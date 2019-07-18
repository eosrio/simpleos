const {app, BrowserWindow, Menu, protocol, ipcMain, Notification, Tray, shell} = require('electron');
const path = require('path');
const url = require('url');
const keytar = require('keytar');
const fs = require('fs');
const moment = require('moment');
const schedule = require('node-schedule');
const portfinder = require('portfinder');
const {version, productName, name} = require('./package.json');
const {Api, JsonRpc, RpcError} = require('eosjs');
const {TextEncoder, TextDecoder} = require('util');
const fetch = require('isomorphic-fetch');
const {JsSignatureProvider} = require('eosjs/dist/eosjs-jssig');
const TextEnc = new TextEncoder();
const TextDec = new TextDecoder();
const cors = require('cors');
const bodyParser = require('body-parser');
const express = require('express')();
const PORT = 47888;
const http = require('http').Server(express);
let win, devtools, serve, isAutoLaunch;
let appIcon = null;
let deepLink = null;
let job = null;
app.getVersion = () => version;

const PROTOCOL_PREFIX = 'simpleos';
const args = process.argv.slice(1);
devtools = args.some(val => val === '--devtools');
serve = args.some(val => val === '--serve');

portfinder['basePort'] = 47888;
portfinder['highestPort'] = 47900;

const basePath = app.getPath('appData') + '/simpleos-config';
const lockFile = basePath + '/lockFile';

const lockAutoLaunchFile = basePath + '/' + productName + '-lockALFile';
const lockLaunchFile = basePath + '/' + productName + '-lockLFile';
const logFile = basePath + '/' + productName + '-autoclaim.log';

console.log(lockFile);

function clearLock() {
	fs.writeFileSync(lockFile, '');
}

function unlinkLALock() {
	fs.unlinkSync(lockAutoLaunchFile);
}

function unlinkLLock() {
	fs.unlinkSync(lockLaunchFile);
}

function appendLock() {
	if (isAutoLaunch) {
		fs.writeFileSync(lockAutoLaunchFile, process.pid);
	} else {
		fs.writeFileSync(lockLaunchFile, process.pid);
	}
}

if (!fs.existsSync(basePath)) {
	fs.mkdirSync(basePath);
}

try {
	if (!fs.existsSync(lockFile)) {
		unlinkLALock();
		unlinkLLock();
	}
} catch (e) {
	console.error(e);
}

const devMode = process.mainModule.filename.indexOf('app.asar') === -1;

console.log('Developer Mode:', devMode);

app.setLoginItemSettings({
	openAtLogin: !devMode,
	args: ["--autostart"]
});

const loginOpts = app.getLoginItemSettings({
	args: ["--autostart"]
});

isAutoLaunch = loginOpts.wasOpenedAtLogin || args.some(val => val === '--autostart');

const contextMenu = require('electron-context-menu');
contextMenu();

