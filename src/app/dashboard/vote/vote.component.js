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
exports.VoteComponent = void 0;
const core_1 = require("@angular/core");
const voting_service_1 = require("../../services/voting.service");
const accounts_service_1 = require("../../services/accounts.service");
const forms_1 = require("@angular/forms");
const notification_service_1 = require("../../services/notification.service");
const textMaskAddons_1 = require("text-mask-addons/dist/textMaskAddons");
const crypto_service_1 = require("../../services/crypto/crypto.service");
const http_1 = require("@angular/common/http");
const moment = require("moment");
const eosjs2_service_1 = require("../../services/eosio/eosjs2.service");
const rex_component_1 = require("../rex/rex.component");
const app_component_1 = require("../../app.component");
const theme_service_1 = require("../../services/theme.service");
const transaction_factory_service_1 = require("../../services/eosio/transaction-factory.service");
const resource_service_1 = require("../../services/resource.service");
const electron_service_1 = require("../../services/electron.service");
const enf_eosjs_1 = require("enf-eosjs");
const eosjs_jssig_1 = require("enf-eosjs/dist/eosjs-jssig");
const PrivateKey_1 = require("../../helpers/PrivateKey");
let VoteComponent = class VoteComponent {
    constructor(voteService, http, trxFactory, aService, eosjs, crypto, fb, toaster, cdr, app, theme, electron, resource) {
        this.voteService = voteService;
        this.http = http;
        this.trxFactory = trxFactory;
        this.aService = aService;
        this.eosjs = eosjs;
        this.crypto = crypto;
        this.fb = fb;
        this.toaster = toaster;
        this.cdr = cdr;
        this.app = app;
        this.theme = theme;
        this.electron = electron;
        this.resource = resource;
        this.nVotes = 0;
        this.nVotesProxy = 0;
        this.numberMask = (0, textMaskAddons_1.createNumberMask)({
            prefix: '',
            allowDecimal: true,
            includeThousandsSeparator: false,
            decimalLimit: this.aService.activeChain.precision,
        });
        this.percentMask = (0, textMaskAddons_1.createNumberMask)({
            prefix: '',
            allowDecimal: true,
            includeThousandsSeparator: false,
            decimalLimit: 1,
            integerLimit: 3,
        });
        this.showAdvancedRatio = false;
        this.initOptions = {
            renderer: 'z',
            width: 1000,
            height: 400,
        };
        this.netWeight = '';
        this.cpuWeight = '';
        this.netSelf = '';
        this.cpuSelf = '';
        this.cpuWeightN = 0;
        this.netWeightN = 0;
        this.stakingRatio = 75;
        this.listProxyVote = [];
        this.subscriptions = [];
        this.selectedProxy = '';
        this.claimPublicKey = '';
        this.isDestroyed = false;
        this.gbmBalance = 0;
        this.gbmEstimatedDaily = 0;
        this.voteRewardsDaily = 0;
        this.autoClaimConfig = {};
        this.selectedAccountName = '';
        this.claimSetupWarning = '';
        this.basePath = '';
        this.precision = '';
        this.mode = 'local';
        this.basePath = this.electron.app.getPath('appData') + '/simpleos-config';
        this.isValidAccount = true;
        this.max = 100;
        this.min = 0;
        this.minstake = false;
        this.busyList = false;
        this.valuetoStake = '';
        this.unstaking = 0;
        this.unstakeTime = '';
        this.stakeModal = false;
        this.voteModal = false;
        this.busy = false;
        this.totalBalance = 0;
        this.stakedBalance = 0;
        this.totalStaked = 0;
        this.votedDecay = 0;
        this.votedEOSDecay = 0;
        this.wrongpass = '';
        this.stakerr = '';
        this.fromAccount = '';
        this.stakedisabled = true;
        this.autoClaimStatus = false;
        this.enableLinkAuth = true;
        this.singleSelectionBP = {
            name: '',
        };
        this.isManually = false;
        this.selectedVotes = [];
        this.frmForProxy = this.fb.group({
            proxyName: ['', [forms_1.Validators.required]],
        });
        this.subscriptions.push(this.aService.lastUpdate.asObservable().subscribe(value => {
            if (value.account === this.aService.selected.getValue().name) {
                this.updateBalances();
            }
        }));
        this.options = {
            geo: {
                map: 'world',
                roam: false,
                left: 0,
                right: 0,
                silent: true,
                aspectScale: 1,
                itemStyle: {
                    normal: {
                        borderColor: '#1076a1',
                        color: '#17181c',
                    },
                },
            },
            tooltip: {
                formatter: (params) => '<strong>' + params.data.location +
                    '</strong><br> Rank: ' + params.data.position +
                    '<br> Status:  ' + params.data.status,
            },
            animationDuration: 1500,
            animationEasingUpdate: 'quinticInOut',
            series: [
                {
                    type: 'graph',
                    coordinateSystem: 'geo',
                    symbol: 'pin',
                    symbolSize: 15,
                    data: this.voteService.data,
                    animation: true,
                    animationDuration: 2000,
                    focusNodeAdjacency: true,
                    itemStyle: {
                        normal: {
                            borderColor: '#fff',
                            borderWidth: 1,
                            shadowBlur: 10,
                            color: '#fff',
                            shadowColor: 'rgba(0, 0, 0, 0.3)',
                        },
                    },
                    label: {
                        position: 'top',
                        formatter: '{b}',
                        show: false,
                        distance: 6,
                        fontSize: 16,
                    },
                    lineStyle: {
                        color: 'source',
                        curveness: 0.01,
                        width: 2,
                    },
                    force: {
                        repulsion: 600,
                        edgeLength: 150,
                    },
                    emphasis: {
                        lineStyle: {
                            width: 10,
                        },
                    },
                },
            ],
        };
    }
    ngOnInit() {
        const selectedAcc = this.aService.selected.getValue();
        if (this.aService.activeChain.features.vote) {
            this.setCheckListVote(selectedAcc.name);
        }
    }
    ngOnDestroy() {
        this.isDestroyed = true;
        this.voteService.proxies = [];
        this.voteService.bps = [];
        this.subscriptions.forEach(s => {
            s.unsubscribe();
        });
    }
    ngAfterViewInit() {
        const sub = this.aService.selected
            .asObservable()
            .subscribe((selected) => {
            this.onAccountChanged(selected);
        });
        this.subscriptions.push(sub);
    }
    onAccountChanged(selected) {
        this.totalStaked = 0;
        this.votedDecay = 0;
        this.votedEOSDecay = 0;
        if (selected && selected.name && this.selectedAccountName !== selected.name) {
            const precision = Math.pow(10, this.aService.activeChain.precision);
            this.precision = '1.0-' + this.aService.activeChain.precision;
            if (!this.aService.activeChain.name.startsWith('LIBERLAND')) {
                this.voteService.currentVoteType(selected);
                if (this.voteService.proxies.length === 0 ||
                    this.voteService.bps.length === 0) {
                    console.log('from subscriber', this.voteService.voteType);
                    this.voteOption(this.voteService.voteType);
                }
            }
            this.fromAccount = selected.name;
            this.selectedAccountName = selected.name;
            this.totalBalance = selected.full_balance;
            this.stakedBalance = selected.staked;
            this.unstaking = selected.unstaking;
            this.unstakeTime = moment.utc(selected.unstakeTime).add(72, 'hours').fromNow();
            if (this.totalBalance > 0) {
                this.valuetoStake = this.stakedBalance.toString();
            }
            else {
                this.valuetoStake = '0';
            }
            this.cpuWeight = selected.details.total_resources.cpu_weight;
            this.netWeight = selected.details.total_resources.net_weight;
            if (selected.details.self_delegated_bandwidth) {
                this.cpuSelf = selected.details.self_delegated_bandwidth.cpu_weight.split(' ')[0];
                this.netSelf = selected.details.self_delegated_bandwidth.net_weight.split(' ')[0];
            }
            else {
                this.cpuSelf = '';
                this.netSelf = '';
            }
            if (!this.aService.activeChain.name.startsWith('LIBERLAND')) {
                this.loadPlacedVotes(selected);
                this.cpuWeight = selected.details.total_resources.cpu_weight;
                this.netWeight = selected.details.total_resources.net_weight;
                const cpu = rex_component_1.RexComponent.asset2Float(this.cpuWeight);
                const net = rex_component_1.RexComponent.asset2Float(this.netWeight);
                this.cpuWeightN = cpu;
                this.netWeightN = net;
                this.stakingRatio = (cpu / (cpu + net)) * 100;
                if (selected.details.voter_info) {
                    let weeks = 52;
                    let blockTimestampEpoch = 946684800;
                    if (this.aService.activeChain.symbol === 'WAX') {
                        weeks = 13;
                        blockTimestampEpoch = 946684800;
                    }
                    this.hasVote = (selected.details.voter_info.producers.length > 0 || selected.details.voter_info.proxy !== '');
                    this.totalStaked = (selected.details.voter_info.staked / precision);
                    const a = (moment().unix() - blockTimestampEpoch);
                    const b = parseInt('' + (a / 604800), 10) / weeks;
                    const decayEOS = (selected.details.voter_info.last_vote_weight / Math.pow(2, b) / precision);
                    this.votedEOSDecay = this.totalStaked - decayEOS;
                    if (selected.details.voter_info.last_vote_weight > 0) {
                        this.votedDecay = 100 - Math.round(((decayEOS * 100) / this.totalStaked) * 1000) / 1000;
                    }
                }
            }
            else {
                this.hasVote = false;
            }
            this.getRexBalance(selected.name);
            if (this.aService.activeChain.name === 'WAX MAINNET') {
                this.checkWaxGBMdata(selected.name).catch(console.log);
                this.checkVoterRewards(selected.name).catch(console.log);
                this.verifyAutoClaimSetup(selected).catch(console.log);
                this.enableAutoClaim = this.toggleAutoClaim(true);
            }
            if (!this.isDestroyed) {
                this.cdr.detectChanges();
            }
        }
    }
    extOpen(value) {
        // window.shell.openExternal(value);
    }
    sliderLabel(value) {
        const val = parseInt(value.toString(), 10);
        return val.toString();
    }
    updateRatio() {
        console.log(this.stakingRatio);
    }
    updateBalances() {
        const selectedAcc = this.aService.selected.getValue();
        this.totalBalance = selectedAcc.full_balance;
        this.stakedBalance = selectedAcc.staked;
        if (selectedAcc.details.voter_info) {
            let weeks = 52;
            let blockTimestampEpoch = 946684800;
            const precision = Math.pow(10, this.aService.activeChain.precision);
            if (this.aService.activeChain.symbol === 'WAX') {
                weeks = 13;
                blockTimestampEpoch = 946684800;
            }
            this.hasVote = true;
            this.totalStaked = (selectedAcc.details.voter_info.staked / precision);
            const a = (moment().unix() - blockTimestampEpoch);
            const b = parseInt('' + (a / 604800), 10) / weeks;
            const decayEOS = (selectedAcc.details.voter_info.last_vote_weight /
                Math.pow(2, b) / precision);
            this.votedEOSDecay = this.totalStaked - decayEOS;
            if (selectedAcc.details.voter_info.last_vote_weight > 0) {
                this.votedDecay = 100 -
                    Math.round(((decayEOS * 100) / this.totalStaked) * precision) /
                        precision;
            }
        }
        else {
            this.hasVote = false;
        }
        this.getRexBalance(selectedAcc.name);
    }
    getRexBalance(acc) {
        if (this.aService.activeChain.features.rex) {
            this.eosjs.getRexData(acc).then((rexdata) => __awaiter(this, void 0, void 0, function* () {
                let amount = 0;
                if (rexdata.rexbal !== undefined) {
                    const balance = rexdata.rexbal.rex_balance.split(' ');
                    amount = parseFloat(balance[0]);
                }
                this.hasRex = amount > 0;
            }));
        }
        else {
            this.hasRex = false;
        }
    }
    storeConfig() {
        try {
            const filename = this.basePath + '/autoclaim.json';
            const data = JSON.stringify(this.autoClaimConfig, null, '\t');
            this.electron.fs.writeFileSync(filename, data);
        }
        catch (e) {
            console.log(e);
        }
    }
    toggleAutoClaim(check) {
        try {
            const filename = this.basePath + '/autoclaim.json';
            if (this.electron.fs.existsSync(filename)) {
                const data = JSON.parse(this.electron.fs.readFileSync(filename).toString());
                if (check) {
                    return data.enabled;
                }
                data.enabled = !(data.enabled);
                this.enableAutoClaim = data.enabled;
                this.autoClaimStatus = data.enabled;
                console.log(data);
                this.electron.fs.writeFileSync(filename, JSON.stringify(data, null, '\t'));
            }
            else {
                const data = JSON.stringify(this.autoClaimConfig, null, '\t');
                this.electron.fs.writeFileSync(filename, data);
            }
        }
        catch (e) {
            console.log(e);
        }
        this.verifyAutoClaimSetup(this.aService.selected.getValue()).catch(console.log);
        return false;
    }
    IsJsonString(str) {
        try {
            JSON.parse(str);
        }
        catch (e) {
            return false;
        }
        return true;
    }
    verifyAutoClaimSetup(selected) {
        return __awaiter(this, void 0, void 0, function* () {
            // this.autoClaimStatus = false;
            this.claimSetupWarning = '';
            const filename = this.basePath + '/autoclaim.json';
            if (!this.electron.fs.existsSync(filename)) {
                console.log('autoclaim file not present, creating...');
            }
            else {
                if (this.IsJsonString(this.electron.fs.readFileSync(filename))) {
                    this.autoClaimConfig = JSON.parse(this.electron.fs.readFileSync(filename).toString());
                }
                else {
                    this.storeConfig();
                }
            }
            if (this.autoClaimConfig.enabled) {
                if (this.autoClaimConfig['WAX-GBM']) {
                    const accJob = this.autoClaimConfig['WAX-GBM'].jobs.find(j => j.account === selected.name);
                    if (accJob) {
                        const details = yield this.eosjs.rpc.get_account(selected.name);
                        if (details) {
                            const perms = details.permissions;
                            const claimPerm = perms.find(p => p.perm_name === 'claim');
                            if (claimPerm) {
                                const claimKey = claimPerm.required_auth.keys[0].key;
                                const newClaimKey = enf_eosjs_1.Numeric.convertLegacyPublicKey(claimKey);
                                let privKey = yield this.electron.keytar.getPassword('simpleos', newClaimKey);
                                if (!privKey) {
                                    privKey = yield this.electron.keytar.getPassword('simpleos', claimKey);
                                    if (privKey) {
                                        this.electron.keytar.setPassword('simpleos', newClaimKey, privKey);
                                    }
                                }
                                if (privKey) {
                                    try {
                                        const savedKey = PrivateKey_1.PrivateKey.fromString(privKey).getPublicKey().toString();
                                        if (newClaimKey === savedKey) {
                                            this.checkLinkedAuth(selected.name).then((reqLink) => {
                                                if (reqLink.length === 0) {
                                                    this.autoClaimStatus = true;
                                                    this.claimPublicKey = newClaimKey;
                                                }
                                                else {
                                                    this.claimSetupWarning = `Linkauth missing for (${reqLink.join(', ')}). Please renew your claim key or set the permission links manually.`;
                                                }
                                            });
                                        }
                                        else {
                                            console.log('FATAL: Invalid key');
                                        }
                                    }
                                    catch (e) {
                                        console.log('Key verification failed');
                                    }
                                }
                                else {
                                    console.log('no key saved');
                                }
                            }
                            else {
                                console.log('Claim permission not defined');
                                this.claimSetupWarning = 'Claim permission not defined. Please try renewing your key.';
                            }
                        }
                    }
                }
            }
            else {
                this.enableAutoClaim = false;
                this.toggleAutoClaim(true);
            }
        });
    }
    getProxyVotes(account) {
        this.listProxyVote = [];
        this.eosjs.getAccountInfo(account).then(v => {
            if (v.voter_info) {
                this.listProxyVote = v.voter_info.producers;
            }
        });
    }
    setCheckListVote(selAcc) {
        this.subscriptions.push(this.voteService.listReady.asObservable().subscribe((state) => {
            if (state) {
                this.updateCounter();
                if (this.voteService.voteType) {
                    this.nbps = this.voteService.proxies.length;
                }
                else {
                    this.nbps = this.voteService.bps.length;
                }
            }
        }));
        this.aService.accounts.forEach((a) => {
            if (a) {
                if (a.name === selAcc) {
                    if (a.details.voter_info) {
                        if (!this.voteService.voteType) {
                            const currentVotes = a.details.voter_info.producers;
                            this.voteService.bps.forEach((elem) => {
                                elem.checked = currentVotes.indexOf(elem.account) !== -1;
                            });
                        }
                        else {
                            const currentVotes = a.details.voter_info.proxy;
                            this.voteService.proxies.forEach((elem) => {
                                elem.checked = currentVotes.indexOf(elem.account) !== -1;
                            });
                        }
                    }
                    else {
                        // this.voteService.proxies.forEach((elem) => {
                        // 	elem.checked = false;
                        // });
                    }
                }
            }
        });
    }
    processVotes() {
        this.selectedVotes = [];
        if (this.voteService.voteType && !this.voteService.hasList) {
            this.selectedVotes = [this.selectedProxy];
        }
        else {
            if (this.voteService.voteType) {
                this.voteService.proxies.forEach((px) => {
                    if (px.checked) {
                        this.selectedVotes.push(px.account);
                    }
                });
                this.getProxyVotes(this.selectedVotes[0]);
            }
            else {
                this.voteService.bps.forEach((bp) => {
                    if (bp.checked) {
                        this.selectedVotes.push(bp.account);
                    }
                });
            }
        }
        this.setVote();
    }
    updateCounter() {
        let val = 0;
        this.voteService.bps.forEach((bp) => {
            if (bp.checked) {
                val++;
            }
        });
        this.nVotes = val;
    }
    updateCounterProxy(proxy) {
        this.voteService.proxies.forEach((px) => {
            px.checked = px.account === proxy;
        });
        this.nVotes = 1;
    }
    setVote() {
        return __awaiter(this, void 0, void 0, function* () {
            const voter = this.aService.selected.getValue();
            let proxy = '';
            let currentVotes = [];
            if (this.selectedVotes.length <= 30) {
                if (!this.voteService.voteType) {
                    currentVotes = this.selectedVotes;
                    currentVotes.sort();
                }
                else {
                    proxy = this.selectedVotes[0];
                }
            }
            else {
                return new Error('Cannot cast more than 30 votes!');
            }
            const tokenName = this.aService.activeChain.symbol;
            // Transaction Signature
            const [auth, publicKey] = this.trxFactory.getAuth();
            this.mode = this.crypto.getPrivateKeyMode(publicKey);
            let termsHeader = '';
            let termsHtml = '';
            const actionTitle = `<span class="blue">vote</span>`;
            const messageHTML = `<h4 class="text-white">Do you confirm voting on the following ${this.voteService.voteType ? 'Proxy' : 'BPs'}?</h4>

        <h5 class="mt-0">${this.selectedVotes.join(', ')}</h5>`;
            if (this.aService.activeChain.name === 'EOS MAINNET') {
                termsHeader = 'By submiting this action, you agree to the voteproducer Terms & Conditions';
                termsHtml = ` The intent of the voteproducer action is to cast a valid vote for up to 30 BP candidates.
                <br><br>
                As an authorized party I, <span class="blue">${this.fromAccount}</span>, wish to vote on behalf of <span class="blue">${this.fromAccount}</span> in favor of the
                block
                producer candidates <span class="blue">${this.selectedVotes.join(', ')}</span> with
                a voting weight equal to all tokens currently owned
                by <span class="blue">${this.fromAccount}</span> and staked for CPU or bandwidth.
                <br><br>
                If I am not the beneficial owner of these shares I stipulate I have proof that I’ve been authorized to
                vote
                these shares by their beneficial owner(s).
                <br><br>
                I stipulate I have not and will not accept anything of value in exchange for these votes, on penalty of
                confiscation of these tokens, and other penalties.
                <br><br>
                I acknowledge that using any system of automatic voting, re-voting, or vote refreshing, or allowing such
                a
                system to be used on my behalf or on behalf of another, is forbidden and doing so violates this
                contract.`;
            }
            const actionsModal = [{
                    account: 'eosio',
                    name: 'voteproducer',
                    authorization: [auth],
                    data: {
                        voter: voter.name,
                        proxy: this.voteService.voteType ? proxy : '',
                        producers: this.voteService.voteType ? '' : currentVotes,
                    }
                }];
            this.trxFactory.modalData.next({
                transactionPayload: {
                    actions: actionsModal
                },
                signerAccount: auth.actor,
                signerPublicKey: publicKey,
                actionTitle,
                labelHTML: messageHTML,
                termsHeader,
                termsHTML: termsHtml,
                tk_name: tokenName,
            });
            this.trxFactory.launcher.emit({ visibility: true, mode: this.mode });
            const subs = this.trxFactory.status.subscribe((event) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const jsonStatus = JSON.parse(event);
                    if (jsonStatus.error.code === 3080004) {
                        const valueSTR = jsonStatus.error.details[0].message.split('us)');
                        const cpu = parseInt(valueSTR[0].replace(/[^0-9.]+/g, ''), 10);
                        yield this.resource.checkResource(auth, actionsModal, cpu);
                    }
                    if (jsonStatus.error.code === 3080002) {
                        const valueSTR = jsonStatus.error.details[0].message.split('>');
                        const net = parseInt(valueSTR[0].replace(/[^0-9.]+/g, ''), 10);
                        yield this.resource.checkResource(auth, actionsModal, undefined, net);
                    }
                }
                catch (e) {
                    if (event === 'done') {
                        setTimeout(() => {
                            this.aService.refreshFromChain(false).then(() => {
                                this.voteOption(this.voteService.voteType);
                                this.voteService.currentVoteType(voter.name);
                                this.loadPlacedVotes(this.aService.selected.getValue());
                                this.setCheckListVote(this.aService.selected.getValue().name);
                            }).catch(err => {
                                console.log('Refresh From Chain Error:', err);
                            });
                            // this.aService.select(this.aService.accounts.findIndex(sel => sel.name === voter.name));
                        }, 1500);
                        subs.unsubscribe();
                    }
                    if (event === 'modal_closed') {
                        subs.unsubscribe();
                    }
                }
            }));
        });
    }
    loadPlacedVotes(selectedAccount) {
        if (selectedAccount.details.voter_info) {
            if (!this.voteService.voteType) {
                const currentVotes = selectedAccount.details.voter_info.producers;
                this.nVotes = currentVotes.length;
                this.voteService.bps.forEach((elem) => {
                    elem.checked = currentVotes.indexOf(elem.account) !== -1;
                });
                this.updateCounter();
            }
            else {
                const currentVotes = selectedAccount.details.voter_info.proxy;
                this.nVotesProxy = currentVotes !== '' ? 1 : 0;
                this.voteService.proxies.forEach((elem) => {
                    elem.checked = currentVotes.indexOf(elem.account) !== -1;
                });
            }
        }
    }
    voteOption(ev) {
        this.busyList = true;
        this.voteService.voteType = ev;
        const acc = this.aService.selected.getValue();
        this.voteService.loadingProds = false;
        this.voteService.loadingProxs = false;
        this.voteService.initList = false;
        this.voteService.initListProx = false;
        if (this.voteService.voteType === 0) {
            this.voteService.listProducers().then(() => {
                this.busyList = false;
                this.setCheckListVote(acc.name);
                this.loadPlacedVotes(acc);
                this.cdr.detectChanges();
            }).catch(err => {
                console.log('Load Account List Producers Error:', err);
            });
        }
        else if (this.voteService.voteType === 1) {
            this.voteService.listProxies().then(() => {
                this.busyList = false;
                this.setCheckListVote(acc.name);
                this.loadPlacedVotes(acc);
                this.cdr.detectChanges();
            }).catch(err => {
                console.log('Load Account List Proxies Error:', err);
            });
        }
    }
    validateProxy(account) {
        this.eosjs.getAccountInfo(account).then(() => {
            this.isValidAccount = true;
            this.selectedProxy = account;
            this.processVotes();
        }).catch(() => {
            console.log('error');
            this.isValidAccount = false;
        });
    }
    checkLinkedAuthHyperionMulti(account) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.aService.activeChain.hyperionApis) {
                return;
            }
            for (const api of this.aService.activeChain.hyperionApis) {
                const url = api + '/history/get_actions?account=' + account + '&filter=eosio:linkauth';
                try {
                    const response = yield this.http.get(url).toPromise();
                    if (response.actions && response.actions.length > 0) {
                        return response;
                    }
                }
                catch (e) {
                    console.log(`failed to fetch actions: ${api}`);
                }
            }
            return;
        });
    }
    checkLinkedAuth(account) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.checkLinkedAuthHyperionMulti(account);
            console.log(result);
            const required = ['claimgbmvote', 'claimgenesis', 'voteproducer'];
            if (result.actions.length > 0) {
                for (const a of result.actions) {
                    const idx = required.indexOf(a.act.data.type);
                    if (idx !== -1) {
                        required.splice(idx, 1);
                    }
                }
            }
            return required;
        });
    }
    claimGBMRewards() {
        if (this.autoClaimStatus) {
            this.claimDirect(false).catch(console.log);
        }
        else {
            this.claimWithActive().catch(console.log);
        }
        this.checkWaxGBMdata(this.aService.selected.getValue().name).catch(console.log);
    }
    claimWithActive() {
        return __awaiter(this, void 0, void 0, function* () {
            const [auth, publicKey] = this.trxFactory.getAuth();
            console.log(auth);
            const messageHTML = `
		<h5 class="white mb-0">Performing eosio::claimgenesis and eosio::claimgbmvote actions</h5>
		`;
            const actions = [];
            actions.push({
                account: 'eosio',
                name: 'claimgenesis',
                authorization: [auth],
                data: {
                    claimer: auth.actor,
                },
            });
            actions.push({
                account: 'eosio',
                name: 'claimgbmvote',
                authorization: [auth],
                data: {
                    owner: auth.actor,
                },
            });
            yield this.trxFactory.launch(publicKey, {
                transactionPayload: { actions },
                termsHeader: '',
                signerAccount: auth.actor,
                signerPublicKey: publicKey,
                labelHTML: messageHTML,
                actionTitle: 'claim WAX GBM Rewards',
                termsHTML: '',
                errorFunc: (e) => {
                    if (e instanceof enf_eosjs_1.RpcError) {
                        let eJson;
                        if (e.json) {
                            eJson = e.json;
                        }
                        else {
                            eJson = e;
                        }
                        switch (eJson.error.code) {
                            case 3090005: {
                                return 'Irrelevant authority included, missing linkauth';
                            }
                            case 3050003: {
                                return 'Account already claimed in the past 24 hours. Please wait.';
                            }
                            default: {
                                return eJson.error.details[0].message;
                            }
                        }
                    }
                },
            });
            this.cdr.detectChanges();
        });
    }
    claimDirect(voteOnly) {
        return __awaiter(this, void 0, void 0, function* () {
            const [auth] = this.trxFactory.getAuth();
            // check current votes
            const accountData = yield this.eosjs.rpc.get_account(auth.actor);
            let producers = [];
            let proxy = '';
            if (accountData.voter_info) {
                if (accountData.voter_info.proxy !== '') {
                    // voting on proxy
                    proxy = accountData.voter_info.proxy;
                }
                else {
                    // voting on producers
                    producers = accountData.voter_info.producers;
                }
            }
            const claimPrivateKey = yield this.electron.keytar.getPassword('simpleos', this.claimPublicKey);
            const signatureProvider = new eosjs_jssig_1.JsSignatureProvider([claimPrivateKey]);
            const rpc = this.eosjs.rpc;
            const api = new enf_eosjs_1.Api({
                rpc,
                signatureProvider,
                textDecoder: new TextDecoder(),
                textEncoder: new TextEncoder(),
            });
            const actions = [];
            actions.push({
                account: 'eosio',
                name: 'voteproducer',
                authorization: [
                    {
                        actor: auth.actor,
                        permission: 'claim',
                    }
                ],
                data: {
                    voter: auth.actor,
                    proxy,
                    producers,
                },
            });
            if (!voteOnly) {
                actions.push({
                    account: 'eosio',
                    name: 'claimgenesis',
                    authorization: [
                        {
                            actor: auth.actor,
                            permission: 'claim',
                        }
                    ],
                    data: {
                        claimer: auth.actor,
                    },
                });
                actions.push({
                    account: 'eosio',
                    name: 'claimgbmvote',
                    authorization: [
                        {
                            actor: auth.actor,
                            permission: 'claim',
                        }
                    ],
                    data: {
                        owner: auth.actor,
                    },
                });
            }
            try {
                const result = yield api.transact({
                    actions,
                }, {
                    blocksBehind: 3,
                    expireSeconds: 30,
                });
                this.claimError = '';
                if (voteOnly) {
                    this.toaster.onSuccess('Vote broadcasted', 'Check your history for confirmation.');
                }
                else {
                    this.toaster.onSuccess('GBM Rewards Claimed', 'Check your history for confirmation.');
                }
                console.log(result);
                this.cdr.detectChanges();
            }
            catch (e) {
                if (e instanceof enf_eosjs_1.RpcError) {
                    let eJson;
                    if (e.json) {
                        eJson = e.json;
                    }
                    else {
                        eJson = e;
                    }
                    switch (eJson.error.code) {
                        case 3090005: {
                            this.claimError = 'Irrelevant authority included, missing linkauth';
                            break;
                        }
                        case 3050003: {
                            this.claimError = 'Account already claimed in the past 24 hours. Please wait.';
                            break;
                        }
                        default: {
                            this.claimError = eJson.error.details[0].message;
                        }
                    }
                    console.log(JSON.stringify(eJson, null, 2));
                }
            }
        });
    }
    toggleLinkAuth() {
        this.enableLinkAuth = !this.enableLinkAuth;
        this.cdr.detectChanges();
    }
    createClaimPermission() {
        return __awaiter(this, void 0, void 0, function* () {
            const [auth, publicKey] = this.trxFactory.getAuth();
            const messageHTML = `
		<h5 class="white mb-0">
		This action will create a custom permission that is only allowed to claim rewards (linked with eosio::claimgenesis).
		<br><br> This permission will be automatically called once per day to claim your GBM rewards.
		<br><br> You don't need to leave your wallet open, your computer just needs to be turned on.
		<br><br>This action doesn't expose your private key.  </h5>
		`;
            const keypair = yield this.crypto.generateKeyPair();
            const privateKey = keypair.private;
            const publicKey2 = keypair.public;
            const actions = [];
            let changeKey = true;
            if (auth.permission === 'active' || auth.permission === 'owner') {
                actions.push({
                    account: 'eosio',
                    name: 'updateauth',
                    authorization: [auth],
                    data: {
                        account: auth.actor,
                        permission: 'claim',
                        parent: 'active',
                        auth: {
                            threshold: 1,
                            keys: [{ key: publicKey2, weight: 1 }],
                            accounts: [],
                            waits: [],
                        },
                    },
                });
            }
            else {
                changeKey = false;
            }
            if (this.enableLinkAuth) {
                const reqLink = yield this.checkLinkedAuth(auth.actor);
                for (const linkType of reqLink) {
                    actions.push({
                        account: 'eosio',
                        name: 'linkauth',
                        authorization: [auth],
                        data: {
                            account: auth.actor,
                            code: 'eosio',
                            type: linkType,
                            requirement: 'claim',
                        },
                    });
                }
            }
            const results = yield this.trxFactory.launch(publicKey2, {
                transactionPayload: { actions },
                termsHeader: '',
                signerAccount: auth.actor,
                signerPublicKey: publicKey2,
                labelHTML: messageHTML,
                actionTitle: 'auto-claim setup',
                termsHTML: ''
            });
            if (results === 'done') {
                if (!changeKey) {
                    this.electron.keytar.setPassword('simpleos', publicKey2, this.crypto.getPK()[0]);
                    this.claimPublicKey = publicKey2;
                    this.configureAutoClaim(auth.actor, publicKey2, 'claim');
                }
                else {
                    this.electron.keytar.setPassword('simpleos', publicKey2, privateKey);
                    this.claimPublicKey = publicKey2;
                    this.configureAutoClaim(auth.actor, publicKey2, 'claim');
                }
                this.autoClaimStatus = true;
                this.checkWaxGBMdata(this.aService.selected.getValue().name).then(() => {
                    if (this.claimReady) {
                        this.claimDirect(false).catch(console.log);
                    }
                });
            }
        });
    }
    configureAutoClaim(accountName, publicKey, permission) {
        if (!this.autoClaimConfig['WAX-GBM']) {
            this.autoClaimConfig['WAX-GBM'] = {
                apis: this.aService.activeChain.endpoints.map(e => e.url),
                jobs: [],
            };
        }
        const newObj = {
            account: accountName,
            public_key: publicKey,
            permission,
            last_claim: this.lastClaimTime,
            total_rewards: 0,
            next_claim_time: this.lastClaimTime + (24 * 60 * 60 * 1000),
        };
        const idx = this.autoClaimConfig['WAX-GBM'].jobs.findIndex(j => j.account === accountName);
        if (idx === -1) {
            this.autoClaimConfig['WAX-GBM'].jobs.push(newObj);
        }
        else {
            this.autoClaimConfig['WAX-GBM'].jobs[idx] = newObj;
        }
        this.storeConfig();
    }
    checkVoterRewards(name) {
        return __awaiter(this, void 0, void 0, function* () {
            const voter = (yield this.eosjs.rpc.get_account(name)).voter_info;
            const gstate = (yield this.eosjs.rpc.get_table_rows({
                code: 'eosio',
                scope: 'eosio',
                table: 'global',
            })).rows[0];
            if (voter) {
                const unpaidVoteShare = ((1000 * 60 * 60 * 24) / 1000000) *
                    parseFloat(voter.unpaid_voteshare_change_rate);
                const voterBucket = parseFloat(gstate.voters_bucket) / 100000000;
                const globalUnpaidVoteShare = parseFloat(gstate.total_unpaid_voteshare);
                this.voteRewardsDaily = voterBucket * (unpaidVoteShare / globalUnpaidVoteShare);
            }
            else {
                this.voteRewardsDaily = 0;
            }
        });
    }
    checkWaxGBMdata(name) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = yield this.eosjs.rpc.get_table_rows({
                json: true,
                code: 'eosio',
                table: 'genesis',
                scope: name,
            });
            const data = results.rows[0];
            if (data) {
                this.gbmBalance = parseFloat(data.balance.split(' ')[0]);
                this.gbmLastClaim = data.lastClaimTime;
                this.lastClaimTime = moment(moment.utc(this.gbmLastClaim).toDate()).toDate().getTime();
                this.gbmLastClaim = moment(moment.utc(this.gbmLastClaim).toDate()).local().format('DD-MM-YYYY HH:mm');
                if (this.gbmBalance > 0) {
                    this.gbmEstimatedDaily = parseFloat((this.gbmBalance / 1095).toFixed(2));
                }
                else {
                    this.gbmEstimatedDaily = 0;
                }
                this.gbmNextClaim = moment.utc(this.lastClaimTime).add(1, 'day').fromNow();
                this.claimReady = ((this.lastClaimTime) + (24 * 60 * 60 * 1000) <=
                    Date.now());
            }
            else {
                this.gbmBalance = 0;
                this.claimReady = false;
            }
        });
    }
    customTableSort(event) {
        event.data.sort((data1, data2) => {
            if (event.field === 'total_votes') {
                event.field = 'total_votes_num';
            }
            const value1 = data1[event.field];
            const value2 = data2[event.field];
            let result;
            if (value1 == null && value2 != null) {
                result = -1;
            }
            else if (value1 != null && value2 == null) {
                result = 1;
            }
            else if (value1 == null && value2 == null) {
                result = 0;
            }
            else if (typeof value1 === 'string' && typeof value2 === 'string') {
                result = value1.localeCompare(value2);
            }
            else {
                result = (value1 < value2) ? -1 : (value1 > value2) ? 1 : 0;
            }
            return (event.order * result);
        });
    }
    processLiberlandVotes() {
        // window.shell.openExternal('https://vote.liberland.org');
    }
};
VoteComponent = __decorate([
    (0, core_1.Component)({
        selector: 'app-vote',
        templateUrl: './vote.component.html',
        styleUrls: ['./vote.component.css'],
    }),
    __metadata("design:paramtypes", [voting_service_1.VotingService,
        http_1.HttpClient,
        transaction_factory_service_1.TransactionFactoryService,
        accounts_service_1.AccountsService,
        eosjs2_service_1.Eosjs2Service,
        crypto_service_1.CryptoService,
        forms_1.FormBuilder,
        notification_service_1.NotificationService,
        core_1.ChangeDetectorRef,
        app_component_1.AppComponent,
        theme_service_1.ThemeService,
        electron_service_1.ElectronService,
        resource_service_1.ResourceService])
], VoteComponent);
exports.VoteComponent = VoteComponent;
//# sourceMappingURL=vote.component.js.map