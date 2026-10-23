use tauri::{Emitter, Manager, State};

use crate::antelope::discovery::{self, DiscoveredEndpoint};
use crate::antelope::powerup;
use crate::antelope::provider::{EndpointState, ProviderManager, ProviderState};
use crate::antelope::types::*;
use crate::error::Error;

/// Unwrap a Wire KV table row `{ "key": {...}, "value": {...} }` into its inner `"value"` object.
/// Leaves standard Antelope table rows untouched.
fn unwrap_kv_row(row: serde_json::Value) -> serde_json::Value {
    if let serde_json::Value::Object(ref map) = row {
        if map.len() == 2 && map.contains_key("key") {
            if let Some(val @ serde_json::Value::Object(_)) = map.get("value") {
                return val.clone();
            }
        }
    }
    row
}

/// Normalize `get_table_rows` parameters for Wire (`sysio` / `sysio.msig` / `sysio.roa`) KV tables:
/// - `sysio` `producers` (`key_names: ["owner"]`, `key_types: ["uint64"]`)
/// - `sysio` `finalizers` (`key_names: ["finalizer_name"]`, `key_types: ["uint64"]`)
/// - `sysio` `payclaims` / `nodedist` (`key_names: ["account_name"]`, `key_types: ["uint64"]`)
/// - `sysio.roa` `nodeowners` (`key_names: ["scope", "owner"]`)
/// - `sysio.msig` `proposal` / `approvals2` (`key_names: ["scope", "proposal_name"]`, `key_types: ["name", "uint64"]`)
///
/// Wire's `upper_bound` is exclusive `[lower_bound, upper_bound)`, so an exact-match
/// query sets `upper_bound` to `u64 + 1`.
fn normalize_sysio_table_params(params: &serde_json::Value) -> serde_json::Value {
    let Some(obj) = params.as_object() else {
        return params.clone();
    };
    let code = obj.get("code").and_then(|v| v.as_str()).unwrap_or("");
    let table = obj.get("table").and_then(|v| v.as_str()).unwrap_or("");
    let lb = obj
        .get("lower_bound")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if lb.is_empty() || lb.starts_with('{') {
        return params.clone();
    }

    if code == "sysio" && table == "finkeys" {
        let mut out = obj.clone();
        out.remove("index_position");
        out.remove("key_type");
        out.remove("lower_bound");
        out.remove("upper_bound");
        out.insert("limit".into(), serde_json::json!(500));
        return serde_json::Value::Object(out);
    }

    if (code == "sysio"
        && (table == "producers"
            || table == "finalizers"
            || table == "payclaims"
            || table == "nodedist"))
        || (code == "sysio.roa" && table == "nodeowners")
    {
        let key_field = match table {
            "producers" | "nodeowners" => "owner",
            "finalizers" => "finalizer_name",
            _ => "account_name",
        };
        let Ok(u) = crate::antelope::serialize::name_to_u64(lb) else {
            return params.clone();
        };
        let mut out = obj.clone();
        out.insert(
            "lower_bound".into(),
            serde_json::Value::String(format!("{{\"{}\":\"{}\"}}", key_field, u)),
        );
        if obj
            .get("upper_bound")
            .and_then(|v| v.as_str())
            .is_some_and(|ub| !ub.is_empty() && !ub.starts_with('{'))
        {
            out.insert(
                "upper_bound".into(),
                serde_json::Value::String(format!(
                    "{{\"{}\":\"{}\"}}",
                    key_field,
                    u.saturating_add(1)
                )),
            );
        }
        return serde_json::Value::Object(out);
    }

    if code == "sysio.msig"
        && (table == "proposal" || table == "approvals2" || table == "approvals")
    {
        let scope = obj.get("scope").and_then(|v| v.as_str()).unwrap_or("");
        let Ok(u) = crate::antelope::serialize::name_to_u64(lb) else {
            return params.clone();
        };
        let mut out = obj.clone();
        out.insert(
            "lower_bound".into(),
            serde_json::Value::String(format!(
                "{{\"scope\":\"{}\",\"proposal_name\":\"{}\"}}",
                scope, u
            )),
        );
        if obj
            .get("upper_bound")
            .and_then(|v| v.as_str())
            .is_some_and(|ub| !ub.is_empty() && !ub.starts_with('{'))
        {
            out.insert(
                "upper_bound".into(),
                serde_json::Value::String(format!(
                    "{{\"scope\":\"{}\",\"proposal_name\":\"{}\"}}",
                    scope,
                    u.saturating_add(1)
                )),
            );
        }
        return serde_json::Value::Object(out);
    }

    params.clone()
}

