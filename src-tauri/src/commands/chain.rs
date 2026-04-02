use crate::antelope::rpc::RpcClient;
use crate::antelope::types::*;
use crate::error::Error;

/// Get chain info from an RPC endpoint.
#[tauri::command]
pub fn get_chain_info(endpoint: String) -> Result<ChainInfo, Error> {
    let client = RpcClient::new(&endpoint);
    client.get_info()
}

/// Get account details.
#[tauri::command]
pub fn get_account(endpoint: String, account_name: String) -> Result<AccountInfo, Error> {
    let client = RpcClient::new(&endpoint);
    client.get_account(&account_name)
}

/// Get token balance for an account.
#[tauri::command]
pub fn get_balances(
    endpoint: String,
    account: String,
    code: String,
    symbol: String,
) -> Result<Vec<String>, Error> {
    let client = RpcClient::new(&endpoint);
    client.get_currency_balance(&code, &account, &symbol)
}

/// Get table rows from a smart contract.
#[tauri::command]
pub fn get_table_rows(endpoint: String, params: TableRowsParams) -> Result<TableRowsResult, Error> {
    let client = RpcClient::new(&endpoint);
    client.get_table_rows(&params)
}

/// Get producers list.
#[tauri::command]
pub fn get_producers(endpoint: String, limit: u32) -> Result<serde_json::Value, Error> {
    let client = RpcClient::new(&endpoint);
    client.get_producers(limit, "")
}

/// Get actions history from Hyperion.
#[tauri::command]
pub fn get_actions_history(
    hyperion_url: String,
    account: String,
    limit: u32,
    skip: u32,
) -> Result<serde_json::Value, Error> {
    let client = RpcClient::new("");
    client.hyperion_get_actions(&hyperion_url, &account, limit, skip)
}

/// Get token list from Hyperion.
#[tauri::command]
pub fn get_tokens(hyperion_url: String, account: String) -> Result<serde_json::Value, Error> {
    let client = RpcClient::new("");
    client.hyperion_get_tokens(&hyperion_url, &account)
}

/// Lookup accounts associated with a public key.
#[tauri::command]
pub fn lookup_key_accounts(endpoint: String, public_key: String) -> Result<KeyAccountsResult, Error> {
    let client = RpcClient::new(&endpoint);
    client.get_key_accounts(&public_key)
}

/// Check endpoint health by calling get_info and verifying chain_id matches.
#[tauri::command]
pub fn check_endpoint_health(endpoint: String, expected_chain_id: String) -> Result<bool, Error> {
    let client = RpcClient::new(&endpoint);
    match client.get_info() {
        Ok(info) => Ok(info.chain_id == expected_chain_id),
        Err(_) => Ok(false),
    }
}
