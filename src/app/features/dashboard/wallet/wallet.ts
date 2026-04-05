import { Component, effect, signal } from '@angular/core';
import { WalletStateService } from '../../../core/services/wallet-state.service';
import { TauriIpcService } from '../../../core/services/tauri-ipc.service';

interface HistoryAction {
  trx_id: string;
  block_num: number;
  timestamp: string;
  contract: string;
  name: string;
  data: Record<string, any>;
  irreversible: boolean;
}

@Component({
  selector: 'app-wallet',
  standalone: true,
  template: `
    <div class="wallet-view">
      @if (wallet.loading()) {
        <div class="skeleton-group">
          <div class="skeleton skeleton-balance"></div>
          <div class="skeleton-row">
            <div class="skeleton skeleton-card"></div>
            <div class="skeleton skeleton-card"></div>
            <div class="skeleton skeleton-card"></div>
          </div>
        </div>
      } @else if (!wallet.selectedAccount()) {
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-disabled)"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
          <h2>No accounts found</h2>
          <p>Import a private key to get started.</p>
        </div>
      } @else {
        <!-- Balance hero -->
        <div class="balance-section">
          <div class="balance-main">
            <div class="balance-header">
              <span class="balance-label">BALANCE</span>
              <button class="refresh-btn" (click)="refreshAccount()" [disabled]="refreshing()" title="Refresh account data">
                <svg [class.spinning]="refreshing()" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              </button>
            </div>
            <div class="balance-amount">
              <span class="balance-value">{{ formatBalance(wallet.selectedAccount()!.info.core_liquid_balance) }}</span>
              <span class="balance-symbol">{{ getSymbol(wallet.selectedAccount()!.info.core_liquid_balance) }}</span>
            </div>
            <div class="balance-sub">
              <span class="sub-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Staked {{ formatStakeWeight(wallet.selectedAccount()!.info.cpu_weight, wallet.selectedAccount()!.info.net_weight) }}
              </span>
              <span class="sub-divider">|</span>
              <span class="sub-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                Unstaked {{ wallet.selectedAccount()!.info.core_liquid_balance ?? '0.0000' }}
              </span>
            </div>
          </div>

          @if (wallet.selectedAccount().extraBalances?.length) {
            <div class="extra-balances">
              @for (bal of wallet.selectedAccount()!.extraBalances!; track bal.symbol) {
                <div class="extra-balance-row">
                  <span class="extra-balance-amount">{{ bal.amount }}</span>
                </div>
              }
            </div>
          }
        </div>

        <!-- Resource meters -->
        <div class="resources-row">
          <div class="resource-card">
            <div class="resource-header">
              <span class="resource-label">CPU</span>
              <span class="resource-pct" [class.warning]="cpuPct() > 70" [class.critical]="cpuPct() > 85">{{ cpuPct() }}% used</span>
            </div>
            <div class="resource-bar">
              <div class="resource-fill" [class.warning]="cpuPct() > 70" [class.critical]="cpuPct() > 85"
                   [style.width.%]="cpuPct()"></div>
            </div>
            <span class="resource-detail">{{ formatUs(wallet.selectedAccount()!.info.cpu_weight) }}</span>
          </div>

          <div class="resource-card">
            <div class="resource-header">
              <span class="resource-label">NET</span>
              <span class="resource-pct">0% used</span>
            </div>
            <div class="resource-bar">
              <div class="resource-fill" style="width: 0%"></div>
            </div>
            <span class="resource-detail">{{ formatUs(wallet.selectedAccount()!.info.net_weight) }}</span>
          </div>

          <div class="resource-card">
            <div class="resource-header">
              <span class="resource-label">RAM</span>
              <span class="resource-pct" [class.warning]="ramPct() > 70" [class.critical]="ramPct() > 85">{{ ramPct() }}% used</span>
            </div>
            <div class="resource-bar">
              <div class="resource-fill" [class.warning]="ramPct() > 70" [class.critical]="ramPct() > 85"
                   [style.width.%]="ramPct()"></div>
            </div>
            <span class="resource-detail">{{ formatBytes(wallet.selectedAccount()!.info.ram_usage ?? 0) }} / {{ formatBytes(wallet.selectedAccount()!.info.ram_quota ?? 0) }}</span>
          </div>
        </div>

        <!-- Recent activity -->
        <div class="activity-section">
          <div class="activity-header">
            <h3>Recent Activity</h3>
            @if (historyLoading() && actions().length > 0) {
              <div class="header-spinner"></div>
            }
          </div>

          <!-- Filters -->
          <div class="activity-filters">
            <select class="filter-select" [value]="filterAction()" (change)="onFilterAction($any($event.target).value)">
              <option value="">All actions</option>
              <option value="transfer">Transfers</option>
              <option value="delegatebw">Stake</option>
              <option value="undelegatebw">Unstake</option>
              <option value="voteproducer">Votes</option>
              <option value="buyram">Buy RAM</option>
              <option value="sellram">Sell RAM</option>
              <option value="powerup">PowerUp</option>
              <option value="claimrewards">Rewards</option>
            </select>
            <input class="filter-date" type="date"
                   [value]="filterAfter()"
                   (change)="onFilterAfter($any($event.target).value)"
                   title="From date" />
            <input class="filter-date" type="date"
                   [value]="filterBefore()"
                   (change)="onFilterBefore($any($event.target).value)"
                   title="To date" />
            @if (filterAction() || filterAfter() || filterBefore()) {
              <button class="filter-clear" (click)="clearFilters()">Clear</button>
            }
          </div>

          @if (historyLoading() && actions().length === 0) {
            <div class="activity-loading">
              <div class="header-spinner"></div>
              <p>Loading history...</p>
            </div>
          } @else if (historyError()) {
            <div class="activity-empty">
              <p>{{ historyError() }}</p>
            </div>
          } @else if (actions().length === 0) {
            <div class="activity-empty">
              <p>No transaction history found.</p>
            </div>
          } @else {
            <div class="activity-list">
              @for (action of actions(); track action.trx_id + $index) {
                <div class="action-row" [class.expanded]="expandedIndex() === $index"
                     (click)="toggleExpand($index)">
                  <div class="action-summary">
                    <div class="action-icon" [innerHTML]="actionIcon(action)"></div>
                    <div class="action-info">
                      <span class="action-label">{{ actionLabel(action) }}</span>
                      <span class="action-detail-text">{{ actionDetail(action) }}</span>
                    </div>
                    <div class="action-right">
                      <span class="action-amount" [class.positive]="isIncoming(action)">{{ actionAmount(action) }}</span>
                      <span class="action-time">{{ relativeTime(action.timestamp) }}</span>
                    </div>
                  </div>

                  @if (expandedIndex() === $index) {
                    <div class="action-expanded" (click)="$event.stopPropagation()">
                      <div class="expanded-fields">
                        <div class="exp-row">
                          <span class="exp-key">Transaction</span>
                          <span class="exp-value data">{{ action.trx_id.slice(0, 24) }}...</span>
                        </div>
                        <div class="exp-row">
                          <span class="exp-key">Block</span>
                          <span class="exp-value data">{{ action.block_num }}</span>
                        </div>
                        <div class="exp-row">
                          <span class="exp-key">Contract</span>
                          <span class="exp-value data">{{ action.contract }}</span>
                        </div>
                        <div class="exp-row">
                          <span class="exp-key">Action</span>
                          <span class="exp-value">{{ action.name }}</span>
                        </div>
                        @for (field of dataFields(action); track field.key) {
                          <div class="exp-row">
                            <span class="exp-key">{{ field.key }}</span>
                            <span class="exp-value data">{{ field.value }}</span>
                          </div>
                        }
                      </div>
                      @if (explorerTxUrl(action.trx_id); as url) {
                        <a class="explorer-link" [href]="url" target="_blank" rel="noopener"
                           (click)="$event.stopPropagation()">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                               stroke="currentColor" stroke-width="2"
                               stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                          View on explorer
                        </a>
                      }
                    </div>
                  }
                </div>
              }
            </div>

            @if (hasMore()) {
              <button class="load-more" (click)="loadMore()" [disabled]="historyLoading()">
                {{ historyLoading() ? 'Loading...' : 'Load more' }}
              </button>
            }
          }
        </div>

        <!-- Account list (if multiple) -->
        @if (wallet.accounts().length > 1) {
          <div class="accounts-section">
            <h3>Accounts</h3>
            <div class="accounts-list">
              @for (account of wallet.accounts(); track account.chainId + account.name; let i = $index) {
                <div class="account-row"
                     [class.selected]="i === wallet.selectedIndex()"
                     (click)="wallet.selectAccount(i)">
                  <span class="acct-name">{{ account.name }}</span>
                  <span class="acct-bal">{{ account.info.core_liquid_balance ?? '0.0000' }}</span>
                </div>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .wallet-view { max-width: 800px; }

    /* Skeleton loading */
    .skeleton-group { display: flex; flex-direction: column; gap: var(--sp-6); }
    .skeleton {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      animation: pulse 1.5s infinite ease-in-out;
    }
    .skeleton-balance { height: 120px; }
    .skeleton-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-4); }
    .skeleton-card { height: 80px; }
    @keyframes pulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 0.3; }
    }

    /* Empty state */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--sp-4);
      padding: var(--sp-12) 0;
      text-align: center;
    }
    .empty-state h2 { font-size: 18px; }
    .empty-state p { color: var(--text-muted); font-size: 14px; }

    /* Balance hero */
    .balance-section {
      background: var(--bg-raised);
      border-radius: var(--radius-lg);
      padding: var(--sp-6) var(--sp-8);
      margin-bottom: var(--sp-6);
    }
    .balance-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .balance-label {
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 1.5px;
      color: var(--text-muted);
      text-transform: uppercase;
    }
    .refresh-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
    }
    .refresh-btn:hover:not(:disabled) {
      color: var(--accent);
      border-color: var(--accent);
    }
    .refresh-btn:disabled { opacity: 0.4; cursor: default; }
    .refresh-btn .spinning {
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .balance-amount {
      display: flex;
      align-items: baseline;
      gap: var(--sp-2);
      margin-top: var(--sp-1);
    }
    .balance-value {
      font-family: var(--font-body);
      font-size: 42px;
      font-weight: 700;
      color: var(--text-bright);
      line-height: 1.1;
    }
    .balance-symbol {
      font-family: var(--font-data);
      font-size: 20px;
      font-weight: 500;
      color: var(--text-muted);
    }
    .balance-sub {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      margin-top: var(--sp-3);
      font-size: 13px;
      color: var(--text-muted);
    }
    .sub-item {
      display: flex;
      align-items: center;
      gap: var(--sp-1);
    }
    .sub-divider { color: var(--border-subtle); }

    .extra-balances {
      margin-top: var(--sp-3);
      padding-top: var(--sp-3);
      border-top: 1px solid var(--border-subtle);
    }
    .extra-balance-row {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-bright);
      font-family: var(--font-data);
    }

    /* Resource meters */
    .resources-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--sp-4);
      margin-bottom: var(--sp-6);
    }
    .resource-card {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      padding: var(--sp-4);
    }
    .resource-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--sp-2);
    }
    .resource-label {
      font-family: var(--font-data);
      font-size: 12px;
      font-weight: 600;
      color: var(--text-bright);
      letter-spacing: 0.5px;
    }
    .resource-pct {
      font-family: var(--font-data);
      font-size: 11px;
      color: var(--text-muted);
    }
    .resource-pct.warning { color: var(--caution); }
    .resource-pct.critical { color: var(--negative); }
    .resource-bar {
      height: 4px;
      background: var(--bg-hover);
      border-radius: var(--radius-full);
      overflow: hidden;
      margin-bottom: var(--sp-2);
    }
    .resource-fill {
      height: 100%;
      background: var(--accent);
      border-radius: var(--radius-full);
      transition: width 300ms ease;
    }
    .resource-fill.warning { background: var(--caution); }
    .resource-fill.critical { background: var(--negative); }
    .resource-detail {
      font-family: var(--font-data);
      font-size: 12px;
      color: var(--text-muted);
    }

    /* Activity */
    .activity-section {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      overflow: hidden;
      margin-bottom: var(--sp-6);
    }
    .activity-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--sp-4) var(--sp-5);
      border-bottom: 1px solid var(--border-subtle);
    }
    .activity-header h3 { font-size: 14px; font-weight: 600; margin: 0; }
    .header-spinner {
      width: 14px; height: 14px;
      border: 2px solid var(--border-subtle);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 800ms linear infinite;
    }
    .activity-empty, .activity-loading {
      padding: var(--sp-8) var(--sp-5);
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-3);
    }
    .activity-empty p, .activity-loading p { font-size: 13px; color: var(--text-muted); margin: 0; }

    /* Filters */
    .activity-filters {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      padding: var(--sp-3) var(--sp-5);
      border-bottom: 1px solid var(--border-subtle);
    }

    .filter-select, .filter-date {
      padding: var(--sp-1) var(--sp-2);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-base);
      color: var(--text-body);
      font-family: var(--font-body);
      font-size: 12px;
      transition: border-color 150ms;
    }

    .filter-select:focus, .filter-date:focus {
      outline: none;
      border-color: var(--accent);
    }

    .filter-date {
      width: 130px;
      color-scheme: dark;
    }

    .filter-clear {
      padding: var(--sp-1) var(--sp-2);
      border: none;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--accent);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
    }
    .filter-clear:hover { background: var(--accent-muted); }

    /* Action rows */
    .action-row {
      border-bottom: 1px solid var(--border-subtle);
      cursor: pointer;
      transition: background 100ms ease;
    }
    .action-row:last-child { border-bottom: none; }
    .action-row:hover { background: var(--bg-hover); }
    .action-row.expanded { background: var(--bg-active); }

    .action-summary {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-5);
    }

    .action-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-sm);
      background: var(--accent-muted);
      color: var(--accent);
      flex-shrink: 0;
    }

    .action-info {
      display: flex;
      flex-direction: column;
      gap: 1px;
      flex: 1;
      min-width: 0;
    }

    .action-label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-bright);
    }

    .action-detail-text {
      font-size: 12px;
      color: var(--text-muted);
      font-family: var(--font-data);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .action-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 1px;
      flex-shrink: 0;
    }

    .action-amount {
      font-size: 13px;
      font-weight: 500;
      font-family: var(--font-data);
      color: var(--text-bright);
    }

    .action-amount.positive { color: var(--positive); }

    .action-time {
      font-size: 11px;
      color: var(--text-disabled);
    }

    /* Expanded row */
    .action-expanded {
      padding: 0 var(--sp-5) var(--sp-4) calc(32px + var(--sp-5) + var(--sp-3));
    }

    .expanded-fields {
      background: var(--bg-base);
      border-radius: var(--radius-sm);
      padding: var(--sp-3);
      margin-bottom: var(--sp-2);
    }

    .exp-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 2px 0;
    }

    .exp-key {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: capitalize;
    }

    .exp-value {
      font-size: 12px;
      color: var(--text-body);
      text-align: right;
      max-width: 55%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .data { font-family: var(--font-data); }

    .explorer-link {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-1);
      font-size: 11px;
      font-weight: 500;
      color: var(--accent);
      text-decoration: none;
      transition: opacity 150ms;
    }
    .explorer-link:hover { opacity: 0.8; }

    .load-more {
      display: block;
      width: 100%;
      padding: var(--sp-3);
      border: none;
      border-top: 1px solid var(--border-subtle);
      background: transparent;
      color: var(--accent);
      font-family: var(--font-body);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 150ms;
    }
    .load-more:hover:not(:disabled) { background: var(--accent-muted); }
    .load-more:disabled { color: var(--text-disabled); cursor: default; }

    /* Account list */
    .accounts-section h3 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: var(--sp-3);
    }
    .accounts-list {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      overflow: hidden;
    }
    .account-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--sp-3) var(--sp-5);
      cursor: pointer;
      transition: background 150ms ease;
      border-bottom: 1px solid var(--border-subtle);
    }
    .account-row:last-child { border-bottom: none; }
    .account-row:hover { background: var(--bg-hover); }
    .account-row.selected { background: var(--accent-muted); }
    .acct-name {
      font-family: var(--font-data);
      font-size: 14px;
      font-weight: 500;
      color: var(--text-bright);
    }
    .acct-bal {
      font-family: var(--font-data);
      font-size: 13px;
      color: var(--text-muted);
    }
  `],
})
export class WalletComponent {
  private static readonly PAGE_SIZE = 20;

