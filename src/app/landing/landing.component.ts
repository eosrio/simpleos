import {Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {AccountsService} from '../services/accounts.service';
import {Router} from '@angular/router';
import {ClrWizard} from '@clr/angular';
import {NetworkService} from '../services/network.service';
import {CryptoService} from '../services/crypto/crypto.service';
import {NotificationService} from '../services/notification.service';
import {RamService} from '../services/ram.service';
import {HttpClient} from '@angular/common/http';
import {VotingService} from '../services/voting.service';
import {AppComponent} from '../app.component';
import {ThemeService} from '../services/theme.service';
import {lastValueFrom, Subscription} from 'rxjs';
import {LedgerService} from '../services/ledger/ledger.service';
import {AnimationOptions} from 'ngx-lottie';
import {AnimationItem} from 'lottie-web';
import {ImportModalComponent} from '../import-modal/import-modal.component';
import {Eosjs2Service} from '../services/eosio/eosjs2.service';
import {Numeric} from 'enf-eosjs';
import {KeygenModalComponent} from '../keygen-modal/keygen-modal.component';
import {PublicKey} from '../helpers/PublicKey';

interface simpleosExtendedWindow {
    filesystem: any;
    shell: any;
    remote: any;
}

declare var window: Window & (typeof globalThis) & simpleosExtendedWindow;

interface SimpleAccData {
    name: string;
    fullBalance: number;
}

@Component({
    selector: 'app-landing',
    templateUrl: './landing.component.html',
    styleUrls: ['./landing.component.css']
})
export class LandingComponent implements OnInit, OnDestroy {

    @ViewChild('ledgerwizard', {static: true}) ledgerwizard: ClrWizard;
    @ViewChild('wizardnew', {static: true}) wizardnew: ClrWizard;
    @ViewChild('customImportBK', {static: true}) customImportBK: ElementRef;

    @ViewChild(ImportModalComponent)
    private importModal: ImportModalComponent;

    @ViewChild(KeygenModalComponent)
    private keygenModal: KeygenModalComponent;

    lottieConfig: AnimationOptions = {
        path: 'assets/logoanim.json',
        autoplay: false,
        loop: false,
        assetsPath: 'assets/images/'
    };

    anim: AnimationItem;
    busy: boolean;

    importFromLedger = false;
    existingWallet: boolean;
    exodusWallet: boolean;
    newWallet: boolean;
    newKeys: boolean;
    importBKP: boolean;
    endpointModal: boolean;

    accountname = '';
    accountname_err = '';
    accountname_valid = false;
    ownerpk = '';
    ownerpk2 = '';
    ownerpub = '';
    ownerpub2 = '';
    activepk = '';
    activepub = '';
    newAccountPayload = '';
    agreeKeys = false;
    agreeKeys2 = false;
    check: boolean;
    publicEOS: string;
    checkerr: string;
    errormsg: string;
    accounts: SimpleAccData[];
    dropReady: boolean;
    passmatch: boolean;
    passexodusmatch: boolean;
    agree: boolean;
    agree2: boolean;
    generating = false;

    passform: FormGroup;
    passformexodus: FormGroup;
    importForm: FormGroup;
    refundForm: FormGroup;

    pk: string;
    publickey: string;
    pin: string;
    lockscreen: boolean;
    lockscreen2: boolean;
    importedAccounts: any[];
    endpoint: string;
    payloadValid = false;
    generated = false;
    generated2 = false;
    verifyPanel = false;
    choosedFil: string;
    disableIm: boolean;
    infile: any;
    total_amount: number;
    memo: string;

    openTX = LandingComponent.openTXID;
    openGit = LandingComponent.openGithub;
    openFaq = LandingComponent.openFAQ;

    busy2 = false;
    busyActivekey = false;

    relayMethod = false;
    requestValid = false;
    requestId = '';
    requestError = '';
    noPIN = true;
    private subscriptions: Subscription[] = [];

    static parseEOS(tk_string) {
        if (tk_string.split(' ')[1] === 'EOS') {
            return parseFloat(tk_string.split(' ')[0]);
        } else {
            return 0;
        }
    }

    static openTXID(value) {
        window.shell.openExternal('https://www.bloks.io/account/' + value);
    }

    static openGithub() {
        window.shell.openExternal('https://github.com/eosrio/eosriosignup');
    }

    static openFAQ() {
        window.shell.openExternal('https://github.com/eosrio/eosriosignup');
    }

    static resetApp() {
        if (window.remote) {
            window.remote.app.relaunch();
            window.remote.app.exit(0);
        }
    }

    constructor(
        public eosjs: Eosjs2Service,
        public ledgerService: LedgerService,
        private voting: VotingService,
        private crypto: CryptoService,
        private fb: FormBuilder,
        public aService: AccountsService,
        private toaster: NotificationService,
        public network: NetworkService,
        private router: Router,
        private zone: NgZone,
        public ram: RamService,
        private http: HttpClient,
        public app: AppComponent,
        private theme: ThemeService
    ) {
        this.busy = true;
        this.existingWallet = false;
        this.exodusWallet = false;
        this.dropReady = false;
        this.newWallet = false;
        this.check = false;
        this.passmatch = true;
        this.passexodusmatch = true;
        this.agree = false;
        this.agree2 = false;
        this.lockscreen = false;
        this.lockscreen2 = false;
        this.importBKP = false;
        this.endpointModal = false;
        this.disableIm = false;
        this.accounts = [];
        this.importedAccounts = [];
        this.checkerr = '';
        this.errormsg = '';
        this.endpoint = '';
        this.total_amount = 1;
        this.memo = '';
        this.busyActivekey = false;
        this.network.networkingReady.asObservable().subscribe((status) => {
            this.busy = !status;
        });
        this.publicEOS = '';

        this.passform = this.fb.group({
            matchingPassword: this.fb.group({
                pass1: ['', [Validators.required, Validators.minLength(4)]],
                pass2: ['', [Validators.required, Validators.minLength(4)]]
            })
        });

        this.passformexodus = this.fb.group({
            matchingPassword: this.fb.group({
                pass1: ['', [Validators.required, Validators.minLength(4)]],
                pass2: ['', [Validators.required, Validators.minLength(4)]]
            })
        });

        this.importForm = this.fb.group({
            pass: [''],
            customImportBK: ['', Validators.required],
        });

        this.refundForm = this.fb.group({
            account: ['', Validators.required],
            memo: ['', Validators.required]
        });
    }

    cc(text, title, body) {
        window.navigator.clipboard.writeText(text).then(() => {
            this.toaster.onSuccess(title + ' copied to clipboard!', body);
        }).catch(() => {
            this.toaster.onError('Clipboard didn\'t work!', 'Please try other way.');
        });
    }

    checkLedgerReady() {
        if (this.ledgerService.appReady) {
            this.ledgerwizard.next();
        }
    }

    checkPIN() {
        this.noPIN = localStorage.getItem('simpleos-hash') === null;
    }

    resetAndClose() {
        this.wizardnew.reset();
        this.wizardnew.close();
    }

    ngOnInit() {
        console.log('loaded landing');
        this.getCurrentEndpoint();
        if (this.app.compilerVersion === 'DEFAULT') {
            setTimeout(() => this.anim.pause(), 10);
            setTimeout(() => this.anim.play(), 900);
        }
        this.checkPIN();
        if (this.ledgerService.appReady) {
            this.importFromLedger = true;
        }
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach((s) => {
            s.unsubscribe();
        });
    }

    getCurrentEndpoint() {

        if (this.network.activeChain.name.startsWith('WAX')) {
            this.theme.waxTheme();
        } else if (this.network.activeChain.name.startsWith('TELOS')) {
            this.theme.telosTheme();
        } else if (this.network.activeChain.name.startsWith('LIBERLAND')) {
            this.theme.liberlandTheme();
        } else {
            this.theme.defaultTheme();
        }

        if (this.network.activeChain.lastNode !== '') {
            this.endpoint = this.network.activeChain.lastNode;
        } else {
            this.endpoint = this.network.activeChain.firstApi;
        }
    }

    parseSYMBOL(tk_string) {
        if (tk_string.split(' ')[1] === this.network.activeChain.symbol) {
            return parseFloat(tk_string.split(' ')[0]);
        } else {
            return 0;
        }
    }

    changeChain(event) {
        this.importModal.reset();
        this.network.changeChain(event.value);
        this.getCurrentEndpoint();
    }

    setEndPoint(ep) {
        console.log('ENDPOINT >>> ', ep, this.endpoint);
        if (ep !== this.endpoint) {
            this.endpoint = ep;
            this.customConnect();
            // 	this.endpointModal = false;
        }
    }

    validateExchangeMemo(account: string, memo: string) {
        if (this.network.activeChain.exchanges) {
            if (this.network.activeChain.exchanges[account]) {
                const ex = this.network.activeChain.exchanges[account];

                // check memo size
                if (ex.memo_size) {
                    if (memo.length !== ex.memo_size) {
                        return false;
                    }
                }

                // check memo pattern
                if (ex.pattern) {
                    const regex = new RegExp(ex.pattern);
                    return regex.test(memo);
                }

                return true;

            } else {
                return true;
            }
        } else {
            return true;
        }
    }

    verifyAccountName(next) {
        try {
            this.accountname_valid = false;
            const res = this.eosjs.checkAccountName(this.accountname.toLowerCase());
            const regexName = new RegExp('^([a-z]|[1-5])+$');
            if (res !== 0) {
                if (this.accountname.length === 12 && regexName.test(this.accountname.toLowerCase())) {
                    this.eosjs.getAccountInfo(this.accountname.toLowerCase()).then(() => {
                        // this.eos['getAccount'](this.accountname, (err, data) => {
                        //   console.log(err, data);
                        this.accountname_err = 'This account name is not available. Please try another.';
                        this.accountname_valid = false;
                    }).catch(() => {
                        this.accountname_valid = true;
                        this.accountname_err = '';
                        if (next) {
                            this.wizardnew.next();
                        }
                    });
                } else {
                    this.accountname_err = 'The account name must have exactly 12 characters. a-z, 1-5';
                }
            }
        } catch (e) {
            this.accountname_err = e.message;
        }
    }

    async generateKeys() {
        this.generating = true;
        const activePair = await this.crypto.generateKeyPair();
        const ownerPair = await this.crypto.generateKeyPair();
        this.ownerpk = ownerPair.private;
        this.ownerpub = ownerPair.public;
        this.activepk = activePair.private;
        this.activepub = activePair.public;
        this.generating = false;
        this.generated = true;
    }

    makePayload() {
        if (PublicKey.fromString(this.ownerpub).isValid() && PublicKey.fromString(this.activepub).isValid()) {
            console.log('Generating account payload');
            this.newAccountPayload = btoa(JSON.stringify({
                n: this.accountname.toLowerCase(),
                o: this.ownerpub,
                a: this.activepub,
                t: new Date().getTime()
            }));
            this.payloadValid = true;
        } else {
            alert('Invalid public key!');
            this.newAccountPayload = 'Invalid public key! Please go back and fix it!';
            this.payloadValid = false;
            this.wizardnew.navService.previous();
        }
    }

    makeRelayRequest(): void {
        const reqData = {
            name: this.accountname.toLowerCase(),
            active: this.activepub,
            owner: this.ownerpub,
            refund_account: this.refundForm.get('account').value,
            refund_memo: this.refundForm.get('memo').value
        };
        if (this.validateExchangeMemo(reqData.refund_account, reqData.refund_memo)) {
            lastValueFrom(this.http.post('https://br.eosrio.io/account_creation_api/request_account', reqData)).then((data: any) => {
                if (data.status === 'OK') {
                    this.requestId = data.requestId;
                    this.requestError = '';
                    this.requestValid = true;
                } else {
                    this.requestValid = false;
                    this.requestError = data.msg;
                }
            });
        } else {
            this.requestError = 'Invalid memo format';
            this.requestValid = false;
        }
    }

    makeMemo(): void {
        this.memo = this.accountname.toLowerCase() + '-' + this.ownerpub + '-' + this.activepub;
    }

    async retryConn() {
        await this.network.connect(true);
    }

    customConnect() {
        this.network.startup(this.endpoint).then(() => {
            this.endpointModal = false;
        }).catch(console.log);
    }

    handleAnimation(anim: AnimationItem) {
        this.anim = anim;
        this.anim.setSpeed(0.8);
    }

    // Verify public key - step 1
    async checkAccount() {
        if (this.network.networkingReady.getValue()) {
            this.check = true;
            this.accounts = [];
            try {
                const convertedKey = Numeric.convertLegacyPublicKey(this.publicEOS.trim());
                const publicKey = PublicKey.fromString(convertedKey);
                try {
                    const results = await this.eosjs.loadPublicKey(publicKey);
                    console.log(results);
                    await this.processCheckAccount(results.foundAccounts);
                } catch (err) {
                    console.log('ERROR', err.message);
                    console.log('ACCOUNTS', err.accounts);
                    this.checkerr = err;
                    await this.processCheckAccount(err.accounts);
                }
            } catch (e) {
                console.log(e);
                this.checkerr = 'invalid';
            }
            this.check = false;
        }
    }

    // Verify public key - step 2
    async processCheckAccount(accounts) {
        console.log(accounts);
        for (const acc of accounts) {
            if (acc.tokens) {
                this.processTokens(acc);
            } else {
                try {
                    acc.tokens = await this.eosjs.getTokens(acc.account_name);
                    this.processTokens(acc);
                } catch (err) {
                    console.log(err);
                }
            }
        }
        this.checkerr = '';
    }

    // Verify public key - step 3
    processTokens(acc) {
        let balance = 0;
        acc.tokens.forEach((tk) => {
            balance += this.parseSYMBOL(tk);
        });
        if (acc.self_delegated_bandwidth) {
            balance += this.parseSYMBOL(acc.self_delegated_bandwidth.cpu_weight);
            balance += this.parseSYMBOL(acc.self_delegated_bandwidth.net_weight);
        }
        const precisionRound = Math.pow(10, this.aService.activeChain.precision);
        if (this.aService.activeChain.name.startsWith('LIBERLAND')) {
            const staked = acc.voter_info.staked / precisionRound;
            balance += staked;
        }
        const accData = {
            name: acc.account_name,
            fullBalance: Math.round((balance) * precisionRound) / precisionRound
        };
        this.accounts.push(accData);
    }

    inputIMClick() {
        this.customImportBK.nativeElement.click();
    }

    importCheckBK(a) {
        this.infile = a.target.files[0];
        // console.log(this.infile);
        const name = this.infile.name;
        if (name.split('.')[1] !== 'bkp') {
            this.toaster.onError('Wrong file!', '');
            this.infile = '';
            return false;
        }
        this.choosedFil = name;
        console.log(this.choosedFil);
    }

    importBK() {
        this.disableIm = true;
        this.busy2 = true;
        if (this.infile && this.infile !== '') {
            try {
                const data = window.filesystem.readFileSync(this.infile.path, 'utf-8');
                const pass = this.importForm.value.pass;
                let arrLS = null;
                let decrypt = null;

                try {
                    console.log('trying to parse json...');
                    arrLS = JSON.parse(data);
                } catch (e) {
                    // backup encrypted, password required
                    if (pass !== '') {
                        try {
                            decrypt = this.crypto.decryptBKP(data, pass);
                            arrLS = JSON.parse(decrypt);
                        } catch (e) {
                            this.toaster.onError('Wrong password, please try again!', '');
                            console.log('wrong file');
                        }
                    } else {
                        this.toaster.onError('This backup file is encrypted, please provide a password!', '');
                    }
                }
                if (arrLS) {
                    arrLS.forEach((d) => {
                        localStorage.setItem(d.key, d.value);
                    });
                    this.toaster.onSuccess('Imported with success!', 'Application will restart... wait for it!');
                    LandingComponent.resetApp();
                    this.choosedFil = '';
                    this.disableIm = false;
                    this.busy2 = false;
                    this.importBKP = false;
                } else {
                    this.choosedFil = '';
                    this.disableIm = false;
                    this.busy2 = false;
                }
            } catch (e) {
                this.toaster.onError('Something went wrong, please try again or contact our support!', '');
                console.log('wrong entry');
            }
        } else {
            this.toaster.onError('Choose your backup file', '');
            this.choosedFil = '';
            this.disableIm = false;
            this.busy2 = false;
        }
    }

    toggleAnimation() {
        if (this.anim) {
            const duration = this.anim.getDuration(true);
            this.anim.goToAndPlay(Math.round(duration / 3), true);
        }
    }

    openImportModal() {
        this.importModal.openModal();
    }

    openKeyGenModal() {
        this.keygenModal.openModal();
    }
}
