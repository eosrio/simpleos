use super::*;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

struct Server {
    url: String,
    stop: Arc<AtomicBool>,
    calls: Arc<AtomicUsize>,
}

impl Server {
    fn new(status: u16, body: serde_json::Value, delay_ms: u64) -> Self {
        Self::with_chain(status, body, delay_ms, "test-chain")
    }
    fn with_chain(status: u16, body: serde_json::Value, delay_ms: u64, chain: &str) -> Self {
        let chain = chain.to_string();
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let stop = Arc::new(AtomicBool::new(false));
        let calls = Arc::new(AtomicUsize::new(0));
        let stopped = stop.clone();
        let counted = calls.clone();
        std::thread::spawn(move || {
            while !stopped.load(Ordering::Relaxed) {
                match listener.accept() {
                    Ok((mut stream, _)) => {
                        let body = body.clone();
                        let counted = counted.clone();
                        let chain = chain.clone();
                        std::thread::spawn(move || {
                            stream.set_nonblocking(false).unwrap();
                            stream
                                .set_read_timeout(Some(Duration::from_secs(1)))
                                .unwrap();
                            let mut request = Vec::new();
                            loop {
                                let mut buffer = [0; 8192];
                                let Ok(n) = stream.read(&mut buffer) else {
                                    return;
                                };
                                if n == 0 {
                                    return;
                                }
                                request.extend_from_slice(&buffer[..n]);
                                if let Some(end) = request.windows(4).position(|w| w == b"\r\n\r\n")
                                {
                                    let headers =
                                        String::from_utf8_lossy(&request[..end]).to_lowercase();
                                    let length: usize = headers
                                        .lines()
                                        .find_map(|line| line.strip_prefix("content-length:"))
                                        .and_then(|v| v.trim().parse().ok())
                                        .unwrap_or(0);
                                    if request.len() >= end + 4 + length {
                                        break;
                                    }
                                }
                            }
                            counted.fetch_add(1, Ordering::Relaxed);
                            let health = request.starts_with(b"POST /v1/chain/get_info ");
                            let (status, body) = if health {
                                (200, serde_json::json!({"server_version":"test","chain_id":chain,"head_block_num":1,"last_irreversible_block_num":1,"head_block_time":"2100-01-01T00:00:00","head_block_id":"00","last_irreversible_block_id":"00"}).to_string())
                            } else {
                                (status, body.to_string())
                            };
                            if !health {
                                std::thread::sleep(Duration::from_millis(delay_ms));
                            }
                            let reply = format!("HTTP/1.1 {} Test\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", status, body.len(), body);
                            let _ = stream.write_all(reply.as_bytes());
                        });
                    }
                    Err(_) => std::thread::sleep(Duration::from_millis(1)),
                }
            }
        });
        Self { url, stop, calls }
    }
}
impl Drop for Server {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
    }
}

#[tokio::test]
async fn unchecked_backup_recovers_from_gateway_error() {
    let down = Server::new(503, serde_json::json!({"message":"maintenance"}), 0);
    let backup = Server::new(200, serde_json::json!({"rows":[1]}), 0);
    let mut pm = ProviderManager::new("test-chain");
    pm.add_rpc_endpoint(&down.url, None);
    pm.add_rpc_endpoint(&backup.url, None);
    let result = pm
        .rpc_call("/v1/chain/get_table_rows", &serde_json::json!({}), Ok)
        .await
        .unwrap();
    assert_eq!(result["rows"], serde_json::json!([1]));
}

#[tokio::test]
async fn malformed_success_fails_over_before_returning_typed_data() {
    let bad = Server::new(200, serde_json::json!({"unexpected":true}), 0);
    let backup = Server::new(200, serde_json::json!({"rows":[1],"more":false}), 0);
    let mut pm = ProviderManager::new("test-chain");
    pm.add_rpc_endpoint(&bad.url, None);
    pm.add_rpc_endpoint(&backup.url, None);
    let result: crate::antelope::types::TableRowsResult = pm
        .rpc_call(
            "/v1/chain/get_table_rows",
            &serde_json::json!({}),
            |value| serde_json::from_value(value).map_err(|e| Error::Rpc(e.to_string())),
        )
        .await
        .unwrap();
    assert_eq!(result.rows.len(), 1);
}

#[tokio::test]
async fn history_http_error_is_not_empty_success() {
    let down = Server::new(
        503,
        serde_json::json!({"actions":[],"message":"maintenance"}),
        0,
    );
    let backup = Server::new(200, serde_json::json!({"actions":[{"trx_id":"real"}]}), 0);
    let mut pm = ProviderManager::new("test-chain");
    pm.add_hyperion_endpoint(&down.url);
    pm.add_hyperion_endpoint(&backup.url);
    let result: serde_json::Value = pm.hyperion_get("/v2/history/get_actions").await.unwrap();
    assert_eq!(result["actions"][0]["trx_id"], "real");
}

