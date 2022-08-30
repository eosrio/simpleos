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
exports.AppComponent = void 0;
const core_1 = require("@angular/core");
const forms_1 = require("@angular/forms");
const router_1 = require("@angular/router");
// @ts-ignore
const environment_1 = require("../environments/environment");
const network_service_1 = require("./services/network.service");
const accounts_service_1 = require("./services/accounts.service");
const crypto_service_1 = require("./services/crypto/crypto.service");
const connect_service_1 = require("./services/connect.service");
const backup_service_1 = require("./services/backup.service");
const rxjs_1 = require("rxjs");
const eosjs2_service_1 = require("./services/eosio/eosjs2.service");
const transaction_factory_service_1 = require("./services/eosio/transaction-factory.service");
const theme_service_1 = require("./services/theme.service");
const platform_browser_1 = require("@angular/platform-browser");
const ledger_service_1 = require("./services/ledger/ledger.service");
const notification_service_1 = require("./services/notification.service");
const http_1 = require("@angular/common/http");
const resource_service_1 = require("./services/resource.service");
// @ts-ignore
let AppComponent = class AppComponent {
    constructor(fb, network, ledger, aService, titleService, eosjs, crypto, connect, router, autobackup, trxFactory, zone, cdr, theme, toaster, http, resource) {
        this.fb = fb;
        this.network = network;
        this.ledger = ledger;
        this.aService = aService;
        this.titleService = titleService;
        this.eosjs = eosjs;
        this.crypto = crypto;
        this.connect = connect;
        this.router = router;
        this.autobackup = autobackup;
        this.trxFactory = trxFactory;
        this.zone = zone;
        this.cdr = cdr;
        this.theme = theme;
        this.toaster = toaster;
        this.http = http;
        this.resource = resource;
        this.maximized = false;
        this.wrongpass = '';
        this.txerror = '';
        this.transitconnect = false;
        this.externalActionModal = false;
        this.dapp_name = '';
        this.selectedAccount = new rxjs_1.BehaviorSubject('');
        this.dnSet = false;
        this.activeChain = null;
        this.version = environment_1.environment.VERSION;
        this.compilerVersion = environment_1.environment.COMPILERVERSION;
        this.updateauthWarning = false;
        this.transitMode = false;
        this.mode = 'local';
        this.resourceInfo = {
            needResources: false,
            relay: false,
            relayCredit: { used: 0, limit: 0 },
            borrow: 0.0,
            spend: 0.0,
            precision: 4,
            tk_name: 'EOS',
        };
        this.selectedAuth = 'active';
        this.useFreeTransaction = '0';
        this.useBorrowRex = '0';
        this.countLoopUse = 0;
        if (this.compilerVersion === 'LIBERLAND') {
            this.titleService.setTitle('Liberland Wallet v' + this.version);
            this.theme.liberlandTheme();
            if (!this.network.activeChain.name.startsWith('LIBERLAND')) {
                this.activeChain = this.network.defaultChains.find((chain) => chain.name === 'LIBERLAND TESTNET');
                localStorage.setItem('simplEOS.activeChainID', this.activeChain.id);
                this.network.changeChain(this.activeChain.id).catch(console.log);
            }
        }
        else {
            this.theme.defaultTheme();
            this.titleService.setTitle('SimplEOS Wallet v' + this.version);
        }
        this.confirmForm = this.fb.group({
            pass: ['', forms_1.Validators.required],
        });
        // wait 30 seconds for the first automatic backup
        this.autobackup.startTimeout();
        this.accSlots = [];
        this.selectedSlot = null;
        this.selectedSlotIndex = null;
        this.update = false;
        this.newVersion = null;
        this.aService.versionSys = this.version;
        this.ledgerOpen = false;
        this.loadingTRX = false;
        this.busy = false;
        this.ledger.startListener();
        this.startIPCListeners();
    }
    get requiredLedgerInfo() {
        return {
            device: this.crypto.requiredLedgerDevice,
            slot: this.crypto.requiredLedgerSlot
        };
    }
    ngOnInit() {
        this.connect.ipc.send('electron', 'request_os');
    }
    ngAfterViewInit() {
        const dnSavedValue = localStorage.getItem('use_light_theme');
        if (dnSavedValue && dnSavedValue === 'true') {
            this.dnSet = true;
            this.theme.lightMode = true;
            this.theme.lightTheme();
            this.cdr.detectChanges();
        }
        setTimeout(() => {
            this.network.connect(false).catch(console.log);
            setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                if (this.compilerVersion === 'DEFAULT') {
                    this.newVersion = yield this.eosjs.checkSimpleosUpdate();
                }
                else {
                    try {
                        const results = yield this.http.get('https://raw.githubusercontent.com/eosrio/simpleos/master/latest.json', {
                            headers: new http_1.HttpHeaders({
                                'Cache-Control': 'no-cache, no-store, must-revalidate, post-check=0, pre-check=0',
                                'Pragma': 'no-cache',
                                'Expires': '0'
                            })
                        }).toPromise();
                        if (results && results[this.compilerVersion]) {
                            this.newVersion = results[this.compilerVersion];
                        }
                    }
                    catch (e) {
                        console.log('Failed to check version in github');
                    }
                }
                if (this.newVersion) {
                    const remoteVersionNum = parseInt(this.newVersion['version_number'].replace(/[v.]/g, ''), 10);
                    const currentVersionNum = parseInt(this.version.replace(/[.]/g, ''), 10);
                    console.log(`Remote Version: ${remoteVersionNum}`);
                    console.log(`Local Version: ${currentVersionNum}`);
                    if (remoteVersionNum > currentVersionNum) {
                        this.update = true;
                    }
                }
            }), 5000);
        }, 500);
    }
    startIPCListeners() {
        if (this.connect.ipc) {
            // Bind electron events
            this.onElectron = this.onElectron.bind(this);
            this.connect.ipc.on('electron', this.onElectron);
            // Bind simpleos connect requests
            this.onSimpleosConnectMessage = this.onSimpleosConnectMessage.bind(this);
            this.connect.ipc.on('sc_request', this.onSimpleosConnectMessage);
            // Bind transit api requests
            this.onTransitApiMessage = this.onTransitApiMessage.bind(this);
            this.connect.ipc.on('request', this.onTransitApiMessage);
        }
    }
    onElectron(event, payload) {
        if (event) {
            switch (payload.event) {
                case 'platform_reply': {
                    console.log('Platform:', payload.content);
                    this.isMac = payload.content === 'darwin';
                    this.cdr.detectChanges();
                    break;
                }
                case 'isMaximized': {
                    this.maximized = payload.content;
                    this.cdr.detectChanges();
                    break;
                }
                default: {
                    console.log('UNHANDLED IPC EVENT!');
                    console.log(event, payload);
                }
            }
        }
    }
    onTransitApiMessage(event, payload) {
        this.transitEventHandler = event;
        switch (payload.message) {
            case 'launch': {
                console.log(payload);
                break;
            }
            case 'accounts': {
                event.sender.send('accountsResponse', this.aService.accounts.map(a => a.name));
                break;
            }
            case 'connect': {
                this.dapp_name = payload.content.appName;
                const result = this.changeChain(payload.content.chainId);
                event.sender.send('connectResponse', result);
                break;
            }
            case 'login': {
                if (localStorage.getItem('simpleos-hash') && this.crypto.getLockStatus()) {
                    this.eventFired = true;
                    this.transitEventHandler.sender.send('loginResponse', { status: 'CANCELLED' });
                    return;
                }
                const reqAccount = payload.content.account;
                if (reqAccount) {
                    const foundAccount = this.aService.accounts.find((a) => a.name === reqAccount);
                    if (foundAccount) {
                        this.selectedAccount.next(foundAccount);
                        event.sender.send('loginResponse', foundAccount);
                        break;
                    }
                    else {
                        console.log('Account not imported on wallet!');
                        event.sender.send('loginResponse', {});
                    }
                    return;
                }
                this.zone.run(() => {
                    this.isSimpleosConnect = false;
                    this.transitconnect = true;
                    this.eventFired = false;
                });
                if (!this.aService.accounts) {
                    console.log('No account found!');
                    event.sender.send('loginResponse', {});
                }
                if (this.aService.accounts.length > 0) {
                    this.accountChange = this.selectedAccount.subscribe((data) => {
                        if (data) {
                            event.sender.send('loginResponse', data);
                            this.accountChange.unsubscribe();
                            this.selectedAccount.next(null);
                        }
                    });
                }
                else {
                    console.log('No account found!');
                    event.sender.send('loginResponse', {});
                }
                break;
            }
            case 'logout': {
                const reqAccount = payload.content.account;
                console.log(reqAccount);
                this.dapp_name = null;
                event.sender.send('logoutResponse', {});
                break;
            }
            case 'disconnect': {
                this.dapp_name = null;
                event.sender.send('disconnectResponse', {});
                break;
            }
            case 'publicKeys': {
                const localKeys = JSON.parse(localStorage.getItem('eos_keys.' + this.eosjs.chainId));
                event.sender.send('publicKeyResponse', Object.keys(localKeys));
                break;
            }
            case 'sign': {
                this.transitMode = true;
                this.onTransitSign(event, payload).catch(console.log);
                break;
            }
            default: {
                console.log(payload);
            }
        }
    }
    onSimpleosConnectMessage(event, payload) {
        switch (payload.message) {
            case 'change_chain': {
                if (payload.chain_id !== this.network.activeChain.id) {
                    const result = this.changeChain(payload.chain_id);
                    // wait for chain to change
                    const onceListener = this.network.networkingReady.subscribe((value) => {
                        if (value) {
                            event.sender.send('changeChainResponse', result);
                            onceListener.unsubscribe();
                        }
                    });
                }
                else {
                    event.sender.send('changeChainResponse', true);
                }
                break;
            }
            case 'authorizations': {
                this.toaster.onInfo('wallet connection', 'external application requested public account info');
                this.transitconnect = true;
                this.isSimpleosConnect = true;
                if (this.aService.accounts.length > 0) {
                    this.accountChange = this.selectedAccount.subscribe((data) => {
                        if (data) {
                            event.sender.send('authorizationsResponse', data);
                            this.accountChange.unsubscribe();
                            this.selectedAccount.next(null);
                            this.transitconnect = false;
                        }
                    });
                }
                else {
                    console.log('No account found!');
                    event.sender.send('authorizationsResponse', {});
                }
                break;
            }
            case 'sign': {
                if (this.crypto.getLockStatus()) {
                    event.sender.send('signResponse', {
                        status: 'CANCELLED'
                    });
                }
                else {
                    this.simpleosConnectSign(event, payload).catch(console.log);
                }
                break;
            }
        }
    }
    changeChain(chainId) {
        if (this.network.defaultChains.find((chain) => chain.id === chainId)) {
            if (this.network.activeChain.id !== chainId) {
                this.network.changeChain(chainId).catch(console.log);
            }
            return true;
        }
        else {
            return false;
        }
    }
    onLoginModalClose(ev) {
        if (this.transitEventHandler && ev === false && this.eventFired === false) {
            this.eventFired = true;
            this.transitEventHandler.sender.send('loginResponse', { status: 'CANCELLED' });
        }
    }
    onSignModalClose(ev) {
        if (this.transitEventHandler && ev === false && this.eventFired === false) {
            this.eventFired = true;
            this.transitEventHandler.sender.send('signResponse', { status: 'CANCELLED' });
        }
        if (this.replyEvent && ev === false && this.eventFired === false) {
            this.eventFired = true;
            this.replyEvent.sender.send('signResponse', { status: 'CANCELLED' });
        }
    }
    toggleDayNight() {
        this.dnSet = !this.dnSet;
        if (this.dnSet) {
            localStorage.setItem('use_light_theme', 'true');
            this.theme.lightMode = true;
            this.theme.lightTheme();
        }
        else {
            localStorage.setItem('use_light_theme', 'false');
            this.theme.lightMode = false;
            if (this.compilerVersion === 'LIBERLAND') {
                this.theme.liberlandTheme();
            }
            else {
                this.theme.defaultTheme();
            }
        }
        this.cdr.detectChanges();
    }
    minimizeWindow() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Minimize...');
            yield this.connect.ipc.invoke('window-minimize');
        });
    }
    closeWindow() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Close...');
            yield this.connect.ipc.invoke('window-close');
        });
    }
    maximizeWindow() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Maximize...');
            yield this.connect.ipc.invoke('window-maximize');
        });
    }
    performUpdate() {
        if (this.compilerVersion === 'LIBERLAND') {
            if (this.newVersion['homepage']) {
                window['shell'].openExternal(this.newVersion['homepage']).catch(console.log);
            }
            else {
                this.openGithub();
            }
        }
        else {
            window['shell'].openExternal('https://eosrio.io/simpleos/').catch(console.log);
        }
    }
    openGithub() {
        window['shell'].openExternal(this.newVersion['link']).catch(console.log);
    }
    selectAccount(account_data, idx) {
        const [auth, key] = this.trxFactory.getAuth(account_data);
        let responseData;
        if (key !== '') {
            if (this.isSimpleosConnect) {
                responseData = {
                    actor: account_data.name,
                    permission: auth.permission,
                    key: key,
                };
            }
            else {
                responseData = {
                    accountName: account_data.name,
                    permission: auth.permission,
                    publicKey: key,
                };
                this.transitconnect = false;
            }
            this.selectedAccount.next(responseData);
            this.aService.select(idx);
            this.mode = this.crypto.getPrivateKeyMode(key);
            this.selectedAuth = responseData.permission;
            this.allAuth = this.trxFactory.getAllAuth();
        }
    }
    selectAuth([auth, publicKey]) {
        return __awaiter(this, void 0, void 0, function* () {
            this.mode = this.crypto.getPrivateKeyMode(publicKey);
            this.selectedAuth = auth.permission;
            let responseData;
            if (this.isSimpleosConnect) {
                responseData = {
                    actor: auth.actor,
                    permission: auth.permission,
                    key: publicKey,
                };
            }
            else {
                responseData = {
                    accountName: auth.actor,
                    permission: auth.permission,
                    publicKey: publicKey,
                };
            }
            this.fullTrxData.actions.forEach((act, idx) => {
                this.fullTrxData.actions[idx].authorization = [auth];
            });
            yield this.resourceInit([auth, publicKey]);
            this.selectedAccount.next(responseData);
        });
    }
    signResponse(data) {
        this.replyEvent.sender.send('signResponse', data);
    }
    resourceInit(authSelected) {
        return __awaiter(this, void 0, void 0, function* () {
            const [auth] = authSelected !== null && authSelected !== void 0 ? authSelected : this.trxFactory.getAuth();
            const response = yield this.resource.checkResource(auth, this.action_json, undefined, undefined, this.aService.activeChain['symbol']);
            this.resourceInfo = {
                needResources: response.needResources,
                relay: response.relay,
                relayCredit: response.relayCredit,
                borrow: response.borrow,
                spend: response.spend,
                precision: response.precision,
                tk_name: response.tk_name.toString(),
            };
            const result = yield this.resource.getActions(auth);
            this.resourceTransactionPayload = { actions: result };
            this.cdr.detectChanges();
        });
    }
    toggleHelp(e, isFree) {
        if (e.value !== undefined) {
            if (isFree) {
                this.useFreeTransaction = e.value;
                if (this.useFreeTransaction === '0' && this.resourceInfo['needResources'] && this.countLoopUse < 1) {
                    this.countLoopUse++;
                    this.useBorrowRex = '1';
                }
                else {
                    this.countLoopUse = 0;
                }
            }
            else {
                this.useBorrowRex = e.value;
                if (this.useBorrowRex === '0' && this.resourceInfo['relay'] && this.countLoopUse < 1) {
                    this.countLoopUse++;
                    this.useFreeTransaction = '1';
                }
                else {
                    this.countLoopUse = 0;
                }
            }
            this.cdr.detectChanges();
        }
    }
    transactionPayload() {
        let transactionPayload = { actions: [] };
        if (this.resourceInfo.needResources) {
            if (this.useBorrowRex === '1') {
                this.resourceTransactionPayload.actions.forEach(act => {
                    transactionPayload.actions.push(act);
                });
            }
        }
        this.fullTrxData.actions.forEach(act => {
            transactionPayload.actions.push(act);
        });
        return transactionPayload.actions;
    }
    signExternalAction() {
        return __awaiter(this, void 0, void 0, function* () {
            this.wrongpass = '';
            this.txerror = '';
            this.busy = true;
            let transactionPayload = { actions: [] };
            transactionPayload.actions = this.transactionPayload();
            if (this.mode === 'local') {
                console.log('signing in local mode');
                const account = this.aService.accounts.find(a => a.name === this.external_signer);
                const idx = this.aService.accounts.indexOf(account);
                this.aService.selected.next(account);
                // const [, publicKey] = this.trxFactory.getAuth();
                const publicKey = this.selectedAccount.getValue().publicKey;
                try {
                    yield this.crypto.authenticate(this.confirmForm.get('pass').value, publicKey);
                }
                catch (e) {
                    this.wrongpass = 'wrong password';
                    this.busy = false;
                    return;
                }
                let transactionPayload = { actions: [] };
                try {
                    transactionPayload.actions = this.transactionPayload();
                    console.log(transactionPayload, !this.transitMode);
                    const result = yield this.eosjs.signTrx(transactionPayload, !this.transitMode);
                    // console.log(result);
                    if (result) {
                        if (this.transitMode) {
                            this.signResponse({ sigs: result.packedTransaction.signatures });
                        }
                        else {
                            this.signResponse({
                                status: 'OK',
                                content: result.result,
                                packed: result.packedTransaction
                            });
                        }
                        this.wrongpass = '';
                        this.txerror = '';
                        this.busy = false;
                        this.externalActionModal = false;
                        this.aService.select(idx);
                        this.aService.reloadActions(account);
                        yield this.aService.refreshFromChain(false);
                        this.cdr.detectChanges();
                    }
                }
                catch (e) {
                    this.txerror = e;
                    console.log(e);
                    this.busy = false;
                }
            }
            else if (this.mode === 'ledger') {
                try {
                    let result;
                    if (this.resourceInfo['relay'] && this.useFreeTransaction === '1') {
                        const signed = yield this.ledger.sign(transactionPayload, this.crypto.requiredLedgerSlot, this.network.selectedEndpoint.getValue().url, true);
                        if (!signed) {
                            return [null, 'Wrong password!'];
                        }
                        result = yield this.resource.sendTxRelay(signed);
                        if (!result.ok) {
                            const e = result.error.error;
                            this.signResponse({
                                status: 'ERROR',
                                reason: e
                            });
                            this.txerror = e.toString();
                            console.log(e);
                            this.busy = false;
                        }
                    }
                    else {
                        result = yield this.ledger.sign(transactionPayload, this.crypto.requiredLedgerSlot, this.network.selectedEndpoint.getValue().url, false);
                    }
                    if (result) {
                        console.log(result);
                        this.signResponse({
                            status: 'OK',
                            content: result.result,
                            packed: result.packedTransaction
                        });
                        this.wrongpass = '';
                        this.txerror = '';
                        this.busy = false;
                        this.externalActionModal = false;
                        this.cdr.detectChanges();
                    }
                }
                catch (e) {
                    this.signResponse({
                        status: 'ERROR',
                        reason: e
                    });
                    this.txerror = e;
                    console.log(e);
                    this.busy = false;
                }
            }
        });
    }
    processSigners() {
        let signer = '';
        for (const action of this.fullTrxData.actions) {
            if (action.account === 'eosio' && action.name === 'updateauth') {
                this.updateauthWarning = true;
            }
            if (signer === '') {
                signer = action.authorization[0].actor;
            }
            else {
                if (signer !== action.authorization[0].actor) {
                    console.log('Multiple signers!!!');
                }
            }
        }
        this.external_signer = signer;
    }
    onTransitSign(event, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.crypto.getLockStatus()) {
                return;
            }
            this.loadingTRX = true;
            const hexData = payload.content.hex_data;
            try {
                const data = yield this.eosjs.localSigProvider.processTrx(hexData);
                this.fullTrxData = data;
                this.updateauthWarning = false;
                this.confirmForm.reset();
                this.processSigners();
                this.action_json = data.actions;
                yield this.resourceInit();
                if (this.resourceInfo["relay"]) {
                    this.useFreeTransaction = '1';
                    this.useBorrowRex = '0';
                }
                else {
                    this.useBorrowRex = '1';
                }
                this.zone.run(() => {
                    this.loadingTRX = false;
                    this.externalActionModal = true;
                    this.eventFired = false;
                });
                this.replyEvent = event;
            }
            catch (e) {
                console.log(e);
                this.loadingTRX = false;
            }
        });
    }
    simpleosConnectSign(event, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            this.fullTrxData = payload.content;
            this.loadingTRX = true;
            try {
                this.updateauthWarning = false;
                this.confirmForm.reset();
                this.processSigners();
                this.extendActionJson();
                this.checkSignerMode();
                // assign reply event
                this.replyEvent = event;
                this.zone.run(() => {
                    this.wrongpass = '';
                    this.loadingTRX = false;
                    this.externalActionModal = true;
                    this.eventFired = false;
                });
            }
            catch (e) {
                console.log(e);
                this.loadingTRX = false;
            }
        });
    }
    checkSignerMode() {
        const account = this.aService.accounts.find(a => a.name === this.external_signer);
        const [, publicKey] = this.trxFactory.getAuth(account);
        this.mode = this.crypto.getPrivateKeyMode(publicKey);
    }
    extendActionJson() {
        // deep clone transaction data for display
        this.action_json = JSON.parse(JSON.stringify(this.fullTrxData.actions));
        for (const act of this.action_json) {
            if (act.data) {
                for (const k in act.data) {
                    if (act.data.hasOwnProperty(k)) {
                        try {
                            act.data[k] = JSON.parse(act.data[k]);
                        }
                        catch (e) {
                        }
                    }
                }
            }
        }
    }
};
AppComponent = __decorate([
    (0, core_1.Component)({
        selector: 'app-root',
        templateUrl: './app.component.html',
        styleUrls: ['./app.component.css'],
    }),
    __metadata("design:paramtypes", [forms_1.FormBuilder,
        network_service_1.NetworkService,
        ledger_service_1.LedgerService,
        accounts_service_1.AccountsService,
        platform_browser_1.Title,
        eosjs2_service_1.Eosjs2Service,
        crypto_service_1.CryptoService,
        connect_service_1.ConnectService,
        router_1.Router,
        backup_service_1.BackupService,
        transaction_factory_service_1.TransactionFactoryService,
        core_1.NgZone,
        core_1.ChangeDetectorRef,
        theme_service_1.ThemeService,
        notification_service_1.NotificationService,
        http_1.HttpClient,
        resource_service_1.ResourceService])
], AppComponent);
exports.AppComponent = AppComponent;
//# sourceMappingURL=app.component.js.map