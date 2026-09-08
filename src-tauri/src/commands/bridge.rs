//! Pinned read-only Ethereum state for the Ultra bridge. No arbitrary RPC or signing.
use crate::antelope::provider::{read_body_capped, MAX_INFO_BODY_BYTES};
use crate::error::Error;
use serde::Serialize;
use serde_json::{json, Value};
use std::time::Duration;

const BRIDGE: &str = "0x95cCdDC90266F5A31732eFeF6Ab69Baf53a54E50";
const ULTRA_CHAIN: &str = "a9c481dfbc7d9506dc7e87e9a137c931b0a9303f64fd7a1d08b8230133920097";

#[derive(Serialize)]
pub struct EvmBridgeState {
    paused: bool,
    schedule_version: String,
    settlements: Vec<Settlement>,
}
#[derive(Serialize)]
pub struct Settlement {
    counter: String,
    block: String,
}

fn request_batch(bridge_id: &str, counters: &[String]) -> Result<Value, Error> {
    if bridge_id != "ultra-ethereum" || counters.len() > 20 {
        return Err(Error::Rpc("Unsupported bridge or too many requests".into()));
    }
    let mut requests = vec![json!({"jsonrpc":"2.0","id":0,"method":"eth_chainId","params":[]})];
    let mut calls = vec![
        "0xe2bfe6aa".to_string(),
        "0x5c975abb".into(),
        "0x39958b29".into(),
        "0x64d42b17".into(),
    ];
    for counter in counters {
        let number = counter
            .parse::<u64>()
            .map_err(|_| Error::Rpc("Invalid bridge counter".into()))?;
        calls.push(format!("0x56fcff13{number:064x}"));
    }
    for (idx, data) in calls.into_iter().enumerate() {
        requests.push(json!({"jsonrpc":"2.0","id":idx+1,"method":"eth_call","params":[{"to":BRIDGE,"data":data},"latest"]}));
    }
    Ok(Value::Array(requests))
}

fn parse_state(value: Value, counters: &[String]) -> Result<EvmBridgeState, Error> {
    let rows = value
        .as_array()
        .ok_or_else(|| Error::Rpc("Invalid Ethereum response".into()))?;
    let result = |id: usize| -> Result<&str, Error> {
        let matching: Vec<_> = rows
            .iter()
            .filter(|row| row["id"].as_u64() == Some(id as u64))
            .collect();
        if matching.len() != 1 || matching[0].get("error").is_some() {
            return Err(Error::Rpc("Ethereum bridge state unavailable".into()));
        }
        matching[0]["result"]
            .as_str()
            .ok_or_else(|| Error::Rpc("Ethereum result missing".into()))
    };
    let word = |id: usize| -> Result<u64, Error> {
        let raw = result(id)?;
        if raw.len() != 66 || !raw.starts_with("0x") {
            return Err(Error::Rpc("Invalid Ethereum ABI word".into()));
        }
        u64::from_str_radix(&raw[2..], 16)
            .map_err(|_| Error::Rpc("Invalid Ethereum ABI integer".into()))
    };
    if result(0)? != "0x1" || result(1)? != format!("0x{ULTRA_CHAIN}") {
        return Err(Error::Rpc("Bridge network identity mismatch".into()));
    }
    let paused = word(2)?;
    if word(4)? != 1 {
        return Err(Error::Rpc("Bridge EVM chain identity mismatch".into()));
    }
    if paused > 1 {
        return Err(Error::Rpc("Invalid bridge pause state".into()));
    }
    let mut settlements = Vec::new();
    for (idx, counter) in counters.iter().enumerate() {
        settlements.push(Settlement {
            counter: counter.clone(),
            block: word(idx + 5)?.to_string(),
        });
    }
    Ok(EvmBridgeState {
        paused: paused == 1,
        schedule_version: word(3)?.to_string(),
        settlements,
    })
}

#[tauri::command]
pub async fn get_evm_bridge_state(
    bridge_id: String,
    counters: Vec<String>,
) -> Result<EvmBridgeState, Error> {
    let body = request_batch(&bridge_id, &counters)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| Error::Rpc(e.to_string()))?;
    let response = client
        .post("https://ethereum-rpc.publicnode.com")
        .json(&body)
        .send()
        .await
        .map_err(|e| Error::Rpc(e.to_string()))?;
    if !response.status().is_success() {
        return Err(Error::Rpc(format!(
            "Ethereum RPC returned HTTP {}",
            response.status()
        )));
    }
    let bytes = read_body_capped(response, MAX_INFO_BODY_BYTES).await?;
    let value = serde_json::from_slice(&bytes).map_err(|e| Error::Rpc(e.to_string()))?;
    parse_state(value, &counters)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pins_readonly_contract_and_encodes_counter_without_loss() {
        let request = request_batch("ultra-ethereum", &[u64::MAX.to_string()]).unwrap();
        assert_eq!(request[5]["method"], "eth_call");
        assert_eq!(request[5]["params"][0]["to"], BRIDGE);
        assert_eq!(
            request[5]["params"][0]["data"],
            format!("0x56fcff13{:064x}", u64::MAX)
        );
        assert!(request_batch("untrusted", &[]).is_err());
        assert!(request_batch("ultra-ethereum", &["-1".into()]).is_err());
    }
    #[test]
    fn rejects_wrong_network_partial_errors_and_duplicate_ids() {
        let rows = json!([
            {"id":0,"result":"0x1"}, {"id":1,"result":format!("0x{ULTRA_CHAIN}")},
            {"id":2,"result":format!("0x{:064x}",0)}, {"id":3,"result":format!("0x{:064x}",5)},
            {"id":4,"result":format!("0x{:064x}",1)}, {"id":5,"result":format!("0x{:064x}",100)}]);
        let state = parse_state(rows.clone(), &["67".into()]).unwrap();
        assert_eq!(state.settlements[0].block, "100");
        let mut wrong = rows.clone();
        wrong[0]["result"] = json!("0x2");
        assert!(parse_state(wrong, &["67".into()]).is_err());
        let mut error = rows.clone();
        error[4] = json!({"id":4,"error":{"code":-1}});
        assert!(parse_state(error, &["67".into()]).is_err());
        let mut duplicate = rows.clone();
        duplicate.as_array_mut().unwrap().push(rows[0].clone());
        assert!(parse_state(duplicate, &["67".into()]).is_err());
    }

    #[tokio::test]
    #[ignore = "Read-only Ethereum mainnet bridge status; requires network"]
    async fn live_ultra_bridge_identity_and_settlement() {
        let state = get_evm_bridge_state("ultra-ethereum".into(), vec!["67".into()])
            .await
            .unwrap();
        assert!(state.schedule_version.parse::<u64>().unwrap() > 0);
        assert!(state.settlements[0].block.parse::<u64>().unwrap() > 0);
    }
}
