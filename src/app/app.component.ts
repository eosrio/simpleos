import {Component, OnInit} from '@angular/core';
import {EOSJSService} from './eosjs.service';
import {Router} from '@angular/router';
import {AccountsService} from './accounts.service';
import {NetworkService} from './network.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  constructor(private network: NetworkService) {
  }

  ngOnInit() {
    this.network.connect();
  }
}