  refreshing = signal(false);
  actions = signal<HistoryAction[]>([]);
  historyLoading = signal(false);
  historyError = signal('');
  hasMore = signal(false);
  expandedIndex = signal<number | null>(null);

  // Filters
  filterAction = signal('');
  filterAfter = signal('');
  filterBefore = signal('');

  constructor(
    public wallet: WalletStateService,
    private ipc: TauriIpcService,
  ) {
    // Reload history when selected account changes
    effect(() => {
      const acct = this.wallet.selectedAccount();
      if (acct) {
        this.actions.set([]);
        this.expandedIndex.set(null);
        this.loadHistory(0);
      }
    });
  }

  onFilterAction(value: string) {
    this.filterAction.set(value);
    this.reloadFiltered();
  }

  onFilterAfter(value: string) {
    this.filterAfter.set(value);
    this.reloadFiltered();
  }

  onFilterBefore(value: string) {
    this.filterBefore.set(value);
    this.reloadFiltered();
  }

  clearFilters() {
    this.filterAction.set('');
    this.filterAfter.set('');
    this.filterBefore.set('');
    this.reloadFiltered();
  }

  private reloadFiltered() {
    this.actions.set([]);
    this.expandedIndex.set(null);
    this.loadHistory(0);
  }

  private get activeFilters(): { actName?: string; after?: string; before?: string } | undefined {
    const f: any = {};
    if (this.filterAction()) f.actName = this.filterAction();
    if (this.filterAfter()) f.after = this.filterAfter() + 'T00:00:00.000Z';
    if (this.filterBefore()) f.before = this.filterBefore() + 'T23:59:59.999Z';
    return Object.keys(f).length ? f : undefined;
  }

