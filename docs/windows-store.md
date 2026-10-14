# Microsoft Store (Windows)

SimplEOS ships on Windows two ways. Both are built from the same code:

| | GitHub release | Microsoft Store |
|---|---|---|
| Format | NSIS installer (`SimplEOS_<version>_x64-setup.exe`) | MSIX (`SimplEOS_<version>_x64.msix`) |
| Built by | `bun run tauri:build:win` | `bun run tauri:build:win:store` |
| Code signing | None (SmartScreen warns on first run) | Microsoft re-signs the package after certification |
| Updates | Built-in updater ([releasing-updates.md](releasing-updates.md)) | The Store. The self-updater is compiled out |
| Windows | 10 and 11 | 10 (1903+) and 11 |

The Store listing is **SimplEOS Wallet** (Store ID `9PBGQV7HQ4B4`), published by Rio
Blocks. Its package identity lives in `src-tauri/msstore/AppxManifest.xml` and must match
Partner Center > SimplEOS Wallet > Product identity exactly.

## Why MSIX

Only MSIX packages are signed by the Store. An EXE/MSI submission must already carry an
Authenticode signature from a trusted CA, and the Store just links to an installer we
host and update ourselves. Tauri does not produce MSIX, so
`scripts/windows-msstore-package.js` builds the binary with `tauri build --no-bundle`
and packs it with the Windows SDK's `makeappx`.

The Store build uses the same switches as the Mac App Store build: the `app-store` Cargo
feature (no updater or process plugin) and the `appstore` Angular configuration (no
update UI). `src-tauri/tauri.msstore.conf.json` applies them and lists the capabilities.
It includes `sign-confirm`: once a config lists capabilities, only the listed ones are
enabled, and without it the trusted confirmation window cannot approve a signature.

## The vault and file-system virtualization

The vault is a set of encrypted files in `%APPDATA%\io.eosrio.simpleos\keys`. By
default an MSIX app's *new* files under AppData go to a private per-package folder, and
Windows deletes that folder on uninstall. For a wallet that means keys created or
imported in the Store build would be lost with the app.

The manifest therefore excludes both app-data folders from write virtualization:

- **Windows 11:** `virtualization:ExcludedDirectories` for
  `%APPDATA%\io.eosrio.simpleos` and `%LOCALAPPDATA%\io.eosrio.simpleos` only.
- **Windows 10 1903+:** `desktop6:FileSystemWriteVirtualization=disabled` (all of
  AppData), which Windows uses where it does not understand the per-folder form.

Both builds read and write the same files, so users can move between them, and
uninstalling the Store app leaves the vault in place. Both declarations need the
`unvirtualizedResources` restricted capability, which has to be justified at submission
(text below).

## Versions

MSIX versions are four numbers, each at most 65535, and the last must be 0. The script
maps the `package.json` version so prereleases still sort below the release:

| package.json | MSIX |
|---|---|
| `2.0.0-alpha.3` | `2.0.3.0` |
| `2.0.0-beta.1` | `2.0.301.0` |
| `2.0.0-rc.2` | `2.0.602.0` |
| `2.0.0` | `2.0.999.0` |
| `2.0.1-alpha.1` | `2.0.1001.0` |

The Store always serves the highest version, so never publish a lower one after a
higher. The app itself shows the `package.json` version.

## Building

```bash
bun run tauri:build:win:store            # full release build, then pack
node scripts/windows-msstore-package.js --skip-build   # re-pack the last build
```

Output: `src-tauri/target/msstore/SimplEOS_<version>_x64.msix`, plus the unpacked
package in `src-tauri/target/msstore/stage`. The package is unsigned, which is what
the Store expects.

## Testing locally

An unsigned package cannot be installed by double-clicking, but with **Developer Mode**
on (Settings > System > For developers) the staged folder can be registered directly:

```powershell
Add-AppxPackage -Register src-tauri\target\msstore\stage\AppxManifest.xml
# remove it again
Get-AppxPackage RioBlocks.SimplEOSWallet | Remove-AppxPackage
```

The Store build uses the real `%APPDATA%\io.eosrio.simpleos` folder, the same one the
NSIS build uses. Copy that folder somewhere safe before testing against a real vault.

Things to check before submitting:

- It unlocks an existing vault created by the NSIS build.
- After importing a key, `keys\vault-v2.json` appears in the real
  `%APPDATA%\io.eosrio.simpleos\keys` folder and **not** under
  `%LOCALAPPDATA%\Packages\RioBlocks.SimplEOSWallet_e8hadpths8w5g\LocalCache`.
- After uninstalling, the vault folder is still there and the NSIS build unlocks it.
- An `esr:` link opens the app with the request.
- Settings shows no update card.

The Windows App Certification Kit is deprecated but still runs locally:

```powershell
& "${env:ProgramFiles(x86)}\Windows Kits\10\App Certification Kit\appcert.exe" test `
  -appxpackagepath src-tauri\target\msstore\SimplEOS_<version>_x64.msix `
  -reportoutputpath $env:TEMP\simpleos-wack.xml
```

## Submitting

In Partner Center > SimplEOS Wallet, start a submission:

1. **Packages:** upload the `.msix`.
2. **Submission options > Restricted capabilities:** justify `unvirtualizedResources`
   and `runFullTrust`, for example:

   > SimplEOS Wallet is a self-custody cryptocurrency wallet. The user's private keys
   > are stored, encrypted with AES-256-GCM under a key derived from the user's
   > passphrase, in %APPDATA%\io.eosrio.simpleos. With file-system write
   > virtualization these files would be moved into the package's private folder and
   > deleted when the app is uninstalled, permanently destroying the keys and any funds
   > they control if the user has no backup. Only this folder and
   > %LOCALAPPDATA%\io.eosrio.simpleos (the app's WebView data) are excluded, so the
   > vault survives uninstall and reinstall and stays shared with the standalone
   > installer edition of the same app. runFullTrust is required because the app is a
   > Win32 desktop application.

3. **Properties:** category Finance; a privacy policy URL is required for desktop
   (Win32) apps.
4. **Store listing, age ratings, pricing and availability** as usual. For a
   prerelease, consider limiting visibility to a private audience.

Store policy allows cryptocurrency wallets only from company accounts (10.2.6), and apps
handling private keys or crypto transactions count as financial apps (10.8.3). The
publishing account is a verified company account.
