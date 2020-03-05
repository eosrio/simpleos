import {AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit,} from '@angular/core';
import {VotingService} from '../../services/voting.service';
import {AccountsService} from '../../services/accounts.service';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {BodyOutputType, Toast, ToasterConfig, ToasterService,} from 'angular2-toaster';
import {createNumberMask} from 'text-mask-addons/dist/textMaskAddons';
import {CryptoService} from '../../services/crypto/crypto.service';
import {HttpClient} from '@angular/common/http';

import * as moment from 'moment';
import {Subscription} from 'rxjs';

import {Eosjs2Service} from '../../services/eosio/eosjs2.service';
import {RexComponent} from '../rex/rex.component';
import {AppComponent} from '../../app.component';
import {ThemeService} from '../../services/theme.service';
import {TransactionFactoryService} from '../../services/eosio/transaction-factory.service';
import {ElectronService} from 'ngx-electron';
import {JsSignatureProvider} from 'eosjs/dist/eosjs-jssig';
import {SortEvent} from 'primeng/api';
import {Api, RpcError} from 'eosjs';

@Component({
	selector: 'app-vote',
	templateUrl: './vote.component.html',
	styleUrls: ['./vote.component.css'],
})
export class VoteComponent implements OnInit, OnDestroy, AfterViewInit {

	max: number;
	min: number;
	minstake: boolean;
	busyList: boolean;
	hasRex: boolean;
	hasVote: boolean;

	valuetoStake: string;
	percenttoStake: string;
	minToStake = 0.01;
	unstaking: number;
	unstakeTime: string;
	stakeModal: boolean;
	voteModal: boolean;
	isValidAccount: boolean;
	nVotes = 0;
	nVotesProxy = 0;
	busy: boolean;
	totalBalance: number;
	stakedBalance: number;
	totalStaked: number;
	votedEOSDecay: number;
	votedDecay: number;
	singleSelectionBP: any;
	selectedVotes: any[];
	wrongpass: string;
	frmForProxy: FormGroup;
	passForm: FormGroup;
	passFormStake: FormGroup;
	config: ToasterConfig;
	numberMask = createNumberMask({
		prefix: '',
		allowDecimal: true,
		includeThousandsSeparator: false,
		decimalLimit: this.aService.activeChain['precision'],
	});
	percentMask = createNumberMask({
		prefix: '',
		allowDecimal: true,
		includeThousandsSeparator: false,
		decimalLimit: 1,
		integerLimit: 3,
	});
	stakingDiff: number;
	stakingHRV: string;
	stakerr: string;
	stakedisabled: boolean;
	fromAccount: string;
	nbps: number;
	showAdvancedRatio = false;

	location: string[];
	country: string[];
	options: any;

	initOptions = {
		renderer: 'z',
		width: 1000,
		height: 400,
	};

	net_weight = '';
	cpu_weight = '';
	cpu_weight_n = 0;
	net_weight_n = 0;
	stakingRatio = 75;

	listProxyVote = [];

	subscriptions: Subscription[] = [];

	private selectedProxy = '';
	private ecc: any;

	private keytar: any;
	private fs: any;
	autoClaimStatus: boolean;

	claimPublicKey = '';
	private isDestroyed = false;
	public claimError: string;
	public gbmBalance = 0;
	public gbmLastClaim: string;
	public gbmNextClaim: string;
	public claimReady: boolean;
	public gbmEstimatedDaily = 0;
	public voteRewardsDaily = 0;
	private autoClaimConfig = {};
	private selectedAccountName = '';
	private last_claim_time: number;
	public claimSetupWarning = '';
	public basePath = '';
	enableAutoClaim: boolean;
	enableLinkAuth: boolean;

	precision = '';

	mode = 'local';

	constructor(
		public voteService: VotingService,
		private http: HttpClient,
		private trxFactory: TransactionFactoryService,
		public aService: AccountsService,
		public eosjs: Eosjs2Service,
		public crypto: CryptoService,
		private fb: FormBuilder,
		private toaster: ToasterService,
		private cdr: ChangeDetectorRef,
		public app: AppComponent,
		public theme: ThemeService,
		private _electronService: ElectronService,
		// private ledger: LedgerHWService
	) {

		this.ecc = this._electronService.remote.require('eosjs-ecc');
		this.keytar = this._electronService.remote.require('keytar');
		this.fs = this._electronService.remote.require('fs');

		this.basePath = this._electronService.remote.app.getPath('appData') +
			'/simpleos-config';

		this.isValidAccount = true;
		this.max = 100;
		this.min = 0;
		this.minstake = false;
		this.busyList = false;
		this.valuetoStake = '';
		this.percenttoStake = '';
		this.unstaking = 0;
		this.unstakeTime = '';
		this.stakeModal = false;
		this.voteModal = false;
		this.busy = false;
		this.totalBalance = 0;
		this.stakedBalance = 0;
		this.totalStaked = 0;
		this.votedDecay = 0;
		this.votedEOSDecay = 0;
		this.wrongpass = '';
		this.stakerr = '';
		this.fromAccount = '';
		this.stakedisabled = true;
		this.autoClaimStatus = false;
		this.enableLinkAuth = true;
		this.singleSelectionBP = {
			name: '',
		};
		this.selectedVotes = [];
		this.frmForProxy = this.fb.group({
			proxyName: ['', [Validators.required]],
		});
		this.passForm = this.fb.group({
			pass: ['', [Validators.required, Validators.minLength(4)]],
		});
		this.passFormStake = this.fb.group({
			pass: ['', [Validators.required, Validators.minLength(4)]],
		});

		this.subscriptions.push(
			this.aService.lastUpdate.asObservable().subscribe(value => {
				if (value.account === this.aService.selected.getValue().name) {
					this.updateBalances();
				}
			}));

		this.options = {
			geo: {
				map: 'world',
				roam: false,
				left: 0,
				right: 0,
				silent: true,
				aspectScale: 1,
				itemStyle: {
					normal: {
						borderColor: '#1076a1',
						color: '#17181c',
					},
				},
			},
			tooltip: {
				formatter: (params) => '<strong>' + params['data']['location'] +
					'</strong><br> Rank: ' + params['data']['position'] +
					'<br> Status:  ' + params['data']['status'],
			},
			animationDuration: 1500,
			animationEasingUpdate: 'quinticInOut',
			series: [
				{
					type: 'graph',
					coordinateSystem: 'geo',
					symbol: 'pin',
					symbolSize: 15,
					data: this.voteService.data,
					animation: true,
					animationDuration: 2000,
					focusNodeAdjacency: true,
					itemStyle: {
						normal: {
							borderColor: '#fff',
							borderWidth: 1,
							shadowBlur: 10,
							color: '#fff',
							shadowColor: 'rgba(0, 0, 0, 0.3)',
						},
					},
					label: {
						position: 'top',
						formatter: '{b}',
						show: false,
						distance: 6,
						fontSize: 16,
					},
					lineStyle: {
						color: 'source',
						curveness: 0.01,
						width: 2,
					},
					force: {
						repulsion: 600,
						edgeLength: 150,
					},
					emphasis: {
						lineStyle: {
							width: 10,
						},
					},
				},
			],
		};
	}

