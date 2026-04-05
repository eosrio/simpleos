//! Endpoint discovery via bp.json / chains.json.
//!
//! Crawls the producer list for a chain, fetches each producer's bp.json,
//! extracts API endpoints, and health-checks them. Emits progress events
//! via Tauri so the frontend can show live status.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Instant;

use crate::antelope::provider::ProviderManager;
use crate::error::Error;

/// Max age of cached endpoints before re-discovery is recommended (24 hours).
const CACHE_MAX_AGE_SECS: u64 = 86400;

/// Progress event payload sent to the frontend.
#[derive(Debug, Clone, Serialize)]
pub struct DiscoveryProgress {
    pub phase: &'static str,
    pub message: String,
    /// 0.0 to 1.0
    pub progress: f32,
    /// Current count of discovered endpoints
    pub endpoints_found: usize,
    /// Current count of healthy endpoints
    pub healthy_count: usize,
}

/// A discovered API endpoint from bp.json.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredEndpoint {
    pub url: String,
    pub endpoint_type: EndpointType,
    pub producer: String,
    pub latency_ms: i64,
    pub healthy: bool,
    /// Detected capabilities (populated during health check).
    #[serde(default)]
    pub capabilities: EndpointCapabilities,
}

/// What APIs an endpoint supports, detected during health check.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct EndpointCapabilities {
    /// Supports /v1/chain/get_accounts_by_authorizers (Leap 5+)
    pub accounts_by_authorizers: bool,
    /// Supports /v1/history/get_key_accounts (legacy history plugin)
    pub v1_history: bool,
    /// Supports Hyperion v2 APIs (/v2/state, /v2/history)
    pub hyperion_v2: bool,
    /// Server version string from get_info
    pub server_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum EndpointType {
    Api,
    Hyperion,
}

/// Minimal bp.json structure — we only care about nodes[].api_endpoint and nodes[].features.
#[derive(Debug, Deserialize)]
struct BpJson {
    #[serde(default)]
    nodes: Vec<BpNode>,
}

#[derive(Debug, Deserialize)]
struct BpNode {
    #[serde(default)]
    api_endpoint: Option<String>,
    #[serde(default)]
    ssl_endpoint: Option<String>,
    #[serde(default)]
    features: Vec<String>,
    #[serde(default)]
    node_type: Option<serde_json::Value>,
}

/// chains.json structure — maps chain_id to bp.json path.
#[derive(Debug, Deserialize)]
#[serde(transparent)]
struct ChainsJson {
    chains: std::collections::HashMap<String, String>,
}

