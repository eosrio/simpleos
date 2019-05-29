import {AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit} from '@angular/core';
import {AccountsService} from '../../services/accounts.service';
import {EOSJSService} from '../../services/eosjs.service';

import {FormBuilder, FormGroup} from '@angular/forms';

import {MomentDateAdapter} from '@angular/material-moment-adapter';
import {DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE} from '@angular/material/core';

import * as moment from 'moment';
import {Subscription} from 'rxjs';

export const MY_FORMATS = {
	parse: {
		dateInput: 'LL',
	},
	display: {
		dateInput: 'LL',
		monthYearLabel: 'MMM YYYY',
		dateA11yLabel: 'LL',
		monthYearA11yLabel: 'MMMM YYYY',
	},
};

@Component({
	selector: 'app-wallet',
	templateUrl: './wallet.component.html',
	styleUrls: ['./wallet.component.css'],
	providers: [
		{provide: DateAdapter, useClass: MomentDateAdapter, deps: [MAT_DATE_LOCALE]},
		{provide: MAT_DATE_FORMATS, useValue: MY_FORMATS},
	],
})
export class WalletComponent implements OnInit, AfterViewInit, OnDestroy {

	fullBalance = 0;
	staked: number;
	unstaked: number;
	unstaking: 0;
	unstakeTime: string;
	moment: any;
	actions: any[];
	headBlock: number;
	LIB: number;
	blockTracker: any;
	tokens: any[];
	loading: boolean;
	memoAccOwner = {};
	memoAccActive = {};
	memoAccNew = '';
	memoCreator = '';
	lottieConfig: Object;
	actionsFilter = [];
	anim: any;
	selectedAccountName = '';
	actionMarked = '';
	dateAfter: string; // new FormControl(moment());
	dateBefore: string; // new FormControl(moment());
	minDate = new Date('2018-06-02T00:00:00.000Z');
	launchDate = new Date('2018-06-02T00:00:00.000Z');
	maxDate = new Date();

	frmFilters: FormGroup;
	private selectedAccountSubscription: Subscription;
	private lastUpdateSubscription: Subscription;

	constructor(
		public aService: AccountsService,
		public eos: EOSJSService,
		private cdr: ChangeDetectorRef,
		private fb: FormBuilder
	) {

		this.moment = moment;
		this.actions = [];
		this.tokens = [];
		this.headBlock = 0;
		this.staked = 0;
		this.unstaked = 0;
		this.LIB = 0;
		this.blockTracker = null;

		this.frmFilters = this.fb.group({
			selectAction: [''],
			startDate: [''],
			endDate: ['']
		});

		this.lottieConfig = {
			path: 'assets/maintenance_anim2.json',
			autoplay: true,
			loop: true
		};

	}

	openTX(value) {
		window['shell']['openExternal'](this.aService.activeChain['explorers'][0]['tx_url'] + value);
	}

	openAccount(acct?: string) {
		console.log('here!!!');
		if (acct) {
			window['shell']['openExternal'](this.aService.activeChain['explorers'][0]['account_url'] + acct);
		} else {
			window['shell']['openExternal'](this.aService.activeChain['explorers'][0]['account_url'] + this.aService.selected.getValue().name);
		}
	}

	openExplorer(accountName, explorer) {
		window['shell']['openExternal'](explorer.account_url + accountName);
	}

	handleAnimation(anim: any) {
		this.anim = anim;
		this.anim['setSpeed'](0.8);
	}

	getInfo() {
		this.eos['eos']['getInfo']({}).then((info) => {
			this.headBlock = info['head_block_num'];
			this.LIB = info['last_irreversible_block_num'];
		}).catch(err => {
			console.log('Error', err);
		});
	}

	choosedAction(val) {
		this.actionMarked = val;
		this.loadActionsLazy(0);
		this.cdr.detectChanges();
	}

	choosedAfterDate(val) {
		this.dateAfter = val !== null ? moment.utc(val).set({hour: 0, minute: 0, second: 0, millisecond: 0}).format() : '';
		this.minDate = new Date(val);
		this.loadActionsLazy(0);
	}

	choosedBeforeDate(val) {
		this.dateBefore = val !== null ? moment.utc(val).set({hour: 0, minute: 0, second: 0, millisecond: 0}).format() : '';
		this.maxDate = new Date(val);
		this.loadActionsLazy(0);
	}

