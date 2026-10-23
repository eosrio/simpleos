use k256::ecdsa::{RecoveryId, Signature, SigningKey, VerifyingKey};
use k256::elliptic_curve::sec1::ToSec1Point;
use k256::elliptic_curve::Generate;
use k256::PublicKey;
use ripemd::Ripemd160;
use sha2::{Digest, Sha256};
use sha3::Keccak256;
use zeroize::Zeroize;

use crate::error::Error;

/// Antelope / Wire public key & signature variant type tags on the wire.
pub const KEY_TYPE_K1: u8 = 0;
pub const KEY_TYPE_R1: u8 = 1;
pub const KEY_TYPE_WA: u8 = 2;
pub const KEY_TYPE_EM: u8 = 3;

/// Maximum attempts to grind an RFC 6979 signature into Antelope-canonical form.
/// Each attempt has ~25% chance of being canonical, so 100 iterations gives us
/// a failure probability of (0.75)^100 ≈ 3.2e-13.
const CANONICAL_GRIND_MAX_ATTEMPTS: u32 = 100;

/// Generate a new secp256k1 keypair.
/// Returns (WIF private key string, "EOS..." public key string).
pub fn generate_keypair() -> Result<(String, String), Error> {
    // Entropy comes straight from the OS CSPRNG via the audited crate::rng
    // helper; k256 rejection-samples a valid non-zero scalar internally.
    let signing_key = SigningKey::generate_from_rng(&mut crate::rng::secure_rng());
    let mut private_bytes = signing_key.to_bytes();

    let verifying_key = signing_key.verifying_key();
    let compressed = verifying_key.to_sec1_point(true);
    let pub_bytes = compressed.as_bytes();

    let wif = wif_encode(&private_bytes);
    let pub_key = encode_eos_public_key(pub_bytes);

    // Wipe the transient copy of the secret scalar. The returned WIF still
    // carries it (that is the caller's to handle), and `signing_key` zeroizes
    // on drop, but this stack buffer would otherwise linger.
    private_bytes.as_mut_slice().zeroize();
    Ok((wif, pub_key))
}

/// Generate a new secp256k1 keypair, returning raw bytes.
/// Returns (32-byte private key, 33-byte compressed public key).
pub fn generate_keypair_raw() -> Result<([u8; 32], Vec<u8>), Error> {
    let signing_key = SigningKey::generate_from_rng(&mut crate::rng::secure_rng());
    let mut sk_bytes = signing_key.to_bytes();
    let mut private_bytes = [0u8; 32];
    private_bytes.copy_from_slice(&sk_bytes);
    sk_bytes.as_mut_slice().zeroize();

    let verifying_key = signing_key.verifying_key();
    let compressed = verifying_key.to_sec1_point(true);
    let pub_bytes = compressed.as_bytes().to_vec();

    Ok((private_bytes, pub_bytes))
}

/// Compute the ECDH shared secret between our private key and their compressed public key.
/// Returns the raw 32-byte x-coordinate of the shared point.
pub fn ecdh_shared_secret(
    our_private: &[u8],
    their_public_compressed: &[u8],
) -> Result<[u8; 32], Error> {
    if our_private.len() != 32 {
        return Err(Error::Signing("Private key must be 32 bytes".into()));
    }

    let secret_scalar = k256::SecretKey::from_slice(our_private)
        .map_err(|e| Error::Signing(format!("Invalid private key: {}", e)))?;

    let their_pk = PublicKey::from_sec1_bytes(their_public_compressed)
        .map_err(|_| Error::Signing("Invalid public key point".into()))?;

    let shared = k256::ecdh::diffie_hellman(secret_scalar.to_nonzero_scalar(), their_pk.as_affine());
    let mut out = [0u8; 32];
    out.copy_from_slice(shared.raw_secret_bytes());
    Ok(out)
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

/// Compute the 32-byte Antelope / Wire signing digest:
/// `SHA256(chain_id_bytes(32) || serialized_transaction || 32_zero_bytes)`
pub fn compute_signing_digest(
    chain_id_hex: &str,
    serialized_transaction: &[u8],
) -> Result<[u8; 32], Error> {
    let chain_id_bytes = hex_decode(chain_id_hex)
        .map_err(|e| Error::Signing(format!("Invalid chain_id hex: {}", e)))?;
    if chain_id_bytes.len() != 32 {
        return Err(Error::Signing(format!(
            "chain_id must be 32 bytes, got {}",
            chain_id_bytes.len()
        )));
    }

    let mut hasher = Sha256::new();
    hasher.update(&chain_id_bytes);
    hasher.update(serialized_transaction);
    hasher.update([0u8; 32]);
    let digest = hasher.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&digest);
    Ok(out)
}

