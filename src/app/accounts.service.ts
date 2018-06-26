import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, Subject} from 'rxjs';
import {EOSJSService} from './eosjs.service';

@Injectable({
  providedIn: 'root'
})
export class AccountsService {
  public accounts: any[];
  public selected = new BehaviorSubject<any>({});
  public selectedIdx = 0;
  public lastUpdate = new Subject<any>();
  usd_rate: number;
  cmcListings = [];
  tokens = [];
  actions = [];

  static parseEOS(tk_string) {
    if (tk_string.split(' ')[1] === 'EOS') {
      return parseFloat(tk_string.split(' ')[0]);
    } else {
      return 0;
    }
  }

  static extendAccount(acc) {
    let balance = 0;
    if (acc.tokens) {
      acc.tokens.forEach((tk) => {
        balance += AccountsService.parseEOS(tk);
      });
    }
    let net = 0;
    let cpu = 0;
    if (acc['self_delegated_bandwidth']) {
      net = AccountsService.parseEOS(acc['self_delegated_bandwidth']['net_weight']);
      cpu = AccountsService.parseEOS(acc['self_delegated_bandwidth']['cpu_weight']);
      balance += net;
      balance += cpu;
    }
    return {
      name: acc['account_name'],
      full_balance: Math.round((balance) * 10000) / 10000,
      staked: net + cpu,
      details: acc
    };
  }

  constructor(private http: HttpClient, private eos: EOSJSService) {
    this.accounts = [];
    this.usd_rate = 10.00;
    this.fetchListings();
    this.fetchEOSprice();
  }

  registerSymbol(symbol, contract) {
    const idx = this.tokens.findIndex((val) => {
      return val.name === symbol;
    });
    if (idx === -1) {
      this.tokens.push({
        name: symbol,
        contract: contract,
        balance: '',
        price: null
      });
    }
  }

  getTokenBalances() {
    this.tokens.forEach((tk, index) => {
      this.eos.eos['getCurrencyBalance'](tk.contract, this.selected.getValue().name).then((tokendata) => {
        if (this.tokens[index]) {
          this.tokens[index]['balance'] = tokendata[0];
          this.fetchTokenPrice(tk.name).then((price) => {
            this.tokens[index]['price'] = price;
          });
        }
      });
    });
  }

  reloadActions(account) {
    this.actions = [];
    this.tokens = [];
    this.eos['eos']['getActions']({
      account_name: account,
      offset: 200,
      pos: 0
    }).then((data) => {
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
          if (act['data']['to'] === this.selected.getValue().name) {
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
      this.accounts[this.selectedIdx]['tokens'] = this.tokens;
      this.accounts[this.selectedIdx]['actions'] = this.actions;
      this.getTokenBalances();
    });
  }

  select(index) {
    const sel = this.accounts[index];
    if (sel['tokens']) {
      if (sel.tokens.length > 0) {
        this.tokens = sel.tokens;
      }
    } else {
      this.tokens = [];
    }
    if (sel['actions']) {
      if (sel.actions.length > 0) {
        this.actions = sel.actions;
      }
    } else {
      this.actions = [];
    }
    this.selectedIdx = index;
    this.selected.next(sel);
    if (this.actions.length === 0 || this.tokens.length === 0) {
      this.reloadActions(this.selected.getValue().name);
    }
  }

  initFirst() {
    this.selectedIdx = 0;
    this.selected.next(this.accounts[0]);
  }

  importAccounts(accounts) {
    const chain_id = this.eos.chainID;
    const payload = {
      importedOn: new Date(),
      updatedOn: new Date(),
      accounts: accounts
    };
    localStorage.setItem('simpleos.accounts.' + chain_id, JSON.stringify(payload));
    this.loadLocalAccounts(accounts);
  }

  appendNewAccount(account) {
    const chain_id = this.eos.chainID;
    const payload = JSON.parse(localStorage.getItem('simpleos.accounts.' + chain_id));
    payload.accounts.push(account);
    payload.updatedOn = new Date();
    localStorage.setItem('simpleos.accounts.' + chain_id, JSON.stringify(payload));
    this.loadLocalAccounts(payload.accounts);
  }

  loadLocalAccounts(data) {
    if (data.length > 0) {
      this.accounts = [];
      data.forEach((acc_data) => {
        if (!acc_data.details) {
          this.accounts.push(AccountsService.extendAccount(acc_data));
        } else {
          this.accounts.push(acc_data);
        }
      });
      this.refreshFromChain();
    }
  }

  refreshFromChain(): void {
    const PQ = [];
    this.accounts.forEach((account, idx) => {
      const tempPromise = new Promise((resolve, reject) => {
        this.eos.getAccountInfo(account['name']).then((newdata) => {
          this.eos.getTokens(account['name']).then((tokens) => {
            this.eos.getRefunds(account['name']).then((refunds) => {
              let ref_time = null;
              let balance = 0;
              let ref_net = 0;
              let ref_cpu = 0;
              if (refunds.rows.length > 0) {
                ref_net = AccountsService.parseEOS(refunds.rows[0]['cpu_amount']);
                ref_cpu = AccountsService.parseEOS(refunds.rows[0]['cpu_amount']);
                balance += ref_net;
                balance += ref_cpu;
                const tempDate = refunds.rows[0]['request_time'] + '.000Z';
                ref_time = new Date(tempDate);
              }
              tokens.forEach((tk) => {
                balance += AccountsService.parseEOS(tk);
              });
              let net = 0;
              let cpu = 0;
              if (newdata['self_delegated_bandwidth']) {
                net = AccountsService.parseEOS(newdata['self_delegated_bandwidth']['net_weight']);
                cpu = AccountsService.parseEOS(newdata['self_delegated_bandwidth']['cpu_weight']);
                balance += net;
                balance += cpu;
              }
              this.accounts[idx].name = account['name'];
              this.accounts[idx].full_balance = Math.round((balance) * 10000) / 10000;
              this.accounts[idx].staked = net + cpu;
              this.accounts[idx].unstaking = ref_net + ref_cpu;
              this.accounts[idx].unstakeTime = ref_time;
              this.accounts[idx].details = newdata;
              this.lastUpdate.next({
                account: account['name'],
                timestamp: new Date()
              });
              resolve();
            });
          }).catch((error2) => {
            console.log('Error on getTokens', error2);
            reject();
          });
        }).catch((error1) => {
          console.log('Error on getAccountInfo', error1);
          reject();
        });
      });
      PQ.push(tempPromise);
    });
    Promise.all(PQ).then(() => {
      this.eos.storeAccountData(this.accounts);
    });
  }

  fetchListings() {
    this.http.get('https://api.coinmarketcap.com/v2/listings/').subscribe((result: any) => {
      this.cmcListings = result.data;
    });
  }

  fetchTokenPrice(symbol) {
    return new Promise((resolve, reject) => {
      let id = null;
      for (let i = 0; i < this.cmcListings.length; i++) {
        if (this.cmcListings[i].symbol === symbol) {
          id = this.cmcListings[i].id;
        }
      }
      if (id) {
        this.http.get('https://api.coinmarketcap.com/v2/ticker/' + id + '/').subscribe((result: any) => {
          resolve(parseFloat(result.data.quotes.USD['price']));
        }, (err) => {
          reject(err);
        });
      } else {
        resolve(null);
      }
    });
  }

  fetchEOSprice() {
    this.http.get('https://api.coinmarketcap.com/v2/ticker/1765/').subscribe((result: any) => {
      this.usd_rate = parseFloat(result.data.quotes.USD['price']);
    });
  }
}
