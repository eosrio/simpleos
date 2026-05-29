use std::collections::HashMap;
use tauri::{Emitter, Manager, State};

use crate::antelope::discovery::{self, DiscoveredEndpoint};
use crate::antelope::powerup;
use crate::antelope::provider::{EndpointState, ProviderManager, ProviderState};
use crate::antelope::types::*;
use crate::error::Error;

type ProviderMap<'a> = tokio::sync::MutexGuard<'a, HashMap<String, ProviderManager>>;

/// Initialize a chain's provider manager with endpoints from config.
#[tauri::command]
pub async fn init_chain_providers(
    chain_id: String,
    rpc_endpoints: Vec<EndpointEntry>,
    hyperion_endpoints: Vec<String>,
    providers: State<'_, ProviderState>,
) -> Result<(), Error> {
    let mut map = providers.0.lock().await;
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
pub async fn check_rpc_endpoints(
    chain_id: String,
    providers: State<'_, ProviderState>,
) -> Result<Vec<EndpointState>, Error> {
    let mut map: ProviderMap<'_> = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    Ok(pm.check_all_rpc_endpoints().await)
}

/// Run health checks on all Hyperion endpoints for a chain.
#[tauri::command]
pub async fn check_hyperion_endpoints(
    chain_id: String,
    providers: State<'_, ProviderState>,
) -> Result<Vec<EndpointState>, Error> {
    let mut map: ProviderMap<'_> = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    Ok(pm.check_all_hyperion_endpoints().await)
}

/// Get chain info from the best available endpoint (with failover).
#[tauri::command]
pub async fn get_chain_info(
    chain_id: String,
    providers: State<'_, ProviderState>,
) -> Result<ChainInfo, Error> {
    let mut map: ProviderMap<'_> = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    pm.rpc_call("/v1/chain/get_info", &serde_json::json!({}), |json| {
        serde_json::from_value(json).map_err(|e| Error::Rpc(format!("Parse error: {}", e)))
    })
    .await
}

/// Get account info with failover.
#[tauri::command]
pub async fn get_account(
    chain_id: String,
    account_name: String,
    providers: State<'_, ProviderState>,
) -> Result<AccountInfo, Error> {
    let mut map: ProviderMap<'_> = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    pm.rpc_call(
        "/v1/chain/get_account",
        &serde_json::json!({ "account_name": account_name }),
        |json| serde_json::from_value(json).map_err(|e| Error::Rpc(format!("Parse error: {}", e))),
    )
    .await
}

/// Get token balance with failover.
#[tauri::command]
pub async fn get_balances(
    chain_id: String,
    account: String,
    code: String,
    symbol: String,
    providers: State<'_, ProviderState>,
) -> Result<Vec<String>, Error> {
    let mut map: ProviderMap<'_> = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    pm.rpc_call(
        "/v1/chain/get_currency_balance",
        &serde_json::json!({ "code": code, "account": account, "symbol": symbol }),
        |json| serde_json::from_value(json).map_err(|e| Error::Rpc(format!("Parse error: {}", e))),
    )
    .await
}

/// Get table rows with failover.
#[tauri::command]
pub async fn get_table_rows(
    chain_id: String,
    params: serde_json::Value,
    providers: State<'_, ProviderState>,
) -> Result<TableRowsResult, Error> {
    let mut map: ProviderMap<'_> = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    pm.rpc_call("/v1/chain/get_table_rows", &params, |json| {
        serde_json::from_value(json).map_err(|e| Error::Rpc(format!("Parse error: {}", e)))
    })
    .await
}

/// Get ABI with failover.
#[tauri::command]
pub async fn get_abi(
    chain_id: String,
    account_name: String,
    providers: State<'_, ProviderState>,
) -> Result<serde_json::Value, Error> {
    let mut map: ProviderMap<'_> = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    pm.rpc_call(
        "/v1/chain/get_abi",
        &serde_json::json!({ "account_name": account_name }),
        |json| Ok(json),
    )
    .await
}

