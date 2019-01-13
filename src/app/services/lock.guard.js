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
var router_1 = require("@angular/router");
var crypto_service_1 = require("./crypto.service");
var accounts_service_1 = require("./accounts.service");
var LockGuard = /** @class */ (function () {
    function LockGuard(crypto, router, aService) {
        this.crypto = crypto;
        this.router = router;
        this.aService = aService;
    }
    LockGuard.prototype.canActivate = function (next, state) {
        if (localStorage.getItem('simpleos-hash.' + this.aService.mainnetActive['id'])) {
            if (this.crypto.locked) {
                this.router.navigate(['']).then(function () {
                    console.log('Navigation failed');
                });
                return false;
            }
            else {
                return true;
            }
        }
        else {
            return true;
        }
    };
    LockGuard = __decorate([
        core_1.Injectable({
            providedIn: 'root'
        }),
        __metadata("design:paramtypes", [crypto_service_1.CryptoService, router_1.Router, accounts_service_1.AccountsService])
    ], LockGuard);
    return LockGuard;
}());
exports.LockGuard = LockGuard;
//# sourceMappingURL=lock.guard.js.map
