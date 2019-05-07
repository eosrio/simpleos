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
var angular_1 = require("@clr/angular");
var router_1 = require("@angular/router");
var environment_1 = require("../environments/environment");
var network_service_1 = require("./services/network.service");
var accounts_service_1 = require("./services/accounts.service");
var eosjs_service_1 = require("./services/eosjs.service");
var crypto_service_1 = require("./services/crypto.service");
var connect_service_1 = require("./services/connect.service");
var backup_service_1 = require("./services/backup.service");
var AppComponent = /** @class */ (function () {
    function AppComponent(network, 
    // public ledger: LedgerHWService,
    aService, eos, crypto, connect, router, autobackup) {
        this.network = network;
        this.aService = aService;
        this.eos = eos;
        this.crypto = crypto;
        this.connect = connect;
        this.router = router;
        this.autobackup = autobackup;
        this.showAll = false;
        this.agreeConstitution = false;
        this.version = environment_1.environment.VERSION;
        // countdown 30 seconds to automatic backup
        this.autobackup.startTimeout();
        this.accSlots = [];
        this.selectedSlot = null;
        this.selectedSlotIndex = null;
        this.update = false;
        this.aService.versionSys = this.version;
        this.ledgerOpen = false;
        // this.ledger.ledgerStatus.asObservable().subscribe((status) => {
        //   if (this.aService.hasAnyLedgerAccount === false) {
        //     this.ledgerOpen = status;
        //   }
        // });
        // this.ledger.openPanel.subscribe((event) => {
        // 	if (event === 'open') {
        // 		this.ledgerOpen = true;
        // 	}
        // });
        this.busy = false;
    }
    // scanPublicKeys() {
    // 	if (this.ledgerOpen) {
    // 		this.busy = true;
    // 		this.ledger.readPublicKeys(8).then((ledger_slots: LedgerSlot[]) => {
    // 			this.accSlots = ledger_slots;
    // 			this.busy = false;
    // 			console.log(this.accSlots);
    // 		});
    // 	}
    // }
    AppComponent.prototype.selectSlot = function (slot, index) {
        this.selectedSlot = slot;
        this.selectedSlotIndex = index;
        this.ledgerwizard.next();
        console.log(this.selectedSlot);
    };
    AppComponent.prototype.importLedgerAccount = function () {
        var _this = this;
        this.eos.loadPublicKey(this.selectedSlot.publicKey).then(function (data) {
            console.log(data);
            _this.crypto.storeLedgerAccount(data.publicKey, _this.selectedSlotIndex).then(function () {
                _this.aService.appendNewAccount(data.foundAccounts[0]);
                setTimeout(function () {
                    _this.router.navigate(['dashboard', 'vote']).catch(function (err) {
                        console.log(err);
                    });
                }, 1000);
            });
        });
    };
    // checkUpdate() {
    //   this.ipc['send']('checkUpdate', null);
    // }
    // performUpdate() {
    //   // this.ipc['send']('startUpdate', null);
    //   window['shell'].openExternal('https://eosrio.io/simpleos/');
    // }
    //
    // openGithub() {
    //   window['shell'].openExternal('https://github.com/eosrio/simpleos/releases/latest');
    // }
    AppComponent.prototype.ngAfterViewInit = function () {
        var _this = this;
        setTimeout(function () {
            _this.network.connect(false);
        }, 888);
    };
    __decorate([
        core_1.ViewChild('ledgerwizard'),
        __metadata("design:type", angular_1.ClrWizard)
    ], AppComponent.prototype, "ledgerwizard", void 0);
    AppComponent = __decorate([
        core_1.Component({
            selector: 'app-root',
            templateUrl: './app.component.html',
            styleUrls: ['./app.component.css']
        }),
        __metadata("design:paramtypes", [network_service_1.NetworkService,
            accounts_service_1.AccountsService,
            eosjs_service_1.EOSJSService,
            crypto_service_1.CryptoService,
            connect_service_1.ConnectService,
            router_1.Router,
            backup_service_1.BackupService])
    ], AppComponent);
    return AppComponent;
}());
exports.AppComponent = AppComponent;
//# sourceMappingURL=app.component.js.map