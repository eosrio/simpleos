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
- [ ] Key generation (secp256k1 keypair, WIF encode) `todo`
- [ ] Passphrase change (re-encrypt all keys) `todo`
- [ ] Backup export (encrypted JSON) `todo`
- [ ] Backup import (v1 format migration + v2 format) `todo`

### Rust Backend — Chain Interaction
- [x] Minimal RPC client (ureq, sync HTTP) `done`
- [x] Antelope types (Name, Asset, Action, Transaction, ChainInfo, AccountInfo) `done`
- [x] Chain config with default endpoints (Vaulta, WAX, Telos) `done`
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
- [ ] rs_abieos integration for action data serialization `todo`
- [ ] TAPOS (ref block) from get_info for transaction headers `todo`
- [ ] Transaction construction (build + serialize + sign + push) `todo`
- [ ] Transaction confirmation modal with passphrase prompt `todo`
- [ ] Error handling and user-friendly error messages `todo`

### Frontend — Import Key Flow (End-to-End)
- [ ] Landing page: chain selector + import key wizard `todo`
- [ ] Step 1: Enter private key → auto-discover accounts via get_key_accounts `todo`
- [ ] Step 2: Set passphrase (min 8 chars, confirm match) `todo`
- [ ] Step 3: Lockscreen PIN setup (optional) `todo`
- [ ] Navigate to dashboard with real account data `todo`
- [ ] Add watch-only account by account name (no key) `todo`

### Frontend — Wallet View (Wired)
- [ ] Display real balance from get_account `todo`
- [ ] Display real CPU/NET/RAM usage and limits `todo`
- [ ] Transaction history from Hyperion with pagination `todo`
- [ ] Transaction row: icon, description, amount (green/default), timestamp `todo`
- [ ] Click row to expand transaction details `todo`
- [ ] Action type filter dropdown `todo`
- [ ] Date range filter `todo`
- [ ] Refresh button `todo`
- [ ] Open on block explorer link `todo`

---

## Phase 2 — Feature Parity

### Send Flow
- [ ] Token selector (native + Hyperion tokens) `todo`
- [ ] Recipient validation (check account exists on blur) `todo`
- [ ] Amount validation (check against balance) `todo`
- [ ] MAX button `todo`
- [ ] Memo field with 256 char limit `todo`
- [ ] Exchange detection (Binance, Kraken, etc.) — memo becomes required `todo`
- [ ] Contact book (save, edit, delete recipients) `todo`
- [ ] Contact search with fuzzy matching `todo`
- [ ] Confirmation modal → sign and push transfer action `todo`
- [ ] Success/error display with transaction ID `todo`

### Vote / Stake
- [ ] Load BP list from get_producers `todo`
- [ ] BP table: checkbox, rank, name, location, votes, URL `todo`
- [ ] BP search/filter `todo`
- [ ] Select up to 30 BPs `todo`
- [ ] Proxy voting: enter proxy account name `todo`
- [ ] Load current votes for active account `todo`
- [ ] Vote decay calculation and display `todo`
- [ ] Confirm and push voteproducer action `todo`
- [ ] Staking: delegatebw / undelegatebw actions `todo`
- [ ] Staking slider with bidirectional CPU/NET value binding `todo`
- [ ] Advanced staking ratio (CPU/NET split) `todo`

### Resource Management (Adaptive)
- [x] ChainFeaturesService with ABI-based feature detection `done`
- [x] Composable panels: PowerUp, Staking, REX, RAM (Bancor/Fixed/Refund), FIO, XPR `done`
- [x] Free transaction banner for applicable chains `done`
- [ ] Wire PowerUp action (powerup on eosio) `todo`
- [ ] Wire delegatebw / undelegatebw `todo`
- [ ] Wire buyrex / sellrex / deposit / withdraw `todo`
- [ ] Wire buyram / sellram / buyrambytes `todo`
- [ ] Wire ramtransfer (Vaulta) `todo`
- [ ] Wire refundram (Ultra) `todo`
- [ ] Wire stakefio / unstakefio (FIO) `todo`
- [ ] Wire stakexpr / unstakexpr (XPR) `todo`
- [ ] RAM price display (live from chain) `todo`
- [ ] REX balance and maturity display `todo`
- [ ] Delegation list (current delegations to other accounts) `todo`

