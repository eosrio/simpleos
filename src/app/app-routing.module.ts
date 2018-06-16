import {NgModule} from '@angular/core';
import {Routes, RouterModule} from '@angular/router';
import {LandingComponent} from './landing/landing.component';
import {DashboardComponent} from './dashboard/dashboard.component';
import {WalletComponent} from './dashboard/wallet/wallet.component';
import {HistoryComponent} from './dashboard/history/history.component';
import {VoteComponent} from './dashboard/vote/vote.component';
import {SendComponent} from './dashboard/send/send.component';
import {ConfigComponent} from './dashboard/config/config.component';
import {AboutComponent} from './dashboard/about/about.component';

const routes: Routes = [
    {path: '', component: LandingComponent},
    {
        path: 'dashboard',
        component: DashboardComponent,
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
                path: 'about',
                component: AboutComponent,
            }
        ]
    }
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})
export class AppRoutingModule {
}
