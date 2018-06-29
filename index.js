const {app, BrowserWindow, Menu} = require('electron');
const path = require('path');
const url = require('url');
const {version} = require('./package.json');
app.getVersion = () => version;
// const {autoUpdater} = require('electron-updater');
const ipcMain = require('electron').ipcMain;

// let sender;
// autoUpdater.autoDownload = true;

let win, devtools;
const args = process.argv.slice(1);
devtools = args.some(val => val === '--devtools');

// if (devtools) {
//   autoUpdater.updateConfigPath = path.join('./dev-app-update.yml');
// }

// ipcMain.on('checkUpdate', (event, arg) => {
//   sender = event.sender;
//   autoUpdater.checkForUpdates().then((data) => {
//     sender.send('update_data', data);
//   });
// });
//
// autoUpdater.on('error', (error) => {
//   dialog.showErrorBox('Error: ', error == null ? "unknown" : (error.stack || error).toString())
// });
//
// autoUpdater.on('update-available', () => {
//   sender.send('update_ready', true);
// });
//
// autoUpdater.on('update-not-available', () => {
//   sender.send('update_ready', false);
// });

function createWindow() {
  win = new BrowserWindow({
    title: 'simplEOS',
    darkTheme: true,
    width: 1440,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: true,
    icon: path.join(__dirname, 'src/assets/icons/ico/simpleos.ico')
  });
  win.setMenu(null);

  win.loadURL(url.format({
    pathname: path.join(__dirname, 'ng-dist', 'index.html'),
    protocol: 'file:',
    slashes: true
  }));

  if (devtools) {
    win.webContents.openDevTools();
  }

  win.on('closed', () => {
    win = null
  });

  const template = [{
    label: "Application",
    submenu: [
      {type: "separator"},
      {
        label: "Quit",
        accelerator: "Command+Q",
        click: function () {
          app.quit();
        }
      }
    ]
  }, {
    label: "Edit",
    submenu: [
      {label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:"},
      {label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:"},
      {type: "separator"},
      {label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:"},
      {label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:"},
      {label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:"},
      {label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:"}
    ]
  }];
  Menu['setApplicationMenu'](Menu['buildFromTemplate'](template));
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

