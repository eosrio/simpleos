# Biometric Unlock Platform Support

SimplEOS biometric unlock is a quick-unlock convenience layer around the existing wallet passphrase model. It must not replace the wallet passphrase as the recovery credential, and it must not change private-key encryption or backup compatibility.

The current implementation exposes a platform-neutral Rust facade in `src-tauri/src/biometric.rs` and Tauri commands in `src-tauri/src/commands/wallet.rs`. Windows is implemented first. Other platforms should add backend code behind the same facade and keep the Angular UI unchanged where possible.

## Security Model

- The wallet passphrase remains the primary encryption secret.
- Biometric unlock stores a passphrase shortcut protected by the local operating system.
- Enabling biometric unlock requires the current wallet passphrase and a successful OS biometric/user-verification prompt.
- Unlocking with biometrics retrieves the stored passphrase shortcut and then calls the normal wallet unlock path.
- Changing the wallet passphrase clears quick-unlock secrets, including PIN and biometric unlock.
- Resetting the wallet removes the stored biometric shortcut.

This is equivalent to a desktop password-manager biometric unlock model. It improves local usability, but it is not a second cryptographic factor and does not protect against malware already running as the same OS user.

## Stable API

Keep these Tauri commands stable across platforms:

- `biometric_status() -> BiometricStatus`
- `set_biometric_unlock(passphrase)`
- `unlock_with_biometric() -> bool`
- `has_biometric_unlock() -> bool`
- `remove_biometric_unlock()`

`BiometricStatus`:

```rust
pub struct BiometricStatus {
    pub available: bool,
    pub configured: bool,
    pub reason: String,
}
```

Frontend code should only depend on this generic status, not on platform details.

## Current Windows Backend

Windows support uses:

- Windows Hello user verification through `UserConsentVerifier`.
- `IUserConsentVerifierInterop::RequestVerificationForWindowAsync` when a Tauri HWND is available, so the prompt is parented to the app window.
- DPAPI `CryptProtectData` / `CryptUnprotectData` for user-bound local secret storage.
- `biometric.dat` in the Tauri app data directory for the protected passphrase shortcut.

Implementation notes:

- The `windows` crate is pinned to `0.61.3` because the app currently targets Rust `1.77.2`; newer `windows` versions require newer Rust.
- Windows-specific dependencies are under `target.'cfg(windows)'.dependencies`.
- Non-Windows builds currently return `available = false` from the same facade.

## macOS Plan

Use LocalAuthentication plus Keychain:

- Prompt with `LAContext` and an access-control policy such as biometrics or device owner authentication.
- Store the passphrase shortcut in Keychain with access control requiring user presence or biometric/device authentication.
- Prefer keychain access-control enforcement over a separate "verify then read unprotected secret" flow.
- If biometrics are unavailable but device owner authentication is available, return an accurate `reason` so the UI can explain the fallback.

Likely Rust integration options:

- A small Objective-C/Swift bridge called from Rust.
- `objc2`/`objc2-local-authentication` and `security-framework` if they fit the build constraints.
- A Tauri plugin-style internal module if the bridge grows beyond a few functions.

The platform module should implement the same functions as the Windows backend:

- `status`
- `set_unlock_secret`
- `unlock_secret`
- `has_unlock_secret`
- `remove_unlock_secret`

## Linux Plan

Linux is more fragmented, so support should be capability based:

- Secret storage: Secret Service through GNOME Keyring, KWallet, or compatible providers.
- Biometric verification: `fprintd`/libfprint where available.
- Fallback user verification: desktop keyring unlock, Polkit, or no biometric support depending on distro/session capability.

Recommended initial Linux behavior:

- Report unavailable unless both a supported biometric verifier and a secure secret store are present.
- Keep the secret store and biometric verifier as separate backend traits so distros can vary.
- Avoid storing the shortcut in plain files.
- Provide clear `reason` values for missing `fprintd`, missing enrolled prints, locked keyring, or unsupported desktop session.

## Backend Shape For Future Platforms

Keep `src-tauri/src/biometric.rs` as the public facade and add platform modules behind `cfg` gates:

```rust
#[cfg(windows)]
mod platform;

#[cfg(target_os = "macos")]
mod platform;

#[cfg(target_os = "linux")]
mod platform;
```

Each platform should return the same error categories used elsewhere in the wallet:

- `Error::InvalidPassphrase` for failed verification where it maps cleanly.
- `Error::KeyNotFound` when biometric unlock is not configured.
- `Error::Keyring` for OS credential or biometric subsystem failures.
- `Error::Io` only for app-owned file operations.

## UX Guidelines

- Keep Settings labeled as "Biometric Unlock".
- Use the platform name only in explanatory text, such as "Windows Hello is set for this wallet".
- Always keep "Use passphrase instead" available on the lockscreen.
- Do not require biometric unlock for signing until the security model is revisited. The current feature unlocks the wallet session only.
- If the OS biometric state changes, show a recoverable error and guide the user back to passphrase unlock.

## Test Checklist

For each platform backend:

- Status reports unavailable when no biometric capability exists.
- Status reports unavailable when biometrics exist but are not enrolled.
- Enabling rejects an incorrect wallet passphrase.
- Enabling prompts for OS verification before storing the shortcut.
- Unlocking prompts for OS verification and then unlocks the existing wallet session.
- Removing biometric unlock deletes only the quick-unlock shortcut.
- Changing the wallet passphrase disables biometric unlock.
- Wallet reset removes biometric unlock data.
- Builds pass on non-target platforms through stubs or cfg-gated code.
