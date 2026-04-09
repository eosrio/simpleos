//! Anchor-link SealedMessage encrypt/decrypt.
//!
//! Implements the E2E encryption used by the anchor-link session protocol.
//! Messages are encrypted with AES-256-CBC using a shared secret derived from
//! ECDH + SHA-512 key derivation.
//!
//! KDF: SHA-512(nonce_le_bytes || ecdh_shared_secret)
//!   → first 32 bytes = AES-256 key
//!   → next 16 bytes  = CBC IV

use aes::cipher::{block_padding::Pkcs7, BlockDecryptMut, BlockEncryptMut, KeyIvInit};
use sha2::{Digest, Sha512};

use crate::error::Error;

type Aes256CbcEnc = cbc::Encryptor<aes::Aes256>;
type Aes256CbcDec = cbc::Decryptor<aes::Aes256>;

/// Derive AES-256 key and CBC IV from an ECDH shared secret and a nonce.
fn derive_key_iv(nonce: u64, shared_secret: &[u8; 32]) -> ([u8; 32], [u8; 16]) {
    let mut hasher = Sha512::new();
    hasher.update(nonce.to_le_bytes());
    hasher.update(shared_secret);
    let hash = hasher.finalize();

    let mut key = [0u8; 32];
    let mut iv = [0u8; 16];
    key.copy_from_slice(&hash[..32]);
    iv.copy_from_slice(&hash[32..48]);
    (key, iv)
}

/// Decrypt a SealedMessage ciphertext.
///
/// - `ciphertext`: the raw encrypted bytes (AES-256-CBC with PKCS7 padding)
/// - `nonce`: the uint64 nonce from the SealedMessage
/// - `our_private`: our 32-byte session private key
/// - `their_public`: their 33-byte compressed secp256k1 public key (the `from` field)
pub fn unseal(
    ciphertext: &[u8],
    nonce: u64,
    our_private: &[u8],
    their_public: &[u8],
) -> Result<Vec<u8>, Error> {
    let shared = super::signing::ecdh_shared_secret(our_private, their_public)?;
    let (key, iv) = derive_key_iv(nonce, &shared);

    Aes256CbcDec::new(&key.into(), &iv.into())
        .decrypt_padded_vec_mut::<Pkcs7>(ciphertext)
        .map_err(|_| Error::Encryption("AES-CBC decryption failed (bad padding or key)".into()))
}

/// Encrypt a plaintext into a SealedMessage ciphertext.
///
/// - `plaintext`: the data to encrypt (typically a serialized ESR request)
/// - `nonce`: a random uint64 nonce (caller must generate and include in the SealedMessage)
/// - `our_private`: our 32-byte session private key
/// - `their_public`: their 33-byte compressed secp256k1 public key
pub fn seal(
    plaintext: &[u8],
    nonce: u64,
    our_private: &[u8],
    their_public: &[u8],
) -> Result<Vec<u8>, Error> {
    let shared = super::signing::ecdh_shared_secret(our_private, their_public)?;
    let (key, iv) = derive_key_iv(nonce, &shared);

    Ok(Aes256CbcEnc::new(&key.into(), &iv.into()).encrypt_padded_vec_mut::<Pkcs7>(plaintext))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seal_unseal_roundtrip() {
        let (priv_a, pub_a) =
            super::super::signing::generate_keypair_raw().unwrap();
        let (priv_b, pub_b) =
            super::super::signing::generate_keypair_raw().unwrap();

        let plaintext = b"esr:test-signing-request-payload";
        let nonce: u64 = 12345;

        // A seals for B
        let ciphertext = seal(plaintext, nonce, &priv_a, &pub_b).unwrap();

        // B unseals from A
        let decrypted = unseal(&ciphertext, nonce, &priv_b, &pub_a).unwrap();

        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn wrong_key_fails() {
        let (priv_a, _pub_a) =
            super::super::signing::generate_keypair_raw().unwrap();
        let (_priv_b, pub_b) =
            super::super::signing::generate_keypair_raw().unwrap();
        let (_priv_c, pub_c) =
            super::super::signing::generate_keypair_raw().unwrap();

        let ciphertext = seal(b"secret", 1, &priv_a, &pub_b).unwrap();

        // C tries to unseal — wrong key, should fail
        let (priv_c, _) = super::super::signing::generate_keypair_raw().unwrap();
        let result = unseal(&ciphertext, 1, &priv_c, &pub_c);
        assert!(result.is_err());
    }

    #[test]
    fn wrong_nonce_fails() {
        let (priv_a, pub_a) =
            super::super::signing::generate_keypair_raw().unwrap();
        let (priv_b, pub_b) =
            super::super::signing::generate_keypair_raw().unwrap();

        let ciphertext = seal(b"secret", 100, &priv_a, &pub_b).unwrap();

        // Wrong nonce
        let result = unseal(&ciphertext, 999, &priv_b, &pub_a);
        assert!(result.is_err());
    }
}