fn msig_contract_for_chain(chain_id: &str) -> &'static str {
    if crate::antelope::chain_config::is_sysio_chain(chain_id) {
        "sysio.msig"
    } else {
        "eosio.msig"
    }
}

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
    let pm = &mut providers.get(&chain_id).await?;

    Ok(pm.check_all_rpc_endpoints().await)
}

/// Run health checks on all Hyperion endpoints for a chain.
#[tauri::command]
pub async fn check_hyperion_endpoints(
    chain_id: String,
    providers: State<'_, ProviderState>,
) -> Result<Vec<EndpointState>, Error> {
    let pm = &mut providers.get(&chain_id).await?;

    Ok(pm.check_all_hyperion_endpoints().await)
}

/// Get chain info from the best available endpoint (with failover).
#[tauri::command]
pub async fn get_chain_info(
    chain_id: String,
    providers: State<'_, ProviderState>,
) -> Result<ChainInfo, Error> {
    let pm = &mut providers.get(&chain_id).await?;

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
    let pm = &mut providers.get(&chain_id).await?;

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
    let pm = &mut providers.get(&chain_id).await?;

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
    let pm = &mut providers.get(&chain_id).await?;
    let req_params = normalize_sysio_table_params(&params);

    let mut res: TableRowsResult = pm
        .rpc_call("/v1/chain/get_table_rows", &req_params, |json| {
            serde_json::from_value(json).map_err(|e| Error::Rpc(format!("Parse error: {}", e)))
        })
        .await?;
    res.rows = res.rows.into_iter().map(unwrap_kv_row).collect();
    Ok(res)
}

/// Get ABI with failover.
#[tauri::command]
pub async fn get_abi(
    chain_id: String,
    account_name: String,
    providers: State<'_, ProviderState>,
) -> Result<serde_json::Value, Error> {
    let pm = &mut providers.get(&chain_id).await?;

    pm.rpc_call(
        "/v1/chain/get_abi",
        &serde_json::json!({ "account_name": account_name }),
        |json| {
            if json
                .get("abi")
                .is_some_and(|abi| abi.is_null() || abi["actions"].is_array())
            {
                Ok(json)
            } else {
                Err(Error::Rpc("Invalid contract ABI response".into()))
            }
        },
    )
    .await
}

fn decode_asset_16(bytes: &[u8]) -> Option<String> {
    if bytes.len() != 16 {
        return None;
    }
    let amount = i64::from_le_bytes(bytes[0..8].try_into().ok()?);
    let precision = bytes[8] as usize;
    if precision > 18 {
        return None;
    }
    let symbol_end = bytes[9..16].iter().position(|b| *b == 0).unwrap_or(7) + 9;
    let symbol = std::str::from_utf8(&bytes[9..symbol_end]).ok()?;
    let mut digits = format!("{:0width$}", amount.unsigned_abs(), width = precision + 1);
    if precision > 0 {
        digits.insert(digits.len() - precision, '.');
    }
    if amount < 0 {
        digits.insert(0, '-');
    }
    Some(format!("{digits} {symbol}"))
}

fn decode_read_only_return_value(action: &str, hex_str: &str) -> Option<serde_json::Value> {
    let bytes = hex::decode(hex_str).ok()?;
    match action {
        "viewnodedist" if bytes.len() == 49 => {
            let total_allocation = decode_asset_16(&bytes[0..16])?;
            let claimed = decode_asset_16(&bytes[16..32])?;
            let claimable = decode_asset_16(&bytes[32..48])?;
            let can_claim = bytes[48] != 0;
            Some(serde_json::json!({
                "total_allocation": total_allocation,
                "claimed": claimed,
                "claimable": claimable,
                "can_claim": can_claim,
            }))
        }
        _ => None,
    }
}

