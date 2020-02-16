import {Injectable} from '@angular/core';
import {BehaviorSubject , Subject} from 'rxjs';
import {EOSJSService} from './eosio/eosjs.service';
import {HttpClient} from '@angular/common/http';
import {BodyOutputType , Toast , ToasterService} from 'angular2-toaster';
import {Eosjs2Service} from './eosio/eosjs2.service';

@Injectable ( {
	providedIn: 'root'
} )
export class AccountsService {

	public accounts: any[];
	public activeChain: any;
	public selected = new BehaviorSubject<any> ( {} );
	public lastAccount: any = null;
	public selectedIdx = 0;
	public lastUpdate = new Subject<any> ();
	public versionSys: string;

	usd_rate = 1;
	cmcListings = [];
	tokens = [];
	actions = [];
	totalActions: number;
	sessionTokens = {};
	allowed_actions = [];
	totalAssetsSum = 0;
	loading = true;
	isLedger = false;
	hasAnyLedgerAccount = false;
	actionStore = {};
	private loadingTokens = false;
	private lastTkLoadTime = 0;

	public isRefreshing = false;

	defaultChains: any[];

	constructor(
		private http: HttpClient ,
		private eos: EOSJSService ,
		private eosjs: Eosjs2Service ,
		private toaster: ToasterService ,
		// private ledger: LedgerHWService
	) {
		const configSimpleos = JSON.parse ( localStorage.getItem ( 'configSimpleos' ) );

		this.defaultChains = configSimpleos[ 'config' ][ 'chains' ];
		const savedChainId = localStorage.getItem ( 'simplEOS.activeChainID' );
		const EOS_MAINNET_ID = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';

		if (savedChainId) {
			this.activeChain = this.defaultChains.find ( (chain) => chain.id === savedChainId );
			if (!this.activeChain) {
				this.activeChain = this.defaultChains.find ( (chain) => chain.id === EOS_MAINNET_ID );
				localStorage.setItem ( 'simplEOS.activeChainID' , EOS_MAINNET_ID );
			}
		} else {
			this.activeChain = this.defaultChains.find ( (chain) => chain.id === EOS_MAINNET_ID );
			localStorage.setItem ( 'simplEOS.activeChainID' , EOS_MAINNET_ID );
		}

		this.accounts = [];
		this.usd_rate = 10.00;
		this.allowed_actions = [ 'transfer' , 'voteproducer' , 'undelegatebw' , 'delegatebw' ];
		this.fetchEOSprice ().catch ( (err) => {
			console.log ( err );
		} );

		this.eos.online.asObservable ().subscribe ( value => {
			if (value) {
				const store = localStorage.getItem ( 'actionStore.' + this.eos.chainID );
				if (store) {
					this.actionStore = JSON.parse ( store );
				} else {
					// console.log ( this.selected.getValue ().name , 'creating new actionStore' );
					if (this.selected.getValue ()[ 'name' ] !== undefined) {
						this.actionStore[ this.selected.getValue ()[ 'name' ] ] = {
							last_gs: 0 ,
							actions: []
						};
					}

				}
			}
		} );

		// if(this.mainnetActive['name']==='EOS MAINNET') {
		//   this.socket.on('action', (data) => {
		//     if (!this.actionStore[data.account]) {
		//       this.actionStore[data.account] = {
		//         last_gs: 0,
		//         actions: []
		//       };
		//     }
		//
		//     this.actionStore[data.account]['last_gs'] = data.data.receipt.global_sequence;
		//     const idx = this.actionStore[data.account]['actions'].findIndex((v) => {
		//       return v.receipt.act_digest === data.data.receipt.act_digest;
		//     });
		//     if (idx === -1) {
		//       this.actionStore[data.account]['actions'].push(data.data);
		//       this.totalActions = this.actionStore[data.account]['actions'].length;
		//     }
		//   });
		// }
	}

