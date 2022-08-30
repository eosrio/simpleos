"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaimRewardsService = void 0;
const electron_1 = require("electron");
const enf_eosjs_1 = require("enf-eosjs");
const eosjs_jssig_1 = require("enf-eosjs/dist/eosjs-jssig");
const fs = __importStar(require("fs"));
const moment_1 = __importDefault(require("moment"));
const path = __importStar(require("path"));
const util_1 = require("../util");
const nodeSchedule = __importStar(require("node-schedule"));
const keytar_1 = require("keytar");
const { productName } = require('../../package.json');
const basePath = electron_1.app.getPath('appData') + '/simpleos-config';
const TextEnc = new TextEncoder();
const TextDec = new TextDecoder();
class ClaimRewardsService {
    constructor(parent) {
        this.appIcon = null;
        this.autoClaimEnabled = false;
        this.eosRPC = null;
        this.lockFile = basePath + '/lockFile';
        this.lockAutoLaunchFile = basePath + '/' + productName + '-lockALFile';
        this.lockLaunchFile = basePath + '/' + productName + '-lockLFile';
        this.logFile = basePath + '/' + productName + '-autoclaim.log';
        this.main = parent;
        this.init();
    }
    static unlinkFile(file) {
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
        }
    }
    init() {
        try {
            if (!fs.existsSync(this.lockFile)) {
                ClaimRewardsService.unlinkFile(this.lockAutoLaunchFile);
                ClaimRewardsService.unlinkFile(this.lockLaunchFile);
            }
        }
        catch (e) {
            console.error(e);
        }
        this.autoClaimCheck();
    }
    setRpcApi(api) {
        this.eosRPC = new enf_eosjs_1.JsonRpc(api, { fetch });
    }
    autoClaimCheck() {
        const cPath = basePath + '/autoclaim.json';
        if (fs.existsSync(basePath + '/autoclaim.json')) {
            const autoclaimConfStr = fs.readFileSync(cPath, 'utf8');
            if (autoclaimConfStr !== '') {
                const autoclaimContentFile = fs.readFileSync(cPath).toString();
                if (autoclaimContentFile.includes('{')) {
                    const autoclaimConf = JSON.parse(fs.readFileSync(cPath).toString());
                    this.autoClaimEnabled = autoclaimConf.enabled;
                }
                else {
                    this.autoClaimEnabled = false;
                }
                if (!this.autoClaimEnabled) {
                    ClaimRewardsService.unlinkFile(this.lockAutoLaunchFile);
                }
            }
        }
        else {
            ClaimRewardsService.unlinkFile(this.lockAutoLaunchFile);
        }
    }
    claimGBM(accountName, privateKey, permission, rpc) {
        return __awaiter(this, void 0, void 0, function* () {
            const signatureProvider = new eosjs_jssig_1.JsSignatureProvider([privateKey]);
            const api = new enf_eosjs_1.Api({ rpc, signatureProvider, textDecoder: TextDec, textEncoder: TextEnc });
            // check current votes
            const accountData = yield rpc.get_account(accountName);
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
            const actions = [];
            const authorization = [{ actor: accountName, permission }];
            actions.push({
                account: 'eosio',
                name: 'voteproducer',
                authorization,
                data: { voter: accountName, proxy, producers }
            });
            actions.push({
                account: 'eosio',
                name: 'claimgenesis',
                authorization,
                data: { claimer: accountName }
            });
            actions.push({
                account: 'eosio',
                name: 'claimgbmvote',
                authorization,
                data: { owner: accountName }
            });
            try {
                const result = yield api.transact({ actions }, {
                    blocksBehind: 30,
                    expireSeconds: 120,
                    broadcast: true,
                });
                const logFile = basePath + '/autoclaim-trx-log_' + (Date.now()) + '.txt';
                fs.writeFileSync(logFile, JSON.stringify(result));
                this.main.notifyTrx('Auto-claim executed', 'Account: ' + accountName, 0, result.transaction_id);
                return true;
            }
            catch (e) {
                util_1.Logger.warn('\nCaught exception: ' + e);
                let claimError = '';
                if (e instanceof enf_eosjs_1.RpcError) {
                    const eJson = e.json;
                    switch (eJson.error.code.toString()) {
                        case '3090005': {
                            claimError = 'Irrelevant authority included, missing linkauth';
                            break;
                        }
                        case '3050003': {
                            claimError = 'Account already claimed in the past 24 hours. Please wait.';
                            break;
                        }
                        default: {
                            claimError = eJson.error.details[0].message;
                        }
                    }
                }
                yield this.main.notify('Auto-claim error', 'Account: ' + accountName + '\nError: ' + claimError, 0);
                throw new Error(claimError);
            }
        });
    }
    addTrayIcon() {
        util_1.Logger.info(path.join(__dirname, '../static/tray-icon.png'));
        this.appIcon = new electron_1.Tray(path.join(__dirname, '../static/tray-icon.png'));
        const trayMenu = electron_1.Menu.buildFromTemplate([
            {
                label: 'SimplEOS Wallet', click: () => {
                    const spawn = require('child_process').spawn;
                    spawn(process.execPath, [], {
                        detached: true,
                        stdio: ['ignore', 'ignore', 'ignore'],
                    }).unref();
                },
            },
            {
                label: 'Quit SimplEOS Agent', click: () => {
                    this.appIcon.destroy();
                    ClaimRewardsService.unlinkFile(this.lockAutoLaunchFile);
                    electron_1.app.quit();
                },
            },
        ]);
        this.appIcon.setToolTip('simplEOS Agent');
        this.appIcon.setContextMenu(trayMenu);
    }
    storeConfig(autoClaimConfig) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = JSON.stringify(autoClaimConfig, null, '\t');
                fs.writeFileSync(basePath + '/autoclaim.json', data);
            }
            catch (e) {
                const logFile = basePath + '/autoclaim-error_' + (Date.now()) + '.txt';
                fs.writeFileSync(logFile, e);
                yield electron_1.shell.openPath(logFile);
                util_1.Logger.warn(e);
            }
        });
    }
    writeLog(msg) {
        const now = (0, moment_1.default)().format('YYYY-MM-DD HH:mm:ss');
        msg = '[' + now + '] - ' + msg;
        fs.appendFileSync(this.logFile, msg + '\n');
    }
    getClaimTime(account, rpc) {
        return __awaiter(this, void 0, void 0, function* () {
            const genesisTable = yield rpc.get_table_rows({
                json: true, scope: account, code: 'eosio', table: 'genesis', limit: 1,
            });
            if (genesisTable.rows.length === 1) {
                return (0, moment_1.default)(moment_1.default.utc(genesisTable.rows[0].last_claim_time)).local();
            }
            else {
                return null;
            }
        });
    }
    safeRun(callback, errorReturn, apiList) {
        return __awaiter(this, void 0, void 0, function* () {
            let result = null;
            let apiIdx = 0;
            if (apiIdx < apiList.length) {
                for (const api of apiList) {
                    try {
                        this.setRpcApi(apiList[apiIdx]);
                        result = yield callback(this.eosRPC);
                    }
                    catch (e) {
                        if (e.message) {
                            util_1.Logger.info(`${apiList[apiIdx]} failed with error: ${e.message}`);
                        }
                        if (e.name !== 'FetchError') {
                            break;
                        }
                        apiIdx++;
                    }
                    if (result) {
                        break;
                    }
                }
            }
            if (result) {
                return result;
            }
            else {
                return errorReturn;
            }
        });
    }
    runAutoClaim() {
        this.writeLog('Checking claim conditions...');
        util_1.Logger.info('Checking claim conditions...');
        const cPath = basePath + '/autoclaim.json';
        if (fs.existsSync(basePath + '/autoclaim.json')) {
            fs.readFile(cPath, (err, data) => {
                if (err) {
                    throw err;
                }
                const autoclaimConf = JSON.parse(data.toString());
                (() => __awaiter(this, void 0, void 0, function* () {
                    if (autoclaimConf.enabled) {
                        if (autoclaimConf['WAX-GBM']) {
                            const apis = autoclaimConf['WAX-GBM'].apis;
                            this.setRpcApi(apis[0]);
                            for (const job of autoclaimConf['WAX-GBM'].jobs) {
                                const a = yield this.safeRun((api) => this.getClaimTime(job.account, api), null, apis);
                                if (a) {
                                    a.add(1, 'day');
                                    const b = (0, moment_1.default)(moment_1.default.utc()).local();
                                    const scheduleName = 'autoClaim-' + job.account;
                                    if (b.diff(a, 'seconds') > 0) {
                                        this.writeLog(`${job.account} is ready to claim!`);
                                        try {
                                            const pvtkey = yield (0, keytar_1.getPassword)('simpleos', job.public_key);
                                            const perm = job.permission;
                                            const claimResult = yield this.safeRun((api) => this.claimGBM(job.account, pvtkey, perm, api), null, apis);
                                            if (claimResult) {
                                                job.last_claim = Date.now();
                                                nodeSchedule.scheduleJob(scheduleName, a.toDate(), () => {
                                                    this.runAutoClaim();
                                                });
                                            }
                                        }
                                        catch (e) {
                                            const logFile = basePath +
                                                '/autoclaim-error_' + (Date.now()) +
                                                '.txt';
                                            fs.writeFileSync(logFile, e);
                                            this.writeLog(`Autoclaim error, check log file: ${logFile}`);
                                            // shell.openItem(logFile);
                                            nodeSchedule.scheduleJob(scheduleName, b.add(10, 'minutes').toDate(), () => {
                                                this.runAutoClaim();
                                            });
                                        }
                                    }
                                    else {
                                        this.writeLog(`${job.account} claims again at ${a.format()}`);
                                    }
                                }
                            }
                            yield this.storeConfig(autoclaimConf);
                        }
                    }
                }))().catch(util_1.Logger.warn);
            });
        }
    }
    rescheduleAutoClaim() {
        this.writeLog('Checking claim conditions reschedule...');
        const cPath = basePath + '/autoclaim.json';
        if (fs.existsSync(basePath + '/autoclaim.json')) {
            const data = fs.readFileSync(cPath);
            const autoclaimConf = JSON.parse(data.toString());
            if (autoclaimConf.enabled && productName === 'simpleos') {
                if (autoclaimConf['WAX-GBM']) {
                    for (const job of autoclaimConf['WAX-GBM'].jobs) {
                        const a = (0, moment_1.default)(moment_1.default.utc(job.next_claim_time)).local();
                        const b = (0, moment_1.default)(moment_1.default.utc()).local();
                        this.writeLog(`Diff next date from now (sec): ${b.diff(a, 'seconds')}`);
                        if (b.diff(a, 'seconds') > 0) {
                            this.runAutoClaim();
                        }
                    }
                }
            }
        }
    }
    clearLock() {
        fs.writeFileSync(this.lockFile, '');
    }
    unlinkLALock() {
        ClaimRewardsService.unlinkFile(this.lockAutoLaunchFile);
    }
    unlinkLLock() {
        ClaimRewardsService.unlinkFile(this.lockLaunchFile);
    }
}
exports.ClaimRewardsService = ClaimRewardsService;
//# sourceMappingURL=claim-rewards.js.map