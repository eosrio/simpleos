import {AfterViewInit, ChangeDetectorRef, Component, NgZone, ViewChild} from '@angular/core';
import {ClrWizard} from '@clr/angular';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {Router} from '@angular/router';
import {environment} from '../environments/environment';

import {NetworkService} from './services/network.service';
import {AccountsService} from './services/accounts.service';
import {EOSJSService} from './services/eosjs.service';
import {CryptoService} from './services/crypto.service';
import {ConnectService} from './services/connect.service';
import {BackupService} from './services/backup.service';
import {BehaviorSubject, Subscription} from 'rxjs';
import {Eosjs2Service} from './services/eosjs2.service';
import {TransactionFactoryService} from './services/transaction-factory.service';
import {ElectronService} from 'ngx-electron';

export interface LedgerSlot {
	publicKey: string;
	account: string;
}

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit {

	@ViewChild('ledgerwizard') ledgerwizard: ClrWizard;
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
	public version = environment.VERSION;

	updateauthWarning = false;
	public newVersion: any;
	public transit_signer: string;
	private fullTrxData: any;
	private replyEvent: any;

	public isMac: boolean;
	private _maximized: boolean;

	constructor(private fb: FormBuilder,
				public network: NetworkService,
				// public ledger: LedgerHWService,
				public aService: AccountsService,
				public eos: EOSJSService,
				private eosjs: Eosjs2Service,
				private crypto: CryptoService,
				private connect: ConnectService,
				private router: Router,
				private autobackup: BackupService,
				private trxFactory: TransactionFactoryService,
				private zone: NgZone,
				private cdr: ChangeDetectorRef,
				private _electronService: ElectronService
	) {

		this.isMac = this._electronService.isMacOS;

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

		// this.ledger.ledgerStatus.asObservable().subscribe((status) => {
		//   if (this.aService.hasAnyLedgerAccount === false) {
		//     this.ledgerOpen = status;
		//   }
		// });

		// this.ledger.openPanel.subscribe((event) => {
		// 	if (event === 'open') {
		// 		this.ledgerOpen = true;
		// 	}
		// });

		this.busy = false;
		if (this.connect.ipc) {
			this.connect.ipc.on('request', (event, payload) => {
				console.log(payload);
				switch (payload.message) {
					case 'launch': {
						alert(payload.content);
						break;
					}
					case 'accounts': {
						event.sender.send('accountsResponse', this.aService.accounts.map(a => a.name));
						break;
					}
					case 'connect': {
						this.dapp_name = payload.content.dappName;
						this.zone.run(() => {
							this.transitconnect = true;
						});
						if (this.aService.accounts.length > 0) {
							this.accountChange = this.selectedAccount.subscribe((data) => {
								if (data) {
									event.sender.send('connectResponse', data);
									this.accountChange.unsubscribe();
									this.selectedAccount.next(null);
								}
							});
						} else {
							console.log('No account found!');
							event.sender.send('connectResponse', {});
						}
						break;
					}
					case 'publicKeys': {
						const localKeys = JSON.parse(localStorage.getItem('eos_keys.' + this.eos.chainID));
						event.sender.send('publicKeyResponse', Object.keys(localKeys));
						break;
					}
					case 'sign': {
						this.eosjs.localSigProvider.processTrx(payload.content.hex_data).then((data) => {
							console.log(data);
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
								this.transitAction = true;
							});
							this.replyEvent = event;
						}).catch((e) => {
							console.log(e);
						});

						// this.eosjs.deserializeTRX(payload.content.trx).then((results) => {
						// 	console.log(results);
						// 	event.sender.send('signResponse', {
						// 		sigs: []
						// 	});
						// }).catch((error) => {
						// 	console.log(error);
						// });

						break;
					}
					default: {
						console.log(payload);
					}
				}
			});
		}
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
		this.ledgerwizard.next();
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
			setTimeout(() => {
				this.eosjs.checkSimpleosUpdate().then(v => {
					if (v['rows'].length > 0) {
						this.newVersion = v['rows'][0];
						if (this.version !== (this.newVersion['version_number']).replace('v', '')) {
							this.update = true;
						}
					}
				}).catch(err => {
					console.log(err);
				});
			}, 5000);
		}, 900);
	}

	selectAccount(account_data) {
		const activePerm = account_data.details.permissions.find(p => p.perm_name === 'active');
		const responseData = {
			accountName: account_data.name,
			permission: 'active',
			publicKey: activePerm.required_auth.keys[0].key
		};
		this.selectedAccount.next(responseData);
		this.transitconnect = false;
	}

	async signTransitAction() {
		this.busy = true;
		const account = this.aService.accounts.find(a => a.name === this.transit_signer);
		this.aService.selected.next(account);
		const [auth, publicKey] = this.trxFactory.getAuth();
		try {
			await this.crypto.authenticate(this.confirmForm.get('pass').value, publicKey);
		} catch (e) {
			this.wrongpass = 'wrong password';
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
				this.cdr.detectChanges();
			}
		} catch (e) {
			console.log(e);
		}
	}
}
