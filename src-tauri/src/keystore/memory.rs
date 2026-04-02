use std::sync::Mutex;
use std::time::{Duration, Instant};
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Session timeout before auto-lock (5 minutes).
const SESSION_TIMEOUT: Duration = Duration::from_secs(300);

/// A zeroizing container for sensitive key material.
#[derive(Zeroize, ZeroizeOnDrop)]
pub struct SecretKey {
    bytes: Vec<u8>,
}

impl SecretKey {
    pub fn new(bytes: Vec<u8>) -> Self {
        Self { bytes }
    }

    pub fn as_bytes(&self) -> &[u8] {
        &self.bytes
    }
}

/// Manages the wallet session — tracks whether the wallet is unlocked
/// and holds the derived encryption key in memory.
pub struct Session {
    /// The derived master key for decrypting private keys from the keyring.
    /// Only present when unlocked.
    master_key: Option<SecretKey>,
    /// When the session was last used.
    last_activity: Instant,
}

impl Session {
    pub fn new() -> Self {
        Self {
            master_key: None,
            last_activity: Instant::now(),
        }
    }

    /// Unlock the session with a derived master key.
    pub fn unlock(&mut self, key: Vec<u8>) {
        self.master_key = Some(SecretKey::new(key));
        self.last_activity = Instant::now();
    }

    /// Lock the session, zeroizing the master key.
    pub fn lock(&mut self) {
        self.master_key = None;
    }

    /// Check if the session is unlocked and not expired.
    pub fn is_unlocked(&self) -> bool {
        if self.master_key.is_none() {
            return false;
        }
        if self.last_activity.elapsed() > SESSION_TIMEOUT {
            return false;
        }
        true
    }

    /// Get the master key if the session is unlocked. Refreshes activity timer.
    pub fn master_key(&mut self) -> Option<&[u8]> {
        if !self.is_unlocked() {
            self.lock();
            return None;
        }
        self.last_activity = Instant::now();
        self.master_key.as_ref().map(|k| k.as_bytes())
    }
}

impl Drop for Session {
    fn drop(&mut self) {
        self.lock();
    }
}

/// Thread-safe wrapper around Session for use as Tauri state.
pub struct WalletSession(pub Mutex<Session>);

impl WalletSession {
    pub fn new() -> Self {
        Self(Mutex::new(Session::new()))
    }
}
