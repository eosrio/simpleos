import { Component, computed, effect, signal } from '@angular/core';
import { WalletStateService } from '../../../core/services/wallet-state.service';
import { TauriIpcService } from '../../../core/services/tauri-ipc.service';
import { TransactionService } from '../../../core/services/transaction.service';
import { FioApiService, fioNoHandleMessage } from '../../../core/services/fio-api.service';

@Component({
  selector: 'app-bp-keys',
  standalone: true,
  template: `
    <div class="bp-keys-view">
      <div class="bp-badge">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
        <span>Block Producer</span>
      </div>
      <h2>Key Management</h2>

      <!-- Emergency unreg/re-reg panel -->
      <div class="emergency-panel" [class.unreg-state]="!isRegistered()">
        @if (isRegistered()) {
          <div class="emergency-content">
            <div class="emergency-info">
              <h3>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Producer Registered
              </h3>
              <p>Your node is actively producing blocks at rank <strong>#{{ wallet.selectedAccount()!.producerRank }}</strong></p>
            </div>
            <button class="btn-emergency" (click)="onUnregprod()" [disabled]="busy()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
              EMERGENCY UNREG
            </button>
          </div>
          <p class="emergency-hint">Unregisters your producer immediately. Your signing key and registration info will be saved for quick re-registration.</p>
        } @else {
          <div class="emergency-content">
            <div class="emergency-info">
              <h3>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Producer Unregistered
              </h3>
              <p>Your node is <strong>offline</strong>. Saved registration info is ready for quick re-registration.</p>
            </div>
            <button class="btn-rereg" (click)="onReregister()" [disabled]="busy()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              RE-REGISTER NOW
            </button>
          </div>
          <div class="rereg-form">
            <label for="reregKey">Block Signing Key</label>
            <input id="reregKey" type="text" class="rereg-input"
                   [value]="reregKey()"
                   (input)="reregKey.set($any($event.target).value.trim())"
                   placeholder="FIO… / EOS… / PUB_K1_… public key"
                   spellcheck="false" autocomplete="off" />
            @if (savedConfig()) {
              <div class="saved-config">
                <span class="config-item"><strong>URL:</strong> {{ savedConfig()!.url }}</span>
                <span class="config-item"><strong>Location:</strong> {{ savedConfig()!.location }}</span>
              </div>
            }
          </div>
        }
        @if (emergencyError()) {
          <p class="finkey-error">{{ emergencyError() }}</p>
        }
      </div>

      <div class="keys-grid">
        <div class="key-card">
          <div class="key-header">
            <h3>Block Signing Key</h3>
            @if (producerInfo()) {
              <span class="key-status active">Active</span>
            } @else {
              <span class="key-status pending">Unknown</span>
            }
          </div>
          <code class="key-value">{{ producerInfo()?.producer_key ?? 'Loading...' }}</code>
          <div class="key-actions">
            <button class="btn-ghost" (click)="copyKey(producerInfo()?.producer_key)">COPY</button>
          </div>
        </div>

        @if (isRegistered() && producerInfo()) {
          <div class="key-card">
            <div class="key-header">
              <h3>Update Registration</h3>
              @if (regDirty()) {
                <span class="key-status pending">Unsaved changes</span>
              }
            </div>
            <p class="key-desc">
              Push a <code>regproducer</code> action to update your signing key, URL, or location.
            </p>

            <div class="reg-form">
              <label class="reg-field">
                <span class="reg-label">Producer Signing Key</span>
                <input class="form-input" type="text" spellcheck="false"
                  [value]="regKey()" (input)="regKey.set($any($event.target).value)"
                  placeholder="EOS... / PUB_K1_..." />
              </label>
              <label class="reg-field">
                <span class="reg-label">URL (bp.json)</span>
                <input class="form-input" type="text" spellcheck="false"
                  [value]="regUrl()" (input)="regUrl.set($any($event.target).value)"
                  placeholder="https://yourdomain.com" />
              </label>
              <label class="reg-field">
                <span class="reg-label">Location (ISO 3166 numeric)</span>
                <input class="form-input" type="number" min="0" max="999"
                  [value]="regLocation()" (input)="regLocation.set(+$any($event.target).value)"
                  placeholder="0" />
              </label>
            </div>

            <div class="reg-actions">
              <button class="btn-ghost" (click)="resetRegForm()" [disabled]="busy() || !regDirty()">
                REVERT
              </button>
              <button class="btn-primary" (click)="onUpdateRegistration()"
                [disabled]="busy() || !regDirty() || !regKey() || !regUrl()">
                {{ busy() ? 'Submitting...' : 'UPDATE REGISTRATION' }}
              </button>
            </div>

            @if (regError()) {
              <p class="finkey-error">{{ regError() }}</p>
            }
          </div>
        }

        <!-- Finalizer Keys (Savannah) -->
        <div class="key-card">
          <div class="key-header">
            <h3>Finalizer Keys (Savannah)</h3>
            <span class="key-status" [class.active]="activeFinKey()" [class.pending]="!activeFinKey()">
              {{ activeFinKey() ? 'Active' : 'No Active Key' }}
            </span>
          </div>

          @if (activeFinKey()) {
            <div class="finkey-active">
              <span class="finkey-label">Active Key</span>
              <code class="key-value">{{ activeFinKey() }}</code>
            </div>
          }

          @if (pendingConfigLine(); as line) {
            <div class="config-reveal">
              <div class="config-reveal-header">
                <h4>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                  Save this finalizer key — you will not see it again
                </h4>
                <button class="btn-ghost btn-close" (click)="dismissConfig()" aria-label="Dismiss">×</button>
              </div>
              <p class="key-desc">Paste this line into your <code>nodeos</code> <code>config.ini</code> (finalizer plugin). The private key is decrypted only once, right now — after you close this panel, it stays encrypted in your wallet.</p>
              <code class="config-line">{{ line }}</code>
              <div class="key-actions">
                <button class="btn-primary" (click)="copyConfigLine()">
                  {{ configCopied() ? 'COPIED ✓' : 'COPY CONFIG.INI LINE' }}
                </button>
                <button class="btn-ghost" (click)="copyPrivKey()">
                  {{ privKeyCopied() ? 'COPIED ✓' : 'COPY PRIVATE KEY ONLY' }}
                </button>
              </div>
            </div>
          }

          @if (registeredFinKeys().length > 0) {
            <div class="finkey-list">
              @for (key of registeredFinKeys(); track key.id) {
                <div class="finkey-row" [class.active-row]="key.key === activeFinKey()">
                  <div class="finkey-info">
                    <code class="finkey-text">{{ key.key.slice(0, 20) }}...{{ key.key.slice(-8) }}</code>
                    @if (key.key === activeFinKey()) {
                      <span class="finkey-badge active">Active</span>
                    } @else {
                      <span class="finkey-badge standby">Standby</span>
                    }
                  </div>
                  <div class="key-actions">
                    @if (key.key !== activeFinKey()) {
                      <button class="btn-ghost" (click)="onActivateFinKey(key.key)" [disabled]="busy()">ACTIVATE</button>
                      <button class="btn-ghost btn-danger-text" (click)="onDeleteFinKey(key.key)" [disabled]="busy()">DELETE</button>
                    }
                    <button class="btn-ghost" (click)="copyKey(key.key)">COPY</button>
                  </div>
                </div>
              }
            </div>
          } @else {
            <p class="key-desc">BLS finalizer key for Savannah fast finality. Required for Instant Finality participation.</p>
          }

          <div class="finkey-actions">
            <button class="btn-primary" (click)="onGenerateFinKey()" [disabled]="busy() || importOpen()">
              {{ busy() && !importOpen() ? 'Generating...' : 'GENERATE FINALIZER KEY' }}
            </button>
            <button class="btn-ghost" (click)="toggleImport()" [disabled]="busy()">
              {{ importOpen() ? 'CANCEL IMPORT' : 'IMPORT EXISTING KEY' }}
            </button>
          </div>

          @if (importOpen()) {
            <div class="import-form">
              <label class="reg-field">
                <span class="reg-label">Finalizer Public Key</span>
                <input class="form-input" type="text" spellcheck="false"
                  [value]="importKey()" (input)="importKey.set($any($event.target).value)"
                  placeholder="PUB_BLS_..." />
              </label>
              <label class="reg-field">
                <span class="reg-label">Proof of Possession</span>
                <input class="form-input" type="text" spellcheck="false"
                  [value]="importPop()" (input)="importPop.set($any($event.target).value)"
                  placeholder="SIG_BLS_..." />
              </label>
              <p class="key-desc import-hint">
                Get these from <code>leap-util gen-bls-key</code> or your nodeos finalizer plugin config.
                The proof of possession is a BLS signature over the public key.
              </p>
              <div class="reg-actions">
                <button class="btn-primary" (click)="onImportFinKey()"
                  [disabled]="busy() || !canImport()">
                  {{ busy() ? 'Submitting...' : 'REGISTER KEY' }}
                </button>
              </div>
            </div>
          }

          @if (finKeyError()) {
            <p class="finkey-error">{{ finKeyError() }}</p>
          }
        </div>
      </div>

      <div class="section-card">
        <h3>Permission Structure</h3>
        <p class="section-desc">Active permissions on {{ wallet.selectedAccount()!.name }}</p>
        <div class="perm-tree">
          <div class="perm-node root">
            <span class="perm-name">owner</span>
            <span class="perm-threshold">threshold: 1</span>
          </div>
          <div class="perm-node child">
            <span class="perm-name">active</span>
            <span class="perm-threshold">threshold: 1</span>
          </div>
          <div class="perm-node grandchild">
            <span class="perm-name">claim</span>
            <span class="perm-threshold">threshold: 1</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .bp-keys-view { max-width: 800px; }

    .bp-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      padding: var(--sp-1) var(--sp-3);
      background: var(--accent-muted);
      color: var(--accent);
      border-radius: var(--radius-full);
      font-size: 12px;
      font-weight: 500;
      margin-bottom: var(--sp-3);
    }

    h2 { font-size: 24px; margin-bottom: var(--sp-6); }

    /* Emergency panel */
    .emergency-panel {
      background: var(--bg-raised);
      border: 1px solid rgba(45, 212, 168, 0.2);
      border-radius: var(--radius-md);
      padding: var(--sp-5);
      margin-bottom: var(--sp-6);
    }
    .emergency-panel.unreg-state {
      border-color: rgba(240, 68, 56, 0.3);
      background: rgba(240, 68, 56, 0.04);
    }
    .emergency-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--sp-4);
    }
    .emergency-info h3 {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      font-size: 15px;
      margin-bottom: var(--sp-1);
    }
    .emergency-info p {
      font-size: 13px;
      color: var(--text-muted);
    }
    .emergency-info p strong { color: var(--text-bright); }
    .emergency-hint {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: var(--sp-3);
      padding-top: var(--sp-3);
      border-top: 1px solid var(--border-subtle);
    }

    .btn-emergency {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      padding: var(--sp-3) var(--sp-5);
      border: none;
      border-radius: var(--radius-sm);
      background: var(--negative);
      color: #fff;
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
      cursor: pointer;
      white-space: nowrap;
      transition: opacity 150ms ease;
    }
    .btn-emergency:hover { opacity: 0.85; }

    .btn-rereg {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      padding: var(--sp-3) var(--sp-5);
      border: none;
      border-radius: var(--radius-sm);
      background: var(--positive);
      color: #111218;
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
      cursor: pointer;
      white-space: nowrap;
      transition: opacity 150ms ease;
    }
    .btn-rereg:hover { opacity: 0.85; }

    .saved-config {
      display: flex;
      gap: var(--sp-5);
      margin-top: var(--sp-3);
      padding-top: var(--sp-3);
      border-top: 1px solid var(--border-subtle);
      font-size: 12px;
      color: var(--text-muted);
    }
    .config-item strong {
      color: var(--text-body);
    }
    .rereg-form {
      margin-top: var(--sp-3);
      padding-top: var(--sp-3);
      border-top: 1px solid var(--border-subtle);
    }
    .rereg-form label {
      display: block;
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: var(--sp-2);
    }
    .rereg-input {
      width: 100%;
      padding: var(--sp-3) var(--sp-4);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-hover);
      color: var(--text-bright);
      font-family: var(--font-data);
      font-size: 13px;
      transition: border-color 150ms ease;
    }
    .rereg-input:focus { outline: none; border-color: var(--accent); }
    .rereg-input::placeholder { color: var(--text-disabled); }
    .rereg-form .saved-config { margin-top: var(--sp-3); }

    .keys-grid {
      display: flex;
      flex-direction: column;
      gap: var(--sp-4);
      margin-bottom: var(--sp-6);
    }

    .key-card {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      padding: var(--sp-5);
    }

    .key-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--sp-3);
    }
    .key-header h3 { font-size: 14px; }

    .key-status {
      font-family: var(--font-data);
      font-size: 11px;
      font-weight: 500;
      padding: var(--sp-1) var(--sp-2);
      border-radius: var(--radius-full);
    }
    .key-status.active { background: rgba(45, 212, 168, 0.12); color: var(--positive); }
    .key-status.standby { background: var(--accent-muted); color: var(--accent); }
    .key-status.pending { background: rgba(245, 166, 35, 0.12); color: var(--caution); }

    .key-value {
      display: block;
      font-family: var(--font-data);
      font-size: 13px;
      color: var(--text-body);
      background: var(--bg-hover);
      padding: var(--sp-3);
      border-radius: var(--radius-sm);
      margin-bottom: var(--sp-3);
      word-break: break-all;
    }

    .key-desc {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: var(--sp-4);
    }

    .key-actions {
      display: flex;
      gap: var(--sp-2);
    }

    .section-card {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      padding: var(--sp-5);
    }
    .section-card h3 { font-size: 14px; margin-bottom: var(--sp-2); }
    .section-desc { font-size: 13px; color: var(--text-muted); margin-bottom: var(--sp-4); }

    .perm-tree { padding-left: var(--sp-2); }
    .perm-node {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-2) var(--sp-3);
      border-left: 2px solid var(--border-subtle);
      margin-left: 0;
    }
    .perm-node.child { margin-left: var(--sp-5); }
    .perm-node.grandchild { margin-left: var(--sp-10); }
    .perm-name {
      font-family: var(--font-data);
      font-size: 13px;
      font-weight: 500;
      color: var(--text-bright);
    }
    .perm-threshold {
      font-size: 11px;
      color: var(--text-muted);
    }

    .btn-primary {
      padding: var(--sp-3) var(--sp-5);
      border: none; border-radius: var(--radius-sm);
      background: var(--accent); color: #fff;
      font-family: var(--font-body); font-size: 13px;
      font-weight: 500; letter-spacing: 1px;
      text-transform: uppercase; cursor: pointer;
      transition: background 150ms ease;
    }
    .btn-primary:hover { background: var(--accent-hover); }

    .btn-ghost {
      padding: var(--sp-2) var(--sp-3);
      border: 1px solid var(--accent);
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--accent);
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 150ms ease;
    }
    .btn-ghost:hover { background: var(--accent-muted); }
    .btn-danger-text { border-color: var(--negative); color: var(--negative); }
    .btn-danger-text:hover { background: rgba(240, 68, 56, 0.1); }

    /* Finalizer keys */
    .finkey-active {
      margin-bottom: var(--sp-4);
    }
    .finkey-label {
      display: block;
      font-size: 11px;
      font-weight: 500;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: var(--sp-1);
    }
    .finkey-list {
      margin-bottom: var(--sp-4);
    }
    .finkey-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--sp-3);
      border-bottom: 1px solid var(--border-subtle);
      gap: var(--sp-3);
    }
    .finkey-row:last-child { border-bottom: none; }
    .finkey-row.active-row { background: rgba(45, 212, 168, 0.04); }
    .finkey-info { display: flex; align-items: center; gap: var(--sp-2); min-width: 0; }
    .finkey-text {
      font-family: var(--font-data);
      font-size: 12px;
      color: var(--text-body);
    }
    .finkey-badge {
      font-size: 10px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: var(--radius-full);
      white-space: nowrap;
    }
    .finkey-badge.active { background: rgba(45, 212, 168, 0.12); color: var(--positive); }
    .finkey-badge.standby { background: var(--accent-muted); color: var(--accent); }
    .finkey-error {
      font-size: 12px;
      color: var(--negative);
      margin-top: var(--sp-3);
    }

    /* Update registration form */
    .reg-form {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
      margin-bottom: var(--sp-4);
    }
    .reg-field { display: flex; flex-direction: column; gap: var(--sp-1); }
    .reg-label {
      font-size: 11px;
      font-weight: 500;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .form-input {
      width: 100%;
      padding: var(--sp-3) var(--sp-4);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-hover);
      color: var(--text-bright);
      font-family: var(--font-data);
      font-size: 13px;
      transition: border-color 150ms ease;
    }
    .form-input:focus { outline: none; border-color: var(--accent); }
    .form-input::placeholder { color: var(--text-disabled); }
    .reg-actions { display: flex; gap: var(--sp-2); justify-content: flex-end; }
    .btn-primary:disabled, .btn-ghost:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Import existing finalizer key */
    .finkey-actions {
      display: flex;
      gap: var(--sp-2);
      flex-wrap: wrap;
    }
    .import-form {
      margin-top: var(--sp-4);
      padding: var(--sp-4);
      background: var(--bg-hover);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }
    .import-hint {
      margin: 0;
      font-size: 12px;
      line-height: 1.5;
    }
    .import-hint code {
      font-family: var(--font-data);
      font-size: 11px;
      background: var(--bg-raised);
      padding: 1px 4px;
      border-radius: var(--radius-xs);
    }

    /* One-time config.ini reveal after generating a finalizer key */
    .config-reveal {
      margin-top: var(--sp-4);
      padding: var(--sp-4);
      background: rgba(245, 166, 35, 0.06);
      border: 1px solid rgba(245, 166, 35, 0.35);
      border-radius: var(--radius-sm);
    }
    .config-reveal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--sp-3);
      margin-bottom: var(--sp-2);
    }
    .config-reveal-header h4 {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      font-size: 13px;
      font-weight: 600;
      color: var(--caution);
      margin: 0;
    }
    .config-reveal .key-desc code {
      font-family: var(--font-data);
      font-size: 11px;
      background: var(--bg-raised);
      padding: 1px 4px;
      border-radius: var(--radius-xs);
    }
    .config-line {
      display: block;
      font-family: var(--font-data);
      font-size: 12px;
      color: var(--text-bright);
      background: var(--bg-base);
      padding: var(--sp-3);
      border-radius: var(--radius-sm);
      margin-bottom: var(--sp-3);
      word-break: break-all;
      user-select: all;
    }
    .btn-close {
      padding: 0 var(--sp-2);
      line-height: 1;
      font-size: 20px;
      border-color: transparent;
    }
    .btn-close:hover { background: var(--bg-hover); }
  `],
})
export class BpKeysComponent {
  isRegistered = signal(true);
  busy = signal(false);
  producerInfo = signal<any>(null);
  savedConfig = signal<{ url: string; location: number; producer_key: string } | null>(null);
  /** FIO handle the producer registered under — required for FIO reg/unreg actions. */
  fioHandle = signal('');
  /** Actionable error shown in the emergency panel (e.g. no registered FIO handle). */
  emergencyError = signal('');
  /** Editable block-signing key for re-registration (defaults to last good key). */
  reregKey = signal('');

