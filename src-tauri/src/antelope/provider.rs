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
/// Maximum head-block lag (seconds) before an endpoint is considered stale.
/// A synced Antelope node is always within a couple seconds of real time; this
/// generous ceiling still rejects a node that has forked off / stalled (e.g. a
/// pre-Savanna node stuck days behind) while tolerating brief production hiccups
/// and modest client-clock skew. Stale nodes are rechecked before use; if all
/// remain stale, report failure instead of using old TAPOS/account data.
const MAX_HEAD_LAG_SECS: i64 = 120;
/// SEC-017: hard ceiling for chain JSON RPC response bodies (8 MiB).
pub const MAX_RPC_BODY_BYTES: usize = 8 * 1024 * 1024;
/// SEC-017: hard ceiling for get_info / bp.json / chains.json bodies (1 MiB).
pub const MAX_INFO_BODY_BYTES: usize = 1024 * 1024;

// ── Endpoint State ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointState {
    pub url: String,
    #[serde(default)]
    pub owner: Option<String>,
    /// Last measured latency in ms, -1 = failed, 0 = not checked.
    pub latency_ms: i64,
    /// Whether the endpoint's head block was lagging real time at last check.
    /// A stale endpoint responds fine but is behind consensus (forked/halted),
    /// so it is excluded from selection but never circuit-broken.
    #[serde(default)]
    pub stale: bool,
    /// Consecutive failure count.
    #[serde(skip)]
    pub failures: u32,
    /// When the endpoint was last checked.
    #[serde(skip)]
    pub last_check: Option<Instant>,
    /// When the circuit was tripped (if circuit-broken).
    #[serde(skip)]
    pub circuit_broken_at: Option<Instant>,
    #[serde(skip)]
    verified_at: Option<Instant>,
}

impl EndpointState {
    pub fn new(url: &str, owner: Option<&str>) -> Self {
        Self {
            url: url.trim_end_matches('/').to_string(),
            owner: owner.map(|s| s.to_string()),
            latency_ms: 0,
            stale: false,
            failures: 0,
            last_check: None,
            circuit_broken_at: None,
            verified_at: None,
        }
    }

    pub fn is_healthy(&self) -> bool {
        self.latency_ms > 0
            && self.latency_ms <= MAX_HEALTHY_LATENCY_MS as i64
            && !self.stale
            && !self.is_circuit_broken()
    }

    pub fn is_circuit_broken(&self) -> bool {
        if let Some(tripped_at) = self.circuit_broken_at {
            tripped_at.elapsed() < CIRCUIT_BREAKER_COOLDOWN
        } else {
            false
        }
    }

    fn record_success(&mut self, latency_ms: i64, stale: bool) {
        self.latency_ms = latency_ms;
        self.stale = stale;
        self.failures = 0;
        self.circuit_broken_at = None;
        self.last_check = Some(Instant::now());
    }

    fn record_probe_success(&mut self, latency_ms: i64, stale: bool) {
        let failures = self.failures;
        let circuit = self.circuit_broken_at;
        self.record_success(latency_ms.max(1), stale);
        // A health route cannot establish that a failing application route recovered.
        self.failures = failures;
        self.circuit_broken_at = circuit;
    }

