const args = process.argv.slice(1);
process.defaultApp = true;

const systemVersion = process.getSystemVersion();
console.log(systemVersion);

const {
    app,
    BrowserWindow,
    Notification,
    Menu,
    protocol,
    shell,
    powerMonitor,
    ipcMain,
    webContents
} = require('electron');

const path = require('path');
const {version, productName, name, compilerVersion} = require('./package.json');
const url = require('url');
const {spawn} = require('child_process');
const contextMenu = require('electron-context-menu');
const AutoLaunch = require('auto-launch');
const fs = require('fs');

const {TransitApiService} = require('./electron_modules/transit-api');
const {SimpleosConnectService} = require('./electron_modules/simpleos-connect');
const {LedgerManager} = require('./electron_modules/ledger-manager');
const {ClaimRewardsService} = require('./electron_modules/claim-rewards.js');

class SimpleosWallet {

    // wax auto claim manager
    claimRW;

    // ledger hardware wallet connector
    ledger;

    // transit api service
    transit;

    // simpleos connect service
    connect;

    // chrome window object
    win;
    webContents;

    devtools;
    serve;
    debug;
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

    launchServices() {
        // simpleos connect
        this.connect = new SimpleosConnectService(this);
        this.connect.init();
        this.connect.startServer();

        // transit api
        this.transit = new TransitApiService(this);
        this.transit.init();
        this.transit.startServer();

        // ledger integration
        this.ledger = new LedgerManager(this);
    }

    init() {
        app.allowRendererProcessReuse = true;
        app.getVersion = () => version;

        this.devtools = args.some(val => val === '--devtools');
        this.debug = args.some(val => val === '--debug');
        this.serve = args.some(val => val === '--serve');

        this.claimRW.writeLog(`Developer Mode: ${this.devMode}`);
        console.log('Developer Mode:', this.devMode);

        this.claimRW.writeLog(
            `Auto Launcher: ${JSON.stringify(this.simpleosAutoLauncher)}`,
        );

        this.simpleosAutoLauncher.opts.appPath += ' --autostart';

        this.simpleosAutoLauncher.isEnabled().then((status) => {
            console.log('AUTO_LAUNCH:', status);
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
        this.isAutoLaunch = this.loginOpts.wasOpenedAtLogin ||
            args.some(val => val === '--autostart');
        contextMenu();
    }

    runAutoLaunchMode() {
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
    }

    run() {
        // Main startup logic
        if (this.isAutoLaunch) {
            this.runAutoLaunchMode();
        } else {
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
                    this.win.webContents.send('electron', {message: 'type', content: process.platform});
                }, 5000);
            }
            callback();
        });
    }

    launchApp() {
        const gotTheLock = app.requestSingleInstanceLock();
        this.claimRW.writeLog(`On Launching File LAUNCH: ${(fs.existsSync(
            this.claimRW.lockLaunchFile))} | The LOCK: ${gotTheLock}`);
        if (fs.existsSync(this.claimRW.lockLaunchFile)) {
            if (gotTheLock) {
                this.claimRW.unlinkLLock();
            } else {
                console.log('quiting');
                app.quit();
                return;
            }
        }

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
            console.log('Electron ready');
            this.launchServices();
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

        let _icon = path.join(__dirname, 'build/icons/simpleos/icon.png');
        let _bgColor = '#222222';
        if (compilerVersion === 'LIBERLAND') {
            _icon = path.join(__dirname, 'build/icons/liberland/icon.png');
            _bgColor = '#2a566f';
        }

        if (!fs.existsSync(_icon)) {
            console.log('failed to load icon file');
        }

        this.win = new BrowserWindow({
            title: productName,
            show: false,
            paintWhenInitiallyHidden: true,
            titleBarStyle: 'hiddenInset',
            webPreferences: {
                nodeIntegration: true,
                webSecurity: !this.serve,
                devTools: this.devtools,
            },
            darkTheme: true,
            width: 1440,
            height: 920,
            minWidth: 1024,
            minHeight: 600,
            backgroundColor: _bgColor,
            frame: false,
            enableRemoteModule: false,
        });

        this.webContents = this.win.webContents;

        this.webContents.on('did-finish-load', (e) => {
            console.log('did-finish-load');
            this.win.setTitle(productName);
            this.win.setIcon(_icon);
            ipcMain.on('electronOS', (event, args) => {
                console.log(args);
                if (args === 'request_os') {
                    this.win.webContents.send('electronOS', {message: 'type', content: process.platform});
                }
            });
        });

        this.win.once('ready-to-show', () => {
            console.log('window ready to show');
            this.win.show();
        });

        // win.removeMenu();

        console.log('SERVE:', this.serve);
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

        // catch console logs from angular app
        if (this.debug) {
            this.webContents.on('console-message', (e, level, msg, line) => {
                if (level === 1) {
                    console.log(`Log [${line}]: ${msg}`);
                }
            });
        }


        console.log('DEVTOOLS:', this.devtools);
        if (this.devtools) {
            this.webContents.openDevTools();
        } else {
            this.webContents.on('devtools-opened', () => {
                console.log('devtools opened');
                this.webContents.closeDevTools();
            });
        }

        this.win.on('closed', () => {
            this.win = null;
        });

    }
}

const wallet = new SimpleosWallet();
wallet.init();
wallet.run();