  /**
   * A producer's `producer_public_key` is zeroed to the all-ones sentinel
   * (`FIO/EOS1111…`, `PUB_K1_111…`) when unregistered. That is not a usable
   * signing key — never prefill or re-register with it.
   */
  private isPlaceholderKey(k?: string): boolean {
    return !k || /1{24,}/.test(k);
  }

  // Finalizer keys
  registeredFinKeys = signal<{ id: number; key: string }[]>([]);
  activeFinKey = signal<string | null>(null);
  finKeyError = signal('');

  // Update registration form
  regKey = signal('');
  regUrl = signal('');
  regLocation = signal(0);
  regError = signal('');

  // Import existing finalizer key
  importOpen = signal(false);
  importKey = signal('');
  importPop = signal('');

  // One-time config.ini reveal after generating a new finalizer key.
  // Held only in memory; cleared on dismiss or on navigation away.
  pendingConfigLine = signal<string | null>(null);
  pendingPrivKey = signal<string | null>(null);
  configCopied = signal(false);
  privKeyCopied = signal(false);
  canImport = computed(() =>
    this.importKey().trim().startsWith('PUB_BLS')
    && this.importPop().trim().startsWith('SIG_BLS')
  );
  regDirty = computed(() => {
    const cfg = this.savedConfig();
    if (!cfg) return false;
    return this.regKey() !== cfg.producer_key
      || this.regUrl() !== cfg.url
      || this.regLocation() !== cfg.location;
  });

