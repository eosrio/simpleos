use std::collections::HashSet;

use crate::antelope::provider::ProviderState;
use crate::antelope::transaction;
use crate::error::Error;
use crate::ledger::{protocol, transport};
use tauri::{AppHandle, Emitter, State};

/// Check if a Ledger device is connected and list device names.
#[tauri::command]
pub fn ledger_list_devices() -> Result<Vec<String>, Error> {
    transport::list_ledgers()
}

/// Get the EOS app version from the Ledger.
/// Returns { major, minor, patch, allow_unknown, verbose }.
#[tauri::command]
pub fn ledger_get_app_config() -> Result<serde_json::Value, Error> {
    let (allow_unknown, verbose, major, minor, patch) = protocol::get_app_configuration()?;
    Ok(serde_json::json!({
        "major": major,
        "minor": minor,
        "patch": patch,
        "allow_unknown": allow_unknown,
        "verbose": verbose,
    }))
}

/// Get a public key from the Ledger at a BIP44 slot.
/// If confirm is true, the user must confirm on the device screen.
#[tauri::command]
pub fn ledger_get_public_key(account: u32, index: u32, confirm: bool) -> Result<String, Error> {
    let path = protocol::eos_bip44_path(account, index);
    protocol::get_public_key(&path, confirm)
}

/// Discover all EOS public keys on the Ledger (account=0, indices 0..max_index).
#[tauri::command]
pub fn ledger_discover_keys(max_index: u32) -> Result<Vec<serde_json::Value>, Error> {
    let keys = protocol::discover_keys(max_index)?;
    Ok(keys.into_iter().map(|(path, pubkey)| {
        serde_json::json!({
            "path": path.iter().map(|p| format!("{}{}", p & 0x7FFFFFFF, if p & 0x80000000 != 0 { "'" } else { "" })).collect::<Vec<_>>().join("/"),
            "public_key": pubkey,
            "index": path.last().copied().unwrap_or(0),
        })
    }).collect())
}

/// Sign a transaction using the Ledger.
/// Builds the signing digest (chain_id + packed_trx + 32 zeros) and sends to device.
#[tauri::command]
pub async fn ledger_sign_and_push(
    chain_id: String,
    account_index: u32,
    actions: Vec<crate::antelope::transaction::ActionDesc>,
    providers: State<'_, ProviderState>,
) -> Result<crate::antelope::transaction::TransactionResult, Error> {
    let path = protocol::eos_bip44_path(0, account_index);

    let mut map = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    // Build and serialize the transaction (but don't sign it in software)
    let (packed_trx, actual_chain_id) = transaction::build_transaction(pm, &actions).await?;

    // Build the signing data: chain_id (32 bytes) + packed_trx + 32 zero bytes
    let chain_id_bytes = hex::decode(&actual_chain_id)
        .map_err(|e| Error::Serialization(format!("Invalid chain_id hex: {}", e)))?;

    let mut signing_data = Vec::with_capacity(chain_id_bytes.len() + packed_trx.len() + 32);
    signing_data.extend_from_slice(&chain_id_bytes);
    signing_data.extend_from_slice(&packed_trx);
    signing_data.extend_from_slice(&[0u8; 32]);

    // Send to Ledger for signing (this blocks while user confirms on device)
    let signature = protocol::sign_transaction(&path, &signing_data)?;

    // Push the signed transaction
    let packed_hex = hex::encode(&packed_trx);
    let push_body = serde_json::json!({
        "signatures": [signature],
        "compression": "none",
        "packed_context_free_data": "",
        "packed_trx": packed_hex,
    });

    let result = transaction::push_packed_transaction(pm, &push_body).await?;

    if let Some(tx_id) = result.get("transaction_id").and_then(|v| v.as_str()) {
        Ok(crate::antelope::transaction::TransactionResult {
            transaction_id: tx_id.to_string(),
            block_num: result
                .get("processed")
                .and_then(|p| p.get("block_num"))
                .and_then(|b| b.as_u64()),
            block_time: None,
        })
    } else {
        let err_msg = result
            .get("error")
            .and_then(|e| e.get("details"))
            .and_then(|d| d.as_array())
            .and_then(|a| a.first())
            .and_then(|d| d.get("message"))
            .and_then(|m| m.as_str())
            .unwrap_or("Push transaction failed");
        Err(Error::Rpc(err_msg.to_string()))
    }
}

/// Sign a transaction using the Ledger without broadcasting it.
/// Returns packed transaction hex plus the Ledger-produced signature.
#[tauri::command]
pub async fn ledger_sign_transaction(
    chain_id: String,
    account_index: u32,
    actions: Vec<crate::antelope::transaction::ActionDesc>,
    providers: State<'_, ProviderState>,
) -> Result<serde_json::Value, Error> {
    let path = protocol::eos_bip44_path(0, account_index);

    let mut map = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    let (packed_trx, actual_chain_id) = transaction::build_transaction(pm, &actions).await?;
    let chain_id_bytes = hex::decode(&actual_chain_id)
        .map_err(|e| Error::Serialization(format!("Invalid chain_id hex: {}", e)))?;

    let mut signing_data = Vec::with_capacity(chain_id_bytes.len() + packed_trx.len() + 32);
    signing_data.extend_from_slice(&chain_id_bytes);
    signing_data.extend_from_slice(&packed_trx);
    signing_data.extend_from_slice(&[0u8; 32]);

    let signature = protocol::sign_transaction(&path, &signing_data)?;

    Ok(serde_json::json!({
        "packed_trx": hex::encode(&packed_trx),
        "signature": signature,
    }))
}

/// Start a background task that polls for Ledger device connect/disconnect events.
/// Emits "ledger-connected" with the device name when a new device appears,
/// and "ledger-disconnected" with the device name when a device disappears.
/// Polls every 2 seconds using `list_ledgers()`.
#[tauri::command]
pub fn ledger_watch_devices(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut known: HashSet<String> = HashSet::new();

        loop {
            let current: HashSet<String> = match transport::list_ledgers() {
                Ok(devices) => devices.into_iter().collect(),
                Err(_) => HashSet::new(),
            };

            // Detect newly connected devices
            for device in current.difference(&known) {
                // SEC-050: scope Ledger presence events to the main window only
                let _ = app.emit_to("main", "ledger-connected", device.clone());
                log::info!("[ledger] Device connected: {}", device);
            }

            // Detect disconnected devices
            for device in known.difference(&current) {
                // SEC-050: scope Ledger presence events to the main window only
                let _ = app.emit_to("main", "ledger-disconnected", device.clone());
                log::info!("[ledger] Device disconnected: {}", device);
            }

            known = current;

            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        }
    });
}
