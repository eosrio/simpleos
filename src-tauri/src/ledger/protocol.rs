//! EOS Ledger app APDU protocol.
//!
//! Based on VaultaFoundation/ledger-app source code.
//! CLA=0xD4, INS: 0x02 (get key), 0x04 (sign), 0x06 (get config).

use super::transport::{exchange, open_ledger, Apdu};
use crate::antelope::signing;
use crate::error::Error;

const CLA: u8 = 0xD4;
const INS_GET_PUBLIC_KEY: u8 = 0x02;
const INS_SIGN: u8 = 0x04;
const INS_GET_APP_CONFIGURATION: u8 = 0x06;

const P1_CONFIRM: u8 = 0x01;
const P1_NON_CONFIRM: u8 = 0x00;
const P1_FIRST: u8 = 0x00;
const P1_MORE: u8 = 0x80;
const P2_NO_CHAINCODE: u8 = 0x00;

/// BIP44 path for EOS: m/44'/194'/0'/0/{index}
pub fn eos_bip44_path(account: u32, index: u32) -> Vec<u32> {
    vec![
        0x8000002C,           // 44'
        0x800000C2,           // 194'
        0x80000000 | account, // account'
        0,                    // change (always 0)
        index,                // address index
    ]
}

/// Serialize a BIP32 path as bytes for the APDU data field.
/// Format: [path_length: u8] [component: u32 BE] ...
fn serialize_path(path: &[u32]) -> Vec<u8> {
    let mut data = Vec::with_capacity(1 + path.len() * 4);
    data.push(path.len() as u8);
    for component in path {
        data.extend_from_slice(&component.to_be_bytes());
    }
    data
}

/// Get the EOS app configuration from the Ledger.
/// Returns (allow_unknown_actions, verbose_mode, major, minor, patch).
pub fn get_app_configuration() -> Result<(bool, bool, u8, u8, u8), Error> {
    let device = open_ledger()?;
    let response = exchange(
        &device,
        &Apdu {
            cla: CLA,
            ins: INS_GET_APP_CONFIGURATION,
            p1: 0,
            p2: 0,
            data: vec![],
        },
    )?;

    if response.len() < 5 {
        return Err(Error::Ledger("Invalid app configuration response".into()));
    }

    Ok((
        response[0] != 0, // allow unknown actions
        response[1] != 0, // verbose mode
        response[2],      // major version
        response[3],      // minor version
        response[4],      // patch version
    ))
}

/// Get a public key from the Ledger at the given BIP44 path.
///
/// If `confirm` is true, the user must confirm on the device screen.
/// Returns the EOS public key string (e.g., "EOS6MRy...").
pub fn get_public_key(path: &[u32], confirm: bool) -> Result<String, Error> {
    let device = open_ledger()?;

    let response = exchange(
        &device,
        &Apdu {
            cla: CLA,
            ins: INS_GET_PUBLIC_KEY,
            p1: if confirm { P1_CONFIRM } else { P1_NON_CONFIRM },
            p2: P2_NO_CHAINCODE,
            data: serialize_path(path),
        },
    )?;

    // Response format:
    // [pubkey_len: u8] [pubkey: 65 bytes uncompressed] [address_len: u8] [address: N bytes]
    if response.len() < 2 {
        return Err(Error::Ledger("Invalid public key response".into()));
    }

    let pk_len = response[0] as usize;
    if response.len() < 1 + pk_len + 1 {
        return Err(Error::Ledger("Public key response too short".into()));
    }

    let address_len = response[1 + pk_len] as usize;
    let address_start = 1 + pk_len + 1;

    if response.len() < address_start + address_len {
        return Err(Error::Ledger("Address in response too short".into()));
    }

    // The address is already in EOS public key format (e.g., "EOS6MRy...")
    let address = String::from_utf8(response[address_start..address_start + address_len].to_vec())
        .map_err(|_| Error::Ledger("Invalid address encoding".into()))?;

    Ok(address)
}

/// Discover all public keys from the Ledger across multiple BIP44 slots.
/// Scans account=0, indices 0..max_index.
pub fn discover_keys(max_index: u32) -> Result<Vec<(Vec<u32>, String)>, Error> {
    let mut keys = Vec::new();

    for index in 0..max_index {
        let path = eos_bip44_path(0, index);
        match get_public_key(&path, false) {
            Ok(pubkey) => keys.push((path, pubkey)),
            Err(_) => break, // Stop on first error (device disconnected, etc.)
        }
    }

    Ok(keys)
}

/// Sign a transaction hash using the Ledger.
///
/// The `data` should be: chain_id (32 bytes) + serialized_transaction + 32 zero bytes.
/// This is sent in chunks (first chunk includes the BIP44 path).
///
/// Returns the signature in SIG_K1_ format.
pub fn sign_transaction(path: &[u32], data: &[u8]) -> Result<String, Error> {
    let device = open_ledger()?;

    // First chunk: path + beginning of transaction data
    let path_data = serialize_path(path);
    let max_first_chunk = 255 - path_data.len();
    let first_chunk_len = std::cmp::min(max_first_chunk, data.len());

    let mut first_data = path_data;
    first_data.extend_from_slice(&data[..first_chunk_len]);

    let mut response = exchange(
        &device,
        &Apdu {
            cla: CLA,
            ins: INS_SIGN,
            p1: P1_FIRST,
            p2: 0x00,
            data: first_data,
        },
    )?;

    // Send remaining chunks
    let mut offset = first_chunk_len;
    while offset < data.len() {
        let chunk_len = std::cmp::min(255, data.len() - offset);
        response = exchange(
            &device,
            &Apdu {
                cla: CLA,
                ins: INS_SIGN,
                p1: P1_MORE,
                p2: 0x00,
                data: data[offset..offset + chunk_len].to_vec(),
            },
        )?;
        offset += chunk_len;
    }

    // Response: [v: 1 byte] [r: 32 bytes] [s: 32 bytes] = 65 bytes
    // SEC-019: require exactly 65 bytes (not just >= 65) so r/s are unambiguous.
    if response.len() != 65 {
        return Err(Error::Ledger("Unexpected signature response length".into()));
    }

    let v = response[0];
    let r = &response[1..33];
    let s = &response[33..65];

    // SEC-019: validate the device-supplied recovery byte before subtracting.
    // Ledger returns v = 31 or 32 (= recid 0/1 + 27 + 4). A hostile/buggy device
    // sending v < 31 would underflow `v - 27 - 4` (wraps in release, no overflow-checks).
    let recid = v
        .checked_sub(31)
        .filter(|r| *r <= 3)
        .ok_or_else(|| Error::Ledger("Unexpected recovery byte".into()))?;

    // Encode as SIG_K1_
    let mut sig_data = Vec::with_capacity(65);
    sig_data.push(recid); // recovery id (Ledger returns 31 or 32, we need 0 or 1)
    sig_data.extend_from_slice(r);
    sig_data.extend_from_slice(s);

    // Add K1 checksum (RIPEMD160 of sig_data + "K1")
    let mut check_buf = sig_data.clone();
    check_buf.extend_from_slice(b"K1");
    let checksum = signing::ripemd160(&check_buf);
    sig_data.extend_from_slice(&checksum[..4]);

    Ok(format!("SIG_K1_{}", signing::bs58_encode(&sig_data)))
}
