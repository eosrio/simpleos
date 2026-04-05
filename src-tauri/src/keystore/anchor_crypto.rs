//! Anchor wallet decryption.
//!
//! Anchor (by Greymass) encrypts its storage using a non-standard Rijndael
//! configuration from CryptoJS v3.1.9:
//!
//!   - Key derivation: PBKDF2-HMAC-SHA1, 4500 iterations, 16-byte salt → 256-byte key
//!   - Cipher: Rijndael with 128-bit blocks and 256-byte (2048-bit) key → 70 rounds
//!   - Mode: CBC with PKCS7 padding
//!
//! Standard AES-256 crates only support 32-byte keys (14 rounds). This module
//! implements the variable-key-size Rijndael key schedule and block cipher
//! needed to decrypt Anchor backups.
//!
//! Encrypted string format: `<32 hex salt><32 hex IV><base64 ciphertext>`

use zeroize::Zeroize;

// ── Rijndael constants ──

/// AES S-Box (SubBytes)
const SBOX: [u8; 256] = [
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
];

/// Inverse S-Box (InvSubBytes)
const INV_SBOX: [u8; 256] = [
    0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38, 0xbf, 0x40, 0xa3, 0x9e, 0x81, 0xf3, 0xd7, 0xfb,
    0x7c, 0xe3, 0x39, 0x82, 0x9b, 0x2f, 0xff, 0x87, 0x34, 0x8e, 0x43, 0x44, 0xc4, 0xde, 0xe9, 0xcb,
    0x54, 0x7b, 0x94, 0x32, 0xa6, 0xc2, 0x23, 0x3d, 0xee, 0x4c, 0x95, 0x0b, 0x42, 0xfa, 0xc3, 0x4e,
    0x08, 0x2e, 0xa1, 0x66, 0x28, 0xd9, 0x24, 0xb2, 0x76, 0x5b, 0xa2, 0x49, 0x6d, 0x8b, 0xd1, 0x25,
    0x72, 0xf8, 0xf6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xd4, 0xa4, 0x5c, 0xcc, 0x5d, 0x65, 0xb6, 0x92,
    0x6c, 0x70, 0x48, 0x50, 0xfd, 0xed, 0xb9, 0xda, 0x5e, 0x15, 0x46, 0x57, 0xa7, 0x8d, 0x9d, 0x84,
    0x90, 0xd8, 0xab, 0x00, 0x8c, 0xbc, 0xd3, 0x0a, 0xf7, 0xe4, 0x58, 0x05, 0xb8, 0xb3, 0x45, 0x06,
    0xd0, 0x2c, 0x1e, 0x8f, 0xca, 0x3f, 0x0f, 0x02, 0xc1, 0xaf, 0xbd, 0x03, 0x01, 0x13, 0x8a, 0x6b,
    0x3a, 0x91, 0x11, 0x41, 0x4f, 0x67, 0xdc, 0xea, 0x97, 0xf2, 0xcf, 0xce, 0xf0, 0xb4, 0xe6, 0x73,
    0x96, 0xac, 0x74, 0x22, 0xe7, 0xad, 0x35, 0x85, 0xe2, 0xf9, 0x37, 0xe8, 0x1c, 0x75, 0xdf, 0x6e,
    0x47, 0xf1, 0x1a, 0x71, 0x1d, 0x29, 0xc5, 0x89, 0x6f, 0xb7, 0x62, 0x0e, 0xaa, 0x18, 0xbe, 0x1b,
    0xfc, 0x56, 0x3e, 0x4b, 0xc6, 0xd2, 0x79, 0x20, 0x9a, 0xdb, 0xc0, 0xfe, 0x78, 0xcd, 0x5a, 0xf4,
    0x1f, 0xdd, 0xa8, 0x33, 0x88, 0x07, 0xc7, 0x31, 0xb1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xec, 0x5f,
    0x60, 0x51, 0x7f, 0xa9, 0x19, 0xb5, 0x4a, 0x0d, 0x2d, 0xe5, 0x7a, 0x9f, 0x93, 0xc9, 0x9c, 0xef,
    0xa0, 0xe0, 0x3b, 0x4d, 0xae, 0x2a, 0xf5, 0xb0, 0xc8, 0xeb, 0xbb, 0x3c, 0x83, 0x53, 0x99, 0x61,
    0x17, 0x2b, 0x04, 0x7e, 0xba, 0x77, 0xd6, 0x26, 0xe1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0c, 0x7d,
];

