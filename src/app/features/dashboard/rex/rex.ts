import { Component } from '@angular/core';
import { WalletStateService } from '../../../core/services/wallet-state.service';

@Component({
  selector: 'app-rex',
  standalone: true,
  template: `
    <div class="rex-view">
      <h2>REX</h2>
      <p class="page-desc">Resource Exchange — stake tokens into REX to earn rewards from network fees and RAM trading.</p>

      <div class="rex-grid">
        <div class="section-card">
          <h3>Buy REX</h3>
          <div class="form-group">
            <label>Amount ({{ wallet.activeChain()?.symbol ?? 'EOS' }})</label>
            <input class="form-input" type="text" placeholder="0.0000" />
          </div>
          <button class="btn-primary">BUY REX</button>
        </div>

        <div class="section-card">
          <h3>Sell REX</h3>
          <div class="form-group">
            <label>REX amount</label>
            <input class="form-input" type="text" placeholder="0.0000" />
          </div>
          <button class="btn-primary">SELL REX</button>
        </div>
      </div>

      <div class="section-card">
        <h3>REX Balance</h3>
        <div class="rex-info-row">
          <div class="rex-info">
            <span class="info-label">REX Balance</span>
            <span class="info-value">—</span>
          </div>
          <div class="rex-info">
            <span class="info-label">Matured REX</span>
            <span class="info-value">—</span>
          </div>
          <div class="rex-info">
            <span class="info-label">Savings</span>
            <span class="info-value">—</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .rex-view { max-width: 800px; }
    h2 { font-size: 24px; margin-bottom: var(--sp-2); }
    .page-desc { font-size: 13px; color: var(--text-muted); margin-bottom: var(--sp-6); }

    .rex-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--sp-4);
      margin-bottom: var(--sp-6);
    }
    .section-card {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      padding: var(--sp-6);
    }
    .section-card h3 { font-size: 16px; margin-bottom: var(--sp-4); }

    .form-group { margin-bottom: var(--sp-4); }
    label {
      display: block; font-size: 12px; font-weight: 500;
      color: var(--text-muted); text-transform: uppercase;
      letter-spacing: 0.5px; margin-bottom: var(--sp-2);
    }
    .form-input {
      width: 100%;
      padding: var(--sp-3) var(--sp-4);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      background: var(--bg-base);
      color: var(--text-bright);
      font-family: var(--font-data);
      font-size: 14px;
    }
    .form-input::placeholder { color: var(--text-disabled); }

    .btn-primary {
      width: 100%;
      padding: var(--sp-3);
      border: none; border-radius: var(--radius-sm);
      background: var(--accent); color: #fff;
      font-family: var(--font-body); font-size: 13px;
      font-weight: 500; letter-spacing: 1px;
      text-transform: uppercase; cursor: pointer;
      transition: background 150ms ease;
    }
    .btn-primary:hover { background: var(--accent-hover); }

    .rex-info-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--sp-4);
    }
    .rex-info { text-align: center; }
    .info-label {
      display: block; font-size: 11px;
      color: var(--text-muted); letter-spacing: 1px;
      text-transform: uppercase; margin-bottom: var(--sp-1);
    }
    .info-value {
      font-family: var(--font-data); font-size: 18px;
      font-weight: 600; color: var(--text-bright);
    }
  `],
})
export class RexComponent {
  constructor(public wallet: WalletStateService) {}
}
