const {ipcMain} = require('electron');

class SimpleosConnectService {

	main;

  constructor(simpleosWallet) {
  	this.main = simpleosWallet;

  }

}

module.exports = {SimpleosConnectService};
