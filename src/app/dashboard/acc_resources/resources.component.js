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
var eosjs_service_1 = require("../../eosjs.service");
var accounts_service_1 = require("../../accounts.service");
var crypto_service_1 = require("../../services/crypto.service");
var angular2_toaster_1 = require("angular2-toaster");
var forms_1 = require("@angular/forms");
var ram_service_1 = require("../../services/ram.service");
var ResourcesComponent = /** @class */ (function () {
    function ResourcesComponent(eos, aService, crypto, toaster, fb, ramService) {
        this.eos = eos;
        this.aService = aService;
        this.crypto = crypto;
        this.toaster = toaster;
        this.fb = fb;
        this.ramService = ramService;
        this.myRamAlloc = 0;
        this.totalRamAlloc = 0;
        this.ramPriceEOS = 0;
        this.amountbytes = 1024;
        this.total_ram_bytes_reserved = 0;
        this.total_ram_stake = 0;
        this.max_ram_size = 0;
        this.rm_base = 0;
        this.rm_quote = 0;
        this.rm_supply = 0;
        this.ram_quota = 0;
        this.ram_usage = 0;
        this.cpu_weight = '';
        this.net_weight = '';
        this.delegations = [];
        this.delegated_net = 0;
        this.delegated_cpu = 0;
        this.busy = false;
        this.ramActionModal = false;
        this.wrongpass = '';
        this.sellValue = 0;
        this.ramMarketForm = this.fb.group({
            buyBytes: [0],
            buyEos: [0],
            sellBytes: [0]
        });
        this.ram_chart = {
            title: {
                left: 'center',
                subtext: 'RAM price chart',
                subtextStyle: {
                    color: '#ffffff',
                    fontWeight: 'bold',
                },
                top: '20'
            },
            tooltip: {
                trigger: 'axis',
                position: function (pt) {
                    return [pt[0], '10%'];
                }
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: [
                    '2017-1',
                    '2017-2',
                    '2017-3',
                    '2017-4',
                    '2017-5',
                    '2017-6',
                    '2017-7',
                    '2017-8',
                    '2017-9',
                    '2017-10',
                    '2017-11',
                    '2017-12',
                ],
                axisLine: {
                    lineStyle: {
                        color: '#B7B7B7',
                    },
                },
                axisLabel: {
                    textStyle: {
                        color: '#B7B7B7',
                    },
                },
            },
            yAxis: {
                type: 'value',
                boundaryGap: [0, '100%'],
                axisLine: {
                    lineStyle: {
                        color: '#B7B7B7',
                    },
                },
                axisLabel: {
                    textStyle: {
                        color: '#B7B7B7',
                    },
                },
                splitLine: {
                    lineStyle: {
                        color: '#3c3a3a',
                    }
                }
            },
            dataZoom: [{
                    type: 'inside',
                }, {
                    start: 0,
                    end: 10,
                    handleIcon: 'M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,' +
                        '8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z',
                    handleSize: '80%',
                    handleStyle: {
                        color: '#fff',
                        shadowBlur: 3,
                        shadowColor: 'rgba(0, 0, 0, 0.6)',
                        shadowOffsetX: 2,
                        shadowOffsetY: 2
                    },
                    dataBackground: {
                        lineStyle: {
                            color: 'rgb(0, 148, 210)',
                        },
                        areaStyle: {
                            color: 'rgb(0, 143, 203)',
                        }
                    },
                    textStyle: {
                        color: '#B7B7B7',
                    }
                }],
            series: [
                {
                    name: 'RAM price',
                    type: 'line',
                    smooth: true,
                    symbol: 'none',
                    sampling: 'average',
                    itemStyle: {
                        normal: {
                            color: 'rgb(0, 148, 210)' // cor da linha
                        }
                    },
                    areaStyle: {
                        color: {
                            type: 'linear',
                            x: 0,
                            y: 0,
                            x2: 0,
                            y2: 1,
                            colorStops: [{
                                    offset: 0, color: 'rgb(149, 223, 255, 0.6)' // cor do gradiente em cima
                                }, {
                                    offset: 1, color: 'rgb(0, 143, 203, 0.6)' // cor do gradiente embaixo
                                }],
                        }
                    },
                    data: [3.9, 5.9, 11.1, 18.7, 48.3, 69.2, 231.6, 245.6, 279.4, 284.4, 290.3, 300.7]
                }
            ]
        };
    }
    ResourcesComponent.prototype.ngOnInit = function () {
        var _this = this;
        this.reload();
        this.ramService.ramTicker.asObservable().subscribe(function (newPrice) {
            _this.ramPriceEOS = newPrice;
        });
        this.aService.selected.asObservable().subscribe(function (selected) {
            if (selected.details) {
                console.log(selected);
                var d = selected.details;
                _this.ram_quota = d.ram_quota;
                _this.ram_usage = d.ram_usage;
                _this.cpu_limit = d.cpu_limit;
                _this.net_limit = d.net_limit;
                _this.cpu_weight = d.total_resources.cpu_weight;
                _this.net_weight = d.total_resources.net_weight;
                _this.listbw(selected.name);
            }
        });
    };
    ResourcesComponent.prototype.reload = function () {
        var _this = this;
        this.eos.getChainInfo().then(function (global) {
            console.log(global);
            if (global) {
                _this.max_ram_size = global.rows[0]['max_ram_size'];
                _this.total_ram_bytes_reserved = global.rows[0]['total_ram_bytes_reserved'];
                _this.total_ram_stake = global.rows[0]['total_ram_stake'];
                _this.eos.getRamMarketInfo().then(function (rammarket) {
                    console.log(rammarket);
                    _this.rm_base = rammarket.rows[0]['base']['balance'].split(' ')[0];
                    _this.rm_quote = rammarket.rows[0]['quote']['balance'].split(' ')[0];
                    _this.rm_supply = rammarket.rows[0]['supply'].split(' ')[0];
                    _this.updatePrice();
                });
            }
        });
    };
    ResourcesComponent.prototype.listbw = function (account_name) {
        var _this = this;
        this.eos.listDelegations(account_name).then(function (results) {
            if (results.rows.length > 0) {
                _this.delegations = [];
                _this.delegated_net = 0;
                _this.delegated_cpu = 0;
                results.rows.forEach(function (entry) {
                    if (entry.from !== entry.to) {
                        entry.net_weight = entry.net_weight.split(' ')[0];
                        entry.cpu_weight = entry.cpu_weight.split(' ')[0];
                        _this.delegated_net += parseFloat(entry.net_weight);
                        _this.delegated_cpu += parseFloat(entry.cpu_weight);
                        _this.delegations.push(entry);
                    }
                });
            }
        });
    };
    ResourcesComponent.prototype.convertToBytes = function () {
        if (this.ramPriceEOS > 0) {
            this.ramMarketForm.patchValue({
                buyBytes: Math.round((this.ramMarketForm.get('buyEos').value / this.ramPriceEOS) * 1024)
            });
        }
    };
    ResourcesComponent.prototype.convertToEos = function () {
        if (this.ramPriceEOS > 0) {
            this.ramMarketForm.patchValue({
                buyEos: (this.ramMarketForm.get('buyBytes').value * this.ramPriceEOS) / 1024
            });
        }
    };
    ResourcesComponent.prototype.convertToEosSELL = function () {
        if (this.ramPriceEOS > 0) {
            this.sellValue = (this.ramMarketForm.get('sellBytes').value * this.ramPriceEOS) / 1024;
        }
    };
    ResourcesComponent.prototype.updatePrice = function () {
        this.ramPriceEOS = ((this.rm_quote) / this.rm_base) * 1024;
    };
    ResourcesComponent.prototype.openRamModal = function () {
        this.ramActionModal = true;
    };
    ResourcesComponent.prototype.sell = function () {
        // this.busy = true;
        // const account = this.aService.selected.getValue();
        // const pubkey = account.details['permissions'][0]['required_auth'].keys[0].key;
        // this.crypto.authenticate(password, pubkey).then((data) => {
        //   if(data === true) {
        //     this.eos.ramSell()
        //   }
        // }).catch(() => {
        //   this.busy = false;
        //   this.wrongpass = 'Wrong password!';
        // });
    };
    ResourcesComponent.prototype.buy = function () {
    };
    ResourcesComponent.prototype.buybytes = function () {
    };
    ResourcesComponent = __decorate([
        core_1.Component({
            selector: 'app-ram-market',
            templateUrl: './resources.component.html',
            styleUrls: ['./resources.component.css']
        }),
        __metadata("design:paramtypes", [eosjs_service_1.EOSJSService,
            accounts_service_1.AccountsService,
            crypto_service_1.CryptoService,
            angular2_toaster_1.ToasterService,
            forms_1.FormBuilder,
            ram_service_1.RamService])
    ], ResourcesComponent);
    return ResourcesComponent;
}());
exports.ResourcesComponent = ResourcesComponent;
//# sourceMappingURL=resources.component.js.map