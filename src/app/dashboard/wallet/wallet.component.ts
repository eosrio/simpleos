import {AfterViewInit, Component, OnInit} from '@angular/core';
import {AccountsService} from '../../accounts.service';
import {EOSJSService} from '../../eosjs.service';

import * as moment from 'moment';

@Component({
    selector: 'app-wallet',
    templateUrl: './wallet.component.html',
    styleUrls: ['./wallet.component.css']
})
export class WalletComponent implements OnInit, AfterViewInit {
    fullBalance: number;
    staked: number;
    unstaked: number;
    moment: any;

    constructor(public aService: AccountsService, public eos: EOSJSService) {
        this.moment = moment;
    }

    ngOnInit() {
        this.aService.selected.asObservable().subscribe((sel) => {
            if (sel) {
                this.fullBalance = sel.full_balance;
                this.staked = sel.staked;
                this.unstaked = sel.full_balance - sel.staked;
            }
        });
    }

    ngAfterViewInit() {
        setTimeout(() => {
            // this.aService.initFirst();
        }, 1000);
    }

    openTXID(value) {
        window.open('https://eosflare.io/tx/' + value);
    }

}