#[tokio::test]
async fn chain_rejection_does_not_retry_a_transaction() {
    let reject = Server::new(
        500,
        serde_json::json!({"error":{"code":3050003,"name":"eosio_assert_message_exception","what":"overdrawn balance"}}),
        0,
    );
    let backup = Server::new(200, serde_json::json!({"transaction_id":"unexpected"}), 0);
    let mut pm = ProviderManager::new("test-chain");
    pm.add_rpc_endpoint(&reject.url, None);
    pm.add_rpc_endpoint(&backup.url, None);
    let result = pm
        .rpc_call_compatible_paths(&["/v1/chain/push_transaction"], &serde_json::json!({}), Ok)
        .await;
    assert!(matches!(result, Err(Error::RpcResponse(_))), "{result:?}");
    assert_eq!(backup.calls.load(Ordering::Relaxed), 0);
}

#[tokio::test]
async fn wrong_chain_never_receives_the_requested_action() {
    let wrong = Server::with_chain(200, serde_json::json!({"wrong":true}), 0, "other-chain");
    let backup = Server::new(200, serde_json::json!({"right":true}), 0);
    let mut pm = ProviderManager::new("test-chain");
    pm.add_rpc_endpoint(&wrong.url, None);
    pm.add_rpc_endpoint(&backup.url, None);
    let response = pm
        .rpc_call("/v1/chain/get_account", &serde_json::json!({}), Ok)
        .await
        .unwrap();
    assert_eq!(response["right"], true);
    assert_eq!(
        wrong.calls.load(Ordering::Relaxed),
        1,
        "only get_info may reach the wrong chain"
    );
}

#[tokio::test]
async fn timeout_fails_over_and_selection_is_shared_between_requests() {
    let slow = Server::new(200, serde_json::json!({"slow":true}), 250);
    let backup = Server::new(200, serde_json::json!({"right":true}), 0);
    let mut pm = ProviderManager::new("test-chain");
    pm.client = reqwest::Client::builder()
        .timeout(Duration::from_millis(50))
        .build()
        .unwrap();
    pm.add_rpc_endpoint(&slow.url, None);
    pm.add_rpc_endpoint(&backup.url, None);
    let observer = pm.clone();
    let result = pm
        .rpc_call("/v1/chain/get_account", &serde_json::json!({}), Ok)
        .await
        .unwrap();
    assert_eq!(result["right"], true);
    assert_eq!(observer.active_rpc_url().unwrap(), backup.url);
}

#[tokio::test]
async fn slow_history_does_not_block_rpc_or_the_provider_registry() {
    let slow = Server::new(200, serde_json::json!({"actions":[]}), 500);
    let fast = Server::new(200, serde_json::json!({"ready":true}), 0);
    let state = Arc::new(ProviderState::new());
    let mut pm = ProviderManager::new("test-chain");
    pm.add_rpc_endpoint(&fast.url, None);
    pm.add_hyperion_endpoint(&slow.url);
    state.0.lock().await.insert("test-chain".into(), pm);
    let background_state = state.clone();
    let background = tokio::spawn(async move {
        background_state
            .get("test-chain")
            .await
            .unwrap()
            .hyperion_get::<serde_json::Value>("/v2/history/get_actions")
            .await
    });
    tokio::time::timeout(Duration::from_secs(1), async {
        while slow.calls.load(Ordering::Relaxed) == 0 {
            tokio::time::sleep(Duration::from_millis(1)).await;
        }
    })
    .await
    .unwrap();
    let response = tokio::time::timeout(Duration::from_millis(250), async {
        state
            .get("test-chain")
            .await
            .unwrap()
            .rpc_call("/v1/chain/get_account", &serde_json::json!({}), Ok)
            .await
    })
    .await
    .expect("history must not hold the registry or RPC lock")
    .unwrap();
    assert_eq!(response["ready"], true);
    assert!(!background.is_finished());
    background.await.unwrap().unwrap();
}

#[tokio::test]
async fn route_failures_trip_the_circuit_even_when_get_info_works() {
    let down = Server::new(503, serde_json::json!({"message":"busy"}), 0);
    let mut pm = ProviderManager::new("test-chain");
    pm.add_rpc_endpoint(&down.url, None);
    for _ in 0..3 {
        assert!(pm
            .rpc_call("/v1/chain/get_account", &serde_json::json!({}), Ok)
            .await
            .is_err());
    }
    assert!(pm.rpc_endpoints()[0].is_circuit_broken());
    pm.check_all_rpc_endpoints().await;
    assert!(
        pm.rpc_endpoints()[0].is_circuit_broken(),
        "background health checks must preserve route failures"
    );
    let count = down.calls.load(Ordering::Relaxed);
    assert!(pm
        .rpc_call("/v1/chain/get_account", &serde_json::json!({}), Ok)
        .await
        .is_err());
    assert_eq!(down.calls.load(Ordering::Relaxed), count);
}

