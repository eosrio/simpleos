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
    /// Primary system token contract (default: "eosio.token").
    #[serde(default = "default_token_contract")]
    pub token_contract: String,
    /// Additional token contracts to query for balance display.
    /// Each entry: { contract, symbol, precision }.
    #[serde(default)]
    pub extra_tokens: Vec<TokenConfig>,
    pub endpoints: Vec<Endpoint>,
    #[serde(default)]
    pub hyperion_apis: Vec<String>,
    #[serde(default)]
    pub explorers: Vec<Explorer>,
    #[serde(default)]
    pub features: ChainFeatures,
    /// Whether this is a testnet chain.
    #[serde(default)]
    pub testnet: bool,
}

/// A token to query beyond the system token.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenConfig {
    pub contract: String,
    pub symbol: String,
    pub precision: u8,
}

fn default_token_contract() -> String {
    "eosio.token".to_string()
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
            symbol: "A".into(),
            precision: 4,
            icon: None,
            token_contract: "core.vaulta".into(),
            extra_tokens: vec![
                TokenConfig { contract: "eosio.token".into(), symbol: "EOS".into(), precision: 4 },
            ],
            endpoints: vec![
                Endpoint { url: "https://eos.greymass.com".into(), owner: Some("Greymass".into()) },
                Endpoint { url: "https://api.eossweden.org".into(), owner: Some("EOS Sweden".into()) },
                Endpoint { url: "https://api.eosrio.io".into(), owner: Some("EOS Rio".into()) },
                Endpoint { url: "https://eos.api.eosnation.io".into(), owner: Some("EOS Nation".into()) },
                Endpoint { url: "https://eos.eosphere.io".into(), owner: Some("EOSphere".into()) },
            ],
            hyperion_apis: vec![
                "https://eos.hyperion.eosrio.io".into(),
                "https://eos.eosphere.io".into(),
            ],
            explorers: vec![
                Explorer {
                    name: "EOSscan".into(),
                    url: "https://eosscan.io".into(),
                    tx_url: Some("https://eosscan.io/tx/{txid}".into()),
                    account_url: Some("https://eosscan.io/account/{account}".into()),
                },
                Explorer {
                    name: "Unicove".into(),
                    url: "https://unicove.com/en/vaulta".into(),
                    tx_url: Some("https://unicove.com/en/vaulta/transaction/{txid}".into()),
                    account_url: Some("https://unicove.com/en/vaulta/account/{account}".into()),
                },
                Explorer {
                    name: "EOS Authority".into(),
                    url: "https://eosauthority.com".into(),
                    tx_url: Some("https://eosauthority.com/transaction/{txid}?network=eos".into()),
                    account_url: Some("https://eosauthority.com/account/{account}?network=eos".into()),
                },
            ],
            features: ChainFeatures {
                send: true, vote: true, staking: true, rex: true,
                powerup: true, resource: true, dapps: true, history: true,
            },
            testnet: false,
        },
        ChainConfig {
            id: "1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4".into(),
            name: "WAX".into(),
            symbol: "WAX".into(),
            precision: 8,
            icon: None,
            token_contract: default_token_contract(),
            extra_tokens: vec![],
            endpoints: vec![
                Endpoint { url: "https://wax.greymass.com".into(), owner: Some("Greymass".into()) },
                Endpoint { url: "https://api.waxsweden.org".into(), owner: Some("WAX Sweden".into()) },
                Endpoint { url: "https://wax.eosphere.io".into(), owner: Some("EOSphere".into()) },
                Endpoint { url: "https://wax.api.eosnation.io".into(), owner: Some("EOS Nation".into()) },
            ],
            hyperion_apis: vec![
                "https://api.waxsweden.org".into(),
                "https://wax.eosphere.io".into(),
            ],
            explorers: vec![
                Explorer {
                    name: "WaxBlock".into(),
                    url: "https://waxblock.io".into(),
                    tx_url: Some("https://waxblock.io/transaction/{txid}".into()),
                    account_url: Some("https://waxblock.io/account/{account}".into()),
                },
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
            testnet: false,
        },
        ChainConfig {
            id: "4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11".into(),
            name: "Telos".into(),
            symbol: "TLOS".into(),
            precision: 4,
            icon: None,
            token_contract: default_token_contract(),
            extra_tokens: vec![],
            endpoints: vec![
                Endpoint { url: "https://telos.greymass.com".into(), owner: Some("Greymass".into()) },
                Endpoint { url: "https://mainnet.telos.net".into(), owner: Some("Telos Foundation".into()) },
                Endpoint { url: "https://telos.eosphere.io".into(), owner: Some("EOSphere".into()) },
                Endpoint { url: "https://telos.api.eosnation.io".into(), owner: Some("EOS Nation".into()) },
            ],
            hyperion_apis: vec![
                "https://mainnet.telos.net".into(),
                "https://telos.eosphere.io".into(),
            ],
            explorers: vec![
                Explorer {
                    name: "Telos Explorer".into(),
                    url: "https://explorer.telos.net".into(),
                    tx_url: Some("https://explorer.telos.net/transaction/{txid}".into()),
                    account_url: Some("https://explorer.telos.net/account/{account}".into()),
                },
                Explorer {
                    name: "EOS Authority".into(),
                    url: "https://telos.eosauthority.com".into(),
                    tx_url: Some("https://telos.eosauthority.com/transaction/{txid}?network=telos".into()),
                    account_url: Some("https://telos.eosauthority.com/account/{account}?network=telos".into()),
                },
            ],
            features: ChainFeatures::default(),
            testnet: false,
        },
        ChainConfig {
            id: "a9c481dfbc7d9506dc7e87e9a137c931b0a9303f64fd7a1d08b8230133920097".into(),
            name: "Ultra".into(),
            symbol: "UOS".into(),
            precision: 4,
            icon: None,
            token_contract: default_token_contract(),
            extra_tokens: vec![],
            endpoints: vec![
                Endpoint { url: "https://ultra.eosrio.io".into(), owner: Some("EOS Rio".into()) },
                Endpoint { url: "https://api.mainnet.ultra.io".into(), owner: Some("Ultra".into()) },
            ],
            hyperion_apis: vec![],
            explorers: vec![
                Explorer {
                    name: "Ultra Explorer".into(),
                    url: "https://explorer.mainnet.ultra.io".into(),
                    tx_url: Some("https://explorer.mainnet.ultra.io/tx/{txid}".into()),
                    account_url: Some("https://explorer.mainnet.ultra.io/account/{account}".into()),
                },
            ],
            features: ChainFeatures {
                send: true, vote: true, staking: true, rex: false,
                powerup: false, resource: true, dapps: false, history: true,
            },
            testnet: false,
        },
        ChainConfig {
            id: "21dcae42c0182200e93f954a074011f9048a7624c6fe81d3c9541a614a009a60".into(),
            name: "FIO".into(),
            symbol: "FIO".into(),
            precision: 9,
            icon: None,
            token_contract: "fio.token".into(),
            extra_tokens: vec![],
            endpoints: vec![
                Endpoint { url: "https://fio.greymass.com".into(), owner: Some("Greymass".into()) },
                Endpoint { url: "https://fio.eosphere.io".into(), owner: Some("EOSphere".into()) },
                Endpoint { url: "https://fio.api.eosnation.io".into(), owner: Some("EOS Nation".into()) },
            ],
            hyperion_apis: vec![
                "https://fio.eosphere.io".into(),
            ],
            explorers: vec![
                Explorer {
                    name: "FIO Explorer".into(),
                    url: "https://fio.bloks.io".into(),
                    tx_url: Some("https://fio.bloks.io/transaction/{txid}".into()),
                    account_url: Some("https://fio.bloks.io/account/{account}".into()),
                },
            ],
            features: ChainFeatures {
                send: true, vote: true, staking: false, rex: false,
                powerup: false, resource: false, dapps: false, history: true,
            },
            testnet: false,
        },
        ChainConfig {
            id: "38b1d7815474d0c60c65a0f23d12e1fc64b8b8d42d0f754b3afe3044e4050eb1".into(),
            name: "Libre".into(),
            symbol: "LIBRE".into(),
            precision: 4,
            icon: None,
            token_contract: default_token_contract(),
            extra_tokens: vec![],
            endpoints: vec![
                Endpoint { url: "https://libre.greymass.com".into(), owner: Some("Greymass".into()) },
                Endpoint { url: "https://libre-api.edenia.cloud".into(), owner: Some("Edenia".into()) },
                Endpoint { url: "https://libre.eosphere.io".into(), owner: Some("EOSphere".into()) },
            ],
            hyperion_apis: vec![
                "https://libre.eosphere.io".into(),
            ],
            explorers: vec![
                Explorer {
                    name: "Libre Blocks".into(),
                    url: "https://www.libreblocks.io".into(),
                    tx_url: Some("https://www.libreblocks.io/tx/{txid}".into()),
                    account_url: Some("https://www.libreblocks.io/address/{account}".into()),
                },
            ],
            features: ChainFeatures {
                send: true, vote: true, staking: true, rex: false,
                powerup: false, resource: true, dapps: false, history: true,
            },
            testnet: false,
        },
        ChainConfig {
            id: "384da888112027f0321850a169f737c33e53b388aad48b5adace4bab97f437e0".into(),
            name: "XPR".into(),
            symbol: "XPR".into(),
            precision: 4,
            icon: None,
            token_contract: default_token_contract(),
            extra_tokens: vec![],
            endpoints: vec![
                Endpoint { url: "https://proton.greymass.com".into(), owner: Some("Greymass".into()) },
                Endpoint { url: "https://xpr.api.eosnation.io".into(), owner: Some("EOS Nation".into()) },
                Endpoint { url: "https://proton.eosphere.io".into(), owner: Some("EOSphere".into()) },
            ],
            hyperion_apis: vec![
                "https://proton.eosphere.io".into(),
            ],
            explorers: vec![
                Explorer {
                    name: "XPR Explorer".into(),
                    url: "https://explorer.xprnetwork.org".into(),
                    tx_url: Some("https://explorer.xprnetwork.org/transaction/{txid}".into()),
                    account_url: Some("https://explorer.xprnetwork.org/account/{account}".into()),
                },
            ],
            features: ChainFeatures {
                send: true, vote: true, staking: true, rex: false,
                powerup: false, resource: true, dapps: false, history: true,
            },
            testnet: false,
        },
    ]
}

