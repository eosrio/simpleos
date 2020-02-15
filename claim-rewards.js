const path = require('path');
const {productName} = require('./package.json');
const keytar = require('keytar');
const fs = require('fs');
const moment = require('moment');
const schedule = require('node-schedule');
const {Api, JsonRpc, RpcError} = require('eosjs');
const {JsSignatureProvider} = require('eosjs/dist/eosjs-jssig');
const fetch = require('node-fetch');
const {TextEncoder, TextDecoder} = require('util');
const {app, Menu, Tray, shell} = require('electron');

const basePath = app.getPath('appData') + '/simpleos-config';
const TextEnc = new TextEncoder();
const TextDec = new TextDecoder();


class ClaimRewardsService {
	main;
	appIcon = null;
	isEnableAutoClaim = false;
	eosRPC = null;

	lockFile = basePath + '/lockFile';
	lockAutoLaunchFile = basePath + '/' + productName + '-lockALFile';
	lockLaunchFile = basePath + '/' + productName + '-lockLFile';
	logFile = basePath + '/' + productName + '-autoclaim.log';

	constructor(parent) {
		this.main = parent;
		this.init();
	}

	init() {
		try {
			if (!fs.existsSync(this.lockFile)) {
				ClaimRewardsService.unlinkFile(this.lockAutoLaunchFile);
				ClaimRewardsService.unlinkFile(this.lockLaunchFile);
			}
		} catch (e) {
			console.error(e);
		}
		if (!fs.existsSync(basePath)) {
			fs.mkdirSync(basePath);
		}
	}

	setRpcApi(api) {
		this.eosRPC = new JsonRpc(api, {fetch});
	}

	autoClaimCheck() {
		const cPath = basePath + '/autoclaim.json';
		if (fs.existsSync(basePath + '/autoclaim.json')) {
			console.log('file exist', cPath);
			const autoclaimConfStr = fs.readFileSync(cPath, 'utf8');
			// console.log('Read STR exist', autoclaimConfStr);
			if (autoclaimConfStr !== '') {
				const autoclaimConf = JSON.parse(fs.readFileSync(cPath).toString());
				this.isEnableAutoClaim = autoclaimConf['enabled'];
				if (!this.isEnableAutoClaim) {
					ClaimRewardsService.unlinkFile(this.lockAutoLaunchFile);
				}
			}

		} else {
			ClaimRewardsService.unlinkFile(this.lockAutoLaunchFile);
		}
	}