    fn record_failure(&mut self) {
        self.verified_at = None;
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
#[derive(Default)]
struct EndpointPool {
    endpoints: Vec<EndpointState>,
    active: usize,
}

/// Clones share endpoint health and selection, but never hold a lock over I/O.
#[derive(Clone)]
pub struct ProviderManager {
    pub chain_id: String,
    rpc: Arc<std::sync::Mutex<EndpointPool>>,
    hyperion: Arc<std::sync::Mutex<EndpointPool>>,
    client: reqwest::Client,
}

const CALL_BUDGET: Duration = Duration::from_secs(15);
const VERIFY_INTERVAL: Duration = Duration::from_secs(60);

fn pool_lock(pool: &std::sync::Mutex<EndpointPool>) -> std::sync::MutexGuard<'_, EndpointPool> {
    pool.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn candidates(pool: &EndpointPool) -> Vec<(usize, EndpointState)> {
    let mut result: Vec<_> = pool
        .endpoints
        .iter()
        .enumerate()
        .filter(|(_, ep)| !ep.is_circuit_broken())
        .map(|(idx, ep)| (idx, ep.clone()))
        .collect();
    result.sort_by_key(|(idx, ep)| {
        (
            if ep.stale {
                3
            } else if ep.failures > 0 {
                2
            } else if *idx == pool.active {
                0
            } else {
                1
            },
            if ep.latency_ms > 0 {
                ep.latency_ms
            } else {
                i64::MAX
            },
        )
    });
    result
}

impl ProviderManager {
    pub fn new(chain_id: &str) -> Self {
        let client = reqwest::Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .unwrap_or_default();
        Self {
            chain_id: chain_id.into(),
            rpc: Arc::default(),
            hyperion: Arc::default(),
            client,
        }
    }

    pub fn add_rpc_endpoint(&mut self, url: &str, owner: Option<&str>) {
        Self::add(&self.rpc, url, owner);
    }
    pub fn add_hyperion_endpoint(&mut self, url: &str) {
        Self::add(&self.hyperion, url, None);
    }
    fn add(pool: &std::sync::Mutex<EndpointPool>, url: &str, owner: Option<&str>) {
        let mut pool = pool_lock(pool);
        let normalized = url.trim_end_matches('/');
        if !pool.endpoints.iter().any(|ep| ep.url == normalized) {
            pool.endpoints.push(EndpointState::new(normalized, owner));
        }
    }
    pub fn rpc_endpoints(&self) -> Vec<EndpointState> {
        pool_lock(&self.rpc).endpoints.clone()
    }
    pub fn hyperion_endpoints(&self) -> Vec<EndpointState> {
        pool_lock(&self.hyperion).endpoints.clone()
    }
    pub fn active_rpc_url(&self) -> Option<String> {
        let pool = pool_lock(&self.rpc);
        pool.endpoints.get(pool.active).map(|ep| ep.url.clone())
    }
    pub fn active_hyperion_url(&self) -> Option<String> {
        let pool = pool_lock(&self.hyperion);
        pool.endpoints.get(pool.active).map(|ep| ep.url.clone())
    }
    fn success(pool: &std::sync::Mutex<EndpointPool>, idx: usize, latency: i64) {
        let mut pool = pool_lock(pool);
        if let Some(ep) = pool.endpoints.get_mut(idx) {
            ep.record_success(latency.max(1), false);
        }
        pool.active = idx;
    }
    fn failure(pool: &std::sync::Mutex<EndpointPool>, idx: usize) {
        if let Some(ep) = pool_lock(pool).endpoints.get_mut(idx) {
            ep.record_failure();
        }
    }

    pub async fn check_all_rpc_endpoints(&mut self) -> Vec<EndpointState> {
        let mut tasks = tokio::task::JoinSet::new();
        for (idx, ep) in self.rpc_endpoints().into_iter().enumerate() {
            let client = self.client.clone();
            let chain = self.chain_id.clone();
            tasks.spawn(async move {
                (
                    idx,
                    ep.last_check,
                    check_endpoint_health(&client, &ep.url, &chain).await,
                )
            });
        }
        while let Some(Ok((idx, previous, (latency, valid, stale)))) = tasks.join_next().await {
            let mut pool = pool_lock(&self.rpc);
            if let Some(ep) = pool.endpoints.get_mut(idx) {
                // A request that completed after this probe started has newer evidence.
                if ep.last_check != previous {
                    continue;
                }
                if valid {
                    ep.record_probe_success(latency, stale);
                    ep.verified_at = Some(Instant::now());
                } else {
                    ep.record_failure();
                }
            }
        }
        let mut pool = pool_lock(&self.rpc);
        if let Some((idx, _)) = pool
            .endpoints
            .iter()
            .enumerate()
            .filter(|(_, ep)| ep.latency_ms > 0 && !ep.stale && !ep.is_circuit_broken())
            .min_by_key(|(_, ep)| ep.latency_ms)
        {
            pool.active = idx;
        }
        pool.endpoints.clone()
    }

    pub async fn check_all_hyperion_endpoints(&mut self) -> Vec<EndpointState> {
        let mut tasks = tokio::task::JoinSet::new();
        for (idx, ep) in self.hyperion_endpoints().into_iter().enumerate() {
            let client = self.client.clone();
            tasks.spawn(async move {
                (
                    idx,
                    ep.last_check,
                    check_hyperion_health(&client, &ep.url).await,
                )
            });
        }
        while let Some(Ok((idx, previous, (latency, valid)))) = tasks.join_next().await {
            let mut pool = pool_lock(&self.hyperion);
            if let Some(ep) = pool.endpoints.get_mut(idx) {
                if ep.last_check != previous {
                    continue;
                }
                if valid {
                    ep.record_probe_success(latency, false);
                } else {
                    ep.record_failure();
                }
            }
        }
        let mut pool = pool_lock(&self.hyperion);
        if let Some((idx, _)) = pool
            .endpoints
            .iter()
            .enumerate()
            .filter(|(_, ep)| ep.latency_ms > 0 && !ep.is_circuit_broken())
            .min_by_key(|(_, ep)| ep.latency_ms)
        {
            pool.active = idx;
        }
        pool.endpoints.clone()
    }

    async fn verify_rpc(&self, idx: usize, endpoint: &EndpointState) -> bool {
        if !endpoint.stale
            && endpoint
                .verified_at
                .is_some_and(|time| time.elapsed() < VERIFY_INTERVAL)
        {
            return true;
        }
        let (latency, valid, stale) =
            check_endpoint_health(&self.client, &endpoint.url, &self.chain_id).await;
        let mut pool = pool_lock(&self.rpc);
        if let Some(ep) = pool.endpoints.get_mut(idx) {
            if valid {
                ep.record_probe_success(latency, stale);
                ep.verified_at = Some(Instant::now());
            } else {
                ep.record_failure();
            }
        }
        valid && !stale
    }

    pub async fn rpc_call<T, F>(
        &mut self,
        path: &str,
        body: &serde_json::Value,
        parse: F,
    ) -> Result<T, Error>
    where
        F: Fn(serde_json::Value) -> Result<T, Error> + Copy,
    {
        self.rpc_call_compatible_paths(&[path], body, parse).await
    }

    pub async fn rpc_call_compatible_paths<T, F>(
        &mut self,
        paths: &[&str],
        body: &serde_json::Value,
        parse: F,
    ) -> Result<T, Error>
    where
        F: Fn(serde_json::Value) -> Result<T, Error> + Copy,
    {
        let order = candidates(&pool_lock(&self.rpc));
        tokio::time::timeout(CALL_BUDGET, async {
            let mut last_error = String::from("No RPC endpoint is available; retry after the cooldown or check network settings");
            for (idx, endpoint) in order {
                if !self.verify_rpc(idx, &endpoint).await {
                    last_error = format!("{} failed chain/freshness verification", endpoint.url);
                    continue;
                }
                for path in paths {
                    let start = Instant::now();
                    let url = format!("{}{}", endpoint.url, path);
                    match rpc_post(&self.client, &url, body).await {
                        Ok(json) => match parse(json) {
                            Ok(result) => { Self::success(&self.rpc, idx, start.elapsed().as_millis() as i64); return Ok(result); }
                            Err(error) => { last_error = error.to_string(); Self::failure(&self.rpc, idx); break; }
                        },
                        Err(Error::RpcResponse(msg)) if is_unknown_endpoint_response(&msg) => { last_error = msg; continue; }
                        Err(error @ Error::RpcResponse(_)) => {
                            Self::success(&self.rpc, idx, start.elapsed().as_millis() as i64);
                            return Err(error);
                        }
                        Err(error) => { last_error = error.to_string(); Self::failure(&self.rpc, idx); break; }
                    }
                }
            }
            Err(Error::Rpc(format!("All RPC endpoints failed: {}", last_error)))
        }).await.unwrap_or_else(|_| Err(Error::Rpc("RPC request exceeded the 15 second failover budget; retry or check network settings".into())))
    }

    pub async fn hyperion_get<T: serde::de::DeserializeOwned>(
        &mut self,
        path: &str,
    ) -> Result<T, Error> {
        let order = candidates(&pool_lock(&self.hyperion));
        tokio::time::timeout(CALL_BUDGET, async {
            let mut last_error = String::from("No history endpoint configured or all endpoints are cooling down");
            for (idx, endpoint) in order {
                let start = Instant::now();
                match http_get(&self.client, &format!("{}{}", endpoint.url, path)).await {
                    Ok(result) => {
                        Self::success(&self.hyperion, idx, start.elapsed().as_millis() as i64);
                        return Ok(result);
                    }
                    Err(error) => { last_error = error.to_string(); Self::failure(&self.hyperion, idx); }
                }
            }
            Err(Error::Rpc(format!("All history endpoints failed: {}", last_error)))
        }).await.unwrap_or_else(|_| Err(Error::Rpc("History request exceeded the 15 second failover budget; retry or check network settings".into())))
    }
}
// ── Thread-safe wrapper for Tauri state ──

pub struct ProviderState(pub Arc<Mutex<std::collections::HashMap<String, ProviderManager>>>);

impl ProviderState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(std::collections::HashMap::new())))
    }

    /// Hold the registry lock only while cloning a shared provider handle.
    pub async fn get(&self, chain_id: &str) -> Result<ProviderManager, Error> {
        self.0
            .lock()
            .await
            .get(chain_id)
            .cloned()
            .ok_or_else(|| Error::ChainNotFound(chain_id.to_string()))
    }
}