function setupExpress() {
	express.use(cors());

	express.get('/ping', (req, res) => {
		res.end('OK');
	});

	express.get('/accounts', (req, res) => {
		win.webContents.send('request', 'accounts');
		ipcMain.once('accountsResponse', (event, data) => {
			console.log(data);
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify(data));
		});
	});

	express.get('/getPublicKeys', (req, res) => {
		win.webContents.send('request', {
			message: 'publicKeys'
		});
		ipcMain.once('publicKeyResponse', (event, data) => {
			console.log(data);
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify(data));
		});
	});

	express.post('/sign', bodyParser.json(), (req, res) => {
		win.webContents.send('request', {
			message: 'sign',
			content: req.body
		});
		getFocus();
		ipcMain.once('signResponse', (event, data) => {
			console.log(data);
			res.setHeader('Content-Type', 'application/json');
			if (data.status !== 'CANCELLED') {
				unfocus();
			}
			res.end(JSON.stringify(data));
		});
	});

	express.get('/connect', (req, res) => {
		console.log('CONNECT REQUEST');
		win.webContents.send('request', {
			message: 'connect',
			content: {
				appName: req.query['appName'],
				chainId: req.query['chainId']
			}
		});
		if (req.query['appName'].length < 32 && req.query['chainId'].length === 64) {
			ipcMain.once('connectResponse', (event, data) => {
				console.log(data);
				res.setHeader('Content-Type', 'application/json');
				res.end(JSON.stringify(data));
			});
		}
	});

	express.get('/login', (req, res) => {
		console.log('CONNECT REQUEST, account:' + req.query.account);
		win.webContents.send('request', {
			message: 'login',
			content: {
				account: req.query.account
			}
		});
		if (!req.query.account) {
			getFocus();
		}
		if (req.query.account) {
			if (req.query.account.length > 13) {
				res.end('ERROR');
				return false;
			}
		}
		ipcMain.once('loginResponse', (event, data) => {
			console.log(data);
			if (data.status) {
				if (data.status !== 'CANCELLED') {
					if (!req.query.account) {
						unfocus();
					}
				}
			} else {
				unfocus();
			}
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify(data));
		});
	});

	express.get('/logout', (req, res) => {
		console.log('LOGOUT REQUEST');
		win.webContents.send('request', {
			message: 'logout',
			content: {
				account: req.query.account
			}
		});
		if (req.query.account) {
			if (req.query.account.length > 13) {
				res.end('ERROR');
				return false;
			}
		}
		ipcMain.once('logoutResponse', (event, data) => {
			console.log(data);
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify(data));
		});
	});

	express.get('/disconnect', (req, res) => {
		console.log('DISCONNECT REQUEST');
		win.webContents.send('request', {
			message: 'disconnect'
		});
		ipcMain.once('disconnectResponse', (event, data) => {
			console.log(data);
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify(data));
		});
	});
}

function getFocus() {
	if (win) {
		if (win.isMinimized()) {
			win.restore();
		}
		// win.blur();
		win.focus();
		win.show();

	}

	if (process.platform === 'darwin') {
		app.dock.hide();
		win.setAlwaysOnTop(false);
		win.setVisibleOnAllWorkspaces(true);
		win.setFullScreenable(false);
		app.dock.show();
	}
}

function unfocus() {
	switch (process.platform) {
		case "win32": {
			win.minimize();
			break;
		}
		case "linux": {
			win.hide();
			break;
		}
		case "darwin": {
			Menu.sendActionToFirstResponder('hide:');
			break;
		}
	}
}

function regURI() {
	app.setAsDefaultProtocolClient(PROTOCOL_PREFIX);
	protocol.registerHttpProtocol(PROTOCOL_PREFIX, (req, callback) => {
		if (req.url < 128) {
			deepLink = req;
			setTimeout(() => {
				win.webContents.send('request', {
					message: 'launch',
					content: deepLink.url
				});
			}, 5000);
		}
		callback();
	});
}

async function createWindow() {
	regURI();
	let _icon = path.join(__dirname, 'src/assets/icons/ico/simpleos.ico');
	let _bgColor = '#222222';
	if (name === 'liberland-wallet') {
		_icon = path.join(__dirname, 'src/assets/icons/ico/ll.ico');
		_bgColor = '#084577';
	}
	win = new BrowserWindow({
		title: productName,
		webPreferences: {
			nodeIntegration: true,
			webSecurity: !serve,
			devTools: false
		},
		darkTheme: true,
		width: 1440,
		height: 920,
		minWidth: 800,
		minHeight: 600,
		backgroundColor: _bgColor,
		frame: false,
		icon: _icon
	});

	win.removeMenu();

	if (serve) {
		require('electron-reload')(__dirname, {
			electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
			hardResetMethod: 'exit'
		});
		await win.loadURL('http://localhost:7777');
	} else {
		await win.loadURL(url.format({
			pathname: path.join(__dirname, 'ng-dist/index.html'),
			protocol: 'file:',
			slashes: true
		}));
	}

	if (devtools) {
		win.webContents.openDevTools();
	}

	win.webContents.on('did-finish-load', () => {
		win.setTitle(productName);
	});

	win.on('closed', () => {
		win = null;
	});
}