	async claimGBM(account_name, private_key, permission, rpc) {
		const signatureProvider = new JsSignatureProvider([private_key]);
		const api = new Api({rpc, signatureProvider, textDecoder: TextDec, textEncoder: TextEnc});
		// check current votes
		const accountData = await rpc.get_account(account_name);
		let _producers = [];
		let _proxy = '';

		if (accountData['voter_info']) {
			if (accountData['voter_info']['proxy'] !== '') {
				// voting on proxy
				_proxy = accountData['voter_info']['proxy'];
			} else {
				// voting on producers
				_producers = accountData['voter_info']['producers'];
			}
		}

		const _actions = [];

		_actions.push({
			account: 'eosio',
			name: 'voteproducer',
			authorization: [
				{
					actor: account_name,
					permission: permission,
				}],
			data: {
				voter: account_name,
				proxy: _proxy,
				producers: _producers,
			},
		});

		_actions.push({
			account: 'eosio',
			name: 'claimgenesis',
			authorization: [
				{
					actor: account_name,
					permission: permission,
				}],
			data: {
				claimer: account_name,
			},
		});

		_actions.push({
			account: 'eosio',
			name: 'claimgbmvote',
			authorization: [
				{
					actor: account_name,
					permission: permission,
				}],
			data: {
				owner: account_name,
			},
		});

		try {
			const result = await api.transact({
				actions: _actions,
			}, {
				blocksBehind: 3,
				expireSeconds: 30,
				broadcast: true,
			});
			// console.log(result);
			const logFile = basePath + '/autoclaim-trx-log_' + (Date.now()) + '.txt';
			fs.writeFileSync(logFile, JSON.stringify(result));
			this.main.notifyTrx('Auto-claim executed', 'Account: ' + account_name, 0,
				result.transaction_id);
			return true;

		} catch (e) {
			console.log('\nCaught exception: ' + e);
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
				this.main.notify('Auto-claim error',
					'Account: ' + account_name + '\n Error: ' + claimError, 0);
			}
			throw new Error(claimError);
		}
	}

	addTrayIcon() {
		this.appIcon = new Tray(path.join(__dirname, 'static/tray-icon.png'));
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
					this.appIcon['destroy']();
					ClaimRewardsService.unlinkFile(this.lockAutoLaunchFile);
					app.quit();
				},
			},
		]);
		this.appIcon['setToolTip']('simplEOS Agent');
		this.appIcon['setContextMenu'](trayMenu);
	}

	storeConfig(autoClaimConfig) {
		try {
			const data = JSON.stringify(autoClaimConfig, null, '\t');
			fs.writeFileSync(basePath + '/autoclaim.json', data);
		} catch (e) {
			const logFile = basePath + '/autoclaim-error_' + (Date.now()) + '.txt';
			fs.writeFileSync(logFile, e);
			shell.openItem(logFile);
			console.log(e);
		}
	}

	writeLog(msg) {
		const now = moment().format('YYYY-MM-DD HH:mm:ss');
		msg = '[' + now + '] - ' + msg;
		console.log(msg);
		fs.appendFileSync(this.logFile, msg + '\n');
	}

	async getClaimTime(account, rpc) {
		const genesis_table = await rpc.get_table_rows({
			json: true, scope: account, code: 'eosio', table: 'genesis', limit: 1,
		});
		if (genesis_table.rows.length === 1) {
			return moment.utc(genesis_table.rows[0].last_claim_time);
		} else {
			return null;
		}
	}

	async safeRun(callback, errorReturn, api_list) {
		let result = null;
		let api_idx = 0;
		if (api_idx < api_list.length) {
			for (const api of api_list) {
				try {
					this.setRpcApi(api_list[api_idx]);
					result = await callback(this.eosRPC);
				} catch (e) {
					if (e.message) {
						console.log(
							`${api_list[api_idx]} failed with error: ${e.message}`);
					}
					if (e.name !== 'FetchError') {
						break;
					}
					api_idx++;
				}
				if (result) break;
			}
		}
		if (result) {
			return result;
		} else {
			return errorReturn;
		}
	}

	runAutoClaim() {
		this.writeLog('Checking claim conditions...');
		const cPath = basePath + '/autoclaim.json';
		if (fs.existsSync(basePath + '/autoclaim.json')) {
			fs.readFile(cPath, (err, data) => {
				if (err) throw err;
				let autoclaimConf = JSON.parse(data.toString());
				(async () => {
					if (autoclaimConf['enabled']) {
						if (autoclaimConf['WAX-GBM']) {
							const apis = autoclaimConf['WAX-GBM']['apis'];
							this.setRpcApi(apis[0]);
							for (const job of autoclaimConf['WAX-GBM']['jobs']) {
								const a = await this.safeRun(
									(api) => this.getClaimTime(job.account, api), null,
									apis);
								if (a) {
									a.add(1, 'day');
									const b = moment().utc();
									const scheduleName = 'autoClaim-' + job['account'];
									if (b.diff(a, 'seconds') > 0) {
										this.writeLog(
											`${job.account} is ready to claim!`);
										try {
											const pvtkey = await keytar.getPassword(
												'simpleos', job['public_key']);
											const perm = job['permission'];
											const claimResult = await this.safeRun(
												(api) => this.claimGBM(job.account,
													pvtkey, perm, api), null, apis);

											if (claimResult) {
												job['last_claim'] = Date.now();
												schedule.scheduleJob(scheduleName,
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
											schedule.scheduleJob(scheduleName,
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
							this.storeConfig(autoclaimConf);
						}
					}
				})().catch(console.log);
			});
		}
	}

	rescheduleAutoClaim() {
		this.writeLog('Checking claim conditions reschedule...');
		const cPath = basePath + '/autoclaim.json';
		if (fs.existsSync(basePath + '/autoclaim.json')) {
			const data = fs.readFileSync(cPath);
			let autoclaimConf = JSON.parse(data.toString());
			if (autoclaimConf['enabled'] && productName === 'simpleos') {
				if (autoclaimConf['WAX-GBM']) {
					for (const job of autoclaimConf['WAX-GBM']['jobs']) {
						const a = moment.utc(job['next_claim_time']);
						const b = moment().utc();
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

	clearLock() {
		fs.writeFileSync(this.lockFile, '');
	}

	static unlinkFile(file) {
		if (fs.existsSync(file)) {
			fs.unlinkSync(file);
		}
	}

	unlinkLALock() {
		ClaimRewardsService.unlinkFile(this.lockAutoLaunchFile);
	}

	unlinkLLock() {
		ClaimRewardsService.unlinkFile(this.lockLaunchFile);
	}

}

module.exports = { ClaimRewardsService };
