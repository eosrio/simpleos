import {ApplicationRef, ChangeDetectorRef, EventEmitter, Injectable} from '@angular/core';

import * as Transport from '@ledgerhq/hw-transport';
import {BehaviorSubject} from 'rxjs';
import * as asn1 from 'asn1-ber';
import {Serialize} from "eosjs/dist";
import {Eosjs2Service} from "../eosio/eosjs2.service";

import ECC from 'eosjs-ecc';
import {ConnectService} from "../connect.service";

declare let window: any;

interface LKey {
	slot: number;
	address: string;
}

@Injectable({
	providedIn: 'root'
})
export class LedgerService {

	electronStatus: boolean;
	basePath = '44\'/194\'/0\'/0/';
	currentPath: string;
	fcbuffer: any;
	asn1: any;
	ledgerTransport: typeof Transport;
	activeTransport: any;
	bippath: any;
	ledgerEOS: any;
	fc: any;
	refEOS: any;
	ledgerBusy = false;
	ledgerStatus = new BehaviorSubject<boolean>(false);
	slots: any[];

	openPanel = new EventEmitter();
	public appReady = false;
	public checkingApp = false;

	textEncoder = new TextEncoder();
	textDecoder = new TextDecoder();

	public ledgerPublicKeys: LKey[] = [];
	public ledgerAccounts: any[] = [];

	ecc: ECC;

	private LC = {
		CLA: 0xD4,
		INFO: 0x06,
		PK: 0x02,
		SIGN: 0x04,
		YES: 0x01,
		NO: 0x00,
		FIRST: 0x00,
		MORE: 0x80
	};

	private errorCodes = {
		26628: 'Device is not ready, please unlock',
		28160: 'EOS App is not ready, please open the eos app on your ledger',
		27013: 'User cancelled the process',
		27264: 'Invalid data, please enable arbitrary data on your ledger device'
	};

	public deviceName = '';

	constructor(
		private eos: Eosjs2Service,
		private ref: ApplicationRef,
		private connect: ConnectService
	) {
		console.log('Loading ledger service...');
		this.slots = [];
		if (this.isElectron()) {
			this.asn1 = window.asn1;
			this.bippath = window.require('bip32-path');
			this.ecc = window.require('eosjs-ecc');
			this.requestLedgerListener();
			this.connect.ipc.on('ledger', (event, payload) => {
				this.handleIpcMessage(event, payload);
			});
			this.connect.ipc.on('ledger_keys', (event, payload) => {
				if (payload.event === 'read_key') {
					this.ledgerPublicKeys.push(payload.data);
					this.lookupAccounts(payload.data).catch(console.log);
					this.ref.tick();
				}
			})
		}
	}

	requestLedgerListener() {
		console.log('Requesting new ledger event listener');
		this.connect.ipc.send('ledger', {
			event: 'start_listener'
		});
	}

	readSlots(initial: number) {
		this.ledgerPublicKeys = [];
		this.connect.ipc.send('ledger', {
			event: 'read_slots',
			data: {
				starts_on: initial,
				size: 5
			}
		});
	}

	checkEosApp() {
		if (!this.appReady) {
			console.log('Requesting eos app check for ledger device');
			this.checkingApp = true;
			this.connect.ipc.send('ledger', {
				event: 'check_app'
			});
			this.connect.ipc.once('ledger_reply', (event, args) => {
				console.log(event, args);
				this.checkingApp = false;
				this.appReady = args.data;
				if (!this.appReady) {
					setTimeout(() => {
						this.checkEosApp();
					}, 2000);
				}
			});
		}
	}


