import {Injectable} from '@angular/core';
import {TextEncoder} from 'text-encoding-shim';

import * as CryptoJS from 'crypto-js';
import {Router} from '@angular/router';
import {Eosjs2Service} from '../eosio/eosjs2.service';
import {Numeric} from 'eosjs/dist';
import {constructElliptic, PrivateKey} from 'eosjs/dist/eosjs-key-conversions';
import {ElectronService} from 'ngx-electron';

@Injectable({
	providedIn: 'root'
})
export class CryptoService {

	private ivLen = 12;
	private masterKey: CryptoKey;
	private textEncoder = new TextEncoder();
	private basePublicKey = '';
	private locked = true;
	private lockChecked = false;
	requiredLedgerDevice = '';
	requiredLedgerSlot;
	private nodeCrypto: any;

	constructor(
		private router: Router,
		private eosjs: Eosjs2Service,
		private _electronService: ElectronService
	) {
		this.checkLock();
		this.nodeCrypto = this._electronService.remote.require('crypto');
	}

	generateKeyPair() {
		let result;
		while (!result) {
			const rawKey = this.nodeCrypto.randomBytes(32);
			const key = {data: rawKey, type: Numeric.KeyType.k1};
			const privateKey = new PrivateKey(key, constructElliptic(Numeric.KeyType.k1));
			try {
				const EOSIOPrivateKey = privateKey.toString();
				const EOSIOPublicKey = privateKey.getPublicKey();
				result = {
					private: EOSIOPrivateKey,
					public: EOSIOPublicKey.toString()
				};
			} catch (e) {
				console.log(e);
				console.log(privateKey.toString());
			}
		}
		return result;
	}

	checkLock() {
		const lockhash = localStorage.getItem('simpleos-hash');
		this.lockChecked = true;
		if (lockhash) {
			this.locked = true;
			return true;
		} else {
			this.locked = false;
			return false;
		}
	}

	getLockStatus(): boolean {
		if (this.lockChecked) {
			return this.locked;
		} else {
			return this.checkLock();
		}
	}

