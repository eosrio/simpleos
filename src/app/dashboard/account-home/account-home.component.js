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
exports.AccountHomeComponent = void 0;
const core_1 = require("@angular/core");
const accounts_service_1 = require("../../services/accounts.service");
const network_service_1 = require("../../services/network.service");
const moment = require("moment");
const faHistory_1 = require("@fortawesome/pro-regular-svg-icons/faHistory");
const faPaperPlane_1 = require("@fortawesome/pro-regular-svg-icons/faPaperPlane");
const faMemory_1 = require("@fortawesome/pro-regular-svg-icons/faMemory");
const faEdit_1 = require("@fortawesome/pro-regular-svg-icons/faEdit");
const faExchangeAlt_1 = require("@fortawesome/pro-regular-svg-icons/faExchangeAlt");
const faPuzzlePiece_1 = require("@fortawesome/pro-regular-svg-icons/faPuzzlePiece");
const faSquare_1 = require("@fortawesome/pro-solid-svg-icons/faSquare");
const faArrowToBottom_1 = require("@fortawesome/pro-regular-svg-icons/faArrowToBottom");
const faTimes_1 = require("@fortawesome/pro-solid-svg-icons/faTimes");
const faClone_1 = require("@fortawesome/pro-regular-svg-icons/faClone");
const notification_service_1 = require("../../services/notification.service");
const faQuestionCircle_1 = require("@fortawesome/pro-regular-svg-icons/faQuestionCircle");
const resource_service_1 = require("../../services/resource.service");
let AccountHomeComponent = class AccountHomeComponent {
    constructor(aService, network, cdr, resource, toaster) {
        this.aService = aService;
        this.network = network;
        this.cdr = cdr;
        this.resource = resource;
        this.toaster = toaster;
        this.icons = {
            regular: {
                history: faHistory_1.faHistory,
                send: faPaperPlane_1.faPaperPlane,
                memory: faMemory_1.faMemory,
                edit: faEdit_1.faEdit,
                exchange: faExchangeAlt_1.faExchangeAlt,
                puzzle: faPuzzlePiece_1.faPuzzlePiece,
                arrowBottom: faArrowToBottom_1.faArrowToBottom,
                clone: faClone_1.faClone,
                questionCircle: faQuestionCircle_1.faQuestionCircle,
            },
            solid: {
                square: faSquare_1.faSquare,
                times: faTimes_1.faTimes
            },
        };
        this.fullBalance = 0;
        this.staked = 0;
        this.unstaked = 0;
        this.selectedAccountName = 'none';
    }
    ngOnInit() {
        this.lastUpdateSubscription = this.aService.lastUpdate.asObservable().subscribe(value => {
            if (value.account === this.aService.selected.getValue().name) {
                this.updateBalances();
                this.cdr.detectChanges();
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
        }
        else {
            const statusSub = this.network.networkingReady.subscribe((status) => {
                if (status) {
                    // this.getInfo().catch(console.log);
                    statusSub.unsubscribe();
                }
            });
        }
        this.selectedAccountSubscription = this.aService.selected.asObservable().subscribe((sel) => __awaiter(this, void 0, void 0, function* () {
            if (sel.name) {
                if (this.selectedAccountName !== sel.name) {
                    this.selectedAccountName = sel.name;
                    this.onAccountChanged(sel);
                    this.transactionFree = yield this.resource.checkCredits([
                        {
                            account: 'eosio',
                            name: 'delegatebw'
                        },
                    ], sel.name);
                }
            }
            this.cdr.detectChanges();
        }));
        this.cdr.detectChanges();
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
    removeElementWithTransition(target, divBelow) {
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
        window.navigator.clipboard.writeText(text).then(() => {
            this.toaster.onSuccess(`Address ${text} copied to clipboard!`, '');
        }).catch(() => {
            this.toaster.onError('Copy to clipboard didn\'t work!', 'Please try other way.');
        });
    }
};
AccountHomeComponent = __decorate([
    (0, core_1.Component)({
        selector: 'app-account-home',
        templateUrl: './account-home.component.html',
        styleUrls: ['./account-home.component.css']
    }),
    __metadata("design:paramtypes", [accounts_service_1.AccountsService,
        network_service_1.NetworkService,
        core_1.ChangeDetectorRef,
        resource_service_1.ResourceService,
        notification_service_1.NotificationService])
], AccountHomeComponent);
exports.AccountHomeComponent = AccountHomeComponent;
//# sourceMappingURL=account-home.component.js.map