/// Round constants (RCON). CryptoJS uses indices 0..10.
const RCON: [u32; 11] = [
    0x00000000, 0x01000000, 0x02000000, 0x04000000, 0x08000000,
    0x10000000, 0x20000000, 0x40000000, 0x80000000, 0x1b000000,
    0x36000000,
];

const BLOCK_WORDS: usize = 4; // 128-bit block = 4 x 32-bit words

// ── Precomputed MixColumns / InvMixColumns tables ──

/// Build the encryption T-tables at compile time would be ideal,
/// but for clarity we compute GF(2^8) multiplication inline.

fn gf_mul(mut a: u8, mut b: u8) -> u8 {
    let mut p: u8 = 0;
    for _ in 0..8 {
        if b & 1 != 0 {
            p ^= a;
        }
        let hi = a & 0x80;
        a <<= 1;
        if hi != 0 {
            a ^= 0x1b; // irreducible polynomial x^8 + x^4 + x^3 + x + 1
        }
        b >>= 1;
    }
    p
}

// ── Key Expansion ──

/// Expand a variable-length key into the round key schedule.
/// CryptoJS treats the key as an array of 32-bit big-endian words.
///
/// `key_words`: the key as big-endian u32 words (e.g. 64 words for 256-byte key)
/// Returns the expanded key schedule.
fn key_expansion(key_words: &[u32]) -> Vec<u32> {
    let nk = key_words.len(); // key length in 32-bit words
    let nr = nk + 6; // number of rounds
    let total = (nr + 1) * BLOCK_WORDS;

    let mut w = vec![0u32; total];
    w[..nk].copy_from_slice(key_words);

    let mut rcon_idx = 1usize;

    for i in nk..total {
        let mut temp = w[i - 1];

        if i % nk == 0 {
            // RotWord + SubWord + RCON
            temp = (temp << 8) | (temp >> 24); // RotWord
            temp = sub_word(temp);
            temp ^= RCON[rcon_idx];
            rcon_idx += 1;
            // CryptoJS wraps RCON index; with 64-word key we only need indices 1..4
            if rcon_idx >= RCON.len() {
                rcon_idx = 0;
            }
        } else if nk > 6 && i % nk == 4 {
            temp = sub_word(temp);
        }

        w[i] = w[i - nk] ^ temp;
    }

    w
}

fn sub_word(w: u32) -> u32 {
    let b = w.to_be_bytes();
    u32::from_be_bytes([SBOX[b[0] as usize], SBOX[b[1] as usize], SBOX[b[2] as usize], SBOX[b[3] as usize]])
}

// ── Block Decryption (single 128-bit block) ──

fn inv_cipher(block: &mut [u32; 4], round_keys: &[u32]) {
    let nr = round_keys.len() / BLOCK_WORDS - 1;

    // Initial round key addition
    for j in 0..4 {
        block[j] ^= round_keys[nr * 4 + j];
    }

    for round in (1..nr).rev() {
        inv_shift_rows(block);
        inv_sub_bytes(block);
        // AddRoundKey
        for j in 0..4 {
            block[j] ^= round_keys[round * 4 + j];
        }
        inv_mix_columns(block);
    }

    // Final round (no InvMixColumns)
    inv_shift_rows(block);
    inv_sub_bytes(block);
    for j in 0..4 {
        block[j] ^= round_keys[j];
    }
}

fn inv_sub_bytes(state: &mut [u32; 4]) {
    for w in state.iter_mut() {
        let b = w.to_be_bytes();
        *w = u32::from_be_bytes([
            INV_SBOX[b[0] as usize],
            INV_SBOX[b[1] as usize],
            INV_SBOX[b[2] as usize],
            INV_SBOX[b[3] as usize],
        ]);
    }
}

