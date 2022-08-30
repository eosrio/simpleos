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
var ConfigComponent_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigComponent = void 0;
const core_1 = require("@angular/core");
const forms_1 = require("@angular/forms");
const router_1 = require("@angular/router");
const accounts_service_1 = require("../../services/accounts.service");
const network_service_1 = require("../../services/network.service");
const crypto_service_1 = require("../../services/crypto/crypto.service");
const notification_service_1 = require("../../services/notification.service");
const angular_1 = require("@clr/angular");
const backup_service_1 = require("../../services/backup.service");
const app_component_1 = require("../../app.component");
const eosjs2_service_1 = require("../../services/eosio/eosjs2.service");
const chain_service_1 = require("../../services/chain.service");
const keygen_modal_component_1 = require("../../keygen-modal/keygen-modal.component");
const environment_1 = require("../../../environments/environment");
const electron_1 = require("electron");
let ConfigComponent = ConfigComponent_1 = class ConfigComponent {
    constructor(fb, network, router, crypto, aService, toaster, backup, app, eosjs, chain) {
        this.fb = fb;
        this.network = network;
        this.router = router;
        this.crypto = crypto;
        this.aService = aService;
        this.toaster = toaster;
        this.backup = backup;
        this.app = app;
        this.eosjs = eosjs;
        this.chain = chain;
        this.infile = '';
        this.exfile = '';
        this.busy = false;
        this.pkExposureTime = 30;
        this.timetoclose = 0;
        this.timeoutpk = null;
        this.timeoutviewpk = null;
        this.pkError = '';
        this.selectedEndpoint = null;
        this.autoBackup = false;
        this.selectedAccount = '';
        this.claimKey = false;
        this.claimPrivateKey = '';
        this.localKeys = [];
        this.wrongpass = false;
        this.compilerVersion = environment_1.environment.COMPILERVERSION;
        this.fs = window.filesystem;
        this.timetoclose = this.pkExposureTime;
        this.endpointModal = false;
        this.logoutModal = false;
        this.chainModal = false;
        this.confirmModal = false;
        this.pinModal = false;
        this.clearPinModal = false;
        this.clearContacts = false;
        this.changePassModal = false;
        this.importBKModal = false;
        this.exportBKModal = false;
        this.viewPKModal = false;
        this.showpk = false;
        this.managerKeys = false;
        this.passForm = this.fb.group({
            oldpass: ['', [forms_1.Validators.required, forms_1.Validators.minLength(4)]],
            matchingPassword: this.fb.group({
                pass1: ['', [forms_1.Validators.required, forms_1.Validators.minLength(4)]],
                pass2: ['', [forms_1.Validators.required, forms_1.Validators.minLength(4)]]
            })
        });
        this.pinForm = this.fb.group({
            pin: ['', forms_1.Validators.required],
        });
        this.exportForm = this.fb.group({
            pass: ['', forms_1.Validators.required]
        });
        this.importForm = this.fb.group({
            pass: ['', forms_1.Validators.required],
            customImportBK: ['', forms_1.Validators.required],
        });
        this.chainForm = this.fb.group({
            pass: ['', forms_1.Validators.required]
        });
        this.showpkForm = this.fb.group({
            pass: ['', forms_1.Validators.required]
        });
        this.disableEx = false;
        this.disableIm = false;
        this.chainConnected = [];
        this.populateAccounts();
    }
    static resetApp() {
        window.remote.app.relaunch();
        window.remote.app.exit(0);
    }
    populateAccounts() {
        this.keysaccounts = new Map();
        for (let i = 0; i < this.aService.accounts.length; i++) {
            const account = this.aService.accounts[i];
            const auth = this.aService.getStoredKey(account);
            if (!this.keysaccounts.has(auth[0])) {
                this.keysaccounts.set(auth[0], []);
            }
            this.keysaccounts.get(auth[0]).push({
                account: account,
                permission: auth[1],
                idx: i
            });
        }
        this.localKeys = [...this.keysaccounts.keys()];
        if (this.localKeys.length === 0) {
            this.router.navigateByUrl('/').catch(console.log);
        }
    }
    ngOnInit() {
        this.chainConnected = this.getChainConnected();
        this.autoBackup = this.backup.automatic === 'true';
        this.backup.getLastBackupTime();
        this.subscriptions = [];
        this.subscriptions.push(this.aService.selected.asObservable().subscribe(value => {
            if (value) {
                this.populateAccounts();
            }
        }));
    }
    ngOnDestroy() {
        this.subscriptions.forEach((subs) => {
            subs.unsubscribe();
        });
    }
    cc(text) {
        window['navigator']['clipboard']['writeText'](text).then(() => {
            this.toaster.onSuccess('Key copied to clipboard!', 'Please save it on a safe place.');
        }).catch(() => {
            this.toaster.onError('Clipboard didn\'t work!', 'Please try other way.');
        });
    }
    logout() {
        if (this.clearContacts) {
            localStorage.clear();
        }
        else {
            const arr = [];
            const bkpArr = [];
            for (let i = 0; i < localStorage.length; i++) {
                if (localStorage.key(i).startsWith('simpleos.contacts.') || localStorage.key(i) === 'simplEOS.lastBackupTime') {
                    bkpArr.push(localStorage.key(i));
                }
                else {
                    arr.push(localStorage.key(i));
                }
            }
            arr.forEach((k) => {
                localStorage.removeItem(k);
            });
        }
        localStorage.setItem('simplEOS.init', 'false');
        ConfigComponent_1.resetApp();
    }
    logoutByCahin() {
        const arr = [];
        for (let i = 0; i < localStorage.length; i++) {
            if (this.clearContacts && localStorage.key(i) === 'simpleos.contacts.' + this.aService.activeChain['id']) {
                arr.push(localStorage.key(i));
            }
            if (localStorage.key(i).endsWith('.' + this.aService.activeChain['id']) && localStorage.key(i) !== 'simpleos.contacts.' + this.aService.activeChain['id']) {
                if (this.clearContacts) {
                }
                arr.push(localStorage.key(i));
            }
        }
        arr.forEach((k) => {
            localStorage.removeItem(k);
        });
        localStorage.setItem('simplEOS.init', 'false');
        ConfigComponent_1.resetApp();
    }
    getChainConnected() {
        this.chainConnected = [];
        return (this.network.defaultChains.find(chain => chain.id === this.network.mainnetId));
    }
    changeChain(event) {
        return __awaiter(this, void 0, void 0, function* () {
            this.chain.setRawGithub();
            yield this.network.changeChain(event.value);
        });
    }
    selectEndpoint(data) {
        this.selectedEndpoint = data;
        this.confirmModal = true;
    }
    connectEndpoint() {
        return __awaiter(this, void 0, void 0, function* () {
            this.network.selectedEndpoint.next(this.selectedEndpoint);
            this.network.networkingReady.next(false);
            this.aService.lastAccount = this.aService.selected.getValue().name;
            this.busy = true;
            yield this.network.startup(null);
            this.busy = false;
            this.confirmModal = false;
        });
    }
    connectCustom(url) {
        return __awaiter(this, void 0, void 0, function* () {
            this.network.selectedEndpoint.next({ url: url, owner: 'Other', latency: 0, filters: [], chain: '' });
            this.network.networkingReady.next(false);
            this.aService.lastAccount = this.aService.selected.getValue().name;
            this.busy = true;
            yield this.network.startup(url);
            this.busy = false;
            this.endpointModal = false;
        });
    }
    changePass() {
        return __awaiter(this, void 0, void 0, function* () {
            this.wrongpass = false;
            if (this.passmatch) {
                const newpass = this.passForm.value.matchingPassword.pass2;
                const [publicKey] = this.aService.getStoredKey();
                const status = yield this.crypto.authenticate(this.passForm.value.oldpass, publicKey);
                if (status) {
                    if (status !== 'LEDGER') {
                        yield this.crypto.changePass(publicKey, newpass);
                    }
                    this.passForm.reset();
                    this.changePassModal = false;
                    this.toaster.onSuccess('Password changed!', '');
                }
                else {
                    this.passForm.get('oldpass').setValue('');
                    this.wrongpass = true;
                    this.toaster.onError('Wrong password', 'please try again!');
                }
            }
        });
    }
    passCompare() {
        if (this.passForm.value.matchingPassword.pass1 && this.passForm.value.matchingPassword.pass2) {
            if (this.passForm.value.matchingPassword.pass1 === this.passForm.value.matchingPassword.pass2) {
                this.passForm['controls'].matchingPassword['controls']['pass2'].setErrors(null);
                this.passmatch = true;
            }
            else {
                this.passForm['controls'].matchingPassword['controls']['pass2'].setErrors({ 'incorrect': true });
                this.passmatch = false;
            }
        }
    }
    clearPin() {
        this.crypto.removePIN();
        this.clearPinModal = false;
        this.toaster.onSuccess('Lockscreen PIN removed!', '');
    }
    setPIN() {
        if (this.pinForm.value.pin !== '') {
            if (localStorage.getItem('simpleos-hash')) {
                this.crypto.updatePIN(this.pinForm.value.pin);
            }
            else {
                this.crypto.createPIN(this.pinForm.value.pin);
            }
            this.toaster.onSuccess('New Lockscreen PIN defined!', '');
        }
        this.pinModal = false;
    }
    // select folder for backup export
    inputEXClick() {
        return __awaiter(this, void 0, void 0, function* () {
            let prefix = 'simpleos';
            if (this.compilerVersion === 'LIBERLAND') {
                prefix = 'liberland';
            }
            const filename = `${prefix}_${Date.now()}.bkp`;
            const exportFilePath = yield electron_1.ipcRenderer.invoke('read-export-dir', filename);
            if (exportFilePath) {
                this.exfile = exportFilePath;
            }
        });
    }
    // export data to backup file
    exportBK() {
        this.disableEx = true;
        this.busy = true;
        const pass = this.exportForm.get('pass').value;
        let rp = this.backup.createBackup();
        if (pass !== '') {
            rp = this.crypto.encryptBKP(rp, pass);
        }
        this.fs.writeFileSync(this.exfile, rp);
        this.busy = false;
        this.exfile = '';
        this.disableEx = false;
        this.exportBKModal = false;
        this.toaster.onSuccess('Backup exported!', '');
        this.backup.updateBackupTime();
        this.backup.getLastBackupTime();
    }
    // select backup file
    inputIMClick() {
        return __awaiter(this, void 0, void 0, function* () {
            const selected = yield electron_1.ipcRenderer.invoke('read-open-file');
            if (selected) {
                this.exfile = selected;
            }
        });
    }
    // import data from backup
    importBK() {
        this.disableIm = true;
        this.busy = true;
        let data = this.fs.readFileSync(this.infile);
        const pass = this.importForm.get('pass').value;
        try {
            if (pass !== '') {
                data = this.crypto.decryptBKP(data.toString(), pass);
            }
        }
        catch (e) {
            this.toaster.onSuccess('Wrong password, please try again!', '');
            this.busy = false;
            this.disableIm = false;
            return;
        }
        let parsedData;
        try {
            parsedData = JSON.parse(data);
        }
        catch (e) {
            if (pass === '') {
                this.toaster.onError('This backup file is encrypted, please provide a password!', '');
                this.busy = false;
                this.disableIm = false;
                return;
            }
            else {
                this.toaster.onError('Wrong password, please try again!', '');
                this.busy = false;
                this.disableIm = false;
                return;
            }
        }
        if (parsedData && parsedData.length > 0) {
            for (const entry of parsedData) {
                localStorage.setItem(entry.key, entry.value);
            }
            this.disableIm = false;
            this.busy = false;
            this.infile = '';
            this.importBKModal = false;
            this.toaster.onSuccess('Backup imported successfully', 'the wallet will restart...');
            setTimeout(() => {
                ConfigComponent_1.resetApp();
            }, 5000);
        }
        else {
            this.toaster.onError('Invalid backup file!', 'Please try again');
            this.infile = '';
            this.disableIm = false;
            this.busy = false;
        }
    }
    // opt in/out on the automatic backups
    toggleAutosave(event) {
        if (event.checked) {
            localStorage.setItem('simplEOS.autosave', 'true');
            this.backup.automatic = 'true';
            this.backup.startTimeout();
            this.toaster.onSuccess('Automatic backup enabled!', 'First backup will be saved in 10 seconds...');
        }
        else {
            localStorage.setItem('simplEOS.autosave', 'false');
            this.backup.automatic = 'false';
            this.toaster.onInfo('Automatic backup disabled!', '');
        }
    }
    // open modal to view the private for the selected account
    openPKModal() {
        this.selectedAccount = this.aService.selected.getValue().name;
        const [publicKey, permission] = this.aService.getStoredKey(this.aService.selected.getValue());
        if (permission === 'claim' || publicKey === '') {
            this.eosjs.rpc.get_account(this.selectedAccount).then((accData) => {
                const claim_key = accData.permissions.find(p => {
                    return p.perm_name === 'claim';
                });
                electron_1.ipcRenderer.invoke('keytar-getPassword', claim_key.required_auth.keys[0].key).then((result) => {
                    if (result !== '') {
                        this.claimPrivateKey = result;
                        this.claimKey = true;
                        this.viewPKModal = true;
                    }
                }).catch(console.log);
            });
        }
        else {
            this.claimKey = false;
            this.claimPrivateKey = '';
            this.viewPKModal = true;
        }
    }
    // close private key modal
    closePkModal() {
        this.showpk = false;
        this.tempPK = '';
        this.pkError = '';
        this.showpkForm.reset();
        if (this.timeoutpk) {
            this.timetoclose = this.pkExposureTime;
            clearInterval(this.timeoutpk);
        }
        if (this.timeoutviewpk) {
            clearTimeout(this.timeoutviewpk);
        }
    }
    // decode and temporarily display the private key for the selected account
    viewPK() {
        if (this.showpkForm.get('pass').value !== '') {
            const selAcc = this.aService.selected.getValue();
            const [publicKey] = this.aService.getStoredKey(selAcc);
            this.crypto.authenticate(this.showpkForm.get('pass').value, publicKey, true).then((result) => __awaiter(this, void 0, void 0, function* () {
                if (result) {
                    this.showpk = true;
                    this.pkError = '';
                    this.showpkForm.reset();
                    this.tempPK = result;
                    this.timeoutpk = setInterval(() => {
                        this.timetoclose -= 1;
                        if (this.timetoclose <= 0) {
                            this.timetoclose = this.pkExposureTime;
                            clearInterval(this.timeoutpk);
                        }
                    }, 1000);
                    this.timeoutviewpk = setTimeout(() => {
                        this.tempPK = '';
                        this.pkModal.close();
                        if (this.timeoutpk) {
                            this.timetoclose = this.pkExposureTime;
                            clearInterval(this.timeoutpk);
                        }
                    }, this.pkExposureTime * 1000);
                }
                else {
                    this.toaster.onError('Invalid password!', 'please try again');
                    this.pkError = 'Invalid password!';
                    if (this.timeoutviewpk) {
                        clearTimeout(this.timeoutviewpk);
                    }
                    console.log('WRONG PASS');
                }
            })).catch((err) => {
                this.toaster.onError('Invalid password!', 'please try again');
                this.pkError = 'Invalid password!';
                if (this.timeoutviewpk) {
                    clearTimeout(this.timeoutviewpk);
                }
                console.log('WRONG PASS', err);
            });
        }
    }
    // open key generation modal
    openKeyGenModal() {
        this.keygenModal.openModal();
    }
    // remove a single account
    removeAccount(name, refresh) {
        const rmIdx = this.aService.accounts.findIndex(a => a.name === name);
        this.aService.accounts.splice(rmIdx, 1);
        if (refresh) {
            this.toaster.onSuccess('Account Removed', `${name} removed`);
            this.aService.refreshFromChain(true).catch(console.log);
            this.populateAccounts();
            this.aService.select(0);
        }
    }
    // parse saved keystore
    getKeyStore() {
        const savedData = localStorage.getItem('eos_keys.' + this.aService.activeChain.id);
        if (savedData) {
            return JSON.parse(savedData);
        }
    }
    // update saved keystore
    saveKeyStore(keystore) {
        localStorage.setItem('eos_keys.' + this.aService.activeChain.id, JSON.stringify(keystore));
    }
    // remove a key from the key store with all the associated accounts
    removeKey(key) {
        // remove accounts
        const accountsToRemove = this.keysaccounts.get(key);
        for (const a of accountsToRemove) {
            this.removeAccount(a.account.name, false);
        }
        this.aService.select(0);
        // remove key
        const keystore = this.getKeyStore();
        if (keystore[key]) {
            delete keystore[key];
            this.toaster.onSuccess('Key removed', `<div class="dont-break-out">${key}</div> removed`);
        }
        else {
            console.log(`${key} not found`);
        }
        this.saveKeyStore(keystore);
        this.aService.storeAccountData(this.aService.accounts).catch(console.log);
        // refresh accounts
        this.aService.refreshFromChain(true).catch(console.log);
        this.populateAccounts();
    }
};
__decorate([
    (0, core_1.ViewChild)('customExportBK'),
    __metadata("design:type", core_1.ElementRef)
], ConfigComponent.prototype, "customExportBK", void 0);
__decorate([
    (0, core_1.ViewChild)('customImportBK'),
    __metadata("design:type", core_1.ElementRef)
], ConfigComponent.prototype, "customImportBK", void 0);
__decorate([
    (0, core_1.ViewChild)('pkModal'),
    __metadata("design:type", angular_1.ClrModal)
], ConfigComponent.prototype, "pkModal", void 0);
__decorate([
    (0, core_1.ViewChild)('managepkModal'),
    __metadata("design:type", angular_1.ClrModal)
], ConfigComponent.prototype, "managepkModal", void 0);
__decorate([
    (0, core_1.ViewChild)(keygen_modal_component_1.KeygenModalComponent),
    __metadata("design:type", keygen_modal_component_1.KeygenModalComponent)
], ConfigComponent.prototype, "keygenModal", void 0);
ConfigComponent = ConfigComponent_1 = __decorate([
    (0, core_1.Component)({
        selector: 'app-config',
        templateUrl: './config.component.html',
        styleUrls: ['./config.component.css']
    }),
    __metadata("design:paramtypes", [forms_1.FormBuilder,
        network_service_1.NetworkService,
        router_1.Router,
        crypto_service_1.CryptoService,
        accounts_service_1.AccountsService,
        notification_service_1.NotificationService,
        backup_service_1.BackupService,
        app_component_1.AppComponent,
        eosjs2_service_1.Eosjs2Service,
        chain_service_1.ChainService])
], ConfigComponent);
exports.ConfigComponent = ConfigComponent;
//# sourceMappingURL=config.component.js.map