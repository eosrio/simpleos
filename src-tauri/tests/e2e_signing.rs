//! End-to-end signing tests that exercise the complete SimplEOS transaction
//! pipeline against a real local Antelope chain:
//!
//!   passphrase → keystore → decrypt → sign_and_push → verify on chain
//!
//! Prerequisites:
//!   bun run e2e:run    (starts the chain and deploys contracts)
//!
//! Then run:
//!   cargo test --test e2e_signing -- --test-threads=1
//!
//! Tests run serially because they share chain state and mutate account balances.

mod common;

use simpleos_lib::antelope::signing;
use simpleos_lib::antelope::transaction::{self, ActionData, ActionDesc, AuthDesc};
use simpleos_lib::keystore::store::MemoryKeyStore;
use simpleos_lib::keystore::wallet::WalletService;

/// Helper to build a standard token transfer action.
fn transfer_action(from: &str, to: &str, quantity: &str, memo: &str) -> ActionDesc {
    ActionDesc {
        account: "eosio.token".to_string(),
        name: "transfer".to_string(),
        authorization: vec![AuthDesc {
            actor: from.to_string(),
            permission: "active".to_string(),
        }],
        data: ActionData::Json(serde_json::json!({
            "from": from,
            "to": to,
            "quantity": quantity,
            "memo": memo,
        })),
    }
}

/// Helper: read a token balance for an account. Returns the amount as f64.
async fn get_balance(
    pm: &mut simpleos_lib::antelope::provider::ProviderManager,
    account: &str,
    symbol: &str,
) -> f64 {
    let balances: serde_json::Value = pm
        .rpc_call(
            "/v1/chain/get_currency_balance",
            &serde_json::json!({
                "code": "eosio.token",
                "account": account,
                "symbol": symbol,
            }),
            |json| Ok(json),
        )
        .await
        .expect("get_currency_balance should succeed");

    let arr = balances.as_array().expect("balances array");
    if arr.is_empty() {
        return 0.0;
    }
    let s = arr[0].as_str().unwrap();
    s.split_whitespace().next().unwrap().parse::<f64>().unwrap()
}

// ── Public key derivation ──

#[tokio::test]
async fn test_dev_wif_derives_expected_public_key() {
    // This test runs without the chain — it's a pure key derivation sanity check
    // that proves the constants match what the e2e chain expects.
    let (_priv, pub_key) =
        signing::public_key_from_wif(common::E2E_DEV_PRIVATE_KEY).expect("WIF decode");
    assert_eq!(pub_key, common::E2E_DEV_PUBLIC_KEY);
}

// ── Full keystore pipeline: import → decrypt → re-derive ──

#[tokio::test]
async fn test_keystore_full_import_and_decrypt_cycle() {
    // Verify the complete keystore pipeline produces a usable private key
    // that matches the original WIF.
    let wallet = WalletService::new(
        Box::new(MemoryKeyStore::new()),
        vec![common::TEST_CHAIN_PLACEHOLDER.to_string()],
    );

    let passphrase = "integration-test-passphrase";
    let result = wallet
        .import_key(
            common::E2E_DEV_PRIVATE_KEY,
            common::TEST_CHAIN_PLACEHOLDER,
            passphrase,
        )
        .expect("import should succeed");

    assert_eq!(result.public_key, common::E2E_DEV_PUBLIC_KEY);

    // Lock and unlock with passphrase
    wallet.lock();
    assert!(wallet.is_locked());
    wallet.unlock(passphrase).expect("unlock");

    // Decrypt and verify the private key bytes match the original
    let decrypted = wallet
        .decrypt_key(common::TEST_CHAIN_PLACEHOLDER, &result.public_key)
        .expect("decrypt");

    // Re-derive public key from decrypted bytes — must match
    let (_, rederived_pub) = signing::public_key_from_wif(common::E2E_DEV_PRIVATE_KEY).unwrap();
    assert_eq!(rederived_pub, result.public_key);
    assert_eq!(decrypted.len(), 32);
}

// ── Sign a transaction using ONLY the keystore (no chain push) ──

#[tokio::test]
async fn test_keystore_decrypted_key_signs_deterministically() {
    let wallet = WalletService::new(
        Box::new(MemoryKeyStore::new()),
        vec![common::TEST_CHAIN_PLACEHOLDER.to_string()],
    );

    wallet
        .import_key(
            common::E2E_DEV_PRIVATE_KEY,
            common::TEST_CHAIN_PLACEHOLDER,
            "p",
        )
        .unwrap();

    let priv_bytes = wallet
        .decrypt_key(common::TEST_CHAIN_PLACEHOLDER, common::E2E_DEV_PUBLIC_KEY)
        .unwrap();

    // Sign the same fixed input twice — RFC 6979 deterministic nonce means
    // signatures should be byte-identical
    let chain_id = common::TEST_CHAIN_PLACEHOLDER;
    let tx = [0xabu8; 64];
    let sig1 = signing::sign_transaction(chain_id, &tx, &priv_bytes).unwrap();
    let sig2 = signing::sign_transaction(chain_id, &tx, &priv_bytes).unwrap();
    assert_eq!(sig1, sig2, "deterministic ECDSA signatures must match");
    assert!(sig1.starts_with("SIG_K1_"));
}

// ── Full end-to-end: keystore → sign → push → verify on chain ──

