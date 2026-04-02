use crate::antelope::chain_config::{self, ChainConfig};
use crate::error::Error;

/// Get the default chain configurations.
#[tauri::command]
pub fn get_chains_config() -> Result<Vec<ChainConfig>, Error> {
    Ok(chain_config::default_chains())
}
