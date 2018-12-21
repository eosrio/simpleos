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
  abiSmartContract = '';
  abiSmartContractActions = [];
  abiSmartContractStructs = [];
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
  }

  clearInstance() {
    this.baseConfig.keyProvider = [];
    this.eos = EOSJS(this.baseConfig);
  }

  clearSigner() {
    console.log(this.eos);
  }

  loadNewConfig(signer) {
    this.eos = EOSJS({
      httpEndpoint: this.baseConfig.httpEndpoint,
      signProvider: signer,
      chainId: this.chainID,
      sign: true,
      broadcast: true
    });
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

  getAccountActions(name,last_ib):Promise<any> {
    return new Promise((resolve,reject) => {
      this.eos['getActions'](name,-1,0).then(data=>{
        resolve(data);
        // console.log(data);
      }).catch(error=>{
        reject(error);
        // console.log(error);
      });
    });
  }

  getChainInfo(): Promise<any> {
    if (this.eos) {
      return this.eos['getTableRows']({
        json: true,
        code: 'eosio',
        scope: 'eosio',
        table: 'global'
      });
    } else {
      return new Promise(resolve => {
        resolve();
      });
    }
  }

  getDappMetaData(dapp): Promise<any> {
    if (this.eos) {
      return this.eos['getTableRows']({
        json: true,
        code: 'dappmetadata',
        scope: dapp,
        table: 'dapps'
      });
    } else {
      return new Promise(resolve => {
        resolve();
      });
    }
  }

  getRamMarketInfo(): Promise<any> {
    if (this.eos) {
      return this.eos['getTableRows']({
        json: true,
        code: 'eosio',
        scope: 'eosio',
        table: 'rammarket'
      });
    } else {
      return new Promise(resolve => {
        resolve();
      });
    }
  }

  getRefunds(account): Promise<any> {
    return this.eos['getTableRows']({
      json: true,
      code: 'eosio',
      scope: account,
      table: 'refunds'
    });
  }

  listDelegations(account): Promise<any> {
    return this.eos['getTableRows']({
      json: true,
      code: 'eosio',
      scope: account,
      table: 'delband'
    });
  }

  unDelegate(from: string, receiver: string, net: string, cpu: string, symbol: string) {
    //console.log(from, receiver, (net+' EOS'), (cpu+' EOS'));
    return this.eos.undelegatebw(from, receiver, (net + ' ' + symbol), (cpu + ' ' + symbol));
  }

  delegateBW(from: string, receiver: string, net: string, cpu: string, symbol: string) {
    // console.log(from, receiver, (net +' EOS'), (cpu +' EOS'));
    return new Promise((resolve, reject) => {
      this.eos.delegatebw(from, receiver, (net + ' ' + symbol), (cpu + ' ' + symbol), 0).then(data=>{
        resolve(data);
      }).catch(err2 => {
        reject(err2);
      });
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
          console.log('load',data);
          // if (data['account_names'].length > 0) {
          if (data.length > 0 ) {
            const promiseQueue = [];
            // data['account_names'].forEach((acc) => {
            data.forEach((acc) => {
              const tempPromise = new Promise((resolve1, reject1) => {
                // this.getAccountInfo(acc).then((acc_data) => {
                this.getAccountInfo(acc.account).then((acc_data) => {
                  console.log(acc_data.permissions[0]['required_auth']['keys'][0].key);
                  // if (acc_data.permissions[0]['required_auth']['keys'][0].key === pubkey) {
                  this.getTokens(acc_data['account_name']).then((tokens) => {
                    acc_data['tokens'] = tokens;
                    this.accounts[acc] = acc_data;
                    resolve1(acc_data);
                  }).catch((err) => {
                    console.log(err);
                    reject1();
                  });
                  // } else {
                  //   reject1();
                  // }
                });
              });
              promiseQueue.push(tempPromise);
            });
            Promise.all(promiseQueue).then((results) => {
              resolve({
                foundAccounts: results,
                publicKey: pubkey
              });
            }).catch(() => {
              reject({message: 'non_active'});
            });
          } else if(data['account_names'].length > 0 ){

            const promiseQueue = [];
            data['account_names'].forEach((acc) => {
            // data.forEach((acc) => {
              const tempPromise = new Promise((resolve1, reject1) => {
                this.getAccountInfo(acc).then((acc_data) => {
                // this.getAccountInfo(acc.account).then((acc_data) => {
                  console.log(acc_data.permissions[0]['required_auth']['keys'][0].key);
                  if (acc_data.permissions[0]['required_auth']['keys'][0].key === pubkey) {
                    this.getTokens(acc_data['account_name']).then((tokens) => {
                      acc_data['tokens'] = tokens;
                      this.accounts[acc] = acc_data;
                      resolve1(acc_data);
                    }).catch((err) => {
                      console.log(err);
                      reject1();
                    });
                  } else {
                    reject1();
                  }
                });
              });
              promiseQueue.push(tempPromise);
            });
            Promise.all(promiseQueue).then((results) => {
              resolve({
                foundAccounts: results,
                publicKey: pubkey
              });
            }).catch(() => {
              reject({message: 'non_active'});
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
    this.eos['getAbi']('eosio').then((data) => {
      const temp = data['abi']['ricardian_clauses'][0]['body'];
      this.constitution = temp.replace(/(?:\r\n|\r|\n)/g, '<br>');
    });
  }

  getSCAbi(contract) {
    return this.eos['getAbi'](contract);
  }

  pushActionContract(contract, action, form, account) {
    const options = {authorization: account + '@active'};
    console.log(form);
    return new Promise((resolve, reject) => {
      this.eos['contract'](contract).then((tc) => {
        console.log('tem contract',tc);

        if (tc[action]) {
            tc[action](form, options).then( dt => {
              resolve(dt);
            }).catch(err=>{
              reject(err);
            });
        }
      }).catch(err2 => {
        console.log('tem erro contract',err2);
        reject(err2);
      });
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
    if (this.auth) {
      if (contract === 'eosio.token') {
        return new Promise((resolve, reject) => {
          this.eos['transfer'](from, to, amount, memo, (err, trx) => {
            console.log(err, trx);
            if (err) {
              reject(JSON.parse(err));
            } else {
              resolve(true);
            }
          });
        });
      } else {
        return new Promise((resolve, reject) => {
          this.eos['contract'](contract, (err, tokenContract) => {
            if (!err) {
              if (tokenContract['transfer']) {
                const options = {authorization: from + '@active'};
                tokenContract['transfer'](from, to, amount, memo, options, (err2, trx) => {
                  console.log(err, trx);
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

  ramBuyBytes(payer: string, receiver: string, bytes: string): Promise<any> {
    return this.eos.buyrambytes(payer, receiver, parseInt(bytes));
  }

  ramBuyEOS(payer: string, receiver: string, quant: number, symbol:string): Promise<any> {
    return this.eos.buyram(payer, receiver, quant.toFixed(4) + ' ' + symbol);
  }

  ramSellBytes(account: string, bytes: string): Promise<any> {
    return this.eos.sellram(account, parseInt(bytes));
  }

  async createAccount(creator: string, name: string, owner: string,
                      active: string, delegateAmount: number,
                      rambytes: number, transfer: boolean,
                      giftAmount: number, giftMemo: string, symbol: string): Promise<any> {
    if (this.auth) {
      return this.eos.transaction(tr => {
        tr['newaccount']({creator: creator, name: name, owner: owner, active: active});
        tr['buyrambytes']({payer: creator, receiver: name, bytes: rambytes});
        tr['delegatebw']({
          from: creator, receiver: name,
          stake_net_quantity: (delegateAmount * 0.3).toFixed(4) + ' ' + symbol,
          stake_cpu_quantity: (delegateAmount * 0.7).toFixed(4)+ ' ' + symbol,
          transfer: transfer ? 1 : 0
        });
        if (giftAmount > 0) {
          tr['transfer']({
            from: creator,
            to: name,
            quantity: giftAmount.toFixed(4) + ' ' + symbol,
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
      // const info = await this.eos['getInfo']({}).then(result => {
      //   return result;
      // });
      // const broadcast_lib = info['last_irreversible_block_num'];
      console.log(this.eos);
      return this.eosio['voteproducer'](voter, '', currentVotes).then(data =>{
        return JSON.stringify(data);
      }).catch(err=>{
        return err;
      });
      // return new Promise((resolve, reject) => {
      //   const cb = (err, res) => {
      //     if (err) {
      //       reject(JSON.parse(err));
      //     } else {
      //       console.log(res);
      //       // setTimeout(() => {
      //       //   this.txCheckQueue.push({
      //       //     block: broadcast_lib,
      //       //     id: res['transaction_id']
      //       //   });
      //       //   this.startMonitoringLoop();
      //       // }, 1000);
      //       resolve(res);
      //     }
      //   };
      //
      // });
    } else {
      return new Error('Cannot cast more than 30 votes!');
    }
  }

  stake(account, amount, symbol) {
    return new Promise((resolve, reject) => {
      if (amount > 2) {
        const split = ((amount / 2) / 10000).toFixed(4);
        console.log(split);
        this.eos['delegatebw']({
          from: account,
          receiver: account,
          stake_net_quantity: split + ' ' + symbol,
          stake_cpu_quantity: split + ' ' + symbol,
          transfer: 0
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

  unstake(account, amount, symbol) {
    return new Promise((resolve, reject) => {
      this.eos['getAccount'](account).then((accountInfo) => {
        const current_stake = accountInfo['cpu_weight'] + accountInfo['net_weight'];
        if (current_stake - amount >= 10000) {
          const split = ((amount / 2) / 10000).toFixed(4);
          this.eos['undelegatebw']({
            from: account,
            receiver: account,
            unstake_net_quantity: split + ' ' + symbol,
            unstake_cpu_quantity: split + ' ' + symbol
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
