import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {Router} from '@angular/router';
import {EOSJSService} from '../../services/eosjs.service';
import {AccountsService} from '../../services/accounts.service';
import {VotingService} from '../../services/voting.service';
import {NetworkService} from '../../services/network.service';
import {CryptoService} from '../../services/crypto.service';
import {BodyOutputType, Toast, ToasterConfig, ToasterService} from 'angular2-toaster';
import {ClrModal, ClrWizard} from '@clr/angular';
import {BackupService} from '../../services/backup.service';
import {AppComponent} from '../../app.component';
import {ElectronService} from 'ngx-electron';
import {Eosjs2Service} from '../../services/eosjs2.service';
import {ChainService} from '../../services/chain.service';

@Component({
	selector: 'app-config',
	templateUrl: './config.component.html',
	styleUrls: ['./config.component.css']
})
export class ConfigComponent implements OnInit {

	@ViewChild('customExportBK', {static: false}) customExportBK: ElementRef;
	@ViewChild('customImportBK', {static: false}) customImportBK: ElementRef;
	@ViewChild('pkModal', {static: false}) pkModal: ClrModal;
	@ViewChild('managepkModal', {static: false}) managepkModal: ClrModal;
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
	infile: any;
	exfile: any;
	choosedDir: string;
	choosedFil: string;
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

	keysaccounts = [];


	static resetApp() {
		window['remote']['app']['relaunch']();
		window['remote']['app'].exit(0);
	}

