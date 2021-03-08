const {ipcMain} = require('electron');
const express = require('express');
const http = require('http');
const cors = require('cors');
const socketio = require('socket.io');
const {Logger} = require('./util');

class SimpleosConnectService {

    main;
    express;
    httpServer;
    websocketServer;

    currentSessionUuid;
    currentAuthorization;

    constructor(simpleosWallet) {
        this.main = simpleosWallet;
        this.express = express();
        this.httpServer = http.createServer(this.express);
        this.websocketServer = socketio(this.httpServer);

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
        this.express.use(cors());

        this.express.get('/simpleos_ping', (req, res) => {
            res.end('pong');
        });
    }

    startServer(port = 5000) {
        try {
            this.httpServer.listen(port, '127.0.0.1', () => {
                Logger.info(`SimplEOS Connect API listening on local port: ${port}`);
            });
        } catch (error) {
            Logger.warn(error);
        }

        this.websocketServer.on('connection', this.onConnection);
    }

    onConnection(socket) {
        Logger.info('new connection');

        socket.on('disconnect', this.onDisconnect);

        socket.on('get_authorizations', this.onGetAuthorizations);

        socket.on('log_in', this.onLogIn);

        socket.on('log_out', this.onLogOut);

        socket.on('is_logged_in', this.onIsLoggedIn);

        socket.on('get_current_authorization', this.onGetCurrentAuthorization);

        socket.on('transact', this.onTransact);
    }

    onDisconnect(reason) {
        Logger.info('disconnection reason:', reason);
    }

    onGetAuthorizations(chainId, callback) {
        Logger.info('onGetAuthorizations');
        this.main.getFocus();
        this.sendMessage('sc_request',
            {message: 'change_chain', chain_id: chainId});

        ipcMain.once('changeChainResponse', (event, changeChainResp) => {

            if (changeChainResp) {

                this.sendMessage('sc_request', {message: 'authorizations'});

                ipcMain.once('authorizationsResponse', (event, authorizations) => {
                    callback(authorizations);
                });

            } else {
                callback();
            }

        });
    }

    onLogIn(sessionUuid, authorization, callback) {
        Logger.info('onLogIn');

        this.currentSessionUuid = sessionUuid;
        this.currentAuthorization = authorization;

        callback();
    }

    onLogOut(callback) {
        Logger.info('onLogOut');

        this.currentSessionUuid = '';
        this.currentAuthorization = null;

        callback();
    }

    onIsLoggedIn(sessionUuid, callback) {
        Logger.info('isLoggedIn');

        callback(
            this.currentSessionUuid === sessionUuid && this.currentAuthorization);
    }

    onGetCurrentAuthorization(sessionUuid, callback) {
        Logger.info('onGetCurrentAuthorization');

        if (sessionUuid === this.currentSessionUuid) {
            callback(this.currentAuthorization);
            return;
        }
        callback();
    }

    onTransact(transaction, callback) {
        Logger.info('onTransact');

        this.sendMessage('sc_request', {
            message: 'sign',
            content: transaction,
        });

        this.main.getFocus();

        ipcMain.once('signResponse', (event, data) => {
            if (data.status !== 'CANCELLED') {
                this.main.unfocus();
            }
            Logger.info(data);
            callback(data);
        });
    }

    sendMessage(channel, data) {
        this.main.win.webContents.send(channel, data);
    }

}

module.exports = {SimpleosConnectService};
