import { Component } from '@angular/core';
import { WalletStateService } from '../../../core/services/wallet-state.service';

@Component({
  selector: 'app-bp-votes',
  standalone: true,
  template: `
    <div class="bp-votes-view">
      <div class="bp-badge">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
        <span>Block Producer</span>
      </div>
      <h2>Vote Analytics</h2>

      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-label">TOTAL VOTES</span>
          <span class="stat-value">482.3M EOS</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">UNIQUE VOTERS</span>
          <span class="stat-value">1,847</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">PROXY VOTES</span>
          <span class="stat-value">312.1M EOS</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">DIRECT VOTES</span>
          <span class="stat-value">170.2M EOS</span>
        </div>
      </div>

      <div class="section-card">
        <h3>Top Voters</h3>
        <p class="section-desc">Largest vote weight contributors to {{ wallet.selectedAccount()?.name }}</p>

        <div class="voters-table">
          <div class="table-header">
            <span>#</span>
            <span>Account</span>
            <span>Vote Weight</span>
            <span>Type</span>
            <span>Last Vote</span>
          </div>
          <div class="table-row">
            <span class="rank">1</span>
            <span class="data account">bigproxy.gm</span>
            <span class="data">142,380,000</span>
            <span class="type-badge proxy">Proxy</span>
            <span>3 hours ago</span>
          </div>
          <div class="table-row">
            <span class="rank">2</span>
            <span class="data account">whaleaccount</span>
            <span class="data">89,240,000</span>
            <span class="type-badge direct">Direct</span>
            <span>1 day ago</span>
          </div>
          <div class="table-row">
            <span class="rank">3</span>
            <span class="data account">proxy4nation</span>
            <span class="data">67,100,000</span>
            <span class="type-badge proxy">Proxy</span>
            <span>4 hours ago</span>
          </div>
          <div class="table-row">
            <span class="rank">4</span>
            <span class="data account">stakeholder1</span>
            <span class="data">34,500,000</span>
            <span class="type-badge direct">Direct</span>
            <span>2 days ago</span>
          </div>
          <div class="table-row">
            <span class="rank">5</span>
            <span class="data account">communityacc</span>
            <span class="data">28,900,000</span>
            <span class="type-badge direct">Direct</span>
            <span>5 days ago</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .bp-votes-view { max-width: 800px; }

    .bp-badge {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-1) var(--sp-3); background: var(--accent-muted);
      color: var(--accent); border-radius: var(--radius-full);
      font-size: 12px; font-weight: 500; margin-bottom: var(--sp-3);
    }
    h2 { font-size: 24px; margin-bottom: var(--sp-6); }

    .stats-row {
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: var(--sp-4); margin-bottom: var(--sp-6);
    }
    .stat-card {
      background: var(--bg-raised); border-radius: var(--radius-md); padding: var(--sp-4);
    }
    .stat-label {
      display: block; font-size: 11px; font-weight: 500;
      letter-spacing: 1.5px; color: var(--text-muted); margin-bottom: var(--sp-1);
    }
    .stat-value {
      font-family: var(--font-data); font-size: 18px; font-weight: 600; color: var(--text-bright);
    }

    .section-card {
      background: var(--bg-raised); border-radius: var(--radius-md); padding: var(--sp-5);
    }
    .section-card h3 { font-size: 15px; margin-bottom: var(--sp-2); }
    .section-desc { font-size: 13px; color: var(--text-muted); margin-bottom: var(--sp-5); }

    .voters-table { font-size: 13px; }
    .table-header, .table-row {
      display: grid;
      grid-template-columns: 0.4fr 1.5fr 1.2fr 0.8fr 1fr;
      padding: var(--sp-3) var(--sp-2);
      border-bottom: 1px solid var(--border-subtle);
      align-items: center;
    }
    .table-header {
      font-size: 11px; font-weight: 500; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .table-row { color: var(--text-body); }
    .table-row:last-child { border-bottom: none; }
    .table-row:hover { background: var(--bg-hover); }
    .rank { color: var(--text-muted); font-weight: 500; }
    .data { font-family: var(--font-data); }
    .account { color: var(--accent); cursor: pointer; }
    .account:hover { text-decoration: underline; }
    .type-badge {
      font-size: 11px; font-weight: 500; padding: 2px var(--sp-2);
      border-radius: var(--radius-full); display: inline-block; text-align: center;
    }
    .type-badge.proxy { background: var(--accent-muted); color: var(--accent); }
    .type-badge.direct { background: rgba(45, 212, 168, 0.12); color: var(--positive); }
  `],
})
export class BpVotesComponent {
  constructor(public wallet: WalletStateService) {}
}
