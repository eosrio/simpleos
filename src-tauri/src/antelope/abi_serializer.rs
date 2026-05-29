use crate::antelope::provider::ProviderManager;
use crate::error::Error;

#[cfg(all(
    feature = "local-abieos",
    any(
        target_os = "linux",
        target_os = "macos",
        all(target_os = "windows", target_env = "gnu")
    )
))]
pub async fn try_serialize_action_json(
    pm: &mut ProviderManager,
    account: &str,
    action: &str,
    data: &serde_json::Value,
) -> Result<Option<String>, Error> {
    let abi_response = match pm
        .rpc_call(
            "/v1/chain/get_abi",
            &serde_json::json!({ "account_name": account }),
            |json| Ok(json),
        )
        .await
    {
        Ok(json) => json,
        Err(err) => {
            log::warn!(
                "[tx] local abieos unavailable for {}::{}: get_abi failed: {}",
                account,
                action,
                err
            );
            return Ok(None);
        }
    };

    let abi = abi_response.get("abi").cloned().unwrap_or(abi_response);
    if abi.is_null() {
        return Err(Error::Serialization(format!(
            "Could not serialize {}::{} locally: get_abi returned no ABI",
            account, action
        )));
    }

    let abi_json = serde_json::to_string(&abi)
        .map_err(|e| Error::Serialization(format!("Serialize ABI JSON: {}", e)))?;
    let data_json = serde_json::to_string(data)
        .map_err(|e| Error::Serialization(format!("Serialize action JSON: {}", e)))?;

    log::info!("[tx] local abieos: loading ABI for {}", account);
    let abieos = rs_abieos::Abieos::new();
    abieos.set_abi_json(account, &abi_json).map_err(|e| {
        Error::Serialization(format!(
            "Could not load ABI for {} into local abieos: {}",
            account, e
        ))
    })?;

    let datatype = abieos.get_type_for_action(account, action).map_err(|e| {
        Error::Serialization(format!(
            "Could not resolve ABI type for {}::{} locally: {}",
            account, action, e
        ))
    })?;

    let data_hex = abieos
        .json_to_hex(account, &datatype, &data_json)
        .map_err(|e| {
            Error::Serialization(format!(
                "Could not serialize {}::{} locally with ABI type {}: {}",
                account, action, datatype, e
            ))
        })?;

    log::info!(
        "[tx] local abieos: serialized {}::{} as {} bytes",
        account,
        action,
        data_hex.len() / 2
    );

    Ok(Some(data_hex))
}

#[cfg(not(all(
    feature = "local-abieos",
    any(
        target_os = "linux",
        target_os = "macos",
        all(target_os = "windows", target_env = "gnu")
    )
)))]
pub async fn try_serialize_action_json(
    _pm: &mut ProviderManager,
    account: &str,
    action: &str,
    _data: &serde_json::Value,
) -> Result<Option<String>, Error> {
    Err(Error::Serialization(format!(
        "local abieos is not available for {}::{} in this build (feature local-abieos={}, target_os={}, target_family={}; rs_abieos currently supports Linux, macOS, and Windows GNU)",
        account,
        action,
        cfg!(feature = "local-abieos"),
        std::env::consts::OS,
        std::env::consts::FAMILY
    )))
}