// ── Async HTTP helpers ──

/// Check an RPC endpoint's health by calling get_info and verifying chain_id.
/// Returns (latency_ms, is_valid, is_stale). A stale endpoint (head block
/// lagging real time beyond `MAX_HEAD_LAG_SECS`) is still `valid` — it responds
/// correctly on the right chain — but flagged so selection deprioritizes it
/// without ever circuit-breaking it.
async fn check_endpoint_health(
    client: &reqwest::Client,
    url: &str,
    expected_chain_id: &str,
) -> (i64, bool, bool) {
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
            if !response.status().is_success() {
                return (-1, false, false);
            }
            let latency_ms = start.elapsed().as_millis() as i64;
            // SEC-017: cap the get_info body before parsing.
            let parsed = match read_body_capped(response, MAX_INFO_BODY_BYTES).await {
                Ok(bytes) => serde_json::from_slice::<ChainInfo>(&bytes),
                Err(_) => return (-1, false, false),
            };
            match parsed {
                Ok(info) => {
                    if info.chain_id == expected_chain_id {
                        let stale = is_head_stale(&info.head_block_time);
                        (latency_ms, true, stale)
                    } else {
                        log::warn!(
                            "{} serves chain {} (expected {})",
                            url,
                            info.chain_id,
                            expected_chain_id
                        );
                        (-1, false, false)
                    }
                }
                Err(_) => (-1, false, false),
            }
        }
        Err(_) => (-1, false, false),
    }
}