	ngOnInit() {
		const selectedAcc = this.aService.selected.getValue();
		if (this.aService.activeChain.features['vote']) {
			this.setCheckListVote(selectedAcc.name);
		}
		this.getCurrentStake();
	}

	ngOnDestroy(): void {
		this.isDestroyed = true;
		this.voteService.proxies = [];
		this.voteService.bps = [];
		this.subscriptions.forEach(s => {
			s.unsubscribe();
		});
	}

	ngAfterViewInit(): void {
		console.log(this.aService.activeChain['name'].indexOf('LIBERLAND'));
		this.subscriptions.push(
			this.aService.selected.asObservable().subscribe((selected: any) => {
				this.totalStaked = 0;
				this.votedDecay = 0;
				this.votedEOSDecay = 0;
				if (selected && selected['name'] && this.selectedAccountName !==
					selected['name']) {
					const precision = Math.pow(10, this.aService.activeChain['precision']);
					this.precision = '1.0-' + this.aService.activeChain['precision'];
					if (this.aService.activeChain['name'].indexOf('LIBERLAND') === -1) {
						this.voteService.currentVoteType(selected);
						if (this.voteService.proxies.length === 0 ||
							this.voteService.bps.length === 0) {
							// console.log('from subscriber', this.voteService.voteType);
							this.voteOption(this.voteService.voteType);
						}
					}

					this.fromAccount = selected.name;
					this.selectedAccountName = selected.name;
					this.totalBalance = selected.full_balance;
					if (this.aService.activeChain['name'].indexOf('LIBERLAND') === -1) {
						this.stakedBalance = selected.staked;
					} else {
						this.stakedBalance = selected.details.voter_info.staked / precision;
					}
					this.unstaking = selected.unstaking;
					this.unstakeTime = moment.utc(selected.unstakeTime).add(72, 'hours').fromNow();
					if (this.totalBalance > 0) {
						this.minToStake = 100 / this.totalBalance;
						this.valuetoStake = this.stakedBalance.toString();
					} else {
						this.minToStake = 0;
						this.valuetoStake = '0';
						this.percenttoStake = '0';
					}
					this.updateStakePercent();
					if (this.aService.activeChain['name'].indexOf('LIBERLAND') === -1) {
						this.loadPlacedVotes(selected);
						this.cpu_weight = selected.details.total_resources.cpu_weight;
						this.net_weight = selected.details.total_resources.net_weight;
						const _cpu = RexComponent.asset2Float(this.cpu_weight);
						const _net = RexComponent.asset2Float(this.net_weight);
						this.cpu_weight_n = _cpu;
						this.net_weight_n = _net;
						this.stakingRatio = (_cpu / (_cpu + _net)) * 100;


						if (selected.details.voter_info) {
							let weeks = 52;
							let block_timestamp_epoch = 946684800;
							let precision = Math.pow(10,
								this.aService.activeChain['precision']);
							if (this.aService.activeChain['symbol'] === 'WAX') {
								weeks = 13;
								block_timestamp_epoch = 946684800;
							}
							// console.log(selected.details.voter_info.producers, selected.details.voter_info.proxy);
							this.hasVote = (selected.details.voter_info.producers.length >
								0 || selected.details.voter_info.proxy !== '');
							this.totalStaked = (selected.details.voter_info.staked /
								precision);
							const a = (moment().unix() - block_timestamp_epoch);
							const b = parseInt('' + (a / 604800), 10) / weeks;
							const decayEOS = (selected.details.voter_info.last_vote_weight /
								Math.pow(2, b) / precision);
							this.votedEOSDecay = this.totalStaked - decayEOS;
							if (selected.details.voter_info.last_vote_weight > 0) {
								this.votedDecay = 100 -
									Math.round(((decayEOS * 100) / this.totalStaked) * 1000) /
									1000;
							}
						}
					} else {
						this.hasVote = false;
					}
					this.getRexBalance(selected.name);
					if (this.aService.activeChain['name'] === 'WAX MAINNET') {
						this.checkWaxGBMdata(selected.name).catch(console.log);
						this.checkVoterRewards(selected.name).catch(console.log);
						this.verifyAutoClaimSetup(selected).catch(console.log);
						this.enableAutoClaim = this.edAutoClaim(true);
					}
					if (!this.isDestroyed) {
						this.cdr.detectChanges();
					}
				}
			}));
		setImmediate(() => {
			// console.log('after view init');
			// console.log(this.voteService.bps.length, this.voteService.proxies.length);
			if (this.voteService.proxies.length === 0 ||
				this.voteService.bps.length === 0) {
				// console.log('from after view init', this.voteService.voteType);
				this.voteOption(this.voteService.voteType);
			}
			// this.cdr.detectChanges();
		});
	}

