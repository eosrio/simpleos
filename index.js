const {app, BrowserWindow, Menu, protocol} = require('electron');
const path = require('path');
const url = require('url');
const {version} = require('./package.json');
app.getVersion = () => version;
const PROTOCOL_PREFIX = 'simpleos';
app.setAsDefaultProtocolClient(PROTOCOL_PREFIX);

// const ipcMain = require('electron').ipcMain;

// local server
const express = require('express')();
const http = require('http').Server(express);
const io = require('socket.io')(http);

express.get('/', function (req, res) {
	res.send('simpleos-connect');
});

let internalSocket = null;
io.on('connection', function (socket) {
	console.log('a user connected');
	socket.emit('handshake', "Hello!");
	socket.on('id', (mode) => {
		// console.log('new id', mode);
		if (mode === 'SENDER') {
			if (internalSocket) {
				internalSocket.emit('data', "new client has connected!");
			} else {
				console.log('internal socket failure');
			}
		} else if (mode === 'LISTENER') {
			internalSocket = socket;
		}
	});

	socket.on('data', (data) => {
		if (internalSocket) {
			internalSocket.emit('new_data', data);
		} else {
			console.log('socket failure!');
		}
	});
});

http.listen(3000, function () {
	console.log('listening on *:3000');
});


let win, devtools, serve;
const args = process.argv.slice(1);
devtools = args.some(val => val === '--devtools');
serve = args.some(val => val === '--serve');

require('electron-context-menu')({
	showInspectElement: false
});



function createWindow() {

	protocol.registerHttpProtocol(PROTOCOL_PREFIX, (req, callback) => {
		console.log(req);
		callback();
	});

	win = new BrowserWindow({
		title: 'simplEOS',
		webPreferences: {
			nodeIntegration: true
		},
		darkTheme: true,
		width: 1440,
		height: 800,
		minWidth: 800,
		minHeight: 600,
		backgroundColor: '#222222',
		frame: true,
		icon: path.join(__dirname, 'src/assets/icons/ico/simpleos.ico')
	});
	win.setMenu(null);

	if (serve) {
		require('electron-reload')(__dirname, {
			electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
			hardResetMethod: 'exit'
		});
		win.loadURL('http://localhost:7777');
	} else {
		win.loadURL(url.format({
			pathname: path.join(__dirname, 'ng-dist/index.html'),
			protocol: 'file:',
			slashes: true
		}));
	}

	if (devtools) {
		win.webContents.openDevTools();
	}

	win.on('closed', () => {
		win = null;
	});

	const template = [{
		label: 'Application',
		submenu: [
			{type: 'separator'},
			{
				label: 'Quit',
				accelerator: 'Command+Q',
				click: function () {
					app.quit();
				}
			}
		]
	}, {
		label: 'Edit',
		submenu: [
			{label: 'Undo', accelerator: 'CmdOrCtrl+Z', selector: 'undo:'},
			{label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:'},
			{type: 'separator'},
			{label: 'Cut', accelerator: 'CmdOrCtrl+X', selector: 'cut:'},
			{label: 'Copy', accelerator: 'CmdOrCtrl+C', selector: 'copy:'},
			{label: 'Paste', accelerator: 'CmdOrCtrl+V', selector: 'paste:'},
			{label: 'Select All', accelerator: 'CmdOrCtrl+A', selector: 'selectAll:'}
		]
	}];
	Menu['setApplicationMenu'](Menu['buildFromTemplate'](template));
}

app.on('ready', createWindow);
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});
app.on('activate', () => {
	if (win === null) {
		createWindow();
	}
});

