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
exports.ResourceService = void 0;
const core_1 = require("@angular/core");
const accounts_service_1 = require("./accounts.service");
const eosjs2_service_1 = require("./eosio/eosjs2.service");
const http_1 = require("@angular/common/http");
const environment_1 = require("../../environments/environment");
const aux_functions_1 = require("../helpers/aux_functions");
let ResourceService = class ResourceService {
    constructor(aService, eosjs, http) {
        this.aService = aService;
        this.eosjs = eosjs;
        this.http = http;
        this.total_unlent = 0.0;
        this.total_lent = 0.0;
        this.total_rent = 0.0;
        this.cpuCost = 0;
        this.netCost = 0;
        this.totalCost = 0;
        this.cpu_frac = 0;
        this.net_frac = 0;
        this.acumulateNeedCPU = 0;
        this.acumulateNeedNET = 0;
        this.jwtToken = environment_1.environment.JWT_TOKEN;
        this.resourceInfo = {
            needResources: false,
            relay: false,
            relayCredit: { used: 0, limit: 0 },
            borrow: 0,
            spend: 0,
            precision: 4,
            tk_name: 'EOS'
        };
        this.httpOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Origin,X-Requested-With,Content-Type,Accept',
                'Retry-After': 1
            }
        };
    }
    getAvgTime(actions, needCpu, needNet) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            let result = [];
            try {
                if (actions !== undefined) {
                    for (let action of actions) {
                        const stastEndPoint = this.aService.activeChain.borrow.endpoint;
                        let url = `${stastEndPoint}/stats/get_resource_usage?code=${action.account}&action=${action.name}`;
                        if (action.name === 'transfer' && action.data !== undefined) {
                            url = url + `&@transfer.to=bitfinexdep1`;
                        }
                        const response = yield this.http.get(url, this.httpOptions).toPromise();
                        if (response) {
                            result.push({
                                code: action.account,
                                action: action.name,
                                cpu: (_a = response.cpu.percentiles['95.0']) !== null && _a !== void 0 ? _a : 0,
                                net: (_b = response.net.percentiles['99.0']) !== null && _b !== void 0 ? _b : 0
                            });
                        }
                    }
                }
            }
            catch (e) {
                console.log(e);
            }
            this.acumulateNeedCPU = needCpu === undefined ? 0 : this.acumulateNeedCPU + needCpu;
            this.acumulateNeedNET = needNet === undefined ? 0 : this.acumulateNeedNET + needNet;
            const avgUsageCPU_HYPERRION = result.reduce((prev, next) => prev + (next['cpu'] || 0), 0);
            const avgUsageCPU = avgUsageCPU_HYPERRION + this.acumulateNeedCPU;
            const avgUsageNET_HYPERRION = result.reduce((prev, next) => prev + (next['net'] || 0), 0);
            const avgUsageNET = avgUsageNET_HYPERRION + this.acumulateNeedNET;
            return { cpu: avgUsageCPU, net: avgUsageNET };
        });
    }
    checkCredits(actions, acc) {
        return __awaiter(this, void 0, void 0, function* () {
            let result = [];
            if (actions !== undefined) {
                for (let action of actions) {
                    const url = `${this.aService.activeChain.relay.endpoint}/checkCredits`;
                    try {
                        const response = yield this.http.post(url, { accountName: acc, contractName: action.account }, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.jwtToken}` } }).toPromise();
                        if (response) {
                            result.push({
                                accountName: acc,
                                contractName: action.account,
                                enable: response['availableCredits'] > 0,
                                used: response['availableCredits'],
                                limit: 5
                            });
                        }
                    }
                    catch (e) {
                        result.push({
                            accountName: acc,
                            contractName: action.account,
                            enable: false
                        });
                    }
                }
            }
            return result;
        });
    }
    sendTxRelay(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (payload !== undefined) {
                    const url = `https://eos.relay.eosrio.io/pushFreeTx`;
                    const response = yield this.http.post(url, {
                        serializedTransaction: Array.from(payload.pushTransactionArgs.serializedTransaction),
                        signatures: payload.pushTransactionArgs.signatures
                    }, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.jwtToken}` } }).toPromise();
                    console.log(response);
                    return response;
                }
            }
            catch (e) {
                return (e);
            }
        });
    }
    checkResource(auth, actions, needCpu, needNet, tkname) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            // console.log(auth, actions, needCpu, needNet, tkname);
            let isCPUWithdraw = false;
            let isNETWithdraw = false;
            let targetCpu = 0.0000;
            let targetNet = 0.0000;
            let _needResource = false;
            let _relay = false;
            let _relayCredits = { used: 0, limit: 0 };
            const tk_nameVal = tkname !== null && tkname !== void 0 ? tkname : this.aService.activeChain['symbol'];
            const precision = this.aService.activeChain['precision'];
            const prCalc = Math.pow(10, precision);
            const account = this.aService.selected.getValue();
            // Get avg uS values CPU/NET
            const avgUsage = yield this.getAvgTime(actions, needCpu, needNet);
            //Total staked CPU
            const totalCPUStaked = (0, aux_functions_1.parseTokenValue)(account.details.total_resources.cpu_weight);
            //Total staked NET
            const totalNETStaked = (0, aux_functions_1.parseTokenValue)(account.details.total_resources.net_weight);
            //If is total withdraw undelegatebw action change resource available to zero
            const unstake = actions.find(elem => elem.name === 'undelegatebw');
            if (unstake) {
                const unstakeCPU = (0, aux_functions_1.parseTokenValue)(unstake.data.unstake_cpu_quantity);
                isCPUWithdraw = (_a = (totalCPUStaked - unstakeCPU) <= 0) !== null && _a !== void 0 ? _a : false;
                const unstakeNET = (0, aux_functions_1.parseTokenValue)(unstake.data.unstake_net_quantity);
                isNETWithdraw = (_b = (totalNETStaked - unstakeNET) <= 0) !== null && _b !== void 0 ? _b : false;
            }
            const timeCost = yield this.eosjs.getTimeUsCost(precision, account.details);
            // cost of uS CPU
            const timeTokenUnitCPU = timeCost['cpuCost'];
            // cost of uS NET
            // const timeTokenUnitNET = timeCost['netCost'];
            //If is total withdraw is true change resource available to zero before sending actions
            const totalCPULimitAvailable = isCPUWithdraw ? 0 : account.details.cpu_limit.available;
            const totalNETLimitAvailable = isNETWithdraw ? 0 : account.details.net_limit.available;
            //Parameters from config.json
            const defaultUS = this.aService.activeChain['borrow']['default_us'];
            const margin = this.aService.activeChain['borrow']['margin'];
            const newAvgCPU = (avgUsage.cpu + defaultUS) * margin;
            // console.log({
            //     account:acc,
            //     totalCPUStaked: totalCPUStaked,
            //     totalNETStaked: totalNETStaked,
            //     maxCPULimit: maxCPULimit,
            //     maxNETLimit: maxNETLimit,
            //     timeTokenUnitCPU: timeTokenUnitCPU,
            //     timeTokenUnitNET: timeTokenUnitNET,
            //     totalCPULimitAvailable: totalCPULimitAvailable,
            //     totalNETLimitAvailable: totalNETLimitAvailable,
            //     avgUsageCpu:avgUsage.cpu,
            //     avgUsageNet:avgUsage.net,
            // });
            if (totalCPULimitAvailable < avgUsage.cpu || totalNETLimitAvailable < avgUsage.net) {
                //Check first if has free tx push
                if (this.aService.activeChain['relay']['enable'] && totalCPULimitAvailable < this.aService.activeChain['relay']['usageCpuLimit']) {
                    if (this.aService.activeChain['relay']['enable']) {
                        const result = yield this.checkCredits(actions, account.name);
                        if (result[0]['enable']) {
                            _relay = true;
                            _relayCredits.used = result[0]['used'];
                            _relayCredits.limit = result[0]['limit'];
                        }
                    }
                }
                if (this.aService.activeChain['powerup']) {
                    const avgUsagePUP = yield this.getAvgTime([{ account: 'eosio', name: 'powerup', }], needCpu, needNet);
                    const state = yield this.eosjs.getPowerUpState();
                    this.cpu_frac = this.aService.activeChain['powerup']['minCpuFrac'];
                    this.net_frac = this.aService.activeChain['powerup']['minNetFrac'];
                    const amountPowerCpuPlus = ((newAvgCPU + avgUsagePUP.cpu) / timeTokenUnitCPU);
                    const power_cpu = yield this.eosjs.calcPowerUp(state['cpu'], this.cpu_frac, { maxFee: 0, maxPower: amountPowerCpuPlus });
                    const power_net = yield this.eosjs.calcPowerUp(state['net'], this.net_frac, { maxFee: 0, maxPower: 0 });
                    const Amount = Math.ceil(power_cpu.fee * prCalc) / prCalc + Math.ceil(power_net.fee * prCalc) / prCalc;
                    this.cpu_frac = Math.trunc(Math.floor(power_cpu.frac));
                    this.totalCost = (Math.round((Amount) * prCalc) / prCalc);
                    _needResource = true;
                }
            }
            this.resourceInfo = {
                needResources: _needResource,
                relay: _relay,
                relayCredit: _relayCredits,
                borrow: targetCpu + targetNet,
                spend: this.totalCost,
                precision: precision,
                tk_name: tk_nameVal
            };
            return this.resourceInfo;
        });
    }
    calculateRexPrice(rexpool) {
        const S0 = (0, aux_functions_1.parseTokenValue)(rexpool.total_lendable);
        const S1 = S0 + 1.0000;
        const R0 = (0, aux_functions_1.parseTokenValue)(rexpool.total_rex);
        const R1 = (S1 * R0) / S0;
        const rex_amount = R1 - R0;
        this.rexPrice = 1.0000 / rex_amount;
    }
    calculateBorrowingCost(rexpool) {
        const F0 = (0, aux_functions_1.parseTokenValue)(rexpool.total_rent);
        const T0 = (0, aux_functions_1.parseTokenValue)(rexpool.total_unlent);
        const I = 1.0000;
        let out = ((I * T0) / (I + F0));
        if (out < 0) {
            out = 0;
        }
        this.borrowingCost = out;
    }
    // private async updateGlobalRexData() {
    //     await this.eosjs.getRexPool().then((data) => {
    //         this.total_unlent = parseTokenValue(data.total_unlent);
    //         this.total_lent = parseTokenValue(data.total_lent);
    //         this.total_rent = parseTokenValue(data.total_rent);
    //         this.calculateRexPrice(data);
    //         this.calculateBorrowingCost(data);
    //     });
    // }
    getActions(auth) {
        return __awaiter(this, void 0, void 0, function* () {
            let actions = [];
            let tk_name = this.aService.activeChain['symbol'];
            const precision = this.aService.activeChain['precision'];
            const max_payment = this.totalCost.toFixed(precision);
            if (this.resourceInfo.needResources) {
                actions.push({
                    account: 'eosio',
                    name: 'powerup',
                    authorization: [auth],
                    data: {
                        'payer': auth.actor,
                        'receiver': auth.actor,
                        'days': 1,
                        'cpu_frac': this.cpu_frac,
                        'net_frac': this.net_frac,
                        'max_payment': `${max_payment} ${tk_name}`
                    }
                });
            }
            return actions;
        });
    }
};
ResourceService = __decorate([
    (0, core_1.Injectable)({
        providedIn: 'root'
    }),
    __metadata("design:paramtypes", [accounts_service_1.AccountsService,
        eosjs2_service_1.Eosjs2Service,
        http_1.HttpClient])
], ResourceService);
exports.ResourceService = ResourceService;
//# sourceMappingURL=resource.service.js.map