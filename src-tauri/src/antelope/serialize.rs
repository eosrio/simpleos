//! Antelope binary serialization.
//!
//! Encodes Antelope types into the packed binary format expected by nodeos.
//! This covers the system types needed for transaction construction:
//! Name, Asset, Authorization, Action, and Transaction.
//!
//! For custom contract action data (beyond system contracts), we use
//! `abi_json_to_bin` via the chain API. System actions like `transfer`,
//! `delegatebw`, `voteproducer`, etc. are serialized natively here.

use crate::antelope::signing::{
    decode_typed_public_key, encode_k1_public_key_from_bytes, encode_pub_em_from_bytes,
    KEY_TYPE_EM, KEY_TYPE_K1,
};
use crate::error::Error;

// ── Primitives ──

/// Encode an Antelope name string to its u64 representation.
/// Names are up to 12 characters from the set `.12345abcdefghijklmnopqrstuvwxyz`.
/// A 13th character is allowed only from `.12345abcdefghij` (4 bits).
pub fn name_to_u64(name: &str) -> Result<u64, Error> {
    let mut value: u64 = 0;
    let bytes = name.as_bytes();
    if bytes.len() > 13 {
        return Err(Error::Serialization(
            "Antelope names cannot exceed 13 characters".into(),
        ));
    }

    for i in 0..13.min(bytes.len()) {
        let c = char_to_value(bytes[i])?;
        if i < 12 {
            // First 12 chars use 5 bits each
            value |= (c as u64 & 0x1F) << (64 - 5 * (i + 1));
        } else {
            // 13th char uses 4 bits
            if c > 0x0F {
                return Err(Error::Serialization(
                    "Invalid thirteenth name character".into(),
                ));
            }
            value |= c as u64;
        }
    }

    Ok(value)
}

/// Decode a u64 Antelope name back to its string form.
/// Inverse of `name_to_u64`. Trailing `.` characters are trimmed.
pub fn u64_to_name(n: u64) -> String {
    const CHARSET: &[u8; 32] = b".12345abcdefghijklmnopqrstuvwxyz";
    let mut bytes = [0u8; 13];
    for i in 0..12 {
        let shift = 64 - 5 * (i + 1);
        bytes[i] = CHARSET[((n >> shift) & 0x1F) as usize];
    }
    // 13th char uses the lowest 4 bits.
    bytes[12] = CHARSET[(n & 0x0F) as usize];
    let end = bytes
        .iter()
        .rposition(|&c| c != b'.')
        .map(|p| p + 1)
        .unwrap_or(0);
    std::str::from_utf8(&bytes[..end]).unwrap_or("").to_string()
}

