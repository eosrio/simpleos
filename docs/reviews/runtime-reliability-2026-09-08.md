# Runtime reliability remediation

Date: 2026-09-08. Working tree on `v2-tauri-rewrite`.

The user confirmed the WAX `eosriobrazil / eosio / claimstandby / claim2` linkauth works on chain. Release signing and additional manual acceptance testing are owned by the user. This follow-up addresses the runtime gaps from the original production review; it does not qualify a signed release.

## Implemented

- **Independent network requests.** Commands clone shared provider handles under a short registry lock. RPC, history, endpoint discovery and Ledger operations no longer hold the global provider lock over network/device I/O. Endpoint selection and circuit state remain shared between commands.
- **Bounded failover and recovery.** Each RPC/history operation has a 15-second aggregate deadline, with 5-second requests and 3-second health probes. Unchecked backups, slow but valid backups and endpoints whose 60-second circuit cooldown elapsed are eligible. RPC candidates must serve the requested chain with a recent head before use. Health probes run concurrently and cannot overwrite newer request evidence or clear application-route failure history.
- **Errors remain errors.** Gateway failures and malformed typed responses try another endpoint. Real nodeos/FIO chain rejections return immediately. Hyperion requires HTTP success and a valid payload, preventing a maintenance response from appearing as empty history. History, ABI and producer response shapes are checked at the provider boundary.
- **Stable history.** Older account/filter responses are ignored, duplicate pagination is suppressed, missing/inexact totals still allow pagination, and a failed next page preserves loaded transactions with a retry control. Background balance refreshes retain history filters and pagination. Ultra shows that history is unavailable instead of repeatedly requesting a nonexistent configured service.
- **Stable resources and governance.** Late resource estimates, resource data, producer lists and capability probes cannot update a different account/network. Capability and producer failures expose retry controls. Capability discovery includes the configured system wrapper and FIO's `fio.staking` ABI. Wallet refreshes update accounts by chain/name rather than a potentially stale array position.
- **XPR endpoint repair.** Replaced unavailable XPR defaults with verified RPC/history services. The three history providers are Proton UK, EOS USA and Saltant, published by [XPR's endpoint documentation](https://docs.xprnetwork.org/client-sdks/endpoints) and [XPR's infrastructure repository](https://github.com/XPRNetwork/xpr.start). Each returned the expected chain ID, a current head and an action-history response during this session.

## Evidence

- `src-tauri/src/antelope/provider_tests.rs`: 10 deterministic mock-server regressions cover gateway failover, malformed responses, HTTP history failures, terminal chain rejections, wrong-chain exclusion, request timeout, shared selection, lock contention, circuit persistence/recovery and slow backups.
- `src/app/core/services/runtime-reliability.spec.ts`: 14 regressions cover out-of-order responses, pagination/error recovery, capability failures and alternate contracts, missing history support, and account refresh ownership.
- Full frontend suite: **87 passed**, 11 files.
- After the final unavailable-history guard was aligned with Ultra's actual empty endpoint list, all **14 runtime frontend regressions** passed again.
- Final Rust library suite: **147 passed, 0 failed, 2 opt-in live tests ignored** in 78.99 seconds. The mainnet runtime probe was then explicitly run and passed separately.
- Read-only mainnet probe: **passed**. Account parsing, configured system ABI and producer lists succeeded on all seven mainnets. History succeeded on all six mainnets with a configured history service; Ultra has none. The snapshot is [runtime-mainnet.json](2026-09-08-evidence/runtime-mainnet.json), captured at 20:34:23 UTC. Several individual RPC providers failed while their chain remained usable through alternatives.
- Production Angular build: passed. Existing initial-bundle warning (606.55 kB versus 500 kB) and WharfKit CommonJS warnings remain.
- `git diff --check`: passed.

The live probe is a point-in-time public read check, not transaction or sustained-uptime proof. This session did not send chain transactions, operate a hardware wallet, publish releases, or perform the user's additional acceptance testing. Requests are bounded and obsolete frontend results are ignored; navigating away does not cancel an already dispatched Tauri command.

## Desktop artifact

Final `bunx tauri build --no-sign --bundles nsis`: **passed**, release compilation in 2m40s. The executable was launched for the user; this is startup/process evidence, not manual workflow acceptance.

- Executable: `src-tauri/target/release/simpleos.exe`.
- Executable SHA-256: `1f823934eec0ba80cea3f4265051876dcfbea997794d3515ffce81baf056d482`.
- Unsigned installer: `src-tauri/target/release/bundle/nsis/SimplEOS_2.0.0-alpha.2_x64-setup.exe`.
- Installer SHA-256: `81a23e7d28169df0299ba771c17174fb7a84484f12f5de92d32d375b43fbbbc1`.

These supersede earlier same-day local build hashes. No release feed or signed artifact was published.
