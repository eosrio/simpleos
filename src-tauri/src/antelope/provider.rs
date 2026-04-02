use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use crate::antelope::types::ChainInfo;
use crate::error::Error;

/// Request timeout per endpoint.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(5);
/// Health check timeout (faster — we just need get_info).
const HEALTH_CHECK_TIMEOUT: Duration = Duration::from_secs(2);
/// How many consecutive failures before circuit-breaking an endpoint.
const CIRCUIT_BREAKER_THRESHOLD: u32 = 3;
/// How long a circuit-broken endpoint stays down before re-check.
const CIRCUIT_BREAKER_COOLDOWN: Duration = Duration::from_secs(60);
/// Maximum latency to consider an endpoint healthy (ms).
const MAX_HEALTHY_LATENCY_MS: u64 = 1200;

// ── Endpoint State ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointState {
    pub url: String,
    #[serde(default)]
    pub owner: Option<String>,
    /// Last measured latency in ms, -1 = failed, 0 = not checked.
    pub latency_ms: i64,
    /// Consecutive failure count.
    #[serde(skip)]
    pub failures: u32,
    /// When the endpoint was last checked.
    #[serde(skip)]
    pub last_check: Option<Instant>,
    /// When the circuit was tripped (if circuit-broken).
    #[serde(skip)]
    pub circuit_broken_at: Option<Instant>,
}

impl EndpointState {
    pub fn new(url: &str, owner: Option<&str>) -> Self {
        Self {
            url: url.trim_end_matches('/').to_string(),
            owner: owner.map(|s| s.to_string()),
            latency_ms: 0,
            failures: 0,
            last_check: None,
            circuit_broken_at: None,
        }
    }

    pub fn is_healthy(&self) -> bool {
        self.latency_ms > 0 && self.latency_ms <= MAX_HEALTHY_LATENCY_MS as i64 && !self.is_circuit_broken()
    }

    pub fn is_circuit_broken(&self) -> bool {
        if let Some(tripped_at) = self.circuit_broken_at {
            tripped_at.elapsed() < CIRCUIT_BREAKER_COOLDOWN
        } else {
            false
        }
    }

    fn record_success(&mut self, latency_ms: i64) {
        self.latency_ms = latency_ms;
        self.failures = 0;
        self.circuit_broken_at = None;
        self.last_check = Some(Instant::now());
    }

    fn record_failure(&mut self) {
        self.failures += 1;
        self.latency_ms = -1;
        self.last_check = Some(Instant::now());
        if self.failures >= CIRCUIT_BREAKER_THRESHOLD {
            self.circuit_broken_at = Some(Instant::now());
        }
    }
}

// ── Provider Manager ──

/// Manages multiple RPC and Hyperion endpoints for a single chain.
/// Handles health checks, latency-based selection, failover, and circuit breaking.
pub struct ProviderManager {
    pub chain_id: String,
    pub rpc_endpoints: Vec<EndpointState>,
    pub hyperion_endpoints: Vec<EndpointState>,
    /// Index into rpc_endpoints for the currently active endpoint.
    pub active_rpc_index: usize,
    /// Index into hyperion_endpoints for the currently active Hyperion.
    pub active_hyperion_index: usize,
}

impl ProviderManager {
    pub fn new(chain_id: &str) -> Self {
        Self {
            chain_id: chain_id.to_string(),
            rpc_endpoints: Vec::new(),
            hyperion_endpoints: Vec::new(),
            active_rpc_index: 0,
            active_hyperion_index: 0,
        }
    }

    pub fn add_rpc_endpoint(&mut self, url: &str, owner: Option<&str>) {
        // Deduplicate
        if !self.rpc_endpoints.iter().any(|e| e.url == url.trim_end_matches('/')) {
            self.rpc_endpoints.push(EndpointState::new(url, owner));
        }
    }

    pub fn add_hyperion_endpoint(&mut self, url: &str) {
        let normalized = url.trim_end_matches('/').to_string();
        if !self.hyperion_endpoints.iter().any(|e| e.url == normalized) {
            self.hyperion_endpoints.push(EndpointState::new(url, None));
        }
    }

