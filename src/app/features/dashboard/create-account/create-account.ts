import { Component, computed, signal } from '@angular/core';
import { TauriIpcService } from '../../../core/services/tauri-ipc.service';
import { TransactionService } from '../../../core/services/transaction.service';
import { WalletStateService } from '../../../core/services/wallet-state.service';

/** A locally-kept record of an account this wallet created. */
interface CreatedRecord {
  name: string;
  chainId: string;
  ownerKey: string;
  activeKey: string;
  createdAt: number;
}

@Component({
  selector: 'app-create-account',
  standalone: true,
  template: `
    <div class="create-view">
      <!-- ── Top Header ── -->
      <header class="page-header">
        <div class="header-title-row">
          <h2>Create Account</h2>
          <span class="header-sep">·</span>
          <span class="header-meta">Payer: {{ creator() }} · {{ wallet.activeChain().name }}</span>
        </div>
      </header>

      @if (isWire()) {
        <div class="msg-banner error" role="alert">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>Account creation on Wire requires a privileged system account (<code>sysio::newaccount</code> is privileged-only).</span>
        </div>
      } @else if (!wallet.canSign()) {
        <div class="msg-banner error" role="alert">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>Watch-only account — switch to an account with an imported signing key to create accounts.</span>
        </div>
      }

      <div class="create-layout">
        <!-- ── Left: Create Form Card ── -->
        <section class="section-card">
          <div class="card-header">
            <div class="card-title-row">
              <h3>New Account Details</h3>
              <span class="meta-pill">newaccount</span>
            </div>
          </div>

          <!-- New account name -->
          <div class="field-group">
            <div class="field-label-row">
              <label for="new-account-name">Account Name</label>
              <div class="name-meta">
                @if (nameHint()) {
                  <span class="status-tag" [class.error]="nameValid() === false" [class.valid]="nameValid() === true">
                    {{ nameValid() === true ? '✓ ' : '' }}{{ nameHint() }}
                  </span>
                }
                <span class="char-pill" [class.complete]="newName().length === 12">{{ newName().length }}/12</span>
              </div>
            </div>
            <input
              id="new-account-name"
              class="form-input mono"
              type="text"
              spellcheck="false"
              autocapitalize="off"
              placeholder="12 chars (a–z, 1–5)"
              maxlength="13"
              [class.input-valid]="nameValid() === true"
              [class.input-invalid]="nameValid() === false"
              [value]="newName()"
              (input)="onNameInput($any($event.target).value)"
              (blur)="checkNameAvailable()"
            />
          </div>

          <!-- Owner Public Key -->
          <div class="field-group">
            <div class="field-label-row">
              <label for="owner-pub-key">
                Owner Public Key
                @if (isPubKey(ownerKey())) {
                  <span class="curve-pill">{{ keyCurve(ownerKey()) }}</span>
                }
              </label>
              <button class="btn-inline-action" type="button" (click)="generate()">
                + Generate Keypair
              </button>
            </div>
            <input
              id="owner-pub-key"
              class="form-input mono"
              type="text"
              spellcheck="false"
              placeholder="EOS… / PUB_K1_… / PUB_EM_…"
              [class.input-invalid]="ownerKey() !== '' && !isPubKey(ownerKey())"
              [value]="ownerKey()"
              (input)="onOwnerInput($any($event.target).value)"
            />
            @if (generatedOwnerWif()) {
              <div class="key-reveal">
                <div class="key-reveal-head">
                  <span class="key-reveal-label">⚠ Owner Private Key — save now (shown once)</span>
                  <button
                    class="btn-copy-sm"
                    [class.copied]="copiedVal() === generatedOwnerWif()"
                    type="button"
                    (click)="copy(generatedOwnerWif())"
                  >
                    {{ copiedVal() === generatedOwnerWif() ? 'Copied ✓' : 'Copy WIF' }}
                  </button>
                </div>
                <code>{{ generatedOwnerWif() }}</code>
              </div>
            }
          </div>

          <label class="check-label">
            <input type="checkbox" [checked]="sameKey()" (change)="onSameKeyToggle($any($event.target).checked)" />
            <span>Use same key for <code>active</code> permission</span>
          </label>

          @if (!sameKey()) {
            <div class="field-group">
              <div class="field-label-row">
                <label for="active-pub-key">
                  Active Public Key
                  @if (isPubKey(activeKey())) {
                    <span class="curve-pill">{{ keyCurve(activeKey()) }}</span>
                  }
                </label>
                <button class="btn-inline-action" type="button" (click)="generateActive()">
                  + Generate Keypair
                </button>
              </div>
              <input
                id="active-pub-key"
                class="form-input mono"
                type="text"
                spellcheck="false"
                placeholder="EOS… / PUB_K1_… / PUB_EM_…"
                [class.input-invalid]="activeKey() !== '' && !isPubKey(activeKey())"
                [value]="activeKey()"
                (input)="onActiveInput($any($event.target).value)"
              />
              @if (generatedActiveWif()) {
                <div class="key-reveal">
                  <div class="key-reveal-head">
                    <span class="key-reveal-label">⚠ Active Private Key — save now (shown once)</span>
                    <button
                      class="btn-copy-sm"
                      [class.copied]="copiedVal() === generatedActiveWif()"
                      type="button"
                      (click)="copy(generatedActiveWif())"
                    >
                      {{ copiedVal() === generatedActiveWif() ? 'Copied ✓' : 'Copy WIF' }}
                    </button>
                  </div>
                  <code>{{ generatedActiveWif() }}</code>
                </div>
              }
            </div>
          }

          @if (!isWire()) {
            <div class="divider"></div>

            <!-- Resources -->
            <div class="resource-header">
              <span class="sub-heading">Initial Resource Allocation</span>
              <div class="preset-pills" role="group" aria-label="Resource presets">
                <button type="button" class="preset-btn" [class.active]="ramKb() === '4'" (click)="applyPreset('4', '0.5000', '0.1000')">Minimal</button>
                <button type="button" class="preset-btn" [class.active]="ramKb() === '8'" (click)="applyPreset('8', '1.0000', '0.5000')">Standard</button>
                <button type="button" class="preset-btn" [class.active]="ramKb() === '32'" (click)="applyPreset('32', '5.0000', '1.0000')">Power</button>
              </div>
            </div>

            <div class="form-row">
              <div class="field-group">
                <label for="ram-kb">RAM (KB)</label>
                <input
                  id="ram-kb"
                  class="form-input mono"
                  type="text"
                  placeholder="8"
                  [value]="ramKb()"
                  (input)="ramKb.set($any($event.target).value)"
                />
              </div>
              <div class="field-group">
                <label for="cpu-stake">CPU Stake ({{ sym() }})</label>
                <input
                  id="cpu-stake"
                  class="form-input mono"
                  type="text"
                  placeholder="1.0000"
                  [value]="cpuStake()"
                  (input)="cpuStake.set($any($event.target).value)"
                />
              </div>
              <div class="field-group">
                <label for="net-stake">NET Stake ({{ sym() }})</label>
                <input
                  id="net-stake"
                  class="form-input mono"
                  type="text"
                  placeholder="0.5000"
                  [value]="netStake()"
                  (input)="netStake.set($any($event.target).value)"
                />
              </div>
            </div>

            <label class="check-label">
              <input type="checkbox" [checked]="transferStake()" (change)="transferStake.set($any($event.target).checked)" />
              <span>Transfer staked tokens to new account (new account owns &amp; can unstake them)</span>
            </label>
          }

          <!-- Cost & Action Bar -->
          <div class="summary-bar">
            <div class="summary-cost">
              <span class="cost-k">Estimated Outlay</span>
              <span class="cost-v">{{ costSummary() }}</span>
            </div>
            <button class="btn-primary" type="button" [disabled]="!canCreate() || busy()" (click)="onCreate()">
              {{ busy() ? 'Creating…' : 'Create Account' }}
            </button>
          </div>

          @if (formError()) {
            <div class="msg-banner error" role="alert">
              <span>{{ formError() }}</span>
            </div>
          }

          <!-- Success card -->
          @if (created(); as c) {
            <div class="success-card" role="status">
              <div class="success-head">
                <span class="success-badge">✓ Created</span>
                <strong class="mono">{{ c.name }}</strong>
                @if (explorerUrl(c.name); as url) {
                  <a class="explorer-link" [href]="url" target="_blank" rel="noopener">Explorer ↗</a>
                }
              </div>
              <div class="success-row">
                <span class="k">Owner</span>
                <code class="v trunc">{{ formatKeyShort(c.ownerKey) }}</code>
                <button class="btn-copy-sm" type="button" (click)="copy(c.ownerKey)">
                  {{ copiedVal() === c.ownerKey ? '✓' : 'Copy' }}
                </button>
              </div>
              <div class="success-row">
                <span class="k">Active</span>
                <code class="v trunc">{{ formatKeyShort(c.activeKey) }}</code>
                <button class="btn-copy-sm" type="button" (click)="copy(c.activeKey)">
                  {{ copiedVal() === c.activeKey ? '✓' : 'Copy' }}
                </button>
              </div>
              <div class="success-actions">
                @if (canImportCreated()) {
                  <button class="btn-ghost" type="button" [disabled]="busy()" (click)="importCreated()">
                    Import into SimplEOS
                  </button>
                }
                <button class="btn-ghost" type="button" (click)="reset()">Create Another</button>
              </div>
              @if (importNote()) {
                <p class="import-note">{{ importNote() }}</p>
              }
            </div>
          }
        </section>

        <!-- ── Right: Recently Created Card ── -->
        <aside class="section-card recent-panel">
          <div class="card-header">
            <div class="card-title-row">
              <h3>Created Here</h3>
              @if (recentForChain().length > 0) {
                <span class="meta-pill">{{ recentForChain().length }}</span>
              }
            </div>
          </div>

          @if (recentForChain().length > 0) {
            <div class="recent-list">
              @for (r of recentForChain(); track r.name + r.chainId + r.createdAt) {
                <div class="recent-row">
                  <button
                    type="button"
                    class="recent-copy-btn"
                    [class.copied]="copiedVal() === r.name"
                    (click)="copy(r.name)"
                    [title]="'Copy ' + r.name"
                  >
                    <span class="recent-name mono">{{ r.name }}</span>
                    @if (copiedVal() === r.name) {
                      <span class="copied-tag">✓ Copied</span>
                    }
                  </button>
                  <div class="recent-meta">
                    <span class="recent-date">{{ formatShortDate(r.createdAt) }}</span>
                    @if (explorerUrl(r.name); as url) {
                      <a class="explorer-link" [href]="url" target="_blank" rel="noopener" title="View in explorer">↗</a>
                    }
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="empty-block">
              <p class="empty-title">No accounts created yet</p>
              <p class="empty-sub">Accounts created on {{ wallet.activeChain().name }} from this wallet are logged here.</p>
            </div>
          }
        </aside>
      </div>
    </div>
  `,
  styles: [`
    .create-view {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: var(--sp-4);
      padding-bottom: var(--sp-8);
    }

    /* ── Header ── */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--sp-4);
      flex-wrap: wrap;
    }

    .header-title-row {
      display: flex;
      align-items: baseline;
      gap: var(--sp-2);
      flex-wrap: wrap;
    }

    h2 {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-bright);
      margin: 0;
      letter-spacing: -0.02em;
    }

    .header-sep {
      color: var(--text-disabled);
      font-size: 14px;
    }

    .header-meta {
      font-size: 13px;
      font-family: var(--font-data);
      color: var(--text-muted);
    }

    /* ── Layout Grid ── */
    .create-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.75fr);
      gap: var(--sp-4);
      align-items: start;
    }
    @media (max-width: 880px) {
      .create-layout {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .section-card {
      background: var(--bg-raised);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: var(--sp-5);
      display: flex;
      flex-direction: column;
      gap: var(--sp-4);
      min-width: 0;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--sp-3);
    }

    .card-title-row {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
    }

    .card-header h3 {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-bright);
      margin: 0;
    }

    .meta-pill {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: var(--radius-full);
      background: var(--bg-base);
      border: 1px solid var(--border-subtle);
      font-family: var(--font-data);
      font-size: 11px;
      color: var(--text-muted);
    }

    /* ── Form Fields ── */
    .field-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .field-label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--sp-2);
    }

    label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .curve-pill {
      font-family: var(--font-data);
      font-size: 9px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 3px;
      background: color-mix(in srgb, var(--accent) 14%, transparent);
      color: var(--accent-text);
    }

    .name-meta {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
    }

    .status-tag {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
    }
    .status-tag.valid {
      color: var(--positive);
    }
    .status-tag.error {
      color: var(--negative);
    }

    .char-pill {
      font-family: var(--font-data);
      font-variant-numeric: tabular-nums;
      font-size: 10px;
      padding: 1px 6px;
      border-radius: var(--radius-full);
      background: var(--bg-base);
      border: 1px solid var(--border-subtle);
      color: var(--text-muted);
    }
    .char-pill.complete {
      color: var(--accent-text);
      border-color: color-mix(in srgb, var(--accent) 35%, var(--border-subtle));
    }

    .btn-inline-action {
      padding: 2px 8px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-base);
      color: var(--accent-text);
      font-family: var(--font-data);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease;
    }
    .btn-inline-action:hover {
      background: var(--accent-muted);
      border-color: var(--accent);
    }

    .form-input {
      width: 100%;
      padding: 9px 12px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-base);
      color: var(--text-bright);
      font-size: 13px;
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }
    .form-input.mono {
      font-family: var(--font-data);
    }
    .form-input::placeholder {
      color: var(--text-disabled);
    }
    .form-input:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 18%, transparent);
    }
    .input-valid {
      border-color: var(--positive) !important;
    }
    .input-invalid {
      border-color: var(--negative) !important;
    }

    .check-label {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      text-transform: none;
      letter-spacing: 0;
      font-size: 12.5px;
      font-weight: 400;
      color: var(--text-body);
      cursor: pointer;
    }
    .check-label input {
      accent-color: var(--accent);
    }
    .check-label code {
      font-family: var(--font-data);
      font-size: 12px;
      color: var(--accent-text);
    }

    /* ── One-time Key Reveal ── */
    .key-reveal {
      margin-top: 4px;
      padding: var(--sp-3);
      border: 1px solid rgba(245, 158, 11, 0.4);
      border-radius: var(--radius-sm);
      background: rgba(245, 158, 11, 0.08);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .key-reveal-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--sp-2);
    }

    .key-reveal-label {
      font-size: 11px;
      font-weight: 600;
      color: #fbbf24;
    }

    .key-reveal code {
      font-family: var(--font-data);
      font-size: 11.5px;
      color: var(--text-bright);
      word-break: break-all;
      background: var(--bg-base);
      padding: 6px 8px;
      border-radius: 4px;
      border: 1px solid var(--border-subtle);
    }

    .btn-copy-sm {
      padding: 3px 8px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-raised);
      color: var(--accent-text);
      font-family: var(--font-data);
      font-size: 10.5px;
      font-weight: 600;
      cursor: pointer;
      flex-shrink: 0;
    }
    .btn-copy-sm.copied {
      color: var(--positive);
      border-color: color-mix(in srgb, var(--positive) 40%, transparent);
    }

    .divider {
      height: 1px;
      background: var(--border-subtle);
    }

    /* ── Resources & Presets ── */
    .resource-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--sp-2);
      flex-wrap: wrap;
    }

    .sub-heading {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-bright);
    }

    .preset-pills {
      display: inline-flex;
      padding: 2px;
      background: var(--bg-base);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
    }

    .preset-btn {
      padding: 3px 9px;
      border: none;
      border-radius: 3px;
      background: transparent;
      color: var(--text-muted);
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: background 120ms ease, color 120ms ease;
    }
    .preset-btn:hover {
      color: var(--text-bright);
    }
    .preset-btn.active {
      background: var(--bg-raised);
      color: var(--accent-text);
    }

    .form-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--sp-3);
    }

    /* ── Summary & CTA Bar ── */
    .summary-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-4);
      border-radius: var(--radius-md);
      background: var(--bg-base);
      border: 1px solid var(--border-subtle);
      flex-wrap: wrap;
    }

    .summary-cost {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .cost-k {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
    }

    .cost-v {
      font-family: var(--font-data);
      font-variant-numeric: tabular-nums;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-bright);
    }

    .btn-primary {
      padding: 9px 18px;
      border: none;
      border-radius: var(--radius-sm);
      background: var(--accent);
      color: #fff;
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 150ms ease, opacity 150ms ease;
    }
    .btn-primary:hover:not(:disabled) {
      background: var(--accent-hover);
    }
    .btn-primary:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .btn-ghost {
      padding: 7px 12px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-raised);
      color: var(--accent-text);
      font-family: var(--font-data);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background 150ms ease, border-color 150ms ease;
    }
    .btn-ghost:hover:not(:disabled) {
      background: var(--accent-muted);
      border-color: var(--accent);
    }

    /* ── Success Card ── */
    .success-card {
      padding: var(--sp-4);
      border: 1px solid rgba(45, 212, 168, 0.35);
      border-radius: var(--radius-md);
      background: rgba(45, 212, 168, 0.06);
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
    }

    .success-head {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      font-size: 14px;
      color: var(--text-bright);
      margin-bottom: 4px;
    }

    .success-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: var(--radius-full);
      background: rgba(45, 212, 168, 0.16);
      color: var(--positive);
    }

    .success-row {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      font-size: 12px;
    }
    .success-row .k {
      width: 54px;
      color: var(--text-muted);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .success-row .v {
      flex: 1;
      font-family: var(--font-data);
      color: var(--text-body);
      min-width: 0;
    }
    .trunc {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mono {
      font-family: var(--font-data);
    }

    .explorer-link {
      font-size: 11.5px;
      font-family: var(--font-data);
      color: var(--accent-text);
      text-decoration: none;
      margin-left: auto;
    }
    .explorer-link:hover {
      text-decoration: underline;
    }

    .success-actions {
      display: flex;
      gap: var(--sp-2);
      margin-top: var(--sp-2);
    }

    .import-note {
      font-size: 12px;
      color: var(--text-muted);
      margin: 4px 0 0;
    }

    /* ── Recent Panel ── */
    .recent-list {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      background: var(--bg-base);
      overflow: hidden;
    }

    .recent-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-2);
      padding: 9px var(--sp-3);
      border-bottom: 1px solid var(--border-subtle);
    }
    .recent-row:last-child {
      border-bottom: none;
    }

    .recent-copy-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 6px;
      margin-left: -6px;
      border: none;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-bright);
      cursor: pointer;
    }
    .recent-copy-btn:hover {
      background: var(--bg-raised);
      color: var(--accent-text);
    }

    .recent-name {
      font-size: 12.5px;
      font-weight: 600;
    }

    .copied-tag {
      font-size: 10px;
      font-weight: 700;
      color: var(--positive);
    }

    .recent-meta {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
    }

    .recent-date {
      font-size: 11px;
      font-family: var(--font-data);
      color: var(--text-muted);
    }

    /* ── Empty & Banners ── */
    .empty-block {
      padding: var(--sp-5);
      border-radius: var(--radius-md);
      background: var(--bg-base);
      border: 1px dashed var(--border-subtle);
      text-align: center;
    }
    .empty-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-body);
      margin: 0 0 4px;
    }
    .empty-sub {
      font-size: 12px;
      color: var(--text-muted);
      margin: 0;
    }

    .msg-banner {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-3);
      border-radius: var(--radius-sm);
      font-size: 12px;
      line-height: 1.4;
    }
    .msg-banner.error {
      background: rgba(248, 113, 113, 0.1);
      border: 1px solid rgba(248, 113, 113, 0.3);
      color: var(--negative);
    }
  `],
})
export class CreateAccountComponent {
  // ── Form state ──
  newName = signal('');
  ownerKey = signal('');
  activeKey = signal('');
  sameKey = signal(true);
  ramKb = signal('8');
  cpuStake = signal('1.0000');
  netStake = signal('0.5000');
  transferStake = signal(false);

