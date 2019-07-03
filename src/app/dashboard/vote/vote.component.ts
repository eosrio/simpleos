import {AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit} from '@angular/core';
import {VotingService} from '../../services/voting.service';
import {AccountsService} from '../../services/accounts.service';
import {EOSJSService} from '../../services/eosjs.service';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {BodyOutputType, Toast, ToasterConfig, ToasterService} from 'angular2-toaster';
import {createNumberMask} from 'text-mask-addons/dist/textMaskAddons';
import {CryptoService} from '../../services/crypto.service';
import {HttpClient} from '@angular/common/http';

import * as moment from 'moment';
import {Subscription} from 'rxjs';

import {Eosjs2Service} from '../../services/eosjs2.service';
import {RexComponent} from '../rex/rex.component';
import {AppComponent} from '../../app.component';

@Component({
	selector: 'app-vote',
	templateUrl: './vote.component.html',
	styleUrls: ['./vote.component.css']
})
export class VoteComponent implements OnInit, AfterViewInit, OnDestroy {

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
	nVotes: number;
	nVotesProxy: number;
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
		decimalLimit: 4,
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

	echartsInstance: any;
	location: string[];
	country: string[];
	// graphMerge: any;
	options: any;

	initOptions = {
		renderer: 'z',
		width: 1000,
		height: 400
	};

	net_weight = '';
	cpu_weight = '';

	stakingRatio = 75;

	listProxyVote = [];

	subscriptions: Subscription[] = [];
	private selectedProxy = '';

