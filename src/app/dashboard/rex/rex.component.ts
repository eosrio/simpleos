import {Component, OnDestroy} from '@angular/core';
import {AccountsService} from '../../services/accounts.service';
import {createNumberMask} from 'text-mask-addons/dist/textMaskAddons';
import {EOSAccount} from '../../interfaces/account';
import {AbstractControl, FormBuilder, FormGroup, Validators} from '@angular/forms';
import {Router} from '@angular/router';
import {CryptoService} from '../../services/crypto/crypto.service';
import {EOSJSService} from '../../services/eosio/eosjs.service';
import {ToasterConfig, ToasterService} from 'angular2-toaster';
import {Eosjs2Service} from '../../services/eosio/eosjs2.service';
import {TransactionFactoryService} from '../../services/eosio/transaction-factory.service';
import {Subscription} from 'rxjs';
import {RexChartsService} from '../../services/rex-charts.service';
import {ModalStateService} from '../../services/modal-state.service';
import {NetworkService} from '../../services/network.service';
import * as moment from 'moment';
import {HttpClient} from '@angular/common/http';
import {DecimalPipe, formatNumber} from '@angular/common';

interface Loan {
	balance: string;
	expiration: string;
	from: string;
	loan_num: number;
	payment: string;
	receiver: string;
	total_staked: string;
	version: number;
	expires_in?: string;
	created_on?: string;
}

interface Loans {
	cpu: Loan[];
	net: Loan[];
}

@Component({
	selector: 'app-rex',
	templateUrl: './rex.component.html',
	styleUrls: ['./rex.component.css']
})
export class RexComponent implements OnDestroy {

	canbuyREX = false;
	nVoters: number;
	voteModal = false;
	stakeModal = false;
	busy: boolean;
	fromAccount: string;
	showAdvancedRatio = false;
	EOSbuyREX: string;
	REXtoBuy = 0;
	salesResult = 0;
	REXfromStake = 0;
	REXfromCPU = 0;
	REXfromNET = 0;
	EOStotaltoBuy: number;
	REXtotaltoBuy: number;
	fullBalance: number;
	staked: number;
	allStakes: number;
	totalEOSliquid: number;
	unstaking: number;
	cpu_weight: number;
	net_weight: number;
	EOSamounterror: string;
	passFormVote: FormGroup;
	wrongpass: string;
	convertForm: FormGroup;
	buyForm: FormGroup;
	sellForm: FormGroup;
	advancedConvertForm: FormGroup;
	borrowForm: FormGroup;
	borrowAccErrorMsg = '';
	rexFund: number;
	rexPrice: number;
	rexLiquid: number;
	rexSavings: number;
	rexMaturing: number;
	rexBuckets: any[];
	matBucket: any[];
	totalRexBalance: number;
	borrowingCost: number;
	lastSelectedAccount: string;
	numberMask = createNumberMask({
		prefix: '',
		allowDecimal: true,
		includeThousandsSeparator: false,
		decimalLimit: 4,
	});
	config: ToasterConfig;
	subscriptions: Subscription[];
	rex_price_chart: any;
	rexPriceChartMerge: any;
	borrow_cost_chart: any;
	borrowCostChartMerge: any;
	advCpuConvertError = '';
	advNetConvertError = '';
	cpuCost = 0;
	netCost = 0;
	totalCost = 0;

	public rexMode: string;
	public liquid: number;
	public borrowCpuError = '';
	public borrowNetError = '';
	public borrowRenewalError = '';
	public stakeAmountError = '';
	public REXamounterror = '';
	public convertAmountError = '';
	public intervalOptions = [
		{label: '2 hours', range: '2h', step: '5m'},
		{label: '6 hours', range: '6h', step: '15m'},
		{label: '24 hours', range: '24h', step: '30m'},
		{label: '3 days', range: '3d', step: '2h'},
		{label: '2 weeks', range: '2w', step: '6h'},
		{label: '2 months', range: '60d', step: '1d'},
		{label: '1 year', range: '365d', step: '1w'}
	];
	public selectedInterval: any;
	public stakeForm: FormGroup;
	public myLoans: Loans;
	public total_unlent = 0.0;
	public total_lent = 0.0;
	public total_rent = 0.0;

	static asset2Float(asset) {
		return parseFloat(asset.split(' ')[0]);
	}

	static processLoans(arr: Loan[]) {
		for (const loan of arr) {
			loan['expires_in'] = moment.utc(loan.expiration).local().fromNow();
			loan['created_on'] = moment.utc(loan.expiration).local().subtract(30, 'd').format('DD/MM/YY HH:mm:ss');
		}
	}

	static buySliderLabel(value: number): string {
		const val = parseInt(value.toString(), 10);
		return val.toString();
	}

