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
import {LedgerService} from "./services/ledger/ledger.service";
import {log} from "util";

export interface LedgerSlot {
	publicKey: string;
	account: string;
}

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewInit {

	confirmForm: FormGroup;
	wrongpass: string;
	transitconnect = false;
	transitAction = false;
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
	public transit_signer: string;
	private fullTrxData: any;
	private replyEvent: any;

	public isMac = false;
	private _maximized: boolean;

	public transitEventHandler: any;
	private eventFired: boolean;
	public loadingTRX: boolean;

	constructor(private fb: FormBuilder,
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
		if (this.compilerVersion === 'LIBERLAND TESTNET') {
			this.titleService.setTitle('Liberland Wallet v' + this.version);
			this.theme.liberlandTheme();
			this.activeChain = this.network.defaultChains.find((chain) => chain.name === this.compilerVersion);
			localStorage.setItem('simplEOS.activeChainID', this.activeChain.id);
			this.network.changeChain(this.activeChain.id);
		} else {
			this.theme.defaultTheme();
			this.titleService.setTitle('SimplEOS Wallet v' + this.version);
		}

		this.confirmForm = this.fb.group({
			pass: ['', Validators.required]
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

		if (this.connect.ipc) {
			this.connect.ipc.on('request', (event, payload) => {
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
						const requested_chain = payload.content.chainId;
						// console.log ( requested_chain );
						let result = null;
						if (this.network.defaultChains.find((chain) => chain.id === requested_chain)) {
							if (this.network.activeChain.id !== requested_chain) {
								this.network.changeChain(requested_chain);
							}
							result = true;
						} else {
							result = false;
						}
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
						// console.log ( reqAccount );
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
						if (localStorage.getItem('simpleos-hash') && this.crypto.getLockStatus()) {
							return;
						}
						this.loadingTRX = true;
						this.eosjs.localSigProvider.processTrx(payload.content.hex_data).then((data) => {
							// console.log ( data );
							this.fullTrxData = data;
							this.updateauthWarning = false;
							this.confirmForm.reset();
							let signer = '';
							for (const action of data.actions) {
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
							this.transit_signer = signer;
							this.action_json = data.actions;
							this.zone.run(() => {
								this.loadingTRX = false;
								this.transitAction = true;
								this.eventFired = false;
							});
							this.replyEvent = event;

						}).catch((e) => {
							console.log(e);
							this.loadingTRX = false;
						});

						break;
					}
					default: {
						console.log(payload);
					}
				}
			});
		}


	}

	onModalClose(ev) {
		if (this.transitEventHandler && ev === false && this.eventFired === false) {
			this.eventFired = true;
			this.transitEventHandler.sender.send('loginResponse', {status: 'CANCELLED'});
		}
	}

	see() {
		this.dnSet = !this.dnSet;
		if (this.dnSet) {
			this.theme.lightTheme();
		} else {
			if (this.compilerVersion === 'LIBERLAND TESTNET') {
				this.theme.liberlandTheme();
			} else {
				this.theme.defaultTheme();
			}
		}
		this.cdr.detectChanges();
	}

	ngOnInit(): void {
		this.isMac = this._electronService.isMacOS;
		console.log('Is MacOS?', this._electronService.isMacOS);
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

// scanPublicKeys() {
	// 	if (this.ledgerOpen) {
	// 		this.busy = true;
	// 		this.ledger.readPublicKeys(8).then((ledger_slots: LedgerSlot[]) => {
	// 			this.accSlots = ledger_slots;
	// 			this.busy = false;
	// 			console.log(this.accSlots);
	// 		});
	// 	}
	// }

	selectSlot(slot: LedgerSlot, index: number) {
		this.selectedSlot = slot;
		this.selectedSlotIndex = index;
		// this.ledgerwizard.next();
		console.log(this.selectedSlot);
	}

	importLedgerAccount() {
		this.eos.loadPublicKey(this.selectedSlot.publicKey).then((data: any) => {
			console.log(data);
			this.crypto.storeLedgerAccount(data.publicKey, this.selectedSlotIndex).then(() => {
				this.aService.appendNewAccount(data.foundAccounts[0]).catch(console.log);
				setTimeout(() => {
					this.router.navigate(['dashboard', 'wallet']).catch((err) => {
						console.log(err);
					});
				}, 1000);
			});
		});
	}

	performUpdate() {
		window['shell'].openExternal('https://eosrio.io/simpleos/').catch(console.log);
	}

	openGithub() {
		window['shell'].openExternal(this.newVersion['link']).catch(console.log);
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
					if (remoteVersionNum > currentVersionNum) {
						this.update = true;
					}
				}
			}, 5000);
		}, 900);
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
				publicKey: key
			};
			this.selectedAccount.next(responseData);
			this.aService.select(idx);
			this.transitconnect = false;
		}
	}

	async signTransitAction() {
		this.wrongpass = '';
		this.busy = true;
		const account = this.aService.accounts.find(a => a.name === this.transit_signer);
		const idx = this.aService.accounts.indexOf(account);
		this.aService.selected.next(account);
		const [auth, publicKey] = this.trxFactory.getAuth();
		try {
			await this.crypto.authenticate(this.confirmForm.get('pass').value, publicKey);

		} catch (e) {
			this.wrongpass = 'wrong password';
			this.busy = false;
		}
		try {
			const result = await this.eosjs.signTrx(this.fullTrxData);
			if (result) {
				this.replyEvent.sender.send('signResponse', {
					sigs: result.signatures
				});
				this.wrongpass = '';
				this.busy = false;
				this.transitAction = false;
				this.aService.select(idx);
				this.aService.reloadActions(account);
				await this.aService.refreshFromChain();
				this.cdr.detectChanges();

			}
		} catch (e) {
			this.wrongpass = e;
			console.log(e);
			this.busy = false;
		}
	}
}
