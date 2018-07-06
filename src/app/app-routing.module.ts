import { NgModule } from "@angular/core";
import { Routes, RouterModule } from "@angular/router";
import { LandingComponent } from "./landing/landing.component";
import { DashboardComponent } from "./dashboard/dashboard.component";
import { HistoryComponent } from "./dashboard/history/history.component";
import { TestComponent } from "./dashboard/test/test.component";
import { VoteComponent } from "./dashboard/vote/vote.component";
import { SendComponent } from "./dashboard/send/send.component";
import { ConfigComponent } from "./dashboard/config/config.component";
import { AboutComponent } from "./dashboard/about/about.component";
import { LockscreenComponent } from "./lockscreen/lockscreen.component";
import { LockGuard } from "./lock.guard";
import { RamMarketComponent } from "./dashboard/ram-market/ram-market.component";

const routes: Routes = [
  {
    path: "",
    component: LockscreenComponent
  },
  {
    path: "landing",
    component: LandingComponent,
    canActivate: [LockGuard]
  },
  {
    path: "dashboard",
    component: DashboardComponent,
    canActivate: [LockGuard],
    children: [
      {
        path: "history",
        component: HistoryComponent
      },
      {
        path: "send",
        component: SendComponent
      },
      {
        path: "test",
        component: TestComponent
      },
      {
        path: "vote",
        component: VoteComponent
      },
      {
        path: "config",
        component: ConfigComponent
      },
      {
        path: "ram",
        component: RamMarketComponent
      },
      {
        path: "about",
        component: AboutComponent
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule {}