/// Get producers with failover.
#[tauri::command]
pub async fn get_producers(
    chain_id: String,
    limit: u32,
    providers: State<'_, ProviderState>,
) -> Result<serde_json::Value, Error> {
    let mut map: ProviderMap<'_> = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    pm.rpc_call(
        "/v1/chain/get_producers",
        &serde_json::json!({ "limit": limit, "lower_bound": "", "json": true }),
        |json| Ok(json),
    )
    .await
}

/// Lookup accounts by public key. Pure business logic — testable without Tauri state.
/// Tries both `EOS...` and `PUB_K1_...` formats across three sources in order:
///   1. `/v1/chain/get_accounts_by_authorizers` (Leap/Spring 5+, requires `enable-account-queries`)
///   2. Hyperion v2 `/v2/state/get_key_accounts`
///   3. Legacy `/v1/history/get_key_accounts` (deprecated)
pub async fn lookup_key_accounts_impl(
    pm: &mut ProviderManager,
    public_key: &str,
) -> Result<KeyAccountsResult, Error> {
    use crate::antelope::signing;

    // Build list of public key formats to try
    let mut key_formats = vec![public_key.to_string()];

    // If EOS format, also try PUB_K1_ and vice versa
    if public_key.starts_with("EOS") {
        if let Ok(raw) = decode_eos_pubkey(public_key) {
            key_formats.push(signing::encode_k1_public_key_from_bytes(&raw));
        }
    } else if public_key.starts_with("PUB_K1_") {
        if let Ok(raw) = decode_k1_pubkey(public_key) {
            key_formats.push(signing::encode_eos_public_key_from_bytes(&raw));
        }
    }

    let mut all_accounts: Vec<String> = Vec::new();
    let mut authorities: Vec<AccountAuthority> = Vec::new();

    for key in &key_formats {
        // 1. Primary: get_accounts_by_authorizers (Leap 5+ — returns account + permission)
        if let Ok(json) = pm
            .rpc_call(
                "/v1/chain/get_accounts_by_authorizers",
                &serde_json::json!({ "keys": [key] }),
                |json| Ok(json),
            )
            .await
        {
            if let Some(arr) = json.get("accounts").and_then(|v| v.as_array()) {
                for entry in arr {
                    let name = entry
                        .get("account_name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let perm = entry
                        .get("permission_name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("active");
                    if !name.is_empty() {
                        if !all_accounts.contains(&name.to_string()) {
                            all_accounts.push(name.to_string());
                        }
                        let auth = AccountAuthority {
                            account_name: name.to_string(),
                            permission_name: perm.to_string(),
                        };
                        if !authorities.iter().any(|a| {
                            a.account_name == auth.account_name
                                && a.permission_name == auth.permission_name
                        }) {
                            authorities.push(auth);
                        }
                    }
                }
            }
        }

        if !all_accounts.is_empty() {
            break;
        }

        // 2. Fallback: Hyperion v2 (only returns account names, no permissions)
        let hyperion_path = format!("/v2/state/get_key_accounts?public_key={}", key);
        if let Ok(result) = pm.hyperion_get::<serde_json::Value>(&hyperion_path).await {
            if let Some(names) = parse_key_accounts_response(&result) {
                for name in names {
                    if !all_accounts.contains(&name) {
                        all_accounts.push(name);
                    }
                }
            }
        }

        if !all_accounts.is_empty() {
            break;
        }

        // 3. Legacy fallback: v1 history plugin (only returns account names)
        if let Ok(json) = pm
            .rpc_call(
                "/v1/history/get_key_accounts",
                &serde_json::json!({ "public_key": key }),
                |json| Ok(json),
            )
            .await
        {
            if let Some(names) = parse_key_accounts_response(&json) {
                for name in names {
                    if !all_accounts.contains(&name) {
                        all_accounts.push(name);
                    }
                }
            }
        }

        if !all_accounts.is_empty() {
            break;
        }
    }

    Ok(KeyAccountsResult {
        account_names: all_accounts,
        authorities,
    })
}

/// Lookup accounts by public key.
/// Tries both `EOS...` and `PUB_K1_...` formats across Hyperion v2, RPC history,
/// and direct RPC endpoints to maximize discovery.
#[tauri::command]
pub async fn lookup_key_accounts(
    chain_id: String,
    public_key: String,
    providers: State<'_, ProviderState>,
) -> Result<KeyAccountsResult, Error> {
    let mut map: ProviderMap<'_> = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    lookup_key_accounts_impl(pm, &public_key).await
}

/// Decode an EOS... public key to raw compressed bytes.
fn decode_eos_pubkey(key: &str) -> Result<Vec<u8>, Error> {
    let encoded = key
        .strip_prefix("EOS")
        .ok_or_else(|| Error::Signing("Not an EOS key".into()))?;
    let decoded =
        bs58_decode(encoded).map_err(|e| Error::Signing(format!("Invalid base58: {}", e)))?;
    if decoded.len() < 37 {
        return Err(Error::Signing("EOS key too short".into()));
    }
    Ok(decoded[..33].to_vec())
}

/// Decode a PUB_K1_... public key to raw compressed bytes.
fn decode_k1_pubkey(key: &str) -> Result<Vec<u8>, Error> {
    let encoded = key
        .strip_prefix("PUB_K1_")
        .ok_or_else(|| Error::Signing("Not a PUB_K1_ key".into()))?;
    let decoded =
        bs58_decode(encoded).map_err(|e| Error::Signing(format!("Invalid base58: {}", e)))?;
    if decoded.len() < 37 {
        return Err(Error::Signing("PUB_K1_ key too short".into()));
    }
    Ok(decoded[..33].to_vec())
}

/// Minimal base58 decoder (same as in signing.rs, duplicated to avoid circular dep).
fn bs58_decode(input: &str) -> Result<Vec<u8>, String> {
    const BASE58_CHARS: &[u8] = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let mut digits: Vec<u32> = vec![0];
    for c in input.bytes() {
        let val = match BASE58_CHARS.iter().position(|&b| b == c) {
            Some(v) => v as u32,
            None => return Err(format!("Invalid base58 character: {}", c as char)),
        };
        let mut carry = val;
        for d in digits.iter_mut() {
            carry += *d * 58;
            *d = carry % 256;
            carry /= 256;
        }
        while carry > 0 {
            digits.push(carry % 256);
            carry /= 256;
        }
    }
    for c in input.bytes() {
        if c == b'1' {
            digits.push(0);
        } else {
            break;
        }
    }
    digits.reverse();
    Ok(digits.iter().map(|&d| d as u8).collect())
}

/// Parse account names from various response formats.
/// Handles: `{ "account_names": [...] }`, `{ "accounts": [...] }`,
/// and `{ "accounts": [{ "account_name": "..." }] }`.
fn parse_key_accounts_response(json: &serde_json::Value) -> Option<Vec<String>> {
    // Format 1: { "account_names": ["name1", "name2"] }
    if let Some(arr) = json.get("account_names").and_then(|v| v.as_array()) {
        let names: Vec<String> = arr
            .iter()
            .filter_map(|v| v.as_str().map(String::from))
            .collect();
        if !names.is_empty() {
            return Some(names);
        }
    }

    // Format 2: { "accounts": ["name1", "name2"] }
    if let Some(arr) = json.get("accounts").and_then(|v| v.as_array()) {
        let names: Vec<String> = arr
            .iter()
            .filter_map(|v| {
                // Could be string or object with account_name field
                v.as_str().map(String::from).or_else(|| {
                    v.get("account_name")
                        .and_then(|n| n.as_str())
                        .map(String::from)
                })
            })
            .collect();
        if !names.is_empty() {
            return Some(names);
        }
    }

    None
}

/// Get actions history from Hyperion with failover.
#[tauri::command]
pub async fn get_actions_history(
    chain_id: String,
    account: String,
    limit: u32,
    skip: u32,
    act_name: Option<String>,
    after: Option<String>,
    before: Option<String>,
    providers: State<'_, ProviderState>,
) -> Result<serde_json::Value, Error> {
    let mut map: ProviderMap<'_> = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    let mut path = format!(
        "/v2/history/get_actions?account={}&limit={}&skip={}",
        account, limit, skip
    );
    if let Some(name) = act_name {
        path.push_str(&format!("&act.name={}", name));
    }
    if let Some(a) = after {
        path.push_str(&format!("&after={}", a));
    }
    if let Some(b) = before {
        path.push_str(&format!("&before={}", b));
    }
    pm.hyperion_get(&path).await
}

/// Multisig inbox: proposals that still need `account`'s approval.
///
/// Uses Hyperion's `/v2/state/get_proposals` when available — it returns the
/// decoded inner transaction in one call. Chains without Hyperion (e.g. Ultra)
/// return `source: "none"` so the UI can show a clear "history API unavailable"
/// state instead of a misleading empty inbox.
#[tauri::command]
pub async fn get_msig_inbox(
    chain_id: String,
    account: String,
    limit: Option<u32>,
    providers: State<'_, ProviderState>,
) -> Result<serde_json::Value, Error> {
    let mut map: ProviderMap<'_> = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    let lim = limit.unwrap_or(50);

    if pm.hyperion_endpoints.is_empty() {
        // No Hyperion: the frontend will orchestrate via cache + a manual
        // `scan_msig_scopes` call. Returning an empty list here keeps the
        // initial page load instant instead of stalling on a long scan.
        return Ok(serde_json::json!({
            "source": "none",
            "proposals": [],
        }));
    }
    // `requested` filters to proposals that list the account in requested_approvals;
    // `skip_empty=true` drops fully-approved stragglers. We filter `provided` client-side
    // because `!<account>` negation support varies by Hyperion version.
    let path = format!(
        "/v2/state/get_proposals?requested={}&executed=false&skip_empty=true&limit={}",
        account, lim
    );
    let raw: serde_json::Value = pm.hyperion_get(&path).await?;

    let me = account.as_str();
    let proposals = raw
        .get("proposals")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter(|p| {
            // Keep only proposals where `me` hasn't already approved.
            let provided = p.get("provided_approvals").and_then(|v| v.as_array());
            match provided {
                Some(arr) => !arr.iter().any(|a| {
                    a.get("actor").and_then(|x| x.as_str()) == Some(me)
                }),
                None => true,
            }
        })
        .collect::<Vec<_>>();

    Ok(serde_json::json!({
        "source": "hyperion",
        "proposals": proposals,
    }))
}

/// Fetch a specific msig proposal, parse its packed_transaction, and decode
/// each inner action's data via the chain's `abi_bin_to_json` endpoint.
/// Returns `{ expiration, actions: [{account, name, authorization, data}] }`.
#[tauri::command]
pub async fn get_msig_proposal_details(
    chain_id: String,
    proposer: String,
    proposal_name: String,
    providers: State<'_, ProviderState>,
) -> Result<serde_json::Value, Error> {
    use crate::antelope::serialize::{hex_decode, parse_packed_transaction};

    let mut map: ProviderMap<'_> = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    // 1. Read the proposal row from eosio.msig::proposal (scope = proposer, pk = proposal_name).
    let rows: serde_json::Value = pm
        .rpc_call(
            "/v1/chain/get_table_rows",
            &serde_json::json!({
                "code": "eosio.msig",
                "table": "proposal",
                "scope": proposer,
                "lower_bound": proposal_name,
                "upper_bound": proposal_name,
                "limit": 1,
                "json": true,
            }),
            |json| Ok(json),
        )
        .await?;

    let row = rows
        .get("rows")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.first())
        .ok_or_else(|| {
            Error::Serialization(format!(
                "Proposal {}/{} not found",
                proposer, proposal_name
            ))
        })?
        .clone();

    let packed_hex = row
        .get("packed_transaction")
        .and_then(|v| v.as_str())
        .ok_or_else(|| Error::Serialization("packed_transaction missing".into()))?;
    let packed_bytes = hex_decode(packed_hex)
        .map_err(|e| Error::Serialization(format!("Invalid packed_transaction hex: {}", e)))?;

    let parsed = parse_packed_transaction(&packed_bytes)?;

    // 2. For each action, try to decode its data. Failures fall back to hex so the UI
    //    always shows something.
    let mut decoded_actions = Vec::with_capacity(parsed.actions.len());
    for a in parsed.actions {
        let data_val: serde_json::Value = match pm
            .rpc_call(
                "/v1/chain/abi_bin_to_json",
                &serde_json::json!({
                    "code": a.account,
                    "action": a.name,
                    "binargs": a.data_hex,
                }),
                |json| Ok(json),
            )
            .await
        {
            Ok(v) => v
                .get("args")
                .cloned()
                .unwrap_or_else(|| serde_json::json!({ "hex": a.data_hex })),
            Err(_) => serde_json::json!({ "hex": a.data_hex }),
        };

        let auth: Vec<serde_json::Value> = a
            .authorization
            .into_iter()
            .map(|(actor, permission)| {
                serde_json::json!({ "actor": actor, "permission": permission })
            })
            .collect();

        decoded_actions.push(serde_json::json!({
            "account": a.account,
            "name": a.name,
            "authorization": auth,
            "data": data_val,
        }));
    }

    // 3. Fetch approvals2 row (separate table, same scope/pk) so the UI can
    //    render a full card for manual-lookup flows without needing Hyperion.
    let (requested, provided) = fetch_msig_approvals(pm, &proposer, &proposal_name).await;

    Ok(serde_json::json!({
        "expiration": parsed.expiration,
        "actions": decoded_actions,
        "requested_approvals": requested,
        "provided_approvals": provided,
    }))
}