  constructor(
    public wallet: WalletStateService,
    private ipc: TauriIpcService,
    private tx: TransactionService,
    private fioApi: FioApiService,
  ) {
    effect(() => {
      const acct = this.wallet.selectedAccount();
      if (acct?.isProducer) {
        this.loadProducerInfo(acct.chainId, acct.name);
        this.loadFinalizerKeys(acct.chainId, acct.name);
      }
    });
  }

  private async loadFinalizerKeys(chainId: string, account: string) {
    try {
      // Load registered keys from finkeys table (by finalizer name)
      const result = await this.ipc.getTableRows(chainId, {
        code: 'eosio', table: 'finkeys', scope: 'eosio',
        index_position: 'secondary', key_type: 'i64',
        lower_bound: account, upper_bound: account,
        limit: 20, json: true,
      });
      const keys = (result?.rows ?? []).map((r: any) => ({
        id: r.id,
        key: r.finalizer_key ?? '',
      }));
      this.registeredFinKeys.set(keys);

      // Load active key from finalizers table.
      // Field layout varies: some versions store `active_key` (BLS pubkey string),
      // others store `active_key_id` (uint64 referencing finkeys.id).
      const finResult = await this.ipc.getTableRows(chainId, {
        code: 'eosio', table: 'finalizers', scope: 'eosio',
        lower_bound: account, upper_bound: account,
        limit: 1, json: true,
      });
      const finRow = finResult?.rows?.[0];
      let active: string | null = null;
      if (finRow) {
        if (typeof finRow.active_key === 'string' && finRow.active_key.startsWith('PUB_BLS')) {
          active = finRow.active_key;
        } else if (finRow.active_key_id != null) {
          const id = Number(finRow.active_key_id);
          active = keys.find(k => k.id === id)?.key ?? null;
        }
      }
      this.activeFinKey.set(active);
    } catch {
      // Chain may not support Savannah yet
      this.registeredFinKeys.set([]);
      this.activeFinKey.set(null);
    }
  }

