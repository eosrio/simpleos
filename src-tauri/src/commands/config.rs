use crate::antelope::chain_config::{self, ChainConfig};
use crate::error::Error;

/// Get all chain configurations (mainnets + testnets).
#[tauri::command]
pub fn get_chains_config() -> Result<Vec<ChainConfig>, Error> {
    let mut chains = chain_config::default_chains();
    chains.extend(chain_config::default_testnets());
    Ok(chains)
}
