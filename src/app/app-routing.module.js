"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var core_1 = require("@angular/core");
var router_1 = require("@angular/router");
var landing_component_1 = require("./landing/landing.component");
var dashboard_component_1 = require("./dashboard/dashboard.component");
var wallet_component_1 = require("./dashboard/wallet/wallet.component");
var history_component_1 = require("./dashboard/history/history.component");
var vote_component_1 = require("./dashboard/vote/vote.component");
var send_component_1 = require("./dashboard/send/send.component");
var config_component_1 = require("./dashboard/settings/config.component");
var about_component_1 = require("./dashboard/about/about.component");
var lockscreen_component_1 = require("./lockscreen/lockscreen.component");
var lock_guard_1 = require("./lock.guard");
var resources_component_1 = require("./dashboard/acc_resources/resources.component");
var dapp_component_1 = require("./dashboard/dapp/dapp.component");
var routes = [
    {
        path: '',
        component: lockscreen_component_1.LockscreenComponent
    },
    {
        path: 'landing',
        component: landing_component_1.LandingComponent,
        canActivate: [lock_guard_1.LockGuard]
    },
    {
        path: 'dashboard',
        component: dashboard_component_1.DashboardComponent,
        canActivate: [lock_guard_1.LockGuard],
        children: [
            {
                path: 'wallet',
                component: wallet_component_1.WalletComponent,
            },
            {
                path: 'send',
                component: send_component_1.SendComponent,
            },
            {
                path: 'history',
                component: history_component_1.HistoryComponent,
            },
            {
                path: 'vote',
                component: vote_component_1.VoteComponent,
            },
            {
                path: 'config',
                component: config_component_1.ConfigComponent,
            },
            {
                path: 'ram',
                component: resources_component_1.ResourcesComponent,
            },
            {
                path: 'dapp',
                component: dapp_component_1.DappComponent,
            },
            {
                path: 'about',
                component: about_component_1.AboutComponent,
            }
        ]
    }
];
var AppRoutingModule = /** @class */ (function () {
    function AppRoutingModule() {
    }
    AppRoutingModule = __decorate([
        core_1.NgModule({
            imports: [router_1.RouterModule.forRoot(routes, { useHash: true })],
            exports: [router_1.RouterModule]
        })
    ], AppRoutingModule);
    return AppRoutingModule;
}());
exports.AppRoutingModule = AppRoutingModule;
//# sourceMappingURL=app-routing.module.js.map