/// Refresh approval status for a list of known proposals. Used on page load
/// for chains without Hyperion — fast (only touches `approvals2` rows the
/// frontend already knows about) and keeps the UI responsive.
///
/// Returns:
/// - `active`: proposals still awaiting `account`'s approval (full payload)
/// - `dead`:   keys whose on-chain state no longer matches (executed, cancelled,
///              or already approved by `account`) — the frontend uses this to
///              prune its cache.
#[tauri::command]
pub async fn refresh_msig_status(
    chain_id: String,
    account: String,
    keys: Vec<serde_json::Value>,
    providers: State<'_, ProviderState>,
) -> Result<serde_json::Value, Error> {
    let mut map: ProviderMap<'_> = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    let mut active = Vec::new();
    let mut dead = Vec::new();

    for entry in keys {
        let proposer = match entry.get("proposer").and_then(|v| v.as_str()) {
            Some(s) if !s.is_empty() => s.to_string(),
            _ => continue,
        };
        let proposal_name = match entry.get("proposal_name").and_then(|v| v.as_str()) {
            Some(s) if !s.is_empty() => s.to_string(),
            _ => continue,
        };

        let (requested, provided) = fetch_msig_approvals(pm, &proposer, &proposal_name).await;

        // Both empty → row missing (executed/cancelled/never existed). Mark dead.
        if requested.is_empty() && provided.is_empty() {
            dead.push(serde_json::json!({
                "proposer": proposer,
                "proposal_name": proposal_name,
            }));
            continue;
        }

        let in_requested = requested
            .iter()
            .any(|a| a.get("actor").and_then(|v| v.as_str()) == Some(account.as_str()));
        let already_approved = provided
            .iter()
            .any(|a| a.get("actor").and_then(|v| v.as_str()) == Some(account.as_str()));

        if in_requested && !already_approved {
            active.push(serde_json::json!({
                "proposer": proposer,
                "proposal_name": proposal_name,
                "requested_approvals": requested,
                "provided_approvals": provided,
            }));
        } else {
            // No longer relevant to `account` (already approved or not a signer).
            dead.push(serde_json::json!({
                "proposer": proposer,
                "proposal_name": proposal_name,
            }));
        }
    }

    Ok(serde_json::json!({
        "active": active,
        "dead": dead,
    }))
}

