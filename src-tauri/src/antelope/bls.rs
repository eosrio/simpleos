//! BLS12-381 key management for Savannah Instant Finality.
//!
//! Antelope uses BLS12-381 min_pk variant (public keys on G1, signatures on G2)
//! with affine little-endian non-Montgomery serialization.
//!
//! String encoding mirrors leap/spring's `fc::crypto::blslib::serialize_base64url`:
//!   base64url_nopad( raw_bytes || ripemd160(raw_bytes)[0..4] )
//! FC_REFLECT order is `(data)(check)`, so raw bytes come first, 4-byte checksum last.

use crate::error::Error;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use ripemd::{Digest, Ripemd160};

const POP_DST: &[u8] = b"BLS_POP_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_";

/// Wrap raw bytes with the 4-byte RIPEMD160 checksum and base64url-encode.
fn encode_checksummed(raw: &[u8]) -> String {
    let mut buf = Vec::with_capacity(raw.len() + 4);
    buf.extend_from_slice(raw);
    let hash = Ripemd160::digest(raw);
    buf.extend_from_slice(&hash[..4]);
    URL_SAFE_NO_PAD.encode(&buf)
}

/// Generate a BLS12-381 keypair and proof of possession.
///
/// Returns (private_key_bytes, PUB_BLS_..., SIG_BLS_..., PVT_BLS_...).
/// `private_key_bytes` is 32 bytes in blst/IETF big-endian format (what we store).
pub fn generate_finalizer_key() -> Result<(Vec<u8>, String, String, String), Error> {
    let ikm: [u8; 32] = rand::random();
    let sk = blst::min_pk::SecretKey::key_gen(&ikm, &[])
        .map_err(|e| Error::Signing(format!("BLS key_gen failed: {:?}", e)))?;

    let pk = sk.sk_to_pk();
    let pk_bytes = pk.serialize(); // 96 bytes uncompressed BE
    let pk_le = be_to_le_g1(&pk_bytes);

    // Proof of possession: sign the LE public key bytes with the PoP DST
    let pop_sig = sk.sign(&pk_le, POP_DST, &[]);
    let pop_bytes = pop_sig.serialize(); // 192 bytes uncompressed BE
    let pop_le = be_to_le_g2(&pop_bytes);

    // blst::SecretKey::to_bytes() returns 32 bytes big-endian (IETF canonical).
    // Leap stores _sk as `std::array<uint64_t, 4>` and memcpys on LE hosts, so
    // its serialized bytes are little-endian. Reverse to match.
    let sk_be = sk.to_bytes(); // 32 bytes BE
    let mut sk_le = [0u8; 32];
    for i in 0..32 {
        sk_le[i] = sk_be[31 - i];
    }

    let pub_key_str = format!("PUB_BLS_{}", encode_checksummed(&pk_le));
    let pop_str = format!("SIG_BLS_{}", encode_checksummed(&pop_le));
    let priv_key_str = format!("PVT_BLS_{}", encode_checksummed(&sk_le));

    Ok((sk_be.to_vec(), pub_key_str, pop_str, priv_key_str))
}

/// Regenerate the proof of possession for an existing private key.
/// `sk_bytes` is expected in the same format we stored: 32 bytes big-endian (blst::to_bytes).
pub fn proof_of_possession(sk_bytes: &[u8]) -> Result<(String, String), Error> {
    let sk = blst::min_pk::SecretKey::from_bytes(sk_bytes)
        .map_err(|e| Error::Signing(format!("Invalid BLS private key: {:?}", e)))?;

    let pk = sk.sk_to_pk();
    let pk_bytes = pk.serialize();
    let pk_le = be_to_le_g1(&pk_bytes);

    let pop_sig = sk.sign(&pk_le, POP_DST, &[]);
    let pop_bytes = pop_sig.serialize();
    let pop_le = be_to_le_g2(&pop_bytes);

    let pub_key_str = format!("PUB_BLS_{}", encode_checksummed(&pk_le));
    let pop_str = format!("SIG_BLS_{}", encode_checksummed(&pop_le));

    Ok((pub_key_str, pop_str))
}

/// Encode a stored blst private key (32 bytes BE) as `PVT_BLS_...`.
pub fn encode_private_key(sk_bytes: &[u8]) -> Result<String, Error> {
    if sk_bytes.len() != 32 {
        return Err(Error::Signing(format!(
            "BLS private key must be 32 bytes, got {}",
            sk_bytes.len()
        )));
    }
    let mut sk_le = [0u8; 32];
    for i in 0..32 {
        sk_le[i] = sk_bytes[31 - i];
    }
    Ok(format!("PVT_BLS_{}", encode_checksummed(&sk_le)))
}

/// Convert a 96-byte G1 point from big-endian to little-endian (two 48-byte field elements).
fn be_to_le_g1(be: &[u8]) -> Vec<u8> {
    let mut le = vec![0u8; 96];
    for i in 0..48 {
        le[i] = be[47 - i];
        le[48 + i] = be[95 - i];
    }
    le
}

