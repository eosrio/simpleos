import {EventEmitter, Injectable} from '@angular/core';
import {BehaviorSubject, Subject} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {BodyOutputType, Toast, ToasterService} from 'angular2-toaster';
import {Eosjs2Service} from './eosio/eosjs2.service';
import {parseTokenValue} from '../helpers/aux_functions';
import {CryptoService} from './crypto/crypto.service';
import {Numeric} from 'eosjs/dist';
import {EOSAccount} from '../interfaces/account';
import * as moment from 'moment';

@Injectable({
    providedIn: 'root',
})
export class AccountsService {

    public accounts: EOSAccount[];
    public activeChain: any;
    public selected = new BehaviorSubject<EOSAccount>({} as EOSAccount);
    public lastAccount: any = null;
    public selectedIdx = 0;
    public lastUpdate = new Subject<any>();
    public versionSys: string;

    usd_rate = 1;
    tokens = [];
    actions: any[] = [];
    totalActions: number;
    sessionTokens = {};
    allowed_actions = [];
    totalAssetsSum = 0;
    loading = true;
    actionStore = {};
    private loadingTokens = false;
    private lastTkLoadTime = 0;
    public isRefreshing = false;
    defaultChains: any[];
    events: EventEmitter<any>;

    constructor(
        private http: HttpClient,
        private eosjs: Eosjs2Service,
        private crypto: CryptoService,
        private toaster: ToasterService,
    ) {
        this.accounts = [];
        this.usd_rate = 10.00;
        this.allowed_actions = ['transfer', 'voteproducer', 'undelegatebw', 'delegatebw'];
        this.events = new EventEmitter<any>();
    }

    init() {

        this.fetchEOSprice().catch((err) => {
            console.log(err);
        });

        this.eosjs.online.asObservable().subscribe(value => {
            if (value) {
                const store = localStorage.getItem('actionStore.' + this.eosjs.chainId);
                if (store) {
                    this.actionStore = JSON.parse(store);
                } else {
                    // console.log ( this.selected.getValue ().name , 'creating new actionStore' );
                    if (this.selected.getValue()['name'] !== undefined) {
                        this.actionStore[this.selected.getValue()['name']] = {
                            last_gs: 0,
                            actions: [],
                        };
                    }
                }
            }
        });
    }

    getStoredKey(account?: any) {
        if (!account) {
            account = this.selected.getValue();
        }
        const store = localStorage.getItem('eos_keys.' + this.activeChain.id);
        let key = '';
        let _perm = '';
        if (store) {
            const keys = Object.keys(JSON.parse(store));
            account.details.permissions.forEach((p) => {
                if (p.required_auth.keys.length > 0) {
                    const legacyKey = p.required_auth.keys[0].key;
                    const newKey = Numeric.convertLegacyPublicKey(legacyKey);
                    if (keys.includes(legacyKey)) {
                        key = legacyKey;
                        _perm = p.perm_name;
                    } else if (keys.includes(newKey)) {
                        key = newKey;
                        _perm = p.perm_name;
                    }
                }
            });
        }
        return [key, _perm];
    }

    getStoredAuths(account) {
        const store = localStorage.getItem('eos_keys.' + this.activeChain.id);
        const auths = [];
        if (store) {
            const keys = Object.keys(JSON.parse(store));
            account.details.permissions.forEach((p) => {
                if (p.required_auth.keys.length > 0) {
                    const _k = p.required_auth.keys[0].key;
                    if (keys.includes(_k)) {
                        auths.push({
                            key: _k,
                            perm_name: p.perm_name,
                        });
                    }
                }
            });
        }
        return auths;
    }

    parseEOS(tk_string) {
        if (tk_string.split(' ')[1] === this.activeChain['symbol']) {
            return parseFloat(tk_string.split(' ')[0]);
        } else {
            return 0;
        }
    }

