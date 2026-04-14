//! Antelope binary serialization.
//!
//! Encodes Antelope types into the packed binary format expected by nodeos.
//! This covers the system types needed for transaction construction:
//! Name, Asset, Authorization, Action, and Transaction.
//!
//! For custom contract action data (beyond system contracts), we use
//! `abi_json_to_bin` via the chain API. System actions like `transfer`,
//! `delegatebw`, `voteproducer`, etc. are serialized natively here.

use crate::antelope::signing::decode_public_key_flexible;
use crate::error::Error;

// ── Primitives ──

/// Encode an Antelope name string to its u64 representation.
/// Names are up to 12 characters from the set `.12345abcdefghijklmnopqrstuvwxyz`.
/// A 13th character is allowed but only a-p (4 bits).
pub fn name_to_u64(name: &str) -> Result<u64, Error> {
    let mut value: u64 = 0;
    let bytes = name.as_bytes();

    for i in 0..13.min(bytes.len()) {
        let c = char_to_value(bytes[i])?;
        if i < 12 {
            // First 12 chars use 5 bits each
            value |= (c as u64 & 0x1F) << (64 - 5 * (i + 1));
        } else {
            // 13th char uses 4 bits
            value |= c as u64 & 0x0F;
        }
    }

    Ok(value)
}

fn char_to_value(c: u8) -> Result<u8, Error> {
    match c {
        b'.' => Ok(0),
        b'1'..=b'5' => Ok(c - b'0'),
        b'a'..=b'z' => Ok(c - b'a' + 6),
        _ => Err(Error::Serialization(format!(
            "Invalid name character: '{}'",
            c as char
        ))),
    }
}

/// Serialize a u64 name to bytes (little-endian).
pub fn serialize_name(name: &str) -> Result<Vec<u8>, Error> {
    Ok(name_to_u64(name)?.to_le_bytes().to_vec())
}

/// Serialize an Antelope Asset string like "1.0000 EOS".
/// Format: i64 amount (little-endian) + u64 symbol (precision byte + symbol chars).
pub fn serialize_asset(asset_str: &str) -> Result<Vec<u8>, Error> {
    let parts: Vec<&str> = asset_str.trim().split_whitespace().collect();
    if parts.len() != 2 {
        return Err(Error::Serialization(format!(
            "Invalid asset format: '{}'",
            asset_str
        )));
    }

    let amount_str = parts[0];
    let symbol_str = parts[1];

    // Determine precision from decimal places
    let precision = if let Some(dot_pos) = amount_str.find('.') {
        (amount_str.len() - dot_pos - 1) as u8
    } else {
        0u8
    };

    // Parse the amount as integer (removing decimal point)
    let cleaned = amount_str.replace('.', "");
    let amount: i64 = cleaned
        .parse()
        .map_err(|_| Error::Serialization(format!("Invalid amount: '{}'", amount_str)))?;

    // Build symbol: precision byte + up to 7 symbol chars (zero-padded)
    let mut symbol_bytes = [0u8; 8];
    symbol_bytes[0] = precision;
    let sym_chars = symbol_str.as_bytes();
    for (i, &b) in sym_chars.iter().take(7).enumerate() {
        symbol_bytes[i + 1] = b;
    }

    let mut result = Vec::with_capacity(16);
    result.extend_from_slice(&amount.to_le_bytes());
    result.extend_from_slice(&symbol_bytes);
    Ok(result)
}

/// Serialize a variable-length unsigned integer (VarUint32).
pub fn serialize_varuint32(mut value: u32) -> Vec<u8> {
    let mut result = Vec::new();
    loop {
        let mut byte = (value & 0x7F) as u8;
        value >>= 7;
        if value > 0 {
            byte |= 0x80;
        }
        result.push(byte);
        if value == 0 {
            break;
        }
    }
    result
}

// ── Composite Types ──

/// Serialize an authorization (actor name + permission name).
pub fn serialize_authorization(actor: &str, permission: &str) -> Result<Vec<u8>, Error> {
    let mut result = serialize_name(actor)?;
    result.extend_from_slice(&serialize_name(permission)?);
    Ok(result)
}

