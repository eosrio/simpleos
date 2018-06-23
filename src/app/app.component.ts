import {Component, OnInit} from '@angular/core';
import {NetworkService} from './network.service';
import {CryptoService} from './services/crypto.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  update: boolean;
  ipc: any;

  constructor(public network: NetworkService, private crypto: CryptoService) {
    this.update = false;
    this.crypto.createPIN('123456');
  }

  checkUpdate() {
    this.ipc['send']('checkUpdate', null);
  }

  performUpdate() {
    this.ipc['send']('startUpdate', null);
  }

  ngOnInit() {
    if (window['ipcRenderer']) {
      this.ipc = window['ipcRenderer'];
      this.ipc.on('update_data', (event, data) => {
        console.log(data);
      });
      this.ipc.on('update_ready', (event, data) => {
        this.update = data;
        console.log('Update status: ', data);
      });
      setTimeout(() => {
        this.checkUpdate();
      }, 2000);
    }
    this.network.connect();
  }
}
