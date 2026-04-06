//! System tray integration.
//!
//! Provides a persistent tray icon so the wallet can stay resident in the
//! background while hidden. This lets other sites (via the DApp browser or
//! future deep-link / local-bridge transports) wake the wallet for a signing
//! request without paying the cold-start cost of re-launching the app.
//!
//! Behavior:
//! - Left click → show and focus the main window.
//! - Right click → context menu (Show / Lock / Quit).
//! - Closing the window hides it to the tray when `close_to_tray` is enabled
//!   (see `lib.rs` window-event handler). The "Quit" menu item sets the
//!   `quitting` flag so the close handler lets the app exit normally.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Emitter, Manager,
};

/// Runtime flags controlling tray / close behavior.
pub struct TrayState {
    /// When true, closing the main window hides it to the tray instead of
    /// exiting the application.
    pub close_to_tray: Arc<AtomicBool>,
    /// Set by the tray "Quit" menu item so the window close handler knows to
    /// let the app exit instead of re-hiding the window.
    pub quitting: Arc<AtomicBool>,
}

impl TrayState {
    pub fn new(close_to_tray: bool) -> Self {
        Self {
            close_to_tray: Arc::new(AtomicBool::new(close_to_tray)),
            quitting: Arc::new(AtomicBool::new(false)),
        }
    }
}

/// Build and install the system tray icon on application startup.
pub fn setup_tray(app: &App) -> tauri::Result<()> {
    let show_i = MenuItem::with_id(app, "tray_show", "Show SimplEOS", true, None::<&str>)?;
    let lock_i = MenuItem::with_id(app, "tray_lock", "Lock Wallet", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit_i = MenuItem::with_id(app, "tray_quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_i, &lock_i, &sep, &quit_i])?;

    let icon = app
        .default_window_icon()
        .cloned()
        .expect("default window icon must be bundled for tray setup");

    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .tooltip("SimplEOS Wallet")
        .menu(&menu)
        // We handle left clicks ourselves (show window); menu opens on right click.
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "tray_show" => show_main_window(app),
            "tray_lock" => {
                // Tell the frontend to lock the wallet, then pop the window up
                // so the user lands on the lock screen.
                let _ = app.emit("tray-lock-request", ());
                show_main_window(app);
            }
            "tray_quit" => {
                if let Some(state) = app.try_state::<TrayState>() {
                    state.quitting.store(true, Ordering::SeqCst);
                }
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

/// Show, un-minimize, and focus the main window. Safe to call when already
/// visible — acts as a no-op "bring to front".
pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
