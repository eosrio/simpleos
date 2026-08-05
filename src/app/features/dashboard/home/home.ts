import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ThemeService } from '../../../core/services/theme.service';
import { TokenPriceService } from '../../../core/services/token-price.service';
import { WalletAccount, WalletStateService } from '../../../core/services/wallet-state.service';
import { compactAsset } from '../../../core/format';
import {
  isTestnetPortfolioChain,
  portfolioTokenUsdValue,
  type PortfolioPriceChain,
} from './portfolio-value';

/** Matches resources page: warning > 70, critical > 85. */
const RESOURCE_WARNING_PCT = 70;
const RESOURCE_CRITICAL_PCT = 85;

type ResourceLevel = 'ok' | 'warning' | 'critical';

interface HomeStats {
  totalAccounts: number;
  totalChains: number;
  fullAccounts: number;
  watchAccounts: number;
  producerAccounts: number;
  /** Accounts with any of CPU/NET/RAM above the warning threshold. */
  attentionAccounts: number;
  criticalAccounts: number;
  totalLiquidUsd: string;
  pricedAccounts: number;
}

interface HomeAccountCard {
  index: number;
  key: string;
  name: string;
  chainName: string;
  mode: 'full' | 'watch';
  liquid: string;
  liquidUsd: string;
  liquidUsdValue: number | null;
  staked: string;
  cpuPct: number;
  netPct: number;
  ramPct: number;
  ramText: string;
  resourceLevel: ResourceLevel;
  attentionFlags: string[];
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

interface AttentionAccount {
  index: number;
  key: string;
  name: string;
  chainName: string;
  cpuPct: number;
  netPct: number;
  ramPct: number;
  resourceLevel: ResourceLevel;
  attentionFlags: string[];
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
        <!-- Summary bar: the four figures worth re-checking on every unlock, on one line.
             This is a screen people land on several times a day, so it states the numbers
             and gets out of the way — the explanation of what they mean lives in the empty
             state, which is where someone seeing this for the first time actually starts. -->
        <section class="overview">
          <div class="overview-head">
            <h1>Portfolio overview</h1>
            <span class="overview-state">No active account</span>
          </div>

          <div class="overview-metrics">
            <div class="metric metric-lead">
              <span class="metric-key">Estimated value</span>
              @if (stats().pricedAccounts === 0) {
                <span class="metric-figure metric-figure-empty">—</span>
                <span class="metric-note">No cached price yet</span>
              } @else {
                <span class="metric-figure">{{ stats().totalLiquidUsd }}</span>
                <span class="metric-note">{{ stats().pricedAccounts }} of {{ stats().totalAccounts }} priced</span>
              }
            </div>

            <div class="metric">
              <span class="metric-key">Accounts</span>
              <span class="metric-figure">{{ stats().totalAccounts }}</span>
              <span class="metric-note">{{ stats().fullAccounts }} signing · {{ stats().watchAccounts }} watch-only</span>
            </div>

            <div class="metric">
              <span class="metric-key">Chains</span>
              <span class="metric-figure">{{ stats().totalChains }}</span>
              <span class="metric-note">
                @if (stats().producerAccounts > 0) {
                  {{ stats().producerAccounts }} producer account{{ plural(stats().producerAccounts) }}
                } @else {
                  No producer accounts
                }
              </span>
            </div>

            <div class="metric"
                 [class.metric-caution]="stats().attentionAccounts > 0"
                 [class.metric-alarm]="stats().criticalAccounts > 0">
              <span class="metric-key">Needs attention</span>
              <span class="metric-figure">{{ stats().attentionAccounts }}</span>
              <span class="metric-note">
                @if (stats().attentionAccounts === 0) {
                  CPU, NET and RAM all healthy
                } @else if (stats().criticalAccounts > 0) {
                  {{ stats().criticalAccounts }} critical · rest above {{ RESOURCE_WARNING_PCT }}%
                } @else {
                  Above {{ RESOURCE_WARNING_PCT }}% on CPU, NET or RAM
                }
              </span>
            </div>
          </div>
        </section>

