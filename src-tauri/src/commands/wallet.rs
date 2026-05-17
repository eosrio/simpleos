use tauri::{Manager, State};

use crate::antelope::provider::ProviderState;
use crate::antelope::signing;
use crate::antelope::transaction::{self, ActionDesc, TransactionResult};
use crate::error::Error;
use crate::AppWallet;

// ── Vault Check ──

/// Check if a vault has been created by looking for a marker file.
#[tauri::command]
pub fn has_wallet(app: tauri::AppHandle) -> Result<bool, Error> {
    log::info!("[wallet] has_wallet: checking marker file...");
    let app_dir = app.path().app_data_dir().map_err(|e| {
        Error::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            e.to_string(),
        ))
    })?;
    let marker = app_dir.join("vault.marker");
    let exists = marker.exists();
    log::info!(
        "[wallet] has_wallet: marker at {:?} exists={}",
        marker,
        exists
    );
    Ok(exists)
}

fn mark_vault_created(app: &tauri::AppHandle) -> Result<(), Error> {
    let app_dir = app.path().app_data_dir().map_err(|e| {
        Error::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            e.to_string(),
        ))
    })?;
    std::fs::create_dir_all(&app_dir)?;
    std::fs::write(app_dir.join("vault.marker"), b"1")?;
    Ok(())
}

// ── Session ──

#[tauri::command]
pub fn is_locked(wallet: State<AppWallet>) -> Result<bool, Error> {
    Ok(wallet.0.is_locked())
}

// Run off the webview main thread: PBKDF2/Argon2 derivation is CPU-heavy
// and would otherwise freeze the UI (and any fullscreen loader animation).
#[tauri::command(async)]
pub fn unlock(passphrase: String, wallet: State<AppWallet>) -> Result<bool, Error> {
    wallet.0.unlock(&passphrase)?;
    Ok(true)
}

#[tauri::command]
pub fn lock(wallet: State<AppWallet>) -> Result<(), Error> {
    wallet.0.lock();
    Ok(())
}

// ── Key Management ──

// async: takes a passphrase and derives the vault key to store the new key — off-thread.
#[tauri::command(async)]
pub fn import_private_key(
    app: tauri::AppHandle,
    wif: String,
    chain_id: String,
    passphrase: String,
    wallet: State<AppWallet>,
) -> Result<crate::antelope::types::ImportResult, Error> {
    let result = wallet.0.import_key(&wif, &chain_id, &passphrase)?;

    // Mark vault as created
    let _ = mark_vault_created(&app);

    Ok(crate::antelope::types::ImportResult {
        public_key: result.public_key,
        accounts: vec![],
    })
}

/// Derive the public key from a WIF private key without storing anything.
/// Used to validate the key and discover accounts before importing.
/// Import a key using the existing unlocked session. No passphrase needed.
#[tauri::command]
pub fn import_key_with_session(
    app: tauri::AppHandle,
    wif: String,
    chain_id: String,
    wallet: State<AppWallet>,
) -> Result<crate::antelope::types::ImportResult, Error> {
    let result = wallet.0.import_key_with_session(&wif, &chain_id)?;

    let _ = mark_vault_created(&app);

    Ok(crate::antelope::types::ImportResult {
        public_key: result.public_key,
        accounts: vec![],
    })
}

#[tauri::command]
pub fn derive_public_key(wif: String) -> Result<String, Error> {
    let (_priv_bytes, public_key) = signing::public_key_from_wif(&wif)?;
    Ok(public_key)
}

/// Convert any public key (`EOS...`, `PUB_K1_...`, or hex) to FIO legacy
/// format (`FIO...`). FIO chain APIs and actions reject EOS/PUB_K1_ keys with
/// "Invalid FIO Public Key" — every FIO op that takes a pubkey must convert.
#[tauri::command]
pub fn to_fio_public_key(key: String) -> Result<String, Error> {
    if key.starts_with("FIO") {
        return Ok(key);
    }
    let compressed = signing::decode_public_key_flexible(&key)?;
    Ok(signing::encode_fio_public_key_from_bytes(&compressed))
}

#[tauri::command]
pub fn generate_key_pair() -> Result<crate::antelope::types::KeyPairResult, Error> {
    let (wif, public_key) = signing::generate_keypair()?;
    Ok(crate::antelope::types::KeyPairResult { wif, public_key })
}

#[tauri::command]
pub fn list_public_keys(chain_id: String, wallet: State<AppWallet>) -> Result<Vec<String>, Error> {
    wallet.0.list_keys(&chain_id)
}

