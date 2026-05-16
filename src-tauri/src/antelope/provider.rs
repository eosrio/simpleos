use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

use crate::antelope::types::ChainInfo;
use crate::error::Error;

/// Request timeout per endpoint.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(5);
/// Health check timeout (faster — we just need get_info).
const HEALTH_CHECK_TIMEOUT: Duration = Duration::from_secs(3);
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
        self.latency_ms > 0
            && self.latency_ms <= MAX_HEALTHY_LATENCY_MS as i64
            && !self.is_circuit_broken()
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
    pub active_rpc_index: usize,
    pub active_hyperion_index: usize,
    client: reqwest::Client,
}

impl ProviderManager {
    pub fn new(chain_id: &str) -> Self {
        let client = reqwest::Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .build()
            .unwrap_or_default();

        Self {
            chain_id: chain_id.to_string(),
            rpc_endpoints: Vec::new(),
            hyperion_endpoints: Vec::new(),
            active_rpc_index: 0,
            active_hyperion_index: 0,
            client,
        }
    }

    pub fn add_rpc_endpoint(&mut self, url: &str, owner: Option<&str>) {
        if !self
            .rpc_endpoints
            .iter()
            .any(|e| e.url == url.trim_end_matches('/'))
        {
            self.rpc_endpoints.push(EndpointState::new(url, owner));
        }
    }

    pub fn add_hyperion_endpoint(&mut self, url: &str) {
        let normalized = url.trim_end_matches('/').to_string();
        if !self.hyperion_endpoints.iter().any(|e| e.url == normalized) {
            self.hyperion_endpoints.push(EndpointState::new(url, None));
        }
    }

    pub fn active_rpc_url(&self) -> Option<&str> {
        self.rpc_endpoints
            .get(self.active_rpc_index)
            .map(|e| e.url.as_str())
    }

    pub fn active_hyperion_url(&self) -> Option<&str> {
        self.hyperion_endpoints
            .get(self.active_hyperion_index)
            .map(|e| e.url.as_str())
    }

    /// Run health checks on all RPC endpoints concurrently.
    /// Verifies chain_id matches. Updates latency and selects the best endpoint.
    pub async fn check_all_rpc_endpoints(&mut self) -> Vec<EndpointState> {
        let chain_id = self.chain_id.clone();
        let client = self.client.clone();

        // Launch all checks concurrently
        let mut handles = Vec::new();
        for (idx, ep) in self.rpc_endpoints.iter().enumerate() {
            let url = ep.url.clone();
            let chain_id = chain_id.clone();
            let client = client.clone();
            handles.push(tokio::spawn(async move {
                let result = check_endpoint_health(&client, &url, &chain_id).await;
                (idx, result.0, result.1)
            }));
        }

        // Collect results
        for handle in handles {
            if let Ok((idx, latency_ms, valid)) = handle.await {
                if let Some(ep) = self.rpc_endpoints.get_mut(idx) {
                    if valid {
                        ep.record_success(latency_ms);
                    } else {
                        ep.record_failure();
                    }
                }
            }
        }

        self.select_best_rpc();
        self.rpc_endpoints.clone()
    }

    /// Check all Hyperion endpoints concurrently.
    pub async fn check_all_hyperion_endpoints(&mut self) -> Vec<EndpointState> {
        let client = self.client.clone();

        let mut handles = Vec::new();
        for (idx, ep) in self.hyperion_endpoints.iter().enumerate() {
            let url = ep.url.clone();
            let client = client.clone();
            handles.push(tokio::spawn(async move {
                let result = check_hyperion_health(&client, &url).await;
                (idx, result.0, result.1)
            }));
        }

        for handle in handles {
            if let Ok((idx, latency_ms, valid)) = handle.await {
                if let Some(ep) = self.hyperion_endpoints.get_mut(idx) {
                    if valid {
                        ep.record_success(latency_ms);
                    } else {
                        ep.record_failure();
                    }
                }
            }
        }

        self.select_best_hyperion();
        self.hyperion_endpoints.clone()
    }

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

