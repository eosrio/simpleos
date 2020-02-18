import {Injectable, OnInit} from '@angular/core';

import * as socketIo from 'socket.io-client';
import {BehaviorSubject} from 'rxjs';
import {AccountsService} from './accounts.service';
import {EOSJSService} from './eosio/eosjs.service';

@Injectable({
    providedIn: 'root'
})
export class RamService {

    private readonly socket: any;
    public ramTicker = new BehaviorSubject<any>(null);

    ramPriceEOS = 0;
    total_ram_bytes_reserved = 0;
    total_ram_stake = 0;
    max_ram_size = 0;
    rm_base = 0;
    rm_quote = 0;
    rm_supply = 0;
    reloaderInterval = null;

    restrictedChains = [
        'EOS MAINNET',
        'LIBERLAND TESTNET'
    ];

    constructor(private aService: AccountsService, private eos: EOSJSService) {
        this.socket = socketIo('https://hapi.eosrio.io/');
        this.socket.on('ticker', (data) => {
            if (data.price) {
                if (this.aService.activeChain.name === 'EOS MAINNET') {
                    this.ramTicker.next(data);
                    this.ramPriceEOS = data.price;
                }
            }
        });
        setInterval(() => {
            this.reload();
        }, 60000);
    }

    reload() {
        if (!this.restrictedChains.includes(this.aService.activeChain.name)) {
            this.eos.getChainInfo().then((global) => {
                if (global) {
                    this.max_ram_size = global.rows[0]['max_ram_size'];
                    this.total_ram_bytes_reserved = global.rows[0]['total_ram_bytes_reserved'];
                    this.total_ram_stake = global.rows[0]['total_ram_stake'];
                    this.eos.getRamMarketInfo().then((rammarket) => {
                        this.rm_base = rammarket.rows[0]['base']['balance'].split(' ')[0];
                        this.rm_quote = rammarket.rows[0]['quote']['balance'].split(' ')[0];
                        this.rm_supply = rammarket.rows[0]['supply'].split(' ')[0];
                        this.updatePrice();
                    });
                }
            });
        }
    }

    updatePrice() {
        this.ramPriceEOS = ((this.rm_quote) / this.rm_base) * 1024;
    }
}
