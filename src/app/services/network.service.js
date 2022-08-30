"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var NetworkService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkService = void 0;
const core_1 = require("@angular/core");
const accounts_service_1 = require("./accounts.service");
const router_1 = require("@angular/router");
const rxjs_1 = require("rxjs");
const crypto_service_1 = require("./crypto/crypto.service");
const voting_service_1 = require("./voting.service");
const eosjs2_service_1 = require("./eosio/eosjs2.service");
const http_1 = require("@angular/common/http");
const config_1 = require("../../config");
const environment_1 = require("../../environments/environment");
const error_1 = require("../../error");
const defaultCompilerIds = {
    DEFAULT: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
    LIBERLAND: 'cc7d69ef6216ba33be85e9b256fbfbad4e103c14e0f115b281b2f954838c463a'
};
let NetworkService = NetworkService_1 = class NetworkService {
    constructor(http, eosjs, router, aService, voting, crypto) {
        this.http = http;
        this.eosjs = eosjs;
        this.router = router;
        this.aService = aService;
        this.voting = voting;
        this.crypto = crypto;
        this.selectedEndpoint = new rxjs_1.BehaviorSubject(null);
        this.networkingReady = new rxjs_1.BehaviorSubject(false);
        this.connected = false;
        this.lastEndpoint = '';
        this.autoMode = false;
        this.activeChain = null;
        this.isStarting = false;
        this.customChainModal = false;
        this.initChainsConfig();
        this.validEndpoints = [];
        this.status = '';
        this.connectionTimeout = null;
        this.events = new core_1.EventEmitter(true);
    }
    static groupBy(list, keyGetter) {
        const map = new Map();
        list.forEach((item) => {
            const key = keyGetter(item);
            const collection = map.get(key);
            if (!collection) {
                map.set(key, [item]);
            }
            else {
                collection.push(item);
            }
        });
        return map;
    }
    openCustomChainModal() {
        console.log('open custom chain modal');
        this.customChainModal = true;
    }
    createGroups() {
        const groupChain = NetworkService_1.groupBy(this.defaultChains, chain => chain.network);
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
                config: config_1.localConfig
            };
        }
        if (environment_1.environment.COMPILERVERSION === 'DEFAULT') {
            this.defaultChains = configSimpleos.config.chains;
        }
        else {
            this.defaultChains = configSimpleos.config.chains.filter(chain => {
                return chain.name.startsWith(environment_1.environment.COMPILERVERSION);
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
        }
        catch (e) {
            console.log(e);
        }
        let errorSimpleos = JSON.parse(localStorage.getItem('errorSimpleos'));
        if (!errorSimpleos) {
            console.log('failed to load updated config');
            errorSimpleos = {
                error: error_1.localError
            };
        }
        this.defaultErrors = errorSimpleos.error;
        this.createGroups();
        const savedChainId = localStorage.getItem('simplEOS.activeChainID');
        const EOS_MAINNET_ID = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';
        if (savedChainId) {
            this.activeChain = this.defaultChains.find((chain) => chain.id === savedChainId);
            if (!this.activeChain) {
                console.log('Saved chain not found!');
                if (environment_1.environment.COMPILERVERSION === 'DEFAULT') {
                    this.activeChain = this.defaultChains.find((chain) => chain.id === EOS_MAINNET_ID);
                    localStorage.setItem('simplEOS.activeChainID', EOS_MAINNET_ID);
                }
                else {
                    this.activeChain = this.defaultChains[0];
                    localStorage.setItem('simplEOS.activeChainID', this.activeChain.id);
                }
            }
        }
        else {
            this.activeChain = this.defaultChains.find((chain) => chain.id === EOS_MAINNET_ID);
            localStorage.setItem('simplEOS.activeChainID', EOS_MAINNET_ID);
        }
        this.aService.activeChain = this.activeChain;
        this.aService.defaultChains = this.defaultChains;
        this.aService.init();
    }
    connect(automatic) {
        return __awaiter(this, void 0, void 0, function* () {
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
            yield new Promise(resolve => {
                const evSub = this.events.asObservable().subscribe(value => {
                    if (value.event === 'connected' || value.event === 'timeout') {
                        evSub.unsubscribe();
                        resolve();
                    }
                });
            });
        });
    }
    changeChain(chainId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.activeChain = this.defaultChains.find((chain) => chain.id === chainId);
            if (this.activeChain) {
                // send to landing page if no data was found
                const lsKey = "simpleos.accounts." + chainId;
                const savedAccountData = localStorage.getItem(lsKey);
                if (!savedAccountData) {
                    yield this.router.navigateByUrl('/');
                }
                this.aService.activeChain = this.activeChain;
                this.aService.accounts = [];
                this.voting.clearMap();
                this.voting.clearLists();
                this.voting.initList = false;
                this.aService.lastAccount = null;
                localStorage.setItem('simplEOS.activeChainID', this.activeChain.id);
                yield this.connect(false);
                console.log('Network switched to: ' + this.activeChain['name']);
            }
        });
    }
    startTimeout() {
        if (!this.connectionTimeout) {
            this.connectionTimeout = setTimeout(() => {
                if (!this.networkingReady.getValue()) {
                    this.status = 'timeout';
                    clearTimeout(this.connectionTimeout);
                    this.networkingReady.next(false);
                    this.events.emit({ event: 'timeout' });
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
            }
            else {
                this.networkingReady.next(false);
            }
        }
    }
    selectedEP() {
        return this.eosjs.baseConfig.httpEndpoint;
    }
    apiCheck(server) {
        return new Promise((resolve) => {
            const refTime = new Date().getTime();
            const tempTimer = setTimeout(() => {
                server.latency = -1;
                resolve();
            }, 2000);
            try {
                this.http.get(`${server.url}/v1/chain/get_info`).toPromise().then((data) => {
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
                    }
                    else {
                        console.log(`API ${server.url} is serving a different chain id!
                            expected: ${this.activeChain.id}, got: ${data['chain_id']}`);
                    }
                }).catch(() => {
                    server.latency = -1;
                    resolve();
                });
            }
            catch (e) {
                server.latency = -1;
                resolve();
            }
        });
    }
    callStartupConn(server) {
        if (this.connected === true) {
            this.selectedEndpoint.next(server);
            this.startup(null).catch(console.log);
        }
    }
    startup(url) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isStarting) {
                console.log('startup was already running...');
                return;
            }
            else {
                this.isStarting = true;
            }
            let endpoint = url;
            if (!url) {
                endpoint = this.selectedEndpoint.getValue().url;
                console.log('using saved endpoint:', endpoint);
            }
            else {
                this.status = '';
                console.log('startup called on: ', url);
            }
            this.networkingReady.next(false);
            // prevent double load after quick connection mode
            if (endpoint !== this.lastEndpoint || this.autoMode === true) {
                // define endpoint and initialize rpc
                this.eosjs.initRPC(endpoint, this.activeChain.id, this.activeChain.endpoints);
                if (this.activeChain.name === 'EOS MAINNET' || this.activeChain.name === 'EOS JUNGLE 3') {
                    this.eosjs.initRelayRPC();
                }
                this.lastEndpoint = endpoint;
                this.autoMode = false;
                this.defaultChains.find(c => c.id === this.activeChain.id).lastNode = this.lastEndpoint;
                // get saved accounts
                const savedAccounts = this.aService.readStoredAccounts();
                if (savedAccounts && savedAccounts.length > 0) {
                    // load saved accounts for this chain
                    console.log(`loading local data for ${savedAccounts.length} accounts...`);
                    yield this.aService.loadLocalAccounts(savedAccounts);
                    if (this.aService.lastAccount) {
                        this.aService.select(this.aService.accounts.findIndex((a) => {
                            return a.name === this.aService.lastAccount;
                        }));
                    }
                    else {
                        this.aService.initFirst();
                    }
                    // navigate to the account home page
                    yield this.router['navigate'](['dashboard', 'home']);
                }
                else {
                    if (this.crypto.getLockStatus()) {
                        yield this.router['navigate'](['']);
                    }
                    else {
                        // navigate to landing if on any other page
                        if (this.router.url !== '/landing') {
                            yield this.router['navigate'](['landing']);
                        }
                    }
                }
                this.networkingReady.next(true);
                this.events.emit({ event: 'connected' });
                if (this.connectionTimeout) {
                    clearTimeout(this.connectionTimeout);
                    this.isStarting = false;
                    this.connectionTimeout = null;
                }
            }
        });
    }
};
NetworkService = NetworkService_1 = __decorate([
    (0, core_1.Injectable)({
        providedIn: 'root',
    }),
    __metadata("design:paramtypes", [http_1.HttpClient,
        eosjs2_service_1.Eosjs2Service,
        router_1.Router,
        accounts_service_1.AccountsService,
        voting_service_1.VotingService,
        crypto_service_1.CryptoService])
], NetworkService);
exports.NetworkService = NetworkService;
//# sourceMappingURL=network.service.js.map