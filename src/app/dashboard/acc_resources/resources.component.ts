import {Component, OnInit, AfterViewInit, ChangeDetectorRef, OnDestroy} from '@angular/core';
import {ToasterConfig, ToasterService} from 'angular2-toaster';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {EOSAccount} from '../../interfaces/account';
import {createNumberMask} from 'text-mask-addons/dist/textMaskAddons';

import {AccountsService} from '../../services/accounts.service';
import {CryptoService} from '../../services/crypto/crypto.service';
import {RamService} from '../../services/ram.service';

import * as moment from 'moment';
import {TransactionFactoryService, TrxPayload} from '../../services/eosio/transaction-factory.service';
import {Eosjs2Service} from '../../services/eosio/eosjs2.service';
import {Subscription} from "rxjs";
import {RexComponent} from "../rex/rex.component";
import {ResourceService} from "../../services/resource.service";

const _handleIcon = 'M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,' +
    '4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,' +
    '8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,' +
    '24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z';

@Component({
    selector: 'app-ram-market',
    templateUrl: './resources.component.html',
    styleUrls: ['./resources.component.css']
})
export class ResourcesComponent implements OnInit, AfterViewInit, OnDestroy {

    ramPriceEOS = 0;
    total_ram_bytes_reserved = 0;
    total_ram_stake = 0;
    max_ram_size = 0;

    feeBuy = 0;
    feeSell = 0;
    receiver: string;
    payer: string;
    seller: string;
    bytesbuy: number;
    bytessell: number;
    unstaked: number;

    ram_chart: any;
    ram_chartMerge: any;
    dataDT: any[];
    dataVAL: any[];
    timer: any;

    config: ToasterConfig;

    ramMarketFormBuy: FormGroup;
    ramMarketFormSell: FormGroup;
    passBuyForm: FormGroup;
    passSellForm: FormGroup;
    passUnDelegateForm: FormGroup;
    delegateForm: FormGroup;
    passDelegateForm: FormGroup;
    passRefundForm: FormGroup;

    ram_quota = 0;
    ram_usage = 0;

    max: number;
    min: number;
    minstake: boolean;
    busyList: boolean;
    hasRex: boolean;
    hasVote: boolean;
    valuetoStake: string;
    percenttoStake: string;
    minToStake = 0.00;
    unstaking: number;
    unstakeTime: string;
    stakeModal: boolean;
    voteModal: boolean;
    isValidAccount: boolean;
    nVotes = 0;
    nVotesProxy = 0;
    totalBalance: number;
    stakedBalance: number;
    totalStaked: number;
    votedEOSDecay: number;
    votedDecay: number;
    singleSelectionBP: any;
    selectedVotes: any[];
    wrongpass: string;
    frmForProxy: FormGroup;
    percentMask = createNumberMask({
        prefix: '',
        allowDecimal: true,
        includeThousandsSeparator: false,
        decimalLimit: 1,
        integerLimit: 3,
    });
    stakingDiff: number;
    stakingHRV: string;
    stakerr: string;
    stakedisabled: boolean;
    fromAccount: string;
    nbps: number;
    showAdvancedRatio = false;

    location: string[];
    country: string[];
    options: any;

    initOptions = {
        renderer: 'z',
        width: 1000,
        height: 400,
    };

    net_self = '';
    cpu_self = '';
    stakingRatio = 75;


    isManually: boolean;
    autoClaimStatus: boolean;

    claimPublicKey = '';
    public claimError: string;
    public gbmBalance = 0;
    public gbmLastClaim: string;
    public gbmNextClaim: string;
    public claimReady: boolean;
    public gbmEstimatedDaily = 0;
    public voteRewardsDaily = 0;
    public claimSetupWarning = '';
    public basePath = '';
    enableAutoClaim: boolean;
    enableLinkAuth: boolean;


    cpu_limit: any;
    cpu_weight = '';
    cpu_weight_n = 0;
    cpu_amount_m = 0;
    net_limit: any;
    net_weight = '';
    net_weight_n = 0;
    net_amount_m = 0;

    delegations = [];
    delegated_net = 0;
    delegated_cpu = 0;
    fromUD: string;
    netUD: string;
    cpuUD: string;
    accNow: string;

    cpuD = '';
    netD = '';
    accTo: string;
    errormsgD = '';
    errormsgD2 = '';
    errormsgD3 = '';

    info: any[];

    busy: boolean;
    wrongpassbuy = '';
    wrongpasssell = '';
    wrongpassundelegate = '';
    wrongpassdelegate = '';
    errormsg = '';
    errormsg2 = '';
    errormsgeos = '';

    numberMask = createNumberMask({
        prefix: '',
        allowDecimal: true,
        includeThousandsSeparator: false,
        decimalLimit: 4
    });
    private mode = 'local';

    private selectedAccountName = '';

    private isDestroyed = false;
    subscriptions: Subscription[] = [];
    precision = '';

