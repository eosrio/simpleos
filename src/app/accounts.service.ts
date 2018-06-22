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
  public lastUpdate = new Subject<any>();
  usd_rate: number;

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
    const net = AccountsService.parseEOS(acc['total_resources']['net_weight']);
    const cpu = AccountsService.parseEOS(acc['total_resources']['cpu_weight']);
    balance += net;
    balance += cpu;
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
    this.fetchEOSprice();
    this.eos.online.asObservable().subscribe((onlineStatus) => {
      console.log('onlineStatus', onlineStatus);
      if (onlineStatus) {
        setTimeout(() => {
          // this.refreshFromChain();
        }, 1000);
      }
    });
  }

  select(index) {
    const sel = this.accounts[index];
    this.selected.next(sel);
  }

  initFirst() {
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
              const net = AccountsService.parseEOS(newdata['self_delegated_bandwidth']['net_weight']);
              const cpu = AccountsService.parseEOS(newdata['self_delegated_bandwidth']['cpu_weight']);
              balance += net;
              balance += cpu;
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

  fetchEOSprice() {
    this.http.get('https://api.coinmarketcap.com/v2/ticker/1765/').subscribe((result: any) => {
      this.usd_rate = parseFloat(result.data.quotes.USD['price']);
    });
  }
}
