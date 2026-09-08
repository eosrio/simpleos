# EVM bridge integration — 2026-09-08

## Delivered workflow

An Ultra mainnet account whose signer is managed only by SimplEOS can initiate an Ultra-to-Ethereum transfer from **EVM Bridges**. The screen reads live token configuration and balances, builds the token transfer to `ultra.swap` with `ethereum,<recipient>` memo, and uses the existing transaction review and signer resolution. No Ultra browser wallet is needed.

The recipient completes the Ethereum claim on [Ultra's official bridge](https://bridge.ultra.io/) by connecting the recipient Ethereum wallet, choosing Ultra to Ethereum, and using **Resume Transfer to EVM**. For Ethereum-to-Ultra transfers, the screen supplies the Ultra destination account and instructions for entering it manually on the official site. Ethereum signing remains on the official site, as requested. There is no invented URL prefill or in-app Ethereum signer.

Contract evidence, verified implementation references, and captured public fixtures are recorded in [the research report](ultra-ethereum-bridge-research-2026-09-08.md).

## Implementation boundaries

- `core/bridges/bridge-model.ts` contains route and transfer models, exact integer arithmetic, address checksums, precision and amount validation.
- `EvmBridgeAdapter` separates protocol reads and transaction construction from the dashboard screen. Ultra is the first adapter. Adding another protocol requires an adapter, route, validated backend status reader, and protocol-specific copy where appropriate.
- Native reads use the existing chain-aware RPC provider. A narrow Rust command reads the pinned Ethereum bridge through PublicNode, verifies both chain identities, and exposes pause, schedule, and settlement state. It accepts no arbitrary RPC URL, destination, or method.
- Preflight refreshes configuration and balances before the existing signing dialog. Unavailable data, maintenance, pause, invalid checksums, insufficient balance, limits, and precision loss block submission. Watch-only accounts cannot send.
- Polling stops on navigation and backs off after errors. Stale responses cannot replace another account's state. Local submission receipts remain associated with the original account even if selection changes during confirmation.
- Recorded validator proofs are not treated as verified claims. A nonzero Ethereum settlement block is labeled settled, not proof of token receipt, because administrative repairs can also settle requests. Missing native requests do not imply success. Unknown and older-schedule states direct the user to official recovery.

## Validation

- `bun run test --watch=false`: **101 passed**, including 13 bridge tests covering payloads, integer precision, checksum validation, maintenance/pause, live-shaped configuration, request states, preflight changes, account-switch races, duplicate submission prevention, watch-only behavior, and receipt persistence failure.
- `cargo test --locked --lib`: **149 passed**, 3 network probes ignored by default.
- `cargo test --locked --lib commands::bridge -- --include-ignored --nocapture`: **3 passed**, including the read-only Ethereum mainnet probe through the actual Rust command. It verified bridge identity and a historical settlement.
- A read-only probe through the actual TypeScript adapter verified Ultra chain identity, all four configured token precisions/limits, balances, maintenance, and the numeric sender-index request query. Ethereum state was injected for this native-only probe and separately verified by the Rust probe.
- The actual Angular bridge component was rendered in an isolated preview with synthetic balances/request state at 1440×1000 and 960×640. Both layouts fit without horizontal overflow. Transaction submission in that preview was mocked; native signing remains a manual acceptance item.
- The interface detector reported no findings in its degraded regex mode. This is not a complete accessibility audit.
- `git diff --check` passed. Production frontend compilation passed with initial-bundle budget and upstream CommonJS optimization warnings.
- `bunx tauri build --no-sign --bundles nsis` succeeded. The unsigned x64 installer is `src-tauri/target/release/bundle/nsis/SimplEOS_2.0.0-alpha.2_x64-setup.exe`, SHA-256 `9EE9BAA5890B95AD39844EC41B8AE7011C18293B5DF9F818715BA72F3E38F6F4`. The release app was relaunched and its SimplEOS window responded (PID 107572). This proves process startup, not a completed live bridge transaction.

## Remaining acceptance

No bridge funds were moved and no live transaction was signed during implementation. User acceptance should cover a real Ultra send, validator progression, an Ethereum claim using only the recipient Ethereum wallet, and an Ethereum-to-Ultra return to a manually entered account. Hardware signing and release signing remain user-owned.

Ethereum availability currently depends on one public RPC endpoint; failures disable fresh transfer preflight or show unknown tracking status. Bridge upgrades or validator schedule changes can require a corresponding adapter update or official recovery. The reusable screen is initially configured only for Ultra mainnet to Ethereum mainnet.
