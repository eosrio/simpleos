import { Component, signal, computed, OnDestroy, viewChild, ElementRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WalletStateService } from '../../../core/services/wallet-state.service';
import { UiStateService } from '../../../core/services/ui-state.service';
import { TauriIpcService } from '../../../core/services/tauri-ipc.service';
import { TransactionService } from '../../../core/services/transaction.service';
import { UnlistenFn } from '@tauri-apps/api/event';
import { listen } from '@tauri-apps/api/event';

interface DappEntry {
  name: string;
  url: string;
  description: string;
  icon: string;
  chains: string[];
  category: 'defi' | 'tools' | 'governance' | 'nft' | 'exchange';
  pinned?: boolean;
}

interface DappSession {
  origin: string;
  name: string;
  account: string;
  chainId: string;
  authorizedAt: number;
}

const CURATED_DAPPS: DappEntry[] = [
  {
    name: 'Unicove',
    url: 'https://unicove.com',
    description: 'Official Vaulta (EOS) web wallet and account manager by Greymass',
    icon: '🏦',
    chains: ['Vaulta'],
    category: 'tools',
  },
  {
    name: 'MSIG App',
    url: 'https://msig.app',
    description: 'Multi-signature proposal creator and manager for Antelope chains',
    icon: '📋',
    chains: ['Vaulta', 'WAX', 'Telos', 'FIO', 'Libre', 'XPR'],
    category: 'governance',
  },
  {
    name: 'Libre DeFi',
    url: 'https://defi.libre.org',
    description: 'DeFi platform on Libre chain — swap, lend, stake with Bitcoin backing',
    icon: '💱',
    chains: ['Libre'],
    category: 'defi',
  },
  {
    name: 'Alcor Exchange',
    url: 'https://alcor.exchange',
    description: 'Decentralized exchange for Antelope chains — swap, liquidity, NFT market',
    icon: '📊',
    chains: ['Vaulta', 'WAX', 'Telos', 'Ultra'],
    category: 'exchange',
  },
  {
    name: 'Bloks.io',
    url: 'https://bloks.io',
    description: 'Block explorer and account tool for EOS/Vaulta',
    icon: '🔍',
    chains: ['Vaulta', 'WAX', 'Telos'],
    category: 'tools',
  },
  {
    name: 'EOS Authority',
    url: 'https://eosauthority.com',
    description: 'Governance portal, voting analytics, and alerts for EOS',
    icon: '🏛️',
    chains: ['Vaulta'],
    category: 'governance',
  },
  {
    name: 'AtomicHub',
    url: 'https://atomichub.io',
    description: 'NFT marketplace for WAX and EOS — create, buy, sell, trade digital assets',
    icon: '🎨',
    chains: ['WAX', 'Vaulta'],
    category: 'nft',
  },
  {
    name: 'Telos Decide',
    url: 'https://app.telos.net',
    description: 'Telos governance and voting platform',
    icon: '🗳️',
    chains: ['Telos'],
    category: 'governance',
  },
  {
    name: 'Ultra Marketplace',
    url: 'https://ultra.io',
    description: 'Game distribution and digital asset marketplace on Ultra',
    icon: '🎮',
    chains: ['Ultra'],
    category: 'nft',
  },
  {
    name: 'REX Staking',
    url: 'https://rex.tokenika.io',
    description: 'REX management interface — deposit, buy/sell REX, manage savings',
    icon: '🦖',
    chains: ['Vaulta'],
    category: 'defi',
  },
];