/// Compute the EIP-191 personal_sign digest over a 32-byte raw signing digest:
/// `keccak256("\x19Ethereum Signed Message:\n32" || signing_digest)`
pub fn eip191_digest32(signing_digest: &[u8; 32]) -> [u8; 32] {
    let mut hasher = Keccak256::new();
    hasher.update(b"\x19Ethereum Signed Message:\n32");
    hasher.update(signing_digest);
    let result = hasher.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&result);
    out
}

/// Compute the EIP-191 personal_sign digest over an arbitrary byte slice:
/// `keccak256(format!("\x19Ethereum Signed Message:\n{}", msg.len()) || msg)`
pub fn eip191_message_hash(message: &[u8]) -> [u8; 32] {
    let prefix = format!("\x19Ethereum Signed Message:\n{}", message.len());
    let mut hasher = Keccak256::new();
    hasher.update(prefix.as_bytes());
    hasher.update(message);
    let result = hasher.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&result);
    out
}

/// Sign a serialized transaction for an Antelope chain using K1 (`SIG_K1_...`).
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
    let digest = compute_signing_digest(chain_id_hex, serialized_transaction)?;
    sign_prehash_canonical(&digest, private_key_bytes)
}

/// Sign a serialized transaction for a Wire (`sysio`) chain using an EM (Ethereum) key (`SIG_EM_...`)
/// or a K1 key (`SIG_K1_...`), automatically dispatching based on `signer_public_key` prefix.
pub fn sign_transaction_for_key(
    chain_id_hex: &str,
    serialized_transaction: &[u8],
    private_key_bytes: &[u8],
    signer_public_key: &str,
) -> Result<String, Error> {
    if is_em_public_key(signer_public_key) {
        sign_transaction_em(chain_id_hex, serialized_transaction, private_key_bytes)
    } else {
        sign_transaction(chain_id_hex, serialized_transaction, private_key_bytes)
    }
}

/// Sign a serialized transaction for a Wire (`sysio`) chain using an EM (Ethereum) key.
///
/// 1. `signing_digest = sha256(chain_id_bytes(32) || packed_trx || zeros(32))`
/// 2. `eip191_hash = keccak256("\x19Ethereum Signed Message:\n32" || signing_digest)`
/// 3. Sign `eip191_hash` with deterministic RFC 6979 secp256k1 ECDSA (low-S).
/// 4. Format as `SIG_EM_<r(64 hex)><s(64 hex)><v(2 hex)>` where `v ∈ {27, 28}` (`0x1b`/`0x1c`).
pub fn sign_transaction_em(
    chain_id_hex: &str,
    serialized_transaction: &[u8],
    private_key_bytes: &[u8],
) -> Result<String, Error> {
    let signing_digest = compute_signing_digest(chain_id_hex, serialized_transaction)?;
    sign_digest_em(&signing_digest, private_key_bytes)
}

/// Sign a 32-byte Antelope/Wire `signing_digest` with an EM (Ethereum) private key.
/// Applies the EIP-191 32-byte prefix before signing and returns `SIG_EM_<130 lowercase hex>`.
pub fn sign_digest_em(
    signing_digest: &[u8; 32],
    private_key_bytes: &[u8],
) -> Result<String, Error> {
    if private_key_bytes.len() != 32 {
        return Err(Error::Signing("Private key must be 32 bytes".into()));
    }
    let signing_key = SigningKey::from_slice(private_key_bytes)
        .map_err(|e| Error::Signing(format!("Invalid private key: {}", e)))?;

    let eip191_hash = eip191_digest32(signing_digest);
    let (signature, recovery_id) = ecdsa::hazmat::sign_prehashed_rfc6979::<
        k256::Secp256k1,
        k256::sha2::Sha256,
    >(signing_key.as_nonzero_scalar(), &eip191_hash, &[]);

    let r_bytes = signature.r().to_bytes();
    let s_bytes = signature.s().to_bytes();
    let mut r = [0u8; 32];
    let mut s = [0u8; 32];
    r.copy_from_slice(&r_bytes);
    s.copy_from_slice(&s_bytes);
    let v = recovery_id.to_byte() + 27;

    encode_sig_em_from_rsv(&r, &s, v)
}

/// Normalize an Ethereum recovery byte `v` into standard `{27, 28}` (`0x1b` / `0x1c`).
/// Accepts raw `0`/`1`, legacy Ethereum `27`/`28`, or EIP-155 `v >= 35`.
pub fn normalize_eth_v(v: u8) -> Result<u8, Error> {
    match v {
        0 | 1 => Ok(v + 27),
        27 | 28 => Ok(v),
        v if v >= 35 => Ok(27 + ((v - 35) % 2)),
        other => Err(Error::Signing(format!(
            "Invalid Ethereum signature recovery id v={}",
            other
        ))),
    }
}