    /// Get the currently active RPC endpoint URL.
    pub fn active_rpc_url(&self) -> Option<&str> {
        self.rpc_endpoints.get(self.active_rpc_index).map(|e| e.url.as_str())
    }

    /// Get the currently active Hyperion endpoint URL.
    pub fn active_hyperion_url(&self) -> Option<&str> {
        self.hyperion_endpoints.get(self.active_hyperion_index).map(|e| e.url.as_str())
    }

    /// Run health checks on all RPC endpoints in parallel (via threads).
    /// Verifies chain_id matches. Updates latency and selects the best endpoint.
    pub fn check_all_rpc_endpoints(&mut self) -> Vec<EndpointState> {
        let chain_id = self.chain_id.clone();
        let urls: Vec<String> = self.rpc_endpoints.iter().map(|e| e.url.clone()).collect();

        // Run checks in parallel using threads
        let results: Vec<(usize, i64, bool)> = std::thread::scope(|s| {
            let handles: Vec<_> = urls
                .iter()
                .enumerate()
                .map(|(idx, url)| {
                    let url = url.clone();
                    let chain_id = chain_id.clone();
                    s.spawn(move || {
                        let result = check_endpoint_health(&url, &chain_id);
                        (idx, result.0, result.1)
                    })
                })
                .collect();

            handles.into_iter().map(|h| h.join().unwrap()).collect()
        });

        // Apply results
        for (idx, latency_ms, valid) in results {
            if let Some(ep) = self.rpc_endpoints.get_mut(idx) {
                if valid {
                    ep.record_success(latency_ms);
                } else {
                    ep.record_failure();
                }
            }
        }

        // Select best endpoint
        self.select_best_rpc();

        // Return current state for frontend display
        self.rpc_endpoints.clone()
    }

    /// Check all Hyperion endpoints.
    pub fn check_all_hyperion_endpoints(&mut self) -> Vec<EndpointState> {
        let urls: Vec<String> = self.hyperion_endpoints.iter().map(|e| e.url.clone()).collect();

        let results: Vec<(usize, i64, bool)> = std::thread::scope(|s| {
            let handles: Vec<_> = urls
                .iter()
                .enumerate()
                .map(|(idx, url)| {
                    let url = url.clone();
                    s.spawn(move || {
                        let result = check_hyperion_health(&url);
                        (idx, result.0, result.1)
                    })
                })
                .collect();

            handles.into_iter().map(|h| h.join().unwrap()).collect()
        });

        for (idx, latency_ms, valid) in results {
            if let Some(ep) = self.hyperion_endpoints.get_mut(idx) {
                if valid {
                    ep.record_success(latency_ms);
                } else {
                    ep.record_failure();
                }
            }
        }

        self.select_best_hyperion();
        self.hyperion_endpoints.clone()
    }

    /// Select the lowest-latency healthy RPC endpoint.
    fn select_best_rpc(&mut self) {
        let mut best_idx = self.active_rpc_index;
        let mut best_latency = i64::MAX;

        for (idx, ep) in self.rpc_endpoints.iter().enumerate() {
            if ep.is_healthy() && ep.latency_ms < best_latency {
                best_latency = ep.latency_ms;
                best_idx = idx;
            }
        }

        self.active_rpc_index = best_idx;
    }

    fn select_best_hyperion(&mut self) {
        let mut best_idx = self.active_hyperion_index;
        let mut best_latency = i64::MAX;

        for (idx, ep) in self.hyperion_endpoints.iter().enumerate() {
            if ep.is_healthy() && ep.latency_ms < best_latency {
                best_latency = ep.latency_ms;
                best_idx = idx;
            }
        }

        self.active_hyperion_index = best_idx;
    }

