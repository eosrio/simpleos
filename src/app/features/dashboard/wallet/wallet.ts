import { Component } from '@angular/core';
import { WalletStateService } from '../../../core/services/wallet-state.service';

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
            <span class="balance-label">BALANCE</span>
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
          </div>
          <div class="activity-empty">
            <p>Transaction history will appear here once connected to a Hyperion endpoint.</p>
          </div>
        </div>

        <!-- Account list (if multiple) -->
        @if (wallet.accounts().length > 1) {
          <div class="accounts-section">
            <h3>Accounts</h3>
            <div class="accounts-list">
              @for (account of wallet.accounts(); track account.name; let i = $index) {
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
    .balance-label {
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 1.5px;
      color: var(--text-muted);
      text-transform: uppercase;
    }
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
      padding: var(--sp-4) var(--sp-5);
      border-bottom: 1px solid var(--border-subtle);
    }
    .activity-header h3 { font-size: 14px; font-weight: 600; }
    .activity-empty {
      padding: var(--sp-8) var(--sp-5);
      text-align: center;
    }
    .activity-empty p { font-size: 13px; color: var(--text-muted); }

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
  constructor(public wallet: WalletStateService) {}

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
    const limit = acct.info.cpu_weight ?? 1;
    return limit > 0 ? Math.min(100, Math.round((0 / limit) * 100)) : 0;
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
