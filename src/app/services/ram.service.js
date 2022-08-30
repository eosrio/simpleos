"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RamService = void 0;
const core_1 = require("@angular/core");
const socket_io_client_1 = require("socket.io-client");
const rxjs_1 = require("rxjs");
const accounts_service_1 = require("./accounts.service");
const eosjs2_service_1 = require("./eosio/eosjs2.service");
let RamService = class RamService {
    constructor(aService, eosjs) {
        this.aService = aService;
        this.eosjs = eosjs;
        this.ramTicker = new rxjs_1.BehaviorSubject(null);
        this.ramPriceEOS = 0;
        this.total_ram_bytes_reserved = 0;
        this.total_ram_stake = 0;
        this.max_ram_size = 0;
        this.rm_base = 0;
        this.rm_quote = 0;
        this.rm_supply = 0;
        this.restrictedChains = ['EOS MAINNET'];
        this.socket = (0, socket_io_client_1.io)('https://hapi.eosrio.io/', {
            transports: ['websocket']
        });
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
};
RamService = __decorate([
    (0, core_1.Injectable)({
        providedIn: 'root'
    }),
    __metadata("design:paramtypes", [accounts_service_1.AccountsService,
        eosjs2_service_1.Eosjs2Service])
], RamService);
exports.RamService = RamService;
//# sourceMappingURL=ram.service.js.map