	handleIpcMessage(event, payload) {
		console.log(event, payload);
		if (payload.event === 'listener_event') {
			if (payload.data.type === 'add') {
				this.deviceName = payload.data.deviceModel.productName;
				this.ref.tick();
				console.log(`Device connected: ${this.deviceName}`);
				this.checkingApp = true;
				this.openPanel.emit(true);
				this.checkEosApp();
				// Transport.open(event.descriptor).then(async (t) => {
				// 	switch (opMode) {
				// 		case 'add_account': {
				// 			getAddresses(t).catch(console.log);
				// 			break;
				// 		}
				// 		case 'sign': {
				// 			await recursiveCheck(t, api);
				// 			break;
				// 		}
				// 	}
				// });
			} else if (payload.data.type === 'remove') {
				this.openPanel.emit(false);
				this.deviceName = '';
				this.appReady = false;
				this.checkingApp = false;
				this.ref.tick();
				console.log(`Device Removed: ${payload.data.deviceModel["productName"]}`);
			} else {
				console.log(event);
			}
		}
	}

	encode(writer, buffer) {
		return writer.writeBuffer(buffer, asn1.Ber.OctetString);
	}

	serialize(chainId: string, transaction: any, types: any) {
		const writer = new asn1.BerWriter();
		const _temp = [
			types.checksum256.prepare(chainId),
			types.time_point_sec.prepare(transaction.expiration),
			types.uint16.prepare(transaction.ref_block_num),
			types.uint32.prepare(transaction.ref_block_prefix),
			types.uint8.prepare(0),
			types.uint8.prepare(transaction.max_cpu_usage_ms),
			types.uint8.prepare(transaction.delay_sec),
			types.uint8.prepare(0),
			types.uint8.prepare(transaction.actions.length)
		];
		for (const t of _temp) {
			this.encode(writer, t);
		}
		for (let i = 0; i < transaction.actions.length; i += 1) {
			const action = transaction.actions[i];
			this.encode(writer, types.name.prepare(action.account));
			this.encode(writer, types.name.prepare(action.name));
			this.encode(writer, types.uint8.prepare(action.authorization.length));
			for (let i = 0; i < action.authorization.length; i += 1) {
				const authorization = action.authorization[i];
				this.encode(writer, types.name.prepare(authorization.actor));
				this.encode(writer, types.name.prepare(authorization.permission));
			}
			if (action.data) {
				const data = Buffer.from(action.data, 'hex');
				this.encode(writer, types.uint8.prepare(data.length));
				this.encode(writer, data);
			} else {
				try {
					this.encode(writer, types.uint8.prepare(0))
					this.encode(writer, new Buffer(0));
				} catch (e) {
					console.log('err', e);
				}
			}
		}
		this.encode(writer, types.uint8.prepare(0));
		this.encode(writer, types.checksum256.prepare(Buffer.alloc(32, 0).toString('hex')));
		return writer.buffer;
	}

	isElectron() {
		this.electronStatus = window && window['process'] && window['process']['type'];
		return this.electronStatus;
	}

	// readNextPublicKey(index, transport, limit, resolve) {
	// 	const bip44Path = this.basePath + index.toString();
	// 	const paths = this.bippath.fromString(bip44Path).toPathArray();
	// 	const buffer = Buffer.alloc(1 + paths.length * 4);
	// 	buffer[0] = paths.length;
	// 	paths.forEach((element, i) => {
	// 		buffer.writeUInt32BE(element, 1 + 4 * i);
	// 	});
	// 	transport.send(0xD4, 0x02, 0x00, 0x01, buffer).then(response => {
	// 		const result = {};
	// 		const pkl = response[0];
	// 		const addressLength = response[1 + pkl];
	// 		result['publicKey'] = response.slice(1, 1 + pkl)['toString']('hex');
	// 		result['wif'] = response.slice(1 + pkl + 1, 1 + pkl + 1 + addressLength)['toString']('ascii');
	// 		result['chainCode'] = response.slice(1 + pkl + 1 + addressLength, 1 + pkl + 1 + addressLength + 32)['toString']('hex');
	// 		if (this.ecc.isValidPublic(result['wif'])) {
	// 			// console.log('Looking for account related to ' + result.wif);
	// 			this.ecc.getKeyAccounts(result['wif']).then(data => {
	// 				if (data.account_names.length > 0) {
	// 					data.account_names.forEach(acc => {
	// 						this.eos.rpc.get_account(acc).then(account => {
	// 							account.permissions.forEach(perm => {
	// 								if (perm['perm_name'] === 'active') {
	// 									if (result['wif'] === perm.required_auth.keys[0].key) {
	// 										console.log('Index: ' + index + '\nAccount found: ' + acc + '\nKey: ' + result['wif']);
	// 										this.slots.push({
	// 											publicKey: result['wif'],
	// 											account: acc
	// 										});
	// 									}
	// 								}
	// 							});
	// 						});
	// 					});
	// 				} else {
	// 					console.log('\n\nIndex: ' + index + '\nNo account associated!' + '\nKey: ' + result['wif']);
	// 					this.slots.push({
	// 						publicKey: result['wif'],
	// 						account: null
	// 					});
	// 				}
	// 				if (index + 1 < limit) {
	// 					this.readNextPublicKey(index + 1, transport, limit, resolve);
	// 				} else {
	// 					resolve(this.slots);
	// 				}
	// 			});
	// 		} else {
	// 			console.log('Invalid!');
	// 		}
	// 	});
	// }

