//! Key storage trait and implementations.
//!
//! Abstracts over the OS keyring so wallet operations can be tested
//! with an in-memory store without any Tauri or OS dependencies.

use crate::error::Error;
use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

/// SEC-030: best-effort restriction of an on-disk secret file to owner read/write only.
/// On Unix this sets mode 0o600. On Windows the inherited ACL is left in place —
/// see the SEC-030 report note (no minimal, certain owner-only ACL primitive here).
#[allow(unused_variables)]
fn restrict_file_permissions(path: &Path) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600));
    }
    // SEC-030 TODO(windows ACL): restrict to the current user via an explicit DACL.
}

/// SEC-030: best-effort restriction of a secrets directory to owner access only (0o700 on Unix).
#[allow(unused_variables)]
fn restrict_dir_permissions(path: &Path) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700));
    }
    // SEC-030 TODO(windows ACL): restrict to the current user via an explicit DACL.
}

/// Trait for key storage backends.
/// Implementations must store encrypted private key blobs keyed by (chain_id, public_key)
/// and maintain a per-chain index of public keys.
pub trait KeyStore: Send + Sync {
    fn store_key(&self, chain_id: &str, public_key: &str, encrypted: &[u8]) -> Result<(), Error>;
    fn load_key(&self, chain_id: &str, public_key: &str) -> Result<Vec<u8>, Error>;
    fn delete_key(&self, chain_id: &str, public_key: &str) -> Result<(), Error>;
    fn list_keys(&self, chain_id: &str) -> Result<Vec<String>, Error>;
    /// SEC-028: delete the per-chain key index entry so a wallet reset leaves
    /// nothing behind in the backing store (e.g. the OS credential store).
    fn clear_index(&self, chain_id: &str) -> Result<(), Error>;
}

/// In-memory key store for testing. No OS dependencies.
pub struct MemoryKeyStore {
    /// (chain_id:public_key) → encrypted blob
    keys: Mutex<HashMap<String, Vec<u8>>>,
    /// chain_id → [public_keys]
    indices: Mutex<HashMap<String, Vec<String>>>,
}

impl MemoryKeyStore {
    pub fn new() -> Self {
        Self {
            keys: Mutex::new(HashMap::new()),
            indices: Mutex::new(HashMap::new()),
        }
    }
}

impl KeyStore for MemoryKeyStore {
    fn store_key(&self, chain_id: &str, public_key: &str, encrypted: &[u8]) -> Result<(), Error> {
        let key = format!("{}:{}", chain_id, public_key);
        self.keys.lock().unwrap().insert(key, encrypted.to_vec());

        // Update index
        let mut indices = self.indices.lock().unwrap();
        let index = indices.entry(chain_id.to_string()).or_default();
        if !index.contains(&public_key.to_string()) {
            index.push(public_key.to_string());
        }
        Ok(())
    }

    fn load_key(&self, chain_id: &str, public_key: &str) -> Result<Vec<u8>, Error> {
        let key = format!("{}:{}", chain_id, public_key);
        self.keys
            .lock()
            .unwrap()
            .get(&key)
            .cloned()
            .ok_or_else(|| Error::KeyNotFound(format!("{}:{}", chain_id, public_key)))
    }

    fn delete_key(&self, chain_id: &str, public_key: &str) -> Result<(), Error> {
        let key = format!("{}:{}", chain_id, public_key);
        self.keys.lock().unwrap().remove(&key);

        let mut indices = self.indices.lock().unwrap();
        if let Some(index) = indices.get_mut(chain_id) {
            index.retain(|k| k != public_key);
        }
        Ok(())
    }

    fn list_keys(&self, chain_id: &str) -> Result<Vec<String>, Error> {
        let indices = self.indices.lock().unwrap();
        Ok(indices.get(chain_id).cloned().unwrap_or_default())
    }

    fn clear_index(&self, chain_id: &str) -> Result<(), Error> {
        self.indices.lock().unwrap().remove(chain_id);
        Ok(())
    }
}

