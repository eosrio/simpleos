import {Injectable} from '@angular/core';
import {AccountsService} from "./accounts.service";
import {Eosjs2Service} from "./eosio/eosjs2.service";
import {HttpClient} from '@angular/common/http';
import {environment} from "../../environments/environment";

interface resourceData {
    needResources: boolean,
    relay: boolean,
    relayCredit: { used: number, limit: number },
    borrow: number,
    spend: number,
    precision: number,
    tk_name: String,
}

@Injectable({
    providedIn: 'root'
})


export class ResourceService {
    total_unlent = 0.0;
    httpOptions: any;
    total_lent = 0.0;
    total_rent = 0.0;
    rexPrice: number;
    borrowingCost: number;
    cpuCost = 0;
    netCost = 0;
    totalCost = 0;
    acumulateNeedCPU = 0;
    acumulateNeedNET = 0;
    resourceInfo: resourceData;

    private jwtToken = environment.JWT_TOKEN;

    constructor(
        private aService: AccountsService,
        private eosjs: Eosjs2Service,
        private http: HttpClient,) {

        this.resourceInfo = {
            needResources: false,
            relay: false,
            relayCredit: {used: 0, limit: 0},
            borrow: 0,
            spend: 0,
            precision: 4,
            tk_name: 'EOS'
        }
        this.httpOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Origin,X-Requested-With,Content-Type,Accept',
                'Retry-After': 1
            }
        };

    }

    static asset2Float(asset) {
        return parseFloat(asset.split(' ')[0]);
    }

    async getAvgTime(actions, needCpu?, needNet?) {
        let result = [];
        try {
            if (actions !== undefined) {
                for (let action of actions) {
                    const stastEndPoint = this.aService.activeChain.borrow.endpoint;
                    let url = `${stastEndPoint}/stats/get_resource_usage?code=${action.account}&action=${action.name}`;

                    if(action.name === 'transfer' && action.data !== undefined){
                       url = url + `&@transfer.to=bitfinexdep1`;
                    }
                    const response: any = await this.http.get(url,this.httpOptions).toPromise();

                    if (response) {
                        result.push({
                            code:action.account,
                            action:action.name,
                            cpu: response.cpu.percentiles['95.0'] ?? 0,
                            net: response.net.percentiles['99.0'] ?? 0
                        });
                    }
                }

            }
        } catch (e) {
            console.log(e);
        }

        this.acumulateNeedCPU = needCpu === undefined ? 0 : this.acumulateNeedCPU + needCpu;
        this.acumulateNeedNET = needNet === undefined ? 0 : this.acumulateNeedNET + needNet;
        const avgUsageCPU_HYPERRION = result.reduce((prev, next) => prev + (next['cpu'] || 0), 0);
        const avgUsageCPU = avgUsageCPU_HYPERRION + this.acumulateNeedCPU;

        const avgUsageNET_HYPERRION = result.reduce((prev, next) => prev + (next['net'] || 0), 0);
        const avgUsageNET = avgUsageNET_HYPERRION + this.acumulateNeedNET;

        return {cpu: avgUsageCPU, net: avgUsageNET};

    }

    async checkCredits(actions, acc) {

        let result = [];

        if (actions !== undefined) {
            for (let action of actions) {
                const url = `${this.aService.activeChain.relay.endpoint}/checkCredits`;
                try {
                    const response = await this.http.post(
                        url,
                        {accountName: acc, contractName: action.account},
                        {headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${this.jwtToken}`}}
                    ).toPromise();

                    if (response) {
                        result.push({
                            accountName: acc,
                            contractName: action.account,
                            enable: response['availableCredits'] > 0,
                            used: response['availableCredits'],
                            limit: 5
                        });
                    }
                } catch (e) {
                    result.push({
                        accountName: acc,
                        contractName: action.account,
                        enable: false
                    });
                }

            }

        }
        return result;

    }

    async sendTxRelay(payload) {
        try {
            if (payload !== undefined) {
                const url = `https://eos.relay.eosrio.io/pushFreeTx`;
                const response = await this.http.post(
                    url,
                    {
                        serializedTransaction: Array.from(payload.pushTransactionArgs.serializedTransaction),
                        signatures: payload.pushTransactionArgs.signatures
                    },
                    {headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${this.jwtToken}`}}
                ).toPromise();
                console.log(response);
                return response;
            }
        } catch (e) {
            return (e);
        }
    }

    async checkResource(auth, actions, needCpu?, needNet?, tkname?) {

        // console.log(auth, actions, needCpu, needNet, tkname);
        let isCPUWithdraw = false;
        let isNETWithdraw = false;

        let targetCpu = 0.0000;
        let targetNet = 0.0000;
        let _needResource = false;
        let _relay = false;
        let _relayCredits = {used: 0, limit: 0};

        const tk_nameVal = tkname ?? this.aService.activeChain['symbol'];
        const precision = this.aService.activeChain['precision'];
        const account = this.aService.selected.getValue();

        // Get avg uS values CPU/NET
        const avgUsage: any = await this.getAvgTime(actions, needCpu, needNet);
        console.log(avgUsage);

        //Total staked CPU
        const totalCPUStaked = ResourceService.asset2Float(account.details.total_resources.cpu_weight);

        //Total staked NET
        const totalNETStaked = ResourceService.asset2Float(account.details.total_resources.net_weight);

        //If is total withdraw undelegatebw action change resource available to zero
        const unstake = actions.find(elem => elem.name === 'undelegatebw');
        if (unstake) {
            const unstakeCPU = ResourceService.asset2Float(unstake.data.unstake_cpu_quantity);

            isCPUWithdraw = (totalCPUStaked - unstakeCPU) <= 0 ?? false;

            const unstakeNET = ResourceService.asset2Float(unstake.data.unstake_net_quantity);

            isNETWithdraw = (totalNETStaked - unstakeNET) <= 0 ?? false;
        }
        const accStd = await this.eosjs.getAccountInfo('eosriobrazil');
        const totalCPUStakedStd = accStd.cpu_weight/precision;
        const totalNETStakedStd = accStd.net_weight/precision;

        const maxCPULimit = accStd.cpu_limit.max;
        const maxNETLimit = accStd.net_limit.max;
        // cost of uS CPU
        const timeTokenUnitCPU = parseFloat((totalCPUStakedStd / maxCPULimit).toPrecision(precision));

        // cost of uS NET
        const timeTokenUnitNET = parseFloat((totalNETStakedStd / maxNETLimit).toPrecision(precision));

        //If is total withdraw is true change resource available to zero before sending actions
        const totalCPULimitAvailable = isCPUWithdraw ? 0 : account.details.cpu_limit.available;
        const totalNETLimitAvailable = isNETWithdraw ? 0 : account.details.net_limit.available;

        console.log({
            totalCPUStaked: totalCPUStaked,
            totalNETStaked: totalNETStaked,
            maxCPULimit: maxCPULimit,
            maxNETLimit: maxNETLimit,
            timeTokenUnitCPU: timeTokenUnitCPU,
            timeTokenUnitNET: timeTokenUnitNET,
            totalCPULimitAvailable: totalCPULimitAvailable,
            totalNETLimitAvailable: totalNETLimitAvailable,
        });
        // if (totalCPULimitAvailable < avgUsage.cpu || totalNETLimitAvailable < avgUsage.net) {

        //Check first if has free tx push
        // if(this.aService.activeChain['relay']['enable'] &&  totalCPULimitAvailable < this.aService.activeChain['relay']['usageCpuLimit']) {
        if (this.aService.activeChain['relay']['enable']) {
            const result:any = await this.checkCredits(actions, account.name);
            console.log(result);
            if (result[0]['enable']) {
                _relay = true;
                _relayCredits.used = result['used'];
                _relayCredits.limit = result['limit'];
            }
            console.log(result);
        }

        if (this.aService.activeChain['features']['rex']) {

            // Get Rex Informations
            await this.updateGlobalRexData();

            if (this.aService.activeChain['borrow']['enable']) {

                //Parameters from config.json
                const defaultUS: number = this.aService.activeChain['borrow']['default_us'];
                const margin: number = this.aService.activeChain['borrow']['margin'];


                const newAvgCPU = (avgUsage.cpu + defaultUS) * margin;

                if (totalCPULimitAvailable < newAvgCPU) {
                    targetCpu = parseFloat(((newAvgCPU - totalCPULimitAvailable) * timeTokenUnitCPU).toPrecision(precision));
                    _needResource = true;
                }

                if (totalNETLimitAvailable < avgUsage.net) {
                    if (isNETWithdraw) {
                        targetNet = parseFloat((2).toPrecision(precision));
                    } else {
                        targetNet = parseFloat(((avgUsage.net - totalNETLimitAvailable) * timeTokenUnitNET).toPrecision(precision));
                    }
                    _needResource = true;
                }

                console.log({
                    targetCpu: targetCpu,
                    targetNet: targetNet,
                    borrowingCost: this.borrowingCost,
                    newAvgCPU: newAvgCPU,
                    totalCPULimitAvailable: totalCPULimitAvailable,
                    totalNETLimitAvailable: totalNETLimitAvailable,
                    timeTokenUnitCPU: timeTokenUnitCPU,
                    precision: precision
                });

                if (targetCpu > 0) {
                    this.cpuCost = targetCpu / this.borrowingCost;
                    if (this.cpuCost < 0.0001) {
                        this.cpuCost = 0.0001;
                    }
                }

                if (targetNet > 0) {
                    this.netCost = targetNet / this.borrowingCost;
                    if (this.netCost < 0.0001) {
                        this.netCost = 0.0001;
                    }
                }

                this.totalCost = this.cpuCost + this.netCost;
            }
        }
        // }

        this.resourceInfo = {
            needResources: _needResource,
            relay: _relay,
            relayCredit: _relayCredits,
            borrow: targetCpu + targetNet,
            spend: this.totalCost,
            precision: precision,
            tk_name: tk_nameVal
        };
        console.log(this.resourceInfo);
        return this.resourceInfo;
    }

    calculateRexPrice(rexpool) {
        const S0 = ResourceService.asset2Float(rexpool.total_lendable);
        const S1 = S0 + 1.0000;
        const R0 = ResourceService.asset2Float(rexpool.total_rex);
        const R1 = (S1 * R0) / S0;
        const rex_amount = R1 - R0;
        this.rexPrice = 1.0000 / rex_amount;
    }

    calculateBorrowingCost(rexpool) {
        const F0 = ResourceService.asset2Float(rexpool.total_rent);
        const T0 = ResourceService.asset2Float(rexpool.total_unlent);
        const I = 1.0000;
        let out = ((I * T0) / (I + F0));
        if (out < 0) {
            out = 0;
        }
        this.borrowingCost = out;
    }

    private async updateGlobalRexData() {
        await this.eosjs.getRexPool().then((data) => {
            this.total_unlent = ResourceService.asset2Float(data.total_unlent);
            this.total_lent = ResourceService.asset2Float(data.total_lent);
            this.total_rent = ResourceService.asset2Float(data.total_rent);
            this.calculateRexPrice(data);
            this.calculateBorrowingCost(data);
        });
    }

    async getActions(auth) {
        let actions = [];

        let precision = this.aService.activeChain['precision'];
        let tk_name = this.aService.activeChain['symbol'];

        const amountRex = this.totalCost;
        const _cpuPayment = this.cpuCost.toFixed(precision) + ' ' + tk_name;
        const cpu_fund = 0;
        const _netPayment = this.netCost.toFixed(precision) + ' ' + tk_name;
        const net_fund = 0;


        if (this.resourceInfo.needResources && !this.resourceInfo.relay) {
            if (this.cpuCost > 0 || this.netCost > 0) {
                actions.push({
                    account: 'eosio',
                    name: 'deposit',
                    authorization: [auth],
                    data: {
                        'owner': auth.actor,
                        'amount': amountRex.toFixed(precision) + ' ' + tk_name
                    }
                });
            }

            if (this.cpuCost > 0) {
                actions.push({
                    account: 'eosio',
                    name: 'rentcpu',
                    authorization: [auth],
                    data: {
                        'from': auth.actor,
                        'receiver': auth.actor,
                        'loan_payment': _cpuPayment,
                        'loan_fund': cpu_fund.toFixed(precision) + ' ' + tk_name
                    }
                });
            }

            if (this.netCost > 0) {
                actions.push({
                    account: 'eosio',
                    name: 'rentnet',
                    authorization: [auth],
                    data: {
                        'from': auth.actor,
                        'receiver': auth.actor,
                        'loan_payment': _netPayment,
                        'loan_fund': net_fund.toFixed(precision) + ' ' + tk_name
                    }
                });
            }
        }

        return actions;
    }
}