	serializeEosjs = (api, transaction) => {
		const types = {};
		api.abiTypes.forEach((value, key) => types[key] = value);
		api.transactionTypes.forEach((value, key) => types[key] = value);
		Object.keys(types).map(key => {
			types[key].prepare = raw => {
				const buf = new Serialize.SerialBuffer({
					textEncoder: this.textEncoder,
					textDecoder: this.textDecoder
				});
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
			}
		});
		const serializedData = this.serialize(api.chainId, transaction, types).toString('hex');
		return Buffer.from(serializedData, "hex");
	}

	// enableLedgerEOS(slot) {
	// 	console.log('Enabling ledger connection on slot ' + slot.toString());
	// 	const newPath = this.basePath + slot.toString();
	// 	const pSigner = (data) => {
	// 		return new Promise((resolve) => {
	// 			const paths = this.bippath.fromString(newPath).toPathArray();
	// 			const rawTx = this.serialize(this.eosService.chainID, data.transaction);
	// 			let offset = 0;
	// 			const toSend = [];
	// 			while (offset !== rawTx.length) {
	// 				const maxChunkSize = offset === 0 ? 150 - 1 - paths.length * 4 : 150;
	// 				const chunkSize =
	// 					offset + maxChunkSize > rawTx.length
	// 						? rawTx.length - offset
	// 						: maxChunkSize;
	// 				const buffer = Buffer.alloc(
	// 					offset === 0 ? 1 + paths.length * 4 + chunkSize : chunkSize
	// 				);
	// 				if (offset === 0) {
	// 					buffer[0] = paths.length;
	// 					paths.forEach((element, index) => {
	// 						buffer.writeUInt32BE(element, 1 + 4 * index);
	// 					});
	// 					rawTx.copy(buffer, 1 + 4 * paths.length, offset, offset + chunkSize);
	// 				} else {
	// 					rawTx.copy(buffer, 0, offset, offset + chunkSize);
	// 				}
	// 				toSend.push(buffer);
	// 				offset += chunkSize;
	// 			}
	// 			console.log(toSend);
	// 			this.submitToLedger(toSend, 0, this.activeTransport, resolve);
	// 		});
	// 	};
	// 	this.eosService.loadNewConfig(pSigner);
	// }

	// readPublicKeys(slots) {
	// 	this.slots = [];
	// 	return new Promise(resolve => {
	// 		this.readNextPublicKey(0, this.activeTransport, slots, resolve);
	// 	});
	// }

