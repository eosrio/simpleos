import {EventEmitter, Injectable} from '@angular/core';
import * as assert from 'assert';

import * as Transport from '@ledgerhq/hw-transport-node-hid';
import {EOSJSService} from '../eosjs.service';
import * as EOSJS from 'eosjs';
import {BehaviorSubject} from 'rxjs';

declare let window: any;

@Injectable({
  providedIn: 'root'
})
export class LedgerHWService {

  electronStatus: boolean;
  basePath = '44\'/194\'/0\'/0/';
  currentPath: string;
  fcbuffer: any;
  asn1: any;
  ledgerTransport: typeof Transport;
  activeTransport: any;
  bippath: any;
  eosjs: typeof EOSJS;
  ledgerEOS: any;
  fc: any;
  refEOS: any;
  ledgerBusy = false;
  ledgerStatus = new BehaviorSubject<boolean>(false);
  slots: any[];
  openPanel = new EventEmitter();

  static convert(response) {
    return {
      v: response.slice(0, 1).toString('hex'),
      r: response.slice(1, 1 + 32).toString('hex'),
      s: response.slice(1 + 32, 1 + 32 + 32).toString('hex')
    };
  }

  constructor(private eosService: EOSJSService) {
    console.log('Loading ledger service...');
    this.slots = [];

    if (this.isElectron()) {
      this.fcbuffer = window.fcbuffer;
      this.asn1 = window.asn1;
      this.ledgerTransport = window.ledgerTransport;
      this.bippath = window.require('bip32-path');
      this.eosjs = window.require('eosjs');
      this.refEOS = this.eosjs({
        httpEndpoint: null,
        chainId: this.eosService.chainID
      });
      this.fc = this.refEOS.fc;
    }
  }

  encode(writter, type, data) {
    writter['writeBuffer'](this.fcbuffer.toBuffer(type, data), this.asn1['Ber']['OctetString']);
  }

