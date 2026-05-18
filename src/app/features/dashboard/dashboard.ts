import { Component, HostListener, computed, effect, ElementRef, signal, viewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { WalletStateService } from '../../core/services/wallet-state.service';
import { ThemeService } from '../../core/services/theme.service';
import { UiStateService } from '../../core/services/ui-state.service';
import { TauriIpcService } from '../../core/services/tauri-ipc.service';
import { ConfirmModalComponent } from '../../shared/confirm-modal';
import { WindowControlsComponent } from '../../shared/window-controls';

interface AccountTabFilter {
  chainId: string;
  chainName: string;
  count: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ConfirmModalComponent, WindowControlsComponent],
  template: `
    <div class="dashboard">
      <!-- Custom titlebar: brand + account tabs (browser-style) + drag region + window controls -->
      <div class="titlebar">
        <button class="titlebar-brand" type="button" title="Wallet overview" aria-label="Open wallet overview" (click)="openOverview()">
          <img src="assets/simpleos-logo.svg" alt="SimplEOS" class="titlebar-logo" />
          <span class="titlebar-name">Simpl<span class="accent">EOS</span></span>
        </button>
        @if (wallet.accounts().length > 0 && !ui.fullscreen()) {
          @if (accountChainFilters().length > 1) {
            <div class="chain-filter" #chainFilterRoot>
              <button class="chain-filter-trigger"
                      type="button"
                      title="Filter account tabs by chain"
                      aria-label="Filter account tabs by chain"
                      [attr.aria-expanded]="chainFilterOpen()"
                      aria-haspopup="menu"
                      (click)="toggleChainFilter()">
                <span class="chain-filter-icon" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a14.5 14.5 0 0 1 0 20"/><path d="M12 2a14.5 14.5 0 0 0 0 20"/></svg>
                </span>
                <span class="chain-filter-label">{{ selectedChainFilterLabel() }}</span>
                <span class="chain-filter-count">{{ visibleAccountTabs().length }}</span>
                <span class="chain-filter-arrow" [class.open]="chainFilterOpen()" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </span>
              </button>

              @if (chainFilterOpen()) {
                <div class="chain-filter-menu" role="menu" aria-label="Account tab chain filter">
                  <button type="button"
                          class="chain-filter-option"
                          [class.active]="selectedChainFilter() === 'all'"
                          role="menuitemradio"
                          [attr.aria-checked]="selectedChainFilter() === 'all'"
                          (click)="applyChainFilter('all')">
                    <span class="option-mark" aria-hidden="true"></span>
                    <span class="option-main">
                      <span class="option-name">All chains</span>
                      <span class="option-meta">{{ accountChainFilters().length }} networks</span>
                    </span>
                    <span class="option-count">{{ wallet.accounts().length }}</span>
                  </button>

                  <div class="chain-filter-divider" aria-hidden="true"></div>

                  @for (chain of accountChainFilters(); track chain.chainId) {
                    <button type="button"
                            class="chain-filter-option"
                            [class.active]="selectedChainFilter() === chain.chainId"
                            role="menuitemradio"
                            [attr.aria-checked]="selectedChainFilter() === chain.chainId"
                            (click)="applyChainFilter(chain.chainId)">
                      <span class="option-mark" aria-hidden="true"></span>
                      <span class="option-main">
                        <span class="option-name">{{ chain.chainName }}</span>
                        <span class="option-meta">{{ chain.count }} account{{ chain.count === 1 ? '' : 's' }}</span>
                      </span>
                      <span class="option-count">{{ chain.count }}</span>
                    </button>
                  }
                </div>
              }
            </div>
          }

          <div class="account-tabs-shell"
               [class.scrollable-left]="canScrollLeft()"
               [class.scrollable-right]="canScrollRight()">
            @if (canScrollLeft()) {
              <button class="tabs-nav tabs-nav-left"
                      type="button"
                      aria-label="Scroll account tabs left"
                      title="Scroll account tabs left"
                      (click)="scrollTabs('left')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            }

            <div class="account-tabs" #accountTabs (scroll)="updateTabScrollState()" (wheel)="onTabsWheel($event)">
              @for (tab of visibleAccountTabs(); track tab.account.chainId + tab.account.name) {
                <button class="account-tab"
                        [class.active]="tab.index === wallet.selectedIndex()"
                        [class.watch-only]="tab.account.mode === 'watch'"
                        [class.drag-over]="dragOverIndex === tab.index"
                        draggable="true"
                        (dragstart)="onDragStart($event, tab.index)"
                        (dragover)="onDragOver($event, tab.index)"
                        (dragleave)="onDragLeave()"
                        (drop)="onDrop($event, tab.index)"
                        (dragend)="onDragEnd()"
                        (click)="selectAccount(tab.index)">
                  <span class="tab-name">
                    {{ tab.account.name }}
                    @if (tab.account.mode === 'watch') {
                      <span class="watch-badge" title="Watch-only — no keys imported">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      </span>
                    }
                  </span>
                  <span class="tab-balance">{{ tab.account.info.core_liquid_balance ?? tab.account.extraBalances?.[0]?.amount ?? '—' }}</span>
                </button>
              }
              <button class="account-tab add-tab" title="Add account" (click)="addAccount()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>

            @if (canScrollRight()) {
              <button class="tabs-nav tabs-nav-right"
                      type="button"
                      aria-label="Scroll account tabs right"
                      title="Scroll account tabs right"
                      (click)="scrollTabs('right')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            }
          </div>
        }
        <div class="titlebar-drag-fill" data-tauri-drag-region></div>
        <app-window-controls />
      </div>

      <div class="main-area">
        @if (!ui.fullscreen()) {
        <nav class="sidebar">
          <!-- Active account info -->
          <div class="account-card" [class.watch-card]="wallet.isWatchOnly()" [class.overview-card]="!wallet.hasSelectedAccount()">
            @if (wallet.selectedAccount(); as account) {
              <div class="account-card-header">
                <span class="account-name">{{ account.name }}</span>
                @if (account.mode === 'watch') {
                  <span class="mode-badge watch">watch</span>
                }
              </div>
              <span class="account-chain">{{ account.chainName }}</span>
            } @else {
              <span class="account-name">Portfolio overview</span>
              <span class="account-chain">{{ wallet.accounts().length }} loaded account{{ wallet.accounts().length === 1 ? '' : 's' }}</span>
            }
          </div>

          <ul class="nav-list">
            <li>
              <a routerLink="home"
                 routerLinkActive="active"
                 [routerLinkActiveOptions]="{ exact: true }"
                 (click)="goHome()">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>
                Home
              </a>
            </li>

            @if (wallet.hasSelectedAccount()) {
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
            @if (wallet.activeChain().features.rex) {
              <li>
                <a routerLink="rex" routerLinkActive="active">
                  <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                  REX
                </a>
              </li>
            }
            <li>
              <a routerLink="dapp" routerLinkActive="active">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                DApps
              </a>
            </li>
            <li>
              <a routerLink="contracts" routerLinkActive="active">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 18 22 12 16 6"/><path d="M8 6 2 12 8 18"/><path d="m14 4-4 16"/></svg>
                Contracts
              </a>
            </li>
            <li>
              <a routerLink="msig-inbox" routerLinkActive="active">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9"/><polyline points="2 6 12 13 22 6"/><circle cx="18" cy="18" r="4"/><path d="m16 18 1.5 1.5L20 17"/></svg>
                Multisig Inbox
              </a>
            </li>

            @if (wallet.isFio()) {
              <li class="nav-divider"></li>
              <li>
                <a routerLink="fio-handles" routerLinkActive="active">
                  <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                  FIO Handles
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
            } @else {
              <li class="nav-hint">
                Select an account from Home to open history, transfers, voting, and chain resources.
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

          <!-- Lock toggle + Theme toggle + version -->
          <div class="sidebar-footer">
            @if (wallet.securityMode() === 'ManualToggle') {
              <button class="lock-toggle" (click)="toggleLock()" [title]="wallet.locked() ? 'Unlock wallet' : 'Lock wallet'">
                @if (wallet.locked()) {
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                } @else {
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--positive)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                }
              </button>
            }
            @if (wallet.securityMode() === 'SignPerUse') {
              <span class="mode-badge" title="Passphrase required for each transaction">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </span>
            }
            <button class="theme-toggle" (click)="lockWallet()" title="Lock wallet">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </button>
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
        }

        <main class="content" [class.fullscreen]="ui.fullscreen()">
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

      <app-confirm-modal />
    </div>
  `,
  styles: [`
    .dashboard {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: var(--bg-base);
    }

    /* ── Custom titlebar (browser-style: tabs + drag region + window controls) ── */
    .titlebar {
      display: flex;
      align-items: stretch;
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--chain-tint) 80%, var(--bg-deep)), var(--bg-deep));
      border-bottom: 1px solid var(--border-subtle);
      min-height: 40px;
      /* Entire strip acts as a drag handle where children don't opt out. */
      -webkit-app-region: drag;
    }

    /* Brand area on the far left of the titlebar — logo + wordmark.
       Acts as a drag region (entire area is -webkit-app-region: drag
       via inherited titlebar rule; image and span have data-tauri-drag-region
       set explicitly for Tauri's JS drag handler). */
    .titlebar-brand {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      padding: 0 var(--sp-4) 0 var(--sp-4);
      flex-shrink: 0;
      border: none;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      -webkit-app-region: no-drag;
      transition: background 150ms ease, color 150ms ease;
    }
    :host-context(html.os-mac) .titlebar-brand {
      /* Reserve space for native traffic lights positioned at x=14. */
      padding-left: 84px;
    }
    .titlebar-brand:hover {
      background: color-mix(in srgb, var(--accent) 10%, transparent);
    }
    .titlebar-logo {
      width: 20px;
      height: 20px;
      filter: drop-shadow(0 0 6px rgba(0, 148, 210, 0.25));
    }
    .titlebar-name {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.4px;
      color: var(--text-bright);
    }
    .titlebar-name .accent { color: var(--accent); }

    .chain-filter {
      position: relative;
      display: inline-flex;
      align-items: center;
      align-self: stretch;
      flex: 0 0 auto;
      padding: 5px var(--sp-3) 0 var(--sp-2);
      margin-left: var(--sp-2);
      -webkit-app-region: no-drag;
      z-index: 20;
    }

    .chain-filter::before {
      content: '';
      width: 1px;
      height: 22px;
      margin-right: var(--sp-3);
      background: color-mix(in srgb, var(--border-subtle) 78%, transparent);
    }

    .chain-filter-trigger {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      height: 30px;
      min-width: 150px;
      max-width: 190px;
      padding: 0 9px;
      border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--border-subtle));
      border-radius: var(--radius-sm);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent),
        color-mix(in srgb, var(--bg-base) 88%, var(--accent) 12%);
      color: var(--text-body);
      cursor: pointer;
      transition: border-color 150ms ease, background 150ms ease, color 150ms ease, transform 150ms ease;
    }

    .chain-filter-trigger:hover,
    .chain-filter-trigger[aria-expanded="true"] {
      border-color: color-mix(in srgb, var(--accent) 42%, var(--border-subtle));
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.045), transparent),
        color-mix(in srgb, var(--bg-base) 80%, var(--accent) 20%);
      color: var(--text-bright);
    }

    .chain-filter-trigger:active {
      transform: translateY(1px);
    }

    .chain-filter-icon,
    .chain-filter-arrow {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: currentColor;
      opacity: 0.82;
      flex-shrink: 0;
    }

    .chain-filter-arrow {
      margin-left: auto;
      transition: transform 150ms ease;
    }

    .chain-filter-arrow.open {
      transform: rotate(180deg);
    }

    .chain-filter-label {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: var(--font-data);
      font-size: 12px;
      font-weight: 700;
    }

    .chain-filter-count,
    .option-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      height: 18px;
      padding: 0 6px;
      border-radius: var(--radius-full);
      background: color-mix(in srgb, var(--accent) 16%, transparent);
      color: var(--accent);
      font-family: var(--font-data);
      font-size: 10px;
      font-weight: 700;
      line-height: 1;
      flex-shrink: 0;
    }

    .chain-filter-menu {
      position: absolute;
      top: calc(100% + 7px);
      left: calc(var(--sp-2) + var(--sp-3) + 1px);
      width: 218px;
      max-height: min(340px, calc(100vh - 92px));
      overflow-y: auto;
      padding: 6px;
      border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--border-subtle));
      border-radius: var(--radius-md);
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--chain-tint) 95%, transparent), transparent 54%),
        var(--bg-deep);
      box-shadow: 0 18px 36px rgba(0, 0, 0, 0.34);
    }

    .chain-filter-option {
      display: grid;
      grid-template-columns: 14px minmax(0, 1fr) auto;
      align-items: center;
      gap: 9px;
      width: 100%;
      min-height: 38px;
      padding: 7px 8px;
      border: 0;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-muted);
      text-align: left;
      cursor: pointer;
      transition: background 150ms ease, color 150ms ease;
    }

    .chain-filter-option:hover,
    .chain-filter-option.active {
      background: color-mix(in srgb, var(--accent) 12%, transparent);
      color: var(--text-bright);
    }

    .chain-filter-option.active .option-mark {
      background: var(--accent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent);
    }

    .option-mark {
      width: 7px;
      height: 7px;
      border-radius: var(--radius-full);
      background: color-mix(in srgb, var(--text-muted) 34%, transparent);
    }

    .option-main {
      display: flex;
      flex-direction: column;
      min-width: 0;
      gap: 2px;
    }

    .option-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: var(--font-data);
      font-size: 12px;
      font-weight: 700;
    }

    .option-meta {
      color: var(--text-disabled);
      font-size: 10px;
      font-weight: 600;
    }

    .chain-filter-divider {
      height: 1px;
      margin: 5px 4px;
      background: var(--border-subtle);
    }

    .titlebar-drag-fill {
      /* Chrome-style minimum drag region after the tabs / + button.
         Grows to consume remaining space so users always have somewhere
         to grab the window. */
      flex: 1 1 120px;
      min-width: 120px;
      align-self: stretch;
    }

    /* ── Account tabs (inside the titlebar) ── */
    .account-tabs-shell {
      position: relative;
      flex: 1 1 auto;
      min-width: 0;
      max-width: min(920px, calc(100vw - 320px));
      overflow: hidden;
      -webkit-app-region: no-drag;
    }

    .account-tabs-shell::before,
    .account-tabs-shell::after {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      width: 18px;
      pointer-events: none;
      z-index: 1;
      opacity: 0;
      transition: opacity 150ms ease;
    }

    .account-tabs-shell::before {
      left: 0;
      background: linear-gradient(90deg, var(--bg-deep), transparent);
    }

    .account-tabs-shell::after {
      right: 0;
      background: linear-gradient(270deg, var(--bg-deep), transparent);
    }

    .account-tabs-shell.scrollable-left::before,
    .account-tabs-shell.scrollable-right::after {
      opacity: 1;
    }

    .account-tabs {
      display: flex;
      align-items: stretch;
      height: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      padding: 0 calc(var(--sp-4) + 28px) 0 calc(var(--sp-2) + 28px);
      scrollbar-width: none;
      -ms-overflow-style: none;
      scroll-snap-type: x proximity;
      /* Buttons inside are interactive — opt out of drag. */
      -webkit-app-region: no-drag;
    }

    .account-tabs::-webkit-scrollbar {
      display: none;
      height: 0;
    }

    .tabs-nav {
      position: absolute;
      top: 50%;
      z-index: 2;
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid color-mix(in srgb, var(--accent) 20%, var(--border-subtle));
      border-radius: var(--radius-full);
      background: color-mix(in srgb, var(--bg-base) 92%, var(--accent) 8%);
      color: var(--text-body);
      cursor: pointer;
      transform: translateY(-50%);
      box-shadow: 0 8px 18px rgba(0, 0, 0, 0.18);
      transition: color 150ms ease, border-color 150ms ease, background 150ms ease, transform 150ms ease;
      -webkit-app-region: no-drag;
    }

    .tabs-nav:hover {
      color: var(--text-bright);
      border-color: color-mix(in srgb, var(--accent) 36%, var(--border-subtle));
      background: color-mix(in srgb, var(--bg-base) 86%, var(--accent) 14%);
    }

    .tabs-nav:active {
      transform: translateY(-50%) scale(0.96);
    }

    .tabs-nav-left {
      left: 2px;
    }

    .tabs-nav-right {
      right: 2px;
    }

    .account-tab {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      gap: 2px;
      padding: var(--sp-2) var(--sp-4);
      margin: 4px 0 0;
      border: none;
      border-bottom: 2px solid transparent;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      white-space: nowrap;
      transition: color 150ms ease, border-color 150ms ease, background 150ms ease, transform 150ms ease;
      min-width: 124px;
      max-width: 176px;
      scroll-snap-align: start;
      border-radius: 10px 10px 0 0;
    }

    .account-tab:hover {
      background: color-mix(in srgb, var(--accent) 8%, var(--bg-hover));
      color: var(--text-body);
    }

    .account-tab.active {
      border-bottom-color: var(--accent);
      color: var(--text-bright);
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--accent) 14%, transparent), transparent 75%),
        var(--bg-base);
      transform: translateY(-1px);
    }

    .tab-name {
      font-family: var(--font-data);
      font-size: 13px;
      font-weight: 500;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tab-balance {
      font-family: var(--font-data);
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 1px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .account-tab[draggable="true"] {
      cursor: grab;
    }
    .account-tab[draggable="true"]:active {
      cursor: grabbing;
    }
    .account-tab.drag-over {
      border-left: 2px solid var(--accent);
    }
    :host-context(.dragging) .account-tab {
      opacity: 0.7;
    }

    .add-tab {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
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
      background-image:
        linear-gradient(to bottom, color-mix(in srgb, var(--chain-tint) 180%, transparent), transparent 60%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.025), transparent 32%);
      border-right: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      padding: var(--sp-5) 0;
      transition: background-image 300ms ease;
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

    .overview-card {
      border: 1px solid rgba(0, 148, 210, 0.18);
      background:
        radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 16%, transparent), transparent 48%),
        linear-gradient(180deg, color-mix(in srgb, var(--accent) 10%, transparent), transparent),
        var(--bg-raised);
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.12);
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

    .nav-hint {
      margin: var(--sp-2) var(--sp-5) 0;
      padding: var(--sp-3);
      border: 1px dashed color-mix(in srgb, var(--accent) 22%, var(--border-subtle));
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      font-size: 12px;
      line-height: 1.45;
      background: color-mix(in srgb, var(--accent) 4%, transparent);
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

    .lock-toggle {
      width: 32px;
      height: 32px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-subtle);
      background: var(--bg-base);
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.15s, color 0.15s;
    }
    .lock-toggle:hover {
      border-color: var(--accent);
      color: var(--text-bright);
    }
    .mode-badge {
      display: flex;
      align-items: center;
      color: var(--accent);
      opacity: 0.6;
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
      background:
        radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 10%, transparent), transparent 24%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.015), transparent 18%),
        var(--bg-base);
    }
    .content.fullscreen {
      padding: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
  `],
})
export class DashboardComponent {
  readonly accountTabs = viewChild<ElementRef<HTMLDivElement>>('accountTabs');
  readonly chainFilterRoot = viewChild<ElementRef<HTMLElement>>('chainFilterRoot');
  readonly canScrollLeft = signal(false);
  readonly canScrollRight = signal(false);
  readonly chainFilterOpen = signal(false);
  readonly selectedChainFilter = signal('all');
  readonly accountChainFilters = computed<AccountTabFilter[]>(() => {
    const chainOrder = new Map(this.wallet.chains().map((chain, index) => [chain.id, index]));
    const filters = new Map<string, AccountTabFilter>();

    for (const account of this.wallet.accounts()) {
      const current = filters.get(account.chainId);
      if (current) {
        current.count += 1;
      } else {
        filters.set(account.chainId, {
          chainId: account.chainId,
          chainName: account.chainName,
          count: 1,
        });
      }
    }

    return [...filters.values()].sort((left, right) => {
      const leftOrder = chainOrder.get(left.chainId) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = chainOrder.get(right.chainId) ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.chainName.localeCompare(right.chainName);
    });
  });
  readonly visibleAccountTabs = computed(() => {
    const filter = this.selectedChainFilter();
    return this.wallet.accounts()
      .map((account, index) => ({ account, index }))
      .filter(tab => filter === 'all' || tab.account.chainId === filter);
  });
  readonly selectedChainFilterLabel = computed(() => {
    const filter = this.selectedChainFilter();
    if (filter === 'all') return 'All';
    return this.accountChainFilters().find(chain => chain.chainId === filter)?.chainName ?? 'All';
  });
  dragSourceIndex: number | null = null;
  dragOverIndex: number | null = null;

