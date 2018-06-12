import {Component, OnInit} from '@angular/core';
import {EOSJSService} from '../eosjs.service';
import {AccountsService} from '../accounts.service';
import {LandingComponent} from '../landing/landing.component';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  lottieConfig: Object;
  anim: any;
  newAccountModal: boolean;
  accounts: any;

  constructor(public eos: EOSJSService, public aService: AccountsService) {
    this.newAccountModal = false;
    this.lottieConfig = {
      path: 'assets/logoanim2.json',
      autoplay: true,
      loop: false
    };
  }

  ngOnInit() {
    this.accounts = [];
    this.eos.status.asObservable().subscribe((status) => {
      if (status) {
        this.loadStoredAccounts();
      }
    });
  }

  handleAnimation(anim: any) {
    this.anim = anim;
    this.anim.setSpeed(0.8);
  }

  selectAccount(idx) {
    this.aService.select(idx);
  }

  refreshAccount() {
    const accountName = this.aService.selected.getValue().name;
  }

  loadStoredAccounts() {
    const account_names = Object.keys(this.eos.accounts.getValue());
    if (account_names.length > 0) {
      account_names.forEach((name) => {
        const acc = this.eos.accounts.getValue()[name];
        let balance = 0;
        acc['tokens'].forEach((tk) => {
          balance += LandingComponent.parseEOS(tk);
        });
        const net = LandingComponent.parseEOS(acc['total_resources']['net_weight']);
        const cpu = LandingComponent.parseEOS(acc['total_resources']['cpu_weight']);
        balance += net;
        balance += cpu;
        const accData = {
          name: acc['account_name'],
          full_balance: Math.round((balance) * 10000) / 10000,
          staked: net + cpu,
          details: acc
        };
        this.accounts.push(accData);
        this.aService.accounts.push(accData);
      });
    }
    this.aService.initFirst();
  }
}
