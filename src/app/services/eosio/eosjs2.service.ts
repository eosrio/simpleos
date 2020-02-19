import {Injectable} from '@angular/core';
import {
    SignatureProvider,
    SignatureProviderArgs,
} from 'eosjs/dist/eosjs-api-interfaces';
import {Api, JsonRpc} from 'eosjs';
import {PushTransactionArgs} from 'eosjs/dist/eosjs-rpc-interfaces';
import {JsSignatureProvider} from 'eosjs/dist/eosjs-jssig';
import ecc from 'eosjs-ecc'
import {EOSJSService} from "./eosjs.service";

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
            textDecoder: undefined,
        };
        const api = new Api(args);
        return await api.deserializeTransactionWithActions(binaryData);
    }

    getAvailableKeys(): Promise<string[]> {
        console.log('get available keys');
        return new Promise((resolve) => {
            resolve(['']);
        });
    }

    sign(args: SignatureProviderArgs): Promise<PushTransactionArgs> {
        console.log('Incoming signature request');
        console.log(args);
        return new Promise((resolve) => {
            resolve({
                signatures: [''],
                serializedTransaction: new Uint8Array(),
            });
        });
    }
}

@Injectable({
    providedIn: 'root',
})
export class Eosjs2Service {

    constructor(
        private oldEOS: EOSJSService
    ) {
        this.rpc = null;
        this.textDecoder = new TextDecoder();
        this.textEncoder = new TextEncoder();
    }

    public ecc: any;
    rpc: JsonRpc;
    textEncoder: TextEncoder;
    textDecoder: TextDecoder;
    public localSigProvider: SimpleosSigProvider;
    public activeEndpoint: string;
    public chainId: string;

    private JsSigProvider: SignatureProvider;
    private api: Api;

    private activeChain = localStorage.getItem('simplEOS.activeChainID');

    private configLS = JSON.parse(localStorage.getItem('configSimpleos'));

    private defaultChain = this.configLS['config']['chains'].find(chain => chain.id === this.activeChain);
    private defaultMainnetEndpoint = this.defaultChain.firstApi;

    private EOSMainnetChain = this.configLS['config']['chains'].find(chain => chain.name === 'EOS MAINNET');
    private EOStMainnetEndpoint = this.EOSMainnetChain.firstApi;

    static makeDelegateBW(auth, from: string, receiver: string,
                          stake_net_quantity: string,
                          stake_cpu_quantity: string, transfer: boolean,
                          symbol: string) {
        return {
            account: 'eosio',
            name: 'delegatebw',
            authorization: [auth],
            data: {
                'from': from,
                'receiver': receiver,
                'stake_net_quantity': stake_net_quantity + ' ' + symbol,
                'stake_cpu_quantity': stake_cpu_quantity + ' ' + symbol,
                'transfer': transfer,
            },
        };
    }

    static makeUndelegateBW(auth: any, from: string, receiver: string,
                            unstake_net_quantity: string,
                            unstake_cpu_quantity: string, symbol: string) {
        return {
            account: 'eosio',
            name: 'undelegatebw',
            authorization: [auth],
            data: {
                'from': from,
                'receiver': receiver,
                'unstake_net_quantity': unstake_net_quantity + ' ' + symbol,
                'unstake_cpu_quantity': unstake_cpu_quantity + ' ' + symbol,
            },
        };
    }

    initRPC(endpoint, chainID) {
        this.activeEndpoint = endpoint;
        this.chainId = chainID;
        this.rpc = new JsonRpc(this.activeEndpoint);
        this.localSigProvider = new SimpleosSigProvider(this.rpc);
    }

    initAPI(key) {
        this.JsSigProvider = new JsSignatureProvider([key]);
        this.api = new Api({
            rpc: this.rpc,
            signatureProvider: this.JsSigProvider,
            textDecoder: new TextDecoder(),
            textEncoder: new TextEncoder(),
        });
        setTimeout(() => {
            this.JsSigProvider = null;
            this.api = null;
        }, 5000);
    }

