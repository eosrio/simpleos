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
    /// Commit encrypted records together. Unsupported backends must fail before writing.
    fn store_batch(&self, _records: &[(String, String, Vec<u8>)]) -> Result<(), Error> {
        Err(Error::Keyring(
            "This storage backend does not support atomic vault changes".into(),
        ))
    }
    /// True only when there is no existing vault material. Errors must not mean empty.
    fn is_empty(&self) -> Result<bool, Error> {
        Err(Error::Keyring(
            "Cannot establish that the key store is empty".into(),
        ))
    }
    fn namespaces(&self, known: &[String]) -> Result<Vec<String>, Error> {
        Ok(known.to_vec())
    }
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
    fn namespaces(&self, _known: &[String]) -> Result<Vec<String>, Error> {
        Ok(self.indices.lock().unwrap().keys().cloned().collect())
    }
    fn store_batch(&self, records: &[(String, String, Vec<u8>)]) -> Result<(), Error> {
        let mut keys = self.keys.lock().unwrap();
        let mut indices = self.indices.lock().unwrap();
        for (chain, public, encrypted) in records {
            keys.insert(format!("{chain}:{public}"), encrypted.clone());
            let index = indices.entry(chain.clone()).or_default();
            if !index.contains(public) {
                index.push(public.clone());
            }
        }
        Ok(())
    }

    fn is_empty(&self) -> Result<bool, Error> {
        Ok(self.keys.lock().unwrap().is_empty())
    }
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

/// File store with an atomically replaced encrypted snapshot. Existing per-key
/// files are read lazily and retained during migration; once a namespace is in
/// the snapshot it is authoritative, including an empty (deleted) namespace.
pub struct FileKeyStore {
    base_dir: std::path::PathBuf,
    mutation: Mutex<()>,
    #[cfg(test)]
    pub(crate) fail_before_commit: std::sync::Arc<std::sync::atomic::AtomicBool>,
}

type Snapshot = std::collections::BTreeMap<String, std::collections::BTreeMap<String, Vec<u8>>>;

impl FileKeyStore {
    pub fn new(app_data_dir: std::path::PathBuf) -> Self {
        Self {
            base_dir: app_data_dir.join("keys"),
            mutation: Mutex::new(()),
            #[cfg(test)]
            fail_before_commit: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
        }
    }

    fn legacy_dir(&self, chain: &str) -> Result<std::path::PathBuf, Error> {
        // Never use unchecked renderer text as a path, even for legacy reads.
        if chain.is_empty()
            || !chain
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
        {
            return Err(Error::Serialization("Invalid key namespace".into()));
        }
        Ok(self.base_dir.join(&chain[..chain.len().min(16)]))
    }

    fn snapshot(&self) -> Result<Snapshot, Error> {
        match std::fs::read(self.base_dir.join("vault-v2.json")) {
            Ok(bytes) => serde_json::from_slice(&bytes)
                .map_err(|e| Error::Serialization(format!("Corrupt key store: {e}"))),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Snapshot::new()),
            Err(e) => Err(e.into()),
        }
    }

    fn legacy_index(&self, chain: &str) -> Result<Vec<String>, Error> {
        let dir = self.legacy_dir(chain)?;
        let keys: Vec<String> = match std::fs::read(dir.join("index.json")) {
            Ok(bytes) => serde_json::from_slice(&bytes)
                .map_err(|e| Error::Serialization(format!("Corrupt key index: {e}"))),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(vec![]),
            Err(e) => Err(e.into()),
        }?;
        if dir.exists() {
            use sha2::{Digest, Sha256};
            let expected: std::collections::BTreeSet<String> = keys
                .iter()
                .flat_map(|key| {
                    [
                        format!("{}.bin", hex::encode(key.as_bytes())),
                        format!("{}.bin", hex::encode(Sha256::digest(key.as_bytes()))),
                    ]
                })
                .collect();
            for entry in std::fs::read_dir(dir)? {
                let entry = entry?;
                let name = entry.file_name().to_string_lossy().into_owned();
                if name.ends_with(".bin") && !expected.contains(&name) {
                    return Err(Error::Keyring("Unindexed legacy key material; recover the key index before changing this vault".into()));
                }
            }
        }
        Ok(keys)
    }

    fn legacy_load(&self, chain: &str, public: &str) -> Result<Vec<u8>, Error> {
        use sha2::{Digest, Sha256};
        let dir = self.legacy_dir(chain)?;
        let current = dir.join(format!(
            "{}.bin",
            hex::encode(Sha256::digest(public.as_bytes()))
        ));
        match std::fs::read(current) {
            Ok(bytes) => return Ok(bytes),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
            Err(e) => return Err(e.into()),
        }
        // The older full-hex filename could exceed the filesystem component limit.
        if public.len() * 2 + 4 > 255 {
            return Err(Error::KeyNotFound(public.into()));
        }
        match std::fs::read(dir.join(format!("{}.bin", hex::encode(public.as_bytes())))) {
            Ok(bytes) => Ok(bytes),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                Err(Error::KeyNotFound(public.into()))
            }
            Err(e) => Err(e.into()),
        }
    }

    fn migrate_namespace(&self, snapshot: &mut Snapshot, chain: &str) -> Result<(), Error> {
        self.legacy_dir(chain)?;
        if !snapshot.contains_key(chain) {
            let mut entries = std::collections::BTreeMap::new();
            for public in self.legacy_index(chain)? {
                entries.insert(public.clone(), self.legacy_load(chain, &public)?);
            }
            snapshot.insert(chain.into(), entries);
        }
        Ok(())
    }

    fn commit(&self, snapshot: &Snapshot) -> Result<(), Error> {
        use std::io::Write;
        std::fs::create_dir_all(&self.base_dir)?;
        restrict_dir_permissions(&self.base_dir);
        // Same-directory rename is the commit point. A failed write/rename leaves
        // the old snapshot readable, including after restart. No delete-then-rename.
        let mut temp = tempfile::NamedTempFile::new_in(&self.base_dir)?;
        restrict_file_permissions(temp.path());
        serde_json::to_writer(&mut temp, snapshot)
            .map_err(|e| Error::Serialization(e.to_string()))?;
        temp.flush()?;
        temp.as_file().sync_all()?;
        #[cfg(test)]
        if self
            .fail_before_commit
            .load(std::sync::atomic::Ordering::SeqCst)
        {
            return Err(Error::Io(std::io::Error::other(
                "injected failure before snapshot commit",
            )));
        }
        temp.persist(self.base_dir.join("vault-v2.json"))
            .map_err(|e| Error::Io(e.error))?;
        #[cfg(unix)]
        if let Err(e) = std::fs::File::open(&self.base_dir).and_then(|dir| dir.sync_all()) {
            // Rename already committed. Never report an aborted transaction and
            // leave the session using the old password after this commit point.
            log::error!("Vault committed, but directory synchronization failed: {e}");
        }
        Ok(())
    }
}

