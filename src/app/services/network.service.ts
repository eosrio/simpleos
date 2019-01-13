import {Injectable} from '@angular/core';
import {AccountsService} from './accounts.service';
import {EOSJSService} from './eosjs.service';
import {Router} from '@angular/router';

import * as Eos from '../../assets/eos.js';
import {BehaviorSubject} from 'rxjs';
import {CryptoService} from './crypto.service';
import {VotingService} from './voting.service';

export interface Endpoint {
	url: string;
	owner: string;
	latency: number;
	filters: any[];
	chain: string;
}

@Injectable({
	providedIn: 'root'
})
export class NetworkService {

	publicEndpoints: Endpoint[];
	eos: any;

	public mainnetId: string;

	public: string;
	genesistx = 'ad77575a8b4f52e477682e712b1cbd884299468db6a94d909f90c6961cea9b02';
	voteref = 'b23f537e8ab29fbcec8b533081ef7e12b146899ca42a3fc9eb608258df9983d9';
	accountez = 'EOS7WdCcva3WtsJRckJWodnHLof5B7qwAyfJSaMZmfn7Dgn6TQDBu';
	txrefBlock = 191;
	voterefBlock = 572278;
	baseConfig = {
		httpEndpoint: '',
		expireInSeconds: 60,
		broadcast: true,
		debug: false,
		sign: true,
		chainId: ''
	};
	validEndpoints: Endpoint[];
	status: string;
	connectionTimeout: any;
	selectedEndpoint = new BehaviorSubject<Endpoint>(null);
	networkingReady = new BehaviorSubject<boolean>(false);

	connected = false;
	lastEndpoint = '';

	public activeChain = null;

