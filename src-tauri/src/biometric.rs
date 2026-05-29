use crate::error::Error;
use serde::Serialize;
use tauri::AppHandle;

#[derive(Debug, Serialize)]
pub struct BiometricStatus {
    pub available: bool,
    pub configured: bool,
    pub reason: String,
}

#[cfg(windows)]
mod platform {
    use super::BiometricStatus;
    use crate::error::Error;
    use std::path::PathBuf;
    use tauri::{AppHandle, Manager};
    use windows::{
        core::{HSTRING, PCWSTR},
        Security::Credentials::UI::{
            UserConsentVerificationResult, UserConsentVerifier, UserConsentVerifierAvailability,
        },
        Win32::{
            Foundation::{LocalFree, HLOCAL, HWND},
            Security::Cryptography::{
                CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
            },
            System::WinRT::{
                IUserConsentVerifierInterop, RoGetActivationFactory, RoInitialize,
                RO_INIT_MULTITHREADED,
            },
        },
    };
    use windows_future::IAsyncOperation;

    const FILE_NAME: &str = "biometric.dat";
    const DPAPI_DESCRIPTION: &str = "SimplEOS biometric unlock";
    const DPAPI_ENTROPY: &[u8] = b"simpleos-biometric-unlock-v1";

    pub fn status(app: &AppHandle) -> Result<BiometricStatus, Error> {
        let configured = secret_path(app)?.exists();
        match availability() {
            Ok((true, reason)) => Ok(BiometricStatus {
                available: true,
                configured,
                reason,
            }),
            Ok((false, reason)) => Ok(BiometricStatus {
                available: false,
                configured,
                reason,
            }),
            Err(e) => Ok(BiometricStatus {
                available: false,
                configured,
                reason: e.to_string(),
            }),
        }
    }