#[tauri::command]
pub fn remove_key(
    chain_id: String,
    public_key: String,
    wallet: State<AppWallet>,
) -> Result<(), Error> {
    wallet.0.remove_key(&chain_id, &public_key)
}

// ── Key Export ──

/// Export a private key as WIF. Requires the wallet to be unlocked.
#[tauri::command]
pub fn export_private_key(
    chain_id: String,
    public_key: String,
    wallet: State<AppWallet>,
) -> Result<String, Error> {
    let private_key_bytes = wallet.0.decrypt_key(&chain_id, &public_key)?;
    Ok(signing::wif_encode(&private_key_bytes))
}

// ── Transaction Signing ──

#[tauri::command]
pub async fn sign_and_push(
    chain_id: String,
    public_key: String,
    actions: Vec<ActionDesc>,
    wallet: State<'_, AppWallet>,
    providers: State<'_, ProviderState>,
) -> Result<TransactionResult, Error> {
    let private_key_bytes = wallet.0.decrypt_key(&chain_id, &public_key)?;

    let mut map: tokio::sync::MutexGuard<
        '_,
        std::collections::HashMap<String, crate::antelope::provider::ProviderManager>,
    > = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    transaction::sign_and_push(pm, &actions, &private_key_bytes).await
}

#[tauri::command]
pub async fn sign_transaction(
    chain_id: String,
    public_key: String,
    actions: Vec<ActionDesc>,
    wallet: State<'_, AppWallet>,
    providers: State<'_, ProviderState>,
) -> Result<SignedTransaction, Error> {
    let private_key_bytes = wallet.0.decrypt_key(&chain_id, &public_key)?;

    let mut map: tokio::sync::MutexGuard<
        '_,
        std::collections::HashMap<String, crate::antelope::provider::ProviderManager>,
    > = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    let (packed_trx, signature) = transaction::sign_only(pm, &actions, &private_key_bytes).await?;

    Ok(SignedTransaction {
        packed_trx,
        signature,
    })
}

/// Sign a raw 32-byte digest (hex-encoded) with the private key matching
/// the given public key on the specified chain. Used for ESR identity proofs.
#[tauri::command]
pub async fn sign_digest(
    chain_id: String,
    public_key: String,
    digest_hex: String,
    wallet: State<'_, AppWallet>,
) -> Result<String, Error> {
    let private_key_bytes = wallet.0.decrypt_key(&chain_id, &public_key)?;
    let signature = crate::antelope::signing::sign_digest(&digest_hex, &private_key_bytes)?;
    Ok(signature)
}

// ── Passphrase ──

#[tauri::command]
pub fn change_passphrase(
    old_passphrase: String,
    new_passphrase: String,
    wallet: State<AppWallet>,
    app: tauri::AppHandle,
) -> Result<(), Error> {
    wallet
        .0
        .change_passphrase(&old_passphrase, &new_passphrase)?;
    let _ = crate::biometric::remove_unlock_secret(&app);
    if let Ok(app_dir) = app.path().app_data_dir() {
        let _ = std::fs::remove_file(app_dir.join("pin.dat"));
    }
    Ok(())
}

// ── Security Mode ──

#[tauri::command]
pub fn get_security_mode(wallet: State<AppWallet>) -> Result<String, Error> {
    let mode = wallet.0.security_mode();
    Ok(serde_json::to_string(&mode).unwrap_or_else(|_| "\"SessionUnlock\"".into()))
}

#[tauri::command]
pub fn set_security_mode(mode: String, wallet: State<AppWallet>) -> Result<(), Error> {
    let parsed: crate::keystore::wallet::SecurityMode =
        serde_json::from_str(&format!("\"{}\"", mode))
            .map_err(|_| Error::Serialization(format!("Invalid security mode: {}", mode)))?;
    wallet.0.set_security_mode(parsed);
    Ok(())
}

#[tauri::command]
pub fn needs_passphrase_for_signing(wallet: State<AppWallet>) -> Result<bool, Error> {
    Ok(wallet.0.needs_passphrase_for_signing())
}

#[tauri::command]
pub fn needs_lockscreen(wallet: State<AppWallet>) -> Result<bool, Error> {
    Ok(wallet.0.needs_lockscreen())
}