  constructor(
    public wallet: WalletStateService,
    public theme: ThemeService,
    public ui: UiStateService,
    private router: Router,
    private ipc: TauriIpcService,
  ) {
    effect((onCleanup) => {
      const tabsRef = this.accountTabs();
      const accountCount = this.visibleAccountTabs().length;
      const fullscreen = this.ui.fullscreen();

      if (!tabsRef || accountCount === 0 || fullscreen) {
        this.canScrollLeft.set(false);
        this.canScrollRight.set(false);
        return;
      }

      const element = tabsRef.nativeElement;
      const resizeObserver = new ResizeObserver(() => this.updateTabScrollState());
      resizeObserver.observe(element);

      const frameId = requestAnimationFrame(() => this.updateTabScrollState());

      onCleanup(() => {
        resizeObserver.disconnect();
        cancelAnimationFrame(frameId);
      });
    });

    effect((onCleanup) => {
      const tabsRef = this.accountTabs();
      const selectedIndex = this.wallet.selectedIndex();

      if (!tabsRef || selectedIndex === null) {
        return;
      }

      const element = tabsRef.nativeElement;
      const frameId = requestAnimationFrame(() => {
        const activeTab = element.querySelector<HTMLButtonElement>('.account-tab.active');
        activeTab?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
        this.updateTabScrollState();
      });

      onCleanup(() => cancelAnimationFrame(frameId));
    });

    effect(() => {
      const filters = this.accountChainFilters();
      const selected = this.selectedChainFilter();
      if (filters.length <= 1) {
        this.chainFilterOpen.set(false);
      }
      if (selected !== 'all' && !filters.some(chain => chain.chainId === selected)) {
        this.selectedChainFilter.set('all');
      }
    });

    effect(() => {
      const account = this.wallet.selectedAccount();
      if (account) {
        this.theme.setChainByName(account.chainName);
      }
    });
  }