        <!-- Resource health: quick scan for accounts under pressure -->
        <section class="resource-health"
                 [class.resource-health-ok]="attentionList().length === 0"
                 [class.resource-health-alert]="attentionList().length > 0">
          <!-- Title and threshold legend share one line; each row below carries its own
               Manage action, so the panel does not need to explain what to do next. -->
          <header class="resource-health-header">
            <h2>
              @if (attentionList().length === 0) {
                All accounts look healthy
              } @else {
                {{ attentionList().length }} account{{ plural(attentionList().length) }} need{{ attentionList().length === 1 ? 's' : '' }} attention
              }
            </h2>
            <p>
              @if (attentionList().length === 0) {
                CPU, NET and RAM below {{ RESOURCE_WARNING_PCT }}% everywhere
              } @else {
                Warning above {{ RESOURCE_WARNING_PCT }}% · critical above {{ RESOURCE_CRITICAL_PCT }}%
              }
            </p>
          </header>

          @if (attentionList().length > 0) {
            <div class="attention-list">
              @for (item of attentionList(); track item.key) {
                <button type="button" class="attention-row"
                        [class.attention-critical]="item.resourceLevel === 'critical'"
                        (click)="openAccountResources(item.index)">
                  <div class="attention-identity">
                    <span class="attention-name">{{ item.name }}</span>
                    <span class="attention-chain">{{ item.chainName }}</span>
                  </div>
                  <div class="attention-meters">
                    <div class="mini-meter" [class.warning]="item.cpuPct > RESOURCE_WARNING_PCT" [class.critical]="item.cpuPct > RESOURCE_CRITICAL_PCT">
                      <div class="mini-meter-head">
                        <span>CPU</span>
                        <span>{{ item.cpuPct }}%</span>
                      </div>
                      <div class="mini-meter-track">
                        <div class="mini-meter-fill" [style.width.%]="item.cpuPct"></div>
                      </div>
                    </div>
                    <div class="mini-meter" [class.warning]="item.netPct > RESOURCE_WARNING_PCT" [class.critical]="item.netPct > RESOURCE_CRITICAL_PCT">
                      <div class="mini-meter-head">
                        <span>NET</span>
                        <span>{{ item.netPct }}%</span>
                      </div>
                      <div class="mini-meter-track">
                        <div class="mini-meter-fill" [style.width.%]="item.netPct"></div>
                      </div>
                    </div>
                    <div class="mini-meter" [class.warning]="item.ramPct > RESOURCE_WARNING_PCT" [class.critical]="item.ramPct > RESOURCE_CRITICAL_PCT">
                      <div class="mini-meter-head">
                        <span>RAM</span>
                        <span>{{ item.ramPct }}%</span>
                      </div>
                      <div class="mini-meter-track">
                        <div class="mini-meter-fill" [style.width.%]="item.ramPct"></div>
                      </div>
                    </div>
                  </div>
                  <div class="attention-flags">
                    @for (flag of item.attentionFlags; track flag) {
                      <span class="attention-flag" [class.flag-critical]="item.resourceLevel === 'critical'">{{ flag }}</span>
                    }
                    <span class="attention-action">Manage</span>
                  </div>
                </button>
              }
            </div>
          }
        </section>

