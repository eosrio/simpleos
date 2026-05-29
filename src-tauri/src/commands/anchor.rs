use tauri::{Manager, State};

use crate::error::Error;
use crate::keystore::anchor_import::{
    self, AnchorImportResult, ImportSelection, ParsedAnchorBackup,
};
use crate::AppWallet;

/// Parse an Anchor backup JSON string and return wallet entries for the selection UI.
/// No password needed — only reads wallet/network metadata.
#[tauri::command(async)]
pub fn parse_anchor_backup(json: String) -> Result<ParsedAnchorBackup, Error> {
    anchor_import::parse_backup(&json)
}

/// Verify the Anchor wallet password against the backup's walletHash.
#[tauri::command(async)]
pub fn verify_anchor_password(json: String, password: String) -> Result<bool, Error> {
    anchor_import::verify_password(&json, &password)
}

/// Import selected wallet entries from an Anchor backup.
///
/// For "full" imports: decrypts the private key from the Anchor vault,
/// then re-encrypts it with the SimplEOS master key and stores it.
///
/// For "watch" imports: only records the account/chain/pubkey mapping
/// (no key material stored).
#[tauri::command(async)]
pub fn import_anchor_entries(
    app: tauri::AppHandle,
    json: String,
    anchor_password: String,
    simpleos_passphrase: String,
    selections: Vec<ImportSelection>,
    wallet: State<AppWallet>,
) -> Result<AnchorImportResult, Error> {
    let mut result = AnchorImportResult {
        imported_full: 0,
        imported_watch: 0,
        skipped: 0,
        errors: vec![],
    };

    // Only decrypt if any "full" imports requested
    let needs_decrypt = selections.iter().any(|s| s.import_mode == "full");

    let key_map = if needs_decrypt {
        log::info!("[anchor] Decrypting Anchor storage...");
        match anchor_import::decrypt_keys(&json, &anchor_password) {
            Ok(map) => {
                log::info!("[anchor] Decrypted {} private keys", map.len());
                for (pubkey, _) in &map {
                    log::info!(
                        "[anchor]   key: {}...{}",
                        &pubkey[..12],
                        &pubkey[pubkey.len() - 6..]
                    );
                }
                Some(map)
            }
            Err(e) => {
                log::error!("[anchor] Decryption FAILED: {}", e);
                return Err(e);
            }
        }
    } else {
        None
    };

    // Ensure SimplEOS vault exists and session is unlocked
    let has_full = selections.iter().any(|s| s.import_mode == "full");
    if has_full {
        let mut full_imports: Vec<(&ImportSelection, &str)> = Vec::new();

        for sel in &selections {
            if sel.import_mode == "full" {
                let wif = match key_map.as_ref().and_then(|m| m.get(&sel.pubkey)) {
                    Some(wif) => wif.as_str(),
                    None => {
                        result.errors.push(format!(
                            "No private key found for {} on {}",
                            sel.account, sel.chain_id
                        ));
                        result.skipped += 1;
                        continue;
                    }
                };

                log::info!(
                    "[anchor] Queued key for {}@{} on chain {}...",
                    sel.account,
                    sel.authority,
                    &sel.chain_id[..8]
                );
                full_imports.push((sel, wif));
            } else {
                // Watch-only — no key import needed, frontend handles account creation
                result.imported_watch += 1;
            }
        }

        if !full_imports.is_empty() {
            log::info!(
                "[anchor] Batch importing {} full keys with shared wallet key derivation...",
                full_imports.len()
            );
            let import_items: Vec<(&str, &str)> = full_imports
                .iter()
                .map(|(sel, wif)| (*wif, sel.chain_id.as_str()))
                .collect();
            let import_results = wallet.0.import_keys(&import_items, &simpleos_passphrase)?;

            for ((sel, _), import_result) in full_imports.iter().zip(import_results.into_iter()) {
                match import_result {
                    Ok(r) => {
                        log::info!(
                            "[anchor]   OK: {}@{} on {} stored as {}",
                            sel.account,
                            sel.authority,
                            &sel.chain_id[..8],
                            r.public_key
                        );
                        result.imported_full += 1;
                    }
                    Err(e) => {
                        log::error!(
                            "[anchor]   FAILED: {}@{} on {}: {}",
                            sel.account,
                            sel.authority,
                            &sel.chain_id[..8],
                            e
                        );
                        result.errors.push(format!(
                            "Failed to import {} ({}@{}): {}",
                            sel.pubkey, sel.account, sel.chain_id, e
                        ));
                        result.skipped += 1;
                    }
                }
            }
        }
    } else {
        // All watch-only
        result.imported_watch = selections.len();
    }

    // Mark vault as created if any full imports succeeded
    if result.imported_full > 0 {
        if let Ok(app_dir) = app.path().app_data_dir() {
            let _ = std::fs::create_dir_all(&app_dir);
            let _ = std::fs::write(app_dir.join("vault.marker"), b"1");
        }
    }

    Ok(result)
}