	extOpen(value) {
		window['shell']['openExternal'](value);
	}

	sliderLabel(value: number): string {
		const val = parseInt(value.toString(), 10);
		return val.toString();
	}

	updateRatio() {
		console.log(this.stakingRatio);
	}

	setStake() {
		this.stakerr = '';
		const precisionVal = this.aService.activeChain['precision'];
		const precision = Math.pow(10, this.aService.activeChain['precision']);

		const prevStake = Math.round(this.aService.selected.getValue().staked * precision);
		console.log(this.aService.selected.getValue().details.voter_info.staked / precision);
		const nextStakeFloat = parseFloat(this.valuetoStake);
		const nextStakeInt = Math.round(nextStakeFloat * precision);
		const diff = nextStakeInt - prevStake;
		this.stakingDiff = diff;
		this.stakingHRV = (Math.abs(this.stakingDiff) / precision).toFixed(precisionVal) + ' ' + this.aService.activeChain['symbol'];
		this.wrongpass = '';
		console.log(diff);
		if (diff !== 0) {
			this.newSetStake().catch(console.log);
		} else {
			this.stakerr = 'Value has not changed';
		}

	}

	async newSetStake() {
		this.busy = true;
		this.wrongpass = '';
		const account = this.aService.selected.getValue();
		const precisionVal = this.aService.activeChain['precision'];
		this.wrongpass = '';

		// Transaction Signature
		const [auth, publicKey] = this.trxFactory.getAuth();

		this.mode = this.crypto.getPrivateKeyMode(publicKey);

		let actionTitle = ``;
		let html = ``;
		let action = '';
		if (this.stakingDiff > 0) {
			action = 'stake';
			html = `<h5 class="mt-0">After staking, this tokens will be locked for at least 3 days.</h5>`;
			actionTitle = `Stake <span class="blue">+${this.stakingHRV}</span> ?`;
		} else if (this.stakingDiff < 0) {
			action = 'unstake';
			html = `<h5 class="mt-0">Your tokens will be free for transfers after 3 days.</h5>`;
			actionTitle = `Unstake <span class="blue">${this.stakingHRV}</span> ?`;
		}

		const messageHTML = ` <h4 class="text-white">Total staked will be: <span class="blue">${parseFloat(this.valuetoStake).toFixed(precisionVal)}</span></h4>
            <h4 class="text-white mt-0">Voting power will be: <span class="blue">${parseFloat(this.percenttoStake).toFixed(2)}%</span></h4>
            ${html}`;

		const [, permission] = this.aService.getStoredKey(account);
		let trx = {};
		if (this.aService.activeChain['name'].indexOf('LIBERLAND') === -1) {
			try {
				const actions = await this.eosjs.changebw(
					account.name,
					permission,
					this.stakingDiff,
					this.aService.activeChain['symbol'],
					this.stakingRatio / 100,
					this.aService.activeChain['precision'],
				);
				trx = {actions: actions};
				console.log(actions);
			} catch (e) {
				console.log(e);
			}
		} else {
			trx = {
				actions: [{
					account: 'eosio',
					name: action,
					authorization: [auth],
					data: {
						'acnt': account.name,
						'quantity': this.stakingHRV,
					}
				}]
			};
		}

		console.log(trx);
		this.trxFactory.modalData.next({
			transactionPayload: trx,
			signerAccount: auth.actor,
			signerPublicKey: publicKey,
			actionTitle: actionTitle,
			labelHTML: messageHTML,
			termsHeader: '',
			termsHTML: ''
		});
		this.trxFactory.launcher.emit({visibility: true, mode: this.mode});
		const subs = this.trxFactory.status.subscribe((event) => {
			console.log(event);
			if (event === 'done') {
				setTimeout(() => {
					this.aService.refreshFromChain(false).then(() => {
						this.cpu_weight = this.aService.selected.getValue().details.total_resources.cpu_weight;
						this.net_weight = this.aService.selected.getValue().details.total_resources.net_weight;
					});
				}, 1500);
				subs.unsubscribe();
			}
			if (event === 'modal_closed') {
				subs.unsubscribe();
			}
		});
	}

	async callSetStake(password) {
		this.busy = true;
		const account = this.aService.selected.getValue();
		const [pubkey, permission] = this.aService.getStoredKey(account);
		try {
			const authData = await this.crypto.authenticate(password, pubkey);
			if (authData === true) {
				try {
					const trx = await this.eosjs.changebw(
						account.name,
						permission,
						this.stakingDiff,
						this.aService.activeChain['symbol'],
						this.stakingRatio / 100,
						this.aService.activeChain['precision'],
					);
					console.log(trx);
					this.busy = false;
					this.wrongpass = '';
					this.stakeModal = false;
					this.cdr.detectChanges();
					this.showToast('success', 'Transaction broadcasted',
						'Check your history for confirmation.');
					setTimeout(() => {
						this.aService.refreshFromChain(false).then(() => {
							this.cpu_weight = this.aService.selected.getValue().details.total_resources.cpu_weight;
							this.net_weight = this.aService.selected.getValue().details.total_resources.net_weight;
						});
					}, 1500);
				} catch (error) {
					console.log(error.json.error.details[0].message);
					if (typeof error === 'object') {
						this.wrongpass = error.json.error.details[0].message;
					} else {
						if (JSON.parse(error).json.error.name === 'leeway_deadline_exception') {
							this.wrongpass = 'Not enough CPU bandwidth to perform transaction. Try again later.';
						} else {
							this.wrongpass = JSON.parse(error).json.error.details[0].message;
						}
					}
					this.busy = false;
				}
			} else {
				this.wrongpass = 'Wrong password!';
				this.busy = false;
			}
		} catch (e) {
			this.busy = false;
			this.wrongpass = 'Wrong password!';
		}
	}

