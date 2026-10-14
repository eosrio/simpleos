//! Biometric quick unlock: a shortcut to the wallet passphrase that only the
//! platform's biometric / device authentication can open.
//!
//! On Windows the passphrase is encrypted under a key derived from a Windows
//! Hello signature (see [`sealed`]). Windows Hello signs only after the user
//! passes its prompt, so `biometric.dat` is useless on its own, including to
//! other programs running as the same user. Earlier builds stored the passphrase
//! with DPAPI behind a UI-only consent prompt, which any such program could
//! decrypt silently; [`discard_legacy_secret`] removes those files.

use crate::error::Error;
use serde::Serialize;
use tauri::AppHandle;

#[derive(Debug, Serialize)]
pub struct BiometricStatus {
    pub available: bool,
    pub configured: bool,
    pub reason: String,
}

const FILE_NAME: &str = "biometric.dat";

/// On-disk format of the passphrase shortcut (JSON in `biometric.dat`).
///
/// The passphrase is AES-256-GCM encrypted under SHA-256 of a domain tag and the
/// Windows Hello key's signature over `challenge`. That signature is RSA PKCS#1
/// v1.5, which is deterministic, so signing the same challenge again at unlock
/// reproduces the key; enrollment checks the padding before storing anything.
///
/// The plaintext is `u16 length || passphrase || zeros`, padded to a multiple of
/// `PAD_BLOCK`, because AES-GCM ciphertext would otherwise reveal the passphrase
/// length.
#[cfg_attr(not(windows), allow(dead_code))]
mod sealed {
    use crate::error::Error;
    use crate::keystore::derive;
    use serde::{Deserialize, Serialize};
    use sha2::{Digest, Sha256};
    use zeroize::Zeroizing;

    const VERSION: u8 = 2;
    const KEY_DOMAIN: &[u8] = b"simpleos-windows-hello-unlock-v2";
    const PAD_BLOCK: usize = 256;

    #[derive(Serialize, Deserialize)]
    struct File {
        version: u8,
        /// Hex. The data Windows Hello signs to reproduce the key.
        challenge: String,
        /// Hex. nonce || AES-256-GCM ciphertext of the passphrase.
        ciphertext: String,
    }

    fn key_from_signature(signature: &[u8]) -> Zeroizing<[u8; 32]> {
        let mut hasher = Sha256::new();
        hasher.update(KEY_DOMAIN);
        hasher.update(signature);
        let mut key = Zeroizing::new([0u8; 32]);
        key.copy_from_slice(&hasher.finalize());
        key
    }

    fn pad(passphrase: &str) -> Result<Zeroizing<Vec<u8>>, Error> {
        let bytes = passphrase.as_bytes();
        let len = u16::try_from(bytes.len())
            .map_err(|_| Error::Encryption("Passphrase is too long".into()))?;
        let total = (2 + bytes.len()).div_ceil(PAD_BLOCK) * PAD_BLOCK;
        // Capacity up front, so nothing is reallocated and left behind unzeroed.
        let mut padded = Zeroizing::new(Vec::with_capacity(total));
        padded.extend_from_slice(&len.to_be_bytes());
        padded.extend_from_slice(bytes);
        padded.resize(total, 0);
        Ok(padded)
    }

    fn unpad(padded: &[u8]) -> Option<&[u8]> {
        let len = u16::from_be_bytes(padded.get(..2)?.try_into().ok()?) as usize;
        padded.get(2..2 + len)
    }

    pub fn seal(passphrase: &str, challenge: &[u8], signature: &[u8]) -> Result<Vec<u8>, Error> {
        let key = key_from_signature(signature);
        let ciphertext = derive::encrypt_with_key(&pad(passphrase)?, &key)?;
        serde_json::to_vec(&File {
            version: VERSION,
            challenge: hex::encode(challenge),
            ciphertext: hex::encode(ciphertext),
        })
        .map_err(|e| Error::Serialization(e.to_string()))
    }

    /// The challenge and ciphertext of a current-format file. `None` for anything
    /// else, including the DPAPI blobs earlier builds wrote.
    pub fn parse(bytes: &[u8]) -> Option<(Vec<u8>, Vec<u8>)> {
        let file: File = serde_json::from_slice(bytes).ok()?;
        if file.version != VERSION {
            return None;
        }
        Some((
            hex::decode(file.challenge).ok()?,
            hex::decode(file.ciphertext).ok()?,
        ))
    }

