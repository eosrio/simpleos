import {ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {AccountsService} from "../services/accounts.service";
import {CryptoService} from "../services/crypto/crypto.service";
import {EOSJSService} from "../services/eosio/eosjs.service";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {NetworkService} from "../services/network.service";
import {Router} from "@angular/router";
import {Subscription} from "rxjs";
import {compare2FormPasswords, contentStyle, handleErrorMessage} from "../helpers/aux_functions";
import {ClrWizard} from "@clr/angular";
import {LedgerService} from "../services/ledger/ledger.service";
import {Eosjs2Service} from "../services/eosio/eosjs2.service";

@Component({
    selector: 'app-import-modal',
    templateUrl: './import-modal.component.html',
    styleUrls: ['./import-modal.component.css']
})
export class ImportModalComponent implements OnInit, OnDestroy {

    @ViewChild('importwizard', {static: true}) importwizard: ClrWizard;

    // boolean flags
    passmatch = true;
    lockscreen = false;

    busyActivekey = false;
    noPIN = true;

    // constitution agreement
    agree = false;

    // lockscreen pin
    pin: string;

    importedAccounts = [];

    // import private key form
    pvtform: FormGroup;
    // wallet password form
    passform: FormGroup;

    // error strings
    errormsg = '';

    apierror = '';

    // public key
    publicEOS = '';

    private subscriptions: Subscription[] = [];
    isOpen = false;

    // ledger info
    usingLedger = false;
    accountsToImport: any[] = [];
    keysToImport: Map<any, any>;
    ledgerError = '';
    private ledgerEventsListener: Subscription;

    constructor(
        public eos: EOSJSService,
        public eosjs: Eosjs2Service,
        public ledger: LedgerService,
        public aService: AccountsService,
        public network: NetworkService,
        private crypto: CryptoService,
        private fb: FormBuilder,
        private router: Router,
        private zone: NgZone,
        private cdr: ChangeDetectorRef
    ) {
        this.createForms();
        this.creatSubscriptions();
    }

    importKeys(ledgerAccounts) {
        if (this.usingLedger) {
            this.loadSelectedLedgerAccts(ledgerAccounts).catch(console.log);
        } else {
            this.verifyPrivateKey(this.pvtform.get('private_key').value, true);
        }
    }

    loadLedgerAccounts() {
        this.usingLedger = true;
        this.ledgerError = '';
        console.log('reading ledger slots...');
        this.ledger.readSlots(0, 5);
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

    async loadSelectedLedgerAccts(items) {
        this.accountsToImport = [];
        this.keysToImport = new Map();
        for (const item of items) {
            this.keysToImport.set(item.value.key, item.value.slot);
            this.accountsToImport.push(item.value.data);
        }
        this.importwizard.next();
    }

    createForms() {
        this.passform = this.fb.group({
            matchingPassword: this.fb.group({
                pass1: ['', [Validators.required, Validators.minLength(10)]],
                pass2: ['', [Validators.required, Validators.minLength(10)]]
            })
        });
        this.pvtform = this.fb.group({
            private_key: ['', Validators.required]
        });
    }

    creatSubscriptions() {
        this.subscriptions.push(this.pvtform.get('private_key').valueChanges.subscribe((value) => {
            if (value) {
                value = value.trim();
                if (value.length === 51) {
                    this.verifyPrivateKey(value, false);
                }
            } else {
                this.importedAccounts = [];
                this.pvtform.controls['private_key'].setErrors(null);
                this.errormsg = '';
            }
        }));
    }

    ngOnInit(): void {
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach((s) => {
            s.unsubscribe();
        });
    }

    doCancel(): void {
        this.pvtform.reset();
        this.importwizard.close();
        this.importwizard.reset();
        this.usingLedger = false;
        this.accountsToImport = [];
        this.importedAccounts = [];
        this.ledger.ledgerAccounts = [];
    }

    getConstitution() {
        if (this.network.activeChain['name'] === 'EOS MAINNET') {
            this.eos.getConstitution();
        }
    }

    resetImport() {
        this.passform.reset();
        this.importwizard.reset();
        this.pvtform.reset();
    }

    async completeLedgerImport() {
        this.keysToImport.forEach((slot, key) => {
            this.crypto.storeLedgerAccount(key, slot, this.ledger.deviceName);
        });
        if (this.aService.accounts.length === 0) {
            await this.aService.importAccounts(this.accountsToImport);
            await this.router.navigate(['dashboard', 'wallet']);
        } else {
            await this.aService.appendAccounts(this.accountsToImport);
        }
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
        } else {
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
                                this.aService.importAccounts(this.importedAccounts).then((data: any[]) => {
                                    if (data.length > 0) {
                                        this.crypto.decryptKeys(pubk).then(() => {
                                            this.router.navigate(['dashboard', 'wallet'])
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
                            } else {
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
        if (input !== '') {
            this.busyActivekey = true;
            this.eosjs.checkPvtKey(input.trim()).then((results) => {
                this.publicEOS = results.publicKey;
                this.importedAccounts = [];
                this.importedAccounts = [...results.foundAccounts];
                this.importedAccounts.forEach((item) => {
                    // console.log(item);
                    item['permission'] = item.permissions.find(p => {
                        return p.required_auth.keys[0].key === results.publicKey;
                    })['perm_name'];
                    if (item['refund_request']) {
                        const tempDate = item['refund_request']['request_time'] + '.000Z';
                        const refundTime = new Date(tempDate).getTime() + (72 * 60 * 60 * 1000);
                        const now = new Date().getTime();
                        if (now > refundTime) {
                            this.eos.claimRefunds(item.account_name, input.trim(), item['permission']).then((tx) => {
                                console.log(tx);
                            });
                        } else {
                            console.log('Refund not ready!');
                        }
                    }
                });
                this.pvtform.controls['private_key'].setErrors(null);
                this.zone.run(() => {
                    if (auto) {
                        this.importwizard.forceNext();
                    }
                    this.errormsg = '';
                    this.apierror = '';
                });
            }).catch((e) => {
                this.zone.run(() => {
                    this.pvtform.controls['private_key'].setErrors({'incorrect': true});
                    this.importedAccounts = [];
                    this.errormsg = handleErrorMessage(e);
                });
            });
        }
    }

    setPin() {
        this.crypto.createPIN(this.pin);
    }

    processContentStyle(constitution: string, textMuted: string) {
        contentStyle(constitution, textMuted);
    }

    passCompare() {
        this.passmatch = compare2FormPasswords(this.passform);
    }

    openModal() {
        this.importwizard.open();
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
            this.importwizard.next();
        }
    }
}
