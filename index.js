const {app, BrowserWindow, Menu} = require('electron');
const path = require('path');
const url = require('url');

let win, serve;
const args = process.argv.slice(1);
serve = args.some(val => val === '--serve');

function createWindow() {
  win = new BrowserWindow({
    title: 'simplEOS',
    darkTheme: true,
    x: 100,
    y: 100,
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 500,
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