    pub fn open(ciphertext: &[u8], signature: &[u8]) -> Result<Zeroizing<String>, Error> {
        let key = key_from_signature(signature);
        let plaintext = Zeroizing::new(derive::decrypt_with_key(ciphertext, &key)?);
        let passphrase = unpad(&plaintext)
            .ok_or_else(|| Error::Encryption("Malformed biometric unlock data".into()))?;
        std::str::from_utf8(passphrase)
            .map(|s| Zeroizing::new(s.to_owned()))
            .map_err(|e| Error::Serialization(e.to_string()))
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        const CHALLENGE: [u8; 32] = [7; 32];

        #[test]
        fn sealed_passphrase_opens_only_with_the_same_signature() {
            let signature = vec![0x5a; 256];
            let bytes = seal("correct horse battery staple", &CHALLENGE, &signature).unwrap();
            let (challenge, ciphertext) = parse(&bytes).unwrap();
            assert_eq!(challenge, CHALLENGE);
            assert_eq!(
                open(&ciphertext, &signature).unwrap().as_str(),
                "correct horse battery staple"
            );

            let mut other = signature.clone();
            other[0] ^= 1;
            assert!(open(&ciphertext, &other).is_err());
        }

        #[test]
        fn the_file_holds_no_plaintext_and_rejects_tampering() {
            let signature = vec![0x11; 256];
            let bytes = seal("hunter2-passphrase", &CHALLENGE, &signature).unwrap();
            assert!(!String::from_utf8_lossy(&bytes).contains("hunter2"));

            let (_, mut ciphertext) = parse(&bytes).unwrap();
            let last = ciphertext.len() - 1;
            ciphertext[last] ^= 1;
            assert!(open(&ciphertext, &signature).is_err());
        }

        #[test]
        fn ciphertext_length_does_not_reveal_the_passphrase_length() {
            let signature = vec![0x22; 256];
            let lengths: Vec<usize> = [
                "a",
                "a much longer passphrase than the first",
                &"x".repeat(254),
            ]
            .iter()
            .map(|p| {
                parse(&seal(p, &CHALLENGE, &signature).unwrap())
                    .unwrap()
                    .1
                    .len()
            })
            .collect();
            assert!(lengths.iter().all(|&len| len == lengths[0]), "{lengths:?}");

            // Longer passphrases round up to the next block and still open.
            let long = "y".repeat(300);
            let (_, ciphertext) = parse(&seal(&long, &CHALLENGE, &signature).unwrap()).unwrap();
            assert!(ciphertext.len() > lengths[0]);
            assert_eq!(open(&ciphertext, &signature).unwrap().as_str(), long);
            assert_eq!(
                open(
                    &parse(&seal("", &CHALLENGE, &signature).unwrap()).unwrap().1,
                    &signature
                )
                .unwrap()
                .as_str(),
                ""
            );
        }

        #[test]
        fn legacy_and_foreign_files_are_not_parsed() {
            // DPAPI blobs start with this version header and provider GUID.
            let dpapi = [
                0x01, 0x00, 0x00, 0x00, 0xd0, 0x8c, 0x9d, 0xdf, 0x01, 0x15, 0xd1, 0x11,
            ];
            assert!(parse(&dpapi).is_none());
            assert!(parse(b"").is_none());
            assert!(parse(br#"{"version":1,"challenge":"00","ciphertext":"00"}"#).is_none());
            assert!(parse(br#"{"version":2,"challenge":"zz","ciphertext":"00"}"#).is_none());
        }
    }
}

/// Delete a `biometric.dat` that isn't in the current format. Builds before the
/// Windows Hello key binding stored the passphrase there with DPAPI, which any
/// program running as the user could decrypt without a prompt.
pub fn discard_legacy_secret(app_data_dir: &std::path::Path) {
    let path = app_data_dir.join(FILE_NAME);
    if let Ok(bytes) = std::fs::read(&path) {
        if sealed::parse(&bytes).is_none() {
            let _ = std::fs::remove_file(&path);
        }
    }
}

#[cfg(windows)]
mod platform {
    use super::{sealed, BiometricStatus, FILE_NAME};
    use crate::error::Error;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    use std::time::Duration;
    use tauri::{AppHandle, Manager};
    use windows::{
        core::{w, Array, HSTRING, PCWSTR},
        Security::Credentials::{
            KeyCredential, KeyCredentialCreationOption, KeyCredentialManager, KeyCredentialStatus,
            UI::{UserConsentVerifier, UserConsentVerifierAvailability},
        },
        Security::Cryptography::{
            Core::{
                AsymmetricAlgorithmNames, AsymmetricKeyAlgorithmProvider, CryptographicEngine,
                CryptographicPublicKeyBlobType,
            },
            CryptographicBuffer,
        },
        Win32::{
            System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED},
            UI::WindowsAndMessaging::{FindWindowW, SetForegroundWindow},
        },
    };

    /// Windows Hello key name. Hello keys belong to the Windows user, so the
    /// GitHub and Microsoft Store builds share the key, as they share
    /// biometric.dat.
    const KEY_NAME: &str = "io.eosrio.simpleos.unlock";
    const CHALLENGE_LEN: usize = 32;

    pub fn status(app: &AppHandle) -> Result<BiometricStatus, Error> {
        let configured = secret_path(app)?.exists();
        let (available, reason) = availability().unwrap_or_else(|e| (false, e.to_string()));
        Ok(BiometricStatus {
            available,
            configured,
            reason,
        })
    }

    pub fn set_unlock_secret(app: &AppHandle, passphrase: &str) -> Result<(), Error> {
        ensure_available()?;
        let credential = create_or_open_key()?;
        let challenge: [u8; CHALLENGE_LEN] = crate::rng::secure_array();
        let signature = sign(&credential, &challenge)?;
        // The key is rebuilt from this signature at unlock, which only works if
        // signing is deterministic (PKCS#1 v1.5, not PSS).
        if !verifies_as_pkcs1(&credential, &challenge, &signature) {
            return Err(Error::Keyring(
                "Windows Hello on this device signs in a format SimplEOS can't use for unlock"
                    .into(),
            ));
        }

        let sealed = sealed::seal(passphrase, &challenge, &signature)?;
        let path = secret_path(app)?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(Error::Io)?;
        }
        std::fs::write(&path, sealed).map_err(Error::Io)?;
        Ok(())
    }

    pub fn unlock_secret(app: &AppHandle) -> Result<String, Error> {
        let path = secret_path(app)?;
        let bytes = match std::fs::read(&path) {
            Ok(bytes) => bytes,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                return Err(Error::KeyNotFound(
                    "Biometric unlock is not configured".into(),
                ))
            }
            Err(e) => return Err(Error::Io(e)),
        };
        let Some((challenge, ciphertext)) = sealed::parse(&bytes) else {
            let _ = std::fs::remove_file(&path);
            return Err(Error::KeyNotFound(
                "Windows Hello unlock needs to be set up again. Unlock with your passphrase, then enable it in Settings."
                    .into(),
            ));
        };

        ensure_available()?;
        let Some(credential) = open_key()? else {
            // A Windows PIN reset deletes Windows Hello's app keys.
            let _ = std::fs::remove_file(&path);
            return Err(Error::KeyNotFound(
                "Windows Hello no longer has the SimplEOS key, for example after a Windows PIN reset. Unlock with your passphrase, then enable Windows Hello again in Settings."
                    .into(),
            ));
        };
        let signature = sign(&credential, &challenge)?;
        match sealed::open(&ciphertext, &signature) {
            Ok(passphrase) => Ok(passphrase.as_str().to_owned()),
            Err(_) => {
                let _ = std::fs::remove_file(&path);
                Err(Error::KeyNotFound(
                    "Windows Hello unlock no longer matches this wallet. Unlock with your passphrase, then enable it again in Settings."
                        .into(),
                ))
            }
        }
    }

    pub fn has_unlock_secret(app: &AppHandle) -> Result<bool, Error> {
        Ok(secret_path(app)?.exists())
    }

    pub fn remove_unlock_secret(app: &AppHandle) -> Result<(), Error> {
        let path = secret_path(app)?;
        if path.exists() {
            std::fs::remove_file(path).map_err(Error::Io)?;
        }
        // Drop the Hello key too. Off-thread so callers on the UI thread never
        // wait on a WinRT operation.
        std::thread::spawn(|| {
            let _ = KeyCredentialManager::DeleteAsync(&HSTRING::from(KEY_NAME))
                .and_then(|op| op.join());
        });
        Ok(())
    }

    fn secret_path(app: &AppHandle) -> Result<PathBuf, Error> {
        let app_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| Error::Io(std::io::Error::other(e.to_string())))?;
        Ok(app_dir.join(FILE_NAME))
    }

