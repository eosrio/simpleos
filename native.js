if (typeof module !== 'undefined' && module.exports) {
	window.remote = require('electron').remote;
	window.shell = require('electron').shell;
	window.ipcRenderer = require('electron').ipcRenderer;
	window.clipboard = require('electron').clipboard;
	window.filesystem = require('fs');
	// window.opn = require('opn');
	// window.fcbuffer = require('fcbuffer');
	// window.asn1 = require('asn1-ber');
	// window.ledgerTransport = require('@ledgerhq/hw-transport-node-hid').default;
	console.log('NATIVE MODULES LOADED!');
}
