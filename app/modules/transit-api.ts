import Fastify, {FastifyInstance} from 'fastify';
import * as portfinder from 'portfinder';
import fastifyCors from 'fastify-cors';
import { ipcMain } from 'electron';
import {Logger} from '../util';


export class TransitApiService {
    main;
    fastify: FastifyInstance = Fastify({});

    constructor(simpleosWallet) {
        this.main = simpleosWallet;
    }

    init(): void {
        portfinder.setBasePort(47888);
        portfinder.setHighestPort(49800);
        this.setupRoutes();
    }

    sendMessage(channel, data): void {
        this.main.win.webContents.send(channel, data);
    }

    setupRoutes(): void {
        this.fastify.register(fastifyCors);

        // ping
        this.fastify.get('/ping', (request, reply) => {
            reply.send('OK');
        });

        // accounts
        this.fastify.get('/accounts', (request, reply) => {
            this.sendMessage('request', 'accounts');
            ipcMain.once('accountsResponse', (event, data) => {
                reply.send(data);
            });
        });

        // get public keys
        this.fastify.get('/getPublicKeys', (request, reply) => {
            this.sendMessage('request', {
                message: 'publicKeys',
            });
            ipcMain.once('publicKeyResponse', (event, data) => {
                reply.send(data);
            });
        });

        // connect
        this.fastify.get('/connect', (request, reply) => {
            const query = request.query as any;
            Logger.info('CONNECT REQUEST');
            this.main.getFocus();
            this.sendMessage('request', {
                message: 'connect',
                content: {
                    appName: query.appName,
                    chainId: query.chainId,
                },
            });
            if (query.appName.length < 32 && query.chainId.length === 64) {
                ipcMain.once('connectResponse', (event, data) => {
                    reply.send(data);
                });
            }
        });

        // login
        this.fastify.get('/login', (request, reply) => {
            const query = request.query as any;
            Logger.info('CONNECT REQUEST, account:' + query.account);
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
            ipcMain.once('loginResponse', (event, data) => {
                if (data.status) {
                    if (data.status !== 'CANCELLED') {
                        if (!query.account) {
                            this.main.unfocus();
                        }
                    }
                } else {
                    this.main.unfocus();
                }
                reply.send(data);
            });
        });

        // logout
        this.fastify.get('/logout', (request, reply) => {
            const query = request.query as any;
            Logger.info('LOGOUT REQUEST');
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
            ipcMain.once('logoutResponse', (event, data) => {
                reply.send(data);
            });
        });

        // disconnect
        this.fastify.get('/disconnect', (request, reply) => {
            Logger.info('DISCONNECT REQUEST');
            this.sendMessage('request', {message: 'disconnect'});
            ipcMain.once('disconnectResponse', (event, data) => {
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
            ipcMain.once('signResponse', (event, data) => {
                if (data.status !== 'CANCELLED') {
                    this.main.unfocus();
                }
                reply.send(data);
            });
        });
    }

    async startServer(): Promise<void> {
        try {
            const availablePort = await portfinder.getPortPromise();
            await this.fastify.listen({
                port: availablePort,
                host: '127.0.0.1'
            });
            Logger.info(`Transit API listening on local port: ${availablePort}`);
        } catch (e) {
            Logger.warn(e);
        }
    }

}
