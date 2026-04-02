import { Component } from '@angular/core';
import { WalletStateService } from '../../../core/services/wallet-state.service';

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
          <span class="stat-value positive">1,247.3200 EOS</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">LAST CLAIM</span>
          <span class="stat-value">2 days ago</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">DAILY EST.</span>
          <span class="stat-value">~623.66 EOS</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">RANK</span>
          <span class="stat-value">#{{ wallet.selectedAccount()?.producerRank ?? '—' }}</span>
        </div>
      </div>

      <div class="section-card">
        <div class="section-header">
          <h3>Claim History</h3>
          <button class="btn-primary">CLAIM REWARDS</button>
        </div>

        <div class="history-table">
          <div class="table-header">
            <span>Date</span>
            <span>Block Pay</span>
            <span>Vote Pay</span>
            <span>Total</span>
            <span>TX</span>
          </div>
          <div class="table-row">
            <span>Mar 31, 2026</span>
            <span class="data">312.4100</span>
            <span class="data">311.2500</span>
            <span class="data positive">623.6600 EOS</span>
            <span class="tx-link">a3f2...8b1c</span>
          </div>
          <div class="table-row">
            <span>Mar 30, 2026</span>
            <span class="data">298.8800</span>
            <span class="data">305.1200</span>
            <span class="data positive">604.0000 EOS</span>
            <span class="tx-link">7d1e...4a2f</span>
          </div>
          <div class="table-row">
            <span>Mar 29, 2026</span>
            <span class="data">315.2200</span>
            <span class="data">318.7800</span>
            <span class="data positive">634.0000 EOS</span>
            <span class="tx-link">c9b5...e3d7</span>
          </div>
        </div>
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
  constructor(public wallet: WalletStateService) {}
}