/// Encode `(r, s, v)` into Wire's canonical `SIG_EM_<130 lowercase hex>` format.
pub fn encode_sig_em_from_rsv(r: &[u8; 32], s: &[u8; 32], v: u8) -> Result<String, Error> {
    let v_norm = normalize_eth_v(v)?;
    Ok(format!(
        "SIG_EM_{}{}{:02x}",
        hex_encode_bytes(r),
        hex_encode_bytes(s),
        v_norm
    ))
}

/// Encode a `SIG_EM_...` string into its 66-byte Wire binary form: `0x03 || r(32) || s(32) || v(1)`.
pub fn serialize_sig_em_wire(sig_em_or_hex: &str) -> Result<Vec<u8>, Error> {
    let (r, s, v) = parse_sig_em_or_hex(sig_em_or_hex)?;
    let mut out = Vec::with_capacity(66);
    out.push(KEY_TYPE_EM);
    out.extend_from_slice(&r);
    out.extend_from_slice(&s);
    out.push(v);
    Ok(out)
}

/// Parse a `SIG_EM_<130 hex>` or `0x<130 hex>` or raw `<130 hex>` Ethereum signature
/// into `(r: [u8; 32], s: [u8; 32], v_normalized_27_28: u8)`.
pub fn parse_sig_em_or_hex(sig: &str) -> Result<([u8; 32], [u8; 32], u8), Error> {
    let trimmed = sig.trim();
    let hex_part = trimmed
        .strip_prefix("SIG_EM_")
        .or_else(|| trimmed.strip_prefix("0x"))
        .or_else(|| trimmed.strip_prefix("0X"))
        .unwrap_or(trimmed);

    if hex_part.len() != 130 {
        return Err(Error::Signing(format!(
            "EM signature must be 65 bytes (130 hex chars), got {} chars",
            hex_part.len()
        )));
    }
    let raw = hex_decode(hex_part)
        .map_err(|e| Error::Signing(format!("Invalid EM signature hex: {}", e)))?;
    let mut r = [0u8; 32];
    let mut s = [0u8; 32];
    r.copy_from_slice(&raw[0..32]);
    s.copy_from_slice(&raw[32..64]);
    let v = normalize_eth_v(raw[64])?;
    Ok((r, s, v))
}

/// Recover the canonical compressed `PUB_EM_<66 lowercase hex>` public key from an
/// EIP-191 32-byte digest and a `SIG_EM_` (or 65-byte hex) signature.
pub fn recover_pub_em_from_eip191(
    eip191_hash: &[u8; 32],
    sig_em_or_hex: &str,
) -> Result<String, Error> {
    let (r, s, v) = parse_sig_em_or_hex(sig_em_or_hex)?;
    let mut rs = [0u8; 64];
    rs[..32].copy_from_slice(&r);
    rs[32..].copy_from_slice(&s);

    let signature = Signature::from_slice(&rs)
        .map_err(|e| Error::Signing(format!("Invalid secp256k1 signature scalars: {}", e)))?;
    let recovery_id = RecoveryId::from_byte(v - 27)
        .ok_or_else(|| Error::Signing(format!("Invalid recovery id: {}", v)))?;

    let verifying_key = VerifyingKey::recover_from_prehash(eip191_hash, &signature, recovery_id)
        .map_err(|e| Error::Signing(format!("Failed to recover public key from signature: {}", e)))?;
    let compressed = verifying_key.to_sec1_point(true);
    encode_pub_em_from_bytes(compressed.as_bytes())
}

/// Recover the canonical compressed `PUB_EM_<66 lowercase hex>` public key from a
/// 32-byte Antelope/Wire transaction `signing_digest` and a `SIG_EM_` (or 65-byte hex) signature.
pub fn recover_pub_em(signing_digest: &[u8; 32], sig_em_or_hex: &str) -> Result<String, Error> {
    let eip191_hash = eip191_digest32(signing_digest);
    recover_pub_em_from_eip191(&eip191_hash, sig_em_or_hex)
}

