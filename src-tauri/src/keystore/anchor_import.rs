//! Anchor backup file parser and import logic.
//!
//! Parses the JSON backup format exported by Anchor wallet (Greymass),
//! extracts wallet entries and network definitions, and optionally
//! decrypts private keys for full import.

use crate::error::Error;
use crate::keystore::anchor_crypto;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── Anchor Backup JSON Types ──

#[derive(Debug, Deserialize)]
pub struct AnchorBackup {
    pub networks: Vec<SchemaWrapped<AnchorNetwork>>,
    pub wallets: Vec<SchemaWrapped<AnchorWallet>>,
    pub storage: SchemaWrapped<AnchorStorage>,
    pub settings: SchemaWrapped<AnchorSettings>,
}

#[derive(Debug, Deserialize)]
pub struct SchemaWrapped<T> {
    pub schema: String,
    pub data: T,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnchorNetwork {
    pub chain_id: String,
    pub name: String,
    pub symbol: String,
    pub node: String,
    #[serde(default)]
    pub key_prefix: Option<String>,
    #[serde(default)]
    pub testnet: bool,
    #[serde(default)]
    pub token_precision: Option<u8>,
    #[serde(default)]
    pub staked_resources: Option<bool>,
    #[serde(default)]
    pub supported_contracts: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnchorWallet {
    pub account: String,
    pub authority: String,
    pub chain_id: String,
    pub mode: String,
    pub pubkey: String,
    #[serde(rename = "type")]
    pub key_type: String,
    #[serde(default)]
    pub path: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AnchorStorage {
    pub data: String,
    pub keys: Vec<String>,
    #[serde(default)]
    pub paths: HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnchorSettings {
    #[serde(default)]
    pub wallet_hash: Option<String>,
    #[serde(default)]
    pub display_test_networks: Option<bool>,
}

/// A single key entry from the decrypted storage.
#[derive(Debug, Deserialize)]
pub struct AnchorKeyEntry {
    pub key: String,    // WIF private key
    pub pubkey: String, // Public key (EOS.../FIO...)
}

// ── Output types (sent to frontend) ──

/// A parsed wallet entry ready for the selection UI.
#[derive(Debug, Clone, Serialize)]
pub struct AnchorWalletEntry {
    pub account: String,
    pub authority: String,
    pub chain_id: String,
    pub chain_name: String,
    pub symbol: String,
    pub pubkey: String,
    pub mode: String, // "hot" or "ledger"
    pub is_testnet: bool,
    pub hd_path: Option<String>,
    pub has_private_key: bool, // true if pubkey found in storage.keys
}

/// Result of parsing an Anchor backup (no password needed).
#[derive(Debug, Serialize)]
pub struct ParsedAnchorBackup {
    pub entries: Vec<AnchorWalletEntry>,
    pub has_encrypted_keys: bool,
    pub total_hot_keys: usize,
    pub total_ledger_keys: usize,
}

/// What the frontend sends back for each wallet to import.
#[derive(Debug, Deserialize)]
pub struct ImportSelection {
    pub account: String,
    pub authority: String,
    pub chain_id: String,
    pub pubkey: String,
    pub import_mode: String, // "full" or "watch"
}

/// Result of importing selected entries.
#[derive(Debug, Serialize)]
pub struct AnchorImportResult {
    pub imported_full: usize,
    pub imported_watch: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}

// ── Core Logic ──

/// Parse an Anchor backup JSON file and return the list of wallet entries
/// for the selection UI. No password required at this stage.
pub fn parse_backup(json: &str) -> Result<ParsedAnchorBackup, Error> {
    let backup: AnchorBackup = serde_json::from_str(json)
        .map_err(|e| Error::Serialization(format!("Invalid Anchor backup JSON: {}", e)))?;

    // Build network lookup: chainId → (name, symbol, testnet)
    let networks: HashMap<String, (&AnchorNetwork,)> = backup
        .networks
        .iter()
        .map(|n| (n.data.chain_id.clone(), (&n.data,)))
        .collect();

    let storage_keys: std::collections::HashSet<&str> = backup
        .storage
        .data
        .keys
        .iter()
        .map(|k| k.as_str())
        .collect();

    let mut entries = Vec::new();

    for wallet in &backup.wallets {
        let w = &wallet.data;

        let (chain_name, symbol, is_testnet) = match networks.get(&w.chain_id) {
            Some((net,)) => (net.name.clone(), net.symbol.clone(), net.testnet),
            None => (
                // SEC-010: never byte-index an unvalidated backup string
                format!("Unknown ({})", crate::util::short_prefix(&w.chain_id, 8)),
                "???".into(),
                false,
            ),
        };

        let hd_path = w
            .path
            .clone()
            .or_else(|| backup.storage.data.paths.get(&w.pubkey).cloned());

        entries.push(AnchorWalletEntry {
            account: w.account.clone(),
            authority: w.authority.clone(),
            chain_id: w.chain_id.clone(),
            chain_name,
            symbol,
            pubkey: w.pubkey.clone(),
            mode: w.mode.clone(),
            is_testnet,
            hd_path,
            has_private_key: storage_keys.contains(w.pubkey.as_str()),
        });
    }

    let total_hot = entries.iter().filter(|e| e.mode == "hot").count();
    let total_ledger = entries.iter().filter(|e| e.mode == "ledger").count();

    Ok(ParsedAnchorBackup {
        entries,
        has_encrypted_keys: !backup.storage.data.data.is_empty(),
        total_hot_keys: total_hot,
        total_ledger_keys: total_ledger,
    })
}

/// Verify the Anchor wallet password using the walletHash from settings.
pub fn verify_password(json: &str, password: &str) -> Result<bool, Error> {
    let backup: AnchorBackup = serde_json::from_str(json)
        .map_err(|e| Error::Serialization(format!("Invalid Anchor backup JSON: {}", e)))?;

    let wallet_hash = backup
        .settings
        .data
        .wallet_hash
        .as_deref()
        .ok_or_else(|| Error::Encryption("No walletHash in backup settings".into()))?;

    anchor_crypto::verify_anchor_password(wallet_hash, password)
}

/// Decrypt the storage and return a map of pubkey → WIF private key.
pub fn decrypt_keys(json: &str, password: &str) -> Result<HashMap<String, String>, Error> {
    let backup: AnchorBackup = serde_json::from_str(json)
        .map_err(|e| Error::Serialization(format!("Invalid Anchor backup JSON: {}", e)))?;

    let decrypted_json = anchor_crypto::decrypt_anchor(&backup.storage.data.data, password)?;

    let key_entries: Vec<AnchorKeyEntry> = serde_json::from_str(&decrypted_json)
        .map_err(|e| Error::Serialization(format!("Invalid decrypted key data: {}", e)))?;

    let mut map = HashMap::new();
    for entry in key_entries {
        map.insert(entry.pubkey, entry.key);
    }

    Ok(map)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Minimal valid Anchor backup for testing the parser.
    const MINI_BACKUP: &str = r#"{
        "networks": [
            {"schema": "anchor.v2.network", "data": {
                "chainId": "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906",
                "name": "EOS", "symbol": "EOS", "node": "https://eos.greymass.com",
                "keyPrefix": "EOS", "testnet": false, "supportedContracts": ["rex","powerup"]
            }},
            {"schema": "anchor.v2.network", "data": {
                "chainId": "1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4",
                "name": "WAX", "symbol": "WAX", "node": "https://wax.greymass.com",
                "keyPrefix": "EOS", "testnet": false, "tokenPrecision": 8, "supportedContracts": []
            }},
            {"schema": "anchor.v2.network", "data": {
                "chainId": "73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d",
                "name": "Jungle 4 (EOS Testnet)", "symbol": "EOS", "node": "https://jungle4.api.eosnation.io",
                "keyPrefix": "EOS", "testnet": true, "supportedContracts": []
            }}
        ],
        "wallets": [
            {"schema": "anchor.v2.wallet", "data": {
                "account": "eosriobrazil", "authority": "active",
                "chainId": "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906",
                "mode": "hot", "pubkey": "EOS5svWC6jACYeHwjN1UNAXfnvSxA6bbRxK3myFMpp9HKHML5u5SE", "type": "key"
            }},
            {"schema": "anchor.v2.wallet", "data": {
                "account": "eosriobrazil", "authority": "active",
                "chainId": "1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4",
                "mode": "hot", "pubkey": "EOS7tytkrnAdh9r821sFX3r3YgT1HveAtdPgq6hPTavwUNMoc26ew", "type": "key"
            }},
            {"schema": "anchor.v2.wallet", "data": {
                "account": "eosriobrazil", "authority": "active",
                "chainId": "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906",
                "mode": "ledger", "pubkey": "EOS7SkbAhCuUjPZMvwiSogpze8Q7xa78bMRHvr1hvHjcEdbd4dBpQ",
                "type": "ledger", "path": "44'/194'/0'/0/0"
            }},
            {"schema": "anchor.v2.wallet", "data": {
                "account": "eosriobrazil", "authority": "active",
                "chainId": "73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d",
                "mode": "hot", "pubkey": "EOS7Lirhftz9PMa3DEozBt6R8jB63Vuy5hAnS3u1TkMLpXxiUdAAa", "type": "key"
            }}
        ],
        "storage": {"schema": "anchor.v2.storage", "data": {
            "data": "aabbccdd",
            "keys": ["EOS5svWC6jACYeHwjN1UNAXfnvSxA6bbRxK3myFMpp9HKHML5u5SE", "EOS7tytkrnAdh9r821sFX3r3YgT1HveAtdPgq6hPTavwUNMoc26ew", "EOS7Lirhftz9PMa3DEozBt6R8jB63Vuy5hAnS3u1TkMLpXxiUdAAa"],
            "paths": {"EOS7SkbAhCuUjPZMvwiSogpze8Q7xa78bMRHvr1hvHjcEdbd4dBpQ": "44'/194'/0'/0/0"}
        }},
        "settings": {"schema": "anchor.v2.settings", "data": {"walletHash": "aabb"}},
        "pending": {"schema": "anchor.v1.pending", "data": {"accounts":[], "certificates":[], "request": false}}
    }"#;

    #[test]
    fn parse_backup_extracts_entries() {
        let result = parse_backup(MINI_BACKUP).unwrap();
        assert_eq!(result.entries.len(), 4);
        assert_eq!(result.total_hot_keys, 3);
        assert_eq!(result.total_ledger_keys, 1);
        assert!(result.has_encrypted_keys);
    }

    #[test]
    fn parse_backup_resolves_chain_names() {
        let result = parse_backup(MINI_BACKUP).unwrap();
        assert_eq!(result.entries[0].chain_name, "EOS");
        assert_eq!(result.entries[0].symbol, "EOS");
        assert_eq!(result.entries[1].chain_name, "WAX");
        assert_eq!(result.entries[1].symbol, "WAX");
    }

    #[test]
    fn parse_backup_detects_testnets() {
        let result = parse_backup(MINI_BACKUP).unwrap();
        assert!(!result.entries[0].is_testnet); // EOS mainnet
        assert!(result.entries[3].is_testnet); // Jungle 4
    }

    #[test]
    fn parse_backup_resolves_hd_paths() {
        let result = parse_backup(MINI_BACKUP).unwrap();
        // Ledger entry has path from wallet data
        let ledger = result.entries.iter().find(|e| e.mode == "ledger").unwrap();
        assert_eq!(ledger.hd_path.as_deref(), Some("44'/194'/0'/0/0"));
    }

    #[test]
    fn parse_backup_detects_private_key_availability() {
        let result = parse_backup(MINI_BACKUP).unwrap();
        // Hot wallets with keys in storage.keys
        assert!(result.entries[0].has_private_key);
        assert!(result.entries[1].has_private_key);
        // Ledger wallet — key not in storage.keys
        let ledger = result.entries.iter().find(|e| e.mode == "ledger").unwrap();
        assert!(!ledger.has_private_key);
    }
}
