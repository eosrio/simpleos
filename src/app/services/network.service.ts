import {EventEmitter, Injectable} from '@angular/core';
import {AccountsService} from './accounts.service';
import {Router} from '@angular/router';

import {BehaviorSubject} from 'rxjs';
import {CryptoService} from './crypto/crypto.service';
import {VotingService} from './voting.service';
import {Eosjs2Service} from './eosio/eosjs2.service';
import {HttpClient} from '@angular/common/http';
import {localConfig} from '../../config';
import {environment} from '../../environments/environment';

export interface Endpoint {
    url: string;
    owner: string;
    latency: number;
    filters: any[];
    chain: string;
}

const defaultCompilerIds = {
    DEFAULT: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
    LIBERLAND: 'cc7d69ef6216ba33be85e9b256fbfbad4e103c14e0f115b281b2f954838c463a'
};

@Injectable({
    providedIn: 'root',
})
export class NetworkService {

    eos: any;
    public mainnetId: string;
    public: string;
    validEndpoints: Endpoint[];
    status: string;
    connectionTimeout: any;
    selectedEndpoint = new BehaviorSubject<Endpoint>(null);
    networkingReady = new BehaviorSubject<boolean>(false);

    connected = false;
    lastEndpoint = '';
    autoMode = false;

    public activeChain = null;
    defaultChains: any[];
    selectGroup: any[];
    isStarting = false;

    customChainModal = false;
    events: EventEmitter<any>;

    static groupBy(list, keyGetter) {
        const map = new Map();
        list.forEach((item) => {
            const key = keyGetter(item);
            const collection = map.get(key);
            if (!collection) {
                map.set(key, [item]);
            } else {
                collection.push(item);
            }
        });
        return map;
    }

    constructor(
        private http: HttpClient,
        private eosjs: Eosjs2Service,
        private router: Router,
        private aService: AccountsService,
        private voting: VotingService,
        private crypto: CryptoService,
    ) {
        this.initChainsConfig();
        this.validEndpoints = [];
        this.status = '';
        this.connectionTimeout = null;
        this.events = new EventEmitter(true);
    }

    openCustomChainModal() {
        console.log('open custom chain modal');
        this.customChainModal = true;
    }

    createGroups() {
        const groupChain = NetworkService.groupBy(this.defaultChains, chain => chain.network);
        this.selectGroup = [];
        const mainnetList = groupChain.get('MAINNET');
        if (mainnetList) {
            this.selectGroup.push({
                'name': 'MAINNETS',
                'chains': mainnetList,
            });
        }
        const testnetList = groupChain.get('TESTNET');
        if (testnetList) {
            this.selectGroup.push({
                'name': 'TESTNETS',
                'chains': testnetList,
            });
        }
    }

    initChainsConfig() {

        let configSimpleos = JSON.parse(localStorage.getItem('configSimpleos'));
        if (!configSimpleos) {
            console.log('failed to load updated config');
            configSimpleos = {
                config: localConfig
            };
        }

        if (environment.COMPILERVERSION === 'DEFAULT') {
            this.defaultChains = configSimpleos.config.chains;
        } else {
            this.defaultChains = configSimpleos.config.chains.filter(chain => {
                return chain.name.startsWith(environment.COMPILERVERSION);
            });
        }

        // load custom chains
        try {
            const customChains = JSON.parse(localStorage.getItem('custom_chains'));
            if (customChains) {
                for (const chain of customChains) {
                    this.defaultChains.push(chain);
                    console.log(`Added ${chain.name} with id ${chain.id}`);
                }
            }
        } catch (e) {
            console.log(e);
        }

        this.createGroups();

        const savedChainId = localStorage.getItem('simplEOS.activeChainID');
        const EOS_MAINNET_ID = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';

        if (savedChainId) {
            this.activeChain = this.defaultChains.find((chain) => chain.id === savedChainId);
            if (!this.activeChain) {
                console.log('Saved chain not found!');
                if (environment.COMPILERVERSION === 'DEFAULT') {
                    this.activeChain = this.defaultChains.find((chain) => chain.id === EOS_MAINNET_ID);
                    localStorage.setItem('simplEOS.activeChainID', EOS_MAINNET_ID);
                } else {
                    this.activeChain = this.defaultChains[0];
                    localStorage.setItem('simplEOS.activeChainID', this.activeChain.id);
                }
            }
        } else {
            this.activeChain = this.defaultChains.find((chain) => chain.id === EOS_MAINNET_ID);
            localStorage.setItem('simplEOS.activeChainID', EOS_MAINNET_ID);
        }
        this.aService.activeChain = this.activeChain;
        this.aService.defaultChains = this.defaultChains;
        this.aService.init();
    }

    async connect(automatic: boolean) {
        this.autoMode = automatic;
        this.status = '';
        this.mainnetId = '';
        this.aService.activeChain = this.activeChain;
        this.mainnetId = this.activeChain['id'];
        this.networkingReady.next(false);
        const pQueue = [];
        this.connected = false;
        this.activeChain['endpoints'].forEach((apiNode) => {
            pQueue.push(this.apiCheck(apiNode));
        });
        Promise.all(pQueue).then(() => {
            this.extractValidNode();
        });
        this.startTimeout();
        await new Promise(resolve => {
            const evSub = this.events.asObservable().subscribe(value => {
                if (value.event === 'connected' || value.event === 'timeout') {
                    evSub.unsubscribe();
                    resolve();
                }
            });
        });
    }