	getStoredKey(account) {
		const store = localStorage.getItem ( 'eos_keys.' + this.activeChain.id );
		let key = '';
		let _perm = '';
		if (store) {
			const keys = Object.keys ( JSON.parse ( store ) );
			account.details.permissions.forEach ( (p) => {
				if (p.required_auth.keys.length > 0) {
					const _k = p.required_auth.keys[ 0 ].key;
					if (keys.indexOf ( _k ) !== -1) {
						key = _k;
						_perm = p.perm_name;
					}
				}
			} );
		}
		return [ key , _perm ];
	}

	parseEOS(tk_string) {
		if (tk_string.split ( ' ' )[ 1 ] === this.activeChain[ 'symbol' ]) {
			return parseFloat ( tk_string.split ( ' ' )[ 0 ] );
		} else {
			return 0;
		}
	}

	extendAccount(acc) {
		let balance = 0;
		if (acc.tokens) {
			acc.tokens.forEach ( (tk) => {
				balance += this.parseEOS ( tk );
			} );
		}
		let net = 0;
		let cpu = 0;
		if (acc[ 'self_delegated_bandwidth' ]) {
			net = this.parseEOS ( acc[ 'self_delegated_bandwidth' ][ 'net_weight' ] );
			cpu = this.parseEOS ( acc[ 'self_delegated_bandwidth' ][ 'cpu_weight' ] );
			balance += net;
			balance += cpu;
		}

		const precisionRound = Math.pow ( 10 , this.activeChain[ 'precision' ] );
		return {
			name: acc[ 'account_name' ] ,
			full_balance: Math.round ( (balance) * precisionRound ) / precisionRound ,
			staked: net + cpu ,
			details: acc
		};
	}


	registerSymbol(data) {
		const idx = this.tokens.findIndex ( (val) => {
			return val.name === data[ 'symbol' ];
		} );
		let price = null;
		let usd_value = null;
		if (data[ 'price' ]) {
			price = data[ 'price' ];
			usd_value = data[ 'usd_value' ];
		}
		if (idx === -1) {
			const obj = {
				name: data[ 'symbol' ] ,
				contract: data[ 'contract' ] ,
				balance: data[ 'balance' ] ,
				precision: data[ 'precision' ] ,
				price: price ,
				usd_value: usd_value
			};
			this.sessionTokens[ this.selectedIdx ].push ( obj );
			this.tokens.push ( obj );
		}
	}

	calcTotalAssets() {
		let totalSum = 0;
		this.tokens.forEach ( tk => {
			if (tk.price) {
				totalSum += (tk.balance * tk.price);
			}
		} );
		this.totalAssetsSum = totalSum;
	}

	async fetchTokens(account) {
		// console.log(this.sessionTokens[this.selectedIdx]);
		// console.log('loadingTokens', this.loadingTokens);
		// console.log('loadingTokens Diff time',((Date.now() - this.lastTkLoadTime > 60 * 1000)));
		// console.log('Tokens length',this.tokens.length);
		if (!this.loadingTokens && ((Date.now () - this.lastTkLoadTime > 60 * 1000) || this.tokens.length === 0)) {
			this.loadingTokens = true;
			this.sessionTokens[ this.selectedIdx ] = [];
			if (this.activeChain[ 'name' ] === 'EOS MAINNET') {
				const data = await this.http.get ( 'https://hapi.eosrio.io/data/v2/tokens/' + account ).toPromise ();
				this.lastTkLoadTime = Date.now ();
				const tokens = Object.keys ( data );
				this.loading = false;
				tokens.forEach ( (idx) => {
					if (data[ idx ][ 'symbol' ] !== this.activeChain[ 'symbol' ]) {
						this.registerSymbol ( data[ idx ] );
					}
				} );
				this.tokens.sort ( (a: any , b: any) => {
					return a.usd_value < b.usd_value ? 1 : -1;
				} );
				this.accounts[ this.selectedIdx ][ 'tokens' ] = this.tokens;
				this.loadingTokens = false;
				return this.accounts;
			} else {
				if (this.activeChain.historyApi !== '') {
					// Load with hyperion
					const data = await this.http.get ( this.activeChain.historyApi + '/state/get_tokens?account=' + account ).toPromise ();
					const tokens = data[ 'tokens' ];
					for (const token of tokens) {
						if (token.symbol !== this.activeChain[ 'symbol' ]) {
							token[ 'balance' ] = token[ 'amount' ];
							token[ 'usd_value' ] = 0;
							this.registerSymbol ( token );
						}
					}
					this.tokens.sort ( (a: any , b: any) => {
						if (a.symbol < b.symbol) {
							return -1;
						}
						if (a.symbol > b.symbol) {
							return 1;
						}
						return 0;
					} );
					this.lastTkLoadTime = Date.now ();
					this.loading = false;
					this.accounts[ this.selectedIdx ][ 'tokens' ] = this.tokens;
					this.loadingTokens = false;
					return this.accounts;
				} else {
					this.loading = false;
					this.loadingTokens = false;
					this.lastTkLoadTime = Date.now ();
					return null;
				}
			}
		} else {
			if (this.tokens.length > 0) {
				this.loadingTokens = false;
			}
			this.loading = false;
			return null;
		}
	}