    fn hello_error(e: windows::core::Error) -> Error {
        Error::Keyring(format!("Windows Hello request failed: {e}"))
    }

    fn availability() -> Result<(bool, String), Error> {
        let _ = unsafe { RoInitialize(RO_INIT_MULTITHREADED) };
        let consent = UserConsentVerifier::CheckAvailabilityAsync()
            .and_then(|op| op.join())
            .map_err(hello_error)?;
        let reason = match consent {
            UserConsentVerifierAvailability::Available => None,
            UserConsentVerifierAvailability::DeviceNotPresent => {
                Some("No Windows Hello device is present")
            }
            UserConsentVerifierAvailability::NotConfiguredForUser => {
                Some("Windows Hello is not configured for this user")
            }
            UserConsentVerifierAvailability::DisabledByPolicy => {
                Some("Windows Hello is disabled by policy")
            }
            UserConsentVerifierAvailability::DeviceBusy => Some("Windows Hello device is busy"),
            _ => Some("Windows Hello is unavailable"),
        };
        if let Some(reason) = reason {
            return Ok((false, reason.into()));
        }

        let supported = KeyCredentialManager::IsSupportedAsync()
            .and_then(|op| op.join())
            .map_err(hello_error)?;
        if supported {
            Ok((true, "Windows Hello is available".into()))
        } else {
            Ok((
                false,
                "Windows Hello can't create keys for this user. Set up a Windows Hello PIN first."
                    .into(),
            ))
        }
    }

