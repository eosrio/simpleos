"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletComponent = exports.MY_FORMATS = void 0;
const core_1 = require("@angular/core");
const accounts_service_1 = require("../../services/accounts.service");
const forms_1 = require("@angular/forms");
const material_moment_adapter_1 = require("@angular/material-moment-adapter");
const core_2 = require("@angular/material/core");
const moment = require("moment");
const paginator_1 = require("primeng/paginator");
const eosjs2_service_1 = require("../../services/eosio/eosjs2.service");
const network_service_1 = require("../../services/network.service");
exports.MY_FORMATS = {
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
let WalletComponent = class WalletComponent {
    constructor(aService, network, eosjs, cdr, fb) {
        this.aService = aService;
        this.network = network;
        this.eosjs = eosjs;
        this.cdr = cdr;
        this.fb = fb;
        this.fullBalance = 0;
        this.actionsFilter = [];
        this.actions = [];
        this.selectedAccountName = '';
        this.actionMarked = '';
        this.minDate = new Date('2018-06-02T00:00:00.000Z');
        this.launchDate = new Date('2018-06-02T00:00:00.000Z');
        this.maxDate = new Date();
        this.maxRows = 12;
        this.shouldLazyLoad = true;
        this.lastPage = 0;
        this.moment = moment;
        this.tokens = [];
        this.headBlock = 0;
        this.staked = 0;
        this.unstaked = 0;
        this.LIB = 0;
        this.blockTracker = null;
        this.frmFilters = this.fb.group({
            selectAction: [''],
            startDate: [''],
            endDate: [''],
        });
        this.lottieConfig = {
            path: 'assets/maintenance_anim2.json',
            autoplay: true,
            loop: true,
        };
    }
    ngOnInit() {
        this.actionsFilter = [];
        this.lastUpdateSubscription = this.aService.lastUpdate.asObservable().subscribe(value => {
            if (value.account === this.aService.selected.getValue().name) {
                this.updateBalances();
            }
        });
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
        if (this.network.networkingReady.getValue()) {
            this.getInfo().catch(console.log);
        }
        else {
            const statusSub = this.network.networkingReady.subscribe((status) => {
                if (status) {
                    this.getInfo().catch(console.log);
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
        this.actions = [];
        this.aService.refreshFromChain(false).catch(console.log);
        this.frmFilters.patchValue({
            selectAction: '',
            startDate: '',
            endDate: '',
        });
        this.precision = '1.2-' + this.aService.activeChain.precision;
        this.actionsFilter = this.buildHyperionFilters(sel['name']);
        console.log(`get actions for ${sel.name}`);
        this.loading = true;
        this.aService.getAccActions(sel.name).then(() => {
            this.loading = false;
            this.actions = sel.actions;
        }).catch(console.log);
    }
    buildHyperionFilters(name) {
        return [
            { name: 'ALL ACTIONS', filter: '' },
            { name: 'ACCOUNT', filter: '&filter=*:newaccount' },
            { name: 'RECEIVE TOKEN', filter: '&filter=*:transfer&transfer.to=' + name },
            { name: 'SEND TOKEN', filter: '&filter=*:transfer&transfer.from=' + name },
            { name: 'STAKE', filter: '&filter=*:delegatebw' },
            { name: 'UNSTAKE', filter: '&filter=*:undelegatebw' },
            { name: 'VOTE', filter: '&filter=*:voteproducer' },
            { name: 'RAM BUY', filter: '&filter=*:buyrambytes' },
            { name: 'RAM SELL', filter: '&filter=*:sellram' },
            { name: 'BUY REX', filter: '&filter=*:buyrex' },
            { name: 'SELL REX', filter: '&filter=*:sellrex' },
            { name: 'STAKE REX', filter: '&filter=*:mvtosavings' },
            { name: 'UNSTAKE REX', filter: '&filter=*:mvfrsavings' },
            { name: 'RENT CPU', filter: '&filter=*:rentcpu' },
            { name: 'RENT NET', filter: '&filter=*:rentnet' },
        ];
    }
    openTX(value) {
        window['shell']['openExternal'](this.aService.activeChain['explorers'][0]['tx_url'] + value);
    }
    openAccount(acct) {
        if (acct && this.aService.activeChain['explorers'][0]) {
            window['shell']['openExternal'](this.aService.activeChain['explorers'][0]['account_url'] + acct);
        }
        else {
            window['shell']['openExternal'](this.aService.activeChain['explorers'][0]['account_url'] + this.aService.selected.getValue().name);
        }
    }
    getInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            const info = yield this.eosjs.rpc.get_info();
            this.headBlock = info.head_block_num;
            this.LIB = info.last_irreversible_block_num;
        });
    }
    choosedAction(val) {
        this.actionMarked = val;
        this.loadActionsLazy(0).catch(console.log);
    }
    choosedAfterDate(val) {
        this.dateAfter = val !== null ? moment.utc(val).set({
            hour: 0,
            minute: 0,
            second: 0,
            millisecond: 0,
        }).format() : '';
        this.minDate = new Date(val);
        this.loadActionsLazy(0).catch(console.log);
    }
    choosedBeforeDate(val) {
        this.dateBefore = val !== null ? moment.utc(val).set({
            hour: 0,
            minute: 0,
            second: 0,
            millisecond: 0,
        }).format() : '';
        this.maxDate = new Date(val);
        this.loadActionsLazy(0).catch(console.log);
    }
    loadActionsLazy(e) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.shouldLazyLoad) {
                let pos = e !== 0 ? e.first : 0;
                let _skip = e !== 0 ? e.first : 0;
                const account = this.aService.selected.getValue();
                if (this.paginator.getPage() > this.lastPage) {
                    const diff = this.paginator.getPage() - this.lastPage;
                    this.lastPage = this.paginator.getPage();
                    if (this.aService.actions.length > 0) {
                        const lastAction = this.aService.actions[this.aService.actions.length - 1];
                        if (lastAction.seq) {
                            pos = lastAction.seq - 1 - (this.maxRows * (diff - 1));
                        }
                    }
                }
                if (this.paginator.getPage() < this.lastPage) {
                    const diff = this.lastPage - this.paginator.getPage();
                    this.lastPage = this.paginator.getPage();
                    if (this.aService.actions.length > 0) {
                        const firstAction = this.aService.actions[0];
                        if (firstAction.seq) {
                            pos = firstAction.seq + this.maxRows + (this.maxRows * (diff - 1));
                        }
                    }
                }
                this.actions = [];
                this.loading = true;
                yield this.aService.getActions(account.name, pos, this.maxRows, _skip, this.actionMarked, this.dateAfter, this.dateBefore);
                this.actions = account.actions;
                this.loading = false;
                this.paginator.changePage(e);
            }
        });
    }
    memoCreatorAccName(info) {
        const creator = JSON.stringify(JSON.parse(info)['creator']).replace(new RegExp('\"', 'g'), '');
        return creator === this.aService.selected.getValue().name ? 'this account' : creator;
    }
    updateBalances() {
        const sel = this.aService.selected.getValue();
        this.fullBalance = sel.full_balance;
        this.staked = sel.staked;
        this.unstaked = sel.full_balance - sel.staked - sel.unstaking;
    }
    refresh() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('refresh action history');
            this.actionMarked = '';
            this.dateBefore = '';
            this.dateAfter = '';
            this.minDate = new Date();
            this.maxDate = new Date();
            yield this.aService.reloadActions(this.aService.selected.getValue().name);
            this.shouldLazyLoad = false;
            this.paginator.changePage(0);
            setTimeout(() => {
                this.shouldLazyLoad = true;
            }, 200);
        });
    }
};
__decorate([
    (0, core_1.ViewChild)('paginator'),
    __metadata("design:type", paginator_1.Paginator)
], WalletComponent.prototype, "paginator", void 0);
WalletComponent = __decorate([
    (0, core_1.Component)({
        selector: 'app-wallet',
        templateUrl: './wallet.component.html',
        styleUrls: ['./wallet.component.css'],
        providers: [
            { provide: core_2.DateAdapter, useClass: material_moment_adapter_1.MomentDateAdapter, deps: [core_2.MAT_DATE_LOCALE] },
            { provide: core_2.MAT_DATE_FORMATS, useValue: exports.MY_FORMATS },
        ],
    }),
    __metadata("design:paramtypes", [accounts_service_1.AccountsService,
        network_service_1.NetworkService,
        eosjs2_service_1.Eosjs2Service,
        core_1.ChangeDetectorRef,
        forms_1.FormBuilder])
], WalletComponent);
exports.WalletComponent = WalletComponent;
//# sourceMappingURL=wallet.component.js.map