/// OS keyring-backed key store (wraps existing os_keyring module).
pub struct OsKeyStore;

impl KeyStore for OsKeyStore {
    fn store_key(&self, chain_id: &str, public_key: &str, encrypted: &[u8]) -> Result<(), Error> {
        super::os_keyring::store_key(chain_id, public_key, encrypted)?;
        super::os_keyring::add_to_index(chain_id, public_key)?;
        Ok(())
    }

    fn load_key(&self, chain_id: &str, public_key: &str) -> Result<Vec<u8>, Error> {
        super::os_keyring::load_key(chain_id, public_key)
    }

    fn delete_key(&self, chain_id: &str, public_key: &str) -> Result<(), Error> {
        super::os_keyring::delete_key(chain_id, public_key)?;
        super::os_keyring::remove_from_index(chain_id, public_key)?;
        Ok(())
    }

    fn list_keys(&self, chain_id: &str) -> Result<Vec<String>, Error> {
        super::os_keyring::list_keys(chain_id)
    }

    fn clear_index(&self, chain_id: &str) -> Result<(), Error> {
        super::os_keyring::delete_index(chain_id)
    }
}

/// File-based key store. Stores encrypted key blobs as files in a directory.
/// Reliable fallback when the OS keyring doesn't work (Snap, Flatpak, WSL, etc).
///
/// Layout:
///   {base_dir}/keys/{hex(chain_id)}/{hex(public_key)}.bin  — encrypted blob
///   {base_dir}/keys/{hex(chain_id)}/index.json             — list of public keys
pub struct FileKeyStore {
    base_dir: std::path::PathBuf,
}

impl FileKeyStore {
    pub fn new(app_data_dir: std::path::PathBuf) -> Self {
        Self {
            base_dir: app_data_dir.join("keys"),
        }
    }

    fn chain_dir(&self, chain_id: &str) -> std::path::PathBuf {
        // Use first 16 chars of chain_id as directory name (enough to be unique, filesystem-safe)
        self.base_dir.join(&chain_id[..chain_id.len().min(16)])
    }

    /// Current filename: short SHA-256 hex of the public key.
    /// BLS pubkeys are ~140 chars, so hex-encoding the whole key (≈280 chars + ".bin")
    /// exceeded the 255-byte filesystem limit on ext4/NTFS → ENAMETOOLONG.
    fn key_file(&self, chain_id: &str, public_key: &str) -> std::path::PathBuf {
        use sha2::{Digest, Sha256};
        let digest = Sha256::digest(public_key.as_bytes());
        let safe_name = hex::encode(digest);
        self.chain_dir(chain_id).join(format!("{}.bin", safe_name))
    }

    /// Legacy filename used before the BLS fix: full hex of the pubkey bytes.
    /// Still read on load/delete so keys stored by older builds keep working.
    fn legacy_key_file(&self, chain_id: &str, public_key: &str) -> std::path::PathBuf {
        let safe_name = hex::encode(public_key.as_bytes());
        self.chain_dir(chain_id).join(format!("{}.bin", safe_name))
    }

    fn index_file(&self, chain_id: &str) -> std::path::PathBuf {
        self.chain_dir(chain_id).join("index.json")
    }

    fn read_index(&self, chain_id: &str) -> Vec<String> {
        let path = self.index_file(chain_id);
        match std::fs::read_to_string(&path) {
            Ok(json) => serde_json::from_str(&json).unwrap_or_default(),
            Err(_) => Vec::new(),
        }
    }

    fn write_index(&self, chain_id: &str, keys: &[String]) -> Result<(), Error> {
        let dir = self.chain_dir(chain_id);
        std::fs::create_dir_all(&dir)?;
        // SEC-030: owner-only directory for the on-disk key store.
        restrict_dir_permissions(&dir);
        let json = serde_json::to_string(keys).map_err(|e| Error::Serialization(e.to_string()))?;
        let index_path = self.index_file(chain_id);
        std::fs::write(&index_path, json)?;
        // SEC-030: owner-only key index file.
        restrict_file_permissions(&index_path);
        Ok(())
    }
}

