import {EventEmitter , Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {AccountsService} from './accounts.service';
import {CryptoService} from './crypto.service';

export interface TrxModalData {
	labelHTML: string;
	termsHTML: string;
	termsHeader: string;
	actionTitle: string;
	signerPublicKey: string;
	signerAccount: string;
	transactionPayload: any;
	errorFunc?: any;
}

@Injectable ( {
	providedIn: 'root'
} )
export class TransactionFactoryService {

	public modalData: BehaviorSubject<TrxModalData>;
	public launcher: EventEmitter<boolean>;
	public status: EventEmitter<string>;

	constructor(
		private aService: AccountsService ,
		private crypto: CryptoService
	) {
		this.launcher = new EventEmitter<any> ();
		this.status = new EventEmitter<string> ( true );
		this.modalData = new BehaviorSubject<TrxModalData> ( {
			labelHTML: '' ,
			termsHTML: '' ,
			termsHeader: '' ,
			actionTitle: '' ,
			signerPublicKey: '' ,
			signerAccount: '' ,
			transactionPayload: {} ,
			errorFunc: null
		} );
	}

	getAuth() {
		const actor = this.aService.selected.getValue ();
		// find active key
		let _permission = 'active';
		let publicKey = actor.details[ 'permissions' ].find ( (p) => p.perm_name === 'active' )[ 'required_auth' ].keys[ 0 ].key;
		const validKey = this.crypto.checkPublicKey ( publicKey );
		if (!validKey) {
			for (const perm of actor.details[ 'permissions' ]) {
				if (this.crypto.checkPublicKey ( perm[ 'required_auth' ].keys[ 0 ].key )) {
					_permission = perm.perm_name;
					publicKey = perm[ 'required_auth' ].keys[ 0 ].key;
					break;
				}
			}
			console.log ( `non-active permission selected: ${_permission}` );
		}
		return [ {
			actor: actor.name ,
			permission: _permission
		} , publicKey ];
	}
}