	constructor(
		private http: HttpClient,
		private fb: FormBuilder,
		private trxFactory: TransactionFactoryService,
		public aService: AccountsService,
		public network: NetworkService,
		private router: Router,
		private mds: ModalStateService,
		public eos: EOSJSService,
		private eosjs: Eosjs2Service,
		public crypto: CryptoService,
		private toaster: ToasterService,
		private rexCharts: RexChartsService
	) {

		this.selectedInterval = this.intervalOptions[1];
		this.busy = true;
		this.rexBuckets = [];
		this.matBucket = [];
		this.rexPrice = 0;
		this.rexLiquid = 0;
		this.rexFund = 0;
		this.rexSavings = 0;
		this.rexMaturing = 0;
		this.totalRexBalance = 0;
		this.lastSelectedAccount = '';
		this.rexPriceChartMerge = [];
		this.borrowingCost = 0;
		this.cpu_weight = 0;
		this.net_weight = 0;

		this.myLoans = {
			cpu: [],
			net: []
		};

		// Setup Forms
		this.passFormVote = this.fb.group({
			pass: ['', [Validators.required, Validators.minLength(10)]]
		});
		this.buyForm = this.fb.group({
			EOSamount: ['', Validators.min(0)],
		});
		this.sellForm = this.fb.group({
			REXamount: ['', Validators.min(0)],
			auto: [true]
		});
		this.convertForm = this.fb.group({
			EOSamount: ['', Validators.min(0)],
		});
		this.stakeForm = this.fb.group({
			amount: ['', Validators.min(0)],
		});
		this.advancedConvertForm = this.fb.group({
			cpu: [0, Validators.min(0)],
			net: [0, Validators.min(0)]
		});
		this.borrowForm = this.fb.group({
			CPUamount: [0, Validators.min(0)],
			NETamount: [0, Validators.min(0)],
			renewal: ['', Validators.min(0)],
			accountReceiver: [''],
			account: ['', Validators.required]
		});

		// Setup subscriptions
		this.subscriptions = [];
		this.subscriptions.push(this.rexCharts.rexPriceChart.asObservable().subscribe(data => {
			if (data) {
				this.updatePriceChart(data);
			}
		}));
		this.subscriptions.push(this.rexCharts.borrowingCostChart.asObservable().subscribe(data => {
			if (data) {
				this.updateBorrowingChart(data);
			}
		}));
		this.subscriptions.push(this.buyForm.get('EOSamount').valueChanges.subscribe(value => {
			if (this.rexPrice !== 0) {
				this.REXtoBuy = value / this.rexPrice;
			} else {
				this.REXtoBuy = 0;
			}
			this.checkTotal();
		}));
		this.subscriptions.push(this.sellForm.get('REXamount').valueChanges.subscribe(value => {
			if (this.rexPrice !== 0) {
				this.salesResult = value * this.rexPrice;
			} else {
				this.salesResult = 0;
			}
		}));
		this.subscriptions.push(this.convertForm.get('EOSamount').valueChanges.subscribe(value => {
			if (this.rexPrice !== 0) {
				this.REXfromStake = value / this.rexPrice;
			} else {
				this.REXfromStake = 0;
			}
			this.checkTotal();
		}));
		this.subscriptions.push(this.advancedConvertForm.get('cpu').valueChanges.subscribe(val => {
			if (val !== '') {
				if (parseFloat(val) > this.aService.selected.getValue().details.self_delegated_bandwidth.cpu_weight.split(' ')[0]) {
					this.advancedConvertForm.controls['cpu'].setErrors({'incorrect': true});
					this.advCpuConvertError = 'invalid amount';
				} else {
					const sum = parseFloat(val) + parseFloat(this.advancedConvertForm.get('net').value);
					if (val > 0) {
						this.REXfromCPU = val / this.rexPrice;
					} else {
						this.REXfromCPU = 0;
					}
					this.convertForm.patchValue({
						EOSamount: sum
					});
				}
			} else {
				this.REXfromCPU = 0;
			}
		}));
		this.subscriptions.push(this.advancedConvertForm.get('net').valueChanges.subscribe(val => {
			if (val !== '') {
				if (parseFloat(val) > this.aService.selected.getValue().details.self_delegated_bandwidth.net_weight.split(' ')[0]) {
					this.advancedConvertForm.controls['net'].setErrors({'incorrect': true});
					this.advNetConvertError = 'invalid amount';
				} else {
					const sum = parseFloat(val) + parseFloat(this.advancedConvertForm.get('cpu').value);
					if (val > 0) {
						this.REXfromNET = val / this.rexPrice;
					} else {
						this.REXfromNET = 0;
					}
					this.convertForm.patchValue({
						EOSamount: sum
					});
				}
			} else {
				this.REXfromNET = 0;
			}
		}));
		this.subscriptions.push(this.aService.selected.asObservable().subscribe((sel: EOSAccount) => {
			if (Object.keys(sel).length > 0) {
				const d = sel.details;
				this.fromAccount = d.account_name;
				if (this.fromAccount !== this.lastSelectedAccount) {
					this.lastSelectedAccount = this.fromAccount;
					this.fullBalance = sel.full_balance;
					this.allStakes = sel.staked;
					this.unstaking = sel.unstaking;
					this.updateAccountBalances(d);
					this.checkRequirements(d);
					this.updateREXData(sel.details.account_name);
					// this.loadRexHistory().catch(console.log);
				}
			}
		}));
		this.subscriptions.push(this.eos.online.subscribe(state => {
			if (state) {
				this.updateGlobalRexData();
			}
		}));
		const color = document.documentElement.style.getPropertyValue('--text-white-color') !== '' ? document.documentElement.style.getPropertyValue('--text-white-color') : '#ffffff';

		// Setup Charts
		this.rex_price_chart = {
			title: {
				left: 'center',
				subtext: 'REX/EOS price',
				subtextStyle: {color: color, fontWeight: 'bold'},
				top: '20'
			},
			grid: {height: '80%', width: '75%', right: '30', top: '11'},
			tooltip: {
				trigger: 'axis',
				formatter: (params) => {
					params = params[0];
					return `
						${moment(params.name, 'YYYY-MM-DDTHH:mm:ss.SSSZ').format('HH:mm[\n]DD/MM/YYYY')}
						<br>
						${params.value.toFixed(12)}
						<br>
						1 ${this.aService.activeChain['symbol']} = ${(1 / params.value).toFixed(4)} REX
					`;
				},
			},
			xAxis: {
				type: 'category',
				boundaryGap: false,
				data: [],
				axisLine: {lineStyle: {color: '#B7B7B7'}},
				axisLabel: {
					textStyle: {color: '#B7B7B7'},
					formatter: function (params) {
						return moment(params, 'YYYY-MM-DDTHH:mm:ss.SSSZ').format('HH:mm[\n]DD/MM');
					},
				},
			},
			yAxis: {
				type: 'value',
				boundaryGap: [0, '100%'],
				axisLine: {lineStyle: {color: '#B7B7B7'}},
				axisLabel: {textStyle: {color: '#B7B7B7'}, show: false},
				splitLine: {lineStyle: {color: '#3c3a3a'}},
				scale: true
			},
			series: [{
				name: 'REX price',
				type: 'line',
				smooth: true,
				symbol: 'none',
				sampling: 'average',
				itemStyle: {normal: {color: 'rgb(0, 148, 210)'}},
				areaStyle: {
					color: {
						type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
						colorStops: [
							{offset: 0, color: 'rgb(149, 223, 255, 0.6)'},
							{offset: 1, color: 'rgb(0, 143, 203, 0.1)'}
						],
					}
				},
				data: []
			}]
		};
		this.borrow_cost_chart = {
			title: {
				left: 'center',
				subtext: 'borrowing cost',
				subtextStyle: {color: color, fontWeight: 'bold'},
				top: '20'
			},
			grid: {height: '80%', width: '75%', right: '30', top: '11'},
			tooltip: {
				trigger: 'axis',
				formatter: (params) => {
					params = params[0];
					return `
						${moment(params.name, 'YYYY-MM-DDTHH:mm:ss.SSSZ').format('HH:mm[\n]DD/MM/YYYY')}
						<br>
						${params.value.toFixed(12)}
						<br>
						1 ${this.aService.activeChain['symbol']} = ${(1 / params.value).toFixed(4)} ${this.aService.activeChain['symbol']}
					`;
				},
			},
			xAxis: {
				type: 'category',
				boundaryGap: false,
				data: [],
				axisLine: {lineStyle: {color: '#B7B7B7'}},
				axisLabel: {
					textStyle: {color: '#B7B7B7'},
					formatter: function (params) {
						return moment(params, 'YYYY-MM-DDTHH:mm:ss.SSSZ').format('HH:mm[\n]DD/MM');
					},
				},
			},
			yAxis: {
				type: 'value',
				boundaryGap: [0, '100%'],
				axisLine: {lineStyle: {color: '#B7B7B7'}},
				axisLabel: {textStyle: {color: '#B7B7B7'}, show: false},
				splitLine: {lineStyle: {color: '#3c3a3a'}},
				scale: true
			},
			series: [{
				name: 'borrowing cost',
				type: 'line',
				smooth: true,
				symbol: 'none',
				sampling: 'average',
				itemStyle: {normal: {color: 'rgb(0, 148, 210)'}},
				areaStyle: {
					color: {
						type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
						colorStops: [
							{offset: 0, color: 'rgb(149, 223, 255, 0.6)'},
							{offset: 1, color: 'rgb(0, 143, 203, 0.1)'}
						],
					}
				},
				data: []
			}]
		};
		this.reloadChart();
	}

