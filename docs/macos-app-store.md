# Mac App Store Packaging

SimplEOS can be packaged for the Mac App Store as a sandboxed macOS app. This build lane is separate from the direct-distribution DMG lane.

## Apple Developer Setup

Team ID:

```bash
export APPLE_TEAM_ID=FS7QM58848
```

Create or install these items for bundle ID `io.eosrio.simpleos`:

1. Mac App Distribution certificate.
2. Mac Installer Distribution certificate.
3. Mac App Store provisioning profile.
4. App Store Connect app record for SimplEOS.

Use `.env.appstore.example` as the local environment template. The packaging script automatically loads `.env.appstore` when it exists.

If `xcrun altool` is not found, make sure `DEVELOPER_DIR` points to full Xcode instead of Command Line Tools:

```bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
```

## Build

```bash
bun run tauri:build:mac:appstore
```

Validate the signed package with App Store Connect:

```bash
bun run tauri:build:mac:appstore:validate
```

Install the signed App Store build locally for testing:

```bash
bun run tauri:install:mac:appstore
```

This builds the App Store lane with the same sandbox and no self-updater, but signs it locally so macOS can launch it before App Store delivery. It then copies the app to `~/Applications/SimplEOS.app` and verifies the copied signature. Add `:open` to launch it after install:

```bash
bun run tauri:install:mac:appstore:open
```

The fully signed upload build produced by `bun run tauri:build:mac:appstore` is for App Store Connect validation/upload. macOS may reject that upload-signed `.app` when launched directly outside the App Store.

Upload the package:

```bash
bun run tauri:build:mac:appstore:upload
```

`APPLE_PROVIDER_PUBLIC_ID` is only needed when App Store Connect reports multiple providers for the account. Xcode 26's `altool --list-providers` does not support API-key authentication, so skip provider discovery unless validation or upload explicitly asks for it. If it does, run `--list-providers` with an Apple ID and app-specific password, or use Transporter.

The script builds a universal Apple Silicon + Intel app, embeds the provisioning profile, signs with the Mac App Store application certificate, and produces a signed installer package:

```text
src-tauri/target/universal-apple-darwin/release/bundle/pkg/
```

Current validated package:

```text
src-tauri/target/universal-apple-darwin/release/bundle/pkg/SimplEOS_2.0.0_universal_appstore.pkg
```

## Xcode and Transporter

This is a macOS App Store flow, not an iOS flow. Xcode is still required for the Apple developer account, signing assets, SDK tooling, and App Store validation tools, but the Tauri desktop app is packaged from the command line instead of an Xcode app target.

For a GUI upload, install Apple's Transporter app and upload the generated `.pkg`. Xcode Organizer can also upload macOS apps, but it expects an Xcode archive; Tauri's desktop macOS build does not create one by default. The script uses the same Apple signing identities and App Store Connect upload tooling without adding a separate Xcode wrapper project.

## App Store Differences

- App Sandbox is enabled.
- Network client access is enabled for chain RPC/API calls.
- User-selected file read/write is enabled for backup import/export.
- USB access is enabled for Ledger hardware wallet support.
- Tauri updater artifacts and runtime update checks are disabled; App Store builds rely on App Store updates.

Ledger support must be tested in a sandboxed build before submission. If App Review rejects USB/HID access, submit with a clear explanation that the app supports optional Ledger hardware-wallet transaction signing and does not trade, exchange, or broker assets.
