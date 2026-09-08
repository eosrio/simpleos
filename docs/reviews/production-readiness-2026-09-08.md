# SimplEOS production readiness review — 2026-09-08

**Decision: do not release this revision for general use with real funds.** The existing suites pass, but recovery, signing correctness, and release delivery contain concrete blockers that those suites do not cover.

Reviewed `v2-tauri-rewrite` at `7c7be1079b4cb0798167059dad9b686f5e172a3f`, version `2.0.0-alpha.2`. Scope: current Angular/Tauri app, Rust wallet/transaction/provider code, frontend signing and recovery routes, desktop configuration, updater, CI, and tests. The archived Electron `v1/` app was excluded. The checkout was clean at the start. No application code was changed; the only retained additions are this report and review evidence.

P1 means fix before production release. P2 means a material defect or hardening gap requiring an explicit disposition. Security findings below state their prerequisites; renderer-compromise findings are not claims that an ordinary remote website can directly invoke privileged commands.

## Findings

### F1 · P1 · A transfer can sign a different recipient from the one shown

[`serialize.rs:20`](../../src-tauri/src/antelope/serialize.rs) accepts overlong names and masks the thirteenth character to four bits instead of rejecting invalid input. The executed probe encoded `abcdefghijklz` as **`abcdefghijklj`**. The Send form permits any `a-z` character in position 13 (`send.ts:887`), and submission does not require a successful account lookup. If the resulting canonical account exists, the signed transfer can target it.

The confirmation summary compounds this: `sign_confirm.rs:317-327` labels locally serialized data verified and displays `original_json`, without decoding and comparing the signed bytes. Thus the incorrect recipient can appear as a verified action. This is a reproduced serializer mismatch with the frontend and confirmation routes traced in source; no mainnet transaction was sent.

**Fix/acceptance:** reject invalid and overlong Antelope names at the backend boundary; round-trip critical action fields from the packed bytes before calling them verified. Test the exact recipient above through Send, trusted confirmation, and a local-chain transfer.

### F2 · P1 · An arbitrary signing digest can be presented as a login

[`begin_esr_sign`, `sign_confirm.rs:760-845`](../../src-tauri/src/commands/sign_confirm.rs) accepts the digest, chain, action descriptions, origin, and `is_identity` independently from the renderer. Its only digest check is 64 hexadecimal characters. Setting `is_identity=true` selects “Login request” and sets `any_unverified=false`; `confirm.ts:66-76` then hides the action list. Approval reaches `sign_digest` at `sign_confirm.rs:531` without establishing that the digest describes an identity request.

A compromised main renderer can therefore request a transaction signature under an innocuous login display. User approval is still required; the defect is approval of misleading content, not silent signing. Separately, `esr.service.ts:67-86` logs the request chain but uses the selected account's chain for key lookup without enforcing equality, so displayed network and digest network are not bound either. These are source-validated paths, not a reproduced WebView compromise.

**Fix/acceptance:** parse and resolve ESR in the backend, derive both digest and displayed summary from one validated request, enforce the chain, and verify identity semantics rather than trusting a renderer boolean. Reject mismatched digest/action/chain and fake-login cases.

### F3 · P1 · A partial passphrase change strands keys

[`wallet.rs:434-475`](../../src-tauri/src/keystore/wallet.rs) overwrites encrypted keys one at a time and updates the vault verifier only after all writes. There is no transaction, staging generation, or rollback. A deterministic store probe failed the second key write: the old password still unlocked the vault but could not decrypt the first key; the new password could not unlock it; retrying the change failed. Recovery then needs a prior backup or a manual repair outside the normal UI.

**Fix/acceptance:** stage a complete new generation, verify it, and switch an atomic manifest only after durable writes. Inject failures at every write and restart boundary and prove that one complete password/key generation remains usable. File blobs and indices also use direct `fs::write`, so crash-safe persistence needs coverage beyond password rotation.

### F4 · P1 · Fresh-install recovery from the app's own backup is unfinished

[`landing.ts:569-575`](../../src/app/features/landing/landing.ts) renders a placeholder for the advertised Restore Backup action; it has no file input or import handler. Settings exports a `.json` v2 backup and can import one, but that does not implement the advertised first-run recovery path. The backend `import_backup` command (`commands/wallet.rs:424-429`) also omits `mark_vault_created`, unlike private-key import.

**Fix/acceptance:** implement first-run v2 backup import, create the vault marker only after a successful restore, discover restored accounts, and verify recovery on an empty app-data directory followed by an application restart. Decide separately whether legacy `.bkp` migration is supported; the current first-run copy suggests it is.

### F5 · P1 · Send uses the first chain key and does not route Ledger accounts

