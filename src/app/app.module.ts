import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';
import {AppComponent} from './app.component';
import {ClarityModule} from '@clr/angular';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {LandingComponent} from './landing/landing.component';
import {EOSJSService} from './services/eosjs.service';
import {DashboardComponent} from './dashboard/dashboard.component';
import {AppRoutingModule} from './app-routing.module';
import {library} from '@fortawesome/fontawesome-svg-core';
import {far} from '@fortawesome/pro-regular-svg-icons';
import {fas} from '@fortawesome/pro-solid-svg-icons';
import {fab} from '@fortawesome/free-brands-svg-icons';
import {fal} from '@fortawesome/pro-light-svg-icons';
import {WalletComponent} from './dashboard/wallet/wallet.component';
import {VoteComponent} from './dashboard/vote/vote.component';
import {SendComponent} from './dashboard/send/send.component';
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
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {TableModule} from 'primeng/table';
import {LottieAnimationViewModule} from 'ng-lottie';
import {ConfigComponent} from './dashboard/settings/config.component';
import {HttpClientModule} from '@angular/common/http';
import {AccordionModule, TooltipModule} from 'primeng/primeng';
import {AboutComponent} from './dashboard/about/about.component';
import {TextMaskModule} from 'angular2-text-mask';
import {ToasterModule} from 'angular2-toaster';
import {AccountsService} from './services/accounts.service';
import {NetworkService} from './services/network.service';
import {CryptoService} from './services/crypto.service';
import {FontAwesomeModule} from '@fortawesome/angular-fontawesome';
import {LockscreenComponent} from './lockscreen/lockscreen.component';
import {ResourcesComponent} from './dashboard/acc_resources/resources.component';
import {NgxEchartsModule} from 'ngx-echarts';
import {RamService} from './services/ram.service';
import {DappComponent} from './dashboard/dapp/dapp.component';
// import {FormComponent} from './dashboard/dapp/dapp.component';
import {ReferendumComponent} from './dashboard/referendum/referendum.component';
import {DynamicFormBuilderModule} from './dynamic-form-builder/dynamic-form-builder.module';
import {ConnectService} from './services/connect.service';
import {BackupService} from './services/backup.service';
import {NgxJsonViewerModule} from 'ngx-json-viewer';
import {OrderModule} from 'ngx-order-pipe';
import {NgxPaginationModule} from 'ngx-pagination';
import {FuseJsModule} from './modules/fusejs/fusejs.module';
import {MaterialDesignFrameworkModule} from 'angular7-json-schema-form';
import {RexComponent} from './dashboard/rex/rex.component';
import {Eosjs2Service} from './services/eosjs2.service';
import {ThousandSuffixesPipe} from './dashboard/rex/thousand-suffixes.pipe';
import { ConfirmModalComponent } from './confirm-modal/confirm-modal.component';
import { InputModalComponent } from './input-modal/input-modal.component';
import {NgxElectronModule} from 'ngx-electron';
import {MarkdownModule} from 'ngx-markdown';

library.add(far, fas, fab, fal);

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
		ReactiveFormsModule,
		TableModule,
		TextMaskModule,
		NgxEchartsModule,
		ToasterModule.forRoot(),
		TooltipModule,
		AppRoutingModule,
		DynamicFormBuilderModule,
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
		AccountsService,
		NetworkService,
		CryptoService,
		RamService,
		// LedgerHWService,
		ConnectService,
		BackupService
	],
	bootstrap: [AppComponent]
})
export class AppModule {
}
