import {AfterViewInit, Component, OnDestroy, OnInit} from '@angular/core';
import {AccountsService} from '../../services/accounts.service';
import {EOSJSService} from '../../services/eosjs.service';

import * as moment from 'moment';

@Component({
	selector: 'app-wallet',
	templateUrl: './wallet.component.html',
	styleUrls: ['./wallet.component.css']
})
export class WalletComponent implements OnInit, AfterViewInit, OnDestroy {
	fullBalance: number;
	staked: number;
	unstaked: number;
	moment: any;
	actions: any[];
	headBlock: number;
	LIB: number;
	blockTracker: any;
	tokens: any[];
	loading: boolean;
	memoAccOwner = '';
	memoAccActive = '';
	lottieConfig: Object;
	anim: any;
	selectedAccountName = '';

	constructor(public aService: AccountsService, public eos: EOSJSService) {
		this.moment = moment;
		this.actions = [];
		this.tokens = [];
		this.headBlock = 0;
		this.fullBalance = 0;
		this.staked = 0;
		this.unstaked = 0;
		this.LIB = 0;
		this.blockTracker = null;
		this.lottieConfig = {
			path: 'assets/maintenance_anim2.json',
			autoplay: true,
			loop: true
		};
	}

	openTX(value) {
		window['shell']['openExternal'](this.aService.activeChain['explorers'][0]['tx_url'] + value);
	}

	openAccount() {
		window['shell']['openExternal'](this.aService.activeChain['explorers'][0]['account_url'] + this.aService.selected.getValue().name);
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


	ngOnInit() {
		// console.log('here', this.aService.totalActions);
		// console.log('Action', this.aService.actions);
		this.aService.lastUpdate.asObservable().subscribe(value => {
			if (value.account === this.aService.selected.getValue().name) {
				this.updateBalances();
			}
		});
		setTimeout(() => {
			this.getInfo();
		}, 5000);
		if (!this.blockTracker) {
			this.blockTracker = setInterval(() => {
				this.getInfo();
			}, 5000);

		}

		this.loading = true;
	}

	ngOnDestroy() {
		if (this.blockTracker) {
			clearInterval(this.blockTracker);
			this.blockTracker = null;
		}
	}

	ngAfterViewInit() {
		this.aService.selected.asObservable().subscribe((sel) => {
			if (sel['name']) {
				if (this.selectedAccountName !== sel['name']) {
					// console.log('account selected:' + sel['name']);
					this.selectedAccountName = sel['name'];
					this.fullBalance = sel.full_balance;
					this.staked = sel.staked;
					this.unstaked = sel.full_balance - sel.staked;
					this.tokens = [];
					this.aService.reloadActions(sel.name);
					this.aService.refreshFromChain();
				}
			}
		});
	}

	dateSort(ev) {
		ev.field.forEach(data => {
			console.log(data);
		});
	}

	memoNewAcc(info) {
		this.memoAccOwner = JSON.stringify(JSON.parse(info)['owner']);
		this.memoAccActive = JSON.stringify(JSON.parse(info)['active']);
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
		this.unstaked = sel.full_balance - sel.staked;
	}

	refresh() {
		this.aService.reloadActions(this.aService.selected.getValue().name);
	}

}
