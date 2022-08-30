"use strict";
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
exports.SimpleosConnectService = void 0;
const fastify_1 = __importDefault(require("fastify"));
const socket_io_1 = require("socket.io");
const fastify_cors_1 = __importDefault(require("fastify-cors"));
const util_1 = require("../util");
const electron_1 = require("electron");
class SimpleosConnectService {
    constructor(simpleosWallet) {
        this.fastify = (0, fastify_1.default)({});
        this.main = simpleosWallet;
        this.currentSessionUuid = '';
        this.currentAuthorization = null;
        this.onConnection = this.onConnection.bind(this);
        this.onDisconnect = this.onDisconnect.bind(this);
        this.onGetAuthorizations = this.onGetAuthorizations.bind(this);
        this.onLogIn = this.onLogIn.bind(this);
        this.onLogOut = this.onLogOut.bind(this);
        this.onIsLoggedIn = this.onIsLoggedIn.bind(this);
        this.onGetCurrentAuthorization = this.onGetCurrentAuthorization.bind(this);
        this.onTransact = this.onTransact.bind(this);
    }
    init() {
        this.setupRoutes();
    }
    setupRoutes() {
        this.fastify.register(fastify_cors_1.default);
        this.fastify.get('/simpleos_ping', (request, reply) => {
            reply.send('pong');
        });
    }
    startServer(port = 5000) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.fastify.listen({ port, host: '127.0.0.1' });
                util_1.Logger.info(`SimplEOS Connect API listening on local port: ${port}`);
                this.websocketServer = new socket_io_1.Server(this.fastify.server);
                this.websocketServer.on('connection', this.onConnection);
            }
            catch (err) {
                util_1.Logger.warn(err);
            }
        });
    }
    onConnection(socket) {
        util_1.Logger.info('new connection');
        socket.on('disconnect', this.onDisconnect);
        socket.on('get_authorizations', this.onGetAuthorizations);
        socket.on('log_in', this.onLogIn);
        socket.on('log_out', this.onLogOut);
        socket.on('is_logged_in', this.onIsLoggedIn);
        socket.on('get_current_authorization', this.onGetCurrentAuthorization);
        socket.on('transact', this.onTransact);
    }
    onDisconnect(reason) {
        util_1.Logger.info('disconnection reason: ' + reason);
    }
    onGetAuthorizations(chainId, callback) {
        util_1.Logger.info('onGetAuthorizations');
        this.main.getFocus();
        this.sendMessage('sc_request', { message: 'change_chain', chain_id: chainId });
        electron_1.ipcMain.once('changeChainResponse', (event, changeChainResp) => {
            if (changeChainResp) {
                this.sendMessage('sc_request', { message: 'authorizations' });
                electron_1.ipcMain.once('authorizationsResponse', (event2, authorizations) => {
                    callback(authorizations);
                });
            }
            else {
                callback();
            }
        });
    }
    onLogIn(sessionUuid, authorization, callback) {
        util_1.Logger.info('onLogIn');
        this.currentSessionUuid = sessionUuid;
        this.currentAuthorization = authorization;
        callback();
    }
    onLogOut(callback) {
        util_1.Logger.info('onLogOut');
        this.currentSessionUuid = '';
        this.currentAuthorization = null;
        callback();
    }
    onIsLoggedIn(sessionUuid, callback) {
        util_1.Logger.info('isLoggedIn');
        callback(this.currentSessionUuid === sessionUuid && this.currentAuthorization);
    }
    onGetCurrentAuthorization(sessionUuid, callback) {
        util_1.Logger.info('onGetCurrentAuthorization');
        if (sessionUuid === this.currentSessionUuid) {
            callback(this.currentAuthorization);
            return;
        }
        callback();
    }
    onTransact(transaction, callback) {
        util_1.Logger.info('onTransact');
        this.sendMessage('sc_request', {
            message: 'sign',
            content: transaction,
        });
        this.main.getFocus();
        electron_1.ipcMain.once('signResponse', (event, data) => {
            if (data.status !== 'CANCELLED') {
                this.main.unfocus();
            }
            util_1.Logger.info(data);
            callback(data);
        });
    }
    sendMessage(channel, data) {
        this.main.win.webContents.send(channel, data);
    }
}
exports.SimpleosConnectService = SimpleosConnectService;
//# sourceMappingURL=simpleos-connect.js.map