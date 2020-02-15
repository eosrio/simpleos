const args = process.argv.slice(1);
// process.traceDeprecation = true;
// process.traceProcessWarnings = true;
// process.throwDeprecation = true;
process.defaultApp = true;

const {app, BrowserWindow, Notification, Menu, protocol, ipcMain, shell, powerMonitor} = require('electron');
const path = require('path');
const portfinder = require('portfinder');
const {version, productName, name} = require('./package.json');
const url = require('url');
const cors = require('cors');
const bodyParser = require('body-parser');
const express = require('express')();
const http = require('http').createServer(express);
const {spawn} = require('child_process');

// const io = require('socket.io')(http);

const contextMenu = require('electron-context-menu');
const AutoLaunch = require('auto-launch');
const fs = require('fs');


const {LedgerManager} = require("./ledger-manager");
const {ClaimRewardsService} = require('./claim-rewards.js');

class SimpleosWallet {
	claimRW;
	ledger;
	win;
	devtools;
	serve;
	isAutoLaunch;
	deepLink;
	isEnableAutoClaim = false;
	PROTOCOL_PREFIX = 'simpleos';
	simpleosAutoLauncher = new AutoLaunch({name: 'simpleos'});
	devMode = process.mainModule.filename.indexOf('app.asar') === -1;
	loginOpts = app.getLoginItemSettings({
		args: ['--autostart'],
	});

	constructor() {
		this.claimRW = new ClaimRewardsService(this);
	}

	init() {
		app.allowRendererProcessReuse = true;
		app.getVersion = () => version;
		portfinder['basePort'] = 47888;
		portfinder['highestPort'] = 49800;
		this.devtools = args.some(val => val === '--devtools');
		this.serve = args.some(val => val === '--serve');
		this.claimRW.writeLog(`Developer Mode: ${this.devMode}`);
		console.log('Developer Mode:', this.devMode);
		this.claimRW.writeLog(`simpleos Auto Launcher: ${JSON.stringify(this.simpleosAutoLauncher)}`);
		this.simpleosAutoLauncher.opts.appPath += ' --autostart';
		this.simpleosAutoLauncher.isEnabled().then((status) => {
			console.log('STATUS:', status);
			if (status) {
				console.log('Auto launch already enabled!');
				return;
			}
			if (!this.devMode) {
				console.log('Enabling auto-launch!');
				this.simpleosAutoLauncher.enable();
			}
		}).catch(function (err) {
			console.log(err);
		});
		app.setLoginItemSettings({
			openAtLogin: !this.devMode,
			args: ['--autostart'],
		});
		this.isAutoLaunch = this.loginOpts.wasOpenedAtLogin || args.some(val => val === '--autostart');
		contextMenu();
	}

	run() {
		// Main startup logic
		if (this.isAutoLaunch) {
			// check if another agent is running
			app.on('second-instance', (event, argv) => {
				if (argv[1] === '--autostart') {
					this.claimRW.writeLog(`Force quit agent in second instance...`);
					app.quit();
				}
			});

			app.on('quit', () => {
				this.claimRW.writeLog(`Quitting Agent...`);
				this.claimRW.unlinkLALock();
			});

			app.on('ready', () => {
				this.claimRW.unlinkLALock();
				this.appendLock();
				this.claimRW.autoClaimCheck();
				console.log('READY!');
				if (this.isEnableAutoClaim && productName === 'simpleos') {
					this.claimRW.addTrayIcon();
					this.claimRW.runAutoClaim();
					if (process.platform === 'darwin') {
						app.dock.hide();
					}
				} else {
					this.claimRW.writeLog(`Quitting disabled auto claim...`);
					app.quit();
				}
				powerMonitor.on('suspend', () => {
					this.claimRW.rescheduleAutoClaim();
				});
				powerMonitor.on('resume', () => {
					this.claimRW.rescheduleAutoClaim();
				});
				powerMonitor.on('lock-screen', () => {
					this.claimRW.rescheduleAutoClaim();
				});
			});
		} else {
			this.setupExpress();
			this.launchApp();
			this.claimRW.autoClaimCheck();
			if (this.isEnableAutoClaim) {
				if (!(fs.existsSync(this.claimRW.lockAutoLaunchFile)) && productName ===
					'simpleos') {
					spawn(process.execPath, ['--autostart'], {
						detached: true,
						stdio: ['ignore', 'ignore', 'ignore'],
					}).unref();
				}
			}
		}
	}