	updateBalances() {
		const selectedAcc = this.aService.selected.getValue();
		this.totalBalance = selectedAcc.full_balance;
		this.stakedBalance = selectedAcc.staked;
		if (selectedAcc.details.voter_info) {

			let weeks = 52;
			let block_timestamp_epoch = 946684800;
			const precision = Math.pow(10, this.aService.activeChain['precision']);
			if (this.aService.activeChain['symbol'] === 'WAX') {
				weeks = 13;
				block_timestamp_epoch = 946684800;
			}

			this.hasVote = true;
			this.totalStaked = (selectedAcc.details.voter_info.staked / precision);
			const a = (moment().unix() - block_timestamp_epoch);
			const b = parseInt('' + (a / 604800), 10) / weeks;
			const decayEOS = (selectedAcc.details.voter_info.last_vote_weight /
				Math.pow(2, b) / precision);
			this.votedEOSDecay = this.totalStaked - decayEOS;
			if (selectedAcc.details.voter_info.last_vote_weight > 0) {
				this.votedDecay = 100 -
					Math.round(((decayEOS * 100) / this.totalStaked) * precision) /
					precision;
			}
		} else {
			this.hasVote = false;
		}

		this.getRexBalance(selectedAcc.name);
	}

	getRexBalance(acc) {
		if (this.aService.activeChain.features['rex']) {
			this.eosjs.getRexData(acc).then(async (rexdata) => {
				this.hasRex = !rexdata.rexbal;
			});
		} else {
			this.hasRex = false;
		}
	}

	storeConfig() {
		try {
			const filename = this.basePath + '/autoclaim.json';
			const data = JSON.stringify(this.autoClaimConfig, null, '\t');
			this.fs.writeFileSync(filename, data);
		} catch (e) {
			console.log(e);
		}

	}

	edAutoClaim(check?) {
		try {
			const filename = this.basePath + '/autoclaim.json';
			if (this.fs.existsSync(filename)) {
				const data = JSON.parse(this.fs.readFileSync(filename));
				if (check) {
					return data['enabled'];
				}
				data['enabled'] = !(data['enabled']);
				this.enableAutoClaim = data['enabled'];
				this.fs.writeFileSync(filename, JSON.stringify(data, null, '\t'));
			} else {
				const data = JSON.stringify(this.autoClaimConfig, null, '\t');
				this.fs.writeFileSync(filename, data);
			}

		} catch (e) {
			console.log(e);
		}
		this.verifyAutoClaimSetup(this.aService.selected.getValue()).catch(console.log);
	}

	// enableAutoClaimStartup() {
	// 	const AutoLaunch = this._electronService.remote.require('auto-launch');
	// 	const walletAutoLauncher = new AutoLaunch({
	// 		name: 'simpleos'
	// 	});
	// 	walletAutoLauncher.opts.appPath += '" --autostart"';
	// 	walletAutoLauncher.isEnabled().then((isEnabled) => {
	// 		if (isEnabled) {
	// 			return;
	// 		}
	// 		walletAutoLauncher.enable();
	// 	}).catch(function (err) {
	// 		console.log(err);
	// 	});
	// }

	IsJsonString(str) {
		try {
			JSON.parse(str);
		} catch (e) {
			return false;
		}
		return true;
	}

	async verifyAutoClaimSetup(selected) {
		this.autoClaimStatus = false;
		this.claimSetupWarning = '';
		const filename = this.basePath + '/autoclaim.json';
		if (!this.fs.existsSync(filename)) {
			console.log('autoclaim file not present, creating...');
		} else {
			if (this.IsJsonString(this.fs.readFileSync(filename))) {
				this.autoClaimConfig = JSON.parse(this.fs.readFileSync(filename));
			} else {
				this.storeConfig();
			}

		}
		if (this.autoClaimConfig['enabled']) {
			if (this.autoClaimConfig['WAX-GBM']) {
				const accJob = this.autoClaimConfig['WAX-GBM']['jobs'].find(
					j => j.account === selected.name);
				if (accJob) {
					this.eosjs.rpc.get_account(selected.name).then(details => {
						const perms = details.permissions;
						const claim_perm = perms.find(p => p.perm_name === 'claim');
						if (claim_perm) {
							const claim_key = claim_perm.required_auth.keys[0].key;
							this.keytar.getPassword('simpleos', claim_key).then((key) => {
								try {
									if (claim_key === this.ecc.privateToPublic(key)) {
										this.checkLinkedAuth(selected.name).then((req_link) => {
											if (req_link.length === 0) {
												this.autoClaimStatus = true;
												this.claimPublicKey = claim_key;
											} else {
												console.log('Missing link auth');
												this.claimSetupWarning = 'Linkauth missing for (' +
													req_link.join(', ') +
													'). Please renew your claim key or set the permission links manually.';
											}
										});
									} else {
										console.log('FATAL: Invalid key');
									}
								} catch (e) {
									console.log('Key verification failed');
								}
							}).catch((error) => {
								console.log(error);
							});
						} else {
							console.log('Claim permission not defined');
							this.claimSetupWarning = 'Claim permission not defined. Please try renewing your key.';
						}
					});
				}
			}
		} else {
			console.log('autoclaim disabled');
			this.enableAutoClaim = false;
			this.edAutoClaim(false);
			// this.enableAutoClaimStartup();
			// this.autoClaimConfig['enabled'] = true;
			// this.storeConfig();
		}
	}

