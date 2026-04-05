// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Clean Snap VSCode GTK env vars that poison library loading on Linux
    for var in &[
        "GTK_PATH",
        "GTK_EXE_PREFIX",
        "GDK_PIXBUF_MODULEDIR",
        "GDK_PIXBUF_MODULE_FILE",
        "GTK_IM_MODULE_FILE",
        "GIO_MODULE_DIR",
        "LOCPATH",
    ] {
        std::env::remove_var(var);
    }

    simpleos_lib::run();
}
