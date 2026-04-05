import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { WalletStateService } from './core/services/wallet-state.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    @if (ready()) {
      <router-outlet />
    } @else {
      <div class="splash">
        <img src="assets/simpleos-logo.svg" alt="SimplEOS" class="splash-logo" />
      </div>
    }
  `,
  styles: [`
    .splash {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: var(--bg-deep, #111218);
    }
    .splash-logo {
      width: 80px;
      height: 80px;
      opacity: 0.6;
      animation: pulse 1.5s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.4; transform: scale(0.95); }
      50% { opacity: 0.8; transform: scale(1); }
    }
  `],
  styleUrl: './app.css',
})
export class AppComponent implements OnInit {
  ready = signal(false);

  constructor(
    private wallet: WalletStateService,
    private theme: ThemeService,
    private router: Router,
  ) {}

  async ngOnInit() {
    console.log('[app] ngOnInit: ENTERED');
    console.log('[app] hasTauri initial:', this.wallet.hasTauri());
    console.log('[app] current URL:', this.router.url);
    await this.wallet.initialize();
    console.log('[app] ngOnInit: initialization complete, routing...');

    const vault = this.wallet.vaultExists();
    const locked = this.wallet.locked();
    const accounts = this.wallet.accounts().length;
    console.log(`[app] state: vault=${vault}, locked=${locked}, accounts=${accounts}`);

    if (!vault && accounts === 0) {
      console.log('[app] routing to /landing (fresh install)');
      await this.router.navigate(['/landing']);
    } else if (locked) {
      // Vault exists and needs lockscreen (SessionUnlock mode)
      await this.wallet.restoreAccounts();
      console.log('[app] routing to /lockscreen');
      await this.router.navigate(['/lockscreen']);
    } else {
      // SignPerUse, ManualToggle (locked but no lockscreen), or session still alive
      if (accounts === 0) {
        const restored = await this.wallet.restoreAccounts();
        if (!restored && vault) {
          console.log('[app] no cached accounts, running full load...');
          await this.wallet.loadAccounts();
        }
      }
      console.log(`[app] routing to /dashboard (mode=${this.wallet.securityMode()})`);
      await this.router.navigate(['/dashboard']);

      // Background refresh to pick up latest balances (including extra tokens)
      if (this.wallet.accounts().length > 0) {
        this.wallet.refreshAllAccounts().then(() => this.wallet.saveAccounts());
      }
    }

    console.log('[app] setting ready=true');
    this.ready.set(true);
  }
}
