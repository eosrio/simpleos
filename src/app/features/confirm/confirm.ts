import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { TauriIpcService, SignSummary } from '../../core/services/tauri-ipc.service';
import { sameKey } from '../../core/services/account-signer';

/**
 * Trusted transaction-confirmation window (R2+R3).
 *
 * Rendered only in the backend-owned `sign-confirm` window. On load it fetches
 * the backend-built {@link SignSummary} (the locally-decoded description of the
 * EXACT bytes that will be signed) and renders the actions, authorization,
 * requesting origin/callback, signing digest, and warnings. The user approves
 * with the unlock factor (`approve_sign` via Vault, Ledger ETH app, or MetaMask
 * loopback bridge) or rejects (`reject_sign`); closing the window also counts
 * as a rejection.
 */
@Component({
  selector: 'app-confirm-window',
  standalone: true,
  template: `
    <div class="cw">
      <header class="cw-titlebar" data-tauri-drag-region="deep">
        <span class="cw-brand">SimplEOS</span>
        @if (summary()?.is_em_signer) {
          <span class="cw-em-pill">Wire EM (EIP-191)</span>
        }
      </header>

      @if (loading()) {
        <div class="cw-center"><p>Loading…</p></div>
      } @else if (!summary()) {
        <div class="cw-center"><p class="cw-err">{{ error() || 'No pending request.' }}</p></div>
      } @else {
        @let s = summary()!;
        <main class="cw-body">
          <h1 class="cw-title">{{ s.title }}</h1>

          @if (s.origin) {
            <div class="cw-origin">
              <span class="cw-label">Requested by</span>
              <span class="cw-origin-host">{{ s.origin }}</span>
            </div>
          }

          @if (s.any_unverified) {
            <div class="cw-warn cw-warn-strong">
              ⚠ Some action data could not be verified locally against the bytes that will be
              signed. Proceed only if you trust this request.
            </div>
          }

          <div class="cw-meta">
            <div>
              <span class="cw-label">Signer Public Key</span>
              <code>{{ s.signer_public_key }}</code>
            </div>
            @if (s.signer_eth_address) {
              <div>
                <span class="cw-label">Ethereum Address (EIP-55)</span>
                <code>{{ s.signer_eth_address }}</code>
              </div>
            }
            <div><span class="cw-label">Chain</span><code>{{ s.chain_id.slice(0, 12) }}…</code></div>
            @if (s.signing_digest_hex && s.mode !== 'export') {
              <div class="cw-digest-box">
                <span class="cw-label">Signing Digest (32 bytes)</span>
                <code class="cw-digest">0x{{ s.signing_digest_hex }}</code>
                @if (s.eip191_hash_hex) {
                  <span class="cw-label cw-mt">EIP-191 Personal Sign Hash</span>
                  <code class="cw-digest">0x{{ s.eip191_hash_hex }}</code>
                }
              </div>
            }
            @if (s.delay_sec > 0) {
              <div class="cw-warn">⚠ Deferred transaction: delay {{ s.delay_sec }}s</div>
            }
            @if (s.has_context_free_actions) {
              <div class="cw-warn">⚠ Contains context-free actions</div>
            }
          </div>

          @if (s.mode === 'export') {
            <div class="cw-export">
              <p>{{ s.identity_scope }}</p>
              <p class="cw-warn cw-warn-strong">
                ⚠ This reveals a private key in plaintext. Anyone who sees it gains full control of
                the account. Only continue if you initiated this export.
              </p>
            </div>
          } @else if (s.mode === 'identity') {
            <div class="cw-identity">
              <p>{{ s.identity_scope || 'Prove ownership of this account.' }}</p>
              @if (s.callback_url) {
                <div class="cw-callback">
                  <span class="cw-label">Result sent to</span>
                  <code class="cw-break">{{ s.callback_url }}</code>
                </div>
              }
            </div>
          } @else {
            @for (a of s.actions; track $index) {
              <section class="cw-action" [class.cw-action-risk]="a.high_risk">
                <div class="cw-action-head">
                  <code class="cw-action-name">{{ a.account }}::{{ a.name }}</code>
                  @if (!a.verified) { <span class="cw-badge cw-badge-warn">unverified</span> }
                </div>
                <div class="cw-auth">
                  @for (au of a.authorization; track $index) {
                    <span class="cw-auth-chip">{{ au.actor }}&#64;{{ au.permission }}</span>
                  }
                </div>
                @if (a.warning) { <div class="cw-warn">⚠ {{ a.warning }}</div> }
                <pre class="cw-data">{{ formatData(a.data) }}</pre>
              </section>
            }
            @if (s.callback_url) {
              <div class="cw-callback">
                <span class="cw-label">Result sent to</span>
                <code class="cw-break">{{ s.callback_url }}</code>
              </div>
            }
          }
        </main>

        <footer class="cw-footer">
          @if (s.is_em_signer && s.mode !== 'export') {
            <div class="cw-signer-picker">
              <span class="cw-label">Sign EM Key With</span>
              <div class="cw-signer-tabs">
                <button
                  type="button"
                  class="cw-tab"
                  [class.active]="signerBackend() === 'vault'"
                  [disabled]="!keyInVault() || busy()"
                  (click)="signerBackend.set('vault')"
                  [title]="keyInVault() ? 'Sign with private key in SimplEOS Vault' : 'Key is not stored in local Vault'"
                >
                  Vault
                </button>
                <button
                  type="button"
                  class="cw-tab"
                  [class.active]="signerBackend() === 'metamask'"
                  [disabled]="busy()"
                  (click)="signerBackend.set('metamask')"
                >
                  MetaMask
                </button>
                <button
                  type="button"
                  class="cw-tab"
                  [class.active]="signerBackend() === 'ledger_eth'"
                  [disabled]="busy()"
                  (click)="signerBackend.set('ledger_eth')"
                >
                  Ledger ETH
                </button>
              </div>
              @if (signerBackend() === 'ledger_eth') {
                <div class="cw-ledger-row">
                  <span>BIP44 Index (m/44'/60'/0'/0/n):</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    class="cw-ledger-idx"
                    [value]="ledgerIndex()"
                    (input)="ledgerIndex.set(+$any($event.target).value || 0)"
                    [disabled]="busy()"
                  />
                </div>
              }
            </div>
          }

          @if (needsPassphraseInput()) {
            <input
              type="password"
              class="cw-pass"
              placeholder="Passphrase"
              autocomplete="off"
              [value]="passphrase()"
              (input)="passphrase.set($any($event.target).value)"
              (keyup.enter)="approve()"
              [disabled]="busy()"
            />
          }
          @if (error()) { <p class="cw-err">{{ error() }}</p> }
          <div class="cw-buttons">
            <button class="cw-btn cw-btn-ghost" (click)="reject()" [disabled]="busy()">Cancel</button>
            <button
              class="cw-btn cw-btn-primary"
              [class.cw-btn-danger]="summary()?.mode === 'export' || summary()?.any_unverified"
              (click)="approve()"
              [disabled]="busy()"
            >
              {{ busy() ? busyLabel() : approveLabel() }}
            </button>
          </div>
        </footer>
      }
    </div>
  `,
  styles: [`
    :host { display: block; height: 100vh; }
    .cw {
      display: flex; flex-direction: column; height: 100vh;
      background: var(--bg-deep, #14151c); color: var(--text, #e6e6e6);
      font-size: 13px;
    }
    .cw-titlebar {
      height: 34px; flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between;
      padding: 0 12px; -webkit-user-select: none; user-select: none;
    }
    .cw-brand { font-weight: 600; opacity: 0.7; letter-spacing: 0.5px; }
    .cw-em-pill {
      font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 999px;
      background: rgba(99, 102, 241, 0.2); color: #a5b4fc;
    }
    .cw-center { flex: 1; display: flex; align-items: center; justify-content: center; }
    .cw-body { flex: 1; overflow-y: auto; padding: 4px 16px 16px; }
    .cw-title { font-size: 16px; margin: 0 0 12px; }
    .cw-label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.55; margin-bottom: 2px; }
    .cw-mt { margin-top: 6px; }
    .cw-origin { background: var(--bg-elev, #1d1f29); border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; }
    .cw-origin-host { font-weight: 600; }
    .cw-meta { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    .cw-meta code { font-size: 11px; word-break: break-all; }
    .cw-digest-box {
      background: var(--bg-elev, #1d1f29); border: 1px solid var(--border, #2a2c38);
      border-radius: 8px; padding: 8px 10px;
    }
    .cw-digest { display: block; font-size: 11px; word-break: break-all; color: #93c5fd; }
    .cw-action {
      background: var(--bg-elev, #1d1f29); border-radius: 8px; padding: 10px;
      margin-bottom: 8px; border: 1px solid transparent;
    }
    .cw-action-risk { border-color: var(--danger, #e0564f); }
    .cw-action-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .cw-action-name { font-weight: 600; }
    .cw-auth { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
    .cw-auth-chip { font-size: 11px; background: var(--bg-deep, #14151c); border-radius: 6px; padding: 2px 6px; opacity: 0.85; }
    .cw-data {
      margin: 6px 0 0; padding: 8px; background: var(--bg-deep, #0f1016);
      border-radius: 6px; font-size: 11px; white-space: pre-wrap; word-break: break-word;
      max-height: 200px; overflow: auto;
    }
    .cw-callback { background: var(--bg-elev, #1d1f29); border-radius: 8px; padding: 8px 10px; margin-top: 8px; }
    .cw-break { word-break: break-all; font-size: 11px; }
    .cw-badge { font-size: 10px; padding: 1px 6px; border-radius: 10px; }
    .cw-badge-warn { background: var(--danger, #e0564f); color: #fff; }
    .cw-warn { font-size: 12px; color: var(--warning, #e0a44f); margin: 6px 0; }
    .cw-warn-strong { color: var(--danger, #e0564f); font-weight: 500; }
    .cw-err { color: var(--danger, #e0564f); font-size: 12px; margin: 6px 0; }
    .cw-footer { flex: 0 0 auto; padding: 12px 16px; border-top: 1px solid var(--border, #2a2c38); }
    .cw-signer-picker { margin-bottom: 10px; }
    .cw-signer-tabs { display: flex; gap: 6px; margin-top: 4px; }
    .cw-tab {
      flex: 1; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border, #2a2c38);
      background: var(--bg-elev, #1d1f29); color: var(--text, #e6e6e6); font-size: 11px;
      font-weight: 600; cursor: pointer;
    }
    .cw-tab.active {
      border-color: var(--accent, #4f8cff); background: rgba(79, 140, 255, 0.18); color: #fff;
    }
    .cw-tab:disabled { opacity: 0.4; cursor: not-allowed; }
    .cw-ledger-row {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      margin-top: 6px; font-size: 11px; opacity: 0.85;
    }
    .cw-ledger-idx {
      width: 64px; padding: 4px 6px; border-radius: 6px; border: 1px solid var(--border, #2a2c38);
      background: var(--bg-deep, #0f1016); color: var(--text, #e6e6e6); font-size: 12px;
    }
    .cw-pass {
      width: 100%; box-sizing: border-box; padding: 9px 10px; margin-bottom: 8px;
      background: var(--bg-deep, #0f1016); border: 1px solid var(--border, #2a2c38);
      border-radius: 8px; color: var(--text, #e6e6e6); font-size: 13px;
    }
    .cw-buttons { display: flex; gap: 8px; }
    .cw-btn { flex: 1; padding: 10px; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; }
    .cw-btn:disabled { opacity: 0.5; cursor: default; }
    .cw-btn-ghost { background: var(--bg-elev, #1d1f29); color: var(--text, #e6e6e6); }
    .cw-btn-primary { background: var(--accent, #4f8cff); color: #fff; font-weight: 600; }
    .cw-btn-danger { background: var(--danger, #e0564f); }
  `],
})
export class ConfirmWindowComponent implements OnInit {
  private ipc = inject(TauriIpcService);

