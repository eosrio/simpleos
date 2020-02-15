if (typeof module !== 'undefined' && module.exports) {
	const {remote, shell, ipcRenderer, clipboard} = require('electron');
	window.remote = remote;
	window.shell = shell;
	window.ipcRenderer = ipcRenderer;
	window.clipboard = clipboard;
	window.filesystem = require('fs');
	console.log('NATIVE MODULES LOADED!');
}