	getTokenBalances() {
		this.tokens.forEach ( (tk , index) => {
			if (this.tokens[ index ]) {
				this.fetchTokenPrice ( tk.name ).then ( (price) => {
					this.tokens[ index ][ 'price' ] = price;
				} );
			}
		} );
	}


	processAction(act , id , block_num , date , account_action_seq) {
		const contract = act[ 'account' ];
		const action_name = act[ 'name' ];
		let symbol = '' , user = '' , type = '' , memo = '';
		let votedProducers = null , proxy = null , voter = null;
		let cpu = 0 , net = 0 , amount = 0;

		if (typeof act.data === 'object') {

			if (action_name === 'transfer') {
				if (this.activeChain.historyApi !== '') {
					amount = act[ 'data' ][ 'amount' ];
					symbol = act[ 'data' ][ 'symbol' ];
				} else {
					if (contract === 'eosio.token') {
						// NATIVE TOKEN
						amount = parseFloat ( act[ 'data' ][ 'quantity' ][ 'split' ] ( ' ' )[ 0 ] );
						symbol = this.activeChain[ 'symbol' ];
					} else {
						// CUSTOM TOKEN
						amount = parseFloat ( act[ 'data' ][ 'quantity' ][ 'split' ] ( ' ' )[ 0 ] );
						symbol = act[ 'data' ][ 'quantity' ][ 'split' ] ( ' ' )[ 1 ];
					}
				}
				memo = act[ 'data' ][ 'memo' ];
				if (act[ 'data' ][ 'to' ] === this.selected.getValue ().name) {
					user = act[ 'data' ][ 'from' ];
					type = 'received';
				} else {
					user = act[ 'data' ][ 'to' ];
					type = 'sent';
				}
			}
			if (action_name === 'buyrambytes') {
				amount = act[ 'data' ][ 'bytes' ];
				symbol = 'bytes';
				if (act[ 'data' ][ 'receiver' ] === this.selected.getValue ().name) {
					user = act[ 'data' ][ 'payer' ];
					type = 'bytes_in';
				} else {
					user = act[ 'data' ][ 'receiver' ];
					type = 'bytes_out';
				}
			}
			if (action_name === 'sellram') {
				amount = act[ 'data' ][ 'bytes' ];
				symbol = 'bytes';
				user = act[ 'data' ][ 'account' ];
				type = 'bytes_s';
			}
			if (contract === 'eosio' && action_name === 'voteproducer') {
				votedProducers = act[ 'data' ][ 'producers' ];
				proxy = act[ 'data' ][ 'proxy' ];
				voter = act[ 'data' ][ 'voter' ];
				type = 'vote';
			}
			if (contract === 'eosio' && action_name === 'undelegatebw') {
				cpu = parseFloat ( act[ 'data' ][ 'unstake_cpu_quantity' ].split ( ' ' )[ 0 ] );
				net = parseFloat ( act[ 'data' ][ 'unstake_net_quantity' ].split ( ' ' )[ 0 ] );
				amount = cpu + net;
				if (act[ 'data' ][ 'from' ] === act[ 'data' ][ 'receiver' ]) {
					user = act[ 'data' ][ 'from' ];
					type = 'unstaked_in';
				} else {
					user = act[ 'data' ][ 'receiver' ];
					type = 'unstaked_out';
				}
			}
			if (contract === 'eosio' && action_name === 'delegatebw') {
				cpu = parseFloat ( act[ 'data' ][ 'stake_cpu_quantity' ].split ( ' ' )[ 0 ] );
				net = parseFloat ( act[ 'data' ][ 'stake_net_quantity' ].split ( ' ' )[ 0 ] );
				amount = cpu + net;
				if (act[ 'data' ][ 'from' ] === act[ 'data' ][ 'receiver' ]) {
					user = act[ 'data' ][ 'from' ];
					type = 'staked_in';
				} else {
					user = act[ 'data' ][ 'receiver' ];
					type = 'staked_out';
				}
			}


			if ((contract === 'eosio' && action_name === 'refund')) {
				type = 'refund';
			}

			if (act[ 'data' ][ 'to' ] === 'eosio.ram') {
				type = 'buyram';
			}
			if (act[ 'data' ][ 'from' ] === 'eosio.ram') {
				type = 'sellram';
			}
			if ((contract !== 'eosio' && contract !== 'eosio.token' && action_name !== 'transfer')) {
				if (!act[ 'data' ][ 'to' ] && !act[ 'data' ][ 'from' ]) {
					type = 'other';
					const dataInfo = act[ 'data' ];
					Object.keys ( dataInfo ).forEach ( (dt) => {
						memo += dt + ': ' + dataInfo[ dt ] + '; ';
					} );
				} else {
					type = 'other2';
					const dataInfo = act[ 'data' ];
					Object.keys ( dataInfo ).forEach ( (dt) => {
						memo += dt + ': ' + dataInfo[ dt ] + '; ';
					} );
				}

			}
			if ((contract === 'eosio' && action_name === 'newaccount')) {
				type = 'new';
				user = act[ 'data' ][ 'newact' ];
				memo = JSON.stringify ( act[ 'data' ] );
			}
			if ((contract === 'eosio' && action_name === 'mvtosavings')) {
				type = 'mvtosavings';
				amount = parseFloat ( act[ 'data' ][ 'rex' ].split ( ' ' )[ 0 ] );
				symbol = 'REX';
			}
			if ((contract === 'eosio' && action_name === 'mvfrsavings')) {
				type = 'mvfrsavings';
				amount = parseFloat ( act[ 'data' ][ 'rex' ].split ( ' ' )[ 0 ] );
				symbol = 'REX';
			}
			if ((contract === 'eosio' && action_name === 'unstaketorex')) {
				type = 'unstaketorex';
				cpu = parseFloat ( act[ 'data' ][ 'from_cpu' ].split ( ' ' )[ 0 ] );
				net = parseFloat ( act[ 'data' ][ 'from_net' ].split ( ' ' )[ 0 ] );
				amount = cpu + net;
			}
			if ((contract === 'eosio' && action_name === 'deposit')) {
				type = 'deposit';
			}
			if ((contract === 'eosio' && action_name === 'buyrex')) {
				type = 'buyrex';
				amount = parseFloat ( act[ 'data' ][ 'amount' ].split ( ' ' )[ 0 ] );
			}
			if ((contract === 'eosio' && action_name === 'deposit')) {
				type = 'deposit';
				amount = parseFloat ( act[ 'data' ][ 'amount' ].split ( ' ' )[ 0 ] );
			}
			if ((contract === 'eosio' && action_name === 'withdraw')) {
				type = 'withdraw';
				amount = parseFloat ( act[ 'data' ][ 'amount' ].split ( ' ' )[ 0 ] );
			}
			if ((contract === 'eosio' && action_name === 'sellrex')) {
				type = 'sellrex';
				amount = parseFloat ( act[ 'data' ][ 'rex' ].split ( ' ' )[ 0 ] );
				symbol = 'REX';
			}
			if ((contract === 'eosio' && action_name === 'rentcpu')) {
				type = 'rentcpu';
				user = act[ 'data' ][ 'receiver' ] === this.selected.getValue ().name ? 'this account' : act[ 'data' ][ 'receiver' ];
				amount = parseFloat ( act[ 'data' ][ 'loan_payment' ].split ( ' ' )[ 0 ] );
			}
			if ((contract === 'eosio' && action_name === 'rentnet')) {
				user = act[ 'data' ][ 'receiver' ] === this.selected.getValue ().name ? 'this account' : act[ 'data' ][ 'receiver' ];
				type = 'rentnet';
				amount = parseFloat ( act[ 'data' ][ 'loan_payment' ].split ( ' ' )[ 0 ] );
			}

		}

		const allowedActions = [
			'eosio::newaccount' ,
			'eosio.token::transfer' ,
			'eosio::delegatebw' ,
			'eosio::undelegatebw' ,
			'eosio::refund' ,
			'eosio::voteproducer' ,
			'eosio::sellram' ,
			'eosio::buyrambytes' ,
			'eosio::mvtosavings' ,
			'eosio::mvfrsavings' ,
			'eosio::unstaketorex' ,
			'eosio::buyrex' ,
			'eosio::sellrex' ,
			'eosio::deposit' ,
			'eosio::withdraw' ,
			'eosio::rentcpu' ,
			'eosio::rentnet'
		];

		const matched = allowedActions.includes ( contract + '::' + action_name );
		const precisionRound = Math.pow ( 10 , this.activeChain[ 'precision' ] );
		const obj = {
			id: id ,
			seq: account_action_seq ,
			type: type ,
			action_name: action_name ,
			contract: contract ,
			user: user ,
			block: block_num ,
			date: date ,
			amount: (Math.round ( amount * precisionRound ) / precisionRound) ,
			symbol: symbol ,
			memo: memo ,
			votedProducers: votedProducers ,
			proxy: proxy ,
			voter: voter ,
			matched: matched ,
			json_data: act[ 'data' ]
		};
		// this.actions.unshift(obj);

		if (this.actions.findIndex ( (a) => {
			return obj.seq === a.seq;
		} ) === -1) {
			this.actions.push ( obj );
		}
	}