	constructor(private fb: FormBuilder,
				public voteService: VotingService,
				public network: NetworkService,
				private router: Router,
				private eos: EOSJSService,
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
			oldpass: ['', [Validators.required, Validators.minLength(10)]],
			matchingPassword: this.fb.group({
				pass1: ['', [Validators.required, Validators.minLength(10)]],
				pass2: ['', [Validators.required, Validators.minLength(10)]]
			})
		});
		this.pinForm = this.fb.group({
			pin: ['', Validators.required],
		});
		this.exportForm = this.fb.group({
			pass: ['', Validators.required],
			customExportBK: ['', Validators.required],
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

		console.log(this.aService.accounts);
		// console.log(this.aService.getStoredKey());

		this.keysaccounts = [
			{
				public_key: 'EOS7zG5owDg1c7HmTjMt9Hsc8EASzrL7dGHyYcP5EoSE1rFaVAU9z',
				accounts:[{
					name:'account1',
					idx:'0',
				},{
					name:'account2',
					idx:'1',
				},{
					name:'account3',
					idx:'2',
				}],
			},
			{
				public_key: 'EOS5EaTTG7eDV6DRAJUbuaeM6MTgbmsdC6ZQ4WwHagpMgQdB4J9EZ',
				accounts:[{
					name:'account4',
					idx:'3',
				},{
					name:'account5',
					idx:'4',
				},{
					name:'account6',
					idx:'5',
				}],
			}
		];

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
			if (this.clearContacts && localStorage.key(i) === 'simpleos.contacts.'+this.aService.activeChain['id']) {
				arr.push(localStorage.key(i));
			}
			if ( localStorage.key(i).endsWith('.'+this.aService.activeChain['id']) && localStorage.key(i) !== 'simpleos.contacts.'+this.aService.activeChain['id'] ) {
				if (this.clearContacts ) {}
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

	connectEndpoint() {
		this.network.selectedEndpoint.next(this.selectedEndpoint);
		this.network.networkingReady.next(false);
		this.aService.lastAccount = this.aService.selected.getValue().name;
		this.network.startup(null);
		this.confirmModal = false;
	}

	connectCustom(url) {
		this.network.selectedEndpoint.next({url: url, owner: 'Other', latency: 0, filters: [], chain: ''});
		this.network.networkingReady.next(false);
		this.aService.lastAccount = this.aService.selected.getValue().name;
		this.network.startup(url);
		this.endpointModal = false;
	}

	changePass() {
		if (this.passmatch) {
			const account = this.aService.selected.getValue();
			const publicKey = account.details['permissions'][0]['required_auth'].keys[0].key;
			this.crypto.authenticate(this.passForm.value.oldpass, publicKey).then(() => {
				this.crypto.changePass(publicKey, this.passForm.value.matchingPassword.pass2).then(() => {
					ConfigComponent.resetApp();
				});
			});
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


	inputEXClick() {
		this.customExportBK.nativeElement.click();
	}

	exportCheckBK(a) {
		this.exfile = a.target.files[0];
		const path = this.exfile.path;
		if (path === '') {
			this.showToast('error', 'Went some wrong, try again!', '');
			this.exfile = '';
			return false;
		}
		this.choosedDir = path;
	}

	exportBK() {
		if (this.exfile) {
			if (this.exfile !== '') {

				this.disableEx = true;
				this.busy = true;

				const bkpArr = [];
				for (let i = 0; i < localStorage.length; i++) {
					if (localStorage.key(i).length > 12) {
						const keyLS = localStorage.key(i);
						const valueLS = localStorage.getItem(localStorage.key(i));
						bkpArr.push({key: keyLS, value: valueLS});
					}
				}
				const pass = this.exportForm.value.pass;
				let rp = null;
				if (this.exportForm.value.pass !== '') {
					rp = this.crypto.encryptBKP(JSON.stringify(bkpArr), pass);
				} else {
					rp = JSON.stringify(bkpArr);
				}
				const path = this.exfile.path + '/simpleos.bkp';
				window['filesystem']['writeFile'](path, rp, 'utf-8', (err, data) => {
					if (!err) {
						this.showToast('success', 'Backup exported!', '');
						this.choosedDir = '';
						this.disableEx = false;
						this.busy = false;
						this.exportBKModal = false;
					}
				});
			} else {
				this.showToast('error', 'Choose your backup directory and fill the password field!', '');
				this.choosedDir = '';
				this.disableEx = false;
				this.busy = false;
			}
		} else {
			this.showToast('error', 'Choose your backup directory and fill the password field!', '');
		}
	}

	inputIMClick() {
		this.customImportBK.nativeElement.click();
	}

	importCheckBK(a) {
		this.infile = a.target.files[0];
		const name = this.infile.name;
		if (name.split('.')[1] !== 'bkp') {
			this.showToast('error', 'Wrong file!', '');
			this.infile = '';
			return false;
		}
		this.choosedFil = name;
	}

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

	importBK() {
		this.disableIm = true;
		this.busy = true;
		if (this.infile && this.infile !== '') {
			window['filesystem']['readFile'](this.infile.path, 'utf-8', (err, data) => {
				if (!err) {
					const pass = this.importForm.value.pass;
					let arrLS = null;
					let decrypt = null;
					try {
						arrLS = JSON.parse(data);
					} catch (e) {
						// backup encrypted, password required
						if (pass !== '') {
							decrypt = this.crypto.decryptBKP(data, pass);
							try {
								arrLS = JSON.parse(decrypt);
							} catch (e) {
								this.showToast('error', 'Wrong password, please try again!', '');
								console.log('wrong file');
							}
						} else {
							this.showToast('error', 'This backup file is encrypted, please provide a password!', '');
						}
					}

					if (arrLS) {
						arrLS.forEach(function (d) {
							localStorage.setItem(d['key'], d['value']);
						});

						this.showToast('success', 'Imported with success!', '');
						this.choosedFil = '';
						this.disableIm = false;
						this.busy = false;
						this.importBKModal = false;
						setTimeout(() => {
							ConfigComponent.resetApp();
						}, 1000);
					} else {
						this.choosedFil = '';
						this.disableIm = false;
						this.busy = false;
					}

				} else {
					this.showToast('error', 'Something went wrong, please try again or contact our support!', '');
					console.log('wrong entry');
				}
			});
		} else {
			this.showToast('error', 'Choose your backup file', '');
			this.choosedFil = '';
			this.disableIm = false;
			this.busy = false;
		}
	}

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

	viewPK() {
		if (this.showpkForm.get('pass').value !== '') {
			const selAcc = this.aService.selected.getValue();
			const [publicKey, permission] = this.aService.getStoredKey(selAcc);
			this.crypto.authenticate(this.showpkForm.get('pass').value, publicKey).then((result) => {
				if (result) {
					this.showpk = true;
					this.showpkForm.reset();
					this.tempPK = this.eos.baseConfig.keyProvider;
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

	generateNKeys() {
		this.generating2 = true;
		setTimeout(() => {
			this.eos.ecc.initialize().then(() => {
				this.eos.ecc['randomKey'](64).then((privateKey) => {
					this.ownerpk2 = privateKey;
					this.ownerpub2 = this.eos.ecc['privateToPublic'](this.ownerpk2);
					this.generating2 = false;
					this.generated2 = true;
				});
			});
		}, 100);
	}

}