/// Run full endpoint discovery for a chain.
///
/// 1. Fetch producer list from chain
/// 2. For each producer with a URL, fetch bp.json (or chains.json → bp.json)
/// 3. Extract API endpoints
/// 4. Health check all discovered endpoints
/// 5. Register healthy endpoints with the ProviderManager
///
/// Returns discovered endpoints and emits progress events via the callback.
pub async fn discover_endpoints<F>(
    pm: &mut ProviderManager,
    chain_id: &str,
    client: &reqwest::Client,
    mut on_progress: F,
) -> Result<Vec<DiscoveredEndpoint>, Error>
where
    F: FnMut(DiscoveryProgress),
{
    let mut all_endpoints: Vec<DiscoveredEndpoint> = Vec::new();
    let mut healthy_count = 0usize;

    // Phase 1: Fetch producers
    on_progress(DiscoveryProgress {
        phase: "producers",
        message: "Fetching producer list...".into(),
        progress: 0.0,
        endpoints_found: 0,
        healthy_count: 0,
    });

    let producers_json: serde_json::Value = pm
        .rpc_call(
            "/v1/chain/get_producers",
            &serde_json::json!({ "limit": 50, "lower_bound": "", "json": true }),
            |json| Ok(json),
        )
        .await?;

    let producers: Vec<ProducerEntry> = parse_producers(&producers_json);
    let total_producers = producers.len();

    on_progress(DiscoveryProgress {
        phase: "producers",
        message: format!("Found {} producers", total_producers),
        progress: 0.05,
        endpoints_found: 0,
        healthy_count: 0,
    });

    // Phase 2: Crawl bp.json for all producers concurrently (batches of 10)
    let bp_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(4))
        .build()
        .unwrap_or_default();

    let active_producers: Vec<&ProducerEntry> = producers.iter()
        .filter(|p| !p.url.is_empty())
        .collect();
    let total_active = active_producers.len();

    let batch_size = 10;
    let mut completed = 0usize;

    for batch_start in (0..total_active).step_by(batch_size) {
        let batch_end = (batch_start + batch_size).min(total_active);
        let mut handles = Vec::new();

        for &producer in &active_producers[batch_start..batch_end] {
            let client = bp_client.clone();
            let url = producer.url.clone();
            let owner = producer.owner.clone();
            let cid = chain_id.to_string();

            handles.push(tokio::spawn(async move {
                fetch_bp_endpoints(&client, &url, &owner, &cid).await
            }));
        }

        for handle in handles {
            completed += 1;
            if let Ok(endpoints) = handle.await {
                for ep in endpoints {
                    if !all_endpoints.iter().any(|e| e.url == ep.url) {
                        all_endpoints.push(ep);
                    }
                }
            }

            let progress = 0.05 + 0.55 * (completed as f32 / total_active as f32);
            on_progress(DiscoveryProgress {
                phase: "bp_json",
                message: format!("Scanning producers ({}/{}) — {} endpoints", completed, total_active, all_endpoints.len()),
                progress,
                endpoints_found: all_endpoints.len(),
                healthy_count: 0,
            });
        }
    }

    on_progress(DiscoveryProgress {
        phase: "testing",
        message: format!(
            "Discovered {} endpoints, testing...",
            all_endpoints.len()
        ),
        progress: 0.6,
        endpoints_found: all_endpoints.len(),
        healthy_count: 0,
    });

    // Phase 3: Health check all discovered endpoints concurrently
    let total_endpoints = all_endpoints.len();
    let chain_id_owned = chain_id.to_string();

    // Test in batches of 10 to avoid overwhelming
    let batch_size = 10;
    for batch_start in (0..total_endpoints).step_by(batch_size) {
        let batch_end = (batch_start + batch_size).min(total_endpoints);
        let mut handles = Vec::new();

        for idx in batch_start..batch_end {
            let url = all_endpoints[idx].url.clone();
            let ep_type = all_endpoints[idx].endpoint_type.clone();
            let chain_id = chain_id_owned.clone();
            let test_client = client.clone();

            handles.push(tokio::spawn(async move {
                let result = match ep_type {
                    EndpointType::Api => test_api_endpoint(&test_client, &url, &chain_id).await,
                    EndpointType::Hyperion => test_hyperion_endpoint(&test_client, &url).await,
                };
                (idx, result)
            }));
        }

        for handle in handles {
            if let Ok((idx, result)) = handle.await {
                all_endpoints[idx].latency_ms = result.latency_ms;
                all_endpoints[idx].healthy = result.healthy;
                all_endpoints[idx].capabilities = result.capabilities;
                if result.healthy {
                    healthy_count += 1;
                }
            }
        }

        let progress = 0.6 + 0.35 * (batch_end as f32 / total_endpoints.max(1) as f32);
        on_progress(DiscoveryProgress {
            phase: "testing",
            message: format!(
                "Testing endpoints ({}/{}) — {} healthy",
                batch_end, total_endpoints, healthy_count
            ),
            progress,
            endpoints_found: total_endpoints,
            healthy_count,
        });
    }

    // Phase 4: Register healthy endpoints with ProviderManager
    for ep in &all_endpoints {
        if ep.healthy {
            match ep.endpoint_type {
                EndpointType::Api => {
                    pm.add_rpc_endpoint(&ep.url, Some(&ep.producer));
                }
                EndpointType::Hyperion => {
                    pm.add_hyperion_endpoint(&ep.url);
                }
            }
        }
    }

    // Re-run health checks on all registered endpoints to rank them
    pm.check_all_rpc_endpoints().await;
    pm.check_all_hyperion_endpoints().await;

    on_progress(DiscoveryProgress {
        phase: "done",
        message: format!(
            "Discovery complete — {} healthy endpoints",
            healthy_count
        ),
        progress: 1.0,
        endpoints_found: total_endpoints,
        healthy_count,
    });

    Ok(all_endpoints)
}