/// Full scope-walk of `eosio.msig::proposal`, streaming progress to the
/// frontend via Tauri events so the UI can show a spinner + counter.
///
/// Emits:
/// - `msig-scan-progress` `{scanned: u32, found: u32, done: bool}`
/// - `msig-scan-proposal` (per match — full proposal payload)
///
/// Returns the final list so the caller can replace its state and update cache.
#[tauri::command]
pub async fn scan_msig_scopes_stream(
    chain_id: String,
    account: String,
    max_scopes: Option<u32>,
    app: tauri::AppHandle,
    providers: State<'_, ProviderState>,
) -> Result<serde_json::Value, Error> {
    use tauri::Emitter;
    let mut map: ProviderMap<'_> = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    let cap = max_scopes.unwrap_or(500);
    let mut lower = String::new();
    let mut scanned: u32 = 0;
    let mut found: u32 = 0;
    let mut results: Vec<serde_json::Value> = Vec::new();
    const PAGE: u32 = 200;

    let _ = app.emit(
        "msig-scan-progress",
        serde_json::json!({ "scanned": 0, "found": 0, "done": false }),
    );

    'outer: while scanned < cap {
        let remaining = (cap - scanned).min(PAGE);
        let scopes_page: serde_json::Value = match pm
            .rpc_call(
                "/v1/chain/get_table_by_scope",
                &serde_json::json!({
                    "code": "eosio.msig",
                    "table": "proposal",
                    "lower_bound": lower,
                    "limit": remaining,
                }),
                |json| Ok(json),
            )
            .await
        {
            Ok(v) => v,
            Err(_) => break,
        };

        let rows = scopes_page
            .get("rows")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        if rows.is_empty() {
            break;
        }

        for row in rows.iter() {
            scanned += 1;
            let _ = app.emit(
                "msig-scan-progress",
                serde_json::json!({ "scanned": scanned, "found": found, "done": false }),
            );

            let count = row.get("count").and_then(|v| v.as_u64()).unwrap_or(0);
            if count == 0 {
                continue;
            }
            let proposer = match row.get("scope").and_then(|v| v.as_str()) {
                Some(s) if !s.is_empty() => s.to_string(),
                _ => continue,
            };

            let props: serde_json::Value = match pm
                .rpc_call(
                    "/v1/chain/get_table_rows",
                    &serde_json::json!({
                        "code": "eosio.msig",
                        "table": "proposal",
                        "scope": proposer,
                        "limit": count.min(50),
                        "json": true,
                    }),
                    |json| Ok(json),
                )
                .await
            {
                Ok(v) => v,
                Err(_) => continue,
            };

            let proposal_rows = props
                .get("rows")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();

            for pr in proposal_rows {
                let proposal_name = match pr.get("proposal_name").and_then(|v| v.as_str()) {
                    Some(s) if !s.is_empty() => s.to_string(),
                    _ => continue,
                };
                let (requested, provided) =
                    fetch_msig_approvals(pm, &proposer, &proposal_name).await;

                let in_requested = requested
                    .iter()
                    .any(|a| a.get("actor").and_then(|v| v.as_str()) == Some(account.as_str()));
                let already_approved = provided
                    .iter()
                    .any(|a| a.get("actor").and_then(|v| v.as_str()) == Some(account.as_str()));

                if in_requested && !already_approved {
                    let payload = serde_json::json!({
                        "proposer": proposer,
                        "proposal_name": proposal_name,
                        "requested_approvals": requested,
                        "provided_approvals": provided,
                    });
                    found += 1;
                    let _ = app.emit("msig-scan-proposal", payload.clone());
                    results.push(payload);
                }
            }

            if scanned >= cap {
                break 'outer;
            }
        }

        let more = scopes_page
            .get("more")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if more.is_empty() {
            break;
        }
        lower = more.to_string();
    }

    let _ = app.emit(
        "msig-scan-progress",
        serde_json::json!({ "scanned": scanned, "found": found, "done": true }),
    );

    Ok(serde_json::json!({
        "proposals": results,
        "scanned": scanned,
    }))
}