/// Execute a read-only contract action via `/v1/chain/send_read_only_transaction`.
/// Builds an unsigned transaction with `authorization: []` and returns
/// `processed.action_traces[0].return_value_data` (or decoded `return_value`).
#[tauri::command]
pub async fn call_read_only_action(
    chain_id: String,
    account: String,
    action: String,
    args: serde_json::Value,
    providers: State<'_, ProviderState>,
) -> Result<serde_json::Value, Error> {
    let pm = &mut providers.get(&chain_id).await?;
    let action_desc = crate::antelope::transaction::ActionDesc {
        account: account.clone(),
        name: action.clone(),
        authorization: vec![],
        data: crate::antelope::transaction::ActionData::Json(args),
    };
    let (packed_trx, _) = crate::antelope::transaction::build_transaction(pm, &[action_desc]).await?;
    let body = serde_json::json!({
        "transaction": {
            "signatures": [],
            "compression": "none",
            "packed_context_free_data": "",
            "packed_trx": crate::antelope::serialize::hex_encode(&packed_trx),
        }
    });

    let res: serde_json::Value = pm
        .rpc_call_compatible_paths(&["/v1/chain/send_read_only_transaction"], &body, Ok)
        .await?;

    if let Some(except) = res
        .get("processed")
        .and_then(|p| p.get("except"))
        .filter(|v| !v.is_null())
    {
        let stack_msg = except
            .get("stack")
            .and_then(|s| s.as_array())
            .and_then(|arr| arr.first())
            .and_then(|item| item.get("format").or_else(|| item.get("msg")))
            .and_then(|f| f.as_str());
        let main_msg = except
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("Read-only action failed");
        let detail = match stack_msg {
            Some(s) if !s.is_empty() => format!("{main_msg}: {s}"),
            _ => main_msg.to_string(),
        };
        return Err(Error::Rpc(detail));
    }

    let first_trace = res
        .get("processed")
        .and_then(|p| p.get("action_traces"))
        .and_then(|t| t.as_array())
        .and_then(|arr| arr.first())
        .ok_or_else(|| Error::Rpc("Missing action_traces in read-only response".into()))?;

    if let Some(data) = first_trace.get("return_value_data").filter(|v| !v.is_null()) {
        return Ok(data.clone());
    }

    if let Some(hex_str) = first_trace.get("return_value").and_then(|v| v.as_str()) {
        if let Some(decoded) = decode_read_only_return_value(&action, hex_str) {
            return Ok(decoded);
        }
        return Ok(serde_json::json!({ "return_value": hex_str }));
    }

    Ok(serde_json::Value::Null)
}

