import {ChangeDetectorRef, Component} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {Eosjs2Service} from '../services/eosio/eosjs2.service';
import {CryptoService} from '../services/crypto/crypto.service';
import {RpcError} from 'eosjs/dist';
import {BodyOutputType, Toast, ToasterService} from 'angular2-toaster';
import {AccountsService} from '../services/accounts.service';
import {TransactionFactoryService, TrxModalData} from '../services/eosio/transaction-factory.service';
import {LedgerService} from "../services/ledger/ledger.service";
import {NetworkService} from "../services/network.service";
import {Subject, Subscription} from "rxjs";

@Component({
    selector: 'app-confirm-modal',
    templateUrl: './confirm-modal.component.html',
    styleUrls: ['./confirm-modal.component.css']
})
export class ConfirmModalComponent {

    public visibility = false;
    wasClosed = false;
    public displayTerms = false;
    public mode = 'local';
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
        private trxFactory: TransactionFactoryService,
        public ledger: LedgerService,
        public network: NetworkService,
    ) {
        this.confirmationForm = this.fb.group({
            pass: ['', [Validators.required]]
        });
        this.trxFactory.launcher.subscribe((state) => {
            this.visibility = state.visibility;
            this.mode = state.mode;
            console.log(state.mode);
            if (this.visibility) {
                this.wasClosed = false;
            }
        });
        this.trxFactory.modalData.asObservable().subscribe((modalData) => {
            this.modalData = modalData;
        });
    }

    async processTransaction(trx, handler) {
        console.log(trx);
        try {
            const result = await this.eosjs.transact(trx);
            if (result === 'wrong_pass') {
                return [null, 'Wrong password!'];
            } else {
                return [result, null];
            }
        } catch (e) {
            console.log('\nCaught exception: ' + e);
            if (handler) {
                return [false, handler(e)];
            } else {
                this.errormsg = e;
                if (e instanceof RpcError) {
                    console.log(JSON.stringify(e.json, null, 2));
                }
                return [false, null];
            }

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
            return false;
        }

        console.log(this.modalData.transactionPayload);
        if (this.modalData.transactionPayload.actions.length === 0) {
            this.trxFactory.status.emit('done');
            this.confirmationForm.reset();
            this.busy = false;
            this.visibility = false;
            this.cdr.detectChanges();
            return true;
        }

        // Sign and push transaction
        const [trxResult, err] = await this.processTransaction(
            this.modalData.transactionPayload,
            this.modalData.errorFunc
        );

        if (err) {
            this.errormsg = err;
            this.busy = false;
            this.confirmationForm.reset();
        } else {
            if (trxResult) {
                const trxId = trxResult.transaction_id;
                this.wasClosed = true;
                this.confirmationForm.reset();
                setTimeout(() => {
                    this.aService.refreshFromChain(false).catch(e => {
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
    }

    async signLedger() {
        this.errormsg = '';
        this.busy = true;

        try {
            const result = await this.ledger.sign(
                this.modalData.transactionPayload,
                this.crypto.requiredLedgerSlot,
                this.network.selectedEndpoint.getValue().url
            );
            if (result) {
                console.log(result);
                const trxId = result['result']['transaction_id'];

                setTimeout(() => {
                    this.aService.refreshFromChain(false).catch(e => {
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
                this.errormsg = '';
                this.busy = false;
                this.visibility = false;
                this.cdr.detectChanges();
            }
        } catch (e) {
            this.errormsg = e;
            console.log(e);
            this.busy = false;
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
                    // Open block explorer on browser
                    if (this.aService.activeChain.explorers) {
                        if (this.aService.activeChain.explorers.length > 0) {
                            const txBase = this.aService.activeChain.explorers[0].tx_url;
                            window['shell']['openExternal'](txBase + data.data.id);
                        }
                    }
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
            this.busy = false;
            this.trxFactory.status.emit('modal_closed');
            this.errormsg = '';
        }
    }

    get requiredLedgerInfo() {
        return {
            device: this.crypto.requiredLedgerDevice,
            slot: this.crypto.requiredLedgerSlot
        };
    }
}