impl KeyStore for FileKeyStore {
    fn namespaces(&self, known: &[String]) -> Result<Vec<String>, Error> {
        let mut namespaces: std::collections::BTreeSet<String> = known.iter().cloned().collect();
        namespaces.extend(self.snapshot()?.into_keys());
        if self.base_dir.exists() {
            for entry in std::fs::read_dir(&self.base_dir)? {
                let entry = entry?;
                if entry.file_type()?.is_dir()
                    && !namespaces
                        .iter()
                        .any(|n| self.legacy_dir(n).ok().as_ref() == Some(&entry.path()))
                    && std::fs::read_dir(entry.path())?
                        .next()
                        .transpose()?
                        .is_some()
                {
                    return Err(Error::Keyring("Unknown legacy key namespace; recover its chain configuration before changing or exporting the vault".into()));
                }
            }
        }
        Ok(namespaces.into_iter().collect())
    }
    fn store_key(&self, chain: &str, public: &str, encrypted: &[u8]) -> Result<(), Error> {
        self.store_batch(&[(chain.into(), public.into(), encrypted.to_vec())])
    }

    fn store_batch(&self, records: &[(String, String, Vec<u8>)]) -> Result<(), Error> {
        let _guard = self.mutation.lock().unwrap();
        let mut snapshot = self.snapshot()?;
        for (chain, public, encrypted) in records {
            self.migrate_namespace(&mut snapshot, chain)?;
            snapshot
                .get_mut(chain)
                .unwrap()
                .insert(public.clone(), encrypted.clone());
        }
        self.commit(&snapshot)
    }

    fn load_key(&self, chain: &str, public: &str) -> Result<Vec<u8>, Error> {
        self.legacy_dir(chain)?;
        let snapshot = self.snapshot()?;
        if let Some(entries) = snapshot.get(chain) {
            return entries
                .get(public)
                .cloned()
                .ok_or_else(|| Error::KeyNotFound(public.into()));
        }
        self.legacy_load(chain, public)
    }

    fn delete_key(&self, chain: &str, public: &str) -> Result<(), Error> {
        let _guard = self.mutation.lock().unwrap();
        let mut snapshot = self.snapshot()?;
        self.migrate_namespace(&mut snapshot, chain)?;
        snapshot.get_mut(chain).unwrap().remove(public);
        self.commit(&snapshot)
    }

    fn list_keys(&self, chain: &str) -> Result<Vec<String>, Error> {
        self.legacy_dir(chain)?;
        match self.snapshot()?.get(chain) {
            Some(entries) => Ok(entries.keys().cloned().collect()),
            None => self.legacy_index(chain),
        }
    }

    fn clear_index(&self, chain: &str) -> Result<(), Error> {
        let _guard = self.mutation.lock().unwrap();
        let mut snapshot = self.snapshot()?;
        self.legacy_dir(chain)?;
        snapshot.insert(chain.into(), Default::default());
        self.commit(&snapshot)
    }