  async onGenerateFinKey() {
    const acct = this.wallet.selectedAccount();
    if (!acct) return;

    this.busy.set(true);
    this.finKeyError.set('');

    try {
      // Generate BLS key pair and PoP
      const {
        finalizer_key,
        proof_of_possession,
        finalizer_private_key,
        config_ini_line,
      } = await this.ipc.generateFinalizerKey(acct.chainId);

      // Reveal the one-time config.ini line before asking to sign.
      // Intentional: if the user cancels the tx, they still have the backup
      // paired with the key stored locally.
      this.pendingPrivKey.set(finalizer_private_key);
      this.pendingConfigLine.set(config_ini_line);
      this.configCopied.set(false);
      this.privKeyCopied.set(false);

      // Push regfinkey action
      const ok = await this.confirmAction('Register Finalizer Key', [{
        account: 'eosio', name: 'regfinkey', authorization: this.auth(),
        data: {
          finalizer_name: this.me(),
          finalizer_key,
          proof_of_possession,
        },
      }]);

      if (ok) {
        await this.loadFinalizerKeys(acct.chainId, acct.name);
      }
    } catch (e: any) {
      this.finKeyError.set(e?.toString() ?? 'Failed to generate finalizer key');
    } finally {
      this.busy.set(false);
    }
  }

