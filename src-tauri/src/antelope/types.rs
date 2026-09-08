use serde::{Deserialize, Serialize};

/// An Antelope account name (up to 12 characters, base32 encoded as u64).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Name(pub String);

/// A token amount with symbol (e.g., "1.0000 EOS").
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asset {
    pub amount: String,
    pub symbol: String,
}

impl std::fmt::Display for Asset {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} {}", self.amount, self.symbol)
    }
}

/// Authorization for an action.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Authorization {
    pub actor: String,
    pub permission: String,
}

/// A single action in a transaction.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Action {
    pub account: String,
    pub name: String,
    pub authorization: Vec<Authorization>,
    pub data: serde_json::Value,
}

/// Chain info response from get_info.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainInfo {
    pub server_version: String,
    pub chain_id: String,
    pub head_block_num: u64,
    pub last_irreversible_block_num: u64,
    pub head_block_time: String,
    pub head_block_id: String,
    pub last_irreversible_block_id: String,
    #[serde(default)]
    pub server_version_string: Option<String>,
    // Savannah fast finality fields
    #[serde(default)]
    pub fork_db_head_block_num: Option<u64>,
    #[serde(default)]
    pub last_irreversible_block_time: Option<String>,
}

/// Account info response from get_account.
/// Note: some chains return numeric fields as strings, so we use a flexible deserializer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountInfo {
    pub account_name: String,
    #[serde(default)]
    pub core_liquid_balance: Option<String>,
    #[serde(default, deserialize_with = "deserialize_flexible_i64")]
    pub ram_quota: Option<i64>,
    #[serde(default, deserialize_with = "deserialize_flexible_i64")]
    pub ram_usage: Option<i64>,
    #[serde(default, deserialize_with = "deserialize_flexible_i64")]
    pub net_weight: Option<i64>,
    #[serde(default, deserialize_with = "deserialize_flexible_i64")]
    pub cpu_weight: Option<i64>,
    #[serde(default)]
    pub cpu_limit: Option<ResourceLimit>,
    #[serde(default)]
    pub net_limit: Option<ResourceLimit>,
    #[serde(default)]
    pub permissions: Vec<Permission>,
    #[serde(default)]
    pub voter_info: Option<serde_json::Value>,
    #[serde(default)]
    pub total_resources: Option<serde_json::Value>,
    #[serde(default)]
    pub self_delegated_bandwidth: Option<serde_json::Value>,
    #[serde(default)]
    pub refund_request: Option<serde_json::Value>,
}

/// Resource usage limits (CPU or NET) from get_account.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimit {
    #[serde(default, deserialize_with = "deserialize_flexible_i64")]
    pub used: Option<i64>,
    #[serde(default, deserialize_with = "deserialize_flexible_i64")]
    pub available: Option<i64>,
    #[serde(default, deserialize_with = "deserialize_flexible_i64")]
    pub max: Option<i64>,
}

/// Deserialize a value that may be either an i64 or a string containing an i64.
fn deserialize_flexible_i64<'de, D>(deserializer: D) -> Result<Option<i64>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de;

    struct FlexibleI64Visitor;

    impl<'de> de::Visitor<'de> for FlexibleI64Visitor {
        type Value = Option<i64>;

        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            formatter.write_str("an i64, a string containing an i64, or null")
        }

        fn visit_none<E: de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }

        fn visit_unit<E: de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }

        fn visit_i64<E: de::Error>(self, v: i64) -> Result<Self::Value, E> {
            Ok(Some(v))
        }

        fn visit_u64<E: de::Error>(self, v: u64) -> Result<Self::Value, E> {
            Ok(Some(v as i64))
        }

        fn visit_f64<E: de::Error>(self, v: f64) -> Result<Self::Value, E> {
            Ok(Some(v as i64))
        }

        fn visit_str<E: de::Error>(self, v: &str) -> Result<Self::Value, E> {
            if v.is_empty() {
                return Ok(None);
            }
            v.parse::<i64>().map(Some).map_err(de::Error::custom)
        }
    }

    deserializer.deserialize_any(FlexibleI64Visitor)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Permission {
    pub perm_name: String,
    pub parent: String,
    pub required_auth: serde_json::Value,
    /// Older nodes omit this field. Preserve that distinction for the UI.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub linked_actions: Option<Vec<LinkedAction>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkedAction {
    pub account: String,
    // nodeos omits action for a contract-wide link. Normalize absent/null to
    // the empty Antelope name, which the UI already displays as "All actions".
    #[serde(default, deserialize_with = "deserialize_link_action")]
    pub action: String,
}

fn deserialize_link_action<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    Ok(Option::<String>::deserialize(deserializer)?.unwrap_or_default())
}

/// Parameters for get_table_rows.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableRowsParams {
    pub chain_id: String,
    pub code: String,
    pub table: String,
    pub scope: String,
    #[serde(default)]
    pub lower_bound: Option<String>,
    #[serde(default)]
    pub upper_bound: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: u32,
    #[serde(default = "default_true")]
    pub json: bool,
    #[serde(default)]
    pub key_type: Option<String>,
    #[serde(default)]
    pub index_position: Option<String>,
}

