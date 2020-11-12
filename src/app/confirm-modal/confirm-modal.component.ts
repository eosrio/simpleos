import {ChangeDetectorRef, Component, ElementRef, NgZone, ViewChild} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {Eosjs2Service} from '../services/eosio/eosjs2.service';
import {CryptoService} from '../services/crypto/crypto.service';
import {RpcError} from 'eosjs/dist';
import {BodyOutputType, Toast, ToasterService} from 'angular2-toaster';
import {AccountsService} from '../services/accounts.service';
import {TransactionFactoryService, TrxModalData} from '../services/eosio/transaction-factory.service';
import {LedgerService} from "../services/ledger/ledger.service";
import {NetworkService} from "../services/network.service";
import {MatInput} from "@angular/material/input";
import {ResourceService} from "../services/resource.service";



@Component({
    selector: 'app-confirm-modal',
    templateUrl: './confirm-modal.component.html',
    styleUrls: ['./confirm-modal.component.css']
})
export class ConfirmModalComponent {

    @ViewChild('pass') pass: MatInput;
    @ViewChild('option') option: MatInput;

    public visibility = false;
    wasClosed = false;
    public displayTerms = false;
    public mode = 'local';
    public errormsg:any = {'friendly':'', 'origin':''};
    public busy = false;
    public wantBorrow:boolean= false;
    options;
    labelHtml;

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
        public resource: ResourceService,
        private zone: NgZone,
    ) {

        this.confirmationForm = this.fb.group({
            pass: ['', [Validators.required]]
        });

        this.trxFactory.launcher.subscribe((state) => {
            this.visibility = state.visibility;
            this.mode = state.mode;
            if (this.visibility) {
                this.confirmationForm.reset();
                this.wasClosed = false;
                this.setFocus();
            }
        });

        this.trxFactory.modalData.asObservable().subscribe((modalData) => {
            this.modalData = modalData;
        });
    }

    toggleHelp(input , e){
        console.log(e.target.value);
        if( e.target.value !== undefined){
            this.wantBorrow = e.target.value === "1" ?? false
        }

    }

    changeOption(){
        console.log(this.options);
    }

    setFocus() {
        setTimeout(() => {
            if (this.pass) {
                this.pass.focus();
            }
        }, 100);
    }

    async processTransaction(trx, handler) {

        if(this.modalData.addActions && this.wantBorrow === undefined) {
            return [null, 'Please select a option!'];
        }

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
                this.trxFactory.status.emit(JSON.stringify(handler(e), null, 2));
                return [false, handler(e)];
            } else {

                const error = this.network.defaultErrors;
                console.log(e.json.error.code);
                console.log(error.find(elem=>elem.code===e.json.error.code));
                const msg = error.find(elem=>elem.code===e.json.error.code);

                if(msg === undefined ){
                    this.errormsg = {'friendly':e, 'origin':''};
                }else {
                    this.errormsg = {'friendly':msg['message'], 'origin':e};
                }

                if (e instanceof RpcError) {
                    this.trxFactory.status.emit(JSON.stringify(e.json, null, 2));
                    console.log(JSON.stringify(e.json, null, 2));
                }
                return [false, null];
            }

        }
    }

    async executeAction(pass): Promise<any> {
        this.busy = true;
        this.errormsg = {'friendly':'', 'origin':''};
        let transactionPayload = {actions:[]};
        // Unlock Signer
        try {
            await this.crypto.authenticate(pass, this.modalData.signerPublicKey);
        } catch (e) {
            this.errormsg = {'friendly':'Wrong password!', 'origin':''};
            this.trxFactory.status.emit('error');
            this.busy = false;
            this.showToast('error', 'Authentication fail', `Wrong password`, {});
            return false;
        }

        if (this.modalData.transactionPayload.actions.length === 0) {
            this.trxFactory.status.emit('done');
            this.confirmationForm.reset();
            this.busy = false;
            this.visibility = false;
            this.cdr.detectChanges();
            return true;
        }

        if(this.modalData.addActions){
            if(this.wantBorrow){
                this.modalData.resourceTransactionPayload.actions.forEach(act =>{
                    transactionPayload.actions.push(act);
                });
            }
        }

        this.modalData.transactionPayload.actions.forEach(act =>{
            transactionPayload.actions.push(act);
        });

        console.log(transactionPayload);
        // Sign and push transaction
        const [trxResult, err] = await this.processTransaction(
            transactionPayload,
            this.modalData.errorFunc
        );

        if (err) {
            this.errormsg = {'friendly':err, 'origin':''};
            this.busy = false;
            this.trxFactory.status.emit('error');
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
                this.showToast('error', 'Transaction failed', `${this.errormsg['friendly']}`, {});
            }
        }
    }

    async signLedger() {
        this.errormsg = {'friendly':'', 'origin':''};
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
                }, 3000);

                this.showToast(
                    'success',
                    'Transaction broadcasted',
                    ` TRX ID: ${trxId} <br> Check your history for confirmation.`,
                    {id: trxId}
                );
                this.errormsg = {'friendly':'', 'origin':''};
            }
        } catch (e) {

            const error = this.network.defaultErrors;
            const msg = error.find(elem=>elem.code===e.json.error.code);
            if(msg.message === undefined){
                this.errormsg = {'friendly':e, 'origin':''};
            }else {
                this.errormsg = {'friendly':msg.message, 'origin':e};
            }

            // this.errormsg = e;
            console.log(e);
            this.busy = false;
            this.showToast('error', 'Transaction failed', `${this.errormsg['friendly']}`, {});
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
            this.errormsg = {'friendly':'', 'origin':''};
        }
    }

    get requiredLedgerInfo() {
        return {
            device: this.crypto.requiredLedgerDevice,
            slot: this.crypto.requiredLedgerSlot
        };
    }
}