/// Read `eosio.msig::approvals2` for `{proposer, proposal_name}`.
/// Returns (requested, provided) approval lists. Empty on any error.
async fn fetch_msig_approvals(
    pm: &mut crate::antelope::provider::ProviderManager,
    proposer: &str,
    proposal_name: &str,
) -> (Vec<serde_json::Value>, Vec<serde_json::Value>) {
    let rows: serde_json::Value = match pm
        .rpc_call(
            "/v1/chain/get_table_rows",
            &serde_json::json!({
                "code": "eosio.msig",
                "table": "approvals2",
                "scope": proposer,
                "lower_bound": proposal_name,
                "upper_bound": proposal_name,
                "limit": 1,
                "json": true,
            }),
            |json| Ok(json),
        )
        .await
    {
        Ok(v) => v,
        Err(_) => return (Vec::new(), Vec::new()),
    };

    let row = rows
        .get("rows")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.first())
        .cloned()
        .unwrap_or(serde_json::json!({}));

    let extract = |key: &str| -> Vec<serde_json::Value> {
        row.get(key)
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .filter_map(|entry| {
                // approvals2 rows look like { level: {actor, permission}, time }
                let level = entry.get("level")?.clone();
                let actor = level.get("actor")?.as_str()?.to_string();
                let permission = level.get("permission")?.as_str()?.to_string();
                let time = entry.get("time").and_then(|t| t.as_str()).unwrap_or("").to_string();
                Some(serde_json::json!({ "actor": actor, "permission": permission, "time": time }))
            })
            .collect()
    };

    (extract("requested_approvals"), extract("provided_approvals"))
}

