import {Injectable} from '@angular/core';

import * as EOSJS from '../../../assets/eos.js';
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

    auth = false;
    constitution = '';

    public accounts = new BehaviorSubject<any>({});
    public online = new BehaviorSubject<boolean>(false);
    public chainID: string;
    public eos: any;

    // TODO: move all methods to eosjs2
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

    init(url, chain): Promise<any[] | any> {
        this.chainID = chain;
        return new Promise((resolve, reject) => {
            this.baseConfig.chainId = this.chainID;
            this.baseConfig.httpEndpoint = url;
            this.eos = EOSJS(this.baseConfig);
            this.eos['getInfo']({}).then(result => {
                this.ready = true;
                this.online.next(result['head_block_num'] - result['last_irreversible_block_num'] < 400);
                let savedAcc: any[] = [];
                const savedpayload = localStorage.getItem('simpleos.accounts.' + this.chainID);
                if (savedpayload) {
                    savedAcc = JSON.parse(savedpayload).accounts;
                    this.loadHistory();
                }
                resolve(savedAcc);
            }).catch((err) => {
                reject(err);
            });
        });
    }

    getKeyAccounts(pubkey: string): Promise<any> {
        return new Promise((resolve2, reject2) => {
            this.eos['getKeyAccounts']({
                public_key: pubkey
            }).then(data => {
                resolve2(data);
                // console.log('ff',data);
            }).catch(error => {
                reject2(error);
                // console.log(error);
            });
        });
    }

    getAccountInfo(name: string) {
        return this.eos['getAccount'](name);
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

    listDelegations(account): Promise<any> {
        return this.eos['getTableRows']({
            json: true,
            code: 'eosio',
            scope: account,
            table: 'delband'
        });
    }

    getSymbolContract(contract): Promise<any> {
        return this.eos['getTableRows']({
            json: true,
            code: contract,
            scope: contract,
            table: 'accounts'
        });
    }

    requestRefund(from: string, permission) {
        // console.log(from, receiver, (net+' EOS'), (cpu+' EOS'));
        const options = {authorization: from + '@' + permission};
        return this.eos.refund(from, options);
    }

    unDelegate(from: string, receiver: string, net: string, cpu: string, symbol: string, permission) {
        // console.log(from, receiver, (net+' EOS'), (cpu+' EOS'));
        const options = {authorization: from + '@' + permission};
        return this.eos.undelegatebw(from, receiver, (net + ' ' + symbol), (cpu + ' ' + symbol), options);
    }

    delegateBW(from: string, receiver: string, net: string, cpu: string, symbol: string, permission) {
        // console.log(from, receiver, (net +' EOS'), (cpu +' EOS'));
        const options = {authorization: from + '@' + permission};
        return new Promise((resolve, reject) => {
            this.eos.delegatebw(from, receiver, (net + ' ' + symbol), (cpu + ' ' + symbol), 0, options).then(data => {
                resolve(data);
            }).catch(err2 => {
                reject(err2);
            });
        });
    }

    claimRefunds(account, k, permission): Promise<any> {
        this.baseConfig.keyProvider = [k];
        const tempEos = EOSJS(this.baseConfig);
        return tempEos['refund']({owner: account}, {
            broadcast: true,
            sign: true,
            authorization: account + '@' + permission
        });
    }

    checkAccountName(name) {
        return this.format['encodeName'](name);
    }

    async storeAccountData(accounts) {
        if (accounts) {
            if (accounts.length > 0) {
                this.accounts.next(accounts);
                const payload = JSON.parse(localStorage.getItem('simpleos.accounts.' + this.chainID));
                payload.updatedOn = new Date();
                payload.accounts = accounts;
                // console.log("Set Item Local Storage: ",payload);
                localStorage.setItem('simpleos.accounts.' + this.chainID, JSON.stringify(payload));
                return true;
            } else {
                return false;
            }
        } else {
            return null;
        }
    }

    listProducers() {
        return this.eos['getProducers']({json: true, limit: 200});
    }

    getTokens(name) {
        return this.eos['getCurrencyBalance']('eosio.token', name);
    }

    getConstitution() {
        this.eos['getAbi']('eosio').then((data) => {
            const temp = data['abi']['ricardian_clauses'][0]['body'];
            // this.constitution = temp.replace(/(?:\r\n|\r|\n)/g, '<br>');
            this.constitution = temp;
        });
    }

    getSCAbi(contract) {
        return this.eos['getAbi'](contract);
    }

    pushActionContract(contract, action, form, account, permission) {
        const options = {authorization: account + '@' + permission};

        console.log(JSON.stringify(form));
        console.log(contract, action);
        console.log(options);
        return new Promise((resolve, reject2) => {
            this.eos['contract'](contract).then((tc) => {
                if (tc[action]) {
                    tc[action](form, options).then(dt => {
                        resolve(dt);
                    }).catch(err => {
                        reject2(err);
                    });
                }
            }).catch(err2 => {
                reject2(err2);
            });
        });
    }

    loadHistory() {
        this.actionHistory = [];
    }

    async transfer(contract, from, to, amount, memo, permission): Promise<any> {
        if (this.auth) {
            const options = {authorization: from + '@' + permission};
            if (contract === 'eosio.token') {
                return new Promise((resolve, reject) => {
                    this.eos['transfer'](from, to, amount, memo, options, (err) => {
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
                                tokenContract['transfer'](from, to, amount, memo, options, (err2) => {
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

    ramBuyBytes(payer: string, receiver: string, bytes: string, permission): Promise<any> {
        const options = {authorization: payer + '@' + permission};
        return this.eos.buyrambytes(payer, receiver, parseInt(bytes, 10), options);
    }

    ramSellBytes(account: string, bytes: string, permission): Promise<any> {
        const options = {authorization: account + '@' + permission};
        return this.eos.sellram(account, parseInt(bytes, 10), options);
    }

    async voteAction(voter: string, list: string[], type: number, permission: string): Promise<any> {
        let proxy = '';
        let currentVotes = [];
        if (list.length <= 30) {
            if (!type) {
                currentVotes = list;
                currentVotes.sort();
            } else {
                proxy = list[0];
            }
        } else {
            return new Error('Cannot cast more than 30 votes!');
        }
        console.log(proxy);
        const options = {authorization: voter + '@' + permission};

        if (!this.eosio) {
            this.eosio = await this.eos['contract']('eosio');
        }

        return this.eosio['voteproducer'](voter, type ? proxy : '', type ? '' : currentVotes, options).then(data => {
            return JSON.stringify(data);
        }).catch(err => {
            return err;
        });
    }
}
