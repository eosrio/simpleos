import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {EOSJSService} from './eosjs.service';
import {Subject} from 'rxjs';
import {AccountsService} from './accounts.service';
import * as moment from 'moment';
import {Eosjs2Service} from './eosjs2.service';

@Injectable({
	providedIn: 'root'
})
export class VotingService {

	constructor(
		private eosjs: Eosjs2Service,
		private eos: EOSJSService,
		private http: HttpClient,
		private aService: AccountsService
	) {
		this.hasList = true;
		this.bps = [];
		this.proxies = [];
		this.data = [];
		this.initList = false;
		this.initListProx = false;
		this.chainActive = false;
		this.totalActivatedStake = 0;
		this.totalProducerVoteWeight = 0;
		this.stakePercent = 0;
		this.isOnline = false;

		this.lastState = false;
		this.lastChain = '';
		this.lastAcc = '';


		// EOSJS Status watcher
		this.eos.online.asObservable().subscribe(value => {
			this.isOnline = value;
			if (value !== this.lastState) {
				this.lastState = value;
				// console.log('ONLINE VALUE:', value);
				if (value) {
					this.callLoader();
				}
			}
		});

		// Account status watcher
		this.aService.selected.asObservable().subscribe((sA) => {
			if (sA['name']) {
				this.selectedAccount = sA;
				if (this.bps.length === 0 && !this.initList) {
					if (this.lastAcc !== sA['name'] || this.lastChain !== this.aService.activeChain.name) {
						this.lastAcc = sA['name'];
						this.lastChain = this.aService.activeChain.name;
						this.callLoader();
					}
				}
			}
		});
	}

	public bps: any[];
	public proxies: any[];
	public listReady = new Subject<Boolean>();
	// public listReadyProxy = new Subject<Boolean>();
	public counter = new Subject<Number>();
	selectedAccount: any;
	initList: boolean;
	initListProx: boolean;
	totalActivatedStake: number;
	voteType: number;
	totalProducerVoteWeight: number;
	totalVoteWeight: number;
	chainActive: boolean;
	stakePercent: number;
	activeCounter = 50;
	isOnline: boolean;

	lastState: boolean;
	lastChain: string;
	lastAcc: string;
	public hasList: boolean;
	loadingProds = false;
	loadingProxs = false;

	// map
	data: any[];
	updateOptions: any;
	list: any[];

	maxProxies = 1000;

	static shuffle(array) {
		let currentIndex = array.length, temporaryValue, randomIndex;
		while (0 !== currentIndex) {
			randomIndex = Math.floor(Math.random() * currentIndex);
			currentIndex -= 1;
			temporaryValue = array[currentIndex];
			array[currentIndex] = array[randomIndex];
			array[randomIndex] = temporaryValue;
		}
		return array;
	}


	static amountFilter(value, args?) {
		let exp;
		const suffixes = ['k', 'M', 'G', 'T', 'P', 'E'];
		if (Number.isNaN(value)) {
			return null;
		}
		if (value < 1000) {
			return value.toFixed(args);
		}
		exp = Math.floor(Math.log(value) / Math.log(1000));
		return (value / Math.pow(1000, exp)).toFixed(args) + suffixes[exp - 1];
	}

	callLoader() {
		// console.log('attempt to load BPs', this.aService.selected.getValue().name, this.isOnline);
		if (this.aService.selected.getValue().name && this.isOnline) {
			this.listProducers().catch((e => {
				console.log(e);
			}));
		}
	}

	forceReload() {
		console.log('Voting Service: Force reload!');
		this.bps = [];
		this.initList = false;
		// this.listProducers();
	}

	clearMap() {
		this.data = [];
		this.updateOptions = {
			series: [{
				data: this.data
			}]
		};
	}

	randomizeList() {
		this.bps = VotingService.shuffle(this.bps);
	}

	bpsByChain(id) {
		this.bps = this.bps.filter(bp => bp.chainId === id);
	}

	pxsByChain(id) {
		this.proxies = this.proxies.filter(px => px.chainId === id);
	}

	currentVoteType(sel) {
		const myAccount = sel;
		if (myAccount.name) {
			if (myAccount.details['voter_info'] !== null) {
				if (myAccount.details['voter_info']['producers'].length > 0) {
					this.voteType = 0;
				} else if (myAccount.details['voter_info']['proxy'] !== '') {
					this.voteType = 1;
				} else {
					this.voteType = 0;
				}
			} else {
				this.voteType = 0;
			}
		}
	}

