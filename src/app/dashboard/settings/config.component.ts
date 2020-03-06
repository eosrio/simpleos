import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {Router} from '@angular/router';
import {AccountsService} from '../../services/accounts.service';
import {NetworkService} from '../../services/network.service';
import {CryptoService} from '../../services/crypto/crypto.service';
import {BodyOutputType, Toast, ToasterConfig, ToasterService} from 'angular2-toaster';
import {ClrModal, ClrWizard} from '@clr/angular';
import {BackupService} from '../../services/backup.service';
import {AppComponent} from '../../app.component';
import {ElectronService} from 'ngx-electron';
import {Eosjs2Service} from '../../services/eosio/eosjs2.service';
import {ChainService} from '../../services/chain.service';

declare const window: any;

@Component({
    selector: 'app-config',
    templateUrl: './config.component.html',
    styleUrls: ['./config.component.css']
})
export class ConfigComponent implements OnInit {

    @ViewChild('customExportBK') customExportBK: ElementRef;
    @ViewChild('customImportBK') customImportBK: ElementRef;
    @ViewChild('pkModal') pkModal: ClrModal;
    @ViewChild('managepkModal') managepkModal: ClrModal;
    @ViewChild('wizardkeys', {static: true}) wizardkeys: ClrWizard;

    endpointModal: boolean;
    logoutModal: boolean;
    logoutChainModal: boolean;
    confirmModal: boolean;
    chainModal: boolean;
    pinModal: boolean;
    newKeys: boolean;
    managerKeys: boolean;
    clearPinModal: boolean;
    changePassModal: boolean;
    importBKModal: boolean;
    exportBKModal: boolean;
    viewPKModal: boolean;
    passForm: FormGroup;
    chainForm: FormGroup;
    pinForm: FormGroup;
    exportForm: FormGroup;
    importForm: FormGroup;
    showpkForm: FormGroup;
    passmatch: boolean;
    clearContacts: boolean;
    config: ToasterConfig;
    infile = '';
    exfile = '';
    disableEx: boolean;
    disableIm: boolean;
    chainConnected: any;
    busy = false;
    showpk: boolean;
    tempPK: any;

    pkExposureTime = 30;
    timetoclose = 0;
    timeoutpk = null;
    timeoutviewpk = null;
    pkError = '';

    selectedEndpoint = null;
    autoBackup = false;
    lastBackupTime: string;
    selectedAccount = '';

    claimKey = false;
    private keytar: any;
    claimPrivateKey = '';


    generating2 = false;
    ownerpk2 = '';
    ownerpub2 = '';
    generated2 = false;
    agreeKeys2 = false;

    keysaccounts: Map<string, any[]>;
    localKeys: string[] = [];
    private fs: any;
    wrongpass = false;

    static resetApp() {
        window.remote.app.relaunch();
        window.remote.app.exit(0);
    }