        <section class="chains-section">
          @for (chain of chainSections(); track chain.chainId) {
            <article class="chain-card">
              <header class="chain-header">
                <div class="chain-title-block">
                  <h2>{{ chain.chainName }}</h2>
                  <p>{{ chain.accountCount }} account{{ plural(chain.accountCount) }} · {{ chain.fullCount }} signing · {{ chain.watchCount }} watch-only</p>
                </div>

                <div class="chain-totals">
                  <span class="chain-balance" [title]="chain.totalLiquid">{{ compactAsset(chain.totalLiquid) }}</span>
                  <span class="chain-usd">{{ chain.totalLiquidUsd }}</span>
                </div>
              </header>

              <div class="account-grid">
                @for (account of chain.accounts; track account.key) {
                  <button type="button" class="account-card"
                          [class.account-card-warning]="account.resourceLevel === 'warning'"
                          [class.account-card-critical]="account.resourceLevel === 'critical'"
                          (click)="openAccount(account.index)">
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
                          @if (account.resourceLevel !== 'ok') {
                            <span class="badge"
                                  [class.badge-warning]="account.resourceLevel === 'warning'"
                                  [class.badge-critical]="account.resourceLevel === 'critical'">
                              {{ account.resourceLevel === 'critical' ? 'critical resources' : 'low resources' }}
                            </span>
                          }
                        </div>
                      </div>

                      <svg class="open-chevron" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>

                    <!-- Liquid and staked only: RAM is already one of the three meters below. -->
                    <div class="metric-grid">
                      <div class="metric-block">
                        <span class="metric-label">Liquid</span>
                        <span class="metric-value" [title]="account.liquid">{{ compactAsset(account.liquid) }}</span>
                        <span class="metric-meta">{{ account.liquidUsd }}</span>
                      </div>

                      <div class="metric-block">
                        <span class="metric-label">Staked</span>
                        <span class="metric-value" [title]="account.staked">{{ compactAsset(account.staked) }}</span>
                        <span class="metric-meta">CPU + NET weight</span>
                      </div>
                    </div>

                    <div class="resource-meters">
                      <div class="mini-meter" [class.warning]="account.cpuPct > RESOURCE_WARNING_PCT" [class.critical]="account.cpuPct > RESOURCE_CRITICAL_PCT">
                        <div class="mini-meter-head">
                          <span>CPU</span>
                          <span>{{ account.cpuPct }}%</span>
                        </div>
                        <div class="mini-meter-track">
                          <div class="mini-meter-fill" [style.width.%]="account.cpuPct"></div>
                        </div>
                      </div>
                      <div class="mini-meter" [class.warning]="account.netPct > RESOURCE_WARNING_PCT" [class.critical]="account.netPct > RESOURCE_CRITICAL_PCT">
                        <div class="mini-meter-head">
                          <span>NET</span>
                          <span>{{ account.netPct }}%</span>
                        </div>
                        <div class="mini-meter-track">
                          <div class="mini-meter-fill" [style.width.%]="account.netPct"></div>
                        </div>
                      </div>
                      <div class="mini-meter" [title]="account.ramText"
                           [class.warning]="account.ramPct > RESOURCE_WARNING_PCT" [class.critical]="account.ramPct > RESOURCE_CRITICAL_PCT">
                        <div class="mini-meter-head">
                          <span>RAM</span>
                          <span>{{ account.ramPct }}%</span>
                        </div>
                        <div class="mini-meter-track">
                          <div class="mini-meter-fill" [style.width.%]="account.ramPct"></div>
                        </div>
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

    /* ── Summary bar ──
       One panel, four figures, hairline dividers. The previous hero nested cards inside
       cards, which is where most of its height came from; the numbers here are sized to
       be read, not to fill space. */
    .overview {
      padding: var(--sp-4) var(--sp-5);
      border: 1px solid color-mix(in srgb, var(--accent) 14%, var(--border-subtle));
      border-radius: var(--radius-lg);
      background:
        radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 10%, transparent), transparent 46%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent),
        var(--bg-deep);
    }

    .overview-head {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      margin-bottom: var(--sp-4);
    }

    .overview-head h1 {
      margin: 0;
      color: var(--text-bright);
      font-size: 17px;
      font-weight: 600;
      line-height: 1.2;
    }

    .overview-metrics {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--sp-4);
    }

