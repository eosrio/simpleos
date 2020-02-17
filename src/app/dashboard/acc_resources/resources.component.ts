import {Component, OnDestroy, OnInit} from '@angular/core';
import {BodyOutputType, Toast, ToasterConfig, ToasterService} from 'angular2-toaster';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {EOSAccount} from '../../interfaces/account';
import {createNumberMask} from 'text-mask-addons/dist/textMaskAddons';

import {AccountsService} from '../../services/accounts.service';
import {CryptoService} from '../../services/crypto/crypto.service';
import {RamService} from '../../services/ram.service';
import {EOSJSService} from '../../services/eosio/eosjs.service';

import * as moment from 'moment';

@Component({
	selector: 'app-ram-market',
	templateUrl: './resources.component.html',
	styleUrls: ['./resources.component.css']
})
export class ResourcesComponent implements OnInit {
	passBuyModal: boolean;
	passSellModal: boolean;
	passUnDelegateModal: boolean;
	passDelegateModal: boolean;
	requestRefundModal: boolean;

	myRamAlloc = 0;
	totalRamAlloc = 0;
	ramPriceEOS = 0;
	amountbytes = 1024;
	total_ram_bytes_reserved = 0;
	total_ram_stake = 0;
	max_ram_size = 0;
	rm_base = 0;
	rm_quote = 0;
	rm_supply = 0;

	feeBuy = 0;
	feeSell = 0;
	receiver: string;
	payer: string;
	seller: string;
	bytesbuy: string;
	bytessell: string;
	unstaked: number;

	ram_chart: any;
	ram_chartMerge: any;
	dataDT: any[];
	dataVAL: any[];
	timer: any;

	config: ToasterConfig;

	ramMarketFormBuy: FormGroup;
	ramMarketFormSell: FormGroup;
	passBuyForm: FormGroup;
	passSellForm: FormGroup;
	passUnDelegateForm: FormGroup;
	delegateForm: FormGroup;
	passDelegateForm: FormGroup;
	passRefundForm: FormGroup;

	currentSelAccountName: string;

	ram_quota = 0;
	ram_usage = 0;
	cpu_limit: any;
	cpu_weight = '';
	cpu_weight_n = 0;
	net_limit: any;
	net_weight = '';
	net_weight_n = 0;

	delegations = [];
	delegated_net = 0;
	delegated_cpu = 0;
	fromUD: string;
	netUD: string;
	cpuUD: string;
	accNow: string;

	cpuD = '';
	netD = '';
	accTo: string;
	errormsgD = '';
	errormsgD2 = '';
	errormsgD3 = '';

	info: any[];

	busy: boolean;
	ramActionModal = false;
	wrongpassbuy = '';
	wrongpasssell = '';
	wrongpassundelegate = '';
	wrongpassdelegate = '';
	wrongpassrefund = '';
	errormsg = '';
	errormsg2 = '';
	errormsgeos = '';
	handleIcon = 'M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,' +
		'8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z';

	sellValue = 0;

	numberMask = createNumberMask({
		prefix: '',
		allowDecimal: true,
		includeThousandsSeparator: false,
		decimalLimit: 4
	});

	ramLoaderInterval: any;


