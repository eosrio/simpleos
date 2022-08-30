import {Injectable} from '@angular/core';
import {SignatureProvider, SignatureProviderArgs} from 'eosjs/dist/eosjs-api-interfaces';
import {Api, JsonRpc} from 'enf-eosjs';
import {PushTransactionArgs} from 'enf-eosjs/dist/eosjs-rpc-interfaces';
import {JsSignatureProvider} from 'enf-eosjs/dist/eosjs-jssig';
import {PrivateKey, PublicKey} from '../../helpers/KeyConversions';
import * as BN from 'bn.js';


import {
    convertFraction,
    makeAsset,
    makeDelegateBW,
    makeSingleKeyAuth,
    makeUndelegateBW,
    parseTokenValue,
} from '../../helpers/aux_functions';
import {BehaviorSubject, Subject} from 'rxjs';

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

    public online = new BehaviorSubject<boolean>(false);
    public status = new Subject<Boolean>();

    public ecc: any;
    rpc: JsonRpc;
    rpcRelay: JsonRpc;
    public localSigProvider: SimpleosSigProvider;
    public relaySigProvider: SimpleosSigProvider;
    public activeEndpoint: string;
    public alternativeEndpoints: any[];
    public chainId: string;
    private api: Api;
    private apiRelay: Api;

    private txOpts = {
        useLastIrreversible: true,
        expireSeconds: 240,
        broadcast: true,
        sign: true,
    };

    baseConfig = {
        keyProvider: [],
        httpEndpoint: '',
        expireInSeconds: 60,
        broadcast: true,
        debug: false,
        sign: true,
        chainId: '',
    };

    configLS: any;
    activeChain: string;
    defaultChain: any;
    defaultMainnetEndpoint: string;
    EOSMainnetChain: any;
    EOStMainnetEndpoint: string;

    constructor() {
        this.activeChain = localStorage.getItem('simplEOS.activeChainID');
        this.configLS = JSON.parse(localStorage.getItem('configSimpleos'));

        this.defaultChain = this.configLS.config.chains.find(chain => chain.id === this.activeChain);
        if (this.defaultChain) {
            this.defaultMainnetEndpoint = this.defaultChain.firstApi;
        } else {
            this.activeChain = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';
            this.defaultChain = this.configLS.config.chains.find(chain => chain.id === this.activeChain);
            this.defaultMainnetEndpoint = this.defaultChain.firstApi;
        }

        this.EOSMainnetChain = this.configLS.config.chains.find(chain => chain.name === 'EOS MAINNET');
        this.EOStMainnetEndpoint = this.EOSMainnetChain.firstApi;

    }

    initRPC(endpoint, chainID, allEndpoints) {
        this.activeEndpoint = endpoint;
        this.chainId = chainID;
        this.alternativeEndpoints = allEndpoints;
        this.rpc = new JsonRpc(this.activeEndpoint);
        this.localSigProvider = new SimpleosSigProvider(this.rpc);
    }

    initRelayRPC() {
        console.log(this.defaultChain.relay.endpoint);
        this.rpcRelay = new JsonRpc(this.activeEndpoint);
        this.relaySigProvider = new SimpleosSigProvider(this.rpcRelay);
        console.log('Started RELAY RPC ....');
    }

    createApi(key): Api {
        return new Api({
            rpc: this.rpc,
            signatureProvider: new JsSignatureProvider([key]),
            textDecoder: new TextDecoder(),
            textEncoder: new TextEncoder(),
        });
    }

    createApiRelay(key): Api {
        console.log('Created RELAY API ....');
        return new Api({
            rpc: this.rpcRelay,
            signatureProvider: new JsSignatureProvider([key]),
            textDecoder: new TextDecoder(),
            textEncoder: new TextEncoder(),
        });
    }

    initAPI(key) {
        this.api = this.createApi(key);
        setTimeout(() => {
            this.api = null;
        }, 5000);
    }

    initAPIRelay(key) {
        this.apiRelay = this.createApiRelay(key);
        setTimeout(() => {
            this.apiRelay = null;
        }, 5000);
    }

    async signTrx(trx: any, shouldBroadcast: boolean): Promise<any> {
        const packedTransaction = await this.api.transact(trx, {
            expireSeconds: 240,
            broadcast: false,
            sign: true,
        });
        if (shouldBroadcast) {
            const result = await this.api.pushSignedTransaction(packedTransaction as PushTransactionArgs);
            return {result, packedTransaction};
        } else {
            return {packedTransaction};
        }
    }

    async signRelayTrx(trx: any) {
        trx.actions.unshift({
            account: 'eosriorelay1',
            name: 'payforcpu',
            authorization: [{
                actor: 'eosriorelay1',
                permission: 'freecpu'
            }],
            data: {}
        });
        if (this.apiRelay) {
            const requiredKeys = await this.apiRelay.signatureProvider.getAvailableKeys();
            try {
                const packedTransaction = await this.apiRelay.transact(trx, {
                    expireSeconds: 240,
                    broadcast: false,
                    sign: false,
                });
                if ('serializedTransaction' in packedTransaction) {
                    const serializedTx = packedTransaction.serializedTransaction;
                    const signArgs = {
                        chainId: this.chainId,
                        requiredKeys,
                        serializedTransaction: serializedTx,
                        abis: [],
                    };
                    console.log(signArgs);
                    const pushTransactionArgs = await this.apiRelay.signatureProvider.sign(signArgs);
                    return {pushTransactionArgs};
                }
            } catch (e) {
                console.log(e);
            }
        }
    }


    transact(trx) {
        if (this.api) {
            return this.api.transact(trx, {
                expireSeconds: 360,
            });
        } else {
            return new Promise(resolve => {
                resolve('wrong_pass');
            });
        }
    }

    async getTableRows(code: string, scope: string, table: string): Promise<any> {
        if (this.rpc) {
            try {
                return this.rpc.get_table_rows({
                    json: true,
                    code,
                    scope,
                    table,
                });
            } catch (e) {
                console.log(e);
                return null;
            }
        }
    }

    async getMainnetTableRows(code: string, scope: string, table: string): Promise<any> {
        const tempRpc = new JsonRpc(this.defaultMainnetEndpoint);
        return tempRpc.get_table_rows({
            code,
            scope,
            table,
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

    async getPowerUpState(): Promise<any> {
        const powerUpState = await this.rpc.get_table_rows({
            json: true,
            code: 'eosio',
            scope: '0',
            table: 'powup.state',
        });
        return powerUpState.rows[0];
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

    async getAccountActions(account, position, offset): Promise<any> {
        console.log(`Account: ${account} | Pos: ${position} | Offset: ${offset}`);
        return this.rpc.history_get_actions(account, position, offset);
    }

    async recursiveFetchTableRows(
        array: any[],
        _code: string,
        _scope: string,
        _table: string,
        _pkey: string,
        LB: string,
        _batch: number
    ) {
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
        const auth = {actor: creator, permission};

        _actions.push({
            account: 'eosio',
            name: 'newaccount',
            authorization: [auth],
            data: {
                creator,
                name,
                owner: makeSingleKeyAuth(owner),
                active: makeSingleKeyAuth(active),
            },
        });

        _actions.push({
            account: 'eosio',
            name: 'buyrambytes',
            authorization: [auth],
            data: {
                payer: creator,
                receiver: name,
                bytes: rambytes,
            },
        });

        _actions.push({
            account: 'eosio',
            name: 'delegatebw',
            authorization: [auth],
            data: {
                from: creator, receiver: name,
                stake_net_quantity: makeAsset(delegateAmount * 0.3, symbol, precision),
                stake_cpu_quantity: makeAsset(delegateAmount * 0.7, symbol, precision),
                transfer,
            },
        });

        if (giftAmount > 0) {
            _actions.push({
                from: creator,
                to: name,
                quantity: makeAsset(giftAmount, symbol, precision),
                memo: giftMemo,
            });
        }

        return this.transact({actions: _actions});
    }

    checkPvtKey(k): Promise<any> {
        try {
            const pubkey = PrivateKey.fromString(k).getPublicKey();
            console.log(pubkey.toString());
            return this.loadPublicKey(pubkey);
        } catch (e) {
            console.log(e);
            return new Promise((resolve, reject) => {
                reject(e);
            });
        }
    }

    async loadPublicKey(pubkey: PublicKey): Promise<any> {
        return new Promise(async (resolve, reject2) => {
            if (pubkey.isValid()) {
                const tempAccData = [];
                const account_names = await this.getKeyAccountsMulti(pubkey.toString());
                console.log(account_names);
                if (account_names.length > 0) {
                    const promiseQueue = [];
                    account_names.forEach((acc) => {
                        promiseQueue.push(new Promise(async (resolve1, reject1) => {
                            let acc_data;
                            try {
                                acc_data = await this.rpc.get_account(acc);
                            } catch (e) {
                                console.log(e);
                                reject1();
                            }
                            try {
                                acc_data.tokens = await this.rpc.get_currency_balance('eosio.token', acc);
                            } catch (e) {
                                console.log(e);
                            }
                            tempAccData.push(acc_data);
                            resolve1(acc_data);
                        }));
                    });

                    Promise.all(promiseQueue)
                        .then((results: any[]) => {
                            resolve({
                                foundAccounts: results,
                                publicKey: pubkey.toString(),
                            });
                        })
                        .catch(() => {
                            reject2({
                                message: 'non_active',
                                accounts: tempAccData,
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

    async getKeyAccountsMulti(key: string): Promise<string[]> {
        return new Promise(async (resolve) => {
            const accounts: Set<string> = new Set();
            const queue = [];

            // check on selected endpoint first
            const primaryResults: string[] = await new Promise(async (resolve1) => {
                // fire 2 seconds timeout
                let _expired;
                const _t = setTimeout(() => {
                    _expired = true;
                    resolve1(undefined);
                }, 2000);

                // check on primary endpoint
                try {
                    const result = await this.rpc.history_get_key_accounts(key);
                    if (result && result.account_names.length > 0) {
                        resolve1(result.account_names);
                    } else {
                        resolve1(undefined);
                    }
                } catch (e) {
                    console.log(this.rpc.endpoint, e.message);
                    resolve1(undefined);
                }

                if (!_expired) {
                    clearTimeout(_t);
                }
            });

            // resolve directly if accounts are found
            if (primaryResults && primaryResults.length > 0) {
                resolve(primaryResults);
                return;
            }

            // fallback to others
            for (const api of this.alternativeEndpoints) {
                if (api.url !== this.rpc.endpoint && !api.failed) {
                    const tempRpc = new JsonRpc(api.url);
                    queue.push(new Promise(async (innerResolve) => {
                        try {
                            const result = await tempRpc.history_get_key_accounts(key);
                            if (result && result.account_names) {
                                for (const account of result.account_names) {
                                    accounts.add(account);
                                }
                            }
                        } catch (e) {
                            console.log(api.url, e.message);
                            api.failed = true;
                        }
                        innerResolve(undefined);
                    }));
                }
            }

            // 5 second timeout if any account has returned, otherwise we wait for all endpoints to return
            let expired;
            const timeout = setTimeout(() => {
                if (accounts.size > 0) {
                    expired = true;
                    resolve([...accounts]);
                }
            }, 5000);
            await Promise.all(queue);
            if (!expired) {
                clearTimeout(timeout);
                resolve([...accounts]);
            }
        });
    }

    async changebw(account, permission, amount, symbol, ratio, fr) {
        const accountInfo = await this.rpc.get_account(account);
        const refund = accountInfo.refund_request;
        const liquid_bal = accountInfo.core_liquid_balance;
        let wei_cpu: number;
        let wei_net: number;
        let ref_cpu = 0;
        let ref_net = 0;
        let liquid = 0;

        const _div = Math.pow(10, fr);
        const _zero = Number(0).toFixed(fr);

        const cpuWeightSTR = accountInfo.self_delegated_bandwidth === null ? '0.0000 ' + symbol : accountInfo.self_delegated_bandwidth.cpu_weight;
        const netWeightSTR = accountInfo.self_delegated_bandwidth === null ? '0.0000 ' + symbol : accountInfo.self_delegated_bandwidth.net_weight;

        if (typeof accountInfo.cpu_weight === 'string') {
            wei_cpu = Math.round(parseTokenValue(cpuWeightSTR) / _div);
            wei_net = Math.round(parseTokenValue(netWeightSTR) / _div);
        } else {
            wei_cpu = parseTokenValue(cpuWeightSTR);
            wei_net = parseTokenValue(netWeightSTR);
        }

        if (liquid_bal) {
            liquid = Math.round(parseTokenValue(liquid_bal) * _div);
        }

        if (refund) {
            ref_cpu = Math.round(parseTokenValue(refund.cpu_amount) * _div);
            ref_net = Math.round(parseTokenValue(refund.net_amount) * _div);
        }

        const current_stake = wei_cpu + wei_net;
        const new_total = current_stake + amount;
        const new_cpu = new_total * ratio;
        const new_net = new_total * (1 - ratio);
        const cpu_diff = new_cpu - wei_cpu;
        const net_diff = new_net - wei_net;
        return await this.processStakeActions(account, permission, cpu_diff, net_diff, ref_cpu, ref_net, liquid, _div, fr, _zero, symbol);

    }

    async changebwManually(account, permission, amountCPU, amountNET, symbol, fr) {
        const accountInfo = await this.rpc.get_account(account);
        const refund = accountInfo.refund_request;
        const liquid_bal = accountInfo.core_liquid_balance;

        let wei_cpu: number;
        let wei_net: number;
        let ref_cpu = 0;
        let ref_net = 0;
        let liquid = 0;

        const _div = Math.pow(10, fr);
        const _zero = Number(0).toFixed(fr);

        const cpuWeightSTR = accountInfo.self_delegated_bandwidth === null ? '0.0000 ' + symbol : accountInfo.self_delegated_bandwidth.cpu_weight;
        const netWeightSTR = accountInfo.self_delegated_bandwidth === null ? '0.0000 ' + symbol : accountInfo.self_delegated_bandwidth.net_weight;


        if (typeof accountInfo.cpu_weight === 'string') {
            wei_cpu = Math.round(parseTokenValue(cpuWeightSTR) / _div);
            wei_net = Math.round(parseTokenValue(netWeightSTR) / _div);
        } else {
            wei_cpu = Math.round(parseTokenValue(cpuWeightSTR) * _div);
            wei_net = Math.round(parseTokenValue(netWeightSTR) * _div);
        }


        if (liquid_bal) {
            liquid = Math.round(parseTokenValue(liquid_bal) * _div);
        }

        if (refund) {
            ref_cpu = Math.round(parseTokenValue(refund.cpu_amount) * _div);
            ref_net = Math.round(parseTokenValue(refund.net_amount) * _div);
        }

        const new_cpu = amountCPU;
        const new_net = amountNET;
        const cpu_diff = new_cpu - wei_cpu;
        const net_diff = new_net - wei_net;
        // console.log('current --->', wei_cpu, wei_net);
        // console.log('new ------->', new_cpu, new_net);
        // console.log('diff ------>', cpu_diff, net_diff);

        return await this.processStakeActions(account, permission, cpu_diff, net_diff, ref_cpu, ref_net, liquid, _div, fr, _zero, symbol);

    }

    async processStakeActions(account, permission, cpu_diff, net_diff, ref_cpu, ref_net, liquid, _div, fr, _zero, symbol) {

        let cpu_v;
        let net_v;

        if (cpu_diff > (ref_cpu + liquid)) {
            net_diff += (cpu_diff - (ref_cpu + liquid));
            cpu_diff = (ref_cpu + liquid);

        }

        if (net_diff > (ref_net + liquid)) {
            cpu_diff += (cpu_diff - (ref_cpu + liquid));
            net_diff = (ref_net + liquid);

        }

        const acts = [];
        const auth = {actor: account, permission};

        if (cpu_diff < 0 && net_diff >= 0) {
            // Unstake CPU & Stake NET

            // Unstake CPU
            cpu_v = convertFraction(cpu_diff, _div, fr);
            acts.push(makeUndelegateBW(auth, account, account, _zero, cpu_v, symbol));

            // Stake NET
            if (net_diff > 0) {
                net_v = convertFraction(net_diff, _div, fr);
                acts.push(makeDelegateBW(auth, account, account, net_v, _zero, false, symbol));
            }

        } else if (net_diff < 0 && cpu_diff >= 0) {
            // Unstake NET & Stake CPU

            // Unstake NET
            net_v = convertFraction(net_diff, _div, fr);
            acts.push(makeUndelegateBW(auth, account, account, net_v, _zero, symbol));

            // Stake CPU
            if (cpu_diff > 0) {
                cpu_v = convertFraction(cpu_diff, _div, fr);
                acts.push(makeDelegateBW(auth, account, account, _zero, cpu_v, false, symbol));
            }

        } else if (net_diff < 0 && cpu_diff < 0) {

            // Unstake NET & CPU
            cpu_v = convertFraction(cpu_diff, _div, fr);
            net_v = convertFraction(net_diff, _div, fr);
            acts.push(makeUndelegateBW(auth, account, account, net_v, cpu_v, symbol));

        } else {

            // Stake NET & CPU
            cpu_v = convertFraction(cpu_diff, _div, fr);
            net_v = convertFraction(net_diff, _div, fr);
            acts.push(makeDelegateBW(auth, account, account, net_v, cpu_v, false, symbol));

        }
        return acts;
    }

    claimRefunds(account, k, permission): Promise<any> {
        const tempApi = this.createApi(k);
        return tempApi.transact({
            actions: [
                {
                    account: 'eosio',
                    name: 'refund',
                    authorization: [{actor: account, permission}],
                    data: {owner: account},
                }],
        }, this.txOpts);
    }

    listProducers() {
        return this.rpc.get_producers(true, null, 200);
    }

    getChainInfoRPC(): Promise<any> {
        return this.rpc.get_info();
    }

    getChainUserres(): Promise<any> {
        return this.getTableRows('eosio', 'eosio', 'userres');
    }

    getChainInfo(): Promise<any> {
        return this.getTableRows('eosio', 'eosio', 'global');
    }


    getRamMarketInfo(): Promise<any> {
        return this.getTableRows('eosio', 'eosio', 'rammarket');
    }

    getDappMetaData(dapp): Promise<any> {
        return this.getTableRows('dappmetadata', dapp, 'dapps');
    }

    listDelegations(account): Promise<any> {
        return this.getTableRows('eosio', account, 'delband');
    }

    getSCAbi(contract) {
        return this.rpc.get_abi(contract);
    }

    getSymbolContract(contract): Promise<any> {
        return this.getTableRows(contract, contract, 'accounts');
    }

    getAccountInfo(name: string) {
        return this.rpc.get_account(name);
    }

    getTokens(name): Promise<any> {
        return this.rpc.get_currency_balance('eosio.token', name);
    }

    pushActionContract(contract, action, form, account, permission) {
        return this.transact({
            actions: [
                {
                    account: contract,
                    name: action,
                    authorization: [{actor: account, permission}],
                    data: form,
                }],
        });
    }

    checkAccountName(name) {
        console.log(`Check format for account name: ${name}`);
        // return this.format['encodeName'](name);
        return 1;
    }

    async calcPowerUp(state, frac, {maxFee, maxPower}) {
        let new_FRAC = 0;
        let powerup = await this.calculateFeePowerUp(state, frac);
        if (maxFee !== 0) {
            new_FRAC = Math.floor((maxFee * frac) / powerup.fee);
        }
        else if (maxPower !== 0) {
            new_FRAC = (maxPower * frac) / powerup.amount;
 }

        if (new_FRAC > 0) {
            powerup = await this.calculateFeePowerUp(state, new_FRAC);
        }

        return powerup;
    }

    async getTimeUsCost(pr, acc_details?) {

        const precision = Math.pow(10, pr);
        const precisionNet = Math.pow(10, pr + 4);
        let userDetails;
        if (acc_details !== undefined && acc_details.cpu_limit.max > 0) {
            userDetails = acc_details;
        }
        else {
            userDetails = await this.getAccountInfo('eosriobrazil');
        }
        const cpu_weight = userDetails.cpu_weight;
        const net_weight = userDetails.net_weight;
        console.log(userDetails);
        const timeUsCost = Math.round(((userDetails.cpu_limit.max / cpu_weight)) * precision) / precision;
        const timeUsCostNet = Math.round(((userDetails.net_limit.max / net_weight)) * precisionNet) / precisionNet;

        return {cpuCost: timeUsCost, netCost: timeUsCostNet};
    }

    calculateFee(state: any, frac: number): any {
        const utilization_increase = new BN((frac * parseFloat(state.weight)) / parseFloat(state.initial_weight_ratio));
        const zero = new BN(0);
        // 10e15
        const precision2 = new BN(1000000000000000);

        if (utilization_increase.lte(zero)) { return 0; }
        console.log(utilization_increase.toNumber(), state);
        let fee = 0.0;
        let start_utilization = new BN(state.utilization);
        const end_utilization = start_utilization.add(utilization_increase);
        const weight = new BN(state.weight);

        const minPrice = parseTokenValue(state.min_price);
        const maxPrice = parseTokenValue(state.max_price);
        const exp = parseFloat(state.exponent);
        const nexp = exp - 1.0;

        const priceFunction = (utilization: BN): number => {
            let price = minPrice;
            if (nexp <= 0.0) {
                return maxPrice;
            } else {
                const d = (maxPrice - minPrice);
                const x = utilization.mul(precision2).div(weight).toNumber() / precision2.toNumber();
                price += d * Math.pow(x, nexp);
            }
            return price;
        };

        const priceIntegralDelta = (startUtilization: BN, endUtilization: BN): number => {
            const c = (maxPrice - minPrice) / exp;
            const start_u = startUtilization.mul(precision2).div(weight).toNumber() / precision2.toNumber();
            const end_u = endUtilization.mul(precision2).div(weight).toNumber() / precision2.toNumber();
            return (minPrice * end_u) - (minPrice * start_u) + (c * Math.pow(end_u, exp)) - (c * Math.pow(start_u, exp));
        };

        const adjustedUtilization = new BN(state.adjusted_utilization);
        if (start_utilization.lt(adjustedUtilization)) {
            const priceResult = priceFunction(adjustedUtilization);
            const min = BN.min(utilization_increase, adjustedUtilization.sub(start_utilization));
            const k = min.mul(precision2).div(weight).toNumber() / precision2.toNumber();
            fee += priceResult * k;

            start_utilization = adjustedUtilization;
        }

        if (start_utilization < end_utilization) {
            fee += priceIntegralDelta(start_utilization, end_utilization);
        }

        return {fee, frac, amount: utilization_increase.toNumber()};
    }

    async calculateFeePowerUp(state, frac) {

        const amount = (frac * parseFloat(state.weight)) / parseFloat(state.initial_weight_ratio);
        let fee = 0.0;

        try {
            let start_utilization = parseFloat(state.utilization);
            const end_utilization = start_utilization + amount;
            const adjustedUtilization = parseFloat(state.adjusted_utilization);
            if (start_utilization < state.adjusted_utilization) {

                const price = this.priceFunction(state, adjustedUtilization);
                const min = Math.min(amount, adjustedUtilization - start_utilization);
                const k = min / parseFloat(state.weight);

                fee += price * k;
                start_utilization = adjustedUtilization;
            }

            if (start_utilization < end_utilization) {
                fee += this.priceIntegralDelta(state, start_utilization, end_utilization);
            }
            // console.log({fee: fee, frac: frac, amount: amount,percent:percent,compare:(fee / max)});
            return {fee, frac, amount};
        } catch (e) {
            return {fee, frac, amount};
        }

    }


    priceFunction(state, utilization): number {

        const maxPrice = parseTokenValue(state.max_price);
        const minPrice = parseTokenValue(state.min_price);
        let price = minPrice;

        const weight = parseFloat(state.weight);
        const new_exponent = parseFloat(state.exponent) - 1.0;
        if (new_exponent <= 0.0) {
            return maxPrice;
        } else {
            price += (maxPrice - minPrice) * Math.pow(utilization / weight, new_exponent);
        }
        return price;
    }

    priceIntegralDelta(state, start_utilization, end_utilization): number {
        const maxPrice = parseTokenValue(state.max_price);
        const minPrice = parseTokenValue(state.min_price);

        const exp = parseFloat(state.exponent);
        const weight = parseFloat(state.weight);

        const coefficient = (maxPrice - minPrice) / exp;
        const start_u = start_utilization / weight;
        const end_u = end_utilization / weight;

        return (minPrice * end_u) - (minPrice * start_u) +
            (coefficient * Math.pow(end_u, exp)) - (coefficient * Math.pow(start_u, exp));
    }


}