  summary = signal<SignSummary | null>(null);
  loading = signal(true);
  requiresPassphrase = signal(false);
  keyInVault = signal(true);
  signerBackend = signal<'vault' | 'metamask' | 'ledger_eth'>('vault');
  ledgerIndex = signal(0);
  passphrase = signal('');
  busy = signal(false);
  error = signal('');

  needsPassphraseInput = computed(() => {
    const s = this.summary();
    if (!s) return false;
    if (s.is_em_signer && s.mode !== 'export' && this.signerBackend() !== 'vault') {
      return false;
    }
    return this.requiresPassphrase();
  });

  async ngOnInit() {
    try {
      const s = await this.ipc.getPendingSignRequest();
      this.summary.set(s);

      if (s.is_em_signer && s.mode !== 'export') {
        const stored = await this.ipc.listPublicKeys(s.chain_id).catch(() => [] as string[]);
        const inVault = stored.some((k) => sameKey(k, s.signer_public_key));
        this.keyInVault.set(inVault);
        this.signerBackend.set(inVault ? 'vault' : 'metamask');
      }

      // Export always requires a fresh passphrase (SEC-006); Strict policy requires
      // one for every signature; otherwise follow the active security mode.
      const policy = await this.ipc.getConfirmationPolicy().catch(() => 'standard' as const);
      const needsPass = s.mode === 'export' || policy === 'strict'
        ? true
        : await this.ipc.needsPassphraseForSigning().catch(() => false);
      this.requiresPassphrase.set(needsPass);
    } catch (e: any) {
      this.error.set(this.friendly(e));
    } finally {
      this.loading.set(false);
    }
  }

