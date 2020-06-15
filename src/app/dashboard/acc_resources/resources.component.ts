import {Component, OnInit} from '@angular/core';
import {ToasterConfig, ToasterService} from 'angular2-toaster';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {EOSAccount} from '../../interfaces/account';
import {createNumberMask} from 'text-mask-addons/dist/textMaskAddons';

import {AccountsService} from '../../services/accounts.service';
import {CryptoService} from '../../services/crypto/crypto.service';
import {RamService} from '../../services/ram.service';

import * as moment from 'moment';
import {TransactionFactoryService} from '../../services/eosio/transaction-factory.service';
import {Eosjs2Service} from '../../services/eosio/eosjs2.service';

const _handleIcon = 'M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,' +
    '4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,' +
    '8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,' +
    '24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z';

@Component({
    selector: 'app-ram-market',
    templateUrl: './resources.component.html',
    styleUrls: ['./resources.component.css']
})
export class ResourcesComponent implements OnInit {

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
    cpu_limit: any;
    cpu_weight = '';
    cpu_weight_n = 0;
    net_limit: any;
    net_weight = '';
    net_weight_n = 0;

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

    constructor(
        private eosjs: Eosjs2Service,
        public aService: AccountsService,
        private crypto: CryptoService,
        private toaster: ToasterService,
        private fb: FormBuilder,
        public ramService: RamService,
        private http: HttpClient,
        private trxFactory: TransactionFactoryService,
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
            this.newSell();
        }
    }

    newSell() {
        let termsHeader = ``;
        let termsHtml = ``;
        const actionTitle = `<span class="blue">Password</span>`;
        const messageHTML = ` <h3 class="modal-title text-white"><span class="blue">${this.seller}</span> sell <span
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
        // Transaction Signature
        const [auth, publicKey] = this.trxFactory.getAuth();

        this.mode = this.crypto.getPrivateKeyMode(publicKey);
        this.trxFactory.modalData.next({
            transactionPayload: {
                actions: [{
                    account: 'eosio',
                    name: 'sellram',
                    authorization: [auth],
                    data: {
                        'account': this.seller,
                        'bytes': this.bytessell
                    }
                }]
            },
            signerAccount: auth.actor,
            signerPublicKey: publicKey,
            actionTitle: actionTitle,
            labelHTML: messageHTML,
            termsHeader: termsHeader,
            termsHTML: termsHtml
        });
        this.trxFactory.launcher.emit({visibility: true, mode: this.mode});
        const subs = this.trxFactory.status.subscribe(async (event) => {
            console.log(event);
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
        });
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
            this.newBuy();
        }
    }

    newBuy() {
        const bytesAmount = Math.floor(this.ramMarketFormBuy.value.buyBytes * 1024);
        let termsHeader = ``;
        let termsHtml = ``;
        const actionTitle = `<span class="blue">Password</span>`;
        const messageHTML = `<h3 class="modal-title text-white"><span class="blue">${this.payer}</span> buy <span
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

        // Transaction Signature
        const [auth, publicKey] = this.trxFactory.getAuth();

        this.mode = this.crypto.getPrivateKeyMode(publicKey);

        this.trxFactory.modalData.next({
            transactionPayload: {
                actions: [{
                    account: 'eosio',
                    name: 'buyrambytes',
                    authorization: [auth],
                    data: {
                        'payer': this.payer,
                        'receiver': this.receiver,
                        'bytes': this.bytesbuy
                    }
                }]
            },
            signerAccount: auth.actor,
            signerPublicKey: publicKey,
            actionTitle: actionTitle,
            labelHTML: messageHTML,
            termsHeader: termsHeader,
            termsHTML: termsHtml
        });
        this.trxFactory.launcher.emit({visibility: true, mode: this.mode});
        const subs = this.trxFactory.status.subscribe(async (event) => {
            console.log(event);
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
        });
    }

    newRefund() {
        const namesel = this.aService.selected.getValue().name;
        let termsHeader = ``;
        let termsHtml = ``;
        const actionTitle = `<span class="blue">Password</span>`;
        const messageHTML = ` <h3 class="modal-title text-white">Request Refund to <span class="blue">${this.aService.selected.getValue().name}</span></h3>`;

        if (this.aService.activeChain.name === 'EOS MAINNET') {
            termsHeader = 'By submiting this transaction, you agree to the refund Terms & Conditions';
            termsHtml = ` The intent of the <span class="blue">refund</span> action is to return previously
                unstaked tokens to an account after the unstaking period has elapsed.
                <br><br>As an authorized party I <span class="blue">${this.aService.selected.getValue().name}</span> wish to
                have the unstaked tokens of <span class="blue">${this.aService.selected.getValue().name}</span> returned.`;
        }

        // Transaction Signature
        const [auth, publicKey] = this.trxFactory.getAuth();

        this.mode = this.crypto.getPrivateKeyMode(publicKey);
        this.trxFactory.modalData.next({
            transactionPayload: {
                actions: [{
                    account: 'eosio',
                    name: 'refund',
                    authorization: [auth],
                    data: {
                        'owner': namesel
                    }
                }]
            },
            signerAccount: auth.actor,
            signerPublicKey: publicKey,
            actionTitle: actionTitle,
            labelHTML: messageHTML,
            termsHeader: termsHeader,
            termsHTML: termsHtml
        });

        this.trxFactory.launcher.emit({visibility: true, mode: this.mode});

        const subs = this.trxFactory.status.subscribe(async (event) => {
            console.log(event);
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
        });
    }

    fillUnDelegateRequest(from: string, net: string, cpu: string) {
        this.fromUD = from;
        this.netUD = net;
        this.cpuUD = cpu;
        this.accNow = this.aService.selected.getValue().name;
        this.newUnDelegateRequest();
    }

    newUnDelegateRequest() {
        let termsHeader = ``;
        let termsHtml = ``;
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
        // Transaction Signature
        const [auth, publicKey] = this.trxFactory.getAuth();

        this.mode = this.crypto.getPrivateKeyMode(publicKey);
        this.trxFactory.modalData.next({
            transactionPayload: {
                actions: [{
                    account: 'eosio',
                    name: 'undelegatebw',
                    authorization: [auth],
                    data: {
                        'from': this.accNow,
                        'receiver': this.fromUD,
                        'unstake_cpu_quantity': this.cpuUD + ' ' + this.aService.activeChain['symbol'],
                        'unstake_net_quantity': this.netUD + ' ' + this.aService.activeChain['symbol']

                    }
                }]
            },
            signerAccount: auth.actor,
            signerPublicKey: publicKey,
            actionTitle: actionTitle,
            labelHTML: messageHTML,
            termsHeader: termsHeader,
            termsHTML: termsHtml
        });
        this.trxFactory.launcher.emit({visibility: true, mode: this.mode});
        const subs = this.trxFactory.status.subscribe(async (event) => {
            console.log(event);
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
        });
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
        this.newDelegateRequest();

    }


    newDelegateRequest() {
        let termsHeader = ``;
        let termsHtml = ``;
        const actionTitle = `<span class="blue">Password</span>`;
        const messageHTML = `<h3 class="modal-title text-white">Are you sure you want to delegate <span class="blue">NET</span> and <span
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
        // Transaction Signature
        const [auth, publicKey] = this.trxFactory.getAuth();
        this.mode = this.crypto.getPrivateKeyMode(publicKey);
        this.trxFactory.modalData.next({
            transactionPayload: {
                actions: [{
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
                }]
            },
            signerAccount: auth.actor,
            signerPublicKey: publicKey,
            actionTitle: actionTitle,
            labelHTML: messageHTML,
            termsHeader: termsHeader,
            termsHTML: termsHtml
        });
        this.trxFactory.launcher.emit({
            visibility: true,
            mode: this.mode
        });
        const subs = this.trxFactory.status.subscribe(async (event) => {
            console.log(event);
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
        });
    }
}