fn inv_shift_rows(state: &mut [u32; 4]) {
    // State is in column-major order: state[col] = [row0, row1, row2, row3] as big-endian u32
    // We need to extract the row bytes, shift, and put back.
    let mut flat = [0u8; 16];
    for col in 0..4 {
        let b = state[col].to_be_bytes();
        for row in 0..4 {
            flat[row * 4 + col] = b[row];
        }
    }

    // Row 0: no shift
    // Row 1: shift right by 1
    flat[4..8].rotate_right(1);
    // Row 2: shift right by 2
    flat[8..12].rotate_right(2);
    // Row 3: shift right by 3
    flat[12..16].rotate_right(3);

    for col in 0..4 {
        state[col] = u32::from_be_bytes([flat[col], flat[4 + col], flat[8 + col], flat[12 + col]]);
    }
}

fn inv_mix_columns(state: &mut [u32; 4]) {
    for col in state.iter_mut() {
        let b = col.to_be_bytes();
        let (s0, s1, s2, s3) = (b[0], b[1], b[2], b[3]);

        // InvMixColumns matrix multiplication in GF(2^8):
        // [0e 0b 0d 09]   [s0]
        // [09 0e 0b 0d] * [s1]
        // [0d 09 0e 0b]   [s2]
        // [0b 0d 09 0e]   [s3]
        let r0 = gf_mul(0x0e, s0) ^ gf_mul(0x0b, s1) ^ gf_mul(0x0d, s2) ^ gf_mul(0x09, s3);
        let r1 = gf_mul(0x09, s0) ^ gf_mul(0x0e, s1) ^ gf_mul(0x0b, s2) ^ gf_mul(0x0d, s3);
        let r2 = gf_mul(0x0d, s0) ^ gf_mul(0x09, s1) ^ gf_mul(0x0e, s2) ^ gf_mul(0x0b, s3);
        let r3 = gf_mul(0x0b, s0) ^ gf_mul(0x0d, s1) ^ gf_mul(0x09, s2) ^ gf_mul(0x0e, s3);

        *col = u32::from_be_bytes([r0, r1, r2, r3]);
    }
}

// ── CBC Decryption ──

fn cbc_decrypt(ciphertext: &[u8], iv: &[u8; 16], round_keys: &[u32]) -> Result<Vec<u8>, String> {
    if ciphertext.len() % 16 != 0 {
        return Err("Ciphertext length not a multiple of 16".into());
    }
    if ciphertext.is_empty() {
        return Err("Empty ciphertext".into());
    }

    let mut plaintext = Vec::with_capacity(ciphertext.len());
    let mut prev_block = *iv;

    for chunk in ciphertext.chunks_exact(16) {
        // Load ciphertext block as 4 big-endian u32 words
        let mut block = [
            u32::from_be_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]),
            u32::from_be_bytes([chunk[4], chunk[5], chunk[6], chunk[7]]),
            u32::from_be_bytes([chunk[8], chunk[9], chunk[10], chunk[11]]),
            u32::from_be_bytes([chunk[12], chunk[13], chunk[14], chunk[15]]),
        ];

        inv_cipher(&mut block, round_keys);

        // XOR with previous ciphertext block (CBC)
        let decrypted_bytes = [
            block[0].to_be_bytes(),
            block[1].to_be_bytes(),
            block[2].to_be_bytes(),
            block[3].to_be_bytes(),
        ];

        for (i, db) in decrypted_bytes.iter().enumerate() {
            for (j, &byte) in db.iter().enumerate() {
                plaintext.push(byte ^ prev_block[i * 4 + j]);
            }
        }

        prev_block.copy_from_slice(chunk);
    }

    // PKCS7 unpadding
    let pad_len = *plaintext.last().ok_or("Empty plaintext after decryption")? as usize;
    if pad_len == 0 || pad_len > 16 || pad_len > plaintext.len() {
        return Err("Invalid PKCS7 padding".into());
    }
    for &b in &plaintext[plaintext.len() - pad_len..] {
        if b as usize != pad_len {
            return Err("Invalid PKCS7 padding".into());
        }
    }
    plaintext.truncate(plaintext.len() - pad_len);

    Ok(plaintext)
}

// ── Public API ──

// ── SHA-1 (inline implementation to avoid external crate) ──