    constructor(private fb: FormBuilder,
                public network: NetworkService,
                private router: Router,
                private crypto: CryptoService,
                public aService: AccountsService,
                private toaster: ToasterService,
                private backup: BackupService,
                public app: AppComponent,
                private _electronService: ElectronService,
                public eosjs: Eosjs2Service,
                private chain: ChainService,
    ) {

        this.keytar = this._electronService.remote.require('keytar');

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
            oldpass: ['', [Validators.required, Validators.minLength(4)]],
            matchingPassword: this.fb.group({
                pass1: ['', [Validators.required, Validators.minLength(4)]],
                pass2: ['', [Validators.required, Validators.minLength(4)]]
            })
        });
        this.pinForm = this.fb.group({
            pin: ['', Validators.required],
        });
        this.exportForm = this.fb.group({
            pass: ['', Validators.required]
        });
        this.importForm = this.fb.group({
            pass: ['', Validators.required],
            customImportBK: ['', Validators.required],
        });
        this.chainForm = this.fb.group({
            pass: ['', Validators.required]
        });
        this.showpkForm = this.fb.group({
            pass: ['', Validators.required]
        });
        this.disableEx = false;
        this.disableIm = false;

        this.chainConnected = [];
        const lastbkp = localStorage.getItem('simplEOS.lastBackupTime');
        if (lastbkp === '' || lastbkp === null) {
            this.lastBackupTime = '';
        } else {
            this.lastBackupTime = (new Date(parseInt(lastbkp, 10))).toLocaleString();
        }

        this.keysaccounts = new Map();
        this.populateAccounts();
    }

    populateAccounts() {
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

    ngOnInit() {
        this.chainConnected = this.getChainConnected();
        this.autoBackup = this.backup.automatic === 'true';
    }

    cc(text) {
        window['navigator']['clipboard']['writeText'](text).then(() => {
            this.showToast('success', 'Key copied to clipboard!', 'Please save it on a safe place.');
        }).catch(() => {
            this.showToast('error', 'Clipboard didn\'t work!', 'Please try other way.');
        });
    }

    logout() {
        if (this.clearContacts) {
            localStorage.clear();
        } else {
            const arr = [];
            const bkpArr = [];
            for (let i = 0; i < localStorage.length; i++) {
                if (localStorage.key(i).startsWith('simpleos.contacts.') || localStorage.key(i) === 'simplEOS.lastBackupTime') {
                    bkpArr.push(localStorage.key(i));
                } else {
                    arr.push(localStorage.key(i));
                }
            }
            arr.forEach((k) => {
                localStorage.removeItem(k);
            });
        }
        localStorage.setItem('simplEOS.init', 'false');
        ConfigComponent.resetApp();
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
        ConfigComponent.resetApp();
    }

    getChainConnected() {
        this.chainConnected = [];
        return (this.network.defaultChains.find(chain => chain.id === this.network.mainnetId));
    }

    changeChain(event) {
        this.chain.setRawGithub();
        this.network.changeChain(event.value);
    }

    selectEndpoint(data) {
        this.selectedEndpoint = data;
        this.confirmModal = true;
    }

    async connectEndpoint() {
        this.network.selectedEndpoint.next(this.selectedEndpoint);
        this.network.networkingReady.next(false);
        this.aService.lastAccount = this.aService.selected.getValue().name;
        this.busy = true;
        await this.network.startup(null);
        this.busy = false;
        this.confirmModal = false;
    }

    async connectCustom(url) {
        this.network.selectedEndpoint.next({url: url, owner: 'Other', latency: 0, filters: [], chain: ''});
        this.network.networkingReady.next(false);
        this.aService.lastAccount = this.aService.selected.getValue().name;
        this.busy = true;
        await this.network.startup(url);
        this.busy = false;
        this.endpointModal = false;
    }

    async changePass() {
        this.wrongpass = false;
        if (this.passmatch) {
            const newpass = this.passForm.value.matchingPassword.pass2;
            const [publicKey] = this.aService.getStoredKey();
            const status = await this.crypto.authenticate(this.passForm.value.oldpass, publicKey);
            if (status) {
                if (status !== 'LEDGER') {
                    await this.crypto.changePass(publicKey, newpass);
                }
                this.passForm.reset();
                this.changePassModal = false;
            } else {
                this.passForm.get('oldpass').reset();
                this.wrongpass = true;
            }
        }
    }

    passCompare() {
        if (this.passForm.value.matchingPassword.pass1 && this.passForm.value.matchingPassword.pass2) {
            if (this.passForm.value.matchingPassword.pass1 === this.passForm.value.matchingPassword.pass2) {
                this.passForm['controls'].matchingPassword['controls']['pass2'].setErrors(null);
                this.passmatch = true;
            } else {
                this.passForm['controls'].matchingPassword['controls']['pass2'].setErrors({'incorrect': true});
                this.passmatch = false;
            }
        }
    }

    clearPin() {
        this.crypto.removePIN();
        this.clearPinModal = false;
        this.showToast('success', 'Lockscreen PIN removed!', '');
    }

    setPIN() {
        if (this.pinForm.value.pin !== '') {
            if (localStorage.getItem('simpleos-hash')) {
                this.crypto.updatePIN(this.pinForm.value.pin);
            } else {
                this.crypto.createPIN(this.pinForm.value.pin);
            }
            this.showToast('success', 'New Lockscreen PIN defined!', '');
        }
        this.pinModal = false;
    }

    // select folder for backup export
    async inputEXClick() {
        const prefix = 'simpleos';
        const filename = `${prefix}_${Date.now()}.bkp`;
        const dirs = await this._electronService.remote.dialog.showOpenDialog({
            properties: ['openDirectory']
        });
        if (dirs.filePaths.length > 0) {
            const nodePath = this._electronService.remote.require('path');
            this.exfile = nodePath.join(dirs.filePaths[0], filename);
        }
    }

    // export data to backup file
    exportBK() {
        this.disableEx = true;
        this.busy = true;
        const pass: string = this.exportForm.get('pass').value;
        let rp = this.backup.createBackup();
        if (pass !== '') {
            rp = this.crypto.encryptBKP(rp, pass);
        }
        this.fs.writeFileSync(this.exfile, rp);
        this.busy = false;
        this.exfile = '';
        this.disableEx = false;
        this.exportBKModal = false;
        this.showToast('success', 'Backup exported!', '');
    }

    // select backup file
    async inputIMClick() {
        const selected = await this._electronService.remote.dialog.showOpenDialog({
            properties: ['openFile']
        });
        if (selected.filePaths.length > 0) {
            this.infile = selected.filePaths[0];
        }
    }

    // import data from backup
    importBK() {
        this.disableIm = true;
        this.busy = true;
        let data = this.fs.readFileSync(this.infile);
        const pass = this.importForm.get('pass').value;

        if (pass !== '') {
            data = this.crypto.decryptBKP(data.toString(), pass);
        }

        let parsedData;
        try {
            parsedData = JSON.parse(data);
        } catch (e) {
            if (pass === '') {
                this.showToast('error', 'This backup file is encrypted, please provide a password!', '');
                this.busy = false;
                this.disableIm = false;
                return;
            } else {
                this.showToast('error', 'Wrong password, please try again!', '');
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
            this.showToast('success', 'Backup imported successfully', 'the wallet will restart...');
            setTimeout(() => {
                ConfigComponent.resetApp();
            }, 5000);
        } else {
            this.showToast('error', 'Invalid backup file!', 'Please try again');
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
            this.showToast('success', 'Automatic backup enabled!', 'First backup will be saved in 10 seconds...');
        } else {
            localStorage.setItem('simplEOS.autosave', 'false');
            this.backup.automatic = 'false';
            this.showToast('info', 'Automatic backup disabled!', '');
        }
    }

    // open modal to view the private for the selected account
    openPKModal() {
        this.selectedAccount = this.aService.selected.getValue().name;
        const [publicKey, permission] = this.aService.getStoredKey(this.aService.selected.getValue());
        console.log(publicKey, permission);
        if (permission === 'claim' || publicKey === '') {
            this.eosjs.rpc.get_account(this.selectedAccount).then((accData) => {
                const claim_key = accData.permissions.find(p => {
                    return p.perm_name === 'claim';
                });
                this.keytar.getPassword('simpleos', claim_key.required_auth.keys[0].key).then((result) => {
                    console.log(result);
                    if (result !== '') {
                        this.claimPrivateKey = result;
                        this.claimKey = true;
                        this.viewPKModal = true;
                    }
                });
            });
        } else {
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
            this.crypto.authenticate(this.showpkForm.get('pass').value, publicKey).then((result) => {
                if (result) {
                    this.showpk = true;
                    this.showpkForm.reset();
                    this.tempPK = this.eosjs.baseConfig.keyProvider;
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
            }).catch((err) => {
                this.showToast('error', 'Invalid password!', '');
                this.pkError = 'Invalid password!';
                if (this.timeoutviewpk) {
                    clearTimeout(this.timeoutviewpk);
                }
                console.log('WRONG PASS', err);
            });
        }
    }


    async generateNKeys() {
        this.generating2 = true;
        this.ownerpk2 = await this.eosjs.ecc.randomKey(64);
        this.ownerpub2 = this.eosjs.ecc.privateToPublic(this.ownerpk2);
        this.generating2 = false;
        this.generated2 = true;
    }

}
