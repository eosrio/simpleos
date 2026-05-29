//! Ledger USB HID transport layer.
//!
//! Handles the HID packet framing protocol used by all Ledger devices.
//! Each APDU is split into 64-byte HID reports with a channel/sequence header.

use crate::error::Error;
use hidapi::{HidApi, HidDevice};

/// Ledger USB vendor ID.
const LEDGER_VID: u16 = 0x2C97;

/// HID channel used for APDU framing.
const CHANNEL: u16 = 0x0101;

/// Tag byte for APDU messages.
const TAG_APDU: u8 = 0x05;

/// HID report size (Ledger always uses 64-byte reports + 1 byte report ID on some platforms).
const PACKET_SIZE: usize = 64;

/// APDU command structure.
pub struct Apdu {
    pub cla: u8,
    pub ins: u8,
    pub p1: u8,
    pub p2: u8,
    pub data: Vec<u8>,
}

/// Open a connection to any connected Ledger device.
pub fn open_ledger() -> Result<HidDevice, Error> {
    let api = HidApi::new().map_err(|e| Error::Ledger(format!("Failed to init HID: {}", e)))?;

    // Try all known Ledger product IDs (Nano S, S+, X, Stax, Flex)
    for device_info in api.device_list() {
        if device_info.vendor_id() == LEDGER_VID {
            // Filter to the FIDO/generic HID interface (interface 0 on most, 2 on Nano X)
            if let Ok(device) = device_info.open_device(&api) {
                return Ok(device);
            }
        }
    }

    Err(Error::Ledger(
        "No Ledger device found. Is it connected and unlocked?".into(),
    ))
}

/// List connected Ledger devices. Returns product strings.
pub fn list_ledgers() -> Result<Vec<String>, Error> {
    let api = HidApi::new().map_err(|e| Error::Ledger(format!("Failed to init HID: {}", e)))?;

    let mut devices = Vec::new();
    for info in api.device_list() {
        if info.vendor_id() == LEDGER_VID {
            let name = info.product_string().unwrap_or("Ledger Device");
            devices.push(name.to_string());
        }
    }
    Ok(devices)
}

/// Send an APDU command and receive the response.
/// Handles HID packet framing (split into 64-byte chunks with sequence numbers).
pub fn exchange(device: &HidDevice, apdu: &Apdu) -> Result<Vec<u8>, Error> {
    let raw = serialize_apdu(apdu);
    send_raw(device, &raw)?;
    recv_raw(device)
}

/// Serialize an APDU into the wire format (before HID framing).
fn serialize_apdu(apdu: &Apdu) -> Vec<u8> {
    let mut buf = Vec::with_capacity(5 + apdu.data.len());
    buf.push(apdu.cla);
    buf.push(apdu.ins);
    buf.push(apdu.p1);
    buf.push(apdu.p2);
    buf.push(apdu.data.len() as u8);
    buf.extend_from_slice(&apdu.data);
    buf
}

/// Send raw APDU bytes over HID with Ledger framing.
fn send_raw(device: &HidDevice, data: &[u8]) -> Result<(), Error> {
    let total_len = data.len();
    let mut offset = 0usize;
    let mut seq: u16 = 0;

    while offset < total_len || seq == 0 {
        let mut packet = vec![0u8; PACKET_SIZE + 1]; // +1 for HID report ID (0x00)
        let mut pos = 1; // skip report ID byte

        // Header: channel (2 bytes) + tag (1 byte) + sequence (2 bytes)
        packet[pos] = (CHANNEL >> 8) as u8;
        packet[pos + 1] = (CHANNEL & 0xFF) as u8;
        pos += 2;
        packet[pos] = TAG_APDU;
        pos += 1;
        packet[pos] = (seq >> 8) as u8;
        packet[pos + 1] = (seq & 0xFF) as u8;
        pos += 2;

        // First packet includes total length (2 bytes)
        if seq == 0 {
            packet[pos] = (total_len >> 8) as u8;
            packet[pos + 1] = (total_len & 0xFF) as u8;
            pos += 2;
        }

        // Fill remaining space with data
        let remaining_space = PACKET_SIZE + 1 - pos;
        let chunk_len = std::cmp::min(remaining_space, total_len - offset);
        if chunk_len > 0 {
            packet[pos..pos + chunk_len].copy_from_slice(&data[offset..offset + chunk_len]);
            offset += chunk_len;
        }

        device
            .write(&packet)
            .map_err(|e| Error::Ledger(format!("HID write failed: {}", e)))?;

        seq += 1;
    }

    Ok(())
}