/// Serialize a single action.
/// `data` is the already-serialized action data (hex string from abi_json_to_bin or native serialization).
pub fn serialize_action(
    account: &str,
    name: &str,
    authorizations: &[(&str, &str)],
    data_hex: &str,
) -> Result<Vec<u8>, Error> {
    let mut result = Vec::new();

    // account name
    result.extend_from_slice(&serialize_name(account)?);
    // action name
    result.extend_from_slice(&serialize_name(name)?);

    // authorization array
    result.extend_from_slice(&serialize_varuint32(authorizations.len() as u32));
    for (actor, perm) in authorizations {
        result.extend_from_slice(&serialize_authorization(actor, perm)?);
    }

    // data (hex-encoded bytes)
    let data_bytes = hex_decode(data_hex)
        .map_err(|e| Error::Serialization(format!("Invalid action data hex: {}", e)))?;
    result.extend_from_slice(&serialize_varuint32(data_bytes.len() as u32));
    result.extend_from_slice(&data_bytes);

    Ok(result)
}

// ── System Action Serialization ──

/// Serialize the data for an `eosio.token::transfer` action.
pub fn serialize_transfer(
    from: &str,
    to: &str,
    quantity: &str,
    memo: &str,
) -> Result<Vec<u8>, Error> {
    let mut data = Vec::new();
    data.extend_from_slice(&serialize_name(from)?);
    data.extend_from_slice(&serialize_name(to)?);
    data.extend_from_slice(&serialize_asset(quantity)?);
    // memo: length-prefixed string
    let memo_bytes = memo.as_bytes();
    data.extend_from_slice(&serialize_varuint32(memo_bytes.len() as u32));
    data.extend_from_slice(memo_bytes);
    Ok(data)
}

/// Serialize the data for `eosio::delegatebw`.
pub fn serialize_delegatebw(
    from: &str,
    receiver: &str,
    stake_net: &str,
    stake_cpu: &str,
    transfer: bool,
) -> Result<Vec<u8>, Error> {
    let mut data = Vec::new();
    data.extend_from_slice(&serialize_name(from)?);
    data.extend_from_slice(&serialize_name(receiver)?);
    data.extend_from_slice(&serialize_asset(stake_net)?);
    data.extend_from_slice(&serialize_asset(stake_cpu)?);
    data.push(if transfer { 1 } else { 0 });
    Ok(data)
}

/// Serialize the data for `eosio::undelegatebw`.
pub fn serialize_undelegatebw(
    from: &str,
    receiver: &str,
    unstake_net: &str,
    unstake_cpu: &str,
) -> Result<Vec<u8>, Error> {
    let mut data = Vec::new();
    data.extend_from_slice(&serialize_name(from)?);
    data.extend_from_slice(&serialize_name(receiver)?);
    data.extend_from_slice(&serialize_asset(unstake_net)?);
    data.extend_from_slice(&serialize_asset(unstake_cpu)?);
    Ok(data)
}

/// Serialize the data for `eosio::voteproducer`.
pub fn serialize_voteproducer(
    voter: &str,
    proxy: &str,
    producers: &[&str],
) -> Result<Vec<u8>, Error> {
    let mut data = Vec::new();
    data.extend_from_slice(&serialize_name(voter)?);
    data.extend_from_slice(&serialize_name(proxy)?);
    // producers must be sorted alphabetically
    let mut sorted: Vec<&str> = producers.to_vec();
    sorted.sort();
    data.extend_from_slice(&serialize_varuint32(sorted.len() as u32));
    for p in &sorted {
        data.extend_from_slice(&serialize_name(p)?);
    }
    Ok(data)
}

/// Serialize the data for `eosio::buyram`.
pub fn serialize_buyram(payer: &str, receiver: &str, quant: &str) -> Result<Vec<u8>, Error> {
    let mut data = Vec::new();
    data.extend_from_slice(&serialize_name(payer)?);
    data.extend_from_slice(&serialize_name(receiver)?);
    data.extend_from_slice(&serialize_asset(quant)?);
    Ok(data)
}

/// Serialize the data for `eosio::buyrambytes`.
pub fn serialize_buyrambytes(payer: &str, receiver: &str, bytes: u32) -> Result<Vec<u8>, Error> {
    let mut data = Vec::new();
    data.extend_from_slice(&serialize_name(payer)?);
    data.extend_from_slice(&serialize_name(receiver)?);
    data.extend_from_slice(&bytes.to_le_bytes());
    Ok(data)
}

