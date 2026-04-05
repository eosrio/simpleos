use k256::ecdsa::hazmat::SignPrimitive;
use k256::ecdsa::{Signature, SigningKey};
use k256::elliptic_curve::generic_array::GenericArray;
use k256::{NonZeroScalar, Scalar};
use ripemd::Ripemd160;
use sha2::{Digest, Sha256};
use zeroize::Zeroize;

use crate::error::Error;

/// Maximum attempts to grind an RFC 6979 signature into Antelope-canonical form.
/// Each attempt has ~25% chance of being canonical, so 100 iterations gives us
/// a failure probability of (0.75)^100 ≈ 3.2e-13.
const CANONICAL_GRIND_MAX_ATTEMPTS: u32 = 100;

/// Generate a new secp256k1 keypair.
/// Returns (WIF private key string, "EOS..." public key string).
pub fn generate_keypair() -> Result<(String, String), Error> {
    let signing_key = SigningKey::random(&mut rand::thread_rng());
    let private_bytes = signing_key.to_bytes();

    let verifying_key = signing_key.verifying_key();
    let compressed = verifying_key.to_encoded_point(true);
    let pub_bytes = compressed.as_bytes();

    let wif = wif_encode(&private_bytes);
    let pub_key = encode_eos_public_key(pub_bytes);

    Ok((wif, pub_key))
}

/// Encode raw private key bytes as a WIF string.
pub fn wif_encode(private_key: &[u8]) -> String {
    // WIF format: 0x80 + 32 private key bytes + 4-byte checksum
    let mut payload = Vec::with_capacity(34);
    payload.push(0x80);
    payload.extend_from_slice(private_key);

    let hash1 = Sha256::digest(&payload);
    let hash2 = Sha256::digest(&hash1);
    payload.extend_from_slice(&hash2[..4]);

    bs58_encode(&payload)
}

/// Encode raw private key bytes as PVT_K1_ format.
pub fn encode_pvt_k1(private_key: &[u8]) -> String {
    let mut check_buf = private_key.to_vec();
    check_buf.extend_from_slice(b"K1");
    let checksum = ripemd160(&check_buf);

    let mut data = private_key.to_vec();
    data.extend_from_slice(&checksum[..4]);
    format!("PVT_K1_{}", bs58_encode(&data))
}

/// Sign a serialized transaction for an Antelope chain.
///
/// Produces the signing digest: SHA256(chain_id_bytes + serialized_transaction + 32_zero_bytes)
/// Then signs with secp256k1 ECDSA and returns the signature in `SIG_K1_...` format.
///
/// Antelope requires signatures to be "canonical" — both `r` and `s` field-element
/// bytes must have the high bit (0x80) clear in their MSB. k256 already normalizes
/// `s` to the low form, but `r` comes from the random nonce `k` and needs to be
/// ground by varying RFC 6979's additional data until both components are canonical.
pub fn sign_transaction(
    chain_id_hex: &str,
    serialized_transaction: &[u8],
    private_key_bytes: &[u8],
) -> Result<String, Error> {
    let chain_id_bytes = hex_decode(chain_id_hex)
        .map_err(|e| Error::Signing(format!("Invalid chain_id hex: {}", e)))?;

    let mut hasher = Sha256::new();
    hasher.update(&chain_id_bytes);
    hasher.update(serialized_transaction);
    hasher.update(&[0u8; 32]);
    let digest = hasher.finalize();

    // Parse private key as a non-zero scalar for low-level signing API.
    if private_key_bytes.len() != 32 {
        return Err(Error::Signing("Private key must be 32 bytes".into()));
    }
    let priv_array = GenericArray::from_slice(private_key_bytes);
    let priv_scalar = NonZeroScalar::from_repr(*priv_array)
        .into_option()
        .ok_or_else(|| Error::Signing("Invalid private key scalar".into()))?;
    let scalar: Scalar = *priv_scalar.as_ref();

    // Grind until the signature is Antelope-canonical. RFC 6979 is deterministic
    // per (priv_key, digest, additional_data), so we vary `ad` each iteration.
    for attempt in 0u32..CANONICAL_GRIND_MAX_ATTEMPTS {
        let ad = attempt.to_le_bytes();
        let (signature, recovery_id) = scalar
            .try_sign_prehashed_rfc6979::<Sha256>(&digest, &ad)
            .map_err(|e| Error::Signing(format!("Signing failed: {}", e)))?;

        let recid = recovery_id.ok_or_else(|| {
            Error::Signing("No recovery id produced".into())
        })?;

        if is_canonical(&signature) {
            return encode_k1_signature(&signature, recid);
        }
    }

    Err(Error::Signing(format!(
        "Could not produce canonical signature after {} attempts",
        CANONICAL_GRIND_MAX_ATTEMPTS
    )))
}

