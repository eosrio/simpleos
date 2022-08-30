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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomChainModalComponent = void 0;
const core_1 = require("@angular/core");
const network_service_1 = require("../services/network.service");
const dist_1 = require("eosjs/dist");
const http_1 = require("@angular/common/http");
const electron_1 = require("electron");
let CustomChainModalComponent = class CustomChainModalComponent {
    constructor(network, http) {
        this.network = network;
        this.http = http;
        this.chainName = 'CUSTOM CHAIN';
        this.chainType = 'TESTNET';
        this.eosioAlias = 'eosio';
        this.tokenContract = 'eosio.token';
        this.nativeHistoryStatus = false;
        this.hyperionHistoryStatus = false;
        this.toggleHistory = true;
        this.toggleSend = true;
        this.toggleRes = true;
        this.toggleVote = true;
        this.toggleRex = false;
        this.toggleStake = true;
        this.validated = false;
        this.testing = false;
        this.chainInfo = {};
        this.busy = false;
        this.endpointErr = false;
    }
    checkEndpoint() {
        return __awaiter(this, void 0, void 0, function* () {
            this.busy = true;
            this.endpointErr = false;
            if (!this.apiUrl) {
                this.chainId = '';
                this.precision = null;
                this.symbol = null;
                this.tokenContract = 'eosio.token';
                this.hyperionUrl = '';
                this.nativeHistoryStatus = false;
                this.hyperionHistoryStatus = false;
                this.busy = false;
                this.endpointErr = false;
                return;
            }
            console.log(`testing ${this.apiUrl}`);
            if (this.apiUrl.split('://').length === 1) {
                this.apiUrl = `http://${this.apiUrl}`;
            }
            this.tempRpc = new dist_1.JsonRpc(this.apiUrl);
            try {
                this.chainInfo = yield this.tempRpc.get_info();
                this.chainId = this.chainInfo.chain_id;
                yield this.lookupSystemToken();
                yield this.checkHyperionHistory();
                yield this.checkNativeHistory();
            }
            catch (e) {
                console.log(e);
                this.chainId = '';
                this.precision = null;
                this.symbol = null;
                this.tokenContract = 'eosio.token';
                this.hyperionUrl = '';
                this.nativeHistoryStatus = false;
                this.hyperionHistoryStatus = false;
                this.endpointErr = true;
            }
            this.busy = false;
        });
    }
    lookupSystemToken() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.tokenContract) {
                try {
                    const data = yield this.tempRpc.get_currency_balance(this.tokenContract, this.eosioAlias);
                    console.log(data);
                    if (data.length > 0) {
                        const arr = data[0].split(' ');
                        this.symbol = arr[1];
                        this.precision = arr[0].split('.')[1].length;
                    }
                }
                catch (e) {
                    yield electron_1.ipcRenderer.invoke('show-error-box', {
                        title: 'Autocomplete Error',
                        content: `Failed to get native token information from ${this.tokenContract}`
                    });
                    this.precision = null;
                    this.symbol = null;
                    this.tokenContract = '';
                    console.log(e);
                }
            }
        });
    }
    closeModal() {
        this.network.customChainModal = false;
    }
    ngOnInit() {
    }
    finish() {
        // store custom chains
        const savedData = localStorage.getItem('custom_chains');
        if (savedData) {
            try {
                const chains = JSON.parse(savedData);
                chains.push(this.validatedChain);
                localStorage.setItem('custom_chains', JSON.stringify(chains));
            }
            catch (e) {
                console.log(e);
            }
        }
        else {
            localStorage.setItem('custom_chains', JSON.stringify([this.validatedChain]));
        }
        this.closeModal();
    }
    checkHyperion() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.hyperionUrl) {
                return;
            }
            try {
                const result = yield this.http.get(`${this.hyperionUrl}/history/get_actions?limit=1`).toPromise();
                console.log(result);
                if (result.actions && result.actions.length === 1) {
                    this.lastActionTs = result.actions[0]['@timestamp'];
                }
            }
            catch (e) {
                console.log(e);
            }
        });
    }
    checkProxyContract() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.proxyRegistry && this.tempRpc) {
                try {
                    const results = yield this.tempRpc.get_table_rows({
                        json: true,
                        code: this.proxyRegistry,
                        scope: this.proxyRegistry,
                        table: 'proxies',
                        limit: 1
                    });
                    if (results.rows.length === 1) {
                        console.log(results.rows[0]);
                    }
                }
                catch (e) {
                }
            }
        });
    }
    testConnection() {
        if (!this.chainId || !this.apiUrl) {
            return;
        }
        this.testing = true;
        const customChain = {
            "id": this.chainId,
            "symbol": this.symbol,
            "icon": "generic.png",
            "precision": this.precision,
            "name": this.chainName,
            "network": this.chainType,
            "firstApi": this.apiUrl,
            "historyApi": this.hyperionUrl,
            "hyperionApis": [this.hyperionUrl],
            "forumTally": "",
            "eosrioBP": "",
            "proxyRegistry": this.proxyRegistry,
            "lastNode": "",
            "logoSrc": "",
            "backdrop": "",
            "features": {
                "history": this.toggleHistory,
                "send": this.toggleSend,
                "resource": this.toggleRes,
                "vote": this.toggleVote,
                "staking": this.toggleStake,
                "rex": this.toggleRex,
                "dapps": true,
                "newAcc": true,
                "addAcc": true
            },
            "system": ["eosio", "eosio.token", "eosio.msig", "eosio.forum"],
            "endpoints": [
                { "url": this.apiUrl, "owner": "Custom", "latency": 0 },
            ],
            "explorers": [],
            "exchanges": {}
        };
        const existingChainId = this.network.defaultChains.findIndex(c => c.id === customChain.id);
        if (existingChainId !== -1) {
            this.network.defaultChains.splice(existingChainId, 1);
        }
        this.network.defaultChains.push(customChain);
        this.network.createGroups();
        this.network.changeChain(this.chainId);
        let readySubs = this.network.networkingReady.subscribe(value => {
            console.log('networkingReady', value);
            if (value) {
                this.validated = true;
                this.validatedChain = customChain;
                readySubs.unsubscribe();
                readySubs = null;
            }
        });
        setTimeout(() => {
            this.testing = false;
            if (readySubs) {
                readySubs.unsubscribe();
            }
        }, 5000);
    }
    checkNativeHistory() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('testing native history...');
            this.nativeHistoryStatus = false;
            try {
                const results = yield this.tempRpc.history_get_actions(this.eosioAlias, -1, -1);
                if (results.actions && results.actions.length === 1) {
                    this.nativeHistoryStatus = true;
                }
            }
            catch (e) {
                console.log(e);
            }
        });
    }
    checkHyperionHistory() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.http.get(`${this.apiUrl}/v2/history/get_actions?limit=1`).toPromise();
                console.log(result);
                if (result.actions && result.actions.length === 1) {
                    this.lastActionTs = result.actions[0]['@timestamp'];
                    this.hyperionHistoryStatus = true;
                    this.hyperionUrl = this.apiUrl + '/v2';
                }
            }
            catch (e) {
                console.log(e);
            }
        });
    }
    onModalClose(status) {
        console.log(status);
        this.network.customChainModal = status;
    }
    deleteStoredData() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const chains = JSON.parse(localStorage.getItem('custom_chains'));
                if (chains && chains.length > 0) {
                    const confirmation = yield electron_1.ipcRenderer.invoke('show-message-box', {
                        title: 'Clear all custom chains',
                        type: 'question',
                        message: `Are you sure you want to remove ${chains.length} custom ${chains.length === 1 ? 'chain' : 'chains'} ?`,
                        buttons: ["NO", "YES"]
                    });
                    if (confirmation.response === 1) {
                        localStorage.removeItem('custom_chains');
                    }
                }
                else {
                    yield electron_1.ipcRenderer.invoke('show-message-box', {
                        type: 'info',
                        message: "No custom chains to remove"
                    });
                }
            }
            catch (e) {
                console.log(e);
            }
        });
    }
};
CustomChainModalComponent = __decorate([
    (0, core_1.Component)({
        selector: 'app-custom-chain-modal',
        templateUrl: './custom-chain-modal.component.html',
        styleUrls: ['./custom-chain-modal.component.css']
    }),
    __metadata("design:paramtypes", [network_service_1.NetworkService,
        http_1.HttpClient])
], CustomChainModalComponent);
exports.CustomChainModalComponent = CustomChainModalComponent;
//# sourceMappingURL=custom-chain-modal.component.js.map