/// Receive a framed APDU response from the Ledger.
fn recv_raw(device: &HidDevice) -> Result<Vec<u8>, Error> {
    let mut result = Vec::new();
    let mut expected_len: usize = 0;
    let mut seq: u16 = 0;

    loop {
        let mut packet = vec![0u8; PACKET_SIZE + 1];
        let read = device
            .read_timeout(&mut packet, 30_000) // 30 second timeout
            .map_err(|e| Error::Ledger(format!("HID read failed: {}", e)))?;

        if read == 0 {
            return Err(Error::Ledger("Ledger communication timeout".into()));
        }

        let mut pos = 0;

        // Some platforms include report ID byte, some don't
        if packet[0] == 0x00 {
            pos = 1;
        }

        // Verify channel
        let ch = ((packet[pos] as u16) << 8) | (packet[pos + 1] as u16);
        pos += 2;
        if ch != CHANNEL {
            continue; // not our channel, skip
        }

        // Verify tag
        if packet[pos] != TAG_APDU {
            continue;
        }
        pos += 1;

        // Verify sequence
        let pkt_seq = ((packet[pos] as u16) << 8) | (packet[pos + 1] as u16);
        pos += 2;
        if pkt_seq != seq {
            return Err(Error::Ledger(format!(
                "Sequence mismatch: expected {}, got {}",
                seq, pkt_seq
            )));
        }

        // First packet has total length
        if seq == 0 {
            expected_len = ((packet[pos] as usize) << 8) | (packet[pos + 1] as usize);
            pos += 2;
        }

        // Copy data
        let remaining = expected_len - result.len();
        let available = read - pos;
        let chunk_len = std::cmp::min(remaining, available);
        result.extend_from_slice(&packet[pos..pos + chunk_len]);

        if result.len() >= expected_len {
            break;
        }

        seq += 1;
    }

    // Last 2 bytes are the status word (SW)
    if result.len() < 2 {
        return Err(Error::Ledger("Response too short".into()));
    }

    let sw = ((result[result.len() - 2] as u16) << 8) | (result[result.len() - 1] as u16);
    let data = result[..result.len() - 2].to_vec();

    match sw {
        0x9000 => Ok(data), // Success
        0x6985 => Err(Error::Ledger("User rejected the request on device".into())),
        0x6A82 => Err(Error::Ledger("EOS app not open on Ledger".into())),
        0x6D00 => Err(Error::Ledger(
            "Unknown command. Is the EOS app open?".into(),
        )),
        0x6E00 => Err(Error::Ledger(
            "Wrong app. Please open the EOS app on your Ledger".into(),
        )),
        0x6B00 => Err(Error::Ledger("Invalid parameter".into())),
        _ => Err(Error::Ledger(format!("Ledger error: 0x{:04X}", sw))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_apdu_serialization() {
        let apdu = Apdu {
            cla: 0xD4,
            ins: 0x02,
            p1: 0x00,
            p2: 0x00,
            data: vec![0x03, 0x80, 0x00, 0x00, 0x2C],
        };
        let raw = serialize_apdu(&apdu);
        assert_eq!(raw[0], 0xD4);
        assert_eq!(raw[1], 0x02);
        assert_eq!(raw[4], 5); // data length
    }
}