    pub fn set_unlock_secret(app: &AppHandle, passphrase: &str, prompt: &str) -> Result<(), Error> {
        ensure_available()?;
        verify_user(app, prompt)?;

        let protected = dpapi_protect(passphrase.as_bytes())?;
        let path = secret_path(app)?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(Error::Io)?;
        }
        std::fs::write(&path, protected).map_err(Error::Io)?;
        // SEC-030 TODO(windows ACL): biometric.dat is Windows-only (this module is
        // `#[cfg(windows)]`), so there is no Unix mode to set here. The payload is
        // DPAPI-protected (per-user, cross-user decryption blocked), but the file's
        // inherited NTFS ACL is not tightened to owner-only — no minimal, certain
        // owner-only ACL primitive is applied. Reported as not-done.
        Ok(())
    }

    pub fn unlock_secret(app: &AppHandle, prompt: &str) -> Result<String, Error> {
        let path = secret_path(app)?;
        if !path.exists() {
            return Err(Error::KeyNotFound(
                "Biometric unlock is not configured".into(),
            ));
        }

        ensure_available()?;
        verify_user(app, prompt)?;

        let protected = std::fs::read(path).map_err(Error::Io)?;
        let passphrase = dpapi_unprotect(&protected)?;
        String::from_utf8(passphrase).map_err(|e| Error::Serialization(e.to_string()))
    }

    pub fn has_unlock_secret(app: &AppHandle) -> Result<bool, Error> {
        Ok(secret_path(app)?.exists())
    }

    pub fn remove_unlock_secret(app: &AppHandle) -> Result<(), Error> {
        let path = secret_path(app)?;
        if path.exists() {
            std::fs::remove_file(path).map_err(Error::Io)?;
        }
        Ok(())
    }

    fn secret_path(app: &AppHandle) -> Result<PathBuf, Error> {
        let app_dir = app.path().app_data_dir().map_err(|e| {
            Error::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                e.to_string(),
            ))
        })?;
        Ok(app_dir.join(FILE_NAME))
    }

    fn availability() -> Result<(bool, String), Error> {
        let _ = unsafe { RoInitialize(RO_INIT_MULTITHREADED) };
        let result = UserConsentVerifier::CheckAvailabilityAsync()
            .map_err(|e| Error::Keyring(format!("Windows Hello availability failed: {e}")))?
            .get()
            .map_err(|e| Error::Keyring(format!("Windows Hello availability failed: {e}")))?;

        let message = match result {
            UserConsentVerifierAvailability::Available => (true, "Windows Hello is available"),
            UserConsentVerifierAvailability::DeviceNotPresent => {
                (false, "No Windows Hello device is present")
            }
            UserConsentVerifierAvailability::NotConfiguredForUser => {
                (false, "Windows Hello is not configured for this user")
            }
            UserConsentVerifierAvailability::DisabledByPolicy => {
                (false, "Windows Hello is disabled by policy")
            }
            UserConsentVerifierAvailability::DeviceBusy => (false, "Windows Hello device is busy"),
            _ => (false, "Windows Hello is unavailable"),
        };

        Ok((message.0, message.1.into()))
    }

    fn ensure_available() -> Result<(), Error> {
        let (available, reason) = availability()?;
        if available {
            Ok(())
        } else {
            Err(Error::Keyring(reason))
        }
    }

    fn verify_user(app: &AppHandle, prompt: &str) -> Result<(), Error> {
        let _ = unsafe { RoInitialize(RO_INIT_MULTITHREADED) };
        let message = HSTRING::from(prompt);
        let hwnd = app
            .get_webview_window("main")
            .and_then(|window| window.hwnd().ok());

        let operation: IAsyncOperation<UserConsentVerificationResult> = if let Some(hwnd) = hwnd {
            let class = HSTRING::from("Windows.Security.Credentials.UI.UserConsentVerifier");
            let interop: IUserConsentVerifierInterop = unsafe {
                RoGetActivationFactory(&class)
                    .map_err(|e| Error::Keyring(format!("Windows Hello activation failed: {e}")))?
            };
            unsafe {
                interop
                    .RequestVerificationForWindowAsync(HWND(hwnd.0), &message)
                    .map_err(|e| Error::Keyring(format!("Windows Hello prompt failed: {e}")))?
            }
        } else {
            UserConsentVerifier::RequestVerificationAsync(&message)
                .map_err(|e| Error::Keyring(format!("Windows Hello prompt failed: {e}")))?
        };

        match operation
            .get()
            .map_err(|e| Error::Keyring(format!("Windows Hello verification failed: {e}")))?
        {
            UserConsentVerificationResult::Verified => Ok(()),
            UserConsentVerificationResult::DeviceNotPresent => {
                Err(Error::Keyring("No Windows Hello device is present".into()))
            }
            UserConsentVerificationResult::NotConfiguredForUser => Err(Error::Keyring(
                "Windows Hello is not configured for this user".into(),
            )),
            UserConsentVerificationResult::DisabledByPolicy => {
                Err(Error::Keyring("Windows Hello is disabled by policy".into()))
            }
            UserConsentVerificationResult::DeviceBusy => {
                Err(Error::Keyring("Windows Hello device is busy".into()))
            }
            UserConsentVerificationResult::RetriesExhausted => Err(Error::InvalidPassphrase),
            UserConsentVerificationResult::Canceled => Err(Error::Keyring(
                "Windows Hello verification was canceled".into(),
            )),
            _ => Err(Error::Keyring("Windows Hello verification failed".into())),
        }
    }

    fn dpapi_protect(data: &[u8]) -> Result<Vec<u8>, Error> {
        let mut input = blob_from_slice(data);
        let mut entropy = blob_from_slice(DPAPI_ENTROPY);
        let mut output = CRYPT_INTEGER_BLOB::default();
        let mut description = wide_null(DPAPI_DESCRIPTION);

        unsafe {
            CryptProtectData(
                &mut input,
                PCWSTR(description.as_mut_ptr()),
                Some(&mut entropy),
                None,
                None,
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
            .map_err(|e| Error::Keyring(format!("DPAPI protect failed: {e}")))?;
        }

        blob_to_vec_and_free(output)
    }

    fn dpapi_unprotect(data: &[u8]) -> Result<Vec<u8>, Error> {
        let mut input = blob_from_slice(data);
        let mut entropy = blob_from_slice(DPAPI_ENTROPY);
        let mut output = CRYPT_INTEGER_BLOB::default();

        unsafe {
            CryptUnprotectData(
                &mut input,
                None,
                Some(&mut entropy),
                None,
                None,
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
            .map_err(|e| Error::Keyring(format!("DPAPI unprotect failed: {e}")))?;
        }

        blob_to_vec_and_free(output)
    }

    fn blob_from_slice(data: &[u8]) -> CRYPT_INTEGER_BLOB {
        CRYPT_INTEGER_BLOB {
            cbData: data.len() as u32,
            pbData: data.as_ptr() as *mut u8,
        }
    }

    fn blob_to_vec_and_free(blob: CRYPT_INTEGER_BLOB) -> Result<Vec<u8>, Error> {
        if blob.pbData.is_null() {
            return Ok(Vec::new());
        }
        let bytes = unsafe { std::slice::from_raw_parts(blob.pbData, blob.cbData as usize) };
        let out = bytes.to_vec();
        unsafe {
            let _ = LocalFree(Some(HLOCAL(blob.pbData as *mut _)));
        }
        Ok(out)
    }

    fn wide_null(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(std::iter::once(0)).collect()
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

    pub fn set_unlock_secret(
        _app: &AppHandle,
        _passphrase: &str,
        _prompt: &str,
    ) -> Result<(), Error> {
        Err(Error::Keyring(
            "Biometric unlock is only available on Windows".into(),
        ))
    }

    pub fn unlock_secret(_app: &AppHandle, _prompt: &str) -> Result<String, Error> {
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

pub fn set_unlock_secret(app: &AppHandle, passphrase: &str, prompt: &str) -> Result<(), Error> {
    platform::set_unlock_secret(app, passphrase, prompt)
}

pub fn unlock_secret(app: &AppHandle, prompt: &str) -> Result<String, Error> {
    platform::unlock_secret(app, prompt)
}

pub fn has_unlock_secret(app: &AppHandle) -> Result<bool, Error> {
    platform::has_unlock_secret(app)
}

pub fn remove_unlock_secret(app: &AppHandle) -> Result<(), Error> {
    platform::remove_unlock_secret(app)
}