  toggleImport() {
    this.importOpen.update(v => !v);
    if (!this.importOpen()) {
      this.importKey.set('');
      this.importPop.set('');
      this.finKeyError.set('');
    }
  }

  async onImportFinKey() {
    const acct = this.wallet.selectedAccount();
    if (!acct || !this.canImport()) return;

    this.busy.set(true);
    this.finKeyError.set('');

    try {
      const ok = await this.confirmAction('Register Finalizer Key', [{
        account: 'eosio', name: 'regfinkey', authorization: this.auth(),
        data: {
          finalizer_name: this.me(),
          finalizer_key: this.importKey().trim(),
          proof_of_possession: this.importPop().trim(),
        },
      }]);

      if (ok) {
        this.importOpen.set(false);
        this.importKey.set('');
        this.importPop.set('');
        await this.loadFinalizerKeys(acct.chainId, acct.name);
      }
    } catch (e: any) {
      this.finKeyError.set(e?.toString() ?? 'Failed to register finalizer key');
    } finally {
      this.busy.set(false);
    }
  }

  async onActivateFinKey(key: string) {
    this.busy.set(true);
    this.finKeyError.set('');
    try {
      const ok = await this.confirmAction('Activate Finalizer Key', [{
        account: 'eosio', name: 'actfinkey', authorization: this.auth(),
        data: { finalizer_name: this.me(), finalizer_key: key },
      }]);
      if (ok) {
        const acct = this.wallet.selectedAccount();
        if (acct) await this.loadFinalizerKeys(acct.chainId, acct.name);
      }
    } catch (e: any) {
      this.finKeyError.set(e?.toString() ?? 'Failed to activate key');
    } finally {
      this.busy.set(false);
    }
  }