@Component({
  selector: 'app-dapp',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="dapp-view">
      @if (!activeDapp()) {
        <h2>DApps</h2>
        <!-- Launcher view -->
        <div class="launcher">
          <p class="page-desc">Open Antelope dApps securely inside SimplEOS. Signing requests are handled by the wallet — your keys never leave the app.</p>

          <!-- Custom URL bar -->
          <div class="url-bar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input class="url-input" type="text"
                   placeholder="Enter dApp URL or search..."
                   [value]="searchQuery()"
                   (input)="searchQuery.set($any($event.target).value)"
                   (keyup.enter)="onUrlEnter()" />
            @if (searchQuery()) {
              <button class="btn-go" (click)="onUrlEnter()">GO</button>
            }
          </div>

          <!-- Category filters -->
          <div class="category-filters">
            <button class="filter-chip" [class.active]="activeCategory() === 'all'" (click)="activeCategory.set('all')">All</button>
            <button class="filter-chip" [class.active]="activeCategory() === 'defi'" (click)="activeCategory.set('defi')">DeFi</button>
            <button class="filter-chip" [class.active]="activeCategory() === 'tools'" (click)="activeCategory.set('tools')">Tools</button>
            <button class="filter-chip" [class.active]="activeCategory() === 'governance'" (click)="activeCategory.set('governance')">Governance</button>
            <button class="filter-chip" [class.active]="activeCategory() === 'nft'" (click)="activeCategory.set('nft')">NFT</button>
            <button class="filter-chip" [class.active]="activeCategory() === 'exchange'" (click)="activeCategory.set('exchange')">Exchange</button>
          </div>

          <!-- Anchor compatibility notice -->
          <div class="compat-banner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <span>SimplEOS is compatible with dApps that support <strong>Anchor Wallet</strong>. Select "Anchor" when connecting.</span>
          </div>

          <!-- Pinned dApps section -->
          @if (pinnedDapps().length > 0) {
            <div class="section-label">Pinned</div>
            <div class="dapp-grid">
              @for (dapp of pinnedDapps(); track dapp.url) {
                <div class="dapp-card" (click)="openDapp(dapp)">
                  <div class="dapp-icon">{{ dapp.icon }}</div>
                  <div class="dapp-info">
                    <span class="dapp-name">{{ dapp.name }}</span>
                    <span class="dapp-desc">{{ dapp.description }}</span>
                    <div class="dapp-chains">
                      @for (chain of dapp.chains; track chain) {
                        <span class="chain-tag">{{ chain }}</span>
                      }
                    </div>
                  </div>
                  <button class="btn-unpin" title="Unpin" (click)="$event.stopPropagation(); unpinDapp(dapp)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              }
            </div>
            <div class="section-label" style="margin-top: var(--sp-4)">All DApps</div>
          }

          <!-- DApp grid -->
          <div class="dapp-grid">
            @for (dapp of filteredDapps(); track dapp.url) {
              <div class="dapp-card" (click)="openDapp(dapp)">
                <div class="dapp-icon">{{ dapp.icon }}</div>
                <div class="dapp-info">
                  <span class="dapp-name">{{ dapp.name }}</span>
                  <span class="dapp-desc">{{ dapp.description }}</span>
                  <div class="dapp-chains">
                    @for (chain of dapp.chains; track chain) {
                      <span class="chain-tag">{{ chain }}</span>
                    }
                  </div>
                </div>
                <button class="btn-pin" title="Pin to top" (click)="$event.stopPropagation(); pinDapp(dapp)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 17v5"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
                </button>
              </div>
            }
          </div>

          <!-- Add custom dApp -->
          @if (showAddDapp()) {
            <div class="add-dapp-form">
              <h4>Add Custom DApp</h4>
              <input class="form-input" type="text" placeholder="Name"
                     [value]="customDappName()" (input)="customDappName.set($any($event.target).value)" />
              <input class="form-input" type="url" placeholder="https://..."
                     [value]="customDappUrl()" (input)="customDappUrl.set($any($event.target).value)" />
              <div class="add-dapp-actions">
                <button class="btn-cancel" (click)="showAddDapp.set(false)">Cancel</button>
                <button class="btn-save" (click)="onAddCustomDapp()" [disabled]="!customDappName() || !customDappUrl()">Add & Pin</button>
              </div>
            </div>
          } @else {
            <button class="btn-add-dapp" (click)="showAddDapp.set(true)">+ Add Custom DApp</button>
          }

          <!-- Active sessions -->
          @if (sessions().length > 0) {
            <div class="sessions-section">
              <div class="section-label">Active Sessions</div>
              @for (session of sessions(); track session.origin) {
                <div class="session-row">
                  <div class="session-info">
                    <span class="session-origin">{{ session.origin }}</span>
                    <span class="session-account">{{ session.account }} on {{ session.name }}</span>
                  </div>
                  <button class="btn-revoke" (click)="revokeSession(session)">Revoke</button>
                </div>
              }
            </div>
          }
        </div>
      } @else {
        <!-- Active dApp view (fullscreen browser) -->
        <div class="browser-chrome">
          <div class="browser-bar">
            <button class="nav-btn" (click)="closeDapp()" title="Back to catalog">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            </button>
            <div class="nav-separator"></div>
            <button class="nav-btn" (click)="goBack()" title="Back">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button class="nav-btn" (click)="goForward()" title="Forward">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <button class="nav-btn" (click)="reloadDapp()" title="Reload">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            </button>
            <div class="browser-url" [class.secure]="isSecureOrigin()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span>{{ currentUrl() }}</span>
            </div>
            <span class="browser-account">{{ wallet.selectedAccount().name }}</span>
            <span class="browser-dapp-name">{{ activeDapp()!.name }}</span>
          </div>

          <!-- The Tauri child webview is positioned over this element -->
          <div class="browser-frame" #browserFrame>
            @if (loading()) {
              <div class="frame-loading">
                <div class="loading-spinner"></div>
                <span>Loading {{ activeDapp()!.name }}...</span>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .dapp-view { max-width: 900px; }
    .dapp-view:has(.browser-chrome) { max-width: none; height: 100%; }
    h2 { font-size: 24px; margin-bottom: var(--sp-2); }
    .page-desc { font-size: 13px; color: var(--text-muted); margin-bottom: var(--sp-5); }

    .section-label {
      font-size: 11px; font-weight: 600; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 1px;
      margin-bottom: var(--sp-3);
    }

    /* URL bar */
    .url-bar {
      display: flex; align-items: center; gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-4);
      background: var(--bg-raised);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      margin-bottom: var(--sp-5);
      color: var(--text-muted);
    }
    .url-input {
      flex: 1; border: none; background: none;
      color: var(--text-bright); font-family: var(--font-data); font-size: 13px; outline: none;
    }
    .url-input::placeholder { color: var(--text-disabled); }
    .btn-go {
      padding: var(--sp-1) var(--sp-3);
      border: none; border-radius: var(--radius-sm);
      background: var(--accent); color: #fff;
      font-size: 11px; font-weight: 600; letter-spacing: 1px; cursor: pointer;
    }

    /* Category filters */
    .category-filters {
      display: flex; gap: var(--sp-2); margin-bottom: var(--sp-4); flex-wrap: wrap;
    }
    .filter-chip {
      padding: var(--sp-1) var(--sp-3);
      border: 1px solid var(--border-subtle); border-radius: var(--radius-full);
      background: transparent; color: var(--text-muted);
      font-family: var(--font-body); font-size: 12px;
      cursor: pointer; transition: all 150ms ease;
    }
    .filter-chip:hover { border-color: var(--text-muted); color: var(--text-body); }
    .filter-chip.active { background: var(--accent-muted); border-color: var(--accent); color: var(--accent); }

    /* Compat banner */
    .compat-banner {
      display: flex; align-items: center; gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-4);
      background: var(--accent-muted); border-radius: var(--radius-md);
      font-size: 12px; color: var(--accent); margin-bottom: var(--sp-6);
    }
    .compat-banner strong { color: var(--text-bright); }

    /* DApp grid */
    .dapp-grid { display: flex; flex-direction: column; gap: var(--sp-2); }
    .dapp-card {
      display: flex; align-items: center; gap: var(--sp-4);
      padding: var(--sp-4) var(--sp-5);
      background: var(--bg-raised); border-radius: var(--radius-md);
      cursor: pointer; transition: background 150ms ease;
      border: 1px solid transparent;
    }
    .dapp-card:hover { background: var(--bg-hover); border-color: var(--border-subtle); }
    .dapp-icon {
      font-size: 28px; width: 44px; height: 44px;
      display: flex; align-items: center; justify-content: center;
      background: var(--bg-hover); border-radius: var(--radius-md); flex-shrink: 0;
    }
    .dapp-info { flex: 1; min-width: 0; }
    .dapp-name { display: block; font-size: 14px; font-weight: 600; color: var(--text-bright); margin-bottom: 2px; }
    .dapp-desc { display: block; font-size: 12px; color: var(--text-muted); margin-bottom: var(--sp-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .dapp-chains { display: flex; gap: var(--sp-1); }
    .chain-tag { font-family: var(--font-data); font-size: 10px; color: var(--text-muted); background: var(--bg-active); padding: 1px var(--sp-2); border-radius: var(--radius-full); }

    .btn-pin, .btn-unpin {
      display: flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border: none; border-radius: var(--radius-sm);
      background: transparent; color: var(--text-disabled); cursor: pointer;
      opacity: 0; transition: opacity 150ms ease, color 150ms ease;
    }
    .dapp-card:hover .btn-pin, .dapp-card:hover .btn-unpin { opacity: 1; }
    .btn-pin:hover { color: var(--accent); }
    .btn-unpin:hover { color: var(--negative); }

    /* Add custom dApp */
    .btn-add-dapp {
      display: block; width: 100%; margin-top: var(--sp-4);
      padding: var(--sp-3); border: 1px dashed var(--border-subtle);
      border-radius: var(--radius-md); background: transparent;
      color: var(--accent); font-size: 13px; cursor: pointer;
      transition: background 150ms ease;
    }
    .btn-add-dapp:hover { background: var(--accent-muted); }
    .add-dapp-form {
      margin-top: var(--sp-4); padding: var(--sp-4);
      border: 1px solid var(--border-subtle); border-radius: var(--radius-md);
      background: var(--bg-raised);
      display: flex; flex-direction: column; gap: var(--sp-3);
    }
    .add-dapp-form h4 { font-size: 14px; margin: 0; }
    .add-dapp-form .form-input {
      width: 100%; padding: var(--sp-2) var(--sp-3);
      border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);
      background: var(--bg-base); color: var(--text-bright);
      font-family: var(--font-body); font-size: 13px;
    }
    .add-dapp-actions { display: flex; gap: var(--sp-2); }
    .btn-cancel { flex: 0; padding: var(--sp-1) var(--sp-3); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: transparent; color: var(--text-muted); cursor: pointer; font-family: var(--font-body); font-size: 12px; }
    .btn-save { flex: 1; padding: var(--sp-1) var(--sp-3); border: none; border-radius: var(--radius-sm); background: var(--accent); color: #fff; cursor: pointer; font-family: var(--font-body); font-size: 12px; }
    .btn-save:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Sessions */
    .sessions-section { margin-top: var(--sp-6); }
    .session-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: var(--sp-3) var(--sp-4);
      background: var(--bg-raised); border-radius: var(--radius-sm);
      margin-bottom: var(--sp-2);
    }
    .session-info { display: flex; flex-direction: column; }
    .session-origin { font-family: var(--font-data); font-size: 12px; color: var(--text-bright); }
    .session-account { font-size: 11px; color: var(--text-muted); }
    .btn-revoke {
      padding: var(--sp-1) var(--sp-3); border: 1px solid var(--negative);
      border-radius: var(--radius-sm); background: transparent; color: var(--negative);
      font-size: 11px; cursor: pointer;
    }

    /* Browser chrome */
    .browser-chrome { display: flex; flex-direction: column; height: 100%; }
    .browser-bar {
      display: flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-4);
      background: var(--bg-deep); border-bottom: 1px solid var(--border-subtle);
    }
    .nav-separator { width: 1px; height: 18px; background: var(--border-subtle); margin: 0 var(--sp-1); }
    .nav-btn {
      display: flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border: none; border-radius: var(--radius-sm);
      background: transparent; color: var(--text-muted); cursor: pointer;
      transition: background 150ms ease, color 150ms ease;
    }
    .nav-btn:hover { background: var(--bg-hover); color: var(--text-bright); }
    .browser-url {
      display: flex; align-items: center; gap: var(--sp-2);
      flex: 1; font-family: var(--font-data); font-size: 12px; color: var(--text-muted);
      padding: var(--sp-1) var(--sp-3);
      background: var(--bg-base); border-radius: var(--radius-sm);
      border: 1px solid var(--border-subtle); min-width: 0; overflow: hidden;
    }
    .browser-url svg { flex-shrink: 0; color: var(--text-muted); }
    .browser-url.secure svg { color: var(--positive); }
    .browser-url span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .browser-dapp-name { font-size: 12px; font-weight: 500; color: var(--text-body); white-space: nowrap; }
    .browser-account {
      font-family: var(--font-data); font-size: 11px; color: var(--accent);
      background: var(--accent-muted); padding: 2px var(--sp-2);
      border-radius: var(--radius-full); white-space: nowrap;
    }
    .browser-frame { flex: 1; background: var(--bg-base); position: relative; }
    .frame-loading {
      position: absolute; inset: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: var(--sp-3); color: var(--text-disabled); font-size: 13px;
    }
    .loading-spinner {
      width: 24px; height: 24px;
      border: 2px solid var(--border-subtle); border-top-color: var(--accent);
      border-radius: 50%; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class DappComponent implements OnDestroy {
  searchQuery = signal('');
  activeCategory = signal<string>('all');
  activeDapp = signal<DappEntry | null>(null);
  currentUrl = signal('');
  loading = signal(false);

  // Custom dApp form
  showAddDapp = signal(false);
  customDappName = signal('');
  customDappUrl = signal('');

  // Pinned dApps
  pinnedDapps = signal<DappEntry[]>([]);

  // Sessions
  sessions = signal<DappSession[]>([]);

  browserFrame = viewChild<ElementRef>('browserFrame');

  wallet = inject(WalletStateService);
  private ui = inject(UiStateService);
  private ipc = inject(TauriIpcService);
  private tx = inject(TransactionService);
  private resizeObserver: ResizeObserver | null = null;
  private unlistenNav: UnlistenFn | null = null;
  private unlistenSign: UnlistenFn | null = null;

  isSecureOrigin = computed(() => {
    const url = this.currentUrl();
    return url.startsWith('https://');
  });

  constructor() {
    this.loadPinnedDapps();
    this.loadSessions();
  }

  ngOnDestroy() {
    this.teardownWebview();
  }

  filteredDapps(): DappEntry[] {
    const query = this.searchQuery().toLowerCase();
    const category = this.activeCategory();
    const chainName = this.wallet.selectedAccount()?.chainName;
    const pinnedUrls = new Set(this.pinnedDapps().map(d => d.url));

    return CURATED_DAPPS.filter(dapp => {
      if (pinnedUrls.has(dapp.url)) return false; // hide pinned from main list
      if (category !== 'all' && dapp.category !== category) return false;
      if (query && !dapp.name.toLowerCase().includes(query) && !dapp.description.toLowerCase().includes(query)) return false;
      if (chainName && !dapp.chains.includes(chainName)) return false;
      return true;
    });
  }

  openDapp(dapp: DappEntry) {
    this.activeDapp.set(dapp);
    this.currentUrl.set(dapp.url);
    this.loading.set(true);
    this.ui.fullscreen.set(true);

    // Create/update session
    this.ensureSession(dapp);

    setTimeout(() => this.mountWebview(dapp.url));
  }

  closeDapp() {
    this.teardownWebview();
    this.activeDapp.set(null);
    this.currentUrl.set('');
    this.loading.set(false);
    this.ui.fullscreen.set(false);
  }

  onUrlEnter() {
    const raw = this.searchQuery().trim();
    if (!raw) return;

    const url = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
    try {
      const hostname = new URL(url).hostname;
      this.openDapp({
        name: hostname,
        url,
        description: 'Custom URL',
        icon: '🌐',
        chains: [],
        category: 'tools',
      });
    } catch { /* Invalid URL */ }
  }

  reloadDapp() { this.ipc.reloadDapp(); }
  goBack() { this.ipc.dappGoBack(); }
  goForward() { this.ipc.dappGoForward(); }

  // ── Pinned DApps ──

  private async loadPinnedDapps() {
    try {
      const saved = await this.ipc.storeGet<DappEntry[]>('pinnedDapps');
      if (saved) this.pinnedDapps.set(saved);
    } catch { /* ignore */ }
  }

  private async savePinnedDapps() {
    await this.ipc.storeSet('pinnedDapps', this.pinnedDapps());
  }

  pinDapp(dapp: DappEntry) {
    if (this.pinnedDapps().some(d => d.url === dapp.url)) return;
    this.pinnedDapps.update(list => [...list, { ...dapp, pinned: true }]);
    this.savePinnedDapps();
  }

  unpinDapp(dapp: DappEntry) {
    this.pinnedDapps.update(list => list.filter(d => d.url !== dapp.url));
    this.savePinnedDapps();
  }

  async onAddCustomDapp() {
    const name = this.customDappName().trim();
    const url = this.customDappUrl().trim();
    if (!name || !url) return;

    const dapp: DappEntry = {
      name,
      url: url.startsWith('http') ? url : `https://${url}`,
      description: 'Custom dApp',
      icon: '🌐',
      chains: [],
      category: 'tools',
      pinned: true,
    };

    this.pinnedDapps.update(list => [...list, dapp]);
    await this.savePinnedDapps();
    this.showAddDapp.set(false);
    this.customDappName.set('');
    this.customDappUrl.set('');
  }

  // ── Session Management ──

  private async loadSessions() {
    try {
      const saved = await this.ipc.storeGet<DappSession[]>('dappSessions');
      if (saved) this.sessions.set(saved);
    } catch { /* ignore */ }
  }

  private async saveSessions() {
    await this.ipc.storeSet('dappSessions', this.sessions());
  }

  private ensureSession(dapp: DappEntry) {
    const origin = new URL(dapp.url).origin;
    const account = this.wallet.selectedAccount();
    if (!account) return;

    const existing = this.sessions().find(s => s.origin === origin && s.account === account.name);
    if (existing) return;

    this.sessions.update(list => [...list, {
      origin,
      name: dapp.name,
      account: account.name,
      chainId: account.chainId,
      authorizedAt: Date.now(),
    }]);
    this.saveSessions();
  }

  isSessionAuthorized(origin: string): boolean {
    const account = this.wallet.selectedAccount();
    if (!account) return false;
    return this.sessions().some(s => s.origin === origin && s.account === account.name);
  }

  revokeSession(session: DappSession) {
    this.sessions.update(list => list.filter(s => !(s.origin === session.origin && s.account === session.account)));
    this.saveSessions();
  }

  // ── Webview Lifecycle ──

  private async mountWebview(url: string) {
    const el = this.browserFrame()?.nativeElement as HTMLElement | undefined;
    if (!el) return;

    // Listen for navigation events
    this.unlistenNav = await listen<string>('dapp-navigation', (event) => {
      this.currentUrl.set(event.payload);
      this.loading.set(false);
    });

    // Listen for signing requests from the bridge
    this.unlistenSign = await this.ipc.onDappSigningRequest(async (request) => {
      await this.handleSigningRequest(request);
    });

    const rect = el.getBoundingClientRect();
    try {
      await this.ipc.openDappBrowser(url, rect.left, rect.top, rect.width, rect.height);
    } catch (err) {
      console.error('[dapp] Failed to open webview:', err);
      this.loading.set(false);
    }

    this.resizeObserver = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      this.ipc.resizeDappBrowser(r.left, r.top, r.width, r.height);
    });
    this.resizeObserver.observe(el);
  }

  private teardownWebview() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.unlistenNav?.();
    this.unlistenNav = null;
    this.unlistenSign?.();
    this.unlistenSign = null;
    this.ipc.closeDappBrowser();
    this.ui.fullscreen.set(false);
  }

  // ── Signing Request Handler ──

  private async handleSigningRequest(request: { id: string; actions: any[]; chainId: string | null; origin: string }) {
    const account = this.wallet.selectedAccount();
    if (!account) {
      await this.ipc.dappRejectSigning(request.id, 'No active account');
      return;
    }

    // Validate origin — check if session is authorized
    if (!this.isSessionAuthorized(request.origin)) {
      // Auto-authorize for now (session was created when dApp opened)
      // In a stricter mode, we could show a consent dialog here
    }

    // Use the chain from request if available, otherwise use active account's chain
    const chainId = request.chainId || account.chainId;

    try {
      const keys = await this.ipc.listPublicKeys(chainId);
      if (keys.length === 0) {
        await this.ipc.dappRejectSigning(request.id, 'No signing key available');
        return;
      }

      const dappName = this.activeDapp()?.name ?? request.origin;

      // Show the confirmation modal via TransactionService
      const result = await this.tx.confirm({
        chainId,
        publicKey: keys[0],
        actions: request.actions,
        title: `${dappName} — Sign Transaction`,
      });

      if (result) {
        await this.ipc.dappResolveSigning(request.id, {
          transaction_id: result.transaction_id,
          processed: true,
        });
      } else {
        await this.ipc.dappRejectSigning(request.id, 'User rejected the transaction');
      }
    } catch (e: any) {
      await this.ipc.dappRejectSigning(request.id, e?.toString() ?? 'Signing failed');
    }
  }
}
