# Production readiness remediation — first critical batch

Date: 2026-09-08. Base: `7c7be1079b4cb0798167059dad9b686f5e172a3f`, branch `v2-tauri-rewrite`.

This records implementation and local acceptance following [the readiness review](production-readiness-2026-09-08.md). The app remains **not approved for a production release**. Changes are in the working tree; no release, update feed, or production wallet was modified.

## Changes and evidence

| Review finding | Implementation | Acceptance status |
| --- | --- | --- |
| F1: recipient serialization mismatch | Reject overlong names and invalid 13th characters in Rust. Validate asset grammar, symbols, precision and magnitude. Decode standard transfer approval details from the actual signed bytes. Send and contacts use the corrected name grammar; Send verifies the recipient on the selected chain. | Regression tests reject the original malformed recipient and assets. Approval tests show the real recipient and quantity even when unrelated JSON is supplied. |
| F2: ESR digest disguised as login | Remove independent digest, display-actions and identity-flag inputs from ESR IPC. Accept packed transactions, parse their complete envelope, derive the signing digest in Rust, and infer login identity/scope from the encoded action. Reject unsupported context-free actions, extensions, malformed identity permissions and trailing bytes. Enforce the request's chain and requested identity in the frontend. | Independent WharfKit v2/v3 identity fixtures match Rust's digest construction. Tests reject hidden/trailing data and prevent a transfer from being classified as login. Physical trusted-window/dapp callback acceptance remains open. |
| F3: partial passphrase rotation | Add atomic batch storage. The file backend stages a complete encrypted snapshot and replaces it with a same-directory rename. Rotation validates/decrypts every indexed namespace before committing keys and the verification token together. Serialize session-dependent operations with rotation, including BLS encryption and storage. Backends without atomic batches return an error before writing. | Injected pre-commit failure preserves the old password, wallet key and BLS key after restart. Retrying rotation succeeds. File migration, namespace separation, corruption and restart tests pass. |
| F4: first-run restore placeholder | Add v2 JSON file selection, password entry, progress/error states, backend import and account discovery to onboarding. Validate every backup secret against its public key before committing. Persist the vault marker after import and detect existing vault material even if that marker is missing. | Tests cover fresh restore, failed-password behavior, offline discovery, persistence and navigation. Rust tests recover and decrypt the restored wallet after reopening the file store. Legacy `.bkp` conversion is explicitly unsupported in this screen. |
| F5: wrong account key / Ledger Send | Resolve a signer against the account's current on-chain permission and threshold. Apply the resolver in Send, ESR and the shared transaction confirmation path. Propagate the Ledger index and check its device public key. Reject watch-only accounts and permissions needing more than one available signer. | Tests cover first-key ordering, owner permission, insufficient multisig weight, Ledger routing and legacy callers reaching the shared transaction path. A real Ledger approval remains unverified. ESR Ledger signing remains explicitly unsupported. |
| F6: renderer policy overwrite | Remove `store:default` from normal and App Store capabilities. Replace renderer Store access with backend preference commands using the fixed `wallet-state.json` path and allowed preference keys. Malformed/unreadable policy contents require strict confirmation; policy writes use an atomic replacement. | Backend tests reject policy/key-file preference names and prove malformed policy selects strict confirmation. Native WebView permission-denial acceptance remains open. |
| F7: missing verifier accepted | Unlock never initializes verification material. Initialization requires an empty store; existing tokens must decrypt to the exact expected plaintext. Storage errors propagate instead of becoming successful password verification. | Tests remove the verifier from a populated wallet and prove both unlock and reinitialization fail. A token with unrelated decrypted plaintext is rejected. |
| F8: chain path traversal/panic | Validate legacy path components before slicing or joining. New snapshots use full namespaces as data rather than truncated directory names. Reject unknown/unindexed legacy material and malformed backup namespaces. | Traversal and multibyte inputs fail without writing outside the key store or panicking. Two chains sharing a 16-character prefix retain distinct new records. |
| F9: updater/release lifecycle | Add cryptographic validation of artifact bytes and the trusted comment against the configured updater key, both during manifest generation and before uploading local artifacts. Matching key IDs alone are insufficient. | Independent minisign golden-vector tests accept the original bytes and reject changed bytes/comments. Existing local signing material is rejected because it does not match the configured release key. The live feed, release assets and upgrade path are still unqualified. |
| F10: broken CI | Correct the Bun action commit using GitHub's resolved v2 SHA. Add Node 24 setup, Angular unit tests and updater signature tests. Required Rust integration tests now fail if the local chain is unavailable under CI or `SIMPLEOS_REQUIRE_E2E`. | Local equivalents pass. No new hosted CI run has been pushed or observed. Platform build coverage still needs expansion. |
| F11: keyring mock backend | No feature switch or silent migration to OS storage was made. The current build still selects the encrypted file fallback, as established in the review. | Open: choose and qualify the supported storage policy, including OS migration/persistence if required. |