// ── Helpers ──

#[derive(Debug)]
struct ProducerEntry {
    owner: String,
    url: String,
}

fn parse_producers(json: &serde_json::Value) -> Vec<ProducerEntry> {
    json.get("rows")
        .and_then(|r| r.as_array())
        .map(|rows| {
            rows.iter()
                .filter_map(|row| {
                    let owner = row.get("owner")?.as_str()?;
                    let url = row.get("url").and_then(|u| u.as_str()).unwrap_or("");
                    let is_active = row
                        .get("is_active")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0);
                    if is_active == 1 && !url.is_empty() {
                        Some(ProducerEntry {
                            owner: owner.to_string(),
                            url: normalize_bp_url(url),
                        })
                    } else {
                        None
                    }
                })
                .collect()
        })
        .unwrap_or_default()
}

fn normalize_bp_url(url: &str) -> String {
    let url = url.trim().trim_end_matches('/');
    if url.starts_with("http://") || url.starts_with("https://") {
        url.to_string()
    } else {
        format!("https://{}", url)
    }
}

/// Fetch API endpoints from a producer's bp.json.
/// Tries: {url}/bp.json directly, then {url}/chains.json → chain-specific bp.json.
async fn fetch_bp_endpoints(
    client: &reqwest::Client,
    base_url: &str,
    producer: &str,
    chain_id: &str,
) -> Vec<DiscoveredEndpoint> {
    let mut endpoints = Vec::new();

    // Try chains.json first (more reliable for multi-chain producers)
    if let Some(bp_path) = fetch_chains_json(client, base_url, chain_id).await {
        let bp_url = if bp_path.starts_with("http") {
            bp_path
        } else {
            format!("{}/{}", base_url, bp_path.trim_start_matches('/'))
        };
        if let Ok(bp) = fetch_and_parse_bp_json(client, &bp_url).await {
            extract_endpoints(&bp, producer, &mut endpoints);
            return endpoints;
        }
    }

    // Fallback: direct bp.json
    let bp_url = format!("{}/bp.json", base_url);
    if let Ok(bp) = fetch_and_parse_bp_json(client, &bp_url).await {
        extract_endpoints(&bp, producer, &mut endpoints);
    }

    endpoints
}

async fn fetch_chains_json(
    client: &reqwest::Client,
    base_url: &str,
    chain_id: &str,
) -> Option<String> {
    let url = format!("{}/chains.json", base_url);
    let resp = client.get(&url).send().await.ok()?;
    let chains: ChainsJson = resp.json().await.ok()?;
    chains.chains.get(chain_id).cloned()
}

async fn fetch_and_parse_bp_json(
    client: &reqwest::Client,
    url: &str,
) -> Result<BpJson, Error> {
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| Error::Rpc(format!("bp.json fetch: {}", e)))?;

    resp.json::<BpJson>()
        .await
        .map_err(|e| Error::Rpc(format!("bp.json parse: {}", e)))
}

