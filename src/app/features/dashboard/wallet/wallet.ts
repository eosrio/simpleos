import { Component, effect, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { open as openUrl } from '@tauri-apps/plugin-shell';
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
  /** First authorizer ("actor") from act.authorization, if present. */
  actor: string;
}

/** A structured value node used to render arbitrary action data. */
type ValueNode =
  | { kind: 'primitive'; key: string; value: string; mono?: boolean }
  | { kind: 'table'; key: string; headers: string[]; rows: string[][] }
  | { kind: 'list'; key: string; items: string[] }
  | { kind: 'object'; key: string; children: ValueNode[] }
  | { kind: 'objectList'; key: string; groups: ValueNode[][] };

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [NgTemplateOutlet],
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

          @if (wallet.selectedAccount()!.extraBalances?.length) {
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
                    <div class="action-icon">
                      @switch (iconKey(action)) {
                        @case ('incoming') {
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                          </svg>
                        }
                        @case ('outgoing') {
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
                          </svg>
                        }
                        @case ('lock') {
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                          </svg>
                        }
                        @case ('unlock') {
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                          </svg>
                        }
                        @case ('vote') {
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                          </svg>
                        }
                        @case ('ram') {
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                            <line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
                          </svg>
                        }
                        @case ('reward') {
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
                          </svg>
                        }
                        @default {
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                          </svg>
                        }
                      }
                    </div>
                    <div class="action-info">
                      <div class="action-line-1">
                        <span class="action-label">{{ actionLabel(action) }}</span>
                        <span class="contract-badge data" [title]="action.contract + '::' + action.name">
                          {{ action.contract }}
                        </span>
                      </div>
                      <span class="action-detail-text">{{ actionDetail(action) }}</span>
                    </div>
                    <div class="action-right">
                      <div class="action-line-1 right-line">
                        @if (actionAmount(action); as amt) {
                          <span class="action-amount" [class.positive]="isIncoming(action)">{{ amt }}</span>
                        } @else if (action.actor) {
                          <span class="action-actor data">{{ action.actor }}</span>
                        }
                      </div>
                      <div class="action-meta-line">
                        <span class="action-time">{{ relativeTime(action.timestamp) }}</span>
                        <span class="action-hash data">#{{ action.trx_id.slice(0, 8) }}</span>
                      </div>
                    </div>
                  </div>

                  @if (expandedIndex() === $index) {
                    <div class="action-expanded" (click)="$event.stopPropagation()">
                      <!-- Transaction metadata card -->
                      <div class="meta-card">
                        <div class="meta-row">
                          <span class="meta-key">Transaction</span>
                          <span class="meta-value data mono-sm">{{ shortHash(action.trx_id) }}</span>
                          <button class="icon-btn" title="Copy transaction id"
                                  (click)="copy(action.trx_id); $event.stopPropagation()">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor" stroke-width="2"
                                 stroke-linecap="round" stroke-linejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                          </button>
                        </div>
                        <div class="meta-row">
                          <span class="meta-key">Block</span>
                          <span class="meta-value data">{{ action.block_num }}</span>
                        </div>
                        <div class="meta-row">
                          <span class="meta-key">Contract</span>
                          <span class="meta-value data">{{ action.contract }}::{{ action.name }}</span>
                        </div>
                        <div class="meta-row">
                          <span class="meta-key">Timestamp</span>
                          <span class="meta-value">{{ formatTimestamp(action.timestamp) }}</span>
                        </div>
                      </div>

                      <!-- Action data card -->
                      @if (richDataNodes(action); as nodes) {
                        @if (nodes.length > 0) {
                          <div class="data-card">
                            <div class="data-card-header">Data</div>
                            <div class="data-card-body">
                              @for (node of nodes; track node.key) {
                                <ng-container [ngTemplateOutlet]="valueNodeTpl"
                                              [ngTemplateOutletContext]="{ $implicit: node, depth: 0 }"/>
                              }
                            </div>
                          </div>
                        }
                      }

                      @if (explorerTxLinks(action.trx_id); as links) {
                        @if (links.length > 0) {
                          <div class="explorer-links">
                            <span class="explorer-links-label">View on</span>
                            @for (link of links; track link.name) {
                              <button type="button" class="explorer-link"
                                      (click)="openExplorer(link.url); $event.stopPropagation()">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                                     stroke="currentColor" stroke-width="2.2"
                                     stroke-linecap="round" stroke-linejoin="round">
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                  <polyline points="15 3 21 3 21 9"/>
                                  <line x1="10" y1="14" x2="21" y2="3"/>
                                </svg>
                                {{ link.name }}
                              </button>
                            }
                          </div>
                        }
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

    <!-- Recursive renderer for ValueNode tree -->
    <ng-template #valueNodeTpl let-node let-depth="depth">
      @switch (node.kind) {
        @case ('primitive') {
          <div class="dv-row" [style.padding-left.px]="depth * 12">
            <span class="dv-key">{{ node.key }}</span>
            <span class="dv-value" [class.data]="node.mono !== false">{{ node.value }}</span>
          </div>
        }
        @case ('list') {
          <div class="dv-row" [style.padding-left.px]="depth * 12">
            <span class="dv-key">{{ node.key }}</span>
            <span class="dv-value data">[{{ node.items.length }}] {{ node.items.join(', ') }}</span>
          </div>
        }
        @case ('table') {
          <div class="dv-block" [style.padding-left.px]="depth * 12">
            <div class="dv-block-header">{{ node.key }} <span class="dv-count">({{ node.rows.length }})</span></div>
            <div class="dv-table-wrap">
              <table class="dv-table">
                <thead>
                  <tr>
                    @for (h of node.headers; track h) { <th>{{ h }}</th> }
                  </tr>
                </thead>
                <tbody>
                  @for (row of node.rows; track $index) {
                    <tr>
                      @for (cell of row; track $index) { <td class="data">{{ cell }}</td> }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
        @case ('object') {
          <div class="dv-block" [style.padding-left.px]="depth * 12">
            <div class="dv-block-header">{{ node.key }}</div>
            @for (child of node.children; track child.key) {
              <ng-container [ngTemplateOutlet]="valueNodeTpl"
                            [ngTemplateOutletContext]="{ $implicit: child, depth: depth + 1 }"/>
            }
          </div>
        }
        @case ('objectList') {
          <div class="dv-block" [style.padding-left.px]="depth * 12">
            <div class="dv-block-header">{{ node.key }} <span class="dv-count">({{ node.groups.length }})</span></div>
            @for (group of node.groups; track $index) {
              <div class="dv-group">
                <div class="dv-group-index">#{{ $index }}</div>
                @for (child of group; track child.key) {
                  <ng-container [ngTemplateOutlet]="valueNodeTpl"
                                [ngTemplateOutletContext]="{ $implicit: child, depth: depth + 1 }"/>
                }
              </div>
            }
          </div>
        }
      }
    </ng-template>
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
      gap: 2px;
      flex: 1;
      min-width: 0;
    }

    .action-line-1 {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      min-width: 0;
    }
    .right-line {
      justify-content: flex-end;
    }

    .action-label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-bright);
      flex-shrink: 0;
    }

    .contract-badge {
      font-size: 10px;
      font-weight: 500;
      color: var(--text-muted);
      background: var(--bg-base);
      border: 1px solid var(--border-subtle);
      padding: 1px 6px;
      border-radius: var(--radius-sm);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 160px;
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
      gap: 2px;
      flex-shrink: 0;
      min-width: 0;
    }

    .action-amount {
      font-size: 13px;
      font-weight: 500;
      font-family: var(--font-data);
      color: var(--text-bright);
    }

    .action-amount.positive { color: var(--positive); }

    .action-actor {
      font-size: 12px;
      color: var(--text-body);
      font-weight: 500;
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .action-meta-line {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
    }

    .action-time {
      font-size: 11px;
      color: var(--text-disabled);
    }

    .action-hash {
      font-size: 10px;
      color: var(--text-disabled);
      padding: 1px 5px;
      border-radius: var(--radius-sm);
      background: var(--bg-base);
    }

    /* Expanded row */
    .action-expanded {
      padding: 0 var(--sp-5) var(--sp-4) calc(32px + var(--sp-5) + var(--sp-3));
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
    }

    .data { font-family: var(--font-data); }
    .mono-sm { font-size: 11px; letter-spacing: 0.2px; }

    /* Meta card (transaction metadata) */
    .meta-card {
      background: var(--bg-base);
      border-radius: var(--radius-sm);
      padding: var(--sp-3);
      display: grid;
      grid-template-columns: 1fr;
      gap: 2px;
    }
    .meta-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-2);
      padding: 2px 0;
    }
    .meta-key {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      flex-shrink: 0;
    }
    .meta-value {
      font-size: 12px;
      color: var(--text-body);
      text-align: right;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
      min-width: 0;
    }
    .icon-btn {
      border: none;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      padding: 2px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-sm);
      transition: color 150ms, background 150ms;
      flex-shrink: 0;
    }
    .icon-btn:hover { color: var(--accent); background: var(--bg-hover); }

    /* Data card (action arguments) */
    .data-card {
      background: var(--bg-base);
      border-radius: var(--radius-sm);
      overflow: hidden;
    }
    .data-card-header {
      font-size: 10px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: var(--sp-2) var(--sp-3);
      border-bottom: 1px solid var(--border-subtle);
    }
    .data-card-body {
      padding: var(--sp-2) var(--sp-3);
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    /* Recursive value renderer */
    .dv-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--sp-3);
      padding: 3px 0;
      min-width: 0;
    }
    .dv-key {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: capitalize;
      flex-shrink: 0;
    }
    .dv-value {
      font-size: 12px;
      color: var(--text-body);
      text-align: right;
      word-break: break-word;
      overflow-wrap: anywhere;
      max-width: 65%;
    }
    .dv-block {
      display: flex;
      flex-direction: column;
      padding: 4px 0;
    }
    .dv-block-header {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: capitalize;
      padding-bottom: 4px;
    }
    .dv-count {
      color: var(--text-disabled);
      font-size: 10px;
      font-weight: normal;
    }
    .dv-group {
      border-left: 2px solid var(--border-subtle);
      padding-left: var(--sp-2);
      margin: 4px 0;
      position: relative;
    }
    .dv-group-index {
      font-size: 10px;
      color: var(--text-disabled);
      font-family: var(--font-data);
      margin-bottom: 2px;
    }
    .dv-table-wrap {
      overflow-x: auto;
      max-width: 100%;
    }
    .dv-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    .dv-table th {
      text-align: left;
      font-weight: 500;
      color: var(--text-muted);
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.4px;
      padding: 4px 8px 4px 0;
      border-bottom: 1px solid var(--border-subtle);
      white-space: nowrap;
    }
    .dv-table td {
      color: var(--text-body);
      padding: 4px 8px 4px 0;
      border-bottom: 1px solid var(--border-subtle);
      vertical-align: top;
      word-break: break-word;
    }
    .dv-table tr:last-child td { border-bottom: none; }

    .explorer-links {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-2);
      padding-top: var(--sp-1);
    }
    .explorer-links-label {
      font-size: 10px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-right: 2px;
    }
    .explorer-link {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 500;
      color: var(--accent);
      background: var(--bg-base);
      border: 1px solid var(--border-subtle);
      padding: 4px 10px;
      border-radius: 999px;
      cursor: pointer;
      text-decoration: none;
      font-family: var(--font-body);
      transition: background 150ms, border-color 150ms, color 150ms;
    }
    .explorer-link:hover {
      background: var(--accent-muted);
      border-color: var(--accent);
      color: var(--accent);
    }

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
        // Hyperion emits `@timestamp` without a timezone (e.g. "2026-04-05T22:39:56.000").
        // JS parses unqualified ISO date-times as *local time*, so append "Z" to force UTC.
        timestamp: this.normalizeTimestamp(a['@timestamp'] ?? a.timestamp ?? ''),
        contract: a.act?.account ?? '',
        name: a.act?.name ?? '',
        data: a.act?.data ?? {},
        irreversible: a.irreversible ?? false,
        actor: a.act?.authorization?.[0]?.actor ?? '',
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
      const memo = a.data['memo'] ? ` · ${a.data['memo']}` : '';
      return `${a.data['from'] ?? ''} → ${a.data['to'] ?? ''}${memo}`;
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
    if (a.name === 'buyram' || a.name === 'buyrambytes') {
      return `${a.data['payer'] ?? ''} → ${a.data['receiver'] ?? ''}`;
    }
    if (a.name === 'updateauth') {
      return `${a.data['account'] ?? ''} · ${a.data['permission'] ?? ''}`;
    }
    // Generic: build a compact preview of the first few data fields.
    return this.genericDataPreview(a.data);
  }

  /** Pick the most useful compact preview from an arbitrary action data payload. */
  private genericDataPreview(data: Record<string, any>): string {
    if (!data) return '';
    const entries = Object.entries(data);
    if (entries.length === 0) return '';

    const parts: string[] = [];
    for (const [key, value] of entries) {
      if (parts.length >= 2) break;
      if (value === null || value === undefined) continue;

      if (Array.isArray(value)) {
        if (value.length > 0) {
          parts.push(`${value.length} ${key}`);
        }
      } else if (typeof value === 'object') {
        // Skip nested objects — too noisy for a one-line preview.
        continue;
      } else {
        const str = String(value);
        if (str.length === 0) continue;
        // Truncate long primitives so they don't dominate the row.
        const trimmed = str.length > 28 ? str.slice(0, 26) + '…' : str;
        parts.push(`${key}: ${trimmed}`);
      }
    }
    return parts.join(' · ');
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

  iconKey(a: HistoryAction): string {
    switch (a.name) {
      case 'transfer': return this.isIncoming(a) ? 'incoming' : 'outgoing';
      case 'delegatebw': case 'buyrex': return 'lock';
      case 'undelegatebw': case 'sellrex': return 'unlock';
      case 'voteproducer': return 'vote';
      case 'buyram': case 'buyrambytes': case 'sellram': return 'ram';
      case 'claimrewards': return 'reward';
      default: return 'generic';
    }
  }

  /**
   * Build a tree of ValueNodes from an action's data payload.
   * Renders primitives inline, arrays of uniformly-shaped objects as mini tables,
   * arrays of primitives as a compact list, and mixed/object trees recursively.
   */
  richDataNodes(a: HistoryAction): ValueNode[] {
    if (!a.data) return [];
    return Object.entries(a.data).map(([k, v]) => this.buildValueNode(k, v));
  }

  private buildValueNode(key: string, value: any): ValueNode {
    if (value === null || value === undefined) {
      return { kind: 'primitive', key, value: '—', mono: false };
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return { kind: 'primitive', key, value: '[]' };
      }
      // Array of primitives
      if (value.every(v => v === null || typeof v !== 'object')) {
        return {
          kind: 'list',
          key,
          items: value.map(v => (v === null ? 'null' : String(v))),
        };
      }
      // Array of objects: if shape is uniform (shared scalar-only keys), render as table
      const allObjects = value.every(v => v && typeof v === 'object' && !Array.isArray(v));
      if (allObjects) {
        const firstKeys = Object.keys(value[0] || {});
        const sameShape = value.every(
          v => Object.keys(v).length === firstKeys.length
            && firstKeys.every(k => k in v),
        );
        const scalarOnly = sameShape && firstKeys.every(k =>
          k !== '__proto__' && k !== 'constructor' && k !== 'prototype' &&
          value.every(v => v[k] === null || typeof v[k] !== 'object')
        );
        if (sameShape && scalarOnly && firstKeys.length > 0) {
          return {
            kind: 'table',
            key,
            headers: firstKeys,
            rows: value.map(v =>
              firstKeys.map(k => (k !== '__proto__' && k !== 'constructor' && k !== 'prototype' && v[k] !== null) ? String(v[k] ?? '') : ''),
            ),
          };
        }
        // Uniform-ish objects but with nested content — render as list of groups
        return {
          kind: 'objectList',
          key,
          groups: value.map(v =>
            Object.entries(v).map(([ck, cv]) => this.buildValueNode(ck, cv)),
          ),
        };
      }
      // Mixed array — fall back to stringified list
      return {
        kind: 'list',
        key,
        items: value.map(v =>
          typeof v === 'object' ? JSON.stringify(v) : String(v),
        ),
      };
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value);
      if (entries.length === 0) {
        return { kind: 'primitive', key, value: '{}' };
      }
      return {
        kind: 'object',
        key,
        children: entries.map(([ck, cv]) => this.buildValueNode(ck, cv)),
      };
    }

    // Primitive
    return {
      kind: 'primitive',
      key,
      value: String(value),
      mono: typeof value !== 'boolean',
    };
  }

  shortHash(hash: string): string {
    if (!hash) return '';
    if (hash.length <= 20) return hash;
    return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
  }

  formatTimestamp(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard may be unavailable — silently ignore.
    }
  }

  async openExplorer(url: string): Promise<void> {
    try {
      await openUrl(url);
    } catch (e) {
      console.error('Failed to open explorer URL', url, e);
    }
  }

  /** All configured explorers that expose a transaction URL for the active chain. */
  explorerTxLinks(trxId: string): { name: string; url: string }[] {
    const chain = this.wallet.activeChain();
    if (!chain?.explorers?.length || !trxId) return [];
    return chain.explorers
      .filter((e: any) => e?.tx_url)
      .map((e: any) => ({
        name: e.name,
        url: e.tx_url.replace('{txid}', trxId),
      }));
  }

  /**
   * Force an ISO timestamp to be parsed as UTC.
   * Hyperion returns `@timestamp` as "2026-04-05T22:39:56.000" with no tz suffix,
   * which `new Date()` interprets as local time and breaks relative/absolute displays.
   */
  private normalizeTimestamp(iso: string): string {
    if (!iso) return '';
    // Already has a timezone suffix ("Z" or ±HH:MM) → trust it.
    if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso)) return iso;
    return iso + 'Z';
  }

  relativeTime(iso: string): string {
    if (!iso) return '';
    const t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    // Clamp negative diffs to 0 so clock skew / slightly-future timestamps show "just now".
    const diff = Math.max(0, Date.now() - t);
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return 'just now';
    const mins = Math.floor(secs / 60);
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
