const {ipcMain} = require('electron');
const cors = require('cors');
const bodyParser = require('body-parser');
const express = require('express');
const http = require('http');
const portfinder = require('portfinder');

class TransitApiService {
  main;
  expressApp;
  httpServer;

  constructor(simpleosWallet) {
    this.main = simpleosWallet;
    this.expressApp = express();
    this.httpServer = http.createServer(this.expressApp);
  }

  init() {
    portfinder['basePort'] = 47888;
    portfinder['highestPort'] = 49800;
    this.setupRoutes();
  }

  setupRoutes() {
    this.expressApp.use(cors());
    this.expressApp.get('/ping', (req, res) => {
      res.end('OK');
    });
    this.expressApp.get('/accounts', (req, res) => {
      this.main.win.webContents.send('request', 'accounts');
      ipcMain.once('accountsResponse', (event, data) => {
        console.log(data);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      });
    });
    this.expressApp.get('/getPublicKeys', (req, res) => {
      this.main.win.webContents.send('request', {
        message: 'publicKeys',
      });
      ipcMain.once('publicKeyResponse', (event, data) => {
        console.log(data);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      });
    });
    this.expressApp.get('/connect', (req, res) => {
      console.log('CONNECT REQUEST');
      this.main.getFocus();
      this.main.win.webContents.send('request', {
        message: 'connect',
        content: {
          appName: req.query['appName'],
          chainId: req.query['chainId'],
        },
      });
      if (req.query['appName'].length < 32 && req.query['chainId'].length ===
          64) {
        ipcMain.once('connectResponse', (event, data) => {
          console.log(data);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        });
      }
    });
    this.expressApp.get('/login', (req, res) => {
      console.log('CONNECT REQUEST, account:' + req.query.account);
      this.main.win.webContents.send('request', {
        message: 'login',
        content: {
          account: req.query.account,
        },
      });
      if (!req.query.account) {
        this.main.getFocus();
      }
      if (req.query.account) {
        if (req.query.account.length > 13) {
          res.end('ERROR');
          return false;
        }
      }
      ipcMain.once('loginResponse', (event, data) => {
        console.log(data);
        if (data.status) {
          if (data.status !== 'CANCELLED') {
            if (!req.query.account) {
              this.main.unfocus();
            }
          }
        } else {
          this.main.unfocus();
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      });
    });
    this.expressApp.get('/logout', (req, res) => {
      console.log('LOGOUT REQUEST');
      this.main.win.webContents.send('request', {
        message: 'logout',
        content: {
          account: req.query.account,
        },
      });
      if (req.query.account) {
        if (req.query.account.length > 13) {
          res.end('ERROR');
          return false;
        }
      }
      ipcMain.once('logoutResponse', (event, data) => {
        console.log(data);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      });
    });
    this.expressApp.get('/disconnect', (req, res) => {
      console.log('DISCONNECT REQUEST');
      this.main.win.webContents.send('request', {
        message: 'disconnect',
      });
      ipcMain.once('disconnectResponse', (event, data) => {
        console.log(data);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      });
    });
    this.expressApp.post('/sign', bodyParser.json(), (req, res) => {
      this.main.win.webContents.send('request', {
        message: 'sign',
        content: req.body,
      });
      this.main.getFocus();
      ipcMain.once('signResponse', (event, data) => {
        console.log(data);
        res.setHeader('Content-Type', 'application/json');
        if (data.status !== 'CANCELLED') {
          this.main.unfocus();
        }
        res.end(JSON.stringify(data));
      });
    });
  }

  startServer() {
    try {
      portfinder.getPortPromise().then((port) => {
        this.httpServer.listen(port, '127.0.0.1', () => {
          console.log('listening on 127.0.0.1:' + port);
        });
      }).catch((err) => {
        console.log(err);
      });
    } catch (e) {
      console.log(e);
    }
  }

}

module.exports = {TransitApiService};
