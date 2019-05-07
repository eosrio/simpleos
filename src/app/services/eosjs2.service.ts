import {Injectable} from '@angular/core';
import {Api, JsonRpc} from 'eosjs';
import {SignatureProvider, SignatureProviderArgs} from 'eosjs/dist/eosjs-api-interfaces';
import {PushTransactionArgs} from 'eosjs/dist/eosjs-rpc-interfaces';

const {JsSignatureProvider} = require('eosjs/dist/eosjs-jssig');

export class SimpleosSigProvider implements SignatureProvider {
	localRPC: JsonRpc;

	constructor(_rpc: JsonRpc) {
		this.localRPC = _rpc;
	}

	async processTrx(binaryData) {
		const args = {
			rpc: this.localRPC,
			authorityProvider: undefined,
			abiProvider: undefined,
			signatureProvider: this,
			chainId: undefined,
			textEncoder: undefined,
			textDecoder: undefined
		};
		const api = new Api(args);
		return await api.deserializeTransactionWithActions(binaryData);
	}

	getAvailableKeys(): Promise<string[]> {
		console.log('get available keys');
		return new Promise((resolve, reject) => {
			resolve(['']);
		});
	}

	sign(args: SignatureProviderArgs): Promise<PushTransactionArgs> {
		console.log('Incoming signature request');
		console.log(args);
		return new Promise((resolve, reject) => {
			resolve({
				signatures: [''],
				serializedTransaction: new Uint8Array()
			});
		});
	}
}

@Injectable({
	providedIn: 'root'
})
export class Eosjs2Service {
	rpc: JsonRpc;
	textEncoder: TextEncoder;
	textDecoder: TextDecoder;
	public localSigProvider: SimpleosSigProvider;
	public activeEndpoint: string;
	public chainId: string;

	private JsSigProvider: SignatureProvider;
	private api: Api;
	private defaultMainnetEndpoint = 'https://api.eosrio.io';

	constructor() {
		this.rpc = null;
		this.textDecoder = new TextDecoder();
		this.textEncoder = new TextEncoder();
	}

	initRPC(endpoint, chainID) {
		this.activeEndpoint = endpoint;
		this.chainId = chainID;
		this.rpc = new JsonRpc(this.activeEndpoint);
		this.localSigProvider = new SimpleosSigProvider(this.rpc);
	}

	initAPI(key) {
		this.JsSigProvider = new JsSignatureProvider([key]);
		this.api = new Api({rpc: this.rpc, signatureProvider: this.JsSigProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder()});
		setTimeout(() => {
			this.JsSigProvider = null;
			this.api = null;
		}, 5000);
	}

	signTrx(trx) {
		return this.api.transact(trx, {
			blocksBehind: 3,
			expireSeconds: 30,
			broadcast: false,
			sign: true
		});
	}

	transact(trx) {
		return this.api.transact(trx, {
			blocksBehind: 3,
			expireSeconds: 30,
		});
	}

	async getTableRows(_code: string, _scope: string, _table: string) {
		return this.rpc.get_table_rows({
			code: _code,
			scope: _scope,
			table: _table
		});
	}

	async getMainnetTableRows(_code: string, _scope: string, _table: string) {
		const tempRpc = new JsonRpc(this.defaultMainnetEndpoint);
		return tempRpc.get_table_rows({
			code: _code,
			scope: _scope,
			table: _table
		});
	}

	async getRexPool(): Promise<any> {
		const rexpool = await this.rpc.get_table_rows({
			json: true,
			code: 'eosio',
			scope: 'eosio',
			table: 'rexpool'
		});
		return rexpool.rows[0];
	}

	async getRexData(_account: string): Promise<any> {
		const rexbal_rows = await this.rpc.get_table_rows({
			json: true,
			code: 'eosio',
			scope: 'eosio',
			table: 'rexbal',
			lower_bound: _account,
			limit: 1
		});
		const rexbal_data = rexbal_rows.rows.find(row => row.owner === _account);
		const rexfund_rows = await this.rpc.get_table_rows({
			json: true,
			code: 'eosio',
			scope: 'eosio',
			table: 'rexfund',
			lower_bound: _account,
			limit: 1
		});
		const rexfund_data = rexfund_rows.rows.find(row => row.owner === _account);
		return {
			rexbal: rexbal_data,
			rexfund: rexfund_data
		};
	}

	async recursiveFetchTableRows(array: any[], _code: string, _scope: string, _table: string, _pkey: string, LB: string, _batch: number) {
		const data = await this.rpc.get_table_rows({
			json: true,
			code: _code,
			scope: _scope,
			table: _table,
			limit: _batch,
			lower_bound: LB
		});
		let batch_size = _batch;
		if (LB !== '') {
			data.rows.shift();
			batch_size--;
		}
		array.push(...data.rows);
		const last_elem = data.rows[data.rows.length - 1];
		const last_pk = last_elem[_pkey];
		if (data.rows.length === batch_size) {
			await this.recursiveFetchTableRows(array, _code, _scope, _table, _pkey, last_pk, _batch);
		}
	}

	async getProxies(contract): Promise<any> {
		const result = {
			rows: []
		};
		if (contract !== '') {
			await this.recursiveFetchTableRows(result.rows, contract, contract, 'proxies', 'owner', '', 100);
		}
		return result;
	}

	async getLoans(account: string): Promise<any> {
		const loans = {
			cpu: [],
			net: []
		};
		const data = await Promise.all([this.rpc.get_table_rows({
			json: true,
			code: 'eosio',
			table: 'cpuloan',
			scope: 'eosio',
			index_position: 3,
			key_type: 'i64',
			lower_bound: account,
			limit: 25
		}), this.rpc.get_table_rows({
			json: true,
			code: 'eosio',
			table: 'netloan',
			scope: 'eosio',
			index_position: 3,
			key_type: 'i64',
			lower_bound: account,
			limit: 25
		})]);
		// Extract owner's CPU loans
		for (const row of data[0].rows) {
			if (row.from === account) {
				loans.cpu.push(row);
			}
		}
		// Extract owner's NET loans
		for (const row of data[1].rows) {
			if (row.from === account) {
				loans.net.push(row);
			}
		}
		return loans;
	}

	async checkSimpleosUpdate() {
		const tempRpc = new JsonRpc(this.defaultMainnetEndpoint);
		return tempRpc.get_table_rows({
			json: true,
			code: 'simpleosvers',
			scope: 'simpleosvers',
			table: 'info'
		});
	}
}
