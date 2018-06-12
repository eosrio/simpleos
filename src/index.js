const {app, BrowserWindow} = require('electron');
const path = require('path');
const url = require('url');
require('update-electron-app')();

if (require('electron-squirrel-startup')) {
  app.quit();
}

let win, serve;
const args = process.argv.slice(1);
serve = args.some(val => val === '--serve');

function createWindow() {
  win = new BrowserWindow({
    x: 1280 / 2,
    y: 100,
    width: 1280,
    height: 720,
    'min-width': 800,
    'min-height': 500,
    frame: true,
    icon: path.join(__dirname, 'assets/icons/ico/simpleos.ico')
  });
  win.setMenu(null);
  if (serve) {
    require('electron-reload')(__dirname, {
      electron: require(__dirname + '../node_modules/electron')
    });
    win.loadURL('http://localhost:7868');
  } else {
    win.loadURL(url.format({
      pathname: path.join(__dirname, '../dist/index.html'),
      protocol: 'file:',
      slashes: true
    }));
  }
  // win.webContents.openDevTools();
  win.on('closed', () => {
    win = null
  });
}

app.on('ready', createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
});
app.on('activate', () => {
  if (win === null) {
    createWindow()
  }
});

