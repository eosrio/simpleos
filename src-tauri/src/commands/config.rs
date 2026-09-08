use crate::antelope::chain_config::{self, ChainConfig};
use crate::error::Error;
use tauri_plugin_store::StoreExt;

/// Renderer preferences have one fixed file and a bounded set of key families.
/// In particular, no renderer-supplied value can become a filesystem path.
fn validate_preference_key(key: &str) -> Result<(), Error> {
    let exact = [
        "accounts",
        "securityMode",
        "autoLockMinutes",
        "closeToTray",
        "pinnedDapps",
        "dappSessions",
        "created_accounts",
        "tokenPrices",
        "contacts",
        "contactsMigratedPerChain",
    ];
    let prefix = [
        "contacts:",
        "recentContracts:",
        "contractAbi:",
        "bp_config_",
        "msig_cache_",
    ];
    if key.len() <= 256 && (exact.contains(&key) || prefix.iter().any(|p| key.starts_with(p))) {
        Ok(())
    } else {
        Err(Error::Serialization("Unknown preference key".into()))
    }
}

#[tauri::command]
pub fn preference_get(
    app: tauri::AppHandle,
    key: String,
) -> Result<Option<serde_json::Value>, Error> {
    validate_preference_key(&key)?;
    let store = app
        .store("wallet-state.json")
        .map_err(|e| Error::Serialization(e.to_string()))?;
    Ok(store.get(&key))
}

#[tauri::command]
pub fn preference_set(
    app: tauri::AppHandle,
    key: String,
    value: serde_json::Value,
) -> Result<(), Error> {
    validate_preference_key(&key)?;
    if value.to_string().len() > 4 * 1024 * 1024 {
        return Err(Error::Serialization("Preference value too large".into()));
    }
    let store = app
        .store("wallet-state.json")
        .map_err(|e| Error::Serialization(e.to_string()))?;
    store.set(key, value);
    store
        .save()
        .map_err(|e| Error::Serialization(e.to_string()))
}

#[tauri::command]
pub fn preference_delete(app: tauri::AppHandle, key: String) -> Result<(), Error> {
    validate_preference_key(&key)?;
    let store = app
        .store("wallet-state.json")
        .map_err(|e| Error::Serialization(e.to_string()))?;
    store.delete(&key);
    store
        .save()
        .map_err(|e| Error::Serialization(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preferences_cannot_address_backend_policy_or_key_material() {
        for key in [
            "confirm_policy",
            "../confirm_policy",
            "keys/__vault__/index.json",
            "vault.marker",
        ] {
            assert!(validate_preference_key(key).is_err());
        }
        for key in [
            "accounts",
            "contacts:chain-id",
            "contractAbi:chain-id:eosio",
        ] {
            assert!(validate_preference_key(key).is_ok());
        }
    }
}

/// Get all chain configurations (mainnets + testnets).
#[tauri::command]
pub fn get_chains_config() -> Result<Vec<ChainConfig>, Error> {
    let mut chains = chain_config::default_chains();
    chains.extend(chain_config::default_testnets());
    Ok(chains)
}