  async loadHistory(skip: number) {
    const acct = this.wallet.selectedAccount();
    if (!acct || !this.wallet.hasTauri()) return;

    this.historyLoading.set(true);
    this.historyError.set('');

    try {
      const result = await this.ipc.getActionsHistory(
        acct.chainId, acct.name, WalletComponent.PAGE_SIZE, skip,
        this.activeFilters,
      );

      const raw: any[] = result?.actions ?? [];
      const mapped: HistoryAction[] = raw.map((a: any) => ({
        trx_id: a.trx_id ?? '',
        block_num: a.block_num ?? 0,
        timestamp: a['@timestamp'] ?? '',
        contract: a.act?.account ?? '',
        name: a.act?.name ?? '',
        data: a.act?.data ?? {},
        irreversible: a.irreversible ?? false,
      }));

      if (skip === 0) {
        this.actions.set(mapped);
      } else {
        this.actions.update(prev => [...prev, ...mapped]);
      }

      const total = result?.total?.value ?? 0;
      this.hasMore.set(skip + mapped.length < total);
    } catch (e: any) {
      if (skip === 0) {
        this.historyError.set('Could not load history. No Hyperion endpoint available.');
      }
    } finally {
      this.historyLoading.set(false);
    }
  }

  loadMore() {
    this.loadHistory(this.actions().length);
  }