/// Serialize the data for `eosio::sellram`.
pub fn serialize_sellram(account: &str, bytes: i64) -> Result<Vec<u8>, Error> {
    let mut data = Vec::new();
    data.extend_from_slice(&serialize_name(account)?);
    data.extend_from_slice(&bytes.to_le_bytes());
    Ok(data)
}

/// Serialize the data for `eosio::claimrewards`.
pub fn serialize_claimrewards(owner: &str) -> Result<Vec<u8>, Error> {
    serialize_name(owner)
}

/// Serialize an Antelope `public_key` (K1 only): `[type_byte=0][33 bytes compressed]`.
/// Accepts `EOS...`, `PUB_K1_...`, or hex-encoded compressed key.
pub fn serialize_public_key(key: &str) -> Result<Vec<u8>, Error> {
    let compressed = decode_public_key_flexible(key.trim())
        .map_err(|e| Error::Serialization(format!("Invalid public key: {}", e)))?;
    if compressed.len() != 33 {
        return Err(Error::Serialization(format!(
            "Public key must be 33 bytes, got {}",
            compressed.len()
        )));
    }
    let mut out = Vec::with_capacity(34);
    out.push(0); // K1
    out.extend_from_slice(&compressed);
    Ok(out)
}

/// Serialize a length-prefixed UTF-8 string.
pub fn serialize_string(s: &str) -> Vec<u8> {
    let bytes = s.as_bytes();
    let mut out = serialize_varuint32(bytes.len() as u32);
    out.extend_from_slice(bytes);
    out
}

/// Serialize the data for `eosio::regproducer`.
/// `producer(name) || producer_key(public_key) || url(string) || location(uint16)`
pub fn serialize_regproducer(
    producer: &str,
    producer_key: &str,
    url: &str,
    location: u16,
) -> Result<Vec<u8>, Error> {
    let mut data = Vec::new();
    data.extend_from_slice(&serialize_name(producer)?);
    data.extend_from_slice(&serialize_public_key(producer_key)?);
    data.extend_from_slice(&serialize_string(url));
    data.extend_from_slice(&location.to_le_bytes());
    Ok(data)
}

/// Serialize the data for `eosio::unregprod`.
pub fn serialize_unregprod(producer: &str) -> Result<Vec<u8>, Error> {
    serialize_name(producer)
}

/// Serialize the data for `eosio::regfinkey` (Savannah BLS finalizer key registration).
/// `finalizer_name(name) || finalizer_key(string) || proof_of_possession(string)`
pub fn serialize_regfinkey(
    finalizer_name: &str,
    finalizer_key: &str,
    proof_of_possession: &str,
) -> Result<Vec<u8>, Error> {
    let mut data = Vec::new();
    data.extend_from_slice(&serialize_name(finalizer_name)?);
    data.extend_from_slice(&serialize_string(finalizer_key));
    data.extend_from_slice(&serialize_string(proof_of_possession));
    Ok(data)
}

/// Serialize the data for `eosio::actfinkey` / `eosio::delfinkey`.
/// Both take `finalizer_name(name) || finalizer_key(string)`.
pub fn serialize_finkey_ref(
    finalizer_name: &str,
    finalizer_key: &str,
) -> Result<Vec<u8>, Error> {
    let mut data = Vec::new();
    data.extend_from_slice(&serialize_name(finalizer_name)?);
    data.extend_from_slice(&serialize_string(finalizer_key));
    Ok(data)
}

// ── Transaction Serialization ──

/// A raw transaction ready for serialization.
pub struct RawTransaction {
    /// Expiration time as Unix timestamp (seconds).
    pub expiration: u32,
    /// TAPOS ref_block_num (lower 16 bits of a recent block number).
    pub ref_block_num: u16,
    /// TAPOS ref_block_prefix (bytes 8..12 of a recent block ID, little-endian u32).
    pub ref_block_prefix: u32,
    /// Max NET usage words (0 = no limit).
    pub max_net_usage_words: u32,
    /// Max CPU usage in microseconds (0 = no limit).
    pub max_cpu_usage_ms: u8,
    /// Delay in seconds.
    pub delay_sec: u32,
    /// Context-free actions.
    pub context_free_actions: Vec<Vec<u8>>,
    /// Serialized actions.
    pub actions: Vec<Vec<u8>>,
    /// Transaction extensions.
    pub transaction_extensions: Vec<(u16, Vec<u8>)>,
}