  async onDeleteFinKey(key: string) {
    this.busy.set(true);
    this.finKeyError.set('');
    try {
      const ok = await this.confirmAction('Delete Finalizer Key', [{
        account: 'eosio', name: 'delfinkey', authorization: this.auth(),
        data: { finalizer_name: this.me(), finalizer_key: key },
      }]);
      if (ok) {
        const acct = this.wallet.selectedAccount();
        if (acct) await this.loadFinalizerKeys(acct.chainId, acct.name);
      }
    } catch (e: any) {
      this.finKeyError.set(e?.toString() ?? 'Failed to delete key');
    } finally {
      this.busy.set(false);
    }
  }

  private async loadProducerInfo(chainId: string, account: string) {
    try {
      // Use get_producers API — works on all chains including FIO
      // (FIO's producers table uses numeric PK so get_table_rows by name fails)
      const result = await this.ipc.getProducers(chainId, 200);
      const list: any[] = result?.rows ?? result?.producers ?? [];
      const row = list.find((r: any) => r.owner === account);
      if (row) {
        // Normalize: FIO uses producer_public_key, standard chains use producer_key
        if (!row.producer_key && row.producer_public_key) {
          row.producer_key = row.producer_public_key;
        }
        this.producerInfo.set(row);
        // FIO producer rows carry the handle the BP registered under.
        if (row.fio_address) this.fioHandle.set(row.fio_address);
        // Registered unless the row explicitly flags itself inactive.
        // Ultra and other permissioned chains may omit is_active or use a
        // truthy non-1 value; the old `total_votes > 0` fallback misclassified
        // unregprod'd BPs on EOS/WAX (their votes persist after unregistration).
        const ia = row.is_active;
        const isInactive = ia === 0 || ia === false || ia === '0';
        this.isRegistered.set(!isInactive);
        const onChainKey = row.producer_key ?? row.producer_public_key ?? '';
        // When unregistered the on-chain key is the null sentinel — fall back
        // to the real key persisted before unregistration so re-registration
        // doesn't push a dead key.
        let goodKey = onChainKey;
        if (this.isPlaceholderKey(onChainKey)) {
          try {
            const prev = await this.ipc.storeGet<{ producer_key?: string }>(`bp_config_${account}`);
            goodKey = prev?.producer_key && !this.isPlaceholderKey(prev.producer_key)
              ? prev.producer_key : '';
          } catch { goodKey = ''; }
        }
        const cfg = {
          url: row.url ?? '',
          location: row.location ?? 0,
          producer_key: goodKey,
        };
        this.savedConfig.set(cfg);
        // Prefill update-registration + re-register forms if untouched
        if (!this.regDirty() || !this.regKey()) {
          this.regKey.set(goodKey);
          this.regUrl.set(cfg.url);
          this.regLocation.set(cfg.location);
        }
        if (!this.reregKey()) this.reregKey.set(goodKey);
        // Only persist when we have a real key — never overwrite a saved good
        // key with the null sentinel from an unregistered row.
        if (goodKey) {
          try {
            await this.ipc.storeSet(`bp_config_${account}`, cfg);
          } catch { /* non-critical */ }
        }
      }
    } catch { /* offline or not a producer */ }
  }

