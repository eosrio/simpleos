pub mod antelope;
pub mod commands;
pub mod error;
pub mod keystore;
pub mod ledger;

use antelope::provider::ProviderState;
use keystore::memory::WalletSession;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(WalletSession::new())
        .manage(ProviderState::new())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Wallet
            commands::wallet::is_locked,
            commands::wallet::unlock,
            commands::wallet::lock,
            commands::wallet::import_private_key,
            commands::wallet::list_public_keys,
            commands::wallet::remove_key,
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
            commands::network::get_active_endpoints,
            // Config
            commands::config::get_chains_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