    registerSymbol(data) {
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
                contract: data['contract'],
                balance: data['balance'],
                precision: data['precision'],
                price: price,
                usd_value: usd_value,
            };
            if (this.sessionTokens[this.selectedIdx]) {
                this.sessionTokens[this.selectedIdx].push(obj);
            } else {
                this.sessionTokens[this.selectedIdx] = [];
            }
            this.tokens.push(obj);
        }
    }

    calcTotalAssets() {
        let totalSum = 0;
        this.tokens.forEach(tk => {
            if (tk.price) {
                totalSum += (tk.balance * tk.price);
            }
        });
        this.totalAssetsSum = totalSum;
    }

    async getTokenHyperionMulti(account): Promise<any> {
        if (!this.activeChain.hyperionApis) {
            return;
        }
        for (const api of this.activeChain.hyperionApis) {
            let url = api + '/state/get_tokens?account=' + account;
            try {
                const response: any = await this.http.get(url).toPromise();
                if (response.tokens && response.tokens.length > 0) {
                    return response;
                }
            } catch (e) {
                console.log(`failed to fetch actions: ${api}`);
            }
        }
        return;
    }

    async fetchTokens(account) {

        if (this.accounts.length === 0) {
            return;
        }

        if (!this.loadingTokens && ((Date.now() - this.lastTkLoadTime > 60 * 1000) || this.tokens.length === 0)) {
            this.loadingTokens = true;
            this.sessionTokens[this.selectedIdx] = [];
            // if (this.activeChain['name'] === 'EOS MAINNET') {
            //     const data = await this.http.get('https://hapi.eosrio.io/data/v2/tokens/' + account).toPromise();
            //     this.lastTkLoadTime = Date.now();
            //     const tokens = Object.keys(data);
            //     this.loading = false;
            //     tokens.forEach((idx) => {
            //         if (data[idx]['symbol'] !== this.activeChain['symbol']) {
            //             this.registerSymbol(data[idx]);
            //         }
            //     });
            //     this.tokens.sort((a: any, b: any) => {
            //         return a.usd_value < b.usd_value ? 1 : -1;
            //     });
            //     this.accounts[this.selectedIdx]['tokens'] = this.tokens;
            //     this.loadingTokens = false;
            //     return this.accounts;
            // } else {
                // Load with hyperion multi
                this.lastTkLoadTime = Date.now();
                const data = await this.getTokenHyperionMulti(account);
                if (data) {
                    const tokens = data['tokens'];
                    for (const token of tokens) {
                        if (token.symbol !== this.activeChain['symbol']) {
                            token['balance'] = token['amount'];
                            token['usd_value'] = 0;
                            this.registerSymbol(token);
                        }
                    }
                    this.tokens.sort((a: any, b: any) => {
                        if (a.symbol < b.symbol) {
                            return -1;
                        }
                        if (a.symbol > b.symbol) {
                            return 1;
                        }
                        return 0;
                    });
                    this.lastTkLoadTime = Date.now();
                    this.loading = false;
                    this.accounts[this.selectedIdx]['tokens'] = this.tokens;
                    this.loadingTokens = false;
                    return this.accounts;
                } else {
                    this.loading = false;
                    this.loadingTokens = false;
                    this.lastTkLoadTime = Date.now();
                    return null;
                }
            // }
        } else {
            if (this.tokens.length > 0) {
                this.loadingTokens = false;
            }
            this.loading = false;
            return null;
        }
    }

    processAction(act, id, block_num, date, account_action_seq) {
        const contract = act['account'];
        const action_name = act['name'];
        let symbol = '', user = '', type = '', memo = '';
        let votedProducers = null, proxy = null, voter = null;
        let cpu = 0, net = 0, amount = 0;

        if (typeof act.data === 'object') {

            if (action_name === 'transfer') {

                if (typeof act['data']['amount'] === 'number') {
                    amount = act['data']['amount'];
                } else {
                    amount = parseTokenValue(act['data']['quantity']);
                }

                if (act['data']['symbol']) {
                    symbol = act['data']['symbol'];
                } else {
                    if (act.data.quantity) {
                        symbol = act['data']['quantity']['split'](' ')[1];
                    }
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

            if (action_name === 'buyrambytes') {

                amount = act['data']['bytes'];
                symbol = 'bytes';
                if (act['data']['receiver'] === this.selected.getValue().name) {
                    user = act['data']['payer'];
                    type = 'bytes_in';
                } else {
                    user = act['data']['receiver'];
                    type = 'bytes_out';
                }
            }

            if (action_name === 'sellram') {
                amount = act['data']['bytes'];
                symbol = 'bytes';
                user = act['data']['account'];
                type = 'bytes_s';
            }

            if (contract === 'eosio' && action_name === 'voteproducer') {
                votedProducers = act['data']['producers'];
                proxy = act['data']['proxy'];
                voter = act['data']['voter'];
                type = 'vote';
            }

            if (contract === 'eosio' && action_name === 'undelegatebw') {

                cpu = parseTokenValue(act['data']['unstake_cpu_quantity']);
                net = parseTokenValue(act['data']['unstake_net_quantity']);

                amount = cpu + net;
                if (act['data']['from'] === act['data']['receiver']) {
                    user = act['data']['from'];
                    type = 'unstaked_in';
                } else {
                    user = act['data']['receiver'];
                    type = 'unstaked_out';
                }
            }

            if (contract === 'eosio' && action_name === 'delegatebw') {
                cpu = parseTokenValue(act['data']['stake_cpu_quantity']);
                net = parseTokenValue(act['data']['stake_net_quantity']);
                amount = cpu + net;
                if (act['data']['from'] === act['data']['receiver']) {
                    user = act['data']['from'];
                    type = 'staked_in';
                } else {
                    user = act['data']['receiver'];
                    type = 'staked_out';
                }
            }

            if ((contract === 'eosio' && action_name === 'refund')) {
                type = 'refund';
            }

            if (act['data']['to'] === 'eosio.ram') {
                type = 'buyram';
            }

            if (act['data']['from'] === 'eosio.ram') {
                type = 'sellram';
            }

            if ((contract !== 'eosio' && contract !== 'eosio.token' && action_name !== 'transfer')) {
                if (!act['data']['to'] && !act['data']['from']) {
                    type = 'other';
                    const dataInfo = act['data'];
                    Object.keys(dataInfo).forEach((dt) => {
                        memo += dt + ': ' + dataInfo[dt] + '; ';
                    });
                } else {
                    type = 'other2';
                    const dataInfo = act['data'];
                    Object.keys(dataInfo).forEach((dt) => {
                        memo += dt + ': ' + dataInfo[dt] + '; ';
                    });
                }

            }

            if ((contract === 'eosio' && action_name === 'newaccount')) {
                type = 'new';
                user = act['data']['newact'];
                memo = JSON.stringify(act['data']);
            }

            if ((contract === 'eosio' && action_name === 'mvtosavings')) {
                type = 'mvtosavings';
                amount = parseTokenValue(act['data']['rex']);
                symbol = 'REX';
            }

            if ((contract === 'eosio' && action_name === 'mvfrsavings')) {
                type = 'mvfrsavings';
                amount = parseTokenValue(act['data']['rex']);
                symbol = 'REX';
            }

            if ((contract === 'eosio' && action_name === 'unstaketorex')) {
                type = 'unstaketorex';
                cpu = parseTokenValue(act['data']['from_cpu']);
                net = parseTokenValue(act['data']['from_net']);
                amount = cpu + net;
            }

            if ((contract === 'eosio' && action_name === 'deposit')) {
                type = 'deposit';
            }

            if ((contract === 'eosio' && action_name === 'buyrex')) {
                type = 'buyrex';
                amount = parseTokenValue(act['data']['amount']);
            }

            if ((contract === 'eosio' && action_name === 'deposit')) {
                type = 'deposit';
                amount = parseTokenValue(act['data']['amount']);
            }

            if ((contract === 'eosio' && action_name === 'withdraw')) {
                type = 'withdraw';
                amount = parseTokenValue(act['data']['amount']);
            }

            if ((contract === 'eosio' && action_name === 'sellrex')) {
                type = 'sellrex';
                amount = parseTokenValue(act['data']['rex']);
                symbol = 'REX';
            }

            if ((contract === 'eosio' && action_name === 'rentcpu')) {
                type = 'rentcpu';
                user = act['data']['receiver'] === this.selected.getValue().name ? 'this account' : act['data']['receiver'];
                amount = parseTokenValue(act['data']['loan_payment']);
            }

            if ((contract === 'eosio' && action_name === 'rentnet')) {
                user = act['data']['receiver'] === this.selected.getValue().name ? 'this account' : act['data']['receiver'];
                type = 'rentnet';
                amount = parseTokenValue(act['data']['loan_payment']);
            }
        }

        const allowedActions = [
            'eosio::newaccount',
            'eosio.token::transfer',
            'eosio::delegatebw',
            'eosio::undelegatebw',
            'eosio::refund',
            'eosio::voteproducer',
            'eosio::sellram',
            'eosio::buyrambytes',
            'eosio::mvtosavings',
            'eosio::mvfrsavings',
            'eosio::unstaketorex',
            'eosio::buyrex',
            'eosio::sellrex',
            'eosio::deposit',
            'eosio::withdraw',
            'eosio::rentcpu',
            'eosio::rentnet',
        ];

        const matched = allowedActions.includes(contract + '::' + action_name);
        const precisionRound = Math.pow(10, this.activeChain['precision']);
        const obj = {
            id: id,
            seq: account_action_seq,
            type: type,
            action_name: action_name,
            contract: contract,
            user: user,
            block: block_num,
            date: date,
            amount: (Math.round(amount * precisionRound) / precisionRound),
            symbol: symbol,
            memo: memo,
            votedProducers: votedProducers,
            proxy: proxy,
            voter: voter,
            matched: matched,
            json_data: act['data'],
        };
        // this.actions.unshift(obj);

        if (this.actions.findIndex((a) => {
            return obj.seq === a.seq;
        }) === -1) {
            this.actions.push(obj);
        }
    }

    async getAccActions(account) {
        if (account === null) {
            account = this.selected.getValue().name;
        }
        const store = localStorage.getItem('actionStore.' + this.activeChain['id']);
        // console.log('GETACCACTIONS:',store);
        if (store) {
            this.actionStore = JSON.parse(store.toString());
        }
        if (!this.actionStore[this.selected.getValue().name]) {
            this.actionStore[this.selected.getValue().name] = {
                last_gs: 0,
                actions: [],
            };
        }
        await this.getActions(account, 0, 12, 0).catch(console.log);
    }

    private async getActionsHyperionMulti(account: any, limit: any, skip: any, filter?: any, after?: any, before?: any, parent?: any): Promise<boolean> {
        let result;

        if (!this.activeChain.hyperionApis) {
            return false;
        }

        if (this.activeChain.hyperionApis.length === 0) {
            return false;
        }

        let apis = this.activeChain.hyperionApis;
        if (!this.activeChain.hyperionProviders) {
            this.checkHyperionProviders().catch(console.log);
        } else {
            if (this.activeChain.hyperionProviders.length > 0) {
                apis = this.activeChain.hyperionProviders.map(a => a.url);
            }
        }
        let bestUrl = '';
        for (const api of apis) {
            if (!result) {

                let url = api + '/history/get_actions?account=' + account + '&limit=' + limit + '&skip=' + skip;

                url = url + (filter !== '' && filter !== undefined ? filter : '');
                url = url + (after !== '' && after !== undefined ? '&after=' + after : '');
                url = url + (before !== '' && before !== undefined ? '&before=' + before : '');
                url = url + (parent !== '' && parent !== undefined ? '&parent=' + parent : '');

                try {
                    const tref = Date.now();
                    const response: any = await this.http.get(url).toPromise();
                    if (response.actions && response.actions.length > 0) {
                        const latency = Date.now() - tref;
                        console.log(`Used ${api} with ${latency} ms latency`);
                        // const provider = this.activeChain.hyperionProviders.find(p => p.url === api);
                        // provider.latency = latency;
                        bestUrl = api;
                        result = response;
                    }
                } catch (e) {
                    console.log(`failed to fetch actions: ${api}`);
                }
            }
        }

        if (result) {
            this.updateActionStore(account, result['actions']);

            for (const action of this.actionStore[account].actions) {
                const act = action['act'];
                const tx_id = action['trx_id'];
                const blk_num = action['block_num'];
                const blk_time = action['@timestamp'];
                const seq = action['global_sequence'];
                try {
                    this.processAction(act, tx_id, blk_num, blk_time, seq);
                } catch (e) {
                    console.log(act);
                    console.log(e);
                }
            }
            this.totalActions = result['total']['value'];
            this.accounts[this.selectedIdx]['actions'] = this.actions;
            this.calcTotalAssets();
            this.checkLastActions(bestUrl, account).catch(console.log);
            return true;
        } else {
            console.log('no action history from hyperion endpoints');
            this.actions = [];
            this.totalActions = 0;
            return false;
        }
    }

    async getActions(account: string, pos: number, offset: number, skip: number, filter?, after?, before?, parent?) {
        console.log(`getActions`, account, pos, offset);
        if (!account) {
            console.log(new Error('no account'));
            return;
        }
        this.actions = [];
        // check history using hyperion
        const hyperionStatus = await this.getActionsHyperionMulti(account, offset, skip, filter, after, before, parent);
        if (hyperionStatus) {
            return;
        }
        // fallback to native
        const _position = pos === 0 ? -1 : pos;
        const _offset = pos === 0 ? -offset : -(offset - 1);
        this.eosjs.getAccountActions(account, _position, _offset).then((val) => {
            const actions = val['actions'];
            actions.reverse();
            if (actions.length > 0) {
                if (pos === 0) {
                    this.totalActions = actions[0].account_action_seq + 1;
                }
                this.updateActionStore(account, actions);
            }
            console.log('Total Actions:' + this.totalActions);
            this.actionStore[account]['actions'].forEach((action) => {
                let act, tx_id, blk_num, blk_time, seq;
                if (action['action_trace']) {
                    act = action['action_trace']['act'];
                    tx_id = action['action_trace']['trx_id'];
                    blk_num = action['block_num'];
                    blk_time = action['block_time'];
                    seq = action['account_action_seq'];
                } else {
                    act = action['act'];
                    tx_id = action['trx_id'];
                    blk_num = action['block_num'];
                    blk_time = action['block_time'];
                    seq = action['receipt']['global_sequence'];
                }
                this.processAction(act, tx_id, blk_num, blk_time, seq);
            });
            this.accounts[this.selectedIdx]['actions'] = this.actions;
            this.calcTotalAssets();
            // this.checkLastActions('').catch(console.log);
        }).catch((err) => {
            console.log(err);
        });
    }

    async checkLastActions(api, account){
        let activitypastday = false;
        const nowDate = moment.utc(moment().local());
        const beforeDate = moment.utc(moment().local()).subtract(1, 'days');

        let url = api + '/history/get_actions?limit=100&skip=0&account=' + account +
            '&after=' + beforeDate.format('YYYY-MM-DD[T]HH:mm:ss') +
            '&before=' + nowDate.format('YYYY-MM-DD[T]HH:mm:ss');

        try {
            const response: any = await this.http.get(url).toPromise();
                if (response.actions.length > 0) {
                    response.actions.forEach(act => {
                        console.log(act['act']['authorization']);
                        const actor = act['act']['authorization'].find(auth => auth.actor === account);
                        if (!activitypastday && actor) {
                            activitypastday = true;
                        }
                    });
            }

        } catch (e) {
            console.log(`failed to fetch actions: ${api}`);
        }
        this.accounts[this.selectedIdx]['activitypastday'] = activitypastday;
        console.log(activitypastday);
    }

    reloadActions(account) {
        this.getAccActions(account).catch(console.log);
    }

    select(index) {
        const sel = this.accounts[index];
        this.loading = true;
        this.tokens = [];
        if (sel) {
            if (sel['actions'] && sel) {
                if (sel.actions.length > 0) {
                    this.actions = sel.actions;
                }
            } else {
                this.actions = [];
            }
            this.selectedIdx = index;
            this.selected.next(sel);
            this.fetchTokens(sel.name).catch(console.log);
        }
    }

    initFirst() {
        this.select(0);
    }

    async importAccounts(accounts): Promise<any[]> {
        const chain_id = this.eosjs.chainId;
        const payload = {importedOn: new Date(), updatedOn: new Date(), accounts: accounts};
        localStorage.setItem('simpleos.accounts.' + chain_id, JSON.stringify(payload));
        localStorage.setItem('simplEOS.init', 'true');
        await this.loadLocalAccounts(accounts);
        return accounts;
    }

    appendNewAccount(account) {
        return new Promise((resolve, reject2) => {
            const chain_id = this.eosjs.chainId;
            let payload = JSON.parse(localStorage.getItem('simpleos.accounts.' + chain_id));
            if (!payload) {
                payload = {
                    accounts: [account],
                    updatedOn: new Date(),
                };
            } else {
                payload.accounts.push(account);
                payload['updatedOn'] = new Date();
            }
            localStorage.setItem('simpleos.accounts.' + chain_id, JSON.stringify(payload));
            localStorage.setItem('simplEOS.init', 'true');
            this.loadLocalAccounts(payload.accounts).then((data) => {
                resolve(data);
            }).catch(() => {
                reject2();
            });
        });
    }

    async appendAccounts(accounts) {
        const chain_id = this.eosjs.chainId;
        let payload = JSON.parse(localStorage.getItem('simpleos.accounts.' + chain_id));
        if (!payload) {
            payload = {
                accounts: [],
                updatedOn: new Date(),
            };
        }
        accounts.forEach((account) => {
            const idx = payload.accounts.findIndex((elem) => {
                return elem.name === account.account_name || elem.account_name === account.account_name;
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
        this.events.emit({event: 'imported_accounts', data: accounts});
        localStorage.setItem('simpleos.accounts.' + chain_id, JSON.stringify(payload));
        localStorage.setItem('simplEOS.init', 'true');
        return await this.loadLocalAccounts(payload.accounts);
    }

    async loadLocalAccounts(data: any[]) {
        if (data.length > 0) {
            this.accounts = [
                ...data.map((value) => {
                    return !value.details ? {name: value['account_name'],full_balance:0, details: value} : value;
                })
            ];
            // reload all account
            await this.refreshFromChain(true);
            // select first tab
            this.select(0);
        }
    }

    refreshAccountFactory(account: EOSAccount): Promise<EOSAccount> {
        return new Promise(async (resolve) => {
            const newdata = await this.eosjs.getAccountInfo(account['name']);
            const tokens = await this.eosjs.getTokens(account['name']);
            let balance = 0; 
            let ref_time = null;
            let ref_cpu = 0;
            let ref_net = 0;
            let staked = 0;
            const refund = newdata['refund_request'];
            if (refund) {
                ref_cpu = this.parseEOS(refund['cpu_amount']);
                ref_net = this.parseEOS(refund['net_amount']);
                balance += ref_net;
                balance += ref_cpu;
                const tempDate = refund['request_time'] + '.000Z';
                ref_time = new Date(tempDate);
            }
            tokens.forEach((tk) => {
                balance += this.parseEOS(tk);
            });
            let net = 0;
            let cpu = 0;
            if (newdata['self_delegated_bandwidth']) {
                net = this.parseEOS(newdata['self_delegated_bandwidth']['net_weight']);
                cpu = this.parseEOS(newdata['self_delegated_bandwidth']['cpu_weight']);
                staked = net + cpu;
                balance += net;
                balance += cpu;
            }
            const precisionRound = Math.pow(10, this.activeChain['precision']);
            if (!newdata['total_resources']) {
                if (newdata['voter_info'] && newdata['voter_info']['staked']) {
                    staked = newdata['voter_info']['staked'] / precisionRound;
                    balance += staked;
                }
            }
            account.name = account['name'];
            account.full_balance = Math.round((balance) * precisionRound) / precisionRound;
            account.staked = staked;
            account.unstaking = ref_net + ref_cpu;
            account.unstakeTime = ref_time;
            account.details = newdata;
            this.lastUpdate.next({
                account: account['name'],
                timestamp: new Date(),
            });
            resolve(account);
        });
    }

    async refreshFromChain(refreshAll, refreshOthers?: string[]) {
        if (this.isRefreshing) {
            return;
        }
        this.isRefreshing = true;
        const PQ = [];
        if (refreshAll) {
            for (const account of this.accounts) {
                PQ.push(this.refreshAccountFactory(account));
            }
            this.accounts = await Promise.all(PQ);
        } else {
            await this.refreshAccountFactory(this.accounts[this.selectedIdx]);
            if (refreshOthers) {
                for (const accountName of refreshOthers) {
                    const account = this.accounts.find((a) => a.name === accountName);
                    if (account) {
                        await this.refreshAccountFactory(account);
                    }
                }
            }
        }
        await this.fetchTokens(this.selected.getValue().name);
        await this.classifySigProviders();
        await this.storeAccountData(this.accounts);
        this.isRefreshing = false;
    }

    readStoredAccounts() {
        const data = localStorage.getItem('simpleos.accounts.' + this.eosjs.chainId);
        if (data) {
            try {
                return JSON.parse(data).accounts;
            } catch (e) {
                return [];
            }
        } else {
            return [];
        }
    }

    async storeAccountData(accounts) {
        console.log('saving data...');
        if (accounts) {
            const data = localStorage.getItem('simpleos.accounts.' + this.eosjs.chainId);
            let payload;
            if (data) {
                try {
                    payload = JSON.parse(data);
                } catch (e) {
                    console.log(e);
                    return false;
                }
            } else {
                payload = {};
            }
            payload.updatedOn = new Date();
            payload.accounts = accounts;
            localStorage.setItem('simpleos.accounts.' + this.eosjs.chainId, JSON.stringify(payload));
            return true;
        } else {
            return null;
        }
    }

    async fetchEOSprice() {
        if (this.activeChain['name'] === 'EOS MAINNET') {
            try {
                const priceresult = await this.eosjs.getMainnetTableRows('delphioracle', 'eosusd', 'datapoints');
                this.usd_rate = priceresult.rows[0].median / 10000;
                console.log(this.usd_rate);
            } catch (e) {
                console.log(e);
                this.usd_rate = 0;
            }
        }
        return null;
    }

    private updateActionStore(account: any, resultElement: any) {
        if (!this.actionStore[account]) {
            this.actionStore[account] = {
                actions: resultElement,
            };
        } else {
            this.actionStore[account]['actions'] = resultElement;
        }
        const payload = JSON.stringify(this.actionStore);
        localStorage.setItem('actionStore.' + this.activeChain['id'], payload);
    }

    private sortProviders() {
        if (this.activeChain.hyperionProviders.length > 1) {
            this.activeChain.hyperionProviders.sort((a, b) => {
                return a.latency - b.latency;
            });
        }
    }

    private async checkHyperionProviders() {
        this.activeChain.hyperionProviders = [];
        for (const api of this.activeChain.hyperionApis) {
            try {
                const tref = Date.now();
                const response: any = await this.http.get(`${api}/history/get_actions?limit=1`).toPromise();
                if (response.actions && response.actions.length === 1) {
                    const lastTimestamp = new Date(response.actions[0]['@timestamp'] + 'Z').getTime();
                    const now = Date.now();
                    this.activeChain.hyperionProviders.push({
                        url: api,
                        latency: (now - tref),
                        diff: (now - lastTimestamp)
                    });
                }
            } catch (e) {
                console.log(`${api} is not available`);
            }
        }
        this.sortProviders();
    }

    private async classifySigProviders() {
        for (const acc of this.accounts) {
            const [key, perm] = this.getStoredKey(acc);
            const mode = this.crypto.getPrivateKeyMode(key);
            if (mode) {
                acc.type = mode;
                acc.storedKey = key;
                acc.storedPerm = perm;
            }
        }
    }
}
