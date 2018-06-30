import {Injectable} from '@angular/core';
import {TextEncoder} from 'text-encoding-shim';
import {EOSJSService} from '../eosjs.service';

import * as CryptoJS from 'crypto-js';
import {Router} from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {

  private ivLen = 12;
  private masterKey: CryptoKey;
  private textEncoder = new TextEncoder();
  private basePublicKey = '';
  public locked = true;

  constructor(private eosjs: EOSJSService, private router: Router) {
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

  async changePass(publickey, newpass): Promise<boolean> {
    const store = JSON.parse(localStorage.getItem('eos_keys.' + this.eosjs.chainID));
    if (store) {
      const payload = store[publickey]['private'];
      if (payload) {
        const encryptedData = this.base64ToBuffer(payload);
        const iv = encryptedData.slice(0, this.ivLen);
        const data = encryptedData.slice(this.ivLen);
        const decrypted = await crypto.subtle.decrypt({
          name: 'AES-GCM',
          iv: iv
        }, this.masterKey, data);
        const tempKey = String.fromCharCode.apply(null, new Uint8Array(decrypted)).replace(/"/g, '');
        await this.initKeys(publickey, newpass);
        await this.encryptAndStore(tempKey, publickey);
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  async encryptAndStore(data, publickey): Promise<void> {
    const encryptedData = await this.encrypt(data);
    let store = {};
    const oldData = JSON.parse(localStorage.getItem('eos_keys.' + this.eosjs.chainID));
    if (oldData) {
      store = oldData;
    }
    store[publickey] = {
      private: this.bufferToBase64(encryptedData)
    };
    localStorage.setItem('eos_keys.' + this.eosjs.chainID, JSON.stringify(store));
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

  async authenticate(pass, publickey): Promise<boolean> {
    this.eosjs.auth = false;
    await this.initKeys(publickey, pass);
    return await this.decryptKeys(publickey);
  }

  async decryptKeys(publickey): Promise<boolean> {
    const store = JSON.parse(localStorage.getItem('eos_keys.' + this.eosjs.chainID));
    if (store) {
      const payload = store[publickey]['private'];
      if (payload) {
        const encryptedData = this.base64ToBuffer(payload);
        const iv = encryptedData.slice(0, this.ivLen);
        const data = encryptedData.slice(this.ivLen);
        setTimeout(() => {
          this.eosjs.clearInstance();
        }, 5000);
        const decrypted = await crypto.subtle.decrypt({
          name: 'AES-GCM',
          iv: iv
        }, this.masterKey, data);
        this.eosjs.baseConfig.keyProvider.push(String.fromCharCode.apply(null, new Uint8Array(decrypted)).replace(/"/g, ''));
        this.eosjs.reloadInstance();
        return true;
      } else {
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
      this.router.navigate(target).catch(() => {
        alert('cannot navigate :(');
      });
      return true;
    } else {
      this.locked = true;
      return false;
    }
  }

  lock() {
    this.locked = true;
    this.router.navigate(['']).catch(() => {
      alert('cannot navigate :(');
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

}