	//
	// getMyVote(account){
	// 	this.aService.selected.asObservable().subscribe((selected: any) => {
	// 		// const myAccount = selected.selected.getValue();
	// 		// return (myAccount.details['voter_info']['proxy'].indexOf(account) !== -1);
	// 	});
	//
	// }
	//
	getProxyVotes(account) {
		this.listProxyVote = [];
		this.eosjs.getAccountInfo(account).then(v => {
			if (v['voter_info']) {
				this.listProxyVote = v['voter_info']['producers'];
			}
		});
	}

	setCheckListVote(selAcc) {
		this.subscriptions.push(
			this.voteService.listReady.asObservable().subscribe((state) => {
				if (state) {
					this.updateCounter();
					if (this.voteService.voteType) {
						this.nbps = this.voteService.proxies.length;
					} else {
						this.nbps = this.voteService.bps.length;
					}
				}
			}),
		);
		this.aService.accounts.forEach((a) => {
			if (a) {
				if (a.name === selAcc) {
					if (a.details['voter_info']) {
						if (!this.voteService.voteType) {
							const currentVotes = a.details['voter_info']['producers'];
							this.voteService.bps.forEach((elem) => {
								elem.checked = currentVotes.indexOf(elem.account) !== -1;
							});
						} else {
							const currentVotes = a.details['voter_info']['proxy'];
							this.voteService.proxies.forEach((elem) => {
								elem.checked = currentVotes.indexOf(elem.account) !== -1;
							});
						}
					} else {
						// this.voteService.proxies.forEach((elem) => {
						// 	elem.checked = false;
						// });
					}
				}
			}
		});
	}

	getCurrentStake() {
		if (this.totalBalance > 0) {
			this.percenttoStake = ((this.stakedBalance / this.totalBalance) *
				100).toString();
		}
		this.valuetoStake = this.stakedBalance.toString();
	}

	updateStakeValue() {
		this.stakedisabled = false;
		this.minstake = false;
		this.valuetoStake = (this.totalBalance *
			(parseFloat(this.percenttoStake) / 100)).toString();
		if (this.valuetoStake === '1') {
			this.minstake = true;
		}
	}

	updateStakePercent() {
		this.stakedisabled = false;
		if (this.totalBalance > 0) {
			this.percenttoStake = ((parseFloat(this.valuetoStake) * 100) /
				this.totalBalance).toString();
		}
	}

	checkPercent() {
		this.minstake = false;
		let min;
		if (this.totalBalance > 0) {
			min = 100 / this.totalBalance;
		} else {
			min = 0;
		}
		if (parseFloat(this.percenttoStake) <= min) {
			this.percenttoStake = min.toString();
			this.updateStakeValue();
			this.minstake = true;
		}
		if (parseFloat(this.percenttoStake) > 100) {
			this.percenttoStake = '100';
			this.updateStakeValue();
		}
	}

	checkValue() {
		this.minstake = false;
		if (parseFloat(this.valuetoStake) <= 1) {
			this.valuetoStake = '1';
			this.updateStakePercent();
			this.minstake = true;
		}
		if (parseFloat(this.valuetoStake) > this.totalBalance) {
			this.valuetoStake = this.totalBalance.toString();
			this.updateStakePercent();
		}
	}

	processVotes() {
		this.selectedVotes = [];
		if (this.voteService.voteType && !this.voteService.hasList) {
			this.selectedVotes = [this.selectedProxy];
		} else {
			if (this.voteService.voteType) {
				// this.selectedPxs = [];
				this.voteService.proxies.forEach((px) => {
					if (px.checked) {
						this.selectedVotes.push(px.account);
					}
					// this.selectedPxs.push(px.account);

				});
				this.getProxyVotes(this.selectedVotes[0]);
			} else {
				// this.selectedBPs = [];
				this.voteService.bps.forEach((bp) => {
					if (bp.checked) {
						// this.selectedBPs.push(bp.account);
						this.selectedVotes.push(bp.account);
					}
				});
			}
		}
		// this.passForm.reset();
		// this.wrongpass = '';
		// this.voteModal = true;
		this.setVote();
	}

	updateCounter() {
		let val = 0;
		this.voteService.bps.forEach((bp) => {
			if (bp.checked) {
				val++;
			}
		});
		this.nVotes = val;
	}

	updateCounterProxy(proxy) {
		this.voteService.proxies.forEach((px) => {
			px.checked = px.account === proxy;
		});
		this.nVotes = 1;
	}

