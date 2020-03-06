// Angular core modules
import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {HTTP_INTERCEPTORS, HttpClientModule} from '@angular/common/http';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';

// Electron Bindings
import {NgxElectronModule} from 'ngx-electron';

// Main Router
import {AppRoutingModule} from './app-routing.module';

// Vmware Clarity Framework
import {ClarityModule} from '@clr/angular';

// Other Modules
import {TextMaskModule} from 'angular2-text-mask';
import {ToasterModule} from 'angular2-toaster';
import {NgxEchartsModule} from 'ngx-echarts';
import {NgxJsonViewerModule} from 'ngx-json-viewer';
import {OrderModule} from 'ngx-order-pipe';
import {NgxPaginationModule} from 'ngx-pagination';

// Fusejs - fuzzy search
import {FuseJsModule} from './modules/fusejs/fusejs.module';
import {MarkdownModule} from 'ngx-markdown';

// FontAwesome Imports
import {FaIconLibrary, FontAwesomeModule} from '@fortawesome/angular-fontawesome';

// FAS
import {faHeart} from '@fortawesome/pro-solid-svg-icons/faHeart';
import {faTh} from '@fortawesome/pro-solid-svg-icons/faTh';
import {faCaretDown} from '@fortawesome/pro-solid-svg-icons/faCaretDown';
import {faSkullCrossbones} from '@fortawesome/pro-solid-svg-icons/faSkullCrossbones';
import {faKey} from '@fortawesome/pro-solid-svg-icons/faKey';
import {faExclamationTriangle} from '@fortawesome/pro-solid-svg-icons/faExclamationTriangle';
import {faGlobe} from '@fortawesome/pro-solid-svg-icons/faGlobe';

// FAL - Light Pro
import {faArrowAltToBottom} from '@fortawesome/pro-light-svg-icons/faArrowAltToBottom';
import {faChevronCircleUp} from '@fortawesome/pro-light-svg-icons/faChevronCircleUp';
import {faChevronCircleDown} from '@fortawesome/pro-light-svg-icons/faChevronCircleDown';
import {faCog} from '@fortawesome/pro-light-svg-icons/faCog';
import {faSearchMinus} from '@fortawesome/pro-light-svg-icons/faSearchMinus';
import {faSearchPlus} from '@fortawesome/pro-light-svg-icons/faSearchPlus';

