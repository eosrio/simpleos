import {LocalConfigStorage} from './modules/local-config-storage';
import {app, BrowserWindow, dialog, ipcMain, Menu, Notification, powerMonitor, protocol, shell} from 'electron';

import * as path from 'path';
import * as fs from 'fs';
import {ClaimRewardsService} from './modules/claim-rewards';
import {SimpleosConnectService} from './modules/simpleos-connect';
import {LedgerManager} from './modules/ledger-manager';
import {TransitApiService} from './modules/transit-api';
import {Logger} from './util';
import contextMenu from 'electron-context-menu';
import {spawn} from 'child_process';

import {randomBytes} from 'crypto';
import {getPassword} from 'keytar';

const args = process.argv.slice(1);
// process.defaultApp = true;

const {version, productName, compilerVersion} = require('../package.json');
const AutoLaunch = require('easy-auto-launch');

export class SimpleosWallet {

    // wax auto claim manager (only loaded on DEFAULT compiler)
    claimRW: ClaimRewardsService;

    // ledger hardware wallet connector
    ledger: LedgerManager;

    // transit api service
    transit: TransitApiService;

    // simpleos connect service
    connect: SimpleosConnectService;

    // level db storage
    localConfig: LocalConfigStorage;

    // chrome window object
    win;
    webContents;
    bounds;
    winStoreTimer;

    // launch flags
    devtools;
    serve;
    debug;
    isAutoLaunch;

    deepLink;
    PROTOCOL_PREFIX = 'simpleos';
    simpleosAutoLauncher: any;

    devMode: boolean = require.main.filename.indexOf('app.asar') === -1;
    loginOpts = app.getLoginItemSettings({
        args: ['--autostart'],
    });

    constructor() {
        this.localConfig = new LocalConfigStorage();
        if (compilerVersion === 'DEFAULT') {
            this.simpleosAutoLauncher = new AutoLaunch({name: 'simpleos'});
            this.claimRW = new ClaimRewardsService(this);
        } else {
            app.setLoginItemSettings({openAtLogin: false, args: ['--autostart']});
            app.setLoginItemSettings({openAtLogin: false});
        }
    }

    async launchServices(): Promise<void> {
        // simpleos connect
        this.connect = new SimpleosConnectService(this);
        this.connect.init();
        await this.connect.startServer();

        // transit api
        this.transit = new TransitApiService(this);
        this.transit.init();
        await this.transit.startServer();

        // ledger integration
        this.ledger = new LedgerManager(this);
    }

    init(): void {
        app.getVersion = () => version;
        this.devtools = args.some(val => val === '--devtools');
        this.debug = args.some(val => val === '--debug');
        this.serve = args.some(val => val === '--serve');
        this.isAutoLaunch = this.loginOpts.wasOpenedAtLogin || args.some(val => val === '--autostart');
        if (this.claimRW) {
            this.claimRW.writeLog(`Developer Mode: ${this.devMode}`);
            Logger.info(`Developer Mode: ${this.devMode}`);
            this.claimRW.writeLog(
                `Auto Launcher: ${JSON.stringify(this.simpleosAutoLauncher)}`,
            );

            // TODO: find a way to pass the params
            // this.simpleosAutoLauncher.opts.path += ' --autostart';

            this.simpleosAutoLauncher.isEnabled().then((status) => {
                Logger.info(`AutoLaunch: ${status}`);
                if (status) {
                    Logger.info('AutoLaunch already enabled!');
                    return;
                }
                if (!this.devMode) {
                    Logger.info('enabling auto-launch');
                    this.simpleosAutoLauncher.enable();
                }
            }).catch((err) => {
                Logger.warn(err);
            });
            app.setLoginItemSettings({
                openAtLogin: !this.devMode,
                args: ['--autostart'],
            });
        }
        contextMenu();
    }

