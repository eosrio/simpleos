use k256::ecdsa::{Signature, SigningKey};
use ripemd::Ripemd160;
use sha2::{Digest, Sha256};
use zeroize::Zeroize;

use crate::error::Error;

/// Sign a serialized transaction for an Antelope chain.
///
/// Produces the signing digest: SHA256(chain_id_bytes + serialized_transaction + 32_zero_bytes)
/// Then signs with secp256k1 ECDSA and returns the signature in `SIG_K1_...` format.
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

    let signing_key = SigningKey::from_bytes(private_key_bytes.into())
        .map_err(|e| Error::Signing(format!("Invalid private key: {}", e)))?;

    let (signature, recovery_id) = signing_key
        .sign_prehash_recoverable(&digest)
        .map_err(|e| Error::Signing(format!("Signing failed: {}", e)))?;

    encode_k1_signature(&signature, recovery_id)
}

/// Derive the public key (EOS format) from a WIF private key.
/// Returns (raw_private_key_bytes, "EOS..." public key string).
pub fn public_key_from_wif(wif: &str) -> Result<(Vec<u8>, String), Error> {
    let mut decoded = wif_decode(wif)?;
    let private_key_bytes = &decoded[1..33];

    let signing_key = SigningKey::from_bytes(private_key_bytes.into())
        .map_err(|e| Error::Signing(format!("Invalid private key: {}", e)))?;

    let verifying_key = signing_key.verifying_key();
    let compressed = verifying_key.to_encoded_point(true);
    let pub_bytes = compressed.as_bytes().to_vec();

    let pub_key_str = encode_eos_public_key(&pub_bytes);

    let priv_bytes = private_key_bytes.to_vec();
    decoded.zeroize();

    Ok((priv_bytes, pub_key_str))
}

// ── RIPEMD160 + Encoding helpers ──

fn ripemd160(data: &[u8]) -> [u8; 20] {
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

fn bs58_encode(data: &[u8]) -> String {
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
}
