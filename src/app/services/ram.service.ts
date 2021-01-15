import {Injectable, OnInit} from '@angular/core';

import {io as socketIo } from 'socket.io-client';
import {BehaviorSubject} from 'rxjs';
import {AccountsService} from './accounts.service';
import {Eosjs2Service} from './eosio/eosjs2.service';

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

	restrictedChains = [
		'EOS MAINNET',
		'LIBERLAND TESTNET',
		'LIBERLAND T2',
		'LIBERLAND TEST LEGACY'
	];

	constructor(
		private aService: AccountsService,
		private eosjs: Eosjs2Service
	) {
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
			this.eosjs.getChainInfo().then((global) => {
				if (global) {
					this.max_ram_size = global.rows[0]['max_ram_size'];
					this.total_ram_bytes_reserved = global.rows[0]['total_ram_bytes_reserved'];
					this.total_ram_stake = global.rows[0]['total_ram_stake'];
					this.eosjs.getRamMarketInfo().then((rammarket) => {
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
