import {NgModule} from '@angular/core';
import {Routes, RouterModule} from '@angular/router';
import {LandingComponent} from './landing/landing.component';
import {DashboardComponent} from './dashboard/dashboard.component';
import {WalletComponent} from './dashboard/wallet/wallet.component';
import {HistoryComponent} from './dashboard/history/history.component';
import {VoteComponent} from './dashboard/vote/vote.component';
import {SendComponent} from './dashboard/send/send.component';
import {ConfigComponent} from './dashboard/settings/config.component';
import {AboutComponent} from './dashboard/about/about.component';
import {LockscreenComponent} from './lockscreen/lockscreen.component';
import {LockGuard} from './lock.guard';
import {ResourcesComponent} from './dashboard/acc_resources/resources.component';
import {DappComponent} from './dashboard/dapp/dapp.component';

const routes: Routes = [
  {
    path: '',
    component: LockscreenComponent
  },
  {
    path: 'landing',
    component: LandingComponent,
    canActivate: [LockGuard]
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [LockGuard],
    children: [
      {
        path: 'wallet',
        component: WalletComponent,
      },
      {
        path: 'send',
        component: SendComponent,
      },
      {
        path: 'history',
        component: HistoryComponent,
      },
      {
        path: 'vote',
        component: VoteComponent,
      },
      {
        path: 'config',
        component: ConfigComponent,
      },
      {
        path: 'ram',
        component: ResourcesComponent,
      },
      {
        path: 'dapp',
        component: DappComponent,
      },
      {
        path: 'about',
        component: AboutComponent,
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {useHash: true})],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
