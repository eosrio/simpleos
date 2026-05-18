import { Component, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { open as openUrl } from '@tauri-apps/plugin-shell';
import { TransactionService, TxAction } from '../core/services/transaction.service';
import { WalletStateService } from '../core/services/wallet-state.service';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (tx.visible()) {
      <div class="overlay" (click)="onOverlayClick($event)">
        <div class="modal">

          <!-- ── Review phase ── -->
          @if (tx.phase() === 'review') {
            <div class="modal-header">
              <h3>{{ tx.request()?.title ?? 'Confirm Transaction' }}</h3>
            </div>

            <div class="modal-body">
              <!-- Account & chain context -->
              @if (wallet.selectedAccount(); as acct) {
                <div class="context-row">
                  <span class="context-label">Account</span>
                  <span class="context-value data">{{ acct.name }}</span>
                </div>
                <div class="context-row">
                  <span class="context-label">Chain</span>
                  <span class="context-value">{{ acct.chainName }}</span>
                </div>
              }

              <div class="divider"></div>

              <!-- Actions -->
              @for (action of tx.request()?.actions ?? []; track $index) {
                <div class="action-card">
                  <div class="action-header">
                    <span class="action-contract data">{{ action.account }}</span>
                    <span class="action-arrow">&rsaquo;</span>
                    <span class="action-name">{{ action.name }}</span>
                  </div>
                  <div class="action-fields">
                    @for (field of actionFields(action); track field.key) {
                      <div class="field-row">
                        <span class="field-key">{{ field.key }}</span>
                        <span class="field-value data"
                              [class.field-amount]="isAmount(field.value)">{{ field.value }}</span>
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Passphrase input (when required) -->
              @if (tx.needsPassphrase()) {
                <div class="passphrase-section">
                  <label class="passphrase-label">Enter passphrase to sign</label>
                  <input class="form-input" type="password"
                         placeholder="Passphrase"
                         [ngModel]="tx.passphrase()"
                         (ngModelChange)="tx.passphrase.set($event)"
                         (keydown.enter)="tx.sign()" />
                </div>
              }

              @if (tx.errorMessage()) {
                <div class="inline-error">{{ tx.errorMessage() }}</div>
              }
            </div>

            <div class="modal-actions">
              <button class="btn-cancel" (click)="tx.cancel()">Cancel</button>
              <button class="btn-confirm" (click)="tx.sign()"
                      [disabled]="tx.needsPassphrase() && !tx.passphrase()">
                {{ tx.mode() === 'signOnly' ? 'Sign Transaction' : 'Confirm & Sign' }}
              </button>
            </div>
          }

          <!-- ── Signing phase ── -->
          @if (tx.phase() === 'signing') {
            <div class="modal-body status-phase">
              <div class="spinner"></div>
              <p class="status-text">{{ tx.request()?.isLogin ? 'Signing identity proof...' : tx.mode() === 'signOnly' ? 'Signing transaction...' : 'Signing and broadcasting...' }}</p>
            </div>
          }

          <!-- ── Success phase ── -->
          @if (tx.phase() === 'success') {
            <div class="modal-body status-phase">
              <div class="status-icon success-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                     stroke="var(--positive)" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h3 class="status-title">{{ tx.request()?.isLogin ? 'Login Successful' : tx.mode() === 'signOnly' ? 'Transaction Signed' : 'Transaction Sent' }}</h3>
              @if (!tx.request()?.isLogin && isSignOnlyResult()) {
                <div class="tx-output">
                  <div class="tx-id-row">
                    <span class="tx-id-label">Packed TX</span>
                    <span class="tx-id data">{{ signOnlyResult()?.packed_trx }}</span>
                  </div>
                  <div class="tx-id-row">
                    <span class="tx-id-label">Signature</span>
                    <span class="tx-id data">{{ signOnlyResult()?.signature }}</span>
                  </div>
                  <button type="button" class="explorer-link" (click)="copySignedResult()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2"
                         stroke-linecap="round" stroke-linejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    Copy signed JSON
                  </button>
                </div>
              } @else if (!tx.request()?.isLogin) {
                <div class="tx-id-row">
                  <span class="tx-id-label">TX ID</span>
                  <span class="tx-id data">{{ txResult()?.transaction_id }}</span>
                </div>
                @if (explorerLinks(); as links) {
                  @if (links.length > 0) {
                    <div class="explorer-links">
                      @for (link of links; track link.name) {
                        <button type="button" class="explorer-link" (click)="openExplorer(link.url)">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                               stroke="currentColor" stroke-width="2"
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
              }
            </div>
            <div class="modal-actions">
              <button class="btn-confirm" (click)="tx.dismiss()">Done</button>
            </div>
          }

          <!-- ── Error phase ── -->
          @if (tx.phase() === 'error') {
            <div class="modal-body status-phase">
              <div class="status-icon error-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                     stroke="var(--negative)" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </div>
              <h3 class="status-title">Transaction Failed</h3>
              <p class="error-detail">{{ tx.errorMessage() }}</p>
            </div>
            <div class="modal-actions">
              <button class="btn-cancel" (click)="tx.dismiss()">Close</button>
              <button class="btn-cancel" (click)="copyDebugDetails()">Copy Debug</button>
              <button class="btn-confirm" (click)="retry()">Retry</button>
            </div>
          }

        </div>
      </div>
    }
  `,
  styles: [`
    .overlay {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--backdrop-blur);
      backdrop-filter: blur(4px);
      animation: fadeIn 150ms ease;
    }

    .modal {
      width: 420px;
      max-height: 80vh;
      overflow-y: auto;
      background: var(--bg-raised);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-modal);
      animation: slideUp 200ms ease;
    }

    .modal-header {
      padding: var(--sp-5) var(--sp-6);
      border-bottom: 1px solid var(--border-subtle);
    }

    .modal-header h3 {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-bright);
      margin: 0;
    }

    .modal-body {
      padding: var(--sp-5) var(--sp-6);
    }

    .modal-actions {
      display: flex;
      gap: var(--sp-3);
      padding: var(--sp-4) var(--sp-6);
      border-top: 1px solid var(--border-subtle);
    }

    /* ── Context rows ── */
    .context-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--sp-1) 0;
    }

    .context-label {
      font-size: 12px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .context-value {
      font-size: 13px;
      color: var(--text-bright);
    }

    .data {
      font-family: var(--font-data);
    }

    .divider {
      height: 1px;
      background: var(--border-subtle);
      margin: var(--sp-4) 0;
    }

    /* ── Action cards ── */
    .action-card {
      background: var(--bg-base);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: var(--sp-4);
      margin-bottom: var(--sp-3);
    }

    .action-card:last-of-type {
      margin-bottom: 0;
    }

    .action-header {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      margin-bottom: var(--sp-3);
      font-size: 13px;
      font-weight: 500;
    }

    .action-contract {
      color: var(--accent);
    }

    .action-arrow {
      color: var(--text-disabled);
    }

    .action-name {
      color: var(--text-bright);
    }

    .field-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 2px 0;
    }

    .field-key {
      font-size: 12px;
      color: var(--text-muted);
    }

    .field-value {
      font-size: 13px;
      color: var(--text-body);
      text-align: right;
      max-width: 60%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .field-amount {
      color: var(--text-bright);
      font-weight: 500;
    }

    /* ── Passphrase ── */
    .passphrase-section {
      margin-top: var(--sp-4);
    }

    .passphrase-label {
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
      font-family: var(--font-body);
      font-size: 14px;
      transition: border-color 150ms ease;
    }

    .form-input:focus {
      outline: none;
      border-color: var(--accent);
    }

    .form-input::placeholder {
      color: var(--text-disabled);
    }

    .inline-error {
      margin-top: var(--sp-3);
      font-size: 12px;
      color: var(--negative);
    }

    /* ── Buttons ── */
    .btn-cancel, .btn-confirm {
      flex: 1;
      padding: var(--sp-3);
      border-radius: var(--radius-sm);
      font-family: var(--font-body);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 150ms ease;
    }

    .btn-cancel {
      background: var(--bg-base);
      color: var(--text-muted);
      border: 1px solid var(--border-subtle);
    }

    .btn-cancel:hover {
      background: var(--bg-hover);
    }

    .btn-confirm {
      background: var(--accent);
      color: #fff;
      border: none;
    }

    .btn-confirm:hover:not(:disabled) {
      background: var(--accent-hover);
    }

    .btn-confirm:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    /* ── Status phases (signing, success, error) ── */
    .status-phase {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: var(--sp-8) var(--sp-6);
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--border-subtle);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 800ms linear infinite;
    }

    .status-text {
      margin-top: var(--sp-4);
      font-size: 14px;
      color: var(--text-muted);
    }

    .status-icon {
      margin-bottom: var(--sp-3);
    }

    .status-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-bright);
      margin: 0 0 var(--sp-4) 0;
    }

    .tx-id-row {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-4);
      background: var(--bg-base);
      border-radius: var(--radius-md);
    }

    .tx-output {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
      align-items: stretch;
    }

    .tx-id-label {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .tx-id {
      font-size: 11px;
      color: var(--text-body);
      word-break: break-all;
    }

    .error-detail {
      font-size: 13px;
      color: var(--text-muted);
      max-width: 340px;
      word-break: break-word;
    }

    /* ── Explorer links ── */
    .explorer-links {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-2);
      margin-top: var(--sp-4);
    }

    .explorer-link {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-3);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-base);
      color: var(--accent);
      font-size: 12px;
      font-weight: 500;
      font-family: var(--font-body);
      text-decoration: none;
      cursor: pointer;
      transition: background 150ms ease, border-color 150ms ease;
    }

    .explorer-link:hover {
      background: var(--accent-muted);
      border-color: var(--accent);
    }

    /* ── Animations ── */
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class ConfirmModalComponent {

  /** Build explorer links from the active chain's explorer config + current tx result. */
  explorerLinks = computed(() => {
    const txId = this.txResult()?.transaction_id;
    if (!txId) return [];
    const chain = this.wallet.activeChain();
    if (!chain?.explorers) return [];
    return chain.explorers
      .filter((e: any) => e.tx_url)
      .map((e: any) => ({
        name: e.name,
        url: (e.tx_url as string).replace('{txid}', txId),
      }));
  });

  constructor(
    public tx: TransactionService,
    public wallet: WalletStateService,
  ) {}

  txResult() {
    const result = this.tx.result();
    return result && 'transaction_id' in result ? result : null;
  }

  signOnlyResult() {
    const result = this.tx.result();
    return result && 'packed_trx' in result ? result : null;
  }

  isSignOnlyResult(): boolean {
    return this.signOnlyResult() !== null;
  }

  /** Open an explorer URL in the system's default browser via Tauri shell plugin. */
  async openExplorer(url: string): Promise<void> {
    try {
      await openUrl(url);
    } catch (e) {
      console.error('Failed to open explorer URL', url, e);
    }
  }

  async copySignedResult(): Promise<void> {
    const result = this.signOnlyResult();
    if (!result) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    } catch {
      // Clipboard may be unavailable in restricted WebViews.
    }
  }

  async copyDebugDetails(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.tx.debugDetails());
    } catch {
      // Clipboard may be unavailable in restricted WebViews.
    }
  }

  /** Close modal when clicking the overlay background (not the modal itself). */
  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('overlay')) {
      if (this.tx.phase() === 'review') {
        this.tx.cancel();
      }
    }
  }

  /** Go back to review phase to retry. */
  retry() {
    this.tx.phase.set('review');
    this.tx.errorMessage.set('');
  }

  /** Extract key/value pairs from action data for display. */
  actionFields(action: TxAction): { key: string; value: string }[] {
    if (!action.data) return [];
    const isFioAction = action.account?.startsWith('fio.');
    return Object.entries(action.data).map(([key, value]) => {
      let display = typeof value === 'object' ? JSON.stringify(value) : String(value);
      if (display.length > 180) display = display.slice(0, 177) + '...';
      // Format FIO max_fee from SUFs to human-readable FIO tokens
      if (isFioAction && key === 'max_fee' && typeof value === 'number') {
        const fioAmount = (value / 1e9).toFixed(2);
        display = `~${fioAmount} FIO`;
      }
      return { key, value: display };
    });
  }

  /** Check if a value looks like a token amount (e.g., "1.0000 EOS"). */
  isAmount(value: string): boolean {
    return /^\d[\d,]*\.\d+\s+[A-Z]+$/.test(value);
  }
}