	updateAccountBalances(d) {
		if (d.core_liquid_balance) {
			this.totalEOSliquid = RexComponent.asset2Float(d.core_liquid_balance);
		} else {
			this.totalEOSliquid = 0.0;
		}
		this.liquid = this.totalEOSliquid;
		if (d.self_delegated_bandwidth) {
			this.cpu_weight = parseFloat(d.self_delegated_bandwidth.cpu_weight.split(' ')[0]);
			this.net_weight = parseFloat(d.self_delegated_bandwidth.net_weight.split(' ')[0]);
			this.staked = this.cpu_weight + this.net_weight;
		}
		if (d.total_resources) {
			this.allStakes = parseFloat(d.total_resources.cpu_weight.split(' ')[0]) + parseFloat(d.total_resources.net_weight.split(' ')[0]);
		}
	}

	async loadRexHistory() {
		const hyperionUrl = this.aService.activeChain['historyApi'];
		if (hyperionUrl !== '') {
			const account = this.aService.selected.getValue().name;
			const filters = 'eosio:withdraw,eosio:buyrex,eosio:unstaketorex,eosio:sellrex,eosio:deposit';
			const finalUrl = `${hyperionUrl}/history/get_actions?account=${account}&filter=${filters}`;
			console.log(finalUrl);
			const historyData: any = await this.http.get(finalUrl).toPromise();
			console.log(historyData);
			for (const action of historyData.actions) {
				const timestamp = moment(action['@timestamp']).format('DD/MM/YYYY HH:mm:ss');
				console.log(timestamp, action.act);
			}
		}
	}

	updateNetCost() {
		const target = parseFloat(this.borrowForm.get('NETamount').value);
		if (isNaN(target)) {
			this.netCost = 0;
		} else {
			this.netCost = target / this.borrowingCost;
		}
		this.updateTotalCost();
		this.checkBorrowAmount();
	}

	updateCpuCost() {
		const target = parseFloat(this.borrowForm.get('CPUamount').value);
		if (isNaN(target)) {
			this.cpuCost = 0;
		} else {
			this.cpuCost = target / this.borrowingCost;
		}
		this.updateTotalCost();
		this.checkBorrowAmount();
	}

	updateTotalCost() {
		this.totalCost = this.cpuCost + this.netCost;
	}

	selectInterval(ev) {
		this.selectedInterval = this.intervalOptions.find(item => item.range === ev.value);
		this.reloadChart();
	}

	reloadChart() {
		this.rexCharts.loadCharts(this.selectedInterval.range, this.selectedInterval.step).catch(console.log);
	}

	updateREXData(account) {
		// Fetch current loans
		this.eosjs.getLoans(account).then((loans: Loans) => {
			RexComponent.processLoans(loans.cpu);
			RexComponent.processLoans(loans.net);
			this.myLoans = loans;
		}).catch(console.log);

		// Fetch user rex data
		this.eosjs.getRexData(account).then(async (rexdata) => {
			// console.log('REX DATA', rexdata);
			const accountInfo = await this.eosjs.rpc.get_account(account);
			this.updateAccountBalances(accountInfo);
			this.rexBuckets = [];
			this.matBucket = [];
			this.rexSavings = 0;
			this.rexMaturing = 0;
			this.rexLiquid = 0;
			this.rexFund = 0;
			this.totalRexBalance = 0;
			if (rexdata.rexbal) {
				this.totalRexBalance = RexComponent.asset2Float(rexdata.rexbal.rex_balance);
				if (rexdata.rexbal.rex_maturities.length > 0) {
					for (const rexMat of rexdata.rexbal.rex_maturities) {
						const maturityTime = (new Date(rexMat.first).getTime() - Date.now()) / (1000 * 60 * 60);
						// console.log(rexMat, maturityTime);
						if (maturityTime > 128) {
							this.rexSavings = rexMat.second / 10000;
							rexMat['amount'] = rexMat.second / 10000;
							this.matBucket.push(rexMat);
						} else if (maturityTime < 0) {
							this.rexLiquid += rexMat.second / 10000;
						} else {
							rexMat['unstakein'] = moment.utc(rexMat.first).fromNow();
							rexMat['amount'] = rexMat.second / 10000;
							rexMat['unstakedate'] = moment.utc(rexMat.first).local().format('DD/MM HH:mm');
							this.rexBuckets.push(rexMat);
							this.rexMaturing += rexMat['amount'];
						}
					}
					// console.log(this.rexBuckets);
				}
				if (rexdata.rexbal.matured_rex > 0) {
					this.rexLiquid = rexdata.rexbal.matured_rex / 10000;
				}
			}
			if (rexdata.rexfund) {
				this.rexFund = parseFloat(rexdata.rexfund.balance.split(' ')[0]);
				if (this.rexFund > 0) {
					this.totalEOSliquid += this.rexFund;
				}
			}
		});
	}