fn extract_endpoints(bp: &BpJson, producer: &str, out: &mut Vec<DiscoveredEndpoint>) {
    for node in &bp.nodes {
        let is_hyperion = node.features.iter().any(|f| {
            f.eq_ignore_ascii_case("hyperion-v2")
                || f.eq_ignore_ascii_case("history-v2")
        }) || node_type_contains(&node.node_type, "hyperion");

        // Prefer SSL endpoint
        let api_url = node
            .ssl_endpoint
            .as_deref()
            .or(node.api_endpoint.as_deref());

        if let Some(url) = api_url {
            let url = url.trim().trim_end_matches('/');
            if url.is_empty() || (!url.starts_with("https://") && !url.starts_with("http://")) {
                continue;
            }

            let ep_type = if is_hyperion {
                EndpointType::Hyperion
            } else {
                EndpointType::Api
            };

            // Don't add duplicates
            if !out.iter().any(|e| e.url == url) {
                out.push(DiscoveredEndpoint {
                    url: url.to_string(),
                    endpoint_type: ep_type,
                    producer: producer.to_string(),
                    latency_ms: 0,
                    healthy: false,
                    capabilities: EndpointCapabilities::default(),
                });
            }
        }
    }
}

fn node_type_contains(node_type: &Option<serde_json::Value>, needle: &str) -> bool {
    match node_type {
        Some(serde_json::Value::String(s)) => s.eq_ignore_ascii_case(needle),
        Some(serde_json::Value::Array(arr)) => arr.iter().any(|v| {
            v.as_str()
                .map(|s| s.eq_ignore_ascii_case(needle))
                .unwrap_or(false)
        }),
        _ => false,
    }
}

/// Test result with capabilities.
struct EndpointTestResult {
    latency_ms: i64,
    healthy: bool,
    capabilities: EndpointCapabilities,
}

/// Test an API endpoint: verify chain_id and probe capabilities.
async fn test_api_endpoint(
    client: &reqwest::Client,
    url: &str,
    chain_id: &str,
) -> EndpointTestResult {
    let base = url.trim_end_matches('/');
    let start = Instant::now();
    let full_url = format!("{}/v1/chain/get_info", base);

    let info_result = client
        .post(&full_url)
        .timeout(std::time::Duration::from_secs(3))
        .json(&serde_json::json!({}))
        .send()
        .await;

    let (latency, healthy, server_version) = match info_result {
        Ok(resp) => {
            let latency = start.elapsed().as_millis() as i64;
            match resp.json::<serde_json::Value>().await {
                Ok(json) => {
                    let cid = json.get("chain_id").and_then(|v| v.as_str()).unwrap_or("");
                    let ver = json.get("server_version_string")
                        .and_then(|v| v.as_str())
                        .map(String::from);
                    if cid == chain_id {
                        (latency, true, ver)
                    } else {
                        (-1, false, None)
                    }
                }
                Err(_) => (-1, false, None),
            }
        }
        Err(_) => return EndpointTestResult {
            latency_ms: -1,
            healthy: false,
            capabilities: EndpointCapabilities::default(),
        },
    };

    if !healthy {
        return EndpointTestResult {
            latency_ms: latency,
            healthy: false,
            capabilities: EndpointCapabilities::default(),
        };
    }

    // Probe capabilities concurrently
    let probe_timeout = std::time::Duration::from_secs(2);

    let auth_url = format!("{}/v1/chain/get_accounts_by_authorizers", base);
    let hist_url = format!("{}/v1/history/get_key_accounts", base);

    let auth_probe = client
        .post(&auth_url)
        .timeout(probe_timeout)
        .json(&serde_json::json!({ "keys": ["EOS1111111111111111111111111111111114T1Anm"] }))
        .send();

    let hist_probe = client
        .post(&hist_url)
        .timeout(probe_timeout)
        .json(&serde_json::json!({ "public_key": "EOS1111111111111111111111111111111114T1Anm" }))
        .send();

    let (auth_result, hist_result) = tokio::join!(auth_probe, hist_probe);

    // get_accounts_by_authorizers: responds with 200 + JSON (even if empty result)
    // A 404 or 500 means not supported
    let accounts_by_authorizers = match auth_result {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    };

    // v1 history: same logic
    let v1_history = match hist_result {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    };

    EndpointTestResult {
        latency_ms: latency,
        healthy: true,
        capabilities: EndpointCapabilities {
            accounts_by_authorizers,
            v1_history,
            hyperion_v2: false,
            server_version,
        },
    }
}