/// Convert a 192-byte G2 point from blst's uncompressed big-endian form
/// to Antelope/leap's `toAffineBytesLE` form.
///
/// blst (IETF) layout BE: `[x.c1][x.c0][y.c1][y.c0]` — imaginary part first.
/// leap   layout    LE: `[x.c0][x.c1][y.c0][y.c1]` — real part first.
///
/// So we both reverse each 48-byte field element AND swap c0/c1 within each fp2.
fn be_to_le_g2(be: &[u8]) -> Vec<u8> {
    let mut le = vec![0u8; 192];
    let copy_reversed = |le: &mut [u8], dst: usize, src: usize| {
        for i in 0..48 {
            le[dst + i] = be[src + 47 - i];
        }
    };
    // x.c0 ← blst chunk 1 ; x.c1 ← blst chunk 0
    copy_reversed(&mut le, 0, 48);
    copy_reversed(&mut le, 48, 0);
    // y.c0 ← blst chunk 3 ; y.c1 ← blst chunk 2
    copy_reversed(&mut le, 96, 144);
    copy_reversed(&mut le, 144, 96);
    le
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_key_produces_valid_format() {
        let (sk, pub_key, pop, priv_key) = generate_finalizer_key().unwrap();
        assert!(pub_key.starts_with("PUB_BLS_"));
        assert!(pop.starts_with("SIG_BLS_"));
        assert!(priv_key.starts_with("PVT_BLS_"));
        assert_eq!(sk.len(), 32);
    }

    #[test]
    fn proof_of_possession_roundtrip() {
        let (sk, pub_key1, pop1, _) = generate_finalizer_key().unwrap();
        let (pub_key2, pop2) = proof_of_possession(&sk).unwrap();
        assert_eq!(pub_key1, pub_key2);
        assert_eq!(pop1, pop2);
    }

    #[test]
    fn different_keys_are_unique() {
        let (_, pk1, _, _) = generate_finalizer_key().unwrap();
        let (_, pk2, _, _) = generate_finalizer_key().unwrap();
        assert_ne!(pk1, pk2);
    }

    #[test]
    fn encoded_pubkey_length_matches_leap() {
        // 96 data bytes + 4 checksum = 100 bytes → base64url no-pad length = ceil(100 * 4 / 3) = 134
        let (_, pk, _, _) = generate_finalizer_key().unwrap();
        let body = pk.strip_prefix("PUB_BLS_").unwrap();
        assert_eq!(body.len(), 134);
    }

    #[test]
    fn encoded_privkey_length_matches_leap() {
        // 32 + 4 = 36 bytes → base64url no-pad = 48
        let (_, _, _, priv_key) = generate_finalizer_key().unwrap();
        let body = priv_key.strip_prefix("PVT_BLS_").unwrap();
        assert_eq!(body.len(), 48);
    }

    #[test]
    fn encoded_sig_length_matches_leap() {
        // 192 + 4 = 196 → base64url no-pad = ceil(196 * 4 / 3) = 262
        let (_, _, pop, _) = generate_finalizer_key().unwrap();
        let body = pop.strip_prefix("SIG_BLS_").unwrap();
        assert_eq!(body.len(), 262);
    }

    /// G1 LE conversion must be bijective — reversing it recovers blst's BE bytes.
    #[test]
    fn g1_le_roundtrip() {
        let (sk_bytes, _, _, _) = generate_finalizer_key().unwrap();
        let sk = blst::min_pk::SecretKey::from_bytes(&sk_bytes).unwrap();
        let pk_be = sk.sk_to_pk().serialize();
        let pk_le = be_to_le_g1(&pk_be);
        // Reversing each 48-byte chunk back should recover BE
        let roundtrip = be_to_le_g1(&pk_le);
        assert_eq!(&roundtrip[..], &pk_be[..]);
    }

    /// Our encoded PoP must verify against our encoded pubkey using blst
    /// (reconstructing BE bytes from our LE output and cross-checking).
    #[test]
    fn pop_verifies_with_blst() {
        let (sk_bytes, _, _, _) = generate_finalizer_key().unwrap();
        let sk = blst::min_pk::SecretKey::from_bytes(&sk_bytes).unwrap();
        let pk = sk.sk_to_pk();

        // Regenerate pk_le and pop_le through our pipeline, then verify
        let pk_le = be_to_le_g1(&pk.serialize());
        let pop_sig = sk.sign(&pk_le, POP_DST, &[]);
        let pop_le = be_to_le_g2(&pop_sig.serialize());

        // Reconstruct BE from our LE to feed back to blst for verification
        let pop_be = le_g2_to_be(&pop_le);
        let sig_rebuilt = blst::min_pk::Signature::deserialize(&pop_be).unwrap();

        let ok = sig_rebuilt.verify(true, &pk_le, POP_DST, &[], &pk, true);
        assert_eq!(ok, blst::BLST_ERROR::BLST_SUCCESS);
    }

    fn le_g2_to_be(le: &[u8]) -> Vec<u8> {
        // Inverse of be_to_le_g2: blst BE = [x.c1][x.c0][y.c1][y.c0]; leap LE = [x.c0][x.c1][y.c0][y.c1].
        let mut be = vec![0u8; 192];
        let copy_reversed = |be: &mut [u8], dst: usize, src: usize| {
            for i in 0..48 {
                be[dst + i] = le[src + 47 - i];
            }
        };
        copy_reversed(&mut be, 0, 48);   // x.c1 ← leap chunk 1
        copy_reversed(&mut be, 48, 0);   // x.c0 ← leap chunk 0
        copy_reversed(&mut be, 96, 144); // y.c1 ← leap chunk 3
        copy_reversed(&mut be, 144, 96); // y.c0 ← leap chunk 2
        be
    }
}
