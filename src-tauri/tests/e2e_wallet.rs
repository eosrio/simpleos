//! Integration tests for the SimplEOS wallet backend against a real local chain.
//!
//! Prerequisites:
//!   bun run e2e:run    (starts the chain and deploys contracts)
//!
//! Then run:
//!   cargo test --test e2e_wallet -- --test-threads=1
//!
//! Tests run serially because they share chain state.

mod common;

use simpleos_lib::commands::network::lookup_key_accounts_impl;

// ── Chain connectivity ──

#[tokio::test]
async fn test_chain_is_reachable_and_returns_info() {
    let chain_id = require_chain_or_skip!();
    let mut pm = common::make_provider(&chain_id).await;

    let info = pm
        .rpc_call("/v1/chain/get_info", &serde_json::json!({}), |json| {
            Ok(json)
        })
        .await
        .expect("get_info should succeed");

    assert!(info.get("chain_id").is_some(), "chain_id field must exist");
    assert_eq!(
        info["chain_id"].as_str().unwrap(),
        chain_id,
        "chain_id must match"
    );
    assert!(
        info["head_block_num"].as_u64().unwrap_or(0) > 0,
        "head_block_num must be > 0"
    );
}

// ── Account queries ──

#[tokio::test]
async fn test_get_account_returns_alice() {
    let chain_id = require_chain_or_skip!();
    let mut pm = common::make_provider(&chain_id).await;

    let acct = pm
        .rpc_call(
            "/v1/chain/get_account",
            &serde_json::json!({ "account_name": "alice" }),
            |json| Ok(json),
        )
        .await
        .expect("get_account for alice should succeed");

    assert_eq!(acct["account_name"].as_str(), Some("alice"));
    assert!(
        acct["core_liquid_balance"].is_string(),
        "alice should have a core_liquid_balance"
    );
    assert!(
        acct["ram_quota"].as_u64().unwrap_or(0) > 0,
        "alice should have ram_quota"
    );
}

#[tokio::test]
async fn test_get_account_fails_for_unknown_account() {
    let chain_id = require_chain_or_skip!();
    let mut pm = common::make_provider(&chain_id).await;

    let result = pm
        .rpc_call(
            "/v1/chain/get_account",
            &serde_json::json!({ "account_name": "doesnotexist" }),
            |json| Ok(json),
        )
        .await;

    assert!(
        result.is_err(),
        "get_account for nonexistent account should fail"
    );
}

// ── Key → Account Discovery (the main feature we're validating) ──

#[tokio::test]
async fn test_lookup_key_accounts_finds_all_test_accounts() {
    let chain_id = require_chain_or_skip!();
    let mut pm = common::make_provider(&chain_id).await;

    let result = lookup_key_accounts_impl(&mut pm, common::E2E_DEV_PUBLIC_KEY)
        .await
        .expect("lookup_key_accounts should succeed");

    // All test accounts share the dev public key, so they should all be discovered
    for expected in common::E2E_TEST_ACCOUNTS {
        assert!(
            result.account_names.iter().any(|n| n == expected),
            "expected to find {} in account_names, got: {:?}",
            expected,
            result.account_names
        );
    }

    // Authorities should include at least one permission entry per account
    assert!(
        !result.authorities.is_empty(),
        "authorities list should not be empty (get_accounts_by_authorizers returns permissions)"
    );

    let alice_auth = result
        .authorities
        .iter()
        .find(|a| a.account_name == "alice");
    assert!(
        alice_auth.is_some(),
        "alice must be in authorities (got: {:?})",
        result.authorities
    );
}

#[tokio::test]
async fn test_lookup_key_accounts_returns_empty_for_unknown_key() {
    let chain_id = require_chain_or_skip!();
    let mut pm = common::make_provider(&chain_id).await;

    // A well-formed but unused public key
    let unused_key = "EOS7EarnUhcyrqpVHCPEbyUN5dXipn7VLQj8pkzx7e4JjzMAcAumX";

    let result = lookup_key_accounts_impl(&mut pm, unused_key)
        .await
        .expect("lookup should not error even for unknown keys");

    assert!(
        result.account_names.is_empty(),
        "unused key should return empty account list, got: {:?}",
        result.account_names
    );
}

