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
var HistoryComponent = /** @class */ (function () {
    function HistoryComponent() {
        this.history = [
            { type: 'sent', amount: '5', user: '', date: '1 minute ago', id: '1' },
            { type: 'received', amount: '5', user: '', date: '1 minute ago', id: '2' },
            { type: 'unstaked', amount: '5', user: '', date: '1 minute ago', id: '3' },
            { type: 'staked', amount: '5', user: '', date: '1 minute ago', id: '4' },
            { type: 'sent', amount: '5', user: '', date: '1 minute ago', id: '5' },
            { type: 'received', amount: '5', user: '', date: '1 minute ago', id: '6' },
            { type: 'received', amount: '5', user: '', date: '1 minute ago', id: '7' },
            { type: 'received', amount: '5', user: '', date: '1 minute ago', id: '8' },
            { type: 'received', amount: '5', user: '', date: '1 minute ago', id: '9' },
            { type: 'sent', amount: '5', user: '', date: '1 minute ago', id: '10' },
            { type: 'sent', amount: '5', user: '', date: '1 minute ago', id: '11' }
        ];
    }
    HistoryComponent.prototype.ngOnInit = function () {
    };
    HistoryComponent = __decorate([
        core_1.Component({
            selector: 'app-history',
            templateUrl: './history.component.html',
            styleUrls: ['./history.component.css']
        }),
        __metadata("design:paramtypes", [])
    ], HistoryComponent);
    return HistoryComponent;
}());
exports.HistoryComponent = HistoryComponent;
//# sourceMappingURL=history.component.js.map