/// Whether an endpoint's `head_block_time` lags the local clock beyond the
/// staleness ceiling. A node ahead of the local clock (negative lag, e.g. minor
/// clock skew) is never treated as stale. Unparseable times are treated as
/// non-stale so a format quirk can't wrongly sideline a working endpoint.
fn is_head_stale(head_block_time: &str) -> bool {
    let head_secs = match crate::antelope::transaction::parse_block_time(head_block_time) {
        Ok(secs) => secs as i64,
        Err(_) => return false,
    };
    let now_secs = match std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) {
        Ok(d) => d.as_secs() as i64,
        Err(_) => return false,
    };
    now_secs - head_secs > MAX_HEAD_LAG_SECS
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

fn is_unknown_endpoint_response(message: &str) -> bool {
    let lower = message.to_ascii_lowercase();
    lower.contains("unknown endpoint")
        || (lower.contains("http 404") && lower.contains("unspecified"))
}

/// SEC-017: read a response body into memory with a hard byte ceiling.
/// Rejects up-front when a `Content-Length` already exceeds `max_bytes`, and
/// streams chunks so a chunked/length-lying response is aborted the moment the
/// accumulated bytes pass the cap. The existing per-client/per-request timeout
/// still bounds total time. Returns the raw bytes on success.
pub(crate) async fn read_body_capped(
    response: reqwest::Response,
    max_bytes: usize,
) -> Result<Vec<u8>, Error> {
    if let Some(len) = response.content_length() {
        if len > max_bytes as u64 {
            return Err(Error::Rpc(format!(
                "Response body too large: {} bytes (max {})",
                len, max_bytes
            )));
        }
    }

    let mut buf: Vec<u8> = Vec::new();
    let mut response = response;
    loop {
        match response
            .chunk()
            .await
            .map_err(|e| Error::Rpc(format!("Body read error: {}", e)))?
        {
            Some(chunk) => {
                if buf.len() + chunk.len() > max_bytes {
                    return Err(Error::Rpc(format!(
                        "Response body exceeded {} byte cap",
                        max_bytes
                    )));
                }
                buf.extend_from_slice(&chunk);
            }
            None => break,
        }
    }

    Ok(buf)
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
    // SEC-017: cap the buffered response body before parsing.
    let bytes = read_body_capped(response, MAX_RPC_BODY_BYTES).await?;
    let json = serde_json::from_slice::<serde_json::Value>(&bytes)
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
            (_, Some(f)) => format!("{} -> HTTP {}: {}: {}", url, status.as_u16(), what, f),
            (Some(d), None) => format!("{} -> HTTP {}: {}: {}", url, status.as_u16(), what, d),
            (None, None) => format!("{} -> HTTP {}: {}", url, status.as_u16(), what),
        };

        // Gateway/rate-limit/service errors are endpoint failures, not chain
        // rejections. A nodeos exception or FIO field validation is terminal.
        let chain_rejection = json.get("error").is_some_and(|error| {
            error.get("code").and_then(|v| v.as_i64()).is_some()
                && error.get("name").and_then(|v| v.as_str()).is_some()
        });
        if chain_rejection
            || json.get("fields").is_some_and(|v| v.is_array())
            || is_unknown_endpoint_response(&msg)
        {
            return Err(Error::RpcResponse(msg));
        }
        return Err(Error::Rpc(msg));
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

    let status = response.status();
    let bytes = read_body_capped(response, MAX_RPC_BODY_BYTES).await?;
    if !status.is_success() {
        return Err(Error::Rpc(format!("{} -> HTTP {}", url, status.as_u16())));
    }
    let json: serde_json::Value =
        serde_json::from_slice(&bytes).map_err(|e| Error::Rpc(format!("Parse error: {}", e)))?;
    if json.get("error").is_some_and(|v| !v.is_null()) {
        return Err(Error::Rpc("History server returned an error".into()));
    }
    serde_json::from_value(json).map_err(|e| Error::Rpc(format!("Parse error: {}", e)))
}

