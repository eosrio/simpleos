import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WalletStateService } from '../../../core/services/wallet-state.service';

interface DappEntry {
  name: string;
  url: string;
  description: string;
  icon: string;
  chains: string[];
  category: 'defi' | 'tools' | 'governance' | 'nft' | 'exchange';
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
      <h2>DApps</h2>

      @if (!activeDapp()) {
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
                <svg class="dapp-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
              </div>
            }
          </div>
        </div>
      } @else {
        <!-- Active dApp view (browser placeholder) -->
        <div class="browser-bar">
          <button class="nav-btn" (click)="closeDapp()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div class="browser-url">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span>{{ activeDapp()!.url }}</span>
          </div>
          <span class="browser-dapp-name">{{ activeDapp()!.name }}</span>
        </div>

        <div class="browser-frame">
          <div class="browser-placeholder">
            <div class="placeholder-icon">{{ activeDapp()!.icon }}</div>
            <h3>{{ activeDapp()!.name }}</h3>
            <p>Built-in browser will load here.</p>
            <p class="placeholder-hint">The Tauri webview will render the dApp with the Anchor signing bridge injected. In browser preview mode, this is a placeholder.</p>
            <a class="external-link" [href]="activeDapp()!.url" target="_blank" rel="noopener">
              Open in external browser ↗
            </a>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .dapp-view { max-width: 900px; }
    h2 { font-size: 24px; margin-bottom: var(--sp-2); }
    .page-desc { font-size: 13px; color: var(--text-muted); margin-bottom: var(--sp-5); }

    /* URL bar */
    .url-bar {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-4);
      background: var(--bg-raised);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      margin-bottom: var(--sp-5);
      color: var(--text-muted);
    }
    .url-input {
      flex: 1;
      border: none;
      background: none;
      color: var(--text-bright);
      font-family: var(--font-data);
      font-size: 13px;
      outline: none;
    }
    .url-input::placeholder { color: var(--text-disabled); }
    .btn-go {
      padding: var(--sp-1) var(--sp-3);
      border: none; border-radius: var(--radius-sm);
      background: var(--accent); color: #fff;
      font-size: 11px; font-weight: 600; letter-spacing: 1px;
      cursor: pointer;
    }

    /* Category filters */
    .category-filters {
      display: flex;
      gap: var(--sp-2);
      margin-bottom: var(--sp-4);
      flex-wrap: wrap;
    }
    .filter-chip {
      padding: var(--sp-1) var(--sp-3);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-full);
      background: transparent;
      color: var(--text-muted);
      font-family: var(--font-body);
      font-size: 12px;
      cursor: pointer;
      transition: all 150ms ease;
    }
    .filter-chip:hover { border-color: var(--text-muted); color: var(--text-body); }
    .filter-chip.active {
      background: var(--accent-muted);
      border-color: var(--accent);
      color: var(--accent);
    }

    /* Anchor compat banner */
    .compat-banner {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-4);
      background: var(--accent-muted);
      border-radius: var(--radius-md);
      font-size: 12px;
      color: var(--accent);
      margin-bottom: var(--sp-6);
    }
    .compat-banner strong { color: var(--text-bright); }

    /* DApp grid */
    .dapp-grid {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
    }
    .dapp-card {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      padding: var(--sp-4) var(--sp-5);
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: background 150ms ease, transform 150ms ease;
      border: 1px solid transparent;
    }
    .dapp-card:hover {
      background: var(--bg-hover);
      border-color: var(--border-subtle);
    }

    .dapp-icon {
      font-size: 28px;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-hover);
      border-radius: var(--radius-md);
      flex-shrink: 0;
    }
    .dapp-info { flex: 1; min-width: 0; }
    .dapp-name {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-bright);
      margin-bottom: 2px;
    }
    .dapp-desc {
      display: block;
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: var(--sp-2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .dapp-chains {
      display: flex;
      gap: var(--sp-1);
    }
    .chain-tag {
      font-family: var(--font-data);
      font-size: 10px;
      color: var(--text-muted);
      background: var(--bg-active);
      padding: 1px var(--sp-2);
      border-radius: var(--radius-full);
    }
    .dapp-arrow {
      color: var(--text-disabled);
      flex-shrink: 0;
      transition: color 150ms ease;
    }
    .dapp-card:hover .dapp-arrow { color: var(--accent); }

    /* Browser view */
    .browser-bar {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-4);
      background: var(--bg-raised);
      border-radius: var(--radius-md) var(--radius-md) 0 0;
      border-bottom: 1px solid var(--border-subtle);
    }
    .nav-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px; height: 28px;
      border: none; border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: background 150ms ease, color 150ms ease;
    }
    .nav-btn:hover { background: var(--bg-hover); color: var(--text-bright); }
    .browser-url {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      flex: 1;
      font-family: var(--font-data);
      font-size: 12px;
      color: var(--text-muted);
    }
    .browser-url svg { color: var(--positive); }
    .browser-dapp-name {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-body);
    }

    .browser-frame {
      background: var(--bg-base);
      border: 1px solid var(--border-subtle);
      border-top: none;
      border-radius: 0 0 var(--radius-md) var(--radius-md);
      min-height: 500px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .browser-placeholder {
      text-align: center;
      padding: var(--sp-10);
    }
    .placeholder-icon { font-size: 48px; margin-bottom: var(--sp-4); }
    .browser-placeholder h3 { font-size: 18px; margin-bottom: var(--sp-2); }
    .browser-placeholder p { font-size: 13px; color: var(--text-muted); margin-bottom: var(--sp-2); }
    .placeholder-hint { font-size: 11px; color: var(--text-disabled); max-width: 400px; margin: 0 auto; }
    .external-link {
      display: inline-block;
      margin-top: var(--sp-4);
      font-size: 13px;
      color: var(--accent);
      text-decoration: none;
    }
    .external-link:hover { text-decoration: underline; }
  `],
})
export class DappComponent {
  searchQuery = signal('');
  activeCategory = signal<string>('all');
  activeDapp = signal<DappEntry | null>(null);

  constructor(public wallet: WalletStateService) {}

  filteredDapps(): DappEntry[] {
    const query = this.searchQuery().toLowerCase();
    const category = this.activeCategory();
    const chainName = this.wallet.selectedAccount()?.chainName;

    return CURATED_DAPPS.filter(dapp => {
      // Category filter
      if (category !== 'all' && dapp.category !== category) return false;
      // Search filter
      if (query && !dapp.name.toLowerCase().includes(query) && !dapp.description.toLowerCase().includes(query)) return false;
      // Chain filter — show dapps relevant to active chain, or all if no account
      if (chainName && !dapp.chains.includes(chainName)) return false;
      return true;
    });
  }

  openDapp(dapp: DappEntry) {
    this.activeDapp.set(dapp);
  }

  closeDapp() {
    this.activeDapp.set(null);
  }

  onUrlEnter() {
    const url = this.searchQuery().trim();
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      this.activeDapp.set({
        name: new URL(url).hostname,
        url,
        description: 'Custom URL',
        icon: '🌐',
        chains: [],
        category: 'tools',
      });
    }
  }
}