	getAccActions(account) {
		const nActions = 100;

		if (account === null) {
			account = this.selected.getValue ().name;
		}

		const store = localStorage.getItem ( 'actionStore.' + this.activeChain[ 'id' ] );
		if (store) {
			this.actionStore = JSON.parse ( store.toString () );
		}
		if (!this.actionStore[ this.selected.getValue ().name ]) {
			this.actionStore[ this.selected.getValue ().name ] = {
				last_gs: 0 ,
				actions: []
			};
		}

		if (this.activeChain.historyApi !== '') {
			this.getActions ( account , 12 , 0 );
		} else {
			// console.log('Fetching actions', account, reload);


			// Test if mongo is available
			const currentEndpoint = this.activeChain.endpoints.find ( (e) => e.url === this.eos.baseConfig.httpEndpoint );
			if (currentEndpoint[ 'version' ]) {
				if (currentEndpoint[ 'version' ] === 'mongo') {
					this.getActions ( account , nActions , 0 );
				} else {
					this.getActions ( account , -(nActions) , -1 );
				}
			} else {
				// Test API
				this.getActions ( account , nActions , 0 );
				console.log ( 'Starting history api test' );


			}
		}
	}

	getActions(account , offset , pos , filter? , after? , before? , parent?) {
		this.actions = [];
		this.totalActions = 0;
		if (this.activeChain.historyApi !== '') {
			let url = this.activeChain.historyApi + '/history/get_actions?account=' + account + '&limit=' + offset + '&skip=' + pos;
			url = url + (filter !== '' && filter !== undefined ? filter : '');
			url = url + (after !== '' && after !== undefined ? '&after=' + after : '');
			url = url + (before !== '' && before !== undefined ? '&before=' + before : '');
			url = url + (parent !== '' && parent !== undefined ? '&parent=' + parent : '');
			this.http.get ( url ).subscribe ( (result) => {
				if (result[ 'actions' ]) {
					if (result[ 'actions' ].length > 0) {
						this.actionStore[ account ][ 'actions' ] = result[ 'actions' ];
						const payload = JSON.stringify ( this.actionStore );
						localStorage.setItem ( 'actionStore.' + this.activeChain[ 'id' ] , payload );
						this.actionStore[ account ][ 'actions' ].forEach ( (action) => {
							const act = action[ 'act' ];
							const tx_id = action[ 'trx_id' ];
							const blk_num = action[ 'block_num' ];
							const blk_time = action[ '@timestamp' ];
							const seq = action[ 'global_sequence' ];
							this.processAction ( act , tx_id , blk_num , blk_time , seq );
						} );
						this.totalActions = result[ 'total' ][ 'value' ];
						this.accounts[ this.selectedIdx ][ 'actions' ] = this.actions;
						this.calcTotalAssets ();
					} else {
						this.actionStore[ account ][ 'actions' ] = {};
						this.actions = [];
					}
				} else {
					console.log ( 'empty result history!' );
					this.actions = [];
					this.totalActions = 0;
				}
			} , (err) => {
				console.log ( err );
			} );
		} else {
			this.eos.getAccountActions ( account , offset , pos ).then ( val => {
				console.log ( val );
				const actions = val[ 'actions' ];
				if (actions.length > 0) {
					this.actionStore[ account ][ 'actions' ] = actions;
					const payload = JSON.stringify ( this.actionStore );
					localStorage.setItem ( 'actionStore.' + this.activeChain[ 'id' ] , payload );
				}
				this.actionStore[ account ][ 'actions' ].forEach ( (action) => {

					let a_name , a_acct , a_recv , selAcc , act , tx_id , blk_num , blk_time , seq;
					if (action[ 'action_trace' ]) {
						// native history api
						a_name = action[ 'action_trace' ][ 'act' ][ 'name' ];
						a_acct = action[ 'action_trace' ][ 'act' ][ 'account' ];
						a_recv = action[ 'action_trace' ][ 'receipt' ][ 'receiver' ];
						selAcc = this.selected.getValue ().name;

						act = action[ 'action_trace' ][ 'act' ];
						tx_id = action[ 'action_trace' ][ 'trx_id' ];
						blk_num = action[ 'block_num' ];
						blk_time = action[ 'block_time' ];
						seq = action[ 'account_action_seq' ];

					} else {
						// mongo history api
						a_name = action[ 'act' ][ 'name' ];
						a_acct = action[ 'act' ][ 'account' ];
						a_recv = action[ 'receipt' ][ 'receiver' ];
						selAcc = this.selected.getValue ().name;

						act = action[ 'act' ];
						tx_id = action[ 'trx_id' ];
						blk_num = action[ 'block_num' ];
						blk_time = action[ 'block_time' ];
						seq = action[ 'receipt' ][ 'global_sequence' ];
					}

					if (a_recv === selAcc || (a_recv === a_acct && a_name !== 'transfer')) {
						this.processAction ( act , tx_id , blk_num , blk_time , seq );
					}
				} );

				this.totalActions = this.actions.length;
				this.accounts[ this.selectedIdx ][ 'actions' ] = this.actions;
				this.calcTotalAssets ();
			} ).catch ( (err) => {
				console.log ( err );
			} );
		}
	}