#[cfg(test)]
#[path = "provider_tests.rs"]
mod reliability_tests;

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

        ep.record_success(50, false);
        assert!(!ep.is_circuit_broken());
        assert_eq!(ep.failures, 0);
        assert_eq!(ep.latency_ms, 50);
    }

    #[test]
    fn endpoint_health_check() {
        let mut ep = EndpointState::new("https://example.com", Some("Test"));
        assert!(!ep.is_healthy());

        ep.record_success(150, false);
        assert!(ep.is_healthy());

        ep.record_success(1500, false);
        assert!(!ep.is_healthy());
    }

    #[test]
    fn stale_endpoint_is_unhealthy_but_not_circuit_broken() {
        let mut ep = EndpointState::new("https://stale.example.com", None);
        // Fast latency but flagged stale (head lagging real time).
        ep.record_success(50, true);
        assert!(!ep.is_healthy(), "stale endpoint must not be selectable");
        assert!(
            !ep.is_circuit_broken(),
            "staleness must never trip the circuit breaker"
        );
        assert_eq!(ep.failures, 0, "staleness must not count as a failure");

        // Once it catches up, it becomes healthy again.
        ep.record_success(50, false);
        assert!(ep.is_healthy());
    }

    #[test]
    fn head_staleness_thresholds() {
        // A far-past head time is stale; a future one (clock skew) is not.
        // Stay within the u32-seconds range parse_block_time supports (<~2106).
        assert!(is_head_stale("2000-01-01T00:00:00.000"));
        assert!(!is_head_stale("2100-01-01T00:00:00.000"));
        // Garbage is treated as non-stale (never sideline on a parse quirk).
        assert!(!is_head_stale("not-a-time"));
    }

    #[test]
    fn provider_deduplication() {
        let mut pm = ProviderManager::new("test-chain-id");
        pm.add_rpc_endpoint("https://api.example.com", None);
        pm.add_rpc_endpoint("https://api.example.com/", None);
        pm.add_rpc_endpoint("https://api.example.com", None);
        assert_eq!(pm.rpc_endpoints().len(), 1);
    }
}