    signTrx(trx: any, shouldBroadcast: boolean) {
        return this.api.transact(trx, {
            blocksBehind: 3,
            expireSeconds: 30,
            broadcast: shouldBroadcast,
            sign: true,
        });
    }

    transact(trx) {
        if (this.api) {
            return this.api.transact(trx, {
                blocksBehind: 3,
                expireSeconds: 30,
            });
        } else {
            return new Promise(resolve => {
                resolve('wrong_pass');
            });
        }
    }

    async getTableRows(_code: string, _scope: string, _table: string) {
        return this.rpc.get_table_rows({
            code: _code,
            scope: _scope,
            table: _table,
        });
    }

    async getMainnetTableRows(_code: string, _scope: string, _table: string) {
        const tempRpc = new JsonRpc(this.defaultMainnetEndpoint);
        return tempRpc.get_table_rows({
            code: _code,
            scope: _scope,
            table: _table,
        });
    }

    async getEOSMainnetTableRows(_code: string, _scope: string,
                                 _table: string) {
        const tempRpc = new JsonRpc(this.EOStMainnetEndpoint);
        return tempRpc.get_table_rows({
            code: _code,
            scope: _scope,
            table: _table,
        });
    }

    async getRexPool(): Promise<any> {
        const rexpool = await this.rpc.get_table_rows({
            json: true,
            code: 'eosio',
            scope: 'eosio',
            table: 'rexpool',
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
            limit: 1,
        });
        const rexbal_data = rexbal_rows.rows.find(
            row => row.owner === _account);
        const rexfund_rows = await this.rpc.get_table_rows({
            json: true,
            code: 'eosio',
            scope: 'eosio',
            table: 'rexfund',
            lower_bound: _account,
            limit: 1,
        });
        const rexfund_data = rexfund_rows.rows.find(
            row => row.owner === _account);
        return {
            rexbal: rexbal_data,
            rexfund: rexfund_data,
        };
    }

