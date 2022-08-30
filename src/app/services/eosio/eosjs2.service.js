"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Eosjs2Service = exports.SimpleosSigProvider = void 0;
const core_1 = require("@angular/core");
const enf_eosjs_1 = require("enf-eosjs");
const eosjs_jssig_1 = require("enf-eosjs/dist/eosjs-jssig");
const KeyConversions_1 = require("../../helpers/KeyConversions");
const BN = require("bn.js");
const aux_functions_1 = require("../../helpers/aux_functions");
const rxjs_1 = require("rxjs");
class SimpleosSigProvider {
    constructor(_rpc) {
        this.localRPC = _rpc;
    }
    processTrx(binaryData) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = {
                rpc: this.localRPC,
                authorityProvider: undefined,
                abiProvider: undefined,
                signatureProvider: this,
                chainId: undefined,
                textEncoder: undefined,
                textDecoder: undefined,
            };
            const api = new enf_eosjs_1.Api(args);
            return yield api.deserializeTransactionWithActions(binaryData);
        });
    }
    getAvailableKeys() {
        console.log('get available keys');
        return new Promise((resolve) => {
            resolve(['']);
        });
    }
    sign(args) {
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
exports.SimpleosSigProvider = SimpleosSigProvider;
let Eosjs2Service = class Eosjs2Service {
    constructor() {
        this.online = new rxjs_1.BehaviorSubject(false);
        this.status = new rxjs_1.Subject();
        this.txOpts = {
            useLastIrreversible: true,
            expireSeconds: 240,
            broadcast: true,
            sign: true,
        };
        this.baseConfig = {
            keyProvider: [],
            httpEndpoint: '',
            expireInSeconds: 60,
            broadcast: true,
            debug: false,
            sign: true,
            chainId: '',
        };
        this.activeChain = localStorage.getItem('simplEOS.activeChainID');
        this.configLS = JSON.parse(localStorage.getItem('configSimpleos'));
        this.defaultChain = this.configLS.config.chains.find(chain => chain.id === this.activeChain);
        if (this.defaultChain) {
            this.defaultMainnetEndpoint = this.defaultChain.firstApi;
        }
        else {
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
        this.rpc = new enf_eosjs_1.JsonRpc(this.activeEndpoint);
        this.localSigProvider = new SimpleosSigProvider(this.rpc);
    }
    initRelayRPC() {
        console.log(this.defaultChain.relay.endpoint);
        this.rpcRelay = new enf_eosjs_1.JsonRpc(this.activeEndpoint);
        this.relaySigProvider = new SimpleosSigProvider(this.rpcRelay);
        console.log('Started RELAY RPC ....');
    }
    createApi(key) {
        return new enf_eosjs_1.Api({
            rpc: this.rpc,
            signatureProvider: new eosjs_jssig_1.JsSignatureProvider([key]),
            textDecoder: new TextDecoder(),
            textEncoder: new TextEncoder(),
        });
    }
    createApiRelay(key) {
        console.log('Created RELAY API ....');
        return new enf_eosjs_1.Api({
            rpc: this.rpcRelay,
            signatureProvider: new eosjs_jssig_1.JsSignatureProvider([key]),
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
    signTrx(trx, shouldBroadcast) {
        return __awaiter(this, void 0, void 0, function* () {
            const packedTransaction = yield this.api.transact(trx, {
                expireSeconds: 240,
                broadcast: false,
                sign: true,
            });
            if (shouldBroadcast) {
                const result = yield this.api.pushSignedTransaction(packedTransaction);
                return { result, packedTransaction };
            }
            else {
                return { packedTransaction };
            }
        });
    }
    signRelayTrx(trx) {
        return __awaiter(this, void 0, void 0, function* () {
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
                const requiredKeys = yield this.apiRelay.signatureProvider.getAvailableKeys();
                try {
                    const packedTransaction = yield this.apiRelay.transact(trx, {
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
                        const pushTransactionArgs = yield this.apiRelay.signatureProvider.sign(signArgs);
                        return { pushTransactionArgs };
                    }
                }
                catch (e) {
                    console.log(e);
                }
            }
        });
    }
    transact(trx) {
        if (this.api) {
            return this.api.transact(trx, {
                expireSeconds: 360,
            });
        }
        else {
            return new Promise(resolve => {
                resolve('wrong_pass');
            });
        }
    }
    getTableRows(code, scope, table) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.rpc) {
                try {
                    return this.rpc.get_table_rows({
                        json: true,
                        code,
                        scope,
                        table,
                    });
                }
                catch (e) {
                    console.log(e);
                    return null;
                }
            }
        });
    }
    getMainnetTableRows(code, scope, table) {
        return __awaiter(this, void 0, void 0, function* () {
            const tempRpc = new enf_eosjs_1.JsonRpc(this.defaultMainnetEndpoint);
            return tempRpc.get_table_rows({
                code,
                scope,
                table,
            });
        });
    }
    getRexPool() {
        return __awaiter(this, void 0, void 0, function* () {
            const rexpool = yield this.rpc.get_table_rows({
                json: true,
                code: 'eosio',
                scope: 'eosio',
                table: 'rexpool',
            });
            return rexpool.rows[0];
        });
    }
    getPowerUpState() {
        return __awaiter(this, void 0, void 0, function* () {
            const powerUpState = yield this.rpc.get_table_rows({
                json: true,
                code: 'eosio',
                scope: '0',
                table: 'powup.state',
            });
            return powerUpState.rows[0];
        });
    }
    getRexData(_account) {
        return __awaiter(this, void 0, void 0, function* () {
            const rexbal_rows = yield this.rpc.get_table_rows({
                json: true,
                code: 'eosio',
                scope: 'eosio',
                table: 'rexbal',
                lower_bound: _account,
                limit: 1,
            });
            const rexbal_data = rexbal_rows.rows.find(row => row.owner === _account);
            const rexfund_rows = yield this.rpc.get_table_rows({
                json: true,
                code: 'eosio',
                scope: 'eosio',
                table: 'rexfund',
                lower_bound: _account,
                limit: 1,
            });
            const rexfund_data = rexfund_rows.rows.find(row => row.owner === _account);
            return {
                rexbal: rexbal_data,
                rexfund: rexfund_data,
            };
        });
    }
    getAccountActions(account, position, offset) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Account: ${account} | Pos: ${position} | Offset: ${offset}`);
            return this.rpc.history_get_actions(account, position, offset);
        });
    }
    recursiveFetchTableRows(array, _code, _scope, _table, _pkey, LB, _batch) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield this.rpc.get_table_rows({
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
                yield this.recursiveFetchTableRows(array, _code, _scope, _table, _pkey, last_pk, _batch);
            }
        });
    }
    getProxies(contract) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Getting proxy data via chain API');
            const result = {
                rows: [],
            };
            if (contract !== '') {
                yield this.recursiveFetchTableRows(result.rows, contract, contract, 'proxies', 'owner', '', 100);
            }
            return result;
        });
    }
    getLoans(account) {
        return __awaiter(this, void 0, void 0, function* () {
            const loans = {
                cpu: [],
                net: [],
            };
            const data = yield Promise.all([
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
                })
            ]);
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
        });
    }
    checkSimpleosUpdate() {
        return __awaiter(this, void 0, void 0, function* () {
            const tempRpc = new enf_eosjs_1.JsonRpc(this.EOStMainnetEndpoint);
            const data = yield tempRpc.get_table_rows({
                json: true,
                code: 'simpleosvers',
                scope: 'simpleosvers',
                table: 'info',
            });
            if (data.rows.length > 0) {
                return data.rows[0];
            }
            else {
                return null;
            }
        });
    }
    createAccount(creator, name, owner, active, delegateAmount, rambytes, transfer, giftAmount, giftMemo, symbol, precision, permission) {
        return __awaiter(this, void 0, void 0, function* () {
            const _actions = [];
            const auth = { actor: creator, permission };
            _actions.push({
                account: 'eosio',
                name: 'newaccount',
                authorization: [auth],
                data: {
                    creator,
                    name,
                    owner: (0, aux_functions_1.makeSingleKeyAuth)(owner),
                    active: (0, aux_functions_1.makeSingleKeyAuth)(active),
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
                    stake_net_quantity: (0, aux_functions_1.makeAsset)(delegateAmount * 0.3, symbol, precision),
                    stake_cpu_quantity: (0, aux_functions_1.makeAsset)(delegateAmount * 0.7, symbol, precision),
                    transfer,
                },
            });
            if (giftAmount > 0) {
                _actions.push({
                    from: creator,
                    to: name,
                    quantity: (0, aux_functions_1.makeAsset)(giftAmount, symbol, precision),
                    memo: giftMemo,
                });
            }
            return this.transact({ actions: _actions });
        });
    }
    checkPvtKey(k) {
        try {
            const pubkey = KeyConversions_1.PrivateKey.fromString(k).getPublicKey();
            console.log(pubkey.toString());
            return this.loadPublicKey(pubkey);
        }
        catch (e) {
            console.log(e);
            return new Promise((resolve, reject) => {
                reject(e);
            });
        }
    }
    loadPublicKey(pubkey) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject2) => __awaiter(this, void 0, void 0, function* () {
                if (pubkey.isValid()) {
                    const tempAccData = [];
                    const account_names = yield this.getKeyAccountsMulti(pubkey.toString());
                    console.log(account_names);
                    if (account_names.length > 0) {
                        const promiseQueue = [];
                        account_names.forEach((acc) => {
                            promiseQueue.push(new Promise((resolve1, reject1) => __awaiter(this, void 0, void 0, function* () {
                                let acc_data;
                                try {
                                    acc_data = yield this.rpc.get_account(acc);
                                }
                                catch (e) {
                                    console.log(e);
                                    reject1();
                                }
                                try {
                                    acc_data.tokens = yield this.rpc.get_currency_balance('eosio.token', acc);
                                }
                                catch (e) {
                                    console.log(e);
                                }
                                tempAccData.push(acc_data);
                                resolve1(acc_data);
                            })));
                        });
                        Promise.all(promiseQueue)
                            .then((results) => {
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
                    }
                    else {
                        reject2({ message: 'no_account' });
                    }
                }
                else {
                    reject2({ message: 'invalid' });
                }
            }));
        });
    }
    getKeyAccountsMulti(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                const accounts = new Set();
                const queue = [];
                // check on selected endpoint first
                const primaryResults = yield new Promise((resolve1) => __awaiter(this, void 0, void 0, function* () {
                    // fire 2 seconds timeout
                    let _expired;
                    const _t = setTimeout(() => {
                        _expired = true;
                        resolve1(undefined);
                    }, 2000);
                    // check on primary endpoint
                    try {
                        const result = yield this.rpc.history_get_key_accounts(key);
                        if (result && result.account_names.length > 0) {
                            resolve1(result.account_names);
                        }
                        else {
                            resolve1(undefined);
                        }
                    }
                    catch (e) {
                        console.log(this.rpc.endpoint, e.message);
                        resolve1(undefined);
                    }
                    if (!_expired) {
                        clearTimeout(_t);
                    }
                }));
                // resolve directly if accounts are found
                if (primaryResults && primaryResults.length > 0) {
                    resolve(primaryResults);
                    return;
                }
                // fallback to others
                for (const api of this.alternativeEndpoints) {
                    if (api.url !== this.rpc.endpoint && !api.failed) {
                        const tempRpc = new enf_eosjs_1.JsonRpc(api.url);
                        queue.push(new Promise((innerResolve) => __awaiter(this, void 0, void 0, function* () {
                            try {
                                const result = yield tempRpc.history_get_key_accounts(key);
                                if (result && result.account_names) {
                                    for (const account of result.account_names) {
                                        accounts.add(account);
                                    }
                                }
                            }
                            catch (e) {
                                console.log(api.url, e.message);
                                api.failed = true;
                            }
                            innerResolve(undefined);
                        })));
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
                yield Promise.all(queue);
                if (!expired) {
                    clearTimeout(timeout);
                    resolve([...accounts]);
                }
            }));
        });
    }
    changebw(account, permission, amount, symbol, ratio, fr) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountInfo = yield this.rpc.get_account(account);
            const refund = accountInfo.refund_request;
            const liquid_bal = accountInfo.core_liquid_balance;
            let wei_cpu;
            let wei_net;
            let ref_cpu = 0;
            let ref_net = 0;
            let liquid = 0;
            const _div = Math.pow(10, fr);
            const _zero = Number(0).toFixed(fr);
            const cpuWeightSTR = accountInfo.self_delegated_bandwidth === null ? '0.0000 ' + symbol : accountInfo.self_delegated_bandwidth.cpu_weight;
            const netWeightSTR = accountInfo.self_delegated_bandwidth === null ? '0.0000 ' + symbol : accountInfo.self_delegated_bandwidth.net_weight;
            if (typeof accountInfo.cpu_weight === 'string') {
                wei_cpu = Math.round((0, aux_functions_1.parseTokenValue)(cpuWeightSTR) / _div);
                wei_net = Math.round((0, aux_functions_1.parseTokenValue)(netWeightSTR) / _div);
            }
            else {
                wei_cpu = (0, aux_functions_1.parseTokenValue)(cpuWeightSTR);
                wei_net = (0, aux_functions_1.parseTokenValue)(netWeightSTR);
            }
            if (liquid_bal) {
                liquid = Math.round((0, aux_functions_1.parseTokenValue)(liquid_bal) * _div);
            }
            if (refund) {
                ref_cpu = Math.round((0, aux_functions_1.parseTokenValue)(refund.cpu_amount) * _div);
                ref_net = Math.round((0, aux_functions_1.parseTokenValue)(refund.net_amount) * _div);
            }
            const current_stake = wei_cpu + wei_net;
            const new_total = current_stake + amount;
            const new_cpu = new_total * ratio;
            const new_net = new_total * (1 - ratio);
            const cpu_diff = new_cpu - wei_cpu;
            const net_diff = new_net - wei_net;
            return yield this.processStakeActions(account, permission, cpu_diff, net_diff, ref_cpu, ref_net, liquid, _div, fr, _zero, symbol);
        });
    }
    changebwManually(account, permission, amountCPU, amountNET, symbol, fr) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountInfo = yield this.rpc.get_account(account);
            const refund = accountInfo.refund_request;
            const liquid_bal = accountInfo.core_liquid_balance;
            let wei_cpu;
            let wei_net;
            let ref_cpu = 0;
            let ref_net = 0;
            let liquid = 0;
            const _div = Math.pow(10, fr);
            const _zero = Number(0).toFixed(fr);
            const cpuWeightSTR = accountInfo.self_delegated_bandwidth === null ? '0.0000 ' + symbol : accountInfo.self_delegated_bandwidth.cpu_weight;
            const netWeightSTR = accountInfo.self_delegated_bandwidth === null ? '0.0000 ' + symbol : accountInfo.self_delegated_bandwidth.net_weight;
            if (typeof accountInfo.cpu_weight === 'string') {
                wei_cpu = Math.round((0, aux_functions_1.parseTokenValue)(cpuWeightSTR) / _div);
                wei_net = Math.round((0, aux_functions_1.parseTokenValue)(netWeightSTR) / _div);
            }
            else {
                wei_cpu = Math.round((0, aux_functions_1.parseTokenValue)(cpuWeightSTR) * _div);
                wei_net = Math.round((0, aux_functions_1.parseTokenValue)(netWeightSTR) * _div);
            }
            if (liquid_bal) {
                liquid = Math.round((0, aux_functions_1.parseTokenValue)(liquid_bal) * _div);
            }
            if (refund) {
                ref_cpu = Math.round((0, aux_functions_1.parseTokenValue)(refund.cpu_amount) * _div);
                ref_net = Math.round((0, aux_functions_1.parseTokenValue)(refund.net_amount) * _div);
            }
            const new_cpu = amountCPU;
            const new_net = amountNET;
            const cpu_diff = new_cpu - wei_cpu;
            const net_diff = new_net - wei_net;
            // console.log('current --->', wei_cpu, wei_net);
            // console.log('new ------->', new_cpu, new_net);
            // console.log('diff ------>', cpu_diff, net_diff);
            return yield this.processStakeActions(account, permission, cpu_diff, net_diff, ref_cpu, ref_net, liquid, _div, fr, _zero, symbol);
        });
    }
    processStakeActions(account, permission, cpu_diff, net_diff, ref_cpu, ref_net, liquid, _div, fr, _zero, symbol) {
        return __awaiter(this, void 0, void 0, function* () {
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
            const auth = { actor: account, permission };
            if (cpu_diff < 0 && net_diff >= 0) {
                // Unstake CPU & Stake NET
                // Unstake CPU
                cpu_v = (0, aux_functions_1.convertFraction)(cpu_diff, _div, fr);
                acts.push((0, aux_functions_1.makeUndelegateBW)(auth, account, account, _zero, cpu_v, symbol));
                // Stake NET
                if (net_diff > 0) {
                    net_v = (0, aux_functions_1.convertFraction)(net_diff, _div, fr);
                    acts.push((0, aux_functions_1.makeDelegateBW)(auth, account, account, net_v, _zero, false, symbol));
                }
            }
            else if (net_diff < 0 && cpu_diff >= 0) {
                // Unstake NET & Stake CPU
                // Unstake NET
                net_v = (0, aux_functions_1.convertFraction)(net_diff, _div, fr);
                acts.push((0, aux_functions_1.makeUndelegateBW)(auth, account, account, net_v, _zero, symbol));
                // Stake CPU
                if (cpu_diff > 0) {
                    cpu_v = (0, aux_functions_1.convertFraction)(cpu_diff, _div, fr);
                    acts.push((0, aux_functions_1.makeDelegateBW)(auth, account, account, _zero, cpu_v, false, symbol));
                }
            }
            else if (net_diff < 0 && cpu_diff < 0) {
                // Unstake NET & CPU
                cpu_v = (0, aux_functions_1.convertFraction)(cpu_diff, _div, fr);
                net_v = (0, aux_functions_1.convertFraction)(net_diff, _div, fr);
                acts.push((0, aux_functions_1.makeUndelegateBW)(auth, account, account, net_v, cpu_v, symbol));
            }
            else {
                // Stake NET & CPU
                cpu_v = (0, aux_functions_1.convertFraction)(cpu_diff, _div, fr);
                net_v = (0, aux_functions_1.convertFraction)(net_diff, _div, fr);
                acts.push((0, aux_functions_1.makeDelegateBW)(auth, account, account, net_v, cpu_v, false, symbol));
            }
            return acts;
        });
    }
    claimRefunds(account, k, permission) {
        const tempApi = this.createApi(k);
        return tempApi.transact({
            actions: [
                {
                    account: 'eosio',
                    name: 'refund',
                    authorization: [{ actor: account, permission }],
                    data: { owner: account },
                }
            ],
        }, this.txOpts);
    }
    listProducers() {
        return this.rpc.get_producers(true, null, 200);
    }
    getChainInfoRPC() {
        return this.rpc.get_info();
    }
    getChainUserres() {
        return this.getTableRows('eosio', 'eosio', 'userres');
    }
    getChainInfo() {
        return this.getTableRows('eosio', 'eosio', 'global');
    }
    getRamMarketInfo() {
        return this.getTableRows('eosio', 'eosio', 'rammarket');
    }
    getDappMetaData(dapp) {
        return this.getTableRows('dappmetadata', dapp, 'dapps');
    }
    listDelegations(account) {
        return this.getTableRows('eosio', account, 'delband');
    }
    getSCAbi(contract) {
        return this.rpc.get_abi(contract);
    }
    getSymbolContract(contract) {
        return this.getTableRows(contract, contract, 'accounts');
    }
    getAccountInfo(name) {
        return this.rpc.get_account(name);
    }
    getTokens(name) {
        return this.rpc.get_currency_balance('eosio.token', name);
    }
    pushActionContract(contract, action, form, account, permission) {
        return this.transact({
            actions: [
                {
                    account: contract,
                    name: action,
                    authorization: [{ actor: account, permission }],
                    data: form,
                }
            ],
        });
    }
    checkAccountName(name) {
        console.log(`Check format for account name: ${name}`);
        // return this.format['encodeName'](name);
        return 1;
    }
    calcPowerUp(state, frac, { maxFee, maxPower }) {
        return __awaiter(this, void 0, void 0, function* () {
            let new_FRAC = 0;
            let powerup = yield this.calculateFeePowerUp(state, frac);
            if (maxFee !== 0) {
                new_FRAC = Math.floor((maxFee * frac) / powerup.fee);
            }
            else if (maxPower !== 0) {
                new_FRAC = (maxPower * frac) / powerup.amount;
            }
            if (new_FRAC > 0) {
                powerup = yield this.calculateFeePowerUp(state, new_FRAC);
            }
            return powerup;
        });
    }
    getTimeUsCost(pr, acc_details) {
        return __awaiter(this, void 0, void 0, function* () {
            const precision = Math.pow(10, pr);
            const precisionNet = Math.pow(10, pr + 4);
            let userDetails;
            if (acc_details !== undefined && acc_details.cpu_limit.max > 0) {
                userDetails = acc_details;
            }
            else {
                userDetails = yield this.getAccountInfo('eosriobrazil');
            }
            const cpu_weight = userDetails.cpu_weight;
            const net_weight = userDetails.net_weight;
            console.log(userDetails);
            const timeUsCost = Math.round(((userDetails.cpu_limit.max / cpu_weight)) * precision) / precision;
            const timeUsCostNet = Math.round(((userDetails.net_limit.max / net_weight)) * precisionNet) / precisionNet;
            return { cpuCost: timeUsCost, netCost: timeUsCostNet };
        });
    }
    calculateFee(state, frac) {
        const utilization_increase = new BN((frac * parseFloat(state.weight)) / parseFloat(state.initial_weight_ratio));
        const zero = new BN(0);
        // 10e15
        const precision2 = new BN(1000000000000000);
        if (utilization_increase.lte(zero)) {
            return 0;
        }
        console.log(utilization_increase.toNumber(), state);
        let fee = 0.0;
        let start_utilization = new BN(state.utilization);
        const end_utilization = start_utilization.add(utilization_increase);
        const weight = new BN(state.weight);
        const minPrice = (0, aux_functions_1.parseTokenValue)(state.min_price);
        const maxPrice = (0, aux_functions_1.parseTokenValue)(state.max_price);
        const exp = parseFloat(state.exponent);
        const nexp = exp - 1.0;
        const priceFunction = (utilization) => {
            let price = minPrice;
            if (nexp <= 0.0) {
                return maxPrice;
            }
            else {
                const d = (maxPrice - minPrice);
                const x = utilization.mul(precision2).div(weight).toNumber() / precision2.toNumber();
                price += d * Math.pow(x, nexp);
            }
            return price;
        };
        const priceIntegralDelta = (startUtilization, endUtilization) => {
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
        return { fee, frac, amount: utilization_increase.toNumber() };
    }
    calculateFeePowerUp(state, frac) {
        return __awaiter(this, void 0, void 0, function* () {
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
                return { fee, frac, amount };
            }
            catch (e) {
                return { fee, frac, amount };
            }
        });
    }
    priceFunction(state, utilization) {
        const maxPrice = (0, aux_functions_1.parseTokenValue)(state.max_price);
        const minPrice = (0, aux_functions_1.parseTokenValue)(state.min_price);
        let price = minPrice;
        const weight = parseFloat(state.weight);
        const new_exponent = parseFloat(state.exponent) - 1.0;
        if (new_exponent <= 0.0) {
            return maxPrice;
        }
        else {
            price += (maxPrice - minPrice) * Math.pow(utilization / weight, new_exponent);
        }
        return price;
    }
    priceIntegralDelta(state, start_utilization, end_utilization) {
        const maxPrice = (0, aux_functions_1.parseTokenValue)(state.max_price);
        const minPrice = (0, aux_functions_1.parseTokenValue)(state.min_price);
        const exp = parseFloat(state.exponent);
        const weight = parseFloat(state.weight);
        const coefficient = (maxPrice - minPrice) / exp;
        const start_u = start_utilization / weight;
        const end_u = end_utilization / weight;
        return (minPrice * end_u) - (minPrice * start_u) +
            (coefficient * Math.pow(end_u, exp)) - (coefficient * Math.pow(start_u, exp));
    }
};
Eosjs2Service = __decorate([
    (0, core_1.Injectable)({
        providedIn: 'root',
    }),
    __metadata("design:paramtypes", [])
], Eosjs2Service);
exports.Eosjs2Service = Eosjs2Service;
//# sourceMappingURL=eosjs2.service.js.map