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
  tokens: any[];

  static openTXID(value) {
    window['shell'].openExternal('https://eosflare.io/tx/' + value);
  }

  constructor(public aService: AccountsService, public eos: EOSJSService) {
    this.moment = moment;
    this.actions = [];
    this.tokens = [];
    this.headBlock = 0;
    this.fullBalance = 0;
    this.staked = 0;
    this.unstaked = 0;
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
    this.aService.lastUpdate.asObservable().subscribe(value => {
      if (value.account === this.aService.selected.getValue().name) {
        this.updateBalances();
      }
    });
    this.getInfo();
    if (!this.blockTracker) {
      this.blockTracker = setInterval(() => {
        this.getInfo();
      }, 5000);
    }
  }

  ngOnDestroy() {
    if (this.blockTracker) {
      clearInterval(this.blockTracker);
      this.blockTracker = null;
    }
  }

  ngAfterViewInit() {
    this.aService.selected.asObservable().subscribe((sel) => {
      if (sel['name']) {
        setImmediate(() => {
          this.fullBalance = sel.full_balance;
          this.staked = sel.staked;
          this.unstaked = sel.full_balance - sel.staked;
          this.tokens = [];
          this.reloadActions(sel.name);
          this.aService.refreshFromChain();
        });
      }
    });
  }

  updateBalances() {
    const sel = this.aService.selected.getValue();
    this.fullBalance = sel.full_balance;
    this.staked = sel.staked;
    this.unstaked = sel.full_balance - sel.staked;
  }

  refresh() {
    this.reloadActions(this.aService.selected.getValue().name);
    this.aService.refreshFromChain();
  }

  registerSymbol(symbol, contract) {
    const idx = this.tokens.findIndex((val) => {
      return val.name === symbol;
    });
    if (idx === -1) {
      this.tokens.push({
        name: symbol,
        contract: contract,
        balance: ''
      });
    }
  }

  getTokenBalances() {
    this.tokens.forEach((tk, index) => {
      this.eos.eos['getCurrencyBalance'](tk.contract, this.aService.selected.getValue().name).then((tokendata) => {
        this.tokens[index].balance = tokendata[0];
      });
    });
  }

  reloadActions(account) {
    this.eos['eos']['getActions']({
      account_name: account,
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
        let amount = 0;
        let symbol = '';
        let user = '';
        let type = '';
        let memo = '';
        let votedProducers = null;
        let proxy = null;
        let voter = null;
        let cpu = 0;
        let net = 0;

        if (action_name === 'transfer') {
          if (contract === 'eosio.token') {
            // NATIVE TOKEN
            amount = act['data']['quantity']['split'](' ')[0];
            symbol = 'EOS';
          } else {
            // CUSTOM TOKEN
            amount = act['data']['quantity']['split'](' ')[0];
            symbol = act['data']['quantity']['split'](' ')[1];
            this.registerSymbol(symbol, contract);
          }
          memo = act['data']['memo'];
          if (act['data']['to'] === this.aService.selected.getValue().name) {
            user = act['data']['from'];
            type = 'received';
          } else {
            user = act['data']['to'];
            type = 'sent';
          }
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

        let valid = true;
        if (action_name === 'transfer') {
          if (act['data']['to'] === 'eosio.stake') {
            valid = false;
          }
        }

        if (allowed_actions.includes(action_name) && valid) {
          const idx = this.actions.findIndex((val) => {
            return val.id === id;
          });
          if (idx === -1) {
            this.actions.push({
              id: id,
              type: type,
              action_name: action_name,
              contract: contract,
              user: user,
              block: block_num,
              date: date,
              amount: amount,
              symbol: symbol,
              memo: memo,
              votedProducers: votedProducers,
              proxy: proxy,
              voter: voter
            });
          }
        }
      });
      this.actions.reverse();
      this.getTokenBalances();
    });
  }

}
