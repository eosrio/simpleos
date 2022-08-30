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
exports.LockGuard = void 0;
const core_1 = require("@angular/core");
const router_1 = require("@angular/router");
const crypto_service_1 = require("../services/crypto/crypto.service");
let LockGuard = class LockGuard {
    constructor(crypto, router) {
        this.crypto = crypto;
        this.router = router;
    }
    canActivate(next, state) {
        if (localStorage.getItem('simpleos-hash')) {
            if (this.crypto.getLockStatus()) {
                console.log('wallet locked, redirecting...');
                this.router.navigate(['']).then(() => {
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
    }
};
LockGuard = __decorate([
    (0, core_1.Injectable)({
        providedIn: 'root'
    }),
    __metadata("design:paramtypes", [crypto_service_1.CryptoService, router_1.Router])
], LockGuard);
exports.LockGuard = LockGuard;
//# sourceMappingURL=lock.guard.js.map