    runAutoLaunchMode(): void {
        // check if another agent is running
        Logger.info(`run Auto Launch Mode...`);
        app.on('second-instance', (event, argv) => {
            Logger.info(`check if another agent is running...`);
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
            if (this.claimRW.autoClaimEnabled && productName === 'simpleos') {
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

    run(): void {
        if (this.isAutoLaunch && this.claimRW) {
            this.runAutoLaunchMode();
        } else {
            this.launchApp();
            if (this.claimRW) {
                this.claimRW.autoClaimCheck();
                if (this.claimRW.autoClaimEnabled) {
                    if (!(fs.existsSync(this.claimRW.lockAutoLaunchFile)) && productName === 'simpleos') {
                        spawn(process.execPath, ['--autostart'], {
                            detached: true,
                            stdio: ['ignore', 'ignore', 'ignore']
                        }).unref();
                    }
                }
            }
        }
    }

    appendLock(): void {
        const pidString = process.pid.toString(10);
        if (this.isAutoLaunch) {
            fs.writeFileSync(this.claimRW.lockAutoLaunchFile, pidString);
        } else {
            fs.writeFileSync(this.claimRW.lockLaunchFile, pidString);
        }
    }

    getFocus(): void {
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
            app.dock.show().catch(Logger.warn);
        }
    }

    unfocus(): void {
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
                if (this.claimRW) {
                    this.claimRW.writeLog(`unfocus `);
                }
                Menu.sendActionToFirstResponder('hide:');
                break;
            }
        }
    }

    regURI(): void {
        app.setAsDefaultProtocolClient(this.PROTOCOL_PREFIX);
        protocol.registerHttpProtocol(this.PROTOCOL_PREFIX, (req, callback) => {
            if (req.url.length < 128) {
                this.deepLink = req;
                setTimeout(() => {
                    this.win.webContents.send('request', {message: 'launch', content: this.deepLink.url});
                    this.win.webContents.send('electron', {message: 'type', content: process.platform});
                }, 5000);
            }
            callback({});
        });
    }

    launchApp(): void {
        if (this.claimRW) {
            const gotTheLock = app.requestSingleInstanceLock();
            this.claimRW.writeLog(`On Launching File LAUNCH: ${(fs.existsSync(
                this.claimRW.lockLaunchFile))} | The LOCK: ${gotTheLock}`);
            if (fs.existsSync(this.claimRW.lockLaunchFile)) {
                if (gotTheLock) {
                    this.claimRW.unlinkLLock();
                } else {
                    Logger.info('quiting');
                    app.quit();
                    return;
                }
            }
            this.appendLock();
            app.on('second-instance', () => {
                Logger.info('launching second instance...');
                if (this.win) {
                    if (this.win.isMinimized()) {
                        this.win.restore();
                    }
                    this.win.focus();
                }
            });
        }
        this.attachAppHandlers();
    }

    notifyTrx(title, body, autoClose, trxId): void {
        const notification = new Notification({title, body});
        notification.show();
        notification.on('click', () => {
            shell.openExternal('https://wax.bloks.io/transaction/' + trxId).catch(Logger.warn);
        });
        if (autoClose > 0) {
            setTimeout(() => {
                notification.close();
            }, autoClose);
        }
    }

    notify(title, body, autoClose): void {
        const notification = new Notification({title, body});
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

    async createWindow(): Promise<void> {
        this.regURI();
        let icon = path.join(__dirname, '../resources/icons/simpleos/256x256.png');
        let bgColor = '#222222';

        if (compilerVersion === 'LIBERLAND') {
            icon = path.join(__dirname, '../resources/icons/liberland/256x256.png');
            bgColor = '#2a566f';
        }

        if (!fs.existsSync(icon)) {
            Logger.info('failed to load icon file');
        }

        const savedBounds = await this.localConfig.getKey('windowBounds');
        if (savedBounds) {
            this.bounds = JSON.parse(savedBounds);
        } else {
            this.bounds = {
                width: 1440,
                height: 920,
            };
        }

        this.win = new BrowserWindow({
            title: productName,
            show: false,
            paintWhenInitiallyHidden: true,
            titleBarStyle: 'hiddenInset',
            webPreferences: {
                nodeIntegration: true,
                nodeIntegrationInWorker: true,
                webSecurity: !this.serve,
                devTools: this.devtools,
                contextIsolation: false,
            },
            x: this.bounds.x,
            y: this.bounds.y,
            darkTheme: true,
            width: this.bounds.width,
            height: this.bounds.height,
            minWidth: 1024,
            minHeight: 600,
            backgroundColor: bgColor,
            frame: false,
        });

        this.webContents = this.win.webContents;

        this.webContents.on('did-finish-load', () => {
            this.win.setTitle(productName);
            this.win.setIcon(icon);
        });

        ipcMain.on('electron', (event, data) => {
            if (data === 'request_os') {
                this.win.webContents.send('electron', {event: 'platform_reply', content: process.platform});
            }
        });

        this.attachIPCHandlers();
        this.attachWindowHandlers();

        if (this.serve) {
            try {
                require('electron-reloader')(module);
                Logger.info(`electron-reloader loaded`);
            } catch (e) {
                Logger.info(`electron-reloader failed to load with error: ${e.message}`);
            }

            // load from local webserver
            await this.win.loadURL('http://localhost:7777');
        } else {

            // Path when running electron executable
            let pathIndex = './index.html';
            if (fs.existsSync(path.join(__dirname, '../dist/index.html'))) {
                // Path when running electron in local folder
                pathIndex = '../dist/index.html';
            }
            // standard execution
            const url = new URL(path.join('file:', __dirname, pathIndex));
            await this.win.loadURL(url.href);
        }

        // catch console logs from angular app
        if (this.debug) {
            this.webContents.on('console-message', (e, level, msg, line) => {
                if (level === 1) {
                    Logger.info(`Log [${line}]: ${msg}`);
                }
            });
        }

        Logger.info(`DevTools: ${this.devtools}`);

        if (this.devtools) {
            this.webContents.openDevTools();
        } else {
            this.webContents.on('devtools-opened', () => {
                Logger.info('DevTools opened');
                this.webContents.closeDevTools();
            });
        }

        this.win.on('closed', () => {
            this.win = null;
        });

    }

    updateSavedBounds(debounce?: boolean): void {
        if (debounce) {
            if (!this.winStoreTimer) {
                this.winStoreTimer = setTimeout(() => {
                    const bounds = JSON.stringify(this.win.getBounds());
                    this.localConfig.setKey('windowBounds', bounds).catch(Logger.warn);
                }, 2000);
            }
        } else {
            const obj = this.win.getBounds();
            obj.isMaximized = this.win.isMaximized();
            const bounds = JSON.stringify(obj);
            this.localConfig.setKey('windowBounds', bounds).catch(Logger.warn);
        }
    }

    attachWindowHandlers(): void {
        this.win.once('ready-to-show', () => {
            Logger.info('main window is ready');
            this.win.show();
            setTimeout(() => {
                if (this.bounds.isMaximized) {
                    this.win.maximize();
                }
            }, 500);
        });

        this.win.on('resize', () => {
            // save window state
            if (this.win.isMaximized()) {
                this.win.webContents.send('electron', {
                    event: 'isMaximized',
                    content: this.win.isMaximized(),
                });
            } else {
                this.updateSavedBounds(true);
            }
        });

        this.win.on('move', () => {
            this.updateSavedBounds(true);
        });

        this.win.on('close', () => {
            this.updateSavedBounds();
        });
    }

    attachIPCHandlers(): void {
        // show error dialog
        ipcMain.handle('show-error-box', async (event, data) => {
            dialog.showErrorBox(data.title, data.content);
        });

        // show message box
        ipcMain.handle('show-message-box', async (event, options) => {
            return await dialog.showMessageBox(options);
        });

        // get app path
        ipcMain.handle('get-app-path', async (event, suffix) => {
            return path.join(this.localConfig.basePath, suffix);
        });

        // native prompt for export folder
        ipcMain.handle('read-export-dir', async (event, filename) => {
            // noinspection JSCheckFunctionSignatures
            const dirs = await dialog.showOpenDialog({properties: ['openDirectory']});
            if (dirs.filePaths.length > 0) {
                return path.join(dirs.filePaths[0], filename);
            } else {
                return null;
            }
        });

        // native prompt for open file
        ipcMain.handle('read-open-file', async () => {
            // noinspection JSCheckFunctionSignatures
            const selected = await dialog.showOpenDialog({properties: ['openFile']});
            if (selected.filePaths.length > 0) {
                return selected.filePaths[0];
            } else {
                return null;
            }
        });

        // extract key from local keytar
        ipcMain.handle('keytar-getPassword', async (event, key) => {
            return await getPassword('simpleos', key);
        });

        // generate random bytes
        ipcMain.handle('get-rnd-bytes', async (event, size) => {
            return randomBytes(size);
        });

        // window max
        ipcMain.handle('window-maximize', () => {
            if (this.win.isMaximized()) {
                this.win.restore();
            } else {
                this.win.maximize();
            }
        });

        // window min
        ipcMain.handle('window-minimize', () => {
            this.win.minimize();
        });

        // window close
        ipcMain.handle('window-close', () => {
            this.win.close();
        });
    }

    attachAppHandlers(): void {
        app.on('ready', async () => {
            Logger.info('Electron ready');
            await this.launchServices();
            this.createWindow().catch(Logger.warn);
        });

        app.on('window-all-closed', () => {
            if (this.claimRW) {
                this.claimRW.writeLog(`Quitting Application...`);
                this.claimRW.clearLock();
                this.claimRW.unlinkLLock();
            }
            app.quit();
        });

        app.on('activate', async () => {
            if (this.win === null) {
                await this.createWindow();
            }
        });

        app.on('will-finish-launching', () => {
            app.on('open-url', (e, url) => {
                // e.preventDefault();
                Logger.info(url);
            });
        });
    }
}

const wallet = new SimpleosWallet();
wallet.init();
wallet.run();


