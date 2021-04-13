import {ChangeDetectorRef, Component, ElementRef, NgZone, ViewChild} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {Eosjs2Service} from '../services/eosio/eosjs2.service';
import {CryptoService} from '../services/crypto/crypto.service';
import {RpcError} from 'eosjs/dist';
import {NotificationService} from '../services/notification.service';
import {AccountsService} from '../services/accounts.service';
import {TransactionFactoryService, TrxModalData} from '../services/eosio/transaction-factory.service';
import {LedgerService} from '../services/ledger/ledger.service';
import {NetworkService} from '../services/network.service';
import {MatInput} from '@angular/material/input';
import {ResourceService} from '../services/resource.service';

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
    public errormsg: any = {'friendly': '', 'origin': ''};
    public busy = false;
    public useFreeTransaction = '0';
    public useBorrowRex = '0';
    public countLoopUse = 0;
    options;
    labelHtml;
    public loadResource = false;
    public selectedAuth: string = 'active';
    confirmationForm: FormGroup;
    public modalData: TrxModalData;
    public allAuth: any;

    constructor(
        public aService: AccountsService,
        private fb: FormBuilder,
        private cdr: ChangeDetectorRef,
        private eosjs: Eosjs2Service,
        private crypto: CryptoService,
        private toaster: NotificationService,
        private trxFactory: TransactionFactoryService,
        public ledger: LedgerService,
        public network: NetworkService,
        public resource: ResourceService,
        private zone: NgZone,
    ) {

        this.confirmationForm = this.fb.group({
            pass: ['', [Validators.required]]
        });

        this.trxFactory.launcher.subscribe(async (state) => {
            this.loadResource = true;
            this.visibility = state.visibility;
            this.mode = state.mode;
            const [auth] = this.trxFactory.getAuth();
            this.selectedAuth = auth.permission;
            if (this.visibility) {
                this.confirmationForm.reset();
                this.wasClosed = false;
                this.setFocus();
                console.log(Date(), this.loadResource);
                await this.resourceInit();
                if (this.modalData.resourceInfo["relay"]) {
                    this.useFreeTransaction = '1';
                    this.useBorrowRex = '0';
                } else {
                    this.useBorrowRex = '1';
                }
            }
            this.allAuth = this.trxFactory.getAllAuth();
        });

        this.trxFactory.modalData.asObservable().subscribe((modalData) => {
            this.modalData = modalData;
        });
    }

    toggleHelp(e, isFree) {
        if (e.value !== undefined) {
            if (isFree) {
                this.useFreeTransaction = e.value;
                if (this.useFreeTransaction === '0' && this.modalData.resourceInfo['needResources'] && this.countLoopUse < 1) {
                    this.countLoopUse++;
                    this.useBorrowRex = '1';
                } else {
                    this.countLoopUse = 0;
                }
            } else {
                this.useBorrowRex = e.value;
                if (this.useBorrowRex === '0' && this.modalData.resourceInfo['relay'] && this.countLoopUse < 1) {
                    this.countLoopUse++;
                    this.useFreeTransaction = '1';
                } else {
                    this.countLoopUse = 0;
                }
            }

            this.cdr.detectChanges();
        }
    }

    async resourceInit(authSelected?) {

        const [auth] = authSelected ?? this.trxFactory.getAuth();
        this.modalData.resourceInfo = await this.resource.checkResource(auth, this.modalData.transactionPayload.actions, undefined, undefined, this.modalData.tk_name);
        const result = await this.resource.getActions(auth);
        this.modalData.resourceTransactionPayload = {actions: result};
        this.loadResource = false;

        this.cdr.detectChanges();
    }

    async selectAuth([auth, publicKey]) {
        this.selectedAuth = auth.permission;
        this.modalData.signerAccount = auth.actor;
        this.modalData.signerPublicKey = publicKey;
        this.mode = this.crypto.getPrivateKeyMode(publicKey);
        await this.changeAuthTransactionPayload([auth]);
        await this.resourceInit([auth, publicKey]);
        console.log(this.modalData);
    }

    async changeAuthTransactionPayload([auth]) {
        this.modalData.transactionPayload.actions.forEach((act, idx) => {
            this.modalData.transactionPayload.actions[idx].authorization = [auth];
        });
    }

    setFocus() {
        setTimeout(() => {
            if (this.pass) {
                this.pass.focus();
            }
        }, 100);
    }

    async processTransaction(trx, handler) {
        if ((this.modalData.resourceInfo['needResources'] || this.modalData.resourceInfo['relay']) && this.useFreeTransaction === undefined) {
            return [null, 'Please select a option!'];
        }
        try {
            let result;
            if (this.modalData.resourceInfo['relay'] && this.useFreeTransaction === '1') {
                const signed = await this.eosjs.signRelayTrx(trx);
                if (!signed) {
                    return [null, 'Wrong password!'];
                }
                result = await this.resource.sendTxRelay(signed);
                if (!result.ok) {
                    const err: RpcError = result.error.error;
                    return this.handlerError(err, handler);
                }
            } else {
                result = await this.eosjs.transact(trx);
            }

            if (result === 'wrong_pass') {
                return [null, 'Wrong password!'];
            } else {
                return [result, null];
            }

        } catch (e) {
            return this.handlerError(e, handler);
        }
    }

    handlerError(e, handler?) {
        console.log('\nCaught exception: ' + e);
        if (handler) {
            this.trxFactory.status.emit(JSON.stringify(handler(e), null, 2));
            this.busy = false;
            return [false, handler(e)];
        } else {

            const error = this.network.defaultErrors;
            let msg;
            if (e.json !== undefined) {
                msg = error.find(elem => elem.code === e.json.error.code);
            }

            if (this.aService.activeChain['borrow']['enable'] === false || msg === undefined) {
                if (e.json !== undefined)
                    this.errormsg = {'friendly': e.json.error.details[0].message, 'origin': ''};
                else
                    this.errormsg = {'friendly': e, 'origin': ''};
            } else {
                this.errormsg = {'friendly': msg['message'], 'origin': e.json.error.details[0].message};
            }

            if (e instanceof RpcError) {
                this.trxFactory.status.emit(JSON.stringify(e.json, null, 2));
            }
            this.busy = false;
            return [false, null];
        }
    }


    async executeAction(pass): Promise<any> {
        this.busy = true;
        this.errormsg = {'friendly': '', 'origin': ''};
        let transactionPayload = {actions: []};

        // Unlock Signer
        try {
            await this.crypto.authenticate(pass, this.modalData.signerPublicKey);
        } catch (e) {
            this.errormsg = {'friendly': 'Wrong password!', 'origin': ''};
            this.trxFactory.status.emit('error');
            this.busy = false;
            this.toaster.onError('Authentication fail', `Wrong password`);
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

        transactionPayload.actions = this.transactionPayload();


        // Sign and push transaction
        const [trxResult, err] = await this.processTransaction(
            transactionPayload,
            this.modalData.errorFunc
        );

        if (err) {
            this.errormsg = {'friendly': err, 'origin': ''};
            this.busy = false;
            this.trxFactory.status.emit('error');
            this.confirmationForm.reset();
        } else {
            if (trxResult) {
                const trxId = this.modalData.resourceInfo.relay && this.useFreeTransaction === '1' ? trxResult.data.transactionId : trxResult.transaction_id;
                this.wasClosed = true;
                this.confirmationForm.reset();
                setTimeout((_) => {
                    this.aService.refreshFromChain(false).catch(e => {
                        console.log(e);
                    });
                    this.trxFactory.status.emit('done');
                    this.busy = false;
                    this.visibility = false;
                    this.cdr.detectChanges();
                }, 1500);
                this.toaster.onSuccessEX('Transaction broadcasted', `<div class="dont-break-out"> TRX ID: ${trxId}</div> <br> Check your history for confirmation.`, {
                    id: trxId
                }, this.aService.activeChain.explorers);
            } else {
                this.busy = false;
                this.confirmationForm.reset();
                this.toaster.onError('Transaction failed', `${this.errormsg['friendly']}`);
            }
        }
    }

    transactionPayload() {
        let transactionPayload = {actions: []};
        if (this.modalData.resourceInfo.needResources) {
            if (this.useBorrowRex === '1') {
                this.modalData.resourceTransactionPayload.actions.forEach(act => {
                    transactionPayload.actions.push(act);
                });
            }
        }

        this.modalData.transactionPayload.actions.forEach(act => {
            transactionPayload.actions.push(act);
        });
        return transactionPayload.actions;
    }

    async signLedger() {
        this.errormsg = {'friendly': '', 'origin': ''};
        this.busy = true;
        let transactionPayload = {actions: []};

        try {
            transactionPayload.actions = this.transactionPayload();
            let result;
            if (this.modalData.resourceInfo['relay'] && this.useFreeTransaction === '1') {

                const signed = await this.ledger.sign(
                    transactionPayload,
                    this.crypto.requiredLedgerSlot,
                    this.network.selectedEndpoint.getValue().url,
                    true
                );

                if (!signed) {
                    return [null, 'Wrong password!'];
                }
                result = await this.resource.sendTxRelay(signed);
                if (!result.ok) {
                    const err: RpcError = result.error.error;
                    return this.handlerError(err);
                }
            } else {
                result = await this.ledger.sign(
                    transactionPayload,
                    this.crypto.requiredLedgerSlot,
                    this.network.selectedEndpoint.getValue().url,
                    false
                );
            }
            if (result) {
                // console.log(result);
                const trxId = this.modalData.resourceInfo.relay && this.useFreeTransaction === '1' ? result.data.transactionId : result['result']['transaction_id'];

                setTimeout(() => {
                    this.aService.refreshFromChain(false).catch(e => {
                        console.log(e);
                    });
                    this.trxFactory.status.emit('done');
                    this.busy = false;
                    this.visibility = false;
                    this.cdr.detectChanges();
                }, 3000);
                this.toaster.onSuccessEX('Transaction broadcasted', `<div class="dont-break-out"> TRX ID: ${trxId}</div> <br> Check your history for confirmation.`, {
                    id: trxId
                }, this.aService.activeChain.explorers);

                this.errormsg = {'friendly': '', 'origin': ''};
            }
        } catch (e) {
            this.handlerError(e);
        }
    }

    onClose() {
        if (!this.wasClosed) {
            this.wasClosed = true;
            this.busy = false;
            this.trxFactory.status.emit('modal_closed');
            this.errormsg = {'friendly': '', 'origin': ''};
        }
    }

    get requiredLedgerInfo() {
        return {
            device: this.crypto.requiredLedgerDevice,
            slot: this.crypto.requiredLedgerSlot
        };
    }
}