    async changeChain(chainId) {
        this.activeChain = this.defaultChains.find((chain) => chain.id === chainId);
        if (this.activeChain) {

            // send to landing page if no data was found
            const lsKey = "simpleos.accounts." + chainId;
            const savedAccountData = localStorage.getItem(lsKey);

            if (!savedAccountData) {
                await this.router.navigateByUrl('/');
            }

            this.aService.activeChain = this.activeChain;
            this.aService.accounts = [];
            this.voting.clearMap();
            this.voting.clearLists();
            this.voting.initList = false;
            this.aService.lastAccount = null;
            localStorage.setItem('simplEOS.activeChainID', this.activeChain.id);
            await this.connect(false);
            console.log('Network switched to: ' + this.activeChain['name']);
        }
    }

    startTimeout() {
        if (!this.connectionTimeout) {
            this.connectionTimeout = setTimeout(() => {
                if (!this.networkingReady.getValue()) {
                    this.status = 'timeout';
                    clearTimeout(this.connectionTimeout);
                    this.networkingReady.next(false);
                    this.events.emit({event: 'timeout'});
                    this.connectionTimeout = null;
                    this.isStarting = false;
                }
            }, 5000);
        }
    }

    extractValidNode() {
        this.validEndpoints = [];
        this.activeChain.endpoints.forEach((apiNode) => {
            if (apiNode.latency > 0 && apiNode.latency < 1200) {
                this.validEndpoints.push(apiNode);
            }
        });
        this.selectEndpoint();
    }

    selectEndpoint() {
        let latency = 2000;
        if (this.connected === false) {
            for (const node of this.validEndpoints) {
                if (node.latency < latency && node.latency > 1) {
                    latency = node.latency;
                    this.selectedEndpoint.next(node);
                }
            }

            if (this.selectedEndpoint.getValue()) {
                console.log('Best Server Selected!', this.selectedEndpoint.getValue().url);
                this.startup(null).catch(console.log);
            } else {
                this.networkingReady.next(false);
            }
        }
    }

    selectedEP() {
        return this.eosjs.baseConfig.httpEndpoint;
    }

    apiCheck(server: Endpoint) {
        return new Promise((resolve) => {
            const refTime = new Date().getTime();
            const tempTimer = setTimeout(() => {
                server.latency = -1;
                resolve();
            }, 2000);
            this.http.get(`${server.url}/v1/chain/get_info`).toPromise().then((data: any) => {
                if (data['chain_id'] === this.activeChain.id) {
                    server.latency = ((new Date().getTime()) - refTime);
                    clearTimeout(tempTimer);
                    if (server.latency > 1 && server.latency < 200) {
                        if (this.connected === false) {
                            this.connected = true;
                            this.callStartupConn(server);
                        }
                    }
                    resolve();
                } else {
                    console.log(`API ${server.url} is serving a different chain id!
                        expected: ${this.activeChain.id}, got: ${data['chain_id']}`);
                }
            }).catch(() => {
                server.latency = -1;
                resolve();
            });
        });
    }

    callStartupConn(server) {
        if (this.connected === true) {
            this.selectedEndpoint.next(server);
            this.startup(null).catch(console.log);
        }
    }

    async startup(url) {
        if (this.isStarting) {
            console.log('startup was already running...');
            return;
        } else {
            this.isStarting = true;
        }
        let endpoint = url;
        if (!url) {
            endpoint = this.selectedEndpoint.getValue().url;
            console.log('using saved endpoint:', endpoint);
        } else {
            this.status = '';
            console.log('startup called on: ', url);
        }

        this.networkingReady.next(false);

        // prevent double load after quick connection mode
        if (endpoint !== this.lastEndpoint || this.autoMode === true) {

            // define endpoint and initialize rpc
            this.eosjs.initRPC(endpoint, this.activeChain.id, this.activeChain.endpoints);
            this.lastEndpoint = endpoint;
            this.autoMode = false;
            this.defaultChains.find(c => c.id === this.activeChain.id).lastNode = this.lastEndpoint;

            // get saved accounts
            const savedAccounts = this.aService.readStoredAccounts();

            if (savedAccounts && savedAccounts.length > 0) {

                // load saved accounts for this chain
                console.log(`loading local data for ${savedAccounts.length} accounts...`);
                await this.aService.loadLocalAccounts(savedAccounts);

                if (this.aService.lastAccount) {
                    this.aService.select(this.aService.accounts.findIndex((a) => {
                        return a.name === this.aService.lastAccount;
                    }));
                } else {
                    this.aService.initFirst();
                }

                // navigate to the wallet page
                await this.router['navigate'](['dashboard', 'wallet']);

            } else {
                if (this.crypto.getLockStatus()) {
                    await this.router['navigate'](['']);
                } else {
                    // navigate to landing if on any other page
                    if (this.router.url !== '/landing') {
                        await this.router['navigate'](['landing']);
                    }
                }
            }

            this.networkingReady.next(true);
            this.events.emit({event: 'connected'});
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.isStarting = false;
                this.connectionTimeout = null;
            }
        }
    }

}
