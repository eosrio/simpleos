import { Routes } from '@angular/router';
import { accountSelectedGuard } from './core/guards/account-selected.guard';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'lockscreen',
    loadComponent: () => import('./features/lockscreen/lockscreen').then(m => m.LockscreenComponent),
  },
  {
    path: 'landing',
    loadComponent: () => import('./features/landing/landing').then(m => m.LandingComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard').then(m => m.DashboardComponent),
    canActivate: [authGuard],
    children: [
      { path: 'home', loadComponent: () => import('./features/dashboard/home/home').then(m => m.HomeComponent) },
      { path: 'wallet', canActivate: [accountSelectedGuard], loadComponent: () => import('./features/dashboard/wallet/wallet').then(m => m.WalletComponent) },
      { path: 'send', canActivate: [accountSelectedGuard], loadComponent: () => import('./features/dashboard/send/send').then(m => m.SendComponent) },
      { path: 'vote', canActivate: [accountSelectedGuard], loadComponent: () => import('./features/dashboard/vote/vote').then(m => m.VoteComponent) },
      { path: 'resources', canActivate: [accountSelectedGuard], loadComponent: () => import('./features/dashboard/resources/resources').then(m => m.ResourcesComponent) },
      { path: 'rex', canActivate: [accountSelectedGuard], loadComponent: () => import('./features/dashboard/rex/rex').then(m => m.RexComponent) },
      { path: 'contracts', canActivate: [accountSelectedGuard], loadComponent: () => import('./features/dashboard/contracts/contracts').then(m => m.ContractsComponent) },
      { path: 'dapp', canActivate: [accountSelectedGuard], loadComponent: () => import('./features/dashboard/dapp/dapp').then(m => m.DappComponent) },
      { path: 'settings', loadComponent: () => import('./features/dashboard/settings/settings').then(m => m.SettingsComponent) },
      { path: 'about', loadComponent: () => import('./features/dashboard/about/about').then(m => m.AboutComponent) },
      { path: 'fio-handles', canActivate: [accountSelectedGuard], loadComponent: () => import('./features/dashboard/fio-handles/fio-handles').then(m => m.FioHandlesComponent) },
      { path: 'msig-inbox', canActivate: [accountSelectedGuard], loadComponent: () => import('./features/dashboard/msig-inbox/msig-inbox').then(m => m.MsigInboxComponent) },
      // BP-specific routes (conditionally shown in nav when account is a producer)
      { path: 'bp-keys', canActivate: [accountSelectedGuard], loadComponent: () => import('./features/dashboard/bp-keys/bp-keys').then(m => m.BpKeysComponent) },
      { path: 'bp-rewards', canActivate: [accountSelectedGuard], loadComponent: () => import('./features/dashboard/bp-rewards/bp-rewards').then(m => m.BpRewardsComponent) },
      { path: 'bp-votes', canActivate: [accountSelectedGuard], loadComponent: () => import('./features/dashboard/bp-votes/bp-votes').then(m => m.BpVotesComponent) },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: 'landing', pathMatch: 'full' },
  { path: '**', redirectTo: 'landing' },
];
