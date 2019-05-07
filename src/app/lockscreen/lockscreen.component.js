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
var crypto_service_1 = require("../services/crypto.service");
var router_1 = require("@angular/router");
var network_service_1 = require("../services/network.service");
var accounts_service_1 = require("../services/accounts.service");
var LockscreenComponent = /** @class */ (function () {
    function LockscreenComponent(crypto, router, network, aService) {
        this.crypto = crypto;
        this.router = router;
        this.network = network;
        this.aService = aService;
        this.pin = '';
        this.nAttempts = 5;
        this.wrongpass = false;
        this.logoutModal = false;
        this.clearContacts = false;
        this.lottieConfig = {
            path: 'assets/logoanim.json',
            autoplay: true,
            loop: false
        };
    }
    LockscreenComponent_1 = LockscreenComponent;
    LockscreenComponent.resetApp = function () {
        window['remote']['app']['relaunch']();
        window['remote']['app'].exit(0);
    };
    LockscreenComponent.prototype.ngOnInit = function () {
        if (localStorage.getItem('simpleos-hash') === null) {
            this.router.navigate(['landing']).catch(function () {
                alert('cannot navigate out');
            });
        }
    };
    LockscreenComponent.prototype.handleAnimation = function (anim) {
        this.anim = anim;
        this.anim['setSpeed'](0.8);
    };
    LockscreenComponent.prototype.unlock = function () {
        var target = ['landing'];
        if (this.network.networkingReady.getValue() && this.aService.accounts.length > 0) {
            target = ['dashboard', 'wallet'];
        }
        if (!this.crypto.unlock(this.pin, target)) {
            this.wrongpass = true;
            this.nAttempts--;
            if (this.nAttempts === 0) {
                localStorage.clear();
                LockscreenComponent_1.resetApp();
            }
        }
    };
    LockscreenComponent.prototype.logout = function () {
        if (this.clearContacts) {
            localStorage.clear();
        }
        else {
            var arr = [];
            for (var i = 0; i < localStorage.length; i++) {
                if (localStorage.key(i) !== 'simpleos.contacts.' + this.network.activeChain['id']) {
                    arr.push(localStorage.key(i));
                }
            }
            arr.forEach(function (k) {
                localStorage.removeItem(k);
            });
        }
        LockscreenComponent_1.resetApp();
    };
    var LockscreenComponent_1;
    LockscreenComponent = LockscreenComponent_1 = __decorate([
        core_1.Component({
            selector: 'app-lockscreen',
            templateUrl: './lockscreen.component.html',
            styleUrls: ['./lockscreen.component.css']
        }),
        __metadata("design:paramtypes", [crypto_service_1.CryptoService,
            router_1.Router,
            network_service_1.NetworkService,
            accounts_service_1.AccountsService])
    ], LockscreenComponent);
    return LockscreenComponent;
}());
exports.LockscreenComponent = LockscreenComponent;
//# sourceMappingURL=lockscreen.component.js.map