	ngOnDestroy(): void {
		this.subscriptions.forEach(sub => {
			sub.unsubscribe();
		});
	}

	checkTotal() {
		const v1 = this.buyForm.get('EOSamount').value;
		const v2 = this.convertForm.get('EOSamount').value;
		if (v1 !== '' && v2 !== '') {
			this.EOStotaltoBuy = parseFloat(v1) + parseFloat(v2);
		} else {
			if (v1 === '') {
				this.EOStotaltoBuy = parseFloat(v2);
			} else if (v2 === '') {
				this.EOStotaltoBuy = parseFloat(v1);
			}
		}
		this.REXtotaltoBuy = this.EOStotaltoBuy / this.rexPrice;
	}

	updatePriceChart(datapoints) {
		const dataDT = [];
		const dataVAL = [];
		let maxY = 0;
		let minY = 10000000;
		datapoints.forEach((val) => {
			dataDT.push(val.time);
			dataVAL.push(val.value);
			if (val.value > maxY) {
				maxY = val.value;
			}
			if (val.value < minY) {
				minY = val.value;
			}
		});
		this.rexPriceChartMerge = {
			xAxis: {
				data: dataDT
			},
			yAxis: {
				min: minY,
				max: maxY
			},
			series: {
				data: dataVAL
			}
		};
	}

	updateBorrowingChart(datapoints) {
		const dataDT = [];
		const dataVAL = [];
		let maxY = 0;
		let minY = 10000000;
		datapoints.forEach((val) => {
			dataDT.push(val.time);
			dataVAL.push(val.value);
			if (val.value > maxY) {
				maxY = val.value;
			}
			if (val.value < minY) {
				minY = val.value;
			}
		});
		this.borrowCostChartMerge = {
			xAxis: {
				data: dataDT
			},
			yAxis: {
				min: minY,
				max: maxY
			},
			series: {
				data: dataVAL
			}
		};
	}

	calculateRexPrice(rexpool) {
		const S0 = RexComponent.asset2Float(rexpool.total_lendable);
		const S1 = S0 + 1.0000;
		const R0 = RexComponent.asset2Float(rexpool.total_rex);
		const R1 = (S1 * R0) / S0;
		const rex_amount = R1 - R0;
		this.rexPrice = 1.0000 / rex_amount;
		// console.log('REX PRICE', this.rexPrice);
	}

	calculateBorrowingCost(rexpool) {
		const F0 = RexComponent.asset2Float(rexpool.total_rent);
		const T0 = RexComponent.asset2Float(rexpool.total_unlent);
		const I = 1.0000;
		let out = ((I * T0) / (I + F0));
		if (out < 0) {
			out = 0;
		}
		this.borrowingCost = out;
		// console.log(`1 EOS >> ${this.borrowingCost.toFixed(2)} EOS`);
	}

	checkRequirements(acc) {
		this.busy = false;
		if (acc.voter_info) {
			const voter = acc.voter_info;
			this.nVoters = voter.producers.length;
			// console.log(voter);
			if (voter.producers.length === 0) {
				this.canbuyREX = voter.proxy !== '';
			} else {
				this.canbuyREX = voter.producers.length >= 21;
			}
		} else {
			this.canbuyREX = false;
			this.nVoters = 0;
		}
	}

	createMoveToSavingModal() {
		this.mds.inputModal.hintHTML = `
				Liquid: ${formatNumber(this.rexLiquid, 'en-us', '1.0-4')} REX<br>
				Unstaking: ${formatNumber(this.rexMaturing, 'en-us', '1.0-4')}  REX<br>
				Total Available: ${formatNumber(this.rexLiquid + this.rexMaturing, 'en-us', '1.0-4')}  REX`;

		this.mds.inputModal.maxValue = this.rexLiquid + this.rexMaturing;
		this.mds.inputModal.inputPlaceholder = 'Amount (REX)';
		this.mds.inputModal.buttonText = 'NEXT';
		this.mds.inputModal.modalTitle = 'Stake your REX';
		this.mds.inputModal.modalTooltip = `Move REX to your savings account where it can't be sold until you request an unstake.`;

		const sub = this.mds.inputModal.event.subscribe((result) => {
			if (result.event === 'done') {
				this.moveToSavings(parseFloat(result.value)).catch(console.log);
				sub.unsubscribe();
			} else if (result.event === 'close') {
				sub.unsubscribe();
			}
		});
		this.mds.inputModal.visibility = true;
	}

	createMoveFromSavingModal() {
		this.mds.inputModal.hintHTML = `
				Total Staked: ${formatNumber(this.matBucket[0].amount, 'en-us', '1.0-4')} REX`;
		this.mds.inputModal.maxValue = this.rexSavings;
		this.mds.inputModal.inputPlaceholder = 'Amount (REX)';
		this.mds.inputModal.buttonText = 'NEXT';
		this.mds.inputModal.modalTitle = 'Unstake your REX';
		this.mds.inputModal.modalTooltip = `Move REX out of your savings account so it can be sold after maturing. Unstaking takes at least 4 days to be completed.`;

		const sub = this.mds.inputModal.event.subscribe((result) => {
			if (result.event === 'done') {
				this.moveFromSavings(parseFloat(result.value)).catch(console.log);
				sub.unsubscribe();
			} else if (result.event === 'close') {
				sub.unsubscribe();
			}
		});
		this.mds.inputModal.visibility = true;
	}

