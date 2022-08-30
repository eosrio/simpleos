import {app, Menu, shell, Tray} from 'electron';
import {Api, JsonRpc, RpcError} from 'enf-eosjs';
import {JsSignatureProvider} from 'enf-eosjs/dist/eosjs-jssig';
import * as fs from 'fs';
import moment from 'moment';
import * as path from 'path';
import {Logger} from '../util';

import * as nodeSchedule from 'node-schedule';

import {getPassword} from 'keytar';

const {productName} = require('../../package.json');

const basePath = app.getPath('appData') + '/simpleos-config';
const TextEnc = new TextEncoder();
const TextDec = new TextDecoder();

export class ClaimRewardsService {

    constructor(parent) {
        this.main = parent;
        this.init();
    }

    main;
    appIcon = null;
    autoClaimEnabled = false;
    eosRPC = null;

    lockFile = basePath + '/lockFile';
    lockAutoLaunchFile = basePath + '/' + productName + '-lockALFile';
    lockLaunchFile = basePath + '/' + productName + '-lockLFile';
    logFile = basePath + '/' + productName + '-autoclaim.log';

    static unlinkFile(file): void {
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
        }
    }

    init(): void {
        try {
            if (!fs.existsSync(this.lockFile)) {
                ClaimRewardsService.unlinkFile(this.lockAutoLaunchFile);
                ClaimRewardsService.unlinkFile(this.lockLaunchFile);
            }
        } catch (e) {
            console.error(e);
        }
        this.autoClaimCheck();
    }

    setRpcApi(api): void {
        this.eosRPC = new JsonRpc(api, {fetch});
    }

    autoClaimCheck(): void {
        const cPath = basePath + '/autoclaim.json';
        if (fs.existsSync(basePath + '/autoclaim.json')) {
            const autoclaimConfStr = fs.readFileSync(cPath, 'utf8');
            if (autoclaimConfStr !== '') {
                const autoclaimContentFile = fs.readFileSync(cPath).toString();
                if (autoclaimContentFile.includes('{')) {
                    const autoclaimConf = JSON.parse(fs.readFileSync(cPath).toString());
                    this.autoClaimEnabled = autoclaimConf.enabled;
                } else {
                    this.autoClaimEnabled = false;
                }
                if (!this.autoClaimEnabled) {
                    ClaimRewardsService.unlinkFile(this.lockAutoLaunchFile);
                }
            }
        } else {
            ClaimRewardsService.unlinkFile(this.lockAutoLaunchFile);
        }
    }

    async claimGBM(accountName, privateKey, permission, rpc): Promise<boolean> {
        const signatureProvider = new JsSignatureProvider([privateKey]);
        const api = new Api({rpc, signatureProvider, textDecoder: TextDec, textEncoder: TextEnc});
        // check current votes
        const accountData = await rpc.get_account(accountName);
        let producers = [];
        let proxy = '';

        if (accountData.voter_info) {
            if (accountData.voter_info.proxy !== '') {
                // voting on proxy
                proxy = accountData.voter_info.proxy;
            } else {
                // voting on producers
                producers = accountData.voter_info.producers;
            }
        }

        const actions = [];
        const authorization = [{actor: accountName, permission}];

        actions.push({
            account: 'eosio',
            name: 'voteproducer',
            authorization,
            data: {voter: accountName, proxy, producers}
        });

        actions.push({
            account: 'eosio',
            name: 'claimgenesis',
            authorization,
            data: {claimer: accountName}
        });

        actions.push({
            account: 'eosio',
            name: 'claimgbmvote',
            authorization,
            data: {owner: accountName}
        });

        try {
            const result = await api.transact({actions}, {
                blocksBehind: 30,
                expireSeconds: 120,
                broadcast: true,
            });
            const logFile = basePath + '/autoclaim-trx-log_' + (Date.now()) + '.txt';
            fs.writeFileSync(logFile, JSON.stringify(result));
            this.main.notifyTrx('Auto-claim executed', 'Account: ' + accountName, 0,
                result.transaction_id);
            return true;
        } catch (e) {
            Logger.warn('\nCaught exception: ' + e);
            let claimError = '';
            if (e instanceof RpcError) {
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
            await this.main.notify('Auto-claim error', 'Account: ' + accountName + '\nError: ' + claimError, 0);
            throw new Error(claimError);
        }
    }

    addTrayIcon(): void {
        Logger.info(path.join(__dirname, '../static/tray-icon.png'));
        this.appIcon = new Tray(path.join(__dirname, '../static/tray-icon.png'));
        const trayMenu = Menu.buildFromTemplate([
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
                    app.quit();
                },
            },
        ]);
        this.appIcon.setToolTip('simplEOS Agent');
        this.appIcon.setContextMenu(trayMenu);
    }

    async storeConfig(autoClaimConfig): Promise<void> {
        try {
            const data = JSON.stringify(autoClaimConfig, null, '\t');
            fs.writeFileSync(basePath + '/autoclaim.json', data);
        } catch (e) {
            const logFile = basePath + '/autoclaim-error_' + (Date.now()) + '.txt';
            fs.writeFileSync(logFile, e);
            await shell.openPath(logFile);
            Logger.warn(e);
        }
    }

    writeLog(msg): void {
        const now = moment().format('YYYY-MM-DD HH:mm:ss');
        msg = '[' + now + '] - ' + msg;
        fs.appendFileSync(this.logFile, msg + '\n');
    }

    async getClaimTime(account, rpc): Promise<moment.Moment> {
        const genesisTable = await rpc.get_table_rows({
            json: true, scope: account, code: 'eosio', table: 'genesis', limit: 1,
        });
        if (genesisTable.rows.length === 1) {
            return moment(moment.utc(genesisTable.rows[0].last_claim_time)).local();
        } else {
            return null;
        }
    }

    async safeRun(callback, errorReturn, apiList): Promise<any> {
        let result = null;
        let apiIdx = 0;
        if (apiIdx < apiList.length) {
            for (const api of apiList) {
                try {
                    this.setRpcApi(apiList[apiIdx]);
                    result = await callback(this.eosRPC);
                } catch (e) {
                    if (e.message) {
                        Logger.info(`${apiList[apiIdx]} failed with error: ${e.message}`);
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
        } else {
            return errorReturn;
        }
    }

    runAutoClaim(): void {
        this.writeLog('Checking claim conditions...');
        Logger.info('Checking claim conditions...');
        const cPath = basePath + '/autoclaim.json';
        if (fs.existsSync(basePath + '/autoclaim.json')) {
            fs.readFile(cPath, (err, data) => {
                if (err) {
                    throw err;
                }
                const autoclaimConf = JSON.parse(data.toString());
                (async () => {
                    if (autoclaimConf.enabled) {
                        if (autoclaimConf['WAX-GBM']) {
                            const apis = autoclaimConf['WAX-GBM'].apis;
                            this.setRpcApi(apis[0]);
                            for (const job of autoclaimConf['WAX-GBM'].jobs) {
                                const a = await this.safeRun(
                                    (api) => this.getClaimTime(job.account, api), null,
                                    apis);
                                if (a) {
                                    a.add(1, 'day');
                                    const b = moment(moment.utc()).local();
                                    const scheduleName = 'autoClaim-' + job.account;
                                    if (b.diff(a, 'seconds') > 0) {
                                        this.writeLog(
                                            `${job.account} is ready to claim!`);
                                        try {
                                            const pvtkey = await getPassword('simpleos', job.public_key);
                                            const perm = job.permission;
                                            const claimResult = await this.safeRun(
                                                (api) => this.claimGBM(job.account,
                                                    pvtkey, perm, api), null, apis);

                                            if (claimResult) {
                                                job.last_claim = Date.now();
                                                nodeSchedule.scheduleJob(scheduleName,
                                                    a.toDate(), () => {
                                                        this.runAutoClaim();
                                                    });
                                            }
                                        } catch (e) {
                                            const logFile = basePath +
                                                '/autoclaim-error_' + (Date.now()) +
                                                '.txt';
                                            fs.writeFileSync(logFile, e);
                                            this.writeLog(
                                                `Autoclaim error, check log file: ${logFile}`);
                                            // shell.openItem(logFile);
                                            nodeSchedule.scheduleJob(scheduleName,
                                                b.add(10, 'minutes').toDate(),
                                                () => {
                                                    this.runAutoClaim();
                                                });
                                        }
                                    } else {
                                        this.writeLog(
                                            `${job.account} claims again at ${a.format()}`);
                                    }
                                }
                            }
                            await this.storeConfig(autoclaimConf);
                        }
                    }
                })().catch(Logger.warn);
            });
        }
    }

    rescheduleAutoClaim(): void {
        this.writeLog('Checking claim conditions reschedule...');
        const cPath = basePath + '/autoclaim.json';
        if (fs.existsSync(basePath + '/autoclaim.json')) {
            const data = fs.readFileSync(cPath);
            const autoclaimConf = JSON.parse(data.toString());
            if (autoclaimConf.enabled && productName === 'simpleos') {
                if (autoclaimConf['WAX-GBM']) {
                    for (const job of autoclaimConf['WAX-GBM'].jobs) {
                        const a = moment(moment.utc(job.next_claim_time)).local();
                        const b = moment(moment.utc()).local();
                        this.writeLog(`Diff next date from now (sec): ${b.diff(a,
                            'seconds')}`);
                        if (b.diff(a, 'seconds') > 0) {
                            this.runAutoClaim();
                        }
                    }
                }
            }
        }
    }

    clearLock(): void {
        fs.writeFileSync(this.lockFile, '');
    }

    unlinkLALock(): void {
        ClaimRewardsService.unlinkFile(this.lockAutoLaunchFile);
    }

    unlinkLLock(): void {
        ClaimRewardsService.unlinkFile(this.lockLaunchFile);
    }

}
