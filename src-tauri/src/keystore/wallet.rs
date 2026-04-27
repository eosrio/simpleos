//! Wallet service: the complete key management pipeline.
//!
//! Pure Rust, no Tauri dependency. All wallet operations (import, decrypt,
//! list, remove, change passphrase) go through this service, which is
//! fully testable with an in-memory key store.

use crate::antelope::signing;
use crate::error::Error;
use crate::keystore::derive;
use crate::keystore::memory::Session;
use crate::keystore::store::KeyStore;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

/// Master salt used for deriving the session master key from the passphrase.
const MASTER_SALT: &[u8] = b"simpleos-master-key";

/// How the wallet handles key access and session lifetime.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SecurityMode {
    /// Unlock once at startup. Session stays open until app closes or timeout.
    /// Keys are available for signing without further prompts.
    SessionUnlock,
    /// Never keep the master key in memory. Prompt for passphrase on every signature.
    /// Most secure — no keys in memory between signings.
    SignPerUse,
    /// User manually toggles lock/unlock via a UI button (like Anchor).
    /// When locked, signing prompts for passphrase. When unlocked, signing is instant.
    ManualToggle,
}
/// Key used to store the vault verification token.
const VAULT_VERIFY_CHAIN: &str = "__vault__";
const VAULT_VERIFY_KEY: &str = "__verify__";
/// The known plaintext we encrypt to verify the passphrase on unlock.
const VAULT_VERIFY_PLAINTEXT: &[u8] = b"simpleos-vault-ok";
const LIBRE_MAINNET_CHAIN_ID: &str =
    "38b1d7815474d0c60683ecbea321d723e83f5da6ae5f1c1f9fecc69d9ba96465";
const LEGACY_LIBRE_MAINNET_CHAIN_ID: &str =
    "38b1d7815474d0c60c65a0f23d12e1fc64b8b8d42d0f754b3afe3044e4050eb1";
const LEGACY_LIBRE_CHAIN_IDS: &[&str] = &[LEGACY_LIBRE_MAINNET_CHAIN_ID];
const NO_LEGACY_CHAIN_IDS: &[&str] = &[];

fn legacy_chain_ids(chain_id: &str) -> &'static [&'static str] {
    if chain_id == LIBRE_MAINNET_CHAIN_ID {
        LEGACY_LIBRE_CHAIN_IDS
    } else {
        NO_LEGACY_CHAIN_IDS
    }
}

/// The core wallet service. Owns a session and a key store.
pub struct WalletService {
    session: Mutex<Session>,
    store: Box<dyn KeyStore>,
    /// Chain IDs to check when doing multi-chain operations (e.g., passphrase change).
    known_chains: Vec<String>,
    /// Current security mode.
    security_mode: Mutex<SecurityMode>,
}

/// Result of importing a key.
#[derive(Debug, Clone)]
pub struct ImportResult {
    pub public_key: String,
    pub private_key_bytes: Vec<u8>,
}

impl WalletService {
    pub fn new(store: Box<dyn KeyStore>, known_chains: Vec<String>) -> Self {
        Self {
            session: Mutex::new(Session::new()),
            store,
            known_chains,
            security_mode: Mutex::new(SecurityMode::SessionUnlock),
        }
    }

    // ── Session ──

    pub fn is_locked(&self) -> bool {
        let session = self.session.lock().unwrap();
        !session.is_unlocked()
    }

    /// Unlock the wallet with a passphrase.
    /// Verifies the passphrase by decrypting the vault verification token.
    pub fn unlock(&self, passphrase: &str) -> Result<(), Error> {
        let master_key = derive::derive_key(passphrase.as_bytes(), MASTER_SALT);

        // Verify passphrase using the vault verification token
        match self.store.load_key(VAULT_VERIFY_CHAIN, VAULT_VERIFY_KEY) {
            Ok(encrypted_token) => {
                derive::decrypt(&encrypted_token, &master_key, MASTER_SALT)
                    .map_err(|_| Error::InvalidPassphrase)?;
            }
            Err(_) => {
                // No vault token yet — this shouldn't happen if has_wallet is true,
                // but accept the passphrase and create the token now (migration case)
                let encrypted = derive::encrypt(VAULT_VERIFY_PLAINTEXT, &master_key, MASTER_SALT)?;
                let _ = self
                    .store
                    .store_key(VAULT_VERIFY_CHAIN, VAULT_VERIFY_KEY, &encrypted);
            }
        }

        let mut session = self.session.lock().unwrap();
        session.unlock(master_key.to_vec());
        Ok(())
    }