/// Sign and push with an explicit passphrase (for SignPerUse / locked ManualToggle mode).
#[tauri::command]
pub async fn sign_and_push_with_passphrase(
    chain_id: String,
    public_key: String,
    passphrase: String,
    actions: Vec<ActionDesc>,
    wallet: State<'_, AppWallet>,
    providers: State<'_, ProviderState>,
) -> Result<TransactionResult, Error> {
    let private_key_bytes =
        wallet
            .0
            .decrypt_key_with_passphrase(&chain_id, &public_key, &passphrase)?;

    let mut map: tokio::sync::MutexGuard<
        '_,
        std::collections::HashMap<String, crate::antelope::provider::ProviderManager>,
    > = providers.0.lock().await;
    let pm = map
        .get_mut(&chain_id)
        .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;

    transaction::sign_and_push(pm, &actions, &private_key_bytes).await
}

// ── Finalizer Keys (BLS) ──

/// Generate a BLS12-381 finalizer key pair and proof of possession.
/// Stores the BLS private key in the keystore under a special chain prefix.
/// Returns { pub_key, pop } for use with regfinkey.
#[tauri::command]
pub fn generate_finalizer_key(
    chain_id: String,
    wallet: State<AppWallet>,
) -> Result<serde_json::Value, Error> {
    let (sk_bytes, pub_key, pop, priv_key) = crate::antelope::bls::generate_finalizer_key()?;

    // Store the BLS private key in the keystore keyed by the BLS public key
    // Use a special chain prefix to distinguish from secp256k1 keys
    let bls_chain = format!("bls_{}", chain_id);

    let mut session = wallet.0.session_lock()?;
    let master_key = session.master_key().ok_or(Error::WalletLocked)?;
    let encrypted =
        crate::keystore::derive::encrypt(&sk_bytes, master_key, b"simpleos-master-key")?;
    drop(session);

    wallet.0.store_raw_key(&bls_chain, &pub_key, &encrypted)?;

    // Pre-formatted config.ini line. Spring/leap use the unified `signature-provider`
    // option for both secp256k1 signing keys and BLS finalizer keys.
    let config_line = format!("signature-provider = {}=KEY:{}", pub_key, priv_key);

    Ok(serde_json::json!({
        "finalizer_key": pub_key,
        "proof_of_possession": pop,
        "finalizer_private_key": priv_key,
        "config_ini_line": config_line,
    }))
}

/// List all BLS finalizer keys stored for a chain.
#[tauri::command]
pub fn list_finalizer_keys(
    chain_id: String,
    wallet: State<AppWallet>,
) -> Result<Vec<String>, Error> {
    let bls_chain = format!("bls_{}", chain_id);
    wallet.0.list_keys(&bls_chain)
}

/// Get proof of possession for an existing stored BLS key (for re-registration).
#[tauri::command]
pub fn get_finalizer_pop(
    chain_id: String,
    finalizer_key: String,
    wallet: State<AppWallet>,
) -> Result<serde_json::Value, Error> {
    let bls_chain = format!("bls_{}", chain_id);

    // Decrypt the BLS private key
    let mut session = wallet.0.session_lock()?;
    let master_key = session.master_key().ok_or(Error::WalletLocked)?;

    let encrypted = wallet.0.load_raw_key(&bls_chain, &finalizer_key)?;
    let sk_bytes = crate::keystore::derive::decrypt(&encrypted, master_key, b"simpleos-master-key")
        .map_err(|_| Error::InvalidPassphrase)?;
    drop(session);

    let (pub_key, pop) = crate::antelope::bls::proof_of_possession(&sk_bytes)?;

    Ok(serde_json::json!({
        "finalizer_key": pub_key,
        "proof_of_possession": pop,
    }))
}

// ── PIN ──

/// Set a quick-unlock PIN. Encrypts the passphrase with a PIN-derived key.
// async: derives two keys + encrypts — keep off the main thread.
#[tauri::command(async)]
pub fn set_pin(
    passphrase: String,
    pin: String,
    wallet: State<AppWallet>,
    app: tauri::AppHandle,
) -> Result<(), Error> {
    use crate::keystore::derive;

    // Verify passphrase works by trying to unlock
    wallet.0.unlock(&passphrase)?;

    let pin_salt = b"simpleos-pin-key";
    let pin_key = derive::derive_key(pin.as_bytes(), pin_salt);
    let encrypted = derive::encrypt(passphrase.as_bytes(), &pin_key, pin_salt)?;

    // Store in app data dir
    let app_dir = app.path().app_data_dir().map_err(|e| {
        Error::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            e.to_string(),
        ))
    })?;
    std::fs::create_dir_all(&app_dir).map_err(Error::Io)?;
    std::fs::write(app_dir.join("pin.dat"), &encrypted).map_err(Error::Io)?;
    Ok(())
}