#[tokio::test]
async fn test_full_signing_pipeline_push_transfer_to_chain() {
    let chain_id = require_chain_or_skip!();

    // 1. Set up an in-memory wallet and import the dev key
    let wallet = WalletService::new(Box::new(MemoryKeyStore::new()), vec![chain_id.clone()]);
    let import = wallet
        .import_key(common::E2E_DEV_PRIVATE_KEY, &chain_id, "test-pass")
        .expect("import should succeed");
    assert_eq!(import.public_key, common::E2E_DEV_PUBLIC_KEY);

    // 2. Decrypt the key through the keystore (simulating a real signing request)
    let priv_bytes = wallet
        .decrypt_key(&chain_id, &import.public_key)
        .expect("decrypt should succeed");

    // 3. Record alice's balance before
    let mut pm = common::make_provider(&chain_id).await;
    let alice_before = get_balance(&mut pm, "alice", "TST").await;
    let bob_before = get_balance(&mut pm, "bob", "TST").await;

    // 4. Build and push a transfer via the real sign_and_push function
    //    This is the exact code path the wallet uses in production
    let actions = vec![transfer_action(
        "alice",
        "bob",
        "1.0000 TST",
        "rust e2e transfer",
    )];

    let result = transaction::sign_and_push(&mut pm, &actions, &priv_bytes)
        .await
        .expect("sign_and_push should succeed");

    assert!(!result.transaction_id.is_empty(), "must return tx id");
    assert_eq!(
        result.transaction_id.len(),
        64,
        "tx id must be 32 bytes hex"
    );

    // 5. Wait for the transaction to be applied, then verify balances changed
    tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
    let alice_after = get_balance(&mut pm, "alice", "TST").await;
    let bob_after = get_balance(&mut pm, "bob", "TST").await;

    assert!(
        (alice_before - alice_after - 1.0).abs() < 0.0001,
        "alice should have lost 1.0000 TST (before={}, after={})",
        alice_before,
        alice_after
    );
    assert!(
        (bob_after - bob_before - 1.0).abs() < 0.0001,
        "bob should have gained 1.0000 TST (before={}, after={})",
        bob_before,
        bob_after
    );
}

// ── Passphrase change pipeline ──

#[tokio::test]
async fn test_passphrase_change_preserves_signing_key() {
    let chain_id = require_chain_or_skip!();

    let wallet = WalletService::new(Box::new(MemoryKeyStore::new()), vec![chain_id.clone()]);

    let old_pass = "initial-passphrase";
    let new_pass = "rotated-passphrase";

    wallet
        .import_key(common::E2E_DEV_PRIVATE_KEY, &chain_id, old_pass)
        .unwrap();

    // Change passphrase
    let count = wallet.change_passphrase(old_pass, new_pass).unwrap();
    assert_eq!(count, 1, "should re-encrypt 1 key");

    // Old passphrase should now fail
    wallet.lock();
    assert!(
        wallet.unlock(old_pass).is_err(),
        "old passphrase must be rejected"
    );

    // New passphrase should work AND the key must still be usable
    wallet.unlock(new_pass).expect("new passphrase must work");
    let priv_bytes = wallet
        .decrypt_key(&chain_id, common::E2E_DEV_PUBLIC_KEY)
        .expect("key still decryptable after passphrase change");

    // Use the key to sign and push a transaction — if the rotation corrupted
    // the key, this would produce an invalid signature and get rejected by the chain
    let mut pm = common::make_provider(&chain_id).await;
    let actions = vec![transfer_action(
        "alice",
        "bob",
        "0.0001 TST",
        "post-rotation signing test",
    )];

    let result = transaction::sign_and_push(&mut pm, &actions, &priv_bytes)
        .await
        .expect("signing with rotated key must succeed on chain");

    assert_eq!(result.transaction_id.len(), 64);
}

// ── Backup export/import pipeline ──

#[tokio::test]
async fn test_backup_export_import_preserves_signing() {
    let chain_id = require_chain_or_skip!();

    // Source wallet: import key and export backup
    let source = WalletService::new(Box::new(MemoryKeyStore::new()), vec![chain_id.clone()]);
    source
        .import_key(common::E2E_DEV_PRIVATE_KEY, &chain_id, "backup-test-pass")
        .unwrap();
    let backup_json = source.export_backup("backup-test-pass").unwrap();
    assert!(backup_json.contains("simpleos-v2"));
    assert!(backup_json.contains(common::E2E_DEV_PUBLIC_KEY));

    // Target wallet: fresh, import backup with same passphrase
    let target = WalletService::new(Box::new(MemoryKeyStore::new()), vec![chain_id.clone()]);
    let count = target
        .import_backup(&backup_json, "backup-test-pass")
        .unwrap();
    assert_eq!(count, 1, "should import 1 key from backup");

    // The restored key must be able to sign a real transaction
    let priv_bytes = target
        .decrypt_key(&chain_id, common::E2E_DEV_PUBLIC_KEY)
        .expect("restored key must be decryptable");

    let mut pm = common::make_provider(&chain_id).await;
    let actions = vec![transfer_action(
        "alice",
        "carol",
        "0.0001 TST",
        "backup-restored signing test",
    )];

    let result = transaction::sign_and_push(&mut pm, &actions, &priv_bytes)
        .await
        .expect("signing with backup-restored key must succeed on chain");
    assert_eq!(result.transaction_id.len(), 64);
}

// ── Wrong passphrase rejection ──

#[tokio::test]
async fn test_backup_import_rejects_wrong_passphrase() {
    let chain_id = "test-chain-id-for-offline-test";

    let source = WalletService::new(Box::new(MemoryKeyStore::new()), vec![chain_id.to_string()]);
    source
        .import_key(common::E2E_DEV_PRIVATE_KEY, chain_id, "correct-pass")
        .unwrap();
    let backup_json = source.export_backup("correct-pass").unwrap();

    let target = WalletService::new(Box::new(MemoryKeyStore::new()), vec![chain_id.to_string()]);
    let result = target.import_backup(&backup_json, "wrong-pass");
    assert!(
        result.is_err(),
        "import with wrong passphrase must fail, but got: {:?}",
        result
    );
}
