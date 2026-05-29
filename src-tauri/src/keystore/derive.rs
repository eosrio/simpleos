use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use pbkdf2::pbkdf2_hmac;
use sha2::Sha256;
use zeroize::Zeroize;

const PBKDF2_ITERATIONS: u32 = 600_000;
const AES_KEY_LEN: usize = 32;
const NONCE_LEN: usize = 12;

/// Derive an AES-256 key from a passphrase and salt using PBKDF2-HMAC-SHA256.
pub fn derive_key(passphrase: &[u8], salt: &[u8]) -> [u8; AES_KEY_LEN] {
    let mut key = [0u8; AES_KEY_LEN];
    pbkdf2_hmac::<Sha256>(passphrase, salt, PBKDF2_ITERATIONS, &mut key);
    key
}

/// Encrypt plaintext with AES-256-GCM using a passphrase-derived key.
/// Returns: nonce (12 bytes) || ciphertext+tag
pub fn encrypt(
    plaintext: &[u8],
    passphrase: &[u8],
    salt: &[u8],
) -> Result<Vec<u8>, crate::error::Error> {
    let mut key = derive_key(passphrase, salt);
    let result = encrypt_with_key(plaintext, &key);
    key.zeroize();
    result
}

/// Encrypt plaintext with an already-derived AES-256 key.
///
/// Returns: nonce (12 bytes) || ciphertext+tag
pub fn encrypt_with_key(
    plaintext: &[u8],
    key: &[u8; AES_KEY_LEN],
) -> Result<Vec<u8>, crate::error::Error> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| crate::error::Error::Encryption(e.to_string()))?;

    let nonce_bytes: [u8; NONCE_LEN] = rand::random();
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| crate::error::Error::Encryption(e.to_string()))?;

    let mut result = Vec::with_capacity(NONCE_LEN + ciphertext.len());
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);
    Ok(result)
}

/// Decrypt data encrypted with `encrypt()`.
/// Input: nonce (12 bytes) || ciphertext+tag
pub fn decrypt(
    data: &[u8],
    passphrase: &[u8],
    salt: &[u8],
) -> Result<Vec<u8>, crate::error::Error> {
    let mut key = derive_key(passphrase, salt);
    let result = decrypt_with_key(data, &key);
    key.zeroize();
    result
}

/// Decrypt data with an already-derived AES-256 key.
pub fn decrypt_with_key(
    data: &[u8],
    key: &[u8; AES_KEY_LEN],
) -> Result<Vec<u8>, crate::error::Error> {
    if data.len() < NONCE_LEN {
        return Err(crate::error::Error::Encryption("Data too short".into()));
    }

    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| crate::error::Error::Encryption(e.to_string()))?;

    let nonce = Nonce::from_slice(&data[..NONCE_LEN]);
    let plaintext = cipher
        .decrypt(nonce, &data[NONCE_LEN..])
        .map_err(|_| crate::error::Error::InvalidPassphrase)?;

    Ok(plaintext)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypt_decrypt_roundtrip() {
        let plaintext = b"5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3";
        let passphrase = b"my-secure-passphrase";
        let salt = b"EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV";

        let encrypted = encrypt(plaintext, passphrase, salt).unwrap();
        let decrypted = decrypt(&encrypted, passphrase, salt).unwrap();

        assert_eq!(plaintext.to_vec(), decrypted);
    }

    #[test]
    fn wrong_passphrase_fails() {
        let plaintext = b"secret-key-data";
        let passphrase = b"correct-passphrase";
        let wrong = b"wrong-passphrase";
        let salt = b"salt";

        let encrypted = encrypt(plaintext, passphrase, salt).unwrap();
        let result = decrypt(&encrypted, wrong, salt);

        assert!(result.is_err());
    }
}