/// Check that both `r` and `s` components have the high bit clear in their
/// most-significant byte. This is the Antelope `is_canonical` rule — stricter
/// than BIP-0062 low-S because it also applies to `r`.
fn is_canonical(signature: &Signature) -> bool {
    let r = signature.r().to_bytes();
    let s = signature.s().to_bytes();
    // High bit of first byte must be clear for both components.
    (r[0] & 0x80) == 0 && (s[0] & 0x80) == 0
}

/// Derive the public key from a private key string.
/// Supports both legacy WIF format (`5K...`) and modern Antelope format (`PVT_K1_...`).
/// Returns (raw_private_key_bytes, "EOS..." or "PUB_K1_..." public key string).
pub fn public_key_from_wif(key: &str) -> Result<(Vec<u8>, String), Error> {
    let key = key.trim();

    let private_key_bytes = if key.starts_with("PVT_K1_") {
        pvt_k1_decode(key)?
    } else {
        let mut decoded = wif_decode(key)?;
        let bytes = decoded[1..33].to_vec();
        decoded.zeroize();
        bytes
    };

    let signing_key = SigningKey::from_bytes((&private_key_bytes[..]).into())
        .map_err(|e| Error::Signing(format!("Invalid private key: {}", e)))?;

    let verifying_key = signing_key.verifying_key();
    let compressed = verifying_key.to_encoded_point(true);
    let pub_bytes = compressed.as_bytes().to_vec();

    // Return PUB_K1_ format for modern keys, EOS format for legacy
    let pub_key_str = if key.starts_with("PVT_K1_") {
        encode_k1_public_key(&pub_bytes)
    } else {
        encode_eos_public_key(&pub_bytes)
    };

    Ok((private_key_bytes, pub_key_str))
}

/// Decode a `PVT_K1_...` private key.
/// Format: PVT_K1_ + base58(32_bytes_privkey + ripemd160(privkey + "K1")[0..4])
fn pvt_k1_decode(key: &str) -> Result<Vec<u8>, Error> {
    let encoded = key
        .strip_prefix("PVT_K1_")
        .ok_or_else(|| Error::Signing("Not a PVT_K1_ key".into()))?;

    let decoded = bs58_decode(encoded)
        .map_err(|e| Error::Signing(format!("Invalid PVT_K1_ base58: {}", e)))?;

    if decoded.len() < 36 {
        return Err(Error::Signing("PVT_K1_ key too short".into()));
    }

    let key_bytes = &decoded[..32];
    let checksum = &decoded[32..36];

    // Verify RIPEMD160 checksum: ripemd160(key_bytes + "K1")[0..4]
    let mut check_buf = key_bytes.to_vec();
    check_buf.extend_from_slice(b"K1");
    let hash = ripemd160(&check_buf);

    if &hash[..4] != checksum {
        return Err(Error::Signing("PVT_K1_ checksum mismatch".into()));
    }

    Ok(key_bytes.to_vec())
}

/// Encode a public key in `PUB_K1_...` format.
fn encode_k1_public_key(compressed_pub: &[u8]) -> String {
    let mut check_buf = compressed_pub.to_vec();
    check_buf.extend_from_slice(b"K1");
    let checksum = ripemd160(&check_buf);

    let mut data = compressed_pub.to_vec();
    data.extend_from_slice(&checksum[..4]);
    format!("PUB_K1_{}", bs58_encode(&data))
}

// ── RIPEMD160 + Encoding helpers ──

pub fn ripemd160(data: &[u8]) -> [u8; 20] {
    let mut hasher = Ripemd160::new();
    hasher.update(data);
    let result = hasher.finalize();
    let mut out = [0u8; 20];
    out.copy_from_slice(&result);
    out
}