// FAB - Brands Free
import {faTelegramPlane} from '@fortawesome/free-brands-svg-icons/faTelegramPlane';
import {faTwitter} from '@fortawesome/free-brands-svg-icons/faTwitter';
import {faGithub} from '@fortawesome/free-brands-svg-icons/faGithub';
import {faYoutube} from '@fortawesome/free-brands-svg-icons/faYoutube';
import {faFacebook} from '@fortawesome/free-brands-svg-icons/faFacebook';
import {faReddit} from '@fortawesome/free-brands-svg-icons/faReddit';
import {faKeybase} from '@fortawesome/free-brands-svg-icons/faKeybase';
import {faWeixin} from '@fortawesome/free-brands-svg-icons/faWeixin';
// FAR - Regular Pro
import {faSignOutAlt} from '@fortawesome/pro-regular-svg-icons/faSignOutAlt';
import {faExclamationCircle} from '@fortawesome/pro-regular-svg-icons/faExclamationCircle';
import {faUndo} from '@fortawesome/pro-regular-svg-icons/faUndo';
import {faQuestionCircle} from '@fortawesome/pro-regular-svg-icons/faQuestionCircle';
import {faSpinner} from '@fortawesome/pro-regular-svg-icons/faSpinner';
import {faExchangeAlt} from '@fortawesome/pro-regular-svg-icons/faExchangeAlt';
import {faDonate} from '@fortawesome/pro-regular-svg-icons/faDonate';
import {faUndoAlt} from '@fortawesome/pro-regular-svg-icons/faUndoAlt';
import {faHandHoldingUsd} from '@fortawesome/pro-regular-svg-icons/faHandHoldingUsd';
import {faUser} from '@fortawesome/pro-regular-svg-icons/faUser';
import {faReceipt} from '@fortawesome/pro-regular-svg-icons/faReceipt';
import {faEdit} from '@fortawesome/pro-regular-svg-icons/faEdit';
import {faLock} from '@fortawesome/pro-regular-svg-icons/faLock';
import {faLockOpen} from '@fortawesome/pro-regular-svg-icons/faLockOpen';
import {faParachuteBox} from '@fortawesome/pro-regular-svg-icons/faParachuteBox';
import {faCheck} from '@fortawesome/pro-regular-svg-icons/faCheck';
import {faHourglass} from '@fortawesome/pro-regular-svg-icons/faHourglass';
import {faEye} from '@fortawesome/pro-regular-svg-icons/faEye';
import {faEyeSlash} from '@fortawesome/pro-regular-svg-icons/faEyeSlash';
import {faClone} from '@fortawesome/pro-regular-svg-icons/faClone';
import {faHistory} from '@fortawesome/pro-regular-svg-icons/faHistory';
import {faPaperPlane} from '@fortawesome/pro-regular-svg-icons/faPaperPlane';
import {faMemory} from '@fortawesome/pro-regular-svg-icons/faMemory';
import {faPuzzlePiece} from '@fortawesome/pro-regular-svg-icons/faPuzzlePiece';
import {faBoxBallot} from '@fortawesome/pro-regular-svg-icons/faBoxBallot';
import {faUserMinus} from '@fortawesome/pro-regular-svg-icons/faUserMinus';
import {faAngleRight} from '@fortawesome/pro-regular-svg-icons/faAngleRight';
import {faTimes} from '@fortawesome/pro-regular-svg-icons/faTimes';
import {faLongArrowAltDown} from '@fortawesome/pro-regular-svg-icons/faLongArrowAltDown';
import {faSearch} from '@fortawesome/pro-regular-svg-icons/faSearch';
import {faSync} from '@fortawesome/pro-regular-svg-icons/faSync';
import {faPencil} from '@fortawesome/pro-regular-svg-icons/faPencil';
import {faPlus} from '@fortawesome/pro-regular-svg-icons/faPlus';
import {faMinus} from '@fortawesome/pro-regular-svg-icons/faMinus';
import {faTimesCircle} from '@fortawesome/pro-regular-svg-icons/faTimesCircle';
import {faUserPlus} from '@fortawesome/pro-regular-svg-icons/faUserPlus';
import {faUserEdit} from '@fortawesome/pro-regular-svg-icons/faUserEdit';
import {faExternalLink} from '@fortawesome/pro-regular-svg-icons/faExternalLink';

/* COMPONENTS */
import {AppComponent} from './app.component';
import {LandingComponent} from './landing/landing.component';
import {LockscreenComponent} from './lockscreen/lockscreen.component';
import {DashboardComponent} from './dashboard/dashboard.component';
import {WalletComponent} from './dashboard/wallet/wallet.component';
import {SendComponent} from './dashboard/send/send.component';
import {ResourcesComponent} from './dashboard/acc_resources/resources.component';
import {VoteComponent} from './dashboard/vote/vote.component';
import {RexComponent} from './dashboard/rex/rex.component';
import {DappComponent} from './dashboard/dapp/dapp.component';
import {ReferendumComponent} from './dashboard/referendum/referendum.component';
import {AboutComponent} from './dashboard/about/about.component';
import {ConfigComponent} from './dashboard/settings/config.component';
import {InputModalComponent} from './input-modal/input-modal.component';
import {ConfirmModalComponent} from './confirm-modal/confirm-modal.component';

/* CUSTOM PIPES */
import {ThousandSuffixesPipe} from './dashboard/rex/thousand-suffixes.pipe';

/* SERVICES */
import {ChainService} from './services/chain.service';
import {Eosjs2Service} from './services/eosio/eosjs2.service';
import {NetworkService} from './services/network.service';
import {CryptoService} from './services/crypto/crypto.service';
import {AccountsService} from './services/accounts.service';
import {ConnectService} from './services/connect.service';
import {RamService} from './services/ram.service';
import {BackupService} from './services/backup.service';
import {ThemeService} from './services/theme.service';
import {LedgerService} from './services/ledger/ledger.service';

// Angular Material
import {MatAutocompleteModule} from '@angular/material/autocomplete';
import {MatButtonToggleModule} from '@angular/material/button-toggle';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatRadioModule} from '@angular/material/radio';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatSelectModule} from '@angular/material/select';
import {MatInputModule} from '@angular/material/input';
import {MatTabsModule} from '@angular/material/tabs';
import {MatSliderModule} from '@angular/material/slider';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatListModule} from "@angular/material/list";
import {FlexLayoutModule} from "@angular/flex-layout";

