import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { onOpenUrl, getCurrent } from '@tauri-apps/plugin-deep-link';
import { WalletStateService } from './core/services/wallet-state.service';
import { ThemeService } from './core/services/theme.service';
import { EsrService } from './core/services/esr.service';
import { LinkSessionService } from './core/services/link-session.service';
import { TokenPriceService } from './core/services/token-price.service';
import { UpdateService } from './core/services/update.service';
import { ResizeHandlesComponent } from './shared/resize-handles';
import { FullscreenLoaderComponent } from './shared/fullscreen-loader';
import { AlertPanelComponent } from './shared/alert-panel';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ResizeHandlesComponent, FullscreenLoaderComponent, AlertPanelComponent],
  template: `
    @if (ready()) {
      <router-outlet />
    } @else {
      <div class="splash">
        <img src="assets/simpleos-logo.svg" alt="SimplEOS" class="splash-logo" />
      </div>
    }
    <app-resize-handles />
    <app-fullscreen-loader />
    <app-alert-panel />
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
    private esr: EsrService,
    private linkSession: LinkSessionService,
    private tokenPrice: TokenPriceService,
    private updates: UpdateService,
  ) {}

  async ngOnInit() {
    console.log('[app] ngOnInit: ENTERED');
    console.log('[app] hasTauri initial:', this.wallet.hasTauri());
    console.log('[app] current URL:', this.router.url);

    // Mark the document with the OS family so the custom titlebar can reserve
    // space for macOS traffic lights (which are preserved via titleBarStyle: "Overlay").
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || '';
      const platform = (navigator as any).platform || '';
      if (/Mac/i.test(platform) || /Mac/i.test(ua)) {
        document.documentElement.classList.add('os-mac');
      } else if (/Win/i.test(platform) || /Windows/i.test(ua)) {
        document.documentElement.classList.add('os-win');
      } else {
        document.documentElement.classList.add('os-linux');
      }
    }

    // Listen for "Lock Wallet" menu item clicks from the system tray.
    // Registered unconditionally: `hasTauri()` is still false at this point
    // (it only flips inside initialize() below), and listen() rejects cleanly
    // in a non-Tauri context so the .catch() handles the web case.
    listen('tray-lock-request', async () => {
      console.log('[app] tray requested wallet lock');
      // Close any open dapp child webview — it's a native OS layer that renders
      // on top of all Angular content including the lockscreen.
      await invoke<void>('close_dapp_browser').catch(() => {});
      await this.wallet.lock();
      await this.router.navigate(['/lockscreen']);
    }).catch(err => console.warn('[app] tray-lock-request listen failed:', err));

    onOpenUrl((urls) => {
      console.log('[app] Deep link received:', urls);
      for (const url of urls) {
        if (url.startsWith('esr:') || url.startsWith('esr-anchor:') || url.startsWith('anchor:')) {
          // If the app is locked, we can't do anything yet. We pass it and let EsrService handle it.
          // EsrService checks if there is an active account.
          this.esr.handleEsrRequest(url);
        }
      }
    }).catch(err => console.warn('[app] onOpenUrl listen failed:', err));

    // Handle initial deep links (if app was started via a deep link)
    setTimeout(async () => {
      try {
        const urls = await getCurrent();
        if (urls && urls.length > 0) {
          console.log('[app] Initial deep link(s):', urls);
          for (const url of urls) {
            if (url.startsWith('esr:') || url.startsWith('esr-anchor:') || url.startsWith('anchor:')) {
              this.esr.handleEsrRequest(url);
            }
          }
        }
      } catch (err) {
        console.warn('[app] getCurrent() for deep links failed:', err);
      }
    }, 1000); // Slight delay to ensure UI is ready

    await this.wallet.initialize();
    this.tokenPrice.initialize();
    this.linkSession.restoreSessions().catch(err =>
      console.warn('[app] Failed to restore link sessions:', err)
    );
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

    // Check for updates in the background (silent = true)
    this.updates.checkForUpdates(true);

    console.log('[app] setting ready=true');
    this.ready.set(true);
  }
}
