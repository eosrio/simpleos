import {Injectable} from '@angular/core';
import {AccountsService} from './accounts.service';
import {EOSJSService} from './eosjs.service';
import {Router} from '@angular/router';

import * as Eos from '../assets/eos.js';
import {BehaviorSubject} from 'rxjs';
import {LedgerHWService} from './services/ledger-h-w.service';

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
	public mainNet = [];
	public mainnetActive = [];
	// public mainnetId  = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';
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


	constructor(private eosjs: EOSJSService, private router: Router, private aService: AccountsService, private ledger: LedgerHWService) {
		this.publicEndpoints = [
			{url: 'https://api.eosrio.io', owner: 'EOS Rio', latency: 0, filters: [], chain: 'EOS MAINNET'},
			{url: 'https://hapi.eosrio.io', owner: 'EOS Rio', latency: 0, filters: [], chain: 'EOS MAINNET'},
			{url: 'https://eu.eosdac.io', owner: 'eosDAC', latency: 0, filters: [], chain: 'EOS MAINNET'},
			{url: 'https://mainnet.eoscalgary.io', owner: 'eoscalgary', latency: 0, filters: [], chain: 'EOS MAINNET'},
			{url: 'https://api.dpos.africa/', owner: 'EOS Africa', latency: 0, filters: [], chain: 'EOS MAINNET'},
			{url: 'https://api1.eosasia.one', owner: 'EOS Asia', latency: 0, filters: [], chain: 'EOS MAINNET'},
			{url: 'https://api.eoslaomao.com', owner: 'EOS Asia', latency: 0, filters: [], chain: 'EOS MAINNET'},
			{url: 'https://mainnet.genereos.io', owner: 'EOS Asia', latency: 0, filters: [], chain: 'EOS MAINNET'},
			{url: 'https://node1.eosphere.io', owner: 'EOS Asia', latency: 0, filters: [], chain: 'EOS MAINNET'},
			{url: 'https://proxy.eosnode.tools', owner: 'Proxy Node', latency: 0, filters: [], chain: 'EOS MAINNET'},
			{url: 'https://history.cryptolions.io', owner: 'EOS Cryptolions', latency: 0, filters: [], chain: 'EOS MAINNET'},
			{url: 'https://api.worbli.eosrio.io', owner: 'EOSRIo - Worbli', latency: 0, filters: [], chain: 'WORBLI MAINNET'},
			{url: 'https://api.worblisweden.org', owner: 'EOS Sweden - Worbli', latency: 0, filters: [], chain: 'WORBLI MAINNET'},
			// {url: 'https://jungle2.cryptolions.io:443', owner: 'Jungle 2', latency: 0, filters: [], chain: 'JUNGLE TESTNET'},
			{url: 'https://junglehistory.cryptolions.io:4433', owner: 'Jungle 2', latency: 0, filters: [], chain: 'JUNGLE TESTNET'},
			// {url: 'https://jungle-node.mywish.io', owner: 'Jungle 2', latency: 0, filters: [], chain: 'JUNGLE TESTNET'},
			{url: 'https://api.eos.miami:17441', owner: 'Telos', latency: 0, filters: [], chain: 'TELOS TESTNET'}
		];

		this.validEndpoints = [];
		this.status = '';
		this.connectionTimeout = null;
		this.mainNet = [];
		this.mainnetActive = [];

	}

	connect() {
		this.status = '';
		this.setChain();
		this.mainnetActive = [];
		this.aService.mainnetActive = [];
		this.mainnetId = '';
		this.mainnetActive = this.mainNet.find(chain => chain.active);
		this.aService.mainnetActive = this.mainNet.find(chain => chain.active);
		this.mainnetId = this.mainNet.find(chain => chain.active).id;
		this.networkingReady.next(false);

		const pQueue = [];
		this.connected = false;
		this.publicEndpoints.forEach((apiNode) => {
			if (this.mainnetActive['name'] === apiNode.chain) {
				pQueue.push(this.apiCheck(apiNode));
			}
		});

		Promise.all(pQueue).then(() => {
			this.extractValidNode();
		});
		console.log('Starting timer...');
		this.startTimeout();
	}

	setChain() {
		this.mainNet = [];
		const storeChain = localStorage.getItem('simplEOS.storeChain');
		for (let chain in JSON.parse(storeChain)) {
			// console.log(JSON.parse(storeChain)[chain[0]]);
			this.mainNet.push(JSON.parse(storeChain)[chain[0]]);
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

	async scanNodes() {
		for (const apiNode of this.publicEndpoints) {
			if (this.mainnetActive['name'] === apiNode.chain) {
				await this.apiCheck(apiNode);
			}

		}
	}

	async extractValidNode() {
		this.validEndpoints = [];
		for (const apiNode of this.publicEndpoints) {
			if (this.mainnetActive['name'] === apiNode.chain) {
				if (apiNode.latency > 0 && apiNode.latency < 1000) {
					await this.filterCheck(apiNode).then(value => {
						const node = this.publicEndpoints;
						const nodeSel = node.find(ep => ep.url === apiNode.url);
						if (nodeSel.filters.length === 1) {
							 this.validEndpoints.push(apiNode);
						}
					});
				}
			}
		}
		this.selectEndpoint();

	}

	selectEndpoint() {
		let latency = 2000;
		this.validEndpoints.forEach((node) => {
			if (this.mainnetActive['name'] === node.chain) {
				if (node.latency < latency && node.latency > 1) {
					latency = node.latency;
					this.selectedEndpoint.next(node);
				}
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
		return this.selectedEndpoint.getValue().url;
	}

	verifyFilters() {

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
		console.log('Starting latency check for ' + server.url);
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
						console.log(server.url, server.latency);
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
		let endpoint = url;
		if (!url) {
			endpoint = this.selectedEndpoint.getValue().url;
		} else {
			this.status = '';
			this.networkingReady.next(false);
			this.startTimeout();
		}

		this.eosjs.init(endpoint, this.mainnetId).then((savedAccounts: any) => {
			// if (this.ledger.isElectron()) {
			//   this.aService.checkLedgerAccounts().then(() => {
			//     this.ledger.initListener();
			//   });
			// }
			if (this.connectionTimeout) {
				clearTimeout(this.connectionTimeout);
				this.networkingReady.next(true);
				this.connectionTimeout = null;
			}
			if (savedAccounts) {
				if (savedAccounts.length > 0) {
					this.aService.loadLocalAccounts(savedAccounts);
					this.aService.initFirst();
					this.networkingReady.next(true);
					this.router['navigate'](['dashboard', 'wallet']);
				} else {
					console.log('No saved accounts!');
				}
			}
		}).catch((err) => {
			console.log('-------EOSJS_ERRO-------->', err);
			this.networkingReady.next(false);
		});
	}

}
