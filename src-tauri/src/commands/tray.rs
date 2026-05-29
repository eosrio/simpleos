//! Tauri commands for controlling tray / close-to-tray behavior and for
//! letting the frontend (or a future external bridge) bring the window to
//! the foreground when a signing request arrives.

use std::sync::atomic::Ordering;

use tauri::{AppHandle, State};

use crate::tray::{show_main_window as bring_main_window_to_front, TrayState};

/// Update whether closing the main window should hide it to the tray.
/// Called by the Settings page when the user toggles the option.
#[tauri::command]
pub fn set_close_to_tray(enabled: bool, state: State<'_, TrayState>) -> Result<(), String> {
    state.close_to_tray.store(enabled, Ordering::SeqCst);
    Ok(())
}

/// Read the current close-to-tray setting (for UI hydration).
#[tauri::command]
pub fn get_close_to_tray(state: State<'_, TrayState>) -> bool {
    state.close_to_tray.load(Ordering::SeqCst)
}

/// Bring the main window to the foreground. Intended to be called from the
/// frontend (or a future external bridge) when a dapp issues a signing
/// request while the wallet is hidden in the tray.
#[tauri::command]
pub fn show_main_window(app: AppHandle) -> Result<(), String> {
    bring_main_window_to_front(&app);
    Ok(())
}
