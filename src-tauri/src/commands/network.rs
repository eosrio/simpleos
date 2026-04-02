use tauri::State;

use crate::antelope::provider::{EndpointState, ProviderState};
use crate::antelope::types::*;
use crate::error::Error;

/// Initialize a chain's provider manager with endpoints from config.
#[tauri::command]
pub fn init_chain_providers(
    chain_id: String,
    rpc_endpoints: Vec<EndpointEntry>,
    hyperion_endpoints: Vec<String>,
    providers: State<ProviderState>,
) -> Result<(), Error> {
    let mut map = providers.0.lock().unwrap();
    let pm = map
        .entry(chain_id.clone())
        .or_insert_with(|| crate::antelope::provider::ProviderManager::new(&chain_id));

    for ep in rpc_endpoints {
        pm.add_rpc_endpoint(&ep.url, ep.owner.as_deref());
    }
    for url in hyperion_endpoints {
        pm.add_hyperion_endpoint(&url);
    }

    Ok(())
}

/// Run health checks on all RPC endpoints for a chain. Returns sorted endpoint states.
#[tauri::command]
pub fn check_rpc_endpoints(
    chain_id: String,
    providers: State<ProviderState>,
) -> Result<Vec<EndpointState>, Error> {
    let mut map = providers.0.lock().unwrap();
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    Ok(pm.check_all_rpc_endpoints())
}

/// Run health checks on all Hyperion endpoints for a chain.
#[tauri::command]
pub fn check_hyperion_endpoints(
    chain_id: String,
    providers: State<ProviderState>,
) -> Result<Vec<EndpointState>, Error> {
    let mut map = providers.0.lock().unwrap();
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    Ok(pm.check_all_hyperion_endpoints())
}

/// Get chain info from the best available endpoint (with failover).
#[tauri::command]
pub fn get_chain_info(
    chain_id: String,
    providers: State<ProviderState>,
) -> Result<ChainInfo, Error> {
    let mut map = providers.0.lock().unwrap();
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    pm.rpc_call("/v1/chain/get_info", &serde_json::json!({}), |json| {
        serde_json::from_value(json).map_err(|e| Error::Rpc(format!("Parse error: {}", e)))
    })
}

/// Get account info with failover.
#[tauri::command]
pub fn get_account(
    chain_id: String,
    account_name: String,
    providers: State<ProviderState>,
) -> Result<AccountInfo, Error> {
    let mut map = providers.0.lock().unwrap();
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    pm.rpc_call(
        "/v1/chain/get_account",
        &serde_json::json!({ "account_name": account_name }),
        |json| serde_json::from_value(json).map_err(|e| Error::Rpc(format!("Parse error: {}", e))),
    )
}

/// Get token balance with failover.
#[tauri::command]
pub fn get_balances(
    chain_id: String,
    account: String,
    code: String,
    symbol: String,
    providers: State<ProviderState>,
) -> Result<Vec<String>, Error> {
    let mut map = providers.0.lock().unwrap();
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    pm.rpc_call(
        "/v1/chain/get_currency_balance",
        &serde_json::json!({ "code": code, "account": account, "symbol": symbol }),
        |json| serde_json::from_value(json).map_err(|e| Error::Rpc(format!("Parse error: {}", e))),
    )
}

/// Get table rows with failover.
#[tauri::command]
pub fn get_table_rows(
    chain_id: String,
    params: serde_json::Value,
    providers: State<ProviderState>,
) -> Result<TableRowsResult, Error> {
    let mut map = providers.0.lock().unwrap();
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    pm.rpc_call("/v1/chain/get_table_rows", &params, |json| {
        serde_json::from_value(json).map_err(|e| Error::Rpc(format!("Parse error: {}", e)))
    })
}

/// Get ABI with failover.
#[tauri::command]
pub fn get_abi(
    chain_id: String,
    account_name: String,
    providers: State<ProviderState>,
) -> Result<serde_json::Value, Error> {
    let mut map = providers.0.lock().unwrap();
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    pm.rpc_call(
        "/v1/chain/get_abi",
        &serde_json::json!({ "account_name": account_name }),
        |json| Ok(json),
    )
}

/// Get producers with failover.
#[tauri::command]
pub fn get_producers(
    chain_id: String,
    limit: u32,
    providers: State<ProviderState>,
) -> Result<serde_json::Value, Error> {
    let mut map = providers.0.lock().unwrap();
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    pm.rpc_call(
        "/v1/chain/get_producers",
        &serde_json::json!({ "limit": limit, "lower_bound": "", "json": true }),
        |json| Ok(json),
    )
}

/// Lookup accounts by public key (tries history API with failover).
#[tauri::command]
pub fn lookup_key_accounts(
    chain_id: String,
    public_key: String,
    providers: State<ProviderState>,
) -> Result<KeyAccountsResult, Error> {
    let mut map = providers.0.lock().unwrap();
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    pm.rpc_call(
        "/v1/history/get_key_accounts",
        &serde_json::json!({ "public_key": public_key }),
        |json| serde_json::from_value(json).map_err(|e| Error::Rpc(format!("Parse error: {}", e))),
    )
}

/// Get actions history from Hyperion with failover.
#[tauri::command]
pub fn get_actions_history(
    chain_id: String,
    account: String,
    limit: u32,
    skip: u32,
    providers: State<ProviderState>,
) -> Result<serde_json::Value, Error> {
    let mut map = providers.0.lock().unwrap();
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    let path = format!("/v2/history/get_actions?account={}&limit={}&skip={}", account, limit, skip);
    pm.hyperion_get(&path)
}

/// Get token list from Hyperion with failover.
#[tauri::command]
pub fn get_tokens(
    chain_id: String,
    account: String,
    providers: State<ProviderState>,
) -> Result<serde_json::Value, Error> {
    let mut map = providers.0.lock().unwrap();
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    let path = format!("/v2/state/get_tokens?account={}", account);
    pm.hyperion_get(&path)
}

/// Get the currently active endpoints for a chain.
#[tauri::command]
pub fn get_active_endpoints(
    chain_id: String,
    providers: State<ProviderState>,
) -> Result<ActiveEndpoints, Error> {
    let map = providers.0.lock().unwrap();
    let pm = map
        .get(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    Ok(ActiveEndpoints {
        rpc: pm.active_rpc_url().unwrap_or("").to_string(),
        hyperion: pm.active_hyperion_url().unwrap_or("").to_string(),
        rpc_endpoints: pm.rpc_endpoints.clone(),
        hyperion_endpoints: pm.hyperion_endpoints.clone(),
    })
}

// ── Supporting types ──

#[derive(serde::Deserialize)]
pub struct EndpointEntry {
    pub url: String,
    pub owner: Option<String>,
}

#[derive(serde::Serialize)]
pub struct ActiveEndpoints {
    pub rpc: String,
    pub hyperion: String,
    pub rpc_endpoints: Vec<EndpointState>,
    pub hyperion_endpoints: Vec<EndpointState>,
}