  private me(): string { return this.wallet.selectedAccount()?.name ?? ''; }
  private auth() { return [{ actor: this.me(), permission: 'active' }]; }

  /**
   * The FIO handle this producer is registered under. Prefer the value from
   * the producers row; fall back to resolving the account's owned handles.
   */
  /**
   * Currently-registered FIO handle owned by this account, or '' if none.
   * Delegates to the shared resolver, preferring the handle the producer
   * registered under only if it is still live (it may have been burned).
   */
  private async fioAddr(): Promise<string> {
    const handle = await this.fioApi.resolveOwnedHandle(
      this.wallet.selectedAccount(),
      this.fioHandle(),
    );
    if (handle) this.fioHandle.set(handle);
    return handle;
  }

  /** FIO fee (SUFs) for an endpoint, with a 20% margin to clear boundary checks. */
  private async fioFee(endpoint: string): Promise<number> {
    const acct = this.wallet.selectedAccount();
    if (!acct) return 0;
    try {
      const res = await this.ipc.fioGetFee(acct.chainId, endpoint, this.fioHandle());
      return Math.floor((res?.fee ?? 0) * 1.2);
    } catch {
      return 0;
    }
  }

  private async confirmAction(title: string, actions: any[]) {
    const account = this.wallet.selectedAccount();
    if (!account) return false;
    const keys = await this.ipc.listPublicKeys(account.chainId);
    if (keys.length === 0) return false;
    const result = await this.tx.confirm({ chainId: account.chainId, publicKey: keys[0], actions, title });
    if (result) {
      await this.wallet.refreshAccount(this.wallet.selectedIndex());
      await this.loadProducerInfo(account.chainId, account.name);
    }
    return !!result;
  }

