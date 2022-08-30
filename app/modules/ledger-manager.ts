import {SimpleosWallet} from '../main';

import {TextDecoder, TextEncoder} from 'util';
import * as asn1 from 'asn1-ber';
import {Api, JsonRpc, Numeric, Serialize} from 'enf-eosjs';
import {Logger} from '../util';
import * as bipPath from 'bip32-path';
import TransportNodeHid from '@ledgerhq/hw-transport-node-hid';
import {ipcMain} from 'electron';
import {JsSignatureProvider} from 'enf-eosjs/dist/eosjs-jssig';
import {Signature} from '../leap/Signature';
import {constructElliptic} from '../leap/KeyConversions';

import * as sudoPrompt from 'sudo-prompt';


const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

const codecs = {
    textEncoder: new TextEncoder(),
    textDecoder: new TextDecoder(),
};

const errorCodes = {
    26628: 'Device is not ready, please unlock',
    28160: 'EOS App is not ready, please open the eos app on your ledger',
    27013: 'User cancelled the process',
    27264: 'Invalid data, please enable arbitrary data on your ledger device',
};

const LC = {
    CLA: 0xD4,
    INFO: 0x06,
    PK: 0x02,
    SIGN: 0x04,
    YES: 0x01,
    NO: 0x00,
    FIRST: 0x00,
    MORE: 0x80,
};

const encode = (writer, buffer) => {
    return writer.writeBuffer(buffer, asn1.Ber.OctetString);
};

const serializeEosjs = (api, transaction) => {
    const types = {};
    api.abiTypes.forEach((value, key) => types[key] = value);
    api.transactionTypes.forEach((value, key) => types[key] = value);
    Object.keys(types).map((key) => {
        types[key].prepare = (raw) => {
            const buf = new Serialize.SerialBuffer(codecs);
            const aliasKey = (() => {
                switch (key) {
                    case 'account_name':
                    case 'action_name':
                    case 'permission_name':
                        return 'name';
                    default:
                        return key;
                }
            })();
            types[aliasKey].serialize(buf, raw);
            return Buffer.from(buf.asUint8Array());
        };
    });
    return serializeTransaction(api.chainId, transaction, types).buffer;
};

const serializeTransaction = (chainId, transaction, types) => {
    const writer = new asn1.BerWriter();

    encode(writer, types.checksum256.prepare(chainId));

    encode(writer, types.time_point_sec.prepare(transaction.expiration));

    encode(writer, types.uint16.prepare(transaction.ref_block_num));

    encode(writer, types.uint32.prepare(transaction.ref_block_prefix));

    encode(writer, types.varuint32.prepare(transaction.max_net_usage_words));

    encode(writer, types.uint8.prepare(transaction.max_cpu_usage_ms));

    encode(writer, types.varuint32.prepare(transaction.delay_sec));

    // context free actions
    encode(writer, types.uint8.prepare(0));

    // action list size
    encode(writer, types.uint8.prepare(transaction.actions.length));

    for (const act of transaction.actions) {
        encode(writer, types.name.prepare(act.account));
        encode(writer, types.name.prepare(act.name));

        // auth array size
        encode(writer, types.uint8.prepare(act.authorization.length));

        // push auths
        for (const auth of act.authorization) {
            encode(writer, types.name.prepare(auth.actor));
            encode(writer, types.name.prepare(auth.permission));
        }

        if (act.data) {
            // push serialized action data
            const data = Buffer.from(act.data, 'hex');
            encode(writer, types.varuint32.prepare(data.length));
            encode(writer, data);

        } else {

            try {
                encode(writer, types.varuint32.prepare(0));
                encode(writer, Buffer.alloc(0));
            } catch (e) {
                Logger.warn('err: ' + e.message);
            }

        }
    }

    // transaction extensions
    encode(writer, types.uint8.prepare(0));

    // checksum
    encode(writer, types.checksum256.prepare(Buffer.alloc(32, 0).toString('hex')));

    return writer;
};

const CHUNK_LIMIT = 128;

