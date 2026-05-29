# SimplEOS v2 Roadmap

> Task tracker for the Tauri v2 + Angular 22 rewrite.
> Update status as work progresses. Each task has a status: `done`, `wip`, `todo`, `blocked`.

---

## Phase 1 — Secure Core

### Scaffolding & Design
- [x] Project scaffold (Tauri v2 + Angular 22 + bun) `done`
- [x] Rust backend module structure (keystore, antelope, ledger, commands) `done`
- [x] Design spec document (DESIGN_SPEC.md) `done`
- [x] Liquid glass logo SVG `done`
- [x] Global styles with design system tokens `done`
- [x] Lockscreen with logo animation `done`
- [x] Dashboard shell with sidebar navigation `done`
- [x] Account tab bar (one tab per account, locked to chain) `done`
- [x] Theme system: dark/light base + 7 chain accent overlays `done`
- [x] Watch-only account indicators (eye badge, amber banner) `done`
- [x] BP-conditional nav (Keys, Rewards, Vote Analytics) `done`
- [x] All feature page scaffolds (wallet, send, vote, resources, rex, dapp, settings, about) `done`

### Rust Backend — Crypto & Key Management
- [x] AES-256-GCM encryption with PBKDF2 600k iterations `done`
- [x] Zeroizing in-memory session (ZeroizingSecret, auto-lock timeout) `done`
- [x] OS keychain integration via keyring crate `done`
- [x] Key index management per chain `done`
- [x] WIF private key import (decode, validate checksum, derive public key) `done`
- [x] RIPEMD160 for proper EOS public key encoding `done`
- [x] Key generation (secp256k1 keypair, WIF encode) `done`
- [x] Passphrase change (re-encrypt all keys) `done`
- [x] Backup export (encrypted JSON) `done`
- [x] Backup import (v2 format) `done`

### Rust Backend — Chain Interaction
- [x] Minimal RPC client (reqwest, async HTTP) `done`
- [x] Antelope types (Name, Asset, Action, Transaction, ChainInfo, AccountInfo) `done`
- [x] Chain config with default endpoints (Vaulta, WAX, Telos, Ultra, FIO, Libre, XPR) `done`
- [x] Connect to chain and verify chain_id `done`
- [x] get_account → parse full account data (balances, resources, permissions) `done`
- [x] get_key_accounts → discover accounts from public key `done`
- [x] get_currency_balance → fetch token balances `done`
- [x] get_table_rows → generic table queries `done`
- [x] get_producers → load BP list with metadata `done`
- [x] Hyperion get_actions → transaction history with pagination `done`
- [x] Hyperion get_tokens → multi-token discovery `done`
- [x] Endpoint health check with latency measurement `done`
- [x] Automatic endpoint failover `done`

### Rust Backend — Transaction Signing
- [x] secp256k1 ECDSA signing with k256 crate `done`
- [x] Signing digest: SHA256(chain_id + serialized_trx + 32 zero bytes) `done`
- [x] Proper RIPEMD160 checksum for SIG_K1_ encoding `done`
- [x] Native binary serialization (Name, Asset, Action, Transaction) `done`
- [x] abi_json_to_bin fallback for custom contract actions `done`
- [x] TAPOS (ref block) from get_info for transaction headers `done`
- [x] Transaction construction (build + serialize + sign + push) `done`
- [x] Transaction confirmation modal with passphrase prompt `done`
- [x] Error handling and user-friendly error messages `done`

### Frontend — Import Key Flow (End-to-End)
- [x] Landing page: chain selector + import key wizard `done`
- [x] Step 1: Enter private key → auto-discover accounts via get_key_accounts `done`
- [x] Step 2: Set passphrase (min 8 chars, confirm match) `done`
- [x] Step 3: Lockscreen PIN setup (optional) `done`
- [x] Navigate to dashboard with real account data `done`
- [x] Add watch-only account by account name (no key) `done`

### Frontend — Wallet View (Wired)
- [x] Display real balance from get_account `done`
- [x] Display real CPU/NET/RAM usage and limits `done`
- [x] Transaction history from Hyperion with pagination `done`
- [x] Transaction row: icon, description, amount (green/default), timestamp `done`
- [x] Click row to expand transaction details `done`
- [x] Action type filter dropdown `done`
- [x] Date range filter `done`
- [x] Refresh button `done`
- [x] Open on block explorer link `done`

---

## Phase 2 — Feature Parity

