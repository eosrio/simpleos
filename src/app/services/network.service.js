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
var accounts_service_1 = require("../accounts.service");
var eosjs_service_1 = require("../eosjs.service");
var router_1 = require("@angular/router");
var Eos = require("../../assets/eos.js");
var rxjs_1 = require("rxjs");
var ledger_h_w_service_1 = require("./ledger-h-w.service");
var NetworkService = /** @class */ (function () {
    function NetworkService(eosjs, router, aService, ledger) {
        this.eosjs = eosjs;
        this.router = router;
        this.aService = aService;
        this.ledger = ledger;
        this.networks = [];
        this.mainnetActive = [];
        this.genesistx = 'ad77575a8b4f52e477682e712b1cbd884299468db6a94d909f90c6961cea9b02';
        this.voteref = 'b23f537e8ab29fbcec8b533081ef7e12b146899ca42a3fc9eb608258df9983d9';
        this.accountez = 'EOS7WdCcva3WtsJRckJWodnHLof5B7qwAyfJSaMZmfn7Dgn6TQDBu';
        this.txrefBlock = 191;
        this.voterefBlock = 572278;
        this.baseConfig = {
            httpEndpoint: '',
            expireInSeconds: 60,
            broadcast: true,
            debug: false,
            sign: true,
            chainId: ''
        };
        this.selectedEndpoint = new rxjs_1.BehaviorSubject(null);
        this.networkingReady = new rxjs_1.BehaviorSubject(false);
        this.connected = false;
        this.publicEndpoints = [
            { url: 'https://api.eosrio.io', owner: 'EOS Rio', latency: 0, filters: [], chain: 'EOS MAINNET' },
            { url: 'https://hapi.eosrio.io', owner: 'EOS Rio', latency: 0, filters: [], chain: 'EOS MAINNET' },
            { url: 'https://eu.eosdac.io', owner: 'eosDAC', latency: 0, filters: [], chain: 'EOS MAINNET' },
            { url: 'https://mainnet.eoscalgary.io', owner: 'eoscalgary', latency: 0, filters: [], chain: 'EOS MAINNET' },
            // {url: 'https://api.dpos.africa/', owner: 'EOS Africa', latency: 0, filters: [], chain: 'EOS MAINNET'},
            { url: 'https://api1.eosasia.one', owner: 'EOS Asia', latency: 0, filters: [], chain: 'EOS MAINNET' },
            { url: 'https://api.eoslaomao.com', owner: 'EOS Asia', latency: 0, filters: [], chain: 'EOS MAINNET' },
            { url: 'https://mainnet.genereos.io', owner: 'EOS Asia', latency: 0, filters: [], chain: 'EOS MAINNET' },
            { url: 'https://node1.eosphere.io', owner: 'EOS Asia', latency: 0, filters: [], chain: 'EOS MAINNET' },
            { url: 'https://proxy.eosnode.tools', owner: 'Proxy Node', latency: 0, filters: [], chain: 'EOS MAINNET' },
            { url: 'https://history.cryptolions.io', owner: 'EOS Cryptolions', latency: 0, filters: [], chain: 'EOS MAINNET' },
            { url: 'https://api.worbli.eosrio.io', owner: 'EOSRIo - Worbli', latency: 0, filters: [], chain: 'WORBLI MAINNET' },
            { url: 'https://api.worblisweden.org', owner: 'EOS Sweden - Worbli', latency: 0, filters: [], chain: 'WORBLI MAINNET' },
            // {url: 'https://jungle2.cryptolions.io:443', owner: 'Jungle 2', latency: 0, filters: [], chain: 'JUNGLE TESTNET'},
            { url: 'https://junglehistory.cryptolions.io:4433', owner: 'Jungle 2', latency: 0, filters: [], chain: 'JUNGLE TESTNET' },
            // {url: 'https://jungle-node.mywish.io', owner: 'Jungle 2', latency: 0, filters: [], chain: 'JUNGLE TESTNET'},
            { url: 'https://api.eos.miami:17441', owner: 'Telos', latency: 0, filters: [], chain: 'TELOS TESTNET' }
        ];
        this.validEndpoints = [];
        this.status = '';
        this.connectionTimeout = null;
        this.networks = [];
        this.mainnetActive = [];
        this.loadNetworks();
    }
    NetworkService.prototype.connect = function () {
        var _this = this;
        this.status = '';
        this.mainnetActive = [];
        this.aService.mainnetActive = [];
        this.mainnetId = '';
        this.mainnetActive = this.networks.find(function (chain) { return chain.active; });
        console.log(this.mainnetActive);
        this.aService.mainnetActive = this.mainnetActive;
        this.mainnetId = this.networks.find(function (chain) { return chain.active; }).id;
        this.networkingReady.next(false);
        var pQueue = [];
        this.connected = false;
        this.publicEndpoints.forEach(function (apiNode) {
            if (_this.mainnetActive['name'] === apiNode.chain) {
                pQueue.push(_this.apiCheck(apiNode));
            }
        });
        Promise.all(pQueue).then(function () {
            _this.extractValidNode();
        });
        console.log('Starting timer...');
        this.startTimeout();
    };
    NetworkService.prototype.loadNetworks = function () {
        var storeChain = localStorage.getItem('simplEOS.storeChain');
        if (storeChain) {
            this.networks = JSON.parse(storeChain);
        }
        console.log(this.networks);
    };
    NetworkService.prototype.startTimeout = function () {
        var _this = this;
        this.connectionTimeout = setTimeout(function () {
            console.log('Timeout!');
            if (!_this.networkingReady.getValue()) {
                _this.status = 'timeout';
                clearTimeout(_this.connectionTimeout);
                _this.networkingReady.next(false);
                _this.connectionTimeout = null;
            }
        }, 10000);
    };
    NetworkService.prototype.scanNodes = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, apiNode;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _i = 0, _a = this.publicEndpoints;
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        apiNode = _a[_i];
                        if (!(this.mainnetActive['name'] === apiNode.chain)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.apiCheck(apiNode)];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    NetworkService.prototype.extractValidNode = function () {
        this.validEndpoints = [];
        for (var _i = 0, _a = this.publicEndpoints; _i < _a.length; _i++) {
            var apiNode = _a[_i];
            if (this.mainnetActive['name'] === apiNode.chain) {
                if (apiNode.latency > 0 && apiNode.latency < 1200) {
                    // await this.filterCheck(apiNode).then(value => {
                    // 	const node = this.publicEndpoints;
                    // 	const nodeSel = node.find(ep => ep.url === apiNode.url);
                    // 	if (nodeSel.filters.length === 1) {
                    this.validEndpoints.push(apiNode);
                    // 	}
                    // });
                }
            }
        }
        this.selectEndpoint();
    };
    NetworkService.prototype.selectEndpoint = function () {
        var _this = this;
        var latency = 2000;
        this.validEndpoints.forEach(function (node) {
            if (_this.mainnetActive['name'] === node.chain) {
                if (node.latency < latency && node.latency > 1) {
                    latency = node.latency;
                    _this.selectedEndpoint.next(node);
                }
            }
        });
        if (this.selectedEndpoint.getValue() === null) {
            this.networkingReady.next(false);
        }
        else {
            console.log('Best Server Selected!', this.selectedEndpoint.getValue().url);
            this.startup(null);
        }
    };
    NetworkService.prototype.selectedEP = function () {
        return this.selectedEndpoint.getValue().url;
    };
    NetworkService.prototype.verifyFilters = function () {
    };
    NetworkService.prototype.filterCheck = function (server) {
        var _this = this;
        console.log('Starting filter check for ' + server.url);
        var config = this.baseConfig;
        config.httpEndpoint = server.url;
        config.chainId = this.mainnetId;
        var eosCK = Eos(config);
        var pq = [];
        var getkeyAcc = eosCK['getKeyAccounts'](this.accountez).then(function (info) {
            if (info.length > 0 || info['account_names'].length > 0) {
                _this.publicEndpoints.find(function (ep) { return ep.url === server.url; }).filters.push({ eosio: 'history' });
                return true;
            }
            else {
                console.log('eosio:history filter is disabled on ' + server.url);
            }
        }).catch(function (err) {
            console.log(err);
            return false;
        });
        pq.push(getkeyAcc);
        // 	if (err) {
        // 		console.log(err);
        // 		return err;
        // 	} else {
        // 		// return txInfo;
        // 		// if (txInfo.length > 0 || txInfo['account_names'] > 0 ) {
        // 		// 	this.publicEndpoints.find(ep => ep.url === server.url).filters.push({eosio:'history'});
        // 		// } else {
        // 		// 	console.log('eosio:history filter is disabled on ' + server.url);
        // 		// }
        // 	}
        // });
        // });
        // console.log(getAccKey);
        // pq.push(new Promise((resolve1) => {
        // 	eosCK['getTransaction'](this.genesistx, (err, txInfo) => {
        //     if (err) {
        //       console.log(err);
        //       resolve1();
        //     } else {
        //       if (txInfo['block_num'] === this.txrefBlock) {
        // 		  this.publicEndpoints.find(ep => ep.url === server.url).filters.push('eosio.token:transfer');
        //       } else {
        //         console.log('eosio.token:transfer filter is disabled on ' + server.url);
        //       }
        //       resolve1();
        //     }
        //   });
        // }));
        // pq.push(new Promise((resolve1) => {
        //   eos['getTransaction'](this.voteref, (err, txInfo) => {
        //     if (err) {
        //       console.log(err);
        //       resolve1();
        //     } else {
        //       if (txInfo['block_num'] === this.voterefBlock) {
        //         server.filters.push('eosio:voteproducer');
        //       } else {
        //         console.log('eosio:voteproducer filter is disabled on ' + server.url);
        //       }
        //       resolve1();
        //     }
        //   });
        // }));
        return Promise.all(pq);
    };
    NetworkService.prototype.apiCheck = function (server) {
        var _this = this;
        console.log('Starting latency check for ' + server.url);
        return new Promise(function (resolve) {
            var config = _this.baseConfig;
            config.httpEndpoint = server.url;
            config.chainId = _this.mainnetId;
            var eos = Eos(config);
            var refTime = new Date().getTime();
            var tempTimer = setTimeout(function () {
                server.latency = -1;
                resolve();
            }, 2000);
            try {
                eos['getInfo']({}, function (err) {
                    if (err) {
                        server.latency = -1;
                    }
                    else {
                        server.latency = ((new Date().getTime()) - refTime);
                        console.log(server.url, server.latency);
                    }
                    clearTimeout(tempTimer);
                    if (server.latency > 1 && server.latency < 200) {
                        // force quick connection
                        if (_this.connected === false) {
                            _this.connected = true;
                            _this.selectedEndpoint.next(server);
                            _this.startup(null);
                        }
                    }
                    resolve();
                });
            }
            catch (e) {
                server.latency = -1;
                resolve();
            }
        });
    };
    NetworkService.prototype.startup = function (url) {
        var _this = this;
        var endpoint = url;
        if (!url) {
            endpoint = this.selectedEndpoint.getValue().url;
        }
        else {
            this.status = '';
            this.networkingReady.next(false);
            this.startTimeout();
        }
        this.eosjs.init(endpoint, this.mainnetId).then(function (savedAccounts) {
            // if (this.ledger.isElectron()) {
            //   this.aService.checkLedgerAccounts().then(() => {
            //     this.ledger.initListener();
            //   });
            // }
            if (_this.connectionTimeout) {
                clearTimeout(_this.connectionTimeout);
                _this.networkingReady.next(true);
                _this.connectionTimeout = null;
            }
            if (savedAccounts) {
                if (savedAccounts.length > 0) {
                    _this.aService.loadLocalAccounts(savedAccounts);
                    _this.aService.initFirst();
                    _this.networkingReady.next(true);
                    _this.router['navigate'](['dashboard', 'wallet']);
                }
                else {
                    console.log('No saved accounts!');
                }
            }
        }).catch(function (err) {
            console.log('-------EOSJS_ERRO-------->', err);
            _this.networkingReady.next(false);
        });
    };
    NetworkService = __decorate([
        core_1.Injectable({
            providedIn: 'root'
        }),
        __metadata("design:paramtypes", [eosjs_service_1.EOSJSService, router_1.Router, accounts_service_1.AccountsService, ledger_h_w_service_1.LedgerHWService])
    ], NetworkService);
    return NetworkService;
}());
exports.NetworkService = NetworkService;
//# sourceMappingURL=network.service.js.map