impl RawTransaction {
    /// Serialize the transaction to its packed binary form.
    pub fn serialize(&self) -> Vec<u8> {
        let mut buf = Vec::with_capacity(256);

        // Header
        buf.extend_from_slice(&self.expiration.to_le_bytes());
        buf.extend_from_slice(&self.ref_block_num.to_le_bytes());
        buf.extend_from_slice(&self.ref_block_prefix.to_le_bytes());
        buf.extend_from_slice(&serialize_varuint32(self.max_net_usage_words));
        buf.push(self.max_cpu_usage_ms);
        buf.extend_from_slice(&serialize_varuint32(self.delay_sec));

        // Context-free actions
        buf.extend_from_slice(&serialize_varuint32(self.context_free_actions.len() as u32));
        for action in &self.context_free_actions {
            buf.extend_from_slice(action);
        }

        // Actions
        buf.extend_from_slice(&serialize_varuint32(self.actions.len() as u32));
        for action in &self.actions {
            buf.extend_from_slice(action);
        }

        // Transaction extensions
        buf.extend_from_slice(&serialize_varuint32(
            self.transaction_extensions.len() as u32
        ));
        for (ext_type, ext_data) in &self.transaction_extensions {
            buf.extend_from_slice(&ext_type.to_le_bytes());
            buf.extend_from_slice(&serialize_varuint32(ext_data.len() as u32));
            buf.extend_from_slice(ext_data);
        }

        buf
    }
}

// ── TAPOS helpers ──

/// Extract TAPOS ref_block_num from a block number.
/// Uses the lower 16 bits.
pub fn tapos_ref_block_num(block_num: u64) -> u16 {
    (block_num & 0xFFFF) as u16
}

/// Extract TAPOS ref_block_prefix from a block ID hex string.
///
/// Per the Antelope reference implementation, `ref_block_prefix` is the
/// little-endian u32 interpretation of bytes 8..12 of the block ID:
/// ```cpp
/// ref_block_prefix = *reinterpret_cast<const uint32_t*>(id._hash + 1);
/// ```
/// On little-endian platforms (x86, ARM LE), `reinterpret_cast<uint32_t*>` reads
/// the four bytes in little-endian order, so we use `from_le_bytes`.
pub fn tapos_ref_block_prefix(block_id_hex: &str) -> Result<u32, Error> {
    if block_id_hex.len() < 24 {
        return Err(Error::Serialization("Block ID too short for TAPOS".into()));
    }
    // Bytes 8..12 of the block ID = hex chars 16..24
    let prefix_hex = &block_id_hex[16..24];
    let bytes = hex_decode(prefix_hex)
        .map_err(|e| Error::Serialization(format!("Invalid block ID hex: {}", e)))?;

    Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}

// ── Hex helpers ──

pub fn hex_encode(data: &[u8]) -> String {
    let mut s = String::with_capacity(data.len() * 2);
    for &b in data {
        s.push_str(&format!("{:02x}", b));
    }
    s
}