	async signTransaction(transport, trx, api, slotIndex) {
		const path = `44'/194'/0'/0/${slotIndex}`;
		const paths = this.bippath.fromString(path).toPathArray();
		let result;
		try {
			result = await api.transact(trx, {
				blocksBehind: 3,
				expireSeconds: 300,
				sign: false,
				broadcast: false
			});
		} catch (e) {
			console.log(e.message);
			return null;
		}
		const decTrx = await api.deserializeTransaction(result.serializedTransaction);
		const rawTx = this.serializeEosjs(api, decTrx);
		const toSend = [];
		let offset = 0;
		while (offset !== rawTx.length) {
			const maxChunkSize = offset === 0 ? 150 - 1 - paths.length * 4 : 150;
			const chunkSize = offset + maxChunkSize > rawTx.length ? rawTx.length - offset : maxChunkSize;
			const buffer = Buffer.alloc(offset === 0 ? 1 + (paths.length * 4) + chunkSize : chunkSize);
			if (offset === 0) {
				buffer[0] = paths.length;
				paths.forEach((element, index) => buffer.writeUInt32BE(element, 1 + 4 * index));
				rawTx.copy(buffer, 1 + 4 * paths.length, offset, offset + chunkSize);
			} else {
				rawTx.copy(buffer, 0, offset, offset + chunkSize);
			}
			toSend.push(buffer);
			offset += chunkSize;
		}
		console.log(`Array size: ${toSend.length}`);
		let response;
		for (let i = 0; i < toSend.length; i++) {
			try {
				console.log(`Sending part ${i}...`);
				response = await transport.send(
					this.LC.CLA,
					this.LC.SIGN, i === 0 ? this.LC.FIRST : this.LC.MORE,
					0x00,
					toSend[i]
				);
			} catch (e) {
				this.handleError(e);
				return null;
			}
		}
		if (response.length > 64) {
			const v = response.slice(0, 1).toString("hex");
			const r = response.slice(1, 33).toString("hex");
			const s = response.slice(33, 65).toString("hex");
			result.signatures.push(this.ecc.Signature.fromHex(v + r + s).toString());
			return result;
		} else {
			return null;
		}
	}

	async getAddressFromSlot(transport, slotIndex) {
		const path = `44'/194'/0'/0/${slotIndex}`;
		const paths = this.bippath.fromString(path).toPathArray();
		const buf = Buffer.alloc(1 + paths.length * 4);
		buf[0] = paths.length;
		for (let i = 0; i < paths.length; i++) {
			buf.writeUInt32BE(paths[i], 1 + 4 * i);
		}
		try {
			const response = await transport.send(
				this.LC.CLA,
				this.LC.PK,
				this.LC.NO,
				this.LC.NO,
				buf
			);
			const pkl = response[0];
			const addl = response[1 + pkl];
			return {
				publicKey: response.slice(1, 1 + pkl).toString("hex"),
				address: response.slice(1 + pkl + 1, 1 + pkl + 1 + addl).toString("ascii"),
				chainCode: response.slice(1 + pkl + 1 + addl, 1 + pkl + 1 + addl + 32).toString("hex")
			};
		} catch (e) {
			this.handleError(e);
		}
	}

	async getEosAppStatus(transport) {
		try {
			await transport.send(
				this.LC.CLA,
				this.LC.INFO,
				this.LC.NO,
				this.LC.NO
			);
			return true;
		} catch (e) {
			this.handleError(e);
			return false;
		}
	}

	async getAddresses(transport) {
		// Check app configuration
		await this.getEosAppStatus(transport);
		for (let i = 0; i < 3; i++) {
			const {address} = await this.getAddressFromSlot(transport, i);
			console.log(address);
			// find accounts
		}
	}

	handleError(e) {
		if (this.errorCodes[e.statusCode]) {
			console.log(this.errorCodes[e.statusCode]);
			// process.exit(1);
		} else {
			console.log(e);
		}
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

	private async lookupAccounts(data: any) {
		const key = data.address;
		console.log('looking up accounts for ' + key);
		const results = await this.eos.rpc.history_get_key_accounts(key);
		if (results.account_names) {
			for (const account of results.account_names) {
				console.log(account);
			}
		}
		results.account_names.push('testaccount' + data.slot);
		this.ledgerAccounts.push({
			key: key,
			slot: data.slot,
			accounts: results.account_names
		});
	}
}