function splitPayload(rawTx, slot): any[] {
    const path = `44'/194'/0'/0/${slot}`;
    const paths = bipPath.fromString(path).toPathArray();
    const chunks = [];
    let offset = 0;
    const inputDataLength = 1 + (paths.length * 4);
    while (offset !== rawTx.length) {
        const maxChunkSize = (offset === 0) ? CHUNK_LIMIT - inputDataLength : CHUNK_LIMIT;
        const chunkSize = (offset + maxChunkSize > rawTx.length) ? rawTx.length - offset : maxChunkSize;
        let buffer;
        if (offset === 0) {
            buffer = Buffer.alloc(inputDataLength + chunkSize);
            buffer[0] = paths.length;
            paths.forEach((element, index) => buffer.writeUInt32BE(element, 1 + 4 * index));
            rawTx.copy(buffer, 1 + 4 * paths.length, offset, offset + chunkSize);
        } else {
            buffer = Buffer.alloc(chunkSize);
            rawTx.copy(buffer, 0, offset, offset + chunkSize);
        }
        chunks.push(buffer);
        offset += chunkSize;
    }
    return chunks;
}

export class LedgerManager {

    main: SimpleosWallet;
    listener;
    transport: TransportNodeHid;
    deviceDescriptor;
    errorMsg = '';
    rootRequested = false;

    constructor(simpleosWallet) {
        this.main = simpleosWallet;
        this.init().catch(Logger.warn);
    }

    async init(): Promise<void> {
        const hidStatus = await TransportNodeHid.isSupported();
        Logger.info(`HID Status: ${hidStatus}`);
        if (!hidStatus) {
            Logger.info('HID Supported: ' + hidStatus);
            process.exit();
        }

        ipcMain.on('ledger', async (event, args) => {
            if (args.event === 'sign_trx') {
                const results = await this.signTransaction(
                    args.data,
                    args.slot,
                    args.endpoint,
                );
                if (results) {
                    this.main.win.webContents.send('ledger_reply', {
                        event: 'sign_trx',
                        data: results,
                    });
                } else {
                    this.main.win.webContents.send('ledger_reply', {
                        event: 'sign_trx',
                        error: this.errorMsg,
                    });
                }
            }

            if (args.event === 'start_listener') {
                this.setupListener();
            }
            if (args.event === 'check_app') {
                Logger.info('ckecking status app');
                const status = await this.getEosAppStatus();
                this.main.win.webContents.send('ledger_reply', {
                    event: 'check_app',
                    data: status,
                });
            }
            if (args.event === 'read_slots') {

                if (!this.transport) {
                    await this.openTransport();
                }

                if (!this.deviceDescriptor) {
                    this.reportDeviceError();
                    return;
                }

                if (this.transport) {
                    for (let i = args.data.starts_on; i < args.data.size; i++) {
                        const results = await this.getAddressFromSlot(this.transport, i);
                        if (results) {
                            this.main.win.webContents.send('ledger_keys', {
                                event: 'read_key',
                                data: {
                                    address: results.address,
                                    slot: i,
                                },
                            });
                        } else {
                            this.reportDeviceError();
                            break;
                        }
                    }
                } else {
                    this.reportDeviceError();
                }
            }
        });
    }

    reportDeviceError(): void {
        // error reading from device
        this.main.win.webContents.send('ledger', {
            event: 'error',
            data: new Error('error reading from device'),
        });
    }

    async getAddressFromSlot(transport, slotIndex): Promise<any> {
        const path = `44'/194'/0'/0/${slotIndex}`;
        const paths = bipPath.fromString(path).toPathArray();
        const buf = Buffer.alloc(1 + paths.length * 4);
        buf[0] = paths.length;
        for (let i = 0; i < paths.length; i++) {
            buf.writeUInt32BE(paths[i], 1 + 4 * i);
        }
        try {
            const response = await this.transport.send(0xD4, 0x02, 0x00, 0x00, buf);
            const result: any = {};
            const pkl = response[0];
            const addl = response[1 + pkl];
            result.publicKey = response.slice(1, 1 + pkl).toString('hex');
            result.address = response.slice(1 + pkl + 1, 1 + pkl + 1 + addl).toString('ascii');
            result.chainCode = response.slice(1 + pkl + 1 + addl,
                1 + pkl + 1 + addl + 32).toString('hex');
            return result;
        } catch (e) {
            this.handleError(e);
            return null;
        }
    }

    handleError(e): void {
        this.main.win.webContents.send('ledger', {
            event: 'error',
            data: e,
        });
        if (errorCodes[e.statusCode]) {
            Logger.info(errorCodes[e.statusCode]);
        } else {
            Logger.info('-------------- TRANSPORT ERROR ------------');
            Logger.info(e);
            Logger.info(JSON.stringify(this.transport));
            Logger.info('-------------------------------------');
        }
    }