  approveLabel(): string {
    const s = this.summary();
    const m = s?.mode;
    if (m === 'export') return 'Reveal key';
    if (m === 'identity') return 'Approve login';
    if (s?.is_em_signer) {
      if (this.signerBackend() === 'metamask') return 'Sign in MetaMask';
      if (this.signerBackend() === 'ledger_eth') return 'Sign on Ledger ETH';
    }
    return 'Approve';
  }

  busyLabel(): string {
    if (this.summary()?.is_em_signer) {
      if (this.signerBackend() === 'metamask') return 'Waiting for MetaMask…';
      if (this.signerBackend() === 'ledger_eth') return 'Confirm on Ledger…';
    }
    return 'Working…';
  }

  formatData(data: any): string {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }

  async approve() {
    const s = this.summary();
    if (!s || this.busy()) return;
    if (this.needsPassphraseInput() && !this.passphrase()) {
      this.error.set('Passphrase is required');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.ipc.approveSign(s.request_id, this.passphrase() || undefined, {
        signerBackend: s.is_em_signer && s.mode !== 'export' ? this.signerBackend() : 'vault',
        ledgerIndex: this.ledgerIndex(),
      });
      // On success the backend closes this window; nothing more to do here.
    } catch (e: any) {
      // e.g. wrong passphrase or broadcast failure — stay open for retry.
      this.error.set(this.friendly(e));
      this.busy.set(false);
    }
  }

  async reject() {
    const s = this.summary();
    this.busy.set(true);
    try {
      if (s) await this.ipc.rejectSign(s.request_id);
    } catch {
      /* backend closes the window regardless */
    }
  }

  private friendly(e: any): string {
    const msg = typeof e === 'string' ? e : (e?.message ?? String(e));
    if (/InvalidPassphrase/i.test(msg)) return 'Incorrect passphrase';
    if (/already in progress/i.test(msg)) return 'Another confirmation is in progress';
    return msg.replace(/^.*?Error\("?/, '').replace(/"?\)$/, '');
  }
}
