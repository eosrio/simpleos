import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ThemeService } from '../../../core/services/theme.service';
import { TokenPriceService } from '../../../core/services/token-price.service';
import { WalletAccount, WalletStateService } from '../../../core/services/wallet-state.service';

interface HomeStats {
  totalAccounts: number;
  totalChains: number;
  fullAccounts: number;
  watchAccounts: number;
  producerAccounts: number;
  hotAccounts: number;
  totalLiquidUsd: string;
  pricedAccounts: number;
}

interface HomeAccountCard {
  index: number;
  key: string;
  name: string;
  mode: 'full' | 'watch';
  liquid: string;
  liquidUsd: string;
  staked: string;
  ramPct: number;
  ramText: string;
  producerText: string | null;
}

interface HomeChainSection {
  chainId: string;
  chainName: string;
  accountCount: number;
  fullCount: number;
  watchCount: number;
  totalLiquid: string;
  totalLiquidUsd: string;
  accounts: HomeAccountCard[];
}

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="home-view">
      @if (!wallet.accounts().length) {
        <section class="empty-state">
          <span class="empty-kicker">Wallet home</span>
          <h1>No accounts available yet</h1>
          <p>Add or import an account to populate the live overview.</p>
          <button type="button" class="empty-action" (click)="addAccount()">Add account</button>
        </section>
      } @else {
        <section class="hero">
          <div class="hero-copy">
            <div class="hero-copy-panel">
              <span class="hero-kicker">Wallet home</span>
              <div class="hero-title-row">
                <h1 class="hero-title">Portfolio overview</h1>
                <span class="hero-state">No active account</span>
              </div>
              <p class="hero-description">
                Fast snapshot across every imported account using cached balances, stake, RAM usage,
                and token pricing. Select an account below when you want the detailed wallet tools.
              </p>
              <div class="hero-meta">
                <span class="hero-meta-item">{{ stats().totalAccounts }} account{{ plural(stats().totalAccounts) }}</span>
                <span class="hero-meta-item">{{ stats().totalChains }} chain{{ plural(stats().totalChains) }}</span>
                <span class="hero-meta-item">{{ stats().pricedAccounts }} priced</span>
              </div>

              <div class="hero-highlights">
                @if (primaryChain(); as leadChain) {
                  <article class="hero-highlight hero-highlight-primary">
                    <span class="hero-highlight-label">Largest network footprint</span>
                    <strong>{{ leadChain.chainName }}</strong>
                    <span>{{ leadChain.accountCount }} account{{ plural(leadChain.accountCount) }} · {{ leadChain.totalLiquidUsd }}</span>
                  </article>
                }

                <article class="hero-highlight">
                  <span class="hero-highlight-label">Producer coverage</span>
                  <strong>{{ stats().producerAccounts }}</strong>
                  <span>Producer account{{ plural(stats().producerAccounts) }} visible in the wallet</span>
                </article>

                <article class="hero-highlight">
                  <span class="hero-highlight-label">Fast state mode</span>
                  <strong>{{ stats().pricedAccounts }}/{{ stats().totalAccounts }}</strong>
                  <span>Accounts with cached token pricing layered into the overview</span>
                </article>
              </div>
            </div>
          </div>

          <div class="hero-stats">
            <article class="stat-card stat-card-primary">
              <span class="stat-label">Accounts</span>
              <span class="stat-value">{{ stats().totalAccounts }}</span>
              <span class="stat-meta">{{ stats().fullAccounts }} signing · {{ stats().watchAccounts }} watch-only</span>
            </article>

            <article class="stat-card">
              <span class="stat-label">Chains</span>
              <span class="stat-value">{{ stats().totalChains }}</span>
              <span class="stat-meta">{{ stats().producerAccounts }} producer{{ plural(stats().producerAccounts) }}</span>
            </article>

            <article class="stat-card">
              <span class="stat-label">Estimated liquid value</span>
              <span class="stat-value">{{ stats().totalLiquidUsd }}</span>
              <span class="stat-meta">{{ stats().pricedAccounts }} priced account{{ plural(stats().pricedAccounts) }}</span>
            </article>

            <article class="stat-card">
              <span class="stat-label">RAM hot spots</span>
              <span class="stat-value">{{ stats().hotAccounts }}</span>
              <span class="stat-meta">Accounts at or above 80% RAM usage</span>
            </article>
          </div>
        </section>

        <section class="chains-section">
          @for (chain of chainSections(); track chain.chainId) {
            <article class="chain-card">
              <header class="chain-header">
                <div class="chain-title-block">
                  <span class="chain-kicker">Network summary</span>
                  <h2>{{ chain.chainName }}</h2>
                  <p>{{ chain.accountCount }} account{{ plural(chain.accountCount) }} · {{ chain.fullCount }} signing · {{ chain.watchCount }} watch-only</p>
                </div>

                <div class="chain-totals">
                  <span class="chain-balance">{{ chain.totalLiquid }}</span>
                  <span class="chain-usd">{{ chain.totalLiquidUsd }}</span>
                </div>
              </header>

              <div class="account-grid">
                @for (account of chain.accounts; track account.key) {
                  <button type="button" class="account-card" (click)="openAccount(account.index)">
                    <div class="account-card-top">
                      <div>
                        <div class="account-name">{{ account.name }}</div>
                        <div class="account-badges">
                          <span class="badge" [class.badge-watch]="account.mode === 'watch'">
                            {{ account.mode === 'watch' ? 'watch-only' : 'signing' }}
                          </span>
                          @if (account.producerText; as producerText) {
                            <span class="badge badge-producer">{{ producerText }}</span>
                          }
                        </div>
                      </div>

                      <span class="open-label">Open account</span>
                    </div>

                    <div class="metric-grid">
                      <div class="metric-block">
                        <span class="metric-label">Liquid</span>
                        <span class="metric-value">{{ account.liquid }}</span>
                        <span class="metric-meta">{{ account.liquidUsd }}</span>
                      </div>

                      <div class="metric-block">
                        <span class="metric-label">Staked</span>
                        <span class="metric-value">{{ account.staked }}</span>
                        <span class="metric-meta">CPU + NET weight</span>
                      </div>

                      <div class="metric-block">
                        <span class="metric-label">RAM</span>
                        <span class="metric-value" [class.metric-warning]="account.ramPct >= 80">{{ account.ramPct }}%</span>
                        <span class="metric-meta">{{ account.ramText }}</span>
                      </div>
                    </div>
                  </button>
                }
              </div>
            </article>
          }
        </section>
      }
    </div>
  `,
  styles: [`
    .home-view {
      display: flex;
      flex-direction: column;
      gap: var(--sp-5);
    }

    .hero,
    .empty-state {
      position: relative;
      overflow: hidden;
      padding: var(--sp-6);
      border: 1px solid rgba(0, 148, 210, 0.16);
      border-radius: calc(var(--radius-lg) + 2px);
      background:
        radial-gradient(circle at top right, rgba(0, 148, 210, 0.16), transparent 35%),
        linear-gradient(180deg, rgba(0, 148, 210, 0.08), transparent 60%),
        var(--bg-deep);
      box-shadow: 0 18px 42px rgba(0, 0, 0, 0.12);
    }

    .hero::before,
    .empty-state::before {
      content: '';
      position: absolute;
      inset: auto -80px -120px auto;
      width: 240px;
      height: 240px;
      border-radius: 50%;
      background: radial-gradient(circle, color-mix(in srgb, var(--accent) 24%, transparent), transparent 68%);
      opacity: 0.7;
      pointer-events: none;
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
      gap: var(--sp-5);
      align-items: start;
    }

    .hero-copy-panel {
      position: relative;
      display: flex;
      flex-direction: column;
      min-height: 100%;
      padding-right: var(--sp-4);
    }

    .hero-kicker,
    .empty-kicker {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      padding: 6px 10px;
      border-radius: var(--radius-full);
      background: rgba(0, 148, 210, 0.12);
      color: var(--accent);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: var(--sp-4);
    }

    .empty-state h1 {
      margin: 0;
      color: var(--text-bright);
      font-size: clamp(2rem, 4vw, 3rem);
      line-height: 1;
    }

    .empty-state p {
      margin: var(--sp-4) 0 0;
      max-width: 60ch;
      color: var(--text-muted);
      font-size: 15px;
      line-height: 1.6;
    }

    .hero-title-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-3);
    }

    .hero-title {
      margin: 0;
      color: var(--text-bright);
      font-size: clamp(1.5rem, 2vw, 2rem);
      line-height: 1.15;
      font-weight: 600;
    }

    .hero-state {
      display: inline-flex;
      align-items: center;
      padding: 5px 10px;
      border-radius: var(--radius-full);
      border: 1px solid color-mix(in srgb, var(--accent) 16%, var(--border-subtle));
      background: color-mix(in srgb, var(--accent) 7%, transparent);
      color: var(--text-muted);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .hero-description {
      margin: var(--sp-3) 0 0;
      max-width: 56ch;
      color: var(--text-muted);
      font-size: 14px;
      line-height: 1.55;
    }

    .hero-meta {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-2);
      margin-top: var(--sp-3);
    }

    .hero-meta-item {
      display: inline-flex;
      align-items: center;
      padding: 5px 9px;
      border-radius: var(--radius-full);
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid color-mix(in srgb, var(--accent) 10%, var(--border-subtle));
      color: var(--text-body);
      font-size: 12px;
      line-height: 1;
    }

    .hero-highlights {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: var(--sp-3);
      margin-top: var(--sp-5);
    }

    .hero-highlight {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: var(--sp-3) var(--sp-4);
      border-radius: var(--radius-md);
      border: 1px solid color-mix(in srgb, var(--accent) 12%, var(--border-subtle));
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent), rgba(0, 0, 0, 0.08);
      min-height: 92px;
    }

    .hero-highlight-primary {
      background:
        radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 18%, transparent), transparent 46%),
        linear-gradient(180deg, color-mix(in srgb, var(--accent) 8%, transparent), transparent),
        rgba(0, 0, 0, 0.08);
    }

    .hero-highlight-label {
      color: var(--text-disabled);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .hero-highlight strong {
      color: var(--text-bright);
      font-family: var(--font-data);
      font-size: 18px;
      font-weight: 600;
      line-height: 1.2;
    }

    .hero-highlight span:last-child {
      color: var(--text-muted);
      font-size: 12px;
      line-height: 1.45;
    }

    .hero-stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sp-3);
    }

    .stat-card {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
      min-height: 116px;
      padding: var(--sp-4);
      border-radius: var(--radius-md);
      border: 1px solid color-mix(in srgb, var(--accent) 10%, var(--border-subtle));
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent), rgba(0, 0, 0, 0.08);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
    }

    .stat-card-primary {
      background:
        radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 22%, transparent), transparent 44%),
        linear-gradient(180deg, color-mix(in srgb, var(--accent) 16%, transparent), color-mix(in srgb, var(--accent) 4%, transparent));
      border-color: color-mix(in srgb, var(--accent) 20%, var(--border-subtle));
    }

    .stat-label {
      color: var(--text-muted);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .stat-value {
      color: var(--text-bright);
      font-family: var(--font-data);
      font-size: 28px;
      font-weight: 600;
      line-height: 1.1;
    }

    .stat-meta {
      margin-top: auto;
      color: var(--text-muted);
      font-size: 12px;
      line-height: 1.4;
    }

    .chains-section {
      display: grid;
      gap: var(--sp-4);
    }

    .chain-card {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
      padding: var(--sp-4);
      border: 1px solid color-mix(in srgb, var(--accent) 10%, var(--border-subtle));
      border-radius: var(--radius-lg);
      background:
        radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 10%, transparent), transparent 42%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent),
        var(--bg-deep);
      box-shadow: 0 14px 30px rgba(0, 0, 0, 0.1);
    }

    .chain-title-block {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .chain-kicker {
      display: inline-flex;
      width: fit-content;
      padding: 4px 8px;
      border-radius: var(--radius-full);
      background: color-mix(in srgb, var(--accent) 12%, transparent);
      color: var(--accent);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .chain-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--sp-3);
    }

    .chain-header h2 {
      margin: 0;
      color: var(--text-bright);
      font-size: 20px;
      line-height: 1.1;
    }

    .chain-header p {
      margin: 2px 0 0;
      color: var(--text-muted);
      font-size: 13px;
    }

    .chain-totals {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
      text-align: right;
    }

    .chain-balance {
      color: var(--text-bright);
      font-family: var(--font-data);
      font-size: 18px;
      font-weight: 600;
    }

    .chain-usd {
      color: var(--text-muted);
      font-size: 12px;
    }

    .account-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: var(--sp-3);
    }

    .account-card {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
      width: 100%;
      padding: var(--sp-3) var(--sp-4);
      border: 1px solid color-mix(in srgb, var(--accent) 10%, var(--border-subtle));
      border-radius: var(--radius-md);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent),
        color-mix(in srgb, var(--accent) 2%, var(--bg-base));
      text-align: left;
      cursor: pointer;
      transition: transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
    }

    .account-card:hover {
      transform: translateY(-2px);
      border-color: color-mix(in srgb, var(--accent) 26%, var(--border-subtle));
      box-shadow: 0 16px 30px rgba(0, 0, 0, 0.16);
    }

    .account-card-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--sp-3);
    }

    .account-name {
      color: var(--text-bright);
      font-family: var(--font-data);
      font-size: 16px;
      font-weight: 600;
    }

    .account-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: var(--sp-2);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 8px;
      border-radius: var(--radius-full);
      background: rgba(0, 148, 210, 0.12);
      color: var(--accent);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .badge-watch {
      background: rgba(245, 166, 35, 0.12);
      color: var(--caution);
    }

    .badge-producer {
      background: rgba(56, 189, 248, 0.12);
      color: #7dd3fc;
    }

    .open-label {
      color: var(--text-muted);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      white-space: nowrap;
      opacity: 0.9;
    }

    .metric-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--sp-3);
    }

    .metric-block {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }

    .metric-label {
      color: var(--text-disabled);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .metric-value {
      color: var(--text-bright);
      font-family: var(--font-data);
      font-size: 14px;
      font-weight: 600;
      line-height: 1.35;
      word-break: break-word;
    }

    .metric-warning {
      color: var(--caution);
    }

    .metric-meta {
      color: var(--text-muted);
      font-size: 11px;
      line-height: 1.4;
    }

    .empty-action {
      align-self: flex-start;
      margin-top: var(--sp-5);
      padding: var(--sp-2) var(--sp-4);
      border: 1px solid var(--accent);
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--accent);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      transition: background 150ms ease, color 150ms ease;
    }

    .empty-action:hover {
      background: rgba(0, 148, 210, 0.12);
      color: var(--text-bright);
    }

    @media (max-width: 1100px) {
      .hero {
        grid-template-columns: 1fr;
        gap: var(--sp-4);
      }

      .hero-highlights {
        margin-top: var(--sp-4);
      }

       .hero-copy-panel {
        padding-right: 0;
      }
    }

    @media (max-width: 720px) {
      .hero,
      .empty-state,
      .chain-card {
        padding: var(--sp-5);
      }

      .home-view {
        gap: var(--sp-4);
      }

      .hero-stats,
      .metric-grid {
        grid-template-columns: 1fr;
      }

      .hero-highlights {
        grid-template-columns: 1fr;
      }

      .chain-header,
      .account-card-top {
        flex-direction: column;
      }

      .chain-totals {
        align-items: flex-start;
        text-align: left;
      }
    }
  `],
})
export class HomeComponent {
  readonly wallet = inject(WalletStateService);
  private readonly priceService = inject(TokenPriceService);
  private readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  readonly primaryChain = computed(() => this.chainSections()[0] ?? null);

  readonly stats = computed<HomeStats>(() => {
    const accounts = this.wallet.accounts();
    const totalLiquidUsd = accounts.reduce((sum, account) => sum + (this.priceValue(account.info.core_liquid_balance) ?? 0), 0);
    const pricedAccounts = accounts.filter(account => this.priceValue(account.info.core_liquid_balance) !== null).length;

    return {
      totalAccounts: accounts.length,
      totalChains: new Set(accounts.map(account => account.chainId)).size,
      fullAccounts: accounts.filter(account => account.mode === 'full').length,
      watchAccounts: accounts.filter(account => account.mode === 'watch').length,
      producerAccounts: accounts.filter(account => account.isProducer).length,
      hotAccounts: accounts.filter(account => this.ramPct(account) >= 80).length,
      totalLiquidUsd: this.formatUsd(totalLiquidUsd, pricedAccounts),
      pricedAccounts,
    };
  });

  readonly chainSections = computed<HomeChainSection[]>(() => {
    const chainsById = new Map(this.wallet.chains().map(chain => [chain.id, chain]));
    const grouped = new Map<string, {
      chainId: string;
      chainName: string;
      precision: number;
      symbol: string;
      liquidTotal: number;
      totalLiquidUsd: number;
      pricedAccounts: number;
      fullCount: number;
      watchCount: number;
      accounts: HomeAccountCard[];
    }>();

    this.wallet.accounts().forEach((account, index) => {
      const chain = chainsById.get(account.chainId);
      const parsedBalance = this.parseAmount(account.info.core_liquid_balance);
      const pricedValue = this.priceValue(account.info.core_liquid_balance);
      const group = grouped.get(account.chainId) ?? {
        chainId: account.chainId,
        chainName: account.chainName,
        precision: chain?.precision ?? 4,
        symbol: parsedBalance?.symbol ?? chain?.symbol ?? '',
        liquidTotal: 0,
        totalLiquidUsd: 0,
        pricedAccounts: 0,
        fullCount: 0,
        watchCount: 0,
        accounts: [],
      };

      group.symbol ||= parsedBalance?.symbol ?? chain?.symbol ?? '';
      group.liquidTotal += parsedBalance?.value ?? 0;
      group.totalLiquidUsd += pricedValue ?? 0;
      group.pricedAccounts += pricedValue === null ? 0 : 1;
      group.fullCount += account.mode === 'full' ? 1 : 0;
      group.watchCount += account.mode === 'watch' ? 1 : 0;
      group.accounts.push({
        index,
        key: `${account.chainId}:${account.name}`,
        name: account.name,
        mode: account.mode,
        liquid: account.info.core_liquid_balance ?? this.formatToken(0, group.precision, group.symbol),
        liquidUsd: pricedValue === null ? 'No cached price' : this.priceService.formatUsd(pricedValue),
        staked: this.formatToken(this.stakedTotal(account), group.precision, group.symbol),
        ramPct: this.ramPct(account),
        ramText: `${this.formatBytes(account.info.ram_usage ?? 0)} / ${this.formatBytes(account.info.ram_quota ?? 0)}`,
        producerText: this.producerLabel(account),
      });
      grouped.set(account.chainId, group);
    });

    return [...grouped.values()]
      .map(group => ({
        chainId: group.chainId,
        chainName: group.chainName,
        accountCount: group.accounts.length,
        fullCount: group.fullCount,
        watchCount: group.watchCount,
        totalLiquid: this.formatToken(group.liquidTotal, group.precision, group.symbol),
        totalLiquidUsd: this.formatUsd(group.totalLiquidUsd, group.pricedAccounts),
        accounts: group.accounts.sort((left, right) => {
          const leftValue = this.priceValue(left.liquid);
          const rightValue = this.priceValue(right.liquid);
          if ((rightValue ?? 0) !== (leftValue ?? 0)) {
            return (rightValue ?? 0) - (leftValue ?? 0);
          }
          return left.name.localeCompare(right.name);
        }),
      }))
      .sort((left, right) => {
        if (right.accountCount !== left.accountCount) {
          return right.accountCount - left.accountCount;
        }
        return left.chainName.localeCompare(right.chainName);
      });
  });

  constructor() {
    this.wallet.clearSelectedAccount();
  }

  plural(count: number): string {
    return count === 1 ? '' : 's';
  }

  openAccount(index: number) {
    const account = this.wallet.accounts()[index];
    if (!account) return;

    this.wallet.selectAccount(index);
    this.theme.setChainByName(account.chainName);
    this.router.navigate(['/dashboard/wallet']);
  }

  addAccount() {
    this.router.navigate(['/landing']);
  }

  private producerLabel(account: WalletAccount): string | null {
    if (!account.isProducer) {
      return null;
    }

    return account.producerRank ? `#${account.producerRank} producer` : 'producer';
  }

  private stakedTotal(account: WalletAccount): number {
    return ((account.info.cpu_weight ?? 0) + (account.info.net_weight ?? 0)) / 10000;
  }

  private ramPct(account: WalletAccount): number {
    const quota = account.info.ram_quota ?? 0;
    const usage = account.info.ram_usage ?? 0;
    if (quota <= 0) return 0;
    return Math.min(100, Math.round((usage / quota) * 100));
  }

  private priceValue(balance?: string | null): number | null {
    return balance ? this.priceService.toUsd(balance) : null;
  }

  private formatUsd(value: number, pricedAccounts: number): string {
    if (pricedAccounts === 0) {
      return 'No cached price';
    }

    return this.priceService.formatUsd(value);
  }

  private parseAmount(balance?: string | null): { value: number; symbol: string } | null {
    if (!balance) return null;

    const normalized = balance.replace(/,/g, '').trim();
    const match = normalized.match(/^([0-9]+(?:\.[0-9]+)?)\s+([A-Za-z0-9]+)$/);
    if (!match) return null;

    return {
      value: Number(match[1]),
      symbol: match[2],
    };
  }

  private formatToken(value: number, precision: number, symbol: string): string {
    const formatted = value.toLocaleString(undefined, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });

    return symbol ? `${formatted} ${symbol}` : formatted;
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}