/// Verify that `sig_em_or_hex` over `signing_digest` recovers to `expected_pub_em`
/// (comparing in compressed form), and return the canonical `SIG_EM_<130 lowercase hex>` string.
pub fn verify_sig_em_for_pubkey(
    signing_digest: &[u8; 32],
    sig_em_or_hex: &str,
    expected_pub_em: &str,
) -> Result<String, Error> {
    let (r, s, v) = parse_sig_em_or_hex(sig_em_or_hex)?;
    let canonical_sig = encode_sig_em_from_rsv(&r, &s, v)?;
    let recovered = recover_pub_em(signing_digest, &canonical_sig)?;
    let expected_norm = normalize_pub_em(expected_pub_em)?;
    if recovered != expected_norm {
        let rec_addr = eth_address_from_pub_em(&recovered).unwrap_or_default();
        let exp_addr = eth_address_from_pub_em(&expected_norm).unwrap_or_default();
        return Err(Error::Signing(format!(
            "EM signature public key mismatch: recovered {} ({}) but expected {} ({})",
            recovered, rec_addr, expected_norm, exp_addr
        )));
    }
    Ok(canonical_sig)
}

/// Sign a pre-computed 32-byte digest directly (for ESR identity proofs, etc.).
/// Returns the signature in `SIG_K1_...` format.
pub fn sign_digest(digest_hex: &str, private_key_bytes: &[u8]) -> Result<String, Error> {
    let digest_bytes =
        hex_decode(digest_hex).map_err(|e| Error::Signing(format!("Invalid digest hex: {}", e)))?;
    sign_prehash_canonical(&digest_bytes, private_key_bytes)
}

