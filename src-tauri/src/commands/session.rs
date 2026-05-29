//! Anchor-link session commands.
//!
//! Manages session keypairs and sealed message encryption/decryption
//! for the persistent channel protocol.

use serde::Serialize;
use tauri::State;

use crate::antelope::{sealed_message, signing};
use crate::error::Error;
use crate::keystore::derive;
use crate::AppWallet;

/// Chain ID prefix used for storing link session keys in the keystore.
const LINK_SESSION_CHAIN: &str = "__link__";
/// Salt used for encrypting session private keys with the master key.
const SESSION_SALT: &[u8] = b"simpleos-link-session";

#[derive(Debug, Serialize)]
pub struct SessionInfo {
    /// The full channel URL (e.g. "https://cb.anchor.link/<uuid>")
    pub channel_url: String,
    /// PUB_K1_... encoded public key (for the callback payload / dApp consumption)
    pub link_key: String,
    /// Hex-encoded compressed public key (for internal keystore lookups)
    pub link_key_hex: String,
    /// Wallet display name
    pub link_name: String,
    /// The channel UUID (used for WebSocket path)
    pub channel_uuid: String,
}

/// Generate a v4-style UUID from 16 random bytes.
fn random_uuid() -> String {
    let mut bytes = [0u8; 16];
    use rand::RngCore;
    rand::thread_rng().fill_bytes(&mut bytes);
    // Set version (4) and variant (RFC 4122)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        bytes[0], bytes[1], bytes[2], bytes[3],
        bytes[4], bytes[5],
        bytes[6], bytes[7],
        bytes[8], bytes[9],
        bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15],
    )
}

/// Create a new link session: generate a keypair, store the encrypted private key,
/// and return the session info including the channel URL.
#[tauri::command]
pub fn create_link_session(
    buoy_url: String,
    wallet: State<AppWallet>,
) -> Result<SessionInfo, Error> {
    let (private_bytes, public_bytes) = signing::generate_keypair_raw()?;
    let link_key_hex = hex::encode(&public_bytes);
    let link_key = signing::encode_k1_public_key_from_bytes(&public_bytes);
    let channel_uuid = random_uuid();

    // Encrypt private key with the wallet master key
    let mut session = wallet.0.session_lock()?;
    let master_key = session.master_key().ok_or(Error::WalletLocked)?;
    let encrypted = derive::encrypt(&private_bytes, master_key, SESSION_SALT)
        .map_err(|e| Error::Encryption(format!("Failed to encrypt session key: {}", e)))?;
    drop(session);

    // Store in keystore under the __link__ namespace, keyed by hex pubkey
    wallet.0.store_raw_key(LINK_SESSION_CHAIN, &link_key_hex, &encrypted)?;

    let channel_url = format!("https://{}/{}", buoy_url, channel_uuid);

    log::info!(
        "[session] Created link session: key={}, channel={}",
        &link_key_hex[..16],
        channel_uuid
    );

    Ok(SessionInfo {
        channel_url,
        link_key,
        link_key_hex,
        link_name: "SimplEOS".to_string(),
        channel_uuid,
    })
}

/// Decrypt a SealedMessage received from a dApp via the session channel.
///
/// Returns the decrypted payload as a UTF-8 string (typically an ESR URI).
/// The `from_key` can be PUB_K1_..., EOS..., or hex-encoded compressed public key.
#[tauri::command]
pub fn unseal_message(
    ciphertext_hex: String,
    nonce: u64,
    from_key: String,
    session_pubkey_hex: String,
    wallet: State<AppWallet>,
) -> Result<String, Error> {
    let ciphertext = hex::decode(&ciphertext_hex)
        .map_err(|e| Error::Encryption(format!("Invalid ciphertext hex: {}", e)))?;
    let from_key_bytes = signing::decode_public_key_flexible(&from_key)
        .map_err(|e| Error::Encryption(format!("Invalid from key: {}", e)))?;

    // Load and decrypt our session private key
    let encrypted = wallet.0.load_raw_key(LINK_SESSION_CHAIN, &session_pubkey_hex)?;
    let mut session = wallet.0.session_lock()?;
    let master_key = session.master_key().ok_or(Error::WalletLocked)?;
    let private_key = derive::decrypt(&encrypted, master_key, SESSION_SALT)
        .map_err(|_| Error::Encryption("Failed to decrypt session key".into()))?;
    drop(session);

    let plaintext = sealed_message::unseal(&ciphertext, nonce, &private_key, &from_key_bytes)?;

    String::from_utf8(plaintext)
        .map_err(|e| Error::Encryption(format!("Decrypted payload is not valid UTF-8: {}", e)))
}

/// Encrypt a payload into a SealedMessage for sending to a dApp.
#[tauri::command]
pub fn seal_message(
    payload: String,
    nonce: u64,
    to_key_hex: String,
    session_pubkey_hex: String,
    wallet: State<AppWallet>,
) -> Result<String, Error> {
    let to_key = hex::decode(&to_key_hex)
        .map_err(|e| Error::Encryption(format!("Invalid to_key hex: {}", e)))?;

    // Load and decrypt our session private key
    let encrypted = wallet.0.load_raw_key(LINK_SESSION_CHAIN, &session_pubkey_hex)?;
    let mut session = wallet.0.session_lock()?;
    let master_key = session.master_key().ok_or(Error::WalletLocked)?;
    let private_key = derive::decrypt(&encrypted, master_key, SESSION_SALT)
        .map_err(|_| Error::Encryption("Failed to decrypt session key".into()))?;
    drop(session);

    let ciphertext = sealed_message::seal(payload.as_bytes(), nonce, &private_key, &to_key)?;

    Ok(hex::encode(&ciphertext))
}

/// Delete a link session keypair from the keystore.
#[tauri::command]
pub fn delete_link_session(
    session_pubkey_hex: String,
    wallet: State<AppWallet>,
) -> Result<(), Error> {
    wallet.0.delete_raw_key(LINK_SESSION_CHAIN, &session_pubkey_hex)?;
    log::info!(
        "[session] Deleted link session: key={}",
        &session_pubkey_hex[..session_pubkey_hex.len().min(16)]
    );
    Ok(())
}