	loadActionsLazy(e?) {
		const pos = e !== 0 ? e['first'] : 0;
		const account = this.aService.selected.getValue().name;
		if (this.aService.activeChain['historyApi'] !== '') {
			this.aService.getActions(account, 12, pos, this.actionMarked, this.dateAfter, this.dateBefore);
			this.aService.totalActions = 1000;
		}

	}

	ngOnInit() {
		// console.log('here', this.aService.totalActions);
		// console.log('Action', this.aService.actions);
		this.actionsFilter = [];
		this.lastUpdateSubscription = this.aService.lastUpdate.asObservable().subscribe(value => {
			if (value.account === this.aService.selected.getValue().name) {
				this.updateBalances();
			}
		});
		setTimeout(() => {
			this.getInfo();
		}, 5000);
		if (!this.blockTracker) {
			// this.blockTracker = setInterval(() => {
			// 	this.getInfo();
			// }, 10000);
		}

		this.loading = true;
	}

	ngOnDestroy() {
		if (this.blockTracker) {
			clearInterval(this.blockTracker);
			this.blockTracker = null;
		}
		this.selectedAccountSubscription.unsubscribe();
		this.lastUpdateSubscription.unsubscribe();
	}

	ngAfterViewInit() {
		this.selectedAccountSubscription = this.aService.selected.asObservable().subscribe((sel) => {
			if (sel['name']) {
				if (this.selectedAccountName !== sel['name']) {
					console.log('account selected:', sel);
					this.selectedAccountName = sel['name'];
					this.fullBalance = sel.full_balance;
					this.staked = sel.staked;
					this.unstaking = sel.unstaking;
					console.log(this.fullBalance, this.staked, this.unstaking);
					this.unstaked = this.fullBalance - this.staked - this.unstaking;
					this.unstakeTime = moment.utc(sel.unstakeTime).add(72, 'hours').fromNow();
					this.tokens = [];
					this.aService.reloadActions(sel['name']);
					this.aService.refreshFromChain();
					this.frmFilters.patchValue({
						selectAction: '',
						startDate: '',
						endDate: ''
					});
					this.actionsFilter = [
						{name: 'ALL ACTIONS', filter: ''},
						{name: 'ACCOUNT', filter: '&filter=*:newaccount'},
						{name: 'RECEIVE TOKEN', filter: '&filter=*:transfer&transfer.to=' + sel['name']},
						{name: 'SEND TOKEN', filter: '&filter=*:transfer&transfer.from=' + sel['name']},
						{name: 'STAKE', filter: '&filter=*:delegatebw'},
						{name: 'UNSTAKE', filter: '&filter=*:undelegatebw'},
						{name: 'VOTE', filter: '&filter=*:voteproducer'},
						{name: 'RAM BUY', filter: '&filter=*:buyrambytes'},
						{name: 'RAM SELL', filter: '&filter=*:sellram'},
						{name: 'BUY REX', filter: '&filter=*:buyrex'},
						{name: 'SELL REX', filter: '&filter=*:sellrex'},
						{name: 'STAKE REX', filter: '&filter=*:mvtosavings'},
						{name: 'UNSTAKE REX', filter: '&filter=*:mvfrsavings'},
						{name: 'RENT CPU', filter: '&filter=*:rentcpu'},
						{name: 'RENT NET', filter: '&filter=*:rentnet'}
					];

				}
			}
			this.cdr.detectChanges();
		});
	}

	dateSort(ev) {
		ev.field.forEach(data => {
			console.log(data);
		});
	}

	memoCreatorAccName(info) {
		const creator = JSON.stringify(JSON.parse(info)['creator']).replace(new RegExp('\"', 'g'), '');
		return creator === this.aService.selected.getValue().name ? 'this account' : creator;
	}


	// loadHistoryLazy(LazyLoadEvent) {
	//   console.log(LazyLoadEvent);
	//   let order = 'desc';
	//   if (LazyLoadEvent.sortField === 'date') {
	//     if (LazyLoadEvent.sortOrder === 1) {
	//       order = 'asc';
	//     }
	//   }
	//
	//   this.aService.getAccActions(null, LazyLoadEvent.first, LazyLoadEvent.rows, order);
	//   this.loading = false;
	// }

	updateBalances() {
		const sel = this.aService.selected.getValue();
		this.fullBalance = sel.full_balance;
		this.staked = sel.staked;
		this.unstaked = sel.full_balance - sel.staked - sel.unstaking;
	}

	refresh() {
		this.actionMarked = '';
		this.dateBefore = '';
		this.dateAfter = '';
		this.minDate = new Date();
		this.maxDate = new Date();
		this.aService.reloadActions(this.aService.selected.getValue().name);
	}

}
