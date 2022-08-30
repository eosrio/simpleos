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
exports.AppModule = exports.playerFactory = void 0;
const core_1 = require("@angular/core");
const forms_1 = require("@angular/forms");
const animations_1 = require("@angular/platform-browser/animations");
const platform_browser_1 = require("@angular/platform-browser");
const http_1 = require("@angular/common/http");
const flex_layout_1 = require("@angular/flex-layout");
const a11y_1 = require("@angular/cdk/a11y");
const app_component_1 = require("./app.component");
const landing_component_1 = require("./landing/landing.component");
const config_component_1 = require("./dashboard/settings/config.component");
const dashboard_component_1 = require("./dashboard/dashboard.component");
const send_component_1 = require("./dashboard/send/send.component");
const wallet_component_1 = require("./dashboard/wallet/wallet.component");
const custom_chain_modal_component_1 = require("./custom-chain-modal/custom-chain-modal.component");
const vote_component_1 = require("./dashboard/vote/vote.component");
const lockscreen_component_1 = require("./lockscreen/lockscreen.component");
const resources_component_1 = require("./dashboard/acc_resources/resources.component");
const rex_component_1 = require("./dashboard/rex/rex.component");
const thousand_suffixes_pipe_1 = require("./dashboard/rex/thousand-suffixes.pipe");
const dapp_component_1 = require("./dashboard/dapp/dapp.component");
const account_home_component_1 = require("./dashboard/account-home/account-home.component");
const input_modal_component_1 = require("./input-modal/input-modal.component");
const import_modal_component_1 = require("./import-modal/import-modal.component");
const keygen_modal_component_1 = require("./keygen-modal/keygen-modal.component");
const safe_pipe_1 = require("./services/safe.pipe");
const confirm_modal_component_1 = require("./confirm-modal/confirm-modal.component");
const about_component_1 = require("./dashboard/about/about.component");
const app_routing_module_1 = require("./app-routing.module");
const accordion_1 = require("primeng/accordion");
const table_1 = require("primeng/table");
const tooltip_1 = require("primeng/tooltip");
const paginator_1 = require("primeng/paginator");
const angular_1 = require("@clr/angular");
const autocomplete_1 = require("@angular/material/autocomplete");
const progress_bar_1 = require("@angular/material/progress-bar");
const form_field_1 = require("@angular/material/form-field");
const checkbox_1 = require("@angular/material/checkbox");
const input_1 = require("@angular/material/input");
const radio_1 = require("@angular/material/radio");
const card_1 = require("@angular/material/card");
const list_1 = require("@angular/material/list");
const select_1 = require("@angular/material/select");
const slider_1 = require("@angular/material/slider");
const tabs_1 = require("@angular/material/tabs");
const button_toggle_1 = require("@angular/material/button-toggle");
const datepicker_1 = require("@angular/material/datepicker");
const slide_toggle_1 = require("@angular/material/slide-toggle");
const tree_1 = require("@angular/material/tree");
const tooltip_2 = require("@angular/material/tooltip");
const expansion_1 = require("@angular/material/expansion");
const chips_1 = require("@angular/material/chips");
// import {MaterialDesignFrameworkModule} from "@ajsf/material";
const ngx_echarts_1 = require("ngx-echarts");
const echarts = require("echarts");
const ngx_toastr_1 = require("ngx-toastr");
const ngx_mask_1 = require("ngx-mask");
// import {TextMaskModule} from "angular2-text-mask";
// import {ToasterModule} from "angular2-toaster";
const ngx_json_viewer_1 = require("ngx-json-viewer");
const ngx_order_pipe_1 = require("ngx-order-pipe");
const ngx_pagination_1 = require("ngx-pagination");
// TODO: cleanup usage
// import {NgxElectronModule} from 'ngx-electron';
const angularx_qrcode_1 = require("angularx-qrcode");
// Lottie
const ngx_lottie_1 = require("ngx-lottie");
const lottie_web_1 = require("lottie-web");
/* SERVICES */
const eosjs2_service_1 = require("./services/eosio/eosjs2.service");
const chain_service_1 = require("./services/chain.service");
const accounts_service_1 = require("./services/accounts.service");
const network_service_1 = require("./services/network.service");
const crypto_service_1 = require("./services/crypto/crypto.service");
const ram_service_1 = require("./services/ram.service");
const ledger_service_1 = require("./services/ledger/ledger.service");
const connect_service_1 = require("./services/connect.service");
const backup_service_1 = require("./services/backup.service");
const theme_service_1 = require("./services/theme.service");
const notification_service_1 = require("./services/notification.service");
// FontAwesome Imports
const angular_fontawesome_1 = require("@fortawesome/angular-fontawesome");
// FAS - Solid Pro
const faHeart_1 = require("@fortawesome/pro-solid-svg-icons/faHeart");
const faTh_1 = require("@fortawesome/pro-solid-svg-icons/faTh");
const faCaretDown_1 = require("@fortawesome/pro-solid-svg-icons/faCaretDown");
const faSkullCrossbones_1 = require("@fortawesome/pro-solid-svg-icons/faSkullCrossbones");
const faKey_1 = require("@fortawesome/pro-solid-svg-icons/faKey");
const faExclamationTriangle_1 = require("@fortawesome/pro-solid-svg-icons/faExclamationTriangle");
const faGlobe_1 = require("@fortawesome/pro-solid-svg-icons/faGlobe");
const faLightbulbOn_1 = require("@fortawesome/pro-solid-svg-icons/faLightbulbOn");
// FAL - Light Pro
const faArrowAltToBottom_1 = require("@fortawesome/pro-light-svg-icons/faArrowAltToBottom");
const faChevronCircleUp_1 = require("@fortawesome/pro-light-svg-icons/faChevronCircleUp");
const faChevronCircleDown_1 = require("@fortawesome/pro-light-svg-icons/faChevronCircleDown");
const faCog_1 = require("@fortawesome/pro-light-svg-icons/faCog");
const faSearchMinus_1 = require("@fortawesome/pro-light-svg-icons/faSearchMinus");
const faSearchPlus_1 = require("@fortawesome/pro-light-svg-icons/faSearchPlus");
// FAB - Brands Free
const faTelegramPlane_1 = require("@fortawesome/free-brands-svg-icons/faTelegramPlane");
const faTwitter_1 = require("@fortawesome/free-brands-svg-icons/faTwitter");
const faGithub_1 = require("@fortawesome/free-brands-svg-icons/faGithub");
const faYoutube_1 = require("@fortawesome/free-brands-svg-icons/faYoutube");
const faFacebook_1 = require("@fortawesome/free-brands-svg-icons/faFacebook");
const faReddit_1 = require("@fortawesome/free-brands-svg-icons/faReddit");
const faKeybase_1 = require("@fortawesome/free-brands-svg-icons/faKeybase");
const faWeixin_1 = require("@fortawesome/free-brands-svg-icons/faWeixin");
// FAR - Regular Pro
const faSignOutAlt_1 = require("@fortawesome/pro-regular-svg-icons/faSignOutAlt");
const faExclamationCircle_1 = require("@fortawesome/pro-regular-svg-icons/faExclamationCircle");
const faUndo_1 = require("@fortawesome/pro-regular-svg-icons/faUndo");
const faQuestionCircle_1 = require("@fortawesome/pro-regular-svg-icons/faQuestionCircle");
const faSpinner_1 = require("@fortawesome/pro-regular-svg-icons/faSpinner");
const faExchangeAlt_1 = require("@fortawesome/pro-regular-svg-icons/faExchangeAlt");
const faDonate_1 = require("@fortawesome/pro-regular-svg-icons/faDonate");
const faUndoAlt_1 = require("@fortawesome/pro-regular-svg-icons/faUndoAlt");
const faHandHoldingUsd_1 = require("@fortawesome/pro-regular-svg-icons/faHandHoldingUsd");
const faUser_1 = require("@fortawesome/pro-regular-svg-icons/faUser");
const faReceipt_1 = require("@fortawesome/pro-regular-svg-icons/faReceipt");
const faEdit_1 = require("@fortawesome/pro-regular-svg-icons/faEdit");
const faLock_1 = require("@fortawesome/pro-regular-svg-icons/faLock");
const faLockOpen_1 = require("@fortawesome/pro-regular-svg-icons/faLockOpen");
const faParachuteBox_1 = require("@fortawesome/pro-regular-svg-icons/faParachuteBox");
const faCheck_1 = require("@fortawesome/pro-regular-svg-icons/faCheck");
const faHourglass_1 = require("@fortawesome/pro-regular-svg-icons/faHourglass");
const faEye_1 = require("@fortawesome/pro-regular-svg-icons/faEye");
const faEyeSlash_1 = require("@fortawesome/pro-regular-svg-icons/faEyeSlash");
const faClone_1 = require("@fortawesome/pro-regular-svg-icons/faClone");
const faHistory_1 = require("@fortawesome/pro-regular-svg-icons/faHistory");
const faPaperPlane_1 = require("@fortawesome/pro-regular-svg-icons/faPaperPlane");
const faMemory_1 = require("@fortawesome/pro-regular-svg-icons/faMemory");
const faPuzzlePiece_1 = require("@fortawesome/pro-regular-svg-icons/faPuzzlePiece");
const faBoxBallot_1 = require("@fortawesome/pro-regular-svg-icons/faBoxBallot");
const faUserMinus_1 = require("@fortawesome/pro-regular-svg-icons/faUserMinus");
const faAngleRight_1 = require("@fortawesome/pro-regular-svg-icons/faAngleRight");
const faTimes_1 = require("@fortawesome/pro-regular-svg-icons/faTimes");
const faLongArrowAltDown_1 = require("@fortawesome/pro-regular-svg-icons/faLongArrowAltDown");
const faSearch_1 = require("@fortawesome/pro-regular-svg-icons/faSearch");
const faSync_1 = require("@fortawesome/pro-regular-svg-icons/faSync");
const faPencil_1 = require("@fortawesome/pro-regular-svg-icons/faPencil");
const faPlus_1 = require("@fortawesome/pro-regular-svg-icons/faPlus");
const faMinus_1 = require("@fortawesome/pro-regular-svg-icons/faMinus");
const faTimesCircle_1 = require("@fortawesome/pro-regular-svg-icons/faTimesCircle");
const faUserPlus_1 = require("@fortawesome/pro-regular-svg-icons/faUserPlus");
const faUserEdit_1 = require("@fortawesome/pro-regular-svg-icons/faUserEdit");
const faExternalLink_1 = require("@fortawesome/pro-regular-svg-icons/faExternalLink");
const faTrashAlt_1 = require("@fortawesome/pro-regular-svg-icons/faTrashAlt");
const faBellOn_1 = require("@fortawesome/pro-regular-svg-icons/faBellOn");
const core_2 = require("@ngx-formly/core");
const material_1 = require("@ngx-formly/material");
const object_type_component_1 = require("./type/object-type/object-type.component");
const array_type_component_1 = require("./type/array-type/array-type.component");
function playerFactory() {
    return lottie_web_1.default;
}
exports.playerFactory = playerFactory;
let AppModule = class AppModule {
    constructor(library) {
        const icons = [];
        // fas solid
        icons.push(...[
            faHeart_1.faHeart,
            faTh_1.faTh,
            faCaretDown_1.faCaretDown,
            faSkullCrossbones_1.faSkullCrossbones,
            faKey_1.faKey,
            faExclamationTriangle_1.faExclamationTriangle,
            faTimesCircle_1.faTimesCircle,
            faGlobe_1.faGlobe,
            faSpinner_1.faSpinner,
            faLightbulbOn_1.faLightbulbOn
        ]);
        // fab brands
        icons.push(...[
            faTelegramPlane_1.faTelegramPlane,
            faTwitter_1.faTwitter,
            faGithub_1.faGithub,
            faYoutube_1.faYoutube,
            faFacebook_1.faFacebook,
            faReddit_1.faReddit,
            faKeybase_1.faKeybase,
            faWeixin_1.faWeixin
        ]);
        // far regular
        icons.push(...[
            faSignOutAlt_1.faSignOutAlt,
            faExclamationCircle_1.faExclamationCircle,
            faUndo_1.faUndo,
            faQuestionCircle_1.faQuestionCircle,
            faSpinner_1.faSpinner,
            faExchangeAlt_1.faExchangeAlt,
            faDonate_1.faDonate,
            faUndoAlt_1.faUndoAlt,
            faHandHoldingUsd_1.faHandHoldingUsd,
            faUser_1.faUser,
            faReceipt_1.faReceipt,
            faEdit_1.faEdit,
            faLock_1.faLock,
            faLockOpen_1.faLockOpen,
            faParachuteBox_1.faParachuteBox,
            faCheck_1.faCheck,
            faHourglass_1.faHourglass,
            faEye_1.faEye,
            faEyeSlash_1.faEyeSlash,
            faClone_1.faClone,
            faHistory_1.faHistory,
            faPaperPlane_1.faPaperPlane,
            faMemory_1.faMemory,
            faPuzzlePiece_1.faPuzzlePiece,
            faBoxBallot_1.faBoxBallot,
            faUserMinus_1.faUserMinus,
            faAngleRight_1.faAngleRight,
            faTimes_1.faTimes,
            faLongArrowAltDown_1.faLongArrowAltDown,
            faSearch_1.faSearch,
            faSync_1.faSync,
            faPencil_1.faPencil,
            faMinus_1.faMinus,
            faPlus_1.faPlus,
            faTimesCircle_1.faTimesCircle,
            faUserPlus_1.faUserPlus,
            faUserEdit_1.faUserEdit,
            faPaperPlane_1.faPaperPlane,
            faExternalLink_1.faExternalLink,
            faTrashAlt_1.faTrashAlt,
            faBellOn_1.faBellOn,
        ]);
        // fal light
        icons.push(...[
            faPaperPlane_1.faPaperPlane,
            faArrowAltToBottom_1.faArrowAltToBottom,
            faChevronCircleUp_1.faChevronCircleUp,
            faChevronCircleDown_1.faChevronCircleDown,
            faCog_1.faCog,
            faSearchMinus_1.faSearchMinus,
            faSearchPlus_1.faSearchPlus
        ]);
        icons.forEach((iconDef) => {
            library.addIcons(iconDef);
        });
    }
};
AppModule = __decorate([
    (0, core_1.NgModule)({
        declarations: [
            app_component_1.AppComponent,
            landing_component_1.LandingComponent,
            dashboard_component_1.DashboardComponent,
            send_component_1.SendComponent,
            wallet_component_1.WalletComponent,
            vote_component_1.VoteComponent,
            config_component_1.ConfigComponent,
            about_component_1.AboutComponent,
            lockscreen_component_1.LockscreenComponent,
            resources_component_1.ResourcesComponent,
            dapp_component_1.DappComponent,
            rex_component_1.RexComponent,
            thousand_suffixes_pipe_1.ThousandSuffixesPipe,
            confirm_modal_component_1.ConfirmModalComponent,
            input_modal_component_1.InputModalComponent,
            import_modal_component_1.ImportModalComponent,
            keygen_modal_component_1.KeygenModalComponent,
            custom_chain_modal_component_1.CustomChainModalComponent,
            safe_pipe_1.SafePipe,
            object_type_component_1.ObjectTypeComponent,
            array_type_component_1.ArrayTypeComponent,
            account_home_component_1.AccountHomeComponent,
        ],
        imports: [
            forms_1.FormsModule,
            accordion_1.AccordionModule,
            table_1.TableModule,
            tooltip_1.TooltipModule,
            animations_1.BrowserAnimationsModule,
            platform_browser_1.BrowserModule,
            angular_1.ClarityModule,
            angular_fontawesome_1.FontAwesomeModule,
            core_2.FormlyModule.forRoot({
                types: [
                    { name: 'string', extends: 'input' },
                    {
                        name: 'number',
                        extends: 'input',
                        defaultOptions: {
                            templateOptions: {
                                type: 'number',
                            },
                        },
                    },
                    {
                        name: 'integer',
                        extends: 'input',
                        defaultOptions: {
                            templateOptions: {
                                type: 'number',
                            },
                        },
                    },
                    { name: 'boolean', extends: 'checkbox' },
                    { name: 'array', component: array_type_component_1.ArrayTypeComponent },
                    { name: 'object', component: object_type_component_1.ObjectTypeComponent },
                ]
            }),
            material_1.FormlyMaterialModule,
            http_1.HttpClientModule,
            autocomplete_1.MatAutocompleteModule,
            card_1.MatCardModule,
            checkbox_1.MatCheckboxModule,
            chips_1.MatChipsModule,
            form_field_1.MatFormFieldModule,
            input_1.MatInputModule,
            list_1.MatListModule,
            radio_1.MatRadioModule,
            select_1.MatSelectModule,
            slider_1.MatSliderModule,
            progress_bar_1.MatProgressBarModule,
            tabs_1.MatTabsModule,
            button_toggle_1.MatButtonToggleModule,
            datepicker_1.MatDatepickerModule,
            slide_toggle_1.MatSlideToggleModule,
            tree_1.MatTreeModule,
            expansion_1.MatExpansionModule,
            forms_1.ReactiveFormsModule,
            ngx_mask_1.NgxMaskModule.forRoot(),
            ngx_echarts_1.NgxEchartsModule.forRoot({ echarts }),
            ngx_toastr_1.ToastrModule.forRoot(),
            app_routing_module_1.AppRoutingModule,
            ngx_json_viewer_1.NgxJsonViewerModule,
            ngx_order_pipe_1.OrderModule,
            ngx_pagination_1.NgxPaginationModule,
            // NgxElectronModule,
            input_1.MatInputModule,
            ngx_lottie_1.LottieModule.forRoot({
                player: playerFactory
            }),
            flex_layout_1.FlexLayoutModule,
            tooltip_2.MatTooltipModule,
            paginator_1.PaginatorModule,
            a11y_1.A11yModule,
            angularx_qrcode_1.QRCodeModule
        ],
        providers: [
            eosjs2_service_1.Eosjs2Service,
            chain_service_1.ChainService,
            accounts_service_1.AccountsService,
            network_service_1.NetworkService,
            crypto_service_1.CryptoService,
            ram_service_1.RamService,
            ledger_service_1.LedgerService,
            connect_service_1.ConnectService,
            backup_service_1.BackupService,
            theme_service_1.ThemeService,
            notification_service_1.NotificationService,
        ],
        bootstrap: [app_component_1.AppComponent],
    }),
    __metadata("design:paramtypes", [angular_fontawesome_1.FaIconLibrary])
], AppModule);
exports.AppModule = AppModule;
//# sourceMappingURL=app.module.js.map