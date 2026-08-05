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
`src-tauri/tauri.conf.json > bundle.updater.pubkey`, and the private key never leaves
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

## Prerequisites

The updater signing key must be available to `tauri build`, or no `.sig` files are
produced and there is nothing to publish:

```bash
export TAURI_SIGNING_PRIVATE_KEY_PATH="$HOME/.tauri/simpleos-updater.key"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
```

Publishing also needs the GitHub CLI (`gh`) authenticated with write access.

## Releasing

1. **Bump the version.** Edit `version` in `package.json` — the single source of truth.
   `tauri.conf.json` reads it, so the bundle, the DMG name and the updater all agree.
   For a Mac App Store release, also update `src-tauri/tauri.appstore.conf.json` to the
   matching plain `x.y.z` (the packaging script fails the build if it drifts).

2. **Build and sign, per platform.** Each platform must be built on a machine that can
   sign for it:

   ```bash
   bun run tauri:build:mac:universal   # macOS: signed, notarized, stapled
   bun run tauri:build                 # Windows / Linux
   ```

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

## Verifying

After publishing, confirm the endpoint serves what you expect (raw.githubusercontent
caches for a few minutes):

```bash
curl -s https://raw.githubusercontent.com/eosrio/simpleos/updater/latest.json | jq
```

Then launch the previous version and confirm the **Update ready** indicator appears in
the sidebar. Settings → Updates → **Check now** forces a re-check without restarting.