	appendLock() {
		if (this.isAutoLaunch) {
			fs.writeFileSync(this.claimRW.lockAutoLaunchFile, process.pid);
		} else {
			fs.writeFileSync(this.claimRW.lockLaunchFile, process.pid);
		}
	}

	setupExpress() {
		console.log('Setup Express');

		express.use(cors());

		express.get('/ping', (req, res) => {
			res.end('OK');
		});

		express.get('/accounts', (req, res) => {
			this.win.webContents.send('request', 'accounts');
			ipcMain.once('accountsResponse', (event, data) => {
				console.log(data);
				res.setHeader('Content-Type', 'application/json');
				res.end(JSON.stringify(data));
			});
		});

		express.get('/getPublicKeys', (req, res) => {
			this.win.webContents.send('request', {
				message: 'publicKeys',
			});
			ipcMain.once('publicKeyResponse', (event, data) => {
				console.log(data);
				res.setHeader('Content-Type', 'application/json');
				res.end(JSON.stringify(data));
			});
		});

		express.post('/sign', bodyParser.json(), (req, res) => {
			this.win.webContents.send('request', {
				message: 'sign',
				content: req.body,
			});
			this.getFocus();
			ipcMain.once('signResponse', (event, data) => {
				console.log(data);
				res.setHeader('Content-Type', 'application/json');
				if (data.status !== 'CANCELLED') {
					this.unfocus();
				}
				res.end(JSON.stringify(data));
			});
		});

		express.get('/connect', (req, res) => {
			console.log('CONNECT REQUEST');
			this.getFocus();
			this.win.webContents.send('request', {
				message: 'connect',
				content: {
					appName: req.query['appName'],
					chainId: req.query['chainId'],
				},
			});
			if (req.query['appName'].length < 32 && req.query['chainId'].length ===
				64) {
				ipcMain.once('connectResponse', (event, data) => {
					console.log(data);
					res.setHeader('Content-Type', 'application/json');
					res.end(JSON.stringify(data));
				});
			}
		});

		express.get('/login', (req, res) => {
			console.log('CONNECT REQUEST, account:' + req.query.account);
			this.win.webContents.send('request', {
				message: 'login',
				content: {
					account: req.query.account,
				},
			});
			if (!req.query.account) {
				this.getFocus();
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
							this.unfocus();
						}
					}
				} else {
					this.unfocus();
				}
				res.setHeader('Content-Type', 'application/json');
				res.end(JSON.stringify(data));
			});
		});

		express.get('/logout', (req, res) => {
			console.log('LOGOUT REQUEST');
			this.win.webContents.send('request', {
				message: 'logout',
				content: {
					account: req.query.account,
				},
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
			this.win.webContents.send('request', {
				message: 'disconnect',
			});
			ipcMain.once('disconnectResponse', (event, data) => {
				console.log(data);
				res.setHeader('Content-Type', 'application/json');
				res.end(JSON.stringify(data));
			});
		});
	}

	getFocus() {
		if (this.win) {
			if (this.win.isMinimized()) {
				this.win.restore();
			}
			this.win.focus();
			this.win.show();

		}

		if (process.platform === 'darwin') {
			app.dock.hide();
			this.win.setAlwaysOnTop(false);
			this.win.setVisibleOnAllWorkspaces(true);
			this.win.setFullScreenable(false);
			app.dock.show().catch(console.log);
		}
	}

	unfocus() {
		switch (process.platform) {
			case 'win32': {
				this.win.minimize();
				break;
			}
			case 'linux': {
				this.win.hide();
				break;
			}
			case 'darwin': {
				this.claimRW.writeLog(`unfocus `);
				Menu.sendActionToFirstResponder('hide:');
				break;
			}
		}
	}

	regURI() {
		app.setAsDefaultProtocolClient(this.PROTOCOL_PREFIX);
		protocol.registerHttpProtocol(this.PROTOCOL_PREFIX, (req, callback) => {
			if (req.url < 128) {
				this.deepLink = req;
				setTimeout(() => {
					this.win.webContents.send('request', {
						message: 'launch',
						content: this.deepLink.url,
					});
				}, 5000);
			}
			callback();
		});
	}

	launchApp() {
		const gotTheLock = app.requestSingleInstanceLock();
		this.claimRW.writeLog(`On Launching File LAUNCH: ${(fs.existsSync(
			this.claimRW.lockLaunchFile))} | The LOCK: ${gotTheLock}`);
		try {
			portfinder.getPortPromise().then((port) => {
				http.listen(port, '127.0.0.1', () => {
					console.log('listening on 127.0.0.1:' + port);
				});
			}).catch((err) => {
				alert(err);
			});
		} catch (e) {
			console.log(e);
		}
		console.log('listen port');

		if (fs.existsSync(this.claimRW.lockLaunchFile)) {
			if (gotTheLock) {
				this.claimRW.unlinkLLock();
			} else {
				console.log('quiting');
				app.quit();
				return;
			}
		}

		console.log('Not gotTheLock');

		this.appendLock();

		app.on('second-instance', () => {
			console.log('launching second instance...');
			if (this.win) {
				if (this.win.isMinimized()) {
					this.win.restore();
				}
				this.win.focus();
			}
		});

		app.on('ready', () => {
			console.log('ready');
			this.ledger = new LedgerManager(this);
			this.createWindow().catch(console.log);
		});

		app.on('window-all-closed', () => {
			this.claimRW.writeLog(`Quitting Application...`);
			this.claimRW.clearLock();
			this.claimRW.unlinkLLock();
			app.quit();
		});

		app.on('activate', async () => {
			if (this.win === null) {
				await this.createWindow();
			}
		});

		app.on('will-finish-launching', () => {
			app.on('open-url', (e, url) => {
				//e.preventDefault();
				console.log(url);
			});
		});

	}

	notifyTrx(title, body, autoClose, trx_id) {
		const notification = new Notification({
			title: title,
			body: body,
		});
		notification.show();

		notification.on('click', () => {
			shell.openExternal('https://wax.bloks.io/transaction/' + trx_id).catch(console.log);
		});

		if (autoClose > 0) {
			setTimeout(() => {
				notification.close();
			}, autoClose);
		}
	}

	notify(title, body, autoClose) {
		const notification = new Notification({
			title: title,
			body: body,
		});
		notification.show();
		notification.on('click', () => {
			if (this.win) {
				this.getFocus();
			}
		});
		if (autoClose > 0) {
			setTimeout(() => {
				notification.close();
			}, autoClose);
		}
	}

	async createWindow() {
		this.regURI();
		let _icon = path.join(__dirname, 'src/assets/icons/ico/simpleos.ico');
		let _bgColor = '#222222';
		if (name === 'liberland-wallet') {
			_icon = path.join(__dirname, 'src/assets/icons/ico/ll.ico');
			_bgColor = '#084577';
		}
		this.win = new BrowserWindow({
			title: productName,
			titleBarStyle: 'hiddenInset',
			webPreferences: {
				nodeIntegration: true,
				webSecurity: !this.serve,
				devTools: true,
			},
			darkTheme: true,
			width: 1440,
			height: 920,
			minWidth: 1024,
			minHeight: 600,
			backgroundColor: _bgColor,
			frame: false,
			icon: _icon,
			enableRemoteModule: false,
		});

		// win.removeMenu();
		console.log(

		);
		if (this.serve) {
			require('electron-reload')(__dirname, {
				electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
				hardResetMethod: 'exit',
			});
			await this.win.loadURL('http://localhost:7777');
		} else {
			await this.win.loadURL(url.format({
				pathname: path.join(__dirname, 'ng-dist/index.html'),
				protocol: 'file:',
				slashes: true,
			}));
		}

		if (this.devtools) {
			this.win.webContents['openDevTools']();
		}

		this.win.webContents.on('did-finish-load', () => {
			this.win.setTitle(productName);
		});

		this.win.on('closed', () => {
			this.win = null;
		});
	}
}

const wallet = new SimpleosWallet();
wallet.init();
wallet.run();



