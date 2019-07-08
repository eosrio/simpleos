const {app, BrowserWindow, Menu, protocol, ipcMain, Notification, Tray, shell} = require('electron');
const path = require('path');
const url = require('url');
const {version, productName, name} = require('./package.json');
app.getVersion = () => version;
const PROTOCOL_PREFIX = 'simpleos';
const args = process.argv.slice(1);

const portfinder = require('portfinder');
portfinder['basePort'] = 47888;
portfinder['highestPort'] = 47900;

const schedule = require('node-schedule');

const keytar = require('keytar');
const fs = require('fs');

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
devtools = args.some(val => val === '--devtools');
serve = args.some(val => val === '--serve');
isAutoLaunch = args.some(val => val === '--autostart');

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
		win.webContents.send('request', {
			message: 'login',
			content: {
				account: req.query.account
			}
		});
		getFocus();
		if (req.query.account) {
			if (req.query.account.length > 13) {
				res.end('ERROR');
				return false;
			}
		}
		ipcMain.once('loginResponse', (event, data) => {
			console.log(data);
			if (data.status !== 'CANCELLED') {
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
			alert(deepLink);
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
		} else {
			launchApp();
			createWindow();
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

function launchApp() {
	const gotTheLock = app.requestSingleInstanceLock();
	if (!gotTheLock) {
		app.quit()
	} else {
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
			console.log('creating window...');
			createWindow();
		});

		app.on('window-all-closed', () => {
			app.quit();
		});

		app.on('activate', async () => {
			if (win === null) {
				await createWindow();
			}
		});
	}
}

async function claimGBM(account_name, api_url, private_key, permission) {
	const rpc = new JsonRpc(api_url, {fetch});
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
			permission: 'claim',
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
			permission: 'claim',
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
		console.log(result);
		const logFile = 'autoclaim-trx-log_' + (Date.now()) + '.txt';
		fs.writeFileSync(logFile, JSON.stringify(result));
		notifyTrx('Auto-claim executed', 'Account: ' + account_name, 0, result.transaction_id);
	} catch (e) {
		console.log('\nCaught exception: ' + e);
		if (e instanceof RpcError)
			console.log(JSON.stringify(e.json, null, 2));
	}
}

function addTrayIcon() {
	const trayIcon = path.join(__dirname, 'src/assets/icons/ico/simpleos-multi.ico');
	console.log(trayIcon);
	appIcon = new Tray(trayIcon);
	const trayMenu = Menu.buildFromTemplate([
		{
			label: 'Quit SimplEOS Agent', click: () => {
				appIcon.destroy();
				app.quit();
			}
		}
	]);
	appIcon.setToolTip('simplEOS Agent');
	appIcon.setContextMenu(trayMenu);
	console.log('Adding tray icon');
}

function storeConfig(autoClaimConfig) {
	try {
		const data = JSON.stringify(autoClaimConfig, null, '\t');
		fs.writeFileSync('autoclaim.json', data);
	} catch (e) {
		const logFile = 'autoclaim-error_' + (Date.now()) + '.txt';
		fs.writeFileSync(logFile, e);
		shell.openItem(logFile);
		console.log(e);
	}
}

// Main startup logic

function runAutoClaim() {
	const cPath = 'autoclaim.json';
	if (fs.existsSync('autoclaim.json')) {
		console.log('Loading configuration file...');
		fs.readFile(cPath, (err, data) => {
			if (err) throw err;
			let autoclaimConf = JSON.parse(data);
			(async () => {
				if (autoclaimConf['WAX-GBM']) {
					for (const job of autoclaimConf['WAX-GBM']['jobs']) {
						if (Date.now() - job['last_claim'] > (24 * 60 * 60 * 1000)) {
							console.log(`${job.account} is ready to claim!`);
							try {
								await claimGBM(job.account, autoclaimConf['WAX-GBM']['apis'][0], (await keytar.getPassword('simpleos', job['public_key'])), job['permission']);
								job['last_claim'] = Date.now();
								// const next_claim = (Date.now() + (24 * 60 * 60 * 1000));
								const next_claim = (Date.now() + (60 * 1000));
								console.log('Scheduling next claim to: ' + next_claim);
								job['next_claim_time'] = next_claim;
								schedule.scheduleJob(new Date(next_claim), () => {
									runAutoClaim();
								});
							} catch (e) {
								const logFile = 'autoclaim-error_' + (Date.now()) + '.txt';
								fs.writeFileSync(logFile, e);
								shell.openItem(logFile);
								console.log(e);
							}
						} else {
							console.log(`${job.account} claims again at ${(new Date(job['last_claim'] + (24 * 60 * 60 * 1000)))}`);
						}
					}
					storeConfig(autoclaimConf);
				}
			})();
		});

	} else {
		console.log('Configuration file not present, quitting');
		app.quit();
	}
}

if (isAutoLaunch) {
	app.on('ready', () => {
		console.log('READY!');
		addTrayIcon();
	});
	runAutoClaim();
} else {
	setupExpress();
	launchApp();
}




