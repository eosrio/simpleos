import {Component, OnInit} from '@angular/core';
import {EOSJSService} from '../../eosjs.service';
import {AccountsService} from '../../accounts.service';
import {CryptoService} from '../../services/crypto.service';
import {ToasterService} from 'angular2-toaster';

@Component({
  selector: 'app-ram-market',
  templateUrl: './ram-market.component.html',
  styleUrls: ['./ram-market.component.css']
})
export class RamMarketComponent implements OnInit {

  myRamAlloc = 0;
  totalRamAlloc = 0;
  ramPriceEOS = 0;
  amountbytes = 1024;
  total_ram_bytes_reserved = 0;
  total_ram_stake = 0;
  max_ram_size = 0;
  rm_base = 0;
  rm_quote = 0;
  rm_supply = 0;

  constructor(
    private eos: EOSJSService,
    private aService: AccountsService,
    private crypto: CryptoService,
    private toaster: ToasterService
  ) {
  }

  ngOnInit() {
    this.reload();
  }

  buy() {

  }

  reload() {
    this.eos.getChainInfo().then((global) => {
      console.log(global);
      this.max_ram_size = global.rows[0]['max_ram_size'];
      this.total_ram_bytes_reserved = global.rows[0]['total_ram_bytes_reserved'];
      this.total_ram_stake = global.rows[0]['total_ram_stake'];
      this.eos.getRamMarketInfo().then((rammarket) => {
        console.log(rammarket);
        this.rm_base = rammarket.rows[0]['base']['balance'].split(' ')[0];
        this.rm_quote = rammarket.rows[0]['quote']['balance'].split(' ')[0];
        this.rm_supply = rammarket.rows[0]['supply'].split(' ')[0];
        this.updatePrice();
      });
    });
  }

  updatePrice() {
    this.ramPriceEOS = ((this.rm_quote) / this.rm_base) * 1024;
  }

  sell() {

  }

}
