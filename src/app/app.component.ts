import {Component} from '@angular/core';
import {EOSJSService} from './eosjs.service';
import {Router} from '@angular/router';
import {AccountsService} from './accounts.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  constructor(private eos: EOSJSService,
              private router: Router,
              public aService: AccountsService) {
    const endpoint = 'http://br.eosrio.io:8080';
    const chain_id = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';
    this.eos.init(endpoint, chain_id).then((savedAccounts: any) => {
      if (savedAccounts) {
        if (savedAccounts.length > 0) {
          this.aService.loadLocalAccounts(savedAccounts);
          router['navigate'](['dashboard', 'vote']);
        } else {
          console.log('No saved accounts!');
        }
      }
    });
  }
}
