import {Injectable} from '@angular/core';
import {AccountsService} from './accounts.service';
import {EOSJSService} from './eosjs.service';
import {Router} from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class NetworkService {

  publicEndpoints: any[];
  mainnetId = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';

  constructor(private eos: EOSJSService, private router: Router, public aService: AccountsService) {
  }

  startup() {
    const endpoint = 'http://br.eosrio.io:8080';
    // const endpoint = 'http://api.hkeos.com';
    this.eos.init(endpoint, this.mainnetId).then((savedAccounts: any) => {
      if (savedAccounts) {
        if (savedAccounts.length > 0) {
          this.aService.loadLocalAccounts(savedAccounts);
          this.router['navigate'](['dashboard', 'vote']);
        } else {
          console.log('No saved accounts!');
        }
      }
    });
  }

}