	createAddToLoanFundModal(event, type) {
		const loan_num = event.loan_num;
		this.mds.inputModal.hintHTML = `
				Total Available: ${formatNumber(this.totalEOSliquid, 'en-us', '1.0-4')} ${this.aService.activeChain.symbol}`;
		this.mds.inputModal.maxValue = this.totalEOSliquid;
		this.mds.inputModal.inputPlaceholder = `Amount (${this.aService.activeChain.symbol})`;
		this.mds.inputModal.buttonText = 'NEXT';
		this.mds.inputModal.modalTitle = 'Add funds to ' + type + ' loan #' + loan_num;
		this.mds.inputModal.modalTooltip = `Add more ${this.aService.activeChain.symbol} to the ${type} loan #${loan_num} renewal fund.`;

		const sub = this.mds.inputModal.event.subscribe((result) => {
			if (result.event === 'done') {
				this.fundLoan(type, parseFloat(result.value), loan_num).catch(console.log);
				sub.unsubscribe();
			} else if (result.event === 'close') {
				sub.unsubscribe();
			}
		});
		this.mds.inputModal.visibility = true;
	}

	createDefundModal(event, type) {
		const loan_num = event.loan_num;
		this.mds.inputModal.hintHTML = `
				Renewal fund balance: ${event.balance}`;
		this.mds.inputModal.maxValue = event.balance;
		this.mds.inputModal.inputPlaceholder = `Amount (${this.aService.activeChain.symbol})`;
		this.mds.inputModal.buttonText = 'NEXT';
		this.mds.inputModal.modalTitle = 'Remove funds from ' + type + ' loan #' + loan_num;
		this.mds.inputModal.modalTooltip = `Remove ${this.aService.activeChain.symbol} from the ${type} loan #${loan_num} renewal fund.`;

		const sub = this.mds.inputModal.event.subscribe((result) => {
			if (result.event === 'done') {
				this.defundLoan(type, parseFloat(result.value), loan_num).catch(console.log);
				sub.unsubscribe();
			} else if (result.event === 'close') {
				sub.unsubscribe();
			}
		});
		this.mds.inputModal.visibility = true;
	}

	async fundLoan(type: string, amount: number, loan_num: number) {
		const [auth, publicKey] = this.trxFactory.getAuth();
		const sym = this.aService.activeChain['symbol'];
		const messageHTML = `
		<h5 class="white mb-0">Adding <span class="blue" style="font-weight: bold">${amount.toFixed(4)}</span> ${sym} to ${type} loan #${loan_num} renewal fund</h5>
		`;
		const _actions = [];
		if (amount > this.rexFund) {
			const _depositAmount = amount - this.rexFund;
			_actions.push({
				account: 'eosio',
				name: 'deposit',
				authorization: [auth],
				data: {
					'owner': auth.actor,
					'amount': _depositAmount.toFixed(4) + ' ' + sym
				}
			});
		}
		if (amount > 0) {
			_actions.push({
				account: 'eosio',
				name: 'fund' + type + 'loan',
				authorization: [auth],
				data: {
					'from': auth.actor,
					'loan_num': loan_num,
					'payment': amount.toFixed(4) + ' ' + sym
				}
			});
		}
		if (_actions.length > 0) {
			console.log(_actions);
			this.trxFactory.modalData.next({
				transactionPayload: {
					actions: _actions
				},
				termsHeader: '',
				signerAccount: auth.actor,
				signerPublicKey: publicKey,
				labelHTML: messageHTML,
				actionTitle: 'fund ' + type + ' loan',
				termsHTML: ''
			});
			this.trxFactory.launcher.emit(true);
			const subs = this.trxFactory.status.subscribe((event) => {
				console.log(event);
				if (event === 'done') {
					this.updateREXData(auth.actor);
					this.updateGlobalRexData();
					subs.unsubscribe();
				}
				if (event === 'modal_closed') {
					subs.unsubscribe();
				}
			});
		}
	}

	async defundLoan(type: string, amount: number, loan_num: number) {
		const [auth, publicKey] = this.trxFactory.getAuth();
		const sym = this.aService.activeChain['symbol'];
		const messageHTML = `
		<h5 class="white mb-0">Removing <span class="blue" style="font-weight: bold">${amount.toFixed(4)}</span> ${sym} from ${type} loan #${loan_num} renewal fund</h5>
		`;
		if (amount > 0) {
			this.trxFactory.modalData.next({
				transactionPayload: {
					actions: [{
						account: 'eosio',
						name: 'def' + type + 'loan',
						authorization: [auth],
						data: {
							'from': auth.actor,
							'loan_num': loan_num,
							amount: amount.toFixed(4) + ' ' + sym
						}
					}, {
						account: 'eosio',
						name: 'withdraw',
						authorization: [auth],
						data: {
							owner: auth.actor,
							amount: amount.toFixed(4) + ' ' + sym
						}
					}]
				},
				termsHeader: '',
				signerAccount: auth.actor,
				signerPublicKey: publicKey,
				labelHTML: messageHTML,
				actionTitle: 'defund ' + type + ' loan',
				termsHTML: ''
			});
			this.trxFactory.launcher.emit(true);
			const subs = this.trxFactory.status.subscribe((event) => {
				console.log(event);
				if (event === 'done') {
					this.updateREXData(auth.actor);
					this.updateGlobalRexData();
					subs.unsubscribe();
				}
				if (event === 'modal_closed') {
					subs.unsubscribe();
				}
			});
		}
	}

	async moveToSavings(amount) {
		// Transaction Signature
		const [auth, publicKey] = this.trxFactory.getAuth();
		const messageHTML = `
		<h5 class="white mb-0">Moving <span class="blue" style="font-weight: bold">${amount.toFixed(4)}</span> REX to savings</h5>
		`;
		if (amount > 0) {
			this.trxFactory.modalData.next({
				transactionPayload: {
					actions: [{
						account: 'eosio',
						name: 'mvtosavings',
						authorization: [auth],
						data: {
							owner: auth.actor,
							rex: amount.toFixed(4) + ' REX'
						}
					}]
				},
				termsHeader: '',
				signerAccount: auth.actor,
				signerPublicKey: publicKey,
				labelHTML: messageHTML,
				actionTitle: 'REX transfer to savings',
				termsHTML: ''
			});
			this.trxFactory.launcher.emit(true);
			const subs = this.trxFactory.status.subscribe((event) => {
				console.log(event);
				if (event === 'done') {
					this.updateREXData(auth.actor);
					this.updateGlobalRexData();
					subs.unsubscribe();
				}
				if (event === 'modal_closed') {
					subs.unsubscribe();
				}
			});
		}
	}

