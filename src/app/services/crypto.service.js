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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var core_1 = require("@angular/core");
var text_encoding_shim_1 = require("text-encoding-shim");
var eosjs_service_1 = require("../eosjs.service");
var CryptoJS = require("crypto-js");
var router_1 = require("@angular/router");
var CryptoService = /** @class */ (function () {
    function CryptoService(eosjs, router) {
        this.eosjs = eosjs;
        this.router = router;
        this.ivLen = 12;
        this.textEncoder = new text_encoding_shim_1.TextEncoder();
        this.basePublicKey = '';
        this.locked = true;
    }
    CryptoService_1 = CryptoService;
    CryptoService.concatUint8Array = function () {
        var arrays = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            arrays[_i] = arguments[_i];
        }
        var totalLength = 0;
        for (var _a = 0, arrays_1 = arrays; _a < arrays_1.length; _a++) {
            var arr = arrays_1[_a];
            totalLength += arr.length;
        }
        var result = new Uint8Array(totalLength);
        var offset = 0;
        for (var _b = 0, arrays_2 = arrays; _b < arrays_2.length; _b++) {
            var arr = arrays_2[_b];
            result.set(arr, offset);
            offset += arr.length;
        }
        return result;
    };
    CryptoService.prototype.initKeys = function (publickey, pass) {
        return __awaiter(this, void 0, void 0, function () {
            var salt, importedPassword, tempKey, exportedTempKey, importedTempKey, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        salt = this.textEncoder.encode(publickey);
                        this.basePublicKey = publickey;
                        return [4 /*yield*/, crypto.subtle.importKey('raw', this.textEncoder.encode(pass), 'PBKDF2', false, ['deriveKey'])];
                    case 1:
                        importedPassword = _b.sent();
                        return [4 /*yield*/, crypto.subtle.deriveKey({
                                name: 'PBKDF2',
                                salt: salt,
                                iterations: 100000,
                                hash: 'SHA-256'
                            }, importedPassword, { name: 'AES-GCM', length: 256 }, true, ['encrypt'])];
                    case 2:
                        tempKey = _b.sent();
                        return [4 /*yield*/, crypto.subtle.exportKey('raw', tempKey)];
                    case 3:
                        exportedTempKey = _b.sent();
                        return [4 /*yield*/, crypto.subtle.importKey('raw', exportedTempKey, 'PBKDF2', false, ['deriveKey'])];
                    case 4:
                        importedTempKey = _b.sent();
                        _a = this;
                        return [4 /*yield*/, crypto.subtle.deriveKey({
                                name: 'PBKDF2', salt: salt,
                                iterations: 100000, hash: 'SHA-256'
                            }, importedTempKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])];
                    case 5:
                        _a.masterKey = _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    CryptoService.prototype.changePass = function (publickey, newpass) {
        return __awaiter(this, void 0, void 0, function () {
            var store, payload, encryptedData, iv, data, decrypted, tempKey;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        store = JSON.parse(localStorage.getItem('eos_keys.' + this.eosjs.chainID));
                        if (!store) return [3 /*break*/, 6];
                        payload = store[publickey]['private'];
                        if (!payload) return [3 /*break*/, 4];
                        encryptedData = this.base64ToBuffer(payload);
                        iv = encryptedData.slice(0, this.ivLen);
                        data = encryptedData.slice(this.ivLen);
                        return [4 /*yield*/, crypto.subtle.decrypt({
                                name: 'AES-GCM',
                                iv: iv
                            }, this.masterKey, data)];
                    case 1:
                        decrypted = _a.sent();
                        tempKey = String.fromCharCode.apply(null, new Uint8Array(decrypted)).replace(/"/g, '');
                        return [4 /*yield*/, this.initKeys(publickey, newpass)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.encryptAndStore(tempKey, publickey)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, true];
                    case 4: return [2 /*return*/, false];
                    case 5: return [3 /*break*/, 7];
                    case 6: return [2 /*return*/, false];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    CryptoService.prototype.encryptAndStore = function (data, publickey) {
        return __awaiter(this, void 0, void 0, function () {
            var encryptedData, store, oldData;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.encrypt(data)];
                    case 1:
                        encryptedData = _a.sent();
                        store = {};
                        oldData = JSON.parse(localStorage.getItem('eos_keys.' + this.eosjs.chainID));
                        if (oldData) {
                            store = oldData;
                        }
                        store[publickey] = {
                            private: this.bufferToBase64(encryptedData)
                        };
                        localStorage.setItem('eos_keys.' + this.eosjs.chainID, JSON.stringify(store));
                        return [2 /*return*/];
                }
            });
        });
    };
    CryptoService.prototype.encrypt = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var compressed, initializationVector, encrypted;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        compressed = this.textEncoder.encode(JSON.stringify(data));
                        initializationVector = new Uint8Array(this.ivLen);
                        crypto.getRandomValues(initializationVector);
                        return [4 /*yield*/, crypto.subtle.encrypt({
                                name: 'AES-GCM',
                                iv: initializationVector
                            }, this.masterKey, compressed)];
                    case 1:
                        encrypted = _a.sent();
                        return [2 /*return*/, CryptoService_1.concatUint8Array(initializationVector, new Uint8Array(encrypted))];
                }
            });
        });
    };
    CryptoService.prototype.bufferToBase64 = function (buf) {
        var binstr = Array.prototype.map.call(buf, function (ch) {
            return String.fromCharCode(ch);
        }).join('');
        return btoa(binstr);
    };
    CryptoService.prototype.base64ToBuffer = function (base64) {
        var binstr = atob(base64);
        var buf = new Uint8Array(binstr.length);
        Array.prototype.forEach.call(binstr, function (ch, i) {
            buf[i] = ch.charCodeAt(0);
        });
        return buf;
    };
    CryptoService.prototype.authenticate = function (pass, publickey) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.eosjs.auth = false;
                        return [4 /*yield*/, this.initKeys(publickey, pass)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.decryptKeys(publickey)];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    CryptoService.prototype.decryptKeys = function (publickey) {
        return __awaiter(this, void 0, void 0, function () {
            var store, payload, encryptedData, iv, data, decrypted, decryptedKey;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        store = JSON.parse(localStorage.getItem('eos_keys.' + this.eosjs.chainID));
                        if (!store) return [3 /*break*/, 4];
                        payload = store[publickey]['private'];
                        if (!payload) return [3 /*break*/, 2];
                        encryptedData = this.base64ToBuffer(payload);
                        iv = encryptedData.slice(0, this.ivLen);
                        data = encryptedData.slice(this.ivLen);
                        setTimeout(function () {
                            _this.eosjs.clearInstance();
                        }, 5000);
                        return [4 /*yield*/, crypto.subtle.decrypt({
                                name: 'AES-GCM',
                                iv: iv
                            }, this.masterKey, data)];
                    case 1:
                        decrypted = _a.sent();
                        decryptedKey = String.fromCharCode.apply(null, new Uint8Array(decrypted));
                        this.eosjs.baseConfig.keyProvider = decryptedKey.replace(/^"(.+(?="$))"$/, '$1');
                        this.eosjs.reloadInstance();
                        return [2 /*return*/, true];
                    case 2: return [2 /*return*/, false];
                    case 3: return [3 /*break*/, 5];
                    case 4: return [2 /*return*/, false];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    CryptoService.prototype.createPIN = function (pin) {
        if (pin !== '') {
            this.locked = false;
            var salt = CryptoJS.lib.WordArray['random'](128 / 8);
            var hash = CryptoJS.PBKDF2(pin, salt, { keySize: 512 / 32, iterations: 1000 }).toString();
            localStorage.setItem('simpleos-salt', JSON.stringify(salt));
            localStorage.setItem('simpleos-hash', hash);
        }
        // this.lock();
    };
    CryptoService.prototype.unlock = function (pin, target) {
        var saved_hash = localStorage.getItem('simpleos-hash');
        var salt = JSON.parse(localStorage.getItem('simpleos-salt'));
        var hash = CryptoJS.PBKDF2(pin, salt, { keySize: 512 / 32, iterations: 1000 }).toString();
        if (hash === saved_hash) {
            this.locked = false;
            this.router.navigate(target).catch(function () {
                alert('cannot navigate :(');
            });
            return true;
        }
        else {
            this.locked = true;
            return false;
        }
    };
    CryptoService.prototype.lock = function () {
        this.locked = true;
        this.router.navigate(['']).catch(function () {
            alert('cannot navigate :(');
        });
    };
    CryptoService.prototype.updatePIN = function (newPIN) {
        if (this.locked === false) {
            this.createPIN(newPIN);
        }
        else {
            alert('please unlock before updating!');
        }
    };
    CryptoService.prototype.removePIN = function () {
        localStorage.removeItem('simpleos-salt');
        localStorage.removeItem('simpleos-hash');
        this.locked = false;
    };
    CryptoService.prototype.encryptTestBKP = function (val, pass) {
        return CryptoJS.AES.encrypt(val, pass);
    };
    CryptoService.prototype.decryptTestBKP = function (enval, pass) {
        try {
            var dek = CryptoJS.AES.decrypt(enval, pass);
            return dek.toString(CryptoJS.enc.Utf8);
        }
        catch (e) {
            return "error not json";
        }
    };
    var CryptoService_1;
    CryptoService = CryptoService_1 = __decorate([
        core_1.Injectable({
            providedIn: 'root'
        }),
        __metadata("design:paramtypes", [eosjs_service_1.EOSJSService, router_1.Router])
    ], CryptoService);
    return CryptoService;
}());
exports.CryptoService = CryptoService;
//# sourceMappingURL=crypto.service.js.map