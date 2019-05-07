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
var http_1 = require("@angular/common/http");
var eosjs_service_1 = require("./eosjs.service");
var rxjs_1 = require("rxjs");
var accounts_service_1 = require("./accounts.service");
var VotingService = /** @class */ (function () {
    function VotingService(eos, http, aService) {
        var _this = this;
        this.eos = eos;
        this.http = http;
        this.aService = aService;
        this.listReady = new rxjs_1.Subject();
        this.counter = new rxjs_1.Subject();
        this.activeCounter = 50;
        this.loadingProds = false;
        this.bps = [];
        this.data = [];
        this.initList = false;
        this.chainActive = false;
        this.totalActivatedStake = 0;
        this.totalProducerVoteWeight = 0;
        this.stakePercent = 0;
        this.isOnline = false;
        this.lastState = false;
        this.lastChain = '';
        this.lastAcc = '';
        // EOSJS Status watcher
        this.eos.online.asObservable().subscribe(function (value) {
            _this.isOnline = value;
            if (value !== _this.lastState) {
                _this.lastState = value;
                console.log('ONLINE VALUE:', value);
                if (value) {
                    _this.callLoader();
                }
            }
        });
        // Account status watcher
        this.aService.selected.asObservable().subscribe(function (sA) {
            if (sA['name']) {
                _this.selectedAccount = sA;
                if (_this.bps.length === 0 && !_this.initList) {
                    if (_this.lastAcc !== sA['name'] || _this.lastChain !== _this.aService.activeChain.name) {
                        _this.lastAcc = sA['name'];
                        _this.lastChain = _this.aService.activeChain.name;
                        _this.callLoader();
                    }
                }
            }
        });
    }
    VotingService_1 = VotingService;
    VotingService.shuffle = function (array) {
        var currentIndex = array.length, temporaryValue, randomIndex;
        while (0 !== currentIndex) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex -= 1;
            temporaryValue = array[currentIndex];
            array[currentIndex] = array[randomIndex];
            array[randomIndex] = temporaryValue;
        }
        return array;
    };
    VotingService.prototype.callLoader = function () {
        console.log('attempt to load BPs', this.aService.selected.getValue().name, this.isOnline);
        if (this.aService.selected.getValue().name && this.isOnline) {
            this.listProducers();
        }
    };
    VotingService.prototype.forceReload = function () {
        console.log('Voting Service: Force reload!');
        this.bps = [];
        this.initList = false;
        // this.listProducers();
    };
    VotingService.prototype.clearMap = function () {
        this.data = [];
        this.updateOptions = {
            series: [{
                    data: this.data
                }]
        };
    };
    VotingService.prototype.randomizeList = function () {
        this.bps = VotingService_1.shuffle(this.bps);
    };
    VotingService.prototype.bpsByChain = function (id) {
        this.bps = this.bps.filter(function (bp) { return bp.chainId === id; });
    };
    VotingService.prototype.listProducers = function () {
        return __awaiter(this, void 0, void 0, function () {
            var producers, global_data, total_votes_1, myAccount_1, expiration_1, requestQueue_1, fullCache_1, path, stored_data_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log(this.aService.selected.getValue().name, this.initList, this.loadingProds);
                        if (!(!this.initList && !this.loadingProds && this.aService.selected.getValue().name)) return [3 /*break*/, 3];
                        this.loadingProds = true;
                        return [4 /*yield*/, this.eos.listProducers()];
                    case 1:
                        producers = _a.sent();
                        console.log('ListProducers returned ' + producers.rows.length + ' producers');
                        return [4 /*yield*/, this.eos.getChainInfo()];
                    case 2:
                        global_data = _a.sent();
                        this.totalProducerVoteWeight = parseFloat(global_data.rows[0]['total_producer_vote_weight']);
                        total_votes_1 = this.totalProducerVoteWeight;
                        myAccount_1 = this.aService.selected.getValue();
                        this.bps = [];
                        producers.rows.forEach(function (prod, idx) {
                            var vote_pct = Math.round((100 * prod['total_votes'] / total_votes_1) * 1000) / 1000;
                            var voted;
                            if (myAccount_1.details['voter_info']) {
                                voted = myAccount_1.details['voter_info']['producers'].indexOf(prod['owner']) !== -1;
                            }
                            else {
                                voted = false;
                            }
                            var producerMetadata = {
                                name: prod['owner'],
                                account: prod['owner'],
                                key: prod['producer_key'],
                                location: '',
                                geo: [],
                                position: idx + 1,
                                status: '',
                                total_votes: vote_pct + '%',
                                social: '',
                                email: '',
                                website: prod.url,
                                logo_256: '',
                                code: '',
                                checked: voted,
                                chainId: _this.aService.activeChain.id
                            };
                            _this.bps.push(producerMetadata);
                        });
                        this.initList = true;
                        this.listReady.next(true);
                        this.loadingProds = false;
                        // Pass 2 - Enhance metadata
                        this.activeCounter = 50;
                        expiration_1 = (1000 * 60 * 60 * 6);
                        requestQueue_1 = [];
                        fullCache_1 = {};
                        path = 'simplEOS.producers.' + this.aService.activeChain.id;
                        stored_data_1 = localStorage.getItem(path);
                        if (stored_data_1) {
                            fullCache_1 = JSON.parse(stored_data_1);
                        }
                        producers.rows.forEach(function (prod, idx) {
                            var cachedPayload = null;
                            if (stored_data_1) {
                                cachedPayload = fullCache_1[prod['owner']];
                                if (cachedPayload) {
                                    if (new Date().getTime() - new Date(cachedPayload.lastUpdate).getTime() > expiration_1) {
                                        // Expired
                                        requestQueue_1.push({ producer: prod, index: idx });
                                    }
                                    else {
                                        // Load from cache
                                        _this.bps[idx] = cachedPayload['meta'];
                                        if (idx < 21) {
                                            _this.bps[idx]['status'] = 'producing';
                                        }
                                        else {
                                            _this.bps[idx]['status'] = 'standby';
                                        }
                                        if (idx < 50) {
                                            _this.addPin(_this.bps[idx]);
                                        }
                                    }
                                }
                                else {
                                    // New entry
                                    requestQueue_1.push({ producer: prod, index: idx });
                                }
                            }
                            else {
                                // New entry
                                requestQueue_1.push({ producer: prod, index: idx });
                            }
                        });
                        this.processReqQueue(requestQueue_1);
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    VotingService.prototype.processReqQueue = function (queue) {
        var _this = this;
        var filteredBatch = [];
        console.log('Processing ' + queue.length + ' bp.json requests');
        var filename = '/bp.json';
        queue.forEach(function (item) {
            if (item.producer.url !== '') {
                var url = item.producer.url.endsWith('.json') ? item.producer.url : item.producer.url + filename;
                if (url !== '') {
                    filteredBatch.push(item);
                }
            }
        });
        console.log('Fecthing BP.JSON data...');
        this.http.post('http://proxy.eosrio.io:4200/batchRequest', filteredBatch).subscribe(function (data) {
            // Load cache
            var fullCache = JSON.parse(localStorage.getItem('simplEOS.producers.' + _this.aService.activeChain.id));
            if (!fullCache) {
                fullCache = {};
            }
            console.log(data.length);
            data.forEach(function (item) {
                if (item && JSON.stringify(item) !== null) {
                    if (item['org']) {
                        var org = item['org'];
                        var loc = ' - ';
                        var geo = [];
                        if (org['location']) {
                            loc = (org.location.name) ? (org.location.name + ', ' + org.location.country) : (org.location.country);
                            geo = [org.location.latitude, org.location.longitude];
                        }
                        var logo_256 = (org['branding']) ? org['branding']['logo_256'] : '';
                        var idx = _this.bps.findIndex(function (el) {
                            return el.account === item['producer_account_name'];
                        });
                        if (idx !== -1) {
                            if (idx < 21) {
                                _this.bps[idx]['status'] = 'producing';
                            }
                            else {
                                _this.bps[idx]['status'] = 'standby';
                            }
                            // console.log('POS: ' + this.bps[idx].position + ' | ' + this.bps[idx].name);
                            _this.bps[idx].name = org['candidate_name'];
                            _this.bps[idx].account = item['producer_account_name'];
                            _this.bps[idx].location = loc;
                            _this.bps[idx].geo = geo;
                            _this.bps[idx].social = org['social'] || {};
                            _this.bps[idx].email = org['email'];
                            _this.bps[idx].website = org['website'];
                            _this.bps[idx].logo_256 = logo_256;
                            _this.bps[idx].code = org['code_of_conduct'];
                            _this.bps[idx].chainId = _this.aService.activeChain.id;
                            if (idx < 50) {
                                _this.addPin(_this.bps[idx]);
                            }
                            // Add to cache
                            var payload = {
                                lastUpdate: new Date(),
                                meta: _this.bps[idx],
                                source: item.url
                            };
                            fullCache[item['producer_account_name']] = payload;
                        }
                    }
                }
            });
            // Save cache
            localStorage.setItem('simplEOS.producers.' + _this.aService.activeChain.id, JSON.stringify(fullCache));
        });
    };
    VotingService.prototype.addPin = function (bp) {
        if (bp.geo.length === 2) {
            var name_1 = bp['name'];
            var account_1 = bp['account'];
            var lat = bp['geo'][0];
            var lon = bp['geo'][1];
            if ((lon < 180 && lon > -180) && (lat < 90 && lat > -90)) {
                if (this.data.length < 50) {
                    if (this.data.findIndex(function (o) { return o.owner === account_1; }) === -1) {
                        this.data.push({
                            name: name_1,
                            owner: account_1,
                            symbol: (bp['status'] === 'standby') ? 'circle' : 'diamond',
                            symbolSize: (bp['status'] === 'standby') ? 8 : 10,
                            itemStyle: {
                                color: (bp['status'] === 'standby') ? '#feff4b' : '#6cff46',
                                borderWidth: 0
                            },
                            value: [lon, lat],
                            location: bp['location'],
                            position: bp['position'],
                            status: bp['status']
                        });
                    }
                    this.updateOptions = {
                        series: [{
                                data: this.data
                            }]
                    };
                }
            }
        }
    };
    var VotingService_1;
    VotingService = VotingService_1 = __decorate([
        core_1.Injectable({
            providedIn: 'root'
        }),
        __metadata("design:paramtypes", [eosjs_service_1.EOSJSService, http_1.HttpClient, accounts_service_1.AccountsService])
    ], VotingService);
    return VotingService;
}());
exports.VotingService = VotingService;
//# sourceMappingURL=voting.service.js.map