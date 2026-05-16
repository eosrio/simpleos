//! Transaction builder: construct, serialize, sign, and push Antelope transactions.
//!
//! Provides a high-level API that takes JSON action descriptions, fetches TAPOS
//! from chain info, serializes actions, signs with a local key, and pushes to nodeos.

use crate::antelope::provider::ProviderManager;
use crate::antelope::serialize::{self, hex_encode, serialize_action, RawTransaction};
use crate::antelope::signing;
use crate::antelope::types::ChainInfo;
use crate::error::Error;

/// Description of an action to include in a transaction.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct ActionDesc {
    pub account: String,
    pub name: String,
    pub authorization: Vec<AuthDesc>,
    /// Either pre-serialized hex data OR JSON data to be serialized via abi_json_to_bin.
    pub data: ActionData,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct AuthDesc {
    pub actor: String,
    pub permission: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(untagged)]
pub enum ActionData {
    /// Already serialized as hex string.
    Hex(String),
    /// JSON data — needs abi_json_to_bin or native serialization.
    Json(serde_json::Value),
}

/// Result of a successful transaction push.
#[derive(Debug, Clone, serde::Serialize)]
pub struct TransactionResult {
    pub transaction_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_num: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_time: Option<String>,
}

/// Build, sign, and push a transaction.
///
/// This is the main entry point for transaction submission:
/// 1. Fetches chain info for TAPOS
/// 2. Serializes each action (native for known types, abi_json_to_bin for custom)
/// 3. Builds the packed transaction
/// 4. Signs with the provided private key
/// 5. Pushes via push_transaction
pub async fn sign_and_push(
    pm: &mut ProviderManager,
    actions: &[ActionDesc],
    private_key_bytes: &[u8],
) -> Result<TransactionResult, Error> {
    // 1. Get chain info for TAPOS
    log::info!("[tx] sign_and_push: fetching chain info...");
    let chain_info: ChainInfo = pm
        .rpc_call("/v1/chain/get_info", &serde_json::json!({}), |json| {
            serde_json::from_value(json).map_err(|e| Error::Rpc(format!("Parse chain info: {}", e)))
        })
        .await?;
    log::info!("[tx] sign_and_push: chain_id={}, head_block_time={}", &chain_info.chain_id[..8], chain_info.head_block_time);

    // 2. Serialize actions
    let mut serialized_actions = Vec::new();
    for action in actions {
        log::info!("[tx] sign_and_push: serializing {}::{}", action.account, action.name);
        let data_hex = resolve_action_data(pm, &action.account, &action.name, &action.data).await?;
        log::info!("[tx] sign_and_push: serialized data_hex len={}", data_hex.len());
        let auths: Vec<(&str, &str)> = action
            .authorization
            .iter()
            .map(|a| (a.actor.as_str(), a.permission.as_str()))
            .collect();
        let serialized = serialize_action(&action.account, &action.name, &auths, &data_hex)?;
        serialized_actions.push(serialized);
    }

    // 3. Build transaction with TAPOS
    let ref_block_num = serialize::tapos_ref_block_num(chain_info.last_irreversible_block_num);
    let ref_block_prefix =
        serialize::tapos_ref_block_prefix(&chain_info.last_irreversible_block_id)?;

    // Expiration: parse head_block_time and add 120 seconds
    let expiration = parse_block_time(&chain_info.head_block_time)? + 120;

    let raw_tx = RawTransaction {
        expiration,
        ref_block_num,
        ref_block_prefix,
        max_net_usage_words: 0,
        max_cpu_usage_ms: 0,
        delay_sec: 0,
        context_free_actions: vec![],
        actions: serialized_actions,
        transaction_extensions: vec![],
    };

    let packed_trx = raw_tx.serialize();

    // 4. Sign
    log::info!("[tx] sign_and_push: signing transaction...");
    let signature =
        signing::sign_transaction(&chain_info.chain_id, &packed_trx, private_key_bytes)?;
    log::info!("[tx] sign_and_push: signed, pushing...");

    // 5. Push
    let packed_hex = hex_encode(&packed_trx);
    let push_body = serde_json::json!({
        "signatures": [signature],
        "compression": "none",
        "packed_context_free_data": "",
        "packed_trx": packed_hex,
    });

    let result: serde_json::Value = pm
        .rpc_call("/v1/chain/send_transaction", &push_body, |json| Ok(json))
        .await?;

    // Parse result
    let transaction_id = result
        .get("transaction_id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let block_num = result
        .get("processed")
        .and_then(|p| p.get("block_num"))
        .and_then(|v| v.as_u64());

    let block_time = result
        .get("processed")
        .and_then(|p| p.get("block_time"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    if transaction_id.is_empty() {
        // Check for error in response
        if let Some(err) = result.get("error") {
            let msg = err
                .get("details")
                .and_then(|d| d.as_array())
                .and_then(|arr| arr.first())
                .and_then(|d| d.get("message"))
                .and_then(|m| m.as_str())
                .unwrap_or("Transaction failed");
            log::error!("[tx] sign_and_push: FAILED: {}", msg);
            return Err(Error::Rpc(msg.to_string()));
        }
        log::error!("[tx] sign_and_push: no transaction_id in response: {:?}", result);
        return Err(Error::Rpc("No transaction_id in response".into()));
    }

    log::info!("[tx] sign_and_push: SUCCESS txid={}", transaction_id);
    Ok(TransactionResult {
        transaction_id,
        block_num,
        block_time,
    })
}

/// Build and sign a transaction without pushing it.
/// Returns the packed transaction hex and signature.
pub async fn sign_only(
    pm: &mut ProviderManager,
    actions: &[ActionDesc],
    private_key_bytes: &[u8],
) -> Result<(String, String), Error> {
    let chain_info: ChainInfo = pm
        .rpc_call("/v1/chain/get_info", &serde_json::json!({}), |json| {
            serde_json::from_value(json).map_err(|e| Error::Rpc(format!("Parse chain info: {}", e)))
        })
        .await?;

    let mut serialized_actions = Vec::new();
    for action in actions {
        let data_hex = resolve_action_data(pm, &action.account, &action.name, &action.data).await?;
        let auths: Vec<(&str, &str)> = action
            .authorization
            .iter()
            .map(|a| (a.actor.as_str(), a.permission.as_str()))
            .collect();
        serialized_actions.push(serialize_action(
            &action.account,
            &action.name,
            &auths,
            &data_hex,
        )?);
    }

    let ref_block_num = serialize::tapos_ref_block_num(chain_info.last_irreversible_block_num);
    let ref_block_prefix =
        serialize::tapos_ref_block_prefix(&chain_info.last_irreversible_block_id)?;
    let expiration = parse_block_time(&chain_info.head_block_time)? + 120;

    let raw_tx = RawTransaction {
        expiration,
        ref_block_num,
        ref_block_prefix,
        max_net_usage_words: 0,
        max_cpu_usage_ms: 0,
        delay_sec: 0,
        context_free_actions: vec![],
        actions: serialized_actions,
        transaction_extensions: vec![],
    };

    let packed_trx = raw_tx.serialize();
    let signature =
        signing::sign_transaction(&chain_info.chain_id, &packed_trx, private_key_bytes)?;

    Ok((hex_encode(&packed_trx), signature))
}

/// Build and serialize a transaction without signing.
/// Returns raw packed transaction bytes (for Ledger signing).
pub async fn build_transaction(
    pm: &mut ProviderManager,
    actions: &[ActionDesc],
) -> Result<(Vec<u8>, String), Error> {
    let chain_info: ChainInfo = pm
        .rpc_call("/v1/chain/get_info", &serde_json::json!({}), |json| {
            serde_json::from_value(json).map_err(|e| Error::Rpc(format!("Parse chain info: {}", e)))
        })
        .await?;

    let mut serialized_actions = Vec::new();
    for action in actions {
        let data_hex = resolve_action_data(pm, &action.account, &action.name, &action.data).await?;
        let auths: Vec<(&str, &str)> = action
            .authorization
            .iter()
            .map(|a| (a.actor.as_str(), a.permission.as_str()))
            .collect();
        serialized_actions.push(serialize_action(
            &action.account,
            &action.name,
            &auths,
            &data_hex,
        )?);
    }

    let ref_block_num = serialize::tapos_ref_block_num(chain_info.last_irreversible_block_num);
    let ref_block_prefix =
        serialize::tapos_ref_block_prefix(&chain_info.last_irreversible_block_id)?;
    let expiration = parse_block_time(&chain_info.head_block_time)? + 120;

    let raw_tx = RawTransaction {
        expiration,
        ref_block_num,
        ref_block_prefix,
        max_net_usage_words: 0,
        max_cpu_usage_ms: 0,
        delay_sec: 0,
        context_free_actions: vec![],
        actions: serialized_actions,
        transaction_extensions: vec![],
    };

    Ok((raw_tx.serialize(), chain_info.chain_id))
}

// ── Helpers ──

/// Resolve action data to hex.
/// For known system actions, serialize natively.
/// For unknown contracts, use abi_json_to_bin via the chain API.
async fn resolve_action_data(
    pm: &mut ProviderManager,
    account: &str,
    name: &str,
    data: &ActionData,
) -> Result<String, Error> {
    match data {
        ActionData::Hex(hex) => Ok(hex.clone()),
        ActionData::Json(json) => {
            // Try native serialization for known system actions
            if let Some(native_hex) = try_native_serialize(account, name, json)? {
                return Ok(native_hex);
            }

            // Fallback: abi_json_to_bin via chain API
            let result: serde_json::Value = pm
                .rpc_call(
                    "/v1/chain/abi_json_to_bin",
                    &serde_json::json!({
                        "code": account,
                        "action": name,
                        "args": json,
                    }),
                    |json| Ok(json),
                )
                .await?;

            result
                .get("binargs")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .ok_or_else(|| Error::Serialization("abi_json_to_bin returned no binargs".into()))
        }
    }
}

/// Try to serialize known system contract actions natively (no ABI lookup needed).
fn try_native_serialize(
    account: &str,
    name: &str,
    json: &serde_json::Value,
) -> Result<Option<String>, Error> {
    match (account, name) {
        // All standard Antelope token contracts use the same transfer struct:
        // (name from, name to, asset quantity, string memo). Native-serialize for
        // any "transfer" action with the standard fields — this also avoids needing
        // /v1/chain/abi_json_to_bin, which is disabled on many modern endpoints.
        (_, "transfer") if json.get("from").is_some() && json.get("to").is_some() && json.get("quantity").is_some() => {
            let from = json_str(json, "from")?;
            let to = json_str(json, "to")?;
            let quantity = json_str(json, "quantity")?;
            let memo = json.get("memo").and_then(|v| v.as_str()).unwrap_or("");
            let data = serialize::serialize_transfer(from, to, quantity, memo)?;
            Ok(Some(hex_encode(&data)))
        }
        ("eosio", "delegatebw") => {
            let from = json_str(json, "from")?;
            let receiver = json_str(json, "receiver")?;
            let stake_net = json_str(json, "stake_net_quantity")?;
            let stake_cpu = json_str(json, "stake_cpu_quantity")?;
            let transfer = json
                .get("transfer")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            let data =
                serialize::serialize_delegatebw(from, receiver, stake_net, stake_cpu, transfer)?;
            Ok(Some(hex_encode(&data)))
        }
        ("eosio", "undelegatebw") => {
            let from = json_str(json, "from")?;
            let receiver = json_str(json, "receiver")?;
            let unstake_net = json_str(json, "unstake_net_quantity")?;
            let unstake_cpu = json_str(json, "unstake_cpu_quantity")?;
            let data = serialize::serialize_undelegatebw(from, receiver, unstake_net, unstake_cpu)?;
            Ok(Some(hex_encode(&data)))
        }
        ("eosio", "voteproducer") => {
            let voter = json_str(json, "voter")?;
            let proxy = json.get("proxy").and_then(|v| v.as_str()).unwrap_or("");
            let producers: Vec<&str> = json
                .get("producers")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str()).collect())
                .unwrap_or_default();
            let data = serialize::serialize_voteproducer(voter, proxy, &producers)?;
            Ok(Some(hex_encode(&data)))
        }
        ("eosio", "buyram") => {
            let payer = json_str(json, "payer")?;
            let receiver = json_str(json, "receiver")?;
            let quant = json_str(json, "quant")?;
            let data = serialize::serialize_buyram(payer, receiver, quant)?;
            Ok(Some(hex_encode(&data)))
        }
        ("eosio", "buyrambytes") => {
            let payer = json_str(json, "payer")?;
            let receiver = json_str(json, "receiver")?;
            let bytes = json.get("bytes").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
            let data = serialize::serialize_buyrambytes(payer, receiver, bytes)?;
            Ok(Some(hex_encode(&data)))
        }
        ("eosio", "sellram") => {
            let account = json_str(json, "account")?;
            let bytes = json.get("bytes").and_then(|v| v.as_i64()).unwrap_or(0);
            let data = serialize::serialize_sellram(account, bytes)?;
            Ok(Some(hex_encode(&data)))
        }
        ("eosio", "claimrewards") => {
            let owner = json_str(json, "owner")?;
            let data = serialize::serialize_claimrewards(owner)?;
            Ok(Some(hex_encode(&data)))
        }
        ("eosio", "regproducer") => {
            // FIO's regproducer ABI is unrelated to Antelope's
            // (fio_address, fio_pub_key, url, location, actor, max_fee).
            // Detect the FIO shape and defer to abi_json_to_bin so the
            // chain's real ABI is used instead of mis-serializing.
            if json.get("fio_address").is_some() {
                return Ok(None);
            }
            let producer = json_str(json, "producer")?;
            let producer_key = json_str(json, "producer_key")?;
            let url = json_str(json, "url").unwrap_or("");
            let location = json
                .get("location")
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u16;
            let data = serialize::serialize_regproducer(producer, producer_key, url, location)?;
            Ok(Some(hex_encode(&data)))
        }
        ("eosio", "unregprod") => {
            // FIO's unregprod ABI is (fio_address, max_fee, actor), not a
            // bare producer name. Defer to abi_json_to_bin for the FIO shape.
            if json.get("fio_address").is_some() {
                return Ok(None);
            }
            let producer = json_str(json, "producer")?;
            let data = serialize::serialize_unregprod(producer)?;
            Ok(Some(hex_encode(&data)))
        }
        ("eosio", "regfinkey") => {
            let finalizer_name = json_str(json, "finalizer_name")?;
            let finalizer_key = json_str(json, "finalizer_key")?;
            let proof_of_possession = json_str(json, "proof_of_possession")?;
            let data = serialize::serialize_regfinkey(finalizer_name, finalizer_key, proof_of_possession)?;
            Ok(Some(hex_encode(&data)))
        }
        ("eosio", "actfinkey") | ("eosio", "delfinkey") => {
            let finalizer_name = json_str(json, "finalizer_name")?;
            let finalizer_key = json_str(json, "finalizer_key")?;
            let data = serialize::serialize_finkey_ref(finalizer_name, finalizer_key)?;
            Ok(Some(hex_encode(&data)))
        }
        _ => Ok(None), // Unknown action — will use abi_json_to_bin
    }
}

/// Extract a required string field from a JSON value.
fn json_str<'a>(json: &'a serde_json::Value, field: &str) -> Result<&'a str, Error> {
    json.get(field)
        .and_then(|v| v.as_str())
        .ok_or_else(|| Error::Serialization(format!("Missing field '{}' in action data", field)))
}