	static concatUint8Array(...arrays: Uint8Array[]): Uint8Array {
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
			return keys.indexOf(testKey) !== -1;
		} else {
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
			} else {
				this.requiredLedgerDevice = '';
				this.requiredLedgerSlot = null;
				return 'local';
			}
		} else {
			console.log('error, no keys!');
			return null;
		}
	}

	async initKeys(publickey, pass): Promise<void> {
		const salt = this.textEncoder.encode(publickey);
		this.basePublicKey = publickey;
		const importedPassword = await crypto.subtle.importKey('raw', this.textEncoder.encode(pass), 'PBKDF2', false, ['deriveKey']);
		const tempKey = await crypto.subtle.deriveKey(
			{
				name: 'PBKDF2',
				salt: salt,
				iterations: 100000,
				hash: 'SHA-256'
			},
			importedPassword,
			{name: 'AES-GCM', length: 256},
			true,
			['encrypt']
		);
		const exportedTempKey = await crypto.subtle.exportKey('raw', tempKey);
		const importedTempKey = await crypto.subtle.importKey('raw', exportedTempKey, 'PBKDF2', false, ['deriveKey']);
		this.masterKey = await crypto.subtle.deriveKey(
			{
				name: 'PBKDF2', salt: salt,
				iterations: 100000, hash: 'SHA-256'
			},
			importedTempKey,
			{name: 'AES-GCM', length: 256},
			false,
			['encrypt', 'decrypt']
		);
	}

	async decryptPayload(payload) {
		const encryptedData = this.base64ToBuffer(payload);
		const iv = encryptedData.slice(0, this.ivLen);
		const data = encryptedData.slice(this.ivLen);
		const decrypted = await crypto.subtle.decrypt({name: 'AES-GCM', iv: iv}, this.masterKey, data);
		return String.fromCharCode.apply(null, new Uint8Array(decrypted)).replace(/"/g, '');
	}

	async changePass(publickey, newpass): Promise<boolean> {
		const [key, value] = this.getLocalKey(publickey);
		if (value) {
			const tempKey = await this.decryptPayload(value.private);
			await this.initKeys(key, newpass);
			await this.encryptAndStore(tempKey, key);
			return true;
		} else {
			return false;
		}
	}

	async encryptAndStore(data, publickey): Promise<void> {
		const encryptedData = await this.encrypt(data);
		let store = {};
		const oldData = JSON.parse(localStorage.getItem('eos_keys.' + this.eosjs.chainId));
		if (oldData) {
			store = oldData;
		}
		store[publickey] = {
			private: this.bufferToBase64(encryptedData)
		};
		localStorage.setItem('eos_keys.' + this.eosjs.chainId, JSON.stringify(store));
	}

	private async encrypt(data): Promise<Uint8Array> {
		const compressed = this.textEncoder.encode(JSON.stringify(data));
		const initializationVector = new Uint8Array(this.ivLen);
		crypto.getRandomValues(initializationVector);
		const encrypted = await crypto.subtle.encrypt({
				name: 'AES-GCM',
				iv: initializationVector
			},
			this.masterKey,
			compressed
		);
		return CryptoService.concatUint8Array(initializationVector, new Uint8Array(encrypted));
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
			key = Numeric.convertLegacyPublicKey(publicKey);
			value = storedData[key];
		}
		return [key, value];
	}

	async authenticate(pass, publickey, exportKey?: boolean): Promise<boolean | string> {
		const [key, value] = this.getLocalKey(publickey);
		if (value) {
			if (value.private !== 'ledger') {
					await this.initKeys(key, pass);
			} else {
				return 'LEDGER';
			}
		}
		return await this.decryptKeys(key, exportKey);
	}

	async decryptKeys(publickey, exportKey?: boolean): Promise<boolean> {
		const [, value] = this.getLocalKey(publickey);
		if (value) {
			if (value.private === 'ledger') {
				return true;
			}
			try {
				const decryptedKey = await this.decryptPayload(value.private);
				this.eosjs.initAPI(decryptedKey.replace(/^"(.+(?="$))"$/, '$1'));
				if (exportKey) {
					return decryptedKey;
				} else {
					return true;
				}
			} catch (e) {
				return false;
			}
		} else {
			return false;
		}
	}

	createPIN(pin: string) {
		if (pin !== '') {
			this.locked = false;
			const salt = CryptoJS.lib.WordArray['random'](128 / 8);
			const hash = CryptoJS.PBKDF2(pin, salt, {keySize: 512 / 32, iterations: 1000}).toString();
			localStorage.setItem('simpleos-salt', JSON.stringify(salt));
			localStorage.setItem('simpleos-hash', hash);
		}
		// this.lock();
	}

	unlock(pin: string, target: string[]): boolean {
		const saved_hash = localStorage.getItem('simpleos-hash');
		const salt = JSON.parse(localStorage.getItem('simpleos-salt'));
		const hash = CryptoJS.PBKDF2(pin, salt, {keySize: 512 / 32, iterations: 1000}).toString();
		if (hash === saved_hash) {
			this.locked = false;
			console.log('unlocked!');
			this.router.navigate(target).catch(() => {
				alert('cannot navigate :(');
			});
			return true;
		} else {
			this.locked = true;
			return false;
		}
	}

	getPK() {
		return this.eosjs.baseConfig.keyProvider;
	}

	storeLedgerAccount(pbk: string, slotNumber: number, deviceName: string) {
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

	updatePIN(newPIN: string) {
		if (this.locked === false) {
			this.createPIN(newPIN);
		} else {
			alert('please unlock before updating!');
		}
	}

	removePIN() {
		localStorage.removeItem('simpleos-salt');
		localStorage.removeItem('simpleos-hash');
		this.locked = false;
	}

	encryptBKP(val: string, pass: string) {
		return CryptoJS.AES.encrypt(val, pass).toString();
	}

	decryptBKP(enval: string, pass: string) {
		return CryptoJS.AES.decrypt(enval, pass).toString(CryptoJS.enc.Utf8);
	}
}
