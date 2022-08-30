"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppRoutingModule = void 0;
const core_1 = require("@angular/core");
const router_1 = require("@angular/router");
const landing_component_1 = require("./landing/landing.component");
const dashboard_component_1 = require("./dashboard/dashboard.component");
const wallet_component_1 = require("./dashboard/wallet/wallet.component");
const vote_component_1 = require("./dashboard/vote/vote.component");
const send_component_1 = require("./dashboard/send/send.component");
const config_component_1 = require("./dashboard/settings/config.component");
const about_component_1 = require("./dashboard/about/about.component");
const lockscreen_component_1 = require("./lockscreen/lockscreen.component");
const lock_guard_1 = require("./guards/lock.guard");
const resources_component_1 = require("./dashboard/acc_resources/resources.component");
const dapp_component_1 = require("./dashboard/dapp/dapp.component");
const rex_component_1 = require("./dashboard/rex/rex.component");
const account_home_component_1 = require("./dashboard/account-home/account-home.component");
const routes = [
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
                path: 'home',
                component: account_home_component_1.AccountHomeComponent
            },
            {
                path: 'wallet',
                component: wallet_component_1.WalletComponent,
            },
            {
                path: 'send',
                component: send_component_1.SendComponent,
            },
            {
                path: 'vote',
                component: vote_component_1.VoteComponent,
            },
            {
                path: 'rex',
                component: rex_component_1.RexComponent,
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
let AppRoutingModule = class AppRoutingModule {
};
AppRoutingModule = __decorate([
    (0, core_1.NgModule)({
        imports: [router_1.RouterModule.forRoot(routes, { useHash: true })],
        exports: [router_1.RouterModule]
    })
], AppRoutingModule);
exports.AppRoutingModule = AppRoutingModule;
//# sourceMappingURL=app-routing.module.js.map