/// Parse an Antelope block time string ("2024-01-01T00:00:00.000") to Unix timestamp.
fn parse_block_time(time_str: &str) -> Result<u32, Error> {
    // Format: "YYYY-MM-DDThh:mm:ss" or "YYYY-MM-DDThh:mm:ss.sss"
    let clean = time_str.split('.').next().unwrap_or(time_str);
    let parts: Vec<&str> = clean.split('T').collect();
    if parts.len() != 2 {
        return Err(Error::Serialization(format!(
            "Invalid block time: '{}'",
            time_str
        )));
    }

    let date_parts: Vec<u32> = parts[0]
        .split('-')
        .map(|s| s.parse().unwrap_or(0))
        .collect();
    let time_parts: Vec<u32> = parts[1]
        .split(':')
        .map(|s| s.parse().unwrap_or(0))
        .collect();

    if date_parts.len() != 3 || time_parts.len() != 3 {
        return Err(Error::Serialization(format!(
            "Invalid block time: '{}'",
            time_str
        )));
    }

    let (year, month, day) = (date_parts[0], date_parts[1], date_parts[2]);
    let (hour, min, sec) = (time_parts[0], time_parts[1], time_parts[2]);

    // Simple Unix timestamp calculation (no leap seconds, good enough for TAPOS)
    let days = days_since_epoch(year, month, day);
    let timestamp = days as u32 * 86400 + hour * 3600 + min * 60 + sec;

    Ok(timestamp)
}

