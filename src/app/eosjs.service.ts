import {Injectable} from '@angular/core';
import {TextEncoder} from 'text-encoding-shim';

import * as EOSJS from '../assets/eos.js';
import {BehaviorSubject, Subject} from 'rxjs';

@Injectable()
export class EOSJSService {
  eos: any;
  eosio: any;
  tokens: any;
  ecc: any;
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

  private ivLen = 12;
  private masterKey: CryptoKey;
  private textEncoder = new TextEncoder('utf-8');
  public accounts = new BehaviorSubject<any>({});
  public online = new BehaviorSubject<Boolean>(false);
  public chainID: string;

  constructor() {
    this.eosio = null;
    this.ecc = EOSJS.modules['ecc'];
    this.format = EOSJS.modules['format'];
    this.ready = false;
    this.txh = [];
    this.actionHistory = [];
  }

  static concatUint8Array(...arrays: Uint8Array[]): Uint8Array {
    let totalLength = 0;
    for (const arr of arrays) {
      totalLength += arr.length;
    }
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
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
        const savedpayload = localStorage.getItem('simpleos.accounts.' + this.chainID);
        let savedAcc = [];
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
        console.log(result);
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
    const payload = localStorage.getItem('simpleos.txhistory.' + this.chainID);
    if (payload) {
      this.txh = JSON.parse(payload);
      this.txh.forEach((data) => {
        if (data['trx']) {
          data['trx']['trx']['actions'].forEach((action) => {
            const status = data['trx']['receipt']['status'];
            const date = data['block_time'];
            const contract = action['account'];
            const action_name = action['name'];
            let amount = 0;
            let user = '';
            let type = '';
            let memo = '';

            if (action['account'] === 'eosio.token' && action['name'] === 'transfer') {
              amount = action['data']['quantity'];
              user = action['data']['to'];
              memo = action['data']['memo'];
              type = 'sent';
            }
            let votedProducers = null;
            let proxy = null;
            let voter = null;
            if (action['account'] === 'eosio' && action['name'] === 'voteproducer') {
              votedProducers = action['data']['producers'];
              proxy = action['data']['proxy'];
              voter = action['data']['voter'];
              type = 'vote';
            }
            this.actionHistory.push({
              id: data['id'],
              type: type,
              action_name: action_name,
              contract: contract,
              user: user,
              status: status,
              date: date,
              amount: amount,
              memo: memo,
              votedProducers: votedProducers,
              proxy: proxy,
              voter: voter
            });
          });
        }
      });
      this.actionHistory.reverse();
    }
  }

  saveHistory() {
    const payload = JSON.stringify(this.txh);
    localStorage.setItem('simpleos.txhistory.' + this.chainID, payload);
  }

  async transfer(from, to, amount, memo): Promise<any> {
    if (this.auth) {
      const info = await this.eos['getInfo']({}).then(result => {
        return result;
      });
      const broadcast_lib = info['last_irreversible_block_num'];
      return new Promise((resolve, reject) => {
        this.eos['transfer'](from, to, amount, memo, (err, trx) => {
          if (err) {
            reject(JSON.parse(err));
          } else {
            console.log(trx);
            setTimeout(() => {
              this.txCheckQueue.push({
                block: broadcast_lib,
                id: trx['transaction_id']
              });
              this.startMonitoringLoop();
            }, 500);
            resolve(true);
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

  async initKeys(publickey, pass): Promise<void> {
    const salt = this.textEncoder.encode(publickey);
    this.basePublicKey = publickey;
    const importedPassword = await crypto.subtle.importKey('raw', this.textEncoder.encode(pass), 'PBKDF2', false, ['deriveKey']);
    const tempKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      importedPassword,
      {name: 'AES-GCM', length: 256},
      true,
      ['encrypt']
    );
    const exportedTempKey = await crypto.subtle.exportKey('raw', tempKey);
    const importedTempKey = await crypto.subtle.importKey('raw', exportedTempKey, 'PBKDF2', false, ['deriveKey']);
    this.masterKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2', salt: salt,
        iterations: 100000, hash: 'SHA-256'
      },
      importedTempKey,
      {name: 'AES-GCM', length: 256},
      false,
      ['encrypt', 'decrypt']
    );
  }

  async changePass(publickey, newpass): Promise<boolean> {
    const store = JSON.parse(localStorage.getItem('eos_keys.' + this.chainID));
    if (store) {
      const payload = store[publickey]['private'];
      if (payload) {
        const encryptedData = this.base64ToBuffer(payload);
        const iv = encryptedData.slice(0, this.ivLen);
        const data = encryptedData.slice(this.ivLen);
        const decrypted = await crypto.subtle.decrypt({
          name: 'AES-GCM',
          iv: iv
        }, this.masterKey, data);
        const tempKey = String.fromCharCode.apply(null, new Uint8Array(decrypted)).replace(/"/g, '');
        await this.initKeys(publickey, newpass);
        await this.encryptAndStore(tempKey, publickey);
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  async encryptAndStore(data, publickey): Promise<void> {
    const encryptedData = await this.encrypt(data);
    let store = {};
    const oldData = JSON.parse(localStorage.getItem('eos_keys.' + this.chainID));
    if (oldData) {
      store = oldData;
    }
    store[publickey] = {
      private: this.bufferToBase64(encryptedData)
    };
    localStorage.setItem('eos_keys.' + this.chainID, JSON.stringify(store));
  }

  private async encrypt(data): Promise<Uint8Array> {
    const compressed = this.textEncoder.encode(JSON.stringify(data));
    const initializationVector = new Uint8Array(this.ivLen);
    crypto.getRandomValues(initializationVector);
    const encrypted = await crypto.subtle.encrypt({
        name: 'AES-GCM',
        iv: initializationVector
      },
      this.masterKey,
      compressed
    );
    return EOSJSService.concatUint8Array(initializationVector, new Uint8Array(encrypted));
  }

  bufferToBase64(buf) {
    const binstr = Array.prototype.map.call(buf, function (ch) {
      return String.fromCharCode(ch);
    }).join('');
    return btoa(binstr);
  }

  base64ToBuffer(base64) {
    const binstr = atob(base64);
    const buf = new Uint8Array(binstr.length);
    Array.prototype.forEach.call(binstr, function (ch, i) {
      buf[i] = ch.charCodeAt(0);
    });
    return buf;
  }

  async authenticate(pass, publickey): Promise<boolean> {
    this.auth = false;
    await this.initKeys(publickey, pass);
    return await this.decryptKeys(publickey);
  }

  async decryptKeys(publickey): Promise<boolean> {
    const store = JSON.parse(localStorage.getItem('eos_keys.' + this.chainID));
    if (store) {
      const payload = store[publickey]['private'];
      if (payload) {
        const encryptedData = this.base64ToBuffer(payload);
        const iv = encryptedData.slice(0, this.ivLen);
        const data = encryptedData.slice(this.ivLen);
        const decrypted = await crypto.subtle.decrypt({
          name: 'AES-GCM',
          iv: iv
        }, this.masterKey, data);
        this.baseConfig.keyProvider.push(String.fromCharCode.apply(null, new Uint8Array(decrypted)).replace(/"/g, ''));
        this.auth = true;
        this.eos = EOSJS(this.baseConfig);
        this.baseConfig.keyProvider = [];
        return true;
      } else {
        return false;
      }
    } else {
      return false;
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

}
