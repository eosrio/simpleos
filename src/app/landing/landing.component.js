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
var LandingComponent_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LandingComponent = void 0;
const core_1 = require("@angular/core");
const forms_1 = require("@angular/forms");
const accounts_service_1 = require("../services/accounts.service");
const router_1 = require("@angular/router");
const angular_1 = require("@clr/angular");
const network_service_1 = require("../services/network.service");
const crypto_service_1 = require("../services/crypto/crypto.service");
const notification_service_1 = require("../services/notification.service");
const ram_service_1 = require("../services/ram.service");
const http_1 = require("@angular/common/http");
const voting_service_1 = require("../services/voting.service");
const app_component_1 = require("../app.component");
const theme_service_1 = require("../services/theme.service");
const rxjs_1 = require("rxjs");
const ledger_service_1 = require("../services/ledger/ledger.service");
const import_modal_component_1 = require("../import-modal/import-modal.component");
const eosjs2_service_1 = require("../services/eosio/eosjs2.service");
const enf_eosjs_1 = require("enf-eosjs");
const keygen_modal_component_1 = require("../keygen-modal/keygen-modal.component");
const PublicKey_1 = require("../helpers/PublicKey");
let LandingComponent = LandingComponent_1 = class LandingComponent {
    constructor(eosjs, ledgerService, voting, crypto, fb, aService, toaster, network, router, zone, ram, http, app, theme) {
        this.eosjs = eosjs;
        this.ledgerService = ledgerService;
        this.voting = voting;
        this.crypto = crypto;
        this.fb = fb;
        this.aService = aService;
        this.toaster = toaster;
        this.network = network;
        this.router = router;
        this.zone = zone;
        this.ram = ram;
        this.http = http;
        this.app = app;
        this.theme = theme;
        this.lottieConfig = {
            path: 'assets/logoanim.json',
            autoplay: false,
            loop: false,
            assetsPath: 'assets/images/'
        };
        this.importFromLedger = false;
        this.accountname = '';
        this.accountname_err = '';
        this.accountname_valid = false;
        this.ownerpk = '';
        this.ownerpk2 = '';
        this.ownerpub = '';
        this.ownerpub2 = '';
        this.activepk = '';
        this.activepub = '';
        this.newAccountPayload = '';
        this.agreeKeys = false;
        this.agreeKeys2 = false;
        this.generating = false;
        this.payloadValid = false;
        this.generated = false;
        this.generated2 = false;
        this.verifyPanel = false;
        this.openTX = LandingComponent_1.openTXID;
        this.openGit = LandingComponent_1.openGithub;
        this.openFaq = LandingComponent_1.openFAQ;
        this.busy2 = false;
        this.busyActivekey = false;
        this.relayMethod = false;
        this.requestValid = false;
        this.requestId = '';
        this.requestError = '';
        this.noPIN = true;
        this.subscriptions = [];
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
                pass1: ['', [forms_1.Validators.required, forms_1.Validators.minLength(4)]],
                pass2: ['', [forms_1.Validators.required, forms_1.Validators.minLength(4)]]
            })
        });
        this.passformexodus = this.fb.group({
            matchingPassword: this.fb.group({
                pass1: ['', [forms_1.Validators.required, forms_1.Validators.minLength(4)]],
                pass2: ['', [forms_1.Validators.required, forms_1.Validators.minLength(4)]]
            })
        });
        this.importForm = this.fb.group({
            pass: [''],
            customImportBK: ['', forms_1.Validators.required],
        });
        this.refundForm = this.fb.group({
            account: ['', forms_1.Validators.required],
            memo: ['', forms_1.Validators.required]
        });
    }
    static parseEOS(tk_string) {
        if (tk_string.split(' ')[1] === 'EOS') {
            return parseFloat(tk_string.split(' ')[0]);
        }
        else {
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
    ngOnDestroy() {
        this.subscriptions.forEach((s) => {
            s.unsubscribe();
        });
    }
    getCurrentEndpoint() {
        if (this.network.activeChain.name.startsWith('WAX')) {
            this.theme.waxTheme();
        }
        else if (this.network.activeChain.name.startsWith('TELOS')) {
            this.theme.telosTheme();
        }
        else if (this.network.activeChain.name.startsWith('LIBERLAND')) {
            this.theme.liberlandTheme();
        }
        else {
            this.theme.defaultTheme();
        }
        if (this.network.activeChain.lastNode !== '') {
            this.endpoint = this.network.activeChain.lastNode;
        }
        else {
            this.endpoint = this.network.activeChain.firstApi;
        }
    }
    parseSYMBOL(tk_string) {
        if (tk_string.split(' ')[1] === this.network.activeChain.symbol) {
            return parseFloat(tk_string.split(' ')[0]);
        }
        else {
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
    validateExchangeMemo(account, memo) {
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
            }
            else {
                return true;
            }
        }
        else {
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
                }
                else {
                    this.accountname_err = 'The account name must have exactly 12 characters. a-z, 1-5';
                }
            }
        }
        catch (e) {
            this.accountname_err = e.message;
        }
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
    makePayload() {
        if (PublicKey_1.PublicKey.fromString(this.ownerpub).isValid() && PublicKey_1.PublicKey.fromString(this.activepub).isValid()) {
            console.log('Generating account payload');
            this.newAccountPayload = btoa(JSON.stringify({
                n: this.accountname.toLowerCase(),
                o: this.ownerpub,
                a: this.activepub,
                t: new Date().getTime()
            }));
            this.payloadValid = true;
        }
        else {
            alert('Invalid public key!');
            this.newAccountPayload = 'Invalid public key! Please go back and fix it!';
            this.payloadValid = false;
            this.wizardnew.navService.previous();
        }
    }
    makeRelayRequest() {
        const reqData = {
            name: this.accountname.toLowerCase(),
            active: this.activepub,
            owner: this.ownerpub,
            refund_account: this.refundForm.get('account').value,
            refund_memo: this.refundForm.get('memo').value
        };
        if (this.validateExchangeMemo(reqData.refund_account, reqData.refund_memo)) {
            (0, rxjs_1.lastValueFrom)(this.http.post('https://br.eosrio.io/account_creation_api/request_account', reqData)).then((data) => {
                if (data.status === 'OK') {
                    this.requestId = data.requestId;
                    this.requestError = '';
                    this.requestValid = true;
                }
                else {
                    this.requestValid = false;
                    this.requestError = data.msg;
                }
            });
        }
        else {
            this.requestError = 'Invalid memo format';
            this.requestValid = false;
        }
    }
    makeMemo() {
        this.memo = this.accountname.toLowerCase() + '-' + this.ownerpub + '-' + this.activepub;
    }
    retryConn() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.network.connect(true);
        });
    }
    customConnect() {
        this.network.startup(this.endpoint).then(() => {
            this.endpointModal = false;
        }).catch(console.log);
    }
    handleAnimation(anim) {
        this.anim = anim;
        this.anim.setSpeed(0.8);
    }
    // Verify public key - step 1
    checkAccount() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.network.networkingReady.getValue()) {
                this.check = true;
                this.accounts = [];
                try {
                    const convertedKey = enf_eosjs_1.Numeric.convertLegacyPublicKey(this.publicEOS.trim());
                    const publicKey = PublicKey_1.PublicKey.fromString(convertedKey);
                    try {
                        const results = yield this.eosjs.loadPublicKey(publicKey);
                        console.log(results);
                        yield this.processCheckAccount(results.foundAccounts);
                    }
                    catch (err) {
                        console.log('ERROR', err.message);
                        console.log('ACCOUNTS', err.accounts);
                        this.checkerr = err;
                        yield this.processCheckAccount(err.accounts);
                    }
                }
                catch (e) {
                    console.log(e);
                    this.checkerr = 'invalid';
                }
                this.check = false;
            }
        });
    }
    // Verify public key - step 2
    processCheckAccount(accounts) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(accounts);
            for (const acc of accounts) {
                if (acc.tokens) {
                    this.processTokens(acc);
                }
                else {
                    try {
                        acc.tokens = yield this.eosjs.getTokens(acc.account_name);
                        this.processTokens(acc);
                    }
                    catch (err) {
                        console.log(err);
                    }
                }
            }
            this.checkerr = '';
        });
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
                }
                catch (e) {
                    // backup encrypted, password required
                    if (pass !== '') {
                        try {
                            decrypt = this.crypto.decryptBKP(data, pass);
                            arrLS = JSON.parse(decrypt);
                        }
                        catch (e) {
                            this.toaster.onError('Wrong password, please try again!', '');
                            console.log('wrong file');
                        }
                    }
                    else {
                        this.toaster.onError('This backup file is encrypted, please provide a password!', '');
                    }
                }
                if (arrLS) {
                    arrLS.forEach((d) => {
                        localStorage.setItem(d.key, d.value);
                    });
                    this.toaster.onSuccess('Imported with success!', 'Application will restart... wait for it!');
                    LandingComponent_1.resetApp();
                    this.choosedFil = '';
                    this.disableIm = false;
                    this.busy2 = false;
                    this.importBKP = false;
                }
                else {
                    this.choosedFil = '';
                    this.disableIm = false;
                    this.busy2 = false;
                }
            }
            catch (e) {
                this.toaster.onError('Something went wrong, please try again or contact our support!', '');
                console.log('wrong entry');
            }
        }
        else {
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
};
__decorate([
    (0, core_1.ViewChild)('ledgerwizard', { static: true }),
    __metadata("design:type", angular_1.ClrWizard)
], LandingComponent.prototype, "ledgerwizard", void 0);
__decorate([
    (0, core_1.ViewChild)('wizardnew', { static: true }),
    __metadata("design:type", angular_1.ClrWizard)
], LandingComponent.prototype, "wizardnew", void 0);
__decorate([
    (0, core_1.ViewChild)('customImportBK', { static: true }),
    __metadata("design:type", core_1.ElementRef)
], LandingComponent.prototype, "customImportBK", void 0);
__decorate([
    (0, core_1.ViewChild)(import_modal_component_1.ImportModalComponent),
    __metadata("design:type", import_modal_component_1.ImportModalComponent)
], LandingComponent.prototype, "importModal", void 0);
__decorate([
    (0, core_1.ViewChild)(keygen_modal_component_1.KeygenModalComponent),
    __metadata("design:type", keygen_modal_component_1.KeygenModalComponent)
], LandingComponent.prototype, "keygenModal", void 0);
LandingComponent = LandingComponent_1 = __decorate([
    (0, core_1.Component)({
        selector: 'app-landing',
        templateUrl: './landing.component.html',
        styleUrls: ['./landing.component.css']
    }),
    __metadata("design:paramtypes", [eosjs2_service_1.Eosjs2Service,
        ledger_service_1.LedgerService,
        voting_service_1.VotingService,
        crypto_service_1.CryptoService,
        forms_1.FormBuilder,
        accounts_service_1.AccountsService,
        notification_service_1.NotificationService,
        network_service_1.NetworkService,
        router_1.Router,
        core_1.NgZone,
        ram_service_1.RamService,
        http_1.HttpClient,
        app_component_1.AppComponent,
        theme_service_1.ThemeService])
], LandingComponent);
exports.LandingComponent = LandingComponent;
//# sourceMappingURL=landing.component.js.map