    constructor(
        private eosjs: Eosjs2Service,
        public aService: AccountsService,
        private crypto: CryptoService,
        private toaster: ToasterService,
        private fb: FormBuilder,
        public ramService: RamService,
        private http: HttpClient,
        private trxFactory: TransactionFactoryService,
        private cdr: ChangeDetectorRef,
        private resource: ResourceService
    ) {
        this.busy = false;
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

        this.totalBalance = 0;
        this.stakedBalance = 0;
        this.totalStaked = 0;
        this.votedEOSDecay = 0;
        this.votedDecay = 0;
        this.isManually = false;
        this.precision = '1.0-' + this.aService.activeChain['precision'];
        this.net_limit = {
            used: 0
        };

        this.cpu_limit = {
            used: 0
        };

        this.ramMarketFormBuy = this.fb.group({
            buyBytes: [0, Validators.required],
            buyEos: [0],
            accountBuy: ['to this account', Validators.required],
            anotherAcc: ['']
        });

        this.delegateForm = this.fb.group({
            netEos: [0, Validators.min(0)],
            cpuEos: [0, Validators.min(0)],
            receiverAcc: ['', Validators.required]
        });

        this.ramMarketFormSell = this.fb.group({
            sellEos: [0],
            sellBytes: [0, Validators.required]
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

        this.passRefundForm = this.fb.group({
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
                right: '47',
            },
            tooltip: {
                trigger: 'axis',
                position: function (pt) {
                    return [pt[0], '20%'];
                },
                formatter: function (params) {
                    params = params[0];
                    return moment(params.name)
                        .format('HH:mm[\n]DD/MM/YYYY') + ' : ' + params.value.toFixed(6);
                },
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: [],
                axisLine: {
                    lineStyle: {
                        color: '#B7B7B7', // cor da linha x
                    },
                },
                axisLabel: {
                    textStyle: {
                        color: '#B7B7B7', // cor do texto da linha x
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
                        color: '#B7B7B7', // cor da linha y
                    },
                },
                axisLabel: {
                    textStyle: {
                        color: '#B7B7B7', // cor do texto da linha y
                    },
                },
                splitLine: {
                    lineStyle: {
                        color: '#3c3a3a', // cor das linhas no meio
                    }
                },
                scale: true
            },
            dataZoom: [{
                show: true,
                realtime: true,
                start: 60,
                end: 100,
                handleIcon: _handleIcon,
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
                'labelFormatter': function (params, out) {
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

    ngOnInit() {
        this.loadHistory();
        this.ramService.reload();
        this.aService.selected.asObservable().subscribe((selected: any) => {
            if (selected.details) {
                this.ramPriceEOS = this.ramService.ramPriceEOS;
                const d = selected.details;
                this.ram_quota = d.ram_quota;
                this.ram_usage = d.ram_usage;
                this.cpu_limit = d.cpu_limit;
                this.net_limit = d.net_limit;
                if (!selected.activitypastday) {
                    this.cpu_limit['used'] = 0;
                    this.net_limit['used'] = 0;
                }
                this.cpu_weight = d.total_resources.cpu_weight;
                this.cpu_weight_n = parseFloat(this.cpu_weight.split(' ')[0]);
                this.net_weight = d.total_resources.net_weight;
                this.net_weight_n = parseFloat(this.net_weight.split(' ')[0]);
                this.listbw(selected.name);
            }
        });

    }

    ngOnDestroy(): void {
        this.isDestroyed = true;
        this.subscriptions.forEach(s => {
            s.unsubscribe();
        });
    }

    ngAfterViewInit(): void {
        const sub = this.aService.selected
            .asObservable()
            .subscribe((selected: any) => {
                this.onAccountChanged(selected).catch(console.log);
            });
        this.subscriptions.push(sub);
    }

    async onAccountChanged(selected: EOSAccount) {
        this.totalStaked = 0;
        this.votedDecay = 0;
        this.votedEOSDecay = 0;
        this.isDestroyed = false;
        // if (selected && selected['name'] && this.selectedAccountName !== selected['name']) {
        if (selected && selected['name'] ) {
            this.precision = '1.0-' + this.aService.activeChain['precision'];

            this.fromAccount = selected.name;
            this.selectedAccountName = selected.name;
            this.totalBalance = selected.full_balance;
            this.stakedBalance = selected.staked;
            this.unstaking = selected.unstaking;
            this.unstakeTime = moment.utc(selected.unstakeTime).add(72, 'hours').fromNow();

            if (this.totalBalance > 0) {
                this.minToStake = 0;
                // this.minToStake = 100 / this.totalBalance;
                this.valuetoStake = this.stakedBalance.toString();
            } else {
                this.minToStake = 0;
                this.valuetoStake = '0';
                this.percenttoStake = '0';
            }
            this.cpu_weight = selected.details.total_resources.cpu_weight;
            this.net_weight = selected.details.total_resources.net_weight;
            if (selected.details.self_delegated_bandwidth) {
                this.cpu_self = selected.details.self_delegated_bandwidth.cpu_weight.split(' ')[0];
                this.net_self = selected.details.self_delegated_bandwidth.net_weight.split(' ')[0];
            } else {
                this.cpu_self = '';
                this.net_self = '';
            }

            console.log(selected);
            this.updateStakePercent();

            if (!this.aService.activeChain['name'].startsWith('LIBERLAND')) {
                await this.updateRatio(selected);

                if (selected.details.voter_info) {
                    let weeks = 52;
                    let block_timestamp_epoch = 946684800;
                    let precision = Math.pow(10, this.aService.activeChain['precision']);
                    if (this.aService.activeChain['symbol'] === 'WAX') {
                        weeks = 13;
                        block_timestamp_epoch = 946684800;
                    }
                    this.hasVote = (selected.details.voter_info.producers.length > 0 || selected.details.voter_info.proxy !== '');
                    this.totalStaked = (selected.details.voter_info.staked / precision);
                    const a = (moment().unix() - block_timestamp_epoch);
                    const b = parseInt('' + (a / 604800), 10) / weeks;
                    const decayEOS = (selected.details.voter_info.last_vote_weight / Math.pow(2, b) / precision);
                    this.votedEOSDecay = this.totalStaked - decayEOS;
                    if (selected.details.voter_info.last_vote_weight > 0) {
                        this.votedDecay = 100 - Math.round(((decayEOS * 100) / this.totalStaked) * 1000) / 1000;
                    }
                }
            } else {
                this.hasVote = false;
            }

            this.getRexBalance(selected.name);

            if (!this.isDestroyed) {
                this.cdr.detectChanges();
            }
            console.log(this.minToStake);
        }
    }

    updateStakePercent() {
        this.stakedisabled = false;
        if (this.totalBalance > 0) {
            this.percenttoStake = ((parseFloat(this.valuetoStake) * 100) /
                this.totalBalance).toString();
        }
    }

    getRexBalance(acc) {
        if (this.aService.activeChain.features['rex']) {
            this.eosjs.getRexData(acc).then(async (rexdata) => {
                // console.log(rexdata);
                // console.log(!rexdata.rexbal);
                let amount = 0;
                if (rexdata.rexbal !== undefined) {
                    const balance = rexdata.rexbal.rex_balance.split(' ');
                    amount = parseFloat(balance[0]);
                }
                this.hasRex = amount > 0;
            });
        } else {
            this.hasRex = false;
        }
    }

    updateStakeValue() {
        this.stakedisabled = false;
        this.minstake = false;
        this.valuetoStake = (this.totalBalance *
            (parseFloat(this.percenttoStake) / 100)).toString();
        if (this.valuetoStake === '1') {
            this.minstake = true;
        }
    }

    checkPercent() {
        this.minstake = false;
        let min = 0;
        // if (this.totalBalance > 0) {
        //     min = 100 / this.totalBalance;
        // } else {
        //      min = 0;
        // }
        if (parseFloat(this.percenttoStake) <= min) {
            this.percenttoStake = min.toString();
            this.updateStakeValue();
            this.minstake = true;
        }
        if (parseFloat(this.percenttoStake) > 100) {
            this.percenttoStake = '100';
            this.updateStakeValue();
        }
    }

    checkValue() {

        this.minstake = parseFloat(this.valuetoStake) <= 1;
        if (parseFloat(this.valuetoStake) > this.totalBalance) {
            this.valuetoStake = this.totalBalance.toString();
            this.updateStakePercent();
        }
    }

    checkValueManually(op) {
        this.minstake = false;
        const sum = parseFloat(this.cpu_self) + parseFloat(this.net_self);
        if (sum <= 1) {
            this.minstake = true;
        }
        if (this.isManually) {
            if (sum > this.totalBalance) {
                if (op === 'cpu') {
                    this.cpu_self = `${this.totalBalance - parseFloat(this.net_self)}`;
                } else {
                    this.net_self = `${this.totalBalance - parseFloat(this.cpu_self)}`;
                }
            }
        }
    }

    sliderLabel(value: number): string {
        const val = parseInt(value.toString(), 10);
        return val.toString();
    }

    callUpdateRatio(){
        const selected = this.aService.selected.getValue();
        // console.log(this.stakingRatio);
        this.updateRatio(selected).catch(console.log);
    }

   async updateRatio(selected) {
        this.cpu_weight = selected.details.total_resources.cpu_weight;
        this.net_weight = selected.details.total_resources.net_weight;
        const _cpu = RexComponent.asset2Float(selected.details.total_resources.cpu_weight);
        const _net = RexComponent.asset2Float(selected.details.total_resources.net_weight);
        this.cpu_weight_n = _cpu;
        this.net_weight_n = _net;

        const symbol = this.aService.activeChain['symbol'];
        const _cpuSelf = RexComponent.asset2Float(selected.details.self_delegated_bandwidth === null? '0.0000 ' + symbol: selected.details.self_delegated_bandwidth.cpu_weight);
        const _netSelf = RexComponent.asset2Float(selected.details.self_delegated_bandwidth === null? '0.0000 ' + symbol: selected.details.self_delegated_bandwidth.net_weight);
        this.stakingRatio = (_cpuSelf === 0 && _netSelf === 0) ? 75 : (_cpuSelf / (_cpuSelf + _netSelf)) * 100;
        this.cdr.detectChanges();
        // console.log(_cpuSelf,_netSelf,this.stakingRatio);
    }

    async setStake() {
        this.stakerr = '';
        const precisionVal = this.aService.activeChain['precision'];
        const symbol = this.aService.activeChain['symbol'];
        const precision = Math.pow(10, this.aService.activeChain['precision']);
        const selected = this.aService.selected.getValue();
        let prevStake = Math.round(this.aService.selected.getValue().staked * precision);

        let nextStakeFloat = parseFloat(this.valuetoStake);
        // console.log(nextStakeFloat);

        if (this.isManually) {
            const nextStakeCPUFloat = parseFloat(this.cpu_self === '' ? '0' : this.cpu_self);
            const nextStakeNETFloat = parseFloat(this.net_self === '' ? '0' : this.net_self);

            // console.log(selected.details.self_delegated_bandwidth);
            const cpuWeightSTR = selected.details.self_delegated_bandwidth===null ? '0.0000 ' + symbol : selected.details.self_delegated_bandwidth.cpu_weight;
            const netWeightSTR = selected.details.self_delegated_bandwidth===null ? '0.0000 ' + symbol : selected.details.self_delegated_bandwidth.net_weight;

            const cpu_self = RexComponent.asset2Float(cpuWeightSTR);
            const net_self = RexComponent.asset2Float(netWeightSTR);

            nextStakeFloat = nextStakeCPUFloat + nextStakeNETFloat;
            prevStake = Math.round((cpu_self + net_self) * precision);

            this.valuetoStake = `${nextStakeFloat}`;
            this.cpu_amount_m =  nextStakeCPUFloat * precision;
            this.net_amount_m =  nextStakeNETFloat * precision;
        }
        await this.updateRatio(selected);
        const nextStakeInt = Math.round(nextStakeFloat * precision);

        const diff = nextStakeInt - prevStake;

        this.stakingDiff = diff;
        this.stakingHRV = (Math.abs(this.stakingDiff) / precision).toFixed(precisionVal) + ' ' + this.aService.activeChain['symbol'];
        this.wrongpass = '';

        if (diff !== 0) {
            this.newSetStake().catch(console.log);
        } else {
            this.stakerr = 'Value has not changed';
        }

    }

    async newSetStake() {
        this.busy = true;
        this.wrongpass = '';
        const account = this.aService.selected.getValue();
        const tk_name = this.aService.activeChain['symbol'];
        const precision = this.aService.activeChain['precision'];
        this.wrongpass = '';

        // Transaction Signature
        const [auth, publicKey] = this.trxFactory.getAuth();

        this.mode = this.crypto.getPrivateKeyMode(publicKey);

        let actionTitle = ``;
        let html = ``;
        let action = '';
        if (this.stakingDiff > 0) {
            action = 'stake';
            html = `<h5 class="mt-0">After staking, this tokens will be locked for at least 3 days.</h5>`;
            actionTitle = `Stake <span class="blue">+${this.stakingHRV}</span> ?`;
        } else if (this.stakingDiff < 0) {
            action = 'unstake';
            html = `<h5 class="mt-0">Your tokens will be free for transfers after 3 days.</h5>`;
            actionTitle = `Unstake <span class="blue">${this.stakingHRV}</span> ?`;
        }

        const messageHTML = `<h4 class="text-white">Total staked will be: <span class="blue">${parseFloat(this.valuetoStake).toFixed(precision)}</span></h4>
            ${html}`;

        // const [, permission] = this.aService.getStoredKey(account);

        let trx = {} as TrxPayload;
        if (this.aService.activeChain['name'].indexOf('LIBERLAND') === -1) {
            try {
                const actions = await (this.isManually ? this.eosjs.changebwManually(
                    account.name,
                    auth.permission,
                    this.cpu_amount_m,
                    this.net_amount_m,
                    tk_name,
                    precision,
                ) : this.eosjs.changebw(
                    account.name,
                    auth.permission,
                    this.stakingDiff,
                    tk_name,
                    this.stakingRatio / 100,
                    precision
                ));

                trx = {actions: actions};
            } catch (e) {
                console.log(e);
            }
        } else {
            trx = {
                actions: [{
                    account: 'eosio',
                    name: action,
                    authorization: [auth],
                    data: {
                        'acnt': account.name,
                        'quantity': this.stakingHRV,
                    }
                }]
            };
        }

        await this.resource.checkResource(auth, trx.actions);
        const resourceActions = await this.resource.getActions(auth);

        this.trxFactory.modalData.next({
            transactionPayload: trx,
            resourceTransactionPayload: {
                actions: resourceActions
            },
            resourceInfo: this.resource.resourceInfo,
            addActions: this.resource.resourceInfo.needResources,
            signerAccount: auth.actor,
            signerPublicKey: publicKey,
            actionTitle: actionTitle,
            labelHTML: messageHTML,
            termsHeader: '',
            termsHTML: '',
        });
        this.trxFactory.launcher.emit({visibility: true, mode: this.mode});
        const subs = this.trxFactory.status.subscribe(async (event) => {
            // console.log(event);
            try{
                const jsonStatus = JSON.parse(event);
                if(jsonStatus.error.code === 3080004){
                    const valueSTR = jsonStatus.error.details[0].message.split('us)');
                    const cpu = parseInt(valueSTR[0].replace(/[^0-9.]+/g, ""));
                    await this.resource.checkResource(auth, trx.actions, cpu);
                }

                if(jsonStatus.error.code === 3080002){
                    const valueSTR = jsonStatus.error.details[0].message.split('>');
                    const net = parseInt(valueSTR[0].replace(/[^0-9.]+/g, ""));
                    await this.resource.checkResource(auth, trx.actions, undefined,net);
                }


            }catch (e) {
                if (event === 'done') {
                    // console.log(event);
                    await this.aService.refreshFromChain(false );
                     setTimeout(async () => {
                            await this.onAccountChanged(this.aService.selected.getValue());

                            // this.cpu_weight = this.aService.selected.getValue().details.total_resources.cpu_weight;
                            // this.net_weight = this.aService.selected.getValue().details.total_resources.net_weight;
                            // const _cpu = RexComponent.asset2Float(this.cpu_weight);
                            // const _net = RexComponent.asset2Float(this.net_weight);
                            // this.cpu_weight_n = _cpu;
                            // this.net_weight_n = _net;
                            //
                            // const symbol = this.aService.activeChain['symbol'];
                            // const precision = this.aService.activeChain['precision'];
                            // const cpuWeightSTR = this.aService.selected.getValue().details.self_delegated_bandwidth===null ? '0.0000 ' + symbol : this.aService.selected.getValue().details.self_delegated_bandwidth.cpu_weight;
                            // const netWeightSTR = this.aService.selected.getValue().details.self_delegated_bandwidth===null ? '0.0000 ' + symbol : this.aService.selected.getValue().details.self_delegated_bandwidth.net_weight;
                            //
                            // this.cpu_self = parseFloat(cpuWeightSTR.split(' ')[0]).toPrecision(precision);
                            // this.net_self = parseFloat(netWeightSTR.split(' ')[0]).toPrecision(precision);
                            // this.cdr.detectChanges();
                    }, 2000);
                    subs.unsubscribe();
                }
                if (event === 'modal_closed') {
                    subs.unsubscribe();
                }
            }

        });
    }

    listbw(account_name) {
        this.eosjs.listDelegations(account_name).then((results) => {
            if (results.rows.length > 0) {
                this.delegations = [];
                this.delegated_net = 0;
                this.delegated_cpu = 0;
                results.rows.forEach((entry) => {
                    if (entry.from !== entry.to) {
                        entry.net_weight = entry.net_weight.split(' ')[0];
                        entry.cpu_weight = entry.cpu_weight.split(' ')[0];
                        this.delegated_net += parseFloat(entry.net_weight);
                        this.delegated_cpu += parseFloat(entry.cpu_weight);
                        this.delegations.push(entry);
                    }
                });
            } else {
                this.delegations = [];
                this.delegated_net = 0;
                this.delegated_cpu = 0;
            }
        });
    }

    convertToBytes() {
        if (this.ramPriceEOS > 0) {
            this.ramMarketFormBuy.patchValue({
                buyBytes: (this.ramMarketFormBuy.get('buyEos').value / this.ramPriceEOS)
            });
            this.feeBuy = this.feeCalculator(this.ramMarketFormBuy.get('buyEos').value);
        }
    }

    convertToEos() {
        if (this.ramPriceEOS > 0) {
            this.ramMarketFormBuy.patchValue({
                buyEos: (this.ramMarketFormBuy.get('buyBytes').value * this.ramPriceEOS)
            });
            this.feeBuy = this.feeCalculator(this.ramMarketFormBuy.get('buyEos').value);
        }
    }

    convertToEosSELL() {
        if (this.ramPriceEOS > 0) {
            this.ramMarketFormSell.patchValue({
                sellEos: (this.ramMarketFormSell.get('sellBytes').value * this.ramPriceEOS)
            });
            this.feeSell = this.feeCalculator(this.ramMarketFormSell.get('sellEos').value);
        }

    }

    convertToBytesSELL() {
        if (this.ramPriceEOS > 0) {
            this.ramMarketFormSell.patchValue({
                sellBytes: (this.ramMarketFormSell.get('sellEos').value / this.ramPriceEOS)
            });
            this.feeSell = this.feeCalculator(this.ramMarketFormSell.get('sellEos').value);
        }
    }

    bytesFilter(bytes: number) {
        const units = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB'];
        const number = Math.floor(Math.log(bytes) / Math.log(1024));
        if (number > 0) {
            return (bytes / Math.pow(1024, Math.floor(number))).toFixed(4) + ' ' + units[number];
        } else {
            return bytes + ' ' + units[number];
        }
    }

    feeCalculator(eosprice: number) {
        return eosprice * .005;
    }

    updateChart() {
        this.ram_chartMerge = {
            xAxis: {
                data: this.dataDT
            },
            series: {
                data: this.dataVAL
            }
        };
    }

    loadHistory() {
        let i = 0;
        try {
            this.http.get('https://hapi.eosrio.io/ram/history1D').subscribe((data: any[]) => {
                data.reverse();
                data.forEach((val) => {
                    this.dataDT.push(val.time);
                    this.dataVAL.push(val.price);
                    i++;
                });
                this.updateChart();
                let j = 0;
                this.ramService.ramTicker.asObservable().subscribe((ramdata) => {
                    if (ramdata) {
                        if (ramdata.price) {
                            const dt = new Date(ramdata.time);
                            this.ramPriceEOS = ramdata.price;
                            this.dataDT.push(dt.toISOString());
                            this.dataVAL.push(ramdata.price);
                            this.updateChart();
                            j++;
                        }
                    }
                });
            });
        } catch (e) {
            console.log('Failed to get RAM information', e);
        }

    }

    checkAccountName() {
        if (this.ramMarketFormBuy.value.anotherAcc !== '') {
            try {
                this.eosjs.checkAccountName(this.ramMarketFormBuy.value.anotherAcc.toLowerCase());
                this.ramMarketFormBuy.controls['anotherAcc'].setErrors(null);
                this.errormsg = '';
                this.eosjs.getAccountInfo(this.ramMarketFormBuy.value.anotherAcc.toLowerCase()).then(() => {
                    this.ramMarketFormBuy.controls['anotherAcc'].setErrors(null);
                    this.errormsg = '';
                }).catch(() => {
                    this.ramMarketFormBuy.controls['anotherAcc'].setErrors({'incorrect': true});
                    this.errormsg = 'account does not exist';
                });
            } catch (e) {
                this.ramMarketFormBuy.controls['anotherAcc'].setErrors({'incorrect': true});
                this.errormsg = e.message;
            }
        } else {
            this.errormsg = '';
        }
    }

    checkAccName() {
        if (this.delegateForm.value.receiverAcc !== '') {
            try {
                this.eosjs.checkAccountName(this.delegateForm.value.receiverAcc.toLowerCase());
                this.delegateForm.controls['receiverAcc'].setErrors(null);
                this.errormsgD = '';
                this.eosjs.getAccountInfo(this.delegateForm.value.receiverAcc.toLowerCase()).then(() => {
                    this.delegateForm.controls['receiverAcc'].setErrors(null);
                    this.errormsgD = '';

                }).catch(() => {
                    this.delegateForm.controls['receiverAcc'].setErrors({'incorrect': true});
                    this.errormsgD = 'account does not exist';
                });
            } catch (e) {
                this.delegateForm.controls['receiverAcc'].setErrors({'incorrect': true});
                this.errormsgD = e.message;
            }
        } else {
            this.errormsg = '';
        }
    }

    checkBuyBytes() {
        if (this.ramMarketFormBuy.value.buyBytes > 0) {
            this.aService.selected.asObservable().subscribe((sel: EOSAccount) => {
                if (sel) {
                    this.unstaked = sel.full_balance - sel.staked - sel.unstaking;
                    // this.unstakeTime = moment.utc(sel.unstakeTime).add(72, 'hours').fromNow();
                }
            });
            if (this.unstaked > this.ramMarketFormBuy.get('buyEos').value) {
                this.ramMarketFormBuy.controls['buyBytes'].setErrors(null);
                this.ramMarketFormBuy.controls['buyEos'].setErrors(null);
                this.errormsg2 = '';
                return true;
            } else {
                this.ramMarketFormBuy.controls['buyEos'].setErrors({'incorrect': true});
                this.errormsg2 = 'not enough unstaked ' + this.aService.activeChain['symbol'] + '!';
                return false;
            }
        } else {
            this.ramMarketFormBuy.controls['buyBytes'].setErrors({'incorrect': true});
            this.errormsg2 = 'must fill RAM amount or price';
            return false;
        }
    }

    checkSellBytes() {
        if (this.ramMarketFormSell.value.sellBytes > 0) {
            if ((this.ram_quota - this.ram_usage) > (this.ramMarketFormSell.get('sellBytes').value) * 1024) {
                this.ramMarketFormSell.controls['sellBytes'].setErrors(null);
                this.ramMarketFormSell.controls['sellEos'].setErrors(null);
                this.errormsgeos = '';
                return true;
            } else {
                this.ramMarketFormSell.controls['sellEos'].setErrors({'incorrect': true});
                this.errormsgeos = 'not enough RAM!';
                return false;
            }
        } else {
            this.ramMarketFormSell.controls['sellBytes'].setErrors({'incorrect': true});
            this.errormsgeos = 'must fill RAM amount or price';
            return false;
        }
    }

    fillSell() {
        if (this.checkSellBytes()) {
            this.seller = this.aService.selected.getValue().name;
            this.bytessell = Math.floor(this.ramMarketFormSell.get('sellBytes').value * 1024);
            this.newSell().catch(console.log);
        }
    }

    async newSell() {
        let termsHeader = ``;
        let termsHtml = ``;

        // Transaction Signature
        const [auth, publicKey] = this.trxFactory.getAuth();


        const actionTitle = `<span class="blue">Password</span>`;
        const messageHTML = `<h3 class="modal-title text-white"><span class="blue">${this.seller}</span> sell <span
            class="blue">${this.bytesFilter(this.bytessell)} </span></h3>
        <h5>
            <span class="modal-title" style="color:#bdbdbd; font-size: 15px;">* 1KB = 1024 bytes </span>
            <span style="color:#bdbdbd;">RAM fee ${this.feeSell.toFixed(6)} ${this.aService.activeChain['symbol']} </span>
        </h5>
        `;
        if (this.aService.activeChain.name === 'EOS MAINNET') {
            termsHeader = 'By submiting this transaction, you agree to the sellram Terms & Conditions';
            termsHtml = `The sellram action sells unused RAM for tokens.
                <br><br>
                As an authorized party I <span class="blue">${this.seller}</span> wish to sell <span class="blue">${this.bytessell}</span> bytes of unused RAM from
                account <span class="blue">${this.seller}</span>.`;

        }

        let actionsModal= [{
            account: 'eosio',
            name: 'sellram',
            authorization: [auth],
            data: {
                'account': this.seller,
                'bytes': this.bytessell
            }
        }];

        this.mode = this.crypto.getPrivateKeyMode(publicKey);

        const resultResource = await this.resource.checkResource(auth, actionsModal);
        const resourceActions = await this.resource.getActions(auth);

        await this._execTrxFactoryNext(actionsModal,resourceActions,resultResource['needResources'],auth.actor,publicKey,actionTitle,messageHTML,termsHeader,termsHtml,resultResource);
    }

    fillBuy() {
        if (this.checkBuyBytes()) {
            // this.passBuyModal = true;
            // this.wrongpassbuy = '';
            this.receiver = this.aService.selected.getValue().name;
            this.payer = this.aService.selected.getValue().name;
            this.bytesbuy = Math.floor(this.ramMarketFormBuy.get('buyBytes').value * 1024);
            const accountBuy = this.ramMarketFormBuy.get('accountBuy').value;
            if (accountBuy === 'to another account') {
                this.receiver = this.ramMarketFormBuy.get('anotherAcc').value;
            }
            this.newBuy().catch(console.log);
        }
    }

    async newBuy() {
        const bytesAmount = Math.floor(this.ramMarketFormBuy.value.buyBytes * 1024);
        let termsHeader = ``;
        let termsHtml = ``;

        // Transaction Signature
        const [auth, publicKey] = this.trxFactory.getAuth();

        const actionTitle = `<span class="blue">Password</span>`;
        const messageHTML = ` <h3 class="modal-title text-white"><span class="blue">${this.payer}</span> buy <span
            class="blue">${this.bytesFilter(bytesAmount)} </span> to ${this.receiver}
        </h3>
        <h5>
            <span class="modal-title" style="color:#bdbdbd; font-size: 15px;">* 1KB = 1024 bytes </span>
            <span style="color:#bdbdbd;">RAM fee ${this.feeBuy.toFixed(6)} ${this.aService.activeChain['symbol']} </span>
        </h5>
        `;

        // Mainnet terms
        if (this.aService.activeChain.name === 'EOS MAINNET') {
            termsHeader = 'By submiting this transaction, you agree to the buyrambytes Terms & Conditions';
            termsHtml = `This action will attempt to reserve about <span class="blue">${this.bytesbuy}</span> bytes of RAM on behalf of <span class="blue">${this.receiver}</span>.
                <br><br>
                <span class="blue">${this.payer}</span> authorizes this contract to transfer sufficient EOS tokens to buy the RAM based upon the
                current
                price as determined by the market maker algorithm.
                <br><br>
                {{payer}} accepts that a 0.5% fee will be charged on the amount spent and that the actual RAM received
                may be
                slightly less than expected due to the approximations necessary to enable this service. <span class="blue">${this.payer}</span>
                accepts that
                a 0.5% fee will be charged if and when they sell the RAM received. <span class="blue">${this.payer}</span> accepts that rounding
                errors
                resulting from limits of computational precision may result in less RAM being allocated. <span class="blue">${this.payer}</span>
                acknowledges
                that the supply of RAM may be increased at any time up to the limits of off-the-shelf computer equipment
                and
                that this may result in RAM selling for less than purchase price. <span class="blue">${this.payer}</span> acknowledges that the price
                of RAM
                may increase or decrease over time according to supply and demand. <span class="blue">${this.payer}</span> acknowledges that RAM is
                non-transferrable. <span class="blue">${this.payer}</span> acknowledges RAM currently in use by their account cannot be sold until it
                is
                freed and that freeing RAM may be subject to terms of other contracts.`;
        }


        this.mode = this.crypto.getPrivateKeyMode(publicKey);
        let actionsModal= [{
            account: 'eosio',
            name: 'buyrambytes',
            authorization: [auth],
            data: {
                'payer': this.payer,
                'receiver': this.receiver,
                'bytes': this.bytesbuy
            }
        }];

        const resultResource = await this.resource.checkResource(auth, actionsModal);
        const resourceActions = await this.resource.getActions(auth);

        await this._execTrxFactoryNext(actionsModal,resourceActions,resultResource['needResources'],auth.actor,publicKey,actionTitle,messageHTML,termsHeader,termsHtml,resultResource);
    }

    async newRefund() {
        const namesel = this.aService.selected.getValue().name;
        let termsHeader = ``;
        let termsHtml = ``;

        // Transaction Signature
        const [auth, publicKey] = this.trxFactory.getAuth();

        const actionTitle = `<span class="blue">Password</span>`;
        const messageHTML = `<h3 class="modal-title text-white">Request Refund to <span class="blue">${this.aService.selected.getValue().name}</span></h3>`;

        if (this.aService.activeChain.name === 'EOS MAINNET') {
            termsHeader = 'By submiting this transaction, you agree to the refund Terms & Conditions';
            termsHtml = ` The intent of the <span class="blue">refund</span> action is to return previously
                unstaked tokens to an account after the unstaking period has elapsed.
                <br><br>As an authorized party I <span class="blue">${this.aService.selected.getValue().name}</span> wish to
                have the unstaked tokens of <span class="blue">${this.aService.selected.getValue().name}</span> returned.`;
        }


        this.mode = this.crypto.getPrivateKeyMode(publicKey);
        let actionsModal = [{
            account: 'eosio',
            name: 'refund',
            authorization: [auth],
            data: {
                'owner': namesel
            }
        }];

        const resultResource = await this.resource.checkResource(auth, actionsModal);
        const resourceActions = await this.resource.getActions(auth);

        await this._execTrxFactoryNext(actionsModal,resourceActions,resultResource['needResources'],auth.actor,publicKey,actionTitle,messageHTML,termsHeader,termsHtml,resultResource);
    }

    fillUnDelegateRequest(from: string, net: string, cpu: string) {
        this.fromUD = from;
        this.netUD = net;
        this.cpuUD = cpu;
        this.accNow = this.aService.selected.getValue().name;
        this.newUnDelegateRequest().catch(console.log);
    }

    async newUnDelegateRequest() {
        let termsHeader = ``;
        let termsHtml = ``;

        // Transaction Signature
        const [auth, publicKey] = this.trxFactory.getAuth();

        const actionTitle = `<span class="blue">Password</span>`;
        const messageHTML = ` <h3 class="modal-title text-white">Are you sure you want to undelegate <span class="blue">NET</span> and <span
            class="blue"> CPU</span> from <span class="blue">${this.fromUD}</span></h3>
            <div>This resources will be removed from <span class="blue">${this.fromUD}</span> and will return to you.</div>
            <div>Please make sure the account <span class="blue">${this.fromUD}</span> has some eos staked, otherwise the account may lose all its
                resources
            </div>
            `;
        if (this.aService.activeChain.name === 'EOS MAINNET') {
            termsHeader = 'By submiting this transaction, you agree to the undelegatebw  Terms & Conditions';
            termsHtml = ` The intent of the undelegatebw action is to unstake tokens from CPU and/or bandwidth.
                <br><br>
                As an authorized party I <span class="blue">${this.accNow}</span> wish to unstake <span class="blue">${this.cpuUD}</span> EOS from CPU and
                <span class="blue">${this.netUD}</span> EOS from bandwidth from the tokens owned by <span class="blue">${this.accNow}</span> previously delegated for
                the use of delegatee <span class="blue">${this.fromUD}</span>.
                <br><br>
                If I as signer am not the beneficial owner of these tokens I stipulate I have proof that I’ve been
                authorized to take this action by their beneficial owner(s).`;
        }

        this.mode = this.crypto.getPrivateKeyMode(publicKey);
        let actionsModal = [{
            account: 'eosio',
            name: 'undelegatebw',
            authorization: [auth],
            data: {
                'from': this.accNow,
                'receiver': this.fromUD,
                'unstake_cpu_quantity': this.cpuUD + ' ' + this.aService.activeChain['symbol'],
                'unstake_net_quantity': this.netUD + ' ' + this.aService.activeChain['symbol']

            }
        }];

        const resultResource = await this.resource.checkResource(auth, actionsModal);
        const resourceActions = await this.resource.getActions(auth);

        await this._execTrxFactoryNext(actionsModal,resourceActions,resultResource['needResources'],auth.actor,publicKey,actionTitle,messageHTML,termsHeader,termsHtml,resultResource);
    }

    checkEos(eosVal, val) {
        if (eosVal > 0) {
            const sel = this.aService.selected.getValue();
            if (sel) {
                if (val === 'net') {
                    this.unstaked = sel.full_balance - sel.staked - sel.unstaking - this.delegateForm.get('cpuEos').value;
                } else {
                    this.unstaked = sel.full_balance - sel.staked - sel.unstaking - this.delegateForm.get('netEos').value;
                }
            }
            if (this.unstaked > eosVal) {
                this.errormsgD3 = '';
                return true;
            } else {
                this.errormsgD3 = 'not enough unstaked ' + this.aService.activeChain['symbol'] + '!';
                return false;
            }
        } else {
            this.errormsgD3 = 'must fill NET and CPU amount';
            return false;
        }
    }

    fillDelegateRequest() {
        this.accTo = this.delegateForm.get('receiverAcc').value;
        this.netD = parseFloat(this.delegateForm.get('netEos').value).toFixed(this.aService.activeChain['precision']);
        this.cpuD = parseFloat(this.delegateForm.get('cpuEos').value).toFixed(this.aService.activeChain['precision']);
        this.accNow = this.aService.selected.getValue().name;
        this.newDelegateRequest().catch(console.log);

    }

    async newDelegateRequest() {
        let termsHeader = ``;
        let termsHtml = ``;

        // Transaction Signature
        const [auth, publicKey] = this.trxFactory.getAuth();

        const actionTitle = `<span class="blue">Password</span>`
        const messageHTML = ` <h3 class="modal-title text-white">Are you sure you want to delegate <span class="blue">NET</span> and <span
            class="blue"> CPU</span> to <span class="blue">${this.accTo}</span></h3> `;
        if (this.aService.activeChain.name === 'EOS MAINNET') {
            termsHeader = 'By submiting this transaction, you agree to the delegatebw Terms & Conditions';
            termsHtml = ` The intent of the delegatebw action is to stake tokens for bandwidth and/or CPU and optionally transfer
                ownership.
                <br><br>
                As an authorized party I <span class="blue">${this.accNow}</span> wish to stake <span class="blue">${this.cpuD}</span> EOS for CPU and <span class="blue">${this.netD}</span> EOS for
                bandwidth from the liquid tokens of <span class="blue">${this.accNow}</span> for the use of delegatee <span class="blue">${this.accTo}</span>.
                <br><br>
                As signer I stipulate that, if I am not the beneficial owner of these tokens, I have proof that I’ve
                been authorized to
                take this action by their beneficial owner(s).`;
        }
        this.mode = this.crypto.getPrivateKeyMode(publicKey);
        let actionsModal= [{
            account: 'eosio',
            name: 'delegatebw',
            authorization: [auth],
            data: {
                'from': this.accNow,
                'receiver': this.accTo,
                'stake_cpu_quantity': this.cpuD + ' ' + this.aService.activeChain['symbol'],
                'stake_net_quantity': this.netD + ' ' + this.aService.activeChain['symbol'],
                'transfer': 0
            }
        }];

        const resultResource = await this.resource.checkResource(auth, actionsModal);
        const resourceActions = await this.resource.getActions(auth);

        await this._execTrxFactoryNext(actionsModal,resourceActions,resultResource['needResources'],auth.actor,publicKey,actionTitle,messageHTML,termsHeader,termsHtml,resultResource);
    }

    async _execTrxFactoryNext(actionsModal,resourceActions,needResources,actor,publicKey,actionTitle,messageHTML,termsHeader, termsHtml, resultResource?){
        this.trxFactory.modalData.next({
            transactionPayload: {
                actions: actionsModal
            },
            resourceTransactionPayload: {
                actions: resourceActions
            },
            resourceInfo: resultResource,
            addActions: needResources,
            signerAccount: actor,
            signerPublicKey: publicKey,
            actionTitle: actionTitle,
            labelHTML: messageHTML,
            termsHeader: termsHeader,
            termsHTML: termsHtml,
        });

        this.trxFactory.launcher.emit({visibility: true, mode: this.mode});
        const subs = this.trxFactory.status.subscribe(async (event) => {
            // console.log(event);
            try{
                const jsonStatus = JSON.parse(event);
                if(jsonStatus.error.code === 3080004){
                    const valueSTR = jsonStatus.error.details[0].message.split('us)');
                    const cpu = parseInt(valueSTR[0].replace(/[^0-9.]+/g, ""));
                    await this.resource.checkResource(actor, actionsModal, cpu);
                }

                if(jsonStatus.error.code === 3080002){
                    const valueSTR = jsonStatus.error.details[0].message.split('>');
                    const net = parseInt(valueSTR[0].replace(/[^0-9.]+/g, ""));
                    await this.resource.checkResource(actor, actionsModal, undefined,net);
                }

            }catch (e) {
                if (event === 'done') {
                    try {
                        await this.aService.refreshFromChain(false);
                    } catch (e) {
                        console.error(e);
                    }
                    subs.unsubscribe();
                }
                if (event === 'modal_closed') {
                    subs.unsubscribe();
                }

            }
        });

    }
}
