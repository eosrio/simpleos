import {AfterViewInit, ChangeDetectorRef, Component, NgZone, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {Router} from '@angular/router';
import {environment} from '../environments/environment';

import {NetworkService} from './services/network.service';
import {AccountsService} from './services/accounts.service';
import {CryptoService} from './services/crypto/crypto.service';
import {ConnectService} from './services/connect.service';
import {BackupService} from './services/backup.service';
import {BehaviorSubject, Subscription} from 'rxjs';
import {Eosjs2Service} from './services/eosio/eosjs2.service';
import {TransactionFactoryService} from './services/eosio/transaction-factory.service';
import {ElectronService} from 'ngx-electron';
import {ThemeService} from './services/theme.service';
import {Title} from '@angular/platform-browser';
import {LedgerService} from './services/ledger/ledger.service';
import {BodyOutputType, Toast, ToasterService} from 'angular2-toaster';
import {EOSAccount} from "./interfaces/account";
import {HttpClient, HttpHeaders} from "@angular/common/http";

export interface LedgerSlot {
    publicKey: string;
    account: string;
}

// @ts-ignore
@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit, AfterViewInit {

    confirmForm: FormGroup;
    wrongpass = '';
    txerror = '';
    transitconnect = false;
    externalActionModal = false;
    dapp_name = '';
    selectedAccount = new BehaviorSubject<any>('');
    accountChange: Subscription;
    ledgerOpen: boolean;
    update: boolean;
    busy: boolean;
    action_json: any[];
    accSlots: LedgerSlot[];
    selectedSlot: LedgerSlot;
    selectedSlotIndex: number;
    dnSet = false;
    activeChain = null;

    public version = environment.VERSION;
    public compilerVersion = environment.COMPILERVERSION;

    updateauthWarning = false;
    public newVersion: any;
    public external_signer: string;
    private fullTrxData: any;
    private replyEvent: any;

    public isMac: boolean;

    public transitEventHandler: any;
    private eventFired: boolean;
    public loadingTRX: boolean;
    private transitMode = false;
    private isSimpleosConnect: boolean;

    constructor(
        private fb: FormBuilder,
        public network: NetworkService,
        public ledger: LedgerService,
        public aService: AccountsService,
        private titleService: Title,
        private eosjs: Eosjs2Service,
        private crypto: CryptoService,
        private connect: ConnectService,
        private router: Router,
        private autobackup: BackupService,
        private trxFactory: TransactionFactoryService,
        private zone: NgZone,
        private cdr: ChangeDetectorRef,
        private _electronService: ElectronService,
        public theme: ThemeService,
        private toaster: ToasterService,
        private http: HttpClient
    ) {

        if (this.compilerVersion === 'LIBERLAND') {
            this.titleService.setTitle('Liberland Wallet v' + this.version);
            this.theme.liberlandTheme();

            if (!this.network.activeChain.name.startsWith('LIBERLAND')) {
                this.activeChain = this.network.defaultChains.find((chain) => chain.name === 'LIBERLAND TESTNET');
                localStorage.setItem('simplEOS.activeChainID', this.activeChain.id);
                this.network.changeChain(this.activeChain.id);
            }

        } else {
            this.theme.defaultTheme();
            this.titleService.setTitle('SimplEOS Wallet v' + this.version);
        }

        this.confirmForm = this.fb.group({
            pass: ['', Validators.required],
        });

        // wait 30 seconds to automatic backup
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

    ngOnInit(): void {
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

            setTimeout(async () => {
                if (this.compilerVersion === 'DEFAULT') {
                    this.newVersion = await this.eosjs.checkSimpleosUpdate();
                } else {
                    const results = await this.http.get('https://raw.githubusercontent.com/eosrio/simpleos/master/latest.json', {
                        headers: new HttpHeaders({
                            'Cache-Control': 'no-cache, no-store, must-revalidate, post-check=0, pre-check=0',
                            'Pragma': 'no-cache',
                            'Expires': '0'
                        })
                    }).toPromise();
                    if (results && results[this.compilerVersion]) {
                        this.newVersion = results[this.compilerVersion];
                    }
                }
                if (this.newVersion) {
                    const remoteVersionNum = parseInt(this.newVersion['version_number'].replace(/[v.]/g, ''));
                    const currentVersionNum = parseInt(this.version.replace(/[.]/g, ''));
                    console.log(`Remote Version: ${remoteVersionNum}`);
                    console.log(`Local Version: ${currentVersionNum}`);
                    if (remoteVersionNum > currentVersionNum) {
                        this.update = true;
                    }
                }
            }, 5000);

        }, 500);
    }

    startIPCListeners() {
        if (this.connect.ipc) {

            // Bind simpleos connect requests
            this.onSimpleosConnectMessage = this.onSimpleosConnectMessage.bind(this);
            this.connect.ipc.on('sc_request', this.onSimpleosConnectMessage);

            // Bind transit api requests
            this.onTransitApiMessage = this.onTransitApiMessage.bind(this);
            this.connect.ipc.on('request', this.onTransitApiMessage);

            // Bind transit api requests
            this.onElectron = this.onElectron.bind(this);
            this.connect.ipc.on('electron', this.onElectron);
        }
    }

    private onElectron(event, payload) {
        if (event) {
            if (payload.event === 'platform_reply') {
                console.log('Platform:', payload.content);
                this.isMac = payload.content === 'darwin';
                this.cdr.detectChanges();
            }
        }
    }

    private onTransitApiMessage(event, payload) {
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
                    this.transitEventHandler.sender.send('loginResponse', {status: 'CANCELLED'});
                    return;
                }
                const reqAccount = payload.content.account;
                if (reqAccount) {
                    const foundAccount = this.aService.accounts.find((a: EOSAccount) => a.name === reqAccount);
                    if (foundAccount) {
                        this.selectedAccount.next(foundAccount);
                        event.sender.send('loginResponse', foundAccount);
                        break;
                    } else {
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
                } else {
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

    private onSimpleosConnectMessage(event, payload) {
        switch (payload.message) {
            case 'change_chain': {
                if (payload.chain_id !== this.network.activeChain.id) {
                    const result: boolean = this.changeChain(payload.chain_id);
                    // wait for chain to change
                    const onceListener = this.network.networkingReady.subscribe((value) => {
                        if (value) {
                            event.sender.send('changeChainResponse', result);
                            onceListener.unsubscribe();
                        }
                    });
                } else {
                    event.sender.send('changeChainResponse', true);
                }
                break;
            }
            case 'authorizations': {
                const toast: Toast = {
                    type: 'info',
                    title: 'wallet connection',
                    body: 'external application requested public account info',
                    timeout: 3000,
                    showCloseButton: true,
                    bodyOutputType: BodyOutputType.TrustedHtml,
                };
                this.toaster.popAsync(toast);
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
                } else {
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
                } else {
                    this.simpleosConnectSign(event, payload).catch(console.log);
                }
                break;
            }
        }
    }

    private changeChain(chainId): boolean {
        if (this.network.defaultChains.find((chain) => chain.id === chainId)) {
            if (this.network.activeChain.id !== chainId) {
                this.network.changeChain(chainId);
            }
            return true;
        } else {
            return false;
        }
    }

    onLoginModalClose(ev) {
        if (this.transitEventHandler && ev === false && this.eventFired === false) {
            this.eventFired = true;
            this.transitEventHandler.sender.send('loginResponse', {status: 'CANCELLED'});
        }
    }

    onSignModalClose(ev) {
        if (this.transitEventHandler && ev === false && this.eventFired === false) {
            this.eventFired = true;
            this.transitEventHandler.sender.send('signResponse', {status: 'CANCELLED'});
        }
        if (this.replyEvent && ev === false && this.eventFired === false) {
            this.eventFired = true;
            this.replyEvent.sender.send('signResponse', {status: 'CANCELLED'});
        }
    }

    toggleDayNight() {
        this.dnSet = !this.dnSet;
        if (this.dnSet) {
            localStorage.setItem('use_light_theme', 'true');
            this.theme.lightMode = true;
            this.theme.lightTheme();
        } else {
            localStorage.setItem('use_light_theme', 'false');
            this.theme.lightMode = false;
            if (this.compilerVersion === 'LIBERLAND') {
                this.theme.liberlandTheme();
            } else {
                this.theme.defaultTheme();
            }
        }
        this.cdr.detectChanges();
    }

    public minimizeWindow() {
        console.log('Minimize...');
        if (this._electronService.isElectronApp) {
            this._electronService.remote.getCurrentWindow().minimize();
        }
    }

    public closeWindow() {
        console.log('Close...');
        if (this._electronService.isElectronApp) {
            this._electronService.remote.getCurrentWindow().close();
        }
    }

    public maximizeWindow() {
        console.log('Maximize...');
        if (this._electronService.isElectronApp) {
            if (this._electronService.remote.getCurrentWindow().isMaximized()) {
                this._electronService.remote.getCurrentWindow().restore();
            } else {
                this._electronService.remote.getCurrentWindow().maximize();
            }
        }
    }

    get maximized(): boolean {
        return this._electronService.remote.getCurrentWindow().isMaximized();
    }

    mode: string = 'local';

    performUpdate() {
        if (this.compilerVersion === 'LIBERLAND') {
            if (this.newVersion['homepage']) {
                window['shell'].openExternal(this.newVersion['homepage']).catch(console.log);
            } else {
                this.openGithub();
            }
        } else {
            window['shell'].openExternal('https://eosrio.io/simpleos/').catch(console.log);
        }
    }

    openGithub() {
        window['shell'].openExternal(this.newVersion['link']).catch(console.log);
    }

    selectAccount(account_data, idx) {
        if(this.isSimpleosConnect ){
            const accountMap = this.aService.accounts.map(a => {
                const [publicKey, perm] = this.aService.getStoredKey(a);
                return {
                    actor: a.name,
                    permission: perm,
                    key: publicKey,
                };
            });
            this.selectedAccount.next(accountMap);
            this.aService.select(idx);
        } else {
            const [auth, key] = this.trxFactory.getAuth(account_data);
            if (key !== '') {
                const responseData = {
                    accountName: account_data.name,
                    permission: auth.permission,
                    publicKey: key,
                };
                this.transitconnect = false;
                this.selectedAccount.next(responseData);
                this.aService.select(idx);
            }
        }
    }

    signResponse(data) {
        this.replyEvent.sender.send('signResponse', data);
    }

    async signExternalAction() {
        this.wrongpass = '';
        this.txerror = '';
        this.busy = true;

        if (this.mode === 'local') {
            console.log('signing in local mode');

            const account = this.aService.accounts.find(a => a.name === this.external_signer);
            const idx = this.aService.accounts.indexOf(account);
            this.aService.selected.next(account);
            const [, publicKey] = this.trxFactory.getAuth();

            try {
                await this.crypto.authenticate(this.confirmForm.get('pass').value, publicKey);
            } catch (e) {
                this.wrongpass = 'wrong password';
                this.busy = false;
                return;
            }

            try {

                console.log(this.fullTrxData, !this.transitMode);
                const result = await this.eosjs.signTrx(this.fullTrxData, !this.transitMode);
                console.log(result);

                if (result) {
                    if (this.transitMode) {
                        this.signResponse({
                            sigs: result.packedTransaction.signatures,
                        });
                    } else {
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
                    await this.aService.refreshFromChain(false);
                    this.cdr.detectChanges();
                }
            } catch (e) {
                this.txerror = e;
                console.log(e);
                this.busy = false;
            }

        } else if (this.mode === 'ledger') {
            try {
                const result = await this.ledger.sign(
                    this.fullTrxData,
                    this.crypto.requiredLedgerSlot,
                    this.network.selectedEndpoint.getValue().url
                );
                if (result) {
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
            } catch (e) {
                this.signResponse({
                    status: 'ERROR',
                    reason: e
                });
                this.txerror = e;
                console.log(e);
                this.busy = false;
            }
        }
    }

    processSigners() {
        let signer = '';
        for (const action of this.fullTrxData.actions) {
            if (action.account === 'eosio' && action.name === 'updateauth') {
                this.updateauthWarning = true;
            }
            if (signer === '') {
                signer = action.authorization[0].actor;
            } else {
                if (signer !== action.authorization[0].actor) {
                    console.log('Multiple signers!!!');
                }
            }
        }
        this.external_signer = signer;
    }

    async onTransitSign(event, payload) {
        if (this.crypto.getLockStatus()) {
            return;
        }
        this.loadingTRX = true;
        const hexData = payload.content.hex_data;
        try {
            const data = await this.eosjs.localSigProvider.processTrx(hexData);
            this.fullTrxData = data;
            this.updateauthWarning = false;
            this.confirmForm.reset();
            this.processSigners();
            this.action_json = data.actions;
            this.zone.run(() => {
                this.loadingTRX = false;
                this.externalActionModal = true;
                this.eventFired = false;
            });
            this.replyEvent = event;
        } catch (e) {
            console.log(e);
            this.loadingTRX = false;
        }
    }

    async simpleosConnectSign(event, payload) {
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
        } catch (e) {
            console.log(e);
            this.loadingTRX = false;
        }
    }

    private checkSignerMode() {
        const account = this.aService.accounts.find(a => a.name === this.external_signer);
        const [, publicKey] = this.trxFactory.getAuth(account);
        this.mode = this.crypto.getPrivateKeyMode(publicKey);
    }

    get requiredLedgerInfo() {
        return {
            device: this.crypto.requiredLedgerDevice,
            slot: this.crypto.requiredLedgerSlot
        };
    }

    private extendActionJson() {
        // deep clone transaction data for display
        this.action_json = JSON.parse(JSON.stringify(this.fullTrxData.actions));
        for (const act of this.action_json) {
            if (act.data) {
                for (const k in act.data) {
                    if (act.data.hasOwnProperty(k)) {
                        try {
                            act.data[k] = JSON.parse(act.data[k]);
                        } catch (e) {

                        }
                    }
                }
            }
        }
    }
}
