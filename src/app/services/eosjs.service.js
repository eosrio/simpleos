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
var EOSJS = require("../../assets/eos.js");
var rxjs_1 = require("rxjs");
var EOSJSService = /** @class */ (function () {
    function EOSJSService() {
        this.status = new rxjs_1.Subject();
        this.abiSmartContract = '';
        this.abiSmartContractActions = [];
        this.abiSmartContractStructs = [];
        this.baseConfig = {
            keyProvider: [],
            httpEndpoint: '',
            expireInSeconds: 60,
            broadcast: true,
            debug: false,
            sign: true,
            chainId: ''
        };
        this.basePublicKey = '';
        this.auth = false;
        this.constitution = '';
        this.txCheckQueue = [];
        this.txMonitorInterval = null;
        this.accounts = new rxjs_1.BehaviorSubject({});
        this.online = new rxjs_1.BehaviorSubject(false);
        this.eosio = null;
        this.ecc = EOSJS.modules['ecc'];
        this.format = EOSJS.modules['format'];
        this.ready = false;
        this.txh = [];
        this.actionHistory = [];
    }
    EOSJSService.prototype.reloadInstance = function () {
        this.auth = true;
        this.eos = EOSJS(this.baseConfig);
    };
    EOSJSService.prototype.clearInstance = function () {
        this.baseConfig.keyProvider = [];
        this.eos = EOSJS(this.baseConfig);
    };
    EOSJSService.prototype.clearSigner = function () {
        console.log(this.eos);
    };
    EOSJSService.prototype.loadNewConfig = function (signer) {
        this.eos = EOSJS({
            httpEndpoint: this.baseConfig.httpEndpoint,
            signProvider: signer,
            chainId: this.chainID,
            sign: true,
            broadcast: true
        });
    };
    EOSJSService.prototype.init = function (url, chain) {
        var _this = this;
        this.chainID = chain;
        return new Promise(function (resolve, reject) {
            _this.baseConfig.chainId = _this.chainID;
            _this.baseConfig.httpEndpoint = url;
            _this.eos = EOSJS(_this.baseConfig);
            _this.eos['getInfo']({}).then(function (result) {
                _this.ready = true;
                _this.online.next(result['head_block_num'] - result['last_irreversible_block_num'] < 400);
                var savedAcc = [];
                var savedpayload = localStorage.getItem('simpleos.accounts.' + _this.chainID);
                if (savedpayload) {
                    savedAcc = JSON.parse(savedpayload).accounts;
                    _this.loadHistory();
                }
                _this.eos['contract']('eosio').then(function (contract) {
                    _this.eosio = contract;
                    resolve(savedAcc);
                });
            }).catch(function (err) {
                reject(err);
            });
        });
    };
    EOSJSService.prototype.getKeyAccounts = function (pubkey) {
        return this.eos.getKeyAccounts(pubkey);
    };
    EOSJSService.prototype.getAccountInfo = function (name) {
        return this.eos['getAccount'](name);
    };
    EOSJSService.prototype.getAccountActions = function (name, last_ib) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.eos['getActions'](name, -1, 0).then(function (data) {
                resolve(data);
                // console.log(data);
            }).catch(function (error) {
                reject(error);
                // console.log(error);
            });
        });
    };
    EOSJSService.prototype.getChainInfo = function () {
        if (this.eos) {
            return this.eos['getTableRows']({
                json: true,
                code: 'eosio',
                scope: 'eosio',
                table: 'global'
            });
        }
        else {
            return new Promise(function (resolve) {
                resolve();
            });
        }
    };
    EOSJSService.prototype.getDappMetaData = function (dapp) {
        if (this.eos) {
            return this.eos['getTableRows']({
                json: true,
                code: 'dappmetadata',
                scope: dapp,
                table: 'dapps'
            });
        }
        else {
            return new Promise(function (resolve) {
                resolve();
            });
        }
    };
    EOSJSService.prototype.getRamMarketInfo = function () {
        if (this.eos) {
            return this.eos['getTableRows']({
                json: true,
                code: 'eosio',
                scope: 'eosio',
                table: 'rammarket'
            });
        }
        else {
            return new Promise(function (resolve) {
                resolve();
            });
        }
    };
    EOSJSService.prototype.getRefunds = function (account) {
        return this.eos['getTableRows']({
            json: true,
            code: 'eosio',
            scope: account,
            table: 'refunds'
        });
    };
    EOSJSService.prototype.listDelegations = function (account) {
        return this.eos['getTableRows']({
            json: true,
            code: 'eosio',
            scope: account,
            table: 'delband'
        });
    };
    EOSJSService.prototype.unDelegate = function (from, receiver, net, cpu, symbol) {
        //console.log(from, receiver, (net+' EOS'), (cpu+' EOS'));
        return this.eos.undelegatebw(from, receiver, (net + ' ' + symbol), (cpu + ' ' + symbol));
    };
    EOSJSService.prototype.delegateBW = function (from, receiver, net, cpu, symbol) {
        var _this = this;
        // console.log(from, receiver, (net +' EOS'), (cpu +' EOS'));
        return new Promise(function (resolve, reject) {
            _this.eos.delegatebw(from, receiver, (net + ' ' + symbol), (cpu + ' ' + symbol), 0).then(function (data) {
                resolve(data);
            }).catch(function (err2) {
                reject(err2);
            });
        });
    };
    EOSJSService.prototype.claimRefunds = function (account, k) {
        this.baseConfig.keyProvider = [k];
        var tempEos = EOSJS(this.baseConfig);
        return tempEos['refund']({ owner: account }, {
            broadcast: true,
            sign: true,
            authorization: account + '@active'
        });
    };
    EOSJSService.prototype.checkAccountName = function (name) {
        return this.format['encodeName'](name);
    };
    EOSJSService.prototype.loadPublicKey = function (pubkey) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (_this.ecc['isValidPublic'](pubkey)) {
                _this.getKeyAccounts(pubkey).then(function (data) {
                    console.log('load', data);
                    // if (data['account_names'].length > 0) {
                    if (data.length > 0) {
                        var promiseQueue_1 = [];
                        // data['account_names'].forEach((acc) => {
                        data.forEach(function (acc) {
                            var tempPromise = new Promise(function (resolve1, reject1) {
                                // this.getAccountInfo(acc).then((acc_data) => {
                                _this.getAccountInfo(acc.account).then(function (acc_data) {
                                    console.log(acc_data.permissions[0]['required_auth']['keys'][0].key);
                                    // if (acc_data.permissions[0]['required_auth']['keys'][0].key === pubkey) {
                                    _this.getTokens(acc_data['account_name']).then(function (tokens) {
                                        acc_data['tokens'] = tokens;
                                        _this.accounts[acc] = acc_data;
                                        resolve1(acc_data);
                                    }).catch(function (err) {
                                        console.log(err);
                                        reject1();
                                    });
                                    // } else {
                                    //   reject1();
                                    // }
                                });
                            });
                            promiseQueue_1.push(tempPromise);
                        });
                        Promise.all(promiseQueue_1).then(function (results) {
                            resolve({
                                foundAccounts: results,
                                publicKey: pubkey
                            });
                        }).catch(function () {
                            reject({ message: 'non_active' });
                        });
                    }
                    else if (data['account_names'].length > 0) {
                        var promiseQueue_2 = [];
                        data['account_names'].forEach(function (acc) {
                            // data.forEach((acc) => {
                            var tempPromise = new Promise(function (resolve1, reject1) {
                                _this.getAccountInfo(acc).then(function (acc_data) {
                                    // this.getAccountInfo(acc.account).then((acc_data) => {
                                    console.log(acc_data.permissions[0]['required_auth']['keys'][0].key);
                                    if (acc_data.permissions[0]['required_auth']['keys'][0].key === pubkey) {
                                        _this.getTokens(acc_data['account_name']).then(function (tokens) {
                                            acc_data['tokens'] = tokens;
                                            _this.accounts[acc] = acc_data;
                                            resolve1(acc_data);
                                        }).catch(function (err) {
                                            console.log(err);
                                            reject1();
                                        });
                                    }
                                    else {
                                        reject1();
                                    }
                                });
                            });
                            promiseQueue_2.push(tempPromise);
                        });
                        Promise.all(promiseQueue_2).then(function (results) {
                            resolve({
                                foundAccounts: results,
                                publicKey: pubkey
                            });
                        }).catch(function () {
                            reject({ message: 'non_active' });
                        });
                    }
                    else {
                        reject({ message: 'no_account' });
                    }
                });
            }
            else {
                reject({ message: 'invalid' });
            }
        });
    };
    EOSJSService.prototype.storeAccountData = function (accounts) {
        if (accounts) {
            if (accounts.length > 0) {
                this.accounts.next(accounts);
                var payload = JSON.parse(localStorage.getItem('simpleos.accounts.' + this.chainID));
                payload.updatedOn = new Date();
                payload.accounts = accounts;
                localStorage.setItem('simpleos.accounts.' + this.chainID, JSON.stringify(payload));
            }
        }
    };
    EOSJSService.prototype.listProducers = function () {
        return this.eos['getProducers']({ json: true, limit: 200 });
    };
    EOSJSService.prototype.getTokens = function (name) {
        return this.eos['getCurrencyBalance']('eosio.token', name);
    };
    EOSJSService.prototype.getTransaction = function (hash) {
        var _this = this;
        if (this.ready) {
            this.eos['getTransaction'](hash).then(function (result) {
                _this.txh.push(result);
                _this.saveHistory();
                _this.loadHistory();
            });
        }
    };
    EOSJSService.prototype.getConstitution = function () {
        var _this = this;
        this.eos['getAbi']('eosio').then(function (data) {
            var temp = data['abi']['ricardian_clauses'][0]['body'];
            _this.constitution = temp.replace(/(?:\r\n|\r|\n)/g, '<br>');
        });
    };
    EOSJSService.prototype.getSCAbi = function (contract) {
        return this.eos['getAbi'](contract);
    };
    EOSJSService.prototype.pushActionContract = function (contract, action, form, account) {
        var _this = this;
        var options = { authorization: account + '@active' };
        console.log(form);
        return new Promise(function (resolve, reject) {
            _this.eos['contract'](contract).then(function (tc) {
                console.log('tem contract', tc);
                if (tc[action]) {
                    tc[action](form, options).then(function (dt) {
                        resolve(dt);
                    }).catch(function (err) {
                        reject(err);
                    });
                }
            }).catch(function (err2) {
                console.log('tem erro contract', err2);
                reject(err2);
            });
        });
    };
    EOSJSService.prototype.loadHistory = function () {
        this.actionHistory = [];
    };
    EOSJSService.prototype.saveHistory = function () {
        var payload = JSON.stringify(this.txh);
        localStorage.setItem('simpleos.txhistory.' + this.chainID, payload);
    };
    EOSJSService.prototype.transfer = function (contract, from, to, amount, memo) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                if (this.auth) {
                    if (contract === 'eosio.token') {
                        return [2 /*return*/, new Promise(function (resolve, reject) {
                                _this.eos['transfer'](from, to, amount, memo, function (err, trx) {
                                    console.log(err, trx);
                                    if (err) {
                                        reject(JSON.parse(err));
                                    }
                                    else {
                                        resolve(true);
                                    }
                                });
                            })];
                    }
                    else {
                        return [2 /*return*/, new Promise(function (resolve, reject) {
                                _this.eos['contract'](contract, function (err, tokenContract) {
                                    if (!err) {
                                        if (tokenContract['transfer']) {
                                            var options = { authorization: from + '@active' };
                                            tokenContract['transfer'](from, to, amount, memo, options, function (err2, trx) {
                                                console.log(err, trx);
                                                if (err2) {
                                                    reject(JSON.parse(err2));
                                                }
                                                else {
                                                    resolve(true);
                                                }
                                            });
                                        }
                                        else {
                                            reject();
                                        }
                                    }
                                    else {
                                        reject(JSON.parse(err));
                                    }
                                });
                            })];
                    }
                }
                return [2 /*return*/];
            });
        });
    };
    EOSJSService.prototype.checkPvtKey = function (k) {
        try {
            var pubkey = this.ecc['privateToPublic'](k);
            return this.loadPublicKey(pubkey);
        }
        catch (e) {
            console.log(e);
            return new Promise(function (resolve, reject) {
                reject(e);
            });
        }
    };
    EOSJSService.prototype.ramBuyBytes = function (payer, receiver, bytes) {
        return this.eos.buyrambytes(payer, receiver, parseInt(bytes));
    };
    EOSJSService.prototype.ramBuyEOS = function (payer, receiver, quant, symbol) {
        return this.eos.buyram(payer, receiver, quant.toFixed(4) + ' ' + symbol);
    };
    EOSJSService.prototype.ramSellBytes = function (account, bytes) {
        return this.eos.sellram(account, parseInt(bytes));
    };
    EOSJSService.prototype.createAccount = function (creator, name, owner, active, delegateAmount, rambytes, transfer, giftAmount, giftMemo, symbol) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (this.auth) {
                    return [2 /*return*/, this.eos.transaction(function (tr) {
                            tr['newaccount']({ creator: creator, name: name, owner: owner, active: active });
                            tr['buyrambytes']({ payer: creator, receiver: name, bytes: rambytes });
                            tr['delegatebw']({
                                from: creator, receiver: name,
                                stake_net_quantity: (delegateAmount * 0.3).toFixed(4) + ' ' + symbol,
                                stake_cpu_quantity: (delegateAmount * 0.7).toFixed(4) + ' ' + symbol,
                                transfer: transfer ? 1 : 0
                            });
                            if (giftAmount > 0) {
                                tr['transfer']({
                                    from: creator,
                                    to: name,
                                    quantity: giftAmount.toFixed(4) + ' ' + symbol,
                                    memo: giftMemo
                                });
                            }
                        })];
                }
                else {
                    return [2 /*return*/, new Promise(function (resolve) { return resolve(null); })];
                }
                return [2 /*return*/];
            });
        });
    };
    EOSJSService.prototype.startMonitoringLoop = function () {
        var _this = this;
        if (!this.txMonitorInterval) {
            console.log('Starting monitoring loop!');
            this.txMonitorInterval = setInterval(function () {
                _this.eos['getInfo']({}).then(function (info) {
                    var lib = info['last_irreversible_block_num'];
                    if (_this.txCheckQueue.length > 0) {
                        console.log('Loop pass - LIB = ' + lib);
                        _this.txCheckQueue.forEach(function (tx, idx) {
                            console.log(tx);
                            if (lib > tx.block) {
                                _this.eos['getTransaction']({ id: tx.id }).then(function (result) {
                                    console.log(result.id);
                                    if (result.id === tx.id) {
                                        _this.txh.push(result);
                                        console.log(result);
                                        _this.txCheckQueue.splice(idx, 1);
                                        _this.saveHistory();
                                        _this.loadHistory();
                                    }
                                });
                            }
                        });
                    }
                    else {
                        if (_this.txMonitorInterval !== null) {
                            console.log('Stopping monitoring loop!');
                            clearInterval(_this.txMonitorInterval);
                            _this.txMonitorInterval = null;
                        }
                    }
                });
            }, 500);
        }
        else {
            console.log('monitor is already polling');
        }
    };
    EOSJSService.prototype.voteProducer = function (voter, list) {
        return __awaiter(this, void 0, void 0, function () {
            var currentVotes;
            return __generator(this, function (_a) {
                if (list.length <= 30) {
                    currentVotes = list;
                    currentVotes.sort();
                    // const info = await this.eos['getInfo']({}).then(result => {
                    //   return result;
                    // });
                    // const broadcast_lib = info['last_irreversible_block_num'];
                    console.log(this.eos);
                    return [2 /*return*/, this.eosio['voteproducer'](voter, '', currentVotes).then(function (data) {
                            return JSON.stringify(data);
                        }).catch(function (err) {
                            return err;
                        })];
                    // return new Promise((resolve, reject) => {
                    //   const cb = (err, res) => {
                    //     if (err) {
                    //       reject(JSON.parse(err));
                    //     } else {
                    //       console.log(res);
                    //       // setTimeout(() => {
                    //       //   this.txCheckQueue.push({
                    //       //     block: broadcast_lib,
                    //       //     id: res['transaction_id']
                    //       //   });
                    //       //   this.startMonitoringLoop();
                    //       // }, 1000);
                    //       resolve(res);
                    //     }
                    //   };
                    //
                    // });
                }
                else {
                    return [2 /*return*/, new Error('Cannot cast more than 30 votes!')];
                }
                return [2 /*return*/];
            });
        });
    };
    EOSJSService.prototype.stake = function (account, amount, symbol) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (amount > 2) {
                var split = ((amount / 2) / 10000).toFixed(4);
                console.log(split);
                _this.eos['delegatebw']({
                    from: account,
                    receiver: account,
                    stake_net_quantity: split + ' ' + symbol,
                    stake_cpu_quantity: split + ' ' + symbol,
                    transfer: 0
                }, function (err, result) {
                    if (err) {
                        console.log(err);
                        reject(err);
                    }
                    else {
                        console.log(result);
                        resolve();
                    }
                });
            }
            else {
                reject();
            }
        });
    };
    EOSJSService.prototype.unstake = function (account, amount, symbol) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.eos['getAccount'](account).then(function (accountInfo) {
                var current_stake = accountInfo['cpu_weight'] + accountInfo['net_weight'];
                if (current_stake - amount >= 10000) {
                    var split = ((amount / 2) / 10000).toFixed(4);
                    _this.eos['undelegatebw']({
                        from: account,
                        receiver: account,
                        unstake_net_quantity: split + ' ' + symbol,
                        unstake_cpu_quantity: split + ' ' + symbol
                    }, function (err, result) {
                        if (err) {
                            console.log(err);
                            reject(err);
                        }
                        else {
                            console.log(result);
                            resolve();
                        }
                    });
                }
                else {
                    reject();
                }
            });
        });
    };
    EOSJSService = __decorate([
        core_1.Injectable(),
        __metadata("design:paramtypes", [])
    ], EOSJSService);
    return EOSJSService;
}());
exports.EOSJSService = EOSJSService;
//# sourceMappingURL=eosjs.service.js.map