impl KeyStore for FileKeyStore {
    fn store_key(&self, chain_id: &str, public_key: &str, encrypted: &[u8]) -> Result<(), Error> {
        let dir = self.chain_dir(chain_id);
        std::fs::create_dir_all(&dir)?;
        // SEC-030: owner-only directory for the on-disk key store.
        restrict_dir_permissions(&dir);
        let key_path = self.key_file(chain_id, public_key);
        std::fs::write(&key_path, encrypted)?;
        // SEC-030: owner-only encrypted key blob.
        restrict_file_permissions(&key_path);

        // Update index
        let mut index = self.read_index(chain_id);
        if !index.contains(&public_key.to_string()) {
            index.push(public_key.to_string());
        }
        self.write_index(chain_id, &index)?;

        log::info!(
            "[file-keystore] Stored key for {} on chain {}",
            public_key,
            crate::util::short_prefix(chain_id, 8) // SEC-013: renderer-supplied chain_id
        );
        Ok(())
    }

    fn load_key(&self, chain_id: &str, public_key: &str) -> Result<Vec<u8>, Error> {
        let path = self.key_file(chain_id, public_key);
        if let Ok(bytes) = std::fs::read(&path) {
            return Ok(bytes);
        }
        std::fs::read(self.legacy_key_file(chain_id, public_key))
            .map_err(|_| Error::KeyNotFound(format!("{}:{}", chain_id, public_key)))
    }

    fn delete_key(&self, chain_id: &str, public_key: &str) -> Result<(), Error> {
        let _ = std::fs::remove_file(self.key_file(chain_id, public_key));
        let _ = std::fs::remove_file(self.legacy_key_file(chain_id, public_key));

        let mut index = self.read_index(chain_id);
        index.retain(|k| k != public_key);
        self.write_index(chain_id, &index)?;
        Ok(())
    }

    fn list_keys(&self, chain_id: &str) -> Result<Vec<String>, Error> {
        Ok(self.read_index(chain_id))
    }

    fn clear_index(&self, chain_id: &str) -> Result<(), Error> {
        // SEC-028: best-effort removal of the on-disk index for this chain.
        let _ = std::fs::remove_file(self.index_file(chain_id));
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn memory_store_crud() {
        let store = MemoryKeyStore::new();
        let chain = "test-chain";
        let pubkey = "EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV";

        // Empty initially
        assert_eq!(store.list_keys(chain).unwrap().len(), 0);

        // Store
        store.store_key(chain, pubkey, b"encrypted-data").unwrap();
        assert_eq!(store.list_keys(chain).unwrap(), vec![pubkey]);

        // Load
        let data = store.load_key(chain, pubkey).unwrap();
        assert_eq!(data, b"encrypted-data");

        // Duplicate store doesn't create duplicate index
        store.store_key(chain, pubkey, b"updated-data").unwrap();
        assert_eq!(store.list_keys(chain).unwrap().len(), 1);
        assert_eq!(store.load_key(chain, pubkey).unwrap(), b"updated-data");

        // Delete
        store.delete_key(chain, pubkey).unwrap();
        assert_eq!(store.list_keys(chain).unwrap().len(), 0);
        assert!(store.load_key(chain, pubkey).is_err());
    }

    #[test]
    fn memory_store_multiple_chains() {
        let store = MemoryKeyStore::new();

        store.store_key("chain-a", "key1", b"data1").unwrap();
        store.store_key("chain-a", "key2", b"data2").unwrap();
        store.store_key("chain-b", "key3", b"data3").unwrap();

        assert_eq!(store.list_keys("chain-a").unwrap().len(), 2);
        assert_eq!(store.list_keys("chain-b").unwrap().len(), 1);
        assert_eq!(store.list_keys("chain-c").unwrap().len(), 0);
    }
}