	reloadActions(account) {
		this.getAccActions ( account );
	}

	select(index) {
		const sel = this.accounts[ index ];
		this.loading = true;
		this.tokens = [];
		if (sel) {
			if (sel[ 'actions' ] && sel) {
				if (sel.actions.length > 0) {
					this.actions = sel.actions;
				}
			} else {
				this.actions = [];
			}
			this.selectedIdx = index;
			this.selected.next ( sel );
			this.fetchTokens ( sel.name ).catch ( console.log );
		}
		// const pbk = this.selected.getValue().details.permissions[0].required_auth.keys[0].key;
		// const stored_data = JSON.parse(localStorage.getItem('eos_keys.' + this.eos.chainID));
		// if(this.isLedger){
		//   this.isLedger = stored_data[pbk]['private'] === 'ledger';
		// }
	}

	initFirst() {
		this.select ( 0 );
	}

	async importAccounts(accounts): Promise<any[]> {
		const chain_id = this.eos.chainID;
		const payload = {importedOn: new Date () , updatedOn: new Date () , accounts: accounts};
		localStorage.setItem ( 'simpleos.accounts.' + chain_id , JSON.stringify ( payload ) );
		localStorage.setItem ( 'simplEOS.init' , 'true' );
		await this.loadLocalAccounts ( accounts );
		return accounts;
	}

