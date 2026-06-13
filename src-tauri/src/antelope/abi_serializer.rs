use crate::antelope::provider::ProviderManager;
use crate::error::Error;

#[cfg(feature = "local-abieos")]
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

#[cfg(not(feature = "local-abieos"))]
pub async fn try_serialize_action_json(
    _pm: &mut ProviderManager,
    account: &str,
    action: &str,
    _data: &serde_json::Value,
) -> Result<Option<String>, Error> {
    Err(Error::Serialization(format!(
        "local abieos is not available for {}::{} in this build (feature local-abieos is disabled)",
        account, action
    )))
}

#[cfg(all(test, feature = "local-abieos"))]
mod tests {
    use crate::antelope::serialize::{hex_encode, serialize_name};

    /// Minimal eosio.msig ABI covering `approve`, including the
    /// `binary_extension<checksum256>` proposal_hash field.
    const MSIG_ABI: &str = r#"{
        "version": "eosio::abi/1.1",
        "types": [],
        "structs": [
            {"name": "permission_level", "base": "", "fields": [
                {"name": "actor", "type": "name"},
                {"name": "permission", "type": "name"}
            ]},
            {"name": "approve", "base": "", "fields": [
                {"name": "proposer", "type": "name"},
                {"name": "proposal_name", "type": "name"},
                {"name": "level", "type": "permission_level"},
                {"name": "proposal_hash", "type": "checksum256$"}
            ]}
        ],
        "actions": [{"name": "approve", "type": "approve", "ricardian_contract": ""}],
        "tables": []
    }"#;

    fn expected_approve_prefix() -> String {
        let mut bytes = serialize_name("alice").unwrap();
        bytes.extend_from_slice(&serialize_name("prop").unwrap());
        bytes.extend_from_slice(&serialize_name("bob").unwrap());
        bytes.extend_from_slice(&serialize_name("active").unwrap());
        hex_encode(&bytes)
    }

    /// Regression test for msig approve serialization on all desktop targets —
    /// on Windows MSVC this exercises the rs_abieos pure-Rust backend, which
    /// replaced the (now widely disabled) RPC abi_json_to_bin fallback.
    #[test]
    fn abieos_serializes_msig_approve() {
        let abieos = rs_abieos::Abieos::new();
        abieos.set_abi_json("eosio.msig", MSIG_ABI).unwrap();

        let datatype = abieos
            .get_type_for_action("eosio.msig", "approve")
            .unwrap();
        assert_eq!(datatype, "approve");

        // Without the binary-extension proposal_hash: nothing appended.
        let data = r#"{"proposer":"alice","proposal_name":"prop","level":{"actor":"bob","permission":"active"}}"#;
        let hex = abieos
            .json_to_hex("eosio.msig", &datatype, data)
            .unwrap()
            .to_lowercase();
        assert_eq!(hex, expected_approve_prefix());

        // With proposal_hash: 32 raw bytes appended (SEC-003 binding).
        let hash = "ab".repeat(32);
        let data_with_hash = format!(
            r#"{{"proposer":"alice","proposal_name":"prop","level":{{"actor":"bob","permission":"active"}},"proposal_hash":"{}"}}"#,
            hash
        );
        let hex = abieos
            .json_to_hex("eosio.msig", &datatype, &data_with_hash)
            .unwrap()
            .to_lowercase();
        assert_eq!(hex, format!("{}{}", expected_approve_prefix(), hash));
    }
}
