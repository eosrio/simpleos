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
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var CryptoService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoService = void 0;
const core_1 = require("@angular/core");
const text_encoding_shim_1 = require("text-encoding-shim");
const CryptoJS = require("crypto-js");
const router_1 = require("@angular/router");
const eosjs2_service_1 = require("../eosio/eosjs2.service");
const dist_1 = require("eosjs/dist");
const eosjs_key_conversions_1 = require("eosjs/dist/eosjs-key-conversions");
const electron_1 = require("electron");
let CryptoService = CryptoService_1 = class CryptoService {
    constructor(router, eosjs) {
        this.router = router;
        this.eosjs = eosjs;
        this.ivLen = 12;
        this.textEncoder = new text_encoding_shim_1.TextEncoder();
        this.basePublicKey = '';
        this.locked = true;
        this.lockChecked = false;
        this.requiredLedgerDevice = '';
        this.checkLock();
    }
    generateKeyPair() {
        return __awaiter(this, void 0, void 0, function* () {
            let result;
            while (!result) {
                const rawKey = yield electron_1.ipcRenderer.invoke('get-rnd-bytes', 32);
                const key = { data: rawKey, type: dist_1.Numeric.KeyType.k1 };
                const privateKey = new eosjs_key_conversions_1.PrivateKey(key, (0, eosjs_key_conversions_1.constructElliptic)(dist_1.Numeric.KeyType.k1));
                try {
                    const EOSIOPrivateKey = privateKey.toString();
                    const EOSIOPublicKey = privateKey.getPublicKey();
                    result = {
                        private: EOSIOPrivateKey,
                        public: EOSIOPublicKey.toString()
                    };
                }
                catch (e) {
                    console.log(e);
                    console.log(privateKey.toString());
                }
            }
            return result;
        });
    }
    checkLock() {
        const lockhash = localStorage.getItem('simpleos-hash');
        this.lockChecked = true;
        if (lockhash) {
            this.locked = true;
            return true;
        }
        else {
            this.locked = false;
            return false;
        }
    }
    getLockStatus() {
        if (this.lockChecked) {
            return this.locked;
        }
        else {
            return this.checkLock();
        }
    }
    static concatUint8Array(...arrays) {
        let totalLength = 0;
        for (const arr of arrays) {
            totalLength += arr.length;
        }
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const arr of arrays) {
            result.set(arr, offset);
            offset += arr.length;
        }
        return result;
    }
    checkPublicKey(testKey) {
        const savedData = localStorage.getItem('eos_keys.' + this.eosjs.chainId);
        if (savedData) {
            const keys = Object.keys(JSON.parse(savedData));
            if (keys.indexOf(testKey) !== -1) {
                return true;
            }
            else {
                return keys.indexOf(dist_1.Numeric.convertLegacyPublicKey(testKey)) !== -1;
            }
        }
        else {
            return false;
        }
    }
    getPrivateKeyMode(pub_key) {
        const [, value] = this.getLocalKey(pub_key);
        if (value) {
            if (value.private === 'ledger') {
                this.requiredLedgerDevice = value.device;
                this.requiredLedgerSlot = value.slot;
                return 'ledger';
            }
            else {
                this.requiredLedgerDevice = '';
                this.requiredLedgerSlot = null;
                return 'local';
            }
        }
        else {
            console.log('error, no keys!');
            return null;
        }
    }
    initKeys(publickey, pass) {
        return __awaiter(this, void 0, void 0, function* () {
            const salt = this.textEncoder.encode(publickey);
            this.basePublicKey = publickey;
            const importedPassword = yield crypto.subtle.importKey('raw', this.textEncoder.encode(pass), 'PBKDF2', false, ['deriveKey']);
            const tempKey = yield crypto.subtle.deriveKey({
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            }, importedPassword, { name: 'AES-GCM', length: 256 }, true, ['encrypt']);
            const exportedTempKey = yield crypto.subtle.exportKey('raw', tempKey);
            const importedTempKey = yield crypto.subtle.importKey('raw', exportedTempKey, 'PBKDF2', false, ['deriveKey']);
            this.masterKey = yield crypto.subtle.deriveKey({
                name: 'PBKDF2', salt: salt,
                iterations: 100000, hash: 'SHA-256'
            }, importedTempKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        });
    }
    decryptPayload(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const encryptedData = this.base64ToBuffer(payload);
            const iv = encryptedData.slice(0, this.ivLen);
            const data = encryptedData.slice(this.ivLen);
            const decrypted = yield crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, this.masterKey, data);
            return String.fromCharCode.apply(null, new Uint8Array(decrypted)).replace(/"/g, '');
        });
    }
    changePass(publickey, newpass) {
        return __awaiter(this, void 0, void 0, function* () {
            const [key, value] = this.getLocalKey(publickey);
            if (value) {
                const tempKey = yield this.decryptPayload(value.private);
                yield this.initKeys(key, newpass);
                yield this.encryptAndStore(tempKey, key);
                return true;
            }
            else {
                return false;
            }
        });
    }
    encryptAndStore(data, publickey) {
        return __awaiter(this, void 0, void 0, function* () {
            const encryptedData = yield this.encrypt(data);
            let store = {};
            const oldData = JSON.parse(localStorage.getItem('eos_keys.' + this.eosjs.chainId));
            if (oldData) {
                store = oldData;
            }
            store[publickey] = {
                private: this.bufferToBase64(encryptedData)
            };
            localStorage.setItem('eos_keys.' + this.eosjs.chainId, JSON.stringify(store));
        });
    }
    encrypt(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const compressed = this.textEncoder.encode(JSON.stringify(data));
            const initializationVector = new Uint8Array(this.ivLen);
            crypto.getRandomValues(initializationVector);
            const encrypted = yield crypto.subtle.encrypt({
                name: 'AES-GCM',
                iv: initializationVector
            }, this.masterKey, compressed);
            return CryptoService_1.concatUint8Array(initializationVector, new Uint8Array(encrypted));
        });
    }
    bufferToBase64(buf) {
        const binstr = Array.prototype.map.call(buf, function (ch) {
            return String.fromCharCode(ch);
        }).join('');
        return btoa(binstr);
    }
    base64ToBuffer(base64) {
        const binstr = atob(base64);
        const buf = new Uint8Array(binstr.length);
        Array.prototype.forEach.call(binstr, function (ch, i) {
            buf[i] = ch.charCodeAt(0);
        });
        return buf;
    }
    getLocalKey(publicKey) {
        const storedData = JSON.parse(localStorage.getItem('eos_keys.' + this.eosjs.chainId));
        let value = storedData[publicKey];
        let key = publicKey;
        if (!value) {
            key = dist_1.Numeric.convertLegacyPublicKey(publicKey);
            value = storedData[key];
        }
        return [key, value];
    }
    authenticate(pass, publickey, exportKey) {
        return __awaiter(this, void 0, void 0, function* () {
            const [key, value] = this.getLocalKey(publickey);
            if (value) {
                if (value.private !== 'ledger') {
                    yield this.initKeys(key, pass);
                }
                else {
                    return 'LEDGER';
                }
            }
            return yield this.decryptKeys(key, exportKey);
        });
    }
    decryptKeys(publickey, exportKey) {
        return __awaiter(this, void 0, void 0, function* () {
            const [, value] = this.getLocalKey(publickey);
            if (value) {
                if (value.private === 'ledger') {
                    return true;
                }
                try {
                    const decryptedKey = yield this.decryptPayload(value.private);
                    this.eosjs.initAPI(decryptedKey.replace(/^"(.+(?="$))"$/, '$1'));
                    if (this.eosjs.defaultChain.name === 'EOS MAINNET' || this.eosjs.defaultChain.name === 'EOS JUNGLE 3') {
                        this.eosjs.initAPIRelay(decryptedKey.replace(/^"(.+(?="$))"$/, '$1'));
                    }
                    if (exportKey) {
                        return decryptedKey;
                    }
                    else {
                        return true;
                    }
                }
                catch (e) {
                    return false;
                }
            }
            else {
                return false;
            }
        });
    }
    createPIN(pin) {
        if (pin !== '') {
            this.locked = false;
            const salt = CryptoJS.lib.WordArray['random'](128 / 8);
            const hash = CryptoJS.PBKDF2(pin, salt, { keySize: 512 / 32, iterations: 1000 }).toString();
            localStorage.setItem('simpleos-salt', JSON.stringify(salt));
            localStorage.setItem('simpleos-hash', hash);
        }
        // this.lock();
    }
    unlock(pin, target) {
        const saved_hash = localStorage.getItem('simpleos-hash');
        const salt = JSON.parse(localStorage.getItem('simpleos-salt'));
        const hash = CryptoJS.PBKDF2(pin, salt, { keySize: 512 / 32, iterations: 1000 }).toString();
        if (hash === saved_hash) {
            this.locked = false;
            console.log('unlocked!');
            this.router.navigate(target).catch(() => {
                alert('cannot navigate :(');
            });
            return true;
        }
        else {
            this.locked = true;
            return false;
        }
    }
    getPK() {
        return this.eosjs.baseConfig.keyProvider;
    }
    storeLedgerAccount(pbk, slotNumber, deviceName) {
        let store = {};
        const oldData = JSON.parse(localStorage.getItem('eos_keys.' + this.eosjs.chainId));
        if (oldData) {
            store = oldData;
        }
        store[pbk] = {
            private: 'ledger',
            slot: slotNumber,
            device: deviceName
        };
        localStorage.setItem('eos_keys.' + this.eosjs.chainId, JSON.stringify(store));
    }
    lock() {
        this.locked = true;
        console.log('locking wallet');
        this.router.navigate(['']).catch(() => {
            console.log('cannot navigate :(');
        });
    }
    updatePIN(newPIN) {
        if (this.locked === false) {
            this.createPIN(newPIN);
        }
        else {
            alert('please unlock before updating!');
        }
    }
    removePIN() {
        localStorage.removeItem('simpleos-salt');
        localStorage.removeItem('simpleos-hash');
        this.locked = false;
    }
    encryptBKP(val, pass) {
        return CryptoJS.AES.encrypt(val, pass).toString();
    }
    decryptBKP(enval, pass) {
        return CryptoJS.AES.decrypt(pass, enval).toString(CryptoJS.enc['Utf8']);
    }
};
CryptoService = CryptoService_1 = __decorate([
    (0, core_1.Injectable)({
        providedIn: 'root'
    }),
    __metadata("design:paramtypes", [router_1.Router,
        eosjs2_service_1.Eosjs2Service])
], CryptoService);
exports.CryptoService = CryptoService;
//# sourceMappingURL=crypto.service.js.map