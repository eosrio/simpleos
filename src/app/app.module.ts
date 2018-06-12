import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';

import {AppComponent} from './app.component';
import {ClarityModule} from '@clr/angular';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {LandingComponent} from './landing/landing.component';
import {EOSJSService} from './eosjs.service';
import {DashboardComponent} from './dashboard/dashboard.component';
import {AppRoutingModule} from './app-routing.module';
import {FontAwesomeModule} from '@fortawesome/angular-fontawesome';
import {library} from '@fortawesome/fontawesome-svg-core';
import {far} from '@fortawesome/pro-regular-svg-icons';
import {fas} from '@fortawesome/pro-solid-svg-icons';
import {fab} from '@fortawesome/free-brands-svg-icons';
import {fal} from '@fortawesome/pro-light-svg-icons';
import {WalletComponent} from './dashboard/wallet/wallet.component';
import {HistoryComponent} from './dashboard/history/history.component';
import {VoteComponent} from './dashboard/vote/vote.component';
import {SendComponent} from './dashboard/send/send.component';
import {
  MatAutocompleteModule,
  MatCheckboxModule,
  MatFormFieldModule,
  MatInputModule,
  MatSliderModule,
  MatTabsModule
} from '@angular/material';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {TableModule} from 'primeng/table';
import {LottieAnimationViewModule} from 'ng-lottie';
import {ConfigComponent} from './dashboard/config/config.component';
import {HttpClientModule} from '@angular/common/http';
import {TooltipModule} from 'primeng/primeng';
import {AboutComponent} from './dashboard/about/about.component';
import {TextMaskModule} from 'angular2-text-mask';
import {ToasterModule} from 'angular2-toaster';

library.add(far, fas, fab, fal);

@NgModule({
  declarations: [
    AppComponent,
    LandingComponent,
    DashboardComponent,
    SendComponent,
    WalletComponent,
    HistoryComponent,
    VoteComponent,
    ConfigComponent,
    AboutComponent
  ],
  imports: [
    BrowserModule,
    ClarityModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatSliderModule,
    TableModule,
    FormsModule,
    TextMaskModule,
    TooltipModule,
    ReactiveFormsModule,
    MatCheckboxModule,
    ToasterModule.forRoot(),
    BrowserAnimationsModule,
    LottieAnimationViewModule.forRoot(),
    FontAwesomeModule,
    ReactiveFormsModule,
    HttpClientModule,
    AppRoutingModule
  ],
  providers: [EOSJSService],
  bootstrap: [AppComponent]
})
export class AppModule {
}
