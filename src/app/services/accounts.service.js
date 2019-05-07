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
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var core_1 = require("@angular/core");
var rxjs_1 = require("rxjs");
var eosjs_service_1 = require("./eosjs.service");
var http_1 = require("@angular/common/http");
var angular2_toaster_1 = require("angular2-toaster");
var AccountsService = /** @class */ (function () {
    function AccountsService(http, eos, toaster) {
        var _this = this;
        this.http = http;
        this.eos = eos;
        this.toaster = toaster;
        this.selected = new rxjs_1.BehaviorSubject({});
        this.lastAccount = null;
        this.selectedIdx = 0;
        this.lastUpdate = new rxjs_1.Subject();
        this.usd_rate = 1;
        this.cmcListings = [];
        this.tokens = [];
        this.actions = [];
        this.sessionTokens = {};
        this.allowed_actions = [];
        this.totalAssetsSum = 0;
        this.loading = true;
        this.isLedger = false;
        this.hasAnyLedgerAccount = false;
        this.actionStore = {};
        this.accounts = [];
        this.usd_rate = 10.00;
        this.allowed_actions = ['transfer', 'voteproducer', 'undelegatebw', 'delegatebw'];
        this.fetchEOSprice();
        this.eos.online.asObservable().subscribe(function (value) {
            if (value) {
                var store = localStorage.getItem('actionStore.' + _this.eos.chainID);
                if (store) {
                    _this.actionStore = JSON.parse(store);
                }
                else {
                    // console.log('creating new actionStore');
                    _this.actionStore[_this.selected.getValue().name] = {
                        last_gs: 0,
                        actions: []
                    };
                }
            }
        });
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
    AccountsService.prototype.parseEOS = function (tk_string) {
        if (tk_string.split(' ')[1] === this.activeChain['symbol']) {
            return parseFloat(tk_string.split(' ')[0]);
        }
        else {
            return 0;
        }
    };
    AccountsService.prototype.extendAccount = function (acc) {
        var _this = this;
        var balance = 0;
        if (acc.tokens) {
            acc.tokens.forEach(function (tk) {
                balance += _this.parseEOS(tk);
            });
        }
        var net = 0;
        var cpu = 0;
        if (acc['self_delegated_bandwidth']) {
            net = this.parseEOS(acc['self_delegated_bandwidth']['net_weight']);
            cpu = this.parseEOS(acc['self_delegated_bandwidth']['cpu_weight']);
            balance += net;
            balance += cpu;
        }
        return {
            name: acc['account_name'],
            full_balance: Math.round((balance) * 10000) / 10000,
            staked: net + cpu,
            details: acc
        };
    };
    AccountsService.prototype.registerSymbol = function (data, contract) {
        var idx = this.tokens.findIndex(function (val) {
            return val.name === data['symbol'];
        });
        var price = null;
        var usd_value = null;
        if (data['price']) {
            price = data['price'];
            usd_value = data['usd_value'];
        }
        if (idx === -1) {
            var obj = {
                name: data['symbol'],
                contract: contract,
                balance: data['balance'],
                precision: data['precision'],
                price: price,
                usd_value: usd_value
            };
            this.sessionTokens[this.selectedIdx].push(obj);
            this.tokens.push(obj);
        }
    };
    AccountsService.prototype.calcTotalAssets = function () {
        var totalSum = 0;
        this.tokens.forEach(function (tk) {
            if (tk.price) {
                totalSum += (tk.balance * tk.price);
            }
        });
        this.totalAssetsSum = totalSum;
    };
    AccountsService.prototype.fetchTokens = function (account) {
        return __awaiter(this, void 0, void 0, function () {
            var data_1, contracts;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.sessionTokens[this.selectedIdx] = [];
                        if (!(this.activeChain['name'] === 'EOS MAINNET')) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.http.get('https://hapi.eosrio.io/data/tokens/' + account).toPromise()];
                    case 1:
                        data_1 = _a.sent();
                        contracts = Object.keys(data_1);
                        this.loading = false;
                        contracts.forEach(function (contract) {
                            if (data_1[contract]['symbol'] !== _this.activeChain['symbol']) {
                                _this.registerSymbol(data_1[contract], contract);
                            }
                        });
                        this.tokens.sort(function (a, b) {
                            return a.usd_value < b.usd_value ? 1 : -1;
                        });
                        this.accounts[this.selectedIdx]['tokens'] = this.tokens;
                        return [2 /*return*/, this.accounts];
                    case 2:
                        this.loading = false;
                        return [2 /*return*/, null];
                }
            });
        });
    };
    AccountsService.prototype.getTokenBalances = function () {
        var _this = this;
        this.tokens.forEach(function (tk, index) {
            if (_this.tokens[index]) {
                _this.fetchTokenPrice(tk.name).then(function (price) {
                    _this.tokens[index]['price'] = price;
                });
            }
        });
    };
    AccountsService.prototype.processAction = function (act, id, block_num, date, account_action_seq) {
        var contract = act['account'];
        var action_name = act['name'];
        var symbol = '', user = '', type = '', memo = '';
        var votedProducers = null, proxy = null, voter = null;
        var cpu = 0, net = 0, amount = 0;
        if (action_name === 'transfer') {
            if (contract === 'eosio.token') {
                // NATIVE TOKEN
                amount = act['data']['quantity']['split'](' ')[0];
                symbol = this.activeChain['symbol'];
            }
            else {
                // CUSTOM TOKEN
                amount = act['data']['quantity']['split'](' ')[0];
                symbol = act['data']['quantity']['split'](' ')[1];
            }
            memo = act['data']['memo'];
            if (act['data']['to'] === this.selected.getValue().name) {
                user = act['data']['from'];
                type = 'received';
            }
            else {
                user = act['data']['to'];
                type = 'sent';
            }
        }
        if (action_name === 'buyrambytes') {
            amount = act['data']['bytes'];
            symbol = 'bytes';
            if (act['data']['receiver'] === this.selected.getValue().name) {
                user = act['data']['payer'];
                type = 'bytes_in';
            }
            else {
                user = act['data']['receiver'];
                type = 'bytes_out';
            }
        }
        if (action_name === 'sellram') {
            amount = act['data']['bytes'];
            symbol = 'bytes';
            user = act['data']['account'];
            type = 'bytes_s';
        }
        if (contract === 'eosio' && action_name === 'voteproducer') {
            votedProducers = act['data']['producers'];
            proxy = act['data']['proxy'];
            voter = act['data']['voter'];
            type = 'vote';
        }
        if (contract === 'eosio' && action_name === 'undelegatebw') {
            cpu = parseFloat(act['data']['unstake_cpu_quantity'].split(' ')[0]);
            net = parseFloat(act['data']['unstake_net_quantity'].split(' ')[0]);
            amount = cpu + net;
            if (act['data']['from'] === act['data']['receiver']) {
                user = act['data']['from'];
                type = 'unstaked_in';
            }
            else {
                user = act['data']['receiver'];
                type = 'unstaked_out';
            }
        }
        if (contract === 'eosio' && action_name === 'delegatebw') {
            cpu = parseFloat(act['data']['stake_cpu_quantity'].split(' ')[0]);
            net = parseFloat(act['data']['stake_net_quantity'].split(' ')[0]);
            amount = cpu + net;
            if (act['data']['from'] === act['data']['receiver']) {
                user = act['data']['from'];
                type = 'staked_in';
            }
            else {
                user = act['data']['receiver'];
                type = 'staked_out';
            }
        }
        if (act['data']['to'] === 'eosio.ram') {
            type = 'buyram';
        }
        if (act['data']['from'] === 'eosio.ram') {
            type = 'sellram';
        }
        if ((contract !== 'eosio' && contract !== 'eosio.token' && action_name !== 'transfer')) {
            if (!act['data']['to'] && !act['data']['from']) {
                type = 'other';
                var dataInfo_1 = act['data'];
                Object.keys(dataInfo_1).forEach(function (dt) {
                    memo += dt + ': ' + dataInfo_1[dt] + '; ';
                });
            }
            else {
                type = 'other2';
                var dataInfo_2 = act['data'];
                Object.keys(dataInfo_2).forEach(function (dt) {
                    memo += dt + ': ' + dataInfo_2[dt] + '; ';
                });
            }
        }
        if ((contract === 'eosio' && action_name === 'newaccount')) {
            type = 'new';
            user = act['data']['name'];
            memo = JSON.stringify(act['data']);
        }
        var allowedActions = [
            'eosio::newaccount',
            'eosio.token::transfer',
            'eosio::delegatebw',
            'eosio::undelegatebw',
            'eosio::voteproducer',
            'eosio::sellram',
            'eosio::buyrambytes'
        ];
        var matched = allowedActions.includes(contract + '::' + action_name);
        var obj = {
            id: id,
            seq: account_action_seq,
            type: type,
            action_name: action_name,
            contract: contract,
            user: user,
            block: block_num,
            date: date,
            amount: amount,
            symbol: symbol,
            memo: memo,
            votedProducers: votedProducers,
            proxy: proxy,
            voter: voter,
            matched: matched,
            json_data: act['data']
        };
        // this.actions.unshift(obj);
        if (this.actions.findIndex(function (a) {
            return obj.seq === a.seq;
        }) === -1) {
            this.actions.push(obj);
        }
    };
    AccountsService.prototype.getAccActions = function (account) {
        var _this = this;
        var nActions = 100;
        if (this.activeChain.name === 'EOS MAINNET') {
            this.actions = [];
        }
        else {
            // console.log('Fetching actions', account, reload);
            if (account === null) {
                account = this.selected.getValue().name;
            }
            var store = localStorage.getItem('actionStore.' + this.activeChain['id']);
            if (store) {
                this.actionStore = JSON.parse(store.toString());
            }
            if (!this.actionStore[this.selected.getValue().name]) {
                this.actionStore[this.selected.getValue().name] = {
                    last_gs: 0,
                    actions: []
                };
            }
            // Test if mongo is available
            var currentEndpoint_1 = this.activeChain.endpoints.find(function (e) { return e.url === _this.eos.baseConfig.httpEndpoint; });
            if (currentEndpoint_1['version']) {
                if (currentEndpoint_1['version'] === 'mongo') {
                    this.getActions(account, nActions, 0);
                }
                else {
                    this.getActions(account, -(nActions), -1);
                }
            }
            else {
                // Test API
                console.log('Starting history api test');
                this.http.get(currentEndpoint_1['url'] + '/v1/history/get_actions/eosio/1').subscribe(function (result) {
                    if (result['actions']) {
                        if (result['actions'].length === 0) {
                            console.log('API RESULT - MONGODB');
                            currentEndpoint_1['version'] = 'mongo';
                            _this.getActions(account, nActions, 0);
                        }
                    }
                    else {
                        console.log('API RESULT - NATIVE');
                        currentEndpoint_1['version'] = 'native';
                        _this.getActions(account, -(nActions), -1);
                    }
                }, function () {
                    console.log('API RESULT - NATIVE');
                    currentEndpoint_1['version'] = 'native';
                    _this.getActions(account, -(nActions), -1);
                });
            }
        }
    };
    AccountsService.prototype.getActions = function (account, offset, pos) {
        var _this = this;
        this.actions = [];
        this.eos.getAccountActions(account, offset, pos).then(function (val) {
            // console.log(val);
            var actions = val['actions'];
            if (actions.length > 0) {
                _this.actionStore[account]['actions'] = actions;
                var payload = JSON.stringify(_this.actionStore);
                localStorage.setItem('actionStore.' + _this.activeChain['id'], payload);
            }
            _this.actionStore[account]['actions'].forEach(function (action) {
                var a_name, a_acct, a_recv, selAcc, act, tx_id, blk_num, blk_time, seq;
                if (action['action_trace']) {
                    // native history api
                    a_name = action['action_trace']['act']['name'];
                    a_acct = action['action_trace']['act']['account'];
                    a_recv = action['action_trace']['receipt']['receiver'];
                    selAcc = _this.selected.getValue().name;
                    act = action['action_trace']['act'];
                    tx_id = action['action_trace']['trx_id'];
                    blk_num = action['block_num'];
                    blk_time = action['block_time'];
                    seq = action['account_action_seq'];
                }
                else {
                    // mongo history api
                    a_name = action['act']['name'];
                    a_acct = action['act']['account'];
                    a_recv = action['receipt']['receiver'];
                    selAcc = _this.selected.getValue().name;
                    act = action['act'];
                    tx_id = action['trx_id'];
                    blk_num = action['block_num'];
                    blk_time = action['block_time'];
                    seq = action['receipt']['global_sequence'];
                }
                if (a_recv === selAcc || (a_recv === a_acct && a_name !== 'transfer')) {
                    _this.processAction(act, tx_id, blk_num, blk_time, seq);
                }
            });
            _this.totalActions = _this.actions.length;
            _this.accounts[_this.selectedIdx]['actions'] = _this.actions;
            _this.calcTotalAssets();
        }).catch(function (err) {
            console.log(err);
        });
    };
    AccountsService.prototype.reloadActions = function (account) {
        this.getAccActions(account);
    };
    AccountsService.prototype.select = function (index) {
        var sel = this.accounts[index];
        this.loading = true;
        this.tokens = [];
        if (sel['actions'] && sel) {
            if (sel.actions.length > 0) {
                this.actions = sel.actions;
            }
        }
        else {
            this.actions = [];
        }
        this.selectedIdx = index;
        this.selected.next(sel);
        // const pbk = this.selected.getValue().details.permissions[0].required_auth.keys[0].key;
        // const stored_data = JSON.parse(localStorage.getItem('eos_keys.' + this.eos.chainID));
        // if(this.isLedger){
        //   this.isLedger = stored_data[pbk]['private'] === 'ledger';
        // }
        // this.socket.emit('open_actions_cursor', {
        // 	account: this.selected.getValue().name
        // }, (result) => {
        // 	console.log(result);
        // });
        this.fetchTokens(this.selected.getValue().name).then(function () {
            // console.log(data);
        });
    };
    AccountsService.prototype.initFirst = function () {
        console.log('Account Service: selecting default account - ', this.selected.getValue().name);
        this.select(0);
    };
    AccountsService.prototype.importAccounts = function (accounts) {
        return __awaiter(this, void 0, void 0, function () {
            var chain_id, payload;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        chain_id = this.eos.chainID;
                        payload = { importedOn: new Date(), updatedOn: new Date(), accounts: accounts };
                        localStorage.setItem('simpleos.accounts.' + chain_id, JSON.stringify(payload));
                        localStorage.setItem('simplEOS.init', 'true');
                        return [4 /*yield*/, this.loadLocalAccounts(accounts)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, accounts];
                }
            });
        });
    };
    AccountsService.prototype.appendNewAccount = function (account) {
        var _this = this;
        return new Promise(function (resolve, reject2) {
            var chain_id = _this.eos.chainID;
            var payload = JSON.parse(localStorage.getItem('simpleos.accounts.' + chain_id));
            if (!payload) {
                payload = {
                    accounts: [account],
                    updatedOn: new Date()
                };
            }
            else {
                payload.accounts.push(account);
                payload['updatedOn'] = new Date();
            }
            localStorage.setItem('simpleos.accounts.' + chain_id, JSON.stringify(payload));
            localStorage.setItem('simplEOS.init', 'true');
            _this.loadLocalAccounts(payload.accounts).then(function (data) {
                resolve(data);
            }).catch(function () {
                reject2();
            });
        });
    };
    AccountsService.prototype.appendAccounts = function (accounts) {
        return __awaiter(this, void 0, void 0, function () {
            var chain_id, payload;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        chain_id = this.eos.chainID;
                        payload = JSON.parse(localStorage.getItem('simpleos.accounts.' + chain_id));
                        accounts.forEach(function (account) {
                            var idx = payload.accounts.findIndex(function (elem) {
                                return elem.name === account.account_name || elem.account_name === account.account_name;
                            });
                            if (idx === -1) {
                                payload.accounts.push(account);
                            }
                            else {
                                var toast = {
                                    type: 'info',
                                    title: 'Import',
                                    body: 'The account ' + account.account_name + ' was already imported! Skipping...',
                                    timeout: 10000,
                                    showCloseButton: true,
                                    bodyOutputType: angular2_toaster_1.BodyOutputType.TrustedHtml,
                                };
                                _this.toaster.popAsync(toast);
                            }
                        });
                        payload.updatedOn = new Date();
                        localStorage.setItem('simpleos.accounts.' + chain_id, JSON.stringify(payload));
                        localStorage.setItem('simplEOS.init', 'true');
                        return [4 /*yield*/, this.loadLocalAccounts(payload.accounts)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    AccountsService.prototype.loadLocalAccounts = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('Loading accounts', data);
                        if (!(data.length > 0)) return [3 /*break*/, 2];
                        this.accounts = [];
                        data.forEach(function (acc_data) {
                            acc_data.tokens = [];
                            if (!acc_data.details) {
                                _this.accounts.push(_this.extendAccount(acc_data));
                            }
                            else {
                                _this.accounts.push(acc_data);
                            }
                        });
                        this.select(0);
                        return [4 /*yield*/, this.refreshFromChain()];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2: return [2 /*return*/, null];
                }
            });
        });
    };
    AccountsService.prototype.refreshFromChain = function () {
        return __awaiter(this, void 0, void 0, function () {
            var PQ;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        PQ = [];
                        this.accounts.forEach(function (account, idx) {
                            var tempPromise = new Promise(function (resolve, reject2) { return __awaiter(_this, void 0, void 0, function () {
                                var newdata, tokens, balance, ref_time, ref_cpu, ref_net, refund, tempDate, net, cpu;
                                var _this = this;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.eos.getAccountInfo(account['name'])];
                                        case 1:
                                            newdata = _a.sent();
                                            return [4 /*yield*/, this.eos.getTokens(account['name'])];
                                        case 2:
                                            tokens = _a.sent();
                                            balance = 0;
                                            ref_time = null;
                                            ref_cpu = 0;
                                            ref_net = 0;
                                            refund = newdata['refund_request'];
                                            if (refund) {
                                                ref_cpu = this.parseEOS(refund['cpu_amount']);
                                                ref_net = this.parseEOS(refund['net_amount']);
                                                balance += ref_net;
                                                balance += ref_cpu;
                                                tempDate = refund['request_time'] + '.000Z';
                                                ref_time = new Date(tempDate);
                                            }
                                            tokens.forEach(function (tk) {
                                                balance += _this.parseEOS(tk);
                                            });
                                            net = 0;
                                            cpu = 0;
                                            if (newdata['self_delegated_bandwidth']) {
                                                net = this.parseEOS(newdata['self_delegated_bandwidth']['net_weight']);
                                                cpu = this.parseEOS(newdata['self_delegated_bandwidth']['cpu_weight']);
                                                balance += net;
                                                balance += cpu;
                                            }
                                            this.accounts[idx].name = account['name'];
                                            this.accounts[idx].full_balance = Math.round((balance) * 10000) / 10000;
                                            this.accounts[idx].staked = net + cpu;
                                            this.accounts[idx].unstaking = ref_net + ref_cpu;
                                            this.accounts[idx].unstakeTime = ref_time;
                                            this.accounts[idx].details = newdata;
                                            this.lastUpdate.next({
                                                account: account['name'],
                                                timestamp: new Date()
                                            });
                                            resolve();
                                            return [2 /*return*/];
                                    }
                                });
                            }); });
                            PQ.push(tempPromise);
                        });
                        return [4 /*yield*/, Promise.all(PQ).then(function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.fetchTokens(this.selected.getValue().name)];
                                        case 1:
                                            _a.sent();
                                            return [4 /*yield*/, this.eos.storeAccountData(this.accounts)];
                                        case 2: return [2 /*return*/, _a.sent()];
                                    }
                                });
                            }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    AccountsService.prototype.fetchListings = function () {
        var _this = this;
        this.http.get('https://api.coinmarketcap.com/v2/listings/').subscribe(function (result) {
            _this.cmcListings = result.data;
        });
    };
    AccountsService.prototype.fetchTokenPrice = function (symbol) {
        return __awaiter(this, void 0, void 0, function () {
            var id, i, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        id = null;
                        for (i = 0; i < this.cmcListings.length; i++) {
                            if (this.cmcListings[i].symbol === symbol) {
                                id = this.cmcListings[i].id;
                            }
                        }
                        if (!(id && symbol === 'EOSDAC')) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.http.get('https://api.coinmarketcap.com/v2/ticker/' + id + '/').toPromise()];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, parseFloat(result.data.quotes.USD['price'])];
                    case 2: return [2 /*return*/, null];
                }
            });
        });
    };
    AccountsService.prototype.fetchEOSprice = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.http.get('https://api.coinmarketcap.com/v2/ticker/1765/').toPromise()];
                    case 1:
                        result = _a.sent();
                        this.usd_rate = parseFloat(result.data.quotes.USD['price']);
                        return [2 /*return*/, null];
                }
            });
        });
    };
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
    AccountsService.prototype.injectLedgerSigner = function () {
        console.log('Ledger mode: ' + this.isLedger);
        if (this.isLedger) {
            var store = JSON.parse(localStorage.getItem('eos_keys.' + this.eos.chainID));
            var pbk = this.selected.getValue().details['permissions'][0]['required_auth'].keys[0].key;
            console.log('Publickey:', pbk);
            console.log(store);
            // if (store[pbk]['private'] === 'ledger') {
            //   this.ledger.enableLedgerEOS(store[pbk]['slot']);
            // } else {
            //   this.eos.clearSigner();
            // }
        }
        else {
            this.eos.clearSigner();
        }
    };
    AccountsService = __decorate([
        core_1.Injectable({
            providedIn: 'root'
        }),
        __metadata("design:paramtypes", [http_1.HttpClient,
            eosjs_service_1.EOSJSService,
            angular2_toaster_1.ToasterService])
    ], AccountsService);
    return AccountsService;
}());
exports.AccountsService = AccountsService;
//# sourceMappingURL=accounts.service.js.map