  serialize(transaction) {
    const types = this.fc.types;
    const writter = new this.asn1['BerWriter']();

    assert(transaction.context_free_actions.length === 0);
    assert(transaction.actions.length > 0);

    const seq = [
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

    seq.forEach(entry => {
      this.encode(writter, entry[0], entry[1]);
    });

    transaction.actions.forEach((action) => {

      const aseq = [
        [types.account_name(), action.account],
        [types.action_name(), action.name],
        [types.unsigned_int(), action.authorization.length]
      ];

      aseq.forEach(entry => {
        this.encode(writter, entry[0], entry[1]);
      });

      for (let i = 0; i < action.authorization.length; i += 1) {
        const authorization = action.authorization[i];
        this.encode(writter, types.account_name(), authorization.actor);
        this.encode(writter, types.permission_name(), authorization.permission);
      }

      const data = Buffer.from(action.data, 'hex');

      this.encode(writter, types.unsigned_int(), data.length);
      writter['writeBuffer'](data, this.asn1['Ber']['OctetString']);

    });

    assert(transaction.transaction_extensions.length === 0);
    this.encode(writter, types.unsigned_int(), 0);
    this.encode(writter, types.checksum256(), Buffer.alloc(32, 0));
    return writter.buffer;
  }

  isElectron() {
    this.electronStatus = window && window['process'] && window['process']['type'];
    return this.electronStatus;
  }

  readNextPublicKey(index, transport, limit, resolve) {
    const bip44Path = this.basePath + index.toString();
    const paths = this.bippath.fromString(bip44Path).toPathArray();
    const buffer = Buffer.alloc(1 + paths.length * 4);
    buffer[0] = paths.length;
    paths.forEach((element, i) => {
      buffer.writeUInt32BE(element, 1 + 4 * i);
    });
    transport.send(0xD4, 0x02, 0x00, 0x01, buffer).then(response => {
      const result = {};
      const pkl = response[0];
      const addressLength = response[1 + pkl];
      result['publicKey'] = response.slice(1, 1 + pkl)['toString']('hex');
      result['wif'] = response.slice(1 + pkl + 1, 1 + pkl + 1 + addressLength)['toString']('ascii');
      result['chainCode'] = response.slice(1 + pkl + 1 + addressLength, 1 + pkl + 1 + addressLength + 32)['toString']('hex');
      if (this.eosService.ecc.isValidPublic(result['wif'])) {
        // console.log('Looking for account related to ' + result.wif);
        this.eosService.eos.getKeyAccounts(result['wif']).then(data => {
          if (data.account_names.length > 0) {
            data.account_names.forEach(acc => {
              this.eosService.eos.getAccount(acc).then(account => {
                account.permissions.forEach(perm => {
                  if (perm['perm_name'] === 'active') {
                    if (result['wif'] === perm.required_auth.keys[0].key) {
                      console.log('Index: ' + index + '\nAccount found: ' + acc + '\nKey: ' + result['wif']);
                      this.slots.push({
                        publicKey: result['wif'],
                        account: acc
                      });
                    }
                  }
                });
              });
            });
          } else {
            console.log('\n\nIndex: ' + index + '\nNo account associated!' + '\nKey: ' + result['wif']);
            this.slots.push({
              publicKey: result['wif'],
              account: null
            });
          }
          if (index + 1 < limit) {
            this.readNextPublicKey(index + 1, transport, limit, resolve);
          } else {
            resolve(this.slots);
          }
        });
      } else {
        console.log('Invalid!');
      }
    });
  }

  submitToLedger(payload, index, transport, resolve) {
    console.log('Payload length: ' + payload.length + ' | Index: ' + index);
    transport.send(0xD4, 0x04, index === 0 ? 0x00 : 0x80, 0x00, payload[index]).then((output) => {
      console.log(output);
      if (index < payload.length - 1) {
        console.log('Submitting remaining payload');
        this.submitToLedger(payload, index + 1, transport, resolve);
      } else {
        const result = LedgerHWService.convert(output);
        const rawSig = result.v + result.r + result.s;
        resolve(rawSig);
      }
    });
  }

  enableLedgerEOS(slot) {
    console.log('Enabling ledger connection on slot ' + slot.toString());
    const newPath = this.basePath + slot.toString();
    const pSigner = (data) => {
      return new Promise((resolve) => {
        const paths = this.bippath.fromString(newPath).toPathArray();
        const rawTx = this.serialize(data.transaction);
        let offset = 0;
        const toSend = [];
        while (offset !== rawTx.length) {
          const maxChunkSize = offset === 0 ? 150 - 1 - paths.length * 4 : 150;
          const chunkSize =
            offset + maxChunkSize > rawTx.length
              ? rawTx.length - offset
              : maxChunkSize;
          const buffer = Buffer.alloc(
            offset === 0 ? 1 + paths.length * 4 + chunkSize : chunkSize
          );
          if (offset === 0) {
            buffer[0] = paths.length;
            paths.forEach((element, index) => {
              buffer.writeUInt32BE(element, 1 + 4 * index);
            });
            rawTx.copy(buffer, 1 + 4 * paths.length, offset, offset + chunkSize);
          } else {
            rawTx.copy(buffer, 0, offset, offset + chunkSize);
          }
          toSend.push(buffer);
          offset += chunkSize;
        }
        console.log(toSend);
        this.submitToLedger(toSend, 0, this.activeTransport, resolve);
      });
    };
    this.eosService.loadNewConfig(pSigner);
  }

  readPublicKeys(slots) {
    this.slots = [];
    return new Promise(resolve => {
      this.readNextPublicKey(0, this.activeTransport, slots, resolve);
    });
  }

  getAppConfig() {
    this.activeTransport.send(0xD4, 0x06, 0x00, 0x00).then(response => {
      const result = {};
      result['version'] = `${response[1]}.${response[2]}.${response[3]}`;
      console.log(result);
    });
  }

  initListener() {
    this.ledgerTransport.listen({
      'next': event => {
        if (event.type === 'add') {
          console.log('Adding device!');
          this.ledgerStatus.next(true);
          this.ledgerTransport.open(event.device.path).then(transport => {
            transport.setDebugMode(false);
            this.activeTransport = transport;
          });
        } else if (event.type === 'remove') {
          console.log('Device removed!');
          this.ledgerStatus.next(false);
        }
      }
    });
  }
}