	constructor(
		private eos: EOSJSService,
		public aService: AccountsService,
		private crypto: CryptoService,
		private toaster: ToasterService,
		private fb: FormBuilder,
		public ramService: RamService,
		private http: HttpClient
	) {
		this.busy = false;
		this.dataDT = [];
		this.dataVAL = [];
		this.ram_chartMerge = [];
		this.wrongpassbuy = '';
		this.wrongpasssell = '';
		this.wrongpassundelegate = '';
		this.wrongpassdelegate = '';
		this.errormsg = '';
		this.errormsg2 = '';
		this.errormsgeos = '';
		this.errormsgD = '';
		this.errormsgD2 = '';
		this.errormsgD3 = '';

		this.net_limit = {
			used: 0
		};

		this.cpu_limit = {
			used: 0
		};

		this.ramMarketFormBuy = this.fb.group({
			buyBytes: [0, Validators.required],
			buyEos: [0],
			accountBuy: ['to this account', Validators.required],
			anotherAcc: ['']
		});

		this.delegateForm = this.fb.group({
			netEos: [0, Validators.min(0)],
			cpuEos: [0, Validators.min(0)],
			receiverAcc: ['', Validators.required]
		});

		this.ramMarketFormSell = this.fb.group({
			sellEos: [0],
			sellBytes: [0, Validators.required]
		});

		this.passBuyForm = this.fb.group({
			pass: ''
		});

		this.passSellForm = this.fb.group({
			pass: ''
		});

		this.passUnDelegateForm = this.fb.group({
			pass: ''
		});

		this.passDelegateForm = this.fb.group({
			pass: ''
		});

		this.passRefundForm = this.fb.group({
			pass: ''
		});

		this.ram_chart = {
			title: {
				left: 'center',
				subtext: 'daily RAM price chart',
				subtextStyle: {
					color: '#ffffff',
					fontWeight: 'bold',
				},
				top: '20'
			},
			grid: {
				height: '67%',
				width: '70%',
				right: '47',
			},
			tooltip: {
				trigger: 'axis',
				position: function (pt) {
					return [pt[0], '20%'];
				},
				formatter: function (params) {
					params = params[0];
					return moment(params.name).format('HH:mm[\n]DD/MM/YYYY') + ' : ' + params.value.toFixed(6);
				},
			},
			xAxis: {
				type: 'category',
				boundaryGap: false,
				data: [],
				axisLine: {
					lineStyle: {
						color: '#B7B7B7', // cor da linha x
					},
				},
				axisLabel: {
					textStyle: {
						color: '#B7B7B7', // cor do texto da linha x
					},
					formatter: function (params) {
						return moment(params).format('HH:mm[\n]DD/MM');
					},
				},
			},
			yAxis: {
				type: 'value',
				boundaryGap: [0, '100%'],
				axisLine: {
					lineStyle: {
						color: '#B7B7B7', // cor da linha y
					},
				},
				axisLabel: {
					textStyle: {
						color: '#B7B7B7', // cor do texto da linha y
					},
				},
				splitLine: {
					lineStyle: {
						color: '#3c3a3a', // cor das linhas no meio
					}
				},
				scale: true
			},
			dataZoom: [{
				show: true,
				realtime: true,
				start: 60,
				end: 100,
				handleIcon: 'M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z',
				handleSize: '80%',
				handleStyle: {
					color: '#fff',
					shadowBlur: 3,
					shadowColor: 'rgba(0, 0, 0, 0.7)',
					shadowOffsetX: 2,
					shadowOffsetY: 2
				}, textStyle: {
					color: '#FFFFFF',
				},
				labelFormatter: function (params, out) {
					return moment(out).format('HH:mm[\n]DD/MM');
				},
				dataBackground: {
					lineStyle: {
						color: 'rgba(0, 148, 210, 0.5'
					},
					areaStyle: {
						color: 'rgba(0, 143, 203, 0.5'
					}
				}
			}, {
				type: 'inside',
				realtime: true,
				start: 60,
				end: 100,
				bottom: 0
			}],
			series: [
				{
					name: 'RAM price',
					type: 'line',
					smooth: true,
					symbol: 'none',
					sampling: 'average',
					itemStyle: {
						normal: {
							color: 'rgb(0, 148, 210)' // cor da linha
						}
					},
					areaStyle: {
						color: {
							type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
							colorStops: [{
								offset: 0, color: 'rgb(149, 223, 255, 0.6)' // cor do gradiente em cima
							}, {
								offset: 1, color: 'rgb(0, 143, 203, 0.6)' // cor do gradiente embaixo
							}],
						}
					},
					data: []
				}
			]
		};

	}

	ngOnInit() {
		this.loadHistory();
		this.ramService.reload();
		this.aService.selected.asObservable().subscribe((selected: any) => {
			if (selected.details) {
				this.ramPriceEOS = this.ramService.ramPriceEOS;
				const d = selected.details;
				this.ram_quota = d.ram_quota;
				this.ram_usage = d.ram_usage;
				this.cpu_limit = d.cpu_limit;
				this.net_limit = d.net_limit;
				this.cpu_weight = d.total_resources.cpu_weight;
				this.cpu_weight_n = parseFloat(this.cpu_weight.split(' ')[0]);
				this.net_weight = d.total_resources.net_weight;
				this.net_weight_n = parseFloat(this.net_weight.split(' ')[0]);
				this.listbw(selected.name);
			}
		});

	}

