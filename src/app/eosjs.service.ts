import {Injectable} from '@angular/core';

import * as EOSJS from '../assets/eos.js';
import {BehaviorSubject, Subject} from 'rxjs';

@Injectable()
export class EOSJSService {
  eosio: any;
  tokens: any;
  public ecc: any;
  format: any;
  ready: boolean;
  status = new Subject<Boolean>();
  txh: any[];
  actionHistory: any[];
  baseConfig = {
    keyProvider: [],
    httpEndpoint: '',
    expireInSeconds: 60,
    broadcast: true,
    debug: false,
    sign: true,
    chainId: ''
  };
  basePublicKey = '';
  auth = false;
  constitution = '';
  txCheckQueue = [];
  txMonitorInterval = null;

  public accounts = new BehaviorSubject<any>({});
  public online = new BehaviorSubject<boolean>(false);
  public chainID: string;
  public eos: any;

  constructor() {
    this.eosio = null;
    this.ecc = EOSJS.modules['ecc'];
    this.format = EOSJS.modules['format'];
    this.ready = false;
    this.txh = [];
    this.actionHistory = [];
  }

  reloadInstance() {
    this.auth = true;
    this.eos = EOSJS(this.baseConfig);
    this.baseConfig.keyProvider = [];
  }

  clearInstance() {
    this.baseConfig.keyProvider = [];
    this.eos = EOSJS(this.baseConfig);
  }

  init(url, chain) {
    this.chainID = chain;
    return new Promise((resolve, reject) => {
      this.baseConfig.chainId = this.chainID;
      this.baseConfig.httpEndpoint = url;
      this.eos = EOSJS(this.baseConfig);
      this.eos['getInfo']({}).then(result => {
        this.ready = true;
        this.online.next(result['head_block_num'] - result['last_irreversible_block_num'] < 400);
        this.getConstitution();
        let savedAcc = [];
        const savedpayload = localStorage.getItem('simpleos.accounts.' + this.chainID);
        if (savedpayload) {
          savedAcc = JSON.parse(savedpayload).accounts;
          this.loadHistory();
        }
        this.eos['contract']('eosio').then(contract => {
          this.eosio = contract;
          resolve(savedAcc);
        });
      }).catch((err) => {
        reject(err);
      });
    });
  }

  getKeyAccounts(pubkey) {
    return this.eos.getKeyAccounts(pubkey);
  }

  getAccountInfo(name) {
    return this.eos['getAccount'](name);
  }

  getChainInfo(): Promise<any> {
    return this.eos['getTableRows']({
      json: true,
      code: 'eosio',
      scope: 'eosio',
      table: 'global'
    });
  }

  getRamMarketInfo(): Promise<any> {
    return this.eos['getTableRows']({
      json: true,
      code: 'eosio',
      scope: 'eosio',
      table: 'rammarket'
    });
  }

  getRefunds(account): Promise<any> {
    return this.eos['getTableRows']({
      json: true,
      code: 'eosio',
      scope: account,
      table: 'refunds'
    });
  }

  claimRefunds(account, k): Promise<any> {
    this.baseConfig.keyProvider = [k];
    const tempEos = EOSJS(this.baseConfig);
    return tempEos['refund']({owner: account}, {
      broadcast: true,
      sign: true,
      authorization: account + '@active'
    });
  }

  checkAccountName(name) {
    return this.format['encodeName'](name);
  }

  loadPublicKey(pubkey) {
    return new Promise((resolve, reject) => {
      if (this.ecc['isValidPublic'](pubkey)) {
        this.getKeyAccounts(pubkey).then((data) => {
          if (data['account_names'].length > 0) {
            const promiseQueue = [];
            data['account_names'].forEach((acc) => {
              const tempPromise = new Promise((resolve1, reject1) => {
                this.getAccountInfo(acc).then((acc_data) => {
                  this.getTokens(acc_data['account_name']).then((tokens) => {
                    acc_data['tokens'] = tokens;
                    this.accounts[acc] = acc_data;
                    resolve1(acc_data);
                  }).catch((err) => {
                    console.log(err);
                    reject1();
                  });
                });
              });
              promiseQueue.push(tempPromise);
            });
            Promise.all(promiseQueue).then((results) => {
              resolve({
                foundAccounts: results,
                publicKey: pubkey
              });
            });
          } else {
            reject({message: 'no_account'});
          }
        });
      } else {
        reject({message: 'invalid'});
      }
    });
  }

  storeAccountData(accounts) {
    if (accounts) {
      if (accounts.length > 0) {
        this.accounts.next(accounts);
        const payload = JSON.parse(localStorage.getItem('simpleos.accounts.' + this.chainID));
        payload.updatedOn = new Date();
        payload.accounts = accounts;
        localStorage.setItem('simpleos.accounts.' + this.chainID, JSON.stringify(payload));
      }
    }
  }

  listProducers() {
    return this.eos['getProducers']({json: true, limit: 200});
  }

  getTokens(name) {
    return this.eos['getCurrencyBalance']('eosio.token', name);
  }

  getTransaction(hash) {
    if (this.ready) {
      this.eos['getTransaction'](hash).then((result) => {
        this.txh.push(result);
        this.saveHistory();
        this.loadHistory();
      });
    }
  }

  getConstitution() {
    this.eos['getCode']('eosio').then((code) => {
      const temp = code['abi']['ricardian_clauses'][0]['body'];
      this.constitution = temp.replace(/(?:\r\n|\r|\n)/g, '<br>');
    });
  }

  loadHistory() {
    this.actionHistory = [];
  }