    /// Execute an RPC call with automatic failover.
    /// Tries the active endpoint first, then falls back to other healthy endpoints.
    pub fn rpc_call<T, F>(&mut self, path: &str, body: &serde_json::Value, parse: F) -> Result<T, Error>
    where
        F: Fn(serde_json::Value) -> Result<T, Error> + Copy,
    {
        // Try active endpoint first
        if let Some(ep) = self.rpc_endpoints.get(self.active_rpc_index) {
            if !ep.is_circuit_broken() {
                match rpc_post(&ep.url, path, body) {
                    Ok(json) => {
                        if let Some(ep) = self.rpc_endpoints.get_mut(self.active_rpc_index) {
                            ep.failures = 0; // Reset on success
                        }
                        return parse(json);
                    }
                    Err(_) => {
                        if let Some(ep) = self.rpc_endpoints.get_mut(self.active_rpc_index) {
                            ep.record_failure();
                        }
                    }
                }
            }
        }

        // Failover: try other healthy endpoints sorted by latency
        let mut candidates: Vec<(usize, i64)> = self
            .rpc_endpoints
            .iter()
            .enumerate()
            .filter(|(idx, ep)| *idx != self.active_rpc_index && ep.is_healthy())
            .map(|(idx, ep)| (idx, ep.latency_ms))
            .collect();

        candidates.sort_by_key(|(_, lat)| *lat);

        for (idx, _) in candidates {
            let url = self.rpc_endpoints[idx].url.clone();
            match rpc_post(&url, path, body) {
                Ok(json) => {
                    // Promote this endpoint
                    self.active_rpc_index = idx;
                    if let Some(ep) = self.rpc_endpoints.get_mut(idx) {
                        ep.failures = 0;
                    }
                    log::info!("Failover: switched RPC to {}", url);
                    return parse(json);
                }
                Err(_) => {
                    if let Some(ep) = self.rpc_endpoints.get_mut(idx) {
                        ep.record_failure();
                    }
                }
            }
        }

        Err(Error::Rpc("All RPC endpoints failed".into()))
    }

    /// Execute a Hyperion GET call with failover.
    pub fn hyperion_get<T: serde::de::DeserializeOwned>(&mut self, path: &str) -> Result<T, Error> {
        // Try active Hyperion first
        if let Some(ep) = self.hyperion_endpoints.get(self.active_hyperion_index) {
            if !ep.is_circuit_broken() {
                let url = format!("{}{}", ep.url, path);
                match http_get::<T>(&url) {
                    Ok(result) => {
                        if let Some(ep) = self.hyperion_endpoints.get_mut(self.active_hyperion_index) {
                            ep.failures = 0;
                        }
                        return Ok(result);
                    }
                    Err(_) => {
                        if let Some(ep) = self.hyperion_endpoints.get_mut(self.active_hyperion_index) {
                            ep.record_failure();
                        }
                    }
                }
            }
        }

        // Failover
        let mut candidates: Vec<(usize, i64)> = self
            .hyperion_endpoints
            .iter()
            .enumerate()
            .filter(|(idx, ep)| *idx != self.active_hyperion_index && ep.is_healthy())
            .map(|(idx, ep)| (idx, ep.latency_ms))
            .collect();

        candidates.sort_by_key(|(_, lat)| *lat);

        for (idx, _) in candidates {
            let url = format!("{}{}", self.hyperion_endpoints[idx].url, path);
            match http_get::<T>(&url) {
                Ok(result) => {
                    self.active_hyperion_index = idx;
                    if let Some(ep) = self.hyperion_endpoints.get_mut(idx) {
                        ep.failures = 0;
                    }
                    log::info!("Failover: switched Hyperion to {}", self.hyperion_endpoints[idx].url);
                    return Ok(result);
                }
                Err(_) => {
                    if let Some(ep) = self.hyperion_endpoints.get_mut(idx) {
                        ep.record_failure();
                    }
                }
            }
        }

        Err(Error::Rpc("All Hyperion endpoints failed".into()))
    }
}

// ── Thread-safe wrapper for Tauri state ──

pub struct ProviderState(pub Mutex<std::collections::HashMap<String, ProviderManager>>);

impl ProviderState {
    pub fn new() -> Self {
        Self(Mutex::new(std::collections::HashMap::new()))
    }

    /// Get or create a ProviderManager for a chain.
    pub fn get_or_create(&self, chain_id: &str) -> std::sync::MutexGuard<'_, std::collections::HashMap<String, ProviderManager>> {
        let mut map = self.0.lock().unwrap();
        if !map.contains_key(chain_id) {
            map.insert(chain_id.to_string(), ProviderManager::new(chain_id));
        }
        map
    }
}

