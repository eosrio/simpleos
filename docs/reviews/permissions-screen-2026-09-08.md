# Dedicated action permission screen

The dashboard now includes **Permissions** at `/dashboard/permissions`. It loads
the selected account's permissions and explicit action links, discovers actions
from the chosen contract ABI, and creates an `eosio::linkauth` transaction through
the existing signer resolver and transaction confirmation flow. Existing links
can be selected with **Change**. This screen links existing permissions; creating
permissions, editing authority keys, wildcard linking and unlinking are outside
this change.

For the requested WAX operation, select `eosriobrazil`, load contract `eosio`,
choose action `claimstandby` and required permission `claim2`, then review. The
transaction uses `eosriobrazil@active` authorization and omits WAX's optional
`authorized_by` binary extension. The required permission does not supply the key
that authorizes changing the link.

The Rust account response now preserves `permissions[].linked_actions`. A node
that omits this data produces an unavailable-state message, not an empty-link
claim. Watch-only accounts cannot sign. The screen checks current account and
network identity, rejects late responses, rechecks the permission and ABI before
review, prevents duplicate submissions, and refreshes links after broadcast.

Validation:

- Frontend suite: 71 tests passed. After adding a further same-account network
  switch guard, all 17 permission-screen tests passed (the suite previously
  contained 16 of these tests).
- Rust library suite: all 134 tests passed, including account-response
  round-tripping, compatibility with older nodes, and local serialization of the
  requested WAX linkauth to its four-name / 32-byte payload.
- The actual Angular component was rendered in an isolated browser harness with
  public-shaped fixtures at 1160 x 760 and 960 x 640. Contract loading, selectors,
  review summary and cancellation were exercised; the narrow layout had no
  horizontal document overflow. The harness cannot submit chain transactions and
  is stored under ignored `tmp/` rather than shipped with the app.
- The mechanical UI detector reported no findings in its degraded regex mode;
  computed contrast and selector analysis were unavailable in that detector.
- `bunx tauri build --no-sign --bundles nsis` succeeded. The release executable
  and unsigned NSIS installer include the new page. The frontend retains its
  existing initial-bundle budget and Wharfkit CommonJS warnings.

The user subsequently confirmed live WAX linkauth works on chain on 2026-09-08.
Physical Ledger approval remains a user acceptance check. No live transaction
was submitted by the implementation tests.

## Follow-up: contract-wide links caused account parsing to fail

The first desktop test exposed a gap in the synthetic fixture: the live WAX
account has a `teleport` link containing only `{"account":"other.worlds"}`.
`LinkedAction.action` was required, causing the entire account response to fail
with `missing field action`. This was reproduced with a captured full account
response and a minimal one-link fixture before changing the parser.

The parser now normalizes absent or null action names to the empty name used by
the UI for **All actions**. Named links remain unchanged and malformed non-string
values still fail parsing. This follows the node API's optional action field:
[Antelope chain API definition](https://github.com/AntelopeIO/leap/blob/main/plugins/chain_plugin/include/eosio/chain_plugin/chain_plugin.hpp#L74-L77).

Validation after this correction: five focused parser tests passed; the explicit
read-only live WAX account test passed; all 18 permission-screen tests passed.
The full public RPC response is pinned in
`tests/fixtures/wax-eosriobrazil-account.json` so this account shape remains part
of regression coverage. No chain transaction was submitted.

The corrected unsigned Windows executable and NSIS installer were rebuilt
successfully with `bunx tauri build --no-sign --bundles nsis` and the app was
relaunched for acceptance testing.
