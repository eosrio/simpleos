use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("Wallet is locked")]
    WalletLocked,

    #[error("Invalid passphrase")]
    InvalidPassphrase,

    #[error("Key not found: {0}")]
    KeyNotFound(String),

    #[error("Chain not found: {0}")]
    ChainNotFound(String),

    #[error("RPC error: {0}")]
    Rpc(String),

    /// HTTP response error from an RPC endpoint. The endpoint is reachable but
    /// rejected the request (e.g. 4xx/5xx with a JSON error body). Callers
    /// should propagate this without triggering failover.
    #[error("RPC response error: {0}")]
    RpcResponse(String),

    #[error("Signing error: {0}")]
    Signing(String),

    #[error("Keyring error: {0}")]
    Keyring(String),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("Encryption error: {0}")]
    Encryption(String),

    #[error("Ledger error: {0}")]
    Ledger(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
