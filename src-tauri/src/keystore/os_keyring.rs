use keyring::Entry;

const SERVICE_NAME: &str = "simpleos";

/// Build a keyring entry key from chain_id and public_key.
fn entry_key(chain_id: &str, public_key: &str) -> String {
    format!("{}:{}", chain_id, public_key)
}

/// Store an encrypted private key blob in the OS keychain.
pub fn store_key(
    chain_id: &str,
    public_key: &str,
    encrypted: &[u8],
) -> Result<(), crate::error::Error> {
    let key = entry_key(chain_id, public_key);
    let entry =
        Entry::new(SERVICE_NAME, &key).map_err(|e| crate::error::Error::Keyring(e.to_string()))?;

    // Store as base64 since keyring expects strings on some platforms
    let encoded = base64_encode(encrypted);
    entry
        .set_password(&encoded)
        .map_err(|e| crate::error::Error::Keyring(e.to_string()))?;

    Ok(())
}

/// Load an encrypted private key blob from the OS keychain.
pub fn load_key(chain_id: &str, public_key: &str) -> Result<Vec<u8>, crate::error::Error> {
    let key = entry_key(chain_id, public_key);
    let entry =
        Entry::new(SERVICE_NAME, &key).map_err(|e| crate::error::Error::Keyring(e.to_string()))?;

    let encoded = entry
        .get_password()
        .map_err(|e| crate::error::Error::KeyNotFound(e.to_string()))?;

    base64_decode(&encoded)
        .map_err(|e| crate::error::Error::Keyring(format!("Base64 decode error: {}", e)))
}

/// Delete a key from the OS keychain.
pub fn delete_key(chain_id: &str, public_key: &str) -> Result<(), crate::error::Error> {
    let key = entry_key(chain_id, public_key);
    let entry =
        Entry::new(SERVICE_NAME, &key).map_err(|e| crate::error::Error::Keyring(e.to_string()))?;

    entry
        .delete_credential()
        .map_err(|e| crate::error::Error::Keyring(e.to_string()))?;

    Ok(())
}

/// List all stored public keys for a given chain.
/// Note: OS keyrings don't support enumeration natively.
/// We maintain a separate index entry per chain.
pub fn list_keys(chain_id: &str) -> Result<Vec<String>, crate::error::Error> {
    let index_key = format!("index:{}", chain_id);
    let entry = Entry::new(SERVICE_NAME, &index_key)
        .map_err(|e| crate::error::Error::Keyring(e.to_string()))?;

    match entry.get_password() {
        Ok(json) => {
            let keys: Vec<String> = serde_json::from_str(&json)
                .map_err(|e| crate::error::Error::Serialization(e.to_string()))?;
            Ok(keys)
        }
        Err(_) => Ok(Vec::new()),
    }
}

/// Add a public key to the chain's key index.
pub fn add_to_index(chain_id: &str, public_key: &str) -> Result<(), crate::error::Error> {
    let mut keys = list_keys(chain_id)?;
    if !keys.contains(&public_key.to_string()) {
        keys.push(public_key.to_string());
    }

    let index_key = format!("index:{}", chain_id);
    let entry = Entry::new(SERVICE_NAME, &index_key)
        .map_err(|e| crate::error::Error::Keyring(e.to_string()))?;

    let json = serde_json::to_string(&keys)
        .map_err(|e| crate::error::Error::Serialization(e.to_string()))?;
    entry
        .set_password(&json)
        .map_err(|e| crate::error::Error::Keyring(e.to_string()))?;

    Ok(())
}

/// Delete the entire key index entry for a chain from the OS credential store.
/// SEC-028: used by wallet reset so no per-chain index entries are left behind.
pub fn delete_index(chain_id: &str) -> Result<(), crate::error::Error> {
    let index_key = format!("index:{}", chain_id);
    let entry = Entry::new(SERVICE_NAME, &index_key)
        .map_err(|e| crate::error::Error::Keyring(e.to_string()))?;
    // Missing entry is fine — nothing to clear.
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(crate::error::Error::Keyring(e.to_string())),
    }
}

/// Remove a public key from the chain's key index.
pub fn remove_from_index(chain_id: &str, public_key: &str) -> Result<(), crate::error::Error> {
    let mut keys = list_keys(chain_id)?;
    keys.retain(|k| k != public_key);

    let index_key = format!("index:{}", chain_id);
    let entry = Entry::new(SERVICE_NAME, &index_key)
        .map_err(|e| crate::error::Error::Keyring(e.to_string()))?;

    let json = serde_json::to_string(&keys)
        .map_err(|e| crate::error::Error::Serialization(e.to_string()))?;
    entry
        .set_password(&json)
        .map_err(|e| crate::error::Error::Keyring(e.to_string()))?;

    Ok(())
}

// Simple base64 encode/decode without pulling in a crate
fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let n = (b0 << 16) | (b1 << 8) | b2;
        result.push(CHARS[((n >> 18) & 0x3F) as usize] as char);
        result.push(CHARS[((n >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            result.push(CHARS[((n >> 6) & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARS[(n & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    let input = input.trim_end_matches('=');
    let mut result = Vec::with_capacity(input.len() * 3 / 4);

    fn char_to_val(c: u8) -> Result<u32, String> {
        match c {
            b'A'..=b'Z' => Ok((c - b'A') as u32),
            b'a'..=b'z' => Ok((c - b'a' + 26) as u32),
            b'0'..=b'9' => Ok((c - b'0' + 52) as u32),
            b'+' => Ok(62),
            b'/' => Ok(63),
            _ => Err(format!("Invalid base64 character: {}", c as char)),
        }
    }

    let bytes = input.as_bytes();
    let chunks = bytes.chunks(4);
    for chunk in chunks {
        let mut n: u32 = 0;
        for (i, &b) in chunk.iter().enumerate() {
            n |= char_to_val(b)? << (18 - 6 * i);
        }
        result.push((n >> 16) as u8);
        if chunk.len() > 2 {
            result.push((n >> 8) as u8);
        }
        if chunk.len() > 3 {
            result.push(n as u8);
        }
    }

    Ok(result)
}
