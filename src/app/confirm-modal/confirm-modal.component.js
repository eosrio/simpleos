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
exports.ConfirmModalComponent = void 0;
const core_1 = require("@angular/core");
const forms_1 = require("@angular/forms");
const eosjs2_service_1 = require("../services/eosio/eosjs2.service");
const crypto_service_1 = require("../services/crypto/crypto.service");
const dist_1 = require("eosjs/dist");
const notification_service_1 = require("../services/notification.service");
const accounts_service_1 = require("../services/accounts.service");
const transaction_factory_service_1 = require("../services/eosio/transaction-factory.service");
const ledger_service_1 = require("../services/ledger/ledger.service");
const network_service_1 = require("../services/network.service");
const input_1 = require("@angular/material/input");
const resource_service_1 = require("../services/resource.service");
let ConfirmModalComponent = class ConfirmModalComponent {
    constructor(aService, fb, cdr, eosjs, crypto, toaster, trxFactory, ledger, network, resource, zone) {
        this.aService = aService;
        this.fb = fb;
        this.cdr = cdr;
        this.eosjs = eosjs;
        this.crypto = crypto;
        this.toaster = toaster;
        this.trxFactory = trxFactory;
        this.ledger = ledger;
        this.network = network;
        this.resource = resource;
        this.zone = zone;
        this.visibility = false;
        this.wasClosed = false;
        this.displayTerms = false;
        this.mode = 'local';
        this.errormsg = { 'friendly': '', 'origin': '' };
        this.busy = false;
        this.useFreeTransaction = '0';
        this.useBorrowRex = '0';
        this.countLoopUse = 0;
        this.loadResource = false;
        this.selectedAuth = 'active';
        this.confirmationForm = this.fb.group({
            pass: ['', [forms_1.Validators.required]]
        });
        this.trxFactory.launcher.subscribe((state) => __awaiter(this, void 0, void 0, function* () {
            this.loadResource = true;
            this.visibility = state.visibility;
            this.mode = state.mode;
            const [auth] = this.trxFactory.getAuth();
            this.selectedAuth = auth.permission;
            if (this.visibility) {
                this.confirmationForm.reset();
                this.wasClosed = false;
                this.setFocus();
                console.log(Date(), this.loadResource);
                yield this.resourceInit();
                if (this.modalData.resourceInfo["relay"]) {
                    this.useFreeTransaction = '1';
                    this.useBorrowRex = '0';
                }
                else {
                    this.useBorrowRex = '1';
                }
            }
            this.allAuth = this.trxFactory.getAllAuth();
        }));
        this.trxFactory.modalData.asObservable().subscribe((modalData) => {
            this.modalData = modalData;
        });
    }
    toggleHelp(e, isFree) {
        if (e.value !== undefined) {
            if (isFree) {
                this.useFreeTransaction = e.value;
                if (this.useFreeTransaction === '0' && this.modalData.resourceInfo['needResources'] && this.countLoopUse < 1) {
                    this.countLoopUse++;
                    this.useBorrowRex = '1';
                }
                else {
                    this.countLoopUse = 0;
                }
            }
            else {
                this.useBorrowRex = e.value;
                if (this.useBorrowRex === '0' && this.modalData.resourceInfo['relay'] && this.countLoopUse < 1) {
                    this.countLoopUse++;
                    this.useFreeTransaction = '1';
                }
                else {
                    this.countLoopUse = 0;
                }
            }
            this.cdr.detectChanges();
        }
    }
    resourceInit(authSelected) {
        return __awaiter(this, void 0, void 0, function* () {
            const [auth] = authSelected !== null && authSelected !== void 0 ? authSelected : this.trxFactory.getAuth();
            this.modalData.resourceInfo = yield this.resource.checkResource(auth, this.modalData.transactionPayload.actions, undefined, undefined, this.modalData.tk_name);
            const result = yield this.resource.getActions(auth);
            this.modalData.resourceTransactionPayload = { actions: result };
            this.loadResource = false;
            this.cdr.detectChanges();
        });
    }
    selectAuth([auth, publicKey]) {
        return __awaiter(this, void 0, void 0, function* () {
            this.selectedAuth = auth.permission;
            this.modalData.signerAccount = auth.actor;
            this.modalData.signerPublicKey = publicKey;
            this.mode = this.crypto.getPrivateKeyMode(publicKey);
            yield this.changeAuthTransactionPayload([auth]);
            yield this.resourceInit([auth, publicKey]);
            console.log(this.modalData);
        });
    }
    changeAuthTransactionPayload([auth]) {
        return __awaiter(this, void 0, void 0, function* () {
            this.modalData.transactionPayload.actions.forEach((act, idx) => {
                this.modalData.transactionPayload.actions[idx].authorization = [auth];
            });
        });
    }
    setFocus() {
        setTimeout(() => {
            if (this.pass) {
                this.pass.focus();
            }
        }, 100);
    }
    processTransaction(trx, handler) {
        return __awaiter(this, void 0, void 0, function* () {
            if ((this.modalData.resourceInfo['needResources'] || this.modalData.resourceInfo['relay']) && this.useFreeTransaction === undefined) {
                return [null, 'Please select a option!'];
            }
            try {
                let result;
                if (this.modalData.resourceInfo['relay'] && this.useFreeTransaction === '1') {
                    const signed = yield this.eosjs.signRelayTrx(trx);
                    if (!signed) {
                        return [null, 'Wrong password!'];
                    }
                    result = yield this.resource.sendTxRelay(signed);
                    if (!result.ok) {
                        const err = result.error.error;
                        return this.handlerError(err, handler);
                    }
                }
                else {
                    result = yield this.eosjs.transact(trx);
                }
                if (result === 'wrong_pass') {
                    return [null, 'Wrong password!'];
                }
                else {
                    return [result, null];
                }
            }
            catch (e) {
                return this.handlerError(e, handler);
            }
        });
    }
    handlerError(e, handler) {
        console.log('\nCaught exception: ' + e);
        if (handler) {
            this.trxFactory.status.emit(JSON.stringify(handler(e), null, 2));
            this.busy = false;
            return [false, handler(e)];
        }
        else {
            const error = this.network.defaultErrors;
            let msg;
            if (e.json !== undefined) {
                msg = error.find(elem => elem.code === e.json.error.code);
            }
            if (this.aService.activeChain['borrow']['enable'] === false || msg === undefined) {
                if (e.json !== undefined)
                    this.errormsg = { 'friendly': e.json.error.details[0].message, 'origin': '' };
                else
                    this.errormsg = { 'friendly': e, 'origin': '' };
            }
            else {
                this.errormsg = { 'friendly': msg['message'], 'origin': e.json.error.details[0].message };
            }
            if (e instanceof dist_1.RpcError) {
                this.trxFactory.status.emit(JSON.stringify(e.json, null, 2));
            }
            this.busy = false;
            return [false, null];
        }
    }
    executeAction(pass) {
        return __awaiter(this, void 0, void 0, function* () {
            this.busy = true;
            this.errormsg = { 'friendly': '', 'origin': '' };
            let transactionPayload = { actions: [] };
            // Unlock Signer
            try {
                yield this.crypto.authenticate(pass, this.modalData.signerPublicKey);
            }
            catch (e) {
                this.errormsg = { 'friendly': 'Wrong password!', 'origin': '' };
                this.trxFactory.status.emit('error');
                this.busy = false;
                this.toaster.onError('Authentication fail', `Wrong password`);
                return false;
            }
            if (this.modalData.transactionPayload.actions.length === 0) {
                this.trxFactory.status.emit('done');
                this.confirmationForm.reset();
                this.busy = false;
                this.visibility = false;
                this.cdr.detectChanges();
                return true;
            }
            transactionPayload.actions = this.transactionPayload();
            console.log(transactionPayload);
            // Sign and push transaction
            const [trxResult, err] = yield this.processTransaction(transactionPayload, this.modalData.errorFunc);
            if (err) {
                this.errormsg = { 'friendly': err, 'origin': '' };
                this.busy = false;
                this.trxFactory.status.emit('error');
                this.confirmationForm.reset();
            }
            else {
                if (trxResult) {
                    const trxId = this.modalData.resourceInfo.relay && this.useFreeTransaction === '1' ? trxResult.data.transactionId : trxResult.transaction_id;
                    this.wasClosed = true;
                    this.confirmationForm.reset();
                    setTimeout((_) => {
                        this.aService.refreshFromChain(false).catch(e => {
                            console.log(e);
                        });
                        this.trxFactory.status.emit('done');
                        this.busy = false;
                        this.visibility = false;
                        this.cdr.detectChanges();
                    }, 1500);
                    this.toaster.onSuccessEX('Transaction broadcasted', `<div class="dont-break-out"> TRX ID: ${trxId}</div> <br> Check your history for confirmation.`, {
                        id: trxId
                    }, this.aService.activeChain.explorers);
                }
                else {
                    this.busy = false;
                    this.confirmationForm.reset();
                    this.toaster.onError('Transaction failed', `${this.errormsg['friendly']}`);
                }
            }
        });
    }
    transactionPayload() {
        let transactionPayload = { actions: [] };
        if (this.modalData.resourceInfo.needResources) {
            if (this.useBorrowRex === '1') {
                this.modalData.resourceTransactionPayload.actions.forEach(act => {
                    transactionPayload.actions.push(act);
                });
            }
        }
        this.modalData.transactionPayload.actions.forEach(act => {
            transactionPayload.actions.push(act);
        });
        return transactionPayload.actions;
    }
    signLedger() {
        return __awaiter(this, void 0, void 0, function* () {
            this.errormsg = { 'friendly': '', 'origin': '' };
            this.busy = true;
            let transactionPayload = { actions: [] };
            try {
                transactionPayload.actions = this.transactionPayload();
                let result;
                if (this.modalData.resourceInfo['relay'] && this.useFreeTransaction === '1') {
                    const signed = yield this.ledger.sign(transactionPayload, this.crypto.requiredLedgerSlot, this.network.selectedEndpoint.getValue().url, true);
                    if (!signed) {
                        return [null, 'Wrong password!'];
                    }
                    result = yield this.resource.sendTxRelay(signed);
                    if (!result.ok) {
                        const err = result.error.error;
                        return this.handlerError(err);
                    }
                }
                else {
                    result = yield this.ledger.sign(transactionPayload, this.crypto.requiredLedgerSlot, this.network.selectedEndpoint.getValue().url, false);
                }
                if (result) {
                    // console.log(result);
                    const trxId = this.modalData.resourceInfo.relay && this.useFreeTransaction === '1' ? result.data.transactionId : result['result']['transaction_id'];
                    setTimeout(() => {
                        this.aService.refreshFromChain(false).catch(e => {
                            console.log(e);
                        });
                        this.trxFactory.status.emit('done');
                        this.busy = false;
                        this.visibility = false;
                        this.cdr.detectChanges();
                    }, 3000);
                    this.toaster.onSuccessEX('Transaction broadcasted', `<div class="dont-break-out"> TRX ID: ${trxId}</div> <br> Check your history for confirmation.`, {
                        id: trxId
                    }, this.aService.activeChain.explorers);
                    this.errormsg = { 'friendly': '', 'origin': '' };
                }
            }
            catch (e) {
                this.handlerError(e);
            }
        });
    }
    onClose() {
        if (!this.wasClosed) {
            this.wasClosed = true;
            this.busy = false;
            this.trxFactory.status.emit('modal_closed');
            this.errormsg = { 'friendly': '', 'origin': '' };
        }
    }
    get requiredLedgerInfo() {
        return {
            device: this.crypto.requiredLedgerDevice,
            slot: this.crypto.requiredLedgerSlot
        };
    }
};
__decorate([
    (0, core_1.ViewChild)('pass'),
    __metadata("design:type", input_1.MatInput)
], ConfirmModalComponent.prototype, "pass", void 0);
__decorate([
    (0, core_1.ViewChild)('option'),
    __metadata("design:type", input_1.MatInput)
], ConfirmModalComponent.prototype, "option", void 0);
ConfirmModalComponent = __decorate([
    (0, core_1.Component)({
        selector: 'app-confirm-modal',
        templateUrl: './confirm-modal.component.html',
        styleUrls: ['./confirm-modal.component.css']
    }),
    __metadata("design:paramtypes", [accounts_service_1.AccountsService,
        forms_1.FormBuilder,
        core_1.ChangeDetectorRef,
        eosjs2_service_1.Eosjs2Service,
        crypto_service_1.CryptoService,
        notification_service_1.NotificationService,
        transaction_factory_service_1.TransactionFactoryService,
        ledger_service_1.LedgerService,
        network_service_1.NetworkService,
        resource_service_1.ResourceService,
        core_1.NgZone])
], ConfirmModalComponent);
exports.ConfirmModalComponent = ConfirmModalComponent;
//# sourceMappingURL=confirm-modal.component.js.map