fn encode_k1_signature(signature: &Signature, recovery_id: k256::ecdsa::RecoveryId) -> Result<String, Error> {
    let r = signature.r().to_bytes();
    let s = signature.s().to_bytes();

    let mut sig_data = Vec::with_capacity(65);
    sig_data.push(recovery_id.to_byte() + 27 + 4); // compressed flag
    sig_data.extend_from_slice(&r);
    sig_data.extend_from_slice(&s);

    // RIPEMD160 checksum with "K1" suffix
    let mut check_buf = sig_data.clone();
    check_buf.extend_from_slice(b"K1");
    let checksum = ripemd160(&check_buf);

    sig_data.extend_from_slice(&checksum[..4]);

    Ok(format!("SIG_K1_{}", bs58_encode(&sig_data)))
}

/// Encode compressed public key bytes as an EOS public key string.
pub fn encode_eos_public_key_from_bytes(compressed_pub: &[u8]) -> String {
    encode_eos_public_key(compressed_pub)
}

/// Encode compressed public key bytes as a PUB_K1_ key string.
pub fn encode_k1_public_key_from_bytes(compressed_pub: &[u8]) -> String {
    encode_k1_public_key(compressed_pub)
}

fn encode_eos_public_key(compressed_pub: &[u8]) -> String {
    let checksum = ripemd160(compressed_pub);
    let mut data = compressed_pub.to_vec();
    data.extend_from_slice(&checksum[..4]);
    format!("EOS{}", bs58_encode(&data))
}

fn wif_decode(wif: &str) -> Result<Vec<u8>, Error> {
    let decoded = bs58_decode(wif)
        .map_err(|e| Error::Signing(format!("Invalid WIF: {}", e)))?;

    if decoded.len() < 37 {
        return Err(Error::Signing("WIF too short".into()));
    }

    // Verify checksum (last 4 bytes)
    let payload = &decoded[..decoded.len() - 4];
    let checksum = &decoded[decoded.len() - 4..];

    let hash1 = Sha256::digest(payload);
    let hash2 = Sha256::digest(&hash1);

    if &hash2[..4] != checksum {
        return Err(Error::Signing("WIF checksum mismatch".into()));
    }

    Ok(payload.to_vec())
}

fn hex_decode(hex: &str) -> Result<Vec<u8>, String> {
    if hex.len() % 2 != 0 {
        return Err("Odd-length hex string".into());
    }
    (0..hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).map_err(|e| e.to_string()))
        .collect()
}

// ── Base58 (no external crate) ──

const BASE58_CHARS: &[u8] = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

pub fn bs58_encode(data: &[u8]) -> String {
    let mut digits: Vec<u32> = vec![0];
    for &byte in data {
        let mut carry = byte as u32;
        for d in digits.iter_mut() {
            carry += *d * 256;
            *d = carry % 58;
            carry /= 58;
        }
        while carry > 0 {
            digits.push(carry % 58);
            carry /= 58;
        }
    }
    // Leading zeros
    for &byte in data {
        if byte == 0 {
            digits.push(0);
        } else {
            break;
        }
    }
    digits.reverse();
    digits.iter().map(|&d| BASE58_CHARS[d as usize] as char).collect()
}

