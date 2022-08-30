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
exports.TransitApiService = void 0;
const fastify_1 = __importDefault(require("fastify"));
const portfinder = __importStar(require("portfinder"));
const fastify_cors_1 = __importDefault(require("fastify-cors"));
const electron_1 = require("electron");
const util_1 = require("../util");
class TransitApiService {
    constructor(simpleosWallet) {
        this.fastify = (0, fastify_1.default)({});
        this.main = simpleosWallet;
    }
    init() {
        portfinder.setBasePort(47888);
        portfinder.setHighestPort(49800);
        this.setupRoutes();
    }
    sendMessage(channel, data) {
        this.main.win.webContents.send(channel, data);
    }
    setupRoutes() {
        this.fastify.register(fastify_cors_1.default);
        // ping
        this.fastify.get('/ping', (request, reply) => {
            reply.send('OK');
        });
        // accounts
        this.fastify.get('/accounts', (request, reply) => {
            this.sendMessage('request', 'accounts');
            electron_1.ipcMain.once('accountsResponse', (event, data) => {
                reply.send(data);
            });
        });
        // get public keys
        this.fastify.get('/getPublicKeys', (request, reply) => {
            this.sendMessage('request', {
                message: 'publicKeys',
            });
            electron_1.ipcMain.once('publicKeyResponse', (event, data) => {
                reply.send(data);
            });
        });
        // connect
        this.fastify.get('/connect', (request, reply) => {
            const query = request.query;
            util_1.Logger.info('CONNECT REQUEST');
            this.main.getFocus();
            this.sendMessage('request', {
                message: 'connect',
                content: {
                    appName: query.appName,
                    chainId: query.chainId,
                },
            });
            if (query.appName.length < 32 && query.chainId.length === 64) {
                electron_1.ipcMain.once('connectResponse', (event, data) => {
                    reply.send(data);
                });
            }
        });
        // login
        this.fastify.get('/login', (request, reply) => {
            const query = request.query;
            util_1.Logger.info('CONNECT REQUEST, account:' + query.account);
            this.sendMessage('request', {
                message: 'login',
                content: {
                    account: query.account,
                },
            });
            if (!query.account) {
                this.main.getFocus();
            }
            if (query.account) {
                if (query.account.length > 13) {
                    reply.send('ERROR');
                    return false;
                }
            }
            electron_1.ipcMain.once('loginResponse', (event, data) => {
                if (data.status) {
                    if (data.status !== 'CANCELLED') {
                        if (!query.account) {
                            this.main.unfocus();
                        }
                    }
                }
                else {
                    this.main.unfocus();
                }
                reply.send(data);
            });
        });
        // logout
        this.fastify.get('/logout', (request, reply) => {
            const query = request.query;
            util_1.Logger.info('LOGOUT REQUEST');
            this.sendMessage('request', {
                message: 'logout',
                content: {
                    account: query.account,
                },
            });
            if (query.account) {
                if (query.account.length > 13) {
                    reply.send('ERROR');
                    return false;
                }
            }
            electron_1.ipcMain.once('logoutResponse', (event, data) => {
                reply.send(data);
            });
        });
        // disconnect
        this.fastify.get('/disconnect', (request, reply) => {
            util_1.Logger.info('DISCONNECT REQUEST');
            this.sendMessage('request', { message: 'disconnect' });
            electron_1.ipcMain.once('disconnectResponse', (event, data) => {
                reply.send(data);
            });
        });
        // sign
        this.fastify.post('/sign', (request, reply) => {
            this.sendMessage('request', {
                message: 'sign',
                content: request.body,
            });
            this.main.getFocus();
            electron_1.ipcMain.once('signResponse', (event, data) => {
                if (data.status !== 'CANCELLED') {
                    this.main.unfocus();
                }
                reply.send(data);
            });
        });
    }
    startServer() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const availablePort = yield portfinder.getPortPromise();
                yield this.fastify.listen({
                    port: availablePort,
                    host: '127.0.0.1'
                });
                util_1.Logger.info(`Transit API listening on local port: ${availablePort}`);
            }
            catch (e) {
                util_1.Logger.warn(e);
            }
        });
    }
}
exports.TransitApiService = TransitApiService;
//# sourceMappingURL=transit-api.js.map