    fn ensure_available() -> Result<(), Error> {
        match availability()? {
            (true, _) => Ok(()),
            (false, reason) => Err(Error::Keyring(reason)),
        }
    }

    fn status_error(status: KeyCredentialStatus) -> Error {
        let message = match status {
            KeyCredentialStatus::UserCanceled => "Windows Hello was canceled",
            KeyCredentialStatus::UserPrefersPassword => {
                "Windows Hello was dismissed. Use your passphrase instead."
            }
            KeyCredentialStatus::SecurityDeviceLocked => {
                "The security device is locked. Try again later or use your passphrase."
            }
            KeyCredentialStatus::NotFound => "The Windows Hello key was not found",
            _ => "Windows Hello failed",
        };
        Error::Keyring(message.into())
    }

    fn create_or_open_key() -> Result<KeyCredential, Error> {
        let name = HSTRING::from(KEY_NAME);
        let result = with_prompt_focus(|| {
            KeyCredentialManager::RequestCreateAsync(
                &name,
                KeyCredentialCreationOption::FailIfExists,
            )?
            .join()
        })?;
        match result.Status().map_err(hello_error)? {
            KeyCredentialStatus::Success => result.Credential().map_err(hello_error),
            KeyCredentialStatus::CredentialAlreadyExists => open_key()?
                .ok_or_else(|| Error::Keyring("The Windows Hello key could not be opened".into())),
            status => Err(status_error(status)),
        }
    }

    /// The SimplEOS Hello key, or `None` if it no longer exists.
    fn open_key() -> Result<Option<KeyCredential>, Error> {
        let result = KeyCredentialManager::OpenAsync(&HSTRING::from(KEY_NAME))
            .and_then(|op| op.join())
            .map_err(hello_error)?;
        match result.Status().map_err(hello_error)? {
            KeyCredentialStatus::Success => result.Credential().map(Some).map_err(hello_error),
            KeyCredentialStatus::NotFound => Ok(None),
            status => Err(status_error(status)),
        }
    }

    /// Sign `data` with the Hello key. Shows the Windows Hello prompt.
    fn sign(credential: &KeyCredential, data: &[u8]) -> Result<Vec<u8>, Error> {
        let buffer = CryptographicBuffer::CreateFromByteArray(data).map_err(hello_error)?;
        let result = with_prompt_focus(|| credential.RequestSignAsync(&buffer)?.join())?;
        match result.Status().map_err(hello_error)? {
            KeyCredentialStatus::Success => {
                let mut signature = Array::<u8>::new();
                CryptographicBuffer::CopyToByteArray(
                    &result.Result().map_err(hello_error)?,
                    &mut signature,
                )
                .map_err(hello_error)?;
                Ok(signature.to_vec())
            }
            status => Err(status_error(status)),
        }
    }

