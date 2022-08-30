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
exports.LedgerManager = void 0;
const util_1 = require("util");
const asn1 = __importStar(require("asn1-ber"));
const enf_eosjs_1 = require("enf-eosjs");
const util_2 = require("../util");
const bipPath = __importStar(require("bip32-path"));
const hw_transport_node_hid_1 = __importDefault(require("@ledgerhq/hw-transport-node-hid"));
const electron_1 = require("electron");
const eosjs_jssig_1 = require("enf-eosjs/dist/eosjs-jssig");
const Signature_1 = require("../leap/Signature");
const KeyConversions_1 = require("../leap/KeyConversions");
const sudoPrompt = __importStar(require("sudo-prompt"));
const textDecoder = new util_1.TextDecoder();
const textEncoder = new util_1.TextEncoder();
const codecs = {
    textEncoder: new util_1.TextEncoder(),
    textDecoder: new util_1.TextDecoder(),
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
            const buf = new enf_eosjs_1.Serialize.SerialBuffer(codecs);
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
        }
        else {
            try {
                encode(writer, types.varuint32.prepare(0));
                encode(writer, Buffer.alloc(0));
            }
            catch (e) {
                util_2.Logger.warn('err: ' + e.message);
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
function splitPayload(rawTx, slot) {
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
        }
        else {
            buffer = Buffer.alloc(chunkSize);
            rawTx.copy(buffer, 0, offset, offset + chunkSize);
        }
        chunks.push(buffer);
        offset += chunkSize;
    }
    return chunks;
}
class LedgerManager {
    constructor(simpleosWallet) {
        this.errorMsg = '';
        this.rootRequested = false;
        this.main = simpleosWallet;
        this.init().catch(util_2.Logger.warn);
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            const hidStatus = yield hw_transport_node_hid_1.default.isSupported();
            util_2.Logger.info(`HID Status: ${hidStatus}`);
            if (!hidStatus) {
                util_2.Logger.info('HID Supported: ' + hidStatus);
                process.exit();
            }
            electron_1.ipcMain.on('ledger', (event, args) => __awaiter(this, void 0, void 0, function* () {
                if (args.event === 'sign_trx') {
                    const results = yield this.signTransaction(args.data, args.slot, args.endpoint);
                    if (results) {
                        this.main.win.webContents.send('ledger_reply', {
                            event: 'sign_trx',
                            data: results,
                        });
                    }
                    else {
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
                    util_2.Logger.info('ckecking status app');
                    const status = yield this.getEosAppStatus();
                    this.main.win.webContents.send('ledger_reply', {
                        event: 'check_app',
                        data: status,
                    });
                }
                if (args.event === 'read_slots') {
                    if (!this.transport) {
                        yield this.openTransport();
                    }
                    if (!this.deviceDescriptor) {
                        this.reportDeviceError();
                        return;
                    }
                    if (this.transport) {
                        for (let i = args.data.starts_on; i < args.data.size; i++) {
                            const results = yield this.getAddressFromSlot(this.transport, i);
                            if (results) {
                                this.main.win.webContents.send('ledger_keys', {
                                    event: 'read_key',
                                    data: {
                                        address: results.address,
                                        slot: i,
                                    },
                                });
                            }
                            else {
                                this.reportDeviceError();
                                break;
                            }
                        }
                    }
                    else {
                        this.reportDeviceError();
                    }
                }
            }));
        });
    }
    reportDeviceError() {
        // error reading from device
        this.main.win.webContents.send('ledger', {
            event: 'error',
            data: new Error('error reading from device'),
        });
    }
    getAddressFromSlot(transport, slotIndex) {
        return __awaiter(this, void 0, void 0, function* () {
            const path = `44'/194'/0'/0/${slotIndex}`;
            const paths = bipPath.fromString(path).toPathArray();
            const buf = Buffer.alloc(1 + paths.length * 4);
            buf[0] = paths.length;
            for (let i = 0; i < paths.length; i++) {
                buf.writeUInt32BE(paths[i], 1 + 4 * i);
            }
            try {
                const response = yield this.transport.send(0xD4, 0x02, 0x00, 0x00, buf);
                const result = {};
                const pkl = response[0];
                const addl = response[1 + pkl];
                result.publicKey = response.slice(1, 1 + pkl).toString('hex');
                result.address = response.slice(1 + pkl + 1, 1 + pkl + 1 + addl).toString('ascii');
                result.chainCode = response.slice(1 + pkl + 1 + addl, 1 + pkl + 1 + addl + 32).toString('hex');
                return result;
            }
            catch (e) {
                this.handleError(e);
                return null;
            }
        });
    }
    handleError(e) {
        this.main.win.webContents.send('ledger', {
            event: 'error',
            data: e,
        });
        if (errorCodes[e.statusCode]) {
            util_2.Logger.info(errorCodes[e.statusCode]);
        }
        else {
            util_2.Logger.info('-------------- TRANSPORT ERROR ------------');
            util_2.Logger.info(e);
            util_2.Logger.info(JSON.stringify(this.transport));
            util_2.Logger.info('-------------------------------------');
        }
    }
    assertTransport() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.transport) {
                yield this.transport.close();
            }
            this.transport = null;
            util_2.Logger.info('starting transport...');
            yield this.openTransport();
        });
    }
    getEosAppStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.assertTransport();
            if (this.transport && !this.transport.disconnected) {
                try {
                    yield this.transport.send(LC.CLA, LC.INFO, LC.NO, LC.NO);
                    util_2.Logger.info('app ready');
                    return true;
                }
                catch (e) {
                    util_2.Logger.warn('app not ready');
                    this.handleError(e);
                    return false;
                }
            }
            else {
                return false;
            }
        });
    }
    setupListener() {
        if (this.listener) {
            this.listener.unsubscribe();
        }
        this.listener = hw_transport_node_hid_1.default.listen({
            next: (event) => {
                const strEV = JSON.stringify(event);
                if (event.type === 'add') {
                    this.deviceDescriptor = event.descriptor;
                }
                else if (event.type === 'remove') {
                    this.deviceDescriptor = null;
                }
                try {
                    this.main.win.webContents.send('ledger', {
                        event: 'listener_event',
                        data: JSON.parse(strEV),
                    });
                }
                catch (e) {
                    console.log(e);
                }
            },
            error: (err) => {
                util_2.Logger.warn(err);
                this.main.win.webContents.send('ledger', {
                    event: 'listener_error',
                    data: err,
                });
            },
            complete: () => {
                util_2.Logger.info('complete');
                this.main.win.webContents.send('ledger', {
                    event: 'listener_complete',
                });
            },
        });
    }
    setTransport(t) {
        this.transport = t;
        util_2.Logger.info(JSON.stringify(this.transport));
        util_2.Logger.info('transport ready');
    }
    openTransport() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                if (this.deviceDescriptor) {
                    util_2.Logger.info('attempting to open descriptor: ' + this.deviceDescriptor);
                    try {
                        hw_transport_node_hid_1.default.open(this.deviceDescriptor).then((t) => __awaiter(this, void 0, void 0, function* () {
                            yield this.setTransport(t);
                            util_2.Logger.info(`opened descriptor:${this.deviceDescriptor} with success!`);
                            resolve();
                        })).catch((err) => {
                            util_2.Logger.warn('Failed to open transport with: ' + this.deviceDescriptor);
                            util_2.Logger.warn(err);
                            if (!this.rootRequested) {
                                this.rootRequested = true;
                                // setup permissions on usb port
                                const command = `chown $USER:root ${this.deviceDescriptor}`;
                                util_2.Logger.info(`Running "${command}" as root`);
                                sudoPrompt.exec(`chown $USER:root ${this.deviceDescriptor}`, {
                                    name: 'SimplEOS Wallet',
                                }, (error, stdout, stderr) => {
                                    if (error) {
                                        util_2.Logger.warn(error);
                                        util_2.Logger.warn(stdout);
                                        util_2.Logger.warn(stderr);
                                        reject(stderr);
                                    }
                                    else {
                                        util_2.Logger.info('permissions updated');
                                        this.rootRequested = false;
                                        hw_transport_node_hid_1.default.open(this.deviceDescriptor).then((t) => __awaiter(this, void 0, void 0, function* () {
                                            yield this.setTransport(t);
                                            resolve();
                                        }));
                                    }
                                });
                            }
                            else {
                                reject('permissions already requested');
                            }
                        });
                    }
                    catch (e) {
                        util_2.Logger.warn(e);
                        reject();
                    }
                }
                else {
                    reject();
                }
            });
        });
    }
    signTransaction(trxdata, slot, endpoint) {
        return __awaiter(this, void 0, void 0, function* () {
            const localRpc = new enf_eosjs_1.JsonRpc(endpoint, { fetch });
            const api = new enf_eosjs_1.Api({
                rpc: localRpc,
                textDecoder,
                textEncoder,
                signatureProvider: new eosjs_jssig_1.JsSignatureProvider([])
            });
            let result;
            try {
                result = yield api.transact(trxdata, {
                    expireSeconds: 300,
                    sign: false,
                    broadcast: false,
                });
            }
            catch (e) {
                util_2.Logger.warn(e.message);
                this.errorMsg = e.message;
                return null;
            }
            const decTrx = yield api.deserializeTransaction(result.serializedTransaction);
            const rawTx = serializeEosjs(api, decTrx);
            const chunks = splitPayload(rawTx, slot);
            let response;
            for (let i = 0; i < chunks.length; i++) {
                try {
                    response = yield this.transport.send(LC.CLA, LC.SIGN, i === 0 ? LC.FIRST : LC.MORE, 0x00, chunks[i]);
                }
                catch (e) {
                    this.handleError(e);
                    return null;
                }
            }
            if (response.length >= 64) {
                const K1 = enf_eosjs_1.Numeric.KeyType.k1;
                const sig = new Signature_1.Signature({ type: K1, data: response.slice(0, 65) }, (0, KeyConversions_1.constructElliptic)(K1));
                result.signatures.push(sig.toString());
                return result;
            }
            else {
                return null;
            }
        });
    }
}
exports.LedgerManager = LedgerManager;
//# sourceMappingURL=ledger-manager.js.map