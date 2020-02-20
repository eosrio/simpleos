const {ipcMain} = require('electron');
const cors = require('cors');
const bodyParser = require('body-parser');
const express = require('express');
const http = require('http');
const portfinder = require('portfinder');

class TransitApiService {
    main;
    expressApp;
    httpServer;

    constructor(simpleosWallet) {
        this.main = simpleosWallet;
        this.expressApp = express();
        this.httpServer = http.createServer(this.expressApp);
    }

    init() {
        portfinder['basePort'] = 47888;
        portfinder['highestPort'] = 49800;
        this.setupRoutes();
    }

    sendMessage(channel, data) {
        this.main.win.webContents.send(channel, data);
    }

    setJsonHeader(res) {
        res.setHeader('Content-Type', 'application/json');
    }

    reply(res, data) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
    }

    setupRoutes() {
        this.expressApp.use(cors());

        // ping
        this.expressApp.get('/ping', (req, res) => {
            res.end('OK');
        });

        // accounts
        this.expressApp.get('/accounts', (req, res) => {
            this.sendMessage('request', 'accounts');
            ipcMain.once('accountsResponse', (event, data) => {
                this.reply(res, data);
            });
        });

        // get public keys
        this.expressApp.get('/getPublicKeys', (req, res) => {
            this.sendMessage('request', {
                message: 'publicKeys',
            });
            ipcMain.once('publicKeyResponse', (event, data) => {
                this.reply(res, data);
            });
        });

        // connect
        this.expressApp.get('/connect', (req, res) => {

            console.log('CONNECT REQUEST');
            this.main.getFocus();

            this.sendMessage('request', {
                message: 'connect',
                content: {
                    appName: req.query['appName'],
                    chainId: req.query['chainId'],
                },
            });

            if (req.query.appName.length < 32 && req.query.chainId.length === 64) {
                ipcMain.once('connectResponse', (event, data) => {
                    this.reply(res, data);
                });
            }
        });

        // login
        this.expressApp.get('/login', (req, res) => {
            console.log('CONNECT REQUEST, account:' + req.query.account);

            this.sendMessage('request', {
                message: 'login',
                content: {
                    account: req.query.account,
                },
            });

            if (!req.query.account) {
                this.main.getFocus();
            }

            if (req.query.account) {
                if (req.query.account.length > 13) {
                    res.end('ERROR');
                    return false;
                }
            }

            ipcMain.once('loginResponse', (event, data) => {
                if (data.status) {
                    if (data.status !== 'CANCELLED') {
                        if (!req.query.account) {
                            this.main.unfocus();
                        }
                    }
                } else {
                    this.main.unfocus();
                }
                this.reply(res, data);
            });
        });

        // logout
        this.expressApp.get('/logout', (req, res) => {
            console.log('LOGOUT REQUEST');

            this.sendMessage('request', {
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
                this.reply(res, data);
            });
        });

        // disconnect
        this.expressApp.get('/disconnect', (req, res) => {
            console.log('DISCONNECT REQUEST');

            this.sendMessage('request', {
                message: 'disconnect',
            });

            ipcMain.once('disconnectResponse', (event, data) => {
                this.reply(res, data);
            });
        });

        // sign
        this.expressApp.post('/sign', bodyParser.json(), (req, res) => {

            this.sendMessage('request', {
                message: 'sign',
                content: req.body,
            });

            this.main.getFocus();

            ipcMain.once('signResponse', (event, data) => {
                if (data.status !== 'CANCELLED') {
                    this.main.unfocus();
                }
                this.reply(res, data);
            });

        });
    }

    startServer() {
        try {
            portfinder.getPortPromise().then((port) => {
                this.httpServer.listen(port, '127.0.0.1', () => {
                    console.log('transit api listening on port' + port);
                });
            }).catch((err) => {
                console.log(err);
            });
        } catch (e) {
            console.log(e);
        }
    }

}

module.exports = {TransitApiService};