    /// True if `signature` verifies as RSA PKCS#1 v1.5 / SHA-256 under the key's
    /// public half. Such signatures are unique per key and message, so signing
    /// the challenge again reproduces it.
    fn verifies_as_pkcs1(credential: &KeyCredential, data: &[u8], signature: &[u8]) -> bool {
        let verify = || -> windows::core::Result<bool> {
            let public_key = credential.RetrievePublicKeyWithBlobType(
                CryptographicPublicKeyBlobType::X509SubjectPublicKeyInfo,
            )?;
            let provider = AsymmetricKeyAlgorithmProvider::OpenAlgorithm(
                &AsymmetricAlgorithmNames::RsaSignPkcs1Sha256()?,
            )?;
            let key = provider.ImportPublicKeyWithBlobType(
                &public_key,
                CryptographicPublicKeyBlobType::X509SubjectPublicKeyInfo,
            )?;
            CryptographicEngine::VerifySignature(
                &key,
                &CryptographicBuffer::CreateFromByteArray(data)?,
                &CryptographicBuffer::CreateFromByteArray(signature)?,
            )
        };
        verify().unwrap_or(false)
    }

    /// Run a Windows Hello request while keeping its dialog in front. With this
    /// API version a desktop app can't parent the dialog to its own window, and
    /// the request fails if the dialog opens behind the app.
    fn with_prompt_focus<T>(
        request: impl FnOnce() -> windows::core::Result<T>,
    ) -> Result<T, Error> {
        let done = Arc::new(AtomicBool::new(false));
        let watcher = {
            let done = done.clone();
            std::thread::spawn(move || {
                // ~15 s: long enough for the dialog to appear.
                for _ in 0..60 {
                    if done.load(Ordering::SeqCst) {
                        break;
                    }
                    let dialog =
                        unsafe { FindWindowW(w!("Credential Dialog Xaml Host"), PCWSTR::null()) };
                    if let Ok(hwnd) = dialog {
                        if unsafe { SetForegroundWindow(hwnd) }.as_bool() {
                            break;
                        }
                    }
                    std::thread::sleep(Duration::from_millis(250));
                }
            })
        };
        let result = request();
        done.store(true, Ordering::SeqCst);
        let _ = watcher.join();
        result.map_err(hello_error)
    }
}

#[cfg(not(windows))]
mod platform {
    use super::BiometricStatus;
    use crate::error::Error;
    use tauri::AppHandle;

    pub fn status(_app: &AppHandle) -> Result<BiometricStatus, Error> {
        Ok(BiometricStatus {
            available: false,
            configured: false,
            reason: "Biometric unlock is only available on Windows".into(),
        })
    }

    pub fn set_unlock_secret(_app: &AppHandle, _passphrase: &str) -> Result<(), Error> {
        Err(Error::Keyring(
            "Biometric unlock is only available on Windows".into(),
        ))
    }

    pub fn unlock_secret(_app: &AppHandle) -> Result<String, Error> {
        Err(Error::Keyring(
            "Biometric unlock is only available on Windows".into(),
        ))
    }

    pub fn has_unlock_secret(_app: &AppHandle) -> Result<bool, Error> {
        Ok(false)
    }

    pub fn remove_unlock_secret(_app: &AppHandle) -> Result<(), Error> {
        Ok(())
    }
}

pub fn status(app: &AppHandle) -> Result<BiometricStatus, Error> {
    platform::status(app)
}

pub fn set_unlock_secret(app: &AppHandle, passphrase: &str) -> Result<(), Error> {
    platform::set_unlock_secret(app, passphrase)
}

pub fn unlock_secret(app: &AppHandle) -> Result<String, Error> {
    platform::unlock_secret(app)
}

pub fn has_unlock_secret(app: &AppHandle) -> Result<bool, Error> {
    platform::has_unlock_secret(app)
}

pub fn remove_unlock_secret(app: &AppHandle) -> Result<(), Error> {
    platform::remove_unlock_secret(app)
}
