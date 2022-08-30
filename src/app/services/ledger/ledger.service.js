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
exports.LedgerService = void 0;
const core_1 = require("@angular/core");
const eosjs2_service_1 = require("../eosio/eosjs2.service");
const connect_service_1 = require("../connect.service");
let LedgerService = class LedgerService {
    constructor(eos, connect) {
        this.eos = eos;
        this.connect = connect;
        this.openPanel = new core_1.EventEmitter();
        this.appReady = false;
        this.checkingApp = false;
        this.ledgerPublicKeys = [];
        this.ledgerAccounts = [];
        this.ledgerEvents = new core_1.EventEmitter();
        this.reading = false;
        this.currentSlot = 0;
        this.errorCodes = {
            26628: 'Device is not ready, please unlock',
            28160: 'EOS App is not ready, please open the eos app on your ledger',
            27013: 'User cancelled the process',
            27264: 'Invalid data, please enable arbitrary data on your ledger device'
        };
        this.deviceName = 'Ledger';
        this.readCount = 0;
        this.appVerificationAttempts = 0;
        console.log('Loading ledger service...');
        this.slots = [];
    }
    startListener() {
        if (this.isElectron()) {
            this.requestLedgerListener();
            this.connect.ipc.on('ledger', (event, payload) => {
                this.handleIpcMessage(event, payload);
            });
            this.connect.ipc.on('ledger_keys', (event, payload) => {
                if (payload.event === 'read_key') {
                    this.ledgerPublicKeys.push(payload.data);
                    this.lookupAccounts(payload.data).catch(console.log);
                }
            });
        }
    }
    requestLedgerListener() {
        console.log('Requesting new ledger event listener');
        this.connect.ipc.send('ledger', {
            event: 'start_listener'
        });
    }
    readSlots(initial, count) {
        this.reading = true;
        this.readCount = count;
        this.ledgerPublicKeys = [];
        this.ledgerAccounts = [];
        this.currentSlot = initial;
        this.connect.ipc.send('ledger', {
            event: 'read_slots',
            data: {
                starts_on: initial,
                size: count
            }
        });
    }
    sign(transaction, slotNumber, rpcEndpoint, onlySign) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                if (onlySign)
                    transaction.actions.unshift({
                        account: 'eosriorelay1',
                        name: 'payforcpu',
                        authorization: [{
                                actor: 'eosriorelay1',
                                permission: 'freecpu'
                            }],
                        data: {}
                    });
                const ledgerSignatureRequest = {
                    event: 'sign_trx',
                    data: transaction,
                    slot: slotNumber,
                    endpoint: rpcEndpoint
                };
                console.log(ledgerSignatureRequest);
                // listen for response
                this.connect.ipc.once('ledger_reply', (event, args) => __awaiter(this, void 0, void 0, function* () {
                    if (args.data) {
                        if (args.event === 'sign_trx') {
                            try {
                                let trxResult;
                                if (onlySign)
                                    trxResult = { pushTransactionArgs: args.data };
                                else
                                    trxResult = yield this.pushSignedTrx(args.data);
                                resolve(trxResult);
                            }
                            catch (e) {
                                reject(e);
                            }
                        }
                    }
                    else if (args.error) {
                        reject(args.error);
                    }
                }));
                // emit payload
                this.connect.ipc.send('ledger', ledgerSignatureRequest);
            });
        });
    }
    checkEosApp() {
        if (!this.appReady) {
            this.checkingApp = true;
            // listen for check response
            console.log(this.connect.ipc);
            this.connect.ipc.once('ledger_reply', (event, args) => {
                if (args.event === 'check_app') {
                    console.log(args);
                    this.checkingApp = false;
                    this.appReady = args.data;
                    if (!this.appReady) {
                        this.appVerificationAttempts++;
                        if (this.appVerificationAttempts < 5) {
                            setTimeout(this.checkEosApp, 2000);
                        }
                    }
                    else {
                        this.appVerificationAttempts = 0;
                    }
                }
            });
            // emit request
            this.connect.ipc.send('ledger', { event: 'check_app' });
        }
    }
    handleIpcMessage(event, payload) {
        if (payload.event === 'listener_event') {
            if (payload.data.type === 'add') {
                this.deviceName = payload.data.deviceModel.productName;
                console.log(`Device connected: ${this.deviceName}`);
                this.checkingApp = true;
                this.appReady = false;
                this.openPanel.emit(true);
                this.checkEosApp();
            }
            else if (payload.data.type === 'remove') {
                this.connect.ipc.send('ledger', { event: 'check_app' });
                this.openPanel.emit(false);
                this.deviceName = '';
                this.appReady = false;
                this.checkingApp = false;
                this.reading = false;
                console.log(`Device Removed: ${payload.data.deviceModel["productName"]}`);
            }
            else {
                console.log(event);
            }
        }
        else if (payload.event === 'error') {
            this.ledgerEvents.emit(payload);
            if (this.reading) {
                this.reading = false;
            }
        }
    }
    isElectron() {
        this.electronStatus = window && window['process'] && window['process']['type'];
        return this.electronStatus;
    }
    lookupAccounts(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = data.address;
            try {
                const account_names = yield this.eos.getKeyAccountsMulti(key);
                const obj = {
                    key: key,
                    slot: data.slot,
                    accounts: []
                };
                if (account_names) {
                    for (const account of account_names) {
                        const acc_data = yield this.eos.rpc.get_account(account);
                        obj.accounts.push({
                            key: key,
                            slot: data.slot,
                            actor: account,
                            permission: this.getAssociatedPermission(acc_data, key),
                            selected: false,
                            data: acc_data
                        });
                    }
                }
                this.ledgerAccounts.push(obj);
                this.ledgerEvents.emit({
                    event: 'new_account',
                    data: obj
                });
            }
            catch (e) {
                console.log(e);
            }
            this.readCount--;
            this.currentSlot++;
            if (this.readCount === 0) {
                this.reading = false;
                setImmediate(() => {
                    this.ledgerEvents.emit({
                        event: 'finished_reading'
                    });
                });
            }
        });
    }
    getAssociatedPermission(acc_data, key) {
        let perm = '';
        for (const p of acc_data.permissions) {
            if (p.required_auth.keys[0].key === key) {
                perm = p.perm_name;
                break;
            }
        }
        return perm;
    }
    pushSignedTrx(data) {
        return __awaiter(this, void 0, void 0, function* () {
            // store transaction for eventual resubmission
            this.tempTrx = data;
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const pushResults = yield this.eos.rpc.push_transaction(data);
                    resolve({ result: pushResults, packedTransaction: data });
                }
                catch (e) {
                    reject(e.json.error.details[0].message);
                }
            }));
        });
    }
};
LedgerService = __decorate([
    (0, core_1.Injectable)({
        providedIn: 'root'
    }),
    __metadata("design:paramtypes", [eosjs2_service_1.Eosjs2Service,
        connect_service_1.ConnectService])
], LedgerService);
exports.LedgerService = LedgerService;
//# sourceMappingURL=ledger.service.js.map