	private showToast(type: string, title: string, body: string) {
		this.config = new ToasterConfig({
			positionClass: 'toast-top-right',
			timeout: 10000,
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
			timeout: 10000,
			showCloseButton: true,
			bodyOutputType: BodyOutputType.TrustedHtml,
		};
		this.toaster.popAsync(toast);
	}

	listbw(account_name) {
		this.eos.listDelegations(account_name).then((results) => {
			if (results.rows.length > 0) {
				this.delegations = [];
				this.delegated_net = 0;
				this.delegated_cpu = 0;
				results.rows.forEach((entry) => {
					if (entry.from !== entry.to) {
						entry.net_weight = entry.net_weight.split(' ')[0];
						entry.cpu_weight = entry.cpu_weight.split(' ')[0];
						this.delegated_net += parseFloat(entry.net_weight);
						this.delegated_cpu += parseFloat(entry.cpu_weight);
						this.delegations.push(entry);
					}
				});
			} else {
				this.delegations = [];
				this.delegated_net = 0;
				this.delegated_cpu = 0;
			}
		});
	}

	convertToBytes() {
		if (this.ramPriceEOS > 0) {
			this.ramMarketFormBuy.patchValue({
				buyBytes: (this.ramMarketFormBuy.get('buyEos').value / this.ramPriceEOS)
			});
			this.feeBuy = this.feeCalculator(this.ramMarketFormBuy.get('buyEos').value);
		}
	}

	convertToEos() {
		if (this.ramPriceEOS > 0) {
			this.ramMarketFormBuy.patchValue({
				buyEos: (this.ramMarketFormBuy.get('buyBytes').value * this.ramPriceEOS)
			});
			this.feeBuy = this.feeCalculator(this.ramMarketFormBuy.get('buyEos').value);
		}
	}

	convertToEosSELL() {
		if (this.ramPriceEOS > 0) {
			this.ramMarketFormSell.patchValue({
				sellEos: (this.ramMarketFormSell.get('sellBytes').value * this.ramPriceEOS)
			});
			this.feeSell = this.feeCalculator(this.ramMarketFormSell.get('sellEos').value);
		}

	}

	convertToBytesSELL() {
		if (this.ramPriceEOS > 0) {
			this.ramMarketFormSell.patchValue({
				sellBytes: (this.ramMarketFormSell.get('sellEos').value / this.ramPriceEOS)
			});
			this.feeSell = this.feeCalculator(this.ramMarketFormSell.get('sellEos').value);
		}
	}

	bytesFilter(bytes, precision?) {
		if (isNaN(parseFloat(bytes)) || !isFinite(bytes)) {
			return '-';
		}
		const units = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB'],
			number = Math.floor(Math.log(bytes) / Math.log(1024));
		return (bytes / Math.pow(1024, Math.floor(number))).toFixed(4) + ' ' + units[number];
	}

	feeCalculator(eosprice: number) {
		return eosprice * .005;
	}

	openRamModal() {
		this.ramActionModal = true;
	}

	updateChart() {
		this.ram_chartMerge = {
			xAxis: {
				data: this.dataDT
			},
			series: {
				data: this.dataVAL
			}
		};
	}

	loadHistory() {
		let i = 0;
		this.http.get('https://hapi.eosrio.io/ram/history1D').subscribe((data: any[]) => {
			const arr = data;
			arr.reverse();
			data.forEach((val) => {
				this.dataDT.push(val.time);
				this.dataVAL.push(val.price);
				i++;
			});
			this.updateChart();
			let j = 0;
			this.ramService.ramTicker.asObservable().subscribe((ramdata) => {
				if (ramdata) {
					if (ramdata.price) {
						const dt = new Date(ramdata.time);
						this.ramPriceEOS = ramdata.price;
						this.dataDT.push(dt.toISOString());
						this.dataVAL.push(ramdata.price);
						this.updateChart();
						j++;
					}
				}
			});
		});
	}

	checkAccountName() {
		if (this.ramMarketFormBuy.value.anotherAcc !== '') {
			try {
				this.eos.checkAccountName(this.ramMarketFormBuy.value.anotherAcc.toLowerCase());
				this.ramMarketFormBuy.controls['anotherAcc'].setErrors(null);
				this.errormsg = '';
				this.eos.getAccountInfo(this.ramMarketFormBuy.value.anotherAcc.toLowerCase()).then(() => {
					this.ramMarketFormBuy.controls['anotherAcc'].setErrors(null);
					this.errormsg = '';
				}).catch(() => {
					this.ramMarketFormBuy.controls['anotherAcc'].setErrors({'incorrect': true});
					this.errormsg = 'account does not exist';
				});
			} catch (e) {
				this.ramMarketFormBuy.controls['anotherAcc'].setErrors({'incorrect': true});
				this.errormsg = e.message;
			}
		} else {
			this.errormsg = '';
		}
	}

	checkAccName() {
		if (this.delegateForm.value.receiverAcc !== '') {
			try {
				this.eos.checkAccountName(this.delegateForm.value.receiverAcc.toLowerCase());
				this.delegateForm.controls['receiverAcc'].setErrors(null);
				this.errormsgD = '';
				this.eos.getAccountInfo(this.delegateForm.value.receiverAcc.toLowerCase()).then(() => {
					this.delegateForm.controls['receiverAcc'].setErrors(null);
					this.errormsgD = '';

				}).catch(() => {
					this.delegateForm.controls['receiverAcc'].setErrors({'incorrect': true});
					this.errormsgD = 'account does not exist';
				});
			} catch (e) {
				this.delegateForm.controls['receiverAcc'].setErrors({'incorrect': true});
				this.errormsgD = e.message;
			}
		} else {
			this.errormsg = '';
		}
	}

	checkBuyBytes() {
		if (this.ramMarketFormBuy.value.buyBytes > 0) {
			this.aService.selected.asObservable().subscribe((sel: EOSAccount) => {
				if (sel) {
					this.unstaked = sel.full_balance - sel.staked - sel.unstaking;
					// this.unstakeTime = moment.utc(sel.unstakeTime).add(72, 'hours').fromNow();
				}
			});
			if (this.unstaked > this.ramMarketFormBuy.get('buyEos').value) {
				this.ramMarketFormBuy.controls['buyBytes'].setErrors(null);
				this.ramMarketFormBuy.controls['buyEos'].setErrors(null);
				this.errormsg2 = '';
				return true;
			} else {
				this.ramMarketFormBuy.controls['buyEos'].setErrors({'incorrect': true});
				this.errormsg2 = 'not enough unstaked ' + this.aService.activeChain['symbol'] + '!';
				return false;
			}
		} else {
			this.ramMarketFormBuy.controls['buyBytes'].setErrors({'incorrect': true});
			this.errormsg2 = 'must fill RAM amount or price';
			return false;
		}
	}

	checkSellBytes() {
		if (this.ramMarketFormSell.value.sellBytes > 0) {
			if ((this.ram_quota - this.ram_usage) > (this.ramMarketFormSell.get('sellBytes').value) * 1024) {
				this.ramMarketFormSell.controls['sellBytes'].setErrors(null);
				this.ramMarketFormSell.controls['sellEos'].setErrors(null);
				this.errormsgeos = '';
				return true;
			} else {
				this.ramMarketFormSell.controls['sellEos'].setErrors({'incorrect': true});
				this.errormsgeos = 'not enough RAM!';
				return false;
			}
		} else {
			this.ramMarketFormSell.controls['sellBytes'].setErrors({'incorrect': true});
			this.errormsgeos = 'must fill RAM amount or price';
			return false;
		}
	}

	fillSell() {
		if (this.checkSellBytes()) {
			this.passSellModal = true;
			this.wrongpassbuy = '';
			this.seller = this.aService.selected.getValue().name;
			this.bytessell = '' + (this.ramMarketFormSell.get('sellBytes').value * 1024);
		}
	}

	rtRefund() {
		this.busy = true;
		console.log(this.busy);
		this.wrongpassrefund = '';
		const account = this.aService.selected.getValue();
		const namesel = this.aService.selected.getValue().name;
		const password = this.passRefundForm.get('pass').value;
		const [pubkey, permission] = this.aService.getStoredKey(account);
		this.crypto.authenticate(password, pubkey).then((data) => {
			if (data === true) {
				this.eos.requestRefund(namesel, permission).then((e) => {
					this.requestRefundModal = false;
					this.showToast('success', 'Transation broadcasted', 'Check your history for confirmation.');
					this.aService.refreshFromChain();
					this.busy = false;
				}).catch((error) => {
					if (typeof error === 'object') {
						if (error.json) {
							this.wrongpassrefund = 'Error: '+error.json.error.details[0].message;
						} else {
							this.wrongpassrefund = 'Error: '+error.error.details[0].message;
						}
					}else{
						if (error.json) {
							this.wrongpassrefund = 'Error: '+JSON.parse(error).json.error.details[0].message;
						} else {
							this.wrongpassrefund = 'Error: '+JSON.parse(error).error.details[0].message;
						}
					}
					this.busy = false;
				});
			}
		}).catch(() => {
			this.wrongpassrefund = 'Wrong password!';
			this.busy = false;
		});

	}

	sell() {
		this.busy = true;
		this.wrongpasssell = '';
		const account = this.aService.selected.getValue();
		const password = this.passSellForm.get('pass').value;
		const [pubkey, permission] = this.aService.getStoredKey(account);
		this.crypto.authenticate(password, pubkey).then((data) => {
			if (data === true) {
				this.eos.ramSellBytes(this.seller, this.bytessell, permission).then((e) => {
					this.passSellModal = false;
					this.showToast('success', 'Transation broadcasted', 'Check your history for confirmation.');
					this.aService.refreshFromChain();
					this.busy = false;
				}).catch((error) => {
					if (typeof error === 'object') {
						if (error.json) {
							this.wrongpasssell = 'Error: '+error.json.error.details[0].message;
						} else {
							this.wrongpasssell = 'Error: '+error.error.details[0].message;
						}
					}else{
						if (error.json) {
							this.wrongpasssell = 'Error: '+JSON.parse(error).json.error.details[0].message;
						} else {
							this.wrongpasssell = 'Error: '+JSON.parse(error).error.details[0].message;
						}
					}
					this.busy = false;
				});
			}
		}).catch(() => {
			this.wrongpasssell = 'Wrong password!';
			this.busy = false;
		});

	}

	fillBuy() {
		if (this.checkBuyBytes()) {
			this.passBuyModal = true;
			this.wrongpassbuy = '';
			this.receiver = this.aService.selected.getValue().name;
			this.payer = this.aService.selected.getValue().name;
			this.bytesbuy = '' + (this.ramMarketFormBuy.get('buyBytes').value * 1024);
			const accountBuy = this.ramMarketFormBuy.get('accountBuy').value;
			if (accountBuy === 'to another account') {
				this.receiver = this.ramMarketFormBuy.get('anotherAcc').value;
			}
		}
	}

	buy() {
		this.busy = true;
		this.wrongpassbuy = '';
		const account = this.aService.selected.getValue();
		const password = this.passBuyForm.get('pass').value;
		const [pubkey, permission] = this.aService.getStoredKey(account);
		this.crypto.authenticate(password, pubkey).then((data) => {
			if (data === true) {
				this.eos.ramBuyBytes(this.payer, this.receiver, this.bytesbuy, permission).then((e) => {
					this.passBuyModal = false;
					this.showToast('success', 'Transation broadcasted', 'Check your history for confirmation.');
					this.aService.refreshFromChain();
					this.busy = false;
				}).catch((error) => {
					if (typeof error === 'object') {
						if (error.json) {
							this.wrongpassbuy = 'Error: '+error.json.error.details[0].message;
						} else {
							this.wrongpassbuy = 'Error: '+error.error.details[0].message;
						}
					}else{
						if (error.json) {
							this.wrongpassbuy = 'Error: '+JSON.parse(error).json.error.details[0].message;
						} else {
							this.wrongpassbuy = 'Error: '+JSON.parse(error).error.details[0].message;
						}
					}
					this.busy = false;
				});
			}
		}).catch(() => {
			this.wrongpassbuy = 'Wrong password!';
			this.busy = false;
		});
	}

	fillUnDelegateRequest(from: string, net: string, cpu: string) {
		this.fromUD = from;
		this.netUD = net;
		this.cpuUD = cpu;
		this.accNow = this.aService.selected.getValue().name;
		this.wrongpassundelegate = '';
	}

	unDelegateRequest() {
		this.busy = true;
		const account = this.aService.selected.getValue();
		const password = this.passUnDelegateForm.get('pass').value;
		const [pubkey, permission] = this.aService.getStoredKey(account);
		this.crypto.authenticate(password, pubkey).then((data) => {
			if (data === true) {
				this.eos.unDelegate(this.accNow, this.fromUD, this.netUD, this.cpuUD, this.aService.activeChain['symbol'], permission).then((e) => {
					this.fromUD = '';
					this.netUD = '';
					this.cpuUD = '';
					this.accNow = '';
					this.passUnDelegateModal = false;
					this.showToast('success', 'Transation broadcasted', 'Check your history for confirmation.');
				}).catch((error) => {
					if (typeof error === 'object') {
						if (error.json) {
							this.wrongpassundelegate = 'Error: '+error.json.error.details[0].message;
						} else {
							this.wrongpassundelegate = 'Error: '+error.error.details[0].message;
						}
					}else{
						if (error.json) {
							this.wrongpassundelegate = 'Error: '+JSON.parse(error).json.error.details[0].message;
						} else {
							this.wrongpassundelegate = 'Error: '+JSON.parse(error).error.details[0].message;
						}
					}
					this.busy = false;
				});
			}
		}).catch((q) => {
			this.busy = false;
			this.wrongpassundelegate = 'Wrong password!';
		});
		this.wrongpassundelegate = '';
	}

	checkEos(eosVal, val) {
		if (eosVal > 0) {
			const sel = this.aService.selected.getValue();
			if (sel) {
				if (val === 'net') {
					this.unstaked = sel.full_balance - sel.staked - sel.unstaking - this.delegateForm.get('cpuEos').value;
				} else {
					this.unstaked = sel.full_balance - sel.staked - sel.unstaking - this.delegateForm.get('netEos').value;
				}
			}
			if (this.unstaked > eosVal) {
				this.errormsgD3 = '';
				return true;
			} else {
				this.errormsgD3 = 'not enough unstaked ' + this.aService.activeChain['symbol'] + '!';
				return false;
			}
		} else {
			this.errormsgD3 = 'must fill NET and CPU amount';
			return false;
		}
	}

	fillDelegateRequest() {
		this.accTo = this.delegateForm.get('receiverAcc').value;
		this.netD = parseFloat(this.delegateForm.get('netEos').value).toFixed(this.aService.activeChain['precision']);
		this.cpuD = parseFloat(this.delegateForm.get('cpuEos').value).toFixed(this.aService.activeChain['precision']);
		this.accNow = this.aService.selected.getValue().name;

	}

	delegateRequest() {
		this.wrongpassdelegate = '';
		this.busy = true;
		const account = this.aService.selected.getValue();
		const password = this.passDelegateForm.get('pass').value;
		const [pubkey, permission] = this.aService.getStoredKey(account);
		this.crypto.authenticate(password, pubkey).then((data) => {
			if (data === true) {
				this.eos.delegateBW(this.accNow, this.accTo, this.netD, this.cpuD, this.aService.activeChain['symbol'], permission).then((e) => {
					this.accTo = '';
					this.netD = '';
					this.cpuD = '';
					this.accNow = '';
					this.busy = false;
					this.passDelegateModal = false;
					this.showToast('success', 'Transation broadcasted', 'Check your history for confirmation.');
				}).catch((error) => {
					console.log(error);
					this.busy = false;
					if (typeof error === 'object') {
						if (error.json) {
							this.wrongpassdelegate = 'Error: '+error.json.error.details[0].message;
						} else {
							this.wrongpassdelegate = 'Error: '+error.error.details[0].message;
						}
					}else{
						if (error.json) {
							this.wrongpassdelegate = 'Error: '+JSON.parse(error).json.error.details[0].message;
						} else {
							this.wrongpassdelegate = 'Error: '+JSON.parse(error).error.details[0].message;
						}
					}
				});
			}
		}).catch((q) => {
			this.busy = false;
			this.wrongpassundelegate = 'Wrong password!';
		});
		// this.wrongpassdelegate = '';
		// this.passDelegateForm.reset();
		// this.busy = false;
	}

}
