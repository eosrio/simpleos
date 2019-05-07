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
var core_1 = require("@angular/core");
var socketIo = require("socket.io-client");
var rxjs_1 = require("rxjs");
var accounts_service_1 = require("./accounts.service");
var eosjs_service_1 = require("./eosjs.service");
var RamService = /** @class */ (function () {
    function RamService(aService, eos) {
        var _this = this;
        this.aService = aService;
        this.eos = eos;
        this.ramTicker = new rxjs_1.BehaviorSubject(null);
        this.ramPriceEOS = 0;
        this.total_ram_bytes_reserved = 0;
        this.total_ram_stake = 0;
        this.max_ram_size = 0;
        this.rm_base = 0;
        this.rm_quote = 0;
        this.rm_supply = 0;
        this.reloaderInterval = null;
        this.socket = socketIo('https://hapi.eosrio.io/');
        this.socket.on('ticker', function (data) {
            if (data.price) {
                if (_this.aService.activeChain.name === 'EOS MAINNET') {
                    _this.ramTicker.next(data);
                    _this.ramPriceEOS = data.price;
                }
            }
        });
        this.reload();
        setInterval(function () {
            _this.reload();
        }, 10000);
    }
    RamService.prototype.reload = function () {
        var _this = this;
        if (this.aService.activeChain.name !== 'EOS MAINNET') {
            this.eos.getChainInfo().then(function (global) {
                if (global) {
                    _this.max_ram_size = global.rows[0]['max_ram_size'];
                    _this.total_ram_bytes_reserved = global.rows[0]['total_ram_bytes_reserved'];
                    _this.total_ram_stake = global.rows[0]['total_ram_stake'];
                    _this.eos.getRamMarketInfo().then(function (rammarket) {
                        _this.rm_base = rammarket.rows[0]['base']['balance'].split(' ')[0];
                        _this.rm_quote = rammarket.rows[0]['quote']['balance'].split(' ')[0];
                        _this.rm_supply = rammarket.rows[0]['supply'].split(' ')[0];
                        _this.updatePrice();
                    });
                }
            });
        }
    };
    RamService.prototype.updatePrice = function () {
        this.ramPriceEOS = ((this.rm_quote) / this.rm_base) * 1024;
    };
    RamService = __decorate([
        core_1.Injectable({
            providedIn: 'root'
        }),
        __metadata("design:paramtypes", [accounts_service_1.AccountsService, eosjs_service_1.EOSJSService])
    ], RamService);
    return RamService;
}());
exports.RamService = RamService;
//# sourceMappingURL=ram.service.js.map