const Transport = require("@ledgerhq/hw-transport-node-hid").default;
const {ipcMain} = require('electron');
const bippath = require('bip32-path');
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

const errorCodes = {
	26628: 'Device is not ready, please unlock',
	28160: 'EOS App is not ready, please open the eos app on your ledger',
	27013: 'User cancelled the process',
	27264: 'Invalid data, please enable arbitrary data on your ledger device'
};

const LC = {
	CLA: 0xD4,
	INFO: 0x06,
	PK: 0x02,
	SIGN: 0x04,
	YES: 0x01,
	NO: 0x00,
	FIRST: 0x00,
	MORE: 0x80
};

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
		if (!hid_status) {
			console.log('HID Supported:', hid_status);
			process.exit();
		}
		ipcMain.on('ledger', async (event, args) => {
			if (args.event === 'start_listener') {
				this.setupListener();
			}
			if (args.event === 'check_app') {
				const status = await this.getEosAppStatus();
				this.main.win.webContents.send('ledger_reply', {
					event: 'check_app',
					data: status
				});
			}
			if (args.event === 'read_slots') {
				for (let i = args.data.starts_on; i < args.data.size; i++) {
					const {address} = await this.getAddressFromSlot(this.transport, i);
					this.main.win.webContents.send('ledger_keys', {
						event: 'read_key',
						data: {
							address,
							slot: i
						}
					});
				}
			}
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
			const response = await transport.send(0xD4, 0x02, 0x00, 0x00, buf);
			const result = {};
			const pkl = response[0];
			const addl = response[1 + pkl];
			result.publicKey = response.slice(1, 1 + pkl).toString("hex");
			result.address = response.slice(1 + pkl + 1, 1 + pkl + 1 + addl).toString("ascii");
			result.chainCode = response.slice(1 + pkl + 1 + addl, 1 + pkl + 1 + addl + 32).toString("hex");
			return result;
		} catch (e) {
			this.handleError(e);
			return null;
		}
	}

	handleError(e) {
		this.main.win.webContents.send('ledger', {
			event: 'error',
			data: e
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
					data: event
				});
			},
			error: (err) => {
				console.log(err);
				this.main.win.webContents.send('ledger', {
					event: 'listener_error',
					data: err
				});
			},
			complete: () => {
				console.log('complete');
				this.main.win.webContents.send('ledger', {
					event: 'listener_complete'
				});
			}
		});
	}

	async openTransport() {
		return new Promise((resolve, reject) => {
			if (this.deviceDescriptor) {
				console.log('deviceDescriptor', this.deviceDescriptor);
				Transport.open(this.deviceDescriptor).then((t) => {
					this.transport = t;
					console.log('transport ready');
					resolve();
				});
			} else {
				reject();
			}
		});
	}
}

module.exports = {LedgerManager};