	async listProducers() {
		if (!this.initList && !this.loadingProds && this.aService.selected.getValue().name) {
			this.loadingProds = true;

			const producers = await this.eos.listProducers();
			// console.log('ListProducers returned ' + producers.rows.length + ' producers');
			const global_data = await this.eos.getChainInfo();

			this.totalProducerVoteWeight = parseFloat(global_data.rows[0]['total_producer_vote_weight']);
			const total_votes = this.totalProducerVoteWeight;

			// Pass 1 - Add accounts
			const myAccount = this.aService.selected.getValue();
			this.bps = [];

			this.hasList = producers.rows.length > 0;

			producers.rows.forEach((prod: any, idx) => {
				const vote_pct: any = Math.round((100 * prod['total_votes'] / total_votes) * 1000) / 1000;
				let voted;
				// console.log( VotingService.amountFilter((prod['total_votes'] / 10000), '2'));
				const a = (moment().unix() - 946684800);
				const b = parseInt('' + (a / 604800), 10) / 52;
				const totalEos = (prod['total_votes'] / Math.pow(2, b) / 10000);
				// console.log(totalEos);
				if (myAccount.details['voter_info']) {
					voted = myAccount.details['voter_info']['producers'].indexOf(prod['owner']) !== -1;
				} else {
					voted = false;
				}
				const producerMetadata = {
					name: prod['owner'],
					account: prod['owner'],
					key: prod['producer_key'],
					location: '',
					geo: [],
					position: idx + 1,
					status: '',
					total_votes: VotingService.amountFilter(totalEos, '2') + ' ' + this.aService.activeChain['symbol'],
					total_votes_eos: vote_pct + '%',
					social: '',
					email: '',
					website: prod.url,
					logo_256: '',
					code: '',
					checked: voted,
					chainId: this.aService.activeChain.id
				};
				this.bps.push(producerMetadata);
			});

			this.initList = true;
			this.listReady.next(true);
			this.loadingProds = false;

			// Pass 2 - Enhance metadata

			this.activeCounter = 50;

			// Cache expires in 6 hours
			const expiration = (1000 * 60 * 60 * 6);

			const requestQueue = [];
			let fullCache = {};
			// Load cached data, single entry per chain
			const path = 'simplEOS.producers.' + this.aService.activeChain.id;
			const stored_data = localStorage.getItem(path);
			if (stored_data) {
				fullCache = JSON.parse(stored_data);
			}
			producers.rows.forEach((prod: any, idx) => {
				let cachedPayload = null;
				if (stored_data) {
					cachedPayload = fullCache[prod['owner']];
					if (cachedPayload) {
						if (new Date().getTime() - new Date(cachedPayload.lastUpdate).getTime() > expiration) {
							// Expired
							requestQueue.push({producer: prod, index: idx});
						} else {
							// Load from cache
							this.bps[idx] = cachedPayload['meta'];
							if (idx < 21) {
								this.bps[idx]['status'] = 'producing';
							} else {
								this.bps[idx]['status'] = 'standby';
							}
							if (idx < 50) {
								this.addPin(this.bps[idx]);
							}
						}
					} else {
						// New entry
						requestQueue.push({producer: prod, index: idx});
					}
				} else {
					// New entry
					requestQueue.push({producer: prod, index: idx});
				}
			});
			this.processReqQueue(requestQueue);
		}
	}

	processReqQueue(queue) {
		const filteredBatch = [];
		// console.log('Processing ' + queue.length + ' bp.json requests');
		const filename = '/bp.json';
		queue.forEach((item) => {
			if (item.producer.url !== '') {
				const url = item.producer.url.endsWith('.json') ? item.producer.url : item.producer.url + filename;
				if (url !== '') {
					filteredBatch.push(item);
				}
			}
		});
		// console.log('Fecthing BP.JSON data...');
		this.http.post('http://proxy.eosrio.io:4200/batchRequest', filteredBatch).subscribe((data: any[]) => {
			// Load cache
			let fullCache = JSON.parse(localStorage.getItem('simplEOS.producers.' + this.aService.activeChain.id));
			if (!fullCache) {
				fullCache = {};
			}

			data.forEach((item) => {
				if (item && JSON.stringify(item) !== null) {
					if (item['org']) {
						const org = item['org'];
						let loc = ' - ';
						let geo = [];
						if (org['location']) {
							loc = (org.location.name) ? (org.location.name + ', ' + org.location.country) : (org.location.country);
							geo = [org.location.latitude, org.location.longitude];
						}
						const logo_256 = (org['branding']) ? org['branding']['logo_256'] : '';
						const idx = this.bps.findIndex((el) => {
							return el.account === item['producer_account_name'];
						});
						if (idx !== -1) {
							if (idx < 21) {
								this.bps[idx]['status'] = 'producing';
							} else {
								this.bps[idx]['status'] = 'standby';
							}
							// console.log('POS: ' + this.bps[idx].position + ' | ' + this.bps[idx].name);
							this.bps[idx].name = org['candidate_name'];
							this.bps[idx].account = item['producer_account_name'];
							this.bps[idx].location = loc;
							this.bps[idx].geo = geo;
							this.bps[idx].social = org['social'] || {};
							this.bps[idx].email = org['email'];
							this.bps[idx].website = org['website'];
							this.bps[idx].logo_256 = logo_256;
							this.bps[idx].code = org['code_of_conduct'];
							this.bps[idx].chainId = this.aService.activeChain.id;
							if (idx < 50) {
								this.addPin(this.bps[idx]);
							}
							// Add to cache
							// const payload =
							fullCache[item['producer_account_name']] = {
								lastUpdate: new Date(),
								meta: this.bps[idx],
								source: item.url
							};
						}
					}
				}
			});
			// Save cache
			localStorage.setItem('simplEOS.producers.' + this.aService.activeChain.id, JSON.stringify(fullCache));
		});
	}

