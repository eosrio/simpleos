import { Routes } from '@angular/router';
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
      { path: 'wallet', loadComponent: () => import('./features/dashboard/wallet/wallet').then(m => m.WalletComponent) },
      { path: 'send', loadComponent: () => import('./features/dashboard/send/send').then(m => m.SendComponent) },
      { path: 'vote', loadComponent: () => import('./features/dashboard/vote/vote').then(m => m.VoteComponent) },
      { path: 'resources', loadComponent: () => import('./features/dashboard/resources/resources').then(m => m.ResourcesComponent) },
      { path: 'rex', loadComponent: () => import('./features/dashboard/rex/rex').then(m => m.RexComponent) },
      { path: 'dapp', loadComponent: () => import('./features/dashboard/dapp/dapp').then(m => m.DappComponent) },
      { path: 'settings', loadComponent: () => import('./features/dashboard/settings/settings').then(m => m.SettingsComponent) },
      { path: 'about', loadComponent: () => import('./features/dashboard/about/about').then(m => m.AboutComponent) },
      // BP-specific routes (conditionally shown in nav when account is a producer)
      { path: 'bp-keys', loadComponent: () => import('./features/dashboard/bp-keys/bp-keys').then(m => m.BpKeysComponent) },
      { path: 'bp-rewards', loadComponent: () => import('./features/dashboard/bp-rewards/bp-rewards').then(m => m.BpRewardsComponent) },
      { path: 'bp-votes', loadComponent: () => import('./features/dashboard/bp-votes/bp-votes').then(m => m.BpVotesComponent) },
      { path: '', redirectTo: 'wallet', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: 'landing', pathMatch: 'full' },
  { path: '**', redirectTo: 'landing' },
];