    /// Create the vault: set the master passphrase.
    /// This stores a verification token that will be used to validate the passphrase on unlock.
    /// Called during first key import.
    fn ensure_vault(&self, master_key: &[u8]) -> Result<(), Error> {
        // Only create if it doesn't exist yet
        if self
            .store
            .load_key(VAULT_VERIFY_CHAIN, VAULT_VERIFY_KEY)
            .is_err()
        {
            let encrypted = derive::encrypt(VAULT_VERIFY_PLAINTEXT, master_key, MASTER_SALT)?;
            self.store
                .store_key(VAULT_VERIFY_CHAIN, VAULT_VERIFY_KEY, &encrypted)?;
        }
        Ok(())
    }

    pub fn lock(&self) {
        let mut session = self.session.lock().unwrap();
        session.lock();
    }

    // ── Security Mode ──

    pub fn security_mode(&self) -> SecurityMode {
        *self.security_mode.lock().unwrap()
    }

    pub fn set_security_mode(&self, mode: SecurityMode) {
        *self.security_mode.lock().unwrap() = mode;
        // If switching to SignPerUse, immediately wipe keys from memory
        if mode == SecurityMode::SignPerUse {
            let mut session = self.session.lock().unwrap();
            session.lock();
        }
    }

    /// Check if signing requires a passphrase right now.
    /// Returns true if the wallet is locked or in SignPerUse mode.
    pub fn needs_passphrase_for_signing(&self) -> bool {
        let mode = self.security_mode();
        match mode {
            SecurityMode::SessionUnlock => self.is_locked(),
            SecurityMode::SignPerUse => true, // Always needs passphrase
            SecurityMode::ManualToggle => self.is_locked(),
        }
    }

    /// Whether the app should show the lockscreen on startup.
    pub fn needs_lockscreen(&self) -> bool {
        let mode = self.security_mode();
        match mode {
            SecurityMode::SessionUnlock => true, // Must unlock before anything
            SecurityMode::SignPerUse => false,   // Load directly, prompt on sign
            SecurityMode::ManualToggle => false, // Load directly, user toggles
        }
    }

    // ── Key Import ──

    /// Import a WIF private key for a chain.
    /// Derives the public key, encrypts the private key with the master key,
    /// and stores it in the key store.
    ///
    /// The wallet must be unlocked first (or a passphrase provided for first-time setup).
    pub fn import_key(
        &self,
        wif: &str,
        chain_id: &str,
        passphrase: &str,
    ) -> Result<ImportResult, Error> {
        // Decode WIF → private key bytes + public key
        let (private_key_bytes, public_key) = signing::public_key_from_wif(wif)?;

        // Derive master key from passphrase
        let master_key = derive::derive_key(passphrase.as_bytes(), MASTER_SALT);

        // Create vault verification token on first import
        self.ensure_vault(&master_key)?;

        // Encrypt private key with master key (fixed salt for all keys)
        let encrypted = derive::encrypt(&private_key_bytes, &master_key, MASTER_SALT)?;

        // Store in key store
        self.store.store_key(chain_id, &public_key, &encrypted)?;

        // Unlock session with master key
        let mut session = self.session.lock().unwrap();
        session.unlock(master_key.to_vec());

        Ok(ImportResult {
            public_key,
            private_key_bytes,
        })
    }

    /// Import a key using the current session (wallet must be unlocked).
    /// No passphrase needed — uses the master key already in memory.
    pub fn import_key_with_session(
        &self,
        wif: &str,
        chain_id: &str,
    ) -> Result<ImportResult, Error> {
        let (private_key_bytes, public_key) = signing::public_key_from_wif(wif)?;

        let mut session = self.session.lock().unwrap();
        let master_key = session.master_key().ok_or(Error::WalletLocked)?;

        let encrypted = derive::encrypt(&private_key_bytes, master_key, MASTER_SALT)?;
        self.store.store_key(chain_id, &public_key, &encrypted)?;

        Ok(ImportResult {
            public_key,
            private_key_bytes,
        })
    }

    // ── Key Access ──

    /// List all public keys stored for a chain.
    pub fn list_keys(&self, chain_id: &str) -> Result<Vec<String>, Error> {
        let mut keys = self.store.list_keys(chain_id)?;
        for legacy_chain_id in legacy_chain_ids(chain_id) {
            for key in self.store.list_keys(legacy_chain_id)? {
                if !keys.contains(&key) {
                    keys.push(key);
                }
            }
        }
        Ok(keys)
    }