// PrimeNG
import {AccordionModule} from 'primeng/accordion';
import {TableModule} from 'primeng/table';
import {TooltipModule} from 'primeng/tooltip';
import {PaginatorModule} from 'primeng/paginator';

// JSON Schema Form
import {MaterialDesignFrameworkModule} from '@ajsf/material';

// Lottie
import {LottieModule} from "ngx-lottie";
import player from 'lottie-web';
import { ImportModalComponent } from './import-modal/import-modal.component';
import {MatTooltipModule} from "@angular/material/tooltip";
import {faTrashAlt} from '@fortawesome/pro-regular-svg-icons/faTrashAlt';

export function playerFactory() {
    return player;
}

@NgModule({
    // entryComponents: [FormComponent],
    declarations: [
        AppComponent,
        LandingComponent,
        DashboardComponent,
        SendComponent,
        WalletComponent,
        VoteComponent,
        ConfigComponent,
        AboutComponent,
        LockscreenComponent,
        ResourcesComponent,
        DappComponent,
        ReferendumComponent,
        RexComponent,
        ThousandSuffixesPipe,
        ConfirmModalComponent,
        InputModalComponent,
        ImportModalComponent,
    ],
    imports: [
        FormsModule,
        AccordionModule,
        TableModule,
        TooltipModule,
        BrowserAnimationsModule,
        BrowserModule,
        ClarityModule,
        FontAwesomeModule,
        HttpClientModule,
        MatAutocompleteModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatInputModule,
        MatRadioModule,
        MatSelectModule,
        MatSliderModule,
        MatProgressBarModule,
        MatTabsModule,
        MatButtonToggleModule,
        MatDatepickerModule,
        MatSlideToggleModule,
        ReactiveFormsModule,
        TextMaskModule,
        NgxEchartsModule,
        ToasterModule.forRoot(),
        AppRoutingModule,
        NgxJsonViewerModule,
        FuseJsModule,
        OrderModule,
        NgxPaginationModule,
        NgxElectronModule,
        MarkdownModule.forRoot(),
        MaterialDesignFrameworkModule,
        MatListModule,
        LottieModule.forRoot({
            player: playerFactory,
            useCache: false
        }),
        FlexLayoutModule,
        MatTooltipModule,
        PaginatorModule,
    ],
    providers: [
        Eosjs2Service,
        ChainService,
        AccountsService,
        NetworkService,
        CryptoService,
        RamService,
        LedgerService,
        ConnectService,
        BackupService,
        ThemeService
    ],
    bootstrap: [AppComponent],
})
export class AppModule {
    constructor(library: FaIconLibrary) {

        const icons = [];

        // fas solid
        icons.push(...[
            faHeart,
            faTh,
            faCaretDown,
            faSkullCrossbones,
            faKey,
            faExclamationTriangle,
            faTimesCircle,
            faGlobe
        ]);

        // fab brands
        icons.push(...[
            faTelegramPlane,
            faTwitter,
            faGithub,
            faYoutube,
            faFacebook,
            faReddit,
            faKeybase,
            faWeixin
        ]);

        // far regular
        icons.push(...[
            faSignOutAlt,
            faExclamationCircle,
            faUndo,
            faQuestionCircle,
            faSpinner,
            faExchangeAlt,
            faDonate,
            faUndoAlt,
            faHandHoldingUsd,
            faUser,
            faReceipt,
            faEdit,
            faLock,
            faLockOpen,
            faParachuteBox,
            faCheck,
            faHourglass,
            faEye,
            faEyeSlash,
            faClone,
            faHistory,
            faPaperPlane,
            faMemory,
            faPuzzlePiece,
            faBoxBallot,
            faUserMinus,
            faAngleRight,
            faTimes,
            faLongArrowAltDown,
            faSearch,
            faSync,
            faPencil,
            faMinus,
            faPlus,
            faTimesCircle,
            faUserPlus,
            faUserEdit,
            faPaperPlane,
            faExternalLink,
            faTrashAlt
        ]);

        // fal light
        icons.push(...[
            faPaperPlane,
            faArrowAltToBottom,
            faChevronCircleUp,
            faChevronCircleDown,
            faCog,
            faSearchMinus,
            faSearchPlus
        ]);

        icons.forEach((iconDef) => {
            library.addIcons(iconDef)
        });
    }

    // FaIconLibrary.addIconPacks(far, fas, fab, fal);
}