  generatedOwnerWif = signal('');
  generatedActiveWif = signal('');
  copiedVal = signal('');

  nameValid = signal<boolean | null>(null);
  nameHint = signal('');
  formError = signal('');
  busy = signal(false);

  created = signal<CreatedRecord | null>(null);
  importNote = signal('');
  private recent = signal<CreatedRecord[]>([]);

  private nameTimer: any;

  creator = computed(() => this.wallet.selectedAccount()?.name ?? '');
  isWire = computed(() => this.wallet.activeChain()?.system_contract === 'sysio');

  recentForChain = computed(() => {
    const chainId = this.wallet.selectedAccount()?.chainId;
    return this.recent().filter(r => r.chainId === chainId).slice().reverse();
  });

  /** The created account's active key lives in our keystore only when we generated it. */
  canImportCreated = computed(() => !!this.created() && this.generatedActiveWif() !== '');

  costSummary = computed(() => {
    if (this.isWire()) return 'No resource outlay required on Wire';
    const cpu = parseFloat(this.cpuStake() || '0');
    const net = parseFloat(this.netStake() || '0');
    const staked = cpu + net;
    const parts: string[] = [`${this.ramKb() || '0'} KB RAM`];
    if (staked > 0) parts.push(`${staked.toFixed(this.prec())} ${this.sym()} staked`);
    return parts.join(' + ');
  });

