import {AfterViewInit, ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {VotingService} from '../../services/voting.service';
import {AccountsService} from '../../services/accounts.service';
import {EOSJSService} from '../../services/eosjs.service';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {BodyOutputType, Toast, ToasterConfig, ToasterService} from 'angular2-toaster';
import {createNumberMask} from 'text-mask-addons/dist/textMaskAddons';
import {CryptoService} from '../../services/crypto.service';
import {HttpClient} from '@angular/common/http';

import * as moment from 'moment';

@Component({
	selector: 'app-vote',
	templateUrl: './vote.component.html',
	styleUrls: ['./vote.component.css']
})
export class VoteComponent implements OnInit, AfterViewInit {
	max: number;
	min: number;
	minstake: boolean;
	valuetoStake: string;
	percenttoStake: string;
	minToStake = 0.01;
	unstaking: number;
	unstakeTime: string;
	stakeModal: boolean;
	voteModal: boolean;
	nVotes: number;
	busy: boolean;
	totalBalance: number;
	stakedBalance: number;
	singleSelectionBP: any;
	selectedBPs: any[];
	wrongpass: string;
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

	echartsInstance: any;
	location: string[];
	country: string[];
	graphMerge: any;
	options: any;

	initOptions = {
		renderer: 'z',
		width: 1000,
		height: 400
	};

	net_weight = '';
	cpu_weight = '';

	constructor(public voteService: VotingService,
				private http: HttpClient,
				public aService: AccountsService,
				public eos: EOSJSService,
				public crypto: CryptoService,
				private fb: FormBuilder,
				private toaster: ToasterService,
				private cdr: ChangeDetectorRef,
				// private ledger: LedgerHWService
	) {
		if (this.voteService.bps) {
			this.nbps = this.voteService.bps.length;
		} else {
			this.nbps = 100;
		}
		this.max = 100;
		this.min = 0;
		this.minstake = false;
		this.valuetoStake = '';
		this.percenttoStake = '';
		this.unstaking = 0;
		this.unstakeTime = '';
		this.stakeModal = false;
		this.voteModal = false;
		this.busy = false;
		this.totalBalance = 0;
		this.stakedBalance = 0;
		this.wrongpass = '';
		this.stakerr = '';
		this.fromAccount = '';
		this.stakedisabled = true;
		this.singleSelectionBP = {
			name: ''
		};
		this.selectedBPs = [];
		this.passForm = this.fb.group({
			pass: ['', [Validators.required, Validators.minLength(10)]]
		});
		this.passFormStake = this.fb.group({
			pass: ['', [Validators.required, Validators.minLength(10)]]
		});

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
			tooltip: {},
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

	extOpen(value) {
		window['shell'].openExternal(value);
	}

	sliderLabel(value: number): string {
		const val = parseInt(value.toString(), 10);
		return val.toString();
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
		this.stakingHRV = (Math.abs(this.stakingDiff) / 10000) + ' EOS';
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
				let call;
				if (this.stakingDiff < 0) {
					console.log('Unstaking: ' + Math.abs(this.stakingDiff));
					call = this.eos.unstake(account.name, Math.abs(this.stakingDiff), this.aService.activeChain['symbol']);
				} else {
					console.log('Staking: ' + Math.abs(this.stakingDiff));
					call = this.eos.stake(account.name, Math.abs(this.stakingDiff), this.aService.activeChain['symbol']);
				}
				call.then(() => {
					this.busy = false;
					this.wrongpass = '';
					this.stakeModal = false;
					this.cdr.detectChanges();
					this.showToast('success', 'Action broadcasted', 'Check your history for confirmation.');
					setTimeout(() => {
						this.aService.refreshFromChain();
					}, 500);
				}).catch((error) => {
					if (typeof error === 'object') {
						this.wrongpass = 'Operation timeout, please try again or select another endpoint.';
					} else {
						if (JSON.parse(error).error.name === 'leeway_deadline_exception') {
							this.wrongpass = 'Not enough CPU bandwidth to perform transaction. Try again later.';
						} else {
							this.wrongpass = JSON.parse(error).error['what'];
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
	}

	ngOnInit() {
		const selectedAcc = this.aService.selected.getValue();
		this.aService.lastUpdate.asObservable().subscribe(value => {
			if (value.account === this.aService.selected.getValue().name) {
				this.updateBalances();
			}
		});
		this.aService.selected.asObservable().subscribe((selected: any) => {
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
			}
		});
		if (this.aService.activeChain.features['vote']) {

			this.voteService.listReady.asObservable().subscribe((state) => {
				if (state) {
					this.updateCounter();
					this.nbps = this.voteService.bps.length;
				}
			});
			this.aService.accounts.forEach((a) => {
				if (a) {
					if (a.name === selectedAcc.name) {
						if (a.details['voter_info']) {
							const currentVotes = a.details['voter_info']['producers'];
							this.voteService.bps.forEach((elem) => {
								elem.checked = currentVotes.indexOf(elem.account) !== -1;
							});
						} else {
							this.voteService.bps.forEach((elem) => {
								elem.checked = false;
							});
						}
					}
				}
			});

		}
		this.getCurrentStake();
	}

	ngAfterViewInit() {

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

	shuffleBps() {
		this.voteService.randomizeList();
	}

	processVotes() {
		this.selectedBPs = [];
		this.voteService.bps.forEach((bp) => {
			if (bp.checked) {
				this.selectedBPs.push(bp.account);
			}
		});
		this.passForm.reset();
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

	modalVote(pass) {
		this.busy = true;
		const voter = this.aService.selected.getValue();
		const publicKey = voter.details['permissions'][0]['required_auth'].keys[0].key;
		this.crypto.authenticate(pass, publicKey).then((data) => {
			// console.log('Auth output:', data);
			if (data === true) {

				this.aService.injectLedgerSigner();

				this.eos.voteProducer(voter.name, this.selectedBPs).then((result) => {
					// console.log(result);
					if (JSON.parse(result).code) {
						// if (err2.error.code === 3081001) {
						this.wrongpass = JSON.parse(result).error.details[0].message;
						// } else {
						//   this.wrongpass = err2.error['what'];
						// }
						this.busy = false;
					} else {
						this.wrongpass = '';
						this.voteModal = false;
						this.busy = false;
						this.showToast('success', 'Vote broadcasted', 'Check your history for confirmation.');
						this.passForm.reset();
						this.aService.refreshFromChain();

						setTimeout(() => {
							this.loadPlacedVotes(this.aService.selected.getValue());
						}, 1500);
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
			const currentVotes = selectedAccount.details['voter_info']['producers'];
			this.nVotes = currentVotes.length;
			this.voteService.bps.forEach((elem) => {
				elem.checked = currentVotes.indexOf(elem.account) !== -1;
			});
			this.updateCounter();
		} else {
			this.voteService.bps.forEach((elem) => {
				elem.checked = false;
			});
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

}