	setVote() {

		const voter = this.aService.selected.getValue();
		let proxy = '';
		let currentVotes = [];
		if (this.selectedVotes.length <= 30) {
			if (!this.voteService.voteType) {
				currentVotes = this.selectedVotes;
				currentVotes.sort();
			} else {
				proxy = this.selectedVotes[0];
			}
		} else {
			return new Error('Cannot cast more than 30 votes!');
		}

		// Transaction Signature
		const [auth, publicKey] = this.trxFactory.getAuth();
		this.mode = this.crypto.getPrivateKeyMode(publicKey);

		let termsHeader = '';
		let termsHtml = '';

		const actionTitle = `<span class="blue">vote</span>`;

		const messageHTML = `<h4 class="text-white">Do you confirm voting on the following ${this.voteService.voteType ? 'Proxy' : 'BPs'}?</h4>
        <h5 class="mt-0">${this.selectedVotes.join(', ')}</h5>`;

		if (this.aService.activeChain.name === 'EOS MAINNET') {
			termsHeader = 'By submiting this action, you agree to the voteproducer Terms & Conditions';
			termsHtml = ` The intent of the voteproducer action is to cast a valid vote for up to 30 BP candidates.
                <br><br>
                As an authorized party I, <span class="blue">${this.fromAccount}</span>, wish to vote on behalf of <span class="blue">${this.fromAccount}</span> in favor of the
                block
                producer candidates <span class="blue">${this.selectedVotes.join(', ')}</span> with
                a voting weight equal to all tokens currently owned
                by <span class="blue">${this.fromAccount}</span> and staked for CPU or bandwidth.
                <br><br>
                If I am not the beneficial owner of these shares I stipulate I have proof that I’ve been authorized to
                vote
                these shares by their beneficial owner(s).
                <br><br>
                I stipulate I have not and will not accept anything of value in exchange for these votes, on penalty of
                confiscation of these tokens, and other penalties.
                <br><br>
                I acknowledge that using any system of automatic voting, re-voting, or vote refreshing, or allowing such
                a
                system to be used on my behalf or on behalf of another, is forbidden and doing so violates this
                contract.`;
		}


		this.trxFactory.modalData.next({
			transactionPayload: {
				actions: [{
					account: 'eosio',
					name: 'voteproducer',
					authorization: [auth],
					data: {
						'voter': voter.name,
						'proxy': this.voteService.voteType ? proxy : '',
						'producers': this.voteService.voteType ? '' : currentVotes,
					}
				}]
			},
			signerAccount: auth.actor,
			signerPublicKey: publicKey,
			actionTitle: actionTitle,
			labelHTML: messageHTML,
			termsHeader: termsHeader,
			termsHTML: termsHtml
		});

		this.trxFactory.launcher.emit({visibility: true, mode: this.mode});
		const subs = this.trxFactory.status.subscribe((event) => {
			console.log(event);
			if (event === 'done') {
				setTimeout(() => {
					this.aService.refreshFromChain(false).then(() => {
						this.voteOption(this.voteService.voteType);
						this.voteService.currentVoteType(voter.name);
						this.loadPlacedVotes(this.aService.selected.getValue());
						this.setCheckListVote(this.aService.selected.getValue().name);
					}).catch(err => {
						console.log('Refresh From Chain Error:', err);
					});
					// this.aService.select(this.aService.accounts.findIndex(sel => sel.name === voter.name));
				}, 1500);
				subs.unsubscribe();
			}
			if (event === 'modal_closed') {
				subs.unsubscribe();
			}
		});
	}

	loadPlacedVotes(selectedAccount) {
		if (selectedAccount.details['voter_info']) {
			if (!this.voteService.voteType) {
				const currentVotes = selectedAccount.details['voter_info']['producers'];
				this.nVotes = currentVotes.length;
				this.voteService.bps.forEach((elem) => {
					elem.checked = currentVotes.indexOf(elem.account) !== -1;
				});
				this.updateCounter();
			} else {
				const currentVotes = selectedAccount.details['voter_info']['proxy'];
				this.nVotesProxy = currentVotes !== '' ? 1 : 0;
				this.voteService.proxies.forEach((elem) => {
					elem.checked = currentVotes.indexOf(elem.account) !== -1;
				});
			}
		}
	}

	private showToast(type: string, title: string, body: string) {
		this.config = new ToasterConfig({
			positionClass: 'toast-top-right',
			timeout: 5000,
			newestOnTop: true,
			tapToDismiss: true,
			preventDuplicates: false,
			animation: 'slideDown',
			limit: 1,
		});
		const toast: Toast = {
			type: type,
			title: title,
			body: body,
			timeout: 5000,
			showCloseButton: true,
			bodyOutputType: BodyOutputType.TrustedHtml,
		};
		this.toaster.popAsync(toast);
	}

	voteOption(ev) {
		this.busyList = true;
		this.voteService.voteType = ev;
		const acc = this.aService.selected.getValue();
		this.voteService.loadingProds = false;
		this.voteService.loadingProxs = false;
		this.voteService.initList = false;
		this.voteService.initListProx = false;
		if (this.voteService.voteType === 0) {
			this.voteService.listProducers().then(() => {
				this.busyList = false;
				this.setCheckListVote(acc.name);
				this.loadPlacedVotes(acc);
				if (!this.cdr['destroyed']) {
					this.cdr.detectChanges();
				}
			}).catch(err => {
				console.log('Load Account List Producers Error:', err);
			});
		} else if (this.voteService.voteType === 1) {
			this.voteService.listProxies().then(() => {
				this.busyList = false;
				this.setCheckListVote(acc.name);
				this.loadPlacedVotes(acc);
				if (!this.cdr['destroyed']) {
					this.cdr.detectChanges();
				}
			}).catch(err => {
				console.log('Load Account List Proxies Error:', err);
			});
		}
	}

	validateProxy(account) {
		this.eosjs.getAccountInfo(account).then(() => {
			this.isValidAccount = true;
			this.selectedProxy = account;
			this.processVotes();
		}).catch(() => {
			console.log('error');
			this.isValidAccount = false;
		});
	}

	async checkLinkedAuth(account): Promise<string[]> {
		const result = await this.http.get(
			this.aService.activeChain.historyApi + '/history/get_actions?account=' +
			account + '&filter=eosio:linkauth').toPromise();
		const required = ['claimgbmvote', 'claimgenesis', 'voteproducer'];
		if (result['actions'].length > 0) {
			for (const a of result['actions']) {
				const idx = required.indexOf(a['act']['data']['type']);
				if (idx !== -1) {
					required.splice(idx, 1);
				}
			}
		}
		return required;
	}