fn bs58_decode(input: &str) -> Result<Vec<u8>, String> {
    let mut digits: Vec<u32> = vec![0];
    for c in input.bytes() {
        let val = match BASE58_CHARS.iter().position(|&b| b == c) {
            Some(v) => v as u32,
            None => return Err(format!("Invalid base58 character: {}", c as char)),
        };
        let mut carry = val;
        for d in digits.iter_mut() {
            carry += *d * 58;
            *d = carry % 256;
            carry /= 256;
        }
        while carry > 0 {
            digits.push(carry % 256);
            carry /= 256;
        }
    }
    // Leading '1's
    for c in input.bytes() {
        if c == b'1' {
            digits.push(0);
        } else {
            break;
        }
    }
    digits.reverse();
    Ok(digits.iter().map(|&d| d as u8).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wif_to_public_key() {
        // Well-known EOS test key pair
        let wif = "5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3";
        let expected_pub = "EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV";

        let (priv_bytes, pub_key) = public_key_from_wif(wif).unwrap();
        assert_eq!(pub_key, expected_pub);
        assert_eq!(priv_bytes.len(), 32);
    }

    #[test]
    fn wif_invalid_checksum() {
        let bad_wif = "5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD4"; // last char changed
        let result = public_key_from_wif(bad_wif);
        assert!(result.is_err());
    }

    #[test]
    fn wif_too_short() {
        let result = public_key_from_wif("5K");
        assert!(result.is_err());
    }

    #[test]
    fn generate_and_reimport() {
        let (wif, pub_key) = generate_keypair().unwrap();
        assert!(wif.starts_with("5"));
        assert!(pub_key.starts_with("EOS"));

        // Re-import the WIF and verify we get the same public key
        let (_priv_bytes, reimported_pub) = public_key_from_wif(&wif).unwrap();
        assert_eq!(pub_key, reimported_pub);
    }

    #[test]
    fn wif_encode_decode_roundtrip() {
        let wif = "5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3";
        let (priv_bytes, _pub_key) = public_key_from_wif(wif).unwrap();
        let re_encoded = wif_encode(&priv_bytes);
        assert_eq!(wif, re_encoded);
    }

    #[test]
    fn wif_empty_string() {
        assert!(public_key_from_wif("").is_err());
    }

    #[test]
    fn wif_invalid_base58_chars() {
        // 'O', 'I', 'l', '0' are not in base58
        assert!(public_key_from_wif("5OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO").is_err());
    }

    #[test]
    fn generate_multiple_keys_are_distinct() {
        let (wif1, pub1) = generate_keypair().unwrap();
        let (wif2, pub2) = generate_keypair().unwrap();
        assert_ne!(wif1, wif2);
        assert_ne!(pub1, pub2);
    }

    #[test]
    fn sign_deterministic_for_same_input() {
        let wif = "5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3";
        let (priv_bytes, _) = public_key_from_wif(wif).unwrap();
        let chain_id = "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906";
        let tx = [1u8; 64];

        let sig1 = sign_transaction(chain_id, &tx, &priv_bytes).unwrap();
        let sig2 = sign_transaction(chain_id, &tx, &priv_bytes).unwrap();

        // ECDSA with k256 uses RFC 6979 deterministic nonce. The canonical-grind
        // loop also must be deterministic per (priv_key, digest), so this holds
        // even when grinding kicks in.
        assert_eq!(sig1, sig2);
    }

    /// Regression test for the canonical-signature bug: prior to the fix,
    /// sign_transaction could emit signatures where the high bit of `r` or `s`
    /// was set, which Antelope's `is_canonical` check rejects with a 500 error.
    /// We test with 32 different transaction bodies to hit the ~75% of inputs
    /// that require at least one grind iteration.
    #[test]
    fn sign_always_produces_canonical_signatures() {
        use k256::ecdsa::Signature as K256Sig;
        let (priv_bytes, _) = public_key_from_wif(
            "5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3",
        )
        .unwrap();
        let chain_id = "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906";

        for i in 0u8..32 {
            let tx = [i; 64];
            let sig_str = sign_transaction(chain_id, &tx, &priv_bytes).unwrap();
            assert!(sig_str.starts_with("SIG_K1_"), "iter {}: must have prefix", i);

            // Decode the SIG_K1_ string back to raw bytes to verify canonicality
            let encoded = sig_str.strip_prefix("SIG_K1_").unwrap();
            let decoded = bs58_decode(encoded).unwrap();
            // Layout: 1-byte recovery + 32-byte r + 32-byte s + 4-byte checksum
            assert!(decoded.len() >= 65, "iter {}: decoded len {}", i, decoded.len());
            let r_byte = decoded[1];
            let s_byte = decoded[33];
            assert_eq!(
                r_byte & 0x80,
                0,
                "iter {}: r high bit set (non-canonical): r[0]={:02x}",
                i,
                r_byte
            );
            assert_eq!(
                s_byte & 0x80,
                0,
                "iter {}: s high bit set (non-canonical): s[0]={:02x}",
                i,
                s_byte
            );

            // Also verify via k256's own canonical check
            let r_bytes = &decoded[1..33];
            let s_bytes = &decoded[33..65];
            let mut rs = [0u8; 64];
            rs[..32].copy_from_slice(r_bytes);
            rs[32..].copy_from_slice(s_bytes);
            let parsed = K256Sig::from_slice(&rs).unwrap();
            assert!(
                super::is_canonical(&parsed),
                "iter {}: k256 view says non-canonical",
                i
            );
        }
    }

    #[test]
    fn sign_different_tx_produces_different_sig() {
        let wif = "5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3";
        let (priv_bytes, _) = public_key_from_wif(wif).unwrap();
        let chain_id = "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906";

        let sig1 = sign_transaction(chain_id, &[0u8; 32], &priv_bytes).unwrap();
        let sig2 = sign_transaction(chain_id, &[1u8; 32], &priv_bytes).unwrap();
        assert_ne!(sig1, sig2);
    }

    #[test]
    fn sign_different_chain_produces_different_sig() {
        let wif = "5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3";
        let (priv_bytes, _) = public_key_from_wif(wif).unwrap();
        let tx = [0u8; 32];

        let sig1 = sign_transaction(
            "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906",
            &tx, &priv_bytes,
        ).unwrap();
        let sig2 = sign_transaction(
            "1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4",
            &tx, &priv_bytes,
        ).unwrap();
        assert_ne!(sig1, sig2);
    }

    #[test]
    fn sign_invalid_chain_id_hex() {
        let (priv_bytes, _) = public_key_from_wif(
            "5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3",
        ).unwrap();
        let result = sign_transaction("not-hex", &[0u8; 32], &priv_bytes);
        assert!(result.is_err());
    }

    #[test]
    fn encode_public_key_from_bytes_matches() {
        let wif = "5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3";
        let (_, pub_key) = public_key_from_wif(wif).unwrap();

        // Re-derive manually
        let signing_key = SigningKey::from_bytes(
            (&public_key_from_wif(wif).unwrap().0[..]).into()
        ).unwrap();
        let compressed = signing_key.verifying_key().to_encoded_point(true);
        let derived = encode_eos_public_key_from_bytes(compressed.as_bytes());

        assert_eq!(pub_key, derived);
    }

    // ── PVT_K1_ format tests ──

    #[test]
    fn pvt_k1_and_wif_produce_same_private_key() {
        // The well-known test key in both formats
        let wif = "5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3";
        let (wif_priv, _) = public_key_from_wif(wif).unwrap();

        // Encode the same private key as PVT_K1_ and decode it back
        let pvt_k1 = encode_pvt_k1(&wif_priv);
        let (pvt_priv, _) = public_key_from_wif(&pvt_k1).unwrap();

        assert_eq!(wif_priv, pvt_priv);
    }

    #[test]
    fn pvt_k1_produces_pub_k1_format() {
        let wif = "5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3";
        let (priv_bytes, _) = public_key_from_wif(wif).unwrap();

        let pvt_k1 = encode_pvt_k1(&priv_bytes);
        let (_, pub_key) = public_key_from_wif(&pvt_k1).unwrap();

        assert!(pub_key.starts_with("PUB_K1_"));
    }

    #[test]
    fn pvt_k1_invalid_checksum() {
        // Tamper with a valid PVT_K1_ key
        let wif = "5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3";
        let (priv_bytes, _) = public_key_from_wif(wif).unwrap();
        let mut pvt = encode_pvt_k1(&priv_bytes);
        // Change last char
        pvt.pop();
        pvt.push('X');
        assert!(public_key_from_wif(&pvt).is_err());
    }

    #[test]
    fn pvt_k1_too_short() {
        assert!(public_key_from_wif("PVT_K1_abc").is_err());
    }

    #[test]
    fn pvt_k1_roundtrip_sign() {
        let wif = "5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3";
        let (priv_bytes, _) = public_key_from_wif(wif).unwrap();
        let pvt_k1 = encode_pvt_k1(&priv_bytes);

        let (decoded_priv, _) = public_key_from_wif(&pvt_k1).unwrap();
        let chain_id = "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906";
        let sig = sign_transaction(chain_id, &[0u8; 32], &decoded_priv).unwrap();
        assert!(sig.starts_with("SIG_K1_"));
    }

    /// Helper: encode raw private key bytes as PVT_K1_ format.
    fn encode_pvt_k1(private_key: &[u8]) -> String {
        let mut check_buf = private_key.to_vec();
        check_buf.extend_from_slice(b"K1");
        let checksum = ripemd160(&check_buf);

        let mut data = private_key.to_vec();
        data.extend_from_slice(&checksum[..4]);
        format!("PVT_K1_{}", bs58_encode(&data))
    }
}