/// Test a Hyperion endpoint by calling /v2/health.
async fn test_hyperion_endpoint(
    client: &reqwest::Client,
    url: &str,
) -> EndpointTestResult {
    let start = Instant::now();
    let base = url.trim_end_matches('/');
    let full_url = format!("{}/v2/health", base);

    match client
        .get(&full_url)
        .timeout(std::time::Duration::from_secs(3))
        .send()
        .await
    {
        Ok(resp) => {
            let latency = start.elapsed().as_millis() as i64;
            if resp.status().is_success() {
                EndpointTestResult {
                    latency_ms: latency,
                    healthy: true,
                    capabilities: EndpointCapabilities {
                        accounts_by_authorizers: false,
                        v1_history: false,
                        hyperion_v2: true,
                        server_version: None,
                    },
                }
            } else {
                EndpointTestResult {
                    latency_ms: -1,
                    healthy: false,
                    capabilities: EndpointCapabilities::default(),
                }
            }
        }
        Err(_) => EndpointTestResult {
            latency_ms: -1,
            healthy: false,
            capabilities: EndpointCapabilities::default(),
        },
    }
}

// ── Endpoint Cache ──

/// Cached endpoint data stored as JSON per chain.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointCache {
    /// Unix timestamp (seconds) when the cache was written.
    pub cached_at: u64,
    pub chain_id: String,
    pub endpoints: Vec<DiscoveredEndpoint>,
}

fn cache_dir(app_data_dir: &PathBuf) -> PathBuf {
    app_data_dir.join("endpoint_cache")
}

fn cache_path(app_data_dir: &PathBuf, chain_id: &str) -> PathBuf {
    // Use first 16 hex chars of chain_id as filename (unique enough, filesystem-safe)
    let short = &chain_id[..16.min(chain_id.len())];
    cache_dir(app_data_dir).join(format!("{}.json", short))
}

/// Save discovered endpoints to local cache.
pub fn save_cache(
    app_data_dir: &PathBuf,
    chain_id: &str,
    endpoints: &[DiscoveredEndpoint],
) -> Result<(), Error> {
    let dir = cache_dir(app_data_dir);
    std::fs::create_dir_all(&dir)?;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let cache = EndpointCache {
        cached_at: now,
        chain_id: chain_id.to_string(),
        endpoints: endpoints.to_vec(),
    };

    let json = serde_json::to_string_pretty(&cache)
        .map_err(|e| Error::Serialization(e.to_string()))?;

    std::fs::write(cache_path(app_data_dir, chain_id), json)?;
    log::info!("[discovery] Cached {} endpoints for chain {}", endpoints.len(), &chain_id[..8]);
    Ok(())
}

/// Load cached endpoints. Returns None if no cache or cache is expired.
pub fn load_cache(
    app_data_dir: &PathBuf,
    chain_id: &str,
) -> Option<EndpointCache> {
    let path = cache_path(app_data_dir, chain_id);
    let json = std::fs::read_to_string(&path).ok()?;
    let cache: EndpointCache = serde_json::from_str(&json).ok()?;

    // Verify chain_id matches
    if cache.chain_id != chain_id {
        return None;
    }

    Some(cache)
}

/// Check if the cache is still fresh (within CACHE_MAX_AGE_SECS).
pub fn is_cache_fresh(cache: &EndpointCache) -> bool {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    now.saturating_sub(cache.cached_at) < CACHE_MAX_AGE_SECS
}