    fn is_empty(&self) -> Result<bool, Error> {
        let snapshot = self.snapshot()?;
        if snapshot.values().any(|entries| !entries.is_empty()) {
            return Ok(false);
        }
        let dirs = match std::fs::read_dir(&self.base_dir) {
            Ok(dirs) => dirs,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(true),
            Err(e) => return Err(e.into()),
        };
        for entry in dirs {
            let entry = entry?;
            if entry.file_type()?.is_dir() {
                let covered = snapshot
                    .keys()
                    .any(|chain| self.legacy_dir(chain).ok().as_ref() == Some(&entry.path()));
                if !covered
                    && std::fs::read_dir(entry.path())?
                        .next()
                        .transpose()?
                        .is_some()
                {
                    return Ok(false);
                }
            }
        }
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn corrupt_snapshot_and_unindexed_legacy_material_fail_closed() {
        let dir = tempfile::tempdir().unwrap();
        let legacy = dir.path().join("keys/legacy-chain");
        std::fs::create_dir_all(&legacy).unwrap();
        std::fs::write(legacy.join("orphan.bin"), b"existing encrypted material").unwrap();
        let store = FileKeyStore::new(dir.path().into());
        assert!(!store.is_empty().unwrap());
        assert!(store
            .store_key("legacy-chain", "new", b"new bytes")
            .is_err());
        assert!(store.list_keys("legacy-chain").is_err());
        let snapshot = dir.path().join("keys/vault-v2.json");
        std::fs::write(&snapshot, b"broken json").unwrap();
        assert!(store.is_empty().is_err());
        assert!(store.store_key("chain", "key", b"new bytes").is_err());
        assert_eq!(std::fs::read(snapshot).unwrap(), b"broken json");
    }

    #[test]
    fn file_batch_failure_keeps_all_old_records_after_restart() {
        let dir = tempfile::tempdir().unwrap();
        let store = FileKeyStore::new(dir.path().into());
        store
            .store_batch(&[
                ("chain".into(), "a".into(), b"old-a".to_vec()),
                ("chain".into(), "b".into(), b"old-b".to_vec()),
            ])
            .unwrap();
        store
            .fail_before_commit
            .store(true, std::sync::atomic::Ordering::SeqCst);
        assert!(store
            .store_batch(&[
                ("chain".into(), "a".into(), b"new-a".to_vec()),
                ("chain".into(), "b".into(), b"new-b".to_vec())
            ])
            .is_err());
        let restarted = FileKeyStore::new(dir.path().into());
        assert_eq!(restarted.load_key("chain", "a").unwrap(), b"old-a");
        assert_eq!(restarted.load_key("chain", "b").unwrap(), b"old-b");
        restarted
            .store_batch(&[
                ("chain".into(), "a".into(), b"new-a".to_vec()),
                ("chain".into(), "b".into(), b"new-b".to_vec()),
            ])
            .unwrap();
        let restarted = FileKeyStore::new(dir.path().into());
        assert_eq!(restarted.load_key("chain", "a").unwrap(), b"new-a");
        assert_eq!(restarted.load_key("chain", "b").unwrap(), b"new-b");
    }

    #[test]
    fn file_store_rejects_unsafe_namespaces_and_keeps_full_chain_identity() {
        let dir = tempfile::tempdir().unwrap();
        let store = FileKeyStore::new(dir.path().into());
        for chain in ["../escaped", "aaaaaaaaaaaaaaaé", "C:\\temp", "", "foo/bar"] {
            assert!(store.store_key(chain, "key", b"value").is_err());
            assert!(store.list_keys(chain).is_err());
        }
        assert!(!dir.path().join("escaped").exists());
        store.store_key("aaaaaaaaaaaaaaaa1", "key", b"one").unwrap();
        store.store_key("aaaaaaaaaaaaaaaa2", "key", b"two").unwrap();
        assert_eq!(store.load_key("aaaaaaaaaaaaaaaa1", "key").unwrap(), b"one");
        assert_eq!(store.load_key("aaaaaaaaaaaaaaaa2", "key").unwrap(), b"two");
    }

    #[test]
    fn legacy_keys_survive_migration_and_deleted_keys_do_not_reappear() {
        use sha2::{Digest, Sha256};
        let dir = tempfile::tempdir().unwrap();
        let legacy = dir.path().join("keys/legacy-chain");
        std::fs::create_dir_all(&legacy).unwrap();
        std::fs::write(legacy.join("index.json"), br#"["first","second"]"#).unwrap();
        std::fs::write(
            legacy.join(format!("{}.bin", hex::encode(Sha256::digest(b"first")))),
            b"old-first",
        )
        .unwrap();
        std::fs::write(
            legacy.join(format!("{}.bin", hex::encode(b"second"))),
            b"old-second",
        )
        .unwrap();
        let store = FileKeyStore::new(dir.path().into());
        assert!(!store.is_empty().unwrap());
        store
            .store_key("legacy-chain", "first", b"new-first")
            .unwrap();
        assert_eq!(
            store.load_key("legacy-chain", "second").unwrap(),
            b"old-second"
        );
        store.delete_key("legacy-chain", "second").unwrap();
        let restarted = FileKeyStore::new(dir.path().into());
        assert!(restarted.load_key("legacy-chain", "second").is_err());
        assert_eq!(
            restarted.load_key("legacy-chain", "first").unwrap(),
            b"new-first"
        );
    }

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
