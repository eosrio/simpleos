use serde::{Deserialize, Serialize};

/// Configuration for a single Antelope chain.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainConfig {
    pub id: String,
    pub name: String,
    pub symbol: String,
    pub precision: u8,
    #[serde(default)]
    pub icon: Option<String>,
    pub endpoints: Vec<Endpoint>,
    #[serde(default)]
    pub hyperion_apis: Vec<String>,
    #[serde(default)]
    pub explorers: Vec<Explorer>,
    #[serde(default)]
    pub features: ChainFeatures,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Endpoint {
    pub url: String,
    #[serde(default)]
    pub owner: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Explorer {
    pub name: String,
    pub url: String,
    #[serde(default)]
    pub tx_url: Option<String>,
    #[serde(default)]
    pub account_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChainFeatures {
    #[serde(default = "default_true")]
    pub send: bool,
    #[serde(default = "default_true")]
    pub vote: bool,
    #[serde(default = "default_true")]
    pub staking: bool,
    #[serde(default)]
    pub rex: bool,
    #[serde(default)]
    pub powerup: bool,
    #[serde(default = "default_true")]
    pub resource: bool,
    #[serde(default)]
    pub dapps: bool,
    #[serde(default = "default_true")]
    pub history: bool,
}

fn default_true() -> bool {
    true
}

/// Build the default chain configurations for priority chains.
pub fn default_chains() -> Vec<ChainConfig> {
    vec![
        ChainConfig {
            id: "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906".into(),
            name: "Vaulta".into(),
            symbol: "EOS".into(),
            precision: 4,
            icon: None,
            endpoints: vec![
                Endpoint { url: "https://eos.greymass.com".into(), owner: Some("Greymass".into()) },
                Endpoint { url: "https://api.eossweden.org".into(), owner: Some("EOS Sweden".into()) },
            ],
            hyperion_apis: vec![
                "https://eos.hyperion.eosrio.io".into(),
            ],
            explorers: vec![
                Explorer {
                    name: "Bloks.io".into(),
                    url: "https://bloks.io".into(),
                    tx_url: Some("https://bloks.io/transaction/{txid}".into()),
                    account_url: Some("https://bloks.io/account/{account}".into()),
                },
            ],
            features: ChainFeatures {
                send: true, vote: true, staking: true, rex: true,
                powerup: true, resource: true, dapps: true, history: true,
            },
        },
        ChainConfig {
            id: "1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4".into(),
            name: "WAX".into(),
            symbol: "WAX".into(),
            precision: 8,
            icon: None,
            endpoints: vec![
                Endpoint { url: "https://wax.greymass.com".into(), owner: Some("Greymass".into()) },
            ],
            hyperion_apis: vec![],
            explorers: vec![
                Explorer {
                    name: "Bloks.io".into(),
                    url: "https://wax.bloks.io".into(),
                    tx_url: Some("https://wax.bloks.io/transaction/{txid}".into()),
                    account_url: Some("https://wax.bloks.io/account/{account}".into()),
                },
            ],
            features: ChainFeatures {
                send: true, vote: true, staking: true, rex: false,
                powerup: true, resource: true, dapps: true, history: true,
            },
        },
        ChainConfig {
            id: "4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11".into(),
            name: "Telos".into(),
            symbol: "TLOS".into(),
            precision: 4,
            icon: None,
            endpoints: vec![
                Endpoint { url: "https://telos.greymass.com".into(), owner: Some("Greymass".into()) },
            ],
            hyperion_apis: vec![],
            explorers: vec![],
            features: ChainFeatures::default(),
        },
        // Ultra, FIO, Libre, XPR — TODO: add chain IDs and endpoints
    ]
}
