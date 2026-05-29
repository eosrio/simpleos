# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SimplEOS v2 is a desktop wallet for Antelope-based blockchains (Vaulta/EOS, WAX, Telos, Ultra, FIO, Libre, XPR). It is a **Tauri 2 + Angular 22** rewrite of the original Electron app — all cryptography, key storage, and chain I/O live in a **Rust backend** (`src-tauri/`); the Angular SPA (`src/`) is a pure renderer that talks to Rust over Tauri IPC and never touches private keys.

Workspace versions are `2.0.0-alpha.0`. The active development branch is `v2-tauri-rewrite`; PRs target `master`.

## Toolchain & Commands

- **Package manager: Bun** (`bun@1.3.11`) — not npm/yarn. Angular CLI is configured to use bun.
- **Node 24** required for the Angular build (see the wrapper note below).
- **Rust** (edition 2021, MSRV 1.77.2) for the backend.

```bash
bun install                 # install JS deps
bun run tauri:dev           # PRIMARY dev loop: builds Angular (ng serve :42024) + opens the Tauri window
bun run tauri:build         # production desktop bundle (runs `bun run build` first via beforeBuildCommand)
bun run start               # Angular dev server only (browser, no Rust backend — uses mock data, see below)
bun run build               # Angular production build into dist/simpleos/browser
```

### Tests

```bash
bun run test                # Angular unit tests — Vitest via @angular/build:unit-test builder (jsdom). Only a few *.spec.ts exist.
bun run e2e:rust:lib        # Rust unit tests: cd src-tauri && cargo test --lib
bun run e2e:run             # TS end-to-end: spins up a local Antelope chain in Docker, deploys contracts, runs wallet tests
bun run e2e:rust            # Rust integration tests against that local chain (e2e_wallet, e2e_signing; --test-threads=1)
bun run e2e:all             # e2e:run then e2e:rust
bun run e2e:clean           # tear down the Docker chain + volumes
```

- The `e2e:*` (non-`:lib`) suites **require Docker** — `tests/e2e/test.ts` is a Bun CLI orchestrating `infra up | deploy | test` against a containerized chain.
- Run a single Rust test: `cd src-tauri && cargo test <name>` (add `--lib` for unit tests, or `--test e2e_wallet` for a specific integration target).
- On systems without `libudev` headers (Linux CI), build/test the backend without Ledger: `cargo test --lib --no-default-features`.

### Quality gates

There is **no JS lint script**. Prettier is the formatter (`bunx prettier --write .`). For Rust, use `cargo fmt` and `cargo clippy` from `src-tauri/`.

### macOS App Store / Windows notes

