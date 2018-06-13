const {app, BrowserWindow} = require('electron');
const path = require('path');
const url = require('url');
require("electron-updater").autoUpdater.checkForUpdatesAndNotify();

let win, serve;
const args = process.argv.slice(1);
serve = args.some(val => val === '--serve');

function createWindow() {
  win = new BrowserWindow({
    x: 100,
    y: 100,
    width: 1280,
    height: 720,
    'min-width': 800,
    'min-height': 500,
    frame: true,
    icon: path.join(__dirname, 'src/assets/icons/ico/simpleos.ico')
  });
  win.setMenu(null);
  win.loadURL(url.format({
    pathname: path.join(__dirname, 'ng-dist', 'index.html'),
    protocol: 'file:',
    slashes: true
  }));
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

