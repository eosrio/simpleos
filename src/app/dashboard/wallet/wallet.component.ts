import {AfterViewInit, Component, OnDestroy, OnInit} from '@angular/core';
import {AccountsService} from '../../accounts.service';
import {EOSJSService} from '../../eosjs.service';

import * as moment from 'moment';

@Component({
    selector: 'app-wallet',
    templateUrl: './wallet.component.html',
    styleUrls: ['./wallet.component.css']
})
export class WalletComponent implements OnInit, AfterViewInit, OnDestroy {
    fullBalance: number;
    staked: number;
    unstaked: number;
    moment: any;
    openTX = WalletComponent.openTXID;
    actions: any[];
    headBlock: number;
    LIB: number;
    blockTracker: any;

    static openTXID(value) {
        window.open('https://eosflare.io/tx/' + value);
    }

    constructor(public aService: AccountsService, public eos: EOSJSService) {
        this.moment = moment;
        this.actions = [];
        this.headBlock = 0;
        this.LIB = 0;
        this.blockTracker = null;
    }

    getInfo() {
        this.eos['eos']['getInfo']({}).then((info) => {
            this.headBlock = info['head_block_num'];
            this.LIB = info['last_irreversible_block_num'];
        });
    }

    ngOnInit() {
        this.aService.selected.asObservable().subscribe((sel) => {
            if (sel) {
                this.fullBalance = sel.full_balance;
                this.staked = sel.staked;
                this.unstaked = sel.full_balance - sel.staked;
            }
        });
        this.getInfo();
        if (!this.blockTracker) {
            this.blockTracker = setInterval(() => {
                this.getInfo();
            }, 5000);
        }
        this.eos['eos']['getActions']({
            account_name: this.aService.selected.getValue().name,
            offset: 200,
            pos: 0
        }).then((data) => {
            this.actions = [];
            const allowed_actions = ['transfer', 'voteproducer', 'undelegatebw', 'delegatebw'];
            data.actions.forEach((item) => {
                const act = item['action_trace']['act'];
                const id = item['action_trace']['trx_id'];
                const block_num = item['block_num'];
                const date = item['block_time'];
                const contract = act['account'];
                const action_name = act['name'];
                console.log(id, block_num, item);
                let amount = 0;
                let user = '';
                let type = '';
                let memo = '';
                let votedProducers = null;
                let proxy = null;
                let voter = null;
                let cpu = 0;
                let net = 0;

                if (contract === 'eosio.token' && action_name === 'transfer') {
                    amount = act['data']['quantity'];
                    user = act['data']['to'];
                    memo = act['data']['memo'];
                    type = 'sent';
                }

                if (contract === 'eosio' && action_name === 'voteproducer') {
                    votedProducers = act['data']['producers'];
                    proxy = act['data']['proxy'];
                    voter = act['data']['voter'];
                    type = 'vote';
                }

                if (contract === 'eosio' && action_name === 'undelegatebw') {
                    cpu = parseFloat(act['data']['unstake_cpu_quantity'].split(' ')[0]);
                    net = parseFloat(act['data']['unstake_net_quantity'].split(' ')[0]);
                    amount = cpu + net;
                    user = act['data']['from'];
                    type = 'unstaked';
                    // liquidtime = moment.utc(item['block_time']).add(72, 'hours').fromNow();
                }

                if (contract === 'eosio' && action_name === 'delegatebw') {
                    cpu = parseFloat(act['data']['stake_cpu_quantity'].split(' ')[0]);
                    net = parseFloat(act['data']['stake_net_quantity'].split(' ')[0]);
                    amount = cpu + net;
                    user = act['data']['from'];
                    type = 'staked';
                }
                if (allowed_actions.includes(action_name)) {
                    this.actions.push({
                        id: id,
                        type: type,
                        action_name: action_name,
                        contract: contract,
                        user: user,
                        block: block_num,
                        date: date,
                        amount: amount,
                        memo: memo,
                        votedProducers: votedProducers,
                        proxy: proxy,
                        voter: voter
                    });
                }
            });
            this.actions.reverse();
        });
    }

    ngOnDestroy() {
        if (this.blockTracker) {
            clearInterval(this.blockTracker);
            this.blockTracker = null;
        }
    }

    ngAfterViewInit() {
        setTimeout(() => {
            // this.aService.initFirst();
        }, 1000);
    }

}
