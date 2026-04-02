import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WalletStateService } from '../../../core/services/wallet-state.service';

@Component({
  selector: 'app-dapp',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="dapp-view">
      <h2>Contracts</h2>
      <p class="page-desc">Interact with smart contracts by loading their ABI and calling actions directly.</p>

      <div class="section-card">
        <div class="form-group">
          <label>Contract Account</label>
          <div class="input-row">
            <input class="form-input" type="text"
                   placeholder="e.g. eosio.token"
                   [value]="contractName()"
                   (input)="contractName.set($any($event.target).value)" />
            <button class="btn-primary" [disabled]="!contractName()">LOAD ABI</button>
          </div>
        </div>

        @if (abiLoaded()) {
          <div class="abi-section">
            <div class="form-group">
              <label>Action</label>
              <select class="form-input">
                <option>transfer</option>
                <option>issue</option>
                <option>retire</option>
              </select>
            </div>
            <div class="action-fields">
              <p class="section-desc">Action parameters will render dynamically from the ABI schema.</p>
            </div>
          </div>
        } @else {
          <div class="empty-abi">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-disabled)"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
            <p>Enter a contract account name and load its ABI to interact with it.</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .dapp-view { max-width: 700px; }
    h2 { font-size: 24px; margin-bottom: var(--sp-2); }
    .page-desc { font-size: 13px; color: var(--text-muted); margin-bottom: var(--sp-6); }

    .section-card {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      padding: var(--sp-6);
    }
    .section-desc { font-size: 13px; color: var(--text-muted); }

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

    .input-row {
      display: flex;
      gap: var(--sp-3);
    }
    .input-row .form-input { flex: 1; }

    .btn-primary {
      padding: var(--sp-3) var(--sp-5);
      border: none; border-radius: var(--radius-sm);
      background: var(--accent); color: #fff;
      font-family: var(--font-body); font-size: 13px;
      font-weight: 500; letter-spacing: 1px;
      text-transform: uppercase; cursor: pointer;
      white-space: nowrap;
      transition: background 150ms ease;
    }
    .btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

    .empty-abi {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-4);
      padding: var(--sp-10) 0;
      text-align: center;
    }
    .empty-abi p { font-size: 13px; color: var(--text-disabled); max-width: 320px; }
  `],
})
export class DappComponent {
  contractName = signal('');
  abiLoaded = signal(false);

  constructor(public wallet: WalletStateService) {}
}
