import {EventEmitter, Injectable} from '@angular/core';
import {Eosjs2Service} from "../eosio/eosjs2.service";
import {ConnectService} from "../connect.service";
import {AccountsService} from "../accounts.service";
import {JsonRpc} from "eosjs/dist";

declare let window: any;

interface LKey {
    slot: number;
    address: string;
}

interface LAccount {
    key: string;
    slot: number;
    actor: string;
    permission: string;
    selected: boolean;
    data: any;
}

interface LAccounts {
    key: string;
    slot: number;
    accounts: LAccount[];
}

@Injectable({
    providedIn: 'root'
})
export class LedgerService {

    electronStatus: boolean;
    slots: any[];

    openPanel = new EventEmitter();
    public appReady = false;
    public checkingApp = false;

    public ledgerPublicKeys: LKey[] = [];
    public ledgerAccounts: LAccounts[] = [];

    ledgerEvents = new EventEmitter();

    reading = false;

    currentSlot = 0;

    private errorCodes = {
        26628: 'Device is not ready, please unlock',
        28160: 'EOS App is not ready, please open the eos app on your ledger',
        27013: 'User cancelled the process',
        27264: 'Invalid data, please enable arbitrary data on your ledger device'
    };

    public deviceName = 'Ledger';
    private readCount = 0;
    private tempTrx: any;
    private appVerificationAttempts = 0;

    constructor(
        private eos: Eosjs2Service,
        private connect: ConnectService
    ) {
        console.log('Loading ledger service...');
        this.slots = [];
    }

    startListener() {
        if (this.isElectron()) {
            this.requestLedgerListener();
            this.connect.ipc.on('ledger', (event, payload) => {
                this.handleIpcMessage(event, payload);
            });
            this.connect.ipc.on('ledger_keys', (event, payload) => {
                if (payload.event === 'read_key') {
                    this.ledgerPublicKeys.push(payload.data);
                    this.lookupAccounts(payload.data).catch(console.log);
                }
            });
        }
    }

    requestLedgerListener() {
        console.log('Requesting new ledger event listener');
        this.connect.ipc.send('ledger', {
            event: 'start_listener'
        });
    }

    readSlots(initial: number, count: number) {
        this.reading = true;
        this.readCount = count;
        this.ledgerPublicKeys = [];
        this.ledgerAccounts = [];
        this.currentSlot = initial;
        this.connect.ipc.send('ledger', {
            event: 'read_slots',
            data: {
                starts_on: initial,
                size: count
            }
        });
    }

    async sign(transaction: any, slotNumber: number, rpcEndpoint: string): Promise<any> {
        return new Promise((resolve, reject) => {

            const ledgerSignatureRequest = {
                event: 'sign_trx',
                data: transaction,
                slot: slotNumber,
                endpoint: rpcEndpoint
            };
            console.log(ledgerSignatureRequest);

            // listen for response
            this.connect.ipc.once('ledger_reply', async (event, args) => {
                if (args.data) {
                    if (args.event === 'sign_trx') {
                        try {
                            console.log(args.data);
                            const trxResult = await this.pushSignedTrx(args.data);
                            resolve(trxResult);
                        } catch (e) {
                            reject(e);
                        }
                    }
                } else if (args.error) {
                    reject(args.error);
                }
            });

            // emit payload
            this.connect.ipc.send('ledger', ledgerSignatureRequest);
        });
    }

    checkEosApp() {
        if (!this.appReady) {
            this.checkingApp = true;

            // listen for check response
            this.connect.ipc.once('ledger_reply', (event, args) => {
                if (args.event === 'check_app') {
                    console.log(args);
                    this.checkingApp = false;
                    this.appReady = args.data;
                    if (!this.appReady) {
                        this.appVerificationAttempts++;
                        if (this.appVerificationAttempts < 5) {
                            setTimeout(this.checkEosApp, 2000);
                        }
                    } else {
                        this.appVerificationAttempts = 0;
                    }
                }
            });

            // emit request
            this.connect.ipc.send('ledger', {event: 'check_app'});
        }
    }


    handleIpcMessage(event, payload) {
        if (payload.event === 'listener_event') {
            if (payload.data.type === 'add') {
                this.deviceName = payload.data.deviceModel.productName;
                console.log(`Device connected: ${this.deviceName}`);
                this.checkingApp = true;
                this.openPanel.emit(true);
                this.checkEosApp();
            } else if (payload.data.type === 'remove') {
                this.openPanel.emit(false);
                this.deviceName = '';
                this.appReady = false;
                this.checkingApp = false;
                console.log(`Device Removed: ${payload.data.deviceModel["productName"]}`);
            } else {
                console.log(event);
            }
        } else if (payload.event === 'error') {
            this.ledgerEvents.emit(payload);
            if (this.reading) {
                this.reading = false;
            }
        }
    }

    isElectron() {
        this.electronStatus = window && window['process'] && window['process']['type'];
        return this.electronStatus;
    }

    private async lookupAccounts(data: any) {
        const key = data.address;
        try {
            const account_names = await this.eos.getKeyAccountsMulti(key);
            const obj = {
                key: key,
                slot: data.slot,
                accounts: []
            };
            if (account_names) {
                for (const account of account_names) {
                    const acc_data: any = await this.eos.rpc.get_account(account);
                    obj.accounts.push({
                        key: key,
                        slot: data.slot,
                        actor: account,
                        permission: this.getAssociatedPermission(acc_data, key),
                        selected: false,
                        data: acc_data
                    });
                }
            }
            this.ledgerAccounts.push(obj);
            this.ledgerEvents.emit({
                event: 'new_account',
                data: obj
            });
        } catch (e) {
            console.log(e);
        }
        this.readCount--;
        this.currentSlot++;
        if (this.readCount === 0) {
            this.reading = false;
            setImmediate(() => {
                this.ledgerEvents.emit({
                    event: 'finished_reading'
                });
            });
        }
    }

    getAssociatedPermission(acc_data: any, key: string) {
        let perm = '';
        for (const p of acc_data.permissions) {
            if (p.required_auth.keys[0].key === key) {
                perm = p.perm_name;
                break;
            }
        }
        return perm;
    }

    async pushSignedTrx(data: any) {
        console.log(data);
        // store transaction for eventual resubmission
        await this.eos.deserializeTrx(data);
        this.tempTrx = data;
        return new Promise(async (resolve, reject) => {
            try {
                const pushResults = await this.eos.rpc.push_transaction(data);
                resolve({result: pushResults, packedTransaction: data});
            } catch (e) {
                reject(e.json.error.details[0].message);
            }
        })
    }
}