### Send Flow
- [x] Token selector (native + Hyperion tokens) `done`
- [x] Recipient validation (check account exists on blur) `done`
- [x] Amount validation (check against balance) `done`
- [x] MAX button `done`
- [x] Memo field with 256 char limit `done`
- [x] Exchange detection (Binance, Kraken, etc.) — memo becomes required `done`
- [x] Contact book (save, edit, delete recipients) `done`
- [x] Contact search with fuzzy matching `done`
- [x] Confirmation modal → sign and push transfer action `done`
- [x] Success/error display with transaction ID `done`

### Vote / Stake
- [x] Load BP list from get_producers `done`
- [x] BP table: checkbox, rank, name, votes, URL `done`
- [x] BP search/filter `done`
- [x] Select up to 30 BPs `done`
- [x] Proxy voting: enter proxy account name `done`
- [x] Load current votes for active account `done`
- [x] Vote decay calculation and display `done`
- [x] Confirm and push voteproducer action `done`
- [x] Staking: delegatebw / undelegatebw actions `done`
- [x] Staking slider with bidirectional CPU/NET value binding `done`
- [x] Advanced staking ratio (CPU/NET split) `done`

### Resource Management (Adaptive)
- [x] ChainFeaturesService with ABI-based feature detection `done`
- [x] Composable panels: PowerUp, Staking, REX, RAM (Bancor/Fixed/Refund), FIO, XPR `done`
- [x] Free transaction banner for applicable chains `done`
- [x] Wire PowerUp action (powerup on eosio) `done`
- [x] Wire delegatebw / undelegatebw `done`
- [x] Wire buyrex / sellrex / deposit / withdraw `done`
- [x] Wire buyram / sellram / buyrambytes `done`
- [x] Wire ramtransfer (Vaulta) `done`
- [x] Wire refundram (Ultra) `done`
- [x] Wire stakefio / unstakefio (FIO) `done`
- [x] Wire stakexpr / unstakexpr (XPR) `done`
- [x] RAM price display (live from chain) `done`
- [x] REX balance and maturity display `done`
- [x] Delegation list (current delegations to other accounts) `done`

### DApp Browser
- [x] Curated dApp launcher with categories and chain filtering `done`
- [x] Fullscreen browser view with chrome bar `done`
- [x] URL bar for custom dApp URLs `done`
- [x] Tauri webview integration (load real URLs in embedded browser) `done`
- [x] Anchor protocol bridge — impersonate anchor-link transport `done`
- [x] Signing request interception (anchor-link → Rust backend → sign → return) `done`
- [x] Session management (persist dApp authorizations) `done`
- [x] CSP and origin validation for webview content `done`
- [x] Allow users to add/pin custom dApps `done`

### BP Producer Features
- [x] BP Keys page with signing key display `done`
- [x] Emergency unreg/re-reg panel with saved config `done`
- [x] Rewards analytics page (mock data) `done`
- [x] Vote analytics page (mock data) `done`
- [x] Wire regproducer / unregprod actions `done`
- [x] Store and restore last regproducer params for quick re-reg `done`
- [x] Wire claimrewards action `done`
- [x] Load real rewards data from Hyperion `done`
- [x] Load real voter data from Hyperion / get_table_rows `done`
- [x] Finalizer key management (BLS12-381 key generation via blst crate) `done`
- [x] Wire regfinkey / actfinkey / delfinkey actions (Savannah) `done`
- [x] Multiple finalizer keys — list, promote primary, delete `done`
- [x] Signing key rotation workflow `done`

### Multi-Chain Support
- [x] Chain config for all 7 priority chains (Vaulta, WAX, Telos, Ultra, FIO, Libre, XPR) `done`
- [x] Complete chain configs: additional endpoints + Hyperion URLs for all chains `done`
- [x] Chain icon assets for all 7 priority chains `done`
- [x] Feature flag detection from on-chain ABI (production, not mock) `done`
- [x] Chain-specific precision handling (4 for EOS/TLOS, 8 for WAX, 9 for FIO) `done`
- [x] Testnet support (Jungle, WAX testnet, Telos testnet, FIO testnet, XPR testnet) `done`
- [x] Custom chain addition (user enters chain ID + endpoint, auto-fetches chain_id) `done`

