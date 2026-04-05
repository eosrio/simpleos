pub mod antelope;
pub mod commands;
pub mod error;
pub mod keystore;
#[cfg(feature = "ledger")]
pub mod ledger;

use std::sync::Arc;
use tauri::Manager;

use antelope::provider::ProviderState;
use keystore::store::{FileKeyStore, OsKeyStore};
use keystore::wallet::WalletService;

/// Thread-safe wrapper for WalletService to use as Tauri managed state.
pub struct AppWallet(pub Arc<WalletService>);

/// Probe the OS keyring with a write→new-entry-read→delete cycle.
/// Returns true if a value written by one Entry can be read by a fresh Entry.
fn probe_os_keyring() -> bool {
    let service = "simpleos";
    let user = "simpleos-keyring-probe";
    let value = "probe-ok";

    // Step 1: write
    let write_entry = match keyring::Entry::new(service, user) {
        Ok(e) => e,
        Err(_) => return false,
    };
    if write_entry.set_password(value).is_err() {
        return false;
    }

    // Step 2: create a FRESH entry with the same params and try to read
    let read_entry = match keyring::Entry::new(service, user) {
        Ok(e) => e,
        Err(_) => return false,
    };
    let ok = match read_entry.get_password() {
        Ok(v) => v == value,
        Err(_) => false,
    };

    // Step 3: clean up
    let _ = write_entry.delete_credential();

    ok
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut all_chains = antelope::chain_config::default_chains();
    all_chains.extend(antelope::chain_config::default_testnets());
    let chain_ids: Vec<String> = all_chains.iter().map(|c| c.id.clone()).collect();

    tauri::Builder::default()
        .manage(ProviderState::new())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;

                // Auto-open DevTools in debug builds
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }

            // Pick key store backend: OS keyring if it works, file-based fallback
            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to resolve app data directory");

            let store: Box<dyn keystore::store::KeyStore> = if probe_os_keyring() {
                log::info!("[wallet] OS keyring probe passed — using OsKeyStore");
                Box::new(OsKeyStore)
            } else {
                log::warn!("[wallet] OS keyring probe FAILED — falling back to FileKeyStore at {:?}", app_data_dir);
                Box::new(FileKeyStore::new(app_data_dir))
            };

            let wallet = AppWallet(Arc::new(WalletService::new(store, chain_ids)));
            app.manage(wallet);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Wallet
            commands::wallet::has_wallet,
            commands::wallet::is_locked,
            commands::wallet::unlock,
            commands::wallet::lock,
            commands::wallet::import_private_key,
            commands::wallet::import_key_with_session,
            commands::wallet::derive_public_key,
            commands::wallet::generate_key_pair,
            commands::wallet::list_public_keys,
            commands::wallet::export_private_key,
            commands::wallet::remove_key,
            commands::wallet::sign_and_push,
            commands::wallet::sign_transaction,
            commands::wallet::change_passphrase,
            commands::wallet::get_security_mode,
            commands::wallet::set_security_mode,
            commands::wallet::needs_passphrase_for_signing,
            commands::wallet::needs_lockscreen,
            commands::wallet::sign_and_push_with_passphrase,
            commands::wallet::generate_finalizer_key,
            commands::wallet::list_finalizer_keys,
            commands::wallet::get_finalizer_pop,
            commands::wallet::export_backup,
            commands::wallet::import_backup,
            commands::wallet::set_pin,
            commands::wallet::unlock_with_pin,
            commands::wallet::has_pin,
            commands::wallet::remove_pin,
            commands::wallet::reset_wallet,
            commands::wallet::test_keyring,
            // Network (provider-managed, with failover)
            commands::network::init_chain_providers,
            commands::network::check_rpc_endpoints,
            commands::network::check_hyperion_endpoints,
            commands::network::get_chain_info,
            commands::network::get_account,
            commands::network::get_balances,
            commands::network::get_table_rows,
            commands::network::get_abi,
            commands::network::get_producers,
            commands::network::lookup_key_accounts,
            commands::network::get_actions_history,
            commands::network::get_tokens,
            commands::network::fio_get_fee,
            commands::network::fio_get_pub_address,
            commands::network::get_active_endpoints,
            commands::network::load_cached_endpoints,
            commands::network::discover_endpoints,
            commands::network::get_powerup_info,
            commands::network::estimate_powerup,
            // Anchor import
            commands::anchor::parse_anchor_backup,
            commands::anchor::verify_anchor_password,
            commands::anchor::import_anchor_entries,
            // Config
            commands::config::get_chains_config,
            // DApp browser
            commands::dapp::open_dapp_browser,
            commands::dapp::close_dapp_browser,
            commands::dapp::navigate_dapp,
            commands::dapp::resize_dapp_browser,
            commands::dapp::reload_dapp,
            commands::dapp::dapp_go_back,
            commands::dapp::dapp_go_forward,
            commands::dapp::dapp_resolve_signing,
            commands::dapp::dapp_reject_signing,
            // Ledger
            #[cfg(feature = "ledger")]
            commands::ledger::ledger_list_devices,
            #[cfg(feature = "ledger")]
            commands::ledger::ledger_get_app_config,
            #[cfg(feature = "ledger")]
            commands::ledger::ledger_get_public_key,
            #[cfg(feature = "ledger")]
            commands::ledger::ledger_discover_keys,
            #[cfg(feature = "ledger")]
            commands::ledger::ledger_sign_and_push,
            #[cfg(feature = "ledger")]
            commands::ledger::ledger_watch_devices,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
