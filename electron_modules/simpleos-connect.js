const {ipcMain} = require('electron');

class SimpleoConnectService {

	main;

  constructor(simpleosWallet) {
  	this.main = simpleosWallet;

  }

}

module.exports = {SimpleoConnectService};
