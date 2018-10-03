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
var eosjs_service_1 = require("./eosjs.service");
var http_1 = require("@angular/common/http");
var angular2_toaster_1 = require("angular2-toaster");
var AccountsService = /** @class */ (function () {
    function AccountsService(http, eos, toaster) {
        this.http = http;
        this.eos = eos;
        this.toaster = toaster;
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
        this.accounts = [];
        this.usd_rate = 10.00;
        this.allowed_actions = ['transfer', 'voteproducer', 'undelegatebw', 'delegatebw'];
        // this.fetchListings();
        this.fetchEOSprice();
    }
    AccountsService_1 = AccountsService;
    AccountsService.parseEOS = function (tk_string) {
        if (tk_string.split(' ')[1] === 'EOS') {
            return parseFloat(tk_string.split(' ')[0]);
        }
        else {
            return 0;
        }
    };
    AccountsService.extendAccount = function (acc) {
        var balance = 0;
        if (acc.tokens) {
            acc.tokens.forEach(function (tk) {
                balance += AccountsService_1.parseEOS(tk);
            });
        }
        var net = 0;
        var cpu = 0;
        if (acc['self_delegated_bandwidth']) {
            net = AccountsService_1.parseEOS(acc['self_delegated_bandwidth']['net_weight']);
            cpu = AccountsService_1.parseEOS(acc['self_delegated_bandwidth']['cpu_weight']);
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
                totalSum = totalSum + (tk.balance * tk.price);
            }
        });
        this.totalAssetsSum = totalSum;
    };
    AccountsService.prototype.fetchTokens = function (account) {
        var _this = this;
        // if (!this.sessionTokens[this.selectedIdx]) {
        this.sessionTokens[this.selectedIdx] = [];
        this.http.get('https://hapi.eosrio.io/data/tokens/' + account).subscribe(function (data) {
            var contracts = Object.keys(data);
            _this.loading = false;
            contracts.forEach(function (contract) {
                if (data[contract]['symbol'] !== 'EOS') {
                    _this.registerSymbol(data[contract], contract);
                }
            });
            _this.tokens.sort(function (a, b) {
                return a.usd_value < b.usd_value ? 1 : -1;
            });
            _this.accounts[_this.selectedIdx]['tokens'] = _this.tokens;
        });
        // } else {
        //   this.loading = false;
        // }
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
    AccountsService.prototype.appendRecentActions = function (account) {
        var _this = this;
        this.eos['eos']['getActions']({
            account_name: account,
            offset: -2,
            pos: -1
        }).then(function (data) {
            data.actions.forEach(function (action) {
                _this.processAction(action.action_trace.act, action.action_trace.trx_id, action.block_num, action.block_time, true);
            });
            _this.accounts[_this.selectedIdx]['actions'] = _this.actions;
        });
    };
    AccountsService.prototype.processAction = function (act, id, block_num, date, append) {
        var contract = act['account'];
        var action_name = act['name'];
        var symbol = '', user = '', type = '', memo = '';
        var votedProducers = null, proxy = null, voter = null;
        var cpu = 0, net = 0, amount = 0;
        if (action_name === 'transfer') {
            if (contract === 'eosio.token') {
                // NATIVE TOKEN
                amount = act['data']['quantity']['split'](' ')[0];
                symbol = 'EOS';
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
            user = act['data']['from'];
            type = 'unstaked';
        }
        if (contract === 'eosio' && action_name === 'delegatebw') {
            cpu = parseFloat(act['data']['stake_cpu_quantity'].split(' ')[0]);
            net = parseFloat(act['data']['stake_net_quantity'].split(' ')[0]);
            amount = cpu + net;
            user = act['data']['from'];
            type = 'staked';
        }
        var valid = true;
        if (action_name === 'transfer') {
            if (act['data']['to'] === 'eosio.stake') {
                valid = false;
            }
        }
        if (this.allowed_actions.includes(action_name) && valid) {
            var idx = this.actions.findIndex(function (val) {
                return val.id === id;
            });
            if (idx === -1) {
                var obj = {
                    id: id, type: type, action_name: action_name,
                    contract: contract, user: user, block: block_num,
                    date: date, amount: amount, symbol: symbol,
                    memo: memo, votedProducers: votedProducers,
                    proxy: proxy, voter: voter
                };
                if (append) {
                    this.actions.unshift(obj);
                }
                else {
                    this.actions.push(obj);
                }
            }
        }
    };
    AccountsService.prototype.reloadActions = function (account) {
        var _this = this;
        this.http.get('https://hapi.eosrio.io/data/actions_limited/' + account).subscribe(function (actions) {
            _this.actions = [];
            actions.forEach(function (item) {
                var act = item['transaction']['trx']['transaction']['action'];
                var id = item['transaction']['trx']['id'];
                var block_num = item['block_num'];
                var date = item['@timestamp'];
                _this.processAction(act, id, block_num, date, false);
            });
            _this.accounts[_this.selectedIdx]['actions'] = _this.actions;
            _this.appendRecentActions(account);
            _this.calcTotalAssets();
        });
    };
    AccountsService.prototype.select = function (index) {
        var sel = this.accounts[index];
        this.loading = true;
        // if (sel['tokens']) {
        //   if (sel.tokens.length > 0) {
        //     this.tokens = sel.tokens;
        //   }
        // } else {
        //   this.tokens = [];
        // }
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
        // if (this.tokens.length === 0) {
        this.fetchTokens(this.selected.getValue().name);
        // }
    };
    AccountsService.prototype.initFirst = function () {
        this.selectedIdx = 0;
        this.selected.next(this.accounts[0]);
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
        payload.accounts.push(account);
        payload.updatedOn = new Date();
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
                    _this.accounts.push(AccountsService_1.extendAccount(acc_data));
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
                                ref_net = AccountsService_1.parseEOS(refunds.rows[0]['cpu_amount']);
                                ref_cpu = AccountsService_1.parseEOS(refunds.rows[0]['cpu_amount']);
                                balance += ref_net;
                                balance += ref_cpu;
                                var tempDate = refunds.rows[0]['request_time'] + '.000Z';
                                ref_time = new Date(tempDate);
                            }
                            tokens.forEach(function (tk) {
                                balance += AccountsService_1.parseEOS(tk);
                            });
                            var net = 0;
                            var cpu = 0;
                            if (newdata['self_delegated_bandwidth']) {
                                net = AccountsService_1.parseEOS(newdata['self_delegated_bandwidth']['net_weight']);
                                cpu = AccountsService_1.parseEOS(newdata['self_delegated_bandwidth']['cpu_weight']);
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
    var AccountsService_1;
    AccountsService = AccountsService_1 = __decorate([
        core_1.Injectable({
            providedIn: 'root'
        }),
        __metadata("design:paramtypes", [http_1.HttpClient, eosjs_service_1.EOSJSService, angular2_toaster_1.ToasterService])
    ], AccountsService);
    return AccountsService;
}());
exports.AccountsService = AccountsService;
//# sourceMappingURL=accounts.service.js.map