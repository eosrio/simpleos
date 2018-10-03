"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
var core_1 = require("@angular/core");
var assert = require("assert");
var eosjs_service_1 = require("../eosjs.service");
var LedgerService = /** @class */ (function () {
    function LedgerService(eosService) {
        this.eosService = eosService;
        this.basePath = '44\'/194\'/0\'/0/';
        this.ledgerBusy = false;
        console.log('Loading ledger service...');
        if (this.isElectron()) {
            this.fcbuffer = window.fcbuffer;
            this.asn1 = window.asn1;
            this.ledgerTransport = window.ledgerTransport;
            this.bippath = window.require('bip32-path');
            this.eosjs = window.require('eosjs');
            this.refEOS = this.eosjs({
                httpEndpoint: null,
                chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906'
            });
            this.fc = this.refEOS.fc;
        }
    }
    LedgerService_1 = LedgerService;
    LedgerService.convert = function (response) {
        return {
            v: response.slice(0, 1).toString('hex'),
            r: response.slice(1, 1 + 32).toString('hex'),
            s: response.slice(1 + 32, 1 + 32 + 32).toString('hex')
        };
    };
    LedgerService.prototype.encode = function (writter, type, data) {
        writter['writeBuffer'](this.fcbuffer.toBuffer(type, data), this.asn1['Ber']['OctetString']);
    };
    LedgerService.prototype.serialize = function (transaction) {
        var _this = this;
        var types = this.fc.types;
        var writter = new this.asn1['BerWriter']();
        assert(transaction.context_free_actions.length === 0);
        assert(transaction.actions.length > 0);
        var seq = [
            [types.checksum256(), 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906'],
            [types.time(), transaction.expiration],
            [types.uint16(), transaction.ref_block_num],
            [types.uint32(), transaction.ref_block_prefix],
            [types.unsigned_int(), transaction.max_net_usage_words],
            [types.uint8(), transaction.max_cpu_usage_ms],
            [types.unsigned_int(), transaction.delay_sec],
            [types.unsigned_int(), 0],
            [types.unsigned_int(), 1]
        ];
        seq.forEach(function (entry) {
            _this.encode(writter, entry[0], entry[1]);
        });
        transaction.actions.forEach(function (action) {
            var aseq = [
                [types.account_name(), action.account],
                [types.action_name(), action.name],
                [types.unsigned_int(), action.authorization.length]
            ];
            aseq.forEach(function (entry) {
                _this.encode(writter, entry[0], entry[1]);
            });
            for (var i = 0; i < action.authorization.length; i += 1) {
                var authorization = action.authorization[i];
                _this.encode(writter, types.account_name(), authorization.actor);
                _this.encode(writter, types.permission_name(), authorization.permission);
            }
            var data = Buffer.from(action.data, 'hex');
            _this.encode(writter, types.unsigned_int(), data.length);
            writter['writeBuffer'](data, _this.asn1['Ber']['OctetString']);
        });
        assert(transaction.transaction_extensions.length === 0);
        this.encode(writter, types.unsigned_int(), 0);
        this.encode(writter, types.checksum256(), Buffer.alloc(32, 0));
        return writter.buffer;
    };
    LedgerService.prototype.isElectron = function () {
        this.electronStatus = window && window['process'] && window['process']['type'];
        return this.electronStatus;
    };
    LedgerService.prototype.readNextPublicKey = function (index, transport, limit) {
        var _this = this;
        var bip44Path = this.basePath + index.toString();
        var paths = this.bippath.fromString(bip44Path).toPathArray();
        var buffer = Buffer.alloc(1 + paths.length * 4);
        buffer[0] = paths.length;
        paths.forEach(function (element, i) {
            buffer.writeUInt32BE(element, 1 + 4 * i);
        });
        transport.send(0xD4, 0x02, 0x00, 0x01, buffer).then(function (response) {
            var result = {};
            var pkl = response[0];
            var addressLength = response[1 + pkl];
            result['publicKey'] = response.slice(1, 1 + pkl)['toString']('hex');
            result['wif'] = response.slice(1 + pkl + 1, 1 + pkl + 1 + addressLength)['toString']('ascii');
            result['chainCode'] = response.slice(1 + pkl + 1 + addressLength, 1 + pkl + 1 + addressLength + 32)['toString']('hex');
            if (_this.eosService.ecc.isValidPublic(result['wif'])) {
                // console.log('Looking for account related to ' + result.wif);
                _this.eosService.eos.getKeyAccounts(result['wif']).then(function (data) {
                    if (data.account_names.length > 0) {
                        data.account_names.forEach(function (acc) {
                            _this.eosService.eos.getAccount(acc).then(function (account) {
                                account.permissions.forEach(function (perm) {
                                    if (perm['perm_name'] === 'active') {
                                        if (result['wif'] === perm.required_auth.keys[0].key) {
                                            console.log('Index: ' + index + '\nAccount found: ' + acc + '\nKey: ' + result['wif']);
                                        }
                                    }
                                });
                            });
                        });
                    }
                    else {
                        console.log('\n\nIndex: ' + index + '\nNo account associated!' + '\nKey: ' + result['wif']);
                    }
                    if (index + 1 < limit) {
                        _this.readNextPublicKey(index + 1, transport, limit);
                    }
                });
            }
            else {
                console.log('Invalid!');
            }
        });
    };
    LedgerService.prototype.submitToLedger = function (payload, index, transport, resolve) {
        var _this = this;
        console.log('Payload length: ' + payload.length + ' | Index: ' + index);
        transport.send(0xD4, 0x04, index === 0 ? 0x00 : 0x80, 0x00, payload[index]).then(function (output) {
            console.log(output);
            if (index < payload.length - 1) {
                console.log('Submitting remaining payload');
                _this.submitToLedger(payload, index + 1, transport, resolve);
            }
            else {
                var result = LedgerService_1.convert(output);
                var rawSig = result.v + result.r + result.s;
                resolve(rawSig);
            }
        });
    };
    LedgerService.prototype.enableLedgerEOS = function () {
        var _this = this;
        var pSigner = function (data) {
            return new Promise(function (resolve) {
                var paths = _this.bippath.fromString(_this.currentPath).toPathArray();
                var rawTx = _this.serialize(data.transaction);
                var offset = 0;
                var toSend = [];
                var _loop_1 = function () {
                    var maxChunkSize = offset === 0 ? 150 - 1 - paths.length * 4 : 150;
                    var chunkSize = offset + maxChunkSize > rawTx.length
                        ? rawTx.length - offset
                        : maxChunkSize;
                    var buffer = Buffer.alloc(offset === 0 ? 1 + paths.length * 4 + chunkSize : chunkSize);
                    if (offset === 0) {
                        buffer[0] = paths.length;
                        paths.forEach(function (element, index) {
                            buffer.writeUInt32BE(element, 1 + 4 * index);
                        });
                        rawTx.copy(buffer, 1 + 4 * paths.length, offset, offset + chunkSize);
                    }
                    else {
                        rawTx.copy(buffer, 0, offset, offset + chunkSize);
                    }
                    toSend.push(buffer);
                    offset += chunkSize;
                };
                while (offset !== rawTx.length) {
                    _loop_1();
                }
                console.log(toSend);
                _this.submitToLedger(toSend, 0, _this.activeTransport, resolve);
            });
        };
        this.ledgerEOS = this.eosjs({
            httpEndpoint: this.eosService.baseConfig.httpEndpoint,
            signProvider: pSigner,
            chainId: this.eosService.chainID,
            sign: true,
            broadcast: true
        });
    };
    LedgerService.prototype.readPublicKeys = function (slots) {
        this.readNextPublicKey(0, this.activeTransport, slots);
    };
    LedgerService.prototype.getAppConfig = function () {
        this.activeTransport.send(0xD4, 0x06, 0x00, 0x00).then(function (response) {
            var result = {};
            result['version'] = response[1] + "." + response[2] + "." + response[3];
            console.log(result);
        });
    };
    LedgerService.prototype.initListener = function () {
        var _this = this;
        this.ledgerTransport.listen({
            'next': function (event) {
                if (event.type === 'add') {
                    console.log('Adding device!');
                    _this.ledgerTransport.open(event.device.path).then(function (transport) {
                        transport.setDebugMode(false);
                        _this.activeTransport = transport;
                        // Prepare transfer
                        _this.currentPath = '44\'/194\'/0\'/0/0';
                        console.log('Enabling Ledger Config');
                        _this.enableLedgerEOS();
                        // setTimeout(() => {
                        //   this.ledgerEOS.transfer(
                        //     'eosriovault1',
                        //     'igorlseosrio',
                        //     '0.0010 EOS',
                        //     'ledger test').then(txdata => {
                        //     console.log(txdata);
                        //   });
                        // }, 2000);
                    });
                }
                else if (event.type === 'remove') {
                    console.log('Device removed!');
                }
            }
        });
    };
    var LedgerService_1;
    LedgerService = LedgerService_1 = __decorate([
        core_1.Injectable({
            providedIn: 'root'
        }),
        __metadata("design:paramtypes", [eosjs_service_1.EOSJSService])
    ], LedgerService);
    return LedgerService;
}());
exports.LedgerService = LedgerService;
//# sourceMappingURL=ledger.service.js.map