	constructor(public voteService: VotingService,
				private http: HttpClient,
				public aService: AccountsService,
				public eos: EOSJSService,
				public eosjs: Eosjs2Service,
				public crypto: CryptoService,
				private fb: FormBuilder,
				private toaster: ToasterService,
				private cdr: ChangeDetectorRef,
				public app: AppComponent
				// private ledger: LedgerHWService
	) {
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
		this.singleSelectionBP = {
			name: ''
		};
		this.selectedVotes = [];
		this.frmForProxy = this.fb.group({
			proxyName: ['', [Validators.required]]
		});
		this.passForm = this.fb.group({
			pass: ['', [Validators.required, Validators.minLength(10)]]
		});
		this.passFormStake = this.fb.group({
			pass: ['', [Validators.required, Validators.minLength(10)]]
		});

		this.subscriptions.push(this.aService.lastUpdate.asObservable().subscribe(value => {
			if (value.account === this.aService.selected.getValue().name) {
				this.updateBalances();
			}
		}));

		this.subscriptions.push(this.aService.selected.asObservable().subscribe((selected: any) => {
			this.totalStaked = 0 ;
			this.votedDecay = 0 ;
			this.votedEOSDecay = 0 ;
			if (selected && selected['name']) {
				this.fromAccount = selected.name;
				this.totalBalance = selected.full_balance;
				this.stakedBalance = selected.staked;
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
				this.loadPlacedVotes(selected);
				this.cpu_weight = selected.details.total_resources.cpu_weight;
				this.net_weight = selected.details.total_resources.net_weight;
				const _cpu = RexComponent.asset2Float(this.cpu_weight);
				const _net = RexComponent.asset2Float(this.net_weight);
				this.stakingRatio = (_cpu / (_cpu + _net)) * 100;

				if (selected.details.voter_info) {
					this.hasVote = true;
					this.totalStaked = (selected.details.voter_info.staked / 10000);
					const a = (moment().unix() - 946684800);
					const b = parseInt('' + (a / 604800), 10) / 52;
					const decayEOS = (selected.details.voter_info.last_vote_weight / Math.pow(2, b) / 10000);
					this.votedEOSDecay = this.totalStaked - decayEOS;
					if (selected.details.voter_info.last_vote_weight > 0){
						this.votedDecay = 100 - Math.round(((decayEOS * 100 ) / this.totalStaked ) * 1000) / 1000;
					}
				} else {
					this.hasVote = false;
				}

				this.eosjs.getRexData(selected.name).then(async (rexdata) => {
					this.hasRex = !rexdata.rexbal;
				});
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
						color: '#17181c'
					}
				}
			},
			tooltip: {
				formatter: (params) => '<strong>' + params['data']['location'] + '</strong><br> Rank: ' + params['data']['position'] + '<br> Status:  ' + params['data']['status']
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
							shadowColor: 'rgba(0, 0, 0, 0.3)'
						}
					},
					label: {
						position: 'top',
						formatter: '{b}',
						show: false,
						distance: 6,
						fontSize: 16
					},
					lineStyle: {
						color: 'source',
						curveness: 0.01,
						width: 2
					},
					force: {
						repulsion: 600,
						edgeLength: 150,
					},
					emphasis: {
						lineStyle: {
							width: 10
						}
					}
				}
			]
		};
	}

	ngOnInit() {
		const selectedAcc = this.aService.selected.getValue();
		if (this.aService.activeChain.features['vote']) {
			this.setCheckListVote(selectedAcc.name);
		}
		this.getCurrentStake();
	}

	ngAfterViewInit() {
		this.subscriptions.push(
			this.aService.selected.asObservable().subscribe((selected) => {
				this.voteService.currentVoteType(selected);
				this.voteOption(this.voteService.voteType);
			})
		);
	}

	ngOnDestroy(): void {
		this.subscriptions.forEach(s => {
			s.unsubscribe();
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

	get getValuetoStake(): number {
		return parseFloat(this.valuetoStake);
	}

	setStake() {
		const prevStake = Math.round(this.aService.selected.getValue().staked * 10000);
		const nextStakeFloat = parseFloat(this.valuetoStake);
		const nextStakeInt = Math.round(nextStakeFloat * 10000);
		const diff = nextStakeInt - prevStake;
		this.stakingDiff = diff;
		this.stakingHRV = (Math.abs(this.stakingDiff) / 10000) + ' ' + this.aService.activeChain['symbol'];
		if (diff === 0) {
			this.stakerr = 'Value has not changed';
		} else {
			this.stakeModal = true;
		}

	}

	callSetStake(password) {
		this.busy = true;
		const account = this.aService.selected.getValue();
		const pubkey = account.details['permissions'][0]['required_auth'].keys[0].key;
		this.crypto.authenticate(password, pubkey).then((data) => {
			if (data === true) {
				this.eos.changebw(account.name, this.stakingDiff, this.aService.activeChain['symbol'], this.stakingRatio / 100)
					.then((trx) => {
						this.busy = false;
						this.wrongpass = '';
						this.stakeModal = false;
						this.cdr.detectChanges();
						this.showToast('success', 'Transaction broadcasted', 'Check your history for confirmation.');
						setTimeout(() => {
							this.aService.refreshFromChain().then(() => {
								this.cpu_weight = this.aService.selected.getValue().details.total_resources.cpu_weight;
								this.net_weight = this.aService.selected.getValue().details.total_resources.net_weight;
							});
						}, 1500);
					})
					.catch((error) => {
						console.log(error);
						if (typeof error === 'object') {
							this.wrongpass = 'Operation timeout, please try again or select another endpoint.';
						} else {
							if (JSON.parse(error).error.name === 'leeway_deadline_exception') {
								this.wrongpass = 'Not enough CPU bandwidth to perform transaction. Try again later.';
							} else {
								this.wrongpass = JSON.stringify(JSON.parse(error).error.details[0].message);
							}
						}
						this.busy = false;
					});
			} else {
				console.dir(data);
				this.wrongpass = 'Wrong password!';
				this.busy = false;
			}
		}).catch(() => {
			this.busy = false;
			this.wrongpass = 'Wrong password!';
		});
	}

	updateBalances() {
		const selectedAcc = this.aService.selected.getValue();
		this.totalBalance = selectedAcc.full_balance;
		this.stakedBalance = selectedAcc.staked;
		if (selectedAcc.details.voter_info) {
			this.hasVote = true;
			this.totalStaked = (selectedAcc.details.voter_info.staked / 10000);
			const a = (moment().unix() - 946684800);
			const b = parseInt('' + (a / 604800), 10) / 52;
			const decayEOS = (selectedAcc.details.voter_info.last_vote_weight / Math.pow(2, b) / 10000);
			this.votedEOSDecay = this.totalStaked - decayEOS;
			if (selectedAcc.details.voter_info.last_vote_weight > 0){
				this.votedDecay = 100 - Math.round(((decayEOS * 100 ) / this.totalStaked ) * 1000) / 1000;
			}
		} else {
			this.hasVote = false;
		}

		this.eosjs.getRexData(selectedAcc.name).then(async (rexdata) => {
			// console.log('REX DATA', rexdata.rexbal);
			this.hasRex = !rexdata.rexbal;
		});
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
		this.eos.getAccountInfo(account).then(v => {
			this.listProxyVote = v['voter_info']['producers'];
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
			})
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
			this.percenttoStake = ((this.stakedBalance / this.totalBalance) * 100).toString();
		}
		this.valuetoStake = this.stakedBalance.toString();
	}

	updateStakeValue() {
		this.stakedisabled = false;
		this.minstake = false;
		this.valuetoStake = (this.totalBalance * (parseFloat(this.percenttoStake) / 100)).toString();
		if (this.valuetoStake === '1') {
			this.minstake = true;
		}
	}

	updateStakePercent() {
		this.stakedisabled = false;
		if (this.totalBalance > 0) {
			this.percenttoStake = ((parseFloat(this.valuetoStake) * 100) / this.totalBalance).toString();
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
		this.passForm.reset();
		this.wrongpass = '';
		this.voteModal = true;
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


	modalVote(pass) {
		this.busy = true;
		const voter = this.aService.selected.getValue();
		const publicKey = voter.details['permissions'][0]['required_auth'].keys[0].key;
		this.crypto.authenticate(pass, publicKey).then((data) => {
			if (data === true) {
				// this.aService.injectLedgerSigner();
				this.eos.voteAction(voter.name, this.selectedVotes, this.voteService.voteType).then((result) => {
					if (JSON.parse(result).code) {
						// if (err2.error.code === 3081001) {
						this.wrongpass = JSON.parse(result).error.details[0].message;
						// } else {
						//   this.wrongpass = err2.error['what'];
						// }
						this.busy = false;
					} else {
						this.wrongpass = '';
						this.cdr.detectChanges();
						setTimeout(() => {
							this.aService.refreshFromChain().then(() => {
								this.voteOption(this.voteService.voteType);
								this.voteService.currentVoteType(voter.name);
								this.loadPlacedVotes(this.aService.selected.getValue());
								this.setCheckListVote(this.aService.selected.getValue().name);
								this.showToast('success', 'Vote broadcasted', 'Check your history for confirmation.');
								this.voteModal = false;
								this.busy = false;
							}).catch(err => {
								console.log('Refresh From Chain Error:', err);
							});
							// this.aService.select(this.aService.accounts.findIndex(sel => sel.name === voter.name));
						}, 1500);
						// this.passForm.reset();
					}
				}).catch((err2) => {
					console.log(err2);
					// if (err2.error.code === 3081001) {
					//   this.wrongpass = 'Not enough stake to perform this action.';
					// } else {
					//   this.wrongpass = err2.error['what'];
					// }
					this.busy = false;
				});


			} else {
				this.wrongpass = 'Something went wrong!';
				this.busy = false;
			}
		}).catch(() => {
			this.busy = false;
			this.wrongpass = 'Wrong password!';
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

	onChartInit(e: any) {
		this.echartsInstance = e;
	}

	voteOption(ev) {
		this.busyList = true;
		this.voteService.voteType = ev;
		const acc = this.aService.selected.getValue();
		this.voteService.initList = false;
		this.voteService.loadingProds = false;
		this.voteService.initListProx = false;
		this.voteService.loadingProxs = false;
		if (this.voteService.voteType === 0) {
			this.voteService.listProducers().then(() => {
				this.busyList = false;
				this.setCheckListVote(acc.name);
				this.loadPlacedVotes(acc);
			}).catch(err => {
				console.log('Load Account List Producers Error:', err);
			});
		} else if (this.voteService.voteType === 1) {
			this.voteService.listProxies().then(() => {
				this.busyList = false;
				this.setCheckListVote(acc.name);
				this.loadPlacedVotes(acc);
			}).catch(err => {
				console.log('Load Account List Proxies Error:', err);
			});
		}
		this.cdr.detectChanges();
	}

	validateProxy(account) {
		this.eos.getAccountInfo(account).then(() => {
			this.isValidAccount = true;
			this.selectedProxy = account;
			this.processVotes();
		}).catch(() => {
			console.log('error');
			this.isValidAccount = false;
		});
	}


}