/// Get token list from Hyperion with failover.
#[tauri::command]
pub async fn get_tokens(
    chain_id: String,
    account: String,
    providers: State<'_, ProviderState>,
) -> Result<serde_json::Value, Error> {
    let mut map: ProviderMap<'_> = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    let path = format!("/v2/state/get_tokens?account={}", account);
    pm.hyperion_get(&path).await
}

/// FIO: Get fee for a given action endpoint.
#[tauri::command]
pub async fn fio_get_fee(
    chain_id: String,
    end_point: String,
    fio_address: String,
    providers: State<'_, ProviderState>,
) -> Result<serde_json::Value, Error> {
    let mut map: ProviderMap<'_> = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    pm.rpc_call(
        "/v1/chain/get_fee",
        &serde_json::json!({ "end_point": end_point, "fio_address": fio_address }),
        |json| Ok(json),
    )
    .await
}

/// FIO: Get all domains and addresses owned by a FIO public key.
#[tauri::command]
pub async fn fio_get_names(
    chain_id: String,
    fio_public_key: String,
    providers: State<'_, ProviderState>,
) -> Result<serde_json::Value, Error> {
    let mut map: ProviderMap<'_> = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    pm.rpc_call(
        "/v1/chain/get_fio_names",
        &serde_json::json!({ "fio_public_key": fio_public_key }),
        |json| Ok(json),
    )
    .await
}