/// Minimal SHA-1 for HMAC-SHA1 / PBKDF2 only. Not for security-critical hashing.
mod sha1_impl {
    const H0: [u32; 5] = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];

    pub fn sha1(message: &[u8]) -> [u8; 20] {
        let ml = (message.len() as u64) * 8;
        // Padding
        let mut msg = message.to_vec();
        msg.push(0x80);
        while msg.len() % 64 != 56 {
            msg.push(0);
        }
        msg.extend_from_slice(&ml.to_be_bytes());

        let mut h = H0;

        for chunk in msg.chunks_exact(64) {
            let mut w = [0u32; 80];
            for i in 0..16 {
                w[i] = u32::from_be_bytes([chunk[i*4], chunk[i*4+1], chunk[i*4+2], chunk[i*4+3]]);
            }
            for i in 16..80 {
                w[i] = (w[i-3] ^ w[i-8] ^ w[i-14] ^ w[i-16]).rotate_left(1);
            }

            let (mut a, mut b, mut c, mut d, mut e) = (h[0], h[1], h[2], h[3], h[4]);

            for i in 0..80 {
                let (f, k) = match i {
                    0..=19  => ((b & c) | ((!b) & d),          0x5A827999),
                    20..=39 => (b ^ c ^ d,                      0x6ED9EBA1),
                    40..=59 => ((b & c) | (b & d) | (c & d),    0x8F1BBCDC),
                    _       => (b ^ c ^ d,                      0xCA62C1D6),
                };

                let temp = a.rotate_left(5)
                    .wrapping_add(f)
                    .wrapping_add(e)
                    .wrapping_add(k)
                    .wrapping_add(w[i]);
                e = d;
                d = c;
                c = b.rotate_left(30);
                b = a;
                a = temp;
            }

            h[0] = h[0].wrapping_add(a);
            h[1] = h[1].wrapping_add(b);
            h[2] = h[2].wrapping_add(c);
            h[3] = h[3].wrapping_add(d);
            h[4] = h[4].wrapping_add(e);
        }

        let mut result = [0u8; 20];
        for (i, &val) in h.iter().enumerate() {
            result[i*4..i*4+4].copy_from_slice(&val.to_be_bytes());
        }
        result
    }

    const SHA1_BLOCK_SIZE: usize = 64;

    pub fn hmac_sha1(key: &[u8], message: &[u8]) -> [u8; 20] {
        let mut padded_key = [0u8; SHA1_BLOCK_SIZE];
        if key.len() > SHA1_BLOCK_SIZE {
            padded_key[..20].copy_from_slice(&sha1(key));
        } else {
            padded_key[..key.len()].copy_from_slice(key);
        }

        let mut ipad = [0x36u8; SHA1_BLOCK_SIZE];
        let mut opad = [0x5cu8; SHA1_BLOCK_SIZE];
        for i in 0..SHA1_BLOCK_SIZE {
            ipad[i] ^= padded_key[i];
            opad[i] ^= padded_key[i];
        }

        let mut inner = Vec::with_capacity(SHA1_BLOCK_SIZE + message.len());
        inner.extend_from_slice(&ipad);
        inner.extend_from_slice(message);
        let inner_hash = sha1(&inner);

        let mut outer = Vec::with_capacity(SHA1_BLOCK_SIZE + 20);
        outer.extend_from_slice(&opad);
        outer.extend_from_slice(&inner_hash);
        sha1(&outer)
    }

    /// PBKDF2-HMAC-SHA1
    pub fn pbkdf2_hmac_sha1(password: &[u8], salt: &[u8], iterations: u32, dk_len: usize) -> Vec<u8> {
        let h_len = 20; // SHA-1 output length
        let blocks_needed = (dk_len + h_len - 1) / h_len;
        let mut dk = Vec::with_capacity(dk_len);

        for block_idx in 1..=(blocks_needed as u32) {
            // U_1 = HMAC(password, salt || INT_32_BE(block_idx))
            let mut salt_block = Vec::with_capacity(salt.len() + 4);
            salt_block.extend_from_slice(salt);
            salt_block.extend_from_slice(&block_idx.to_be_bytes());

            let mut u = hmac_sha1(password, &salt_block);
            let mut result = u;

            for _ in 1..iterations {
                u = hmac_sha1(password, &u);
                for j in 0..20 {
                    result[j] ^= u[j];
                }
            }

            dk.extend_from_slice(&result);
        }

        dk.truncate(dk_len);
        dk
    }
}