	async moveFromSavings(amount) {
		// Transaction Signature
		const [auth, publicKey] = this.trxFactory.getAuth();
		const messageHTML = `
		<h5 class="white mb-0">Unstaking <span class="blue" style="font-weight: bold">${amount.toFixed(4)}</span> REX from savings</h5>
		`;
		if (amount > 0) {
			this.trxFactory.modalData.next({
				transactionPayload: {
					actions: [{
						account: 'eosio',
						name: 'mvfrsavings',
						authorization: [auth],
						data: {
							owner: auth.actor,
							rex: amount.toFixed(4) + ' REX'
						}
					}]
				},
				termsHeader: '',
				signerAccount: auth.actor,
				signerPublicKey: publicKey,
				labelHTML: messageHTML,
				actionTitle: 'REX transfer from savings',
				termsHTML: ''
			});
			this.trxFactory.launcher.emit(true);
			const subs = this.trxFactory.status.subscribe((event) => {
				console.log(event);
				if (event === 'done') {
					this.updateREXData(auth.actor);
					this.updateGlobalRexData();
					subs.unsubscribe();
				}
				if (event === 'modal_closed') {
					subs.unsubscribe();
				}
			});
		}
	}

	setMaxToSell() {
		if (this.rexLiquid > 0) {
			this.sellForm.patchValue({
				REXamount: this.rexLiquid
			});
		}
	}

	setMaxLiquidToBuy() {
		if (this.totalEOSliquid > 0) {
			this.buyForm.patchValue({
				EOSamount: this.totalEOSliquid
			});
		}
	}

	setMaxConvert() {
		if (this.staked > 0) {
			this.convertForm.patchValue({
				EOSamount: this.staked
			});
		}
	}

	async sellRex() {
		// Transaction Signature
		const [auth, publicKey] = this.trxFactory.getAuth();
		const sym = this.aService.activeChain['symbol'];
		const amount = parseFloat(this.sellForm.get('REXamount').value);
		const estimated = `${(amount * this.rexPrice).toFixed(4)} ${sym}`;
		const messageHTML = `<h5 class="white mb-0">Selling <span class="blue" style="font-weight: bold">${formatNumber(amount, 'en-us', '1.0-4')}</span> REX to ${sym}</h5>
							 <p class="mt-0">Estimated yield: ${estimated}</p>`;

		const _actions = [];

		if (amount > 0) {
			_actions.push({
				account: 'eosio',
				name: 'sellrex',
				authorization: [auth],
				data: {
					from: auth.actor,
					rex: amount.toFixed(4) + ' REX'
				}
			});
		}

		if (this.sellForm.get('auto').value === true) {
			_actions.push({
				account: 'eosio',
				name: 'withdraw',
				authorization: [auth],
				data: {
					owner: auth.actor,
					amount: estimated
				}
			});
		}

		if (_actions.length > 0) {
			console.log(_actions);
			this.trxFactory.modalData.next({
				transactionPayload: {
					actions: _actions
				},
				termsHeader: '',
				signerAccount: auth.actor,
				signerPublicKey: publicKey,
				labelHTML: messageHTML,
				actionTitle: 'selling REX',
				termsHTML: ''
			});
			this.trxFactory.launcher.emit(true);
			const subs = this.trxFactory.status.subscribe((event) => {
				console.log(event);
				if (event === 'done') {
					this.updateREXData(auth.actor);
					this.updateGlobalRexData();
					this.sellForm.patchValue({
						REXamount: '',
						auto: true
					});
					subs.unsubscribe();
				}
				if (event === 'modal_closed') {
					subs.unsubscribe();
				}
			});
		}
	}

	async withdraw() {
		// Transaction Signature
		const [auth, publicKey] = this.trxFactory.getAuth();
		const sym = this.aService.activeChain['symbol'];
		const amount = this.rexFund;
		const messageHTML = `<h5 class="white mb-0">Transferring <span class="blue" style="font-weight: bold">${amount.toFixed(4)}</span> ${sym} from the REX fund back to <span class="blue" style="font-weight: bold">${auth.actor}</span></h5>`;

		if (amount > 0) {
			this.trxFactory.modalData.next({
				transactionPayload: {
					actions: [{
						account: 'eosio',
						name: 'withdraw',
						authorization: [auth],
						data: {
							owner: auth.actor,
							amount: amount.toFixed(4) + ' ' + sym
						}
					}]
				},
				termsHeader: '',
				signerAccount: auth.actor,
				signerPublicKey: publicKey,
				labelHTML: messageHTML,
				actionTitle: 'withdraw',
				termsHTML: ''
			});
			this.trxFactory.launcher.emit(true);
			const subs = this.trxFactory.status.subscribe((event) => {
				console.log(event);
				if (event === 'done') {
					this.updateREXData(auth.actor);
					this.updateGlobalRexData();
					subs.unsubscribe();
				}
				if (event === 'modal_closed') {
					subs.unsubscribe();
				}
			});
		}
	}

