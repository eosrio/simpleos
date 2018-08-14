import {Injectable} from '@angular/core';
import {BehaviorSubject, Subject} from 'rxjs';
import {EOSJSService} from './eosjs.service';
import {HttpClient} from '@angular/common/http';
import {BodyOutputType, Toast, ToasterService} from 'angular2-toaster';
import {split} from 'ts-node';

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
  sessionTokens = {};
  allowed_actions = [];
  totalAssetsSum = 0;
  loading = true;

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

  constructor(private http: HttpClient, private eos: EOSJSService, private toaster: ToasterService) {
    this.accounts = [];
    this.usd_rate = 10.00;
    this.allowed_actions = ['transfer', 'voteproducer', 'undelegatebw', 'delegatebw'];
    // this.fetchListings();
    this.fetchEOSprice();
  }

  registerSymbol(data, contract) {
    const idx = this.tokens.findIndex((val) => {
      return val.name === data['symbol'];
    });
    let price = null;
    let usd_value = null;
    if (data['price']) {
      price = data['price'];
      usd_value = data['usd_value'];
    }
    if (idx === -1) {
      const obj = {
        name: data['symbol'],
        contract: contract,
        balance: data['balance'],
        price: price,
        usd_value: usd_value
      };
      this.sessionTokens[this.selectedIdx].push(obj);
      this.tokens.push(obj);
    }
  }

  calcTotalAssets() {
    let totalSum = 0;
    this.tokens.forEach(tk => {
      if (tk.price) {
        totalSum = totalSum + (tk.balance * tk.price);
      }
    });
    this.totalAssetsSum = totalSum;
  }

  fetchTokens(account) {
    // if (!this.sessionTokens[this.selectedIdx]) {
      this.sessionTokens[this.selectedIdx] = [];
      this.http.get('https://hapi.eosrio.io/data/tokens/' + account).subscribe((data) => {
        const contracts = Object.keys(data);
        this.loading = false;
        contracts.forEach((contract) => {
          if (data[contract]['symbol'] !== 'EOS') {
            this.registerSymbol(data[contract], contract);
          }
        });
        this.tokens.sort((a: any, b: any) => {
          return a.usd_value < b.usd_value ? 1 : -1;
        });
        this.accounts[this.selectedIdx]['tokens'] = this.tokens;
      });
    // } else {
    //   this.loading = false;
    // }
  }

  getTokenBalances() {
    this.tokens.forEach((tk, index) => {
      if (this.tokens[index]) {
        this.fetchTokenPrice(tk.name).then((price) => {
          this.tokens[index]['price'] = price;
        });
      }
    });
  }

  appendRecentActions(account) {
    this.eos['eos']['getActions']({
      account_name: account,
      offset: -2,
      pos: -1
    }).then((data) => {
      data.actions.forEach((action) => {
        this.processAction(action.action_trace.act, action.action_trace.trx_id, action.block_num, action.block_time, true);
      });
      this.accounts[this.selectedIdx]['actions'] = this.actions;
    });
  }

  processAction(act, id, block_num, date, append) {
    const contract = act['account'];
    const action_name = act['name'];
    let symbol = '', user = '', type = '', memo = '';
    let votedProducers = null, proxy = null, voter = null;
    let cpu = 0, net = 0, amount = 0;

    if (action_name === 'transfer') {
      if (contract === 'eosio.token') {
        // NATIVE TOKEN
        amount = act['data']['quantity']['split'](' ')[0];
        symbol = 'EOS';
      } else {
        // CUSTOM TOKEN
        amount = act['data']['quantity']['split'](' ')[0];
        symbol = act['data']['quantity']['split'](' ')[1];
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
    if (this.allowed_actions.includes(action_name) && valid) {
      const idx = this.actions.findIndex((val) => {
        return val.id === id;
      });
      if (idx === -1) {
        const obj = {
          id: id, type: type, action_name: action_name,
          contract: contract, user: user, block: block_num,
          date: date, amount: amount, symbol: symbol,
          memo: memo, votedProducers: votedProducers,
          proxy: proxy, voter: voter
        };
        if (append) {
          this.actions.unshift(obj);
        } else {
          this.actions.push(obj);
        }
      }
    }
  }

  reloadActions(account) {
    this.http.get('https://hapi.eosrio.io/data/actions_limited/' + account).subscribe((actions: any[]) => {
      this.actions = [];
      actions.forEach((item) => {
        const act = item['transaction']['trx']['transaction']['action'];
        const id = item['transaction']['trx']['id'];
        const block_num = item['block_num'];
        const date = item['@timestamp'];
        this.processAction(act, id, block_num, date, false);
      });
      this.accounts[this.selectedIdx]['actions'] = this.actions;
      this.appendRecentActions(account);
      this.calcTotalAssets();
    });
  }

  select(index) {
    const sel = this.accounts[index];
    this.loading = true;
    // if (sel['tokens']) {
    //   if (sel.tokens.length > 0) {
    //     this.tokens = sel.tokens;
    //   }
    // } else {
    //   this.tokens = [];
    // }
    this.tokens = [];
    if (sel['actions']) {
      if (sel.actions.length > 0) {
        this.actions = sel.actions;
      }
    } else {
      this.actions = [];
    }
    this.selectedIdx = index;
    this.selected.next(sel);
    // if (this.tokens.length === 0) {
    this.fetchTokens(this.selected.getValue().name);
    // }
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

  appendAccounts(accounts) {
    const chain_id = this.eos.chainID;
    const payload = JSON.parse(localStorage.getItem('simpleos.accounts.' + chain_id));
    accounts.forEach((account) => {
      const idx = payload.accounts.findIndex((el) => {
        return el.name === account.account_name || el.account_name === account.account_name;
      });
      if (idx === -1) {
        payload.accounts.push(account);
      } else {
        const toast: Toast = {
          type: 'info',
          title: 'Import',
          body: 'The account ' + account.account_name + ' was already imported! Skipping...',
          timeout: 10000,
          showCloseButton: true,
          bodyOutputType: BodyOutputType.TrustedHtml,
        };
        this.toaster.popAsync(toast);
      }
    });
    payload.updatedOn = new Date();
    localStorage.setItem('simpleos.accounts.' + chain_id, JSON.stringify(payload));
    this.loadLocalAccounts(payload.accounts);
  }

  loadLocalAccounts(data) {
    if (data.length > 0) {
      this.accounts = [];
      data.forEach((acc_data) => {
        acc_data.tokens = [];
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
      this.fetchTokens(this.selected.getValue().name);
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
      if (id && symbol === 'EOSDAC') {
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
