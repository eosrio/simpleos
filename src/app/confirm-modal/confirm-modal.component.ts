import {ChangeDetectorRef, Component} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {Eosjs2Service} from '../services/eosjs2.service';
import {CryptoService} from '../services/crypto.service';
import {RpcError} from 'eosjs/dist';
import {BodyOutputType, Toast, ToasterService} from 'angular2-toaster';
import {AccountsService} from '../services/accounts.service';
import {TransactionFactoryService, TrxModalData} from '../services/transaction-factory.service';

@Component({
	selector: 'app-confirm-modal',
	templateUrl: './confirm-modal.component.html',
	styleUrls: ['./confirm-modal.component.css']
})
export class ConfirmModalComponent {

	public visibility = false;
	wasClosed = false;
	public displayTerms = false;
	public errormsg = '';
	public busy = false;

	confirmationForm: FormGroup;
	public modalData: TrxModalData;

	constructor(
		public aService: AccountsService,
		private fb: FormBuilder,
		private cdr: ChangeDetectorRef,
		private eosjs: Eosjs2Service,
		private crypto: CryptoService,
		private toaster: ToasterService,
		private trxFactory: TransactionFactoryService
	) {
		this.confirmationForm = this.fb.group({
			pass: ['', [Validators.required]]
		});
		this.trxFactory.launcher.subscribe((state) => {
			this.visibility = state;
			if (this.visibility) {
				this.wasClosed = false;
			}
		});
		this.trxFactory.modalData.asObservable().subscribe((modalData) => {
			this.modalData = modalData;
		});
	}

	async processTransaction(trx) {
		console.log(trx);
		try {
			const result = await this.eosjs.transact(trx);
			console.log(result);
			return result;
		} catch (e) {
			console.log('\nCaught exception: ' + e);
			this.errormsg = e;
			if (e instanceof RpcError) {
				console.log(JSON.stringify(e.json, null, 2));
			}
			return false;
		}
	}

	async executeAction(pass): Promise<any> {
		this.busy = true;
		this.errormsg = '';
		// Unlock Signer
		try {
			await this.crypto.authenticate(pass, this.modalData.signerPublicKey);
		} catch (e) {
			this.errormsg = 'Wrong password!';
			this.trxFactory.status.emit('error');
			this.busy = false;
			this.showToast('error', 'Authentication fail', `Wrong password`, {});
		}
		// Sign and push transaction
		console.log(this.modalData.transactionPayload);
		if (this.modalData.transactionPayload.actions.length === 0) {
			this.trxFactory.status.emit('done');
			this.confirmationForm.reset();
			this.busy = false;
			this.visibility = false;
			this.cdr.detectChanges();
			return true;
		}
		const trxResult = await this.processTransaction(this.modalData.transactionPayload);
		if (trxResult) {
			const trxId = trxResult.transaction_id;
			this.wasClosed = true;
			this.confirmationForm.reset();
			setTimeout(() => {
				this.aService.refreshFromChain().catch(e => {
					console.log(e);
				});
				this.trxFactory.status.emit('done');
				this.busy = false;
				this.visibility = false;
				this.cdr.detectChanges();
			}, 1500);
			this.showToast('success', 'Transaction broadcasted', ` TRX ID: ${trxId} <br> Check your history for confirmation.`, {
				id: trxId
			});
		} else {
			this.busy = false;
			this.confirmationForm.reset();
			this.showToast('error', 'Transaction failed', `${this.errormsg}`, {});
		}
	}

	private showToast(type: string, title: string, body: string, extraData: any) {
		const toast: Toast = {
			type: type,
			title: title,
			body: body,
			data: extraData,
			timeout: 10000,
			showCloseButton: true,
			clickHandler: (data) => {
				if (data.data['id']) {
					// Open explorer
					window['shell']['openExternal'](this.aService.activeChain['explorers'][0]['tx_url'] + data.data['id']);
				}
				return true;
			},
			bodyOutputType: BodyOutputType.TrustedHtml,
		};
		this.toaster.popAsync(toast);
	}

	onClose() {
		if (!this.wasClosed) {
			this.wasClosed = true;
			this.trxFactory.status.emit('modal_closed');
			this.errormsg = '';
		}
	}
}
