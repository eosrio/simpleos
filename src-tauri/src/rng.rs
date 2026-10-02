//! Single audited source of cryptographic randomness for SimplEOS.
//!
//! Every private key, seed, and nonce is drawn here, so the entropy provenance
//! is auditable in exactly one place. We pull directly from the operating-system
//! CSPRNG via [`OsRng`] (`getrandom`: `BCryptGenRandom`/`ProcessPrng` on Windows,
//! `getrandom(2)` on Linux, `getentropy` on macOS) rather than a long-lived
//! userspace PRNG — this keeps the trust base to just the OS kernel and removes
//! any process-lifetime RNG state from the key-generation path.
//!
//! `OsRng` fails **closed**: if the OS RNG is unavailable it panics inside
//! `fill_bytes` rather than returning predictable bytes, so a silent low-entropy
//! draw is impossible. As defense-in-depth [`fill_secure`] additionally rejects
//! an all-zero draw — the signature of a catastrophically broken RNG (chance
//! 2^-8n for an n-byte buffer, i.e. never for real key sizes).

use core::convert::Infallible;

use k256::elliptic_curve::rand_core::{TryCryptoRng, TryRng};
use rand::rngs::OsRng;
use rand::RngCore;

/// The cryptographically secure RNG used for all secret generation.
///
/// [`OsRng`] is the rand 0.8 type. k256 0.14 asks for rand_core 0.10, so key
/// generation goes through [`k256_rng`], which only forwards `fill_bytes` to
/// this same OS CSPRNG.
#[inline]
pub fn secure_rng() -> OsRng {
    OsRng
}

/// rand 0.8 [`OsRng`] adapted to the rand_core 0.10 traits k256 0.14 requires.
///
/// Entropy still comes only from [`secure_rng`]. The adapter does not draw
/// from a second generator.
pub struct K256Rng(OsRng);

/// RNG handle for `SigningKey::generate_from_rng`.
#[inline]
pub fn k256_rng() -> K256Rng {
    K256Rng(secure_rng())
}

impl TryRng for K256Rng {
    type Error = Infallible;

    fn try_next_u32(&mut self) -> Result<u32, Self::Error> {
        Ok(RngCore::next_u32(&mut self.0))
    }

    fn try_next_u64(&mut self) -> Result<u64, Self::Error> {
        Ok(RngCore::next_u64(&mut self.0))
    }

    fn try_fill_bytes(&mut self, dst: &mut [u8]) -> Result<(), Self::Error> {
        // OsRng panics if the OS RNG is unavailable (fail-closed).
        RngCore::fill_bytes(&mut self.0, dst);
        Ok(())
    }
}

impl TryCryptoRng for K256Rng {}

/// Fill `dest` with cryptographically secure bytes from the OS CSPRNG.
///
/// Panics if the OS RNG is unavailable (fail-closed, via `OsRng`) or returns
/// all-zeros for a non-empty buffer — both indicate a broken platform RNG that
/// must never be used to mint key material.
pub fn fill_secure(dest: &mut [u8]) {
    OsRng.fill_bytes(dest);
    if !dest.is_empty() && dest.iter().all(|&b| b == 0) {
        panic!("CSPRNG returned all-zero bytes; refusing to generate key material with degenerate entropy");
    }
}

/// Return `N` cryptographically secure random bytes from the OS CSPRNG.
pub fn secure_array<const N: usize>() -> [u8; N] {
    let mut buf = [0u8; N];
    fill_secure(&mut buf);
    buf
}

/// Startup canary: confirm the OS CSPRNG produces distinct, non-trivial output
/// before any key can be generated. Panics (fail-closed) if it does not — a
/// broken platform RNG must halt the wallet, not silently mint guessable keys.
pub fn self_test() {
    let a = secure_array::<32>();
    let b = secure_array::<32>();
    if a == b {
        panic!("CSPRNG self-test failed: two independent 32-byte draws were identical");
    }
    log::info!("[rng] CSPRNG self-test passed (OsRng / getrandom)");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn draws_are_unique_and_nonzero() {
        let mut seen = HashSet::new();
        for _ in 0..2000 {
            let k = secure_array::<32>();
            assert!(k.iter().any(|&b| b != 0), "all-zero 32-byte draw");
            assert!(seen.insert(k), "duplicate 32-byte draw — RNG is broken");
        }
    }

    #[test]
    fn self_test_passes() {
        self_test();
    }

    #[test]
    fn fill_secure_fills_all_lengths() {
        for len in [1usize, 12, 16, 32, 64] {
            let mut buf = vec![0u8; len];
            fill_secure(&mut buf);
            // Astronomically unlikely to be all-zero; guards against a no-op fill.
            assert!(buf.iter().any(|&b| b != 0), "fill_secure produced all zeros for len {len}");
        }
    }
}