  @HostListener('document:click', ['$event'])
  closeChainFilterFromOutside(event: MouseEvent) {
    const root = this.chainFilterRoot()?.nativeElement;
    if (!root || root.contains(event.target as Node)) return;
    this.chainFilterOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  closeChainFilterFromEscape() {
    this.chainFilterOpen.set(false);
  }

  updateTabScrollState() {
    const element = this.accountTabs()?.nativeElement;
    if (!element) {
      this.canScrollLeft.set(false);
      this.canScrollRight.set(false);
      return;
    }

    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    this.canScrollLeft.set(element.scrollLeft > 4);
    this.canScrollRight.set(element.scrollLeft < maxScrollLeft - 4);
  }

  toggleChainFilter() {
    this.chainFilterOpen.update(open => !open);
  }

  applyChainFilter(nextFilter: string) {
    const filterExists = nextFilter === 'all' || this.accountChainFilters().some(chain => chain.chainId === nextFilter);
    const filter = filterExists ? nextFilter : 'all';
    this.selectedChainFilter.set(filter);
    this.chainFilterOpen.set(false);

    if (filter !== 'all') {
      const firstAccountOnChain = this.wallet.accounts().findIndex(account => account.chainId === filter);
      if (firstAccountOnChain >= 0) {
        this.selectAccount(firstAccountOnChain);
      }
    }

    const element = this.accountTabs()?.nativeElement;
    if (element) {
      element.scrollTo({ left: 0, behavior: 'smooth' });
      requestAnimationFrame(() => this.updateTabScrollState());
    }
  }

  scrollTabs(direction: 'left' | 'right') {
    const element = this.accountTabs()?.nativeElement;
    if (!element) return;

    const delta = Math.max(180, Math.round(element.clientWidth * 0.55));
    element.scrollBy({
      left: direction === 'right' ? delta : -delta,
      behavior: 'smooth',
    });
  }

  onTabsWheel(event: WheelEvent) {
    const element = this.accountTabs()?.nativeElement;
    if (!element || element.scrollWidth <= element.clientWidth) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

    event.preventDefault();
    element.scrollBy({ left: event.deltaY });
  }

  onDragStart(event: DragEvent, index: number) {
    this.dragSourceIndex = index;
    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('text/plain', String(index));
  }

  onDragOver(event: DragEvent, index: number) {
    if (this.dragSourceIndex === null || this.dragSourceIndex === index) return;
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
    this.dragOverIndex = index;
  }

  onDragLeave() {
    this.dragOverIndex = null;
  }

  onDrop(event: DragEvent, targetIndex: number) {
    event.preventDefault();
    if (this.dragSourceIndex === null || this.dragSourceIndex === targetIndex) return;
    this.wallet.reorderAccount(this.dragSourceIndex, targetIndex);
    // Update theme to match newly selected account
    const account = this.wallet.selectedAccount();
    if (account) this.theme.setChainByName(account.chainName);
    this.dragSourceIndex = null;
    this.dragOverIndex = null;
  }

  onDragEnd() {
    this.dragSourceIndex = null;
    this.dragOverIndex = null;
  }

  selectAccount(index: number) {
    this.wallet.selectAccount(index);
    const account = this.wallet.accounts()[index];
    if (account) {
      this.theme.setChainByName(account.chainName);
      if (this.router.url === '/dashboard' || this.router.url.startsWith('/dashboard/home')) {
        this.router.navigate(['/dashboard/wallet']);
      }
    }
  }

  openOverview() {
    this.wallet.clearSelectedAccount();
    this.router.navigate(['/dashboard/home']);
  }

  goHome() {
    this.openOverview();
  }

  addAccount() {
    this.router.navigate(['/landing']);
  }

  async lockWallet() {
    // Close the DApp window before navigating to the lockscreen
    await this.ipc.closeDappBrowser();
    await this.wallet.lock();
    this.router.navigate(['/lockscreen']);
  }

  async toggleLock() {
    if (this.wallet.locked()) {
      // Prompt for passphrase — use a simple prompt for now
      const passphrase = prompt('Enter passphrase to unlock');
      if (passphrase) {
        const success = await this.wallet.unlock(passphrase);
        if (!success) {
          alert('Invalid passphrase');
        }
      }
    } else {
      await this.wallet.lock();
    }
  }
}
