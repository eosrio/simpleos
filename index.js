const {app, BrowserWindow, Menu} = require('electron');
const path = require('path');
const url = require('url');
const {version} = require('./package.json');
app.getVersion = () => version;

const ipcMain = require('electron').ipcMain;

let win, devtools, serve;
const args = process.argv.slice(1);
devtools = args.some(val => val === '--devtools');
serve = args.some(val => val === '--serve');

require('electron-context-menu')({
  showInspectElement: false
});

function createWindow() {
  win = new BrowserWindow({
    title: 'simplEOS',
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
      electron: require(`${__dirname}/node_modules/electron`)
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