	async listProxies() {
		if (!this.initListProx && !this.loadingProxs && this.aService.selected.getValue().name) {
			this.loadingProds = true;
			this.proxies = [];
			const myAccount = this.aService.selected.getValue();
			if (this.aService.activeChain.historyApi !== '') {
				const url = this.aService.activeChain.historyApi + '/state/get_voters?proxy=true&skip=0&limit=' + this.maxProxies;

				await new Promise(resolve => {
					this.http.get(url).toPromise().then((result) => {
						this.hasList = result['voters'].length > 0;
						// console.log('ListProxies returned ' + result['voters'].length + ' proxies');
						// Pass 1 - Add accounts
						// console.log(myAccount);
						result['voters'].forEach((item, idx) => {
							let voted;
							if (myAccount.details['voter_info']) {
								voted = myAccount.details['voter_info']['proxy'].indexOf(item['account']) !== -1;
							} else {
								voted = false;
							}

							// const vote_pct: any = Math.round((100 * item['total_votes'] / total_votes) * 1000) / 1000;
							const a = (moment().unix() - 946684800);
							const b = parseInt('' + (a / 604800), 10) / 52;
							const totalEos = (item['weight'] / Math.pow(2, b) / 10000);

							const proxiesMetadata = {
								name: '-',
								account: item['account'],
								key: '',
								location: '',
								geo: [],
								position: idx + 1,
								status: '',
								total_votes: VotingService.amountFilter(totalEos, '2') + ' ' + this.aService.activeChain['symbol'],
								social: {steemit: '', telegram: '', twitter: '', wechat: ''},
								website: '',
								logo_256: '',
								checked: voted,
								chainId: this.aService.activeChain.id,
								philosophy: '',
								background: '',
								slogan: '',
								weight: item['weight'],
								reg: false
							};
							this.proxies.push(proxiesMetadata);
							resolve(this.proxies[idx]);
						});
					});

				});
			} else {
				await this.eosjs.getProxies(this.aService.activeChain['proxyRegistry']).then(proxy => {
					this.hasList = proxy.rows.length > 0;
					console.log('ListProxies returned ' + proxy.rows.length + ' proxies');
					proxy.rows.forEach((prox, idx) => {
						let voted;
						if (myAccount.details['voter_info']) {
							voted = myAccount.details['voter_info']['proxy'].indexOf(prox['owner']) !== -1;
						} else {
							voted = false;
						}

						// const vote_pct: any = Math.round((100 * item['total_votes'] / total_votes) * 1000) / 1000;
						const a = (moment().unix() - 946684800);
						const b = parseInt('' + (a / 604800), 10) / 52;
						const totalEos = (prox['total_votes'] / Math.pow(2, b) / 10000);

						const proxiesMetadata = {
							name: prox['owner'],
							account: prox['owner'],
							key: '',
							location: '',
							geo: [],
							position: idx + 1,
							status: '',
							total_votes: VotingService.amountFilter(totalEos, '2') + ' ' + this.aService.activeChain['symbol'],
							social: {steemit: prox.steemit, telegram: prox.telegram, twitter: prox.twitter, wechat: prox.wechat},
							website: prox.website,
							logo_256: prox.logo_256,
							checked: voted,
							chainId: this.aService.activeChain.id,
							philosophy: prox.philosophy,
							background: prox.background,
							slogan: prox.slogan,
							weight: prox['total_votes'],
							reg: true
						};
						this.proxies.push(proxiesMetadata);
					});
				}).catch(err => {
					console.log(err);
					this.hasList = false;
				});

			}


			this.initListProx = true;
			this.listReady.next(true);
			this.loadingProxs = false;
			// Pass 2 - Enhance metadata

			this.activeCounter = 50;

			// Cache expires in 6 hours
			const expiration = (1000 * 60 * 60 * 6);

			const requestQueue = [];
			let fullCache = {};

			// Load cached data, single entry per chain
			const path = 'simplEOS.proxies.' + this.aService.activeChain.id;
			const stored_data = localStorage.getItem(path);

			if (stored_data) {
				fullCache = JSON.parse(stored_data);
			}

			this.proxies.forEach((prox, idx) => {
				let cachedPayload = null;
				if (stored_data) {
					cachedPayload = fullCache[prox['account']];
					// console.log(prox,fullCache[prox['account']]);
					if (cachedPayload) {
						if (new Date().getTime() - new Date(cachedPayload.lastUpdate).getTime() > expiration) {
							// Expired
							console.log('expired', expiration);
							requestQueue.push({proxy: prox['account'], index: idx});
						} else if (this.proxies[idx].checked !== cachedPayload['meta']['checked']) {
							// Load from cache
							cachedPayload['meta']['checked'] = this.proxies[idx].checked;
							this.proxies[idx] = cachedPayload['meta'];
						} else {
							// Load from cache
							this.proxies[idx] = cachedPayload['meta'];
						}
					} else {
						// New entry
						requestQueue.push({proxy: prox['account'], index: idx});
					}
				} else {
					// New entry
					console.log('listar hyperion novo');
					requestQueue.push({proxy: prox['account'], index: idx});
				}
			});
			// console.log(requestQueue);
			// console.log(requestQueue.length);
			if (requestQueue.length > 0) {
				this.processReqQueueProxy(requestQueue).then(() => {
					console.log('success');
				}).catch(err => {
					console.log('error', err);
				});
			}


			// Load cache


			// Save cache
			// localStorage.setItem('simplEOS.proxies.' + this.aService.activeChain.id, JSON.stringify(fullCache));
		}
	}

