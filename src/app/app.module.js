"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var platform_browser_1 = require("@angular/platform-browser");
var core_1 = require("@angular/core");
var app_component_1 = require("./app.component");
var angular_1 = require("@clr/angular");
var animations_1 = require("@angular/platform-browser/animations");
var landing_component_1 = require("./landing/landing.component");
var eosjs_service_1 = require("./eosjs.service");
var dashboard_component_1 = require("./dashboard/dashboard.component");
var app_routing_module_1 = require("./app-routing.module");
var fontawesome_svg_core_1 = require("@fortawesome/fontawesome-svg-core");
var pro_regular_svg_icons_1 = require("@fortawesome/pro-regular-svg-icons");
var pro_solid_svg_icons_1 = require("@fortawesome/pro-solid-svg-icons");
var free_brands_svg_icons_1 = require("@fortawesome/free-brands-svg-icons");
var pro_light_svg_icons_1 = require("@fortawesome/pro-light-svg-icons");
var wallet_component_1 = require("./dashboard/wallet/wallet.component");
var history_component_1 = require("./dashboard/history/history.component");
var vote_component_1 = require("./dashboard/vote/vote.component");
var send_component_1 = require("./dashboard/send/send.component");
var material_1 = require("@angular/material");
var forms_1 = require("@angular/forms");
var table_1 = require("primeng/table");
var ng_lottie_1 = require("ng-lottie");
var config_component_1 = require("./dashboard/settings/config.component");
var http_1 = require("@angular/common/http");
var primeng_1 = require("primeng/primeng");
var about_component_1 = require("./dashboard/about/about.component");
var angular2_text_mask_1 = require("angular2-text-mask");
var angular2_toaster_1 = require("angular2-toaster");
var accounts_service_1 = require("./accounts.service");
var network_service_1 = require("./network.service");
var crypto_service_1 = require("./services/crypto.service");
var angular_fontawesome_1 = require("@fortawesome/angular-fontawesome");
var lockscreen_component_1 = require("./lockscreen/lockscreen.component");
var resources_component_1 = require("./dashboard/acc_resources/resources.component");
var ngx_echarts_1 = require("ngx-echarts");
var ram_service_1 = require("./services/ram.service");
var ledger_service_1 = require("./services/ledger.service");
fontawesome_svg_core_1.library.add(pro_regular_svg_icons_1.far, pro_solid_svg_icons_1.fas, free_brands_svg_icons_1.fab, pro_light_svg_icons_1.fal);
var AppModule = /** @class */ (function () {
    function AppModule() {
    }
    AppModule = __decorate([
        core_1.NgModule({
            declarations: [
                app_component_1.AppComponent,
                landing_component_1.LandingComponent,
                dashboard_component_1.DashboardComponent,
                send_component_1.SendComponent,
                wallet_component_1.WalletComponent,
                history_component_1.HistoryComponent,
                vote_component_1.VoteComponent,
                config_component_1.ConfigComponent,
                about_component_1.AboutComponent,
                lockscreen_component_1.LockscreenComponent,
                resources_component_1.ResourcesComponent
            ],
            imports: [
                primeng_1.AccordionModule,
                animations_1.BrowserAnimationsModule,
                platform_browser_1.BrowserModule,
                angular_1.ClarityModule,
                angular_fontawesome_1.FontAwesomeModule,
                forms_1.FormsModule,
                http_1.HttpClientModule,
                ng_lottie_1.LottieAnimationViewModule.forRoot(),
                material_1.MatAutocompleteModule,
                material_1.MatCheckboxModule,
                material_1.MatFormFieldModule,
                material_1.MatInputModule,
                material_1.MatRadioModule,
                material_1.MatSelectModule,
                material_1.MatSliderModule,
                material_1.MatTabsModule,
                ngx_echarts_1.NgxEchartsModule,
                forms_1.ReactiveFormsModule,
                table_1.TableModule,
                angular2_text_mask_1.TextMaskModule,
                angular2_toaster_1.ToasterModule.forRoot(),
                primeng_1.TooltipModule,
                app_routing_module_1.AppRoutingModule
            ],
            providers: [eosjs_service_1.EOSJSService, accounts_service_1.AccountsService, network_service_1.NetworkService, crypto_service_1.CryptoService, ram_service_1.RamService, ledger_service_1.LedgerService],
            bootstrap: [app_component_1.AppComponent]
        })
    ], AppModule);
    return AppModule;
}());
exports.AppModule = AppModule;
//# sourceMappingURL=app.module.js.map