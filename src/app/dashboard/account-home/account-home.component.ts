import {AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit} from '@angular/core';
import {AccountsService} from '../../services/accounts.service';
import {Subscription} from 'rxjs';
import {NetworkService} from '../../services/network.service';
import * as moment from 'moment';
import {faHistory} from '@fortawesome/pro-regular-svg-icons/faHistory';
import {faPaperPlane} from '@fortawesome/pro-regular-svg-icons/faPaperPlane';
import {faMemory} from '@fortawesome/pro-regular-svg-icons/faMemory';
import {faEdit} from '@fortawesome/pro-regular-svg-icons/faEdit';
import {faExchangeAlt} from '@fortawesome/pro-regular-svg-icons/faExchangeAlt';
import {faPuzzlePiece} from '@fortawesome/pro-regular-svg-icons/faPuzzlePiece';
import {faSquare} from '@fortawesome/pro-solid-svg-icons/faSquare';
import {faArrowToBottom} from '@fortawesome/pro-regular-svg-icons/faArrowToBottom';
import {faTimes} from '@fortawesome/pro-solid-svg-icons/faTimes';
import {faClone} from '@fortawesome/pro-regular-svg-icons/faClone';
import {NotificationService} from '../../services/notification.service';
import {faQuestionCircle} from '@fortawesome/pro-regular-svg-icons/faQuestionCircle';
import {ResourceService} from "../../services/resource.service";

@Component({
    selector: 'app-account-home',
    templateUrl: './account-home.component.html',
    styleUrls: ['./account-home.component.css']
})
export class AccountHomeComponent implements OnInit, OnDestroy, AfterViewInit {
    icons = {
        regular: {
            history: faHistory,
            send: faPaperPlane,
            memory: faMemory,
            edit: faEdit,
            exchange: faExchangeAlt,
            puzzle: faPuzzlePiece,
            arrowBottom: faArrowToBottom,
            clone: faClone,
            questionCircle: faQuestionCircle,
        },
        solid: {
            square: faSquare,
            times: faTimes
        },
    };

    fullBalance = 0;
    precision: string;
    staked: number;
    unstaked: number;
    unstaking: 0;
    unstakeTime: string;
    transactionFree: any[];
    tokens: any[];
    selectedAccountName = 'none';

    private selectedAccountSubscription: Subscription;
    private lastUpdateSubscription: Subscription;

    constructor(public aService: AccountsService,
                public network: NetworkService,
                private cdr: ChangeDetectorRef,
                public resource: ResourceService,
                private toaster: NotificationService) {
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

        this.selectedAccountSubscription = this.aService.selected.asObservable().subscribe(async (sel) => {
            if (sel['name']) {
                if (this.selectedAccountName !== sel['name']) {
                    this.selectedAccountName = sel['name'];
                    this.onAccountChanged(sel);
                    this.transactionFree = await this.resource.checkCredits([
                        {account: 'eosio',name: 'delegatebw'},
                    ], sel['name']);
                    this.cdr.detectChanges();
                }
            }
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

    removeElementWithTransition(target: HTMLDivElement, divBelow: HTMLDivElement) {
        divBelow.classList.add('animated-translation');
        target.classList.add('animate__animated', 'animate__fadeOutUp');
        divBelow.style.transform = `translateY(-${target.getBoundingClientRect().height}px)`;
        setTimeout(() => {
            divBelow.classList.remove('animated-translation');
            target.remove();
            divBelow.style.transform = '';
        }, 1000);
    }

    cc(text) {
        window['navigator']['clipboard']['writeText'](text).then(() => {
            this.toaster.onSuccess(`Address ${text} copied to clipboard!`, '');
        }).catch(() => {
            this.toaster.onError('Copy to clipboard didn\'t work!', 'Please try other way.');
        });
    }
}