  constructor(
    public wallet: WalletStateService,
    private ipc: TauriIpcService,
    private tx: TransactionService,
  ) {
    this.loadRecent();
  }

  applyPreset(ram: string, cpu: string, net: string) {
    this.ramKb.set(ram);
    this.cpuStake.set(cpu);
    this.netStake.set(net);
  }

  keyCurve(k: string): string {
    const t = k.trim();
    if (t.startsWith('PUB_EM_')) return 'EM';
    if (t.startsWith('PUB_R1_')) return 'R1';
    if (t.startsWith('PUB_WA_')) return 'WA';
    return 'K1';
  }

  formatKeyShort(k: string): string {
    if (!k || k.length <= 36) return k;
    return `${k.slice(0, 18)}…${k.slice(-10)}`;
  }

  formatShortDate(ts: number): string {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /** User typed an owner key by hand — the generated WIF (if any) no longer
   *  matches, so drop it. Mirror to the active key while "same key" is on. */
  onOwnerInput(value: string) {
    const key = value.trim();
    this.ownerKey.set(key);
    this.generatedOwnerWif.set('');
    if (this.sameKey()) {
      this.activeKey.set(key);
      this.generatedActiveWif.set('');
    }
  }

  onActiveInput(value: string) {
    this.activeKey.set(value.trim());
    this.generatedActiveWif.set('');
  }

  sym(): string { return this.wallet.activeChain()?.symbol ?? 'EOS'; }
  prec(): number { return this.wallet.activeChain()?.precision ?? 4; }

  isPubKey(k: string): boolean {
    const trimmed = k.trim();
    return (
      /^(EOS|FIO|PUB_K1_|PUB_R1_|PUB_WA_)[1-9A-HJ-NP-Za-km-z]{40,}$/.test(trimmed) ||
      /^PUB_EM_[0-9a-fA-F]{64,}$/.test(trimmed)
    );
  }

  private nameSyntaxValid(name: string): boolean {
    if (!/^[a-z1-5.]{1,12}$/.test(name)) return false;
    return name.length === 12 || name.includes('.');
  }

  onNameInput(value: string) {
    const name = value.toLowerCase().trim();
    this.newName.set(name);
    this.nameValid.set(null);
    this.formError.set('');
    clearTimeout(this.nameTimer);
    if (!name) { this.nameHint.set(''); return; }
    if (!/^[a-z1-5.]{1,12}$/.test(name)) {
      this.nameValid.set(false);
      this.nameHint.set('Only a–z, 1–5 and dots');
      return;
    }
    if (!this.nameSyntaxValid(name)) {
      this.nameHint.set('Use 12 chars (or dotted suffix)');
    } else {
      this.nameHint.set('');
    }
    this.nameTimer = setTimeout(() => this.checkNameAvailable(), 500);
  }

  /** Confirm the name is free — a creatable name must NOT already exist on chain. */
  async checkNameAvailable() {
    const name = this.newName();
    const chainId = this.wallet.selectedAccount()?.chainId;
    if (!name || !chainId || !this.nameSyntaxValid(name)) return;
    try {
      await this.ipc.getAccount(chainId, name);
      this.nameValid.set(false);
      this.nameHint.set('Already taken');
    } catch {
      this.nameValid.set(true);
      this.nameHint.set('Available');
    }
  }

  onSameKeyToggle(checked: boolean) {
    this.sameKey.set(checked);
    if (checked) {
      this.activeKey.set(this.ownerKey());
      this.generatedActiveWif.set(this.generatedOwnerWif());
    } else {
      if (this.activeKey() === this.ownerKey()) this.generatedActiveWif.set('');
    }
  }

  async generate() {
    try {
      const kp = await this.ipc.generateKeyPair();
      this.ownerKey.set(kp.public_key);
      this.generatedOwnerWif.set(kp.wif);
      if (this.sameKey()) {
        this.activeKey.set(kp.public_key);
        this.generatedActiveWif.set(kp.wif);
      }
    } catch (e: any) {
      this.formError.set(this.msg(e));
    }
  }

  async generateActive() {
    try {
      const kp = await this.ipc.generateKeyPair();
      this.activeKey.set(kp.public_key);
      this.generatedActiveWif.set(kp.wif);
    } catch (e: any) {
      this.formError.set(this.msg(e));
    }
  }

  async copy(text: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.copiedVal.set(text);
      setTimeout(() => {
        if (this.copiedVal() === text) this.copiedVal.set('');
      }, 1800);
    } catch { /* ignore */ }
  }