	async buyRex() {
		// Transaction Signature
		const [auth, publicKey] = this.trxFactory.getAuth();
		const sym = this.aService.activeChain['symbol'];
		const _actions = [];

		let messageHTML = '';

		if (this.REXfromStake > 0) {

			let cpu_amount, net_amount;
			const _cpu = this.advancedConvertForm.get('cpu').value;
			const _net = this.advancedConvertForm.get('net').value;
			if (_cpu > 0 || _net > 0) {
				cpu_amount = parseFloat(this.advancedConvertForm.get('cpu').value);
				net_amount = parseFloat(this.advancedConvertForm.get('net').value);
			} else {
				const stakingRatio = this.cpu_weight / (this.net_weight + this.cpu_weight);
				const amount = parseFloat(this.convertForm.get('EOSamount').value);
				cpu_amount = amount * stakingRatio;
				net_amount = amount - cpu_amount;
			}
			messageHTML += `<h5 class="white">Buying REX using <span class="blue" style="font-weight: bold">${formatNumber(cpu_amount, 'en-us', '1.0-4') + ' ' + sym}</span> from CPU <br> and <span class="blue" style="font-weight: bold">${formatNumber(net_amount, 'en-us', '1.0-4') + ' ' + sym}</span> from NET</h5>`;
			_actions.push(
				{
					account: 'eosio',
					name: 'unstaketorex',
					authorization: [auth],
					data: {
						owner: auth.actor,
						receiver: auth.actor,
						from_net: net_amount.toFixed(4) + ' ' + sym,
						from_cpu: cpu_amount.toFixed(4) + ' ' + sym
					}
				}
			);
		}

		if (this.REXtoBuy) {
			const _amount = parseFloat(this.buyForm.get('EOSamount').value).toFixed(4) + ' ' + sym;
			messageHTML += `<h5 class="white">Buying REX using <span class="blue" style="font-weight: bold">${formatNumber(parseFloat(this.buyForm.get('EOSamount').value), 'en-us', '1.0-4') + ' ' + sym}</span> from liquid tokens</h5>`;

			if (parseFloat(this.buyForm.get('EOSamount').value) > this.rexFund) {
				const _depositAmount = parseFloat(this.buyForm.get('EOSamount').value) - this.rexFund;
				_actions.push({
					account: 'eosio',
					name: 'deposit',
					authorization: [auth],
					data: {
						'owner': auth.actor,
						'amount': _depositAmount.toFixed(4) + ' ' + sym
					}
				});
			}

			_actions.push({
				account: 'eosio',
				name: 'buyrex',
				authorization: [auth],
				data: {
					'from': auth.actor,
					'amount': _amount
				}
			});
		}

		if (_actions.length > 0) {
			this.trxFactory.modalData.next({
				transactionPayload: {
					actions: _actions
				},
				termsHeader: '',
				signerAccount: auth.actor,
				signerPublicKey: publicKey,
				labelHTML: messageHTML,
				actionTitle: 'REX purchase',
				termsHTML: ''
			});
			this.trxFactory.launcher.emit(true);
			const subs = this.trxFactory.status.subscribe((event) => {
				console.log(event);
				if (event === 'done') {
					this.updateREXData(auth.actor);
					this.updateGlobalRexData();
					this.buyForm.reset();
					this.convertForm.reset();
					subs.unsubscribe();
				}
				if (event === 'modal_closed') {
					subs.unsubscribe();
				}
			});
		}
	}

	async voteOnProxy() {
		// get proxy producers
		const proxy = 'brockpierce1';
		const proxyInfo = await this.eosjs.rpc.get_account(proxy);
		const producers = proxyInfo.voter_info.producers;

		// Transaction Signature
		const [auth, publicKey] = this.trxFactory.getAuth();
		this.trxFactory.modalData.next({
			termsHTML: '',
			actionTitle: 'vote on proxy',
			labelHTML: `Do you confirm voting on the <strong class="blue">${proxy}</strong> ?<br><br>Currently voting for: <h5 class="mt-0" style="color: rgb(166,171,175);">${producers.join(', ')}</h5>`,
			signerAccount: auth.actor,
			signerPublicKey: publicKey,
			termsHeader: '',
			transactionPayload: {
				actions: [
					{
						account: 'eosio',
						name: 'voteproducer',
						authorization: [auth],
						data: {
							voter: auth.actor,
							proxy: proxy,
							producers: []
						}
					}
				]
			}
		});
		this.trxFactory.launcher.emit(true);
		const subs = this.trxFactory.status.subscribe((event) => {
			if (event === 'done') {
				setTimeout(async () => {
					const acc = await this.eosjs.rpc.get_account(auth.actor);
					this.checkRequirements(acc);
					subs.unsubscribe();
				}, 850);
			}
		});
	}

	gotoVote() {
		this.router['navigate'](['dashboard', 'vote']);
	}

	abstractCheckAmount(element: AbstractControl, limit: number, message: string, error_obj: any) {
		const _amount = parseFloat(element.value);
		if (isNaN(_amount)) {
			if (element.value !== '') {
				element.setErrors({'incorrect': true});
				this[error_obj] = 'invlid amount';
			}
		} else {
			if (_amount > limit) {
				element.setErrors({'incorrect': true});
				this[error_obj] = message;
			} else {
				element.setErrors(null);
				this[error_obj] = '';
			}
		}
	}

	checkAmount() {
		this.abstractCheckAmount(this.buyForm.get('EOSamount'), this.totalEOSliquid, 'insufficient funds', 'EOSamounterror');
	}

	checkSellAmount() {
		this.abstractCheckAmount(this.sellForm.get('REXamount'), this.rexLiquid, 'not enough REX', 'REXamounterror');
	}

	checkStakeAmount() {
		this.abstractCheckAmount(this.convertForm.get('EOSamount'), this.staked, 'insufficient stake', 'convertAmountError');
	}

	checkBorrowAmount() {
		let _cpu = this.cpuCost;
		if (isNaN(_cpu)) {
			_cpu = 0;
		}
		let _net = this.netCost;
		if (isNaN(_net)) {
			_net = 0;
		}
		let _renew = parseFloat(this.borrowForm.value.renewal);
		if (isNaN(_renew)) {
			_renew = 0;
		}
		const cpu_f = this.borrowForm.controls['CPUamount'];
		const net_f = this.borrowForm.controls['NETamount'];
		const err = 'invalid amount';
		if (_cpu > 0 || _net > 0) {
			const max = this.liquid - _renew;
			if (_cpu + _net > max) {
				if (_cpu > 0 && _net === 0) {
					cpu_f.setErrors({'incorrect': true});
					this.borrowCpuError = err;
				} else if (_net > 0 && _cpu === 0) {
					net_f.setErrors({'incorrect': true});
					this.borrowNetError = err;
				} else {
					cpu_f.setErrors({'incorrect': true});
					this.borrowCpuError = err;
					net_f.setErrors({'incorrect': true});
					this.borrowNetError = err;
				}
				if (_renew > 0) {
					this.borrowForm.controls['renewal'].setErrors({'incorrect': true});
					this.borrowRenewalError = err;
				}
			} else {
				cpu_f.setErrors(null);
				this.borrowCpuError = '';
				net_f.setErrors(null);
				this.borrowNetError = '';
				this.borrowForm.controls['renewal'].setErrors(null);
				this.borrowRenewalError = '';
			}
		}
	}

