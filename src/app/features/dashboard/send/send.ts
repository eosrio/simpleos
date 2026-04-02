import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WalletStateService } from '../../../core/services/wallet-state.service';

@Component({
  selector: 'app-send',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="send-layout">
      <!-- Send form -->
      <div class="send-form">
        <h2>Send</h2>

        <div class="form-group">
          <label>Token</label>
          <select class="form-input">
            <option>{{ wallet.activeChain()?.symbol ?? 'EOS' }}</option>
          </select>
        </div>

        <div class="form-group">
          <label>Recipient</label>
          <input class="form-input" type="text"
                 placeholder="Account name (e.g. bob.gm)"
                 [value]="recipient()"
                 (input)="recipient.set($any($event.target).value)" />
        </div>

        <div class="form-group">
          <label>Amount</label>
          <div class="amount-row">
            <input class="form-input" type="text"
                   placeholder="0.0000"
                   [value]="amount()"
                   (input)="amount.set($any($event.target).value)" />
            <button class="btn-ghost btn-small" (click)="setMax()">MAX</button>
          </div>
        </div>

        <div class="form-group">
          <label>Memo <span class="optional">(optional)</span></label>
          <input class="form-input" type="text"
                 placeholder="Memo"
                 [value]="memo()"
                 (input)="memo.set($any($event.target).value)"
                 maxlength="256" />
          <span class="char-count">{{ memo().length }} / 256</span>
        </div>

        <button class="btn-primary" [disabled]="!canSend()">SEND</button>
      </div>

      <!-- Contacts panel -->
      <div class="contacts-panel">
        <div class="contacts-header">
          <h3>My Contacts</h3>
        </div>
        <div class="contacts-search">
          <input class="form-input" type="text" placeholder="Search contacts..." />
        </div>
        <div class="contacts-empty">
          <p>No contacts yet. They'll appear here when you save recipients.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .send-layout {
      display: grid;
      grid-template-columns: 1fr 280px;
      gap: var(--sp-6);
      max-width: 900px;
    }

    h2 { font-size: 24px; margin-bottom: var(--sp-6); }

    .form-group {
      margin-bottom: var(--sp-5);
    }

    label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: var(--sp-2);
    }

    .optional {
      text-transform: none;
      letter-spacing: 0;
      color: var(--text-disabled);
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

    .amount-row {
      display: flex;
      gap: var(--sp-2);
    }

    .amount-row .form-input { flex: 1; }

    .char-count {
      display: block;
      text-align: right;
      font-size: 11px;
      color: var(--text-disabled);
      margin-top: var(--sp-1);
    }

    .btn-primary {
      width: 100%;
      padding: var(--sp-3);
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
      transition: background 150ms ease;
    }
    .btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

    .btn-ghost {
      padding: var(--sp-2) var(--sp-3);
      border: 1px solid var(--accent);
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--accent);
      font-family: var(--font-data);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background 150ms ease;
    }
    .btn-ghost:hover { background: var(--accent-muted); }
    .btn-small { white-space: nowrap; }

    /* Contacts panel */
    .contacts-panel {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      padding: var(--sp-4);
      align-self: flex-start;
    }

    .contacts-header h3 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: var(--sp-3);
    }

    .contacts-search { margin-bottom: var(--sp-4); }
    .contacts-search .form-input { font-family: var(--font-body); font-size: 13px; }

    .contacts-empty p {
      font-size: 12px;
      color: var(--text-disabled);
      text-align: center;
      padding: var(--sp-6) 0;
    }
  `],
})
export class SendComponent {
  recipient = signal('');
  amount = signal('');
  memo = signal('');

  constructor(public wallet: WalletStateService) {}

  canSend(): boolean {
    return this.recipient().length > 0 && this.amount().length > 0;
  }

  setMax() {
    const bal = this.wallet.selectedAccount()?.info.core_liquid_balance;
    if (bal) {
      this.amount.set(bal.split(' ')[0]);
    }
  }
}
