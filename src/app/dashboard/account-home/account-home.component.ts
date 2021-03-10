import {AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit} from '@angular/core';
import {AccountsService} from '../../services/accounts.service';
import {Subscription} from 'rxjs';
import {NetworkService} from '../../services/network.service';
import * as moment from 'moment';
import {faHome} from '@fortawesome/pro-regular-svg-icons/faHome';
import {faHistory} from '@fortawesome/pro-regular-svg-icons/faHistory';
import {faPaperPlane} from '@fortawesome/pro-regular-svg-icons/faPaperPlane';
import {faMemory} from '@fortawesome/pro-regular-svg-icons/faMemory';
import {faEdit} from '@fortawesome/pro-regular-svg-icons/faEdit';
import {faLock} from '@fortawesome/pro-regular-svg-icons/faLock';
import {faExchangeAlt} from '@fortawesome/pro-regular-svg-icons/faExchangeAlt';
import {faPuzzlePiece} from '@fortawesome/pro-regular-svg-icons/faPuzzlePiece';
import {faHeart} from '@fortawesome/pro-solid-svg-icons/faHeart';

@Component({
	selector: 'app-account-home',
	templateUrl: './account-home.component.html',
	styleUrls: ['./account-home.component.css']
})
export class AccountHomeComponent implements OnInit, OnDestroy, AfterViewInit {
	icons = {
		regular: {
			home: faHome,
			history: faHistory,
			send: faPaperPlane,
			memory: faMemory,
			edit: faEdit,
			lock: faLock,
			exchange: faExchangeAlt,
			puzzle: faPuzzlePiece
		},
		solid: {
			heart: faHeart
		},
	};

	fullBalance = 0;
	precision: string;
	staked: number;
	unstaked: number;
	unstaking: 0;
	unstakeTime: string;
	tokens: any[];
	selectedAccountName = '';

	private selectedAccountSubscription: Subscription;
	private lastUpdateSubscription: Subscription;

	constructor(public aService: AccountsService,
	            public network: NetworkService,
	            private cdr: ChangeDetectorRef) {
		this.staked = 0;
		this.unstaked = 0;
	}

	ngOnInit(): void {
		this.lastUpdateSubscription = this.aService.lastUpdate.asObservable().subscribe(value => {
			if (value.account === this.aService.selected.getValue().name) {
				this.updateBalances();
			}
		});
	}

	ngOnDestroy() {
		this.selectedAccountSubscription.unsubscribe();
		this.lastUpdateSubscription.unsubscribe();
	}

	ngAfterViewInit() {

		if (this.network.networkingReady.getValue()) {
			// this.getInfo().catch(console.log);
		} else {
			const statusSub = this.network.networkingReady.subscribe((status) => {
				if (status) {
					// this.getInfo().catch(console.log);
					statusSub.unsubscribe();
				}
			});
		}

		this.selectedAccountSubscription = this.aService.selected.asObservable().subscribe((sel) => {
			if (sel['name']) {
				if (this.selectedAccountName !== sel['name']) {
					this.selectedAccountName = sel['name'];
					this.onAccountChanged(sel);
				}
			}
			this.cdr.detectChanges();
		});
	}


	onAccountChanged(sel) {
		this.fullBalance = sel.full_balance;
		this.staked = sel.staked;
		this.unstaking = sel.unstaking;
		this.unstaked = this.fullBalance - this.staked - this.unstaking;
		this.unstakeTime = moment.utc(sel.unstakeTime).add(72, 'hours').fromNow();
		this.tokens = [];
		// this.actions = [];

		this.aService.refreshFromChain(false).catch(console.log);
		// this.frmFilters.patchValue({
		// 	selectAction: '',
		// 	startDate: '',
		// 	endDate: '',
		// });
		this.precision = '1.2-' + this.aService.activeChain.precision;
		// this.actionsFilter = this.buildHyperionFilters(sel['name']);
		// console.log(`get actions for ${sel.name}`);
		// this.loading = true;
		// this.aService.getAccActions(sel.name).then(() => {
		// 	this.loading = false;
		// 	this.actions = sel.actions;
		// }).catch(console.log);
	}

	updateBalances() {
		const sel = this.aService.selected.getValue();
		this.fullBalance = sel.full_balance;
		this.staked = sel.staked;
		this.unstaked = sel.full_balance - sel.staked - sel.unstaking;
	}

}


