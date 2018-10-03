import {Injectable} from '@angular/core';

import * as socketIo from 'socket.io-client';
import {BehaviorSubject} from 'rxjs';

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

  constructor() {
    this.socket = socketIo('https://hapi.eosrio.io/');
    this.socket.on('ticker', (data) => {
      if (data.price) {
        this.ramTicker.next(data);
        this.ramPriceEOS = data.price;
        }
    });
  }
}