  toggleExpand(index: number) {
    this.expandedIndex.set(this.expandedIndex() === index ? null : index);
  }

  async refreshAccount() {
    this.refreshing.set(true);
    try {
      await this.wallet.refreshAccount(this.wallet.selectedIndex());
      await this.wallet.saveAccounts();
      this.actions.set([]);
      this.loadHistory(0);
    } finally {
      this.refreshing.set(false);
    }
  }

  // ── Display helpers ──

  actionLabel(a: HistoryAction): string {
    switch (a.name) {
      case 'transfer': return 'Transfer';
      case 'delegatebw': return 'Stake';
      case 'undelegatebw': return 'Unstake';
      case 'voteproducer': return 'Vote';
      case 'buyram': case 'buyrambytes': return 'Buy RAM';
      case 'sellram': return 'Sell RAM';
      case 'powerup': return 'PowerUp';
      case 'buyrex': return 'Buy REX';
      case 'sellrex': return 'Sell REX';
      case 'claimrewards': return 'Claim Rewards';
      case 'newaccount': return 'Create Account';
      case 'updateauth': return 'Update Auth';
      default: return a.name;
    }
  }

  actionDetail(a: HistoryAction): string {
    if (a.name === 'transfer') {
      return `${a.data['from'] ?? ''} → ${a.data['to'] ?? ''}`;
    }
    if (a.name === 'delegatebw' || a.name === 'undelegatebw') {
      return `${a.data['from'] ?? ''} → ${a.data['receiver'] ?? ''}`;
    }
    if (a.name === 'voteproducer') {
      const prods = a.data['producers'] as string[] | undefined;
      if (prods?.length) return `${prods.length} producer${prods.length > 1 ? 's' : ''}`;
      if (a.data['proxy']) return `proxy: ${a.data['proxy']}`;
      return '';
    }
    return a.contract;
  }

