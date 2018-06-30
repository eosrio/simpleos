if (typeof module !== 'undefined' && module.exports) {
  window.filesystem = require('fs');
  window.opn = require('opn');
  window.remote = require('electron').remote;
  window.shell = require('electron').shell;
  window.ipcRenderer = require('electron').ipcRenderer;
  window.clipboard = require('electron').clipboard;
}
