import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {EOSJSService} from './eosjs.service';
import {Observable, Subject, Subscription} from 'rxjs';
import {AccountsService} from './accounts.service';

@Injectable({
	providedIn: 'root'
})
export class VotingService {

	public bps: any[];
	public listReady = new Subject<Boolean>();
	public counter = new Subject<Number>();
	selectedAccount: any;
	initList: boolean;
	totalActivatedStake: number;
	totalProducerVoteWeight: number;
	chainActive: boolean;
	stakePercent: number;
	activeCounter = 50;
	isOnline: boolean;

	lastState: boolean;
	lastChain: string;
	lastAcc: string;

	loadingProds = false;

	// map
	data: any[];
	updateOptions: any;

	accountSubscriber: Subscription;

	constructor(private eos: EOSJSService, private http: HttpClient, private aService: AccountsService) {
		this.bps = [];
		this.data = [];
		this.initList = false;
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
				console.log('ONLINE VALUE:', value);
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

	callLoader() {
		console.log('attempt to load BPs', this.aService.selected.getValue().name, this.isOnline);
		if (this.aService.selected.getValue().name && this.isOnline) {
			this.listProducers();
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

	async listProducers() {
		console.log(this.aService.selected.getValue().name, this.initList, this.loadingProds);
		if (!this.initList && !this.loadingProds && this.aService.selected.getValue().name) {
			this.loadingProds = true;

			const producers = await this.eos.listProducers();
			console.log('ListProducers returned ' + producers.rows.length + ' producers');
			const global_data = await this.eos.getChainInfo();

			this.totalProducerVoteWeight = parseFloat(global_data.rows[0]['total_producer_vote_weight']);
			const total_votes = this.totalProducerVoteWeight;

			// Pass 1 - Add accounts
			const myAccount = this.aService.selected.getValue();
			this.bps = [];

			producers.rows.forEach((prod: any, idx) => {
				const vote_pct: any = Math.round((100 * prod['total_votes'] / total_votes) * 1000) / 1000;
				let voted;
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
					total_votes: vote_pct + '%',
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
		console.log('Processing ' + queue.length + ' bp.json requests');
		const filename = '/bp.json';
		queue.forEach((item) => {
			if (item.producer.url !== '') {
				const url = item.producer.url.endsWith('.json') ? item.producer.url : item.producer.url + filename;
				if (url !== '') {
					filteredBatch.push(item);
				}
			}
		});
		console.log('Fecthing BP.JSON data...');
		this.http.post('http://proxy.eosrio.io:4200/batchRequest', filteredBatch).subscribe((data: any[]) => {
			// Load cache
			let fullCache = JSON.parse(localStorage.getItem('simplEOS.producers.' + this.aService.activeChain.id));
			if (!fullCache) {
				fullCache = {};
			}

			console.log(data.length);
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
							const payload = {
								lastUpdate: new Date(),
								meta: this.bps[idx],
								source: item.url
							};
							fullCache[item['producer_account_name']] = payload;
						}
					}
				}
			});
			// Save cache
			localStorage.setItem('simplEOS.producers.' + this.aService.activeChain.id, JSON.stringify(fullCache));
		});
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
