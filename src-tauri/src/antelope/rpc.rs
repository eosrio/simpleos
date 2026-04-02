use crate::antelope::types::*;
use crate::error::Error;

/// Minimal Antelope RPC client using ureq (sync HTTP).
pub struct RpcClient {
    endpoint: String,
}

impl RpcClient {
    pub fn new(endpoint: &str) -> Self {
        Self {
            endpoint: endpoint.trim_end_matches('/').to_string(),
        }
    }

    pub fn set_endpoint(&mut self, endpoint: &str) {
        self.endpoint = endpoint.trim_end_matches('/').to_string();
    }

    /// POST to an API endpoint and parse the JSON response.
    fn post<T: serde::de::DeserializeOwned>(&self, path: &str, body: &serde_json::Value) -> Result<T, Error> {
        let url = format!("{}{}", self.endpoint, path);
        let response = ureq::post(&url)
            .send_json(body)
            .map_err(|e| Error::Rpc(format!("{}: {}", url, e)))?;

        response
            .into_json::<T>()
            .map_err(|e| Error::Rpc(format!("Parse error: {}", e)))
    }

    /// GET from an API endpoint and parse the JSON response.
    fn get<T: serde::de::DeserializeOwned>(&self, url: &str) -> Result<T, Error> {
        let response = ureq::get(url)
            .call()
            .map_err(|e| Error::Rpc(format!("{}: {}", url, e)))?;

        response
            .into_json::<T>()
            .map_err(|e| Error::Rpc(format!("Parse error: {}", e)))
    }

    // ── Chain API ──

    pub fn get_info(&self) -> Result<ChainInfo, Error> {
        self.post("/v1/chain/get_info", &serde_json::json!({}))
    }

    pub fn get_account(&self, account_name: &str) -> Result<AccountInfo, Error> {
        self.post(
            "/v1/chain/get_account",
            &serde_json::json!({ "account_name": account_name }),
        )
    }

    pub fn get_currency_balance(&self, code: &str, account: &str, symbol: &str) -> Result<Vec<String>, Error> {
        self.post(
            "/v1/chain/get_currency_balance",
            &serde_json::json!({
                "code": code,
                "account": account,
                "symbol": symbol,
            }),
        )
    }

    pub fn get_table_rows(&self, params: &TableRowsParams) -> Result<TableRowsResult, Error> {
        self.post(
            "/v1/chain/get_table_rows",
            &serde_json::to_value(params).map_err(|e| Error::Serialization(e.to_string()))?,
        )
    }

    pub fn get_abi(&self, account_name: &str) -> Result<serde_json::Value, Error> {
        self.post(
            "/v1/chain/get_abi",
            &serde_json::json!({ "account_name": account_name }),
        )
    }

    pub fn get_producers(&self, limit: u32, lower_bound: &str) -> Result<serde_json::Value, Error> {
        self.post(
            "/v1/chain/get_producers",
            &serde_json::json!({
                "limit": limit,
                "lower_bound": lower_bound,
                "json": true,
            }),
        )
    }

    pub fn push_transaction(&self, packed: &serde_json::Value) -> Result<TxResult, Error> {
        self.post("/v1/chain/push_transaction", packed)
    }

    pub fn get_key_accounts(&self, public_key: &str) -> Result<KeyAccountsResult, Error> {
        self.post(
            "/v1/history/get_key_accounts",
            &serde_json::json!({ "public_key": public_key }),
        )
    }

    // ── Hyperion API ──

    pub fn hyperion_get_tokens(&self, hyperion_url: &str, account: &str) -> Result<serde_json::Value, Error> {
        let url = format!("{}/v2/state/get_tokens?account={}", hyperion_url.trim_end_matches('/'), account);
        self.get(&url)
    }

    pub fn hyperion_get_actions(
        &self,
        hyperion_url: &str,
        account: &str,
        limit: u32,
        skip: u32,
    ) -> Result<serde_json::Value, Error> {
        let url = format!(
            "{}/v2/history/get_actions?account={}&limit={}&skip={}",
            hyperion_url.trim_end_matches('/'),
            account,
            limit,
            skip,
        );
        self.get(&url)
    }
}
