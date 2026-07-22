# macOS Packaging

SimplEOS packages as a Tauri desktop app for macOS 13.3 and newer. The release build produces a signed `.app`, a signed and notarized `.dmg`, and updater artifacts when the Tauri updater private key is available.

## One-time setup

1. Confirm the EOS Rio `Developer ID Application` identity is available. The
   certificate files are already on Desktop and the matching private key is
   installed in the login Keychain:

   ```bash
   security find-identity -v -p codesigning | grep 'Developer ID Application'
   ```

2. Confirm the existing Agent Portal notary profile works. This reads the
   credential from Keychain and does not expose its password:

   ```bash
   xcrun notarytool history --keychain-profile agent-portal-notary
   ```

3. Install the supported Node runtime if needed:

   ```bash
   brew install node@24
   ```

4. Make sure the updater private key matches the public key in
   `src-tauri/tauri.conf.json`.

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

Every build through this script submits and staples the app and DMG, then verifies
the app signature, Gatekeeper assessment, DMG staple, and DMG Gatekeeper assessment.

## Required environment

Code signing:

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: EOS Rio Infraestrutura de Redes Ltda (FS7QM58848)"
```

Notarization uses the existing password-free Keychain profile:

```bash
export APPLE_NOTARY_KEYCHAIN_PROFILE="agent-portal-notary"
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
spctl --assess --type execute --verbose=4 "src-tauri/target/release/bundle/macos/SimplEOS.app"
xcrun stapler validate "src-tauri/target/release/bundle/dmg/SimplEOS_2.0.0-alpha.1_aarch64.dmg"
spctl --assess --type open --context context:primary-signature --verbose=4 "src-tauri/target/release/bundle/dmg/SimplEOS_2.0.0-alpha.1_aarch64.dmg"
```

Tauri signs the app and DMG with `APPLE_SIGNING_IDENTITY`. The release script
submits the app archive and final DMG using `--keychain-profile`, staples both
tickets, and verifies them with `codesign`, Gatekeeper, and `stapler`.