/// Anchor's PBKDF2 parameters.
const ANCHOR_PBKDF2_ITERATIONS: u32 = 4500;
const ANCHOR_KEY_LEN: usize = 256; // 256 bytes = 64 x u32 words

/// Parse Anchor's encrypted string format: `<32 hex salt><32 hex IV><base64 ciphertext>`
fn parse_anchor_encrypted(input: &str) -> Result<(Vec<u8>, [u8; 16], Vec<u8>), String> {
    if input.len() < 65 {
        return Err("Encrypted string too short".into());
    }

    // First 32 hex chars = 16-byte salt
    let salt = hex::decode(&input[..32]).map_err(|e| format!("Invalid salt hex: {}", e))?;
    if salt.len() != 16 {
        return Err(format!("Expected 16-byte salt, got {}", salt.len()));
    }

    // Next 32 hex chars = 16-byte IV
    let iv_bytes = hex::decode(&input[32..64]).map_err(|e| format!("Invalid IV hex: {}", e))?;
    let mut iv = [0u8; 16];
    iv.copy_from_slice(&iv_bytes);

    // Remainder = base64-encoded ciphertext
    let ciphertext = base64_decode(&input[64..])?;

    Ok((salt, iv, ciphertext))
}

fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    // Simple base64 decoder (standard alphabet with padding)
    use std::collections::HashMap;
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let table: HashMap<u8, u8> = ALPHABET.iter().enumerate().map(|(i, &c)| (c, i as u8)).collect();

    let input = input.trim().as_bytes();
    let mut output = Vec::with_capacity(input.len() * 3 / 4);
    let mut buf = 0u32;
    let mut bits = 0u32;

    for &c in input {
        if c == b'=' {
            break;
        }
        let val = table.get(&c).ok_or_else(|| format!("Invalid base64 char: {}", c as char))?;
        buf = (buf << 6) | (*val as u32);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            output.push((buf >> bits) as u8);
            buf &= (1 << bits) - 1;
        }
    }

    Ok(output)
}

/// Derive the 256-byte key from a password using PBKDF2-HMAC-SHA1.
fn derive_anchor_key(password: &str, salt: &[u8]) -> Vec<u8> {
    sha1_impl::pbkdf2_hmac_sha1(
        password.as_bytes(),
        salt,
        ANCHOR_PBKDF2_ITERATIONS,
        ANCHOR_KEY_LEN,
    )
}

/// Convert a byte slice to big-endian u32 words (matching CryptoJS WordArray).
fn bytes_to_words(bytes: &[u8]) -> Vec<u32> {
    bytes
        .chunks(4)
        .map(|chunk| {
            let mut word = [0u8; 4];
            word[..chunk.len()].copy_from_slice(chunk);
            u32::from_be_bytes(word)
        })
        .collect()
}

/// Decrypt an Anchor encrypted string using the user's password.
///
/// The input format is: `<32 hex salt><32 hex IV><base64 ciphertext>`
/// Returns the decrypted UTF-8 string.
pub fn decrypt_anchor(encrypted: &str, password: &str) -> Result<String, crate::error::Error> {
    let (salt, iv, ciphertext) = parse_anchor_encrypted(encrypted)
        .map_err(|e| crate::error::Error::Encryption(format!("Parse error: {}", e)))?;

    let mut key_bytes = derive_anchor_key(password, &salt);
    let key_words = bytes_to_words(&key_bytes);
    key_bytes.zeroize();

    let round_keys = key_expansion(&key_words);
    let plaintext = cbc_decrypt(&ciphertext, &iv, &round_keys)
        .map_err(|e| crate::error::Error::Encryption(format!("Decryption failed: {}", e)))?;

    String::from_utf8(plaintext)
        .map_err(|e| crate::error::Error::Encryption(format!("Invalid UTF-8: {}", e)))
}