// ── Token balance queries ──

#[tokio::test]
async fn test_get_currency_balance_returns_alice_balance() {
    let chain_id = require_chain_or_skip!();
    let mut pm = common::make_provider(&chain_id).await;

    let balances: serde_json::Value = pm
        .rpc_call(
            "/v1/chain/get_currency_balance",
            &serde_json::json!({
                "code": "eosio.token",
                "account": "alice",
                "symbol": "TST"
            }),
            |json| Ok(json),
        )
        .await
        .expect("get_currency_balance should succeed");

    let arr = balances.as_array().expect("balances should be an array");
    assert!(!arr.is_empty(), "alice must have a TST balance");
    let bal_str = arr[0].as_str().expect("balance entry should be a string");
    assert!(
        bal_str.contains("TST"),
        "balance should contain token symbol: {}",
        bal_str
    );
}

// ── Table queries (used by BP list, RAM price, delegations, etc.) ──

#[tokio::test]
async fn test_get_producers_table_contains_registered_producers() {
    let chain_id = require_chain_or_skip!();
    let mut pm = common::make_provider(&chain_id).await;

    let result = pm
        .rpc_call(
            "/v1/chain/get_table_rows",
            &serde_json::json!({
                "code": "eosio",
                "table": "producers",
                "scope": "eosio",
                "json": true,
                "limit": 50
            }),
            |json| Ok(json),
        )
        .await
        .expect("get_table_rows for producers should succeed");

    let rows = result["rows"].as_array().expect("rows should be an array");
    let producer_names: Vec<&str> = rows
        .iter()
        .filter_map(|r| r.get("owner").and_then(|o| o.as_str()))
        .collect();

    assert!(
        producer_names.contains(&"producer1"),
        "producer1 must be in the producers table, got: {:?}",
        producer_names
    );
    assert!(
        producer_names.contains(&"producer2"),
        "producer2 must be registered"
    );
    assert!(
        producer_names.contains(&"producer3"),
        "producer3 must be registered"
    );
}

#[tokio::test]
async fn test_get_rammarket_returns_bancor_state() {
    let chain_id = require_chain_or_skip!();
    let mut pm = common::make_provider(&chain_id).await;

    let result = pm
        .rpc_call(
            "/v1/chain/get_table_rows",
            &serde_json::json!({
                "code": "eosio",
                "table": "rammarket",
                "scope": "eosio",
                "json": true,
                "limit": 1
            }),
            |json| Ok(json),
        )
        .await
        .expect("get_table_rows for rammarket should succeed");

    let rows = result["rows"].as_array().expect("rows should be an array");
    assert!(!rows.is_empty(), "rammarket should have data");
    assert!(
        rows[0].get("base").is_some(),
        "rammarket must have base field"
    );
    assert!(
        rows[0].get("quote").is_some(),
        "rammarket must have quote field"
    );
}

// ── ABI fetching (used by feature detection) ──

#[tokio::test]
async fn test_get_abi_returns_system_contract_actions() {
    let chain_id = require_chain_or_skip!();
    let mut pm = common::make_provider(&chain_id).await;

    let result = pm
        .rpc_call(
            "/v1/chain/get_abi",
            &serde_json::json!({ "account_name": "eosio" }),
            |json| Ok(json),
        )
        .await
        .expect("get_abi for eosio should succeed");

    let abi = result["abi"].as_object().expect("abi should be an object");
    let actions = abi["actions"]
        .as_array()
        .expect("abi.actions should be an array");

    let action_names: Vec<&str> = actions
        .iter()
        .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
        .collect();

    // Core actions used by SimplEOS feature detection
    assert!(
        action_names.contains(&"delegatebw"),
        "eosio ABI must include delegatebw"
    );
    assert!(
        action_names.contains(&"voteproducer"),
        "eosio ABI must include voteproducer"
    );
    assert!(
        action_names.contains(&"buyram"),
        "eosio ABI must include buyram"
    );
}
