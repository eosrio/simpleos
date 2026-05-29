# macOS Packaging

SimplEOS packages as a Tauri desktop app for macOS 13.3 and newer. The release build produces a signed `.app`, a signed and notarized `.dmg`, and updater artifacts when the Tauri updater private key is available.

## One-time setup

1. Install the Apple `Developer ID Application` certificate in Keychain Access.
2. Install the supported Node runtime if needed:

   ```bash
   brew install node@24
   ```

3. Confirm the command line can see the signing certificate:

   ```bash
   bun run mac:signing-identities
   ```

4. Export release credentials in your shell. Use `.env.macos.example` as the local template and keep the filled file uncommitted.
5. Make sure the updater private key matches the public key in `src-tauri/tauri.conf.json`.

## Build

Signed, notarized app and DMG:

```bash
bun run tauri:build:mac
```

Universal Apple Silicon + Intel build:

```bash
bun run tauri:build:mac:universal
```

Local signed/notarized build without updater artifacts:

```bash
bun run tauri:build:mac:no-updater
```

Artifacts are written under `src-tauri/target/*/release/bundle/`.

## Required environment

Code signing:

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Company Name (TEAMID)"
export APPLE_TEAM_ID="TEAMID"
```

Notarization with App Store Connect API key:

```bash
export APPLE_API_ISSUER="issuer-uuid"
export APPLE_API_KEY="key-id"
export APPLE_API_KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_key-id.p8"
```

Or notarization with Apple ID:

```bash
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="@keychain:AC_PASSWORD"
export APPLE_TEAM_ID="TEAMID"
```

Updater signing:

```bash
export TAURI_SIGNING_PRIVATE_KEY_PATH="$HOME/.tauri/simpleos-updater.key"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
```

## Verification

After the build:

```bash
codesign --verify --deep --strict --verbose=2 "src-tauri/target/release/bundle/macos/SimplEOS.app"
spctl -a -vvv -t install "src-tauri/target/release/bundle/dmg/SimplEOS_2.0.0-alpha.0_aarch64.dmg"
xcrun stapler validate "src-tauri/target/release/bundle/dmg/SimplEOS_2.0.0-alpha.0_aarch64.dmg"
```

Tauri uses `APPLE_SIGNING_IDENTITY` for the macOS signing identity and notarizes when Apple API key or Apple ID credentials are present.