/// FIO: Resolve a FIO Handle to a public key.
#[tauri::command]
pub async fn fio_get_pub_address(
    chain_id: String,
    fio_address: String,
    providers: State<'_, ProviderState>,
) -> Result<serde_json::Value, Error> {
    let mut map: ProviderMap<'_> = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    pm.rpc_call(
        "/v1/chain/get_pub_address",
        &serde_json::json!({
            "fio_address": fio_address,
            "chain_code": "FIO",
            "token_code": "FIO",
        }),
        |json| Ok(json),
    )
    .await
}

/// Get the currently active endpoints for a chain.
#[tauri::command]
pub async fn get_active_endpoints(
    chain_id: String,
    providers: State<'_, ProviderState>,
) -> Result<ActiveEndpoints, Error> {
    let map: ProviderMap<'_> = providers.0.lock().await;
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

/// Load cached endpoints for a chain. Returns the cached list if available,
/// along with whether the cache is still fresh (< 24h).
/// This is fast (filesystem only) and should be called on startup / chain select.
#[tauri::command]
pub fn load_cached_endpoints(
    app: tauri::AppHandle,
    chain_id: String,
) -> Result<CachedEndpointsResult, Error> {
    let app_dir = app.path().app_data_dir().map_err(|e| {
        Error::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            e.to_string(),
        ))
    })?;

    match discovery::load_cache(&app_dir, &chain_id) {
        Some(cache) => {
            let fresh = discovery::is_cache_fresh(&cache);
            let healthy: Vec<_> = cache
                .endpoints
                .iter()
                .filter(|e| e.healthy)
                .cloned()
                .collect();
            log::info!(
                "[discovery] Loaded cache for {}: {} endpoints ({} healthy, fresh={})",
                &chain_id[..8],
                cache.endpoints.len(),
                healthy.len(),
                fresh
            );
            Ok(CachedEndpointsResult {
                endpoints: cache.endpoints,
                cached_at: cache.cached_at,
                fresh,
            })
        }
        None => Ok(CachedEndpointsResult {
            endpoints: vec![],
            cached_at: 0,
            fresh: false,
        }),
    }
}

