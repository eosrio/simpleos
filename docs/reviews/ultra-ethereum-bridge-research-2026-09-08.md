# Ultra–Ethereum bridge integration research

Researched 2026-09-08 using official documentation, the deployed official frontend, live read-only Ultra RPC responses, and Etherscan's verified proxy implementation source. No transactions were signed or broadcast. Public response fixtures are in `tests/fixtures/ultra-bridge`; hashes and capture timestamp are recorded in `provenance.json`.

## Identity and scope

The requested [bridge.ultra.io](https://bridge.ultra.io/) connects Ultra mainnet (`a9c481dfbc7d9506dc7e87e9a137c931b0a9303f64fd7a1d08b8230133920097`) to Ethereum mainnet (EIP-155 chain ID 1). Ethereum's bridge proxy is `0x95cCdDC90266F5A31732eFeF6Ab69Baf53a54E50`. This is separate from Ultra's native EVM chain 19991 and its `eosio.evmin`/`eosio.erc2o` integration. [Official bridge overview](https://developers.ultra.io/tutorials/ultra-bridge/), [Ultra chain endpoints](https://developers.ultra.io/products/chain-api/), [native EVM resources](https://developers.ultra.io/tutorials/Ultra-EVM/Resources).

## Native outgoing transaction

The deployed official frontend version 1.0.13 constructs an ordinary token transfer, not a direct user call to `new2evm.a`:

```json
{
  "account": "eosio.token",
  "name": "transfer",
  "authorization": [{"actor": "SENDER", "permission": "active"}],
  "data": {
    "from": "SENDER",
    "to": "ultra.swap",
    "quantity": "100.00000000 UOS",
    "memo": "ethereum,0x1111111111111111111111111111111111111111"
  }
}
```

The receiver address above is an illustrative placeholder, not a recommended destination. The transfer adapter must use the chosen token's live contract/precision. The official frontend currently uses `eosio.token` for all four tokens. Its memo is the EVM scope name, a comma, and the Ethereum address with `0x`. The `ultra.bridge` ABI exposes internal request action `new2evm.a(evm_chain:name, contract:name, quantity:asset, sender:name, evm_receiving_address:checksum160, has_user_data:bool)`, but the frontend initiates through `ultra.swap`. [Deployed frontend asset](https://bridge.ultra.io/assets/index-CEFn9oeE.js), [live get_abi endpoint](https://ultra.eosrio.io/v1/chain/get_abi), fixtures `ultra-bridge-abi.json` and `ultra-swap-abi.json`.

Use exact integer arithmetic. The effective amount precision is the minimum of native and EVM precision. Reject excess fractional digits rather than silently discard funds as dust. For UOS, the native transfer has eight decimals but Ethereum can represent only four. [Deployed frontend precision helpers](https://bridge.ultra.io/assets/index-CEFn9oeE.js), [verified implementation precision conversion](https://etherscan.io/address/0xd21d15751ca9df6813ac5fb1ff366f05a28fda27#code).

## Live configuration and tokens

POST `/v1/chain/get_table_rows` with `json:true, code:"ultra.bridge", scope:"ethereum", table:"tokens.a", limit:100`. Limits are raw **Ultra token units**, not EVM units. Integers may arrive as JSON strings or numbers. `symbol` is `precision,SYMBOL`, `evm_address` is 40 hex characters without `0x`. Read fresh data before signing; static defaults in the official frontend can become stale. [Live table endpoint](https://ultra.eosrio.io/v1/chain/get_table_rows), `tokens.a.json` fixture.

| Token | Native contract | Native / EVM decimals | Minimum | Maximum | Ethereum token |
|---|---|---|---|---|---|
| UOS | eosio.token | 8 / 4 | 100 | 10,000,000 | `0xD13c7342e1ef687C5ad21b27c2b65D772cAb5C8c` |
| USDC | eosio.token | 6 / 6 | 1 | 100,000 | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| WETH | eosio.token | 9 / 18 | 0.0005 | 100 | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |
| USDT | eosio.token | 6 / 6 | 1 | 100,000 | `0xdAC17F958D2ee523a2206206994597C13D831ec7` |

These are capture-time values, not permanent protocol limits. `state & 1` indicates active; `state & 2` indicates mint/burn strategy. Thus both state 1 (UOS) and state 3 (other captured tokens) are active; do not interpret state 3 as paused. The corresponding Ethereum token state is independent and must not be copied from the Ultra table. [Official frontend active filter](https://bridge.ultra.io/assets/index-CEFn9oeE.js), [verified contract TOKEN_ACTIVE and TOKEN_MINT constants](https://etherscan.io/address/0xd21d15751ca9df6813ac5fb1ff366f05a28fda27#code).

For bridge availability, query `evms.a` in scope `ultra.bridge` and verify the ethereum/1 mapping. Query `maint.a` in scope `ultra.bridge`; an empty row set means no scheduled maintenance. A row contains `maintenance_start_time:time_point_sec`, normally an ISO timestamp through Antelope JSON. Treat RPC failure as unavailable, not an empty table. Active maintenance disables submission; imminent maintenance merits a clear warning. At capture, `maint.a` was empty. [ABI and live fixtures](https://ultra.eosrio.io/v1/chain/get_abi), [official maintenance guidance](https://developers.ultra.io/tutorials/ultra-bridge/maintenance-mode).

Official documentation and frontend terms specify no bridge/validator fee for this Ethereum route; Ethereum claim gas is paid in ETH. Native EVM ingress/egress fee tables belong to a different route. [Official outgoing guide](https://developers.ultra.io/tutorials/ultra-bridge/ultra-to-evm), [deployed frontend terms](https://bridge.ultra.io/assets/index-CEFn9oeE.js).

## Request discovery and progress

All following tables use `code:"ultra.bridge", scope:"ethereum"`:

| Table | Lookup | Meaning |
|---|---|---|
| `2evmreqs.a` | primary `counter`; sender index 2 (`i64`), receiver index 3 (`i256`) | Native outgoing request |
| `2evmatts.a` | exact primary `counter` | Validator attestations |
| `schedule.a` | primary version equals request `schedule_id` | Validator members and required threshold |
| `2evmcounter` | singleton | Global outgoing counter; not proof a specific transfer exists |
| `validators.a` | validator account | Last processed/signed/acknowledged counters and blocks |

For sender lookup, the official frontend sends lower/upper bounds equal to the account name, index position 2, key type `i64`, reverse true. For receiver lookup it uses index 3, key type `i256`, and `0x` + the 20-byte address + 12 zero bytes. Exact-counter lookup must verify the returned counter, because a lower-bound-only query can return its successor. Query boundaries are not sufficient to match a newly submitted request: verify sender, recipient, token, amount, chain, and a pre-submission counter boundary. Prefer transaction inline traces when available to identify the actual request. [Deployed request service](https://bridge.ultra.io/assets/index-CEFn9oeE.js).

ABI request fields: `counter`, `schedule_id`, `time:uint32`, `block_num:uint32`, `chain_id:checksum256`, `sender:name`, `symbol:symbol`, `contract:name`, `amount:uint64`, `evm_chain_id:uint64`, `evm_token_precision:uint8`, `evm_token_address:checksum160`, `evm_receiving_address:checksum160`, `user_data:bytes`. Attestation entries contain `validator`, `ultra2evm_signature:bytes`, `evm_block_num_at_sign:uint64`, `evm_block_num_completed:uint64`. Schedule rows contain `version`, `validators`, `threshold`, `start_time`, and first/last counters. [Live ABI](https://ultra.eosrio.io/v1/chain/get_abi), captured fixture.

At capture, outgoing requests and attestations were empty; counter singleton was 68, current schedule version 5 had two validators (`ultra.val4`, `ultra.val5`) and threshold 2. This demonstrates that requests can disappear after processing; absence alone cannot mean failed or completed. No sample pending live request was available. Keep submitted transaction metadata locally for recovery and show unknown status explicitly. [Captured table responses](https://ultra.eosrio.io/v1/chain/get_table_rows).

Count distinct schedule-member attestations, require threshold greater than zero, and distinguish “validator proofs ready” from Ethereum settlement. Proof count alone does not verify signatures or current claim eligibility. In particular, the current Ethereum implementation requires the active validator schedule for ordinary claimers; an older schedule's proof threshold can be satisfied while `claim2EVM` reverts `InactiveSchedule`. [Verified claim2EVM implementation](https://etherscan.io/address/0xd21d15751ca9df6813ac5fb1ff366f05a28fda27#code).

## Ethereum claim and completion truth

The proxy's verified implementation address at capture is `0xd21d15751ca9df6813ac5fb1ff366f05a28fda27`. This is upgradeable; pin the proxy identity and verify chain ID rather than hard-code implementation assumptions indefinitely. The deployed frontend ABI is older than the verified implementation: it lists `claimedUltra2EVMSwapCounters(uint64)`, but the current source uses `ultra2EVMSettlementBlocks(uint64) -> uint256`. The stable `filterClaimableRequests(uint64[]) -> uint64[]` remains available. [Verified proxy page](https://etherscan.io/address/0x95cCdDC90266F5A31732eFeF6Ab69Baf53a54E50#code).

`ultra2EVMSettlementBlocks(counter) == 0` means not settled. A nonzero value marks a settlement block, but **does not by itself prove token payout**: the administrative `fix2EVM` also marks this mapping without releasing tokens. `Ultra2EVMSettle` event or a successful verified claim receipt establishes payment; `Ultra2EVMFixed` indicates repair. Do not call validator threshold, request disappearance, or this mapping alone “funds received.” [Verified settlement and fix functions](https://etherscan.io/address/0xd21d15751ca9df6813ac5fb1ff366f05a28fda27#code).

Read-only Ethereum calls were independently verified using `https://ethereum-rpc.publicnode.com`, published on the [provider's own endpoint page](https://ethereum-rpc.publicnode.com/). `eth_chainId` returned `0x1`; proxy `evmChainId()` returned 1, `ultraChainId()` returned the expected Ultra ID, `paused()` returned false, and `scheduleVersion()` returned 5. Counter 67 had settlement block `0x18b25d3`, while counter 68 returned zero. Complete request/response pairs are in `ethereum-read-calls.json`. The selectors, derived with Keccak-256, are `56fcff13` for `ultra2EVMSettlementBlocks(uint64)`, `64d42b17` for `evmChainId()`, `e2bfe6aa` for `ultraChainId()`, `5c975abb` for `paused()`, and `39958b29` for `scheduleVersion()`. Encode counters as 32-byte big-endian ABI words.

The official frontend instead proxies Ethereum RPC through `https://bridge.ultra.io/api/mainnet`; this endpoint requires its website Origin and wraps an Alchemy configuration. It should not be treated as a general third-party app RPC dependency. [Deployed frontend network configuration](https://bridge.ultra.io/assets/index-CEFn9oeE.js).

The wallet claim is `claim2EVM(bytes ultra2evmData, bytes[] signatures)`. Its 163-byte fixed message prefix contains, in order, big-endian numeric fields with widths:

```text
version1 counter8 schedule_id8 time4 block_num4 chain_id32 sender8
symbol_code8 precision1 contract8 evm_amount32 evm_chain_id8
evm_token_precision1 evm_token_address20 evm_receiving_address20
```

Antelope account names and symbol codes are packed numeric values. Convert `amount` from native precision to EVM precision using integer powers of ten, then encode it as 32-byte uint256. Remaining bytes are optional raw user data, without a length prefix. Each validator signature is 65 bytes, supplied with `0x` in EVM JSON. Signatures are over `keccak256(message)` directly, **not** Ethereum personal-message wrapping. Contract validation includes chain IDs, token/precision/symbol/contract/limits, schedule membership, distinct recovered signers, and threshold. [Verified decoder and claim function](https://etherscan.io/address/0xd21d15751ca9df6813ac5fb1ff366f05a28fda27#code), [official frontend message serializer](https://bridge.ultra.io/assets/index-CEFn9oeE.js).

## Ethereum → Ultra and handoff

The Ethereum wallet first approves the bridge proxy to spend the selected ERC-20, then invokes `swap2Ultra(tokenAddress, amountInEvmUnits, ultraAccountName, "0x")`. This emits `EVM2UltraSwap(counter,data)`; validators complete the Ultra side automatically after Ethereum finality. ETH is required for approval and submission gas. The contract removes precision dust before transfer and rejects fee-on-transfer tokens. [Official incoming guide](https://developers.ultra.io/tutorials/ultra-bridge/evm-to-ultra), [verified swap2Ultra source](https://etherscan.io/address/0xd21d15751ca9df6813ac5fb1ff366f05a28fda27#code).

The official interface supports resuming pending native outgoing requests after connecting the recipient EVM wallet. The captured bundle finds these through the receiver index and filters settled counters; it does not expose a documented request/recipient deep-link parameter. Only a wallet `connect=extension` query handler was found. Therefore open the canonical bridge URL and explain its Resume flow; do not invent prefilled/resume URLs. Completion handoff requires the user to connect the recipient Ethereum wallet and review ETH gas. [Official resume guide](https://developers.ultra.io/tutorials/ultra-bridge/resuming-transactions), [deployed frontend](https://bridge.ultra.io/assets/index-CEFn9oeE.js).

**Producer accounts held only in SimplEOS are supported by this handoff.** The deployed frontend FAQ expressly states that Ultra wallet connection is unnecessary for resume. Its `Zh` resume gate requires only a connected EVM wallet and an EVM destination. The button loads requests by the connected EVM recipient, and the claim handler requires request data, attestations, and the correct Ethereum connection; it does not require Ultra wallet authorization. Concrete steps: connect the recipient Ethereum wallet, select Ultra → Ethereum, click **Resume Transfer to EVM** at the top right, select the request, then claim with **Move Assets**. This is source-level verification of the actual deployed interface; no user's wallet was connected during research. [Deployed frontend FAQ, resume gate, and claim handler](https://bridge.ultra.io/assets/index-CEFn9oeE.js).

For the reverse Ethereum → Ultra direction, the same deployed interface allows a manually typed native destination. Its destination placeholder offers Ultra wallet connection only for autofill. The submit gate checks the source wallet (Ethereum), chain, amount, and destination validity; Ultra wallet connection is not required. Choose Ethereum → Ultra, connect the Ethereum source wallet, paste the SimplEOS producer account name into **Destination Wallet**, and review approval/submission. The producer's native key never needs importing into Ultra Wallet. [Deployed frontend destination input and source-wallet submit gate](https://bridge.ultra.io/assets/index-CEFn9oeE.js).

## Implementation boundary and limitations

A reusable adapter should supply route identity, source transfer construction, live token/config queries, exact amount rules, request discovery, progress interpretation, and official wallet handoff. Native wallet signing can reuse SimplEOS's existing trusted transaction confirmation. Ethereum signing needs an explicit external wallet/session integration; do not imply native Antelope keys can authorize an Ethereum wallet.

The research verified public ABI/table shapes and current verified Solidity logic. It did not independently verify deployed Ultra WASM against an open-source C++ repository, cryptographically validate a live pending proof, sign a claim, or broadcast a reverse deposit. Empty live pending tables mean synthetic tests must identify themselves as generated from the ABI. Future changes to proxy implementation, token configuration, maintenance, or validators require fresh reads.