/// Unlock wallet using PIN. Decrypts stored passphrase, then unlocks normally.
// async: PIN key derivation + decrypt + passphrase-based vault unlock.
// This is the slowest single command in the app — must run off the main thread
// or the loader animation stays frozen until the command returns.
#[tauri::command(async)]
pub fn unlock_with_pin(
    pin: String,
    app: tauri::AppHandle,
    wallet: State<AppWallet>,
) -> Result<bool, Error> {
    use crate::keystore::derive;

    let app_dir = app.path().app_data_dir().map_err(|e| {
        Error::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            e.to_string(),
        ))
    })?;
    let pin_path = app_dir.join("pin.dat");
    if !pin_path.exists() {
        return Err(Error::KeyNotFound("No PIN configured".into()));
    }

    let encrypted = std::fs::read(&pin_path).map_err(Error::Io)?;
    let pin_salt = b"simpleos-pin-key";
    let pin_key = derive::derive_key(pin.as_bytes(), pin_salt);
    let passphrase_bytes =
        derive::decrypt(&encrypted, &pin_key, pin_salt).map_err(|_| Error::InvalidPassphrase)?;

    let passphrase =
        String::from_utf8(passphrase_bytes).map_err(|e| Error::Serialization(e.to_string()))?;

    wallet.0.unlock(&passphrase)?;
    Ok(true)
}

/// Check if a PIN has been configured.
#[tauri::command]
pub fn has_pin(app: tauri::AppHandle) -> Result<bool, Error> {
    let app_dir = app.path().app_data_dir().map_err(|e| {
        Error::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            e.to_string(),
        ))
    })?;
    Ok(app_dir.join("pin.dat").exists())
}

/// Remove the PIN.
#[tauri::command]
pub fn remove_pin(app: tauri::AppHandle) -> Result<(), Error> {
    let app_dir = app.path().app_data_dir().map_err(|e| {
        Error::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            e.to_string(),
        ))
    })?;
    let pin_path = app_dir.join("pin.dat");
    if pin_path.exists() {
        std::fs::remove_file(&pin_path).map_err(Error::Io)?;
    }
    Ok(())
}

// ── Biometric Unlock ──

#[tauri::command]
pub fn biometric_status(app: tauri::AppHandle) -> Result<crate::biometric::BiometricStatus, Error> {
    crate::biometric::status(&app)
}

#[tauri::command(async)]
pub fn set_biometric_unlock(
    passphrase: String,
    wallet: State<AppWallet>,
    app: tauri::AppHandle,
) -> Result<(), Error> {
    wallet.0.unlock(&passphrase)?;
    crate::biometric::set_unlock_secret(
        &app,
        &passphrase,
        "Use Windows Hello to enable biometric unlock for SimplEOS",
    )
}

#[tauri::command(async)]
pub fn unlock_with_biometric(
    app: tauri::AppHandle,
    wallet: State<AppWallet>,
) -> Result<bool, Error> {
    let passphrase =
        crate::biometric::unlock_secret(&app, "Use Windows Hello to unlock your SimplEOS wallet")?;
    wallet.0.unlock(&passphrase)?;
    Ok(true)
}

#[tauri::command]
pub fn has_biometric_unlock(app: tauri::AppHandle) -> Result<bool, Error> {
    crate::biometric::has_unlock_secret(&app)
}

#[tauri::command]
pub fn remove_biometric_unlock(app: tauri::AppHandle) -> Result<(), Error> {
    crate::biometric::remove_unlock_secret(&app)
}

// ── Backup ──

// async: encrypts every key in the vault — off-thread.
#[tauri::command(async)]
pub fn export_backup(passphrase: String, wallet: State<AppWallet>) -> Result<String, Error> {
    wallet.0.export_backup(&passphrase)
}

// async: Anchor's non-standard 70-round Rijndael is particularly slow — off-thread.
#[tauri::command(async)]
pub fn import_backup(
    json: String,
    passphrase: String,
    wallet: State<AppWallet>,
) -> Result<usize, Error> {
    wallet.0.import_backup(&json, &passphrase)
}

// ── Reset ──