	async processReqQueueProxy(queue) {
		const proxies = await this.eosjs.getProxies(this.aService.activeChain['proxyRegistry']);
		// Load cache
		let fullCache = JSON.parse(localStorage.getItem('simplEOS.proxies.' + this.aService.activeChain.id));
		if (!fullCache) {
			fullCache = {};
		}
		queue.forEach(prox => {
			const idx = this.proxies.findIndex((el) => el.account === prox['proxy']);
			if (idx !== -1 && idx !== undefined) {
				fullCache[prox['proxy']] = {
					lastUpdate: new Date(),
					meta: this.proxies[idx]
				};
			}
		});

		proxies.rows.forEach((prox) => {
			const idx = queue.findIndex((el) => el.proxy === prox['owner']);
			if (idx !== -1 && idx !== undefined) {
				this.proxies[idx].name = prox['name'];
				this.proxies[idx].account = prox['owner'];
				this.proxies[idx].key = '';
				this.proxies[idx].location = '';
				this.proxies[idx].geo = [];
				this.proxies[idx].status = '';
				this.proxies[idx].social = {steemit: prox.steemit, telegram: prox.telegram, twitter: prox.twitter, wechat: prox.wechat};
				this.proxies[idx].website = prox.website;
				this.proxies[idx].logo_256 = prox.logo_256;
				this.proxies[idx].philosophy = prox.philosophy;
				this.proxies[idx].background = prox.background;
				this.proxies[idx].slogan = prox.slogan;
				this.proxies[idx].reg = true;

				// Add to cache
				fullCache[prox['owner']] = {
					lastUpdate: new Date(),
					meta: this.proxies[idx]
				};

			}
		});
		localStorage.setItem('simplEOS.proxies.' + this.aService.activeChain.id, JSON.stringify(fullCache));
	}

	addPin(bp) {
		if (bp.geo.length === 2) {
			const name = bp['name'];
			const account = bp['account'];
			const lat = bp['geo'][0];
			const lon = bp['geo'][1];
			if ((lon < 180 && lon > -180) && (lat < 90 && lat > -90)) {
				if (this.data.length < 50) {
					if (this.data.findIndex(o => o.owner === account) === -1) {
						this.data.push({
							name: name,
							owner: account,
							symbol: (bp['status'] === 'standby') ? 'circle' : 'diamond',
							symbolSize: (bp['status'] === 'standby') ? 8 : 10,
							itemStyle: {
								color: (bp['status'] === 'standby') ? '#feff4b' : '#6cff46',
								borderWidth: 0
							},
							value: [lon, lat],
							location: bp['location'],
							position: bp['position'],
							status: bp['status']
						});
					}
					this.updateOptions = {
						series: [{
							data: this.data
						}]
					};
				}
			}
		}
	}
}
