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
var network_service_1 = require("./network.service");
var ledger_service_1 = require("./services/ledger.service");
var AppComponent = /** @class */ (function () {
    function AppComponent(network, ledger) {
        this.network = network;
        this.ledger = ledger;
        this.update = false;
    }
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
    AppComponent.prototype.ngOnInit = function () {
        // if (window['ipcRenderer']) {
        //   this.ipc = window['ipcRenderer'];
        //   this.ipc.on('update_ready', (event, data) => {
        //     this.update = data;
        //   });
        //   setTimeout(() => {
        //     this.checkUpdate();
        //   }, 5000);
        // }
        this.network.connect();
    };
    AppComponent = __decorate([
        core_1.Component({
            selector: 'app-root',
            templateUrl: './app.component.html',
            styleUrls: ['./app.component.css']
        }),
        __metadata("design:paramtypes", [network_service_1.NetworkService, ledger_service_1.LedgerService])
    ], AppComponent);
    return AppComponent;
}());
exports.AppComponent = AppComponent;
//# sourceMappingURL=app.component.js.map