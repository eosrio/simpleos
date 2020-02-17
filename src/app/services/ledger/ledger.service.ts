import {EventEmitter, Injectable} from '@angular/core';
import {Eosjs2Service} from "../eosio/eosjs2.service";

import ECC from 'eosjs-ecc';
import {ConnectService} from "../connect.service";

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
    fcbuffer: any;
    asn1: any;
    bippath: any;
    slots: any[];

    openPanel = new EventEmitter();
    public appReady = false;
    public checkingApp = false;

    public ledgerPublicKeys: LKey[] = [];
    public ledgerAccounts: LAccounts[] = [];

    ledgerEvents = new EventEmitter();

    reading = false;

    currentSlot = 0;

    ecc: ECC;

    private errorCodes = {
        26628: 'Device is not ready, please unlock',
        28160: 'EOS App is not ready, please open the eos app on your ledger',
        27013: 'User cancelled the process',
        27264: 'Invalid data, please enable arbitrary data on your ledger device'
    };

    public deviceName = '';
    private readCount = 0;

    constructor(
        private eos: Eosjs2Service,
        private connect: ConnectService
    ) {
        console.log('Loading ledger service...');
        this.slots = [];
        if (this.isElectron()) {
            this.asn1 = window.asn1;
            this.bippath = window.require('bip32-path');
            this.ecc = window.require('eosjs-ecc');
            this.requestLedgerListener();
            this.connect.ipc.on('ledger', (event, payload) => {
                this.handleIpcMessage(event, payload);
            });
            this.connect.ipc.on('ledger_keys', (event, payload) => {
                if (payload.event === 'read_key') {
                    this.ledgerPublicKeys.push(payload.data);
                    this.lookupAccounts(payload.data).catch(console.log);
                }
            })
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

    async sign(transaction: any, slotNumber: number, rpcEndpoint: string) {
        return new Promise((resolve, reject) => {
            console.log(transaction);

            // send to main process
            this.connect.ipc.send('ledger', {
                event: 'sign_trx',
                data: transaction,
                slot: slotNumber,
                endpoint: rpcEndpoint
            });

            this.connect.ipc.once('ledger_reply', (event, args) => {
                console.log(event, args);
                if (args.data) {
                    resolve(args.data);
                } else if (args.error) {
                    reject(args.error);
                }
            });

        });
    }

    checkEosApp() {
        if (!this.appReady) {
            console.log('Requesting eos app check for ledger device');
            this.checkingApp = true;
            this.connect.ipc.send('ledger', {
                event: 'check_app'
            });
            this.connect.ipc.once('ledger_reply', (event, args) => {
                console.log(event, args);
                this.checkingApp = false;
                this.appReady = args.data;
                if (!this.appReady) {
                    setTimeout(() => {
                        this.checkEosApp();
                    }, 2000);
                }
            });
        }
    }


    handleIpcMessage(event, payload) {
        console.log(event, payload);
        if (payload.event === 'listener_event') {
            if (payload.data.type === 'add') {
                this.deviceName = payload.data.deviceModel.productName;
                console.log(`Device connected: ${this.deviceName}`);
                this.checkingApp = true;
                this.openPanel.emit(true);
                this.checkEosApp();
                // Transport.open(event.descriptor).then(async (t) => {
                // 	switch (opMode) {
                // 		case 'add_account': {
                // 			getAddresses(t).catch(console.log);
                // 			break;
                // 		}
                // 		case 'sign': {
                // 			await recursiveCheck(t, api);
                // 			break;
                // 		}
                // 	}
                // });
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
            const results = await this.eos.rpc.history_get_key_accounts(key);
            const obj = {
                key: key,
                slot: data.slot,
                accounts: []
            };
            if (results.account_names) {
                for (const account of results.account_names) {
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
}