/// Build testnet chain configurations.
pub fn default_testnets() -> Vec<ChainConfig> {
    vec![
        // ── Jungle 4 Testnet (EOS/Vaulta testnet) ──
        ChainConfig {
            id: "73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d".into(),
            name: "Jungle Testnet".into(),
            symbol: "EOS".into(),
            precision: 4,
            icon: None,
            token_contract: default_token_contract(),
            extra_tokens: vec![],
            endpoints: vec![
                Endpoint { url: "https://jungle4.cryptolions.io".into(), owner: Some("CryptoLions".into()) },
                Endpoint { url: "https://jungle4.api.eosnation.io".into(), owner: Some("EOS Nation".into()) },
                Endpoint { url: "https://jungle4.eosphere.io".into(), owner: Some("EOSphere".into()) },
            ],
            hyperion_apis: vec![
                "https://jungle4.cryptolions.io".into(),
            ],
            explorers: vec![
                Explorer {
                    name: "Jungle Bloks".into(),
                    url: "https://jungle.bloks.io".into(),
                    tx_url: Some("https://jungle.bloks.io/transaction/{txid}".into()),
                    account_url: Some("https://jungle.bloks.io/account/{account}".into()),
                },
            ],
            features: ChainFeatures {
                send: true, vote: true, staking: true, rex: true,
                powerup: true, resource: true, dapps: false, history: true,
            },
            testnet: true,
        },
        // ── WAX Testnet ──
        ChainConfig {
            id: "f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12".into(),
            name: "WAX Testnet".into(),
            symbol: "WAX".into(),
            precision: 8,
            icon: None,
            token_contract: default_token_contract(),
            extra_tokens: vec![],
            endpoints: vec![
                Endpoint { url: "https://testnet.waxsweden.org".into(), owner: Some("WAX Sweden".into()) },
                Endpoint { url: "https://testnet.wax.pink.gg".into(), owner: Some("Pink.gg".into()) },
                Endpoint { url: "https://wax-testnet.eosphere.io".into(), owner: Some("EOSphere".into()) },
            ],
            hyperion_apis: vec![
                "https://testnet.waxsweden.org".into(),
            ],
            explorers: vec![
                Explorer {
                    name: "WaxBlock Testnet".into(),
                    url: "https://testnet.waxblock.io".into(),
                    tx_url: Some("https://testnet.waxblock.io/transaction/{txid}".into()),
                    account_url: Some("https://testnet.waxblock.io/account/{account}".into()),
                },
            ],
            features: ChainFeatures {
                send: true, vote: true, staking: true, rex: false,
                powerup: true, resource: true, dapps: false, history: true,
            },
            testnet: true,
        },
        // ── Telos Testnet ──
        ChainConfig {
            id: "1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f".into(),
            name: "Telos Testnet".into(),
            symbol: "TLOS".into(),
            precision: 4,
            icon: None,
            token_contract: default_token_contract(),
            extra_tokens: vec![],
            endpoints: vec![
                Endpoint { url: "https://testnet.telos.caleos.io".into(), owner: Some("Caleos".into()) },
                Endpoint { url: "https://telos-testnet.eosphere.io".into(), owner: Some("EOSphere".into()) },
                Endpoint { url: "https://telostest.api.eosnation.io".into(), owner: Some("EOS Nation".into()) },
            ],
            hyperion_apis: vec![
                "https://testnet.telos.caleos.io".into(),
            ],
            explorers: vec![
                Explorer {
                    name: "Telos Testnet Explorer".into(),
                    url: "https://explorer-test.telos.net".into(),
                    tx_url: Some("https://explorer-test.telos.net/transaction/{txid}".into()),
                    account_url: Some("https://explorer-test.telos.net/account/{account}".into()),
                },
            ],
            features: ChainFeatures::default(),
            testnet: true,
        },
        // ── Ultra Testnet ──
        ChainConfig {
            id: "7fc56be645bb76ab9d747b53089f132dcb7681db06f0852cfa03eaf6f7ac80e9".into(),
            name: "Ultra Testnet".into(),
            symbol: "UOS".into(),
            precision: 4,
            icon: None,
            token_contract: default_token_contract(),
            extra_tokens: vec![],
            endpoints: vec![
                Endpoint { url: "https://testnet.ultra.eosrio.io".into(), owner: Some("EOS Rio".into()) },
                Endpoint { url: "https://ultra-testnet.eosphere.io".into(), owner: Some("EOSphere".into()) },
            ],
            hyperion_apis: vec![],
            explorers: vec![
                Explorer {
                    name: "Ultra Testnet Explorer".into(),
                    url: "https://explorer.testnet.ultra.io".into(),
                    tx_url: Some("https://explorer.testnet.ultra.io/tx/{txid}".into()),
                    account_url: Some("https://explorer.testnet.ultra.io/account/{account}".into()),
                },
            ],
            features: ChainFeatures {
                send: true, vote: true, staking: true, rex: false,
                powerup: false, resource: true, dapps: false, history: false,
            },
            testnet: true,
        },
        // ── FIO Testnet ──
        ChainConfig {
            id: "b20901380af44ef59c5918439a1f9a41d83669020319a80574b804a5f95cbd7e".into(),
            name: "FIO Testnet".into(),
            symbol: "FIO".into(),
            precision: 9,
            icon: None,
            token_contract: "fio.token".into(),
            extra_tokens: vec![],
            endpoints: vec![
                Endpoint { url: "https://testnet.fioprotocol.io".into(), owner: Some("FIO Protocol".into()) },
            ],
            hyperion_apis: vec![],
            explorers: vec![
                Explorer {
                    name: "FIO Test Bloks".into(),
                    url: "https://fio-test.bloks.io".into(),
                    tx_url: Some("https://fio-test.bloks.io/transaction/{txid}".into()),
                    account_url: Some("https://fio-test.bloks.io/account/{account}".into()),
                },
            ],
            features: ChainFeatures {
                send: true, vote: true, staking: false, rex: false,
                powerup: false, resource: false, dapps: false, history: false,
            },
            testnet: true,
        },
        // ── XPR Testnet ──
        ChainConfig {
            id: "71ee83bcf52142d61019d95f9cc5427ba6a0d7ff8accd9e2088ae2abeaf3d3dd".into(),
            name: "XPR Testnet".into(),
            symbol: "XPR".into(),
            precision: 4,
            icon: None,
            token_contract: default_token_contract(),
            extra_tokens: vec![],
            endpoints: vec![
                Endpoint { url: "https://test.proton.eosusa.io".into(), owner: Some("EOS USA".into()) },
                Endpoint { url: "https://proton-testnet.cryptolions.io".into(), owner: Some("CryptoLions".into()) },
            ],
            hyperion_apis: vec![],
            explorers: vec![
                Explorer {
                    name: "XPR Testnet Explorer".into(),
                    url: "https://testnet.explorer.xprnetwork.org".into(),
                    tx_url: Some("https://testnet.explorer.xprnetwork.org/transaction/{txid}".into()),
                    account_url: Some("https://testnet.explorer.xprnetwork.org/account/{account}".into()),
                },
            ],
            features: ChainFeatures {
                send: true, vote: true, staking: true, rex: false,
                powerup: false, resource: true, dapps: false, history: false,
            },
            testnet: true,
        },
    ]
}