[`send.ts:829-833,919-924`](../../src/app/features/dashboard/send/send.ts) selects `listPublicKeys(chainId)[0]` without matching the selected account's active permission. An executed component probe selected Bob, whose active authority references Bob's key, and observed a confirmation request using Alice's key. Normal chain authorization should reject this; it is a signing failure, not an authorization bypass.

A second probe selected a Ledger account with no software keys. Send returned “watch-only” before reaching the hardware signing flow. Even with software keys, the confirmation request does not pass the account's Ledger index. `TransactionService.confirm` requires that index to choose its hardware route. ESR also uses the first chain key (`esr.service.ts:125`).

**Fix/acceptance:** resolve the signer from account permissions and wallet mode in a shared service. Cover two accounts with different keys, owner versus active keys, watch-only accounts, threshold authorities, and Ledger-only accounts. Hardware approval still needs a physical-device test.

### F6 · P1 · Strict confirmation policy is writable through the generic store plugin

[`capabilities/default.json:11`](../../src-tauri/capabilities/default.json) grants the main renderer `store:default`. In the locked `tauri-plugin-store` 2.4.3 implementation, `load` accepts the path, ignores an existing file's deserialize failure, and `save` writes JSON to that path. Meanwhile `sign_confirm.rs:893-911` considers `confirm_policy` backend-owned and interprets any content other than the literal `strict` as Standard.

