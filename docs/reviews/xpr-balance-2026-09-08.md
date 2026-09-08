# Missing XPR balance

The XPR account `eosrio` displayed a missing tab balance and `0.0000` in History even though its token contract held funds.

Read-only calls to `https://proton.eosusa.io` on 2026-09-08 returned:

- `get_account`: no `core_liquid_balance` value; CPU and NET weights were each `10.0000 SYS`.
- `get_currency_balance` for `eosio.token`, account `eosrio`, symbol `XPR`: `74797.0757 XPR`.

The wallet only performed a separate primary-token lookup when the token contract differed from `eosio.token`. That assumption fails on XPR. A regression through `WalletStateService.refreshAccount` reproduced the actual symptom: expected the token balance, received `undefined`.

The shared primary-balance loader now looks up the configured token whenever the account response lacks a balance in the configured symbol, or the configured contract is not `eosio.token`. Refresh, import hydration, discovery and watch-only loading use that same helper. An empty successful token response is represented as zero with the chain's precision and symbol. Network failures are not converted into successful zero responses.

Verification: the reproduction failed before the fix; the complete frontend suite passed afterward (**88 tests**, 11 files). This is a liquid-primary-token fix; SYS resource weights and XPR governance staking are distinct from that balance. No chain transaction was submitted.

The unsigned Windows executable and NSIS installer were rebuilt successfully with `bunx tauri build --no-sign --bundles nsis` (release compilation: 2m46s). Existing frontend bundle-size/CommonJS warnings remain.
