# Review evidence

Collected for commit `7c7be1079b4cb0798167059dad9b686f5e172a3f` on September 8, 2026.

- `readiness_review_probe.rs`: six Rust probes executed as temporary `src-tauri/tests/readiness_review_probe.rs` using `cargo test --locked --test readiness_review_probe -- --nocapture --test-threads=1`. All six assertions confirmed the current defects/behavior. They use generated throwaway keys, an in-memory fault-injection store, and dedicated temporary directories. The traversal probe writes only within its own temporary root.
- `readiness-review-probe.spec.ts`: two Angular component probes executed as temporary `src/app/readiness-review-probe.spec.ts` using `bun run test --watch=false --include=src/app/readiness-review-probe.spec.ts`. Both confirmed current behavior. The final Ledger fixture uses the real model's `mode: 'full'` and `ledgerIndex: 2`.
- `endpoints.json`: timestamped read-only HTTP response snapshot from the 22 mainnet RPC URLs in the current Rust configuration. This is a one-time measurement from Windows, not availability monitoring.
- `check-endpoints.cjs`: the exact snapshot script, executed from the repository root; it writes its output under `tmp/`.
- `bun-audit.json`: raw advisory feed response for the root lockfile; not reachability validation and not a scan of `v1/`.
- `ci-run.json`, `ci-annotations.json`: current GitHub API results for the run on the reviewed commit, including the unresolved Bun action revision.

Temporary tests were removed from the application's normal test directories after execution. Preserved copies intentionally assert the current failures; convert them into desired-behavior regression tests when implementing fixes. Do not interpret their passing result as a production gate passing.

Existing suites: Angular 43 passed; Rust library 116 passed; local-chain TypeScript 14 passed; Rust integrations 16 passed. The chain was reachable during integration tests. No ignored/skipped-chain run was used as acceptance evidence.

Build verification: Angular production bundle passed; unsigned Windows NSIS release packaging passed. Installer SHA-256: `c42b41e05f1a9923cb6c9485802b0425af2f7ac897396ff8062c261fd0a0a99f`. The installer was not launched or installed. The older adjacent signature file is not a verified signature for this artifact.
