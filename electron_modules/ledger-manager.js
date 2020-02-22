const Transport = require('@ledgerhq/hw-transport-node-hid').default;
const {ipcMain} = require('electron');
const bippath = require('bip32-path');
const fetch = require('node-fetch');
const asn1 = require('asn1-ber');
const ecc = require('eosjs-ecc');
const {Api, JsonRpc, Serialize} = require('eosjs');
const util = require('util');
const textDecoder = new util.TextDecoder();
const textEncoder = new util.TextEncoder();

const encoderOptions = {textEncoder: new util.TextEncoder(), textDecoder: new util.TextDecoder()};

const sudo = require('sudo-prompt');

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
    return writer.writeBuffer(buffer, asn1.Ber['OctetString']);
};

const serializeEosjs = (api, transaction) => {
    const types = {};
    api.abiTypes.forEach((value, key) => types[key] = value);
    api.transactionTypes.forEach((value, key) => types[key] = value);
    Object.keys(types).map(key => {
        types[key].prepare = raw => {
            const buf = new Serialize.SerialBuffer(encoderOptions);
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
    console.log(types.action.fields);

    const serializedData = serialize(api.chainId, transaction, types).toString('hex');
    return Buffer.from(serializedData, 'hex');
};

const serialize = (chainId, transaction, types) => {
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
        for (const auth of act.authorization) {
            encode(writer, types.name.prepare(auth.actor));
            encode(writer, types.name.prepare(auth.permission));
        }
        if (act.data) {
            const data = Buffer.from(act.data, 'hex');
            encode(writer, types.varuint32.prepare(data.length));
            encode(writer, data);
        } else {
            try {
                encode(writer, types.uint8.prepare(0));
                encode(writer, Buffer.alloc(0));
            } catch (e) {
                console.log('err', e);
            }
        }
    }

    // transaction extensions
    encode(writer, types.uint8.prepare(0));

    // checksum
    encode(writer, types.checksum256.prepare(Buffer.alloc(32, 0).toString('hex')));
    return writer.buffer;
};

const CHUNK_LIMIT = 128;

function splitPayload(rawTx, slot) {
    const path = `44'/194'/0'/0/${slot}`;
    const paths = bippath.fromString(path).toPathArray();
    console.log('paths', paths);
    console.log(typeof rawTx);
    console.log('raw trx', rawTx);
    const chunks = [];
    let offset = 0;
    const inputDataLength = 1 + (paths.length * 4);
    console.log('rawTx.length:', rawTx.length);
    while (offset !== rawTx.length) {

        let maxChunkSize;
        if (offset === 0) {
            maxChunkSize = CHUNK_LIMIT - inputDataLength;
        } else {
            maxChunkSize = CHUNK_LIMIT;
        }
        console.log('max chunk size:', maxChunkSize);

        let chunkSize;
        if (offset + maxChunkSize > rawTx.length) {
            chunkSize = rawTx.length - offset;
        } else {
            chunkSize = maxChunkSize;
        }
        console.log('chunk size:', chunkSize);

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
        console.log('buffer:', buffer);

        chunks.push(buffer);
        offset += chunkSize;
    }
    return chunks;
}

class LedgerManager {

    listener;
    transport;
    deviceDescriptor;

    constructor(simpleosWallet) {
        this.main = simpleosWallet;
        this.init().catch(console.log);
    }

    async init() {
        const hid_status = await Transport.isSupported();
        console.log(hid_status);
        if (!hid_status) {
            console.log('HID Supported:', hid_status);
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
                        error: this.errormsg,
                    });
                }
            }
            if (args.event === 'start_listener') {
                this.setupListener();
            }
            if (args.event === 'check_app') {
                const status = await this.getEosAppStatus();
                this.main.win.webContents.send('ledger_reply', {
                    event: 'check_app',
                    data: status,
                });
            }
            if (args.event === 'read_slots') {

                if (!this.deviceDescriptor) {
                    this.reportDeviceError();
                    return;
                }

                if (!this.transport) {
                    await this.openTransport();
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

    reportDeviceError() {
        // error reading from device
        this.main.win.webContents.send('ledger', {
            event: 'error',
            data: new Error('error reading from device'),
        });
    }

    async getAddressFromSlot(transport, slotIndex) {
        const path = `44'/194'/0'/0/${slotIndex}`;
        const paths = bippath.fromString(path).toPathArray();
        const buf = Buffer.alloc(1 + paths.length * 4);
        buf[0] = paths.length;
        for (let i = 0; i < paths.length; i++) {
            buf.writeUInt32BE(paths[i], 1 + 4 * i);
        }
        try {
            const response = await this.transport.send(0xD4, 0x02, 0x00, 0x00, buf);
            const result = {};
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

    handleError(e) {
        this.main.win.webContents.send('ledger', {
            event: 'error',
            data: e,
        });
        if (errorCodes[e.statusCode]) {
            console.log(errorCodes[e.statusCode]);
        } else {
            console.log('-------------- TRANSPORT ERROR ------------');
            console.log(e);
            console.log(this.transport);
            console.log('-------------------------------------');
        }
    }

    async assertTransport() {
        if (!this.transport) {
            console.log('starting transport...');
            await this.openTransport();
        } else {
            if (this.transport.disconnected) {
                await this.transport.close();
                this.transport = null;
            }
        }
    }

    async getEosAppStatus() {
        await this.assertTransport();
        if (this.transport && !this.transport.disconnected) {
            try {
                await this.transport.send(LC.CLA, LC.INFO, LC.NO, LC.NO);
                console.log('app ready');
                return true;
            } catch (e) {
                console.log('app not ready');
                this.handleError(e);
                return false;
            }
        } else {
            return false;
        }
    }

    setupListener() {
        if (this.listener) {
            this.listener.unsubscribe();
        }
        this.listener = Transport.listen({
            next: (event) => {
                // console.log(event.type);
                if (event.type === 'add') {
                    this.deviceDescriptor = event.descriptor;
                } else if (event.type === 'remove') {
                    this.deviceDescriptor = null;
                }
                this.main.win.webContents.send('ledger', {
                    event: 'listener_event',
                    data: event,
                });
            },
            error: (err) => {
                console.log(err);
                this.main.win.webContents.send('ledger', {
                    event: 'listener_error',
                    data: err,
                });
            },
            complete: () => {
                console.log('complete');
                this.main.win.webContents.send('ledger', {
                    event: 'listener_complete',
                });
            },
        });
    }

    setTransport(t) {
        this.transport = t;
        console.log('transport ready');
    }

    async openTransport() {
        return new Promise((resolve, reject) => {
            if (this.deviceDescriptor) {
                console.log('attempting to open descriptor: ' + this.deviceDescriptor);
                try {
                    Transport.open(this.deviceDescriptor).then((t) => {
                        this.setTransport(t);
                        resolve();
                    }).catch((err) => {
                        console.log('Failed to open transport with: ' + this.deviceDescriptor);
                        console.log(err);
                        if (!this.rootRequested) {
                            this.rootRequested = true;
                            // setup permissions on usb port
                            const command = `chown $USER:root ${this.deviceDescriptor}`;
                            console.log(`Running "${command}" as root`);
                            sudo.exec(`chown $USER:root ${this.deviceDescriptor}`, {
                                name: 'SimplEOS Wallet'
                            }, (error, stdout, stderr) => {
                                if (error) {
                                    console.log(error, stdout, stderr);
                                    reject(stderr);
                                } else {
                                    console.log('permissions updated');
                                    this.rootRequested = false;
                                    Transport.open(this.deviceDescriptor).then((t) => {
                                        this.setTransport(t);
                                        resolve();
                                    });
                                }
                            });
                        } else {
                            reject('permissions already requested');
                        }
                    });
                } catch (e) {
                    reject();
                    console.log(e);
                }
            } else {
                reject();
            }
        });
    }

    async signTransaction(trxdata, slot, endpoint) {
        const localRpc = new JsonRpc(endpoint, {fetch});
        const api = new Api({
            rpc: localRpc,
            textDecoder: textDecoder,
            textEncoder: textEncoder,
        });
        let result;
        try {
            result = await api.transact(trxdata, {
                blocksBehind: 3,
                expireSeconds: 300,
                sign: false,
                broadcast: false,
            });
        } catch (e) {
            console.log(e.message);
            this.errormsg = e.message;
            return null;
        }
        const decTrx = await api.deserializeTransaction(result.serializedTransaction);
        const rawTx = serializeEosjs(api, decTrx);
        const chunks = splitPayload(rawTx, slot);
        let response;
        for (let i = 0; i < chunks.length; i++) {
            try {
                console.log(`Sending chunk ${i} with ${chunks[i].length} bytes...`);
                response = await this.transport.send(LC.CLA, LC.SIGN, i === 0 ? LC.FIRST : LC.MORE, 0x00, chunks[i]);
            } catch (e) {
                this.handleError(e);
                return null;
            }
        }
        if (response.length >= 64) {
            const v = response.slice(0, 1).toString('hex');
            const r = response.slice(1, 33).toString('hex');
            const s = response.slice(33, 65).toString('hex');
            const signature = ecc.Signature.fromHex(v + r + s).toString();
            result.signatures.push(signature);
            return result;
        } else {
            return null;
        }
    }
}

module.exports = {LedgerManager};