	claimGBMrewards() {
		if (this.autoClaimStatus) {
			this.claimDirect(false).catch(console.log);
		} else {
			this.claimWithActive();
		}
	}

	claimWithActive() {
		const [auth, publicKey] = this.trxFactory.getAuth();
		console.log(auth);
		const messageHTML = `
		<h5 class="white mb-0">Performing eosio::claimgenesis and eosio::claimgbmvote actions</h5>
		`;
		const _actions = [];
		_actions.push({
			account: 'eosio',
			name: 'claimgenesis',
			authorization: [auth],
			data: {
				claimer: auth.actor,
			},
		});
		_actions.push({
			account: 'eosio',
			name: 'claimgbmvote',
			authorization: [auth],
			data: {
				owner: auth.actor,
			},
		});
		console.log(_actions);
		this.trxFactory.modalData.next({
			transactionPayload: {
				actions: _actions,
			},
			termsHeader: '',
			signerAccount: auth.actor,
			signerPublicKey: publicKey,
			labelHTML: messageHTML,
			actionTitle: 'claim WAX GBM Rewards',
			termsHTML: '',
			errorFunc: (e) => {
				if (e instanceof RpcError) {
					let eJson;
					if (e.json) {
						eJson = e.json;
					} else {
						eJson = e;
					}
					switch (eJson.error.code) {
						case 3090005: {
							return 'Irrelevant authority included, missing linkauth';

						}
						case 3050003: {
							return 'Account already claimed in the past 24 hours. Please wait.';

						}
						default: {
							return eJson.error.details[0].message;
						}
					}
				}
			},
		});
		this.trxFactory.launcher.emit(true);
		const subs = this.trxFactory.status.subscribe((event) => {
			if (event === 'done') {
				subs.unsubscribe();
			}
			if (event === 'modal_closed') {
				subs.unsubscribe();
			}
			this.cdr.detectChanges();
		});
	}

	async claimDirect(voteOnly) {
		const [auth] = this.trxFactory.getAuth();
		// check current votes
		const accountData = await this.eosjs.rpc.get_account(auth.actor);
		let _producers = [];
		let _proxy = '';
		if (accountData['voter_info']) {
			if (accountData['voter_info']['proxy'] !== '') {
				// voting on proxy
				_proxy = accountData['voter_info']['proxy'];
			} else {
				// voting on producers
				_producers = accountData['voter_info']['producers'];
			}
		}
		const claim_private_key = await this.keytar.getPassword('simpleos',
			this.claimPublicKey);
		const signatureProvider = new JsSignatureProvider([claim_private_key]);
		const rpc = this.eosjs.rpc;
		const api = new Api({
			rpc,
			signatureProvider,
			textDecoder: new TextDecoder,
			textEncoder: new TextEncoder,
		});
		const _actions = [];
		_actions.push({
			account: 'eosio',
			name: 'voteproducer',
			authorization: [
				{
					actor: auth.actor,
					permission: 'claim',
				}],
			data: {
				voter: auth.actor,
				proxy: _proxy,
				producers: _producers,
			},
		});

		if (!voteOnly) {
			_actions.push({
				account: 'eosio',
				name: 'claimgenesis',
				authorization: [
					{
						actor: auth.actor,
						permission: 'claim',
					}],
				data: {
					claimer: auth.actor,
				},
			});

			_actions.push({
				account: 'eosio',
				name: 'claimgbmvote',
				authorization: [
					{
						actor: auth.actor,
						permission: 'claim',
					}],
				data: {
					owner: auth.actor,
				},
			});
		}

		try {
			const result = await api.transact({
				actions: _actions,
			}, {
				blocksBehind: 3,
				expireSeconds: 30,
			});
			this.claimError = '';
			if (voteOnly) {
				this.showToast('success', 'Vote broadcasted',
					'Check your history for confirmation.');
			} else {
				this.showToast('success', 'GBM Rewards Claimed',
					'Check your history for confirmation.');
			}
			console.log(result);
			this.cdr.detectChanges();
		} catch (e) {
			if (e instanceof RpcError) {
				let eJson;
				if (e.json) {
					eJson = e.json;
				} else {
					eJson = e;
				}
				switch (eJson.error.code) {
					case 3090005: {
						this.claimError = 'Irrelevant authority included, missing linkauth';
						break;
					}
					case 3050003: {
						this.claimError = 'Account already claimed in the past 24 hours. Please wait.';
						break;
					}
					default: {
						this.claimError = eJson.error.details[0].message;
					}
				}
				console.log(JSON.stringify(eJson, null, 2));
			}
		}
	}

	toggleLinkAuth() {
		this.enableLinkAuth = !this.enableLinkAuth;
		this.cdr.detectChanges();
	}

