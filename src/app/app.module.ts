import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {HttpClientModule} from '@angular/common/http';
import {ClarityModule} from '@clr/angular';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';

import {LottieAnimationViewModule} from 'ng-lottie';
import {TextMaskModule} from 'angular2-text-mask';
import {ToasterModule} from 'angular2-toaster';
import {NgxEchartsModule} from 'ngx-echarts';
import {NgxJsonViewerModule} from 'ngx-json-viewer';
import {OrderModule} from 'ngx-order-pipe';
import {NgxPaginationModule} from 'ngx-pagination';
import {FuseJsModule} from './modules/fusejs/fusejs.module';
import {NgxElectronModule} from 'ngx-electron';
import {MarkdownModule} from 'ngx-markdown';

import {
	FaIconLibrary,
	FontAwesomeModule,
} from '@fortawesome/angular-fontawesome';

// FontAwesome Imports
// FAS
import {faHeart} from '@fortawesome/pro-solid-svg-icons/faHeart';
import {faTh} from '@fortawesome/pro-solid-svg-icons/faTh';
import {faCaretDown} from '@fortawesome/pro-solid-svg-icons/faCaretDown';
import {faSkullCrossbones} from '@fortawesome/pro-solid-svg-icons/faSkullCrossbones';
import {faKey} from '@fortawesome/pro-solid-svg-icons/faKey';
import {faExclamationTriangle} from '@fortawesome/pro-solid-svg-icons/faExclamationTriangle';
import {faGlobe} from '@fortawesome/pro-solid-svg-icons/faGlobe';
// FAL
import {faArrowAltToBottom} from '@fortawesome/pro-light-svg-icons/faArrowAltToBottom';
import {faChevronCircleUp} from '@fortawesome/pro-light-svg-icons/faChevronCircleUp';
import {faChevronCircleDown} from '@fortawesome/pro-light-svg-icons/faChevronCircleDown';
import {faCog} from '@fortawesome/pro-light-svg-icons/faCog';
import {faSearchMinus} from '@fortawesome/pro-light-svg-icons/faSearchMinus';
import {faSearchPlus} from '@fortawesome/pro-light-svg-icons/faSearchPlus';
// FAB
import {faTelegramPlane} from '@fortawesome/free-brands-svg-icons/faTelegramPlane';
import {faTwitter} from '@fortawesome/free-brands-svg-icons/faTwitter';
import {faGithub} from '@fortawesome/free-brands-svg-icons/faGithub';
import {faYoutube} from '@fortawesome/free-brands-svg-icons/faYoutube';
import {faFacebook} from '@fortawesome/free-brands-svg-icons/faFacebook';
import {faReddit} from '@fortawesome/free-brands-svg-icons/faReddit';
import {faKeybase} from '@fortawesome/free-brands-svg-icons/faKeybase';
import {faWeixin} from '@fortawesome/free-brands-svg-icons/faWeixin';
// FAR
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
import {AppRoutingModule} from './app-routing.module';
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
import {ThousandSuffixesPipe} from './dashboard/rex/thousand-suffixes.pipe';
/* SERVICES */
import {ChainService} from './services/chain.service';
import {EOSJSService} from './services/eosjs.service';
import {Eosjs2Service} from './services/eosio/eosjs2.service';
import {NetworkService} from './services/network.service';
import {CryptoService} from './services/crypto.service';
import {AccountsService} from './services/accounts.service';
import {ConnectService} from './services/connect.service';
import {RamService} from './services/ram.service';
import {BackupService} from './services/backup.service';
import {ThemeService} from './services/theme.service';
// Material
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
// PrimeNG
import {AccordionModule} from 'primeng/accordion';
import {TableModule} from 'primeng/table';
import {TooltipModule} from 'primeng/tooltip';
import {MaterialDesignFrameworkModule} from '@ajsf/material';
import {LedgerService} from "./services/ledger/ledger.service";

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
		LottieAnimationViewModule.forRoot(),
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
	],
	providers: [
		EOSJSService,
		Eosjs2Service,
		ChainService,
		AccountsService,
		NetworkService,
		CryptoService,
		RamService,
		LedgerService,
		ConnectService,
		BackupService,
		ThemeService,
	],
	bootstrap: [AppComponent],
})
export class AppModule {
	constructor(library: FaIconLibrary) {

		// // fas solid
		library.addIcons(faHeart);
		library.addIcons(faTh);
		library.addIcons(faCaretDown);
		library.addIcons(faSkullCrossbones);
		library.addIcons(faKey);
		library.addIcons(faExclamationTriangle);
		library.addIcons(faTimesCircle);
		library.addIcons(faGlobe);

		// // fab brands
		library.addIcons(faTelegramPlane);
		library.addIcons(faTwitter);
		library.addIcons(faGithub);
		library.addIcons(faYoutube);
		library.addIcons(faFacebook);
		library.addIcons(faReddit);
		library.addIcons(faKeybase);
		library.addIcons(faWeixin);

		// // far regular
		library.addIcons(faSignOutAlt);
		library.addIcons(faExclamationCircle);
		library.addIcons(faUndo);
		library.addIcons(faQuestionCircle);
		library.addIcons(faSpinner);
		library.addIcons(faExchangeAlt);
		library.addIcons(faDonate);
		library.addIcons(faUndoAlt);
		library.addIcons(faHandHoldingUsd);
		library.addIcons(faUser);
		library.addIcons(faReceipt);
		library.addIcons(faEdit);
		library.addIcons(faLock);
		library.addIcons(faLockOpen);
		library.addIcons(faParachuteBox);
		library.addIcons(faCheck);
		library.addIcons(faHourglass);
		library.addIcons(faEye);
		library.addIcons(faEyeSlash);
		library.addIcons(faClone);
		library.addIcons(faHistory);
		library.addIcons(faPaperPlane);
		library.addIcons(faMemory);
		library.addIcons(faPuzzlePiece);
		library.addIcons(faBoxBallot);
		library.addIcons(faUserMinus);
		library.addIcons(faAngleRight);
		library.addIcons(faTimes);
		library.addIcons(faLongArrowAltDown);
		library.addIcons(faSearch);
		library.addIcons(faSync);
		library.addIcons(faPencil);
		library.addIcons(faMinus);
		library.addIcons(faPlus);
		library.addIcons(faTimesCircle);
		library.addIcons(faUserPlus);
		library.addIcons(faUserEdit);
		library.addIcons(faPaperPlane);
		library.addIcons(faExternalLink);

		// // fal light
		library.addIcons(faPaperPlane);
		library.addIcons(faArrowAltToBottom);
		library.addIcons(faChevronCircleUp);
		library.addIcons(faChevronCircleDown);
		library.addIcons(faCog);
		library.addIcons(faSearchMinus);
		library.addIcons(faSearchPlus);
	}

	// FaIconLibrary.addIconPacks(far, fas, fab, fal);
}
