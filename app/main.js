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
exports.SimpleosWallet = void 0;
const local_config_storage_1 = require("./modules/local-config-storage");
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const claim_rewards_1 = require("./modules/claim-rewards");
const simpleos_connect_1 = require("./modules/simpleos-connect");
const ledger_manager_1 = require("./modules/ledger-manager");
const transit_api_1 = require("./modules/transit-api");
const util_1 = require("./util");
const electron_context_menu_1 = __importDefault(require("electron-context-menu"));
const child_process_1 = require("child_process");
const crypto_1 = require("crypto");
const keytar_1 = require("keytar");
const args = process.argv.slice(1);
// process.defaultApp = true;
const { version, productName, compilerVersion } = require('../package.json');
const AutoLaunch = require('easy-auto-launch');
class SimpleosWallet {
    constructor() {
        this.PROTOCOL_PREFIX = 'simpleos';
        this.devMode = require.main.filename.indexOf('app.asar') === -1;
        this.loginOpts = electron_1.app.getLoginItemSettings({
            args: ['--autostart'],
        });
        this.localConfig = new local_config_storage_1.LocalConfigStorage();
        if (compilerVersion === 'DEFAULT') {
            this.simpleosAutoLauncher = new AutoLaunch({ name: 'simpleos' });
            this.claimRW = new claim_rewards_1.ClaimRewardsService(this);
        }
        else {
            electron_1.app.setLoginItemSettings({ openAtLogin: false, args: ['--autostart'] });
            electron_1.app.setLoginItemSettings({ openAtLogin: false });
        }
    }
    launchServices() {
        return __awaiter(this, void 0, void 0, function* () {
            // simpleos connect
            this.connect = new simpleos_connect_1.SimpleosConnectService(this);
            this.connect.init();
            yield this.connect.startServer();
            // transit api
            this.transit = new transit_api_1.TransitApiService(this);
            this.transit.init();
            yield this.transit.startServer();
            // ledger integration
            this.ledger = new ledger_manager_1.LedgerManager(this);
        });
    }
    init() {
        electron_1.app.getVersion = () => version;
        this.devtools = args.some(val => val === '--devtools');
        this.debug = args.some(val => val === '--debug');
        this.serve = args.some(val => val === '--serve');
        this.isAutoLaunch = this.loginOpts.wasOpenedAtLogin || args.some(val => val === '--autostart');
        if (this.claimRW) {
            this.claimRW.writeLog(`Developer Mode: ${this.devMode}`);
            util_1.Logger.info(`Developer Mode: ${this.devMode}`);
            this.claimRW.writeLog(`Auto Launcher: ${JSON.stringify(this.simpleosAutoLauncher)}`);
            // TODO: find a way to pass the params
            // this.simpleosAutoLauncher.opts.path += ' --autostart';
            this.simpleosAutoLauncher.isEnabled().then((status) => {
                util_1.Logger.info(`AutoLaunch: ${status}`);
                if (status) {
                    util_1.Logger.info('AutoLaunch already enabled!');
                    return;
                }
                if (!this.devMode) {
                    util_1.Logger.info('enabling auto-launch');
                    this.simpleosAutoLauncher.enable();
                }
            }).catch((err) => {
                util_1.Logger.warn(err);
            });
            electron_1.app.setLoginItemSettings({
                openAtLogin: !this.devMode,
                args: ['--autostart'],
            });
        }
        (0, electron_context_menu_1.default)();
    }
    runAutoLaunchMode() {
        // check if another agent is running
        util_1.Logger.info(`run Auto Launch Mode...`);
        electron_1.app.on('second-instance', (event, argv) => {
            util_1.Logger.info(`check if another agent is running...`);
            if (argv[1] === '--autostart') {
                this.claimRW.writeLog(`Force quit agent in second instance...`);
                electron_1.app.quit();
            }
        });
        electron_1.app.on('quit', () => {
            this.claimRW.writeLog(`Quitting Agent...`);
            this.claimRW.unlinkLALock();
        });
        electron_1.app.on('ready', () => {
            this.claimRW.unlinkLALock();
            this.appendLock();
            this.claimRW.autoClaimCheck();
            if (this.claimRW.autoClaimEnabled && productName === 'simpleos') {
                this.claimRW.addTrayIcon();
                this.claimRW.runAutoClaim();
                if (process.platform === 'darwin') {
                    electron_1.app.dock.hide();
                }
            }
            else {
                this.claimRW.writeLog(`Quitting disabled auto claim...`);
                electron_1.app.quit();
            }
            electron_1.powerMonitor.on('suspend', () => {
                this.claimRW.rescheduleAutoClaim();
            });
            electron_1.powerMonitor.on('resume', () => {
                this.claimRW.rescheduleAutoClaim();
            });
            electron_1.powerMonitor.on('lock-screen', () => {
                this.claimRW.rescheduleAutoClaim();
            });
        });
    }
    run() {
        if (this.isAutoLaunch && this.claimRW) {
            this.runAutoLaunchMode();
        }
        else {
            this.launchApp();
            if (this.claimRW) {
                this.claimRW.autoClaimCheck();
                if (this.claimRW.autoClaimEnabled) {
                    if (!(fs.existsSync(this.claimRW.lockAutoLaunchFile)) && productName === 'simpleos') {
                        (0, child_process_1.spawn)(process.execPath, ['--autostart'], {
                            detached: true,
                            stdio: ['ignore', 'ignore', 'ignore']
                        }).unref();
                    }
                }
            }
        }
    }
    appendLock() {
        const pidString = process.pid.toString(10);
        if (this.isAutoLaunch) {
            fs.writeFileSync(this.claimRW.lockAutoLaunchFile, pidString);
        }
        else {
            fs.writeFileSync(this.claimRW.lockLaunchFile, pidString);
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
            electron_1.app.dock.hide();
            this.win.setAlwaysOnTop(false);
            this.win.setVisibleOnAllWorkspaces(true);
            this.win.setFullScreenable(false);
            electron_1.app.dock.show().catch(util_1.Logger.warn);
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
                if (this.claimRW) {
                    this.claimRW.writeLog(`unfocus `);
                }
                electron_1.Menu.sendActionToFirstResponder('hide:');
                break;
            }
        }
    }
    regURI() {
        electron_1.app.setAsDefaultProtocolClient(this.PROTOCOL_PREFIX);
        electron_1.protocol.registerHttpProtocol(this.PROTOCOL_PREFIX, (req, callback) => {
            if (req.url.length < 128) {
                this.deepLink = req;
                setTimeout(() => {
                    this.win.webContents.send('request', { message: 'launch', content: this.deepLink.url });
                    this.win.webContents.send('electron', { message: 'type', content: process.platform });
                }, 5000);
            }
            callback({});
        });
    }
    launchApp() {
        if (this.claimRW) {
            const gotTheLock = electron_1.app.requestSingleInstanceLock();
            this.claimRW.writeLog(`On Launching File LAUNCH: ${(fs.existsSync(this.claimRW.lockLaunchFile))} | The LOCK: ${gotTheLock}`);
            if (fs.existsSync(this.claimRW.lockLaunchFile)) {
                if (gotTheLock) {
                    this.claimRW.unlinkLLock();
                }
                else {
                    util_1.Logger.info('quiting');
                    electron_1.app.quit();
                    return;
                }
            }
            this.appendLock();
            electron_1.app.on('second-instance', () => {
                util_1.Logger.info('launching second instance...');
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
    notifyTrx(title, body, autoClose, trxId) {
        const notification = new electron_1.Notification({ title, body });
        notification.show();
        notification.on('click', () => {
            electron_1.shell.openExternal('https://wax.bloks.io/transaction/' + trxId).catch(util_1.Logger.warn);
        });
        if (autoClose > 0) {
            setTimeout(() => {
                notification.close();
            }, autoClose);
        }
    }
    notify(title, body, autoClose) {
        const notification = new electron_1.Notification({ title, body });
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
    createWindow() {
        return __awaiter(this, void 0, void 0, function* () {
            this.regURI();
            let icon = path.join(__dirname, '../resources/icons/simpleos/256x256.png');
            let bgColor = '#222222';
            if (compilerVersion === 'LIBERLAND') {
                icon = path.join(__dirname, '../resources/icons/liberland/256x256.png');
                bgColor = '#2a566f';
            }
            if (!fs.existsSync(icon)) {
                util_1.Logger.info('failed to load icon file');
            }
            const savedBounds = yield this.localConfig.getKey('windowBounds');
            if (savedBounds) {
                this.bounds = JSON.parse(savedBounds);
            }
            else {
                this.bounds = {
                    width: 1440,
                    height: 920,
                };
            }
            this.win = new electron_1.BrowserWindow({
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
            electron_1.ipcMain.on('electron', (event, data) => {
                if (data === 'request_os') {
                    this.win.webContents.send('electron', { event: 'platform_reply', content: process.platform });
                }
            });
            this.attachIPCHandlers();
            this.attachWindowHandlers();
            if (this.serve) {
                try {
                    require('electron-reloader')(module);
                    util_1.Logger.info(`electron-reloader loaded`);
                }
                catch (e) {
                    util_1.Logger.info(`electron-reloader failed to load with error: ${e.message}`);
                }
                // load from local webserver
                yield this.win.loadURL('http://localhost:7777');
            }
            else {
                // Path when running electron executable
                let pathIndex = './index.html';
                if (fs.existsSync(path.join(__dirname, '../dist/index.html'))) {
                    // Path when running electron in local folder
                    pathIndex = '../dist/index.html';
                }
                // standard execution
                const url = new URL(path.join('file:', __dirname, pathIndex));
                yield this.win.loadURL(url.href);
            }
            // catch console logs from angular app
            if (this.debug) {
                this.webContents.on('console-message', (e, level, msg, line) => {
                    if (level === 1) {
                        util_1.Logger.info(`Log [${line}]: ${msg}`);
                    }
                });
            }
            util_1.Logger.info(`DevTools: ${this.devtools}`);
            if (this.devtools) {
                this.webContents.openDevTools();
            }
            else {
                this.webContents.on('devtools-opened', () => {
                    util_1.Logger.info('DevTools opened');
                    this.webContents.closeDevTools();
                });
            }
            this.win.on('closed', () => {
                this.win = null;
            });
        });
    }
    updateSavedBounds(debounce) {
        if (debounce) {
            if (!this.winStoreTimer) {
                this.winStoreTimer = setTimeout(() => {
                    const bounds = JSON.stringify(this.win.getBounds());
                    this.localConfig.setKey('windowBounds', bounds).catch(util_1.Logger.warn);
                }, 2000);
            }
        }
        else {
            const obj = this.win.getBounds();
            obj.isMaximized = this.win.isMaximized();
            const bounds = JSON.stringify(obj);
            this.localConfig.setKey('windowBounds', bounds).catch(util_1.Logger.warn);
        }
    }
    attachWindowHandlers() {
        this.win.once('ready-to-show', () => {
            util_1.Logger.info('main window is ready');
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
            }
            else {
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
    attachIPCHandlers() {
        // show error dialog
        electron_1.ipcMain.handle('show-error-box', (event, data) => __awaiter(this, void 0, void 0, function* () {
            electron_1.dialog.showErrorBox(data.title, data.content);
        }));
        // show message box
        electron_1.ipcMain.handle('show-message-box', (event, options) => __awaiter(this, void 0, void 0, function* () {
            return yield electron_1.dialog.showMessageBox(options);
        }));
        // get app path
        electron_1.ipcMain.handle('get-app-path', (event, suffix) => __awaiter(this, void 0, void 0, function* () {
            return path.join(this.localConfig.basePath, suffix);
        }));
        // native prompt for export folder
        electron_1.ipcMain.handle('read-export-dir', (event, filename) => __awaiter(this, void 0, void 0, function* () {
            // noinspection JSCheckFunctionSignatures
            const dirs = yield electron_1.dialog.showOpenDialog({ properties: ['openDirectory'] });
            if (dirs.filePaths.length > 0) {
                return path.join(dirs.filePaths[0], filename);
            }
            else {
                return null;
            }
        }));
        // native prompt for open file
        electron_1.ipcMain.handle('read-open-file', () => __awaiter(this, void 0, void 0, function* () {
            // noinspection JSCheckFunctionSignatures
            const selected = yield electron_1.dialog.showOpenDialog({ properties: ['openFile'] });
            if (selected.filePaths.length > 0) {
                return selected.filePaths[0];
            }
            else {
                return null;
            }
        }));
        // extract key from local keytar
        electron_1.ipcMain.handle('keytar-getPassword', (event, key) => __awaiter(this, void 0, void 0, function* () {
            return yield (0, keytar_1.getPassword)('simpleos', key);
        }));
        // generate random bytes
        electron_1.ipcMain.handle('get-rnd-bytes', (event, size) => __awaiter(this, void 0, void 0, function* () {
            return (0, crypto_1.randomBytes)(size);
        }));
        // window max
        electron_1.ipcMain.handle('window-maximize', () => {
            if (this.win.isMaximized()) {
                this.win.restore();
            }
            else {
                this.win.maximize();
            }
        });
        // window min
        electron_1.ipcMain.handle('window-minimize', () => {
            this.win.minimize();
        });
        // window close
        electron_1.ipcMain.handle('window-close', () => {
            this.win.close();
        });
    }
    attachAppHandlers() {
        electron_1.app.on('ready', () => __awaiter(this, void 0, void 0, function* () {
            util_1.Logger.info('Electron ready');
            yield this.launchServices();
            this.createWindow().catch(util_1.Logger.warn);
        }));
        electron_1.app.on('window-all-closed', () => {
            if (this.claimRW) {
                this.claimRW.writeLog(`Quitting Application...`);
                this.claimRW.clearLock();
                this.claimRW.unlinkLLock();
            }
            electron_1.app.quit();
        });
        electron_1.app.on('activate', () => __awaiter(this, void 0, void 0, function* () {
            if (this.win === null) {
                yield this.createWindow();
            }
        }));
        electron_1.app.on('will-finish-launching', () => {
            electron_1.app.on('open-url', (e, url) => {
                // e.preventDefault();
                util_1.Logger.info(url);
            });
        });
    }
}
exports.SimpleosWallet = SimpleosWallet;
const wallet = new SimpleosWallet();
wallet.init();
wallet.run();
//# sourceMappingURL=main.js.map