	async createClaimPermission() {
		const [auth, publicKey] = this.trxFactory.getAuth();
		const messageHTML = `
		<h5 class="white mb-0">
		This action will create a custom permission that is only allowed to claim rewards (linked with eosio::claimgenesis).
		<br><br> This permission will be automatically called once per day to claim your GBM rewards.
		<br><br> You don't need to leave your wallet open, your computer just needs to be turned on.
		<br><br>This action doesn't expose your private key.  </h5>
		`;

		console.log('Generating new key pair...');

		const private_key = await this.ecc.randomKey();
		const public_key = this.ecc.privateToPublic(private_key);

		const _actions = [];
		let changeKey = true;
		if (auth.permission === 'active' || auth.permission === 'owner') {

			_actions.push({
				account: 'eosio',
				name: 'updateauth',
				authorization: [auth],
				data: {
					account: auth.actor,
					permission: 'claim',
					parent: 'active',
					auth: {
						threshold: 1,
						keys: [{key: public_key, weight: 1}],
						accounts: [],
						waits: [],
					},
				},
			});
		} else {
			changeKey = false;
		}

		if (this.enableLinkAuth) {
			// Test linkauth
			console.log('Test linkauth');
			const req_link = await this.checkLinkedAuth(auth.actor);
			console.log(req_link);

			for (const link_type of req_link) {
				_actions.push({
					account: 'eosio',
					name: 'linkauth',
					authorization: [auth],
					data: {
						account: auth.actor,
						code: 'eosio',
						type: link_type,
						requirement: 'claim',
					},
				});
			}
		}
		console.log(_actions);
		this.trxFactory.modalData.next({
			transactionPayload: {
				actions: _actions,
			},
			termsHeader: '',
			signerAccount: auth.actor,
			signerPublicKey: publicKey,
			labelHTML: messageHTML,
			actionTitle: 'auto-claim setup',
			termsHTML: '',
		});
		this.trxFactory.launcher.emit(true);
		const subs = this.trxFactory.status.subscribe((event) => {
			if (event === 'done') {
				// Save private key to credential storage
				if (!changeKey) {
					this.keytar.setPassword('simpleos', publicKey, this.crypto.getPK());
					this.claimPublicKey = publicKey;
					this.configureAutoClaim(auth.actor, publicKey, 'claim');
				} else {
					this.keytar.setPassword('simpleos', public_key, private_key);
					this.claimPublicKey = public_key;
					this.configureAutoClaim(auth.actor, public_key, 'claim');
				}
				this.autoClaimStatus = true;
				subs.unsubscribe();
				this.checkWaxGBMdata(this.aService.selected.getValue().name).then(() => {
					if (this.claimReady) {
						this.claimDirect(false).catch(console.log);
					}
				});
			}
			if (event === 'modal_closed') {
				subs.unsubscribe();
			}
		});
	}

	configureAutoClaim(accountName, publicKey, permission) {
		if (!this.autoClaimConfig['WAX-GBM']) {
			this.autoClaimConfig['WAX-GBM'] = {
				apis: [
					'https://wax.eosrio.io',
					'https://api.waxsweden.org',
					'https://chain.wax.io',
				],
				jobs: [],
			};
		}
		const newObj = {
			'account': accountName,
			'public_key': publicKey,
			'permission': permission,
			'last_claim': this.last_claim_time,
			'total_rewards': 0,
			'next_claim_time': this.last_claim_time + (24 * 60 * 60 * 1000),
		};
		const idx = this.autoClaimConfig['WAX-GBM']['jobs'].findIndex(
			j => j.account === accountName);
		if (idx === -1) {
			this.autoClaimConfig['WAX-GBM']['jobs'].push(newObj);
		} else {
			this.autoClaimConfig['WAX-GBM']['jobs'][idx] = newObj;
		}
		this.storeConfig();
	}

	private async checkVoterRewards(name: string) {
		const voter = (await this.eosjs.rpc.get_account(name))['voter_info'];
		const _gstate = (await this.eosjs.rpc.get_table_rows({
			code: 'eosio',
			scope: 'eosio',
			table: 'global',
		}))['rows'][0];
		const unpaidVoteShare = ((1000 * 60 * 60 * 24) / 1000000) *
			parseFloat(voter['unpaid_voteshare_change_rate']);
		const voterBucket = parseFloat(_gstate['voters_bucket']) / 100000000;
		const globalUnpaidVoteShare = parseFloat(_gstate['total_unpaid_voteshare']);
		this.voteRewardsDaily = voterBucket *
			(unpaidVoteShare / globalUnpaidVoteShare);
	}

	private async checkWaxGBMdata(name: any) {

		const results = await this.eosjs.rpc.get_table_rows({
			json: true,
			code: 'eosio',
			table: 'genesis',
			scope: name,
		});
		const data = results.rows[0];
		if (data) {
			this.gbmBalance = parseFloat(data['balance'].split(' ')[0]);
			this.gbmLastClaim = data['last_claim_time'];
			this.last_claim_time = moment(moment.utc(this.gbmLastClaim).toDate()).toDate().getTime();
			this.gbmLastClaim = moment(moment.utc(this.gbmLastClaim).toDate()).local().format('DD-MM-YYYY HH:mm');
			if (this.gbmBalance > 0) {
				this.gbmEstimatedDaily = parseFloat(
					(this.gbmBalance / 1095).toFixed(2));
			} else {
				this.gbmEstimatedDaily = 0;
			}
			this.gbmNextClaim = moment.utc(this.last_claim_time).add(1, 'day').fromNow();
			this.claimReady = ((this.last_claim_time) + (24 * 60 * 60 * 1000) <=
				Date.now());

		} else {
			this.gbmBalance = 0;
			this.claimReady = false;
		}
	}

	customTableSort(event: SortEvent) {
		event.data.sort((data1, data2) => {
			if (event.field === 'total_votes') {
				event.field = 'total_votes_num';
			}
			const value1 = data1[event.field];
			const value2 = data2[event.field];
			let result;
			if (value1 == null && value2 != null) {
				result = -1;
			} else if (value1 != null && value2 == null) {
				result = 1;
			} else if (value1 == null && value2 == null) {
				result = 0;
			} else if (typeof value1 === 'string' && typeof value2 === 'string') {
				result = value1.localeCompare(value2);
			} else {
				result = (value1 < value2) ? -1 : (value1 > value2) ? 1 : 0;
			}
			return (event.order * result);
		});
	}

	processLiberlandVotes() {
		window['shell']['openExternal']("https://vote.liberland.org");
	}
}
