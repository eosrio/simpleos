import {Injectable} from '@angular/core';
import {AccountsService} from './accounts.service';
import {EOSJSService} from './eosio/eosjs.service';
import {Router} from '@angular/router';

import * as Eos from '../../assets/eos.js';
import {BehaviorSubject} from 'rxjs';
import {CryptoService} from './crypto/crypto.service';
import {VotingService} from './voting.service';
import {Eosjs2Service} from './eosio/eosjs2.service';
import {HttpClient} from '@angular/common/http';

export interface Endpoint {
  url: string;
  owner: string;
  latency: number;
  filters: any[];
  chain: string;
}

@Injectable({
  providedIn: 'root',
})
export class NetworkService {

  publicEndpoints: Endpoint[];
  eos: any;

  public mainnetId: string;

  public: string;
  genesistx = 'ad77575a8b4f52e477682e712b1cbd884299468db6a94d909f90c6961cea9b02';
  voteref = 'b23f537e8ab29fbcec8b533081ef7e12b146899ca42a3fc9eb608258df9983d9';
  accountez = 'EOS7WdCcva3WtsJRckJWodnHLof5B7qwAyfJSaMZmfn7Dgn6TQDBu';
  txrefBlock = 191;
  voterefBlock = 572278;
  baseConfig = {
    httpEndpoint: '',
    expireInSeconds: 60,
    broadcast: true,
    debug: false,
    sign: true,
    chainId: '',
  };
  validEndpoints: Endpoint[];
  status: string;
  connectionTimeout: any;
  selectedEndpoint = new BehaviorSubject<Endpoint>(null);
  networkingReady = new BehaviorSubject<boolean>(false);

  connected = false;
  lastEndpoint = '';
  autoMode = false;

  public activeChain = null;
  defaultChains: any[];
  selectGroup: any[];
  private isStarting = false;

  static groupBy(list, keyGetter) {
    const map = new Map();
    list.forEach((item) => {
      const key = keyGetter(item);
      const collection = map.get(key);
      if (!collection) {
        map.set(key, [item]);
      } else {
        collection.push(item);
      }
    });
    return map;
  }

  constructor(
      private http: HttpClient,
      private eosjs: EOSJSService,
      private eosjs2: Eosjs2Service,
      private router: Router,
      private aService: AccountsService,
      private voting: VotingService,
      private crypto: CryptoService,
  ) {
    const configSimpleos = JSON.parse(localStorage.getItem('configSimpleos'));
    this.defaultChains = configSimpleos['config']['chains'];
    const groupChain = NetworkService.groupBy(this.defaultChains, chain => chain.network);
    const mainnet = groupChain.get('MAINNET');
    const testenet = groupChain.get('TESTNET');
    this.selectGroup = [
      {
        'name': 'MAINNETS',
        'chains': mainnet,
      },
      {
        'name': 'TESTNETS',
        'chains': testenet,
      },
    ];
    this.activeChain = this.aService.activeChain;
    this.validEndpoints = [];
    this.status = '';
    this.connectionTimeout = null;
  }

  connect(automatic: boolean) {
    // console.log('analyzing endpoints...');
    this.autoMode = automatic;
    this.status = '';
    this.mainnetId = '';
    this.aService.activeChain = this.activeChain;
    this.mainnetId = this.activeChain['id'];
    this.networkingReady.next(false);
    const pQueue = [];
    this.connected = false;
    this.activeChain['endpoints'].forEach((apiNode) => {
      pQueue.push(this.apiCheck(apiNode));
    });
    Promise.all(pQueue).then(() => {
      this.extractValidNode();
    });
    this.startTimeout();
  }

  changeChain(chainId) {
    this.activeChain = this.defaultChains.find((chain) => chain.id === chainId);
    if (this.activeChain) {
      this.aService.activeChain = this.activeChain;
      this.aService.accounts = [];
      this.voting.clearMap();
      this.voting.clearLists();
      this.voting.initList = false;
      this.aService.lastAccount = null;
      localStorage.setItem('simplEOS.activeChainID', this.activeChain.id);
      this.connect(false);
      console.log('Network switched to: ' + this.activeChain['name']);
    }
  }

  startTimeout() {
    if (!this.connectionTimeout) {
      this.connectionTimeout = setTimeout(() => {
        console.log('Timeout!');
        if (!this.networkingReady.getValue()) {
          this.status = 'timeout';
          clearTimeout(this.connectionTimeout);
          this.networkingReady.next(false);
          this.connectionTimeout = null;
        }
      }, 10000);
    }
  }

  extractValidNode() {
    this.validEndpoints = [];
    this.activeChain.endpoints.forEach((apiNode) => {
      if (apiNode.latency > 0 && apiNode.latency < 1200) {
        this.validEndpoints.push(apiNode);
      }
    });
    this.selectEndpoint();
  }