    async assertTransport(): Promise<void> {
        if (this.transport) {
            await this.transport.close();
        }
        this.transport = null;
        Logger.info('starting transport...');
        await this.openTransport();
    }

    async getEosAppStatus(): Promise<boolean> {
        await this.assertTransport();
        if (this.transport && !this.transport.disconnected) {
            try {
                await this.transport.send(LC.CLA, LC.INFO, LC.NO, LC.NO);
                Logger.info('app ready');
                return true;
            } catch (e) {
                Logger.warn('app not ready');
                this.handleError(e);
                return false;
            }
        } else {
            return false;
        }
    }

    setupListener(): void {
        if (this.listener) {
            this.listener.unsubscribe();
        }
        this.listener = TransportNodeHid.listen({
            next: (event) => {
                const strEV = JSON.stringify(event);
                if (event.type === 'add') {
                    this.deviceDescriptor = event.descriptor;
                } else if (event.type === 'remove') {
                    this.deviceDescriptor = null;
                }
                try {
                    this.main.win.webContents.send('ledger', {
                        event: 'listener_event',
                        data: JSON.parse(strEV),
                    });

                } catch (e) {
                    console.log(e);
                }
            },
            error: (err) => {
                Logger.warn(err);
                this.main.win.webContents.send('ledger', {
                    event: 'listener_error',
                    data: err,
                });
            },
            complete: () => {
                Logger.info('complete');
                this.main.win.webContents.send('ledger', {
                    event: 'listener_complete',
                });
            },
        });
    }

    setTransport(t: TransportNodeHid): void {
        this.transport = t;
        Logger.info(JSON.stringify(this.transport));
        Logger.info('transport ready');
    }

    async openTransport(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.deviceDescriptor) {
                Logger.info('attempting to open descriptor: ' + this.deviceDescriptor);
                try {
                    TransportNodeHid.open(this.deviceDescriptor).then(async (t) => {
                        await this.setTransport(t);
                        Logger.info(`opened descriptor:${this.deviceDescriptor} with success!`);
                        resolve();
                    }).catch((err) => {
                        Logger.warn('Failed to open transport with: ' + this.deviceDescriptor);
                        Logger.warn(err);
                        if (!this.rootRequested) {
                            this.rootRequested = true;
                            // setup permissions on usb port
                            const command = `chown $USER:root ${this.deviceDescriptor}`;
                            Logger.info(`Running "${command}" as root`);
                            sudoPrompt.exec(`chown $USER:root ${this.deviceDescriptor}`, {
                                name: 'SimplEOS Wallet',
                            }, (error, stdout, stderr) => {
                                if (error) {
                                    Logger.warn(error);
                                    Logger.warn(stdout);
                                    Logger.warn(stderr);
                                    reject(stderr);
                                } else {
                                    Logger.info('permissions updated');
                                    this.rootRequested = false;
                                    TransportNodeHid.open(this.deviceDescriptor).then(async (t) => {
                                        await this.setTransport(t);
                                        resolve();
                                    });
                                }
                            });
                        } else {
                            reject('permissions already requested');
                        }
                    });
                } catch (e) {
                    Logger.warn(e);
                    reject();
                }
            } else {
                reject();
            }
        });
    }

    async signTransaction(trxdata, slot, endpoint): Promise<any> {
        const localRpc = new JsonRpc(endpoint, {fetch});
        const api = new Api({
            rpc: localRpc,
            textDecoder,
            textEncoder,
            signatureProvider: new JsSignatureProvider([])
        });
        let result;
        try {
            result = await api.transact(trxdata, {
                expireSeconds: 300,
                sign: false,
                broadcast: false,
            });
        } catch (e) {
            Logger.warn(e.message);
            this.errorMsg = e.message;
            return null;
        }
        const decTrx = await api.deserializeTransaction(result.serializedTransaction);
        const rawTx = serializeEosjs(api, decTrx);
        const chunks = splitPayload(rawTx, slot);
        let response;
        for (let i = 0; i < chunks.length; i++) {
            try {

                response = await this.transport.send(LC.CLA, LC.SIGN, i === 0 ? LC.FIRST : LC.MORE, 0x00, chunks[i]);
            } catch (e) {
                this.handleError(e);
                return null;
            }
        }

        if (response.length >= 64) {
            const K1 = Numeric.KeyType.k1;
            const sig = new Signature({type: K1, data: response.slice(0, 65)}, constructElliptic(K1));
            result.signatures.push(sig.toString());
            return result;
        } else {
            return null;
        }
    }
}