/// Parse a variable-length unsigned integer (VarUint32) at `pos`, advancing the cursor.
pub fn read_varuint32(bytes: &[u8], pos: &mut usize) -> Result<u32, Error> {
    let mut value: u32 = 0;
    let mut shift = 0;
    loop {
        if *pos >= bytes.len() {
            return Err(Error::Serialization("varuint32 truncated".into()));
        }
        let b = bytes[*pos];
        *pos += 1;
        if shift == 28 && b > 0x0F {
            return Err(Error::Serialization("varuint32 overflow".into()));
        }
        value |= ((b & 0x7F) as u32) << shift;
        if b & 0x80 == 0 {
            return Ok(value);
        }
        shift += 7;
        if shift > 28 {
            return Err(Error::Serialization("varuint32 overflow".into()));
        }
    }
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
    if symbol_str.is_empty()
        || symbol_str.len() > 7
        || !symbol_str.bytes().all(|b| b.is_ascii_uppercase())
    {
        return Err(Error::Serialization(
            "Asset symbol must contain 1 to 7 uppercase ASCII letters".into(),
        ));
    }
    let unsigned = amount_str.strip_prefix('-').unwrap_or(amount_str);
    let mut decimal = unsigned.split('.');
    let whole = decimal.next().unwrap_or("");
    let fraction = decimal.next();
    if whole.is_empty()
        || !whole.bytes().all(|b| b.is_ascii_digit())
        || decimal.next().is_some()
        || fraction
            .is_some_and(|f| f.is_empty() || f.len() > 18 || !f.bytes().all(|b| b.is_ascii_digit()))
    {
        return Err(Error::Serialization(format!(
            "Invalid amount: '{amount_str}'"
        )));
    }

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
    if amount.unsigned_abs() > ((1u64 << 62) - 1) {
        return Err(Error::Serialization(
            "Asset amount exceeds Antelope's range".into(),
        ));
    }

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

/// Decode the standard transfer layout, rejecting malformed or trailing data.
/// Confirmation uses this value, not caller-supplied JSON.
pub fn decode_transfer(data: &[u8]) -> Result<serde_json::Value, Error> {
    if data.len() < 33 {
        return Err(Error::Serialization("Truncated transfer".into()));
    }
    let from = u64_to_name(u64::from_le_bytes(data[..8].try_into().unwrap()));
    let to = u64_to_name(u64::from_le_bytes(data[8..16].try_into().unwrap()));
    let amount = i64::from_le_bytes(data[16..24].try_into().unwrap());
    let precision = data[24] as usize;
    if precision > 18 {
        return Err(Error::Serialization("Invalid asset precision".into()));
    }
    let symbol_end = data[25..32].iter().position(|b| *b == 0).unwrap_or(7) + 25;
    if data[symbol_end..32].iter().any(|b| *b != 0) {
        return Err(Error::Serialization("Invalid asset padding".into()));
    }
    let symbol = std::str::from_utf8(&data[25..symbol_end])
        .map_err(|e| Error::Serialization(e.to_string()))?;
    let mut digits = format!("{:0width$}", amount.unsigned_abs(), width = precision + 1);
    if precision > 0 {
        digits.insert(digits.len() - precision, '.');
    }
    if amount < 0 {
        digits.insert(0, '-');
    }
    let quantity = format!("{digits} {symbol}");
    let mut pos = 32;
    let memo_len = read_varuint32(data, &mut pos)? as usize;
    if memo_len != data.len().saturating_sub(pos) {
        return Err(Error::Serialization("Invalid transfer memo length".into()));
    }
    let memo =
        std::str::from_utf8(&data[pos..]).map_err(|e| Error::Serialization(e.to_string()))?;
    if serialize_transfer(&from, &to, &quantity, memo)? != data {
        return Err(Error::Serialization("Noncanonical transfer".into()));
    }
    Ok(serde_json::json!({ "from": from, "to": to, "quantity": quantity, "memo": memo }))
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

/// Serialize an Antelope / Wire `public_key`: `[type_byte][33 bytes compressed]`.
/// - `EOS...`, `FIO...`, `PUB_K1_...`, or raw 33-byte hex -> `[0x00, ..33_bytes]` (`K1`)
/// - `PUB_EM_...` (compressed or uncompressed) -> `[0x03, ..33_bytes]` (`EM`)
pub fn serialize_public_key(key: &str) -> Result<Vec<u8>, Error> {
    let (type_tag, compressed) = decode_typed_public_key(key.trim())
        .map_err(|e| Error::Serialization(format!("Invalid public key: {}", e)))?;
    let mut out = Vec::with_capacity(34);
    out.push(type_tag);
    out.extend_from_slice(&compressed);
    Ok(out)
}

/// Resolved authority key entry: `(key_type_tag, compressed_33_bytes, canonical_key_str, weight)`.
pub type SortedAuthorityKey = (u8, [u8; 33], String, u16);

/// Sort authority `(key_str, weight)` entries into canonical chain order:
/// ascending by `(key_type_tag, compressed_33_bytes)`, so `K1` (tag 0) sorts before `EM` (tag 3).
/// Also normalizes uncompressed `PUB_EM_04...` keys to compressed `PUB_EM_02/03...` and
/// rejects duplicate keys within the same authority.
pub fn sort_authority_keys(
    keys: &[(String, u16)],
) -> Result<Vec<SortedAuthorityKey>, Error> {
    let mut resolved = Vec::with_capacity(keys.len());
    for (key_str, weight) in keys {
        if *weight == 0 {
            return Err(Error::Serialization(
                "Authority key weight must be greater than 0".into(),
            ));
        }
        let (type_tag, compressed) = decode_typed_public_key(key_str)
            .map_err(|e| Error::Serialization(format!("Invalid authority key '{}': {}", key_str, e)))?;
        let canonical_str = match type_tag {
            KEY_TYPE_K1 => encode_k1_public_key_from_bytes(&compressed),
            KEY_TYPE_EM => encode_pub_em_from_bytes(&compressed)?,
            other => {
                return Err(Error::Serialization(format!(
                    "Unsupported public key type tag: {}",
                    other
                )))
            }
        };
        resolved.push((type_tag, compressed, canonical_str, *weight));
    }

    resolved.sort_by(|a, b| (a.0, &a.1).cmp(&(b.0, &b.1)));

    for pair in resolved.windows(2) {
        if pair[0].0 == pair[1].0 && pair[0].1 == pair[1].1 {
            return Err(Error::Serialization(format!(
                "Duplicate public key in authority: {}",
                pair[0].2
            )));
        }
    }

    Ok(resolved)
}

/// Serialize the data for `eosio::updateauth` / `sysio::updateauth`.
///
/// - Automatically sorts `keys` by `(key_type_tag, compressed_33_bytes)` and `accounts` by `(actor, permission)`.
/// - When `include_waits` is `false` (Wire / `sysio`), the `authority` struct is `{ threshold, keys, accounts }`.
/// - When `include_waits` is `true` (Antelope / `eosio` / `core.vaulta`), the `authority` struct includes `waits: wait_weight[]`.
/// - When `authorized_by` is `Some(name)` (non-empty, Wire optional binary extension), appends the 8-byte name.
#[allow(clippy::too_many_arguments)]
pub fn serialize_updateauth(
    account: &str,
    permission: &str,
    parent: &str,
    threshold: u32,
    keys: &[(String, u16)],
    accounts: &[(String, String, u16)],
    waits: Option<&[(u32, u16)]>,
    authorized_by: Option<&str>,
) -> Result<Vec<u8>, Error> {
    if threshold == 0 {
        return Err(Error::Serialization(
            "Authority threshold must be at least 1".into(),
        ));
    }

    let sorted_keys = sort_authority_keys(keys)?;

    let mut sorted_accounts: Vec<(u64, u64, &str, &str, u16)> =
        Vec::with_capacity(accounts.len());
    for (actor, perm, weight) in accounts {
        if *weight == 0 {
            return Err(Error::Serialization(
                "Authority account weight must be greater than 0".into(),
            ));
        }
        sorted_accounts.push((
            name_to_u64(actor)?,
            name_to_u64(perm)?,
            actor.as_str(),
            perm.as_str(),
            *weight,
        ));
    }
    sorted_accounts.sort_by_key(|a| (a.0, a.1));
    for pair in sorted_accounts.windows(2) {
        if pair[0].0 == pair[1].0 && pair[0].1 == pair[1].1 {
            return Err(Error::Serialization(format!(
                "Duplicate account permission in authority: {}@{}",
                pair[0].2, pair[0].3
            )));
        }
    }

    let total_weight: u64 = sorted_keys.iter().map(|k| k.3 as u64).sum::<u64>()
        + sorted_accounts.iter().map(|a| a.4 as u64).sum::<u64>()
        + waits
            .unwrap_or(&[])
            .iter()
            .map(|w| w.1 as u64)
            .sum::<u64>();
    if total_weight < threshold as u64 {
        return Err(Error::Serialization(format!(
            "Invalid authority: total weight ({}) is less than threshold ({})",
            total_weight, threshold
        )));
    }

    let mut data = Vec::with_capacity(64 + sorted_keys.len() * 36 + sorted_accounts.len() * 18);
    data.extend_from_slice(&serialize_name(account)?);
    data.extend_from_slice(&serialize_name(permission)?);
    data.extend_from_slice(&serialize_name(parent)?);

    // authority.threshold (uint32 LE)
    data.extend_from_slice(&threshold.to_le_bytes());

    // authority.keys (key_weight[])
    data.extend_from_slice(&serialize_varuint32(sorted_keys.len() as u32));
    for (type_tag, compressed, _canonical_str, weight) in &sorted_keys {
        data.push(*type_tag);
        data.extend_from_slice(compressed);
        data.extend_from_slice(&weight.to_le_bytes());
    }

    // authority.accounts (permission_level_weight[])
    data.extend_from_slice(&serialize_varuint32(sorted_accounts.len() as u32));
    for (actor_u64, perm_u64, _actor, _perm, weight) in &sorted_accounts {
        data.extend_from_slice(&actor_u64.to_le_bytes());
        data.extend_from_slice(&perm_u64.to_le_bytes());
        data.extend_from_slice(&weight.to_le_bytes());
    }

    // authority.waits (wait_weight[] — present on eosio/core.vaulta, omitted on sysio)
    if let Some(wait_list) = waits {
        let mut sorted_waits = wait_list.to_vec();
        sorted_waits.sort_by_key(|w| w.0);
        data.extend_from_slice(&serialize_varuint32(sorted_waits.len() as u32));
        for (wait_sec, weight) in &sorted_waits {
            data.extend_from_slice(&wait_sec.to_le_bytes());
            data.extend_from_slice(&weight.to_le_bytes());
        }
    }

    // Optional binary extension `authorized_by: name$` on sysio::updateauth
    if let Some(auth_by) = authorized_by.map(str::trim).filter(|s| !s.is_empty()) {
        data.extend_from_slice(&serialize_name(auth_by)?);
    }

    Ok(data)
}

/// Decode `updateauth` binary action data back into canonical JSON for WYSIWYS confirmation.
/// Rejects malformed, unsorted, or non-canonical payloads.
pub fn decode_updateauth(data: &[u8], is_sysio: bool) -> Result<serde_json::Value, Error> {
    if data.len() < 28 {
        return Err(Error::Serialization("Truncated updateauth".into()));
    }
    let mut pos = 0;
    let account = u64_to_name(read_u64_le(data, &mut pos)?);
    let permission = u64_to_name(read_u64_le(data, &mut pos)?);
    let parent = u64_to_name(read_u64_le(data, &mut pos)?);
    let threshold = read_u32_le(data, &mut pos)?;

    let key_count = read_varuint32(data, &mut pos)? as usize;
    let key_count = checked_list_count(key_count, data.len().saturating_sub(pos), 36)?;
    let mut keys = Vec::with_capacity(key_count);
    let mut keys_json = Vec::with_capacity(key_count);
    for _ in 0..key_count {
        let type_tag = read_u8(data, &mut pos)?;
        if pos + 33 > data.len() {
            return Err(Error::Serialization("Truncated key in updateauth".into()));
        }
        let raw_key = &data[pos..pos + 33];
        pos += 33;
        let key_str = match type_tag {
            KEY_TYPE_K1 => encode_k1_public_key_from_bytes(raw_key),
            KEY_TYPE_EM => encode_pub_em_from_bytes(raw_key)?,
            other => {
                return Err(Error::Serialization(format!(
                    "Unsupported key type tag {} in updateauth",
                    other
                )))
            }
        };
        let weight = read_u16_le(data, &mut pos)?;
        keys.push((key_str.clone(), weight));
        keys_json.push(serde_json::json!({
            "key": key_str,
            "weight": weight,
        }));
    }

    let acc_count = read_varuint32(data, &mut pos)? as usize;
    let acc_count = checked_list_count(acc_count, data.len().saturating_sub(pos), 18)?;
    let mut accounts = Vec::with_capacity(acc_count);
    let mut accounts_json = Vec::with_capacity(acc_count);
    for _ in 0..acc_count {
        let actor = u64_to_name(read_u64_le(data, &mut pos)?);
        let perm = u64_to_name(read_u64_le(data, &mut pos)?);
        let weight = read_u16_le(data, &mut pos)?;
        accounts.push((actor.clone(), perm.clone(), weight));
        accounts_json.push(serde_json::json!({
            "permission": { "actor": actor, "permission": perm },
            "weight": weight,
        }));
    }

    let (waits_opt, waits_json, authorized_by) = if is_sysio {
        let auth_by = if pos < data.len() {
            let name = u64_to_name(read_u64_le(data, &mut pos)?);
            if name.is_empty() {
                return Err(Error::Serialization(
                    "Invalid trailing zero authorized_by in sysio::updateauth".into(),
                ));
            }
            Some(name)
        } else {
            None
        };
        (None, None, auth_by)
    } else {
        let wait_count = read_varuint32(data, &mut pos)? as usize;
        let wait_count = checked_list_count(wait_count, data.len().saturating_sub(pos), 6)?;
        let mut waits = Vec::with_capacity(wait_count);
        let mut w_json = Vec::with_capacity(wait_count);
        for _ in 0..wait_count {
            let wait_sec = read_u32_le(data, &mut pos)?;
            let weight = read_u16_le(data, &mut pos)?;
            waits.push((wait_sec, weight));
            w_json.push(serde_json::json!({
                "wait_sec": wait_sec,
                "weight": weight,
            }));
        }
        (Some(waits), Some(w_json), None)
    };

    if pos != data.len() {
        return Err(Error::Serialization("Trailing bytes in updateauth".into()));
    }

    let reserialized = serialize_updateauth(
        &account,
        &permission,
        &parent,
        threshold,
        &keys,
        &accounts,
        waits_opt.as_deref(),
        authorized_by.as_deref(),
    )?;
    if reserialized != data {
        return Err(Error::Serialization(
            "Noncanonical or unsorted updateauth payload".into(),
        ));
    }

    let mut auth_obj = serde_json::json!({
        "threshold": threshold,
        "keys": keys_json,
        "accounts": accounts_json,
    });
    if let Some(w) = waits_json {
        auth_obj["waits"] = serde_json::Value::Array(w);
    }

    let mut out = serde_json::json!({
        "account": account,
        "permission": permission,
        "parent": parent,
        "auth": auth_obj,
    });
    if let Some(auth_by) = authorized_by {
        out["authorized_by"] = serde_json::Value::String(auth_by);
    }
    Ok(out)
}

/// Serialize the data for `eosio::deleteauth` / `sysio::deleteauth`.
pub fn serialize_deleteauth(
    account: &str,
    permission: &str,
    authorized_by: Option<&str>,
) -> Result<Vec<u8>, Error> {
    let mut data = Vec::with_capacity(24);
    data.extend_from_slice(&serialize_name(account)?);
    data.extend_from_slice(&serialize_name(permission)?);
    if let Some(auth_by) = authorized_by.map(str::trim).filter(|s| !s.is_empty()) {
        data.extend_from_slice(&serialize_name(auth_by)?);
    }
    Ok(data)
}

/// Serialize the data for `eosio::linkauth` / `sysio::linkauth`.
pub fn serialize_linkauth(
    account: &str,
    code: &str,
    action_type: &str,
    requirement: &str,
    authorized_by: Option<&str>,
) -> Result<Vec<u8>, Error> {
    let mut data = Vec::with_capacity(40);
    data.extend_from_slice(&serialize_name(account)?);
    data.extend_from_slice(&serialize_name(code)?);
    data.extend_from_slice(&serialize_name(action_type)?);
    data.extend_from_slice(&serialize_name(requirement)?);
    if let Some(auth_by) = authorized_by.map(str::trim).filter(|s| !s.is_empty()) {
        data.extend_from_slice(&serialize_name(auth_by)?);
    }
    Ok(data)
}

/// Serialize the data for `eosio::unlinkauth` / `sysio::unlinkauth`.
pub fn serialize_unlinkauth(
    account: &str,
    code: &str,
    action_type: &str,
    authorized_by: Option<&str>,
) -> Result<Vec<u8>, Error> {
    let mut data = Vec::with_capacity(32);
    data.extend_from_slice(&serialize_name(account)?);
    data.extend_from_slice(&serialize_name(code)?);
    data.extend_from_slice(&serialize_name(action_type)?);
    if let Some(auth_by) = authorized_by.map(str::trim).filter(|s| !s.is_empty()) {
        data.extend_from_slice(&serialize_name(auth_by)?);
    }
    Ok(data)
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
pub fn serialize_finkey_ref(finalizer_name: &str, finalizer_key: &str) -> Result<Vec<u8>, Error> {
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

// ── Packed transaction parser (for msig proposal inspection) ──

/// A single action extracted from a packed transaction.
pub struct ParsedAction {
    pub account: String,
    pub name: String,
    pub authorization: Vec<(String, String)>,
    pub data_hex: String,
}

/// Parsed header fields + action list from a packed_transaction blob.
pub struct ParsedTransaction {
    /// Unix timestamp (seconds since epoch).
    pub expiration: u32,
    pub ref_block_num: u16,
    pub ref_block_prefix: u32,
    pub max_net_usage_words: u32,
    pub max_cpu_usage_ms: u8,
    pub delay_sec: u32,
    pub context_free_actions: Vec<ParsedAction>,
    pub extension_count: usize,
    pub actions: Vec<ParsedAction>,
}

fn read_u8(bytes: &[u8], pos: &mut usize) -> Result<u8, Error> {
    if *pos >= bytes.len() {
        return Err(Error::Serialization("u8 truncated".into()));
    }
    let v = bytes[*pos];
    *pos += 1;
    Ok(v)
}

fn read_u16_le(bytes: &[u8], pos: &mut usize) -> Result<u16, Error> {
    if *pos + 2 > bytes.len() {
        return Err(Error::Serialization("u16 truncated".into()));
    }
    let v = u16::from_le_bytes([bytes[*pos], bytes[*pos + 1]]);
    *pos += 2;
    Ok(v)
}

fn read_u32_le(bytes: &[u8], pos: &mut usize) -> Result<u32, Error> {
    if *pos + 4 > bytes.len() {
        return Err(Error::Serialization("u32 truncated".into()));
    }
    let v = u32::from_le_bytes([
        bytes[*pos],
        bytes[*pos + 1],
        bytes[*pos + 2],
        bytes[*pos + 3],
    ]);
    *pos += 4;
    Ok(v)
}

fn read_u64_le(bytes: &[u8], pos: &mut usize) -> Result<u64, Error> {
    if *pos + 8 > bytes.len() {
        return Err(Error::Serialization("u64 truncated".into()));
    }
    let mut arr = [0u8; 8];
    arr.copy_from_slice(&bytes[*pos..*pos + 8]);
    *pos += 8;
    Ok(u64::from_le_bytes(arr))
}

/// SEC-043: maximum element count we will accept for any varuint32-prefixed list
/// in a packed transaction. `act_count`/`auth_count`/`cfa_count` are varuint32
/// (up to ~4.29B) fed straight into `Vec::with_capacity`; an attacker-crafted
/// proposal could request a multi-GB allocation → `handle_alloc_error`/abort.
/// Real transactions have a handful of actions/authorizations; 1024 is generous.
const MAX_PACKED_TX_LIST: usize = 1024;

/// SEC-043: maximum total packed_transaction size we will parse (bytes).
/// Bounds the whole untrusted input independent of declared counts.
const MAX_PACKED_TX_BYTES: usize = 1024 * 1024; // 1 MiB

/// SEC-043: reject an implausible element count before any allocation. Also
/// rejects counts that cannot possibly fit in the remaining buffer (each list
/// element consumes at least `min_element_size` bytes), so we never pre-size a
/// collection from an untrusted count that the buffer cannot back.
fn checked_list_count(
    count: usize,
    remaining: usize,
    min_element_size: usize,
) -> Result<usize, Error> {
    if count > MAX_PACKED_TX_LIST {
        return Err(Error::Serialization(format!(
            "implausible element count {} (max {})",
            count, MAX_PACKED_TX_LIST
        )));
    }
    if min_element_size > 0 && count.saturating_mul(min_element_size) > remaining {
        return Err(Error::Serialization(
            "declared element count exceeds remaining buffer".into(),
        ));
    }
    Ok(count)
}

fn read_action(bytes: &[u8], pos: &mut usize) -> Result<ParsedAction, Error> {
    let account = u64_to_name(read_u64_le(bytes, pos)?);
    let name = u64_to_name(read_u64_le(bytes, pos)?);
    let auth_count = read_varuint32(bytes, pos)? as usize;
    // SEC-043: each authorization is two u64 names = 16 bytes minimum.
    let auth_count = checked_list_count(auth_count, bytes.len().saturating_sub(*pos), 16)?;
    let mut authorization = Vec::with_capacity(auth_count);
    for _ in 0..auth_count {
        let actor = u64_to_name(read_u64_le(bytes, pos)?);
        let permission = u64_to_name(read_u64_le(bytes, pos)?);
        authorization.push((actor, permission));
    }
    let data_len = read_varuint32(bytes, pos)? as usize;
    if *pos + data_len > bytes.len() {
        return Err(Error::Serialization("action data truncated".into()));
    }
    let data_hex = hex_encode(&bytes[*pos..*pos + data_len]);
    *pos += data_len;
    Ok(ParsedAction {
        account,
        name,
        authorization,
        data_hex,
    })
}

/// Parse a packed transaction (as stored in `eosio.msig::proposal::packed_transaction`).
/// Extracts expiration + actions; skips extensions and unused fields.
pub fn parse_packed_transaction(bytes: &[u8]) -> Result<ParsedTransaction, Error> {
    // SEC-043: bound the total accepted packed_transaction size before parsing.
    if bytes.len() > MAX_PACKED_TX_BYTES {
        return Err(Error::Serialization(format!(
            "packed_transaction too large: {} bytes (max {})",
            bytes.len(),
            MAX_PACKED_TX_BYTES
        )));
    }
    let mut pos = 0;
    let expiration = read_u32_le(bytes, &mut pos)?;
    let ref_block_num = read_u16_le(bytes, &mut pos)?;
    let ref_block_prefix = read_u32_le(bytes, &mut pos)?;
    let max_net_usage_words = read_varuint32(bytes, &mut pos)?;
    let max_cpu_usage_ms = read_u8(bytes, &mut pos)?;
    let delay_sec = read_varuint32(bytes, &mut pos)?;
    let cfa_count = read_varuint32(bytes, &mut pos)? as usize;
    // SEC-043: an action is at least 17 bytes (2 u64 names + 1 varuint auth count).
    let cfa_count = checked_list_count(cfa_count, bytes.len().saturating_sub(pos), 17)?;
    let mut context_free_actions = Vec::with_capacity(cfa_count);
    for _ in 0..cfa_count {
        context_free_actions.push(read_action(bytes, &mut pos)?);
    }
    let act_count = read_varuint32(bytes, &mut pos)? as usize;
    // SEC-043: reject implausible counts and avoid pre-sizing from untrusted input.
    let act_count = checked_list_count(act_count, bytes.len().saturating_sub(pos), 17)?;
    let mut actions = Vec::with_capacity(act_count);
    for _ in 0..act_count {
        actions.push(read_action(bytes, &mut pos)?);
    }
    let extension_count = read_varuint32(bytes, &mut pos)? as usize;
    let extension_count = checked_list_count(extension_count, bytes.len().saturating_sub(pos), 3)?;
    for _ in 0..extension_count {
        let _kind = read_u16_le(bytes, &mut pos)?;
        let len = read_varuint32(bytes, &mut pos)? as usize;
        if len > bytes.len().saturating_sub(pos) {
            return Err(Error::Serialization("Truncated extension".into()));
        }
        pos += len;
    }
    if pos != bytes.len() {
        return Err(Error::Serialization("Trailing transaction bytes".into()));
    }
    Ok(ParsedTransaction {
        expiration,
        actions,
        ref_block_num,
        ref_block_prefix,
        max_net_usage_words,
        max_cpu_usage_ms,
        delay_sec,
        context_free_actions,
        extension_count,
    })
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
    if block_id_hex.len() < 24 || !block_id_hex.is_ascii() {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_names_that_would_change_the_signed_recipient() {
        for recipient in ["abcdefghijklz", "abcdefghijklaa", "é", "alice/other"] {
            assert!(
                serialize_transfer("alice", recipient, "1.0000 EOS", "").is_err(),
                "{recipient}"
            );
        }
        for recipient in ["abcdefghijklj", "abcdefghijkl5", "bob"] {
            let bytes = serialize_transfer("alice", recipient, "1.0000 EOS", "").unwrap();
            assert_eq!(
                u64_to_name(u64::from_le_bytes(bytes[8..16].try_into().unwrap())),
                recipient
            );
        }
    }

    #[test]
    fn rejects_assets_that_cannot_be_represented_exactly() {
        for asset in [
            "1.2.3 EOS",
            "1. EOS",
            ".1 EOS",
            "1.0000 TOOLONGSYM",
            "1 eos",
            "1 EÖS",
            "4611686018427387904 EOS",
            "0.0000000000000000000 EOS",
        ] {
            assert!(serialize_asset(asset).is_err(), "{asset}");
        }
    }

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
    fn u64_to_name_roundtrip() {
        for n in [
            "eosio",
            "eosio.token",
            "alice",
            "bob",
            "eosriobrazil",
            "a",
            "",
        ] {
            let encoded = name_to_u64(n).unwrap();
            assert_eq!(u64_to_name(encoded), n, "roundtrip failed for {:?}", n);
        }
    }

    #[test]
    fn read_varuint32_matches_writer() {
        for v in [0u32, 1, 127, 128, 300, 16384, 1_000_000] {
            let bytes = serialize_varuint32(v);
            let mut pos = 0;
            let back = read_varuint32(&bytes, &mut pos).unwrap();
            assert_eq!(back, v);
            assert_eq!(pos, bytes.len());
        }
    }

    #[test]
    fn parse_packed_transaction_roundtrip() {
        // Build a known transaction, pack it, re-parse, verify fields match.
        let transfer_data = serialize_transfer("alice", "bob", "1.0000 EOS", "hi").unwrap();
        let data_hex = hex_encode(&transfer_data);
        let packed_action =
            serialize_action("eosio.token", "transfer", &[("alice", "active")], &data_hex).unwrap();
        let tx = RawTransaction {
            expiration: 1_700_000_000,
            ref_block_num: 100,
            ref_block_prefix: 200,
            max_net_usage_words: 0,
            max_cpu_usage_ms: 0,
            delay_sec: 0,
            context_free_actions: vec![],
            actions: vec![packed_action],
            transaction_extensions: vec![],
        };
        let packed = tx.serialize();
        let parsed = parse_packed_transaction(&packed).unwrap();
        assert_eq!(parsed.expiration, 1_700_000_000);
        assert_eq!(parsed.actions.len(), 1);
        assert_eq!(parsed.actions[0].account, "eosio.token");
        assert_eq!(parsed.actions[0].name, "transfer");
        assert_eq!(
            parsed.actions[0].authorization,
            vec![("alice".into(), "active".into())]
        );
        assert_eq!(parsed.actions[0].data_hex, data_hex);
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

    #[test]
    fn wire_em_updateauth_and_packed_trx_match_test_vector() {
        let pub_k1 = "PUB_K1_6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5BoDq63";
        let pub_em =
            "PUB_EM_031d483a28813838ddc6a048085ac2eef13a12d8a6e6324eb10c3bc5c272f91f56";
        let pub_em_uncompressed = "PUB_EM_041d483a28813838ddc6a048085ac2eef13a12d8a6e6324eb10c3bc5c272f91f5690c18f11f86b00510150f402ba01b72fa2becc9c132001304e518ae65a951827";
        let expected_pub_em_wire_hex =
            "03031d483a28813838ddc6a048085ac2eef13a12d8a6e6324eb10c3bc5c272f91f56";
        let expected_action_data_hex = "0000000000855c3400000000a8ed32320000000080ab26a701000000020002c0ded2bc1f1305fb0faac5e6c03ee3a1924234985427b6167ca569d13df435cf010003031d483a28813838ddc6a048085ac2eef13a12d8a6e6324eb10c3bc5c272f91f56010000";
        let expected_packed_trx_hex = "00b9556901000200000000000000010000000000eab0c70040cbdaa86c52d5010000000000855c340000000080ab26a7660000000000855c3400000000a8ed32320000000080ab26a701000000020002c0ded2bc1f1305fb0faac5e6c03ee3a1924234985427b6167ca569d13df435cf010003031d483a28813838ddc6a048085ac2eef13a12d8a6e6324eb10c3bc5c272f91f5601000000";

        // 1. PUB_EM_ wire binary encoding (compressed and uncompressed produce identical 34 bytes)
        assert_eq!(
            hex_encode(&serialize_public_key(pub_em).unwrap()),
            expected_pub_em_wire_hex
        );
        assert_eq!(
            hex_encode(&serialize_public_key(pub_em_uncompressed).unwrap()),
            expected_pub_em_wire_hex
        );

        // 2. serialize_updateauth produces exact action_data_hex when passed sorted,
        //    reversed (auto-sorted), or with uncompressed PUB_EM_04...
        let sorted_keys = vec![(pub_k1.to_string(), 1u16), (pub_em.to_string(), 1u16)];
        let reversed_keys = vec![
            (pub_em_uncompressed.to_string(), 1u16),
            (pub_k1.to_string(), 1u16),
        ];

        let data_sorted =
            serialize_updateauth("alice", "active", "owner", 1, &sorted_keys, &[], None, None)
                .unwrap();
        let data_reversed = serialize_updateauth(
            "alice",
            "active",
            "owner",
            1,
            &reversed_keys,
            &[],
            None,
            None,
        )
        .unwrap();

        assert_eq!(hex_encode(&data_sorted), expected_action_data_hex);
        assert_eq!(hex_encode(&data_reversed), expected_action_data_hex);

        // 3. decode_updateauth round-trips cleanly and rejects unsorted bytes
        let decoded = decode_updateauth(&data_sorted, true).unwrap();
        assert_eq!(decoded["account"], "alice");
        assert_eq!(decoded["permission"], "active");
        assert_eq!(decoded["parent"], "owner");
        assert_eq!(decoded["auth"]["threshold"], 1);
        assert_eq!(decoded["auth"]["keys"][0]["key"], pub_k1);
        assert_eq!(decoded["auth"]["keys"][1]["key"], pub_em);

        // 4. Packed transaction matches em-test-vector.json byte-for-byte
        //    "2026-01-01T00:00:00" UTC = 1767225600 (0x6955b900 -> LE 00b95569)
        let action_bytes = serialize_action(
            "sysio",
            "updateauth",
            &[("alice", "owner")],
            expected_action_data_hex,
        )
        .unwrap();
        let tx = RawTransaction {
            expiration: 1_767_225_600,
            ref_block_num: 1,
            ref_block_prefix: 2,
            max_net_usage_words: 0,
            max_cpu_usage_ms: 0,
            delay_sec: 0,
            context_free_actions: vec![],
            actions: vec![action_bytes],
            transaction_extensions: vec![],
        };
        assert_eq!(hex_encode(&tx.serialize()), expected_packed_trx_hex);
    }
}