// ── Low-level HTTP helpers ──

/// Check an RPC endpoint's health by calling get_info and verifying chain_id.
/// Returns (latency_ms, is_valid).
fn check_endpoint_health(url: &str, expected_chain_id: &str) -> (i64, bool) {
    let start = Instant::now();
    let full_url = format!("{}/v1/chain/get_info", url.trim_end_matches('/'));

    match ureq::post(&full_url)
        .timeout(HEALTH_CHECK_TIMEOUT)
        .send_json(serde_json::json!({}))
    {
        Ok(response) => {
            let latency_ms = start.elapsed().as_millis() as i64;
            match response.into_json::<ChainInfo>() {
                Ok(info) => {
                    if info.chain_id == expected_chain_id {
                        (latency_ms, true)
                    } else {
                        log::warn!("{} serves chain {} (expected {})", url, info.chain_id, expected_chain_id);
                        (-1, false)
                    }
                }
                Err(_) => (-1, false),
            }
        }
        Err(_) => (-1, false),
    }
}

/// Check a Hyperion endpoint's health by calling /v2/health.
fn check_hyperion_health(url: &str) -> (i64, bool) {
    let start = Instant::now();
    let full_url = format!("{}/v2/health", url.trim_end_matches('/'));

    match ureq::get(&full_url).timeout(HEALTH_CHECK_TIMEOUT).call() {
        Ok(response) => {
            let latency_ms = start.elapsed().as_millis() as i64;
            // Any 2xx is healthy
            if response.status() >= 200 && response.status() < 300 {
                (latency_ms, true)
            } else {
                (-1, false)
            }
        }
        Err(_) => (-1, false),
    }
}

/// POST to an RPC endpoint and return raw JSON value.
fn rpc_post(base_url: &str, path: &str, body: &serde_json::Value) -> Result<serde_json::Value, Error> {
    let url = format!("{}{}", base_url.trim_end_matches('/'), path);
    let response = ureq::post(&url)
        .timeout(REQUEST_TIMEOUT)
        .send_json(body)
        .map_err(|e| Error::Rpc(format!("{}: {}", url, e)))?;

    response
        .into_json::<serde_json::Value>()
        .map_err(|e| Error::Rpc(format!("Parse error: {}", e)))
}

/// GET from URL and parse JSON.
fn http_get<T: serde::de::DeserializeOwned>(url: &str) -> Result<T, Error> {
    let response = ureq::get(url)
        .timeout(REQUEST_TIMEOUT)
        .call()
        .map_err(|e| Error::Rpc(format!("{}: {}", url, e)))?;

    response
        .into_json::<T>()
        .map_err(|e| Error::Rpc(format!("Parse error: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn endpoint_circuit_breaker() {
        let mut ep = EndpointState::new("https://example.com", None);

        // First two failures — not yet broken
        ep.record_failure();
        ep.record_failure();
        assert!(!ep.is_circuit_broken());

        // Third failure — circuit breaks
        ep.record_failure();
        assert!(ep.is_circuit_broken());

        // Success resets
        ep.record_success(50);
        assert!(!ep.is_circuit_broken());
        assert_eq!(ep.failures, 0);
        assert_eq!(ep.latency_ms, 50);
    }

    #[test]
    fn endpoint_health_check() {
        let mut ep = EndpointState::new("https://example.com", Some("Test"));
        assert!(!ep.is_healthy()); // latency 0 = not checked

        ep.record_success(150);
        assert!(ep.is_healthy());

        ep.record_success(1500); // too slow
        assert!(!ep.is_healthy());
    }

    #[test]
    fn provider_deduplication() {
        let mut pm = ProviderManager::new("test-chain-id");
        pm.add_rpc_endpoint("https://api.example.com", None);
        pm.add_rpc_endpoint("https://api.example.com/", None); // trailing slash
        pm.add_rpc_endpoint("https://api.example.com", None); // exact dupe
        assert_eq!(pm.rpc_endpoints.len(), 1);
    }
}
