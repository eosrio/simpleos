import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {HttpClientModule} from '@angular/common/http';
import {ClarityModule} from '@clr/angular';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {FontAwesomeModule, FaIconLibrary} from '@fortawesome/angular-fontawesome';
import {far} from '@fortawesome/pro-regular-svg-icons';
import {fas} from '@fortawesome/pro-solid-svg-icons';
import {fab} from '@fortawesome/free-brands-svg-icons';
import {fal} from '@fortawesome/pro-light-svg-icons';
import {
	MatAutocompleteModule,
	MatCheckboxModule,
	MatFormFieldModule,
	MatInputModule, MatRadioModule, MatSelectModule,
	MatSliderModule,
	MatTabsModule,
	MatButtonToggleModule, MatProgressBarModule,
	MatDatepickerModule
} from '@angular/material';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {TableModule} from 'primeng/table';
import {LottieAnimationViewModule} from 'ng-lottie';
import {AccordionModule, TooltipModule} from 'primeng/primeng';
import {TextMaskModule} from 'angular2-text-mask';
import {ToasterModule} from 'angular2-toaster';
import {NgxEchartsModule} from 'ngx-echarts';
import {NgxJsonViewerModule} from 'ngx-json-viewer';
import {OrderModule} from 'ngx-order-pipe';
import {NgxPaginationModule} from 'ngx-pagination';
import {FuseJsModule} from './modules/fusejs/fusejs.module';
import {MaterialDesignFrameworkModule} from 'angular7-json-schema-form';
import {NgxElectronModule} from 'ngx-electron';
import {MarkdownModule} from 'ngx-markdown';


/* COMPONENTS */
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { LandingComponent } from './landing/landing.component';
import { LockscreenComponent } from './lockscreen/lockscreen.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { WalletComponent } from './dashboard/wallet/wallet.component';
import { SendComponent } from './dashboard/send/send.component';
import { ResourcesComponent } from './dashboard/acc_resources/resources.component';
import { VoteComponent } from './dashboard/vote/vote.component';
import { RexComponent } from './dashboard/rex/rex.component';
import { DappComponent } from './dashboard/dapp/dapp.component';
import { ReferendumComponent } from './dashboard/referendum/referendum.component';
import { AboutComponent } from './dashboard/about/about.component';
import { ConfigComponent } from './dashboard/settings/config.component';
import { InputModalComponent } from './input-modal/input-modal.component';
import { ConfirmModalComponent } from './confirm-modal/confirm-modal.component';
import { ThousandSuffixesPipe} from './dashboard/rex/thousand-suffixes.pipe';

/* SERVICES */
import { ChainService} from './services/chain.service';
import { EOSJSService } from './services/eosjs.service';
import { Eosjs2Service } from './services/eosjs2.service';
import { NetworkService } from './services/network.service';
import { CryptoService } from './services/crypto.service';
import { AccountsService } from './services/accounts.service';
import { ConnectService } from './services/connect.service';
import { RamService } from './services/ram.service';
import { BackupService } from './services/backup.service';
import { ThemeService } from './services/theme.service';



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
		InputModalComponent
	],
	imports: [
		AccordionModule,
		BrowserAnimationsModule,
		BrowserModule,
		ClarityModule,
		FontAwesomeModule,
		FormsModule,
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
		TableModule,
		TextMaskModule,
		NgxEchartsModule,
		ToasterModule.forRoot(),
		TooltipModule,
		AppRoutingModule,
		NgxJsonViewerModule,
		FuseJsModule,
		OrderModule,
		NgxPaginationModule,
		MaterialDesignFrameworkModule,
		NgxElectronModule,
		MarkdownModule.forRoot()
	],
	providers: [
		EOSJSService,
		Eosjs2Service,
		ChainService,
		AccountsService,
		NetworkService,
		CryptoService,
		RamService,
		// LedgerHWService,
		ConnectService,
		BackupService,
		ThemeService
	],
	bootstrap: [AppComponent]
})
export class AppModule {
	constructor(library: FaIconLibrary) {
		library.addIconPacks(far);
		library.addIconPacks(fas);
		library.addIconPacks(fab);
		library.addIconPacks(fal);
	}
	// FaIconLibrary.addIconPacks(far, fas, fab, fal);
}
