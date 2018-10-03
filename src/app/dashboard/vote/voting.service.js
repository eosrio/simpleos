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
var http_1 = require("@angular/common/http");
var eosjs_service_1 = require("../../eosjs.service");
var rxjs_1 = require("rxjs");
var accounts_service_1 = require("../../accounts.service");
var VotingService = /** @class */ (function () {
    function VotingService(eos, http, aService) {
        var _this = this;
        this.eos = eos;
        this.http = http;
        this.aService = aService;
        this.listReady = new rxjs_1.Subject();
        this.counter = new rxjs_1.Subject();
        this.activeCounter = 50;
        this.bps = [];
        this.data = [];
        this.initList = false;
        this.chainActive = false;
        this.totalActivatedStake = 0;
        this.totalProducerVoteWeight = 0;
        this.stakePercent = 0;
        this.startUpdateGlobalStake();
        this.aService.selected.asObservable().subscribe(function (sA) {
            _this.selectedAccount = sA;
            if (_this.bps.length === 0 && !_this.initList) {
                _this.listProducers();
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
    VotingService.prototype.randomizeList = function () {
        this.bps = VotingService_1.shuffle(this.bps);
    };
    VotingService.prototype.updateGlobalStake = function () {
        var _this = this;
        this.eos.getChainInfo().then(function (global) {
            _this.totalActivatedStake = parseInt(global.rows[0]['total_activated_stake'], 10) / 10000;
            _this.stakePercent = (Math.round((100 * _this.totalActivatedStake / 150000000.0) * 1000) / 1000);
        });
    };
    VotingService.prototype.startUpdateGlobalStake = function () {
        var _this = this;
        this.updateGlobalStake();
        setInterval(function () {
            _this.updateGlobalStake();
        }, 10000);
    };
    VotingService.prototype.listProducers = function () {
        var _this = this;
        if (this.initList === false) {
            this.initList = true;
            this.aService.initFirst();
            this.eos.listProducers().then(function (producers) {
                _this.eos.getChainInfo().then(function (global) {
                    _this.totalActivatedStake = parseInt(global.rows[0]['total_activated_stake'], 10) / 10000;
                    _this.totalProducerVoteWeight = parseFloat(global.rows[0]['total_producer_vote_weight']);
                    _this.chainActive = _this.totalActivatedStake > 150000000.0;
                    var total_votes = _this.totalProducerVoteWeight;
                    // Pass 1 - Add accounts
                    var myAccount = _this.aService.selected.getValue();
                    producers.rows.forEach(function (prod, idx) {
                        var vote_pct = Math.round((100 * prod['total_votes'] / total_votes) * 1000) / 1000;
                        var voted;
                        if (myAccount.details['voter_info']) {
                            voted = myAccount.details['voter_info']['producers'].indexOf(prod['owner']) !== -1;
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
                            status: (idx < 21 && _this.chainActive) ? 'producing' : 'standby',
                            total_votes: vote_pct + '%',
                            social: '',
                            email: '',
                            website: prod.url,
                            logo_256: '',
                            code: '',
                            checked: voted
                        };
                        _this.bps.push(producerMetadata);
                    });
                    _this.listReady.next(true);
                    // Pass 2 - Enhance metadata
                    _this.activeCounter = 50;
                    var expiration = (1000 * 60 * 60 * 6);
                    // const expiration = 1000;
                    var requestQueue = [];
                    producers.rows.forEach(function (prod, idx) {
                        var cachedPayload = JSON.parse(localStorage.getItem(prod['owner']));
                        if (cachedPayload) {
                            if (new Date().getTime() - new Date(cachedPayload.lastUpdate).getTime() > expiration) {
                                // setTimeout(() => {
                                //   this.improveMeta(prod, idx);
                                // }, 100 + idx * 10);
                                requestQueue.push({ producer: prod, index: idx });
                            }
                            else {
                                _this.bps[idx] = cachedPayload['meta'];
                                if (idx < 50) {
                                    _this.addPin(_this.bps[idx]);
                                }
                            }
                        }
                        else {
                            // setTimeout(() => {
                            //   this.improveMeta(prod, idx);
                            // }, 100 + idx * 10);
                            requestQueue.push({ producer: prod, index: idx });
                        }
                    });
                    _this.processReqQueue(requestQueue);
                });
            });
        }
    };
    VotingService.prototype.processReqQueue = function (queue) {
        var _this = this;
        var filteredBatch = [];
        console.log('Processing ' + queue.length + ' bp.json requests');
        queue.forEach(function (item) {
            if (item.producer.url !== '') {
                var url = item.producer.url.endsWith('.json') ? item.producer.url : item.producer.url + '/bp.json';
                if (url !== '') {
                    filteredBatch.push(item);
                }
            }
        });
        this.http.post('http://proxy.eosrio.io:4200/batchRequest', filteredBatch).subscribe(function (data) {
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
                            _this.bps[idx].name = org['candidate_name'];
                            _this.bps[idx].account = item['producer_account_name'];
                            _this.bps[idx].location = loc;
                            _this.bps[idx].geo = geo;
                            _this.bps[idx].social = org['social'] || {};
                            _this.bps[idx].email = org['email'];
                            _this.bps[idx].website = org['website'];
                            _this.bps[idx].logo_256 = logo_256;
                            _this.bps[idx].code = org['code_of_conduct'];
                            if (idx < 50) {
                                _this.addPin(_this.bps[idx]);
                            }
                            // Add to cache
                            var payload = {
                                lastUpdate: new Date(),
                                meta: _this.bps[idx],
                                source: item.url
                            };
                            localStorage.setItem(item['producer_account_name'], JSON.stringify(payload));
                        }
                    }
                }
            });
        });
    };
    VotingService.prototype.improveMeta = function (prod, idx) {
        var _this = this;
        if (prod.url !== '') {
            var url_1 = prod.url.endsWith('.json') ? prod.url : prod.url + '/bp.json';
            if (url_1 !== '') {
                this.http.post('http://proxy.eosrio.io:4200', {
                    url: url_1
                }).subscribe(function (data) {
                    if (data) {
                        if (data['org']) {
                            var org = data['org'];
                            var loc = ' - ';
                            var geo = [];
                            if (org['location']) {
                                loc = (org.location.name) ? (org.location.name + ', ' + org.location.country) : (org.location.country);
                                geo = [org.location.latitude, org.location.longitude];
                            }
                            var logo_256 = (org['branding']) ? org['branding']['logo_256'] : '';
                            if (data['producer_account_name'] === prod['owner']) {
                                _this.bps[idx].name = org['candidate_name'];
                                _this.bps[idx].account = data['producer_account_name'];
                                _this.bps[idx].location = loc;
                                _this.bps[idx].geo = geo;
                                _this.bps[idx].social = org['social'] || {};
                                _this.bps[idx].email = org['email'];
                                _this.bps[idx].website = org['website'];
                                _this.bps[idx].logo_256 = logo_256;
                                _this.bps[idx].code = org['code_of_conduct'];
                                if (idx < 50) {
                                    _this.addPin(_this.bps[idx]);
                                }
                                // Add to cache
                                var payload = {
                                    lastUpdate: new Date(),
                                    meta: _this.bps[idx],
                                    source: url_1
                                };
                                localStorage.setItem(prod['owner'], JSON.stringify(payload));
                            }
                        }
                    }
                }, function () {
                    // console.log(url, err);
                });
            }
        }
        else {
            // console.log(prod['owner'] + ' provided no bp.json');
        }
    };
    VotingService.prototype.addPin = function (bp) {
        if (bp.geo.length === 2) {
            var name_1 = bp['name'];
            var lat = bp['geo'][0];
            var lon = bp['geo'][1];
            if ((lon < 180 && lon > -180) && (lat < 90 && lat > -90)) {
                if (this.data.length < 50) {
                    if (bp['status'] === 'standby') {
                        this.data.push({
                            name: name_1,
                            symbol: 'circle',
                            symbolSize: 8,
                            itemStyle: {
                                color: '#feff4b',
                                borderWidth: 0
                            },
                            value: [lon, lat],
                            location: bp['location']
                        });
                    }
                    else {
                        this.data.push({
                            name: name_1,
                            symbol: 'diamond',
                            symbolSize: 10,
                            itemStyle: {
                                color: '#6cff46',
                                borderWidth: 0
                            },
                            value: [lon, lat],
                            location: bp['location']
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