### DApp Browser
- [x] Curated dApp launcher with categories and chain filtering `done`
- [x] Fullscreen browser view with chrome bar `done`
- [x] URL bar for custom dApp URLs `done`
- [ ] Tauri webview integration (load real URLs in embedded browser) `todo`
- [ ] Anchor protocol bridge — impersonate anchor-link transport `todo`
- [ ] Signing request interception (anchor-link → Rust backend → sign → return) `todo`
- [ ] Session management (persist dApp authorizations) `todo`
- [ ] CSP and origin validation for webview content `todo`
- [ ] Allow users to add/pin custom dApps `todo`

### BP Producer Features
- [x] BP Keys page with signing key display `done`
- [x] Emergency unreg/re-reg panel with saved config `done`
- [x] Rewards analytics page (mock data) `done`
- [x] Vote analytics page (mock data) `done`
- [ ] Wire regproducer / unregprod actions `todo`
- [ ] Store and restore last regproducer params for quick re-reg `todo`
- [ ] Wire claimrewards action `todo`
- [ ] Load real rewards data from Hyperion `todo`
- [ ] Load real voter data from Hyperion / get_table_rows `todo`
- [ ] Finalizer key management (BLS key generation) `todo`
- [ ] Wire regfinkey / actfinkey / delfinkey actions (Savannah) `todo`
- [ ] Multiple finalizer keys — list, promote primary, delete `todo`
- [ ] Signing key rotation workflow `todo`

### Multi-Chain Support
- [x] Chain config for Vaulta, WAX, Telos (default endpoints) `done`
- [ ] Complete chain configs: Ultra, FIO, Libre, XPR endpoints + Hyperion URLs `todo`
- [ ] Chain icon assets for all 7 priority chains `todo`
- [ ] Feature flag detection from on-chain ABI (production, not mock) `todo`
- [ ] Chain-specific precision handling (4 for EOS/TLOS, 8 for WAX, 9 for FIO) `todo`
- [ ] Testnet support (Jungle, Kylin, WAX testnet) `todo`
- [ ] Custom chain addition (user enters chain ID + endpoint) `todo`

### Ledger Hardware Wallet
- [ ] USB HID communication via hidapi crate `todo`
- [ ] Ledger EOS app detection `todo`
- [ ] BIP44 path derivation (44'/194'/0'/0/{slot}) `todo`
- [ ] Public key retrieval from Ledger `todo`
- [ ] Transaction signing via Ledger (APDU chunked protocol) `todo`
- [ ] ASN.1 BER serialization for Ledger transaction format `todo`
- [ ] Multi-slot key discovery `todo`
- [ ] Ledger device connect/disconnect events `todo`

### Settings
- [ ] Endpoint management (list, ping, select, add custom) `todo`
- [ ] Passphrase change `todo`
- [ ] Lock wallet / auto-lock timeout configuration `todo`
- [ ] Export encrypted backup `todo`
- [ ] Import backup (v1 + v2 formats) `todo`
- [ ] View private key (with passphrase + 30s auto-timeout) `todo`
- [ ] Key generation tool `todo`
- [ ] Account removal `todo`
- [ ] Logout / clear all data `todo`

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
| Phase 1 — Secure Core | 53 | 29 | 1 | 23 |
| Phase 2 — Feature Parity | 65 | 9 | 0 | 56 |
| Phase 3 — Production Ready | 23 | 0 | 0 | 23 |
| Phase 4 — Post-Launch | 16 | 0 | 0 | 16 |
| **Total** | **157** | **39** | **1** | **118** |

*Last updated: 2026-04-02*