	private updateGlobalRexData() {
		this.eosjs.getRexPool().then((data) => {
			// console.log(data);
			this.total_unlent = RexComponent.asset2Float(data.total_unlent);
			this.total_lent = RexComponent.asset2Float(data.total_lent);
			this.total_rent = RexComponent.asset2Float(data.total_rent);
			this.calculateRexPrice(data);
			this.calculateBorrowingCost(data);
		});
	}

	changeRexTab(event) {
		this.rexMode = (event === 1 ? 'borrow' : 'trade');
	}

	async checkAccountName() {
		try {
			const acc_data = await this.eosjs.rpc.get_account(this.borrowForm.get('account').value);
			console.log(acc_data);
		} catch (e) {
			this.borrowAccErrorMsg = 'account not found!';
			this.borrowForm.controls['account'].setErrors({'incorrect': true});
		}
	}

	async borrowResources() {
		// Transaction Signature
		const [auth, publicKey] = this.trxFactory.getAuth();
		const sym = this.aService.activeChain['symbol'];
		const _actions = [];

		let messageHTML = '';
		let _receiver = auth.actor;
		if (this.borrowForm.get('accountReceiver').value === 'to another account') {
			_receiver = this.borrowForm.get('account').value;
		}
		let _totalRenew = parseFloat(this.borrowForm.get('renewal').value);
		if (isNaN(_totalRenew)) {
			_totalRenew = 0;
		}
		const extraAmount = (this.totalCost + _totalRenew) - this.rexFund;
		console.log(_totalRenew);


		// Check if a new deposit is required
		if (extraAmount > 0) {
			messageHTML += `<h5 class="white">Transferring <span class="blue" style="font-weight: bold">${extraAmount.toFixed(4)} ${sym}</span> to REX fund</h5>`;
			_actions.push({
				account: 'eosio',
				name: 'deposit',
				authorization: [auth],
				data: {
					'owner': auth.actor,
					'amount': extraAmount.toFixed(4) + ' ' + sym
				}
			});
		}


		if (this.cpuCost > 0) {
			let cpu_fund = _totalRenew;
			if (this.netCost > 0) {
				cpu_fund = cpu_fund * (this.cpuCost / this.totalCost);
			}
			const _estimatedCpu = parseFloat(this.borrowForm.get('CPUamount').value).toFixed(4);
			messageHTML += `<h5 class="white">Using <span class="blue" style="font-weight: bold">${this.cpuCost.toFixed(4)} ${sym}</span> from the REX fund to borrow <span class="blue" style="font-weight: bold">${_estimatedCpu} ${sym}</span> staked for CPU to ${_receiver}</h5>`;
			const _cpuPayment = this.cpuCost.toFixed(4) + ' ' + sym;
			if (cpu_fund > 0) {
				messageHTML += `<h5>Adding <span class="blue" style="font-weight: bold">${cpu_fund.toFixed(4) + ' ' + sym}</span> to the loan's renewal fund</h5>`;
			}
			_actions.push({
				account: 'eosio',
				name: 'rentcpu',
				authorization: [auth],
				data: {
					'from': auth.actor,
					'receiver': _receiver,
					'loan_payment': _cpuPayment,
					'loan_fund': cpu_fund.toFixed(4) + ' ' + sym
				}
			});
		}

		if (this.netCost > 0) {
			let net_fund = _totalRenew;
			if (this.cpuCost > 0) {
				net_fund = net_fund * (this.netCost / this.totalCost);
			}
			const _estimatedNet = parseFloat(this.borrowForm.get('NETamount').value).toFixed(4);
			messageHTML += `<h5 class="white">Using <span class="blue" style="font-weight: bold">${this.netCost.toFixed(4)} ${sym}</span> from the REX fund to borrow <span class="blue" style="font-weight: bold">${_estimatedNet} ${sym}</span> staked for NET to ${_receiver}</h5>`;
			const _netPayment = this.netCost.toFixed(4) + ' ' + sym;
			if (net_fund > 0) {
				messageHTML += `<h5>Adding <span class="blue" style="font-weight: bold">${net_fund.toFixed(4) + ' ' + sym}</span> to the loan's renewal fund</h5>`;
			}
			_actions.push({
				account: 'eosio',
				name: 'rentnet',
				authorization: [auth],
				data: {
					'from': auth.actor,
					'receiver': _receiver,
					'loan_payment': _netPayment,
					'loan_fund': net_fund.toFixed(4) + ' ' + sym
				}
			});
		}

		if (_actions.length > 0) {
			console.log(_actions);
			this.trxFactory.modalData.next({
				transactionPayload: {
					actions: _actions
				},
				termsHeader: '',
				signerAccount: auth.actor,
				signerPublicKey: publicKey,
				labelHTML: messageHTML,
				actionTitle: 'renting resources',
				termsHTML: ''
			});
			this.trxFactory.launcher.emit(true);
			const subs = this.trxFactory.status.subscribe((event) => {
				console.log(event);
				if (event === 'done') {
					this.updateREXData(auth.actor);
					this.updateGlobalRexData();
					subs.unsubscribe();
				}
				if (event === 'modal_closed') {
					subs.unsubscribe();
				}
			});
		}
	}

	async updaterex() {
		// Transaction Signature
		const [auth, publicKey] = this.trxFactory.getAuth();
		const messageHTML = `<h5 class="white mb-0">Updating REX Balances for <span class="blue" style="font-weight: bold">${auth.actor}</span></h5>`;

		this.trxFactory.modalData.next({
			transactionPayload: {
				actions: [{
					account: 'eosio',
					name: 'updaterex',
					authorization: [auth],
					data: {
						owner: auth.actor
					}
				}]
			},
			termsHeader: '',
			signerAccount: auth.actor,
			signerPublicKey: publicKey,
			labelHTML: messageHTML,
			actionTitle: 'update rex',
			termsHTML: ''
		});
		this.trxFactory.launcher.emit(true);
		const subs = this.trxFactory.status.subscribe((event) => {
			console.log(event);
			if (event === 'done') {
				this.updateREXData(auth.actor);
				this.updateGlobalRexData();
				subs.unsubscribe();
			}
			if (event === 'modal_closed') {
				subs.unsubscribe();
			}
		});
	}
}
