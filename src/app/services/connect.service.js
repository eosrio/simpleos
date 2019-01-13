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
var ConnectService = /** @class */ (function () {
    function ConnectService() {
        console.log('Loading simpleos-connect service');
        this.socket = socketIo('http://localhost:5555/');
        this.socket.on('connection', function (socket) {
            socket.on('message', function () {
            });
            socket.on('disconnect', function () {
            });
        });
    }
    ConnectService = __decorate([
        core_1.Injectable({
            providedIn: 'root'
        }),
        __metadata("design:paramtypes", [])
    ], ConnectService);
    return ConnectService;
}());
exports.ConnectService = ConnectService;
//# sourceMappingURL=connect.service.js.map