- App Store builds use a separate path: `bun run tauri:build:mac:appstore` + the `appstore` Angular configuration (swaps `src/environments/environment.ts` → `environment.appstore.ts`) + the Cargo `app-store` feature (disables the self-updater/process plugin in favor of Apple's update mechanism). See `scripts/macos-*.sh`.
- The package/launch scripts are fully **cross-platform**: `start`/`build`/`watch`/`test` and `tauri:dev` use cross-platform Javascript helpers (`scripts/with-supported-node.js` and `scripts/tauri-dev.js`) to set environment paths (such as macOS Homebrew Node 24), strip GTK variables under Linux, and spawn commands, allowing them to run directly on Windows, macOS, and Linux.

## Architecture

### Two-process model & the IPC contract

The Angular renderer and the Rust core communicate **only** through Tauri commands. This contract is the single most important thing to understand:

- **All backend calls go through one service:** `src/app/core/services/tauri-ipc.service.ts` (`TauriIpcService`) wraps `invoke()` from `@tauri-apps/api/core`. 88 of the 89 `invoke` calls in the app live here — do not scatter `invoke` calls elsewhere.
- **Commands are registered in** `src-tauri/src/lib.rs` inside the `tauri::generate_handler![]` macro. Ledger commands are `#[cfg(feature = "ledger")]`-gated there.
- **Naming convention:** command names are `snake_case` strings (`'import_key_with_session'`); JS passes args as a `camelCase` object (`{ wif, chainId }`) and Tauri auto-converts keys to the Rust fn's `snake_case` params (`chain_id`). Return types are deserialized from serde JSON, so the TS interfaces in `tauri-ipc.service.ts` use `snake_case` fields to match Rust structs.

**To add or change a backend capability, touch three places:** (1) implement `#[tauri::command] fn` in `src-tauri/src/commands/<area>.rs` returning `Result<T, error::Error>`; (2) register it in the `generate_handler!` list in `lib.rs`; (3) add a typed wrapper method in `tauri-ipc.service.ts`. Missing step 2 or 3 is the usual cause of "command not found" errors.

### Rust backend (`src-tauri/src/`)

- `lib.rs` — app entry (`run()`): registers plugins, probes the OS keyring to pick a keystore backend, wires managed state, and lists every command.
- `commands/` — the IPC handlers, grouped by area: `wallet.rs` (unlock/import/sign/keys/PIN/biometric/backup/finalizer keys), `network.rs` (chain queries via the provider layer), `session.rs` (anchor-link), `anchor.rs` (Anchor backup import), `dapp.rs` (embedded dapp browser), `config.rs`, `tray.rs`, `ledger.rs`.
- `keystore/` — key management. `wallet.rs` (`WalletService`, the orchestrator), `store.rs` (`KeyStore` trait + `OsKeyStore`/`FileKeyStore`), `memory.rs` (in-memory session with auto-lock), `derive.rs` (PBKDF2 + AES-GCM), `os_keyring.rs`, `anchor_import.rs`/`anchor_crypto.rs`.
- `antelope/` — protocol layer. `signing.rs` (secp256k1/k256, **canonical-signature grinding**, key encoding), `bls.rs` (BLS12-381 finalizer keys via `blst`), `transaction.rs` (build/serialize/sign/push), `abi_serializer.rs` (ABI JSON→hex), `provider.rs` (`ProviderState` — multi-endpoint RPC with failover), `sealed_message.rs` (anchor-link ECDH+AES-CBC), `chain_config.rs` (built-in chain list), `types.rs`.
- `ledger/` — hardware-wallet HID/APDU transport + protocol (feature-gated).
- `error.rs` — single `Error` enum (`thiserror`), serialized to the frontend as JSON. Note the deliberate `Rpc` (network failure → triggers endpoint failover) vs `RpcResponse` (HTTP error body → no failover) distinction.
- `tray.rs`, `biometric.rs` — system tray (with close-to-tray) and platform biometric unlock.

**Managed state** (injected via `.manage()`, accessed as `State<T>`): `AppWallet(Arc<WalletService>)`, `ProviderState` (per-chain endpoint managers), `TrayState`.

### Angular frontend (`src/app/`)

- **Angular 22 is always zoneless** — modern Angular ships without `zone.js`, so reactivity is **signals only** (`signal`/`computed`/`effect`). Use the new control flow (`@if`/`@for`/`@switch`) and standalone components. Do not introduce `*ngIf`/`*ngFor`, `zone.js`, or NgRx.
- `core/services/` — singletons (`providedIn: 'root'`). Beyond `TauriIpcService`, the key one is `WalletStateService` (the central state machine: `locked`, `vaultExists`, `securityMode`, `accounts`, `selectedIndex`, `chains` signals + computed `selectedAccount`/`canSign`/`activeChain`/…). Others: `transaction.service` (sign-confirm modal state machine), `network.service`, `theme.service`, `esr.service` + `link-session.service` (ESR/Anchor signing requests), `token-price.service`, `alert.service`, `update.service`.
- `core/guards/` — `auth.guard` (vault exists + unlocked) and `account-selected.guard` gate the dashboard routes.
- `features/` — screens as standalone components: `landing` (first-run wizard), `lockscreen` (unlock), and `dashboard` (shell with custom titlebar + account tabs) containing `home`, `wallet`, `send`, `vote`, `resources`, `rex`, `contracts`, `dapp`, `settings`, `msig-inbox`, `bp-keys`/`bp-rewards`/`bp-votes`, `fio-handles`, etc. Routes are in `app.routes.ts`; the startup/route-decision flow lives in `app.ts`.
- `shared/` — reusable UI (`confirm-modal`, `alert-panel`, `chain-icon`, `window-controls`, `resize-handles`, loaders).
- **Navigation flow:** fresh install → `/landing`; vault exists + locked → `/lockscreen`; unlocked → `/dashboard`.

### Styling

Plain CSS (no Tailwind/SCSS framework). Global tokens in `src/styles.css`; component styles are inline in `@Component({ styles })`. Two-layer theming applied by `ThemeService` via `data-theme` (`dark`/`light`) and `data-chain` (per-chain accent colors) attributes on `<html>`.

## Key Concepts (require reading multiple files)

### Wallet security model
Three-layer encryption: **passphrase → PBKDF2-HMAC-SHA256 (600k iters) master key → derived storage key → AES-256-GCM** per-key blobs (`keystore/derive.rs`). The master key lives only in an in-memory `Session` (`keystore/memory.rs`) that auto-locks. Encrypted blobs are stored in the **OS keyring** (`OsKeyStore`, preferred — Keychain/Credential Manager/secret-service) or an encrypted **file fallback** (`FileKeyStore`) chosen at startup by `probe_os_keyring()` in `lib.rs`. Three `SecurityMode`s (`get/set_security_mode`): `SessionUnlock` (default; unlock once), `SignPerUse` (passphrase on every signature, nothing held in RAM), `ManualToggle` (user-controlled lock).

### Multi-chain configuration — Rust is the source of truth
Built-in chains live in `src-tauri/src/antelope/chain_config.rs` (`default_chains()` + `default_testnets()`), exposed to the frontend via the `get_chains_config` command. **To add/edit a chain (endpoints, token contract, explorers, features), edit `chain_config.rs`** — not the frontend. The mock chain list in the frontend is only a fallback for browser-only (`bun run start`) UI work where the Tauri backend is absent (`hasTauri()` is false).

### Network provider failover
`antelope/provider.rs` (`ProviderState`) manages multiple RPC/Hyperion endpoints per chain with health checks and a circuit breaker. Initialized from the frontend via `init_chain_providers`; all chain queries route through it. Transport errors (`Error::Rpc`) fail over to the next endpoint; valid HTTP error responses (`Error::RpcResponse`) do not.

### Cargo features & platform gating (`src-tauri/Cargo.toml`)
- `ledger` (default) — Ledger HID support via `hidapi`; needs `libudev-dev` on Linux. Disable with `--no-default-features` to build the core on minimal systems.
- `local-abieos` (default) — local ABI JSON serialization via `rs_abieos`, which is **target-gated to Linux/macOS/Windows-GNU only**. On Windows MSVC (and other targets) ABI encoding falls back to the RPC `abi_json_to_bin` endpoint.
- `app-store` — strips the self-updater and process plugin for Mac App Store builds.

### Custom window chrome
The window is borderless (`decorations: false` in `tauri.conf.json`); the titlebar, traffic-light/window controls, and drag regions are rendered by Angular (`shared/window-controls.ts`, `resize-handles.ts`) and differ by OS. Keep this in mind when editing the dashboard shell.

### Deep links
The app registers the `esr` scheme (`tauri.conf.json`) for ESR/Anchor signing requests; `EsrService` handles incoming URIs (including those that arrive while locked, which are queued until unlock).
