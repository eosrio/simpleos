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
var LockscreenComponent_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LockscreenComponent = void 0;
const core_1 = require("@angular/core");
const crypto_service_1 = require("../services/crypto/crypto.service");
const router_1 = require("@angular/router");
const network_service_1 = require("../services/network.service");
const accounts_service_1 = require("../services/accounts.service");
const app_component_1 = require("../app.component");
let LockscreenComponent = LockscreenComponent_1 = class LockscreenComponent {
    constructor(crypto, router, network, aService, app) {
        this.crypto = crypto;
        this.router = router;
        this.network = network;
        this.aService = aService;
        this.app = app;
        this.pin = '';
        this.nAttempts = 5;
        this.wrongpass = false;
        this.lottieConfig = {
            path: 'assets/logoanim.json',
            autoplay: true,
            loop: false
        };
        this.logoutModal = false;
        this.clearContacts = false;
    }
    static resetApp() {
        window['remote']['app']['relaunch']();
        window['remote']['app'].exit(0);
    }
    toggleAnimation() {
        if (this.anim) {
            const duration = this.anim.getDuration(true);
            this.anim.goToAndPlay(Math.round(duration / 3), true);
        }
    }
    ngOnInit() {
        if (!localStorage.getItem('simpleos-hash')) {
            console.log('no hash saved.. navigating to landing page');
            this.router.navigate(['landing']).catch(() => {
                console.log('cannot navigate out');
            });
        }
    }
    handleAnimation(anim) {
        this.anim = anim;
        this.anim['setSpeed'](0.8);
    }
    unlock() {
        let target = ['landing'];
        if (this.network.networkingReady.getValue() && this.aService.accounts.length > 0) {
            target = ['dashboard', 'home'];
        }
        if (!this.crypto.unlock(this.pin, target)) {
            this.wrongpass = true;
            this.nAttempts--;
            if (this.nAttempts === 0) {
                localStorage.clear();
                LockscreenComponent_1.resetApp();
            }
        }
    }
    logout() {
        if (this.clearContacts) {
            localStorage.clear();
        }
        else {
            const arr = [];
            for (let i = 0; i < localStorage.length; i++) {
                if (localStorage.key(i) !== 'simpleos.contacts.' + this.network.activeChain['id']) {
                    arr.push(localStorage.key(i));
                }
            }
            arr.forEach((k) => {
                localStorage.removeItem(k);
            });
        }
        LockscreenComponent_1.resetApp();
    }
};
LockscreenComponent = LockscreenComponent_1 = __decorate([
    (0, core_1.Component)({
        selector: 'app-lockscreen',
        templateUrl: './lockscreen.component.html',
        styleUrls: ['./lockscreen.component.css']
    }),
    __metadata("design:paramtypes", [crypto_service_1.CryptoService,
        router_1.Router,
        network_service_1.NetworkService,
        accounts_service_1.AccountsService,
        app_component_1.AppComponent])
], LockscreenComponent);
exports.LockscreenComponent = LockscreenComponent;
//# sourceMappingURL=lockscreen.component.js.map