/// Days from Unix epoch (1970-01-01) to a given date.
fn days_since_epoch(year: u32, month: u32, day: u32) -> u32 {
    // Adjusted month/year for March-based counting
    let m = if month > 2 { month - 3 } else { month + 9 };
    let y = if month > 2 { year } else { year - 1 };

    // Days in years + days in months + day
    let era = y / 400;
    let yoe = y - era * 400;
    let doy = (153 * m + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;

    (era * 146097 + doe) - 719468 // Adjust from 0000-03-01 epoch to 1970-01-01
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_block_time_basic() {
        let ts = parse_block_time("2024-01-01T00:00:00.000").unwrap();
        // 2024-01-01 00:00:00 UTC = 1704067200
        assert_eq!(ts, 1704067200);
    }

    #[test]
    fn parse_block_time_no_millis() {
        let ts = parse_block_time("2024-06-15T12:30:45").unwrap();
        // Verify it's a reasonable timestamp (June 2024)
        assert!(ts > 1700000000);
        assert!(ts < 1750000000);
    }

    #[test]
    fn native_transfer_serialize() {
        let json = serde_json::json!({
            "from": "alice",
            "to": "bob",
            "quantity": "1.0000 EOS",
            "memo": "test"
        });
        let result = try_native_serialize("eosio.token", "transfer", &json).unwrap();
        assert!(result.is_some());
    }

    #[test]
    fn native_voteproducer_serialize() {
        let json = serde_json::json!({
            "voter": "alice",
            "proxy": "",
            "producers": ["bp1", "bp2"]
        });
        let result = try_native_serialize("eosio", "voteproducer", &json).unwrap();
        assert!(result.is_some());
    }

    #[test]
    fn unknown_action_returns_none() {
        let json = serde_json::json!({"key": "value"});
        let result = try_native_serialize("customcontract", "customaction", &json).unwrap();
        assert!(result.is_none());
    }
}
