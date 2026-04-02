use tauri::State;

use crate::antelope::signing;
use crate::error::Error;
use crate::keystore::{derive, memory::WalletSession, os_keyring};

#[tauri::command]
pub fn is_locked(session: State<WalletSession>) -> Result<bool, Error> {
    let session = session.0.lock().unwrap();
    Ok(!session.is_unlocked())
}

#[tauri::command]
pub fn unlock(passphrase: String, session: State<WalletSession>) -> Result<bool, Error> {
    // Derive the master key from the passphrase
    // We use a fixed application salt for the master key derivation
    let master_key = derive::derive_key(passphrase.as_bytes(), b"simpleos-master-key");
    let mut session = session.0.lock().unwrap();
    session.unlock(master_key.to_vec());
    Ok(true)
}

#[tauri::command]
pub fn lock(session: State<WalletSession>) -> Result<(), Error> {
    let mut session = session.0.lock().unwrap();
    session.lock();
    Ok(())
}

#[tauri::command]
pub fn import_private_key(
    wif: String,
    chain_id: String,
    passphrase: String,
    session: State<WalletSession>,
) -> Result<crate::antelope::types::ImportResult, Error> {
    // Derive public key from WIF
    let (private_key_bytes, public_key) = signing::public_key_from_wif(&wif)?;

    // Encrypt private key with passphrase (salt = public key bytes)
    let encrypted = derive::encrypt(&private_key_bytes, passphrase.as_bytes(), public_key.as_bytes())?;

    // Store in OS keychain
    os_keyring::store_key(&chain_id, &public_key, &encrypted)?;
    os_keyring::add_to_index(&chain_id, &public_key)?;

    // Unlock session with the passphrase
    let master_key = derive::derive_key(passphrase.as_bytes(), b"simpleos-master-key");
    let mut session = session.0.lock().unwrap();
    session.unlock(master_key.to_vec());

    Ok(crate::antelope::types::ImportResult {
        public_key,
        accounts: vec![], // Caller should use lookup_key_accounts to find associated accounts
    })
}

#[tauri::command]
pub fn list_public_keys(chain_id: String) -> Result<Vec<String>, Error> {
    os_keyring::list_keys(&chain_id)
}

#[tauri::command]
pub fn remove_key(chain_id: String, public_key: String) -> Result<(), Error> {
    os_keyring::delete_key(&chain_id, &public_key)?;
    os_keyring::remove_from_index(&chain_id, &public_key)?;
    Ok(())
}