/// Verify an Anchor wallet password by decrypting the walletHash field.
/// Anchor encrypts the string "VALID" — if decryption yields "VALID", the password is correct.
pub fn verify_anchor_password(wallet_hash: &str, password: &str) -> Result<bool, crate::error::Error> {
    match decrypt_anchor(wallet_hash, password) {
        Ok(plaintext) => Ok(plaintext == "VALID"),
        Err(_) => Ok(false),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sbox_inverse_roundtrip() {
        for i in 0..=255u8 {
            assert_eq!(INV_SBOX[SBOX[i as usize] as usize], i);
        }
    }

    #[test]
    fn gf_mul_known_values() {
        assert_eq!(gf_mul(0x57, 0x83), 0xc1);
        assert_eq!(gf_mul(0x02, 0x87), 0x15);
        assert_eq!(gf_mul(0x01, 0xff), 0xff);
        assert_eq!(gf_mul(0x00, 0xab), 0x00);
    }

    #[test]
    fn parse_anchor_format() {
        // 32 hex salt + 32 hex IV + base64
        let input = "00112233445566778899aabbccddeeffffeeddccbbaa99887766554433221100AAAA";
        let (salt, iv, _ct) = parse_anchor_encrypted(input).unwrap();
        assert_eq!(salt, hex::decode("00112233445566778899aabbccddeeff").unwrap());
        assert_eq!(iv, hex::decode("ffeeddccbbaa99887766554433221100").unwrap().as_slice());
    }

    #[test]
    fn key_expansion_standard_aes128() {
        // Verify key expansion matches known AES-128 test vector
        // Key: 2b7e151628aed2a6abf7158809cf4f3c
        let key_words = vec![0x2b7e1516, 0x28aed2a6, 0xabf71588, 0x09cf4f3c];
        let rk = key_expansion(&key_words);
        // AES-128: nk=4, nr=10, total = 44 words
        assert_eq!(rk.len(), 44);
        // First round key word after expansion
        assert_eq!(rk[4], 0xa0fafe17);
        assert_eq!(rk[5], 0x88542cb1);
    }

    #[test]
    fn decrypt_single_block_aes128() {
        // AES-128 known-answer test (FIPS 197 Appendix B)
        // Key: 2b7e151628aed2a6abf7158809cf4f3c
        // Plaintext: 3243f6a8885a308d313198a2e0370734
        // Ciphertext: 3925841d02dc09fbdc118597196a0b32
        let key_words = vec![0x2b7e1516, 0x28aed2a6, 0xabf71588, 0x09cf4f3c];
        let round_keys = key_expansion(&key_words);

        let mut block: [u32; 4] = [0x3925841d, 0x02dc09fb, 0xdc118597, 0x196a0b32];
        inv_cipher(&mut block, &round_keys);

        assert_eq!(block, [0x3243f6a8, 0x885a308d, 0x313198a2, 0xe0370734]);
    }

    #[test]
    fn base64_decode_basic() {
        assert_eq!(base64_decode("SGVsbG8=").unwrap(), b"Hello");
        assert_eq!(base64_decode("AAAA").unwrap(), vec![0, 0, 0]);
    }

    // Test vector from the Anchor research: password "testpass"
    // Salt: 00112233445566778899aabbccddeeff
    // IV: ffeeddccbbaa99887766554433221100
    // Plaintext: "VALID"
    // Expected ciphertext (base64): 2yhc3tkyBy1tlPTNRDDzZA==
    #[test]
    fn decrypt_anchor_test_vector() {
        let encrypted = "00112233445566778899aabbccddeeffffeeddccbbaa998877665544332211002yhc3tkyBy1tlPTNRDDzZA==";
        let result = decrypt_anchor(encrypted, "testpass");
        match result {
            Ok(plaintext) => assert_eq!(plaintext, "VALID"),
            Err(e) => panic!("Decryption failed: {:?}", e),
        }
    }

    #[test]
    fn verify_anchor_password_correct() {
        let wallet_hash = "00112233445566778899aabbccddeeffffeeddccbbaa998877665544332211002yhc3tkyBy1tlPTNRDDzZA==";
        assert!(verify_anchor_password(wallet_hash, "testpass").unwrap());
    }

    #[test]
    fn verify_anchor_password_wrong() {
        let wallet_hash = "00112233445566778899aabbccddeeffffeeddccbbaa998877665544332211002yhc3tkyBy1tlPTNRDDzZA==";
        assert!(!verify_anchor_password(wallet_hash, "wrongpass").unwrap());
    }
}
