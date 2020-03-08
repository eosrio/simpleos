import {ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {AccountsService} from '../services/accounts.service';
import {CryptoService} from '../services/crypto/crypto.service';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {NetworkService} from '../services/network.service';
import {Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {compare2FormPasswords, handleErrorMessage} from '../helpers/aux_functions';
import {ClrWizard} from '@clr/angular';
import {LedgerService} from '../services/ledger/ledger.service';
import {Eosjs2Service} from '../services/eosio/eosjs2.service';
import {BodyOutputType, Toast, ToasterConfig, ToasterService} from 'angular2-toaster';
import {environment} from '../../environments/environment';
import {Numeric} from "eosjs/dist";

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
    public compilerVersion = environment.COMPILERVERSION;

    // ledger info
    usingLedger = false;
    accountsToImport: any[] = [];
    keysToImport: Map<any, any>;
    ledgerError = '';
    private ledgerEventsListener: Subscription;
    displayPublicKeys = false;
    private config: ToasterConfig;
    busyVerifying = false;

    constructor(
        public eosjs: Eosjs2Service,
        public ledger: LedgerService,
        public aService: AccountsService,
        public network: NetworkService,
        private crypto: CryptoService,
        private fb: FormBuilder,
        private router: Router,
        private zone: NgZone,
        public cdr: ChangeDetectorRef,
        private toaster: ToasterService
    ) {
    }

    importKeys(ledgerAccounts) {
        if (this.usingLedger) {
            this.loadSelectedLedgerAccts(ledgerAccounts).catch(console.log);
        } else {
            this.verifyPrivateKey(this.pvtform.get('private_key').value, true).catch(console.log);
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
                pass1: ['', [Validators.required, Validators.minLength(4)]],
                pass2: ['', [Validators.required, Validators.minLength(4)]]
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
                if (value.length >= 51) {
                    this.verifyPrivateKey(value, false).catch(console.log);
                }
            } else {
                this.importedAccounts = [];
                this.pvtform.controls['private_key'].setErrors(null);
                this.errormsg = '';
            }
        }));
    }

    ngOnInit(): void {
        this.createForms();
        this.creatSubscriptions();
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach((s) => {
            s.unsubscribe();
        });
    }

    doCancel(): void {
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
        this.usingLedger = false;
        this.cdr.detectChanges();
        this.importwizard.open();
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

    async verifyPrivateKey(input, auto) {
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

                const results = await this.eosjs.checkPvtKey(pkey);

                this.publicEOS = results.publicKey;
                this.importedAccounts = [...results.foundAccounts];
                this.importedAccounts.forEach((item) => {
                    console.log(item);
                    const foundPermission = item.permissions.find(p => {
                        if (p.required_auth.keys.length > 0) {
                            const convertedKey = Numeric.convertLegacyPublicKey(p.required_auth.keys[0].key);
                            return convertedKey === results.publicKey;
                        } else {
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
                        } else {
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

            } catch (e) {

                this.zone.run(() => {
                    this.busyVerifying = false;
                    this.pvtform.controls['private_key'].setErrors({'incorrect': true});
                    this.importedAccounts = [];
                    this.errormsg = handleErrorMessage(e);
                });

            }
        }
    }

    setPin() {
        this.crypto.createPIN(this.pin);
    }

    passCompare() {
        this.passmatch = compare2FormPasswords(this.passform);
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

    private showToast(type: string, title: string, body: string) {
        this.config = new ToasterConfig({
            positionClass: 'toast-top-right',
            timeout: 10000,
            newestOnTop: true,
            tapToDismiss: true,
            preventDuplicates: false,
            animation: 'slideDown',
            limit: 1,
        });
        const toast: Toast = {
            type: type,
            title: title,
            body: body,
            timeout: 10000,
            showCloseButton: true,
            bodyOutputType: BodyOutputType.TrustedHtml,
        };
        this.toaster.popAsync(toast);
    }

    cc(text) {
        window['navigator']['clipboard']['writeText'](text).then(() => {
            this.showToast('success', 'Public key copied clipboard!', '');
        }).catch(() => {
            this.showToast('error', 'Clipboard didn\'t work!', 'Please try other way.');
        });
    }
}