function notify(title, body, autoClose) {
	const notification = new Notification({
		title: title,
		body: body
	});
	notification.show();
	notification.on('click', () => {
		if (win) {
			getFocus();
		}
	});
	if (autoClose > 0) {
		setTimeout(() => {
			notification.close();
		}, autoClose);
	}
}

function notifyTrx(title, body, autoClose, trx_id) {
	const notification = new Notification({
		title: title,
		body: body
	});
	notification.show();

	notification.on('click', () => {
		shell.openExternal('https://wax.bloks.io/transaction/' + trx_id);
	});

	if (autoClose > 0) {
		setTimeout(() => {
			notification.close();
		}, autoClose);
	}
}


async function claimGBM(account_name, private_key, permission, rpc) {
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
		authorization: [{
			actor: account_name,
			permission: permission,
		}],
		data: {
			voter: account_name,
			proxy: _proxy,
			producers: _producers
		},
	});

	_actions.push({
		account: 'eosio',
		name: 'claimgenesis',
		authorization: [{
			actor: account_name,
			permission: permission,
		}],
		data: {
			claimer: account_name
		},
	});

	_actions.push({
		account: 'eosio',
		name: 'claimgbmvote',
		authorization: [{
			actor: account_name,
			permission: permission,
		}],
		data: {
			owner: account_name
		},
	});

	try {
		const result = await api.transact({
			actions: _actions
		}, {
			blocksBehind: 3,
			expireSeconds: 30,
			broadcast: true
		});
		// console.log(result);
		const logFile = basePath + '/autoclaim-trx-log_' + (Date.now()) + '.txt';
		fs.writeFileSync(logFile, JSON.stringify(result));
		notifyTrx('Auto-claim executed', 'Account: ' + account_name, 0, result.transaction_id);
		return true;

	} catch (e) {
		console.log('\nCaught exception: ' + e);
		let claimError = '';
		if (e instanceof RpcError) {
			// console.log(JSON.stringify(e.json, null, 2));
			const eJson = e.json;
			switch (eJson.error.code.toString()) {
				case "3090005": {
					claimError = 'Irrelevant authority included, missing linkauth';
					break;
				}
				case "3050003": {
					claimError = 'Account already claimed in the past 24 hours. Please wait.';
					break;
				}
				default: {
					claimError = eJson.error.what;
				}
			}

			notify('Auto-claim error', 'Account: ' + account_name + '\n Error: ' + claimError, 0);
		}
		throw new Error(claimError);
	}
}

function addTrayIcon() {
	appIcon = new Tray(path.join(__dirname, 'static/tray-icon.png'));
	const trayMenu = Menu.buildFromTemplate([
		{
			label: 'Quit SimplEOS Agent', click: () => {
				appIcon.destroy();
				fs.writeFileSync(lockFile, '');
				app.quit();
			}
		}
	]);
	appIcon.setToolTip('simplEOS Agent');
	appIcon.setContextMenu(trayMenu);
	appIcon.setHighlightMode('always');
}

