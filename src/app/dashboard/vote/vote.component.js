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
var voting_service_1 = require("../../services/voting.service");
var accounts_service_1 = require("../../services/accounts.service");
var eosjs_service_1 = require("../../services/eosjs.service");
var forms_1 = require("@angular/forms");
var angular2_toaster_1 = require("angular2-toaster");
var textMaskAddons_1 = require("text-mask-addons/dist/textMaskAddons");
var crypto_service_1 = require("../../services/crypto.service");
var http_1 = require("@angular/common/http");
var moment = require("moment");
var VoteComponent = /** @class */ (function () {
    function VoteComponent(voteService, http, aService, eos, crypto, fb, toaster, cdr) {
        this.voteService = voteService;
        this.http = http;
        this.aService = aService;
        this.eos = eos;
        this.crypto = crypto;
        this.fb = fb;
        this.toaster = toaster;
        this.cdr = cdr;
        this.minToStake = 0.01;
        this.numberMask = textMaskAddons_1.createNumberMask({
            prefix: '',
            allowDecimal: true,
            includeThousandsSeparator: false,
            decimalLimit: 4,
        });
        this.percentMask = textMaskAddons_1.createNumberMask({
            prefix: '',
            allowDecimal: true,
            includeThousandsSeparator: false,
            decimalLimit: 1,
            integerLimit: 3,
        });
        this.showAdvancedRatio = false;
        this.initOptions = {
            renderer: 'z',
            width: 1000,
            height: 400
        };
        this.net_weight = '';
        this.cpu_weight = '';
        this.stakingRatio = 75;
        this.voteService.bpsByChain(this.aService.activeChain.id);
        if (this.voteService.bps) {
            this.nbps = this.voteService.bps.length;
        }
        else {
            this.nbps = 100;
        }
        this.max = 100;
        this.min = 0;
        this.minstake = false;
        this.valuetoStake = '';
        this.percenttoStake = '';
        this.unstaking = 0;
        this.unstakeTime = '';
        this.stakeModal = false;
        this.voteModal = false;
        this.busy = false;
        this.totalBalance = 0;
        this.stakedBalance = 0;
        this.wrongpass = '';
        this.stakerr = '';
        this.fromAccount = '';
        this.stakedisabled = true;
        this.singleSelectionBP = {
            name: ''
        };
        this.selectedBPs = [];
        this.passForm = this.fb.group({
            pass: ['', [forms_1.Validators.required, forms_1.Validators.minLength(10)]]
        });
        this.passFormStake = this.fb.group({
            pass: ['', [forms_1.Validators.required, forms_1.Validators.minLength(10)]]
        });
        this.options = {
            geo: {
                map: 'world',
                roam: false,
                left: 0,
                right: 0,
                silent: true,
                aspectScale: 1,
                itemStyle: {
                    normal: {
                        borderColor: '#1076a1',
                        color: '#17181c'
                    }
                }
            },
            tooltip: {
                formatter: function (params) { return '<strong>' + params['data']['location'] + '</strong><br> Rank: ' + params['data']['position'] + '<br> Status:  ' + params['data']['status']; }
            },
            animationDuration: 1500,
            animationEasingUpdate: 'quinticInOut',
            series: [
                {
                    type: 'graph',
                    coordinateSystem: 'geo',
                    symbol: 'pin',
                    symbolSize: 15,
                    data: this.voteService.data,
                    animation: true,
                    animationDuration: 2000,
                    focusNodeAdjacency: true,
                    itemStyle: {
                        normal: {
                            borderColor: '#fff',
                            borderWidth: 1,
                            shadowBlur: 10,
                            color: '#fff',
                            shadowColor: 'rgba(0, 0, 0, 0.3)'
                        }
                    },
                    label: {
                        position: 'top',
                        formatter: '{b}',
                        show: false,
                        distance: 6,
                        fontSize: 16
                    },
                    lineStyle: {
                        color: 'source',
                        curveness: 0.01,
                        width: 2
                    },
                    force: {
                        repulsion: 600,
                        edgeLength: 150,
                    },
                    emphasis: {
                        lineStyle: {
                            width: 10
                        }
                    }
                }
            ]
        };
    }
    VoteComponent.prototype.extOpen = function (value) {
        window['shell'].openExternal(value);
    };
    VoteComponent.prototype.sliderLabel = function (value) {
        var val = parseInt(value.toString(), 10);
        return val.toString();
    };
    VoteComponent.prototype.updateRatio = function () {
        console.log(this.stakingRatio);
    };
    Object.defineProperty(VoteComponent.prototype, "getValuetoStake", {
        get: function () {
            return parseFloat(this.valuetoStake);
        },
        enumerable: true,
        configurable: true
    });
    VoteComponent.prototype.setStake = function () {
        var prevStake = Math.round(this.aService.selected.getValue().staked * 10000);
        var nextStakeFloat = parseFloat(this.valuetoStake);
        var nextStakeInt = Math.round(nextStakeFloat * 10000);
        var diff = nextStakeInt - prevStake;
        this.stakingDiff = diff;
        this.stakingHRV = (Math.abs(this.stakingDiff) / 10000) + ' ' + this.aService.activeChain['symbol'];
        if (diff === 0) {
            this.stakerr = 'Value has not changed';
        }
        else {
            this.stakeModal = true;
        }
    };
    VoteComponent.prototype.callSetStake = function (password) {
        var _this = this;
        this.busy = true;
        var account = this.aService.selected.getValue();
        var pubkey = account.details['permissions'][0]['required_auth'].keys[0].key;
        this.crypto.authenticate(password, pubkey).then(function (data) {
            if (data === true) {
                _this.eos.changebw(account.name, _this.stakingDiff, _this.aService.activeChain['symbol'], _this.stakingRatio / 100)
                    .then(function (trx) {
                    console.log(trx);
                    _this.busy = false;
                    _this.wrongpass = '';
                    _this.stakeModal = false;
                    _this.cdr.detectChanges();
                    _this.showToast('success', 'Tramsaction broadcasted', 'Check your history for confirmation.');
                    setTimeout(function () {
                        _this.aService.refreshFromChain().then(function () {
                            _this.cpu_weight = _this.aService.selected.getValue().details.total_resources.cpu_weight;
                            _this.net_weight = _this.aService.selected.getValue().details.total_resources.net_weight;
                        });
                    }, 1500);
                })
                    .catch(function (error) {
                    console.log(error);
                    if (typeof error === 'object') {
                        _this.wrongpass = 'Operation timeout, please try again or select another endpoint.';
                    }
                    else {
                        if (JSON.parse(error).error.name === 'leeway_deadline_exception') {
                            _this.wrongpass = 'Not enough CPU bandwidth to perform transaction. Try again later.';
                        }
                        else {
                            _this.wrongpass = JSON.stringify(JSON.parse(error).error.details[0].message);
                        }
                    }
                    _this.busy = false;
                });
            }
            else {
                console.dir(data);
                _this.wrongpass = 'Wrong password!';
                _this.busy = false;
            }
        }).catch(function () {
            _this.busy = false;
            _this.wrongpass = 'Wrong password!';
        });
    };
    VoteComponent.prototype.updateBalances = function () {
        var selectedAcc = this.aService.selected.getValue();
        this.totalBalance = selectedAcc.full_balance;
        this.stakedBalance = selectedAcc.staked;
    };
    VoteComponent.prototype.ngOnInit = function () {
        var _this = this;
        setTimeout(function () {
            _this.voteService.callLoader();
        }, 1000);
        var selectedAcc = this.aService.selected.getValue();
        this.aService.lastUpdate.asObservable().subscribe(function (value) {
            if (value.account === _this.aService.selected.getValue().name) {
                _this.updateBalances();
                _this.stakingRatio = 75;
            }
        });
        this.aService.selected.asObservable().subscribe(function (selected) {
            if (selected && selected['name']) {
                _this.fromAccount = selected.name;
                _this.totalBalance = selected.full_balance;
                _this.stakedBalance = selected.staked;
                _this.unstaking = selected.unstaking;
                _this.unstakeTime = moment.utc(selected.unstakeTime).add(72, 'hours').fromNow();
                if (_this.totalBalance > 0) {
                    _this.minToStake = 100 / _this.totalBalance;
                    _this.valuetoStake = _this.stakedBalance.toString();
                }
                else {
                    _this.minToStake = 0;
                    _this.valuetoStake = '0';
                    _this.percenttoStake = '0';
                }
                _this.updateStakePercent();
                _this.loadPlacedVotes(selected);
                _this.cpu_weight = selected.details.total_resources.cpu_weight;
                _this.net_weight = selected.details.total_resources.net_weight;
            }
        });
        if (this.aService.activeChain.features['vote']) {
            this.voteService.listReady.asObservable().subscribe(function (state) {
                if (state) {
                    _this.updateCounter();
                    _this.nbps = _this.voteService.bps.length;
                }
            });
            this.aService.accounts.forEach(function (a) {
                if (a) {
                    if (a.name === selectedAcc.name) {
                        if (a.details['voter_info']) {
                            var currentVotes_1 = a.details['voter_info']['producers'];
                            _this.voteService.bps.forEach(function (elem) {
                                elem.checked = currentVotes_1.indexOf(elem.account) !== -1;
                            });
                        }
                        else {
                            _this.voteService.bps.forEach(function (elem) {
                                elem.checked = false;
                            });
                        }
                    }
                }
            });
        }
        this.getCurrentStake();
    };
    VoteComponent.prototype.ngAfterViewInit = function () {
        this.voteService.listProducers().catch(function (err) {
            console.log(err);
        });
    };
    VoteComponent.prototype.getCurrentStake = function () {
        if (this.totalBalance > 0) {
            this.percenttoStake = ((this.stakedBalance / this.totalBalance) * 100).toString();
        }
        this.valuetoStake = this.stakedBalance.toString();
    };
    VoteComponent.prototype.updateStakeValue = function () {
        this.stakedisabled = false;
        this.minstake = false;
        this.valuetoStake = (this.totalBalance * (parseFloat(this.percenttoStake) / 100)).toString();
        if (this.valuetoStake === '1') {
            this.minstake = true;
        }
    };
    VoteComponent.prototype.updateStakePercent = function () {
        this.stakedisabled = false;
        if (this.totalBalance > 0) {
            this.percenttoStake = ((parseFloat(this.valuetoStake) * 100) / this.totalBalance).toString();
        }
    };
    VoteComponent.prototype.checkPercent = function () {
        this.minstake = false;
        var min;
        if (this.totalBalance > 0) {
            min = 100 / this.totalBalance;
        }
        else {
            min = 0;
        }
        if (parseFloat(this.percenttoStake) <= min) {
            this.percenttoStake = min.toString();
            this.updateStakeValue();
            this.minstake = true;
        }
        if (parseFloat(this.percenttoStake) > 100) {
            this.percenttoStake = '100';
            this.updateStakeValue();
        }
    };
    VoteComponent.prototype.checkValue = function () {
        this.minstake = false;
        if (parseFloat(this.valuetoStake) <= 1) {
            this.valuetoStake = '1';
            this.updateStakePercent();
            this.minstake = true;
        }
        if (parseFloat(this.valuetoStake) > this.totalBalance) {
            this.valuetoStake = this.totalBalance.toString();
            this.updateStakePercent();
        }
    };
    VoteComponent.prototype.processVotes = function () {
        var _this = this;
        this.selectedBPs = [];
        this.voteService.bps.forEach(function (bp) {
            if (bp.checked) {
                _this.selectedBPs.push(bp.account);
            }
        });
        this.passForm.reset();
        this.voteModal = true;
    };
    VoteComponent.prototype.updateCounter = function () {
        var val = 0;
        this.voteService.bps.forEach(function (bp) {
            if (bp.checked) {
                val++;
            }
        });
        this.nVotes = val;
    };
    VoteComponent.prototype.modalVote = function (pass) {
        var _this = this;
        this.busy = true;
        var voter = this.aService.selected.getValue();
        var publicKey = voter.details['permissions'][0]['required_auth'].keys[0].key;
        this.crypto.authenticate(pass, publicKey).then(function (data) {
            // console.log('Auth output:', data);
            if (data === true) {
                _this.aService.injectLedgerSigner();
                _this.eos.voteProducer(voter.name, _this.selectedBPs).then(function (result) {
                    // console.log(result);
                    if (JSON.parse(result).code) {
                        // if (err2.error.code === 3081001) {
                        _this.wrongpass = JSON.parse(result).error.details[0].message;
                        // } else {
                        //   this.wrongpass = err2.error['what'];
                        // }
                        _this.busy = false;
                    }
                    else {
                        _this.wrongpass = '';
                        _this.voteModal = false;
                        _this.busy = false;
                        _this.showToast('success', 'Vote broadcasted', 'Check your history for confirmation.');
                        _this.passForm.reset();
                        _this.aService.refreshFromChain();
                        setTimeout(function () {
                            _this.loadPlacedVotes(_this.aService.selected.getValue());
                        }, 1500);
                    }
                }).catch(function (err2) {
                    console.log(err2);
                    // if (err2.error.code === 3081001) {
                    //   this.wrongpass = 'Not enough stake to perform this action.';
                    // } else {
                    //   this.wrongpass = err2.error['what'];
                    // }
                    _this.busy = false;
                });
            }
            else {
                _this.wrongpass = 'Something went wrong!';
                _this.busy = false;
            }
        }).catch(function () {
            _this.busy = false;
            _this.wrongpass = 'Wrong password!';
        });
    };
    VoteComponent.prototype.loadPlacedVotes = function (selectedAccount) {
        if (selectedAccount.details['voter_info']) {
            var currentVotes_2 = selectedAccount.details['voter_info']['producers'];
            this.nVotes = currentVotes_2.length;
            this.voteService.bps.forEach(function (elem) {
                elem.checked = currentVotes_2.indexOf(elem.account) !== -1;
            });
            this.updateCounter();
        }
        else {
            this.voteService.bps.forEach(function (elem) {
                elem.checked = false;
            });
        }
    };
    VoteComponent.prototype.showToast = function (type, title, body) {
        this.config = new angular2_toaster_1.ToasterConfig({
            positionClass: 'toast-top-right',
            timeout: 5000,
            newestOnTop: true,
            tapToDismiss: true,
            preventDuplicates: false,
            animation: 'slideDown',
            limit: 1,
        });
        var toast = {
            type: type,
            title: title,
            body: body,
            timeout: 5000,
            showCloseButton: true,
            bodyOutputType: angular2_toaster_1.BodyOutputType.TrustedHtml,
        };
        this.toaster.popAsync(toast);
    };
    VoteComponent.prototype.onChartInit = function (e) {
        this.echartsInstance = e;
    };
    VoteComponent = __decorate([
        core_1.Component({
            selector: 'app-vote',
            templateUrl: './vote.component.html',
            styleUrls: ['./vote.component.css']
        }),
        __metadata("design:paramtypes", [voting_service_1.VotingService,
            http_1.HttpClient,
            accounts_service_1.AccountsService,
            eosjs_service_1.EOSJSService,
            crypto_service_1.CryptoService,
            forms_1.FormBuilder,
            angular2_toaster_1.ToasterService,
            core_1.ChangeDetectorRef])
    ], VoteComponent);
    return VoteComponent;
}());
exports.VoteComponent = VoteComponent;
//# sourceMappingURL=vote.component.js.map