## Storage compatibility and recovery

- The active snapshot is `keys/vault-v2.json`. Each namespace is authoritative once migrated, including empty namespaces, so deleting a migrated key does not resurrect its legacy file.
- Existing encrypted files remain in place during migration. They are recovery material and may still use an earlier password; changing the current password does not revoke old backups or change the on-chain private key.
- Older alpha builds cannot read the new snapshot. Do not treat application rollback against a migrated profile as a supported recovery method. Preserve the original profile and validate an encrypted backup in an isolated profile before a real upgrade.
- Missing/corrupt verification material and unknown/unindexed legacy keys stop mutation. This batch does not guess a password, silently repair an index, or overwrite evidence needed for recovery.
- Restart/fault injection was tested on Windows using temporary stores. Power-loss durability, other filesystems, macOS/Linux migration and full installed-profile rollback/restore need separate qualification. On Unix, a directory-sync error after rename is logged as a committed-but-not-confirmed-durable write; it must not leave the session on the old password after a successful rename.
- The app uses one wallet service in one application process. The file-store mutation lock is not a general lock for unrelated processes opening the same profile.

## Verification

Completed during this work:

- Angular: `bun run test --watch=false` — **55 passed**, 9 files.
- Rust library: `cargo test --locked --lib -- --test-threads=8` — **131 passed**, including the added corrupt-store regression.
- Local nodeos/Spring chain: `bun run e2e:run` — **14 passed**.
- Rust chain integration with `SIMPLEOS_REQUIRE_E2E=1`: **16 passed** (7 signing, 9 wallet). Includes signing and pushing a transfer, recovery from backup and signing after password rotation.
- Updater verification: `node --test scripts/verify-updater-signature.test.js` — **3 passed**. Signature data is an independent public test vector from `minisign-verify` 0.2.5, not a release credential.
- Windows NSIS: `bunx tauri build --no-sign --bundles nsis` — **passed**, including the final ESR permission-selection changes.
- `git diff --check` — passed.

The test chain was stopped and its container/network removed after integration tests. Its pre-existing data volume was preserved. Tests used generated/public test keys and temporary vault directories.

The frontend still emits the initial-bundle budget warning (about 606 kB against 500 kB) and CommonJS warnings from WharfKit dependencies. The review's dependency-advisory backlog has not been remediated or re-audited in this batch.

## Remaining release gates

Follow-up: the user confirmed on-chain linkauth acceptance and assigned release
signing and further manual testing to themselves. The runtime work is tracked in
[Runtime reliability remediation](runtime-reliability-2026-09-08.md). The following
release gates remain qualification items, not a claim that this local build is
ready for distribution.

1. Review and land this storage/signing change; obtain a successful hosted CI run for the final commit.
2. Exercise the actual trusted confirmation window: approve, reject, close, concurrent request, strict policy, and denied arbitrary Store invocation. Verify ESR login/transaction callbacks against a real dapp, including chain mismatch and owner permissions.
3. Test real Ledger transactions and audit feature-specific preflight checks that might prevent hardware requests from reaching the shared confirmation service. Delegated/weighted authority workflows require the multisig path; this batch does not implement a general authority solver.
4. Qualify legacy profile migration and recovery on Windows, macOS and Linux, then settle the OS-keyring versus encrypted-file storage policy.
5. Resolve the dependency advisory backlog and complete the missing native/platform acceptance from the original review.
6. Produce artifacts with the actual release signing credentials, verify every referenced local and remote artifact, publish a working feed, and test a real installed-version update and recovery. No such release was published here.

### Final build/test record

- Final Rust library suite: **131 passed, 0 failed**, 77.99 seconds.
- Final Windows release compilation: **passed**, 2 minutes 39 seconds; NSIS packaging also passed.
- Build artifact: `src-tauri/target/release/bundle/nsis/SimplEOS_2.0.0-alpha.2_x64-setup.exe`.
- SHA-256: `432a24ba6bb22c1290f3b96dca63604fe9bad0d54a387ae8563c080613708a49`.
- This artifact is unsigned. The pre-existing adjacent `.sig` is not release evidence and fails validation against the configured updater key.
- Total completed distinct test cases: **219** (131 Rust unit, 55 Angular, 16 Rust chain integration, 14 TypeScript chain integration, 3 updater signature).
