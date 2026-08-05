import { Component, OnInit, signal, inject } from '@angular/core';
import { TauriIpcService, SignSummary } from '../../core/services/tauri-ipc.service';

/**
 * Trusted transaction-confirmation window (R2+R3).
 *
 * Rendered only in the backend-owned `sign-confirm` window. On load it fetches
 * the backend-built {@link SignSummary} (the locally-decoded description of the
 * EXACT bytes that will be signed) and renders the actions, authorization,
 * requesting origin/callback, and warnings. The user approves with the unlock
 * factor (`approve_sign`) or rejects (`reject_sign`); closing the window also
 * counts as a rejection. The main/dapp renderer cannot script into this window,
 * so it can neither forge nor suppress the confirmation.
 */
@Component({
  selector: 'app-confirm-window',
  standalone: true,
  template: `
    <div class="cw">
      <header class="cw-titlebar" data-tauri-drag-region="deep">
        <span class="cw-brand">SimplEOS</span>
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
            <div><span class="cw-label">Account</span><code>{{ s.signer_public_key }}</code></div>
            <div><span class="cw-label">Chain</span><code>{{ s.chain_id.slice(0, 12) }}…</code></div>
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
          @if (requiresPassphrase()) {
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
              {{ busy() ? 'Working…' : approveLabel() }}
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
      height: 34px; flex: 0 0 auto; display: flex; align-items: center; padding: 0 12px;
      -webkit-user-select: none; user-select: none;
    }
    .cw-brand { font-weight: 600; opacity: 0.7; letter-spacing: 0.5px; }
    .cw-center { flex: 1; display: flex; align-items: center; justify-content: center; }
    .cw-body { flex: 1; overflow-y: auto; padding: 4px 16px 16px; }
    .cw-title { font-size: 16px; margin: 0 0 12px; }
    .cw-label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.55; margin-bottom: 2px; }
    .cw-origin { background: var(--bg-elev, #1d1f29); border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; }
    .cw-origin-host { font-weight: 600; }
    .cw-meta { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    .cw-meta code { font-size: 12px; word-break: break-all; }
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
      max-height: 220px; overflow: auto;
    }
    .cw-callback { background: var(--bg-elev, #1d1f29); border-radius: 8px; padding: 8px 10px; margin-top: 8px; }
    .cw-break { word-break: break-all; font-size: 11px; }
    .cw-badge { font-size: 10px; padding: 1px 6px; border-radius: 10px; }
    .cw-badge-warn { background: var(--danger, #e0564f); color: #fff; }
    .cw-warn { font-size: 12px; color: var(--warning, #e0a44f); margin: 6px 0; }
    .cw-warn-strong { color: var(--danger, #e0564f); font-weight: 500; }
    .cw-err { color: var(--danger, #e0564f); font-size: 12px; margin: 6px 0; }
    .cw-footer { flex: 0 0 auto; padding: 12px 16px; border-top: 1px solid var(--border, #2a2c38); }
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
  passphrase = signal('');
  busy = signal(false);
  error = signal('');

  async ngOnInit() {
    try {
      const s = await this.ipc.getPendingSignRequest();
      this.summary.set(s);
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
    const m = this.summary()?.mode;
    if (m === 'export') return 'Reveal key';
    if (m === 'identity') return 'Approve login';
    return 'Approve';
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
    if (this.requiresPassphrase() && !this.passphrase()) {
      this.error.set('Passphrase is required');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.ipc.approveSign(s.request_id, this.passphrase() || undefined);
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