  canCreate(): boolean {
    if (this.isWire()) return false;
    if (!this.wallet.canSign()) return false;
    if (this.nameValid() === false) return false;
    if (!this.nameSyntaxValid(this.newName())) return false;
    if (!this.isPubKey(this.ownerKey())) return false;
    if (!this.sameKey() && !this.isPubKey(this.activeKey())) return false;
    if (!this.isWire()) {
      const ram = parseFloat(this.ramKb() || '0');
      if (!(ram > 0)) return false;
    }
    return true;
  }

  async onCreate() {
    this.formError.set('');
    const account = this.wallet.selectedAccount();
    if (!account) return;
    const creator = account.name;

    const ownerK = this.ownerKey().trim();
    const activeK = (this.sameKey() ? this.ownerKey() : this.activeKey()).trim();
    const name = this.newName();
    const bytes = Math.round(parseFloat(this.ramKb() || '0') * 1024);
    const cpu = parseFloat(this.cpuStake() || '0');
    const net = parseFloat(this.netStake() || '0');

    const keys = await this.ipc.listPublicKeys(account.chainId);
    if (keys.length === 0) {
      this.formError.set('No signing key found for this account.');
      return;
    }

    const auth = [{ actor: creator, permission: 'active' }];
    const authority = (key: string) =>
      this.isWire()
        ? {
            threshold: 1,
            keys: [{ key, weight: 1 }],
            accounts: [],
          }
        : {
            threshold: 1,
            keys: [{ key, weight: 1 }],
            accounts: [],
            waits: [],
          };

    const actions: any[] = [
      {
        account: this.wallet.systemAccount('newaccount'),
        name: 'newaccount',
        authorization: auth,
        data: { creator, name, owner: authority(ownerK), active: authority(activeK) },
      },
    ];

    if (!this.isWire()) {
      actions.push({
        account: this.wallet.systemAccount('buyrambytes'),
        name: 'buyrambytes',
        authorization: auth,
        data: { payer: creator, receiver: name, bytes },
      });

      if (cpu > 0 || net > 0) {
        actions.push({
          account: this.wallet.systemAccount('delegatebw'),
          name: 'delegatebw',
          authorization: auth,
          data: {
            from: creator,
            receiver: name,
            stake_net_quantity: `${net.toFixed(this.prec())} ${this.sym()}`,
            stake_cpu_quantity: `${cpu.toFixed(this.prec())} ${this.sym()}`,
            transfer: this.transferStake(),
          },
        });
      }
    }

    this.busy.set(true);
    try {
      const result = await this.tx.confirm({
        chainId: account.chainId,
        publicKey: keys[0],
        actions,
        title: `Create ${name}`,
      });

      if (result) {
        const record: CreatedRecord = {
          name,
          chainId: account.chainId,
          ownerKey: ownerK,
          activeKey: activeK,
          createdAt: Date.now(),
        };
        this.created.set(record);
        this.importNote.set('');
        await this.rememberCreated(record);
        this.wallet.refreshAccount(this.wallet.selectedIndex());
      }
    } catch (e: any) {
      this.formError.set(this.msg(e));
    } finally {
      this.busy.set(false);
    }
  }