### Ledger Hardware Wallet
- [x] USB HID communication via hidapi crate `done`
- [x] Ledger EOS app detection `done`
- [x] BIP44 path derivation (44'/194'/0'/0/{slot}) `done`
- [x] Public key retrieval from Ledger `done`
- [x] Transaction signing via Ledger (APDU chunked protocol) `done`
- [x] DER-to-compact signature conversion (canonical check) `done`
- [x] Multi-slot key discovery `done`
- [x] Ledger device connect/disconnect events `done`

### Settings
- [x] Endpoint management (list, ping, select, add custom) `done`
- [x] Passphrase change `done`
- [x] Lock wallet / auto-lock timeout configuration `done`
- [x] Export encrypted backup `done`
- [x] Import backup (v1 + v2 formats) `done`
- [x] View private key (with passphrase + 30s auto-timeout) `done`
- [x] Key generation tool `done`
- [x] Account removal `done`
- [x] Logout / clear all data `done`

---

## Phase 3 — Production Ready

### Security Hardening
- [ ] Security audit of Rust crypto code `todo`
- [ ] CSP policy enforcement in Tauri `todo`
- [ ] Input sanitization for all RPC responses `todo`
- [ ] Rate limiting on failed passphrase attempts (5 max, then wipe) `todo`
- [ ] Auto-lock on idle timeout `todo`
- [ ] No sensitive data in console.log (production build) `todo`
- [ ] Validate all chain endpoints are HTTPS `todo`

### Build & Distribution
- [ ] macOS build (.dmg, universal binary) `todo`
- [ ] macOS code signing + notarization `todo`
- [ ] Windows build (.msi / .nsis) `todo`
- [ ] Windows code signing (EV cert) `todo`
- [ ] Linux build (.AppImage + .deb) `todo`
- [ ] Auto-update via @tauri-apps/plugin-updater `todo`
- [ ] Ed25519 signed update manifests `todo`
- [ ] CI/CD pipeline (GitHub Actions) `todo`

### Savannah Fast Finality
- [ ] Detect Savannah support from get_info response `todo`
- [ ] Display finality status on transaction results `todo`
- [ ] Finalizer key management for BPs (regfinkey, actfinkey, delfinkey) `todo`
- [ ] BLS key generation in Rust `todo`

### PowerUp Resource Model
- [ ] PowerUp state query and pricing calculation `todo`
- [ ] PowerUp cost estimation before transaction `todo`
- [ ] Auto-PowerUp when resources are low (optional) `todo`

### UI Polish
- [ ] Keyboard shortcuts (Alt+key navigation, Ctrl+1-9 account switching) `todo`
- [ ] Route transition animations (subtle fade) `todo`
- [ ] Toast notification system (slide from top-right, 4s auto-dismiss) `todo`
- [ ] Skeleton loading placeholders on all data-loading views `todo`
- [ ] Sidebar collapse to icons at narrow widths (960-1280px) `todo`
- [ ] Lucide icon integration (replace inline SVGs) `todo`
- [ ] Confirmation modal component (reusable, with Ricardian contract display) `todo`
- [ ] Error boundary and offline state handling `todo`

---

## Phase 4 — Post-Launch

### WalletConnect v2
- [ ] WalletConnect protocol implementation `todo`
- [ ] Session management `todo`
- [ ] QR code pairing `todo`

### WAX Auto-Claim
- [ ] System tray agent mode `todo`
- [ ] Scheduled claim execution `todo`
- [ ] GBM rewards support `todo`

### Multi-Signature Support
- [ ] Multi-sig proposal creation `todo`
- [ ] Proposal approval/rejection `todo`
- [ ] Threshold display and tracking `todo`

### Account Creation
- [ ] New account wizard (name validation, key generation) `todo`
- [ ] Pay for account creation (delegatebw + buyrambytes + newaccount) `todo`
- [ ] Account creation on WAX (cloud wallet integration?) `todo`

### Advanced Features
- [ ] Token management (airdrop tokens, hide/show, custom tokens) `todo`
- [ ] Permission management (updateauth, linkauth) `todo`
- [ ] Scheduled transactions UI `todo`
- [ ] Transaction batching `todo`
- [ ] Address book with labels and groups `todo`
- [ ] Biometric unlock (OS-level, via Tauri plugin) `todo`
- [ ] Deep link protocol handler (simpleos://) `todo`
- [ ] Community plugin system (?) `todo`

---

## Status Summary

| Phase | Total | Done | WIP | Todo |
|-------|-------|------|-----|------|
| Phase 1 — Secure Core | 59 | 59 | 0 | 0 |
| Phase 2 — Feature Parity | 81 | 81 | 0 | 0 |
| Phase 3 — Production Ready | 30 | 0 | 0 | 30 |
| Phase 4 — Post-Launch | 20 | 0 | 0 | 20 |
| **Total** | **190** | **140** | **0** | **50** |

*Last updated: 2026-04-05*
