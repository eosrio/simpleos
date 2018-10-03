if (typeof module !== 'undefined' && module.exports) {
  window.remote = require('electron').remote;
  window.shell = require('electron').shell;
  window.ipcRenderer = require('electron').ipcRenderer;
  window.clipboard = require('electron').clipboard;
  window.asn1 = require('asn1-ber');
  window.fcbuffer = require('fcbuffer');
  window.ledgerTransport = require('@ledgerhq/hw-transport-node-hid').default;
  window.filesystem = require('fs');
  window.opn = require('opn');
}
