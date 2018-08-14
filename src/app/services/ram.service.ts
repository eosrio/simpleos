import {Injectable} from '@angular/core';
import {EOSJSService} from '../eosjs.service';

@Injectable({
  providedIn: 'root'
})
export class RamService {

  ramPriceEOS = 0;
  total_ram_bytes_reserved = 0;
  total_ram_stake = 0;
  max_ram_size = 0;
  rm_base = 0;
  rm_quote = 0;
  rm_supply = 0;
  reloaderInterval = null;

  constructor(private eos: EOSJSService) {
  }

  reload() {
    this.eos.getChainInfo().then((global) => {
      // console.log(global);
      if (global) {
        this.max_ram_size = global.rows[0]['max_ram_size'];
        this.total_ram_bytes_reserved = global.rows[0]['total_ram_bytes_reserved'];
        this.total_ram_stake = global.rows[0]['total_ram_stake'];
        this.eos.getRamMarketInfo().then((rammarket) => {
          // console.log(rammarket);
          this.rm_base = rammarket.rows[0]['base']['balance'].split(' ')[0];
          this.rm_quote = rammarket.rows[0]['quote']['balance'].split(' ')[0];
          this.rm_supply = rammarket.rows[0]['supply'].split(' ')[0];
          this.updatePrice();
          this.startLoop();
        });
      }
    });
  }

  startLoop() {
    if (!this.reloaderInterval) {
      this.reloaderInterval = setInterval(() => {
        this.reload();
      }, 15000);
    }
  }

  updatePrice() {
    this.ramPriceEOS = ((this.rm_quote) / this.rm_base) * 1024;
  }
}