/// Discover endpoints from bp.json for a chain.
/// Emits "discovery-progress" events to the frontend as work progresses.
/// Saves results to local cache on completion.
#[tauri::command]
pub async fn discover_endpoints(
    app: tauri::AppHandle,
    chain_id: String,
    providers: State<'_, ProviderState>,
) -> Result<Vec<DiscoveredEndpoint>, Error> {
    let mut map: ProviderMap<'_> = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .unwrap_or_default();

    let result = discovery::discover_endpoints(pm, &chain_id, &client, |progress| {
        let _ = app.emit("discovery-progress", &progress);
    })
    .await?;

    // Save to cache
    if let Ok(app_dir) = app.path().app_data_dir() {
        let _ = discovery::save_cache(&app_dir, &chain_id, &result);
    }

    Ok(result)
}

// ── PowerUp ──

/// Get the PowerUp market state and active orders for an account.
#[tauri::command]
pub async fn get_powerup_info(
    chain_id: String,
    account: String,
    providers: State<'_, ProviderState>,
) -> Result<powerup::ResourceSummary, Error> {
    let mut map: ProviderMap<'_> = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    powerup::get_resource_summary(pm, &account).await
}

/// Estimate the cost of a powerup request.
/// `cpu_frac` and `net_frac` are fractions of total weight (0.0 to 1.0).
#[tauri::command]
pub async fn estimate_powerup(
    chain_id: String,
    cpu_frac: f64,
    net_frac: f64,
    providers: State<'_, ProviderState>,
) -> Result<powerup::PowerUpEstimate, Error> {
    let mut map: ProviderMap<'_> = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    let state = powerup::get_powerup_state(pm).await?;
    powerup::estimate_powerup_cost(&state, cpu_frac, net_frac)
}

// ── Supporting types ──

#[derive(serde::Serialize)]
pub struct CachedEndpointsResult {
    pub endpoints: Vec<DiscoveredEndpoint>,
    /// Unix timestamp when cached (0 = no cache).
    pub cached_at: u64,
    /// Whether the cache is still fresh (< 24h).
    pub fresh: bool,
}

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
