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
Object.defineProperty(exports, "__esModule", { value: true });
var core_1 = require("@angular/core");
var rxjs_1 = require("rxjs");
var eosjs_service_1 = require("../eosjs.service");
var http_1 = require("@angular/common/http");
var angular2_toaster_1 = require("angular2-toaster");
var ledger_h_w_service_1 = require("./ledger-h-w.service");
var socketIo = require("socket.io-client");
var AccountsService = /** @class */ (function () {
    function AccountsService(http, eos, toaster, ledger) {
        var _this = this;
        this.http = http;
        this.eos = eos;
        this.toaster = toaster;
        this.ledger = ledger;
        this.mainnetActive = [];
        this.selected = new rxjs_1.BehaviorSubject({});
        this.selectedIdx = 0;
        this.lastUpdate = new rxjs_1.Subject();
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
        // this.fetchListings();
        this.fetchEOSprice();
        this.socket = socketIo('https://api.eosrio.io/');
        this.socket.on('data', function (data) {
            console.log(data);
        });
        this.eos.online.asObservable().subscribe(function (value) {
            if (value) {
                var store = localStorage.getItem('actionStore.' + _this.eos.chainID);
                if (store) {
                    _this.actionStore = JSON.parse(store);
                }
                else {
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
    AccountsService.prototype.activeChain = function (chainName) {
        var eos = true;
        var wbi = false;
        var jng = false;
        var tls = false;
        var CNval = chainName;
        if (localStorage.getItem('simplEOS.storeChain') && chainName === 'START') {
            var ssC = JSON.parse(localStorage.getItem('simplEOS.storeChain'));
            eos = ssC[0]['active'];
            wbi = ssC[1]['active'];
            tls = ssC[2]['active'];
            jng = ssC[3]['active'];
        }
        else {
            switch (chainName) {
                case 'EOS MAINNET': {
                    eos = true;
                    wbi = false;
                    jng = false;
                    tls = false;
                    break;
                }
                case 'WORBLI MAINNET': {
                    wbi = true;
                    eos = false;
                    jng = false;
                    tls = false;
                    break;
                }
                case 'JUNGLE TESTNET': {
                    jng = true;
                    eos = false;
                    wbi = false;
                    tls = false;
                    break;
                }
                case 'TELOS TESTNET': {
                    tls = true;
                    eos = false;
                    wbi = false;
                    jng = false;
                    break;
                }
                default: {
                    eos = true;
                    wbi = false;
                    jng = false;
                    tls = false;
                    break;
                }
            }
        }
        var mainNet = [{
                id: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
                symbol: 'EOS',
                name: 'EOS MAINNET',
                active: eos,
                firstApi: 'https://api.eosrio.io',
                history: true,
                send: true,
                resource: true,
                vote: true,
                dapps: true,
                addAcc: true,
                newAcc: true
            }, {
                id: '73647cde120091e0a4b85bced2f3cfdb3041e266cbbe95cee59b73235a1b3b6f',
                symbol: 'WBI',
                name: 'WORBLI MAINNET',
                active: wbi,
                firstApi: 'https://api.worbli.eosrio.io',
                history: true,
                send: true,
                resource: false,
                vote: false,
                dapps: true,
                addAcc: true,
                newAcc: false
            }, {
                id: '335e60379729c982a6f04adeaad166234f7bf5bf1191252b8941783559aec33e',
                symbol: 'TLOS',
                name: 'TELOS TESTNET',
                active: tls,
                firstApi: 'https://api.eos.miami:17441',
                history: true,
                send: true,
                resource: false,
                vote: true,
                dapps: true,
                addAcc: true,
                newAcc: true
            }, {
                id: 'e70aaab8997e1dfce58fbfac80cbbb8fecec7b99cf982a9444273cbc64c41473',
                symbol: 'EOS',
                name: 'JUNGLE TESTNET',
                active: jng,
                firstApi: 'https://jungle2.cryptolions.io:443',
                history: true,
                send: true,
                resource: true,
                vote: true,
                dapps: false,
                addAcc: true,
                newAcc: true
            }];
        localStorage.setItem('simplEOS.storeChain', JSON.stringify(mainNet));
    };
    AccountsService.prototype.parseEOS = function (tk_string) {
        if (tk_string.split(' ')[1] === this.mainnetActive['symbol']) {
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
                //console.log(tk.price);
                totalSum += (tk.balance * tk.price);
            }
        });
        this.totalAssetsSum = totalSum;
    };
    AccountsService.prototype.fetchTokens = function (account) {
        var _this = this;
        this.sessionTokens[this.selectedIdx] = [];
        this.http.get('https://hapi.eosrio.io/data/tokens/' + account).subscribe(function (data) {
            var contracts = Object.keys(data);
            _this.loading = false;
            contracts.forEach(function (contract) {
                if (data[contract]['symbol'] !== _this.mainnetActive['symbol']) {
                    _this.registerSymbol(data[contract], contract);
                }
            });
            _this.tokens.sort(function (a, b) {
                return a.usd_value < b.usd_value ? 1 : -1;
            });
            _this.accounts[_this.selectedIdx]['tokens'] = _this.tokens;
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
    AccountsService.prototype.processAction = function (act, id, block_num, date) {
        var contract = act['account'];
        var action_name = act['name'];
        var symbol = '', user = '', type = '', memo = '';
        var votedProducers = null, proxy = null, voter = null;
        var cpu = 0, net = 0, amount = 0;
        // console.log(act,date);
        if (action_name === 'transfer') {
            if (contract === 'eosio.token') {
                // NATIVE TOKEN
                amount = act['data']['quantity']['split'](' ')[0];
                symbol = this.mainnetActive['symbol'];
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
            // user = act['data']['from'];
            // type = 'unstaked';
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
        var valid = true;
        if (action_name === 'transfer') {
            if (act['data']['to'] === 'eosio.stake') {
                valid = false;
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
                var dataInfo = act['data'];
                for (var dt in dataInfo) {
                    memo += dt + ': ' + dataInfo[dt] + '; ';
                }
            }
            else {
                type = 'other2';
                // user = act['data']['from'];
                var dataInfo = act['data'];
                for (var dt in dataInfo) {
                    memo += dt + ': ' + dataInfo[dt] + '; ';
                }
            }
        }
        if ((contract === 'eosio' && action_name === 'newaccount')) {
            type = 'new';
            user = act['data']['name'];
            memo = JSON.stringify(act['data']);
        }
        var obj = {
            id: id,
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
            voter: voter
        };
        // this.actions.unshift(obj);
        this.actions.push(obj);
    };
    AccountsService.prototype.getAccActions = function (account, reload) {
        var _this = this;
        if (account === null) {
            account = this.selected.getValue().name;
        }
        this.actions = [];
        var last_gs = -1;
        if (this.actionStore[account]) {
            last_gs = this.actionStore[account]['last_gs'];
        }
        var limited = true;
        if (!this.actionStore[account]) {
            limited = false;
        }
        else {
            if (!this.actionStore[account]['last_gs']) {
                limited = false;
            }
        }
        if (reload) {
            last_gs = 0;
        }
        var store = localStorage.getItem('actionStore.' + this.mainnetActive['id']);
        if (store) {
            this.actionStore = JSON.parse(store.toString());
        }
        if (!this.actionStore[this.selected.getValue().name]) {
            this.actionStore[this.selected.getValue().name] = {
                last_gs: 0,
                actions: []
            };
        }
        // if(this.mainnetActive['name']==='EOS MAINNET') {
        //   this.socket.emit('get_actions', {
        //     account: account,
        //     limited: limited,
        //     last_gs: last_gs
        //   }, (results) => {
        //     console.log('Stream output: ', results);
        //
        //     if (results === 'end') {
        //       // console.log("socket", this.actionStore[account]['actions']);
        //       this.actionStore[account]['actions'].sort((a: any, b: any) => {
        //         const dB = new Date(b.block_time).getTime();
        //         const dA = new Date(a.block_time).getTime();
        //         return dA - dB;
        //       });
        //
        //       const payload = JSON.stringify(this.actionStore);
        //       localStorage.setItem('actionStore.' + this.eos.chainID, payload);
        //
        //       this.actionStore[account]['actions'].forEach((action) => {
        //         this.processAction(action['act'], action['trx_id'], action['block_num'], action['block_time']);
        //       });
        //       // this.actionStore[account]['actions'].forEach((action) => {
        //       //   this.processAction(action['act'], action['trx_id'], action['block_num'], action['block_time']);
        //       // });
        //
        //       this.totalActions = this.actionStore[account]['actions'].length;
        //       this.accounts[this.selectedIdx]['actions'] = this.actions;
        //       this.calcTotalAssets();
        //     }
        //   });
        // } else {
        //
        // }
        this.eos.getAccountActions(account, 0).then(function (val) {
            var actions = val['actions'];
            // console.log(val);
            var actions2 = [];
            var ls_gs = 0;
            if (actions.length > 0) {
                if (parseInt(val['actions'][0]['receipt']['global_sequence']) > parseInt(_this.actionStore[account]['last_gs'])) {
                    ls_gs = val['actions'][0]['receipt']['global_sequence'];
                }
                else {
                    ls_gs = _this.actionStore[account]['last_gs'];
                }
                actions.forEach(function (data) {
                    if (data['act']['account'] === data['receipt']['receiver']) {
                        // if( data['act']['data']['to'] !==  data['receipt']['receiver']){
                        // console.log(data);
                        actions2.push(data);
                        // }
                    }
                });
            }
            _this.actionStore[account]['last_gs'] = ls_gs;
            _this.actionStore[account]['actions'] = actions2;
            var payload = JSON.stringify(_this.actionStore);
            localStorage.setItem('actionStore.' + _this.mainnetActive['id'], payload);
        });
        this.actionStore[account]['actions'].forEach(function (action) {
            if (action['block_time'] === undefined || action['block_time'] === '') {
                _this.processAction(action['act'], action['trx_id'], action['recv_sequence'], action['createdAt']);
            }
            else {
                _this.processAction(action['act'], action['trx_id'], action['block_num'], action['block_time']);
            }
        });
        this.totalActions = this.actionStore[account]['actions'].length;
        this.accounts[this.selectedIdx]['actions'] = this.actions;
        this.calcTotalAssets();
    };
    AccountsService.prototype.reloadActions = function (account, reload) {
        console.log('reloading: ' + reload);
        // if (account) {
        //   this.socket.emit('close_actions_cursor', {
        //     account: account
        //   }, () => {
        //     this.socket.emit('open_actions_cursor', {
        //       account: account
        //     }, (result2) => {
        //       console.log(result2);
        this.getAccActions(account, reload);
        //     });
        //   });
        // }
    };
    AccountsService.prototype.select = function (index) {
        var sel = this.accounts[index];
        this.loading = true;
        this.tokens = [];
        if (sel['actions']) {
            if (sel.actions.length > 0) {
                this.actions = sel.actions;
            }
        }
        else {
            this.actions = [];
        }
        this.selectedIdx = index;
        this.selected.next(sel);
        var pbk = this.selected.getValue().details.permissions[0].required_auth.keys[0].key;
        var stored_data = JSON.parse(localStorage.getItem('eos_keys.' + this.eos.chainID));
        // if(this.isLedger){
        //   this.isLedger = stored_data[pbk]['private'] === 'ledger';
        // }
        this.socket.emit('open_actions_cursor', {
            account: this.selected.getValue().name
        }, function (result) {
            console.log(result);
        });
        this.fetchTokens(this.selected.getValue().name);
    };
    AccountsService.prototype.initFirst = function () {
        // this.selectedIdx = 0;
        // this.selected.next(this.accounts[0]);
        this.select(0);
    };
    AccountsService.prototype.importAccounts = function (accounts) {
        var chain_id = this.eos.chainID;
        var payload = {
            importedOn: new Date(),
            updatedOn: new Date(),
            accounts: accounts
        };
        localStorage.setItem('simpleos.accounts.' + chain_id, JSON.stringify(payload));
        this.loadLocalAccounts(accounts);
    };
    AccountsService.prototype.appendNewAccount = function (account) {
        var chain_id = this.eos.chainID;
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
        this.loadLocalAccounts(payload.accounts);
    };
    AccountsService.prototype.appendAccounts = function (accounts) {
        var _this = this;
        var chain_id = this.eos.chainID;
        var payload = JSON.parse(localStorage.getItem('simpleos.accounts.' + chain_id));
        accounts.forEach(function (account) {
            var idx = payload.accounts.findIndex(function (el) {
                return el.name === account.account_name || el.account_name === account.account_name;
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
        this.loadLocalAccounts(payload.accounts);
    };
    AccountsService.prototype.loadLocalAccounts = function (data) {
        var _this = this;
        if (data.length > 0) {
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
            this.refreshFromChain();
        }
    };
    AccountsService.prototype.refreshFromChain = function () {
        var _this = this;
        var PQ = [];
        this.accounts.forEach(function (account, idx) {
            var tempPromise = new Promise(function (resolve, reject) {
                _this.eos.getAccountInfo(account['name']).then(function (newdata) {
                    _this.eos.getTokens(account['name']).then(function (tokens) {
                        _this.eos.getRefunds(account['name']).then(function (refunds) {
                            var ref_time = null;
                            var balance = 0;
                            var ref_net = 0;
                            var ref_cpu = 0;
                            if (refunds.rows.length > 0) {
                                ref_net = _this.parseEOS(refunds.rows[0]['cpu_amount']);
                                ref_cpu = _this.parseEOS(refunds.rows[0]['cpu_amount']);
                                balance += ref_net;
                                balance += ref_cpu;
                                var tempDate = refunds.rows[0]['request_time'] + '.000Z';
                                ref_time = new Date(tempDate);
                            }
                            tokens.forEach(function (tk) {
                                balance += _this.parseEOS(tk);
                            });
                            var net = 0;
                            var cpu = 0;
                            if (newdata['self_delegated_bandwidth']) {
                                net = _this.parseEOS(newdata['self_delegated_bandwidth']['net_weight']);
                                cpu = _this.parseEOS(newdata['self_delegated_bandwidth']['cpu_weight']);
                                balance += net;
                                balance += cpu;
                            }
                            _this.accounts[idx].name = account['name'];
                            _this.accounts[idx].full_balance = Math.round((balance) * 10000) / 10000;
                            _this.accounts[idx].staked = net + cpu;
                            _this.accounts[idx].unstaking = ref_net + ref_cpu;
                            _this.accounts[idx].unstakeTime = ref_time;
                            _this.accounts[idx].details = newdata;
                            _this.lastUpdate.next({
                                account: account['name'],
                                timestamp: new Date()
                            });
                            resolve();
                        });
                    }).catch(function (error2) {
                        console.log('Error on getTokens', error2);
                        reject();
                    });
                }).catch(function (error1) {
                    console.log('Error on getAccountInfo', error1);
                    reject();
                });
            });
            PQ.push(tempPromise);
        });
        Promise.all(PQ).then(function () {
            _this.fetchTokens(_this.selected.getValue().name);
            _this.eos.storeAccountData(_this.accounts);
        });
    };
    AccountsService.prototype.fetchListings = function () {
        var _this = this;
        this.http.get('https://api.coinmarketcap.com/v2/listings/').subscribe(function (result) {
            _this.cmcListings = result.data;
        });
    };
    AccountsService.prototype.fetchTokenPrice = function (symbol) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var id = null;
            for (var i = 0; i < _this.cmcListings.length; i++) {
                if (_this.cmcListings[i].symbol === symbol) {
                    console.log('------->', _this.cmcListings[i]);
                    id = _this.cmcListings[i].id;
                }
            }
            if (id && symbol === 'EOSDAC') {
                _this.http.get('https://api.coinmarketcap.com/v2/ticker/' + id + '/').subscribe(function (result) {
                    resolve(parseFloat(result.data.quotes.USD['price']));
                }, function (err) {
                    reject(err);
                });
            }
            else {
                resolve(null);
            }
        });
    };
    AccountsService.prototype.fetchEOSprice = function () {
        var _this = this;
        this.http.get('https://api.coinmarketcap.com/v2/ticker/1765/').subscribe(function (result) {
            _this.usd_rate = parseFloat(result.data.quotes.USD['price']);
        });
    };
    AccountsService.prototype.checkLedgerAccounts = function () {
        var _this = this;
        var hasLedger = false;
        var stored_data = localStorage.getItem('eos_keys.' + this.eos.chainID);
        return new Promise(function (resolve) {
            _this.accounts.forEach(function (acc) {
                var pbk = acc.details.permissions[0].required_auth.keys[0];
                // if (stored_data[pbk]['private'] === 'ledger') {
                //   hasLedger = true;
                // }
            });
            _this.hasAnyLedgerAccount = hasLedger;
            resolve(hasLedger);
        });
    };
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
        __metadata("design:paramtypes", [http_1.HttpClient, eosjs_service_1.EOSJSService, angular2_toaster_1.ToasterService, ledger_h_w_service_1.LedgerHWService])
    ], AccountsService);
    return AccountsService;
}());
exports.AccountsService = AccountsService;
//# sourceMappingURL=accounts.service.js.map
