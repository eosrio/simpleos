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

/// Get the Ethereum app version from the Ledger.
/// Returns { major, minor, patch, arbitrary_data_enabled }.
#[tauri::command]
pub fn ledger_get_eth_app_config() -> Result<serde_json::Value, Error> {
    let (arbitrary_data_enabled, major, minor, patch) = protocol::get_eth_app_configuration()?;
    Ok(serde_json::json!({
        "major": major,
        "minor": minor,
        "patch": patch,
        "arbitrary_data_enabled": arbitrary_data_enabled,
    }))
}

/// Get a public key from the Ledger EOS app at a BIP44 slot.
/// If confirm is true, the user must confirm on the device screen.
#[tauri::command]
pub fn ledger_get_public_key(account: u32, index: u32, confirm: bool) -> Result<String, Error> {
    let path = protocol::eos_bip44_path(account, index);
    protocol::get_public_key(&path, confirm)
}

/// Get a `PUB_EM_...` public key and `0x...` Ethereum address from the Ledger Ethereum app at a BIP44 slot.
#[tauri::command]
pub fn ledger_get_eth_public_key(
    account: u32,
    index: u32,
    confirm: bool,
) -> Result<serde_json::Value, Error> {
    let path = protocol::eth_bip44_path(account, index);
    let (pub_em, eth_address) = protocol::get_eth_public_key(&path, confirm)?;
    Ok(serde_json::json!({
        "public_key": pub_em,
        "eth_address": eth_address,
        "account": account,
        "index": index,
    }))
}

/// Discover all EOS public keys on the Ledger (account=0, indices 0..max_index).
#[tauri::command]
pub fn ledger_discover_keys(max_index: u32) -> Result<Vec<serde_json::Value>, Error> {
    let keys = protocol::discover_keys(max_index)?;
    Ok(keys
        .into_iter()
        .map(|(path, pubkey)| {
            serde_json::json!({
                "path": path.iter().map(|p| format!("{}{}", p & 0x7FFFFFFF, if p & 0x80000000 != 0 { "'" } else { "" })).collect::<Vec<_>>().join("/"),
                "public_key": pubkey,
                "index": path.last().copied().unwrap_or(0),
            })
        })
        .collect())
}

/// Discover Ethereum `PUB_EM_...` public keys on the Ledger Ethereum app (account=0, indices 0..max_index).
#[tauri::command]
pub fn ledger_discover_eth_keys(max_index: u32) -> Result<Vec<serde_json::Value>, Error> {
    let keys = protocol::discover_eth_keys(max_index)?;
    Ok(keys
        .into_iter()
        .map(|(path, pub_em, eth_address)| {
            serde_json::json!({
                "path": path.iter().map(|p| format!("{}{}", p & 0x7FFFFFFF, if p & 0x80000000 != 0 { "'" } else { "" })).collect::<Vec<_>>().join("/"),
                "public_key": pub_em,
                "eth_address": eth_address,
                "index": path.last().copied().unwrap_or(0),
            })
        })
        .collect())
}

/// Sign a transaction using the Ledger EOS app.
/// Builds the signing digest (chain_id + packed_trx + 32 zeros) and sends to device.
#[tauri::command]
pub async fn ledger_sign_and_push(
    chain_id: String,
    account_index: u32,
    actions: Vec<crate::antelope::transaction::ActionDesc>,
    providers: State<'_, ProviderState>,
) -> Result<crate::antelope::transaction::TransactionResult, Error> {
    let path = protocol::eos_bip44_path(0, account_index);

    let pm = &mut providers.get(&chain_id).await?;

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

    transaction::push_signed(pm, &packed_trx, &signature).await
}

/// Sign a transaction using the Ledger EOS app without broadcasting it.
/// Returns packed transaction hex plus the Ledger-produced signature.
#[tauri::command]
pub async fn ledger_sign_transaction(
    chain_id: String,
    account_index: u32,
    actions: Vec<crate::antelope::transaction::ActionDesc>,
    providers: State<'_, ProviderState>,
) -> Result<serde_json::Value, Error> {
    let path = protocol::eos_bip44_path(0, account_index);

    let pm = &mut providers.get(&chain_id).await?;

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
