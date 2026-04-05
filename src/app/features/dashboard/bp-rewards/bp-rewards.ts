import { Component, effect, signal } from '@angular/core';
import { WalletStateService } from '../../../core/services/wallet-state.service';
import { TauriIpcService } from '../../../core/services/tauri-ipc.service';
import { TransactionService } from '../../../core/services/transaction.service';

interface ClaimAction {
  timestamp: string;
  trx_id: string;
  data: any;
}

@Component({
  selector: 'app-bp-rewards',
  standalone: true,
  template: `
    <div class="bp-rewards-view">
      <div class="bp-badge">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
        <span>Block Producer</span>
      </div>
      <h2>Rewards Analytics</h2>

      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-label">UNCLAIMED</span>
          <span class="stat-value positive">{{ unclaimedPay() }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">LAST CLAIM</span>
          <span class="stat-value">{{ lastClaimTime() }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">CLAIMS</span>
          <span class="stat-value">{{ claimHistory().length }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">RANK</span>
          <span class="stat-value">#{{ wallet.selectedAccount().producerRank ?? '—' }}</span>
        </div>
      </div>

      <div class="section-card">
        <div class="section-header">
          <h3>Claim History</h3>
          <button class="btn-primary" (click)="onClaimRewards()" [disabled]="busy()">CLAIM REWARDS</button>
        </div>

        @if (loadingHistory()) {
          <p class="loading-text">Loading claim history...</p>
        } @else if (claimHistory().length === 0) {
          <p class="loading-text">No claim history found.</p>
        } @else {
          <div class="history-table">
            <div class="table-header">
              <span>Date</span>
              <span>Amount</span>
              <span>TX</span>
            </div>
            @for (claim of claimHistory(); track claim.trx_id) {
              <div class="table-row">
                <span>{{ formatDate(claim.timestamp) }}</span>
                <span class="data positive">{{ formatClaimAmount(claim) }}</span>
                <span class="tx-link">{{ claim.trx_id.slice(0, 8) }}...{{ claim.trx_id.slice(-4) }}</span>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .bp-rewards-view { max-width: 800px; }

    .bp-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      padding: var(--sp-1) var(--sp-3);
      background: var(--accent-muted);
      color: var(--accent);
      border-radius: var(--radius-full);
      font-size: 12px;
      font-weight: 500;
      margin-bottom: var(--sp-3);
    }

    h2 { font-size: 24px; margin-bottom: var(--sp-6); }

    .stats-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--sp-4);
      margin-bottom: var(--sp-6);
    }
    .stat-card {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      padding: var(--sp-4);
    }
    .stat-label {
      display: block; font-size: 11px; font-weight: 500;
      letter-spacing: 1.5px; color: var(--text-muted); margin-bottom: var(--sp-1);
    }
    .stat-value {
      font-family: var(--font-data); font-size: 18px; font-weight: 600; color: var(--text-bright);
    }
    .stat-value.positive { color: var(--positive); }

    .section-card {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      padding: var(--sp-5);
    }
    .section-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: var(--sp-5);
    }
    .section-header h3 { font-size: 15px; }

    .history-table { font-size: 13px; }
    .table-header, .table-row {
      display: grid;
      grid-template-columns: 1.5fr 1fr 1fr 1.2fr 0.8fr;
      padding: var(--sp-3) var(--sp-2);
      border-bottom: 1px solid var(--border-subtle);
    }
    .table-header {
      font-size: 11px; font-weight: 500; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .table-row { color: var(--text-body); }
    .table-row:last-child { border-bottom: none; }
    .table-row:hover { background: var(--bg-hover); }
    .data { font-family: var(--font-data); }
    .positive { color: var(--positive); }
    .tx-link {
      font-family: var(--font-data); color: var(--accent); cursor: pointer;
      font-size: 12px;
    }
    .tx-link:hover { text-decoration: underline; }

    .btn-primary {
      padding: var(--sp-2) var(--sp-4);
      border: none; border-radius: var(--radius-sm);
      background: var(--accent); color: #fff;
      font-family: var(--font-body); font-size: 12px;
      font-weight: 500; letter-spacing: 1px;
      text-transform: uppercase; cursor: pointer;
      transition: background 150ms ease;
    }
    .btn-primary:hover { background: var(--accent-hover); }
  `],
})
export class BpRewardsComponent {
  busy = signal(false);
  loadingHistory = signal(false);
  claimHistory = signal<ClaimAction[]>([]);
  unclaimedPay = signal('—');
  lastClaimTime = signal('—');

  constructor(
    public wallet: WalletStateService,
    private ipc: TauriIpcService,
    private tx: TransactionService,
  ) {
    effect(() => {
      const acct = this.wallet.selectedAccount();
      if (acct?.isProducer) {
        this.loadRewardsData(acct.chainId, acct.name);
        this.loadClaimHistory(acct.chainId, acct.name);
      }
    });
  }

  private async loadRewardsData(chainId: string, account: string) {
    try {
      const result = await this.ipc.getTableRows(chainId, {
        code: 'eosio', table: 'producers', scope: 'eosio',
        lower_bound: account, upper_bound: account, limit: 1, json: true,
      });
      const row = result?.rows?.[0];
      if (row) {
        // Unclaimed: unpaid_blocks from producer table (approximate display)
        const unpaid = row.unpaid_blocks ?? 0;
        this.unclaimedPay.set(unpaid > 0 ? `${unpaid} blocks` : 'None');
        // Last claim time
        if (row.last_claim_time && row.last_claim_time !== '1970-01-01T00:00:00.000') {
          this.lastClaimTime.set(this.relativeTime(row.last_claim_time));
        } else {
          this.lastClaimTime.set('Never');
        }
      }
    } catch { /* offline */ }
  }

  private async loadClaimHistory(chainId: string, account: string) {
    this.loadingHistory.set(true);
    try {
      const result = await this.ipc.getActionsHistory(chainId, account, 20, 0, { actName: 'claimrewards' });
      const raw: any[] = result?.actions ?? [];
      this.claimHistory.set(raw.map((a: any) => ({
        timestamp: a['@timestamp'] ?? '',
        trx_id: a.trx_id ?? '',
        data: a.act?.data ?? {},
      })));
    } catch {
      this.claimHistory.set([]);
    } finally {
      this.loadingHistory.set(false);
    }
  }

  async onClaimRewards() {
    const account = this.wallet.selectedAccount();
    if (!account) return;
    this.busy.set(true);
    try {
      const keys = await this.ipc.listPublicKeys(account.chainId);
      if (keys.length === 0) return;
      const result = await this.tx.confirm({
        chainId: account.chainId, publicKey: keys[0],
        actions: [{
          account: 'eosio', name: 'claimrewards',
          authorization: [{ actor: account.name, permission: 'active' }],
          data: { owner: account.name },
        }],
        title: 'Claim Rewards',
      });
      if (result) {
        await this.wallet.refreshAccount(this.wallet.selectedIndex());
        await this.loadRewardsData(account.chainId, account.name);
        await this.loadClaimHistory(account.chainId, account.name);
      }
    } finally {
      this.busy.set(false);
    }
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  formatClaimAmount(claim: ClaimAction): string {
    // Hyperion claimrewards actions may have inline traces with transfer amounts
    // Fall back to showing the action happened
    return 'Claimed';
  }

  private relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}
