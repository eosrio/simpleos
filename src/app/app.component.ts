import {Component, OnInit} from '@angular/core';
import {NetworkService} from './network.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  update: boolean;
  ipc: any;

  constructor(public network: NetworkService) {
    this.update = false;
  }

  checkUpdate() {
    this.ipc['send']('checkUpdate', null);
  }

  performUpdate() {
    // this.ipc['send']('startUpdate', null);
    window['shell'].openExternal('https://eosrio.io/simpleos/');
  }

  openGithub() {
    window['shell'].openExternal('https://github.com/eosrio/simpleos/releases/latest');
  }

  ngOnInit() {
    if (window['ipcRenderer']) {
      this.ipc = window['ipcRenderer'];
      this.ipc.on('update_ready', (event, data) => {
        this.update = data;
      });
      setTimeout(() => {
        this.checkUpdate();
      }, 5000);
    }
    this.network.connect();
  }
}
