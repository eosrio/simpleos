if (typeof module !== 'undefined' && module.exports) {
  window.filesystem = require('fs');
  window.opn = require('opn');
  window.remote = require('electron').remote;
  window.ipcRenderer = require('electron').ipcRenderer;
}