    /// Decrypt and return the raw private key bytes for a given public key.
    /// Requires the wallet to be unlocked.
    pub fn decrypt_key(&self, chain_id: &str, public_key: &str) -> Result<Vec<u8>, Error> {
        let mut session = self.session.lock().unwrap();
        let master_key = session.master_key().ok_or(Error::WalletLocked)?;

        let encrypted = self.load_key_with_aliases(chain_id, public_key)?;
        let private_key_bytes = derive::decrypt(&encrypted, master_key, MASTER_SALT)
            .map_err(|_| Error::InvalidPassphrase)?;

        Ok(private_key_bytes)
    }

    /// Decrypt a key using an explicit passphrase (for SignPerUse mode).
    /// Does NOT unlock the session — the master key is derived, used, and dropped.
    pub fn decrypt_key_with_passphrase(
        &self,
        chain_id: &str,
        public_key: &str,
        passphrase: &str,
    ) -> Result<Vec<u8>, Error> {
        let master_key = derive::derive_key(passphrase.as_bytes(), MASTER_SALT);

        // Verify passphrase first
        match self.store.load_key(VAULT_VERIFY_CHAIN, VAULT_VERIFY_KEY) {
            Ok(encrypted_token) => {
                derive::decrypt(&encrypted_token, &master_key, MASTER_SALT)
                    .map_err(|_| Error::InvalidPassphrase)?;
            }
            Err(_) => return Err(Error::WalletLocked),
        }

        let encrypted = self.load_key_with_aliases(chain_id, public_key)?;
        let private_key_bytes = derive::decrypt(&encrypted, &master_key, MASTER_SALT)
            .map_err(|_| Error::InvalidPassphrase)?;

        // master_key goes out of scope and is on the stack — zeroize would be ideal here
        // but derive_key returns a fixed array that drops normally
        Ok(private_key_bytes)
    }

    /// Remove a key from the store.
    pub fn remove_key(&self, chain_id: &str, public_key: &str) -> Result<(), Error> {
        let result = self.store.delete_key(chain_id, public_key);
        let mut deleted = result.is_ok();
        for legacy_chain_id in legacy_chain_ids(chain_id) {
            if self.store.delete_key(legacy_chain_id, public_key).is_ok() {
                deleted = true;
            }
        }
        if deleted { Ok(()) } else { result }
    }

    fn load_key_with_aliases(&self, chain_id: &str, public_key: &str) -> Result<Vec<u8>, Error> {
        match self.store.load_key(chain_id, public_key) {
            Ok(encrypted) => Ok(encrypted),
            Err(primary_error) => {
                for legacy_chain_id in legacy_chain_ids(chain_id) {
                    if let Ok(encrypted) = self.store.load_key(legacy_chain_id, public_key) {
                        return Ok(encrypted);
                    }
                }
                Err(primary_error)
            }
        }
    }

    // ── Raw key storage (for BLS keys) ──

