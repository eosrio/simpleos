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
exports.TransactionFactoryService = void 0;
const core_1 = require("@angular/core");
const rxjs_1 = require("rxjs");
const accounts_service_1 = require("../accounts.service");
const crypto_service_1 = require("../crypto/crypto.service");
let TransactionFactoryService = class TransactionFactoryService {
    constructor(aService, crypto) {
        this.aService = aService;
        this.crypto = crypto;
        this.launcher = new core_1.EventEmitter();
        this.status = new core_1.EventEmitter(true);
        this.modalData = new rxjs_1.BehaviorSubject({
            labelHTML: '',
            termsHTML: '',
            termsHeader: '',
            actionTitle: '',
            signerPublicKey: '',
            signerAccount: '',
            transactionPayload: {
                actions: []
            },
            resourceTransactionPayload: {
                actions: []
            },
            resourceInfo: {
                needResources: false,
                relay: false,
                relayCredit: { used: 0, limit: 0 },
                borrow: 0.0,
                spend: 0.0,
                precision: 4,
                tk_name: 'EOS',
            },
            errorFunc: null,
        });
    }
    transact(builder) {
        return __awaiter(this, void 0, void 0, function* () {
            const [auth, publicKey] = this.getAuth();
            const modalData = yield builder(auth, publicKey);
            if (modalData) {
                if (!modalData.signerPublicKey) {
                    modalData.signerPublicKey = publicKey;
                }
                if (!modalData.signerAccount) {
                    modalData.signerAccount = auth.actor;
                }
                const status = yield this.launch(publicKey, modalData);
                return { status, auth };
            }
        });
    }
    launch(publicKey, modalData) {
        return __awaiter(this, void 0, void 0, function* () {
            if (modalData) {
                this.modalData.next(modalData);
            }
            return new Promise((resolve) => {
                this.launcher.emit({
                    visibility: true,
                    mode: this.crypto.getPrivateKeyMode(publicKey)
                });
                const subs = this.status.subscribe((event) => {
                    if (event === 'done') {
                        subs.unsubscribe();
                    }
                    if (event === 'modal_closed') {
                        subs.unsubscribe();
                    }
                    resolve(event);
                });
            });
        });
    }
    getAuth(account) {
        // get selected account if none was provided
        const actor = account !== null && account !== void 0 ? account : this.aService.selected.getValue();
        // lookup active key
        let _permission = 'active';
        let publicKey = '';
        let validKey = false;
        const activePerm = actor.details.permissions.find((p) => p.perm_name === _permission);
        if (activePerm.required_auth.keys.length > 0) {
            publicKey = activePerm.required_auth.keys[0].key;
            validKey = this.crypto.checkPublicKey(publicKey);
        }
        // if the active key is not found
        if (!validKey) {
            _permission = '';
            for (const perm of actor.details.permissions) {
                if (perm.required_auth.keys.length > 0) {
                    if (this.crypto.checkPublicKey(perm.required_auth.keys[0].key)) {
                        _permission = perm.perm_name;
                        publicKey = perm.required_auth.keys[0].key;
                        break;
                    }
                }
            }
        }
        if (_permission !== '') {
            return [{ actor: actor.name, permission: _permission }, publicKey];
        }
        else {
            return [null, null];
        }
    }
    getAllAuth(account) {
        // get selected account if none was provided
        const actor = account !== null && account !== void 0 ? account : this.aService.selected.getValue();
        // lookup active key
        let _permission = '';
        let publicKey = '';
        // list all permissions
        let authArr = [];
        for (const perm of actor.details.permissions) {
            if (perm.required_auth.keys.length > 0) {
                if (this.crypto.checkPublicKey(perm.required_auth.keys[0].key)) {
                    _permission = perm.perm_name;
                    publicKey = perm.required_auth.keys[0].key;
                    authArr.push({ auth: { actor: actor.name, permission: _permission }, pubKey: publicKey });
                    //break;
                }
            }
            // }
        }
        if (authArr.length > 0) {
            return authArr;
        }
        else {
            return null;
        }
    }
};
TransactionFactoryService = __decorate([
    (0, core_1.Injectable)({
        providedIn: 'root'
    }),
    __metadata("design:paramtypes", [accounts_service_1.AccountsService,
        crypto_service_1.CryptoService])
], TransactionFactoryService);
exports.TransactionFactoryService = TransactionFactoryService;
//# sourceMappingURL=transaction-factory.service.js.map