	appendNewAccount(account) {
		return new Promise ( (resolve , reject2) => {
			const chain_id = this.eos.chainID;
			let payload = JSON.parse ( localStorage.getItem ( 'simpleos.accounts.' + chain_id ) );
			if (!payload) {
				payload = {
					accounts: [ account ] ,
					updatedOn: new Date ()
				};
			} else {
				payload.accounts.push ( account );
				payload[ 'updatedOn' ] = new Date ();
			}
			localStorage.setItem ( 'simpleos.accounts.' + chain_id , JSON.stringify ( payload ) );
			localStorage.setItem ( 'simplEOS.init' , 'true' );
			this.loadLocalAccounts ( payload.accounts ).then ( (data) => {
				resolve ( data );
			} ).catch ( () => {
				reject2 ();
			} );
		} );
	}

	async appendAccounts(accounts) {
		const chain_id = this.eos.chainID;
		const payload = JSON.parse ( localStorage.getItem ( 'simpleos.accounts.' + chain_id ) );
		accounts.forEach ( (account) => {
			const idx = payload.accounts.findIndex ( (elem) => {
				return elem.name === account.account_name || elem.account_name === account.account_name;
			} );
			if (idx === -1) {
				payload.accounts.push ( account );
			} else {
				const toast: Toast = {
					type: 'info' ,
					title: 'Import' ,
					body: 'The account ' + account.account_name + ' was already imported! Skipping...' ,
					timeout: 10000 ,
					showCloseButton: true ,
					bodyOutputType: BodyOutputType.TrustedHtml ,
				};
				this.toaster.popAsync ( toast );
			}
		} );
		payload.updatedOn = new Date ();
		localStorage.setItem ( 'simpleos.accounts.' + chain_id , JSON.stringify ( payload ) );
		localStorage.setItem ( 'simplEOS.init' , 'true' );
		return await this.loadLocalAccounts ( payload.accounts );
	}