/// Sign an already-hashed 32-byte digest.
///
/// `digest` is the Antelope signing digest (or an ESR identity digest). It is
/// passed to RFC 6979 as `z` and is not hashed again. The `Sha256` type
/// parameter is k256's sha2 0.11, used only as the HMAC inside the nonce
/// generator. The attempt counter is the RFC 6979 additional data, so the
/// grind stays deterministic.
fn sign_prehash_canonical(digest: &[u8], private_key_bytes: &[u8]) -> Result<String, Error> {
    if digest.len() != 32 {
        return Err(Error::Signing("Digest must be 32 bytes".into()));
    }
    if private_key_bytes.len() != 32 {
        return Err(Error::Signing("Private key must be 32 bytes".into()));
    }
    let signing_key = SigningKey::from_slice(private_key_bytes)
        .map_err(|e| Error::Signing(format!("Invalid private key: {}", e)))?;

    for attempt in 0u32..CANONICAL_GRIND_MAX_ATTEMPTS {
        let ad = attempt.to_le_bytes();
        let (signature, recovery_id) = ecdsa::hazmat::sign_prehashed_rfc6979::<
            k256::Secp256k1,
            k256::sha2::Sha256,
        >(signing_key.as_nonzero_scalar(), digest, &ad);

        if is_canonical(&signature) {
            return encode_k1_signature(&signature, recovery_id);
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

/// Parse a private key from WIF (`5K...`), `PVT_K1_...`, or 32-byte hex (`0x...` or 64 hex chars).
/// Returns `(raw_32_byte_private_key, is_raw_hex_input)`.
pub fn decode_private_key_flexible(key: &str) -> Result<(Vec<u8>, bool), Error> {
    let key = key.trim();
    if key.is_empty() {
        return Err(Error::Signing("Private key is empty".into()));
    }
    if key.starts_with("PVT_K1_") {
        return Ok((pvt_k1_decode(key)?, false));
    }
    if let Some(hex_str) = key.strip_prefix("0x").or_else(|| key.strip_prefix("0X")) {
        if hex_str.len() == 64 && hex_str.bytes().all(|b| b.is_ascii_hexdigit()) {
            let bytes = hex_decode(hex_str)
                .map_err(|e| Error::Signing(format!("Invalid hex private key: {}", e)))?;
            let _ = SigningKey::from_slice(&bytes)
                .map_err(|e| Error::Signing(format!("Invalid secp256k1 private key: {}", e)))?;
            return Ok((bytes, true));
        }
    }
    if key.len() == 64 && key.bytes().all(|b| b.is_ascii_hexdigit()) {
        let bytes = hex_decode(key)
            .map_err(|e| Error::Signing(format!("Invalid hex private key: {}", e)))?;
        let _ = SigningKey::from_slice(&bytes)
            .map_err(|e| Error::Signing(format!("Invalid secp256k1 private key: {}", e)))?;
        return Ok((bytes, true));
    }

    let mut decoded = wif_decode(key)?;
    let bytes = decoded[1..33].to_vec();
    decoded.zeroize();
    let _ = SigningKey::from_slice(&bytes)
        .map_err(|e| Error::Signing(format!("Invalid private key: {}", e)))?;
    Ok((bytes, false))
}

/// Derive the public key from a private key string.
/// Supports legacy WIF format (`5K...`), modern Antelope format (`PVT_K1_...`),
/// and 32-byte Ethereum hex private keys (`0x<64 hex>` or `<64 hex>`).
/// Returns `(raw_private_key_bytes, public_key_string)`:
/// - `0x<64 hex>` / `<64 hex>` -> `PUB_EM_<66 lowercase hex>`
/// - `PVT_K1_...` -> `PUB_K1_...`
/// - `5K...` (WIF) -> `EOS...`
pub fn public_key_from_wif(key: &str) -> Result<(Vec<u8>, String), Error> {
    let key = key.trim();
    let (private_key_bytes, is_hex_em) = decode_private_key_flexible(key)?;

    let signing_key = SigningKey::from_slice(&private_key_bytes)
        .map_err(|e| Error::Signing(format!("Invalid private key: {}", e)))?;

    let verifying_key = signing_key.verifying_key();
    let compressed = verifying_key.to_sec1_point(true);
    let pub_bytes = compressed.as_bytes().to_vec();

    let pub_key_str = if is_hex_em {
        encode_pub_em_from_bytes(&pub_bytes)?
    } else if key.starts_with("PVT_K1_") {
        encode_k1_public_key(&pub_bytes)
    } else {
        encode_eos_public_key(&pub_bytes)
    };

    Ok((private_key_bytes, pub_key_str))
}

/// Derive the `PUB_EM_<66 lowercase hex>` public key from any supported private key
/// format (`0x` hex, raw 64-hex, WIF, or `PVT_K1_`).
pub fn pub_em_from_private_key(key: &str) -> Result<(Vec<u8>, String), Error> {
    let (private_key_bytes, _) = decode_private_key_flexible(key)?;
    let signing_key = SigningKey::from_slice(&private_key_bytes)
        .map_err(|e| Error::Signing(format!("Invalid private key: {}", e)))?;
    let compressed = signing_key.verifying_key().to_sec1_point(true);
    let pub_em = encode_pub_em_from_bytes(compressed.as_bytes())?;
    Ok((private_key_bytes, pub_em))
}

/// True if `key` is a Wire `PUB_EM_...` public key.
pub fn is_em_public_key(key: &str) -> bool {
    key.trim().starts_with("PUB_EM_")
}

/// Encode a 33-byte compressed (or 65-byte uncompressed) secp256k1 public key as
/// canonical compressed `PUB_EM_<66 lowercase hex>`.
pub fn encode_pub_em_from_bytes(sec1_bytes: &[u8]) -> Result<String, Error> {
    let pk = PublicKey::from_sec1_bytes(sec1_bytes)
        .map_err(|_| Error::Signing("Invalid secp256k1 public key point".into()))?;
    let compressed = pk.to_sec1_point(true);
    Ok(format!("PUB_EM_{}", hex_encode_bytes(compressed.as_bytes())))
}

/// Decode a `PUB_EM_...` (compressed 33-byte or uncompressed 65-byte) or raw `0x` secp256k1
/// public key hex string into its canonical 33-byte compressed SEC1 form.
///
/// Explicitly detects and rejects 20-byte `0x` Ethereum addresses with an actionable message.
pub fn decode_pub_em_compressed(key: &str) -> Result<[u8; 33], Error> {
    let trimmed = key.trim();
    let hex_part = if let Some(rest) = trimmed.strip_prefix("PUB_EM_") {
        rest
    } else if let Some(rest) = trimmed.strip_prefix("0x").or_else(|| trimmed.strip_prefix("0X")) {
        rest
    } else {
        trimmed
    };

    if hex_part.len() == 40 && hex_part.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(Error::Signing(
            "An Ethereum address (20 bytes) cannot be converted directly to a PUB_EM_ public key \
             because it is a one-way Keccak-256 hash. Paste a PUB_EM_... key, a 33/65-byte \
             secp256k1 public key hex, or derive it from Ledger / MetaMask."
                .into(),
        ));
    }

    let raw = hex_decode(hex_part)
        .map_err(|e| Error::Signing(format!("Invalid PUB_EM_ hex: {}", e)))?;
    if raw.len() != 33 && raw.len() != 65 {
        return Err(Error::Signing(format!(
            "PUB_EM_ public key must be 33 bytes (compressed) or 65 bytes (uncompressed), got {} bytes",
            raw.len()
        )));
    }

    let pk = PublicKey::from_sec1_bytes(&raw)
        .map_err(|_| Error::Signing("Invalid secp256k1 curve point in PUB_EM_ key".into()))?;
    let compressed = pk.to_sec1_point(true);
    let bytes = compressed.as_bytes();
    let mut out = [0u8; 33];
    out.copy_from_slice(bytes);
    Ok(out)
}

/// Normalize any `PUB_EM_...` (compressed or uncompressed) or `0x` secp256k1 public key hex
/// into canonical compressed `PUB_EM_<66 lowercase hex>`.
pub fn normalize_pub_em(key: &str) -> Result<String, Error> {
    let compressed = decode_pub_em_compressed(key)?;
    Ok(format!("PUB_EM_{}", hex_encode_bytes(&compressed)))
}

/// Derive the EIP-55 checksummed Ethereum address (`0x...`, 42 chars) from a `PUB_EM_...`
/// or secp256k1 public key.
pub fn eth_address_from_pub_em(key: &str) -> Result<String, Error> {
    let compressed = decode_pub_em_compressed(key)?;
    let pk = PublicKey::from_sec1_bytes(&compressed)
        .map_err(|_| Error::Signing("Invalid secp256k1 point".into()))?;
    let uncompressed = pk.to_sec1_point(false);
    let uncompressed_bytes = uncompressed.as_bytes(); // 65 bytes: 0x04 || X(32) || Y(32)
    let hash = Keccak256::digest(&uncompressed_bytes[1..65]);
    let addr_bytes = &hash[12..32];
    Ok(eip55_checksum_address(addr_bytes))
}

/// Format a 20-byte Ethereum address with EIP-55 mixed-case checksum (`0x...`).
pub fn eip55_checksum_address(addr_20: &[u8]) -> String {
    let lower_hex = hex_encode_bytes(addr_20);
    let hash = Keccak256::digest(lower_hex.as_bytes());
    let mut out = String::with_capacity(42);
    out.push_str("0x");
    for (i, ch) in lower_hex.chars().enumerate() {
        if ch.is_ascii_alphabetic() {
            let byte = hash[i / 2];
            let nibble = if i % 2 == 0 { byte >> 4 } else { byte & 0x0f };
            if nibble >= 8 {
                out.push(ch.to_ascii_uppercase());
            } else {
                out.push(ch);
            }
        } else {
            out.push(ch);
        }
    }
    out
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

/// Decode a `PUB_K1_...` public key string to raw compressed bytes (33 bytes).
pub fn decode_k1_public_key(key: &str) -> Result<Vec<u8>, Error> {
    let encoded = key
        .strip_prefix("PUB_K1_")
        .ok_or_else(|| Error::Signing("Not a PUB_K1_ key".into()))?;

    let decoded = bs58_decode(encoded)
        .map_err(|e| Error::Signing(format!("Invalid PUB_K1_ base58: {}", e)))?;

    if decoded.len() < 37 {
        return Err(Error::Signing("PUB_K1_ key too short".into()));
    }

    let key_bytes = &decoded[..33];
    let checksum = &decoded[33..37];

    // Verify RIPEMD160 checksum: ripemd160(key_bytes + "K1")[0..4]
    let mut check_buf = key_bytes.to_vec();
    check_buf.extend_from_slice(b"K1");
    let hash = ripemd160(&check_buf);

    if &hash[..4] != checksum {
        return Err(Error::Signing("PUB_K1_ checksum mismatch".into()));
    }

    Ok(key_bytes.to_vec())
}

/// Decode a public key into `(key_type_tag, compressed_33_bytes)`.
/// - `EOS...`, `FIO...`, `PUB_K1_...` -> `(0, [u8; 33])`
/// - `PUB_EM_...` (compressed or uncompressed) -> `(3, [u8; 33])`
pub fn decode_typed_public_key(key: &str) -> Result<(u8, [u8; 33]), Error> {
    let key = key.trim();
    if key.starts_with("PUB_EM_") {
        let compressed = decode_pub_em_compressed(key)?;
        return Ok((KEY_TYPE_EM, compressed));
    }

    let bytes = if key.starts_with("PUB_K1_") {
        decode_k1_public_key(key)?
    } else if key.starts_with("EOS") || key.starts_with("FIO") {
        let decoded = bs58_decode(&key[3..])
            .map_err(|e| Error::Signing(format!("Invalid legacy key base58: {}", e)))?;
        if decoded.len() < 37 {
            return Err(Error::Signing("Legacy public key too short".into()));
        }
        let key_bytes = &decoded[..33];
        let checksum = &decoded[33..37];
        let hash = ripemd160(key_bytes);
        if &hash[..4] != checksum {
            return Err(Error::Signing("Legacy public key checksum mismatch".into()));
        }
        key_bytes.to_vec()
    } else {
        hex_decode(key).map_err(|e| Error::Signing(format!("Invalid public key hex: {}", e)))?
    };

    if bytes.len() != 33 {
        return Err(Error::Signing(format!(
            "Compressed public key must be 33 bytes, got {}",
            bytes.len()
        )));
    }
    let _ = PublicKey::from_sec1_bytes(&bytes)
        .map_err(|_| Error::Signing("Invalid secp256k1 point in public key".into()))?;
    let mut arr = [0u8; 33];
    arr.copy_from_slice(&bytes);
    Ok((KEY_TYPE_K1, arr))
}

/// Compare two public key strings for equality on the wire, normalizing `EOS`/`FIO`/`PUB_K1_`
/// (all `K1`, tag 0) and compressing uncompressed `PUB_EM_04...` to `PUB_EM_02/03...` (`EM`, tag 3).
pub fn public_keys_match(a: &str, b: &str) -> bool {
    match (decode_typed_public_key(a), decode_typed_public_key(b)) {
        (Ok(left), Ok(right)) => left == right,
        _ => a.trim() == b.trim(),
    }
}

/// Decode a public key from `PUB_K1_...`, `EOS...`, `FIO...`, `PUB_EM_...`, or hex-encoded compressed bytes
/// into its 33-byte compressed SEC1 representation.
pub fn decode_public_key_flexible(key: &str) -> Result<Vec<u8>, Error> {
    let (_tag, compressed) = decode_typed_public_key(key)?;
    Ok(compressed.to_vec())
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

fn encode_k1_signature(
    signature: &Signature,
    recovery_id: k256::ecdsa::RecoveryId,
) -> Result<String, Error> {
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

/// Encode compressed public key bytes as a FIO public key string.
/// FIO uses the legacy Graphene format identical to `EOS...` (checksum is
/// `ripemd160(pubkey)[..4]` with no key-type salt) but with a `FIO` prefix.
pub fn encode_fio_public_key_from_bytes(compressed_pub: &[u8]) -> String {
    let checksum = ripemd160(compressed_pub);
    let mut data = compressed_pub.to_vec();
    data.extend_from_slice(&checksum[..4]);
    format!("FIO{}", bs58_encode(&data))
}

fn wif_decode(wif: &str) -> Result<Vec<u8>, Error> {
    let decoded = bs58_decode(wif).map_err(|e| Error::Signing(format!("Invalid WIF: {}", e)))?;

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

fn hex_encode_bytes(data: &[u8]) -> String {
    let mut s = String::with_capacity(data.len() * 2);
    for &b in data {
        s.push_str(&format!("{:02x}", b));
    }
    s
}

fn hex_decode(hex: &str) -> Result<Vec<u8>, String> {
    if !hex.is_ascii() {
        return Err("Non-ASCII hex string".into());
    }
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
    digits
        .iter()
        .map(|&d| BASE58_CHARS[d as usize] as char)
        .collect()
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
        let (priv_bytes, _) =
            public_key_from_wif("5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3").unwrap();
        let chain_id = "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906";

        for i in 0u8..32 {
            let tx = [i; 64];
            let sig_str = sign_transaction(chain_id, &tx, &priv_bytes).unwrap();
            assert!(
                sig_str.starts_with("SIG_K1_"),
                "iter {}: must have prefix",
                i
            );

            // Decode the SIG_K1_ string back to raw bytes to verify canonicality
            let encoded = sig_str.strip_prefix("SIG_K1_").unwrap();
            let decoded = bs58_decode(encoded).unwrap();
            // Layout: 1-byte recovery + 32-byte r + 32-byte s + 4-byte checksum
            assert!(
                decoded.len() >= 65,
                "iter {}: decoded len {}",
                i,
                decoded.len()
            );
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
            &tx,
            &priv_bytes,
        )
        .unwrap();
        let sig2 = sign_transaction(
            "1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4",
            &tx,
            &priv_bytes,
        )
        .unwrap();
        assert_ne!(sig1, sig2);
    }

    #[test]
    fn sign_invalid_chain_id_hex() {
        let (priv_bytes, _) =
            public_key_from_wif("5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3").unwrap();
        let result = sign_transaction("not-hex", &[0u8; 32], &priv_bytes);
        assert!(result.is_err());
    }

    #[test]
    fn encode_public_key_from_bytes_matches() {
        let wif = "5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3";
        let (_, pub_key) = public_key_from_wif(wif).unwrap();

        // Re-derive manually
        let signing_key = SigningKey::from_slice(&public_key_from_wif(wif).unwrap().0).unwrap();
        let compressed = signing_key.verifying_key().to_sec1_point(true);
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

    // ── Wire EM (`PUB_EM_` / `SIG_EM_`) tests ──

    #[test]
    fn em_key_derivation_and_uncompressed_normalization() {
        let em_priv_hex = "0x5dc68c7fb76d4c25337781e9ca12d789bdd7cd9524c5a9eee1bea65607d2f57e";
        let expected_pub_em =
            "PUB_EM_031d483a28813838ddc6a048085ac2eef13a12d8a6e6324eb10c3bc5c272f91f56";
        let uncompressed_pub_em = "PUB_EM_041d483a28813838ddc6a048085ac2eef13a12d8a6e6324eb10c3bc5c272f91f5690c18f11f86b00510150f402ba01b72fa2becc9c132001304e518ae65a951827";
        let expected_eth_addr = "0xEA0891c29854691CAa4F09Bb6091A69f5c3cb183";

        let (_, derived_pub_em) = public_key_from_wif(em_priv_hex).unwrap();
        assert_eq!(derived_pub_em, expected_pub_em);

        // Uncompressed PUB_EM_04... normalizes to the exact compressed PUB_EM_03...
        assert_eq!(
            normalize_pub_em(uncompressed_pub_em).unwrap(),
            expected_pub_em
        );
        assert!(public_keys_match(uncompressed_pub_em, expected_pub_em));

        // Both compressed and uncompressed derive the exact EIP-55 Ethereum address
        assert_eq!(
            eth_address_from_pub_em(expected_pub_em).unwrap(),
            expected_eth_addr
        );
        assert_eq!(
            eth_address_from_pub_em(uncompressed_pub_em).unwrap(),
            expected_eth_addr
        );

        // Rejects a 20-byte Ethereum address with an actionable error message
        let err = decode_pub_em_compressed(expected_eth_addr).unwrap_err();
        assert!(err.to_string().contains("Ethereum address (20 bytes)"));
    }

    #[test]
    fn em_signing_and_recovery_matches_test_vector() {
        let chain_id = "9ccd94e823fda51363bd4265ad618a909c4985c445078c79f8d030fe9697b71d";
        let em_priv_hex = "0x5dc68c7fb76d4c25337781e9ca12d789bdd7cd9524c5a9eee1bea65607d2f57e";
        let packed_trx_hex = "00b9556901000200000000000000010000000000eab0c70040cbdaa86c52d5010000000000855c340000000080ab26a7660000000000855c3400000000a8ed32320000000080ab26a701000000020002c0ded2bc1f1305fb0faac5e6c03ee3a1924234985427b6167ca569d13df435cf010003031d483a28813838ddc6a048085ac2eef13a12d8a6e6324eb10c3bc5c272f91f5601000000";
        let expected_signing_digest_hex =
            "5b3adeedc252c0b0c0e86736b4f995eed63f5001fe012b54064fc97745abe538";
        let expected_eip191_hex =
            "fda8d02d7c5fbd5352f9e4a72de35fe73524661b573d6fc1f7646b3baa54b069";
        let expected_sig_em = "SIG_EM_6c9b094553489f8c69feb4931725bf3b5685146572bf24b77ffb9f7e79318fb14132c71d403c1e2a0680041eec8fcce76a94175dbc750fcd4657378737708b111b";
        let expected_sig_wire_hex = "036c9b094553489f8c69feb4931725bf3b5685146572bf24b77ffb9f7e79318fb14132c71d403c1e2a0680041eec8fcce76a94175dbc750fcd4657378737708b111b";
        let expected_pub_em =
            "PUB_EM_031d483a28813838ddc6a048085ac2eef13a12d8a6e6324eb10c3bc5c272f91f56";

        let packed_trx = hex_decode(packed_trx_hex).unwrap();
        let (priv_bytes, pub_em) = public_key_from_wif(em_priv_hex).unwrap();
        assert_eq!(pub_em, expected_pub_em);

        // 1. signing_digest_hex
        let signing_digest = compute_signing_digest(chain_id, &packed_trx).unwrap();
        assert_eq!(hex_encode_bytes(&signing_digest), expected_signing_digest_hex);

        // 2. eip191_hash_hex
        let eip191 = eip191_digest32(&signing_digest);
        assert_eq!(hex_encode_bytes(&eip191), expected_eip191_hex);

        // 3. sig_em & sig_em_wire_hex
        let sig_em = sign_transaction_em(chain_id, &packed_trx, &priv_bytes).unwrap();
        assert_eq!(sig_em, expected_sig_em);
        let sig_wire = serialize_sig_em_wire(&sig_em).unwrap();
        assert_eq!(hex_encode_bytes(&sig_wire), expected_sig_wire_hex);

        // 4. recover_pub_em & verify_sig_em_for_pubkey
        let recovered = recover_pub_em(&signing_digest, &sig_em).unwrap();
        assert_eq!(recovered, expected_pub_em);
        assert_eq!(
            verify_sig_em_for_pubkey(&signing_digest, &sig_em, expected_pub_em).unwrap(),
            expected_sig_em
        );
    }
}
