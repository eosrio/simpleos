# Shipping an update

How a build reaches existing installs. Packaging and notarization details live in
[macos-packaging.md](macos-packaging.md); this covers the updater specifically.

## How the app checks

`UpdateService` (`src/app/core/services/update.service.ts`) runs a silent check at
startup and whenever someone presses **Check now** in Settings → Updates. When an
update is found, the sidebar footer swaps the version label for an **Update ready**
indicator that deep-links to that card; installing downloads the artifact, verifies its
minisign signature, installs, and relaunches.

Nothing is installed without a valid signature — the public key is pinned in
`src-tauri/tauri.conf.json > plugins > updater > pubkey`, and the private key never leaves
the release machine.

Mac App Store builds strip the updater plugin entirely (Apple ships those updates), so
the Settings card and the indicator are hidden there.

## Where the manifest lives

```
https://raw.githubusercontent.com/eosrio/simpleos/updater/latest.json
```

A branch, not a release asset. GitHub's `releases/latest/` URL only ever resolves to the
newest **non-prerelease** — while v2 ships as alpha that is v1.0.5 from 2020, so an
endpoint pointing there can never offer a v2 build. A fixed branch path works regardless
of prerelease flags.

To serve it from EOS Rio infrastructure instead, change the single `endpoints` entry in
`src-tauri/tauri.conf.json` and publish the same file there; nothing else depends on the
host.

## Building from source

```bash
bun install
bun run tauri:build      # any OS — nsis on Windows, appimage+deb on Linux, app+dmg on macOS
```

That works without any signing key. Tauri refuses to bundle when it finds a configured
updater public key and no private key to match — the error is *"A public key has been
found, but no private key"* — so `scripts/package-desktop.js` passes `--no-sign` when
no key is configured. The build succeeds and produces a working app.

**A source build still receives official updates.** Verification uses the *public* key
baked into `tauri.conf.json`, which every clone of this repo shares, so a self-built app
trusts exactly the same signed releases as a downloaded one. What it cannot do is act as
an update *for* anyone else, since nothing signed its artifacts.

Two consequences worth knowing:

- A source build of an unreleased commit reports the version in `package.json`. If that
  is the same as the latest release, no update is offered until the next one ships.
- `bun run tauri:build:raw` is the unwrapped `tauri build` if you want Tauri's own
  behaviour, key requirement included.

## Prerequisites for releasing

The updater signing key must be available to `tauri build`, or no `.sig` files are
produced and there is nothing to publish:

```bash
export TAURI_SIGNING_PRIVATE_KEY_PATH="$HOME/.tauri/simpleos-updater.key"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
```

> **`tauri build` itself only reads `TAURI_SIGNING_PRIVATE_KEY`** — the `_PATH` variant
> works for `tauri signer sign` but is silently ignored when bundling, and the build
> then dies with *"a public key has been found, but no private key"* **after** the full
> release compile. The packaging scripts read the file into `TAURI_SIGNING_PRIVATE_KEY`
> for you, so exporting either variable works through them. Raw `bunx tauri build`
> needs the key contents, not the path.
>
> Export `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` too, even when it is empty. Without it
> Tauri prompts for the password on stdin, which hangs a non-interactive build after
> everything else has already been compiled and bundled.

Publishing also needs the GitHub CLI (`gh`) authenticated with write access.

## Releasing

1. **Bump the version.** Edit `version` in `package.json` — the single source of truth.
   `tauri.conf.json` reads it, so the bundle, the DMG name and the updater all agree.
   For a Mac App Store release, also update `src-tauri/tauri.appstore.conf.json` to the
   matching plain `x.y.z` (the packaging script fails the build if it drifts).

2. **Build and sign, per platform.** Each platform must be built on a machine that can
   sign for it — there is no cross-compilation here:

   ```bash
   bun run tauri:build:mac:universal   # macOS: signed, notarized, stapled
   bun run tauri:build:win             # Windows: SimplEOS_<version>_x64-setup.exe + .sig
   bun run tauri:build:linux           # Linux: AppImage (+ deb, which the updater ignores)
   ```

   The Windows and Linux commands are the same script; each just defaults to that
   platform's bundles. Pass `--bundles` to override, e.g. `--bundles msi` on Windows.

   Only the AppImage is updatable on Linux — Tauri's updater cannot replace a `.deb`
   install, so users who installed the deb update through their package manager or by
   downloading a new one.

   Windows installers are not Authenticode-signed here, so SmartScreen will warn on
   first run. The updater's own minisign signature is what protects the update path;
   Authenticode is a separate purchase and a separate step.

3. **Generate the manifest** from the signed artifacts left in `src-tauri/target`:

   ```bash
   bun run updater:manifest -- --notes "What changed in this release"
   ```

   It writes `dist/updater/latest.json`, mapping each artifact to the `{os}-{arch}` keys
   the updater looks up. A universal macOS build is listed under both `darwin-aarch64`
   and `darwin-x86_64`, since Tauri matches on the running architecture and has no
   universal fallback.

4. **Publish** — uploads the artifacts to the release for the tag (creating it as a
   prerelease if needed) and writes `latest.json` to the `updater` branch:

   ```bash
   bun run updater:publish:dry    # prints exactly what would happen
   bun run updater:publish
   ```

Repeat steps 2–4 on each platform's machine. Publishing merges into whatever is already
on the branch, so a Windows release adds `windows-x86_64` without dropping the macOS
entries — as long as the version matches. A different version replaces the manifest
outright, which is what you want: a half-published release should never advertise a mix
of versions.

The publish step refuses to run if the manifest references an artifact that is neither
built locally nor already attached to the release, so the branch cannot end up
advertising a download that 404s.

## Rehearsing the whole flow locally

Before trusting a release to reach people, you can exercise discovery → download →
signature check → install on your own machine, with no production key and nothing
published:

```bash
node scripts/updater-selftest.js prepare    # throwaway keypair + build config override
# ...run the build command it prints, then install that build...
node scripts/updater-selftest.js serve      # serves a manifest advertising a higher version
```

`prepare` writes `.updater-selftest/override.json`, which repoints `plugins > updater`
at a throwaway public key and `http://localhost:4599/latest.json`. The build you make
with it trusts only that key, so a rehearsal can never be confused with a real release.
`serve` then advertises the next version number over the artifacts you just built.

That override also sets `dangerousInsecureTransportProtocol`, because the updater plugin
**panics on startup** if an endpoint is not HTTPS — *"the configured updater endpoint
must use a secure protocol"*. It exists only in the generated override and never in the
shipped `tauri.conf.json`, so it cannot reach a real build.

Close any other running copy first. The single-instance plugin makes a second launch
hand its arguments to the instance that is already running and exit immediately, so the
new build never starts and never checks — which looks exactly like a broken updater.

Because the "update" is the same build, the relaunched app reports the old version and
offers the update again — that is expected. The rehearsal proves the transport, the
signature check and the install; it does not prove the version bump. For a genuine
upgrade, build twice with different `package.json` versions and serve the newer one.

Everything lives in `.updater-selftest/` (gitignored) and can be deleted at any time.

## Verifying a real release

After publishing, confirm the endpoint serves what you expect (raw.githubusercontent
caches for a few minutes):

```bash
curl -s https://raw.githubusercontent.com/eosrio/simpleos/updater/latest.json | jq
```

Then launch the previous version and confirm the **Update ready** indicator appears in
the sidebar. Settings → Updates → **Check now** forces a re-check without restarting.