Consequently a compromised main renderer can load `confirm_policy` as a store and save an empty JSON object, causing the next policy read to downgrade without calling the passphrase-gated setter. This removes the extra password factor; it does not remove the confirmation window. Source-validated against the installed plugin, with no mutation of the user's actual policy file. Tauri documents the generic store's load/save API and its default permissions in the [official Store reference](https://v2.tauri.app/plugin/store/).

**Fix/acceptance:** expose narrow preference commands with fixed filenames instead of arbitrary store paths; protect security state from renderer-writable storage and fail closed on malformed policy. Test an attempted store write to the policy file from the main WebView.

### F7 · P1 · Missing verifier data silently establishes a new password

[`wallet.rs:132-143`](../../src-tauri/src/keystore/wallet.rs) treats every verifier read error as a migration case, accepts the supplied password, and creates a new token. The probe removed only the verification token, unlocked with an unrelated password, and then confirmed that the original password could no longer unlock and the existing key could not decrypt. Actual storage failures can enter the same branch because missing data and read errors are not distinguished.

**Fix/acceptance:** distinguish a genuinely new vault from a damaged or temporarily unavailable store. Migration must prove the credential against existing keys before replacing the verifier. Test missing, corrupted, unreadable, and partially restored metadata while preserving the existing vault.

### F8 · P2 · Unvalidated chain identifiers escape the file namespace or panic

[`store.rs:157-159`](../../src-tauri/src/keystore/store.rs) joins the first 16 bytes of a caller-controlled chain string onto the key directory. Probes confirmed `../escaped` writes an index outside `keys/`, and `aaaaaaaaaaaaaaaé` panics because byte 16 splits a UTF-8 character. Release builds use `panic = "abort"`. Backup entry metadata flows to this path without validation (`wallet.rs:621-638`); the chain namespace is not authenticated by the encrypted key blob.

The filesystem probe stayed wholly inside a newly created review sandbox. No arbitrary code execution or access to unrelated user files was attempted or established.

**Fix/acceptance:** validate supported external chain IDs, isolate internal namespaces, use a full filesystem-safe encoding/hash, and propagate filesystem errors. Reject traversal, absolute paths, multibyte strings, prefix collisions, and reserved vault namespaces before any writes.

### F9 · P1 · The configured update feed is absent

The exact endpoint in [`tauri.conf.json:83`](../../src-tauri/tauri.conf.json), [the updater manifest](https://raw.githubusercontent.com/eosrio/simpleos/updater/latest.json), returned **HTTP 404** during this review. The GitHub release inventory showed v2 alpha.1 with one universal DMG and no updater signature assets; alpha.2 was not published. Existing installations cannot discover updates through the configured v2 feed.

**Fix/acceptance:** publish a versioned, correctly signed release and platform manifest, then upgrade an installed previous build. Exercise invalid-signature rejection, interrupted downloads, installation, relaunch, and version reporting. Keep this release-delivery gate distinct from compilation. [Current published v2 release](https://github.com/eosrio/simpleos/releases/tag/v2.0.0-alpha.1).

### F10 · P1 · CI for the reviewed commit cannot run frontend or end-to-end gates

The [CI run for this exact commit](https://github.com/eosrio/simpleos/actions/runs/31008005697) failed its Angular and E2E jobs during setup; Rust unit tests passed. The saved GitHub annotation identifies `oven-sh/setup-bun@0c5077e4f16972049d10e0521c7a8270570b656b` as unresolvable. That SHA appears in [`.github/workflows/ci.yml:32,85`](../../.github/workflows/ci.yml).

The workflow also never runs Angular unit tests or builds Windows/macOS installers. Rust integration helpers return normally when the test chain is missing, so a green integration-test process alone does not establish that chain tests executed.

**Fix/acceptance:** pin a resolvable verified action revision; require frontend tests, a live local chain, and platform release build jobs; obtain a green run on the corrected release commit. Do not interpret the current remote setup failure as a local source-build failure.

### F11 · P2 · OS keyring support is not compiled in

[`Cargo.toml:73`](../../src-tauri/Cargo.toml) declares `keyring = "3"` without platform features. The resolved graph contains only `keyring/default`. An executed probe wrote through one Entry, read it successfully there, and failed to read through a fresh Entry, matching the mock backend. The application's fresh-entry probe correctly rejects that backend and falls back to encrypted files, so this is **not** a claim that production keys are stored only in memory or plaintext. However, the advertised OS keyring path is inactive, and changing this later without a migration could switch storage away from existing file-backed keys.

**Fix/acceptance:** enable and test intended platform backends and make storage selection persistent with an explicit migration/recovery path. The keyring v3 requirement for explicit backend features is confirmed in its [versioned README](https://docs.rs/crate/keyring/3.6.3/source/README.md).

## Verification and limits

| Check | Result |
| --- | --- |
| Angular production build | Passed; initial bundle 607.77 kB exceeds the 500 kB warning budget, below the 1 MB error limit |
| Existing Angular unit tests | 43 passed, 6 files |
| Rust `cargo test --locked --lib` | 116 passed; default Ledger and local ABI features enabled |
| Docker chain + TypeScript suite | 14 passed on a newly started local nodeos chain |
| Rust chain integration | 7 signing + 9 wallet tests passed with that chain running |
| Focused review probes | 6 Rust + 2 Angular probes reproduced the described defects; their passing assertions document defects, not readiness |
| Windows release/NSIS build | Passed with `bunx tauri build --no-sign --bundles nsis`; release compile finished in 3m44s; installer generated, not installed or signed |
| Live mainnet RPC snapshot | 17 of 22 configured endpoints returned matching chain IDs and recent heads; every one of 7 mainnets had a responding endpoint |
| Update feed / exact-commit CI | Failed as detailed above |
| JS dependency audit | Nonzero: 86 advisory instances across 20 packages, including 1 critical, 31 high, 46 moderate, 8 low; scanner severities, not validated app vulnerability counts |

The audit's critical entry is in build-tool dependency `tar`; the identified renderer dependency is `elliptic` 6.6.1, rated low by the feed. Private-key signing uses Rust. Dependency findings need reachability triage; the counts are not evidence of 86 remotely exploitable desktop defects. Rust advisory scanning was not completed. Raw audit and network results are retained in [the evidence directory](2026-09-08-evidence/).

The RPC snapshot is from this machine at the timestamp in `endpoints.json`, not a chain-availability SLA or transaction acceptance proof. Five individual fetches failed, and several working endpoints exceeded the app's 1200 ms healthy-selection threshold. Endpoint failover under sustained failures, global provider-lock contention, and Hyperion history still need runtime qualification.

Local tools were Node 26.4.0, Bun 1.4.3, Rust 1.97.0-nightly, and Docker 29.7.2; these differ from some documented/pinned versions. The test chain container/network were removed afterwards; its newly created test data volume was retained. Production accounts and wallet files were not used.

The unsigned Windows build produced `src-tauri/target/release/bundle/nsis/SimplEOS_2.0.0-alpha.2_x64-setup.exe`, SHA-256 `c42b41e05f1a9923cb6c9485802b0425af2f7ac897396ff8062c261fd0a0a99f`. An older adjacent `.sig` from August 5 remains in the pre-existing build directory; it is not evidence of a signature for this new installer. This is a local build artifact, not a publishable signed release. Release staging should verify signatures over the actual artifact bytes rather than checking only the signature key ID or filename.

Not proven: native installed-app startup/restart recovery, actual trusted-window IPC attack rejection, physical Ledger and Windows Hello flows, macOS/Linux install and signing/notarization for this revision, App Store behavior, real signed upgrades, all chain-specific resource/governance flows, crash/power-loss recovery, or an exhaustive independent security audit. The production config also leaves CSP unset; the optional PIN wraps the passphrase with a 4–6 digit derived secret in a local file, so offline PIN exposure needs a deliberate security decision.

## Release acceptance

Resolve F1–F7 and establish F9–F10 before broad distribution. Give F8 and F11 an explicit remediation/disposition and validate the file-storage path that actually ships. Add tests at the real boundaries: fresh restore and restart, partial writes, two different account keys, hardware-only signing, malformed serialization, ESR summary/digest binding, and main-WebView attempts to modify confirmation policy. Then qualify signed artifacts on each supported platform and a complete previous-version upgrade. Existing cryptographic and local-chain tests are useful foundations, but do not cover these acceptance gaps.