pub fn hex_decode(hex: &str) -> Result<Vec<u8>, String> {
    if hex.len() % 2 != 0 {
        return Err("Odd-length hex string".into());
    }
    (0..hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).map_err(|e| e.to_string()))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn name_encoding() {
        // Well-known name encodings
        assert_eq!(name_to_u64("eosio").unwrap(), 6138663577826885632);
        assert_eq!(name_to_u64("eosio.token").unwrap(), 6138663591592764928);
        assert_eq!(name_to_u64("").unwrap(), 0);
    }

    #[test]
    fn name_roundtrip_bytes() {
        let bytes = serialize_name("eosio").unwrap();
        assert_eq!(bytes.len(), 8);
        let val = u64::from_le_bytes(bytes.try_into().unwrap());
        assert_eq!(val, 6138663577826885632);
    }

    #[test]
    fn asset_serialization() {
        let bytes = serialize_asset("1.0000 EOS").unwrap();
        assert_eq!(bytes.len(), 16);

        // Amount: 10000 as i64 LE
        let amount = i64::from_le_bytes(bytes[0..8].try_into().unwrap());
        assert_eq!(amount, 10000);

        // Symbol: precision=4, "EOS"
        assert_eq!(bytes[8], 4); // precision
        assert_eq!(&bytes[9..12], b"EOS");
    }

    #[test]
    fn asset_high_precision() {
        let bytes = serialize_asset("1.00000000 WAX").unwrap();
        let amount = i64::from_le_bytes(bytes[0..8].try_into().unwrap());
        assert_eq!(amount, 100000000);
        assert_eq!(bytes[8], 8); // precision
    }

    #[test]
    fn varuint32_encoding() {
        assert_eq!(serialize_varuint32(0), vec![0]);
        assert_eq!(serialize_varuint32(1), vec![1]);
        assert_eq!(serialize_varuint32(127), vec![127]);
        assert_eq!(serialize_varuint32(128), vec![0x80, 0x01]);
        assert_eq!(serialize_varuint32(300), vec![0xAC, 0x02]);
    }

    #[test]
    fn transfer_serialization() {
        let data = serialize_transfer("alice", "bob", "1.0000 EOS", "test memo").unwrap();
        // Should contain: from(8) + to(8) + asset(16) + memo_len(varuint) + memo_bytes
        assert!(data.len() > 32);
    }

    #[test]
    fn tapos_extraction() {
        // Test TAPOS from a realistic block ID
        let block_id = "0000000200000000000000000000000000000000000000000000000000000000";
        let prefix = tapos_ref_block_prefix(block_id).unwrap();
        assert_eq!(prefix, 0); // Bytes 8..12 are zeros

        let ref_num = tapos_ref_block_num(2);
        assert_eq!(ref_num, 2);
    }

    /// Regression test for the TAPOS prefix endianness bug.
    ///
    /// The Antelope reference implementation computes:
    ///     ref_block_prefix = *reinterpret_cast<const uint32_t*>(id._hash + 1)
    /// which on little-endian hosts reads bytes 8..12 as a little-endian u32.
    ///
    /// Example from a real block that broke integration tests:
    ///   block_id = "00002818 655b1aa3 b016b8b4 b6de1c4b ..."
    ///   bytes 8..12 = 0xb0, 0x16, 0xb8, 0xb4
    ///   correct (LE)  = 0xb4b816b0 = 3031377072
    ///   incorrect (BE) = 0xb016b8b4 = 2953824948
    #[test]
    fn tapos_prefix_uses_little_endian() {
        let block_id = "00002818655b1aa3b016b8b4b6de1c4b1f99b97d2db2f661b855ba7b4f1fab5f";
        let prefix = tapos_ref_block_prefix(block_id).unwrap();
        assert_eq!(
            prefix, 0xb4b816b0,
            "must be little-endian u32 of bytes 8..11"
        );
    }

    #[test]
    fn transaction_serialization() {
        let action_data = serialize_transfer("alice", "bob", "1.0000 EOS", "").unwrap();
        let data_hex = hex_encode(&action_data);
        let action =
            serialize_action("eosio.token", "transfer", &[("alice", "active")], &data_hex).unwrap();

        let tx = RawTransaction {
            expiration: 1700000000,
            ref_block_num: 100,
            ref_block_prefix: 200,
            max_net_usage_words: 0,
            max_cpu_usage_ms: 0,
            delay_sec: 0,
            context_free_actions: vec![],
            actions: vec![action],
            transaction_extensions: vec![],
        };

        let packed = tx.serialize();
        // Should start with expiration (4 bytes LE)
        let exp = u32::from_le_bytes(packed[0..4].try_into().unwrap());
        assert_eq!(exp, 1700000000);
    }

    #[test]
    fn voteproducer_sorts_producers() {
        let data = serialize_voteproducer("voter", "", &["charlie", "alice", "bob"]).unwrap();
        // voter(8) + proxy(8) + count(varuint) + 3 names(24)
        assert_eq!(data.len(), 8 + 8 + 1 + 24);
        // Verify the producers are sorted: alice, bob, charlie
        let alice = u64::from_le_bytes(data[17..25].try_into().unwrap());
        let bob = u64::from_le_bytes(data[25..33].try_into().unwrap());
        let charlie = u64::from_le_bytes(data[33..41].try_into().unwrap());
        assert!(alice < bob);
        assert!(bob < charlie);
    }
}
