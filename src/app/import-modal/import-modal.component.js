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
exports.ImportModalComponent = void 0;
const core_1 = require("@angular/core");
const accounts_service_1 = require("../services/accounts.service");
const crypto_service_1 = require("../services/crypto/crypto.service");
const forms_1 = require("@angular/forms");
const network_service_1 = require("../services/network.service");
const router_1 = require("@angular/router");
const aux_functions_1 = require("../helpers/aux_functions");
const angular_1 = require("@clr/angular");
const ledger_service_1 = require("../services/ledger/ledger.service");
const eosjs2_service_1 = require("../services/eosio/eosjs2.service");
const notification_service_1 = require("../services/notification.service");
const environment_1 = require("../../environments/environment");
const dist_1 = require("eosjs/dist");
let ImportModalComponent = class ImportModalComponent {
    constructor(eosjs, ledger, aService, network, crypto, fb, router, zone, cdr, toaster) {
        this.eosjs = eosjs;
        this.ledger = ledger;
        this.aService = aService;
        this.network = network;
        this.crypto = crypto;
        this.fb = fb;
        this.router = router;
        this.zone = zone;
        this.cdr = cdr;
        this.toaster = toaster;
        // boolean flags
        this.passmatch = true;
        this.lockscreen = false;
        this.hasPIN = false;
        this.busyActivekey = false;
        // constitution agreement
        this.agree = false;
        this.importedAccounts = [];
        // error strings
        this.errormsg = '';
        this.apierror = '';
        // public key
        this.publicEOS = '';
        this.subscriptions = [];
        this.compilerVersion = environment_1.environment.COMPILERVERSION;
        // ledger info
        this.usingLedger = false;
        this.accountsToImport = [];
        this.ledgerError = '';
        this.displayPublicKeys = false;
        this.busyVerifying = false;
    }
    importKeys(ledgerAccounts) {
        if (this.usingLedger) {
            this.loadSelectedLedgerAccts(ledgerAccounts).catch(console.log);
        }
        else {
            this.verifyPrivateKey(this.pvtform.get('private_key').value, true).catch(console.log);
        }
    }
    loadLedgerAccounts() {
        this.usingLedger = true;
        this.ledgerError = '';
        if (this.ledger.appReady) {
            console.log('reading ledger slots...');
            this.ledger.readSlots(0, 5);
        }
        else {
            this.ledgerError = 'error reading accounts from device! make sure the EOS app is open or device is connected!';
        }
        if (!this.ledgerEventsListener) {
            this.ledgerEventsListener = this.ledger.ledgerEvents.subscribe((value) => {
                if (value.event === 'new_account') {
                    console.log('new account');
                    this.ledgerError = '';
                }
                if (value.event === 'error') {
                    this.ledgerError = 'error reading accounts from device! make sure the EOS app is open on your ' + this.ledger.deviceName;
                }
                if (value.event === 'finished_reading') {
                    console.log('reading completed');
                }
                setImmediate(() => {
                    this.cdr.detectChanges();
                });
            });
        }
    }
    loadSelectedLedgerAccts(items) {
        return __awaiter(this, void 0, void 0, function* () {
            this.accountsToImport = [];
            this.keysToImport = new Map();
            for (const item of items) {
                this.keysToImport.set(item.value.key, item.value.slot);
                this.accountsToImport.push(item.value.data);
            }
            this.importwizard.next();
        });
    }
    createForms() {
        this.passform = this.fb.group({
            matchingPassword: this.fb.group({
                pass1: ['', [forms_1.Validators.required, forms_1.Validators.minLength(4)]],
                pass2: ['', [forms_1.Validators.required, forms_1.Validators.minLength(4)]]
            })
        });
        this.pvtform = this.fb.group({
            private_key: ['', forms_1.Validators.required]
        });
    }
    creatSubscriptions() {
        this.subscriptions.push(this.pvtform.get('private_key').valueChanges.subscribe((value) => {
            if (value) {
                value = value.trim();
                if (value.length >= 51) {
                    this.verifyPrivateKey(value, false).catch(console.log);
                }
            }
            else {
                this.importedAccounts = [];
                this.pvtform.controls['private_key'].setErrors(null);
                this.errormsg = '';
            }
        }));
    }
    ngOnInit() {
        this.ledgerError = '';
        this.createForms();
        this.creatSubscriptions();
    }
    ngOnDestroy() {
        this.subscriptions.forEach((s) => {
            s.unsubscribe();
        });
    }
    doCancel() {
        console.log('modal cancelled!');
        this.accountsToImport = [];
        this.importedAccounts = [];
        this.pvtform.reset();
        this.importwizard.reset();
        this.importwizard.close();
        Promise.resolve(null).then(() => {
            this.ledger.ledgerAccounts = [];
        });
    }
    openModal() {
        const data = localStorage.getItem('simpleos-hash');
        this.hasPIN = !!data;
        this.usingLedger = false;
        this.cdr.detectChanges();
        this.importwizard.open();
    }
    resetImport() {
        this.passform.reset();
        this.importwizard.reset();
        this.pvtform.reset();
    }
    completeLedgerImport() {
        return __awaiter(this, void 0, void 0, function* () {
            this.keysToImport.forEach((slot, key) => {
                this.crypto.storeLedgerAccount(key, slot, this.ledger.deviceName);
            });
            if (this.aService.accounts.length === 0) {
                yield this.aService.importAccounts(this.accountsToImport);
                yield this.router.navigate(['dashboard', 'home']);
            }
            else {
                yield this.aService.appendAccounts(this.accountsToImport);
            }
        });
    }
    importAccounts() {
        if (this.usingLedger) {
            this.completeLedgerImport().then(() => {
                this.usingLedger = false;
                this.ledger.ledgerAccounts = [];
                this.accountsToImport = [];
            }).finally(() => {
                this.resetImport();
            });
        }
        else {
            const pubk = this.publicEOS;
            const mp = this.passform.value.matchingPassword;
            const p1 = mp.pass1;
            const p2 = mp.pass2;
            if (p1 === p2) {
                this.crypto.initKeys(pubk, p1).then(() => {
                    this.crypto.encryptAndStore(this.pvtform.value.private_key, pubk)
                        .then(() => {
                        // check if its the first account
                        if (this.aService.accounts.length === 0) {
                            this.aService.importAccounts(this.importedAccounts).then((data) => {
                                if (data.length > 0) {
                                    this.crypto.decryptKeys(pubk).then(() => {
                                        this.router.navigate(['dashboard', 'home'])
                                            .then(() => {
                                        })
                                            .catch((err) => {
                                            console.log(err);
                                        });
                                        if (this.lockscreen) {
                                            this.setPin();
                                        }
                                    }).catch((error) => {
                                        console.log('Error', error);
                                    });
                                }
                            });
                        }
                        else {
                            this.aService.appendAccounts(this.importedAccounts).catch(console.log);
                        }
                    })
                        .catch((err) => {
                        console.log(err);
                    })
                        .finally(() => {
                        this.resetImport();
                    });
                });
            }
        }
    }
    verifyPrivateKey(input, auto) {
        return __awaiter(this, void 0, void 0, function* () {
            if (auto && this.importedAccounts.length > 0) {
                this.zone.run(() => {
                    this.importwizard.forceNext();
                });
                return;
            }
            if (input !== '' && !this.busyVerifying) {
                this.busyActivekey = true;
                this.busyVerifying = true;
                const pkey = input.trim();
                try {
                    const results = yield this.eosjs.checkPvtKey(pkey);
                    this.publicEOS = results.publicKey;
                    this.importedAccounts = [...results.foundAccounts];
                    this.importedAccounts.forEach((item) => {
                        const foundPermission = item.permissions.find(p => {
                            if (p.required_auth.keys.length > 0) {
                                const convertedKey = dist_1.Numeric.convertLegacyPublicKey(p.required_auth.keys[0].key);
                                return convertedKey === results.publicKey;
                            }
                            else {
                                return false;
                            }
                        });
                        if (foundPermission) {
                            item['permission'] = foundPermission.perm_name;
                        }
                        if (item['refund_request']) {
                            const tempDate = item['refund_request']['request_time'] + '.000Z';
                            const refundTime = new Date(tempDate).getTime() + (72 * 60 * 60 * 1000);
                            const now = new Date().getTime();
                            if (now > refundTime) {
                                this.eosjs.claimRefunds(item.account_name, pkey, item['permission']).then((tx) => {
                                    console.log(tx);
                                });
                            }
                            else {
                                console.log('Refund not ready!');
                            }
                        }
                    });
                    // filter out non-key authorities
                    this.importedAccounts = this.importedAccounts.filter(a => a.permission);
                    this.pvtform.controls['private_key'].setErrors(null);
                    this.zone.run(() => {
                        this.busyVerifying = false;
                        if (auto) {
                            this.importwizard.forceNext();
                        }
                        this.errormsg = '';
                        this.apierror = '';
                    });
                }
                catch (e) {
                    this.zone.run(() => {
                        this.busyVerifying = false;
                        this.pvtform.controls['private_key'].setErrors({ 'incorrect': true });
                        this.importedAccounts = [];
                        this.errormsg = (0, aux_functions_1.handleErrorMessage)(e);
                    });
                }
            }
        });
    }
    setPin() {
        this.crypto.createPIN(this.pin);
    }
    passCompare() {
        this.passmatch = (0, aux_functions_1.compare2FormPasswords)(this.passform);
    }
    reset() {
        this.importwizard.reset();
    }
    tick() {
        this.cdr.detectChanges();
    }
    nextPage() {
        this.passCompare();
        if (this.passform.valid) {
            if (!this.hasPIN) {
                this.importwizard.next();
            }
        }
    }
    cc(text) {
        window['navigator']['clipboard']['writeText'](text).then(() => {
            this.toaster.onSuccess('Public key copied clipboard!', '');
        }).catch(() => {
            this.toaster.onError('Clipboard didn\'t work!', 'Please try other way.');
        });
    }
};
__decorate([
    (0, core_1.ViewChild)('importwizard', { static: true }),
    __metadata("design:type", angular_1.ClrWizard)
], ImportModalComponent.prototype, "importwizard", void 0);
ImportModalComponent = __decorate([
    (0, core_1.Component)({
        selector: 'app-import-modal',
        templateUrl: './import-modal.component.html',
        styleUrls: ['./import-modal.component.css']
    }),
    __metadata("design:paramtypes", [eosjs2_service_1.Eosjs2Service,
        ledger_service_1.LedgerService,
        accounts_service_1.AccountsService,
        network_service_1.NetworkService,
        crypto_service_1.CryptoService,
        forms_1.FormBuilder,
        router_1.Router,
        core_1.NgZone,
        core_1.ChangeDetectorRef,
        notification_service_1.NotificationService])
], ImportModalComponent);
exports.ImportModalComponent = ImportModalComponent;
//# sourceMappingURL=import-modal.component.js.map