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
exports.AccountsService = void 0;
const core_1 = require("@angular/core");
const rxjs_1 = require("rxjs");
const http_1 = require("@angular/common/http");
const eosjs2_service_1 = require("./eosio/eosjs2.service");
const aux_functions_1 = require("../helpers/aux_functions");
const crypto_service_1 = require("./crypto/crypto.service");
const dist_1 = require("eosjs/dist");
const moment = require("moment");
const notification_service_1 = require("./notification.service");
let AccountsService = class AccountsService {
    constructor(http, eosjs, crypto, notification) {
        this.http = http;
        this.eosjs = eosjs;
        this.crypto = crypto;
        this.notification = notification;
        this.selected = new rxjs_1.BehaviorSubject({});
        this.lastAccount = null;
        this.selectedIdx = 0;
        this.lastUpdate = new rxjs_1.Subject();
        this.usd_rate = 1;
        this.tokens = [];
        this.actions = [];
        this.sessionTokens = {};
        this.allowed_actions = [];
        this.totalAssetsSum = 0;
        this.loading = true;
        this.actionStore = {};
        this.loadingTokens = false;
        this.lastTkLoadTime = 0;
        this.isRefreshing = false;
        this.accounts = [];
        this.usd_rate = 10.00;
        this.allowed_actions = ['transfer', 'voteproducer', 'undelegatebw', 'delegatebw'];
        this.events = new core_1.EventEmitter();
        this.httpOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Origin,X-Requested-With,Content-Type,Accept',
                'Retry-After': 1
            }
        };
    }
    init() {
        this.fetchEOSprice().catch((err) => {
            console.log(err);
        });
        this.eosjs.online.asObservable().subscribe(value => {
            if (value) {
                const store = localStorage.getItem('actionStore.' + this.eosjs.chainId);
                if (store) {
                    this.actionStore = JSON.parse(store);
                }
                else {
                    // console.log ( this.selected.getValue ().name , 'creating new actionStore' );
                    if (this.selected.getValue().name !== undefined) {
                        this.actionStore[this.selected.getValue().name] = {
                            last_gs: 0,
                            actions: [],
                        };
                    }
                }
            }
        });
    }
    getStoredKey(account) {
        if (!account) {
            account = this.selected.getValue();
        }
        const store = localStorage.getItem('eos_keys.' + this.activeChain.id);
        let key = '';
        let _perm = '';
        if (store) {
            const keys = Object.keys(JSON.parse(store));
            account.details.permissions.forEach((p) => {
                if (p.required_auth.keys.length > 0) {
                    const legacyKey = p.required_auth.keys[0].key;
                    const newKey = dist_1.Numeric.convertLegacyPublicKey(legacyKey);
                    if (keys.includes(legacyKey)) {
                        key = legacyKey;
                        _perm = p.perm_name;
                    }
                    else if (keys.includes(newKey)) {
                        key = newKey;
                        _perm = p.perm_name;
                    }
                }
            });
        }
        return [key, _perm];
    }
    getStoredAuths(account) {
        const store = localStorage.getItem('eos_keys.' + this.activeChain.id);
        const auths = [];
        if (store) {
            const keys = Object.keys(JSON.parse(store));
            account.details.permissions.forEach((p) => {
                if (p.required_auth.keys.length > 0) {
                    const _k = p.required_auth.keys[0].key;
                    if (keys.includes(_k)) {
                        auths.push({
                            key: _k,
                            perm_name: p.perm_name,
                        });
                    }
                }
            });
        }
        return auths;
    }
    parseEOS(tk_string) {
        if (tk_string.split(' ')[1] === this.activeChain.symbol) {
            return parseFloat(tk_string.split(' ')[0]);
        }
        else {
            return 0;
        }
    }
    registerSymbol(data) {
        const idx = this.tokens.findIndex((val) => {
            return val.name === data.symbol;
        });
        let price = null;
        let usd_value = null;
        if (data.price) {
            price = data.price;
            usd_value = data.usd_value;
        }
        if (idx === -1) {
            const obj = {
                name: data.symbol,
                contract: data.contract,
                balance: data.balance,
                precision: data.precision,
                price,
                usd_value,
            };
            if (this.sessionTokens[this.selectedIdx]) {
                this.sessionTokens[this.selectedIdx].push(obj);
            }
            else {
                this.sessionTokens[this.selectedIdx] = [];
            }
            this.tokens.push(obj);
        }
    }
    calcTotalAssets() {
        let totalSum = 0;
        this.tokens.forEach(tk => {
            if (tk.price) {
                totalSum += (tk.balance * tk.price);
            }
        });
        this.totalAssetsSum = totalSum;
    }
    getTokenHyperionMulti(account) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.activeChain.hyperionApis) {
                return;
            }
            for (const api of this.activeChain.hyperionApis) {
                const url = api + '/state/get_tokens?account=' + account;
                try {
                    const response = yield this.http.get(url, this.httpOptions).toPromise();
                    if (response.tokens && response.tokens.length > 0) {
                        return response;
                    }
                }
                catch (e) {
                    console.log(`failed to fetch actions: ${api}`);
                }
            }
            return;
        });
    }
    fetchTokens(account) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.accounts.length === 0) {
                return;
            }
            if (!this.loadingTokens && ((Date.now() - this.lastTkLoadTime > 60 * 1000) || this.tokens.length === 0)) {
                this.loadingTokens = true;
                this.sessionTokens[this.selectedIdx] = [];
                // Load with hyperion multi
                this.lastTkLoadTime = Date.now();
                const data = yield this.getTokenHyperionMulti(account);
                if (data) {
                    const tokens = data.tokens;
                    for (const token of tokens) {
                        if (token.symbol !== this.activeChain.symbol) {
                            token.balance = token.amount;
                            token.usd_value = 0;
                            this.registerSymbol(token);
                        }
                    }
                    this.tokens.sort((a, b) => {
                        if (a.symbol < b.symbol) {
                            return -1;
                        }
                        if (a.symbol > b.symbol) {
                            return 1;
                        }
                        return 0;
                    });
                    this.lastTkLoadTime = Date.now();
                    this.loading = false;
                    this.accounts[this.selectedIdx].tokens = this.tokens;
                    this.loadingTokens = false;
                    return this.accounts;
                }
                else {
                    this.loading = false;
                    this.loadingTokens = false;
                    this.lastTkLoadTime = Date.now();
                    return null;
                }
                // }
            }
            else {
                if (this.tokens.length > 0) {
                    this.loadingTokens = false;
                }
                this.loading = false;
                return null;
            }
        });
    }
    processAction(act, id, block_num, date, account_action_seq) {
        const contract = act.account;
        const action_name = act.name;
        let symbol = '', user = '', type = '', memo = '';
        let votedProducers = null, proxy = null, voter = null;
        let cpu = 0, net = 0, amount = 0;
        if (typeof act.data === 'object') {
            if (action_name === 'transfer') {
                if (typeof act.data.amount === 'number') {
                    amount = act.data.amount;
                }
                else {
                    amount = (0, aux_functions_1.parseTokenValue)(act.data.quantity);
                }
                if (act.data.symbol) {
                    symbol = act.data.symbol;
                }
                else {
                    if (act.data.quantity) {
                        symbol = act.data.quantity.split(' ')[1];
                    }
                }
                memo = act.data.memo;
                if (act.data.to === this.selected.getValue().name) {
                    user = act.data.from;
                    type = 'received';
                }
                else {
                    user = act.data.to;
                    type = 'sent';
                }
            }
            if (action_name === 'buyrambytes') {
                amount = act.data.bytes;
                symbol = 'bytes';
                if (act.data.receiver === this.selected.getValue().name) {
                    user = act.data.payer;
                    type = 'bytes_in';
                }
                else {
                    user = act.data.receiver;
                    type = 'bytes_out';
                }
            }
            if (action_name === 'sellram') {
                amount = act.data.bytes;
                symbol = 'bytes';
                user = act.data.account;
                type = 'bytes_s';
            }
            if (contract === 'eosio' && action_name === 'voteproducer') {
                votedProducers = act.data.producers;
                proxy = act.data.proxy;
                voter = act.data.voter;
                type = 'vote';
            }
            if (contract === 'eosio' && action_name === 'undelegatebw') {
                cpu = (0, aux_functions_1.parseTokenValue)(act.data.unstake_cpu_quantity);
                net = (0, aux_functions_1.parseTokenValue)(act.data.unstake_net_quantity);
                amount = cpu + net;
                if (act.data.from === act.data.receiver) {
                    user = act.data.from;
                    type = 'unstaked_in';
                }
                else {
                    user = act.data.receiver;
                    type = 'unstaked_out';
                }
            }
            if (contract === 'eosio' && action_name === 'delegatebw') {
                cpu = (0, aux_functions_1.parseTokenValue)(act.data.stake_cpu_quantity);
                net = (0, aux_functions_1.parseTokenValue)(act.data.stake_net_quantity);
                amount = cpu + net;
                if (act.data.from === act.data.receiver) {
                    user = act.data.from;
                    type = 'staked_in';
                }
                else {
                    user = act.data.receiver;
                    type = 'staked_out';
                }
            }
            if ((contract === 'eosio' && action_name === 'refund')) {
                type = 'refund';
            }
            if (act.data.to === 'eosio.ram') {
                type = 'buyram';
            }
            if (act.data.from === 'eosio.ram') {
                type = 'sellram';
            }
            if ((contract !== 'eosio' && contract !== 'eosio.token' && action_name !== 'transfer')) {
                if (!act.data.to && !act.data.from) {
                    type = 'other';
                    const dataInfo = act.data;
                    Object.keys(dataInfo).forEach((dt) => {
                        memo += dt + ': ' + dataInfo[dt] + '; ';
                    });
                }
                else {
                    type = 'other2';
                    const dataInfo = act.data;
                    Object.keys(dataInfo).forEach((dt) => {
                        memo += dt + ': ' + dataInfo[dt] + '; ';
                    });
                }
            }
            if ((contract === 'eosio' && action_name === 'newaccount')) {
                type = 'new';
                user = act.data.newact;
                memo = JSON.stringify(act.data);
            }
            if ((contract === 'eosio' && action_name === 'mvtosavings')) {
                type = 'mvtosavings';
                amount = (0, aux_functions_1.parseTokenValue)(act.data.rex);
                symbol = 'REX';
            }
            if ((contract === 'eosio' && action_name === 'mvfrsavings')) {
                type = 'mvfrsavings';
                amount = (0, aux_functions_1.parseTokenValue)(act.data.rex);
                symbol = 'REX';
            }
            if ((contract === 'eosio' && action_name === 'unstaketorex')) {
                type = 'unstaketorex';
                cpu = (0, aux_functions_1.parseTokenValue)(act.data.from_cpu);
                net = (0, aux_functions_1.parseTokenValue)(act.data.from_net);
                amount = cpu + net;
            }
            if ((contract === 'eosio' && action_name === 'deposit')) {
                type = 'deposit';
            }
            if ((contract === 'eosio' && action_name === 'buyrex')) {
                type = 'buyrex';
                amount = (0, aux_functions_1.parseTokenValue)(act.data.amount);
            }
            if ((contract === 'eosio' && action_name === 'deposit')) {
                type = 'deposit';
                amount = (0, aux_functions_1.parseTokenValue)(act.data.amount);
            }
            if ((contract === 'eosio' && action_name === 'withdraw')) {
                type = 'withdraw';
                amount = (0, aux_functions_1.parseTokenValue)(act.data.amount);
            }
            if ((contract === 'eosio' && action_name === 'sellrex')) {
                type = 'sellrex';
                amount = (0, aux_functions_1.parseTokenValue)(act.data.rex);
                symbol = 'REX';
            }
            if ((contract === 'eosio' && action_name === 'rentcpu')) {
                type = 'rentcpu';
                user = act.data.receiver === this.selected.getValue().name ? 'this account' : act.data.receiver;
                amount = (0, aux_functions_1.parseTokenValue)(act.data.loan_payment);
            }
            if ((contract === 'eosio' && action_name === 'rentnet')) {
                user = act.data.receiver === this.selected.getValue().name ? 'this account' : act.data.receiver;
                type = 'rentnet';
                amount = (0, aux_functions_1.parseTokenValue)(act.data.loan_payment);
            }
        }
        const allowedActions = [
            'eosio::newaccount',
            'eosio.token::transfer',
            'eosio::delegatebw',
            'eosio::undelegatebw',
            'eosio::refund',
            'eosio::voteproducer',
            'eosio::sellram',
            'eosio::buyrambytes',
            'eosio::mvtosavings',
            'eosio::mvfrsavings',
            'eosio::unstaketorex',
            'eosio::buyrex',
            'eosio::sellrex',
            'eosio::deposit',
            'eosio::withdraw',
            'eosio::rentcpu',
            'eosio::rentnet',
        ];
        const matched = allowedActions.includes(contract + '::' + action_name);
        const precisionRound = Math.pow(10, this.activeChain.precision);
        const obj = {
            id,
            seq: account_action_seq,
            type,
            action_name,
            contract,
            user,
            block: block_num,
            date,
            amount: (Math.round(amount * precisionRound) / precisionRound),
            symbol,
            memo,
            votedProducers,
            proxy,
            voter,
            matched,
            json_data: act.data,
        };
        // this.actions.unshift(obj);
        if (this.actions.findIndex((a) => {
            return obj.seq === a.seq;
        }) === -1) {
            this.actions.push(obj);
        }
    }
    getAccActions(account) {
        return __awaiter(this, void 0, void 0, function* () {
            if (account === null) {
                account = this.selected.getValue().name;
            }
            const store = localStorage.getItem('actionStore.' + this.activeChain.id);
            if (store) {
                this.actionStore = JSON.parse(store.toString());
            }
            if (!this.actionStore[this.selected.getValue().name]) {
                this.actionStore[this.selected.getValue().name] = {
                    last_gs: 0,
                    actions: [],
                };
            }
            if (!this.accounts[this.selectedIdx].lastActionCheck || Date.now() - this.accounts[this.selectedIdx].lastActionCheck > 30000) {
                yield this.getActions(account, 0, 12, 0).catch(console.log);
            }
        });
    }
    getActionsHyperionMulti(account, limit, skip, filter, after, before, parent) {
        return __awaiter(this, void 0, void 0, function* () {
            let result;
            if (!this.activeChain.hyperionApis) {
                return false;
            }
            if (this.activeChain.hyperionApis.length === 0) {
                return false;
            }
            const apis = this.activeChain.hyperionApis;
            // if (!this.activeChain.hyperionProviders) {
            //     this.checkHyperionProviders().catch(console.log);
            // } else {
            //     if (this.activeChain.hyperionProviders.length > 0) {
            //         apis = this.activeChain.hyperionProviders.map(a => a.url);
            //     }
            // }
            this.bestApiHyperion = '';
            let bestUrl = '';
            for (const api of apis) {
                if (!result) {
                    let url = api + '/history/get_actions?account=' + account + '&limit=' + limit + '&skip=' + skip;
                    url = url + (filter !== '' && filter !== undefined ? filter : '');
                    url = url + (after !== '' && after !== undefined ? '&after=' + after : '');
                    url = url + (before !== '' && before !== undefined ? '&before=' + before : '');
                    url = url + (parent !== '' && parent !== undefined ? '&parent=' + parent : '');
                    try {
                        const tref = Date.now();
                        const response = yield this.http.get(url, this.httpOptions).toPromise();
                        if (response.actions && response.actions.length > 0) {
                            const latency = Date.now() - tref;
                            console.log(`Used ${api} with ${latency} ms latency`);
                            // const provider = this.activeChain.hyperionProviders.find(p => p.url === api);
                            // provider.latency = latency;
                            this.bestApiHyperion = api;
                            bestUrl = api;
                            result = response;
                        }
                    }
                    catch (e) {
                        console.log(e);
                        console.log(`failed to fetch actions: ${api}`);
                    }
                }
            }
            if (result) {
                this.updateActionStore(account, result.actions);
                for (const action of this.actionStore[account].actions) {
                    const act = action.act;
                    const tx_id = action.trx_id;
                    const blk_num = action.block_num;
                    const blk_time = action['@timestamp'];
                    const seq = action.global_sequence;
                    try {
                        this.processAction(act, tx_id, blk_num, blk_time, seq);
                    }
                    catch (e) {
                        console.log(act);
                        console.log(e);
                    }
                }
                this.totalActions = result.total.value;
                this.accounts[this.selectedIdx].actions = this.actions;
                this.calcTotalAssets();
                if (!this.accounts[this.selectedIdx].lastActionCheck || Date.now() - this.accounts[this.selectedIdx].lastActionCheck > 60000) {
                    yield this.checkLastActions(bestUrl, account);
                }
                return true;
            }
            else {
                console.log('no action history from hyperion endpoints');
                this.actions = [];
                this.totalActions = 0;
                return false;
            }
        });
    }
    getActions(account, pos, offset, skip, filter, after, before, parent) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`getActions`, account, pos, offset);
            if (!account) {
                console.log(new Error('no account'));
                return;
            }
            this.actions = [];
            // check history using hyperion
            const hyperionStatus = yield this.getActionsHyperionMulti(account, offset, skip, filter, after, before, parent);
            if (hyperionStatus) {
                this.accounts[this.selectedIdx].lastActionCheck = Date.now();
                return;
            }
            // fallback to native
            console.log('start loading history...');
            const _position = pos === 0 ? -1 : pos;
            const _offset = pos === 0 ? -offset : -(offset - 1);
            this.eosjs.getAccountActions(account, _position, _offset).then((val) => {
                const actions = val.actions;
                actions.reverse();
                if (actions.length > 0) {
                    if (pos === 0) {
                        this.totalActions = actions[0].account_action_seq + 1;
                    }
                    this.updateActionStore(account, actions);
                }
                console.log('Total Actions:' + this.totalActions);
                this.actionStore[account].actions.forEach((action) => {
                    let act, tx_id, blk_num, blk_time, seq;
                    if (action.action_trace) {
                        act = action.action_trace.act;
                        tx_id = action.action_trace.trx_id;
                        blk_num = action.block_num;
                        blk_time = action.block_time;
                        seq = action.account_action_seq;
                    }
                    else {
                        act = action.act;
                        tx_id = action.trx_id;
                        blk_num = action.block_num;
                        blk_time = action.block_time;
                        seq = action.receipt.global_sequence;
                    }
                    this.processAction(act, tx_id, blk_num, blk_time, seq);
                });
                this.accounts[this.selectedIdx].actions = this.actions;
                this.calcTotalAssets();
            }).catch((err) => {
                console.log(err);
            });
            console.log('finish loading history!');
        });
    }
    checkLastActions(api, account) {
        return __awaiter(this, void 0, void 0, function* () {
            let pastDayActivity = false;
            let hasNewReceived = false;
            const nowDate = moment.utc(moment().local()).toISOString();
            const beforeDate = moment.utc(moment().local()).subtract(1, 'days').toISOString();
            const precision = this.activeChain.precision;
            const notifications = [];
            const url = api + '/history/get_actions?' +
                'limit=10' +
                '&hot_only=true' +
                '&skip=0' +
                '&account=' + account +
                '&after=' + beforeDate +
                '&before=' + nowDate;
            try {
                const response = yield this.http.get(url, this.httpOptions).toPromise();
                if (response.actions.length > 0) {
                    response.actions.forEach(act => {
                        if (act.act.name === 'transfer') {
                            if (act.act.data.amount > 0.0001) {
                                if (act.act.data.to === account) {
                                    const hasSymbol = notifications.find(e => e.symbol = act.act.data.symbol);
                                    if (notifications.length > 0 && hasSymbol) {
                                        hasSymbol.amountSum += act.act.data.amount;
                                    }
                                    else {
                                        notifications.push({
                                            amountSum: act.act.data.amount,
                                            symbol: act.act.data.symbol
                                        });
                                    }
                                    hasNewReceived = true;
                                }
                            }
                        }
                        // check for resource usage on the last 24 hours
                        const actor = act.act.authorization.find(auth => auth.actor === account);
                        if (!pastDayActivity && actor) {
                            pastDayActivity = true;
                        }
                    });
                }
                this.accounts[this.selectedIdx].lastActionCheck = Date.now();
            }
            catch (e) {
                console.log(`failed to fetch actions: ${api}`);
            }
            if (hasNewReceived) {
                notifications.forEach(data => {
                    this.notification.onNotification(`
                     <div class="snotifyToast__subtitle">Notification</div>
                     <div class="snotifyToast__title">Recently received </div>
                     <div class="snotifyToast__body">To:  <i>${account}</i> <br/>
                        Amount: ${data.amountSum.toFixed(precision)} ${data.symbol} </div>`);
                });
            }
            this.accounts[this.selectedIdx].pastDayActivity = pastDayActivity;
        });
    }
    reloadActions(account) {
        this.getAccActions(account).catch(console.log);
    }
    select(index) {
        const sel = this.accounts[index];
        this.loading = true;
        this.tokens = [];
        if (sel) {
            if (sel.actions && sel) {
                if (sel.actions.length > 0) {
                    this.actions = sel.actions;
                }
            }
            else {
                this.actions = [];
            }
            this.selectedIdx = index;
            this.selected.next(sel);
            this.fetchTokens(sel.name).catch(console.log);
        }
    }
    initFirst() {
        this.select(0);
    }
    importAccounts(accounts) {
        return __awaiter(this, void 0, void 0, function* () {
            const chain_id = this.eosjs.chainId;
            const payload = { importedOn: new Date(), updatedOn: new Date(), accounts };
            localStorage.setItem('simpleos.accounts.' + chain_id, JSON.stringify(payload));
            localStorage.setItem('simplEOS.init', 'true');
            yield this.loadLocalAccounts(accounts);
            return accounts;
        });
    }
    appendNewAccount(account) {
        return new Promise((resolve, reject2) => {
            const chain_id = this.eosjs.chainId;
            let payload = JSON.parse(localStorage.getItem('simpleos.accounts.' + chain_id));
            if (!payload) {
                payload = {
                    accounts: [account],
                    updatedOn: new Date(),
                };
            }
            else {
                payload.accounts.push(account);
                payload.updatedOn = new Date();
            }
            localStorage.setItem('simpleos.accounts.' + chain_id, JSON.stringify(payload));
            localStorage.setItem('simplEOS.init', 'true');
            this.loadLocalAccounts(payload.accounts).then((data) => {
                resolve(data);
            }).catch(() => {
                reject2();
            });
        });
    }
    appendAccounts(accounts) {
        return __awaiter(this, void 0, void 0, function* () {
            const chain_id = this.eosjs.chainId;
            let payload = JSON.parse(localStorage.getItem('simpleos.accounts.' + chain_id));
            if (!payload) {
                payload = {
                    accounts: [],
                    updatedOn: new Date(),
                };
            }
            accounts.forEach((account) => {
                const idx = payload.accounts.findIndex((elem) => {
                    return elem.name === account.account_name || elem.account_name === account.account_name;
                });
                if (idx === -1) {
                    payload.accounts.push(account);
                }
                else {
                    this.notification.onInfo('Import', 'The account ' + account.account_name + ' was already imported! Skipping...');
                }
            });
            payload.updatedOn = new Date();
            this.events.emit({ event: 'imported_accounts', data: accounts });
            localStorage.setItem('simpleos.accounts.' + chain_id, JSON.stringify(payload));
            localStorage.setItem('simplEOS.init', 'true');
            return yield this.loadLocalAccounts(payload.accounts);
        });
    }
    loadLocalAccounts(data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (data.length > 0) {
                this.accounts = [
                    ...data.map((value) => {
                        return !value.details ? { name: value.account_name, full_balance: 0, details: value } : value;
                    })
                ];
                // reload all account
                yield this.refreshFromChain(true);
                // select first tab
                this.select(0);
            }
        });
    }
    refreshAccountFactory(account) {
        return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
            const newdata = yield this.eosjs.getAccountInfo(account.name);
            const tokens = yield this.eosjs.getTokens(account.name);
            let balance = 0;
            let ref_time = null;
            let ref_cpu = 0;
            let ref_net = 0;
            let staked = 0;
            const refund = newdata.refund_request;
            if (refund) {
                const precision = this.activeChain.precision;
                const symbol = this.activeChain.symbol;
                ref_cpu = this.parseEOS(refund.cpu_amount);
                ref_net = this.parseEOS(refund.net_amount);
                balance += ref_net;
                balance += ref_cpu;
                const tempDate = refund.request_time + '.000Z';
                ref_time = new Date(tempDate);
                const dateFormat = 'YYYY-MM-DD HH:mm:ss';
                const unstakeDate = moment(moment(ref_time).local());
                const threeDaysAgo = moment().local().subtract(72, 'hours').format(dateFormat);
                const differenceInHours = moment(unstakeDate).diff(threeDaysAgo, 'hours');
                if (differenceInHours < 0) {
                    const html = `<div class="snotifyToast__title">Refund to <i>(${account.name})</i></div>
                    <div class="snotifyToast__body">Balance: ${balance.toFixed(precision)} ${symbol} <br/>
                    ${moment(moment(ref_time).local()).fromNow()}</div>`;
                    this.notification.onNotification(html);
                }
            }
            tokens.forEach((tk) => {
                balance += this.parseEOS(tk);
            });
            let net = 0;
            let cpu = 0;
            if (newdata.self_delegated_bandwidth) {
                net = this.parseEOS(newdata.self_delegated_bandwidth.net_weight);
                cpu = this.parseEOS(newdata.self_delegated_bandwidth.cpu_weight);
                staked = net + cpu;
                balance += net;
                balance += cpu;
            }
            const precisionRound = Math.pow(10, this.activeChain.precision);
            if (!newdata.total_resources) {
                if (newdata.voter_info && newdata.voter_info.staked) {
                    staked = newdata.voter_info.staked / precisionRound;
                    balance += staked;
                }
            }
            account.name = account.name;
            account.full_balance = Math.round((balance) * precisionRound) / precisionRound;
            account.staked = staked;
            account.unstaking = ref_net + ref_cpu;
            account.unstakeTime = ref_time;
            account.details = newdata;
            this.lastUpdate.next({
                account: account.name,
                timestamp: new Date(),
            });
            resolve(account);
        }));
    }
    refreshFromChain(refreshAll, refreshOthers) {
        return __awaiter(this, void 0, void 0, function* () {
            // console.log(this.isRefreshing);
            if (this.isRefreshing) {
                return;
            }
            this.isRefreshing = true;
            const PQ = [];
            if (refreshAll) {
                for (const account of this.accounts) {
                    PQ.push(this.refreshAccountFactory(account));
                }
                this.accounts = yield Promise.all(PQ);
            }
            else {
                yield this.refreshAccountFactory(this.accounts[this.selectedIdx]);
                if (refreshOthers) {
                    for (const accountName of refreshOthers) {
                        const account = this.accounts.find((a) => a.name === accountName);
                        if (account) {
                            yield this.refreshAccountFactory(account);
                        }
                    }
                }
            }
            const resultToken = yield this.fetchTokens(this.selected.getValue().name);
            yield this.classifySigProviders();
            const resultStoreAccData = yield this.storeAccountData(this.accounts);
            console.log('finish resfresh');
            this.isRefreshing = false;
        });
    }
    readStoredAccounts() {
        const data = localStorage.getItem('simpleos.accounts.' + this.eosjs.chainId);
        if (data) {
            try {
                return JSON.parse(data).accounts;
            }
            catch (e) {
                return [];
            }
        }
        else {
            return [];
        }
    }
    storeAccountData(accounts) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('saving data...');
            if (accounts) {
                const data = localStorage.getItem('simpleos.accounts.' + this.eosjs.chainId);
                let payload;
                if (data) {
                    try {
                        payload = JSON.parse(data);
                    }
                    catch (e) {
                        console.log(e);
                        return false;
                    }
                }
                else {
                    payload = {};
                }
                payload.updatedOn = new Date();
                payload.accounts = accounts;
                localStorage.setItem('simpleos.accounts.' + this.eosjs.chainId, JSON.stringify(payload));
                return true;
            }
            else {
                return null;
            }
        });
    }
    storeUsageActionData(actionData) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('saving usage action data...');
            if (actionData.length > 0 && this.accounts) {
                const data = localStorage.getItem('simpleos.accounts.' + this.eosjs.chainId);
                let payload;
                if (data) {
                    try {
                        payload = JSON.parse(data);
                    }
                    catch (e) {
                        console.log(e);
                        return false;
                    }
                }
                else {
                    payload = {};
                }
                payload.usageAction = { updateDate: new Date(), actions: actionData };
                payload.updatedOn = new Date();
                payload.accounts = this.accounts;
                localStorage.setItem('simpleos.accounts.' + this.eosjs.chainId, JSON.stringify(payload));
                return true;
            }
            else {
                return null;
            }
        });
    }
    fetchEOSprice() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.activeChain.name === 'EOS MAINNET') {
                try {
                    const priceresult = yield this.eosjs.getMainnetTableRows('delphioracle', 'eosusd', 'datapoints');
                    this.usd_rate = priceresult.rows[0].median / 10000;
                    console.log(this.usd_rate);
                }
                catch (e) {
                    console.log(e);
                    this.usd_rate = 0;
                }
            }
            return null;
        });
    }
    updateActionStore(account, resultElement) {
        if (!this.actionStore[account]) {
            this.actionStore[account] = {
                actions: resultElement,
            };
        }
        else {
            this.actionStore[account].actions = resultElement;
        }
        const payload = JSON.stringify(this.actionStore);
        localStorage.setItem('actionStore.' + this.activeChain.id, payload);
    }
    sortProviders() {
        if (this.activeChain.hyperionProviders.length > 1) {
            this.activeChain.hyperionProviders.sort((a, b) => {
                return a.latency - b.latency;
            });
        }
    }
    checkHyperionProviders() {
        return __awaiter(this, void 0, void 0, function* () {
            this.activeChain.hyperionProviders = [];
            for (const api of this.activeChain.hyperionApis) {
                try {
                    const tref = Date.now();
                    const response = yield this.http.get(`${api}/history/get_actions?limit=1`, this.httpOptions).toPromise();
                    if (response.actions && response.actions.length === 1) {
                        const lastTimestamp = new Date(response.actions[0]['@timestamp'] + 'Z').getTime();
                        const now = Date.now();
                        this.activeChain.hyperionProviders.push({
                            url: api,
                            latency: (now - tref),
                            diff: (now - lastTimestamp)
                        });
                    }
                }
                catch (e) {
                    console.log(`${api} is not available`);
                }
            }
            this.sortProviders();
        });
    }
    classifySigProviders() {
        return __awaiter(this, void 0, void 0, function* () {
            for (const acc of this.accounts) {
                const [key, perm] = this.getStoredKey(acc);
                const mode = this.crypto.getPrivateKeyMode(key);
                if (mode) {
                    acc.type = mode;
                    acc.storedKey = key;
                    acc.storedPerm = perm;
                }
            }
        });
    }
};
AccountsService = __decorate([
    (0, core_1.Injectable)({
        providedIn: 'root',
    }),
    __metadata("design:paramtypes", [http_1.HttpClient,
        eosjs2_service_1.Eosjs2Service,
        crypto_service_1.CryptoService,
        notification_service_1.NotificationService])
], AccountsService);
exports.AccountsService = AccountsService;
//# sourceMappingURL=accounts.service.js.map