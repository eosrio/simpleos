import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { WalletStateService } from '../../core/services/wallet-state.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="dashboard">
      <!-- Account tabs (one per imported account, each locked to its chain) -->
      @if (wallet.accounts().length > 0) {
        <div class="account-tabs">
          @for (account of wallet.accounts(); track account.name; let i = $index) {
            <button class="account-tab"
                    [class.active]="i === wallet.selectedIndex()"
                    [class.watch-only]="account.mode === 'watch'"
                    (click)="selectAccount(i)">
              <span class="tab-name">
                {{ account.name }}
                @if (account.mode === 'watch') {
                  <span class="watch-badge" title="Watch-only — no keys imported">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </span>
                }
              </span>
              <span class="tab-balance">{{ account.info.core_liquid_balance ?? '—' }}</span>
            </button>
          }
          <button class="account-tab add-tab" title="Add account">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      }

      <div class="main-area">
        <nav class="sidebar">
          <div class="sidebar-header">
            <img src="assets/simpleos-logo.svg" alt="SimplEOS" class="sidebar-logo" />
            <span class="sidebar-brand">Simpl<span class="accent">EOS</span></span>
          </div>

          <!-- Active account info -->
          <div class="account-card" [class.watch-card]="wallet.isWatchOnly()">
            @if (wallet.selectedAccount(); as account) {
              <div class="account-card-header">
                <span class="account-name">{{ account.name }}</span>
                @if (account.mode === 'watch') {
                  <span class="mode-badge watch">watch</span>
                }
              </div>
              <span class="account-chain">{{ account.chainName }}</span>
            } @else {
              <span class="account-name">No account</span>
              <span class="account-chain">—</span>
            }
          </div>

          <ul class="nav-list">
            <li>
              <a routerLink="wallet" routerLinkActive="active">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                History
                <span class="shortcut">Alt+H</span>
              </a>
            </li>
            <li>
              <a routerLink="send" routerLinkActive="active">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
                Send
                <span class="shortcut">Alt+S</span>
              </a>
            </li>
            <li>
              <a routerLink="resources" routerLinkActive="active">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>
                Resources
                <span class="shortcut">Alt+R</span>
              </a>
            </li>
            <li>
              <a routerLink="vote" routerLinkActive="active">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                Vote / Stake
                <span class="shortcut">Alt+V</span>
              </a>
            </li>
            @if (wallet.activeChain()?.features?.rex) {
              <li>
                <a routerLink="rex" routerLinkActive="active">
                  <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                  REX
                </a>
              </li>
            }
            @if (wallet.activeChain()?.features?.dapps) {
              <li>
                <a routerLink="dapp" routerLinkActive="active">
                  <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
                  Contracts
                </a>
              </li>
            }

            <!-- BP-only section -->
            @if (wallet.isProducer()) {
              <li class="nav-divider"></li>
              <li class="nav-section-label">Producer</li>
              <li>
                <a routerLink="bp-keys" routerLinkActive="active">
                  <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                  Keys
                </a>
              </li>
              <li>
                <a routerLink="bp-rewards" routerLinkActive="active">
                  <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  Rewards
                </a>
              </li>
              <li>
                <a routerLink="bp-votes" routerLinkActive="active">
                  <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                  Vote Analytics
                </a>
              </li>
            }

            <li class="nav-divider"></li>
            <li>
              <a routerLink="settings" routerLinkActive="active">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                Settings
                <span class="shortcut">Alt+O</span>
              </a>
            </li>
            <li>
              <a routerLink="about" routerLinkActive="active">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                About
              </a>
            </li>
          </ul>

          <!-- Theme toggle + version -->
          <div class="sidebar-footer">
            <button class="theme-toggle" (click)="theme.toggleBaseTheme()" title="Toggle light/dark theme">
              @if (theme.baseTheme() === 'dark') {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              } @else {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              }
            </button>
            <span class="version">v2.0.0-alpha</span>
          </div>
        </nav>

        <main class="content">
          @if (wallet.isWatchOnly()) {
            <div class="watch-banner">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <span>Watch-only account — import keys to enable transactions</span>
              <button class="banner-action">IMPORT KEY</button>
            </div>
          }
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    .dashboard {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: var(--bg-base);
    }

    /* ── Account tabs (top bar) ── */
    .account-tabs {
      display: flex;
      background: var(--bg-deep);
      border-bottom: 1px solid var(--border-subtle);
      overflow-x: auto;
      min-height: 40px;
    }

    .account-tab {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      padding: var(--sp-2) var(--sp-5);
      border: none;
      border-bottom: 2px solid transparent;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      white-space: nowrap;
      transition: color 150ms ease, border-color 150ms ease, background 150ms ease;
      min-width: 140px;
    }

    .account-tab:hover {
      background: var(--bg-hover);
      color: var(--text-body);
    }

    .account-tab.active {
      border-bottom-color: var(--accent);
      color: var(--text-bright);
      background: var(--bg-base);
    }

    .tab-name {
      font-family: var(--font-data);
      font-size: 13px;
      font-weight: 500;
    }

    .tab-balance {
      font-family: var(--font-data);
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 1px;
    }

    .add-tab {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 40px;
      padding: var(--sp-2);
      color: var(--text-disabled);
    }
    .add-tab:hover { color: var(--accent); }

    /* ── Main area (sidebar + content) ── */
    .main-area {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    /* ── Sidebar ── */
    .sidebar {
      width: 240px;
      min-width: 240px;
      background: var(--bg-deep);
      background-image: linear-gradient(to bottom, var(--chain-tint), transparent 60%);
      border-right: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      padding: var(--sp-5) 0;
      transition: background-image 300ms ease;
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      padding: 0 var(--sp-5);
      margin-bottom: var(--sp-5);
    }

    .sidebar-logo {
      width: 32px;
      height: 32px;
      filter: drop-shadow(0 0 6px rgba(0, 148, 210, 0.2));
    }

    .sidebar-brand {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-bright);
      letter-spacing: 0.5px;
    }

    .accent { color: var(--accent); }

    /* Account card */
    .account-card {
      margin: 0 var(--sp-4);
      padding: var(--sp-3) var(--sp-4);
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      margin-bottom: var(--sp-5);
    }

    .account-name {
      display: block;
      font-family: var(--font-data);
      font-size: 14px;
      font-weight: 500;
      color: var(--text-bright);
    }

    .account-chain {
      display: block;
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 2px;
    }

    /* Navigation */
    .nav-list {
      list-style: none;
      flex: 1;
      padding: 0;
    }

    .nav-list li a {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-2) var(--sp-5);
      text-decoration: none;
      color: var(--text-muted);
      font-size: 13px;
      font-weight: 500;
      border-left: 3px solid transparent;
      transition: color 150ms ease, background 150ms ease, border-color 150ms ease;
      position: relative;
    }

    .nav-list li a:hover {
      color: var(--text-body);
      background: var(--bg-hover);
    }

    .nav-list li a:hover .shortcut { opacity: 1; }

    .nav-list li a.active {
      color: var(--accent);
      border-left-color: var(--accent);
      background: var(--accent-muted);
    }

    .nav-icon { width: 18px; height: 18px; flex-shrink: 0; }

    .shortcut {
      margin-left: auto;
      font-size: 10px;
      color: var(--text-disabled);
      font-family: var(--font-data);
      opacity: 0;
      transition: opacity 150ms ease;
    }

    .nav-divider {
      height: 1px;
      background: var(--border-subtle);
      margin: var(--sp-3) var(--sp-5);
    }

    .nav-section-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--accent);
      padding: var(--sp-1) var(--sp-5);
      list-style: none;
    }

    /* Sidebar footer */
    .sidebar-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--sp-3) var(--sp-5);
      border-top: 1px solid var(--border-subtle);
      margin-top: var(--sp-3);
    }

    .theme-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: color 150ms ease, border-color 150ms ease;
    }
    .theme-toggle:hover {
      color: var(--accent);
      border-color: var(--accent);
    }

    .version {
      font-size: 11px;
      color: var(--text-disabled);
      font-family: var(--font-data);
    }

    /* Watch-only indicators */
    .watch-badge {
      display: inline-flex;
      align-items: center;
      margin-left: var(--sp-1);
      color: var(--caution);
      vertical-align: middle;
    }

    .account-tab.watch-only {
      border-left: 2px solid var(--caution);
    }

    .account-card-header {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
    }

    .mode-badge {
      font-family: var(--font-data);
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
      padding: 1px var(--sp-2);
      border-radius: var(--radius-full);
    }
    .mode-badge.watch {
      background: rgba(245, 166, 35, 0.15);
      color: var(--caution);
    }

    .watch-card {
      border: 1px solid rgba(245, 166, 35, 0.2);
    }

    .watch-banner {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-4);
      background: rgba(245, 166, 35, 0.08);
      border: 1px solid rgba(245, 166, 35, 0.15);
      border-radius: var(--radius-md);
      margin-bottom: var(--sp-6);
      font-size: 13px;
      color: var(--caution);
    }

    .banner-action {
      margin-left: auto;
      padding: var(--sp-1) var(--sp-3);
      border: 1px solid var(--caution);
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--caution);
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 150ms ease;
      white-space: nowrap;
    }
    .banner-action:hover { background: rgba(245, 166, 35, 0.1); }

    /* ── Content ── */
    .content {
      flex: 1;
      padding: var(--sp-8);
      overflow-y: auto;
      background: var(--bg-base);
    }
  `],
})
export class DashboardComponent {
  constructor(
    public wallet: WalletStateService,
    public theme: ThemeService,
  ) {}

  selectAccount(index: number) {
    this.wallet.selectAccount(index);
    // Apply chain theme from the selected account
    const account = this.wallet.accounts()[index];
    if (account) {
      this.theme.setChainByName(account.chainName);
    }
  }
}