function storeConfig(autoClaimConfig) {
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

function writeLog(msg) {
	const now = moment().format('YYYY-MM-DD HH:mm:ss');
	msg = "[" + now + "] - " + msg;
	console.log(msg);
	fs.appendFileSync(logFile, msg + "\n");
}

async function getClaimTime(account, rpc) {
	const genesis_table = await rpc.get_table_rows({
		json: true, scope: account, code: "eosio", table: "genesis", limit: 1
	});
	if (genesis_table.rows.length === 1) {
		return moment.utc(genesis_table.rows[0].last_claim_time);
	} else {
		return null;
	}
}

async function safeRun(callback, errorReturn, api_list) {
	let result = null;
	let api_idx = 0;
	if (api_idx < api_list.length) {
		for (const api of api_list) {
			try {
				setRpcApi(api_list[api_idx]);
				result = await callback(eosRPC);
			} catch (e) {
				if (e.message) {
					console.log(`${api_list[api_idx]} failed with error: ${e.message}`);
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

let eosRPC = null;

function setRpcApi(api) {
	eosRPC = new JsonRpc(api, {fetch});
}

function runAutoClaim() {
	writeLog("Checking claim conditions...");
	const cPath = basePath + '/autoclaim.json';
	if (fs.existsSync(basePath + '/autoclaim.json')) {
		fs.readFile(cPath, (err, data) => {
			if (err) throw err;
			let autoclaimConf = JSON.parse(data.toString());
			(async () => {
				if (autoclaimConf['enabled']) {
					const apis = autoclaimConf['WAX-GBM']['apis'];
					setRpcApi(apis[0]);
					for (const job of autoclaimConf['WAX-GBM']['jobs']) {
						const a = await safeRun((api) => getClaimTime(job.account, api), null, apis);
						if (a) {
							a.add(1, 'day');
							const b = moment().utc();
							if (b.diff(a, 'seconds') > 0) {
								writeLog(`${job.account} is ready to claim!`);
								try {
									const pvtkey = await keytar.getPassword('simpleos', job['public_key']);
									const perm = job['permission'];
									const claimResult = await safeRun((api) => claimGBM(job.account, pvtkey, perm, api), null, apis);
									if (claimResult) {
										job['last_claim'] = Date.now();
										schedule.scheduleJob(a.toDate(), () => {
											runAutoClaim();
										});
									}
								} catch (e) {
									const logFile = basePath + '/autoclaim-error_' + (Date.now()) + '.txt';
									fs.writeFileSync(logFile, e);
									writeLog(`Autoclaim error, check log file: ${logFile}`);
									// shell.openItem(logFile);
									schedule.scheduleJob(b.add(10, 'minutes').toDate(), () => {
										runAutoClaim();
									});
								}
							} else {
								writeLog(`${job.account} claims again at ${a.format()}`);
							}
						}
					}
					storeConfig(autoclaimConf);
				}
			})().catch(console.log);
		});
	}

}


function launchApp() {

	const gotTheLock = app.requestSingleInstanceLock();

	process.defaultApp = true;
	console.log(gotTheLock);


	if (fs.existsSync(lockLaunchFile)) {
		if (gotTheLock) {
			unlinkLLock();
		} else {
			console.log('quiting');
			app.quit();
			return;
		}
	}
	appendLock();


	portfinder.getPortPromise().then((port) => {
		http.listen(port, "127.0.0.1", () => {
			console.log('listening on 127.0.0.1:' + port);
		});
	}).catch((err) => {
		alert(err);
	});

	app.on('second-instance', () => {
		console.log('launching second instance...');
		if (win) {
			if (win.isMinimized()) {
				win.restore();
			}
			win.focus();
		}
	});

	app.on('ready', () => {
		console.log('ready');
		createWindow();
	});

	app.on('window-all-closed', () => {
		clearLock();
		unlinkLLock();
		app.quit();
	});

	app.on('activate', async () => {
		if (win === null) {
			await createWindow();
		}
	});

	app.on('will-finish-launching', () => {
		app.on('open-url', (e, url) => {
			e.preventDefault();
			console.log(url);
		})
	});
}

// Main startup logic

if (isAutoLaunch) {

	// check if another agent is running
	app.requestSingleInstanceLock();
	app.on('second-instance', (event, argv, workingDirectory) => {
		if (argv[1] === '--autostart') {
			app.quit();
		}
	});
	app.on('ready', () => {
		clearLock();
		appendLock();
		console.log('READY!');
		const cPath = basePath + '/autoclaim.json';
		if (fs.existsSync(basePath + '/autoclaim.json')) {
			console.log('Loading configuration file...');
			fs.readFile(cPath, (err, data) => {
				if (err) throw err;
				let autoclaimConf = JSON.parse(data.toString());
				if (autoclaimConf['enabled']) {
					addTrayIcon();
					runAutoClaim();
					if (process.platform === 'darwin') {
						app.dock.hide();
					}
				} else {
					app.quit();
				}
			});
		}
	});

} else {
	setupExpress();
	launchApp();

	// add agent
	if (!devMode) {
		const spawn = require('child_process').spawn;
		spawn(process.execPath, ['--autostart'], {
			stdio: 'ignore',
			detached: true
		}).unref();
	}
}