  /** Import the freshly created account's key + add it by name. Only possible
   *  when we generated the active key here (so its WIF is in hand). */
  async importCreated() {
    const c = this.created();
    const wif = this.generatedActiveWif();
    if (!c || !wif) return;
    this.busy.set(true);
    this.importNote.set('');
    try {
      await this.ipc.importKeyWithSession(wif, c.chainId);
      const ownerWif = this.generatedOwnerWif();
      if (ownerWif && ownerWif !== wif) {
        try { await this.ipc.importKeyWithSession(ownerWif, c.chainId); } catch { /* non-fatal */ }
      }
      await this.wallet.addImportedAccount(c.name, c.chainId, 'full');
      this.importNote.set(`${c.name} added to your wallet. Back up the private key — it won't be shown again.`);
    } catch (e: any) {
      this.importNote.set(`Import failed: ${this.msg(e)}`);
    } finally {
      this.busy.set(false);
    }
  }

  explorerUrl(name: string): string | null {
    const explorer = this.wallet.activeChain()?.explorers?.[0];
    const tpl = explorer?.account_url;
    if (!tpl) return null;
    return tpl.replace('{account}', name);
  }

  reset() {
    this.created.set(null);
    this.importNote.set('');
    this.newName.set('');
    this.ownerKey.set('');
    this.activeKey.set('');
    this.generatedOwnerWif.set('');
    this.generatedActiveWif.set('');
    this.nameValid.set(null);
    this.nameHint.set('');
    this.formError.set('');
  }

  private async loadRecent() {
    try {
      const saved = await this.ipc.storeGet<CreatedRecord[]>('created_accounts');
      if (saved?.length) this.recent.set(saved);
    } catch { /* ignore */ }
  }

  private async rememberCreated(record: CreatedRecord) {
    const next = [...this.recent(), record];
    this.recent.set(next);
    try { await this.ipc.storeSet('created_accounts', next); } catch { /* ignore */ }
  }

  private msg(e: any): string {
    const raw = typeof e === 'string' ? e : e?.message ?? String(e);
    const m = raw.match(/\{[\s\S]*"error"[\s\S]*\}/);
    if (m) {
      try {
        const p = JSON.parse(m[0]);
        const d = p?.error?.details;
        if (Array.isArray(d) && d.length) return d[0].message ?? raw;
        if (p?.error?.what) return p.error.what;
      } catch { /* fall through */ }
    }
    return raw.slice(0, 400);
  }
}