  selectEndpoint() {
    let latency = 2000;
    if (this.connected === false) {
      this.validEndpoints.forEach((node) => {
        if (node.latency < latency && node.latency > 1) {
          latency = node.latency;
          this.selectedEndpoint.next(node);
        }
      });
      if (this.selectedEndpoint.getValue() === null) {
        this.networkingReady.next(false);
      } else {
        console.log('Best Server Selected!', this.selectedEndpoint.getValue().url);
        this.startup(null).catch(console.log);
      }
    }
  }

  selectedEP() {
    return this.eosjs.baseConfig.httpEndpoint;
  }

  filterCheck(server: Endpoint) {
    console.log('Starting filter check for ' + server.url);
    const config = this.baseConfig;
    config.httpEndpoint = server.url;
    config.chainId = this.mainnetId;
    const eosCK = Eos(config);
    const pq = [];
    const getkeyAcc = eosCK['getKeyAccounts'](this.accountez).then(info => {
      if (info.length > 0 || info['account_names'].length > 0) {
        this.publicEndpoints.find(ep => ep.url === server.url).filters.push({eosio: 'history'});
        return true;
      } else {
        console.log('eosio:history filter is disabled on ' + server.url);
      }
    }).catch(err => {
      console.log(err);
      return false;
    });
    pq.push(getkeyAcc);
    return Promise.all(pq);
  }

  apiCheck(server: Endpoint) {
    console.log('Starting latency check for ' + server.url);
    return new Promise((resolve) => {
      const refTime = new Date().getTime();

      const tempTimer = setTimeout(() => {
        server.latency = -1;
        resolve();
      }, 2000);

      this.http.get(`${server.url}/v1/chain/get_info`).subscribe(
          (data: any) => {
            if (data['chain_id'] === this.activeChain.id) {
              server.latency = ((new Date().getTime()) - refTime);
              clearTimeout(tempTimer);
              if (server.latency > 1 && server.latency < 200) {
                if (this.connected === false) {
                  this.connected = true;
                  this.callStartupConn(server);
                }
              }
              resolve();
            } else {
              console.log(
                  `API ${server.url} is serving a different chain id! expected: ${this.activeChain.id}, got: ${data['chain_id']}`);
            }
          },
          () => {
            server.latency = -1;
            resolve();
          },
      );
    });
  }

  callStartupConn(server) {
    if (this.connected === true) {
      this.selectedEndpoint.next(server);
      this.startup(null).catch(console.log);
    }
  }

  async startup(url) {
    // console.log(`startup - url:${url}`);
    if (this.isStarting) {
      return;
    } else {
      this.isStarting = true;
    }
    let endpoint = url;
    if (!url) {
      endpoint = this.selectedEndpoint.getValue().url;
      // console.log('switcing to saved endpoint:', endpoint);
    } else {
      this.status = '';
      console.log('startup called - url: ', url);
    }
    this.networkingReady.next(false);
    this.eosjs.online.next(false);
    this.startTimeout();

    // prevent double load after quick connection mode
    if (endpoint !== this.lastEndpoint || this.autoMode === true) {

      this.eosjs2.initRPC(endpoint, this.activeChain.id);
      let savedAccounts: any[];
      try {
        savedAccounts = await this.eosjs.init(endpoint, this.activeChain.id);
      } catch (err) {
        console.log('>>> EOSJS_ERROR: ', err);
        this.networkingReady.next(false);
      }
      if (!savedAccounts) {
        return;
      }

      this.lastEndpoint = endpoint;
      this.autoMode = false;
      this.defaultChains.find(c => c.id === this.activeChain.id).lastNode = this.lastEndpoint;
      if (savedAccounts) {
        if (savedAccounts.length > 0) {
          await this.aService.loadLocalAccounts(savedAccounts);
          if (this.aService.lastAccount) {
            this.aService.select(this.aService.accounts.findIndex((a) => {
              return a.name === this.aService.lastAccount;
            }));
          } else {
            this.aService.initFirst();
          }
          await this.router['navigate'](['dashboard', 'wallet']);
          this.networkingReady.next(true);
          this.isStarting = false;

        } else {
          this.networkingReady.next(true);
          this.isStarting = false;
          if (this.crypto.getLockStatus()) {
            console.log('No saved accounts! - Navigating to lockscreen');
            await this.router['navigate'](['']);
          } else {
            // navigate to landing if on any other page
            if (this.router.url !== '/landing') {
              await this.router['navigate'](['landing']);
            }
          }
        }
      }

      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.networkingReady.next(true);
        this.isStarting = false;
        this.connectionTimeout = null;
      }
    } else {
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.networkingReady.next(true);
        this.isStarting = false;
        this.connectionTimeout = null;
      }
      this.networkingReady.next(true);
    }
  }

}
