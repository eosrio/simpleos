import {Component, OnInit} from '@angular/core';
import {NetworkService} from "../services/network.service";
import {JsonRpc} from "eosjs/dist";
import {GetInfoResult} from "eosjs/dist/eosjs-rpc-interfaces";
import {HttpClient} from "@angular/common/http";
import {awaitConfigAndCache} from "ngx-lottie/src/utils";
import {ElectronService} from "ngx-electron";

@Component({
    selector: 'app-custom-chain-modal',
    templateUrl: './custom-chain-modal.component.html',
    styleUrls: ['./custom-chain-modal.component.css']
})
export class CustomChainModalComponent implements OnInit {

    apiUrl: string;

    chainInfo: GetInfoResult;
    private tempRpc: JsonRpc;

    chainId: string;
    symbol: string;
    precision: number;
    hyperionUrl: string;
    lastActionTs: string;
    proxyRegistry: string;
    chainName = 'CUSTOM CHAIN';
    chainType = 'TESTNET'
    eosioAlias = 'eosio';
    tokenContract = 'eosio.token';
    nativeHistoryStatus = false;
    hyperionHistoryStatus = false;
    toggleHistory = true;
    toggleSend = true;
    toggleRes = true;
    toggleVote = true;
    toggleRex = false;
    toggleForum = false;
    toggleStake = true;

    constructor(
        public network: NetworkService,
        private http: HttpClient,
        private electron: ElectronService
    ) {
        this.chainInfo = {} as GetInfoResult;
    }

    async checkEndpoint() {
        if (!this.apiUrl) {
            this.chainId = '';
            return;
        }
        console.log(`testing ${this.apiUrl}`);
        if (this.apiUrl.split('://').length === 1) {
            this.apiUrl = `http://${this.apiUrl}`;
        }
        this.tempRpc = new JsonRpc(this.apiUrl);
        try {
            this.chainInfo = await this.tempRpc.get_info();
            this.chainId = this.chainInfo.chain_id;
            await this.lookupSystemToken();
            await this.checkHyperionHistory();
            await this.checkNativeHistory();
        } catch (e) {
            console.log(e);
        }
    }

    async lookupSystemToken() {
        if (this.tokenContract) {
            try {
                const data = await this.tempRpc.get_currency_balance(this.tokenContract, this.eosioAlias);
                console.log(data);
                if (data.length > 0) {
                    const arr = data[0].split(' ');
                    this.symbol = arr[1];
                    this.precision = arr[0].split('.')[1].length;
                }
            } catch (e) {
                this.electron.remote.dialog.showErrorBox(
                    'Autocomplete Error',
                    `Failed to get native token information from ${this.tokenContract}`);
                this.precision = null;
                this.symbol = null;
                this.tokenContract = '';
                console.log(e);
            }
        }
    }

    closeModal() {
        this.network.customChainModal = false;
    }

    ngOnInit(): void {
    }

    finish() {
        this.closeModal();
    }

    async checkHyperion() {
        if (!this.hyperionUrl) {
            return;
        }
        try {
            const result: any = await this.http.get(`${this.hyperionUrl}/history/get_actions?limit=1`).toPromise();
            console.log(result);
            if (result.actions && result.actions.length === 1) {
                this.lastActionTs = result.actions[0]['@timestamp'];
            }
        } catch (e) {
            console.log(e);
        }
    }

    async checkProxyContract() {
        if (this.proxyRegistry && this.tempRpc) {
            try {
                const results = await this.tempRpc.get_table_rows({
                    json: true,
                    code: this.proxyRegistry,
                    scope: this.proxyRegistry,
                    table: 'proxies',
                    limit: 1
                });
                if (results.rows.length === 1) {
                    console.log(results.rows[0]);
                }
            } catch (e) {

            }
        }
    }

    testConnection() {
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
                "forum": this.toggleForum,
                "rex": this.toggleRex,
                "dapps": true,
                "newAcc": true,
                "addAcc": true
            },
            "system": ["eosio", "eosio.token", "eosio.msig", "eosio.forum"],
            "endpoints": [
                {"url": this.apiUrl, "owner": "Custom", "latency": 0},
            ],
            "explorers": [],
            "exchanges": {}
        }
        this.network.defaultChains.push(customChain);
        this.network.createGroups();
        this.network.changeChain(this.chainId);

        // store custom chains
        const savedData = localStorage.getItem('custom_chains');
        if (savedData) {
            try {
                const chains = JSON.parse(savedData);
                chains.push(customChain);
                localStorage.setItem('custom_chains', JSON.stringify(chains));
            } catch (e) {
                console.log(e);
            }
        } else {
            localStorage.setItem('custom_chains', JSON.stringify([customChain]));
        }
    }

    async checkNativeHistory() {
        console.log('testing native history...');
        this.nativeHistoryStatus = false;
        try {
            const results: any = await this.tempRpc.history_get_actions(this.eosioAlias, -1, -1);
            if (results.actions && results.actions.length === 1) {
                this.nativeHistoryStatus = true;
            }
        } catch (e) {
            console.log(e);
        }
    }

    async checkHyperionHistory() {
        try {
            const result: any = await this.http.get(`${this.apiUrl}/v2/history/get_actions?limit=1`).toPromise();
            console.log(result);
            if (result.actions && result.actions.length === 1) {
                this.lastActionTs = result.actions[0]['@timestamp'];
                this.hyperionHistoryStatus = true;
                this.hyperionUrl = this.apiUrl + '/v2';
            }
        } catch (e) {
            console.log(e);
        }
    }

    onModalClose(status: boolean) {
        console.log(status);
        this.network.customChainModal = status;
    }

    async deleteStoredData() {
        try {
            const chains = JSON.parse(localStorage.getItem('custom_chains'));
            if (chains && chains.length > 0) {
                const confirmation = await this.electron.remote.dialog.showMessageBox({
                    title: 'Clear all custom chains',
                    type: 'question',
                    message: `Are you sure you want to remove ${chains.length} custom ${chains.length === 1 ? 'chain' : 'chains'} ?`,
                    buttons: ["NO", "YES"]
                });
                console.log(confirmation);
                if (confirmation.response === 1) {
                    localStorage.removeItem('custom_chains');
                }
            } else {
                await this.electron.remote.dialog.showMessageBox({type: 'info', message: "No custom chains to remove"});
            }
        } catch (e) {
            console.log(e);
        }
    }
}
