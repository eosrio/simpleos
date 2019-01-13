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
var http_1 = require("@angular/common/http");
var moment = require("moment");
var textMaskAddons_1 = require("text-mask-addons/dist/textMaskAddons");
var ResourcesComponent = /** @class */ (function () {
    function ResourcesComponent(eos, aService, crypto, toaster, fb, ramService, http) {
        this.eos = eos;
        this.aService = aService;
        this.crypto = crypto;
        this.toaster = toaster;
        this.fb = fb;
        this.ramService = ramService;
        this.http = http;
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
        this.feeBuy = 0;
        this.feeSell = 0;
        this.ram_quota = 0;
        this.ram_usage = 0;
        this.cpu_weight = '';
        this.net_weight = '';
        this.delegations = [];
        this.delegated_net = 0;
        this.delegated_cpu = 0;
        this.cpuD = '';
        this.netD = '';
        this.errormsgD = '';
        this.errormsgD2 = '';
        this.errormsgD3 = '';
        this.busy = false;
        this.ramActionModal = false;
        this.wrongpassbuy = '';
        this.wrongpasssell = '';
        this.wrongpassundelegate = '';
        this.wrongpassdelegate = '';
        this.errormsg = '';
        this.errormsg2 = '';
        this.errormsgeos = '';
        this.handleIcon = 'M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,' +
            '8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z';
        this.sellValue = 0;
        this.numberMask = textMaskAddons_1.createNumberMask({
            prefix: '',
            allowDecimal: true,
            includeThousandsSeparator: false,
            decimalLimit: 4
        });
        this.dataDT = [];
        this.dataVAL = [];
        this.ram_chartMerge = [];
        this.wrongpassbuy = '';
        this.wrongpasssell = '';
        this.wrongpassundelegate = '';
        this.wrongpassdelegate = '';
        this.errormsg = '';
        this.errormsg2 = '';
        this.errormsgeos = '';
        this.errormsgD = '';
        this.errormsgD2 = '';
        this.errormsgD3 = '';
        this.ramMarketFormBuy = this.fb.group({
            buyBytes: [0, forms_1.Validators.required],
            buyEos: [0],
            accountBuy: ['to this account', forms_1.Validators.required],
            anotherAcc: ['']
        });
        this.delegateForm = this.fb.group({
            netEos: [0, forms_1.Validators.compose([forms_1.Validators.required, forms_1.Validators.pattern('^(0*[1-9][0-9]*(\.[0-9]+)?|0+\.[0-9]*[1-9][0-9]*)$')])],
            cpuEos: [0, forms_1.Validators.compose([forms_1.Validators.required, forms_1.Validators.pattern('^(0*[1-9][0-9]*(\.[0-9]+)?|0+\.[0-9]*[1-9][0-9]*)$')])],
            receiverAcc: ['', forms_1.Validators.required]
        });
        this.ramMarketFormSell = this.fb.group({
            sellEos: [0],
            sellBytes: [0, forms_1.Validators.required]
        });
        this.passBuyForm = this.fb.group({
            pass: ''
        });
        this.passSellForm = this.fb.group({
            pass: ''
        });
        this.passUnDelegateForm = this.fb.group({
            pass: ''
        });
        this.passDelegateForm = this.fb.group({
            pass: ''
        });
        this.ram_chart = {
            title: {
                left: 'center',
                subtext: 'daily RAM price chart',
                subtextStyle: {
                    color: '#ffffff',
                    fontWeight: 'bold',
                },
                top: '20'
            },
            grid: {
                height: '67%',
                width: '70%',
                right: '52',
            },
            tooltip: {
                trigger: 'axis',
                position: function (pt) {
                    return [pt[0], '20%'];
                },
                formatter: function (params) {
                    params = params[0];
                    return moment(params.name).format('HH:mm[\n]DD/MM/YYYY') + ' : ' + params.value.toFixed(6);
                },
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: [],
                axisLine: {
                    lineStyle: {
                        color: '#B7B7B7',
                    },
                },
                axisLabel: {
                    textStyle: {
                        color: '#B7B7B7',
                    },
                    formatter: function (params) {
                        return moment(params).format('HH:mm[\n]DD/MM');
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
                },
                scale: true
            },
            dataZoom: [{
                    show: true,
                    realtime: true,
                    start: 60,
                    end: 100,
                    handleIcon: 'M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z',
                    handleSize: '80%',
                    handleStyle: {
                        color: '#fff',
                        shadowBlur: 3,
                        shadowColor: 'rgba(0, 0, 0, 0.7)',
                        shadowOffsetX: 2,
                        shadowOffsetY: 2
                    }, textStyle: {
                        color: '#FFFFFF',
                    },
                    labelFormatter: function (params, out) {
                        return moment(out).format('HH:mm[\n]DD/MM');
                    },
                    dataBackground: {
                        lineStyle: {
                            color: 'rgba(0, 148, 210, 0.5'
                        },
                        areaStyle: {
                            color: 'rgba(0, 143, 203, 0.5'
                        }
                    }
                }, {
                    type: 'inside',
                    realtime: true,
                    start: 60,
                    end: 100,
                    bottom: 0
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
                            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [{
                                    offset: 0, color: 'rgb(149, 223, 255, 0.6)' // cor do gradiente em cima
                                }, {
                                    offset: 1, color: 'rgb(0, 143, 203, 0.6)' // cor do gradiente embaixo
                                }],
                        }
                    },
                    data: []
                }
            ]
        };
    }
    ResourcesComponent.prototype.ngOnInit = function () {
        var _this = this;
        this.reload();
        this.loadHistory();
        this.aService.selected.asObservable().subscribe(function (selected) {
            if (selected.details) {
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
    ResourcesComponent.prototype.showToast = function (type, title, body) {
        this.config = new angular2_toaster_1.ToasterConfig({
            positionClass: 'toast-top-right',
            timeout: 10000,
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
            timeout: 10000,
            showCloseButton: true,
            bodyOutputType: angular2_toaster_1.BodyOutputType.TrustedHtml,
        };
        this.toaster.popAsync(toast);
    };
    ResourcesComponent.prototype.reload = function () {
        var _this = this;
        this.eos.getChainInfo().then(function (global) {
            if (global) {
                _this.max_ram_size = global.rows[0]['max_ram_size'];
                _this.total_ram_bytes_reserved = global.rows[0]['total_ram_bytes_reserved'];
                _this.total_ram_stake = global.rows[0]['total_ram_stake'];
                _this.eos.getRamMarketInfo().then(function (rammarket) {
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
            else {
                _this.delegations = [];
                _this.delegated_net = 0;
                _this.delegated_cpu = 0;
            }
        });
    };
    ResourcesComponent.prototype.convertToBytes = function () {
        if (this.ramPriceEOS > 0) {
            this.ramMarketFormBuy.patchValue({
                buyBytes: (this.ramMarketFormBuy.get('buyEos').value / this.ramPriceEOS)
            });
            this.feeBuy = this.feeCalculator(this.ramMarketFormBuy.get('buyEos').value);
        }
    };
    ResourcesComponent.prototype.convertToEos = function () {
        if (this.ramPriceEOS > 0) {
            this.ramMarketFormBuy.patchValue({
                buyEos: (this.ramMarketFormBuy.get('buyBytes').value * this.ramPriceEOS)
            });
            this.feeBuy = this.feeCalculator(this.ramMarketFormBuy.get('buyEos').value);
        }
    };
    ResourcesComponent.prototype.convertToEosSELL = function () {
        if (this.ramPriceEOS > 0) {
            this.ramMarketFormSell.patchValue({
                sellEos: (this.ramMarketFormSell.get('sellBytes').value * this.ramPriceEOS)
            });
            this.feeSell = this.feeCalculator(this.ramMarketFormSell.get('sellEos').value);
        }
    };
    ResourcesComponent.prototype.convertToBytesSELL = function () {
        if (this.ramPriceEOS > 0) {
            this.ramMarketFormSell.patchValue({
                sellBytes: (this.ramMarketFormSell.get('sellEos').value / this.ramPriceEOS)
            });
            this.feeSell = this.feeCalculator(this.ramMarketFormSell.get('sellEos').value);
        }
    };
    ResourcesComponent.prototype.bytesFilter = function (bytes, precision) {
        if (isNaN(parseFloat(bytes)) || !isFinite(bytes))
            return '-';
        if (typeof precision === 'undefined')
            precision = 1;
        var units = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB'], number = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, Math.floor(number))).toFixed(4) + ' ' + units[number];
    };
    ResourcesComponent.prototype.feeCalculator = function (eosprice) {
        return eosprice * .005;
    };
    ResourcesComponent.prototype.updatePrice = function () {
        this.ramPriceEOS = ((this.rm_quote) / this.rm_base) * 1024;
    };
    ResourcesComponent.prototype.openRamModal = function () {
        this.ramActionModal = true;
    };
    ResourcesComponent.prototype.updateChart = function () {
        this.ram_chartMerge = {
            xAxis: {
                data: this.dataDT
            },
            series: {
                data: this.dataVAL
            }
        };
    };
    ResourcesComponent.prototype.loadHistory = function () {
        var _this = this;
        var i = 0;
        this.http.get('https://hapi.eosrio.io/ram/history1D').subscribe(function (data) {
            var arr = data;
            arr.reverse();
            data.forEach(function (val) {
                _this.dataDT.push(val.time);
                _this.dataVAL.push(val.price);
                i++;
            });
            _this.updateChart();
            var j = 0;
            _this.ramService.ramTicker.asObservable().subscribe(function (ramdata) {
                if (ramdata) {
                    if (ramdata.price) {
                        var dt = new Date(ramdata.time);
                        _this.ramPriceEOS = ramdata.price;
                        _this.dataDT.push(dt.toISOString());
                        _this.dataVAL.push(ramdata.price);
                        _this.updateChart();
                        j++;
                    }
                }
            });
        });
    };
    ResourcesComponent.prototype.checkAccountName = function () {
        var _this = this;
        if (this.ramMarketFormBuy.value.anotherAcc !== '') {
            try {
                this.eos.checkAccountName(this.ramMarketFormBuy.value.anotherAcc.toLowerCase());
                this.ramMarketFormBuy.controls['anotherAcc'].setErrors(null);
                this.errormsg = '';
                this.eos.getAccountInfo(this.ramMarketFormBuy.value.anotherAcc.toLowerCase()).then(function () {
                    _this.ramMarketFormBuy.controls['anotherAcc'].setErrors(null);
                    _this.errormsg = '';
                }).catch(function () {
                    _this.ramMarketFormBuy.controls['anotherAcc'].setErrors({ 'incorrect': true });
                    _this.errormsg = 'account does not exist';
                });
            }
            catch (e) {
                this.ramMarketFormBuy.controls['anotherAcc'].setErrors({ 'incorrect': true });
                this.errormsg = e.message;
            }
        }
        else {
            this.errormsg = '';
        }
    };
    ResourcesComponent.prototype.checkAccName = function () {
        var _this = this;
        if (this.delegateForm.value.receiverAcc !== '') {
            try {
                this.eos.checkAccountName(this.delegateForm.value.receiverAcc.toLowerCase());
                this.delegateForm.controls['receiverAcc'].setErrors(null);
                this.errormsgD = '';
                this.eos.getAccountInfo(this.delegateForm.value.receiverAcc.toLowerCase()).then(function () {
                    _this.delegateForm.controls['receiverAcc'].setErrors(null);
                    _this.errormsgD = '';
                }).catch(function () {
                    _this.delegateForm.controls['receiverAcc'].setErrors({ 'incorrect': true });
                    _this.errormsgD = 'account does not exist';
                });
            }
            catch (e) {
                this.delegateForm.controls['receiverAcc'].setErrors({ 'incorrect': true });
                this.errormsgD = e.message;
            }
        }
        else {
            this.errormsg = '';
        }
    };
    ResourcesComponent.prototype.checkBuyBytes = function () {
        var _this = this;
        if (this.ramMarketFormBuy.value.buyBytes > 0) {
            this.aService.selected.asObservable().subscribe(function (sel) {
                if (sel) {
                    _this.unstaked = sel.full_balance - sel.staked - sel.unstaking;
                    //this.unstakeTime = moment.utc(sel.unstakeTime).add(72, 'hours').fromNow();
                }
            });
            if (this.unstaked > this.ramMarketFormBuy.get('buyEos').value) {
                this.ramMarketFormBuy.controls['buyBytes'].setErrors(null);
                this.ramMarketFormBuy.controls['buyEos'].setErrors(null);
                this.errormsg2 = '';
                return true;
            }
            else {
                this.ramMarketFormBuy.controls['buyEos'].setErrors({ 'incorrect': true });
                this.errormsg2 = 'not enough unstaked EOS!';
                return false;
            }
        }
        else {
            this.ramMarketFormBuy.controls['buyBytes'].setErrors({ 'incorrect': true });
            this.errormsg2 = 'must fill RAM amount or price';
            return false;
        }
    };
    ResourcesComponent.prototype.checkSellBytes = function () {
        if (this.ramMarketFormSell.value.sellBytes > 0) {
            console.log(this.ram_quota);
            if ((this.ram_quota - this.ram_usage) > (this.ramMarketFormSell.get('sellBytes').value) * 1024) {
                this.ramMarketFormSell.controls['sellBytes'].setErrors(null);
                this.ramMarketFormSell.controls['sellEos'].setErrors(null);
                this.errormsgeos = '';
                return true;
            }
            else {
                this.ramMarketFormSell.controls['sellEos'].setErrors({ 'incorrect': true });
                this.errormsgeos = 'not enough RAM!';
                return false;
            }
        }
        else {
            this.ramMarketFormSell.controls['sellBytes'].setErrors({ 'incorrect': true });
            this.errormsgeos = 'must fill RAM amount or price';
            return false;
        }
    };
    ResourcesComponent.prototype.fillSell = function () {
        if (this.checkSellBytes()) {
            this.passSellModal = true;
            this.wrongpassbuy = '';
            this.seller = this.aService.selected.getValue().name;
            this.bytessell = "" + (this.ramMarketFormSell.get('sellBytes').value * 1024);
        }
    };
    ResourcesComponent.prototype.sell = function () {
        var _this = this;
        this.busy = true;
        this.wrongpasssell = '';
        var account = this.aService.selected.getValue();
        var password = this.passSellForm.get('pass').value;
        var pubkey = account.details['permissions'][0]['required_auth'].keys[0].key;
        this.crypto.authenticate(password, pubkey).then(function (data) {
            if (data === true) {
                _this.eos.ramSellBytes(_this.seller, _this.bytessell).then(function (e) {
                    _this.passSellModal = false;
                    _this.showToast('success', 'Transation broadcasted', 'Check your history for confirmation.');
                }).catch(function (error) {
                    _this.busy = false;
                    _this.wrongpasssell = 'Something went wrong!';
                });
            }
        }).catch(function () {
            _this.busy = false;
            _this.wrongpasssell = 'Wrong password!';
        });
        this.passSellForm.reset();
        this.busy = false;
    };
    ResourcesComponent.prototype.fillBuy = function () {
        if (this.checkBuyBytes()) {
            this.passBuyModal = true;
            this.wrongpassbuy = '';
            this.receiver = this.aService.selected.getValue().name;
            this.payer = this.aService.selected.getValue().name;
            this.bytesbuy = "" + (this.ramMarketFormBuy.get('buyBytes').value * 1024);
            var accountBuy = this.ramMarketFormBuy.get('accountBuy').value;
            if (accountBuy === 'to another account') {
                this.receiver = this.ramMarketFormBuy.get('anotherAcc').value;
            }
        }
    };
    ResourcesComponent.prototype.buy = function () {
        var _this = this;
        this.busy = true;
        this.wrongpassbuy = '';
        var account = this.aService.selected.getValue();
        var password = this.passBuyForm.get('pass').value;
        var pubkey = account.details['permissions'][0]['required_auth'].keys[0].key;
        this.crypto.authenticate(password, pubkey).then(function (data) {
            if (data === true) {
                _this.eos.ramBuyBytes(_this.payer, _this.receiver, _this.bytesbuy).then(function (e) {
                    _this.passBuyModal = false;
                    _this.showToast('success', 'Transation broadcasted', 'Check your history for confirmation.');
                }).catch(function (error) {
                    console.log(error);
                    _this.busy = false;
                    _this.wrongpassbuy = 'Something went wrong!';
                    console.log('Error: ', error);
                });
            }
        }).catch(function () {
            _this.busy = false;
            _this.wrongpassbuy = 'Wrong password!';
        });
        this.passBuyForm.reset();
        this.busy = false;
    };
    ResourcesComponent.prototype.fillUnDelegateRequest = function (from, net, cpu) {
        this.fromUD = from;
        this.netUD = net;
        this.cpuUD = cpu;
        this.accNow = this.aService.selected.getValue().name;
        this.wrongpassundelegate = '';
    };
    ResourcesComponent.prototype.unDelegateRequest = function () {
        var _this = this;
        this.busy = true;
        var account = this.aService.selected.getValue();
        var password = this.passUnDelegateForm.get('pass').value;
        var pubkey = account.details['permissions'][0]['required_auth'].keys[0].key;
        this.crypto.authenticate(password, pubkey).then(function (data) {
            if (data === true) {
                _this.eos.unDelegate(_this.accNow, _this.fromUD, _this.netUD, _this.cpuUD, _this.aService.mainnetActive['symbol']).then(function (e) {
                    _this.fromUD = "";
                    _this.netUD = "";
                    _this.cpuUD = "";
                    _this.accNow = "";
                    _this.passUnDelegateModal = false;
                    _this.showToast('success', 'Transation broadcasted', 'Check your history for confirmation.');
                }).catch(function (error) {
                    _this.busy = false;
                    _this.wrongpassundelegate = 'Something went wrong!';
                });
            }
        }).catch(function (q) {
            _this.busy = false;
            _this.wrongpassundelegate = 'Wrong password!';
        });
        this.wrongpassundelegate = '';
        this.passUnDelegateForm.reset();
        this.busy = false;
    };
    ResourcesComponent.prototype.checkEos = function (eosVal, val) {
        var _this = this;
        if (eosVal > 0) {
            this.aService.selected.asObservable().subscribe(function (sel) {
                if (sel) {
                    if (val === 'net') {
                        _this.unstaked = sel.full_balance - sel.staked - sel.unstaking - _this.delegateForm.get('cpuEos').value;
                    }
                    else {
                        _this.unstaked = sel.full_balance - sel.staked - sel.unstaking - _this.delegateForm.get('netEos').value;
                    }
                }
            });
            if (this.unstaked > eosVal) {
                this.errormsgD3 = '';
                return true;
            }
            else {
                this.errormsgD3 = 'not enough unstaked EOS!';
                return false;
            }
        }
        else {
            this.errormsgD3 = 'must fill NET and CPU amount';
            return false;
        }
    };
    ResourcesComponent.prototype.fillDelegateRequest = function () {
        this.accTo = this.delegateForm.get('receiverAcc').value;
        this.netD = parseFloat(this.delegateForm.get('netEos').value).toFixed(4);
        this.cpuD = parseFloat(this.delegateForm.get('cpuEos').value).toFixed(4);
        this.accNow = this.aService.selected.getValue().name;
    };
    ResourcesComponent.prototype.delegateRequest = function () {
        var _this = this;
        this.wrongpassdelegate = '';
        this.busy = true;
        var account = this.aService.selected.getValue();
        var password = this.passDelegateForm.get('pass').value;
        var pubkey = account.details['permissions'][0]['required_auth'].keys[0].key;
        this.crypto.authenticate(password, pubkey).then(function (data) {
            if (data === true) {
                _this.eos.delegateBW(_this.accNow, _this.accTo, _this.netD, _this.cpuD, _this.aService.mainnetActive['symbol']).then(function (e) {
                    _this.accTo = '';
                    _this.netD = '';
                    _this.cpuD = '';
                    _this.accNow = '';
                    _this.passDelegateModal = false;
                    _this.showToast('success', 'Transation broadcasted', 'Check your history for confirmation.');
                }).catch(function (error) {
                    console.log(error);
                    _this.busy = false;
                    _this.wrongpassdelegate = 'Something went wrong!';
                });
            }
        }).catch(function (q) {
            _this.busy = false;
            _this.wrongpassundelegate = 'Wrong password!';
        });
        // this.wrongpassdelegate = '';
        // this.passDelegateForm.reset();
        // this.busy = false;
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
            ram_service_1.RamService,
            http_1.HttpClient])
    ], ResourcesComponent);
    return ResourcesComponent;
}());
exports.ResourcesComponent = ResourcesComponent;
//# sourceMappingURL=resources.component.js.map