  async onUnregprod() {
    this.busy.set(true);
    this.emergencyError.set('');
    try {
      let actions: any[];
      if (this.wallet.isFio()) {
        const handle = await this.fioAddr();
        if (!handle) {
          this.emergencyError.set(fioNoHandleMessage('unregister this producer'));
          return;
        }
        actions = [{
          account: 'eosio', name: 'unregprod', authorization: this.auth(),
          data: {
            fio_address: handle,
            max_fee: await this.fioFee('unregister_producer'),
            actor: this.me(),
          },
        }];
      } else {
        actions = [{
          account: 'eosio', name: 'unregprod', authorization: this.auth(),
          data: { producer: this.me() },
        }];
      }
      const ok = await this.confirmAction('Unregister Producer', actions);
      if (ok) this.isRegistered.set(false);
    } catch (e: any) {
      this.emergencyError.set(e?.toString() ?? 'Failed to unregister producer');
    } finally {
      this.busy.set(false);
    }
  }

  resetRegForm() {
    const cfg = this.savedConfig();
    if (!cfg) return;
    this.regKey.set(cfg.producer_key);
    this.regUrl.set(cfg.url);
    this.regLocation.set(cfg.location);
    this.regError.set('');
  }

  async onUpdateRegistration() {
    if (!this.regDirty()) return;
    this.busy.set(true);
    this.regError.set('');
    try {
      await this.confirmAction('Update Producer Registration', [{
        account: 'eosio', name: 'regproducer', authorization: this.auth(),
        data: {
          producer: this.me(),
          producer_key: this.regKey().trim(),
          url: this.regUrl().trim(),
          location: this.regLocation() | 0,
        },
      }]);
    } catch (e: any) {
      this.regError.set(e?.toString() ?? 'Failed to update registration');
    } finally {
      this.busy.set(false);
    }
  }

  async onReregister() {
    const config = this.savedConfig();
    if (!config) return;

    // Use the (editable) signing key from the panel, never the on-chain null
    // sentinel that unregprod leaves behind.
    const signingKey = this.reregKey().trim();
    if (this.isPlaceholderKey(signingKey)) {
      this.emergencyError.set(
        'Enter a valid block signing key before re-registering. ' +
        'The unregistered producer has no on-chain key, so it must be set manually.',
      );
      return;
    }

    this.busy.set(true);
    this.emergencyError.set('');
    try {
      let actions: any[];
      if (this.wallet.isFio()) {
        const handle = await this.fioAddr();
        if (!handle) {
          this.emergencyError.set(fioNoHandleMessage('re-register this producer'));
          return;
        }
        actions = [{
          account: 'eosio', name: 'regproducer', authorization: this.auth(),
          data: {
            fio_address: handle,
            fio_pub_key: signingKey,
            url: config.url,
            location: config.location,
            actor: this.me(),
            max_fee: await this.fioFee('register_producer'),
          },
        }];
      } else {
        actions = [{
          account: 'eosio', name: 'regproducer', authorization: this.auth(),
          data: {
            producer: this.me(),
            producer_key: signingKey,
            url: config.url,
            location: config.location,
          },
        }];
      }
      const ok = await this.confirmAction('Re-register Producer', actions);
      if (ok) this.isRegistered.set(true);
    } catch (e: any) {
      this.emergencyError.set(e?.toString() ?? 'Failed to re-register producer');
    } finally {
      this.busy.set(false);
    }
  }

  copyKey(key?: string) {
    if (key) navigator.clipboard.writeText(key);
  }

  async copyConfigLine() {
    const line = this.pendingConfigLine();
    if (!line) return;
    await navigator.clipboard.writeText(line);
    this.configCopied.set(true);
    setTimeout(() => this.configCopied.set(false), 2000);
  }

  async copyPrivKey() {
    const pk = this.pendingPrivKey();
    if (!pk) return;
    await navigator.clipboard.writeText(pk);
    this.privKeyCopied.set(true);
    setTimeout(() => this.privKeyCopied.set(false), 2000);
  }

  dismissConfig() {
    this.pendingConfigLine.set(null);
    this.pendingPrivKey.set(null);
    this.configCopied.set(false);
    this.privKeyCopied.set(false);
  }
}
