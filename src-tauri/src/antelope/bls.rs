//! BLS12-381 key management for Savannah Instant Finality.
//!
//! Antelope uses BLS12-381 min_pk variant (public keys on G1, signatures on G2)
//! with affine little-endian non-Montgomery serialization.

use crate::error::Error;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;

const POP_DST: &[u8] = b"BLS_POP_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_";

/// Generate a BLS12-381 keypair and proof of possession.
///
/// Returns (private_key_bytes, PUB_BLS_..., SIG_BLS_...).
pub fn generate_finalizer_key() -> Result<(Vec<u8>, String, String), Error> {
    let ikm: [u8; 32] = rand::random();
    let sk = blst::min_pk::SecretKey::key_gen(&ikm, &[])
        .map_err(|e| Error::Signing(format!("BLS key_gen failed: {:?}", e)))?;

    let pk = sk.sk_to_pk();

    // Antelope uses uncompressed affine little-endian serialization.
    // blst's `to_bytes()` returns compressed (48 bytes for G1, 96 for G2);
    // `serialize()` returns uncompressed (96 bytes for G1, 192 for G2) in big-endian.
    let pk_bytes = pk.serialize(); // 96 bytes, uncompressed, big-endian
    let pk_le = be_to_le_g1(&pk_bytes);

    // Proof of possession: sign the LE public key bytes with the PoP DST
    let pop_sig = sk.sign(&pk_le, POP_DST, &[]);
    let pop_bytes = pop_sig.serialize(); // 192 bytes, uncompressed, big-endian
    let pop_le = be_to_le_g2(&pop_bytes);

    // Encode to Antelope text format
    let pub_key_str = format!("PUB_BLS_{}", URL_SAFE_NO_PAD.encode(&pk_le));
    let pop_str = format!("SIG_BLS_{}", URL_SAFE_NO_PAD.encode(&pop_le));

    // Store private key as raw bytes (32 bytes)
    let sk_bytes = sk.to_bytes().to_vec();

    Ok((sk_bytes, pub_key_str, pop_str))
}

/// Regenerate the proof of possession for an existing private key.
pub fn proof_of_possession(sk_bytes: &[u8]) -> Result<(String, String), Error> {
    let sk = blst::min_pk::SecretKey::from_bytes(sk_bytes)
        .map_err(|e| Error::Signing(format!("Invalid BLS private key: {:?}", e)))?;

    let pk = sk.sk_to_pk();
    let pk_bytes = pk.serialize();
    let pk_le = be_to_le_g1(&pk_bytes);

    let pop_sig = sk.sign(&pk_le, POP_DST, &[]);
    let pop_bytes = pop_sig.serialize();
    let pop_le = be_to_le_g2(&pop_bytes);

    let pub_key_str = format!("PUB_BLS_{}", URL_SAFE_NO_PAD.encode(&pk_le));
    let pop_str = format!("SIG_BLS_{}", URL_SAFE_NO_PAD.encode(&pop_le));

    Ok((pub_key_str, pop_str))
}

/// Convert a 96-byte G1 point from big-endian to little-endian (two 48-byte field elements).
fn be_to_le_g1(be: &[u8]) -> Vec<u8> {
    let mut le = vec![0u8; 96];
    // Reverse each 48-byte field element
    for i in 0..48 {
        le[i] = be[47 - i];
        le[48 + i] = be[95 - i];
    }
    le
}

/// Convert a 192-byte G2 point from big-endian to little-endian (four 48-byte field elements).
fn be_to_le_g2(be: &[u8]) -> Vec<u8> {
    let mut le = vec![0u8; 192];
    for chunk in 0..4 {
        for i in 0..48 {
            le[chunk * 48 + i] = be[chunk * 48 + 47 - i];
        }
    }
    le
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_key_produces_valid_format() {
        let (sk, pub_key, pop) = generate_finalizer_key().unwrap();
        assert!(pub_key.starts_with("PUB_BLS_"));
        assert!(pop.starts_with("SIG_BLS_"));
        assert_eq!(sk.len(), 32);
    }

    #[test]
    fn proof_of_possession_roundtrip() {
        let (sk, pub_key1, pop1) = generate_finalizer_key().unwrap();
        let (pub_key2, pop2) = proof_of_possession(&sk).unwrap();
        assert_eq!(pub_key1, pub_key2);
        assert_eq!(pop1, pop2);
    }

    #[test]
    fn different_keys_are_unique() {
        let (_, pk1, _) = generate_finalizer_key().unwrap();
        let (_, pk2, _) = generate_finalizer_key().unwrap();
        assert_ne!(pk1, pk2);
    }
}
