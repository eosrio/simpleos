import { Component } from '@angular/core';
import { WalletStateService } from '../../../core/services/wallet-state.service';

@Component({
  selector: 'app-resources',
  standalone: true,
  template: `
    <div class="resources-view">
      <h2>Resources</h2>

      <div class="resources-grid">
        <!-- RAM -->
        <div class="section-card">
          <h3>RAM</h3>
          <div class="ram-price">
            <span class="price-label">Current Price</span>
            <span class="price-value">— {{ wallet.activeChain()?.symbol ?? 'EOS' }}/KB</span>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Buy RAM (KB)</label>
              <input class="form-input" type="text" placeholder="0" />
            </div>
            <button class="btn-primary">BUY</button>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Sell RAM (KB)</label>
              <input class="form-input" type="text" placeholder="0" />
            </div>
            <button class="btn-danger">SELL</button>
          </div>
        </div>

        <!-- CPU / NET Delegation -->
        <div class="section-card">
          <h3>CPU / NET Delegation</h3>
          <p class="section-desc">Delegate CPU and NET resources to another account, or manage your own stake.</p>

          <div class="form-group">
            <label>Receiver account</label>
            <input class="form-input" type="text" placeholder="Account name" />
          </div>

          <div class="delegate-row">
            <div class="form-group">
              <label>CPU ({{ wallet.activeChain()?.symbol ?? 'EOS' }})</label>
              <input class="form-input" type="text" placeholder="0.0000" />
            </div>
            <div class="form-group">
              <label>NET ({{ wallet.activeChain()?.symbol ?? 'EOS' }})</label>
              <input class="form-input" type="text" placeholder="0.0000" />
            </div>
          </div>

          <button class="btn-primary">DELEGATE</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .resources-view { max-width: 800px; }
    h2 { font-size: 24px; margin-bottom: var(--sp-6); }

    .resources-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--sp-6);
    }

    .section-card {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      padding: var(--sp-6);
    }
    .section-card h3 { font-size: 16px; margin-bottom: var(--sp-4); }
    .section-desc { font-size: 13px; color: var(--text-muted); margin-bottom: var(--sp-5); }

    .ram-price {
      background: var(--bg-hover);
      border-radius: var(--radius-sm);
      padding: var(--sp-3) var(--sp-4);
      margin-bottom: var(--sp-5);
      display: flex;
      justify-content: space-between;
    }
    .price-label { font-size: 12px; color: var(--text-muted); }
    .price-value { font-family: var(--font-data); font-size: 13px; color: var(--text-bright); }

    .form-group { margin-bottom: var(--sp-4); }
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
      background: var(--bg-base);
      color: var(--text-bright);
      font-family: var(--font-data);
      font-size: 14px;
    }
    .form-input::placeholder { color: var(--text-disabled); }

    .form-row {
      display: flex;
      gap: var(--sp-3);
      align-items: flex-end;
      margin-bottom: var(--sp-4);
    }
    .form-row .form-group { flex: 1; margin-bottom: 0; }

    .delegate-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--sp-3);
    }

    .btn-primary, .btn-danger {
      padding: var(--sp-3) var(--sp-5);
      border: none;
      border-radius: var(--radius-sm);
      font-family: var(--font-body);
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 1px;
      text-transform: uppercase;
      cursor: pointer;
      white-space: nowrap;
      transition: background 150ms ease;
    }
    .btn-primary { background: var(--accent); color: #fff; }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-danger { background: var(--negative); color: #fff; }
    .btn-danger:hover { opacity: 0.85; }
  `],
})
export class ResourcesComponent {
  constructor(public wallet: WalletStateService) {}
}
