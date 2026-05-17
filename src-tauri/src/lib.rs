pub mod antelope;
pub mod biometric;
pub mod commands;
pub mod error;
pub mod keystore;
#[cfg(feature = "ledger")]
pub mod ledger;
pub mod tray;

use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::{Manager, WindowEvent};
use tauri_plugin_store::StoreExt;

use antelope::provider::ProviderState;
use keystore::store::{FileKeyStore, OsKeyStore};
use keystore::wallet::WalletService;
use tray::TrayState;

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
        .plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {}))
        .plugin(tauri_plugin_deep_link::init())
        .manage(ProviderState::new())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .on_window_event(|window, event| {
            // Intercept close on the main window so it hides to the tray
            // instead of exiting the app. The tray "Quit" menu item flips
            // `quitting` so a subsequent close is allowed through.
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() != "main" {
                    return;
                }
                let app = window.app_handle();
                if let Some(state) = app.try_state::<TrayState>() {
                    if !state.quitting.load(Ordering::SeqCst)
                        && state.close_to_tray.load(Ordering::SeqCst)
                    {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                }
            }
        })
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
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

            // Load close-to-tray preference from the shared store that the
            // frontend Settings page writes to. Defaults to `true` so the
            // wallet stays resident and can handle signing requests quickly.
            let close_to_tray = match app.handle().store("wallet-state.json") {
                Ok(store) => store
                    .get("closeToTray")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(true),
                Err(e) => {
                    log::warn!("[tray] failed to read wallet-state.json ({e}), defaulting close_to_tray=true");
                    true
                }
            };
            app.manage(TrayState::new(close_to_tray));

            tray::setup_tray(app)?;

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
            commands::wallet::to_fio_public_key,
            commands::wallet::generate_key_pair,
            commands::wallet::list_public_keys,
            commands::wallet::export_private_key,
            commands::wallet::remove_key,
            commands::wallet::sign_and_push,
            commands::wallet::sign_transaction,
            commands::wallet::sign_digest,
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
            commands::wallet::biometric_status,
            commands::wallet::set_biometric_unlock,
            commands::wallet::unlock_with_biometric,
            commands::wallet::has_biometric_unlock,
            commands::wallet::remove_biometric_unlock,
            commands::wallet::reset_wallet,
            commands::wallet::test_keyring,
            // Tray / window
            commands::tray::set_close_to_tray,
            commands::tray::get_close_to_tray,
            commands::tray::show_main_window,
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
            commands::network::get_msig_inbox,
            commands::network::get_msig_proposal_details,
            commands::network::refresh_msig_status,
            commands::network::scan_msig_scopes_stream,
            commands::network::get_tokens,
            commands::network::fio_get_fee,
            commands::network::fio_get_names,
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
            commands::dapp::reload_dapp,
            commands::dapp::dapp_go_back,
            commands::dapp::dapp_go_forward,
            commands::dapp::dapp_resolve_signing,
            commands::dapp::dapp_reject_signing,
            // Link sessions (anchor-link protocol)
            commands::session::create_link_session,
            commands::session::unseal_message,
            commands::session::seal_message,
            commands::session::delete_link_session,
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
