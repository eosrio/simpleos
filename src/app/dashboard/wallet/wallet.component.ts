import {Component, OnInit} from '@angular/core';
import {AccountsService} from '../../accounts.service';
import {EOSJSService} from '../../eosjs.service';

import * as moment from 'moment';

@Component({
    selector: 'app-wallet',
    templateUrl: './wallet.component.html',
    styleUrls: ['./wallet.component.css']
})
export class WalletComponent implements OnInit {
    fullBalance: Number;
    staked: Number;
    unstaked: Number;
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

    openTXID(value) {
        window.open('https://eosflare.io/tx/' + value);
    }

}