fn default_limit() -> u32 {
    10
}
fn default_true() -> bool {
    true
}

/// Result from get_table_rows.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableRowsResult {
    pub rows: Vec<serde_json::Value>,
    pub more: bool,
    #[serde(default)]
    pub next_key: Option<String>,
}

/// Transaction result after push_transaction.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TxResult {
    pub transaction_id: String,
    #[serde(default)]
    pub block_num: Option<u64>,
    #[serde(default)]
    pub block_time: Option<String>,
}

/// Producer info from get_producers.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProducerInfo {
    pub owner: String,
    #[serde(default)]
    pub total_votes: Option<String>,
    #[serde(default)]
    pub producer_key: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub is_active: Option<u8>,
}

/// An account + permission discovered via key lookup.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountAuthority {
    pub account_name: String,
    pub permission_name: String,
}

/// Result from key accounts lookup.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyAccountsResult {
    pub account_names: Vec<String>,
    /// Detailed authority info (account + permission). Populated when available.
    #[serde(default)]
    pub authorities: Vec<AccountAuthority>,
}

/// Result for import operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub public_key: String,
    pub accounts: Vec<String>,
}

/// Result for key generation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyPairResult {
    pub wif: String,
    pub public_key: String,
}

#[cfg(test)]
mod permission_link_tests {
    use super::AccountInfo;
    use serde_json::json;

    #[test]
    fn wax_account_with_contract_wide_link_loads_permissions() {
        let account: AccountInfo = serde_json::from_str(include_str!(
            "../../../tests/fixtures/wax-eosriobrazil-account.json"
        )).expect("WAX account response must load permissions, including links without action");
        let output = serde_json::to_value(account).unwrap();
        let teleport = output["permissions"].as_array().unwrap().iter()
            .find(|p| p["perm_name"] == "teleport").unwrap();
        assert!(teleport["linked_actions"].as_array().unwrap().iter().any(|link|
            link["account"] == "other.worlds" && link["action"] == ""));
    }

    #[test]
    fn omitted_link_action_is_normalized_to_contract_wide() {
        let account: AccountInfo = serde_json::from_value(json!({
            "account_name": "alice", "permissions": [{
                "perm_name": "custom", "parent": "active", "required_auth": {},
                "linked_actions": [{"account": "other.worlds"}]
            }]
        })).expect("missing action on a contract-wide link is valid");
        assert_eq!(serde_json::to_value(account).unwrap()["permissions"][0]["linked_actions"][0],
            json!({"account":"other.worlds", "action":""}));
    }

    #[test]
    fn null_and_empty_link_actions_are_contract_wide_but_malformed_values_fail() {
        for action in [json!(null), json!("")] {
            let link: super::LinkedAction = serde_json::from_value(json!({
                "account": "other.worlds", "action": action
            })).unwrap();
            assert_eq!(link.action, "");
        }
        assert!(serde_json::from_value::<super::LinkedAction>(json!({
            "account": "other.worlds", "action": 42
        })).is_err());
        assert!(serde_json::from_value::<super::LinkedAction>(json!({"action":"transfer"})).is_err());
    }

    #[tokio::test]
    #[ignore = "Read-only WAX RPC acceptance check; requires network"]
    async fn live_wax_account_permissions_parse() {
        let account: AccountInfo = reqwest::Client::new()
            .post("https://wax.eosrio.io/v1/chain/get_account")
            .timeout(std::time::Duration::from_secs(20))
            .json(&json!({"account_name":"eosriobrazil"}))
            .send().await.unwrap().error_for_status().unwrap()
            .json().await.expect("live WAX get_account must parse with the application's AccountInfo type");
        assert_eq!(account.account_name, "eosriobrazil");
        assert!(account.permissions.iter().any(|p| p.perm_name == "active"));
        assert!(account.permissions.iter().any(|p| p.perm_name == "claim2"));
    }

    #[test]
    fn account_response_preserves_permission_links_through_ipc() {
        let value = json!({ "account_name": "eosriobrazil", "permissions": [{
            "perm_name": "claim2", "parent": "active", "required_auth": {"threshold": 1},
            "linked_actions": [{"account": "eosio", "action": "claimstandby"}]
        }] });
        let account: AccountInfo = serde_json::from_value(value).unwrap();
        let output = serde_json::to_value(account).unwrap();
        assert_eq!(output["permissions"][0]["linked_actions"][0],
            json!({"account": "eosio", "action": "claimstandby"}));
    }

    #[test]
    fn old_nodes_do_not_become_false_empty_link_lists() {
        let account: AccountInfo = serde_json::from_value(json!({
            "account_name": "alice", "permissions": [{
                "perm_name": "active", "parent": "owner", "required_auth": {}
            }]
        })).unwrap();
        assert!(account.permissions[0].linked_actions.is_none());
        assert!(serde_json::to_value(account).unwrap()["permissions"][0].get("linked_actions").is_none());
    }
}
