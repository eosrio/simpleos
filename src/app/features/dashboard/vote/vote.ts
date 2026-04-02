import { Component } from '@angular/core';
import { WalletStateService } from '../../../core/services/wallet-state.service';

@Component({
  selector: 'app-vote',
  standalone: true,
  template: `
    <div class="vote-view">
      <h2>Vote / Stake</h2>

      <!-- Summary cards -->
      <div class="summary-row">
        <div class="summary-card">
          <span class="summary-label">TOTAL</span>
          <span class="summary-value">{{ wallet.selectedAccount()?.info?.core_liquid_balance ?? '0.0000' }}</span>
        </div>
        <div class="summary-card">
          <span class="summary-label">STAKED</span>
          <span class="summary-value">{{ formatStake() }}</span>
        </div>
        <div class="summary-card">
          <span class="summary-label">VOTE DECAY</span>
          <span class="summary-value decay">—</span>
        </div>
      </div>

      <!-- Staking section -->
      <div class="section-card">
        <h3>Stake your {{ wallet.activeChain()?.symbol ?? 'EOS' }}</h3>
        <p class="section-desc">Staked tokens are used for voting and resource allocation. You can unstake at any time (with a 3-day delay).</p>
        <div class="stake-controls">
          <div class="form-group">
            <label>Amount to stake</label>
            <input class="form-input" type="text" placeholder="0.0000" />
          </div>
          <button class="btn-primary">SET STAKE</button>
        </div>
      </div>

      <!-- BP voting section -->
      <div class="section-card">
        <div class="section-tabs">
          <button class="tab active">Vote for Block Producers</button>
          <button class="tab">Vote through a Proxy</button>
        </div>
        <p class="section-desc">Select up to 30 block producers to vote for. Your vote weight is based on your staked tokens.</p>

        <div class="search-bar">
          <input class="form-input" type="text" placeholder="Search producers..." />
        </div>

        <div class="producers-empty">
          <p>Connect to a chain to load block producers.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .vote-view { max-width: 800px; }
    h2 { font-size: 24px; margin-bottom: var(--sp-6); }

    .summary-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--sp-4);
      margin-bottom: var(--sp-6);
    }
    .summary-card {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      padding: var(--sp-4) var(--sp-5);
    }
    .summary-label {
      display: block;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 1.5px;
      color: var(--text-muted);
      margin-bottom: var(--sp-1);
    }
    .summary-value {
      font-family: var(--font-data);
      font-size: 20px;
      font-weight: 600;
      color: var(--text-bright);
    }
    .summary-value.decay { color: var(--negative); }

    .section-card {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      padding: var(--sp-6);
      margin-bottom: var(--sp-6);
    }
    .section-card h3 { font-size: 16px; margin-bottom: var(--sp-2); }
    .section-desc { font-size: 13px; color: var(--text-muted); margin-bottom: var(--sp-5); }

    .stake-controls {
      display: flex;
      gap: var(--sp-4);
      align-items: flex-end;
    }
    .stake-controls .form-group { flex: 1; margin-bottom: 0; }

    .section-tabs {
      display: flex;
      gap: var(--sp-1);
      margin-bottom: var(--sp-4);
    }
    .tab {
      padding: var(--sp-2) var(--sp-4);
      border: none;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-muted);
      font-family: var(--font-body);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: color 150ms ease, background 150ms ease;
    }
    .tab:hover { color: var(--text-body); background: var(--bg-hover); }
    .tab.active { color: var(--accent); background: var(--accent-muted); }

    .search-bar { margin-bottom: var(--sp-4); }

    .producers-empty {
      padding: var(--sp-8) 0;
      text-align: center;
    }
    .producers-empty p { font-size: 13px; color: var(--text-disabled); }

    .form-group { margin-bottom: var(--sp-5); }
    label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: var(--sp-2);
    }
    .form-input {
      width: 100%;
      padding: var(--sp-3) var(--sp-4);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      background: var(--bg-raised);
      color: var(--text-bright);
      font-family: var(--font-data);
      font-size: 14px;
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }
    .form-input::placeholder { color: var(--text-disabled); }
    .btn-primary {
      padding: var(--sp-3) var(--sp-6);
      border: none;
      border-radius: var(--radius-sm);
      background: var(--accent);
      color: #fff;
      font-family: var(--font-body);
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 1px;
      text-transform: uppercase;
      cursor: pointer;
      white-space: nowrap;
      transition: background 150ms ease;
    }
    .btn-primary:hover { background: var(--accent-hover); }
  `],
})
export class VoteComponent {
  constructor(public wallet: WalletStateService) {}

  formatStake(): string {
    const acct = this.wallet.selectedAccount();
    if (!acct) return '0.0000';
    const total = ((acct.info.cpu_weight ?? 0) + (acct.info.net_weight ?? 0)) / 10000;
    return total.toFixed(4);
  }
}
