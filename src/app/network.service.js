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
var accounts_service_1 = require("./accounts.service");
var eosjs_service_1 = require("./eosjs.service");
var router_1 = require("@angular/router");
var Eos = require("../assets/eos.js");
var rxjs_1 = require("rxjs");
var ledger_service_1 = require("./services/ledger.service");
var NetworkService = /** @class */ (function () {
    function NetworkService(eosjs, router, aService, ledger) {
        this.eosjs = eosjs;
        this.router = router;
        this.aService = aService;
        this.ledger = ledger;
        this.mainnetId = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';
        this.genesistx = 'ad77575a8b4f52e477682e712b1cbd884299468db6a94d909f90c6961cea9b02';
        this.voteref = 'b23f537e8ab29fbcec8b533081ef7e12b146899ca42a3fc9eb608258df9983d9';
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
        this.publicEndpoints = [
            { url: 'https://api.eosrio.io', owner: 'EOS Rio', latency: 0, filters: [] },
        ];
        this.validEndpoints = [];
        this.status = '';
        this.connectionTimeout = null;
    }
    NetworkService.prototype.connect = function () {
        var _this = this;
        this.status = '';
        this.networkingReady.next(false);
        this.scanNodes().then(function () {
            _this.verifyFilters().then(function () {
                _this.extractValidNode();
            });
        });
        console.log('Starting timer...');
        this.startTimeout();
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
        for (var _i = 0, _a = this.publicEndpoints; _i < _a.length; _i++) {
            var node = _a[_i];
            if (node.filters.length === 2) {
                this.validEndpoints.push(node);
            }
        }
        this.selectEndpoint();
    };
    NetworkService.prototype.selectEndpoint = function () {
        var _this = this;
        var latency = 2000;
        this.validEndpoints.forEach(function (node) {
            if (node.latency < latency) {
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
    };
    NetworkService.prototype.verifyFilters = function () {
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
                        if (!(apiNode.latency > 0 && apiNode.latency < 1000)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.filterCheck(apiNode)];
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
    NetworkService.prototype.filterCheck = function (server) {
        var _this = this;
        console.log('Starting filter check for ' + server.url);
        var config = this.baseConfig;
        config.httpEndpoint = server.url;
        config.chainId = this.mainnetId;
        var eos = Eos(config);
        var pq = [];
        pq.push(new Promise(function (resolve1) {
            eos['getTransaction'](_this.genesistx, function (err, txInfo) {
                if (err) {
                    console.log(err);
                    resolve1();
                }
                else {
                    if (txInfo['block_num'] === _this.txrefBlock) {
                        server.filters.push('eosio.token:transfer');
                    }
                    else {
                        console.log('eosio.token:transfer filter is disabled on ' + server.url);
                    }
                    resolve1();
                }
            });
        }));
        pq.push(new Promise(function (resolve1) {
            eos['getTransaction'](_this.voteref, function (err, txInfo) {
                if (err) {
                    console.log(err);
                    resolve1();
                }
                else {
                    if (txInfo['block_num'] === _this.voterefBlock) {
                        server.filters.push('eosio:voteproducer');
                    }
                    else {
                        console.log('eosio:voteproducer filter is disabled on ' + server.url);
                    }
                    resolve1();
                }
            });
        }));
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
        console.log('EP-------->' + endpoint);
        this.eosjs.init(endpoint, this.mainnetId).then(function (savedAccounts) {
            _this.ledger.initListener();
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
                    _this.router['navigate'](['dashboard', 'ram']);
                }
                else {
                    console.log('No saved accounts!');
                }
            }
        }).catch(function () {
            _this.networkingReady.next(false);
        });
    };
    NetworkService = __decorate([
        core_1.Injectable({
            providedIn: 'root'
        }),
        __metadata("design:paramtypes", [eosjs_service_1.EOSJSService, router_1.Router, accounts_service_1.AccountsService, ledger_service_1.LedgerService])
    ], NetworkService);
    return NetworkService;
}());
exports.NetworkService = NetworkService;
//# sourceMappingURL=network.service.js.map