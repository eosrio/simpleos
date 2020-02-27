import {AfterViewInit, ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {AccountsService} from '../services/accounts.service';
import {ClrWizard} from '@clr/angular';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {BodyOutputType, Toast, ToasterConfig, ToasterService} from 'angular2-toaster';
import {CryptoService} from '../services/crypto/crypto.service';
import {RamService} from '../services/ram.service';
import {createNumberMask} from 'text-mask-addons/dist/textMaskAddons';
import {EOSAccount} from '../interfaces/account';
import {NetworkService} from '../services/network.service';
import {AppComponent} from '../app.component';
import {ThemeService} from '../services/theme.service';
import {Subscription} from 'rxjs';
import {Eosjs2Service} from '../services/eosio/eosjs2.service';

import {environment} from '../../environments/environment';
import {AnimationOptions} from 'ngx-lottie';
import {compare2FormPasswords} from '../helpers/aux_functions';
import {ImportModalComponent} from '../import-modal/import-modal.component';

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {

    @ViewChild('newAccountWizard', {static: true}) wizardaccount: ClrWizard;
    @ViewChild('importAccountWizard', {static: true}) importwizard: ClrWizard;

    @ViewChild(ImportModalComponent)
    private importModal: ImportModalComponent;

    lottieConfig: AnimationOptions = {
        path: 'assets/logoanim2.json',
        autoplay: false,
        loop: false,
    };

    anim: any;
    busy = false;

    accounts: any;
    appVersion: string;

    // New account
    passform: FormGroup;
    newAccountModal: boolean;
    importKeyModal: boolean;
    deleteAccModal: boolean;

    newAccountData = {
        t: 0,
        n: '',
        o: '',
        a: '',
    };

    newAccOptions = 'thispk';
    accountname = '';
    accountname_valid = false;
    accountname_err = '';
    amounterror = '';
    amounterror2 = '';
    amounterror3 = '';
    unstaked: number;
    passmatch = false;

    pvtform: FormGroup;
    passform2: FormGroup;
    errormsg: string;
    importedAccounts: any[];

    ownerpk = '';
    ownerpub = '';
    activepk = '';
    activepub = '';
    agreeKeys = false;
    generating = false;
    generated = false;

    final_creator = '';
    final_active = '';
    final_owner = '';
    final_name = '';
    delegate_transfer = false;

    confirmationID = '';
    success = false;

    delegateForm: FormGroup;
    submitTXForm: FormGroup;
    wrongwalletpass = '';
    config: ToasterConfig;

    numberMask = createNumberMask({
        prefix: '',
        allowDecimal: true,
        includeThousandsSeparator: false,
        decimalLimit: 4,
    });

    intMask = createNumberMask({
        prefix: '',
        allowDecimal: false,
        includeThousandsSeparator: false,
    });

    selectedAccRem = null;
    accRemovalIndex = null;
    selectedTab = 0;

    private subscriptions: Subscription[] = [];

    compilerVersion = environment.COMPILERVERSION;

    validOwnerPubKey: boolean = false;
    validActivePubKey: boolean = false;
    private ledgerEventsListener: Subscription;

    constructor(
        public eosjs: Eosjs2Service,
        private fb: FormBuilder,
        public aService: AccountsService,
        private toaster: ToasterService,
        private crypto: CryptoService,
        public network: NetworkService,
        public ram: RamService,
        private zone: NgZone,
        private theme: ThemeService,
        public app: AppComponent,
        private cdr: ChangeDetectorRef,
    ) {

        this.newAccountModal = false;
        this.importKeyModal = false;
        this.deleteAccModal = false;
        this.appVersion = window['appversion'];

        if (this.compilerVersion === 'DEFAULT') {
            this.theme.defaultTheme();
        }

        this.passform = this.fb.group({
            matchingPassword: this.fb.group({
                pass1: ['', [Validators.required, Validators.minLength(10)]],
                pass2: ['', [Validators.required, Validators.minLength(10)]],
            }),
        });

        this.delegateForm = this.fb.group({
            delegate_amount: [1, [Validators.required, Validators.min(1)]],
            delegate_transfer: [false, Validators.required],
            ram_amount: [4096, [Validators.required, Validators.min(4096)]],
            gift_amount: [0],
        });

        this.submitTXForm = this.fb.group({
            pass: ['', [Validators.required, Validators.minLength(10)]],
        });

        this.pvtform = this.fb.group({
            private_key: ['', Validators.required],
        });

        this.passform2 = this.fb.group({
            matchingPassword: this.fb.group({
                pass1: ['', [Validators.required, Validators.minLength(10)]],
                pass2: ['', [Validators.required, Validators.minLength(10)]],
            }),
        });

        this.errormsg = '';
        this.importedAccounts = [];

        this.lottieConfig = {
            path: 'assets/logoanim2.json',
            autoplay: true,
            loop: false,
        };

        document.onkeydown = (e) => {
            // next account
            if (e.ctrlKey && e.key === 'ArrowRight') {
                if (this.aService.selectedIdx < this.aService.accounts.length) {
                    this.aService.select(this.aService.selectedIdx + 1);
                    this.cdr.detectChanges();
                }
            }
            // previous account
            if (e.ctrlKey && e.key === 'ArrowLeft') {
                if (this.aService.selectedIdx > 0) {
                    this.aService.select(this.aService.selectedIdx - 1);
                    this.cdr.detectChanges();
                }
            }
        };
    }

    openTX(value) {
        window['shell']['openExternal'](this.aService.activeChain['explorers'][0]['tx_url'] + value);
    }

    ngOnInit() {
        // this.accounts = [];
        // this.eosjs.status.asObservable().subscribe((status) => {
        //     if (status) {
        //         this.loadStoredAccounts();
        //     }
        // });
    }

    ngAfterViewInit() {
        this.subscriptions.push(
            this.aService.selected.asObservable().subscribe(() => {
                this.selectedTab = this.aService.selectedIdx;
            }),
        );
        this.cdr.detectChanges();

    }

    ngOnDestroy(): void {
        this.subscriptions.forEach(s => {
            s.unsubscribe();
        });
        if (this.ledgerEventsListener) {
            this.ledgerEventsListener.unsubscribe();
            this.ledgerEventsListener = null;
        }
    }

    // getPermissionName(account, key) {
    //     return account.permissions.find(p => {
    //         return p.required_auth.keys[0].key === key;
    //     })['perm_name'];
    // }

    openRemoveAccModal(index, account) {
        this.selectedAccRem = account;
        this.accRemovalIndex = index;
        this.deleteAccModal = true;
    }

    doRemoveAcc() {
        if (!this.aService.isRefreshing) {

            const auths = this.aService.getStoredAuths(this.aService.accounts[this.accRemovalIndex]);
            const savedData = localStorage.getItem('eos_keys.' + this.aService.activeChain.id);
            if (savedData) {
                const keystore = JSON.parse(savedData);
                for (const auth of auths) {
                    if (keystore[auth.key]) {
                        delete keystore[auth.key];
                        console.log(`${auth.key} removed`);
                    } else {
                        console.log(`${auth.key} not found`);
                    }
                }
                localStorage.setItem('eos_keys.' + this.aService.activeChain.id, JSON.stringify(keystore));
            }

            this.aService.accounts.splice(this.accRemovalIndex, 1);
            this.deleteAccModal = false;
            this.aService.select(0);
            this.selectedTab = 0;
            this.aService.refreshFromChain(true).catch(console.log);
        }
    }

    resetAndClose() {
        this.wizardaccount.reset();
        this.wizardaccount.close();
    }

    loadLastPage() {
        if (this.newAccOptions === 'newpk') {
            this.final_active = this.activepub;
            this.final_owner = this.ownerpub;
        }
        if (this.newAccOptions === 'thispk') {
            const account = this.aService.selected.getValue();
            this.final_active = account.details['permissions'][0]['required_auth'].keys[0].key;
            this.final_owner = account.details['permissions'][1]['required_auth'].keys[0].key;
        }
    }

    executeTX() {
        this.busy = true;
        const delegate_amount = parseFloat(this.delegateForm.get('delegate_amount').value);
        const ram_amount = parseInt(this.delegateForm.get('ram_amount').value, 10);
        const gift_amount = parseFloat(this.delegateForm.get('gift_amount').value);
        const delegate_transfer = this.delegateForm.get('delegate_transfer').value;

        const account = this.aService.selected.getValue();
        this.final_creator = account.name;

        const [publicKey, permission] = this.aService.getStoredKey(account);

        this.crypto.authenticate(this.submitTXForm.get('pass').value, publicKey).then((data) => {
            if (data === true) {
                this.eosjs.createAccount(
                    this.final_creator, this.final_name, this.final_owner,
                    this.final_active, delegate_amount, ram_amount,
                    delegate_transfer, gift_amount, 'created with simpleos', this.aService.activeChain['symbol'], this.aService.activeChain['precision'], permission).then((txdata) => {
                    console.log(txdata);
                    if (this.newAccOptions === 'newpk') {
                        if (this.generated && this.agreeKeys) {
                            setTimeout(() => {
                                this.eosjs.checkPvtKey(this.activepk).then((results) => {
                                    const pform = this.passform.value.matchingPassword;
                                    // Import private key
                                    if (pform.pass1 === pform.pass2) {
                                        this.crypto.initKeys(this.final_active, pform.pass1).then(() => {
                                            this.crypto.encryptAndStore(this.activepk, this.final_active).then(() => {
                                                this.aService.appendNewAccount(results.foundAccounts[0]).catch(console.log);
                                                this.wrongwalletpass = '';
                                                this.busy = false;
                                                this.success = true;
                                                this.confirmationID = txdata['transaction_id'];
                                                this.showToast('success', 'Account created', 'Check your history for confirmation.');
                                                this.submitTXForm.reset();
                                                this.aService.refreshFromChain(true).catch(console.log);
                                            }).catch((err) => {
                                                console.log(err);
                                            });
                                        });
                                    }
                                });
                            }, 5000);
                        } else {
                            this.wrongwalletpass = '';
                            this.busy = false;
                            this.success = true;
                            this.confirmationID = txdata['transaction_id'];
                            this.showToast('success', 'Account created', 'Check your history for confirmation.');
                            this.submitTXForm.reset();
                            this.aService.refreshFromChain(true).catch(console.log);
                        }
                    } else if (this.newAccOptions === 'friend') {

                        this.wrongwalletpass = '';
                        this.confirmationID = txdata['transaction_id'];
                        this.success = true;
                        this.busy = false;
                        this.showToast('success', 'Account created', 'Check your history for confirmation. Please notify your friend.');
                        this.submitTXForm.reset();
                    } else if (this.newAccOptions === 'thispk') {
                        setTimeout(() => {
                            this.eosjs.getAccountInfo(this.final_name).then((acc_data) => {
                                this.eosjs.getTokens(acc_data['account_name']).then((tokens) => {
                                    acc_data['tokens'] = tokens;
                                    this.aService.appendNewAccount(acc_data).catch(console.log);
                                    this.wrongwalletpass = '';
                                    this.busy = false;
                                    this.success = true;
                                    this.confirmationID = txdata['transaction_id'];
                                    this.showToast('success', 'Account created', 'Check your history for confirmation.');
                                    this.submitTXForm.reset();
                                }).catch((err) => {
                                    console.log(err);
                                });
                            });
                        }, 5000);
                    }
                }).catch((err2) => {
                    console.log(err2);
                    this.wrongwalletpass = err2;
                    this.busy = false;
                    this.success = false;
                    // if (errorJSON.error.code === 3081001) {
                    // 	this.wrongwalletpass = 'Not enough stake to perform this action.';
                    // } else if (errorJSON.error.code === 3050000) {
                    // 	this.wrongwalletpass = 'Account name not available.';
                    // } else {
                    // 	this.wrongwalletpass = errorJSON.error['what'];
                    // }

                });
            } else {
                this.wrongwalletpass = 'Something went wrong!';
                this.busy = false;
                this.success = false;
            }
        }).catch(() => {
            this.busy = false;
            this.wrongwalletpass = 'Wrong password!';
            this.success = false;
        });
    }

    handleAnimation(anim: any) {
        this.anim = anim;
        this.anim['setSpeed'](0.8);
    }

    selectAccount(idx) {
        this.aService.select(idx);
        this.selectedTab = this.aService.selectedIdx;
        this.cdr.detectChanges();
    }

    // loadStoredAccounts() {
    //     const account_names = Object.keys(this.eos.accounts.getValue());
    //     if (account_names.length > 0) {
    //         account_names.forEach((name) => {
    //             const acc = this.eosjs.accounts.getValue()[name];
    //             let balance = 0;
    //             let staked = 0;
    //             acc['tokens'].forEach((tk) => {
    //                 balance += LandingComponent.parseEOS(tk);
    //             });
    //             if (acc['total_resources']) {
    //                 const net = LandingComponent.parseEOS(acc['total_resources']['net_weight']);
    //                 const cpu = LandingComponent.parseEOS(acc['total_resources']['cpu_weight']);
    //                 balance += net;
    //                 balance += cpu;
    //                 staked = net + cpu;
    //             }
    //
    //             const precisionRound = Math.pow(10, this.aService.activeChain['precision']);
    //             console.log('dashboard', this.aService.activeChain['name'].indexOf('LIBERLAND'));
    //             if (this.aService.activeChain['name'].indexOf('LIBERLAND') > -1) {
    //                 staked = acc['voter_info']['staked'] / precisionRound;
    //                 balance += staked;
    //             }
    //
    //             const accData = {
    //                 name: acc['account_name'],
    //                 full_balance: Math.round((balance) * precisionRound) / precisionRound,
    //                 staked: staked,
    //                 details: acc
    //             };
    //             this.accounts.push(accData);
    //             this.aService.accounts.push(accData);
    //         });
    //     }
    //     this.aService.initFirst();
    // }

    cc(text) {
        window['navigator']['clipboard']['writeText'](text).then(() => {
            this.showToast('success', 'Key copied to clipboard!', 'Please save it on a safe place.');
        }).catch(() => {
            this.showToast('error', 'Clipboard didn\'t work!', 'Please try other way.');
        });
    }

    verifyAccountName(next) {
        const creator = this.aService.selected.getValue().name;
        console.log(creator);
        try {
            this.accountname_valid = false;
            const res = this.eosjs.checkAccountName(this.accountname);
            // const regexName = new RegExp('^([a-z]|[1-5])+$');
            if (res !== 0) {
                if (this.accountname.length < 12 && creator.length === 12) {
                    this.accountname_err = 'The account name must have exactly 12 characters. a-z, 1-5';
                    this.accountname_valid = false;
                    return;
                }

                if (creator.length < 12) {
                    console.log(this.accountname.endsWith(creator));
                    if (this.accountname.length < 12 && !this.accountname.endsWith(creator)) {
                        this.accountname_err = 'You are not eligible to create accounts under this suffix';
                        this.accountname_valid = false;
                        return;
                    }
                }

                this.eosjs.getAccountInfo(this.accountname).then(() => {
                    this.accountname_err = 'This account name is not available. Please try another.';
                    this.accountname_valid = false;
                }).catch(() => {
                    this.accountname_valid = true;
                    this.newAccountData.n = this.accountname;
                    this.final_name = this.accountname;
                    this.final_creator = creator;
                    this.accountname_err = '';
                    if (next) {
                        this.wizardaccount.next();
                    }
                });
            }
        } catch (e) {
            this.accountname_err = e.message;
            this.accountname_valid = false;
        }
    }

    initNewAcc() {
        this.aService.selected.asObservable().subscribe((sel: EOSAccount) => {
            if (sel) {
                this.unstaked = sel.full_balance - sel.staked - sel.unstaking;
            }
        });
    }

    checkAmount(field) {

        if (field === 'gift_amount' && (this.delegateForm.get(field).value !== '' || this.delegateForm.get(field).value > 0)) {
            if (parseFloat(this.delegateForm.get(field).value) > this.unstaked) {
                this.delegateForm.controls[field].setErrors({'incorrect': true});
                this.amounterror3 = 'you don\'t have enought unstaked tokens on this account';
            } else {
                this.delegateForm.controls['delegate_amount'].setErrors(null);
                this.amounterror3 = '';
            }
        } else {
            if (parseFloat(this.delegateForm.get(field).value) === 0 || this.delegateForm.get(field).value === '') {
                this.delegateForm.controls[field].setErrors({'incorrect': true});
                this.amounterror = 'invalid amount';
            } else {
                if (parseFloat(this.delegateForm.get(field).value) > this.unstaked) {
                    this.delegateForm.controls[field].setErrors({'incorrect': true});
                    this.amounterror = 'invalid amount';
                } else {
                    this.delegateForm.controls['delegate_amount'].setErrors(null);
                    this.amounterror = '';
                }
            }
        }
    }

    checkAmountBytes() {
        const price = (this.ram.ramPriceEOS * (this.delegateForm.get('ram_amount').value / 1024));
        if (parseFloat(this.delegateForm.get('ram_amount').value) === 0 || this.delegateForm.get('ram_amount').value === '') {
            this.delegateForm.controls['ram_amount'].setErrors({'incorrect': true});
            this.amounterror2 = 'invalid amount, you need to buy some ram in order to create an account';
        } else {
            if (price > this.unstaked) {
                this.delegateForm.controls['ram_amount'].setErrors({'incorrect': true});
                this.amounterror2 = 'you don\'t have enought unstaked tokens on this account';
            } else {
                this.delegateForm.controls['ram_amount'].setErrors(null);
                this.amounterror2 = '';
            }
        }
    }

    passCompare() {
        this.passmatch = compare2FormPasswords(this.passform);
    }

    async generateKeys() {
        this.generating = true;

        this.ownerpk = await this.eosjs.ecc.randomKey(64);
        this.ownerpub = this.eosjs.ecc.privateToPublic(this.ownerpk);

        this.activepk = await this.eosjs.ecc.randomKey(64);
        this.activepub = this.eosjs.ecc.privateToPublic(this.activepk);

        this.generating = false;
        this.generated = true;
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

    tick() {
        this.cdr.detectChanges();
    }

    openImportModal() {
        this.importModal.openModal();
    }
}