	async loadLocalAccounts(data) {
		if (data.length > 0) {
			this.accounts = [];
			data.forEach ( (acc_data) => {
				acc_data.tokens = [];
				if (!acc_data.details) {
					this.accounts.push ( this.extendAccount ( acc_data ) );
				} else {
					this.accounts.push ( acc_data );
				}
			} );
			this.select ( 0 );
			return await this.refreshFromChain ();
		} else {
			return null;
		}
	}

	async refreshFromChain() {
		this.isRefreshing = true;
		const PQ = [];

		this.accounts.forEach ( (account , idx) => {
			// const tempPromise = new Promise(async (resolve, reject2) => {
			const tempPromise = new Promise ( async (resolve) => {
				const newdata = await this.eos.getAccountInfo ( account[ 'name' ] );
				const tokens = await this.eos.getTokens ( account[ 'name' ] );
				let balance = 0;
				let ref_time = null;
				let ref_cpu = 0;
				let ref_net = 0;
				const refund = newdata[ 'refund_request' ];
				if (refund) {
					ref_cpu = this.parseEOS ( refund[ 'cpu_amount' ] );
					ref_net = this.parseEOS ( refund[ 'net_amount' ] );
					balance += ref_net;
					balance += ref_cpu;
					const tempDate = refund[ 'request_time' ] + '.000Z';
					ref_time = new Date ( tempDate );
				}
				tokens.forEach ( (tk) => {
					balance += this.parseEOS ( tk );
				} );
				let net = 0;
				let cpu = 0;
				if (newdata[ 'self_delegated_bandwidth' ]) {
					net = this.parseEOS ( newdata[ 'self_delegated_bandwidth' ][ 'net_weight' ] );
					cpu = this.parseEOS ( newdata[ 'self_delegated_bandwidth' ][ 'cpu_weight' ] );
					balance += net;
					balance += cpu;
				}

				const precisionRound = Math.pow ( 10 , this.activeChain[ 'precision' ] );

				this.accounts[ idx ].name = account[ 'name' ];
				this.accounts[ idx ].full_balance = Math.round ( (balance) * precisionRound ) / precisionRound;
				this.accounts[ idx ].staked = net + cpu;
				this.accounts[ idx ].unstaking = ref_net + ref_cpu;
				this.accounts[ idx ].unstakeTime = ref_time;
				this.accounts[ idx ].details = newdata;
				this.lastUpdate.next ( {
					account: account[ 'name' ] ,
					timestamp: new Date ()
				} );
				resolve ();
			} );
			PQ.push ( tempPromise );
		} );
		return await Promise.all ( PQ ).then ( async () => {
			await this.fetchTokens ( this.selected.getValue ().name );
			const result = await this.eos.storeAccountData ( this.accounts );
			this.isRefreshing = false;
			return result;

		} );
	}

