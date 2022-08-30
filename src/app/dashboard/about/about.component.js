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
exports.AboutComponent = void 0;
const core_1 = require("@angular/core");
const accounts_service_1 = require("../../services/accounts.service");
const app_component_1 = require("../../app.component");
const theme_service_1 = require("../../services/theme.service");
let AboutComponent = class AboutComponent {
    constructor(aService, app, theme) {
        this.aService = aService;
        this.app = app;
        this.theme = theme;
    }
    ngOnInit() {
    }
    extOpen(value) {
        window['shell'].openExternal(value).catch(console.log);
    }
};
AboutComponent = __decorate([
    (0, core_1.Component)({
        selector: 'app-about',
        templateUrl: './about.component.html',
        styleUrls: ['./about.component.css']
    }),
    __metadata("design:paramtypes", [accounts_service_1.AccountsService, app_component_1.AppComponent, theme_service_1.ThemeService])
], AboutComponent);
exports.AboutComponent = AboutComponent;
//# sourceMappingURL=about.component.js.map