  actionAmount(a: HistoryAction): string {
    if (a.name === 'transfer') return a.data['quantity'] ?? '';
    if (a.name === 'delegatebw') {
      const cpu = a.data['stake_cpu_quantity'] ?? '0';
      const net = a.data['stake_net_quantity'] ?? '0';
      const cpuVal = parseFloat(cpu) || 0;
      const netVal = parseFloat(net) || 0;
      if (cpuVal + netVal > 0) {
        const symbol = cpu.split(' ')[1] ?? '';
        return `${(cpuVal + netVal).toFixed(4)} ${symbol}`;
      }
      return '';
    }
    if (a.name === 'undelegatebw') {
      const cpu = a.data['unstake_cpu_quantity'] ?? '0';
      const net = a.data['unstake_net_quantity'] ?? '0';
      const cpuVal = parseFloat(cpu) || 0;
      const netVal = parseFloat(net) || 0;
      if (cpuVal + netVal > 0) {
        const symbol = cpu.split(' ')[1] ?? '';
        return `${(cpuVal + netVal).toFixed(4)} ${symbol}`;
      }
      return '';
    }
    if (a.name === 'buyram') return a.data['quant'] ?? '';
    if (a.name === 'powerup') return a.data['max_payment'] ?? '';
    return '';
  }