#[tokio::test]
async fn recovered_backup_is_retried_after_cooldown_without_a_health_sweep() {
    let down = Server::new(503, serde_json::json!({"message":"busy"}), 0);
    let backup = Server::new(200, serde_json::json!({"ready":true}), 0);
    let mut pm = ProviderManager::new("test-chain");
    pm.add_rpc_endpoint(&down.url, None);
    pm.add_rpc_endpoint(&backup.url, None);
    {
        let mut pool = pool_lock(&pm.rpc);
        let ep = &mut pool.endpoints[1];
        ep.latency_ms = -1;
        ep.failures = 3;
        ep.circuit_broken_at =
            Some(Instant::now() - CIRCUIT_BREAKER_COOLDOWN - Duration::from_secs(1));
    }
    let result = pm
        .rpc_call("/v1/chain/get_account", &serde_json::json!({}), Ok)
        .await
        .unwrap();
    assert_eq!(result["ready"], true);
    assert_eq!(pm.rpc_endpoints()[1].failures, 0);
}

#[tokio::test]
async fn slow_but_working_backup_is_not_disqualified_by_latency() {
    let down = Server::new(503, serde_json::json!({"message":"busy"}), 0);
    let backup = Server::new(200, serde_json::json!({"ready":true}), 0);
    let mut pm = ProviderManager::new("test-chain");
    pm.add_rpc_endpoint(&down.url, None);
    pm.add_rpc_endpoint(&backup.url, None);
    pool_lock(&pm.rpc).endpoints[1].record_success(2000, false);
    assert!(pm
        .rpc_call("/v1/chain/get_account", &serde_json::json!({}), Ok)
        .await
        .is_ok());
}

#[tokio::test]
#[ignore = "Read-only mainnet RPC/history snapshot; requires network"]
async fn runtime_mainnet_read_probe() {
    let mut jobs = tokio::task::JoinSet::new();
    for chain in crate::antelope::chain_config::default_chains()
        .into_iter()
        .filter(|c| !c.testnet)
    {
        jobs.spawn(async move {
            let mut pm = ProviderManager::new(&chain.id);
            for ep in &chain.endpoints { pm.add_rpc_endpoint(&ep.url, ep.owner.as_deref()); }
            for ep in &chain.hyperion_apis { pm.add_hyperion_endpoint(ep); }
            let endpoints = pm.check_all_rpc_endpoints().await;
            let account = pm.rpc_call("/v1/chain/get_account", &serde_json::json!({"account_name":"eosio"}), |v|
                serde_json::from_value::<crate::antelope::types::AccountInfo>(v).map_err(|e| Error::Rpc(e.to_string()))).await;
            let abi = pm.rpc_call("/v1/chain/get_abi", &serde_json::json!({"account_name":chain.system_contract}), |v|
                if v["abi"]["actions"].is_array() { Ok(v) } else { Err(Error::Rpc("ABI actions missing".into())) }).await;
            let producers = pm.rpc_call("/v1/chain/get_producers", &serde_json::json!({"limit":10,"json":true}), |v|
                if v["rows"].is_array() || v["producers"].is_array() { Ok(v) } else { Err(Error::Rpc("Producer rows missing".into())) }).await;
            let history = if chain.hyperion_apis.is_empty() { "not configured".to_string() } else {
                match pm.hyperion_get::<serde_json::Value>("/v2/history/get_actions?account=eosio&limit=1&sort=desc").await {
                    Ok(v) if v["actions"].is_array() => "ok".into(),
                    Ok(_) => "invalid history payload".into(),
                    Err(e) => e.to_string(),
                }
            };
            serde_json::json!({"chain":chain.name,"chain_id":chain.id,"active_rpc":pm.active_rpc_url(),"active_history":pm.active_hyperion_url(),
                "account": account.map(|_| "ok".to_string()).unwrap_or_else(|e| e.to_string()),
                "system_abi": abi.map(|_| "ok".to_string()).unwrap_or_else(|e| e.to_string()),
                "producers": producers.map(|_| "ok".to_string()).unwrap_or_else(|e| e.to_string()),
                "history":history,"endpoints":endpoints})
        });
    }
    let mut results = Vec::new();
    while let Some(result) = jobs.join_next().await {
        results.push(result.unwrap());
    }
    results.sort_by_key(|r| r["chain"].as_str().unwrap_or_default().to_string());
    let failures: Vec<_> = results
        .iter()
        .filter(|r| {
            r["account"] != "ok"
                || r["system_abi"] != "ok"
                || r["producers"] != "ok"
                || (r["history"] != "ok" && r["history"] != "not configured")
        })
        .map(|r| r["chain"].clone())
        .collect();
    let report = serde_json::json!({"captured_at_unix":std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),"results":results});
    std::fs::create_dir_all("../tmp").unwrap();
    std::fs::write(
        "../tmp/runtime-mainnet.json",
        serde_json::to_string_pretty(&report).unwrap(),
    )
    .unwrap();
    println!("{}", report);
    assert!(
        failures.is_empty(),
        "Live read acceptance failed for {failures:?}; see tmp/runtime-mainnet.json"
    );
}
