//! Shared test helpers for integration tests.
//!
//! These tests run against the local e2e chain started by
//! `bun run e2e:run` (see `tests/e2e/` in the project root).
//!
//! The chain must be running before invoking `cargo test --test <name>`.

use simpleos_lib::antelope::provider::ProviderManager;

/// Default local e2e chain endpoint.
pub const E2E_RPC_URL: &str = "http://127.0.0.1:18888";

/// Dev public key matching the genesis.json initial_key.
pub const E2E_DEV_PUBLIC_KEY: &str = "EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV";

/// Dev private key used by the e2e chain bootstrap.
#[allow(dead_code)]
pub const E2E_DEV_PRIVATE_KEY: &str = "5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3";

/// Placeholder chain_id for pure offline keystore tests (not validated against a live chain).
#[allow(dead_code)]
pub const TEST_CHAIN_PLACEHOLDER: &str =
    "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906";

/// Test accounts created by the e2e bootstrap (tests/e2e/lib/contract-deployer.ts).
#[allow(dead_code)]
pub const E2E_TEST_ACCOUNTS: &[&str] = &[
    "alice",
    "bob",
    "carol",
    "exchange.1",
    "producer1",
    "producer2",
    "producer3",
];

/// Check if the local e2e chain is reachable, skipping the test if not.
/// Returns Some(chain_id) if the chain is up, None if tests should be skipped.
pub async fn require_chain() -> Option<String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(2))
        .build()
        .ok()?;

    let res = client
        .get(format!("{}/v1/chain/get_info", E2E_RPC_URL))
        .send()
        .await
        .ok()?;

    if !res.status().is_success() {
        return None;
    }

    let json: serde_json::Value = res.json().await.ok()?;
    let chain_id = json.get("chain_id")?.as_str()?.to_string();
    Some(chain_id)
}

/// Build a ProviderManager configured for the local e2e chain.
/// Performs a health check so endpoints are marked healthy before calls.
pub async fn make_provider(chain_id: &str) -> ProviderManager {
    let mut pm = ProviderManager::new(chain_id);
    pm.add_rpc_endpoint(E2E_RPC_URL, Some("e2e-test"));
    pm.check_all_rpc_endpoints().await;
    pm
}

/// Print a "skipped" message when the chain isn't running. Used as an early
/// return pattern so CI without Docker doesn't fail all integration tests.
#[macro_export]
macro_rules! require_chain_or_skip {
    () => {{
        match crate::common::require_chain().await {
            Some(id) => id,
            None => {
                eprintln!(
                    "\n  SKIPPED: e2e chain not reachable at {}.\n           Run: bun run e2e:run\n",
                    crate::common::E2E_RPC_URL
                );
                return;
            }
        }
    }};
}