/// Get producers with failover.
#[tauri::command]
pub async fn get_producers(
    chain_id: String,
    limit: u32,
    providers: State<'_, ProviderState>,
) -> Result<serde_json::Value, Error> {
    let pm = &mut providers.get(&chain_id).await?;

    pm.rpc_call(
        "/v1/chain/get_producers",
        &serde_json::json!({ "limit": limit, "lower_bound": "", "json": true }),
        |json| {
            if json["rows"].is_array() || json["producers"].is_array() {
                Ok(json)
            } else {
                Err(Error::Rpc("Invalid producer list response".into()))
            }
        },
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
    let pm = &mut providers.get(&chain_id).await?;

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
    let pm = &mut providers.get(&chain_id).await?;

    let mut url = reqwest::Url::parse("https://history.invalid/v2/history/get_actions").unwrap();
    url.query_pairs_mut()
        .append_pair("account", &account)
        .append_pair("limit", &limit.clamp(1, 1000).to_string())
        .append_pair("skip", &skip.to_string())
        .append_pair("sort", "desc");
    if let Some(name) = act_name {
        url.query_pairs_mut().append_pair("act.name", &name);
    }
    if let Some(a) = after {
        url.query_pairs_mut().append_pair("after", &a);
    }
    if let Some(b) = before {
        url.query_pairs_mut().append_pair("before", &b);
    }
    let path = format!("{}?{}", url.path(), url.query().unwrap_or_default());
    // Validate the payload at the provider boundary so malformed HTTP 200
    // responses fail over instead of appearing as an empty account history.
    let history: ActionsHistory = pm.hyperion_get(&path).await?;
    serde_json::to_value(history).map_err(|e| Error::Rpc(e.to_string()))
}

#[derive(serde::Serialize, serde::Deserialize)]
struct ActionsHistory {
    actions: Vec<serde_json::Value>,
    #[serde(flatten)]
    metadata: serde_json::Map<String, serde_json::Value>,
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
    let pm = &mut providers.get(&chain_id).await?;

    let lim = limit.unwrap_or(50);

    if pm.hyperion_endpoints().is_empty() {
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
                Some(arr) => !arr
                    .iter()
                    .any(|a| a.get("actor").and_then(|x| x.as_str()) == Some(me)),
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
/// each inner action's data via local `rs_abieos` or the chain's `abi_bin_to_json` endpoint.
/// Returns `{ expiration, actions: [{account, name, authorization, data}] }`.
#[tauri::command]
pub async fn get_msig_proposal_details(
    chain_id: String,
    proposer: String,
    proposal_name: String,
    providers: State<'_, ProviderState>,
) -> Result<serde_json::Value, Error> {
    use crate::antelope::serialize::{hex_decode, parse_packed_transaction};

    let msig_code = msig_contract_for_chain(&chain_id);
    let pm = &mut providers.get(&chain_id).await?;

    // 1. Read the proposal row from <msig_code>::proposal (scope = proposer, pk = proposal_name).
    let req_params = normalize_sysio_table_params(&serde_json::json!({
        "code": msig_code,
        "table": "proposal",
        "scope": proposer,
        "lower_bound": proposal_name,
        "upper_bound": proposal_name,
        "limit": 1,
        "json": true,
    }));
    let rows: serde_json::Value = pm
        .rpc_call("/v1/chain/get_table_rows", &req_params, Ok)
        .await?;

    let row = rows
        .get("rows")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.first())
        .cloned()
        .map(unwrap_kv_row)
        .ok_or_else(|| {
            Error::Serialization(format!(
                "Proposal {}/{} not found",
                proposer, proposal_name
            ))
        })?;

    let packed_hex = row
        .get("packed_transaction")
        .and_then(|v| v.as_str())
        .ok_or_else(|| Error::Serialization("packed_transaction missing".into()))?;
    let packed_bytes = hex_decode(packed_hex)
        .map_err(|e| Error::Serialization(format!("Invalid packed_transaction hex: {}", e)))?;

    // SEC-003: sha256 of the on-chain packed_transaction. Passed as the
    // eosio.msig::approve `proposal_hash` so the chain rejects any approval that
    // doesn't match the exact bytes of the reviewed proposal.
    let proposal_hash = {
        use sha2::{Digest, Sha256};
        hex::encode(Sha256::digest(&packed_bytes))
    };

    let parsed = parse_packed_transaction(&packed_bytes)?;

    // 2. For each action, try to decode its data locally via rs_abieos first,
    //    then fall back to RPC abi_bin_to_json, and finally raw hex.
    let mut decoded_actions = Vec::with_capacity(parsed.actions.len());
    for a in parsed.actions {
        let local_decoded = crate::antelope::abi_serializer::try_deserialize_action_hex(
            pm,
            &a.account,
            &a.name,
            &a.data_hex,
        )
        .await
        .ok()
        .flatten();

        let data_val: serde_json::Value = match local_decoded {
            Some(val) => val,
            None => match pm
                .rpc_call(
                    "/v1/chain/abi_bin_to_json",
                    &serde_json::json!({
                        "code": a.account,
                        "action": a.name,
                        "binargs": a.data_hex,
                    }),
                    Ok,
                )
                .await
            {
                Ok(v) => v
                    .get("args")
                    .cloned()
                    .unwrap_or_else(|| serde_json::json!({ "hex": a.data_hex })),
                Err(_) => serde_json::json!({ "hex": a.data_hex }),
            },
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
    let (requested, provided) =
        fetch_msig_approvals(pm, msig_code, &proposer, &proposal_name).await;

    Ok(serde_json::json!({
        "expiration": parsed.expiration,
        "actions": decoded_actions,
        "requested_approvals": requested,
        "provided_approvals": provided,
        "proposal_hash": proposal_hash,
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
    let msig_code = msig_contract_for_chain(&chain_id);
    let pm = &mut providers.get(&chain_id).await?;

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

        let (requested, provided) =
            fetch_msig_approvals(pm, msig_code, &proposer, &proposal_name).await;

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

/// Full scope-walk of `<msig_code>::proposal`, streaming progress to the
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
    let msig_code = msig_contract_for_chain(&chain_id);
    let pm = &mut providers.get(&chain_id).await?;

    let cap = max_scopes.unwrap_or(500);
    let mut lower = String::new();
    let mut scanned: u32 = 0;
    let mut found: u32 = 0;
    let mut results: Vec<serde_json::Value> = Vec::new();
    const PAGE: u32 = 200;

    // SEC-050: scope sensitive msig events to the main window only
    let _ = app.emit_to(
        "main",
        "msig-scan-progress",
        serde_json::json!({ "scanned": 0, "found": 0, "done": false }),
    );

    'outer: while scanned < cap {
        let remaining = (cap - scanned).min(PAGE);
        let scopes_page: serde_json::Value = match pm
            .rpc_call(
                "/v1/chain/get_table_by_scope",
                &serde_json::json!({
                    "code": msig_code,
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
            // SEC-050: scope sensitive msig events to the main window only
            let _ = app.emit_to(
                "main",
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
                        "code": msig_code,
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

            for pr in proposal_rows.into_iter().map(unwrap_kv_row) {
                let proposal_name = match pr.get("proposal_name").and_then(|v| v.as_str()) {
                    Some(s) if !s.is_empty() => s.to_string(),
                    _ => continue,
                };
                let (requested, provided) =
                    fetch_msig_approvals(pm, msig_code, &proposer, &proposal_name).await;

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
                    // SEC-050: scope sensitive msig events to the main window only
                    let _ = app.emit_to("main", "msig-scan-proposal", payload.clone());
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

    // SEC-050: scope sensitive msig events to the main window only
    let _ = app.emit_to(
        "main",
        "msig-scan-progress",
        serde_json::json!({ "scanned": scanned, "found": found, "done": true }),
    );

    Ok(serde_json::json!({
        "proposals": results,
        "scanned": scanned,
    }))
}

/// Read `<msig_code>::approvals2` for `{proposer, proposal_name}`.
/// Returns (requested, provided) approval lists. Empty on any error.
async fn fetch_msig_approvals(
    pm: &mut crate::antelope::provider::ProviderManager,
    msig_code: &str,
    proposer: &str,
    proposal_name: &str,
) -> (Vec<serde_json::Value>, Vec<serde_json::Value>) {
    let req_params = normalize_sysio_table_params(&serde_json::json!({
        "code": msig_code,
        "table": "approvals2",
        "scope": proposer,
        "lower_bound": proposal_name,
        "upper_bound": proposal_name,
        "limit": 1,
        "json": true,
    }));
    let rows: serde_json::Value = match pm
        .rpc_call("/v1/chain/get_table_rows", &req_params, Ok)
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
        .map(unwrap_kv_row)
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
                let time = entry
                    .get("time")
                    .and_then(|t| t.as_str())
                    .unwrap_or("")
                    .to_string();
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
    let pm = &mut providers.get(&chain_id).await?;

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
    let pm = &mut providers.get(&chain_id).await?;

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
    let pm = &mut providers.get(&chain_id).await?;

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
    let pm = &mut providers.get(&chain_id).await?;

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
    let pm = &mut providers.get(&chain_id).await?;

    Ok(ActiveEndpoints {
        rpc: pm.active_rpc_url().unwrap_or_default().to_string(),
        hyperion: pm.active_hyperion_url().unwrap_or_default().to_string(),
        rpc_endpoints: pm.rpc_endpoints(),
        hyperion_endpoints: pm.hyperion_endpoints(),
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
                crate::util::short_prefix(&chain_id, 8), // SEC-013
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
    let pm = &mut providers.get(&chain_id).await?;

    crate::antelope::provider::install_tls_provider();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        // SEC-060: do not follow redirects (prevents redirect-based SSRF/downgrade)
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .unwrap_or_default();

    let result = discovery::discover_endpoints(pm, &chain_id, &client, |progress| {
        // SEC-050: scope discovery progress events to the main window only
        let _ = app.emit_to("main", "discovery-progress", &progress);
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
    let pm = &mut providers.get(&chain_id).await?;

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
    let pm = &mut providers.get(&chain_id).await?;

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

#[cfg(test)]
mod kv_tests {
    use super::*;

    #[test]
    fn normalizes_sysio_payclaims_and_nodedist_bounds() {
        for table in ["payclaims", "nodedist"] {
            let params = serde_json::json!({
                "code": "sysio",
                "scope": "sysio",
                "table": table,
                "lower_bound": "alice",
                "upper_bound": "alice",
                "limit": 1,
                "json": true,
            });
            let norm = normalize_sysio_table_params(&params);
            let u = crate::antelope::serialize::name_to_u64("alice").unwrap();
            assert_eq!(
                norm["lower_bound"].as_str().unwrap(),
                format!("{{\"account_name\":\"{}\"}}", u)
            );
            assert_eq!(
                norm["upper_bound"].as_str().unwrap(),
                format!("{{\"account_name\":\"{}\"}}", u + 1)
            );
        }

        let roa_params = serde_json::json!({
            "code": "sysio.roa",
            "scope": "0",
            "table": "nodeowners",
            "lower_bound": "alice",
            "upper_bound": "alice",
            "limit": 1,
            "json": true,
        });
        let roa_norm = normalize_sysio_table_params(&roa_params);
        let u = crate::antelope::serialize::name_to_u64("alice").unwrap();
        assert_eq!(
            roa_norm["lower_bound"].as_str().unwrap(),
            format!("{{\"owner\":\"{}\"}}", u)
        );
        assert_eq!(
            roa_norm["upper_bound"].as_str().unwrap(),
            format!("{{\"owner\":\"{}\"}}", u + 1)
        );
    }

    #[test]
    fn unwraps_wire_kv_row_and_decodes_viewnodedist_return_value() {
        let wrapped = serde_json::json!({
            "key": { "account_name": "3773066844340060160" },
            "value": { "account_name": "alice", "balance": "12500000000" }
        });
        let unwrapped = unwrap_kv_row(wrapped);
        assert_eq!(unwrapped["account_name"], "alice");
        assert_eq!(unwrapped["balance"], "12500000000");

        let mut buf = Vec::new();
        buf.extend_from_slice(
            &crate::antelope::serialize::serialize_asset("100.000000000 WIRE").unwrap(),
        );
        buf.extend_from_slice(
            &crate::antelope::serialize::serialize_asset("25.000000000 WIRE").unwrap(),
        );
        buf.extend_from_slice(
            &crate::antelope::serialize::serialize_asset("15.000000000 WIRE").unwrap(),
        );
        buf.push(1u8);
        let decoded =
            decode_read_only_return_value("viewnodedist", &hex::encode(&buf)).unwrap();
        assert_eq!(decoded["total_allocation"], "100.000000000 WIRE");
        assert_eq!(decoded["claimed"], "25.000000000 WIRE");
        assert_eq!(decoded["claimable"], "15.000000000 WIRE");
        assert_eq!(decoded["can_claim"], true);
    }
}
