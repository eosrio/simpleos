pub mod antelope;
pub mod commands;
pub mod error;
pub mod keystore;
pub mod ledger;

use keystore::memory::WalletSession;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(WalletSession::new())
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
            // Chain
            commands::chain::get_chain_info,
            commands::chain::get_account,
            commands::chain::get_balances,
            commands::chain::get_table_rows,
            commands::chain::get_producers,
            commands::chain::get_actions_history,
            commands::chain::get_tokens,
            commands::chain::lookup_key_accounts,
            commands::chain::check_endpoint_health,
            // Config
            commands::config::get_chains_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