  isIncoming(a: HistoryAction): boolean {
    if (a.name !== 'transfer') return false;
    return a.data['to'] === this.wallet.selectedAccount()?.name;
  }

  actionIcon(a: HistoryAction): string {
    const svg = (d: string) =>
      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    switch (a.name) {
      case 'transfer':
        return this.isIncoming(a)
          ? svg('<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>')
          : svg('<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>');
      case 'delegatebw': case 'buyrex':
        return svg('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>');
      case 'undelegatebw': case 'sellrex':
        return svg('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>');
      case 'voteproducer':
        return svg('<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>');
      case 'buyram': case 'buyrambytes': case 'sellram':
        return svg('<rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>');
      case 'claimrewards':
        return svg('<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>');
      default:
        return svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>');
    }
  }

  dataFields(a: HistoryAction): { key: string; value: string }[] {
    if (!a.data) return [];
    return Object.entries(a.data).map(([key, value]) => ({
      key,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
    }));
  }

  explorerTxUrl(trxId: string): string | null {
    const chain = this.wallet.activeChain();
    if (!chain?.explorers?.length) return null;
    const explorer = chain.explorers.find((e: any) => e.tx_url);
    if (!explorer?.tx_url) return null;
    return explorer.tx_url.replace('{txid}', trxId);
  }

  relativeTime(iso: string): string {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  formatBalance(balance?: string | null): string {
    if (!balance) return '0.0000';
    return balance.split(' ')[0] ?? '0.0000';
  }

  getSymbol(balance?: string | null): string {
    if (!balance) return '';
    return balance.split(' ')[1] ?? '';
  }

  formatStakeWeight(cpu?: number | null, net?: number | null): string {
    const total = ((cpu ?? 0) + (net ?? 0)) / 10000;
    return total.toFixed(4);
  }

  cpuPct(): number {
    const acct = this.wallet.selectedAccount();
    if (!acct) return 0;
    const limit = acct.info.cpu_limit;
    if (!limit?.max || limit.max <= 0) return 0;
    return Math.min(100, Math.round(((limit.used ?? 0) / limit.max) * 100));
  }

  ramPct(): number {
    const acct = this.wallet.selectedAccount();
    if (!acct) return 0;
    const quota = acct.info.ram_quota ?? 1;
    const usage = acct.info.ram_usage ?? 0;
    return quota > 0 ? Math.min(100, Math.round((usage / quota) * 100)) : 0;
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  formatUs(weight?: number | null): string {
    if (!weight) return '0.0000';
    return (weight / 10000).toFixed(4);
  }
}