    async recursiveFetchTableRows(array: any[], _code: string, _scope: string,
                                  _table: string, _pkey: string, LB: string,
                                  _batch: number) {
        const data = await this.rpc.get_table_rows({
            json: true,
            code: _code,
            scope: _scope,
            table: _table,
            limit: _batch,
            lower_bound: LB,
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
            await this.recursiveFetchTableRows(array, _code, _scope, _table,
                _pkey, last_pk, _batch);
        }
    }

    async getProxies(contract): Promise<any> {
        console.log('Getting proxy data via chain API');
        const result = {
            rows: [],
        };
        if (contract !== '') {
            await this.recursiveFetchTableRows(result.rows, contract, contract,
                'proxies', 'owner', '', 100);
        }
        return result;
    }

    async getLoans(account: string): Promise<any> {
        const loans = {
            cpu: [],
            net: [],
        };
        const data = await Promise.all([
            this.rpc.get_table_rows({
                json: true,
                code: 'eosio',
                table: 'cpuloan',
                scope: 'eosio',
                index_position: 3,
                key_type: 'i64',
                lower_bound: account,
                limit: 25,
            }), this.rpc.get_table_rows({
                json: true,
                code: 'eosio',
                table: 'netloan',
                scope: 'eosio',
                index_position: 3,
                key_type: 'i64',
                lower_bound: account,
                limit: 25,
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
        const tempRpc = new JsonRpc(this.EOStMainnetEndpoint);
        const data = await tempRpc.get_table_rows({
            json: true,
            code: 'simpleosvers',
            scope: 'simpleosvers',
            table: 'info',
        });
        if (data.rows.length > 0) {
            return data.rows[0];
        } else {
            return null;
        }
    }

    async createAccount(creator: string, name: string, owner: string,
                        active: string, delegateAmount: number,
                        rambytes: number, transfer: boolean,
                        giftAmount: number, giftMemo: string, symbol: string,
                        precision: number, permission): Promise<any> {
        const _actions = [];
        const auth = {
            actor: creator,
            permission: permission,
        };
        const _onwer = {
            'threshold': 1,
            'keys': [
                {
                    'key': owner,
                    'weight': 1,
                }],
            'accounts': [],
            'waits': [],
        };
        const _avtive = {
            'threshold': 1,
            'keys': [
                {
                    'key': active,
                    'weight': 1,
                }],
            'accounts': [],
            'waits': [],
        };

        _actions.push({
            account: 'eosio',
            name: 'newaccount',
            authorization: [auth],
            data: {
                creator: creator,
                name: name,
                owner: _onwer,
                active: _avtive,
            },
        });
        _actions.push({
            account: 'eosio',
            name: 'buyrambytes',
            authorization: [auth],
            data: {payer: creator, receiver: name, bytes: rambytes},
        });
        _actions.push({
            account: 'eosio',
            name: 'delegatebw',
            authorization: [auth],
            data: {
                from: creator, receiver: name,
                stake_net_quantity: (delegateAmount * 0.3).toFixed(precision) +
                    ' ' + symbol,
                stake_cpu_quantity: (delegateAmount * 0.7).toFixed(precision) +
                    ' ' + symbol,
                transfer: transfer,
            },
        });
        if (giftAmount > 0) {
            _actions.push({
                from: creator,
                to: name,
                quantity: giftAmount.toFixed(precision) + ' ' + symbol,
                memo: giftMemo,
            });
        }

        console.log(_actions);
        return this.api.transact({
            actions: _actions,
        }, {
            blocksBehind: 3,
            expireSeconds: 30,
        });
    }

    static convertFraction(diff, div, fr) {
        return ((Math.abs(diff)) / div).toFixed(fr);
    }

    checkPvtKey(k): Promise<any> {
        try {
            const pubkey = ecc['privateToPublic'](k);
            return this.loadPublicKey(pubkey);
        } catch (e) {
            console.log(e);
            return new Promise((resolve, reject) => {
                reject(e);
            });
        }
    }

    async loadPublicKey(pubkey) {
        return new Promise(async (resolve, reject2) => {
            if (ecc['isValidPublic'](pubkey)) {
                const tempAccData = [];
                const account_names = await this.getKeyAccountsMulti(pubkey);
                if (account_names.length > 0) {
                    const promiseQueue = [];
                    account_names.forEach((acc) => {
                        const tempPromise = new Promise((resolve1, reject1) => {
                            this.rpc.get_account(acc)
                            this.rpc.get_account(acc).then((acc_data) => {
                                tempAccData.push(acc_data);
                                this.rpc.get_currency_balance('eosio.token', acc).then((tokens) => {
                                    acc_data['tokens'] = tokens;
                                    this.oldEOS.accounts[acc] = acc_data;
                                    resolve1(acc_data);
                                }).catch((err) => {
                                    console.log(err);
                                    reject1();
                                });
                            });
                        });
                        promiseQueue.push(tempPromise);
                    });
                    Promise.all(promiseQueue)
                        .then((results) => {
                            resolve({
                                foundAccounts: results,
                                publicKey: pubkey
                            });
                        })
                        .catch(() => {
                            reject2({
                                message: 'non_active',
                                accounts: tempAccData
                            });
                        });
                } else {
                    reject2({message: 'no_account'});
                }
            } else {
                reject2({message: 'invalid'});
            }
        });
    }

    async getKeyAccountsMulti(key: string) {
        const accounts: Set<string> = new Set();
        const queue = [];
        console.log(this.defaultChain);
        for (const api of this.defaultChain.endpoints) {
            queue.push(new Promise(async (resolve) => {
                const tempRpc = new JsonRpc(api.url);
                try {
                    const result = await tempRpc.history_get_key_accounts(key)
                    if (result.account_names) {
                        for (const account of result.account_names) {
                            accounts.add(account);
                        }
                    }
                } catch (e) {
                    console.log(e);
                }
                resolve();
            }));
        }
        await Promise.all(queue);
        return [...accounts];
    }

    async changebw(account, permission, amount, symbol, ratio, fr) {
        let cpu_v, net_v;
        const accountInfo = await this.rpc.get_account(account);
        const refund = accountInfo['refund_request'];
        const liquid_bal = accountInfo['core_liquid_balance'];
        let wei_cpu: any;
        let wei_net: any;
        let ref_cpu = 0;
        let ref_net = 0;
        let liquid = 0;

        const _div = Math.pow(10, fr);
        const _zero = Number(0).toFixed(fr);

        if ((typeof accountInfo['cpu_weight']) === 'string') {
            wei_cpu = Math.round(
                parseFloat(accountInfo['cpu_weight'].split(' ')[0]) / _div);
            wei_net = Math.round(
                parseFloat(accountInfo['net_weight'].split(' ')[0]) / _div);
        } else {
            wei_cpu = accountInfo['cpu_weight'];
            wei_net = accountInfo['net_weight'];
        }

        if (liquid_bal) {
            liquid = Math.round(parseFloat(liquid_bal.split(' ')[0]) * _div);
        }
        if (refund) {
            ref_cpu = Math.round(
                parseFloat(refund['cpu_amount'].split(' ')[0]) * _div);
            ref_net = Math.round(
                parseFloat(refund['net_amount'].split(' ')[0]) * _div);
        }

        console.log(wei_cpu, wei_net, liquid, ref_cpu, ref_net);

        const current_stake = wei_cpu + wei_net;

        const new_total = current_stake + amount;
        const new_cpu = new_total * ratio;
        const new_net = new_total * (1 - ratio);
        let cpu_diff = new_cpu - wei_cpu;
        let net_diff = new_net - wei_net;

        if (cpu_diff > (ref_cpu + liquid)) {
            net_diff += (cpu_diff - (ref_cpu + liquid));
            cpu_diff = (ref_cpu + liquid);

        }
        if (net_diff > (ref_net + liquid)) {
            cpu_diff += (cpu_diff - (ref_cpu + liquid));
            net_diff = (ref_net + liquid);

        }

        const _actions = [];
        const auth = {
            actor: account,
            permission: permission,
        };

        if (cpu_diff < 0 && net_diff >= 0) {
            net_v = _zero;
            cpu_v = ((Math.abs(cpu_diff)) / _div).toFixed(fr);
            _actions.push(
                Eosjs2Service.makeUndelegateBW(auth, account, account, net_v,
                    cpu_v, symbol));
            if (net_diff > 0) {
                cpu_v = _zero;
                net_v = (net_diff / _div).toFixed(fr);
                _actions.push(
                    Eosjs2Service.makeDelegateBW(auth, account, account, net_v,
                        cpu_v, false, symbol));
            }
        } else if (net_diff < 0 && cpu_diff >= 0) {
            net_v = Eosjs2Service.convertFraction(net_diff, _div, fr);
            cpu_v = _zero;
            _actions.push(
                Eosjs2Service.makeUndelegateBW(auth, account, account, net_v,
                    cpu_v, symbol));
            if (cpu_diff > 0) {
                net_v = _zero;
                cpu_v = (cpu_diff / _div).toFixed(fr);
                _actions.push(
                    Eosjs2Service.makeDelegateBW(auth, account, account, net_v,
                        cpu_v, false, symbol));
            }
        } else if (net_diff < 0 && cpu_diff < 0) {
            cpu_v = Eosjs2Service.convertFraction(cpu_diff, _div, fr);
            net_v = ((Math.abs(net_diff)) / _div).toFixed(fr);
            _actions.push(
                Eosjs2Service.makeUndelegateBW(auth, account, account, net_v,
                    cpu_v, symbol));
        } else {
            cpu_v = (cpu_diff / _div).toFixed(fr);
            net_v = (net_diff / _div).toFixed(fr);
            _actions.push(
                Eosjs2Service.makeDelegateBW(auth, account, account, net_v,
                    cpu_v, false, symbol));
        }
        return _actions;
        // return this.api.transact({
        //     actions: _actions,
        // }, {
        //     blocksBehind: 3,
        //     expireSeconds: 30,
        // });
    }
}
