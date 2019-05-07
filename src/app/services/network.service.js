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
var accounts_service_1 = require("./accounts.service");
var eosjs_service_1 = require("./eosjs.service");
var router_1 = require("@angular/router");
var Eos = require("../../assets/eos.js");
var rxjs_1 = require("rxjs");
var crypto_service_1 = require("./crypto.service");
var voting_service_1 = require("./voting.service");
var chains_1 = require("../chains");
var NetworkService = /** @class */ (function () {
    function NetworkService(eosjs, router, aService, voting, crypto
    // private ledger: LedgerHWService
    ) {
        this.eosjs = eosjs;
        this.router = router;
        this.aService = aService;
        this.voting = voting;
        this.crypto = crypto;
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
        this.lastEndpoint = '';
        this.autoMode = false;
        this.activeChain = null;
        this.defaultChains = chains_1.defaultChainsJSON;
        var savedChainId = localStorage.getItem('simplEOS.activeChainID');
        if (savedChainId) {
            this.activeChain = this.defaultChains.find(function (chain) { return chain.id === savedChainId; });
        }
        else {
            var EOS_MAINNET_ID_1 = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';
            this.activeChain = this.defaultChains.find(function (chain) { return chain.id === EOS_MAINNET_ID_1; });
            localStorage.setItem('simplEOS.activeChainID', EOS_MAINNET_ID_1);
        }
        this.aService.activeChain = this.activeChain;
        this.validEndpoints = [];
        this.status = '';
        this.connectionTimeout = null;
    }
    NetworkService.prototype.connect = function (automatic) {
        var _this = this;
        console.log('analyzing endpoints...');
        this.autoMode = automatic;
        this.status = '';
        this.mainnetId = '';
        this.aService.activeChain = this.activeChain;
        this.mainnetId = this.activeChain['id'];
        this.networkingReady.next(false);
        var pQueue = [];
        this.connected = false;
        this.activeChain['endpoints'].forEach(function (apiNode) {
            pQueue.push(_this.apiCheck(apiNode));
        });
        Promise.all(pQueue).then(function () {
            _this.extractValidNode();
        });
        this.startTimeout();
    };
    NetworkService.prototype.changeChain = function (event) {
        this.activeChain = this.defaultChains.find(function (chain) { return chain.id === event.value; });
        if (this.activeChain) {
            this.aService.activeChain = this.activeChain;
            this.aService.accounts = [];
            this.voting.clearMap();
            this.voting.initList = false;
            this.aService.lastAccount = null;
            localStorage.setItem('simplEOS.activeChainID', this.activeChain.id);
            this.connect(false);
            console.log('Network switched to: ' + this.activeChain['name']);
        }
    };
    NetworkService.prototype.startTimeout = function () {
        var _this = this;
        if (!this.connectionTimeout) {
            this.connectionTimeout = setTimeout(function () {
                console.log('Timeout!');
                if (!_this.networkingReady.getValue()) {
                    _this.status = 'timeout';
                    clearTimeout(_this.connectionTimeout);
                    _this.networkingReady.next(false);
                    _this.connectionTimeout = null;
                }
            }, 10000);
        }
    };
    NetworkService.prototype.extractValidNode = function () {
        var _this = this;
        this.validEndpoints = [];
        this.activeChain.endpoints.forEach(function (apiNode) {
            if (apiNode.latency > 0 && apiNode.latency < 1200) {
                _this.validEndpoints.push(apiNode);
            }
        });
        this.selectEndpoint();
    };
    NetworkService.prototype.selectEndpoint = function () {
        var _this = this;
        var latency = 2000;
        if (this.connected === false) {
            this.validEndpoints.forEach(function (node) {
                if (node.latency < latency && node.latency > 1) {
                    latency = node.latency;
                    _this.selectedEndpoint.next(node);
                }
            });
            if (this.selectedEndpoint.getValue() === null) {
                this.networkingReady.next(false);
            }
            else {
                console.log('Best Server Selected!', this.selectedEndpoint.getValue().url);
                this.startup(null);
            }
        }
    };
    NetworkService.prototype.selectedEP = function () {
        return this.eosjs.baseConfig.httpEndpoint;
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
        return Promise.all(pq);
    };
    NetworkService.prototype.apiCheck = function (server) {
        var _this = this;
        // console.log('Starting latency check for ' + server.url);
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
                        // console.log(server.url, server.latency);
                    }
                    clearTimeout(tempTimer);
                    if (server.latency > 1 && server.latency < 200) {
                        // force quick connection
                        if (_this.connected === false) {
                            _this.connected = true;
                            _this.callStartupConn(server);
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
    NetworkService.prototype.callStartupConn = function (server) {
        if (this.connected === true) {
            console.log('fast api detected, connecting to:', server.url);
            this.selectedEndpoint.next(server);
            this.startup(null);
        }
    };
    NetworkService.prototype.startup = function (url) {
        var _this = this;
        var endpoint = url;
        if (!url) {
            endpoint = this.selectedEndpoint.getValue().url;
            console.log('switcing to saved endpoint:', endpoint);
        }
        else {
            this.status = '';
            console.log('startup called - url: ', url);
        }
        this.networkingReady.next(false);
        this.eosjs.online.next(false);
        this.startTimeout();
        // prevent double load after quick connection mode
        if (endpoint !== this.lastEndpoint || this.autoMode === true) {
            this.eosjs.init(endpoint, this.activeChain.id).then(function (savedAccounts) {
                // if (this.ledger.isElectron()) {
                //   this.aService.checkLedgerAccounts().then(() => {
                //     this.ledger.initListener();
                //   });
                // }
                _this.lastEndpoint = endpoint;
                _this.autoMode = false;
                _this.defaultChains.find(function (c) { return c.id === _this.activeChain.id; }).lastNode = _this.lastEndpoint;
                if (_this.connectionTimeout) {
                    clearTimeout(_this.connectionTimeout);
                    _this.networkingReady.next(true);
                    _this.connectionTimeout = null;
                }
                if (savedAccounts) {
                    if (savedAccounts.length > 0) {
                        console.log('Locading local accounts');
                        _this.aService.loadLocalAccounts(savedAccounts).then(function () {
                            if (_this.aService.lastAccount) {
                                _this.aService.select(_this.aService.accounts.findIndex(function (a) {
                                    return a.name === _this.aService.lastAccount;
                                }));
                            }
                            else {
                                _this.aService.initFirst();
                            }
                            // this.voting.forceReload();
                            _this.networkingReady.next(true);
                            _this.router['navigate'](['dashboard', 'wallet']);
                        });
                    }
                    else {
                        _this.networkingReady.next(true);
                        if (_this.crypto.locked) {
                            console.log('No saved accounts!');
                            _this.router['navigate'](['']);
                        }
                        else {
                            console.log('No saved accounts!');
                            _this.router['navigate'](['landing']);
                        }
                    }
                }
            }).catch(function (err) {
                console.log('>>> EOSJS_ERROR: ', err);
                _this.networkingReady.next(false);
            });
        }
        else {
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.networkingReady.next(true);
                this.connectionTimeout = null;
            }
            this.networkingReady.next(true);
        }
    };
    NetworkService = __decorate([
        core_1.Injectable({
            providedIn: 'root'
        }),
        __metadata("design:paramtypes", [eosjs_service_1.EOSJSService,
            router_1.Router,
            accounts_service_1.AccountsService,
            voting_service_1.VotingService,
            crypto_service_1.CryptoService
            // private ledger: LedgerHWService
        ])
    ], NetworkService);
    return NetworkService;
}());
exports.NetworkService = NetworkService;
//# sourceMappingURL=network.service.js.map