  saveHistory() {
    const payload = JSON.stringify(this.txh);
    localStorage.setItem('simpleos.txhistory.' + this.chainID, payload);
  }

  async transfer(contract, from, to, amount, memo): Promise<any> {
    if (this.auth && contract === 'eosio.token') {
      return new Promise((resolve, reject) => {
        this.eos['transfer'](from, to, amount, memo, (err, trx) => {
          if (err) {
            reject(JSON.parse(err));
          } else {
            resolve(true);
          }
        });
      });
    } else {
      return new Promise((resolve, reject) => {
        this.eos.contract(contract, (err, tokenContract) => {
          if (!err) {
            if (tokenContract['transfer']) {
              tokenContract['transfer'](from, to, amount, memo, (err2, trx) => {
                if (err2) {
                  reject(JSON.parse(err2));
                } else {
                  resolve(true);
                }
              });
            } else {
              reject();
            }
          } else {
            reject(JSON.parse(err));
          }
        });
      });
    }
  }

  checkPvtKey(k): Promise<any> {
    try {
      const pubkey = this.ecc['privateToPublic'](k);
      return this.loadPublicKey(pubkey);
    } catch (e) {
      console.log(e);
      return new Promise((resolve, reject) => {
        reject(e);
      });
    }
  }

  ramBuy() {

  }

  ramSell() {

  }

  async createAccount(creator: string, name: string, owner: string,
                      active: string, delegateAmount: number,
                      rambytes: number, transfer: boolean,
                      giftAmount: number, giftMemo: string): Promise<any> {
    if (this.auth) {
      return this.eos.transaction(tr => {
        tr['newaccount']({creator: creator, name: name, owner: owner, active: active});
        tr['buyrambytes']({payer: creator, receiver: name, bytes: rambytes});
        tr['delegatebw']({
          from: creator, receiver: name,
          stake_net_quantity: (delegateAmount * 0.3).toFixed(4) + ' EOS',
          stake_cpu_quantity: (delegateAmount * 0.7).toFixed(4) + ' EOS',
          transfer: transfer ? 1 : 0
        });
        if (giftAmount > 0) {
          tr['transfer']({
            from: creator,
            to: name,
            quantity: giftAmount.toFixed(4) + ' EOS',
            memo: giftMemo
          });
        }
      });
    } else {
      return new Promise(resolve => resolve(null));
    }
  }

  startMonitoringLoop() {
    if (!this.txMonitorInterval) {
      console.log('Starting monitoring loop!');
      this.txMonitorInterval = setInterval(() => {
        this.eos['getInfo']({}).then((info) => {
          const lib = info['last_irreversible_block_num'];
          if (this.txCheckQueue.length > 0) {
            console.log('Loop pass - LIB = ' + lib);
            this.txCheckQueue.forEach((tx, idx) => {
              console.log(tx);
              if (lib > tx.block) {
                this.eos['getTransaction']({id: tx.id}).then((result) => {
                  console.log(result.id);
                  if (result.id === tx.id) {
                    this.txh.push(result);
                    console.log(result);
                    this.txCheckQueue.splice(idx, 1);
                    this.saveHistory();
                    this.loadHistory();
                  }
                });
              }
            });
          } else {
            if (this.txMonitorInterval !== null) {
              console.log('Stopping monitoring loop!');
              clearInterval(this.txMonitorInterval);
              this.txMonitorInterval = null;
            }
          }
        });
      }, 500);
    } else {
      console.log('monitor is already polling');
    }
  }

  async voteProducer(voter: string, list: string[]): Promise<any> {
    if (list.length <= 30) {
      const currentVotes = list;
      currentVotes.sort();
      const info = await this.eos['getInfo']({}).then(result => {
        return result;
      });
      const broadcast_lib = info['last_irreversible_block_num'];
      return new Promise((resolve, reject) => {
        const cb = (err, res) => {
          if (err) {
            reject(JSON.parse(err));
          } else {
            console.log(res);
            setTimeout(() => {
              this.txCheckQueue.push({
                block: broadcast_lib,
                id: res['transaction_id']
              });
              this.startMonitoringLoop();
            }, 1000);
            resolve(res);
          }
        };
        this.eosio['voteproducer'](voter, '', currentVotes, cb);
      });
    } else {
      return new Error('Cannot cast more than 30 votes!');
    }
  }

  stake(account, amount) {
    return new Promise((resolve, reject) => {
      if (amount > 2) {
        const split = ((amount / 2) / 10000).toFixed(4);
        console.log(split);
        this.eos['delegatebw']({
          from: account,
          receiver: account,
          stake_net_quantity: split + ' EOS',
          stake_cpu_quantity: split + ' EOS',
          transfer: 1
        }, (err, result) => {
          if (err) {
            console.log(err);
            reject(err);
          } else {
            console.log(result);
            resolve();
          }
        });
      } else {
        reject();
      }
    });
  }

  unstake(account, amount) {
    return new Promise((resolve, reject) => {
      this.eos['getAccount'](account).then((accountInfo) => {
        const current_stake = accountInfo['cpu_weight'] + accountInfo['net_weight'];
        if (current_stake - amount >= 10000) {
          const split = ((amount / 2) / 10000).toFixed(4);
          this.eos['undelegatebw']({
            from: account,
            receiver: account,
            unstake_net_quantity: split + ' EOS',
            unstake_cpu_quantity: split + ' EOS'
          }, (err, result) => {
            if (err) {
              console.log(err);
              reject(err);
            } else {
              console.log(result);
              resolve();
            }
          });
        } else {
          reject();
        }
      });
    });
  }

}