	fetchListings() {
		this.http.get ( 'https://api.coinmarketcap.com/v2/listings/' ).subscribe ( (result: any) => {
			this.cmcListings = result.data;
		} );
	}

	async fetchTokenPrice(symbol) {
		let id = null;
		for (let i = 0; i < this.cmcListings.length; i++) {
			if (this.cmcListings[ i ].symbol === symbol) {
				id = this.cmcListings[ i ].id;
			}
		}
		if (id && symbol === 'EOSDAC') {
			const result: any = await this.http.get ( 'https://api.coinmarketcap.com/v2/ticker/' + id + '/' ).toPromise ();
			return parseFloat ( result.data.quotes.USD[ 'price' ] );
		} else {
			return null;
		}
	}

	async fetchEOSprice() {
		if (this.activeChain[ 'name' ] === 'EOS MAINNET') {
			try {
				const priceresult = await this.eosjs.getMainnetTableRows('delphioracle', 'eosusd', 'datapoints');
				this.usd_rate = priceresult.rows[0].median / 10000;
			} catch (e) {
				console.log(e);
				this.usd_rate = 0;
			}
		}
		return null;
	}

	// checkLedgerAccounts() {
	// 	let hasLedger = false;
	// 	const stored_data = localStorage.getItem('eos_keys.' + this.eos.chainID);
	// 	return new Promise(resolve => {
	// 		this.accounts.forEach((acc) => {
	// 			const pbk = acc.details.permissions[0].required_auth.keys[0];
	// 			// if (stored_data[pbk]['private'] === 'ledger') {
	// 			//   hasLedger = true;
	// 			// }
	// 		});
	// 		this.hasAnyLedgerAccount = hasLedger;
	// 		resolve(hasLedger);
	// 	});
	// }

	injectLedgerSigner() {
		console.log ( 'Ledger mode: ' + this.isLedger );
		if (this.isLedger) {
			const store = JSON.parse ( localStorage.getItem ( 'eos_keys.' + this.eos.chainID ) );
			const pbk = this.selected.getValue ().details[ 'permissions' ][ 0 ][ 'required_auth' ].keys[ 0 ].key;
			console.log ( 'Publickey:' , pbk );
			console.log ( store );
			// if (store[pbk]['private'] === 'ledger') {
			//   this.ledger.enableLedgerEOS(store[pbk]['slot']);
			// } else {
			//   this.eos.clearSigner();
			// }
		} else {
			this.eos.clearSigner ();
		}
	}
}