/// Wipe all wallet data: keys, vault marker, endpoint cache.
/// This is a destructive operation — no passphrase required (for recovery from locked state).
#[tauri::command]
pub fn reset_wallet(app: tauri::AppHandle, wallet: State<AppWallet>) -> Result<(), Error> {
    log::warn!("[wallet] RESET: wiping all wallet data");

    // Lock the session
    wallet.0.lock();

    // Delete the vault marker
    if let Ok(app_dir) = app.path().app_data_dir() {
        let _ = std::fs::remove_file(app_dir.join("vault.marker"));
        // Delete endpoint cache
        let _ = std::fs::remove_dir_all(app_dir.join("endpoint_cache"));
        // Delete file-based key store
        let _ = std::fs::remove_dir_all(app_dir.join("keys"));
        // Delete the tauri-plugin-store file
        let _ = std::fs::remove_file(app_dir.join("wallet-state.json"));
        let _ = std::fs::remove_file(app_dir.join("biometric.dat"));
    }

    // Clear all keys from the key store for known chains
    let chains = crate::antelope::chain_config::default_chains();
    for chain in &chains {
        if let Ok(keys) = wallet.0.list_keys(&chain.id) {
            for key in &keys {
                let _ = wallet.0.remove_key(&chain.id, key);
            }
        }
    }
    // Also clear the vault verification token
    let _ = wallet.0.remove_key("__vault__", "__verify__");

    log::warn!("[wallet] RESET: complete");
    Ok(())
}

// ── Diagnostics ──

/// Test the OS keyring by writing, reading, and deleting a test entry.
/// Returns a diagnostic report of what works and what doesn't.
#[tauri::command]
pub fn test_keyring(wallet: State<AppWallet>) -> Result<Vec<String>, Error> {
    let mut report = Vec::new();

    // Report which backend is active
    report.push(format!(
        "Backend: {}",
        if crate::probe_os_keyring() {
            "OS Keyring"
        } else {
            "FileKeyStore (OS keyring probe failed)"
        }
    ));

    let test_key = "simpleos-keyring-test";
    let test_value = "keyring-works-ok";

    // Test 1: Create entry
    match keyring::Entry::new("simpleos", test_key) {
        Ok(entry) => {
            report.push("1. Entry::new OK".into());

            // Test 2: Write
            match entry.set_password(test_value) {
                Ok(_) => report.push("2. set_password OK".into()),
                Err(e) => {
                    report.push(format!("2. set_password FAILED: {}", e));
                    return Ok(report);
                }
            }

            // Test 3: Read back
            match entry.get_password() {
                Ok(val) => {
                    if val == test_value {
                        report.push("3. get_password OK (value matches)".into());
                    } else {
                        report.push(format!("3. get_password MISMATCH: got '{}'", val));
                    }
                }
                Err(e) => report.push(format!("3. get_password FAILED: {}", e)),
            }

            // Test 4: Delete
            match entry.delete_credential() {
                Ok(_) => report.push("4. delete_credential OK".into()),
                Err(e) => report.push(format!("4. delete_credential FAILED: {}", e)),
            }
        }
        Err(e) => report.push(format!("1. Entry::new FAILED: {}", e)),
    }

    // Test 5: Full store→list round-trip through active WalletService keystore
    {
        let test_chain = "test-diagnostic-chain";
        let test_pub = "EOS6MRyTestDiagnosticKey";
        let test_data = b"test-encrypted-blob";

        // Use the actual wallet's key store (whatever backend is active)
        match wallet.0.store_test_key(test_chain, test_pub, test_data) {
            Ok(_) => {
                report.push("5a. KeyStore::store_key OK".into());
                match wallet.0.list_keys(test_chain) {
                    Ok(keys) => report.push(format!("5b. KeyStore::list_keys: {:?}", keys)),
                    Err(e) => report.push(format!("5b. KeyStore::list_keys FAILED: {}", e)),
                }
                let _ = wallet.0.remove_key(test_chain, test_pub);
            }
            Err(e) => report.push(format!("5a. KeyStore::store_key FAILED: {}", e)),
        }
    }

    // Test 6: Check existing EOS key index
    match crate::keystore::os_keyring::list_keys(
        "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906",
    ) {
        Ok(keys) => report.push(format!(
            "6. EOS chain index: {} keys {:?}",
            keys.len(),
            keys
        )),
        Err(e) => report.push(format!("6. EOS chain index FAILED: {}", e)),
    }

    // Test 7: Check vault verification token
    match crate::keystore::os_keyring::load_key("__vault__", "__verify__") {
        Ok(data) => report.push(format!("7. Vault token: {} bytes", data.len())),
        Err(e) => report.push(format!("7. Vault token FAILED: {}", e)),
    }

    Ok(report)
}

// ── Types ──

#[derive(serde::Serialize)]
pub struct SignedTransaction {
    pub packed_trx: String,
    pub signature: String,
}