    /// Lock the session mutex and return the guard. Caller can access master_key().
    pub fn session_lock(&self) -> Result<std::sync::MutexGuard<'_, Session>, Error> {
        self.session.lock().map_err(|_| Error::WalletLocked)
    }

    /// Store raw encrypted bytes under chain_id + key_name.
    pub fn store_raw_key(
        &self,
        chain_id: &str,
        key_name: &str,
        encrypted: &[u8],
    ) -> Result<(), Error> {
        self.store.store_key(chain_id, key_name, encrypted)
    }

    /// Load raw encrypted bytes for chain_id + key_name.
    pub fn load_raw_key(&self, chain_id: &str, key_name: &str) -> Result<Vec<u8>, Error> {
        self.store.load_key(chain_id, key_name)
    }

    /// Delete a raw key entry (chain_id + key_name).
    pub fn delete_raw_key(&self, chain_id: &str, key_name: &str) -> Result<(), Error> {
        self.store.delete_key(chain_id, key_name)
    }

    // ── Passphrase Change ──

    /// Re-encrypt all stored keys with a new passphrase.
    /// Requires the old passphrase to decrypt, then re-encrypts with the new one.
    pub fn change_passphrase(
        &self,
        old_passphrase: &str,
        new_passphrase: &str,
    ) -> Result<usize, Error> {
        // Verify session is unlocked
        {
            let session = self.session.lock().unwrap();
            if !session.is_unlocked() {
                return Err(Error::WalletLocked);
            }
        }

        let old_master = derive::derive_key(old_passphrase.as_bytes(), MASTER_SALT);
        let new_master = derive::derive_key(new_passphrase.as_bytes(), MASTER_SALT);

        let mut re_encrypted_count = 0usize;

        for chain_id in &self.known_chains {
            let public_keys = self.list_keys(chain_id)?;
            for pub_key in &public_keys {
                // Decrypt with old
                let encrypted = self.load_key_with_aliases(chain_id, pub_key)?;
                let private_key_bytes = derive::decrypt(&encrypted, &old_master, MASTER_SALT)
                    .map_err(|_| Error::InvalidPassphrase)?;

                // Re-encrypt with new master key
                let re_encrypted = derive::encrypt(&private_key_bytes, &new_master, MASTER_SALT)?;

                // Overwrite
                self.store.store_key(chain_id, pub_key, &re_encrypted)?;
                re_encrypted_count += 1;
            }
        }

        // Update vault verification token with new master key
        let new_token = derive::encrypt(VAULT_VERIFY_PLAINTEXT, &new_master, MASTER_SALT)?;
        self.store
            .store_key(VAULT_VERIFY_CHAIN, VAULT_VERIFY_KEY, &new_token)?;

        // Update session
        let mut session = self.session.lock().unwrap();
        session.unlock(new_master.to_vec());

        Ok(re_encrypted_count)
    }

    // ── Key Generation ──

    /// Generate a new keypair and import it.
    pub fn generate_and_import(
        &self,
        chain_id: &str,
        passphrase: &str,
    ) -> Result<(String, String), Error> {
        let (wif, public_key) = signing::generate_keypair()?;
        self.import_key(&wif, chain_id, passphrase)?;
        Ok((wif, public_key))
    }

    // ── Verification ──

    /// Store a test key directly (for diagnostics).
    pub fn store_test_key(
        &self,
        chain_id: &str,
        public_key: &str,
        data: &[u8],
    ) -> Result<(), Error> {
        self.store.store_key(chain_id, public_key, data)
    }

    /// Verify that a stored key can be decrypted and produces the expected public key.
    /// This is a self-test: import → decrypt → derive pubkey → compare.
    /// Handles both EOS... and PUB_K1_... public key formats.
    pub fn verify_key_integrity(&self, chain_id: &str, public_key: &str) -> Result<bool, Error> {
        let private_key_bytes = self.decrypt_key(chain_id, public_key)?;

        // Re-derive public key from the decrypted private key
        let signing_key = k256::ecdsa::SigningKey::from_bytes((&private_key_bytes[..]).into())
            .map_err(|e| Error::Signing(format!("Invalid private key: {}", e)))?;
        let verifying_key = signing_key.verifying_key();
        let compressed = verifying_key.to_encoded_point(true);

        // Check both formats
        let eos_pub = signing::encode_eos_public_key_from_bytes(compressed.as_bytes());
        let k1_pub = signing::encode_k1_public_key_from_bytes(compressed.as_bytes());

        Ok(eos_pub == public_key || k1_pub == public_key)
    }

    // ── Backup Export / Import ──

    /// Export all keys as an encrypted JSON backup.
    /// Keys stay encrypted with the current master key (hex-encoded).
    /// Returns a JSON string suitable for writing to a file.
    pub fn export_backup(&self, passphrase: &str) -> Result<String, Error> {
        // Verify passphrase
        let master_key = derive::derive_key(passphrase.as_bytes(), MASTER_SALT);
        match self.store.load_key(VAULT_VERIFY_CHAIN, VAULT_VERIFY_KEY) {
            Ok(token) => {
                derive::decrypt(&token, &master_key, MASTER_SALT)
                    .map_err(|_| Error::InvalidPassphrase)?;
            }
            Err(_) => return Err(Error::WalletLocked),
        }

        let mut entries: Vec<serde_json::Value> = Vec::new();

        for chain_id in &self.known_chains {
            let keys = self.list_keys(chain_id).unwrap_or_default();
            for pub_key in &keys {
                let encrypted = self.load_key_with_aliases(chain_id, pub_key)?;
                entries.push(serde_json::json!({
                    "chain_id": chain_id,
                    "public_key": pub_key,
                    "encrypted_key": hex::encode(&encrypted),
                }));
            }
        }

        // Include vault verification token so import can verify passphrase
        let vault_token = self.store.load_key(VAULT_VERIFY_CHAIN, VAULT_VERIFY_KEY)?;

        let backup = serde_json::json!({
            "version": "simpleos-v2",
            "vault_token": hex::encode(&vault_token),
            "keys": entries,
        });

        Ok(serde_json::to_string_pretty(&backup)
            .map_err(|e| Error::Serialization(e.to_string()))?)
    }

    /// Import keys from a SimplEOS v2 backup JSON.
    /// The passphrase must match the one used during export.
    /// Returns the number of keys imported.
    pub fn import_backup(&self, json: &str, passphrase: &str) -> Result<usize, Error> {
        let backup: serde_json::Value = serde_json::from_str(json)
            .map_err(|e| Error::Serialization(format!("Invalid backup format: {}", e)))?;

        let version = backup["version"].as_str().unwrap_or("");
        if version != "simpleos-v2" {
            return Err(Error::Serialization(format!(
                "Unknown backup version: {}",
                version
            )));
        }

        // Verify passphrase against the backup's vault token
        let master_key = derive::derive_key(passphrase.as_bytes(), MASTER_SALT);
        let vault_token_hex = backup["vault_token"]
            .as_str()
            .ok_or_else(|| Error::Serialization("Missing vault_token".into()))?;
        let vault_token = hex::decode(vault_token_hex)
            .map_err(|e| Error::Serialization(format!("Invalid hex: {}", e)))?;
        derive::decrypt(&vault_token, &master_key, MASTER_SALT)
            .map_err(|_| Error::InvalidPassphrase)?;

        // Ensure local vault exists
        self.ensure_vault(&master_key)?;

        // Import each key
        let keys = backup["keys"]
            .as_array()
            .ok_or_else(|| Error::Serialization("Missing keys array".into()))?;

        let mut count = 0usize;
        for entry in keys {
            let chain_id = entry["chain_id"].as_str().unwrap_or("");
            let pub_key = entry["public_key"].as_str().unwrap_or("");
            let enc_hex = entry["encrypted_key"].as_str().unwrap_or("");

            if chain_id.is_empty() || pub_key.is_empty() || enc_hex.is_empty() {
                continue;
            }

            let encrypted = hex::decode(enc_hex)
                .map_err(|e| Error::Serialization(format!("Invalid hex: {}", e)))?;

            // Verify the key is valid by decrypting it
            derive::decrypt(&encrypted, &master_key, MASTER_SALT)
                .map_err(|_| Error::Encryption("Corrupted key entry in backup".into()))?;

            // Store it (overwrites if exists)
            self.store.store_key(chain_id, pub_key, &encrypted)?;
            count += 1;
        }

        // Unlock session
        let mut session = self.session.lock().unwrap();
        session.unlock(master_key.to_vec());

        Ok(count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::keystore::store::MemoryKeyStore;

    const TEST_WIF: &str = "5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3";
    const TEST_PUB: &str = "EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV";
    const TEST_CHAIN: &str = "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906";
    const TEST_PASS: &str = "my-secure-passphrase-2024!";

    fn make_wallet() -> WalletService {
        WalletService::new(
            Box::new(MemoryKeyStore::new()),
            vec![TEST_CHAIN.to_string()],
        )
    }

    // ── Basic Import ──

    #[test]
    fn import_key_produces_correct_public_key() {
        let w = make_wallet();
        let result = w.import_key(TEST_WIF, TEST_CHAIN, TEST_PASS).unwrap();
        assert_eq!(result.public_key, TEST_PUB);
        assert_eq!(result.private_key_bytes.len(), 32);
    }

    #[test]
    fn import_key_stores_in_keystore() {
        let w = make_wallet();
        w.import_key(TEST_WIF, TEST_CHAIN, TEST_PASS).unwrap();

        let keys = w.list_keys(TEST_CHAIN).unwrap();
        assert_eq!(keys, vec![TEST_PUB]);
    }

    #[test]
    fn import_key_unlocks_session() {
        let w = make_wallet();
        assert!(w.is_locked());
        w.import_key(TEST_WIF, TEST_CHAIN, TEST_PASS).unwrap();
        assert!(!w.is_locked());
    }

    #[test]
    fn import_invalid_wif_fails() {
        let w = make_wallet();
        let result = w.import_key("not-a-valid-wif", TEST_CHAIN, TEST_PASS);
        assert!(result.is_err());
    }

    #[test]
    fn import_wif_bad_checksum_fails() {
        let w = make_wallet();
        // Last char changed
        let result = w.import_key(
            "5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD4",
            TEST_CHAIN,
            TEST_PASS,
        );
        assert!(result.is_err());
    }

    // ── Decrypt & Verify ──

    #[test]
    fn decrypt_key_returns_original_private_key() {
        let w = make_wallet();
        let import = w.import_key(TEST_WIF, TEST_CHAIN, TEST_PASS).unwrap();

        let decrypted = w.decrypt_key(TEST_CHAIN, TEST_PUB).unwrap();
        assert_eq!(decrypted, import.private_key_bytes);
    }

    #[test]
    fn decrypt_key_requires_unlock() {
        let w = make_wallet();
        w.import_key(TEST_WIF, TEST_CHAIN, TEST_PASS).unwrap();
        w.lock();

        let result = w.decrypt_key(TEST_CHAIN, TEST_PUB);
        assert!(matches!(result, Err(Error::WalletLocked)));
    }

    #[test]
    fn unlock_rejects_wrong_passphrase() {
        let w = make_wallet();
        w.import_key(TEST_WIF, TEST_CHAIN, TEST_PASS).unwrap();
        w.lock();

        // Wrong passphrase should be rejected at unlock time
        let result = w.unlock("wrong-passphrase");
        assert!(matches!(result, Err(Error::InvalidPassphrase)));
        assert!(w.is_locked()); // Should remain locked
    }

    #[test]
    fn unlock_accepts_correct_passphrase() {
        let w = make_wallet();
        w.import_key(TEST_WIF, TEST_CHAIN, TEST_PASS).unwrap();
        w.lock();

        w.unlock(TEST_PASS).unwrap();
        assert!(!w.is_locked());
    }

    #[test]
    fn verify_key_integrity_succeeds() {
        let w = make_wallet();
        w.import_key(TEST_WIF, TEST_CHAIN, TEST_PASS).unwrap();
        assert!(w.verify_key_integrity(TEST_CHAIN, TEST_PUB).unwrap());
    }

    // ── Session ──

    #[test]
    fn unlock_lock_cycle() {
        let w = make_wallet();
        assert!(w.is_locked());

        w.unlock(TEST_PASS).unwrap();
        assert!(!w.is_locked());

        w.lock();
        assert!(w.is_locked());
    }

    #[test]
    fn session_timeout() {
        let w = make_wallet();
        w.import_key(TEST_WIF, TEST_CHAIN, TEST_PASS).unwrap();
        assert!(!w.is_locked());

        // Simulate timeout by directly manipulating the session
        {
            let mut session = w.session.lock().unwrap();
            session.last_activity = std::time::Instant::now() - std::time::Duration::from_secs(301);
            // > 5 min
        }

        assert!(w.is_locked());
        // Decrypt should fail after timeout
        let result = w.decrypt_key(TEST_CHAIN, TEST_PUB);
        assert!(matches!(result, Err(Error::WalletLocked)));
    }

    // ── Passphrase Change ──

    #[test]
    fn change_passphrase_re_encrypts_all_keys() {
        let w = make_wallet();
        w.import_key(TEST_WIF, TEST_CHAIN, TEST_PASS).unwrap();

        let new_pass = "brand-new-passphrase-2025!";
        let count = w.change_passphrase(TEST_PASS, new_pass).unwrap();
        assert_eq!(count, 1);

        // Old passphrase is rejected at unlock
        w.lock();
        let result = w.unlock(TEST_PASS);
        assert!(matches!(result, Err(Error::InvalidPassphrase)));
        assert!(w.is_locked());

        // New passphrase works
        w.unlock(new_pass).unwrap();
        let decrypted = w.decrypt_key(TEST_CHAIN, TEST_PUB).unwrap();
        assert_eq!(decrypted.len(), 32);
    }

    #[test]
    fn change_passphrase_fails_when_locked() {
        let w = make_wallet();
        let result = w.change_passphrase("old", "new");
        assert!(matches!(result, Err(Error::WalletLocked)));
    }

    #[test]
    fn change_passphrase_fails_with_wrong_old() {
        let w = make_wallet();
        w.import_key(TEST_WIF, TEST_CHAIN, TEST_PASS).unwrap();

        let result = w.change_passphrase("wrong-old-pass", "new-pass");
        assert!(matches!(result, Err(Error::InvalidPassphrase)));
    }

    // ── Multiple Keys ──

    #[test]
    fn multiple_keys_same_chain() {
        let w = make_wallet();
        w.import_key(TEST_WIF, TEST_CHAIN, TEST_PASS).unwrap();

        // Generate a second key
        let (wif2, pub2) = signing::generate_keypair().unwrap();
        w.import_key(&wif2, TEST_CHAIN, TEST_PASS).unwrap();

        let keys = w.list_keys(TEST_CHAIN).unwrap();
        assert_eq!(keys.len(), 2);
        assert!(keys.contains(&TEST_PUB.to_string()));
        assert!(keys.contains(&pub2));

        // Both can be decrypted
        assert!(w.decrypt_key(TEST_CHAIN, TEST_PUB).is_ok());
        assert!(w.decrypt_key(TEST_CHAIN, &pub2).is_ok());

        // Both pass integrity check
        assert!(w.verify_key_integrity(TEST_CHAIN, TEST_PUB).unwrap());
        assert!(w.verify_key_integrity(TEST_CHAIN, &pub2).unwrap());
    }

    #[test]
    fn multiple_keys_different_chains() {
        let chain_b = "1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4";
        let w = WalletService::new(
            Box::new(MemoryKeyStore::new()),
            vec![TEST_CHAIN.to_string(), chain_b.to_string()],
        );

        w.import_key(TEST_WIF, TEST_CHAIN, TEST_PASS).unwrap();
        let (wif2, _pub2) = signing::generate_keypair().unwrap();
        w.import_key(&wif2, chain_b, TEST_PASS).unwrap();

        assert_eq!(w.list_keys(TEST_CHAIN).unwrap().len(), 1);
        assert_eq!(w.list_keys(chain_b).unwrap().len(), 1);

        // Passphrase change re-encrypts both
        let count = w.change_passphrase(TEST_PASS, "new-pass").unwrap();
        assert_eq!(count, 2);
    }

    // ── Remove ──

    #[test]
    fn remove_key_deletes_from_store() {
        let w = make_wallet();
        w.import_key(TEST_WIF, TEST_CHAIN, TEST_PASS).unwrap();
        assert_eq!(w.list_keys(TEST_CHAIN).unwrap().len(), 1);

        w.remove_key(TEST_CHAIN, TEST_PUB).unwrap();
        assert_eq!(w.list_keys(TEST_CHAIN).unwrap().len(), 0);

        // Can't decrypt after removal
        let result = w.decrypt_key(TEST_CHAIN, TEST_PUB);
        assert!(result.is_err());
    }

    // ── Key Generation ──

    #[test]
    fn generate_and_import_produces_valid_key() {
        let w = make_wallet();
        let (wif, pub_key) = w.generate_and_import(TEST_CHAIN, TEST_PASS).unwrap();

        assert!(wif.starts_with('5'));
        assert!(pub_key.starts_with("EOS"));
        assert_eq!(w.list_keys(TEST_CHAIN).unwrap().len(), 1);
        assert!(w.verify_key_integrity(TEST_CHAIN, &pub_key).unwrap());
    }

    #[test]
    fn generate_keys_are_unique() {
        let w = make_wallet();
        let (_, pub1) = w.generate_and_import(TEST_CHAIN, TEST_PASS).unwrap();
        let (_, pub2) = w.generate_and_import(TEST_CHAIN, TEST_PASS).unwrap();
        assert_ne!(pub1, pub2);
    }

    // ── Signing Roundtrip ──

    #[test]
    fn sign_with_decrypted_key() {
        let w = make_wallet();
        w.import_key(TEST_WIF, TEST_CHAIN, TEST_PASS).unwrap();

        let private_key = w.decrypt_key(TEST_CHAIN, TEST_PUB).unwrap();

        // Sign a dummy transaction
        let sig = signing::sign_transaction(
            TEST_CHAIN,
            &[0u8; 32], // dummy serialized tx
            &private_key,
        )
        .unwrap();

        assert!(sig.starts_with("SIG_K1_"));
        assert!(sig.len() > 70); // SIG_K1_ + base58 encoded sig
    }

    // ── Full Pipeline Roundtrip ──

    #[test]
    fn full_pipeline_import_lock_unlock_decrypt_sign() {
        let w = make_wallet();

        // 1. Import
        let import = w.import_key(TEST_WIF, TEST_CHAIN, TEST_PASS).unwrap();
        assert_eq!(import.public_key, TEST_PUB);
        assert!(!w.is_locked());

        // 2. Verify integrity
        assert!(w.verify_key_integrity(TEST_CHAIN, TEST_PUB).unwrap());

        // 3. Lock
        w.lock();
        assert!(w.is_locked());
        assert!(w.decrypt_key(TEST_CHAIN, TEST_PUB).is_err());

        // 4. Unlock with correct passphrase
        w.unlock(TEST_PASS).unwrap();
        assert!(!w.is_locked());

        // 5. Decrypt
        let priv_bytes = w.decrypt_key(TEST_CHAIN, TEST_PUB).unwrap();
        assert_eq!(priv_bytes.len(), 32);

        // 6. Sign
        let sig = signing::sign_transaction(TEST_CHAIN, &[0u8; 32], &priv_bytes).unwrap();
        assert!(sig.starts_with("SIG_K1_"));

        // 7. Change passphrase
        let count = w.change_passphrase(TEST_PASS, "new-pass").unwrap();
        assert_eq!(count, 1);

        // 8. Old pass rejected at unlock
        w.lock();
        assert!(w.unlock(TEST_PASS).is_err());
        assert!(w.is_locked());

        // 9. New pass works
        w.unlock("new-pass").unwrap();
        let priv_bytes2 = w.decrypt_key(TEST_CHAIN, TEST_PUB).unwrap();
        assert_eq!(priv_bytes, priv_bytes2);
    }

    // ── PVT_K1_ format ──

    #[test]
    fn import_pvt_k1_format() {
        let w = make_wallet();

        // Get the well-known key's raw bytes, then encode as PVT_K1_
        let (priv_bytes, _) = signing::public_key_from_wif(TEST_WIF).unwrap();
        let pvt_k1 = signing::encode_pvt_k1(&priv_bytes);
        assert!(pvt_k1.starts_with("PVT_K1_"));

        // Import the PVT_K1_ key
        let result = w.import_key(&pvt_k1, TEST_CHAIN, TEST_PASS).unwrap();
        assert!(result.public_key.starts_with("PUB_K1_"));

        // Verify the key can be decrypted
        let decrypted = w.decrypt_key(TEST_CHAIN, &result.public_key).unwrap();
        assert_eq!(decrypted, priv_bytes);

        // Verify integrity check passes
        assert!(w
            .verify_key_integrity(TEST_CHAIN, &result.public_key)
            .unwrap());

        // Verify signing works
        let sig = signing::sign_transaction(TEST_CHAIN, &[0u8; 32], &decrypted).unwrap();
        assert!(sig.starts_with("SIG_K1_"));
    }

    // ── Security Modes ──

    #[test]
    fn session_unlock_mode_default() {
        let w = make_wallet();
        assert_eq!(w.security_mode(), SecurityMode::SessionUnlock);
        assert!(w.needs_lockscreen());
        assert!(w.needs_passphrase_for_signing()); // locked by default
    }

    #[test]
    fn session_unlock_mode_after_unlock() {
        let w = make_wallet();
        w.import_key(TEST_WIF, TEST_CHAIN, TEST_PASS).unwrap();
        assert!(!w.needs_passphrase_for_signing()); // unlocked by import
    }

    #[test]
    fn sign_per_use_mode() {
        let w = make_wallet();
        w.import_key(TEST_WIF, TEST_CHAIN, TEST_PASS).unwrap();
        assert!(!w.is_locked());

        w.set_security_mode(SecurityMode::SignPerUse);
        assert!(!w.needs_lockscreen()); // no lockscreen on load
        assert!(w.needs_passphrase_for_signing()); // always needs passphrase
        assert!(w.is_locked()); // session was wiped when switching to SignPerUse
    }

    #[test]
    fn sign_per_use_decrypt_with_passphrase() {
        let w = make_wallet();
        w.import_key(TEST_WIF, TEST_CHAIN, TEST_PASS).unwrap();
        w.set_security_mode(SecurityMode::SignPerUse);

        // Session is locked, can't use decrypt_key
        assert!(w.decrypt_key(TEST_CHAIN, TEST_PUB).is_err());

        // But decrypt_key_with_passphrase works
        let priv_bytes = w
            .decrypt_key_with_passphrase(TEST_CHAIN, TEST_PUB, TEST_PASS)
            .unwrap();
        assert_eq!(priv_bytes.len(), 32);

        // Wrong passphrase fails
        let result = w.decrypt_key_with_passphrase(TEST_CHAIN, TEST_PUB, "wrong");
        assert!(matches!(result, Err(Error::InvalidPassphrase)));

        // Session is still locked after decrypt_key_with_passphrase
        assert!(w.is_locked());
    }

    #[test]
    fn manual_toggle_mode() {
        let w = make_wallet();
        w.import_key(TEST_WIF, TEST_CHAIN, TEST_PASS).unwrap();

        w.set_security_mode(SecurityMode::ManualToggle);
        w.lock();

        assert!(!w.needs_lockscreen()); // no lockscreen
        assert!(w.needs_passphrase_for_signing()); // locked → needs passphrase

        w.unlock(TEST_PASS).unwrap();
        assert!(!w.needs_passphrase_for_signing()); // unlocked → no passphrase

        w.lock();
        assert!(w.needs_passphrase_for_signing()); // locked again
    }

    // ── PVT_K1_ format ──

    #[test]
    fn pvt_k1_and_wif_produce_same_private_key_in_wallet() {
        let w1 = make_wallet();
        let w2 = make_wallet();

        // Import same key in both formats
        let (priv_bytes, _) = signing::public_key_from_wif(TEST_WIF).unwrap();
        let pvt_k1 = signing::encode_pvt_k1(&priv_bytes);

        let r1 = w1.import_key(TEST_WIF, TEST_CHAIN, TEST_PASS).unwrap();
        let r2 = w2.import_key(&pvt_k1, TEST_CHAIN, TEST_PASS).unwrap();

        // Different public key formats but same underlying private key
        assert!(r1.public_key.starts_with("EOS"));
        assert!(r2.public_key.starts_with("PUB_K1_"));

        let dec1 = w1.decrypt_key(TEST_CHAIN, &r1.public_key).unwrap();
        let dec2 = w2.decrypt_key(TEST_CHAIN, &r2.public_key).unwrap();
        assert_eq!(dec1, dec2);
    }
}
