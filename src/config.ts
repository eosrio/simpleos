export const localConfig = {
    chains: [
        {
            id: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
            symbol: 'EOS',
            icon: 'eos.png',
            precision: 4,
            name: 'EOS MAINNET',
            network: 'MAINNET',
            firstApi: 'https://api.eosrio.io',
            historyApi: 'https://eos.hyperion.eosrio.io/v2',
            hyperionApis: [
                'https://eos.hyperion.eosrio.io/v2',
                'https://api.eossweden.org/v2'
            ],
            forumTally: 'https://s3.amazonaws.com/api.eosvotes.io/eosvotes/tallies/latest.json',
            eosrioBP: 'eosriobrazil',
            proxyRegistry: 'regproxyinfo',
            lastNode: '',
            logoSrc: '',
            backdrop: '',
            features: {
                history: true,
                send: true,
                resource: true,
                vote: true,
                staking: true,
                dapps: true,
                addAcc: true,
                newAcc: true,
                forum: true,
                rex: true
            },
            borrow: {
                endpoint: 'https://eos.hyperion.eosrio.io/v2',
                enable: true,
                margin: 2,
                default_us: 3000
            },
            relay: {
                enable: true,
                endpoint: 'https://eos.relay.eosrio.io',
                usageCpuLimit: 2500,
                defaultCredits: 5
            },
            powerup: {
                minCpuFrac: 10000000,
                minNetFrac: 500000,
                maxPowerUpSlider: 0.1,
                daysToRefresh: 2
            },
            system: [
                'eosio',
                'eosio.token',
                'eosio.msig',
                'eosio.forum'
            ],
            endpoints: [
                {
                    url: 'https://api.eosrio.io',
                    owner: 'EOS Rio',
                    latency: 0
                },
                {
                    url: 'https://api.eossweden.org',
                    owner: 'sw/eden',
                    latency: 0
                },
                {
                    url: 'https://eos.greymass.com',
                    owner: 'Greymass',
                    latency: 0
                },
                {
                    url: 'https://nodes.get-scatter.com',
                    owner: 'Scatter',
                    latency: 0
                },
                {
                    url: 'https://api.main.alohaeos.com',
                    owner: 'Aloha EOS',
                    latency: 0
                },
                {
                    url: 'https://api.eoseoul.io',
                    owner: 'EOSeoul',
                    latency: 0
                },
                {
                    url: 'https://api.eosn.io',
                    owner: 'EOS Nation',
                    latency: 0
                },
                {
                    url: 'https://bp.cryptolions.io',
                    owner: 'CryptoLions',
                    latency: 0
                },
                {
                    url: 'https://eos.eosphere.io',
                    owner: 'EOSphere',
                    latency: 0
                }
            ],
            explorers: [
                {
                    name: 'Bloks.io',
                    account_url: 'https://bloks.io/account/',
                    tx_url: 'https://bloks.io/transaction/'
                },
                {
                    name: 'EOSX',
                    account_url: 'https://www.eosx.io/account/',
                    tx_url: 'https://www.eosx.io/tx/'
                },
                {
                    name: 'eosq',
                    account_url: 'https://eosq.app/account/',
                    tx_url: 'https://eosq.app/tx/'
                },
                {
                    name: 'EOS FLARE',
                    account_url: 'https://eosflare.io/account/',
                    tx_url: 'https://eosflare.io/tx/'
                },
                {
                    name: 'EOSPark',
                    account_url: 'https://eospark.com/account/',
                    tx_url: 'https://eospark.com/tx/'
                }
            ],
            exchanges: {
                bitfinexdep1: {
                    memo_size: 16,
                    pattern: '^[a-f0-9]+$'
                },
                krakenkraken: {
                    pattern: '^[0-9]+$'
                },
                binancecleos: {
                    memo_size: 9,
                    pattern: '^[0-9]+$'
                },
                huobideposit: {
                    pattern: '^[0-9]+$'
                },
                poloniexeos1: {
                    memo_size: 16,
                    pattern: '^[a-f0-9]+$'
                },
                gateiowallet: {
                    memo_size: 16,
                    pattern: '^[a-f0-9]+$'
                },
                chainceoneos: {
                    memo_size: 10,
                    pattern: '^[a-z]+$'
                },
                zbeoscharge1: {
                    memo_size: 18,
                    pattern: '^[0-9]+$'
                },
                okbtothemoon: {
                    pattern: '^[0-9]+$'
                },
                eosusrwallet: {
                    memo_size: 36,
                    pattern: '^[a-f0-9]{8}-([a-f0-9]{4}-){3}[a-f0-9]{12}$'
                }
            }
        },
        {
            id: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
            symbol: 'WAX',
            icon: 'wax.png',
            precision: 8,
            name: 'WAX MAINNET',
            network: 'MAINNET',
            firstApi: 'https://wax.eosrio.io',
            historyApi: 'https://wax.eosrio.io/v2',
            hyperionApis: [
                'https://wax.eosrio.io/v2',
                'https://api.waxsweden.org/v2',
                'https://wax.eosusa.news/v2',
                'https://api.wax.alohaeos.com/v2',
                'https://wax.eosphere.io/v2',
                'https://wax.pink.gg/v2',
                'https://api-wax.maltablock.org/v2',
                'https://api.blokcrafters.io/v2'
            ],
            forumTally: '',
            eosrioBP: 'eosriobrazil',
            proxyRegistry: 'regproxyinfo',
            lastNode: '',
            logoSrc: '',
            backdrop: '',
            features: {
                history: true,
                send: true,
                resource: true,
                vote: true,
                staking: true,
                dapps: true,
                addAcc: true,
                newAcc: true,
                forum: false,
                rex: false
            },
            borrow: {
                enable: false
            },
            relay: {
                enable: false
            },
            system: [
                'eosio',
                'eosio.token',
                'eosio.msig'
            ],
            endpoints: [
                {
                    url: 'https://wax.eosrio.io',
                    owner: 'EOS Rio - Wax',
                    latency: 0,
                    version: 'native'
                },
                {
                    url: 'https://wax.blockmatrix.network',
                    owner: 'Blockmatrix',
                    latency: 0,
                    version: 'native'
                },
                {
                    url: 'https://api.waxsweden.org',
                    owner: 'EOS Sweden - WAX',
                    latency: 0
                },
                {
                    url: 'https://api.wax.alohaeos.com',
                    owner: 'Alohaeos - WAX',
                    latency: 0
                },
                {
                    url: 'https://wax.eu.eosamsterdam.net',
                    owner: 'Eosamsterdam - WAX',
                    latency: 0
                },
                {
                    url: 'https://api.blokcrafters.io',
                    owner: 'Blokcrafters - WAX',
                    latency: 0
                },
                {
                    url: 'https://wax.greymass.com',
                    owner: 'Greymass - WAX',
                    latency: 0
                },
                {
                    url: 'https://wax.eos.barcelona',
                    owner: 'EOS Barcelona - WAX',
                    latency: 0
                },
                {
                    url: 'https://wax.eosdac.io',
                    owner: 'EOSDAC - WAX',
                    latency: 0
                },
                {
                    url: 'https://wax-api.eosiomadrid.io',
                    owner: 'EOSio Madrid - WAX',
                    latency: 0
                },
                {
                    url: 'https://api.wax.greeneosio.com',
                    owner: 'Greeneosio - WAX',
                    latency: 0
                }
            ],
            explorers: [
                {
                    name: 'Bloks.io',
                    account_url: 'https://wax.bloks.io/account/',
                    tx_url: 'https://wax.bloks.io/transaction/'
                }
            ]
        },
        {
            id: 'd5a3d18fbb3c084e3b1f3fa98c21014b5f3db536cc15d08f9f6479517c6a3d86',
            symbol: 'BOS',
            icon: 'bos.png',
            precision: 4,
            name: 'BOS MAINNET',
            network: 'MAINNET',
            firstApi: 'https://api.bos.eosrio.io',
            historyApi: 'https://api.bossweden.org/v2',
            hyperionApis: [
                'https://api.bossweden.org/v2',
                'https://bos.eosn.io/v2',
                'https://bos.eosusa.news/v2'
            ],
            forumTally: 'https://s3.amazonaws.com/bos.referendum/referendum/tallies/latest.json',
            eosrioBP: 'bosriobrasil',
            proxyRegistry: 'regproxyinfo',
            lastNode: '',
            logoSrc: '',
            backdrop: '',
            features: {
                history: true,
                send: true,
                resource: true,
                vote: true,
                staking: true,
                dapps: true,
                addAcc: true,
                newAcc: true,
                forum: true,
                rex: true
            },
            borrow: {
                enable: false
            },
            relay: {
                enable: false
            },
            system: [
                'eosio',
                'eosio.token',
                'eosio.msig',
                'eosio.forum'
            ],
            endpoints: [
                {
                    url: 'https://hapi.bos.eosrio.io',
                    owner: 'BOS Rio',
                    latency: 0
                },
                {
                    url: 'https://api.bos.eosrio.io',
                    owner: 'BOS Rio',
                    latency: 0
                },
                {
                    url: 'https://bos.eosargentina.io',
                    owner: 'EOS Argentina',
                    latency: 0
                },
                {
                    url: 'https://api.bossweden.org',
                    owner: 'BOS Sweden',
                    latency: 0
                },
                {
                    url: 'https://api.bos42.io',
                    owner: 'ESO42',
                    latency: 0
                },
                {
                    url: 'http://bos.eosio.sg:8888',
                    owner: 'EOS SG',
                    latency: 0
                },
                {
                    url: 'https://api-bos.oraclechain.io',
                    owner: 'Oracle Chain',
                    latency: 0
                }
            ],
            explorers: [
                {
                    name: 'EOSX',
                    account_url: 'https://bos.eosx.io/account/',
                    tx_url: 'https://bos.eosx.io/tx/'
                },
                {
                    name: 'Bloks.io',
                    account_url: 'https://bos.bloks.io/account/',
                    tx_url: 'https://bos.bloks.io/transaction/'
                }
            ]
        },
        {
            id: 'cfe6486a83bad4962f232d48003b1824ab5665c36778141034d75e57b956e422',
            symbol: 'MEETONE',
            precision: 4,
            icon: 'meetone.png',
            name: 'MEET.ONE MAINNET',
            network: 'MAINNET',
            firstApi: 'https://fullnode.meet.one',
            historyApi: 'https://meetone.hyperion.eosrio.io/v2',
            hyperionApis: [
                'https://api.meetsweden.org/v2'
            ],
            forumTally: '',
            eosrioBP: '',
            proxyRegistry: 'proxies.m',
            lastNode: '',
            logoSrc: '',
            backdrop: '',
            features: {
                history: true,
                send: true,
                resource: true,
                vote: true,
                staking: true,
                dapps: true,
                addAcc: true,
                newAcc: true,
                forum: false,
                rex: false
            },
            borrow: {
                enable: false
            },
            relay: {
                enable: false
            },
            system: [
                'eosio',
                'eosio.token',
                'eosio.msig'
            ],
            endpoints: [
                {
                    url: 'https://fullnode.meet.one',
                    owner: 'MEET.ONE',
                    latency: 0
                },
                {
                    url: 'https://api.meetone.eostribe.io',
                    owner: 'EOS TRIBE',
                    latency: 0
                },
                {
                    url: 'https://api.meetone.alohaeos.com',
                    owner: 'AlohaEOS',
                    latency: 0
                },
                {
                    url: 'https://meetone.eossweden.eu',
                    owner: 'EOS Sweden',
                    latency: 0
                }
            ],
            explorers: [
                {
                    name: 'EOSX',
                    account_url: 'https://meetone.eosx.io/account/',
                    tx_url: 'https://meetone.eosx.io/tx/'
                }
            ]
        },
        {
            id: '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11',
            symbol: 'TLOS',
            icon: 'telos.png',
            precision: 4,
            name: 'TELOS MAINNET',
            network: 'MAINNET',
            firstApi: 'https://api.tlos.goodblock.io',
            historyApi: 'https://telos.eosrio.io/v2',
            hyperionApis: [
                'https://mainnet.telosusa.io/v2',
                'https://telos.eosphere.io/v2',
                'https://api-telos-21zephyr.maltablock.org/v2'
            ],
            eosrioBP: 'eosriobrazil',
            proxyRegistry: 'tlsproxyinfo',
            lastNode: '',
            logoSrc: '',
            backdrop: '',
            features: {
                history: true,
                send: true,
                resource: true,
                vote: true,
                staking: true,
                dapps: true,
                addAcc: true,
                newAcc: true,
                forum: false,
                rex: true
            },
            borrow: {
                enable: false
            },
            relay: {
                enable: false
            },
            system: [
                'eosio',
                'eosio.token',
                'eosio.msig'
            ],
            endpoints: [
                {
                    url: 'https://telos.eosrio.io',
                    owner: 'EOS Rio',
                    latency: 0
                },
                {
                    url: 'https://api.eos.miami',
                    owner: 'Telos Miami',
                    latency: 0
                },
                {
                    url: 'https://api.tlos.goodblock.io',
                    owner: 'Telos Goodblock',
                    latency: 0
                },
                {
                    url: 'https://telos.caleos.io',
                    owner: 'Telos Caleos',
                    latency: 0
                }
            ],
            explorers: [
                {
                    name: 'Bloks.io',
                    account_url: 'https://telos.bloks.io/account/',
                    tx_url: 'https://telos.bloks.io/transaction/'
                },
                {
                    name: 'EOSX',
                    account_url: 'https://telos.eosx.io/account/',
                    tx_url: 'https://telos.eosx.io/tx/'
                }
            ]
        },
        {
            id: '43b9bfe83bea36d397ffa701f716dbeceda684648b5d99956acf5e3971fded3a',
            symbol: 'UOS',
            icon: 'uos.png',
            precision: 4,
            name: 'U°Community',
            network: 'MAINNET',
            firstApi: 'https://api.uos.network',
            historyApi: 'https://hapi.uos.network/v2',
            hyperionApis: [
                'https://hapi.uos.network/v2'
            ],
            forumTally: '',
            eosrioBP: 'uosriobrazil',
            proxyRegistry: '',
            lastNode: '',
            logoSrc: '',
            backdrop: '',
            features: {
                history: true,
                send: true,
                resource: true,
                vote: true,
                staking: true,
                dapps: true,
                addAcc: true,
                newAcc: true,
                forum: false,
                rex: false
            },
            borrow: {
                enable: false
            },
            relay: {
                enable: false
            },
            system: [
                'eosio',
                'eosio.token',
                'eosio.msig'
            ],
            endpoints: [
                {
                    url: 'https://api.uos.network',
                    owner: 'UOS',
                    latency: 0
                },
                {
                    url: 'https://history.uos.network',
                    owner: 'UOS',
                    latency: 0
                }
            ],
            explorers: []
        },
        {
            id: '73647cde120091e0a4b85bced2f3cfdb3041e266cbbe95cee59b73235a1b3b6f',
            symbol: 'WBI',
            icon: 'worbli.png',
            precision: 4,
            name: 'WORBLI MAINNET',
            network: 'MAINNET',
            firstApi: 'https://api.worbli.eosrio.io',
            historyApi: 'https://api.worblisweden.org/v2',
            hyperionApis: [
                'https://api.worblisweden.org/v2'
            ],
            forumTally: '',
            eosrioBP: '',
            proxyRegistry: '',
            lastNode: '',
            logoSrc: '',
            backdrop: '',
            features: {
                history: true,
                send: true,
                resource: true,
                vote: false,
                staking: true,
                dapps: true,
                addAcc: true,
                newAcc: false,
                forum: false,
                rex: false
            },
            borrow: {
                enable: false
            },
            relay: {
                enable: false
            },
            system: [
                'eosio',
                'eosio.token',
                'eosio.msig'
            ],
            endpoints: [
                {
                    url: 'https://api.worbli.eosrio.io',
                    owner: 'EOS Rio - Worbli',
                    latency: 0,
                    version: 'native'
                },
                {
                    url: 'https://api.worblisweden.org',
                    owner: 'EOS Sweden - Worbli',
                    latency: 0
                },
                {
                    url: 'https://api.worbli.eostribe.io',
                    owner: 'EOS Tribe - Worbli',
                    latency: 0,
                    version: 'elastic'
                }
            ],
            explorers: [
                {
                    name: 'EOSX',
                    account_url: 'https://worbli.eosx.io/account/',
                    tx_url: 'https://worbli.eosx.io/tx/'
                },
                {
                    name: 'Bloks.io',
                    account_url: 'https://worbli.bloks.io/account/',
                    tx_url: 'https://worbli.bloks.io/transaction/'
                }
            ]
        },
        {
            id: '2a02a0053e5a8cf73a56ba0fda11e4d92e0238a4a2aa74fccf46d5a910746840',
            symbol: 'EOS',
            icon: 'jungle.png',
            precision: 4,
            name: 'EOS JUNGLE 3',
            network: 'TESTNET',
            firstApi: 'https://jungle3history.cryptolions.io',
            historyApi: 'https://jungle3history.cryptolions.io/v2',
            hyperionApis: [
                'https://jungle3history.cryptolions.io/v2',
                'https://jungle3.eosusa.news/v2',
                'https://jungle3.eosrio.io/v2'
            ],
            forumTally: '',
            eosrioBP: 'eosriobrazil',
            proxyRegistry: '',
            lastNode: '',
            logoSrc: '',
            backdrop: '',
            features: {
                history: true,
                send: true,
                resource: true,
                vote: true,
                staking: true,
                dapps: true,
                addAcc: true,
                newAcc: true,
                forum: false,
                rex: true
            },
            borrow: {
                endpoint: 'https://jungle3history.cryptolions.io/v2',
                enable: true,
                margin: 1.30,
                default_us: 1000
            },
            relay: {
                enable: true,
                endpoint: 'https://eos.relay.eosrio.io',
                usageCpuLimit: 2500,
                defaultCredits: 5
            },
            system: [
                'eosio',
                'eosio.token',
                'eosio.msig'
            ],
            endpoints: [
                {
                    url: 'https://jungle3.eossweden.org',
                    owner: 'EOS Sweden',
                    latency: 0
                },
                {
                    url: 'https://jungle3.eosusa.news',
                    owner: 'EOS USA',
                    latency: 0
                },
                {
                    url: 'https://jungle3history.cryptolions.io',
                    owner: 'Cryptolions',
                    latency: 0
                },
                {
                    url: 'https://jungle3.eosrio.io',
                    owner: 'EOS Rio',
                    latency: 0
                }
            ],
            explorers: [
                {
                    name: 'Bloks.io',
                    account_url: 'https://jungle3.bloks.io/account/',
                    tx_url: 'https://jungle3.bloks.io/transaction/'
                },
                {
                    name: 'EOSX',
                    account_url: 'https://jungle.eosx.io/account/',
                    tx_url: 'https://jungle.eosx.io/tx/'
                }
            ]
        },
        {
            id: 'e70aaab8997e1dfce58fbfac80cbbb8fecec7b99cf982a9444273cbc64c41473',
            symbol: 'EOS',
            icon: 'jungle.png',
            precision: 4,
            name: 'EOS JUNGLE 2',
            network: 'TESTNET',
            firstApi: 'https://jungle.eossweden.org',
            historyApi: 'https://jungle.eossweden.org/v2',
            hyperionApis: [
                'https://jungle.hyperion.eosrio.io/v2',
                'https://jungle.eosusa.news/v2',
                'https://junglehistory.cryptolions.io/v2',
                'https://jungle.eosn.io/v2',
                'https://jungle.eossweden.org/v2'
            ],
            forumTally: '',
            eosrioBP: '',
            proxyRegistry: '',
            lastNode: '',
            logoSrc: '',
            backdrop: '',
            features: {
                history: true,
                send: true,
                resource: true,
                vote: true,
                staking: true,
                dapps: true,
                addAcc: true,
                newAcc: true,
                forum: false,
                rex: true
            },
            borrow: {
                enable: false
            },
            relay: {
                enable: false
            },
            system: [
                'eosio',
                'eosio.token',
                'eosio.msig'
            ],
            endpoints: [
                {
                    url: 'https://jungle.eossweden.org',
                    owner: 'EOS Sweden',
                    latency: 0
                },
                {
                    url: 'https://jungle.eosusa.news',
                    owner: 'EOS USA',
                    latency: 0
                },
                {
                    url: 'https://jungle2.cryptolions.io',
                    owner: 'Jungle 2',
                    latency: 0
                }
            ],
            explorers: [
                {
                    name: 'EOSX',
                    account_url: 'https://jungle.eosx.io/account/',
                    tx_url: 'https://jungle.eosx.io/tx/'
                }
            ]
        },
        {
            id: '33cc2426f1b258ef8c798c34c0360b31732ea27a2d7e35a65797850a86d1ba85',
            symbol: 'BOS',
            icon: 'bos.png',
            precision: 4,
            name: 'BOS TESTNET',
            network: 'TESTNET',
            firstApi: 'https://testnet.bos.eosrio.io',
            historyApi: 'https://api-bostest.blockzone.net/v2',
            hyperionApis: [
                'https://api-bostest.blockzone.net/v2',
                'https://tst.bossweden.org/v2'
            ],
            forumTally: '',
            eosrioBP: 'bosriobrazil',
            proxyRegistry: '',
            lastNode: '',
            logoSrc: '',
            backdrop: '',
            features: {
                history: true,
                send: true,
                resource: true,
                vote: true,
                staking: true,
                dapps: false,
                addAcc: true,
                newAcc: true,
                forum: false,
                rex: true
            },
            borrow: {
                enable: false
            },
            relay: {
                enable: false
            },
            system: [
                'eosio',
                'eosio.token',
                'eosio.msig'
            ],
            endpoints: [
                {
                    url: 'https://testnet.bos.eosrio.io',
                    owner: 'BOS Rio',
                    latency: 0
                },
                {
                    url: 'https://tst.bossweden.org',
                    owner: 'BOS Sweden',
                    latency: 0
                },
                {
                    url: 'https://api-bostest.blockzone.net/',
                    owner: 'Blockzone',
                    latency: 0
                }
            ],
            explorers: [
                {
                    name: 'EOSX',
                    account_url: 'https://bos-test.eosx.io/account/',
                    tx_url: 'https://bos-test.eosx.io/tx/'
                }
            ]
        },
        {
            id: '5fff1dae8dc8e2fc4d5b23b2c7665c97f9e9d8edf2b6485a86ba311c25639191',
            symbol: 'EOS',
            icon: 'kylin.png',
            precision: 4,
            name: 'EOS KYLIN TESTNET',
            network: 'TESTNET',
            firstApi: 'https://api-kylin.eoslaomao.com',
            historyApi: 'https://kylin.eossweden.org/v2',
            hyperionApis: [
                'https://kylin.eossweden.org/v2',
                'https://kylin.eosusa.news/v2',
                'https://kylin.eosn.io/v2'
            ],
            forumTally: '',
            eosrioBP: 'eosriobrazil',
            proxyRegistry: '',
            lastNode: '',
            logoSrc: '',
            backdrop: '',
            features: {
                history: true,
                send: true,
                resource: true,
                vote: true,
                staking: true,
                dapps: false,
                addAcc: true,
                newAcc: true,
                forum: false,
                rex: true
            },
            borrow: {
                enable: false
            },
            relay: {
                enable: false
            },
            system: [
                'eosio',
                'eosio.token',
                'eosio.msig'
            ],
            endpoints: [
                {
                    url: 'https://api-kylin.eoslaomao.com',
                    owner: 'EOS LaoMao',
                    latency: 0
                },
                {
                    url: 'https://api-kylin.eosasia.one',
                    owner: 'EOS Asia',
                    latency: 0
                }
            ],
            explorers: [
                {
                    name: 'EOSX',
                    account_url: 'https://kylin.eosx.io/account/',
                    tx_url: 'https://kylin.eosx.io/tx/'
                },
                {
                    name: 'Bloks.io',
                    account_url: 'https://kylin.bloks.io/account/',
                    tx_url: 'https://kylin.bloks.io/transaction/'
                }
            ]
        },
        {
            id: 'cc1e1e603f6ce192256579ce72f118c52127e6cf1b88783cbd73ea1e6aaa5731',
            symbol: 'LLM',
            icon: 'liberland.png',
            precision: 8,
            name: 'LIBERLAND TESTNET',
            network: 'TESTNET',
            firstApi: 'https://liberland-staging.eosio.se',
            historyApi: '',
            hyperionApis: [],
            forumTally: '',
            eosrioBP: '',
            proxyRegistry: '',
            lastNode: '',
            logoSrc: '',
            backdrop: '',
            features: {
                history: true,
                send: true,
                resource: false,
                vote: false,
                staking: true,
                dapps: true,
                addAcc: true,
                newAcc: false,
                forum: false,
                rex: false
            },
            borrow: {
                enable: false
            },
            relay: {
                enable: false
            },
            system: [
                'eosio',
                'eosio.init',
                'eosio.token',
                'eosio.msig'
            ],
            endpoints: [
                {
                    url: 'https://liberland-staging.eosio.se',
                    owner: 'EOS Sweden',
                    latency: 0,
                    version: 'native'
                }
            ],
            explorers: []
        },
        {
            id: 'cc7d69ef6216ba33be85e9b256fbfbad4e103c14e0f115b281b2f954838c463a',
            symbol: 'LLM',
            icon: 'liberland.png',
            precision: 8,
            name: 'LIBERLAND T2',
            network: 'TESTNET',
            firstApi: 'https://liberland-test.eosio.se',
            historyApi: '',
            hyperionApis: [],
            forumTally: '',
            eosrioBP: '',
            proxyRegistry: '',
            lastNode: '',
            logoSrc: '',
            backdrop: '',
            features: {
                history: true,
                send: true,
                resource: false,
                vote: false,
                staking: true,
                dapps: true,
                addAcc: true,
                newAcc: false,
                forum: false,
                rex: false
            },
            borrow: {
                enable: false
            },
            relay: {
                enable: false
            },
            system: [
                'eosio',
                'eosio.init',
                'eosio.token',
                'eosio.msig'
            ],
            endpoints: [
                {
                    url: 'https://liberland-test.eosio.se',
                    owner: 'EOS Sweden',
                    latency: 0,
                    version: 'native'
                },
                {
                    url: 'https://staging.liberland.eosrio.io',
                    owner: 'EOS Rio',
                    latency: 0,
                    version: 'native'
                }
            ],
            explorers: []
        },
        {
            id: '7f3f5ae1a73d7c14a72f65f257d41397b966ffcd95c588c50d5081eaa354984c',
            symbol: 'LLC',
            icon: 'liberland.png',
            precision: 8,
            name: 'LIBERLAND TEST LEGACY',
            network: 'TESTNET',
            firstApi: 'https://liberland.eossweden.org',
            historyApi: '',
            hyperionApis: [],
            forumTally: '',
            eosrioBP: '',
            proxyRegistry: '',
            lastNode: '',
            logoSrc: '',
            backdrop: '',
            features: {
                history: true,
                send: true,
                resource: false,
                vote: false,
                staking: true,
                dapps: true,
                addAcc: true,
                newAcc: false,
                forum: false,
                rex: false
            },
            borrow: {
                enable: false
            },
            relay: {
                enable: false
            },
            system: [
                'eosio',
                'eosio.token',
                'eosio.msig'
            ],
            endpoints: [
                {
                    url: 'https://liberland.eossweden.org',
                    owner: 'EOS Sweden',
                    latency: 0,
                    version: 'native'
                }
            ],
            explorers: []
        },
        {
            id: '7136e3e32a458bb99cf6973ab5055869d25830607b9e78593769e1be52fb6f20',
            symbol: 'MEETONE',
            icon: 'meetone.png',
            precision: 4,
            name: 'MEET.ONE TESTNET',
            network: 'TESTNET',
            firstApi: 'https://sidechain-test-history.meet.one',
            historyApi: 'https://meetone.hyperion.eosrio.io/v2',
            hyperionApis: [
                'https://meetone.hyperion.eosrio.io/v2'
            ],
            forumTally: '',
            eosrioBP: '',
            proxyRegistry: 'proxies.m',
            lastNode: '',
            logoSrc: '',
            backdrop: '',
            features: {
                history: true,
                send: true,
                resource: true,
                vote: true,
                staking: true,
                dapps: true,
                addAcc: true,
                newAcc: true,
                forum: false,
                rex: false
            },
            borrow: {
                enable: false
            },
            relay: {
                enable: false
            },
            system: [
                'eosio',
                'eosio.token',
                'eosio.msig'
            ],
            endpoints: [
                {
                    url: 'https://sidechain-test-history.meet.one',
                    owner: 'MEET.ONE',
                    latency: 0
                }
            ],
            explorers: []
        }
    ]
};
