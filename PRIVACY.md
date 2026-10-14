# SimplEOS Privacy Policy

Effective: October 13, 2026

This policy covers the SimplEOS desktop wallet, version 2, published by **Rio Blocks**.
That includes the installers on GitHub and the Microsoft Store edition, "SimplEOS
Wallet". SimplEOS is open source, so everything described here can be checked in this
repository.

## In short

- SimplEOS is a self-custody wallet that runs on your computer. There are no SimplEOS
  accounts and no SimplEOS servers you sign in to.
- **Your private keys and passphrase never leave your device.** We cannot see them and
  cannot recover them.
- SimplEOS has **no analytics, telemetry, crash reporting or advertising**, and we do not
  sell or share data.
- To work, the app talks to public blockchain infrastructure and a few other services
  listed below. Those services see your IP address and the requests the app makes.

## What stays on your device

SimplEOS keeps the following in its data folder on your computer:

- **Your key vault.** Private keys are encrypted with AES-256-GCM under a key derived from
  your passphrase (PBKDF2-HMAC-SHA256, 600,000 iterations).
- **Wallet data and settings:** the accounts you add with their cached balances, your
  address book, security and display settings, dApp sessions (site, account and chain),
  bridge transfer history, and caches of prices, contract ABIs and network endpoints.
- **Quick-unlock data, if you turn it on.** Windows Hello unlock stores your passphrase
  encrypted under a key that only Windows Hello can produce, after you confirm with your
  face, fingerprint or Windows PIN. The PIN is kept only in memory while the app runs and
  is never written to disk.

The data folder is `%APPDATA%\io.eosrio.simpleos` and `%LOCALAPPDATA%\io.eosrio.simpleos`
on Windows. On macOS and Linux it is the standard application-data folder for
`io.eosrio.simpleos`.

**Uninstalling SimplEOS leaves your vault in place**, unless you tick "Delete the
application data" in the Windows uninstaller. This is deliberate, so that removing or
reinstalling the app never destroys your keys by accident. To erase the vault and wallet
data, make sure you have a backup, then use **Settings > Logout** ("Wipe Everything") or
**Reset wallet** on the lock screen. You can then delete the folders above.

## What the app sends over the network

SimplEOS only sends what is needed for the feature you are using:

- **Blockchain nodes (RPC and history APIs).** To show balances and history, find the
  accounts that belong to your keys, and broadcast transactions, the app sends account
  names, public keys and the transactions you approve to the nodes for each chain. By
  default these are public nodes run by independent block producers, among them EOS Rio,
  a company related to Rio Blocks. You can change the endpoints in Settings. Requests to
  EOS Rio's nodes are handled under the Rio Blocks privacy policy at
  <https://rioblocks.io/privacidade.html>. Transactions you broadcast are public and
  permanent on the blockchain.
- **Network discovery.** If you run endpoint discovery during setup, the app downloads
  block producers' public information files (`bp.json`, `chains.json`) from their
  websites and tests the endpoints listed there. Nothing about you is sent beyond the
  requests themselves.
- **Token prices** come from on-chain price oracles and from CoinGecko
  (`api.coingecko.com`). Only the coin identifiers, such as `eos` or `wax`, are sent.
- **Signing requests from dApps.** When a website or the dApp browser asks you to sign,
  SimplEOS shows the full request in its confirmation window first. If the request names
  a callback address, that address is shown too, and after you approve, the signature
  and transaction details are sent to it, as the signing-request standard requires.
- **The dApp browser** opens third-party websites in a separate window that has no access
  to your keys. Those sites see your IP address and anything you choose to sign or share
  with them. Their own privacy policies apply.
- **Ultra EVM bridge.** To show the status of bridge transfers, the app makes read-only
  queries to a public Ethereum node (`ethereum-rpc.publicnode.com`). No account names or
  addresses are sent.
- **FIO.** FIO transactions created in SimplEOS include EOS Rio's FIO provider ID
  (`bp@eosrio`), which is recorded on-chain as FIO's fee-sharing mechanism provides.
- **Updates.** The GitHub edition checks GitHub for a new version when it starts and
  downloads updates from GitHub Releases. The Microsoft Store and Mac App Store editions
  are updated by those stores and do not run this check.
- **Block explorers and other links** open in your web browser, not in SimplEOS.

Ledger hardware wallets connect over USB only; the app talks to them directly.

The operators of these services (block producers, CoinGecko, GitHub, Microsoft, Apple and
any website you visit) receive your IP address and the requests described above under
their own policies.

## What we receive

Rio Blocks does not receive your keys, passphrase, balances, address book or usage data
from SimplEOS. The only way information reaches infrastructure related to us is the
blockchain requests above, when your wallet uses EOS Rio's public nodes.

If you install from the Microsoft Store, Microsoft may share aggregated download and
usage statistics with us under its own privacy statement.

## Clipboard and files

SimplEOS writes to the clipboard only when you copy something, such as an account name
or, if you choose, a private key. It never reads the clipboard. It reads only the files
you pick, such as a backup to import, and saves only files you ask for, such as a backup
export.

## Children

SimplEOS is not directed at children.

## Changes and contact

Changes to this policy are published in this file, and its history is in this
repository.

For privacy questions, write to **contact@rioblocks.io** (Rio Blocks, Rio de Janeiro,
Brazil). You can also open an issue on GitHub. Because we do not hold personal data from
the app, most requests can be met by erasing the wallet as described above, but we will
answer anything you send.