    /// Execute an RPC POST call with automatic failover.
    pub async fn rpc_call<T, F>(
        &mut self,
        path: &str,
        body: &serde_json::Value,
        parse: F,
    ) -> Result<T, Error>
    where
        F: Fn(serde_json::Value) -> Result<T, Error> + Copy,
    {
        // Try active endpoint first
        if let Some(ep) = self.rpc_endpoints.get(self.active_rpc_index) {
            if !ep.is_circuit_broken() {
                let url = format!("{}{}", ep.url, path);
                match rpc_post(&self.client, &url, body).await {
                    Ok(json) => {
                        if let Some(ep) = self.rpc_endpoints.get_mut(self.active_rpc_index) {
                            ep.failures = 0;
                        }
                        return parse(json);
                    }
                    // HTTP response errors mean the endpoint is fine but rejected
                    // the request — propagate without failover.
                    Err(e @ Error::RpcResponse(_)) => {
                        if let Some(ep) = self.rpc_endpoints.get_mut(self.active_rpc_index) {
                            ep.failures = 0; // endpoint is healthy
                        }
                        return Err(e);
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
            let url = format!("{}{}", self.rpc_endpoints[idx].url, path);
            match rpc_post(&self.client, &url, body).await {
                Ok(json) => {
                    self.active_rpc_index = idx;
                    if let Some(ep) = self.rpc_endpoints.get_mut(idx) {
                        ep.failures = 0;
                    }
                    log::info!("Failover: switched RPC to {}", self.rpc_endpoints[idx].url);
                    return parse(json);
                }
                Err(e @ Error::RpcResponse(_)) => {
                    // Endpoint works, request was rejected — propagate immediately.
                    self.active_rpc_index = idx;
                    if let Some(ep) = self.rpc_endpoints.get_mut(idx) {
                        ep.failures = 0;
                    }
                    return Err(e);
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
    pub async fn hyperion_get<T: serde::de::DeserializeOwned>(
        &mut self,
        path: &str,
    ) -> Result<T, Error> {
        // Try active Hyperion first
        if let Some(ep) = self.hyperion_endpoints.get(self.active_hyperion_index) {
            if !ep.is_circuit_broken() {
                let url = format!("{}{}", ep.url, path);
                match http_get::<T>(&self.client, &url).await {
                    Ok(result) => {
                        if let Some(ep) =
                            self.hyperion_endpoints.get_mut(self.active_hyperion_index)
                        {
                            ep.failures = 0;
                        }
                        return Ok(result);
                    }
                    Err(_) => {
                        if let Some(ep) =
                            self.hyperion_endpoints.get_mut(self.active_hyperion_index)
                        {
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
            match http_get::<T>(&self.client, &url).await {
                Ok(result) => {
                    self.active_hyperion_index = idx;
                    if let Some(ep) = self.hyperion_endpoints.get_mut(idx) {
                        ep.failures = 0;
                    }
                    log::info!(
                        "Failover: switched Hyperion to {}",
                        self.hyperion_endpoints[idx].url
                    );
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

pub struct ProviderState(pub Arc<Mutex<std::collections::HashMap<String, ProviderManager>>>);

impl ProviderState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(std::collections::HashMap::new())))
    }
}

// ── Async HTTP helpers ──

/// Check an RPC endpoint's health by calling get_info and verifying chain_id.
/// Returns (latency_ms, is_valid).
async fn check_endpoint_health(
    client: &reqwest::Client,
    url: &str,
    expected_chain_id: &str,
) -> (i64, bool) {
    let start = Instant::now();
    let full_url = format!("{}/v1/chain/get_info", url.trim_end_matches('/'));

    let result = client
        .post(&full_url)
        .timeout(HEALTH_CHECK_TIMEOUT)
        .json(&serde_json::json!({}))
        .send()
        .await;

    match result {
        Ok(response) => {
            let latency_ms = start.elapsed().as_millis() as i64;
            match response.json::<ChainInfo>().await {
                Ok(info) => {
                    if info.chain_id == expected_chain_id {
                        (latency_ms, true)
                    } else {
                        log::warn!(
                            "{} serves chain {} (expected {})",
                            url,
                            info.chain_id,
                            expected_chain_id
                        );
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
async fn check_hyperion_health(client: &reqwest::Client, url: &str) -> (i64, bool) {
    let start = Instant::now();
    let full_url = format!("{}/v2/health", url.trim_end_matches('/'));

    match client
        .get(&full_url)
        .timeout(HEALTH_CHECK_TIMEOUT)
        .send()
        .await
    {
        Ok(response) => {
            let latency_ms = start.elapsed().as_millis() as i64;
            if response.status().is_success() {
                (latency_ms, true)
            } else {
                (-1, false)
            }
        }
        Err(_) => (-1, false),
    }
}

/// POST to an RPC endpoint and return raw JSON value.
/// Treats any non-2xx HTTP status as an error, extracting the nodeos error
/// details from the response body if possible.
async fn rpc_post(
    client: &reqwest::Client,
    url: &str,
    body: &serde_json::Value,
) -> Result<serde_json::Value, Error> {
    let response = client
        .post(url)
        .json(body)
        .send()
        .await
        .map_err(|e| Error::Rpc(format!("{}: {}", url, e)))?;

    let status = response.status();
    let json = response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| Error::Rpc(format!("Parse error: {}", e)))?;

    if !status.is_success() {
        // Extract nodeos error details when available. Typical shape:
        //   { "code": 500, "message": "...", "error": { "what": "...", "details": [...] } }
        let what = json
            .get("error")
            .and_then(|e| e.get("what"))
            .and_then(|w| w.as_str())
            .or_else(|| json.get("message").and_then(|m| m.as_str()))
            .unwrap_or("unknown error");

        // Append first detail message if available (usually the root cause)
        let detail = json
            .get("error")
            .and_then(|e| e.get("details"))
            .and_then(|d| d.as_array())
            .and_then(|arr| arr.first())
            .and_then(|d| d.get("message"))
            .and_then(|m| m.as_str());

        // FIO's request validator returns the real cause in a top-level
        // `fields` array: [{ "name", "value", "error" }]. nodeos's generic
        // `message` ("...check the nested errors...") is useless without it.
        let fio_fields = json
            .get("fields")
            .and_then(|f| f.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|f| {
                        let name = f.get("name").and_then(|v| v.as_str()).unwrap_or("?");
                        let err = f.get("error").and_then(|v| v.as_str())?;
                        Some(format!("{}: {}", name, err))
                    })
                    .collect::<Vec<_>>()
                    .join("; ")
            })
            .filter(|s| !s.is_empty());

        let msg = match (detail, fio_fields) {
            (_, Some(f)) => format!("HTTP {}: {}: {}", status.as_u16(), what, f),
            (Some(d), None) => format!("HTTP {}: {}: {}", status.as_u16(), what, d),
            (None, None) => format!("HTTP {}: {}", status.as_u16(), what),
        };

        // Use RpcResponse to signal "endpoint is fine, request was rejected" —
        // callers should propagate without triggering failover.
        return Err(Error::RpcResponse(msg));
    }

    Ok(json)
}

/// GET from URL and parse JSON.
async fn http_get<T: serde::de::DeserializeOwned>(
    client: &reqwest::Client,
    url: &str,
) -> Result<T, Error> {
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| Error::Rpc(format!("{}: {}", url, e)))?;

    response
        .json::<T>()
        .await
        .map_err(|e| Error::Rpc(format!("Parse error: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn endpoint_circuit_breaker() {
        let mut ep = EndpointState::new("https://example.com", None);

        ep.record_failure();
        ep.record_failure();
        assert!(!ep.is_circuit_broken());

        ep.record_failure();
        assert!(ep.is_circuit_broken());

        ep.record_success(50);
        assert!(!ep.is_circuit_broken());
        assert_eq!(ep.failures, 0);
        assert_eq!(ep.latency_ms, 50);
    }

    #[test]
    fn endpoint_health_check() {
        let mut ep = EndpointState::new("https://example.com", Some("Test"));
        assert!(!ep.is_healthy());

        ep.record_success(150);
        assert!(ep.is_healthy());

        ep.record_success(1500);
        assert!(!ep.is_healthy());
    }

    #[test]
    fn provider_deduplication() {
        let mut pm = ProviderManager::new("test-chain-id");
        pm.add_rpc_endpoint("https://api.example.com", None);
        pm.add_rpc_endpoint("https://api.example.com/", None);
        pm.add_rpc_endpoint("https://api.example.com", None);
        assert_eq!(pm.rpc_endpoints.len(), 1);
    }
}
