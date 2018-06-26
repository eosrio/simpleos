import {EventEmitter, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {EOSJSService} from '../../eosjs.service';
import {Subject} from 'rxjs';
import {AccountsService} from '../../accounts.service';

@Injectable({
  providedIn: 'root'
})
export class VotingService {

  public bps: any[];
  public listReady = new Subject<Boolean>();
  public counter = new Subject<Number>();
  selectedAccount: any;
  initList: boolean;
  totalActivatedStake: number;
  totalProducerVoteWeight: number;
  chainActive: boolean;
  stakePercent: number;
  activeCounter = 50;

  // map
  data: any[];
  updateOptions: any;

  constructor(private eos: EOSJSService, private http: HttpClient, private aService: AccountsService) {
    this.bps = [];
    this.data = [];
    this.initList = false;
    this.chainActive = false;
    this.totalActivatedStake = 0;
    this.totalProducerVoteWeight = 0;
    this.stakePercent = 0;
    this.startUpdateGlobalStake();
    this.aService.selected.asObservable().subscribe((sA) => {
      this.selectedAccount = sA;
      if (this.bps.length === 0 && !this.initList) {
        this.listProducers();
      }
    });
  }

  static shuffle(array) {
    let currentIndex = array.length, temporaryValue, randomIndex;
    while (0 !== currentIndex) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
    return array;
  }

  randomizeList() {
    this.bps = VotingService.shuffle(this.bps);
  }

  updateGlobalStake() {
    this.eos.getChainInfo().then((global) => {
      this.totalActivatedStake = parseInt(global.rows[0]['total_activated_stake'], 10) / 10000;
      this.stakePercent = (Math.round((100 * this.totalActivatedStake / 150000000.0) * 1000) / 1000);
    });
  }

  startUpdateGlobalStake() {
    this.updateGlobalStake();
    setInterval(() => {
      this.updateGlobalStake();
    }, 10000);
  }

  listProducers() {
    if (this.initList === false) {
      this.initList = true;
      this.aService.initFirst();
      this.eos.listProducers().then((producers) => {
        this.eos.getChainInfo().then((global) => {
          this.totalActivatedStake = parseInt(global.rows[0]['total_activated_stake'], 10) / 10000;
          this.totalProducerVoteWeight = parseFloat(global.rows[0]['total_producer_vote_weight']);
          this.chainActive = this.totalActivatedStake > 150000000.0;
          const total_votes = this.totalProducerVoteWeight;
          // Pass 1 - Add accounts
          const myAccount = this.aService.selected.getValue();
          producers.rows.forEach((prod: any, idx) => {
            const vote_pct: any = Math.round((100 * prod['total_votes'] / total_votes) * 1000) / 1000;
            let voted;
            if (myAccount.details['voter_info']) {
              voted = myAccount.details['voter_info']['producers'].indexOf(prod['owner']) !== -1;
            } else {
              voted = false;
            }
            const producerMetadata = {
              name: prod['owner'],
              account: prod['owner'],
              key: prod['producer_key'],
              location: '',
              geo: [],
              position: idx + 1,
              status: (idx < 21 && this.chainActive) ? 'producing' : 'standby',
              total_votes: vote_pct + '%',
              social: '',
              email: '',
              website: prod.url,
              logo_256: '',
              code: '',
              checked: voted
            };
            this.bps.push(producerMetadata);
          });
          this.listReady.next(true);
          // Pass 2 - Enhance metadata
          this.activeCounter = 50;
          const expiration = (1000 * 60 * 60 * 6);
          // const expiration = 1000;
          producers.rows.forEach((prod: any, idx) => {
            const cachedPayload = JSON.parse(localStorage.getItem(prod['owner']));
            if (cachedPayload) {
              if (new Date().getTime() - new Date(cachedPayload.lastUpdate).getTime() > expiration) {
                setTimeout(() => {
                  this.improveMeta(prod, idx);
                }, 100 + idx * 10);
              } else {
                this.bps[idx] = cachedPayload['meta'];
                if (idx < 50) {
                  this.addPin(this.bps[idx]);
                }
              }
            } else {
              setTimeout(() => {
                this.improveMeta(prod, idx);
              }, 100 + idx * 10);
            }
          });
        });
      });
    }
  }

  improveMeta(prod, idx) {
    if (prod.url !== '') {
      const url = prod.url.endsWith('.json') ? prod.url : prod.url + '/bp.json';
      if (url !== '') {
        this.http.post('http://proxy.eosrio.io:4200', {
          url: url
        }).subscribe((data) => {
          if (data) {
            if (data['org']) {
              const org = data['org'];
              let loc = ' - ';
              let geo = [];
              if (org['location']) {
                loc = (org.location.name) ? (org.location.name + ', ' + org.location.country) : (org.location.country);
                geo = [org.location.latitude, org.location.longitude];
              }
              const logo_256 = (org['branding']) ? org['branding']['logo_256'] : '';
              if (data['producer_account_name'] === prod['owner']) {
                this.bps[idx].name = org['candidate_name'];
                this.bps[idx].account = data['producer_account_name'];
                this.bps[idx].location = loc;
                this.bps[idx].geo = geo;
                this.bps[idx].social = org['social'] || {};
                this.bps[idx].email = org['email'];
                this.bps[idx].website = org['website'];
                this.bps[idx].logo_256 = logo_256;
                this.bps[idx].code = org['code_of_conduct'];

                if (idx < 50) {
                  this.addPin(this.bps[idx]);
                }

                // Add to cache
                const payload = {
                  lastUpdate: new Date(),
                  meta: this.bps[idx],
                  source: url
                };
                localStorage.setItem(prod['owner'], JSON.stringify(payload));
              }
            }
          }
        }, () => {
          // console.log(url, err);
        });
      }
    } else {
      // console.log(prod['owner'] + ' provided no bp.json');
    }
  }

  addPin(bp) {
    if (bp.geo.length === 2) {
      const name = bp['name'];
      const lat = bp['geo'][0];
      const lon = bp['geo'][1];
      if ((lon < 180 && lon > -180) && (lat < 90 && lat > -90)) {
        if (this.data.length < 50) {
          if (bp['status'] === 'standby') {
            this.data.push({
              name: name,
              symbol: 'circle',
              symbolSize: 8,
              itemStyle: {
                color: '#feff4b',
                borderWidth: 0
              },
              value: [lon, lat],
              location: bp['location']
            });
          } else {
            this.data.push({
              name: name,
              symbol: 'diamond',
              symbolSize: 10,
              itemStyle: {
                color: '#6cff46',
                borderWidth: 0
              },
              value: [lon, lat],
              location: bp['location']
            });
          }
          this.updateOptions = {
            series: [{
              data: this.data
            }]
          };
        }
      }
    }
  }
}
