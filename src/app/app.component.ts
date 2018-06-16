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
