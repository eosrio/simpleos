import {EventEmitter, Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {AccountsService} from '../accounts.service';
import {CryptoService} from '../crypto/crypto.service';
import {Action, Authorization} from "eosjs/dist/eosjs-serialize";

export interface TrxPayload {
    actions: Action[]
}

export interface TrxModalData {
    labelHTML: string;
    termsHTML: string;
    termsHeader: string;
    actionTitle: string;
    signerPublicKey?: string;
    signerAccount?: string;
    transactionPayload: TrxPayload;
    resourceTransactionPayload?: TrxPayload;
    resourceInfo?: {
        needResources:boolean,
        relay:boolean,
        relayCredit:any,
        borrow:number,
        spend:number,
        precision: number,
        tk_name: String, },
    errorFunc?: any;
    tk_name?: string;
}

@Injectable({
    providedIn: 'root'
})
export class TransactionFactoryService {

    public modalData: BehaviorSubject<TrxModalData>;
    public launcher: EventEmitter<any>;
    public status: EventEmitter<string>;

    constructor(
        private aService: AccountsService,
        private crypto: CryptoService
    ) {
        this.launcher = new EventEmitter<any>();
        this.status = new EventEmitter<string>(true);
        this.modalData = new BehaviorSubject<TrxModalData>({
            labelHTML: '',
            termsHTML: '',
            termsHeader: '',
            actionTitle: '',
            signerPublicKey: '',
            signerAccount: '',
            transactionPayload: {
                actions: []
            },
            resourceTransactionPayload: {
                actions: []
            },
            resourceInfo: {
                needResources:false,
                relay:false,
                relayCredit:{used:0,limit:0},
                borrow:0.0,
                spend:0.0,
                precision: 4,
                tk_name: 'EOS',
            },
            errorFunc: null,
        });
    }

    async transact(builder: (auth: Authorization, publicKey: string) => Promise<TrxModalData | null>): Promise<any> {
        const [auth, publicKey] = this.getAuth();
        const modalData = await builder(auth, publicKey);
        if (modalData) {
            if (!modalData.signerPublicKey) {
                modalData.signerPublicKey = publicKey;
            }
            if (!modalData.signerAccount) {
                modalData.signerAccount = auth.actor;
            }
            const status = await this.launch(publicKey, modalData);
            return {status, auth};
        }
    }

    async launch(publicKey: string, modalData?: TrxModalData): Promise<any> {
        if (modalData) {
            this.modalData.next(modalData);
        }
        return new Promise((resolve) => {
            this.launcher.emit({
                visibility: true,
                mode: this.crypto.getPrivateKeyMode(publicKey)
            });
            const subs = this.status.subscribe((event) => {
                if (event === 'done') {
                    subs.unsubscribe();
                }
                if (event === 'modal_closed') {
                    subs.unsubscribe();
                }
                resolve(event);
            });
        });
    }

    getAuth(account?: any): [{ actor: string, permission: string } | null, string | null] {

        // get selected account if none was provided
        const actor = account ?? this.aService.selected.getValue();

        // lookup active key
        let _permission = 'active';
        let publicKey = '';
        let validKey = false;
        const activePerm = actor.details.permissions.find((p) => p.perm_name === _permission);
        if (activePerm.required_auth.keys.length > 0) {
            publicKey = activePerm.required_auth.keys[0].key;
            validKey = this.crypto.checkPublicKey(publicKey);
        }

        // if the active key is not found
        if (!validKey) {
            _permission = '';
            for (const perm of actor.details.permissions) {
                if (perm.required_auth.keys.length > 0) {
                    if (this.crypto.checkPublicKey(perm.required_auth.keys[0].key)) {
                        _permission = perm.perm_name;
                        publicKey = perm.required_auth.keys[0].key;
                        break;
                    }
                }
            }
        }

        if (_permission !== '') {
            return [{actor: actor.name, permission: _permission}, publicKey];
        } else {
            return [null, null];
        }
    }

    getAllAuth(account?: any) {

        // get selected account if none was provided
        const actor = account ?? this.aService.selected.getValue();

        // lookup active key
        let _permission = '';
        let publicKey = '';
        // list all permissions
        let authArr = [];
            for (const perm of actor.details.permissions) {
                if (perm.required_auth.keys.length > 0) {
                    if (this.crypto.checkPublicKey(perm.required_auth.keys[0].key)) {
                        _permission = perm.perm_name;
                        publicKey = perm.required_auth.keys[0].key;
                        authArr.push({auth:{actor: actor.name, permission: _permission},pubKey: publicKey});
                        //break;
                    }
                }
            // }
        }

        if (authArr.length >0) {
            return authArr;
        } else {
            return null;
        }
    }
}