    .metric {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
      padding-left: var(--sp-4);
      border-left: 1px solid var(--border-subtle);
    }

    .metric:first-child {
      padding-left: 0;
      border-left: 0;
    }

    .metric-key {
      color: var(--text-muted);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .metric-figure {
      color: var(--text-bright);
      font-family: var(--font-data);
      font-size: 22px;
      font-weight: 600;
      line-height: 1.15;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* The one figure that earns extra size — it is the reason to open the screen. */
    .metric-lead .metric-figure {
      font-size: 26px;
    }

    .metric-figure-empty {
      color: var(--text-disabled);
    }

    .metric-note {
      color: var(--text-muted);
      font-size: 11px;
      line-height: 1.35;
    }

    .metric-caution .metric-figure { color: var(--caution); }
    .metric-alarm .metric-figure { color: var(--negative); }

    @media (max-width: 940px) {
      .overview-metrics {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        row-gap: var(--sp-4);
      }

      .metric:nth-child(odd) {
        padding-left: 0;
        border-left: 0;
      }
    }

    .overview-state {
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

    /* Resource health panel */
    .resource-health {
      padding: var(--sp-4);
      border-radius: var(--radius-lg);
      border: 1px solid color-mix(in srgb, var(--positive) 22%, var(--border-subtle));
      background:
        radial-gradient(circle at top right, color-mix(in srgb, var(--positive) 12%, transparent), transparent 48%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent),
        var(--bg-deep);
      box-shadow: 0 14px 30px rgba(0, 0, 0, 0.1);
    }

    .resource-health-alert {
      border-color: color-mix(in srgb, var(--caution) 35%, var(--border-subtle));
      background:
        radial-gradient(circle at top right, color-mix(in srgb, var(--caution) 14%, transparent), transparent 48%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent),
        var(--bg-deep);
    }

    .resource-health-header {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--sp-2) var(--sp-4);
    }

    .resource-health-header h2 {
      margin: 0;
      color: var(--text-bright);
      font-size: 15px;
      font-weight: 600;
      line-height: 1.2;
    }

    .resource-health-header p {
      margin: 0;
      color: var(--text-muted);
      font-size: 12px;
      line-height: 1.4;
    }

    .attention-list {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
      margin-top: var(--sp-3);
    }

    .attention-row {
      display: grid;
      grid-template-columns: minmax(120px, 0.9fr) minmax(0, 1.6fr) auto;
      gap: var(--sp-3);
      align-items: center;
      width: 100%;
      padding: var(--sp-2) var(--sp-3);
      border: 1px solid color-mix(in srgb, var(--caution) 22%, var(--border-subtle));
      border-radius: var(--radius-md);
      background: color-mix(in srgb, var(--caution) 5%, var(--bg-base));
      text-align: left;
      cursor: pointer;
      transition: transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
    }

    .attention-row:hover {
      transform: translateY(-1px);
      border-color: color-mix(in srgb, var(--caution) 40%, var(--border-subtle));
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
    }

    .attention-critical {
      border-color: color-mix(in srgb, var(--negative) 30%, var(--border-subtle));
      background: color-mix(in srgb, var(--negative) 6%, var(--bg-base));
    }

    .attention-critical:hover {
      border-color: color-mix(in srgb, var(--negative) 45%, var(--border-subtle));
    }

    .attention-identity {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .attention-name {
      color: var(--text-bright);
      font-family: var(--font-data);
      font-size: 14px;
      font-weight: 600;
    }

    .attention-chain {
      color: var(--text-muted);
      font-size: 11px;
    }

    .attention-meters {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--sp-2);
      min-width: 0;
    }

    .attention-flags {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
    }

    .attention-flag {
      display: inline-flex;
      padding: 3px 7px;
      border-radius: var(--radius-full);
      background: color-mix(in srgb, var(--caution) 16%, transparent);
      color: var(--caution);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .flag-critical {
      background: color-mix(in srgb, var(--negative) 16%, transparent);
      color: var(--negative);
    }

    .attention-action {
      color: var(--text-muted);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .mini-meter {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .mini-meter-head {
      display: flex;
      justify-content: space-between;
      gap: 6px;
      color: var(--text-muted);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .mini-meter-head span:last-child {
      font-family: var(--font-data);
      color: var(--text-body);
    }

    .mini-meter.warning .mini-meter-head span:last-child { color: var(--caution); }
    .mini-meter.critical .mini-meter-head span:last-child { color: var(--negative); }

    .mini-meter-track {
      height: 4px;
      border-radius: var(--radius-full);
      background: color-mix(in srgb, var(--text-disabled) 28%, transparent);
      overflow: hidden;
    }

    .mini-meter-fill {
      height: 100%;
      border-radius: var(--radius-full);
      background: var(--positive);
      transition: width 200ms ease;
    }

    .mini-meter.warning .mini-meter-fill { background: var(--caution); }
    .mini-meter.critical .mini-meter-fill { background: var(--negative); }

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
      gap: 2px;
      min-width: 0;
    }

    .chain-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--sp-3);
    }

    .chain-header h2 {
      margin: 0;
      color: var(--text-bright);
      font-size: 15px;
      font-weight: 600;
      line-height: 1.2;
    }

    .chain-header p {
      margin: 0;
      color: var(--text-muted);
      font-size: 12px;
    }

    .chain-totals {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
      text-align: right;
    }

    .chain-balance {
      color: var(--text-bright);
      font-family: var(--font-data);
      font-size: 15px;
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
      gap: var(--sp-2);
      width: 100%;
      padding: var(--sp-3);
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

    .account-card-warning {
      border-color: color-mix(in srgb, var(--caution) 28%, var(--border-subtle));
    }

    .account-card-critical {
      border-color: color-mix(in srgb, var(--negative) 32%, var(--border-subtle));
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
      font-size: 14px;
      font-weight: 600;
    }

    .account-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 6px;
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

    .badge-warning {
      background: color-mix(in srgb, var(--caution) 16%, transparent);
      color: var(--caution);
    }

    .badge-critical {
      background: color-mix(in srgb, var(--negative) 16%, transparent);
      color: var(--negative);
    }

    /* Replaces an "Open account" caption — the card is a button, so it only needs to
       point, not to say so in words that repeat on every card. */
    .open-chevron {
      flex-shrink: 0;
      color: var(--text-disabled);
      transition: color 150ms ease, transform 150ms ease;
    }

    .account-card:hover .open-chevron {
      color: var(--accent);
      transform: translateX(2px);
    }

    .metric-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sp-3);
    }

    .metric-block {
      display: flex;
      flex-direction: column;
      gap: 3px;
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

    .metric-meta {
      color: var(--text-muted);
      font-size: 11px;
      line-height: 1.4;
    }

    .resource-meters {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--sp-2);
      padding-top: var(--sp-1);
      border-top: 1px solid color-mix(in srgb, var(--accent) 8%, var(--border-subtle));
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

    @media (max-width: 900px) {
      .attention-row {
        grid-template-columns: 1fr;
        align-items: stretch;
      }

      .attention-flags {
        justify-content: flex-start;
      }
    }

    @media (max-width: 720px) {
      .empty-state,
      .chain-card,
      .resource-health {
        padding: var(--sp-5);
      }

      .overview {
        padding: var(--sp-4);
      }

      .home-view {
        gap: var(--sp-4);
      }

      .metric-grid,
      .resource-meters,
      .attention-meters {
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

  /** Exposed for template threshold classes / copy. */
  readonly RESOURCE_WARNING_PCT = RESOURCE_WARNING_PCT;
  readonly RESOURCE_CRITICAL_PCT = RESOURCE_CRITICAL_PCT;

  readonly stats = computed<HomeStats>(() => {
    const accounts = this.wallet.accounts();
    const chainsById = new Map(this.wallet.chains().map((chain) => [chain.id, chain]));
    const pricedValues = accounts.map((account) =>
      this.priceValue(account.info.core_liquid_balance, chainsById.get(account.chainId)),
    );
    const totalLiquidUsd = pricedValues.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    const pricedAccounts = pricedValues.filter((value) => value !== null).length;

    let attentionAccounts = 0;
    let criticalAccounts = 0;
    for (const account of accounts) {
      const level = this.resourceLevel(account);
      if (level === 'warning' || level === 'critical') attentionAccounts += 1;
      if (level === 'critical') criticalAccounts += 1;
    }

    return {
      totalAccounts: accounts.length,
      totalChains: new Set(accounts.map((account) => account.chainId)).size,
      fullAccounts: accounts.filter((account) => account.mode === 'full').length,
      watchAccounts: accounts.filter((account) => account.mode === 'watch').length,
      producerAccounts: accounts.filter((account) => account.isProducer).length,
      attentionAccounts,
      criticalAccounts,
      totalLiquidUsd: this.formatUsd(totalLiquidUsd, pricedAccounts),
      pricedAccounts,
    };
  });

  /** Accounts whose CPU, NET, or RAM is above the warning threshold (worst first). */
  readonly attentionList = computed<AttentionAccount[]>(() => {
    const list: AttentionAccount[] = [];
    this.wallet.accounts().forEach((account, index) => {
      const level = this.resourceLevel(account);
      if (level === 'ok') return;
      const cpuPct = this.cpuPct(account);
      const netPct = this.netPct(account);
      const ramPct = this.ramPct(account);
      list.push({
        index,
        key: `${account.chainId}:${account.name}`,
        name: account.name,
        chainName: account.chainName,
        cpuPct,
        netPct,
        ramPct,
        resourceLevel: level,
        attentionFlags: this.attentionFlags(cpuPct, netPct, ramPct),
      });
    });

    return list.sort((a, b) => {
      const rank = (level: ResourceLevel) => (level === 'critical' ? 2 : 1);
      if (rank(b.resourceLevel) !== rank(a.resourceLevel)) {
        return rank(b.resourceLevel) - rank(a.resourceLevel);
      }
      const maxA = Math.max(a.cpuPct, a.netPct, a.ramPct);
      const maxB = Math.max(b.cpuPct, b.netPct, b.ramPct);
      return maxB - maxA;
    });
  });

  readonly chainSections = computed<HomeChainSection[]>(() => {
    const chainsById = new Map(this.wallet.chains().map((chain) => [chain.id, chain]));
    const grouped = new Map<
      string,
      {
        chainId: string;
        chainName: string;
        isTestnet: boolean;
        precision: number;
        symbol: string;
        liquidTotal: number;
        totalLiquidUsd: number;
        pricedAccounts: number;
        fullCount: number;
        watchCount: number;
        accounts: HomeAccountCard[];
      }
    >();

    this.wallet.accounts().forEach((account, index) => {
      const chain = chainsById.get(account.chainId);
      const parsedBalance = this.parseAmount(account.info.core_liquid_balance);
      const pricedValue = this.priceValue(account.info.core_liquid_balance, chain);
      const group = grouped.get(account.chainId) ?? {
        chainId: account.chainId,
        chainName: account.chainName,
        isTestnet: isTestnetPortfolioChain(chain),
        precision: chain?.precision ?? 4,
        symbol: parsedBalance?.symbol ?? chain?.symbol ?? '',
        liquidTotal: 0,
        totalLiquidUsd: 0,
        pricedAccounts: 0,
        fullCount: 0,
        watchCount: 0,
        accounts: [],
      };

      const cpuPct = this.cpuPct(account);
      const netPct = this.netPct(account);
      const ramPct = this.ramPct(account);
      const resourceLevel = this.resourceLevelFromPcts(cpuPct, netPct, ramPct);

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
        chainName: account.chainName,
        mode: account.mode,
        liquid:
          account.info.core_liquid_balance ?? this.formatToken(0, group.precision, group.symbol),
        liquidUsd: group.isTestnet
          ? 'Not counted'
          : pricedValue === null
            ? 'No cached price'
            : this.priceService.formatUsd(pricedValue),
        liquidUsdValue: pricedValue,
        staked: this.formatToken(this.stakedTotal(account), group.precision, group.symbol),
        cpuPct,
        netPct,
        ramPct,
        ramText: `${this.formatBytes(account.info.ram_usage ?? 0)} / ${this.formatBytes(account.info.ram_quota ?? 0)}`,
        resourceLevel,
        attentionFlags: this.attentionFlags(cpuPct, netPct, ramPct),
        producerText: this.producerLabel(account),
      });
      grouped.set(account.chainId, group);
    });

    return [...grouped.values()]
      .map((group) => ({
        chainId: group.chainId,
        chainName: group.chainName,
        accountCount: group.accounts.length,
        fullCount: group.fullCount,
        watchCount: group.watchCount,
        totalLiquid: this.formatToken(group.liquidTotal, group.precision, group.symbol),
        totalLiquidUsd: group.isTestnet
          ? 'Not counted'
          : this.formatUsd(group.totalLiquidUsd, group.pricedAccounts),
        accounts: group.accounts.sort((left, right) => {
          const leftValue = left.liquidUsdValue;
          const rightValue = right.liquidUsdValue;
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

  /** Balances are rounded for scanning; the exact amount stays in the title attribute. */
  readonly compactAsset = compactAsset;

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

  /** Open the account and jump straight to resource management. */
  openAccountResources(index: number) {
    const account = this.wallet.accounts()[index];
    if (!account) return;

    this.wallet.selectAccount(index);
    this.theme.setChainByName(account.chainName);
    this.router.navigate(['/dashboard/resources']);
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

  private limitPct(limit?: { used?: number; max?: number } | null): number {
    if (!limit?.max || limit.max <= 0) return 0;
    return Math.min(100, Math.round(((limit.used ?? 0) / limit.max) * 100));
  }

  private cpuPct(account: WalletAccount): number {
    return this.limitPct(account.info.cpu_limit);
  }

  private netPct(account: WalletAccount): number {
    return this.limitPct(account.info.net_limit);
  }

  private ramPct(account: WalletAccount): number {
    const quota = account.info.ram_quota ?? 0;
    const usage = account.info.ram_usage ?? 0;
    if (quota <= 0) return 0;
    return Math.min(100, Math.round((usage / quota) * 100));
  }

  private resourceLevelFromPcts(cpuPct: number, netPct: number, ramPct: number): ResourceLevel {
    const max = Math.max(cpuPct, netPct, ramPct);
    if (max > RESOURCE_CRITICAL_PCT) return 'critical';
    if (max > RESOURCE_WARNING_PCT) return 'warning';
    return 'ok';
  }

  private resourceLevel(account: WalletAccount): ResourceLevel {
    return this.resourceLevelFromPcts(
      this.cpuPct(account),
      this.netPct(account),
      this.ramPct(account),
    );
  }

  private attentionFlags(cpuPct: number, netPct: number, ramPct: number): string[] {
    const flags: string[] = [];
    if (cpuPct > RESOURCE_WARNING_PCT) flags.push(`CPU ${cpuPct}%`);
    if (netPct > RESOURCE_WARNING_PCT) flags.push(`NET ${netPct}%`);
    if (ramPct > RESOURCE_WARNING_PCT) flags.push(`RAM ${ramPct}%`);
    return flags;
  }

  private priceValue(
    balance: string | null | undefined,
    chain: PortfolioPriceChain,
  ): number | null {
    return portfolioTokenUsdValue(balance, chain, (amount) => this.priceService.toUsd(amount));
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
