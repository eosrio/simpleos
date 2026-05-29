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
import {faHeart} from '@fortawesome/free-solid-svg-icons/faHeart';
import {faTh} from '@fortawesome/free-solid-svg-icons/faTh';
import {faCaretDown} from '@fortawesome/free-solid-svg-icons/faCaretDown';
import {faSkullCrossbones} from '@fortawesome/free-solid-svg-icons/faSkullCrossbones';
import {faKey} from '@fortawesome/free-solid-svg-icons/faKey';
import {faExclamationTriangle} from '@fortawesome/free-solid-svg-icons/faExclamationTriangle';
import {faGlobe} from '@fortawesome/free-solid-svg-icons/faGlobe';

// FAL - Light Pro
import {faArrowDown as faArrowAltToBottom} from '@fortawesome/free-solid-svg-icons/faArrowDown';
import {faChevronCircleUp} from '@fortawesome/free-solid-svg-icons/faChevronCircleUp';
import {faChevronCircleDown} from '@fortawesome/free-solid-svg-icons/faChevronCircleDown';
import {faCog} from '@fortawesome/free-solid-svg-icons/faCog';
import {faSearchMinus} from '@fortawesome/free-solid-svg-icons/faSearchMinus';
import {faSearchPlus} from '@fortawesome/free-solid-svg-icons/faSearchPlus';

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
import {faSignOutAlt} from '@fortawesome/free-solid-svg-icons/faSignOutAlt';
import {faExclamationCircle} from '@fortawesome/free-solid-svg-icons/faExclamationCircle';
import {faUndo} from '@fortawesome/free-solid-svg-icons/faUndo';
import {faQuestionCircle} from '@fortawesome/free-solid-svg-icons/faQuestionCircle';
import {faSpinner} from '@fortawesome/free-solid-svg-icons/faSpinner';
import {faExchangeAlt} from '@fortawesome/free-solid-svg-icons/faExchangeAlt';
import {faDonate} from '@fortawesome/free-solid-svg-icons/faDonate';
import {faUndoAlt} from '@fortawesome/free-solid-svg-icons/faUndoAlt';
import {faHandHoldingUsd} from '@fortawesome/free-solid-svg-icons/faHandHoldingUsd';
import {faUser} from '@fortawesome/free-solid-svg-icons/faUser';
import {faReceipt} from '@fortawesome/free-solid-svg-icons/faReceipt';
import {faEdit} from '@fortawesome/free-solid-svg-icons/faEdit';
import {faLock} from '@fortawesome/free-solid-svg-icons/faLock';
import {faLockOpen} from '@fortawesome/free-solid-svg-icons/faLockOpen';
import {faParachuteBox} from '@fortawesome/free-solid-svg-icons/faParachuteBox';
import {faCheck} from '@fortawesome/free-solid-svg-icons/faCheck';
import {faHourglass} from '@fortawesome/free-solid-svg-icons/faHourglass';
import {faEye} from '@fortawesome/free-solid-svg-icons/faEye';
import {faEyeSlash} from '@fortawesome/free-solid-svg-icons/faEyeSlash';
import {faClone} from '@fortawesome/free-solid-svg-icons/faClone';
import {faHistory} from '@fortawesome/free-solid-svg-icons/faHistory';
import {faPaperPlane} from '@fortawesome/free-solid-svg-icons/faPaperPlane';
import {faMemory} from '@fortawesome/free-solid-svg-icons/faMemory';
import {faPuzzlePiece} from '@fortawesome/free-solid-svg-icons/faPuzzlePiece';
import {faBoxOpen as faBoxBallot} from '@fortawesome/free-solid-svg-icons/faBoxOpen';
import {faUserMinus} from '@fortawesome/free-solid-svg-icons/faUserMinus';
import {faAngleRight} from '@fortawesome/free-solid-svg-icons/faAngleRight';
import {faTimes} from '@fortawesome/free-solid-svg-icons/faTimes';
import {faLongArrowAltDown} from '@fortawesome/free-solid-svg-icons/faLongArrowAltDown';
import {faSearch} from '@fortawesome/free-solid-svg-icons/faSearch';
import {faSync} from '@fortawesome/free-solid-svg-icons/faSync';
import {faPencilAlt as faPencil} from '@fortawesome/free-solid-svg-icons/faPencilAlt';
import {faPlus} from '@fortawesome/free-solid-svg-icons/faPlus';
import {faMinus} from '@fortawesome/free-solid-svg-icons/faMinus';
import {faTimesCircle} from '@fortawesome/free-solid-svg-icons/faTimesCircle';
import {faUserPlus} from '@fortawesome/free-solid-svg-icons/faUserPlus';
import {faUserEdit} from '@fortawesome/free-solid-svg-icons/faUserEdit';
import {faExternalLinkAlt as faExternalLink} from '@fortawesome/free-solid-svg-icons/faExternalLinkAlt';

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
import {faTrashAlt} from '@fortawesome/free-solid-svg-icons/faTrashAlt';
import { KeygenModalComponent } from './keygen-modal/keygen-modal.component';
import {A11yModule} from "@angular/cdk/a11y";
import { CustomChainModalComponent } from './custom-chain-modal/custom-chain-modal.component';

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
        KeygenModalComponent,
        CustomChainModalComponent,
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
        A11yModule,
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

            faUserMinus,
            faAngleRight,
            faTimes,
            faLongArrowAltDown,
            faSearch,
        faArrowAltToBottom, faBoxBallot,
        faPencil, faExternalLink,
            faSync,

            faMinus,
            faPlus,
            faTimesCircle,
            faUserPlus,
            faUserEdit,
            faPaperPlane,

            faTrashAlt
        ]);

        // fal light
        icons.push(...[
            faPaperPlane,

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