	defaultChains = [
		{
			id: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
			symbol: 'EOS',
			name: 'EOS MAINNET',
			firstApi: 'https://hapi.eosrio.io',
			lastNode: '',
			features: {
				history: true,
				send: true,
				resource: true,
				vote: true,
				staking: true,
				dapps: true,
				addAcc: true,
				newAcc: true,
				forum: true
			},
			system: [
				'eosio',
				'eosio.token',
				'eosio.msig',
				'eosio.forum'
			],
			endpoints: [
				// {url: 'https://api.eosrio.io', owner: 'EOS Rio', latency: 0},
				{url: 'https://hapi.eosrio.io', owner: 'EOS Rio', latency: 0},
				{url: 'https://eu.eosdac.io', owner: 'eosDAC', latency: 0},
				{url: 'https://mainnet.eoscalgary.io', owner: 'eoscalgary', latency: 0},
				// {url: 'https://api.dpos.africa/', owner: 'EOS Africa', latency: 0},
				{url: 'https://api1.eosasia.one', owner: 'EOS Asia', latency: 0},
				{url: 'https://api.eoslaomao.com', owner: 'EOS Asia', latency: 0},
				{url: 'https://mainnet.genereos.io', owner: 'EOS Asia', latency: 0},
				{url: 'https://node1.eosphere.io', owner: 'EOS Asia', latency: 0},
				{url: 'https://proxy.eosnode.tools', owner: 'Proxy Node', latency: 0},
				{url: 'https://history.cryptolions.io', owner: 'EOS Cryptolions', latency: 0, version: 'mongo'}
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
					memo_size: 28,
					pattern: /^[a-f0-9]+$/gm
				},
				krakenkraken: {
					pattern: /^[0-9]+$/gm
				},
				binancecleos: {
					memo_size: 9,
					pattern: /^[0-9]+$/gm
				},
				huobideposit: {
					pattern: /^[0-9]+$/gm
				},
				poloniexeos1: {
					memo_size: 16,
					pattern: /^[a-f0-9]+$/gm
				},
			}
		},
		{
			id: '73647cde120091e0a4b85bced2f3cfdb3041e266cbbe95cee59b73235a1b3b6f',
			symbol: 'WBI',
			name: 'WORBLI MAINNET',
			firstApi: 'https://api.worbli.eosrio.io',
			lastNode: '',
			features: {
				history: true,
				send: true,
				resource: true,
				vote: false,
				staking: true,
				dapps: true,
				addAcc: true,
				newAcc: false,
				forum: false
			},
			system: [
				'eosio',
				'eosio.token',
				'eosio.msig'
			],
			endpoints: [
				{url: 'https://api.worbli.eosrio.io', owner: 'EOS Rio - Worbli', latency: 0, version: 'native'},
				{url: 'https://api.worblisweden.org', owner: 'EOS Sweden - Worbli', latency: 0},
				{url: 'https://api.worbli.eostribe.io', owner: 'EOS Tribe - Worbli', latency: 0, version: 'elastic'}
			],
			explorers: [
				{
					name: 'EOSX',
					account_url: 'https://worbli.eosx.io/account/',
					tx_url: 'https://worbli.eosx.io/tx/'
				}
			]
		},
		{
			id: '33cc2426f1b258ef8c798c34c0360b31732ea27a2d7e35a65797850a86d1ba85',
			symbol: 'BOS',
			name: 'BOS TESTNET',
			firstApi: 'https://boscore.eosrio.io',
			lastNode: '',
			features: {
				history: true,
				send: true,
				resource: true,
				vote: true,
				staking: true,
				dapps: true,
				addAcc: true,
				newAcc: true,
				forum: false
			},
			system: [
				'eosio',
				'eosio.token',
				'eosio.msig'
			],
			endpoints: [
				{url: 'https://boscore.eosrio.io', owner: 'BOS Rio', latency: 0, version: 'mongo'},
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
			id: 'e70aaab8997e1dfce58fbfac80cbbb8fecec7b99cf982a9444273cbc64c41473',
			symbol: 'EOS',
			name: 'JUNGLE TESTNET',
			firstApi: 'https://jungle2.cryptolions.io:443',
			lastNode: '',
			features: {
				history: true,
				send: true,
				resource: true,
				vote: true,
				staking: true,
				dapps: false,
				addAcc: true,
				newAcc: true,
				forum: false
			},
			system: [
				'eosio',
				'eosio.token',
				'eosio.msig'
			],
			endpoints: [
				{url: 'https://junglehistory.cryptolions.io:4433', owner: 'Jungle 2', latency: 0},
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
			id: '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11',
			symbol: 'TLOS',
			name: 'TELOS MAINNET',
			firstApi: 'https://api.eos.miami',
			lastNode: '',
			features: {
				history: true,
				send: true,
				resource: true,
				vote: true,
				staking: true,
				dapps: true,
				addAcc: true,
				newAcc: true,
				forum: false
			},
			system: [
				'eosio',
				'eosio.token',
				'eosio.msig'
			],
			endpoints: [
				{url: 'https://api.eos.miami', owner: 'Telos', latency: 0}
			],
			explorers: [
				{
					name: 'EOSX',
					account_url: 'https://telos.eosx.io/account/',
					tx_url: 'https://telos.eosx.io/tx/'
				}
			]
		}
	];

	constructor(
		private eosjs: EOSJSService,
		private router: Router,
		private aService: AccountsService,
		private voting: VotingService,
		private crypto: CryptoService
		// private ledger: LedgerHWService
	) {

		const savedChainId = localStorage.getItem('simplEOS.activeChainID');
		if (savedChainId) {
			this.activeChain = this.defaultChains.find((chain) => chain.id === savedChainId);
		} else {
			const EOS_MAINNET_ID = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';
			this.activeChain = this.defaultChains.find((chain) => chain.id === EOS_MAINNET_ID);
			localStorage.setItem('simplEOS.activeChainID', EOS_MAINNET_ID);
		}
		this.aService.activeChain = this.activeChain;

		this.validEndpoints = [];
		this.status = '';
		this.connectionTimeout = null;
	}

	connect() {
		this.status = '';
		this.mainnetId = '';
		this.aService.activeChain = this.activeChain;

		this.mainnetId = this.activeChain['id'];
		this.networkingReady.next(false);

		const pQueue = [];
		this.connected = false;

		this.activeChain['endpoints'].forEach((apiNode) => {
			pQueue.push(this.apiCheck(apiNode));
		});

		Promise.all(pQueue).then(() => {
			this.extractValidNode();
		});
		// console.log('Starting timer...');
		this.startTimeout();
	}

	changeChain(event) {
		this.activeChain = this.defaultChains.find((chain) => chain.id === event.value);
		if (this.activeChain) {
			this.aService.activeChain = this.activeChain;
			this.aService.accounts = [];
			localStorage.setItem('simplEOS.activeChainID', this.activeChain.id);
			this.connect();
			console.log('Network switched to: ' + this.activeChain['name']);
		}
	}

	startTimeout() {
		this.connectionTimeout = setTimeout(() => {
			console.log('Timeout!');
			if (!this.networkingReady.getValue()) {
				this.status = 'timeout';
				clearTimeout(this.connectionTimeout);
				this.networkingReady.next(false);
				this.connectionTimeout = null;
			}
		}, 10000);
	}

	extractValidNode() {
		this.validEndpoints = [];
		this.activeChain.endpoints.forEach((apiNode) => {
			if (apiNode.latency > 0 && apiNode.latency < 1200) {
				this.validEndpoints.push(apiNode);
			}
		});
		this.selectEndpoint();
	}

	selectEndpoint() {
		let latency = 2000;
		this.validEndpoints.forEach((node) => {
			if (node.latency < latency && node.latency > 1) {
				latency = node.latency;
				this.selectedEndpoint.next(node);
			}
		});
		if (this.selectedEndpoint.getValue() === null) {
			this.networkingReady.next(false);
		} else {
			console.log('Best Server Selected!', this.selectedEndpoint.getValue().url);
			this.startup(null);
		}
	}

	selectedEP() {
		return this.eosjs.baseConfig.httpEndpoint;
	}

	filterCheck(server: Endpoint) {
		console.log('Starting filter check for ' + server.url);
		const config = this.baseConfig;
		config.httpEndpoint = server.url;
		config.chainId = this.mainnetId;
		const eosCK = Eos(config);
		const pq = [];
		const getkeyAcc = eosCK['getKeyAccounts'](this.accountez).then(info => {

			if (info.length > 0 || info['account_names'].length > 0) {
				this.publicEndpoints.find(ep => ep.url === server.url).filters.push({eosio: 'history'});
				return true;
			} else {
				console.log('eosio:history filter is disabled on ' + server.url);
			}
		}).catch(err => {
			console.log(err);
			return false;
		});
		pq.push(getkeyAcc);

		// 	if (err) {
		// 		console.log(err);
		// 		return err;
		// 	} else {
		// 		// return txInfo;
		// 		// if (txInfo.length > 0 || txInfo['account_names'] > 0 ) {
		// 		// 	this.publicEndpoints.find(ep => ep.url === server.url).filters.push({eosio:'history'});
		// 		// } else {
		// 		// 	console.log('eosio:history filter is disabled on ' + server.url);
		// 		// }
		// 	}
		// });
		// });

		// console.log(getAccKey);
		// pq.push(new Promise((resolve1) => {
		// 	eosCK['getTransaction'](this.genesistx, (err, txInfo) => {
		//     if (err) {
		//       console.log(err);
		//       resolve1();
		//     } else {
		//       if (txInfo['block_num'] === this.txrefBlock) {
		// 		  this.publicEndpoints.find(ep => ep.url === server.url).filters.push('eosio.token:transfer');
		//       } else {
		//         console.log('eosio.token:transfer filter is disabled on ' + server.url);
		//       }
		//       resolve1();
		//     }
		//   });
		// }));
		// pq.push(new Promise((resolve1) => {
		//   eos['getTransaction'](this.voteref, (err, txInfo) => {
		//     if (err) {
		//       console.log(err);
		//       resolve1();
		//     } else {
		//       if (txInfo['block_num'] === this.voterefBlock) {
		//         server.filters.push('eosio:voteproducer');
		//       } else {
		//         console.log('eosio:voteproducer filter is disabled on ' + server.url);
		//       }
		//       resolve1();
		//     }
		//   });
		// }));
		return Promise.all(pq);
	}

	apiCheck(server: Endpoint) {
		// console.log('Starting latency check for ' + server.url);
		return new Promise((resolve) => {
			const config = this.baseConfig;
			config.httpEndpoint = server.url;
			config.chainId = this.mainnetId;
			const eos = Eos(config);
			const refTime = new Date().getTime();
			const tempTimer = setTimeout(() => {
				server.latency = -1;
				resolve();
			}, 2000);
			try {
				eos['getInfo']({}, (err) => {
					if (err) {
						server.latency = -1;
					} else {
						server.latency = ((new Date().getTime()) - refTime);
						// console.log(server.url, server.latency);
					}
					clearTimeout(tempTimer);
					if (server.latency > 1 && server.latency < 200) {
						// force quick connection
						if (this.connected === false) {
							this.connected = true;
							this.selectedEndpoint.next(server);
							this.startup(null);
						}
					}
					resolve();
				});
			} catch (e) {
				server.latency = -1;
				resolve();
			}
		});
	}

	startup(url) {
		// console.log('startup called - url: ', url);
		let endpoint = url;
		if (!url) {
			endpoint = this.selectedEndpoint.getValue().url;
		} else {
			this.status = '';
			this.networkingReady.next(false);
			this.startTimeout();
		}

		// prevent double load after quick connection mode
		if (endpoint !== this.lastEndpoint) {
			this.eosjs.init(endpoint, this.activeChain.id).then((savedAccounts: any) => {
				// if (this.ledger.isElectron()) {
				//   this.aService.checkLedgerAccounts().then(() => {
				//     this.ledger.initListener();
				//   });
				// }
				this.lastEndpoint = endpoint;
				this.defaultChains.find(c => c.id === this.activeChain.id).lastNode = this.lastEndpoint;
				if (this.connectionTimeout) {
					clearTimeout(this.connectionTimeout);
					this.networkingReady.next(true);
					this.connectionTimeout = null;
				}
				if (savedAccounts) {
					if (savedAccounts.length > 0) {
						this.aService.loadLocalAccounts(savedAccounts).then(() => {
							this.aService.initFirst();
							this.voting.forceReload();
							this.networkingReady.next(true);
							if (this.activeChain.features.forum) {
								this.router['navigate'](['dashboard', 'vote']);
							} else {
								this.router['navigate'](['dashboard', 'wallet']);
							}
						});
					} else {
						this.voting.forceReload();
						if (this.crypto.locked) {
							console.log('No saved accounts!');
							this.router['navigate'](['']);
						} else {
							console.log('No saved accounts!');
							this.router['navigate'](['landing']);
						}
					}
				}
			}).catch((err) => {
				console.log('>>> EOSJS_ERROR: ', err);
				this.networkingReady.next(false);
			});
		}
	}

}
