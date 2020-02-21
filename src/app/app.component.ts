import {AfterViewInit, ChangeDetectorRef, Component, NgZone, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {Router} from '@angular/router';
import {environment} from '../environments/environment';

import {NetworkService} from './services/network.service';
import {AccountsService} from './services/accounts.service';
import {EOSJSService} from './services/eosio/eosjs.service';
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
    wrongpass: string;
    transitconnect = false;
    externalActionModal = false;
    dapp_name = '';
    selectedAccount = new BehaviorSubject<any>('');
    accountChange: Subscription;
    ledgerOpen: boolean;
    update: boolean;
    ipc: any;
    busy: boolean;
    action_json: any[];
    pksForm: FormGroup;
    accSlots: LedgerSlot[];
    selectedSlot: LedgerSlot;
    selectedSlotIndex: number;
    showAll = false;
    agreeConstitution = false;
    dnSet = false;
    activeChain = null;

    public version = environment.VERSION;
    public compilerVersion = environment.COMPILERVERSION;

    updateauthWarning = false;
    public newVersion: any;
    public external_signer: string;
    private fullTrxData: any;
    private replyEvent: any;

    public isMac:boolean;
    private _maximized: boolean;

    public transitEventHandler: any;
    private eventFired: boolean;
    public loadingTRX: boolean;
    private transitMode = false;

    constructor(
        private fb: FormBuilder,
        public network: NetworkService,
        public ledger: LedgerService,
        public aService: AccountsService,
        private titleService: Title,
        public eos: EOSJSService,
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
    ) {
        if (this.compilerVersion === 'LIBERLAND') {
            this.titleService.setTitle('Liberland Wallet v' + this.version);
            this.theme.liberlandTheme();
            this.activeChain = this.network.defaultChains.find((chain) => chain.name === 'LIBERLAND TESTNET');
            localStorage.setItem('simplEOS.activeChainID', this.activeChain.id);
            this.network.changeChain(this.activeChain.id);
        } else {
            this.theme.defaultTheme();
            this.titleService.setTitle('SimplEOS Wallet v' + this.version);
        }

        this.confirmForm = this.fb.group({
            pass: ['', Validators.required],
        });

        // countdown 30 seconds to automatic backup
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
        // this.isMac = this._electronService.isMacOS;
        this.connect.ipc.send('electronOS','request_os');
        // console.log('Is MacOS?', this.isMac);
        this.cdr.detectChanges();
    }

    ngAfterViewInit() {
        setTimeout(() => {
            this.network.connect(false);
            setTimeout(async () => {
                this.newVersion = await this.eosjs.checkSimpleosUpdate();
                if (this.newVersion) {
                    const remoteVersionNum = parseInt(this.newVersion['version_number'].replace(/[v.]/g, ''));
                    const currentVersionNum = parseInt(this.version.replace(/[.]/g, ''));
                    console.log(`Remote Version: ${remoteVersionNum}`);
                    console.log(`Local Version: ${currentVersionNum}`);
                    // TODO: change back to currentVersionNum
                    if (remoteVersionNum > 92) {
                        this.update = true;
                    }
                }
            }, 5000);
        }, 900);
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
            this.connect.ipc.on('electronOS', this.onElectron);
        }
    }

    private onElectron(event,payload){
        console.log('type OS:', payload.content);
        this.isMac = payload.content === 'darwin';
        this.cdr.detectChanges();
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
                // console.log ( reqAccount );
                if (reqAccount) {
                    const foundAccount = this.aService.accounts.find((a) => a.accountName === reqAccount);
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
                            // console.log ( data );
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
                const localKeys = JSON.parse(localStorage.getItem('eos_keys.' + this.eos.chainID));
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
                event.sender.send('authorizationsResponse', this.aService.accounts.map(a => {
                    const [publicKey, perm] = this.aService.getStoredKey(a);
                    return {
                        actor: a.name,
                        permission: perm,
                        key: publicKey,
                    };
                }));
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

    see() {
        this.dnSet = !this.dnSet;
        if (this.dnSet) {
            this.theme.lightTheme();
        } else {
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
        window['shell'].openExternal('https://eosrio.io/simpleos/').catch(console.log);
    }

    openGithub() {
        window['shell'].openExternal(this.newVersion['link']).catch(console.log);
    }

    selectAccount(account_data, idx) {
        const store = localStorage.getItem('eos_keys.' + this.aService.activeChain.id);
        let key = '';
        let _perm = '';
        if (store) {
            const keys = Object.keys(JSON.parse(store));
            account_data.details.permissions.forEach((p) => {
                if (p.required_auth.keys.length > 0) {
                    const _k = p.required_auth.keys[0].key;
                    if (keys.indexOf(_k) !== -1) {
                        key = _k;
                        _perm = p.perm_name;
                    }
                }
            });
        }
        if (key !== '') {
            const responseData = {
                accountName: account_data.name,
                permission: _perm,
                publicKey: key,
            };
            this.selectedAccount.next(responseData);
            this.aService.select(idx);
            this.transitconnect = false;
        }
    }

    signResponse(data) {
        this.replyEvent.sender.send('signResponse', data);
    }

    async signExternalAction() {
        this.wrongpass = '';
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
                            sigs: result.signatures,
                        });
                    } else {
                        this.signResponse({
                            status: 'OK',
                            content: result
                        })
                    }
                    this.wrongpass = '';
                    this.busy = false;
                    this.externalActionModal = false;
                    this.aService.select(idx);
                    this.aService.reloadActions(account);
                    await this.aService.refreshFromChain(false);
                    this.cdr.detectChanges();
                }
            } catch (e) {
                this.wrongpass = e;
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
                        content: result
                    });
                    this.wrongpass = '';
                    this.busy = false;
                    this.externalActionModal = false;
                    this.cdr.detectChanges();
                }
            } catch (e) {
                this.signResponse({
                    status: 'ERROR',
                    reason: e
                });
                this.wrongpass = e;
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
        console.log('new signature proposal', payload.content);
        this.fullTrxData = payload.content;
        this.loadingTRX = true;
        try {
            this.updateauthWarning = false;
            this.confirmForm.reset();
            this.processSigners();
            this.action_json = this.fullTrxData.actions;
            this.checkSignerMode();
            this.zone.run(() => {
                this.wrongpass = '';
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

    private checkSignerMode() {
        const account = this.aService.accounts.find(a => a.name === this.external_signer);
        const [auth, publicKey] = this.trxFactory.getAuth(account);
        this.mode = this.crypto.getPrivateKeyMode(publicKey);
    }

    get requiredLedgerInfo() {
        return {
            device: this.crypto.requiredLedgerDevice,
            slot: this.crypto.requiredLedgerSlot
        };
    }
}
