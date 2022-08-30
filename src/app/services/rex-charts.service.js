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
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RexChartsService = void 0;
const core_1 = require("@angular/core");
const http_1 = require("@angular/common/http");
const rxjs_1 = require("rxjs");
const accounts_service_1 = require("./accounts.service");
let RexChartsService = class RexChartsService {
    constructor(http, aService) {
        this.http = http;
        this.aService = aService;
        this.borrowingCostChart = new rxjs_1.BehaviorSubject(null);
        this.rexPriceChart = new rxjs_1.BehaviorSubject(null);
    }
    getChart(type, range, interval) {
        return __awaiter(this, void 0, void 0, function* () {
            let chain = '';
            switch (this.aService.activeChain['name']) {
                case 'EOS MAINNET': {
                    chain = 'mainnet';
                    break;
                }
                case 'BOS MAINNET': {
                    chain = 'bos_mainnet';
                    break;
                }
                case 'EOS JUNGLE TESTNET': {
                    chain = 'jungle';
                    break;
                }
                case 'BOS TESTNET': {
                    chain = 'bos_testnet';
                    break;
                }
                case 'EOS KYLIN TESTNET': {
                    chain = 'kylin';
                    break;
                }
                default: {
                    return null;
                }
            }
            const response = yield this.http.get('https://br.eosrio.io/rex/chart?field=' + type + '&range=' + range + '&interval=' + interval + '&chain=' + chain, {
                responseType: 'text'
            }).toPromise();
            const arr = response.split('\n');
            arr.shift();
            const result = [];
            arr.forEach((line) => {
                const fields = line.split(',');
                if (fields.length > 1) {
                    if (fields[4].split('.').length > 1) {
                        fields[4] = fields[4].split('.')[0] + '.000Z';
                    }
                    else {
                        fields[4] = fields[4].replace('Z', '.000Z');
                    }
                    result.push({
                        time: fields[4],
                        value: parseFloat(fields[3])
                    });
                }
            });
            return result;
        });
    }
    loadCharts(_range, _interval) {
        return __awaiter(this, void 0, void 0, function* () {
            this.rexPriceChart.next(yield this.getChart('rex_price', _range, _interval));
            this.borrowingCostChart.next(yield this.getChart('borrowing_cost', _range, _interval));
        });
    }
};
RexChartsService = __decorate([
    (0, core_1.Injectable)({
        providedIn: 'root'
    }),
    __metadata("design:paramtypes", [http_1.HttpClient,
        accounts_service_1.AccountsService])
], RexChartsService);
exports.RexChartsService = RexChartsService;
//# sourceMappingURL=rex-charts.service.js.map