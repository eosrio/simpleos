import {AfterViewInit, Component, ViewChild} from '@angular/core';
import {ClrWizard} from '@clr/angular';
import {FormGroup} from '@angular/forms';
import {Router} from '@angular/router';
import {environment} from '../environments/environment';

import {NetworkService} from './services/network.service';
import {AccountsService} from './services/accounts.service';
import {EOSJSService} from './services/eosjs.service';
import {CryptoService} from './services/crypto.service';
import {ConnectService} from './services/connect.service';
import {BackupService} from './services/backup.service';

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
	ledgerOpen: boolean;
	update: boolean;
	ipc: any;
	busy: boolean;
	pksForm: FormGroup;
	accSlots: LedgerSlot[];
	selectedSlot: LedgerSlot;
	selectedSlotIndex: number;
	showAll = false;
	agreeConstitution = false;
	public version = environment.VERSION;

	constructor(
		public network: NetworkService,
		// public ledger: LedgerHWService,
		public aService: AccountsService,
		public eos: EOSJSService,
		private crypto: CryptoService,
		private connect: ConnectService,
		private router: Router,
		private autobackup: BackupService
	) {
		// countdown 30 seconds to automatic backup
		this.autobackup.startTimeout();

		this.accSlots = [];
		this.selectedSlot = null;
		this.selectedSlotIndex = null;
		this.update = false;
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
				this.aService.appendNewAccount(data.foundAccounts[0]);
				setTimeout(() => {
					this.router.navigate(['dashboard', 'vote']).catch((err) => {
						console.log(err);
					});
				}, 1000);
			});
		});
	}

	// checkUpdate() {
	//   this.ipc['send']('checkUpdate', null);
	// }

	// performUpdate() {
	//   // this.ipc['send']('startUpdate', null);
	//   window['shell'].openExternal('https://eosrio.io/simpleos/');
	// }
	//
	// openGithub() {
	//   window['shell'].openExternal('https://github.com/eosrio/simpleos/releases/latest');
	// }

	ngAfterViewInit() {
		setTimeout(() => {
			this.network.connect(false);
		}, 888);
	}

	// ngOnInit() {
	//   // if (window['ipcRenderer']) {
	//   //   this.ipc = window['ipcRenderer'];
	//   //   this.ipc.on('update_ready', (event, data) => {
	//   //     this.update = data;
	//   //   });
	//   //   setTimeout(() => {
	//   //     this.checkUpdate();
	//   //   }, 5000);
	//   // }
	//   // this.network.connect();
	// }
}
