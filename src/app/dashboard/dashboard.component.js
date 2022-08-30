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
exports.DashboardComponent = void 0;
const core_1 = require("@angular/core");
const accounts_service_1 = require("../services/accounts.service");
const angular_1 = require("@clr/angular");
const forms_1 = require("@angular/forms");
const notification_service_1 = require("../services/notification.service");
const crypto_service_1 = require("../services/crypto/crypto.service");
const ram_service_1 = require("../services/ram.service");
const textMaskAddons_1 = require("text-mask-addons/dist/textMaskAddons");
const network_service_1 = require("../services/network.service");
const app_component_1 = require("../app.component");
const theme_service_1 = require("../services/theme.service");
const eosjs2_service_1 = require("../services/eosio/eosjs2.service");
const environment_1 = require("../../environments/environment");
const aux_functions_1 = require("../helpers/aux_functions");
const import_modal_component_1 = require("../import-modal/import-modal.component");
const router_1 = require("@angular/router");
const faHome_1 = require("@fortawesome/pro-regular-svg-icons/faHome");
const faHistory_1 = require("@fortawesome/pro-regular-svg-icons/faHistory");
const faPaperPlane_1 = require("@fortawesome/pro-regular-svg-icons/faPaperPlane");
const faMemory_1 = require("@fortawesome/pro-regular-svg-icons/faMemory");
const faEdit_1 = require("@fortawesome/pro-regular-svg-icons/faEdit");
const faLock_1 = require("@fortawesome/pro-regular-svg-icons/faLock");
const faExchangeAlt_1 = require("@fortawesome/pro-regular-svg-icons/faExchangeAlt");
const faPuzzlePiece_1 = require("@fortawesome/pro-regular-svg-icons/faPuzzlePiece");
const faHeart_1 = require("@fortawesome/pro-solid-svg-icons/faHeart");
let DashboardComponent = class DashboardComponent {
    constructor(eosjs, fb, aService, toaster, crypto, network, ram, zone, theme, app, cdr, router) {
        this.eosjs = eosjs;
        this.fb = fb;
        this.aService = aService;
        this.toaster = toaster;
        this.crypto = crypto;
        this.network = network;
        this.ram = ram;
        this.zone = zone;
        this.theme = theme;
        this.app = app;
        this.cdr = cdr;
        this.router = router;
        this.lottieConfig = {
            path: 'assets/logoanim2.json',
            autoplay: false,
            loop: false,
        };
        this.busy = false;
        this.newAccountData = {
            t: 0,
            n: '',
            o: '',
            a: '',
        };
        this.newAccOptions = 'thispk';
        this.accountname = '';
        this.accountname_valid = false;
        this.accountname_err = '';
        this.amounterror = '';
        this.amounterror2 = '';
        this.amounterror3 = '';
        this.passmatch = false;
        this.ownerpk = '';
        this.ownerpub = '';
        this.activepk = '';
        this.activepub = '';
        this.agreeKeys = false;
        this.generating = false;
        this.generated = false;
        this.final_creator = '';
        this.final_active = '';
        this.final_owner = '';
        this.final_name = '';
        this.delegate_transfer = false;
        this.confirmationID = '';
        this.success = false;
        this.wrongwalletpass = '';
        this.numberMask = (0, textMaskAddons_1.createNumberMask)({
            prefix: '',
            allowDecimal: true,
            includeThousandsSeparator: false,
            decimalLimit: 4,
        });
        this.intMask = (0, textMaskAddons_1.createNumberMask)({
            prefix: '',
            allowDecimal: false,
            includeThousandsSeparator: false,
        });
        this.selectedAccRem = null;
        this.accRemovalIndex = null;
        this.selectedTab = 0;
        this.subscriptions = [];
        this.compilerVersion = environment_1.environment.COMPILERVERSION;
        this.validOwnerPubKey = false;
        this.validActivePubKey = false;
        this.faIcons = {
            regular: {
                home: faHome_1.faHome,
                history: faHistory_1.faHistory,
                send: faPaperPlane_1.faPaperPlane,
                memory: faMemory_1.faMemory,
                edit: faEdit_1.faEdit,
                lock: faLock_1.faLock,
                exchange: faExchangeAlt_1.faExchangeAlt,
                puzzle: faPuzzlePiece_1.faPuzzlePiece
            },
            solid: {
                heart: faHeart_1.faHeart
            }
        };
        this.newAccountModal = false;
        this.importKeyModal = false;
        this.deleteAccModal = false;
        this.appVersion = window.appversion;
        if (this.compilerVersion === 'DEFAULT') {
            if (this.theme.lightMode) {
                this.theme.lightTheme();
            }
            else {
                this.theme.defaultTheme();
            }
        }
        this.passform = this.fb.group({
            matchingPassword: this.fb.group({
                pass1: ['', [forms_1.Validators.required, forms_1.Validators.minLength(4)]],
                pass2: ['', [forms_1.Validators.required, forms_1.Validators.minLength(4)]],
            }),
        });
        this.delegateForm = this.fb.group({
            delegate_amount: [1, [forms_1.Validators.required, forms_1.Validators.min(1)]],
            delegate_transfer: [false, forms_1.Validators.required],
            ram_amount: [4096, [forms_1.Validators.required, forms_1.Validators.min(4096)]],
            gift_amount: [0],
        });
        this.submitTXForm = this.fb.group({
            pass: ['', [forms_1.Validators.required, forms_1.Validators.minLength(4)]],
        });
        this.pvtform = this.fb.group({
            private_key: ['', forms_1.Validators.required],
        });
        this.passform2 = this.fb.group({
            matchingPassword: this.fb.group({
                pass1: ['', [forms_1.Validators.required, forms_1.Validators.minLength(4)]],
                pass2: ['', [forms_1.Validators.required, forms_1.Validators.minLength(4)]],
            }),
        });
        this.errormsg = '';
        this.importedAccounts = [];
        this.lottieConfig = {
            path: 'assets/logoanim2.json',
            autoplay: true,
            loop: false,
        };
        // dashboard key shortcuts
        document.onkeydown = (e) => {
            if (e.altKey) {
                switch (e.key) {
                    case 'd': {
                        this.navigateTo('home');
                        break;
                    }
                    case 'v': {
                        this.navigateTo('vote');
                        break;
                    }
                    case 'r': {
                        this.navigateTo('ram');
                        break;
                    }
                    case 's': {
                        this.navigateTo('send');
                        break;
                    }
                    case 'h': {
                        this.navigateTo('wallet');
                        break;
                    }
                    case 'o': {
                        this.navigateTo('config');
                        break;
                    }
                    case 'a': {
                        this.navigateTo('about');
                        break;
                    }
                    case 'c': {
                        this.navigateTo('dapp');
                        break;
                    }
                }
            }
            if (e.ctrlKey) {
                if (e.key === 'ArrowRight') {
                    if (this.aService.selectedIdx < this.aService.accounts.length) {
                        this.aService.select(this.aService.selectedIdx + 1);
                        this.cdr.detectChanges();
                    }
                }
                if (e.key === 'ArrowLeft') {
                    if (this.aService.selectedIdx > 0) {
                        this.aService.select(this.aService.selectedIdx - 1);
                        this.cdr.detectChanges();
                    }
                }
                if (e.key >= '1' && e.key <= '9') {
                    console.log('select account ' + e.key);
                    const accNum = parseInt(e.key);
                    if (this.aService.accounts.length >= accNum) {
                        this.aService.select(accNum - 1);
                        this.cdr.detectChanges();
                    }
                }
            }
        };
    }
    navigateTo(page) {
        this.zone.run(() => {
            this.router.navigate(['dashboard', page]).catch(console.log);
        });
    }
    openTX(value) {
        // window.shell.openExternal(this.aService.activeChain.explorers[0].tx_url + value);
    }
    ngAfterViewInit() {
        let loadedFirst = false;
        this.subscriptions.push(this.aService.selected.asObservable().subscribe((data) => {
            const acc = this.aService.selected.getValue();
            this.selectedTab = this.aService.selectedIdx;
            if (data.name && !loadedFirst) {
                loadedFirst = true;
                this.aService.getAccActions(acc.name).catch(console.log);
            }
        }));
        this.cdr.detectChanges();
    }
    ngOnDestroy() {
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
                    }
                    else {
                        console.log(`${auth.key} not found`);
                    }
                }
                localStorage.setItem('eos_keys.' + this.aService.activeChain.id, JSON.stringify(keystore));
            }
            this.aService.accounts.splice(this.accRemovalIndex, 1);
            this.deleteAccModal = false;
            if (this.accRemovalIndex === 0) {
                this.aService.select(0);
                this.selectedTab = 0;
            }
            else {
                this.aService.select(this.accRemovalIndex - 1);
                this.selectedTab = this.accRemovalIndex - 1;
            }
            this.aService.refreshFromChain(true).catch(console.log);
        }
    }
    resetAndClose() {
        this.wizardAccount.reset();
        this.wizardAccount.close();
    }
    loadLastPage() {
        if (this.newAccOptions === 'newpk') {
            this.final_active = this.activepub;
            this.final_owner = this.ownerpub;
        }
        if (this.newAccOptions === 'thispk') {
            const account = this.aService.selected.getValue();
            this.final_active = account.details.permissions[0].required_auth.keys[0].key;
            this.final_owner = account.details.permissions[1].required_auth.keys[0].key;
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
                this.eosjs.createAccount(this.final_creator, this.final_name, this.final_owner, this.final_active, delegate_amount, ram_amount, delegate_transfer, gift_amount, 'created with simpleos', this.aService.activeChain.symbol, this.aService.activeChain.precision, permission).then((txdata) => {
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
                                                this.confirmationID = txdata.transaction_id;
                                                this.toaster.onSuccess('Account created', 'Check your history for confirmation.');
                                                this.submitTXForm.reset();
                                                this.aService.refreshFromChain(true).catch(console.log);
                                            }).catch((err) => {
                                                console.log(err);
                                            });
                                        });
                                    }
                                });
                            }, 5000);
                        }
                        else {
                            this.wrongwalletpass = '';
                            this.busy = false;
                            this.success = true;
                            this.confirmationID = txdata.transaction_id;
                            this.toaster.onSuccess('Account created', 'Check your history for confirmation.');
                            this.submitTXForm.reset();
                            this.aService.refreshFromChain(true).catch(console.log);
                        }
                    }
                    else if (this.newAccOptions === 'friend') {
                        this.wrongwalletpass = '';
                        this.confirmationID = txdata.transaction_id;
                        this.success = true;
                        this.busy = false;
                        this.toaster.onSuccess('Account created', 'Check your history for confirmation. Please notify your friend.');
                        this.submitTXForm.reset();
                    }
                    else if (this.newAccOptions === 'thispk') {
                        setTimeout(() => {
                            this.eosjs.getAccountInfo(this.final_name).then((accData) => {
                                this.eosjs.getTokens(accData.account_name).then((tokens) => {
                                    accData.tokens = tokens;
                                    this.aService.appendNewAccount(accData).catch(console.log);
                                    this.wrongwalletpass = '';
                                    this.busy = false;
                                    this.success = true;
                                    this.confirmationID = txdata.transaction_id;
                                    this.toaster.onSuccess('Account created', 'Check your history for confirmation.');
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
            }
            else {
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
    handleAnimation(anim) {
        this.anim = anim;
        this.anim.setSpeed(0.8);
    }
    selectAccount(idx) {
        this.aService.select(idx);
        this.selectedTab = this.aService.selectedIdx;
        this.cdr.detectChanges();
    }
    cc(text) {
        window.navigator.clipboard.writeText(text).then(() => {
            this.toaster.onSuccess('Key copied to clipboard!', 'Please save it on a safe place.');
        }).catch(() => {
            this.toaster.onError('Clipboard didn\'t work!', 'Please try other way.');
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
                        this.wizardAccount.next();
                    }
                });
            }
        }
        catch (e) {
            this.accountname_err = e.message;
            this.accountname_valid = false;
        }
    }
    initNewAcc() {
        this.aService.selected.asObservable().subscribe((sel) => {
            if (sel) {
                this.unstaked = sel.full_balance - sel.staked - sel.unstaking;
            }
        });
    }
    checkAmount(field) {
        if (field === 'gift_amount' && (this.delegateForm.get(field).value !== '' || this.delegateForm.get(field).value > 0)) {
            if (parseFloat(this.delegateForm.get(field).value) > this.unstaked) {
                this.delegateForm.controls[field].setErrors({ incorrect: true });
                this.amounterror3 = 'you don\'t have enought unstaked tokens on this account';
            }
            else {
                this.delegateForm.controls.delegate_amount.setErrors(null);
                this.amounterror3 = '';
            }
        }
        else {
            if (parseFloat(this.delegateForm.get(field).value) === 0 || this.delegateForm.get(field).value === '') {
                this.delegateForm.controls[field].setErrors({ incorrect: true });
                this.amounterror = 'invalid amount';
            }
            else {
                if (parseFloat(this.delegateForm.get(field).value) > this.unstaked) {
                    this.delegateForm.controls[field].setErrors({ incorrect: true });
                    this.amounterror = 'invalid amount';
                }
                else {
                    this.delegateForm.controls.delegate_amount.setErrors(null);
                    this.amounterror = '';
                }
            }
        }
    }
    checkAmountBytes() {
        const price = (this.ram.ramPriceEOS * (this.delegateForm.get('ram_amount').value / 1024));
        if (parseFloat(this.delegateForm.get('ram_amount').value) === 0 || this.delegateForm.get('ram_amount').value === '') {
            this.delegateForm.controls.ram_amount.setErrors({ incorrect: true });
            this.amounterror2 = 'invalid amount, you need to buy some ram in order to create an account';
        }
        else {
            if (price > this.unstaked) {
                this.delegateForm.controls.ram_amount.setErrors({ incorrect: true });
                this.amounterror2 = 'you don\'t have enought unstaked tokens on this account';
            }
            else {
                this.delegateForm.controls.ram_amount.setErrors(null);
                this.amounterror2 = '';
            }
        }
    }
    passCompare() {
        this.passmatch = (0, aux_functions_1.compare2FormPasswords)(this.passform);
    }
    generateKeys() {
        return __awaiter(this, void 0, void 0, function* () {
            this.generating = true;
            const activePair = yield this.crypto.generateKeyPair();
            const ownerPair = yield this.crypto.generateKeyPair();
            this.ownerpk = ownerPair.private;
            this.ownerpub = ownerPair.public;
            this.activepk = activePair.private;
            this.activepub = activePair.public;
            this.generating = false;
            this.generated = true;
        });
    }
    tick() {
        this.cdr.detectChanges();
    }
    openImportModal() {
        this.importModal.openModal();
    }
    ramToEOS(value) {
        return this.ram.ramPriceEOS * (parseInt(value, 10) / 1024);
    }
};
__decorate([
    (0, core_1.ViewChild)('newAccountWizard', { static: true }),
    __metadata("design:type", angular_1.ClrWizard)
], DashboardComponent.prototype, "wizardAccount", void 0);
__decorate([
    (0, core_1.ViewChild)('importAccountWizard', { static: true }),
    __metadata("design:type", angular_1.ClrWizard)
], DashboardComponent.prototype, "importWizard", void 0);
__decorate([
    (0, core_1.ViewChild)(import_modal_component_1.ImportModalComponent),
    __metadata("design:type", import_modal_component_1.ImportModalComponent)
], DashboardComponent.prototype, "importModal", void 0);
DashboardComponent = __decorate([
    (0, core_1.Component)({
        selector: 'app-dashboard',
        templateUrl: './dashboard.component.html',
        styleUrls: ['./dashboard.component.css'],
    }),
    __metadata("design:paramtypes", [eosjs2_service_1.Eosjs2Service,
        forms_1.FormBuilder,
        accounts_service_1.AccountsService,
        notification_service_1.NotificationService,
        crypto_service_1.CryptoService,
        network_service_1.NetworkService,
        ram_service_1.RamService,
        core_1.NgZone,
        theme_service_1.ThemeService,
        app_component_1.AppComponent,
        core_1.ChangeDetectorRef,
        router_1.Router])
], DashboardComponent);
exports.DashboardComponent = DashboardComponent;
//# sourceMappingURL=dashboard.component.js.map