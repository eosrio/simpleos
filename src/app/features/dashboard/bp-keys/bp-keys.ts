import { Component, computed, effect, signal } from '@angular/core';
import { WalletStateService } from '../../../core/services/wallet-state.service';
import { TauriIpcService } from '../../../core/services/tauri-ipc.service';
import { TransactionService } from '../../../core/services/transaction.service';
import { FioApiService, fioNoHandleMessage } from '../../../core/services/fio-api.service';
import { normalizePubEm, sameKey } from '../../../core/services/account-signer';

const ISO_3166_NAMES: Record<number, string> = {
  0: 'Unspecified',
  32: 'Argentina',
  36: 'Australia',
  40: 'Austria',
  56: 'Belgium',
  76: 'Brazil',
  124: 'Canada',
  152: 'Chile',
  156: 'China',
  170: 'Colombia',
  203: 'Czechia',
  208: 'Denmark',
  246: 'Finland',
  250: 'France',
  276: 'Germany',
  344: 'Hong Kong',
  356: 'India',
  372: 'Ireland',
  376: 'Israel',
  380: 'Italy',
  392: 'Japan',
  410: 'South Korea',
  484: 'Mexico',
  528: 'Netherlands',
  554: 'New Zealand',
  578: 'Norway',
  616: 'Poland',
  620: 'Portugal',
  642: 'Romania',
  702: 'Singapore',
  710: 'South Africa',
  724: 'Spain',
  752: 'Sweden',
  756: 'Switzerland',
  764: 'Thailand',
  784: 'UAE',
  792: 'Türkiye',
  804: 'Ukraine',
  826: 'United Kingdom',
  840: 'United States',
};

@Component({
  selector: 'app-bp-keys',
  standalone: true,
  template: `
    <section class="bp-keys-view" aria-labelledby="bp-keys-title">
      <header class="page-header">
        <div class="header-title-group">
          <h1 id="bp-keys-title">Key Management</h1>
          <span class="header-meta">
            <code>{{ wallet.selectedAccount()?.name }}</code>
            <span class="meta-sep">·</span>
            <span>{{ wallet.selectedAccount()?.chainName }}</span>
          </span>
        </div>
        <button
          type="button"
          class="btn-ghost btn-refresh"
          (click)="refreshAll()"
          [disabled]="refreshing() || busy()"
        >
          <svg
            class="refresh-icon"
            [class.spinning]="refreshing()"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          {{ refreshing() ? 'Refreshing' : 'Refresh' }}
        </button>
      </header>

      <!-- Compact operational status strip -->
      <div class="status-strip" [class.unreg-state]="!isRegistered()">
        @if (isRegistered()) {
          <div class="status-strip-main">
            <div class="status-identity">
              <span class="status-dot online" aria-hidden="true"></span>
              <span class="status-title">Producer Active</span>
              @if (wallet.selectedAccount()?.producerRank; as rank) {
                <span class="rank-pill">#{{ rank }}</span>
              }
              <span class="status-detail">
                Signing key &amp; URL backed up locally for instant recovery
              </span>
            </div>
            <button type="button" class="btn-emergency" (click)="onUnregprod()" [disabled]="busy()">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                <line x1="12" y1="2" x2="12" y2="12" />
              </svg>
              Emergency Unreg
            </button>
          </div>
        } @else {
          <div class="status-strip-main">
            <div class="status-identity">
              <span class="status-dot offline" aria-hidden="true"></span>
              <span class="status-title">Producer Unregistered</span>
              <span class="status-detail">
                Node removed from schedule — saved registration ready to restore
              </span>
            </div>
            <button type="button" class="btn-rereg" (click)="onReregister()" [disabled]="busy()">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Re-register Now
            </button>
          </div>
          <div class="rereg-form">
            <label for="reregKey">Block Signing Key</label>
            <input
              id="reregKey"
              type="text"
              class="rereg-input"
              [value]="reregKey()"
              (input)="reregKey.set($any($event.target).value.trim())"
              placeholder="FIO… / EOS… / PUB_K1_… public key"
              spellcheck="false"
              autocomplete="off"
            />
            @if (savedConfig()) {
              <div class="saved-config">
                <span class="config-item"><strong>URL:</strong> {{ savedConfig()!.url || '—' }}</span>
                <span class="config-item">
                  <strong>Location:</strong> {{ savedConfig()!.location }} ({{ locationLabel(savedConfig()!.location) }})
                </span>
              </div>
            }
          </div>
        }
        @if (emergencyError()) {
          <p class="finkey-error" role="alert">{{ emergencyError() }}</p>
        }
      </div>

      <div class="workspace">
        <!-- Left column: Producer Registration + Savanna Finalizer Keys -->
        <div class="ops-column">
          <section class="key-card" aria-labelledby="signing-heading">
            <div class="key-header">
              <div class="card-title-row">
                <h2 id="signing-heading">Block Signing &amp; Registration</h2>
                @if (producerKeyInVault()) {
                  <span class="vault-badge" title="Private key is stored in your local SimplEOS vault">
                    ✓ In Vault
                  </span>
                }
              </div>
              <div class="header-badges">
                @if (regDirty()) {
                  <span class="key-status pending">Modified</span>
                } @else if (producerInfo()) {
                  <span
                    class="key-status"
                    [class.active]="isRegistered()"
                    [class.pending]="!isRegistered()"
                  >
                    {{ isRegistered() ? 'Synced' : 'Unregistered' }}
                  </span>
                } @else {
                  <span class="key-status pending">Loading</span>
                }
              </div>
            </div>

            @if (isRegistered() && producerInfo()) {
              <div class="reg-form">
                <div class="reg-field">
                  <div class="field-label-row">
                    <label class="reg-label" for="reg-signing-key">Block Signing Key</label>
                    @if (regKey() !== (producerInfo()?.producer_key ?? '')) {
                      <span class="field-diff-tag">Edited</span>
                    }
                  </div>
                  <div class="input-with-action">
                    <input
                      id="reg-signing-key"
                      class="form-input has-trailing-btn"
                      type="text"
                      spellcheck="false"
                      autocomplete="off"
                      [value]="regKey()"
                      (input)="regKey.set($any($event.target).value)"
                      placeholder="EOS… / PUB_K1_…"
                    />
                    <button
                      type="button"
                      class="btn-inline-copy"
                      [class.copied]="copiedKey() === regKey()"
                      [disabled]="!regKey()"
                      (click)="copyKey(regKey())"
                      title="Copy signing key"
                    >
                      {{ copiedKey() === regKey() ? 'Copied ✓' : 'Copy' }}
                    </button>
                  </div>
                </div>

                <div class="reg-row-split">
                  <label class="reg-field">
                    <span class="reg-label">Producer Website (bp.json)</span>
                    <input
                      class="form-input"
                      type="url"
                      spellcheck="false"
                      autocomplete="off"
                      [value]="regUrl()"
                      (input)="regUrl.set($any($event.target).value)"
                      placeholder="https://yourdomain.com"
                    />
                  </label>
                  <label class="reg-field">
                    <div class="field-label-row">
                      <span class="reg-label">ISO Location</span>
                      <span class="iso-country-hint">{{ locationLabel(regLocation()) }}</span>
                    </div>
                    <input
                      class="form-input"
                      type="number"
                      min="0"
                      max="999"
                      [value]="regLocation()"
                      (input)="regLocation.set(+$any($event.target).value)"
                      placeholder="0"
                    />
                  </label>
                </div>
              </div>

              <div class="reg-footer">
                <span class="reg-footnote">
                  Submits <code>{{ wallet.coreSystemContract() }}::regproducer</code>
                </span>
                <div class="reg-actions">
                  @if (regDirty()) {
                    <button
                      type="button"
                      class="btn-ghost"
                      (click)="resetRegForm()"
                      [disabled]="busy()"
                    >
                      Revert
                    </button>
                  }
                  <button
                    type="button"
                    class="btn-primary"
                    (click)="onUpdateRegistration()"
                    [disabled]="busy() || !regDirty() || !regKey().trim()"
                  >
                    {{ busy() ? 'Submitting…' : 'Update Registration' }}
                  </button>
                </div>
              </div>

              @if (regError()) {
                <p class="finkey-error" role="alert">{{ regError() }}</p>
              }
            } @else {
              <div class="key-readout-row">
                <code class="key-value">{{ producerInfo()?.producer_key ?? 'Loading…' }}</code>
                <button
                  type="button"
                  class="btn-ghost btn-copy-inline"
                  [class.copied]="copiedKey() === producerInfo()?.producer_key"
                  [disabled]="!producerInfo()?.producer_key"
                  (click)="copyKey(producerInfo()?.producer_key)"
                >
                  {{ copiedKey() === producerInfo()?.producer_key ? 'Copied ✓' : 'Copy' }}
                </button>
              </div>
            }
          </section>

          <!-- Finalizer Keys (Savanna) -->
          <section class="key-card" aria-labelledby="finalizer-heading">
            <div class="key-header">
              <div>
                <h2 id="finalizer-heading">Finalizer Keys (Savanna)</h2>
                <p class="card-subtitle">BLS12-381 keys for instant finality</p>
              </div>
              <span
                class="key-status"
                [class.active]="activeFinKey()"
                [class.pending]="!activeFinKey()"
              >
                {{ activeFinKey() ? 'Active' : 'No Active Key' }}
              </span>
            </div>

            @if (finalizersSupported() === false) {
              <div class="fin-unsupported" role="status">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4" />
                  <path d="M12 16h.01" />
                </svg>
                <span
                  ><code>{{ wallet.coreSystemContract() }}</code> does not expose
                  <code>regfinkey</code> on this network.</span
                >
              </div>
            }

            @if (activeFinKey() && registeredFinKeys().length === 0) {
              <div class="finkey-active">
                <div class="key-readout-row">
                  <code class="key-value" [title]="activeFinKey()!">{{ formatKey(activeFinKey()!) }}</code>
                  <button
                    type="button"
                    class="btn-ghost btn-copy-inline"
                    [class.copied]="copiedKey() === activeFinKey()"
                    (click)="copyKey(activeFinKey() ?? undefined)"
                  >
                    {{ copiedKey() === activeFinKey() ? 'Copied ✓' : 'Copy' }}
                  </button>
                </div>
              </div>
            }

            @if (pendingConfigLine(); as line) {
              <div class="config-reveal" role="region" aria-label="Generated finalizer key">
                <div class="config-reveal-header">
                  <h4>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 9v4" />
                      <path d="M12 17h.01" />
                      <path
                        d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                      />
                    </svg>
                    Save this finalizer key — shown only once
                  </h4>
                  <button
                    type="button"
                    class="btn-ghost btn-close"
                    (click)="dismissConfig()"
                    aria-label="Dismiss"
                  >
                    ×
                  </button>
                </div>
                <p class="key-desc">
                  Add this line to your <code>nodeos</code> <code>config.ini</code>. After closing,
                  the private key remains encrypted in your vault.
                </p>
                <code class="config-line">{{ line }}</code>
                <div class="key-actions">
                  <button type="button" class="btn-primary" (click)="copyConfigLine()">
                    {{ configCopied() ? 'Copied ✓' : 'Copy config.ini Line' }}
                  </button>
                  <button type="button" class="btn-ghost" (click)="copyPrivKey()">
                    {{ privKeyCopied() ? 'Copied ✓' : 'Copy Private Key' }}
                  </button>
                </div>
              </div>
            }

            @if (registeredFinKeys().length > 0) {
              <div class="finkey-list">
                @for (key of registeredFinKeys(); track key.id) {
                  <div class="finkey-row" [class.active-row]="key.key === activeFinKey()">
                    <div class="finkey-info">
                      <span class="key-curve-tag curve-bls">BLS</span>
                      <span class="finkey-id" title="On-chain finalizer key ID">#{{ key.id }}</span>
                      <code
                        class="finkey-text"
                        [class.expanded]="showFullKeys()"
                        [title]="key.key"
                      >{{ showFullKeys() ? key.key : formatKey(key.key) }}</code>
                      @if (key.key === activeFinKey()) {
                        <span class="finkey-badge active">Active</span>
                      } @else {
                        <span class="finkey-badge standby">Standby</span>
                      }
                    </div>
                    <div class="key-actions">
                      @if (key.key !== activeFinKey()) {
                        <button
                          type="button"
                          class="btn-ghost"
                          (click)="onActivateFinKey(key.key)"
                          [disabled]="busy()"
                        >
                          Activate
                        </button>
                        <button
                          type="button"
                          class="btn-ghost btn-danger-text"
                          (click)="onDeleteFinKey(key.key)"
                          [disabled]="busy()"
                        >
                          Delete
                        </button>
                      }
                      <button
                        type="button"
                        class="btn-ghost"
                        [class.copied]="copiedKey() === key.key"
                        (click)="copyKey(key.key)"
                      >
                        {{ copiedKey() === key.key ? 'Copied ✓' : 'Copy' }}
                      </button>
                    </div>
                  </div>
                }
              </div>
            }

            <div class="finkey-actions">
              <button
                type="button"
                class="btn-primary"
                (click)="onGenerateFinKey()"
                [disabled]="busy() || importOpen() || finalizersSupported() === false"
              >
                {{ busy() && !importOpen() ? 'Generating…' : 'Generate Finalizer Key' }}
              </button>
              <button
                type="button"
                class="btn-ghost"
                (click)="toggleImport()"
                [disabled]="busy() || finalizersSupported() === false"
              >
                {{ importOpen() ? 'Cancel' : 'Import Existing Key' }}
              </button>
            </div>

            @if (importOpen()) {
              <div class="import-form">
                <label class="reg-field">
                  <span class="reg-label">Finalizer Public Key</span>
                  <input
                    class="form-input"
                    type="text"
                    spellcheck="false"
                    autocomplete="off"
                    [value]="importKey()"
                    (input)="importKey.set($any($event.target).value)"
                    placeholder="PUB_BLS_…"
                  />
                </label>
                <label class="reg-field">
                  <span class="reg-label">Proof of Possession</span>
                  <input
                    class="form-input"
                    type="text"
                    spellcheck="false"
                    autocomplete="off"
                    [value]="importPop()"
                    (input)="importPop.set($any($event.target).value)"
                    placeholder="SIG_BLS_…"
                  />
                </label>
                <div class="reg-footer">
                  <span class="reg-footnote">From <code>leap-util gen-bls-key</code></span>
                  <button
                    type="button"
                    class="btn-primary"
                    (click)="onImportFinKey()"
                    [disabled]="busy() || !canImport() || finalizersSupported() === false"
                  >
                    {{ busy() ? 'Submitting…' : 'Register Key' }}
                  </button>
                </div>
              </div>
            }

            @if (finKeyError()) {
              <p class="finkey-error" role="alert">{{ finKeyError() }}</p>
            }
          </section>
        </div>

        <!-- Right column: Permission Structure -->
        <aside class="inspect-column">
          <section class="section-card" aria-labelledby="perm-structure-heading">
            <div class="key-header">
              <div>
                <h2 id="perm-structure-heading">Permission Structure</h2>
                <p class="card-subtitle">Click any key to copy full public key</p>
              </div>
              <div class="header-badges">
                <button
                  type="button"
                  class="btn-text-toggle"
                  (click)="showFullKeys.set(!showFullKeys())"
                >
                  {{ showFullKeys() ? 'Compact' : 'Expand keys' }}
                </button>
                <span class="perm-count-badge">
                  {{ permTree().length }} {{ permTree().length === 1 ? 'role' : 'roles' }}
                </span>
              </div>
            </div>

            @if (permTree().length > 0) {
              <div class="perm-tree">
                @for (perm of permTree(); track perm.name) {
                  <div
                    class="perm-node"
                    [class.perm-child]="perm.depth > 0"
                    [style.margin-left.px]="perm.depth * 14"
                  >
                    <div class="perm-node-head">
                      <div class="perm-title-group">
                        <span class="perm-name">{{ perm.name }}</span>
                        @if (perm.parent) {
                          <span class="perm-parent">← {{ perm.parent }}</span>
                        }
                      </div>
                      <span class="perm-threshold">threshold {{ perm.threshold }}</span>
                    </div>

                    <div class="perm-auth-list">
                      @for (k of perm.keys; track k.key) {
                        <button
                          type="button"
                          class="perm-auth-row"
                          [class.copied-row]="copiedKey() === k.key"
                          (click)="copyKey(k.key)"
                          [title]="'Click to copy ' + k.key"
                        >
                          <span class="key-curve-tag" [attr.data-curve]="keyCurve(k.key)">
                            {{ keyCurve(k.key) }}
                          </span>
                          <code class="perm-key" [class.expanded]="showFullKeys()">
                            {{ showFullKeys() ? k.key : formatKey(k.key) }}
                          </code>
                          <span class="perm-row-meta">
                            @if (isKeyInVault(k.key)) {
                              <span class="vault-mini-badge" title="Private key in local vault">
                                Vault
                              </span>
                            }
                            <span class="perm-weight">+{{ k.weight }}</span>
                            <span class="perm-copy-label" [class.copied]="copiedKey() === k.key">
                              {{ copiedKey() === k.key ? '✓ Copied' : 'Copy' }}
                            </span>
                          </span>
                        </button>
                      }
                      @for (a of perm.accounts; track a.actor + '@' + a.permission) {
                        <div class="perm-auth-row static-row">
                          <span class="key-curve-tag">ACCT</span>
                          <code class="perm-acct">{{ a.actor }}&#64;{{ a.permission }}</code>
                          <span class="perm-row-meta">
                            <span class="perm-weight">+{{ a.weight }}</span>
                          </span>
                        </div>
                      }
                      @for (w of perm.waits; track w.wait_sec) {
                        <div class="perm-auth-row static-row">
                          <span class="key-curve-tag">WAIT</span>
                          <span class="perm-wait">{{ w.wait_sec }}s delay</span>
                          <span class="perm-row-meta">
                            <span class="perm-weight">+{{ w.weight }}</span>
                          </span>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            } @else {
              <p class="section-desc">No permission data available for this account.</p>
            }
          </section>
        </aside>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .bp-keys-view {
        max-width: 1120px;
        margin: 0 auto;
        font-variant-numeric: tabular-nums;
      }

      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--sp-4);
        margin-bottom: var(--sp-4);
      }

      .header-title-group {
        display: flex;
        align-items: baseline;
        gap: var(--sp-3);
        flex-wrap: wrap;
      }

      h1 {
        font-size: 24px;
        font-weight: 600;
        color: var(--text-bright);
        margin: 0;
        letter-spacing: -0.01em;
      }

      .header-meta {
        display: inline-flex;
        align-items: center;
        gap: var(--sp-2);
        font-size: 13px;
        color: var(--text-muted);
      }
      .header-meta code {
        font-family: var(--font-data);
        color: var(--accent-text);
        font-weight: 500;
      }
      .meta-sep {
        color: var(--text-disabled);
      }

      .btn-refresh {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
        padding: 7px 12px;
      }
      .refresh-icon.spinning {
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      /* Compact operational status strip */
      .status-strip {
        background: var(--bg-raised);
        border: 1px solid rgba(45, 212, 168, 0.22);
        border-radius: var(--radius-lg);
        padding: 12px var(--sp-4);
        margin-bottom: var(--sp-5);
        box-shadow: var(--shadow-card);
      }
      .status-strip.unreg-state {
        border-color: rgba(240, 68, 56, 0.35);
        background: rgba(240, 68, 56, 0.05);
      }
      .status-strip-main {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--sp-4);
      }
      .status-identity {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        flex-wrap: wrap;
        min-width: 0;
      }
      .status-title {
        font-size: 13.5px;
        font-weight: 600;
        color: var(--text-bright);
      }
      .status-detail {
        font-size: 12.5px;
        color: var(--text-muted);
        padding-left: var(--sp-2);
        border-left: 1px solid var(--border-subtle);
      }
      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: var(--radius-full);
        flex-shrink: 0;
      }
      .status-dot.online {
        background: var(--positive);
        box-shadow: 0 0 0 3px rgba(45, 212, 168, 0.16);
      }
      .status-dot.offline {
        background: var(--negative);
        box-shadow: 0 0 0 3px rgba(240, 68, 56, 0.16);
      }
      .rank-pill {
        font-family: var(--font-data);
        font-size: 11px;
        font-weight: 600;
        padding: 1px 8px;
        border-radius: var(--radius-full);
        background: rgba(45, 212, 168, 0.12);
        color: var(--positive);
      }

      .btn-emergency {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 12px;
        border: 1px solid rgba(240, 68, 56, 0.4);
        border-radius: var(--radius-sm);
        background: rgba(240, 68, 56, 0.12);
        color: #ff7b72;
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        cursor: pointer;
        white-space: nowrap;
        flex-shrink: 0;
        transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
      }
      .btn-emergency:hover:enabled {
        background: var(--negative);
        border-color: var(--negative);
        color: #fff;
      }

      .btn-rereg {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 12px;
        border: none;
        border-radius: var(--radius-sm);
        background: var(--positive);
        color: #111218;
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        cursor: pointer;
        white-space: nowrap;
        flex-shrink: 0;
        transition: opacity 150ms ease;
      }
      .btn-rereg:hover:enabled {
        opacity: 0.9;
      }

      .saved-config {
        display: flex;
        flex-wrap: wrap;
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
        padding: 10px var(--sp-3);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-sm);
        background: var(--bg-base);
        color: var(--text-bright);
        font-family: var(--font-data);
        font-size: 13px;
        caret-color: var(--accent-text);
      }

      /* Two-column workspace */
      .workspace {
        display: grid;
        grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
        gap: var(--sp-5);
        align-items: start;
      }

      .ops-column {
        display: flex;
        flex-direction: column;
        gap: var(--sp-5);
        min-width: 0;
      }

      .inspect-column {
        min-width: 0;
      }

      .key-card,
      .section-card {
        background: var(--bg-raised);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-lg);
        padding: var(--sp-5);
        box-shadow: var(--shadow-card);
      }

      .key-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: var(--sp-3);
        margin-bottom: var(--sp-4);
      }
      .card-title-row {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        flex-wrap: wrap;
      }
      .key-header h2 {
        font-size: 15px;
        font-weight: 600;
        color: var(--text-bright);
        margin: 0;
      }
      .card-subtitle {
        font-size: 12px;
        color: var(--text-muted);
        margin: 2px 0 0;
      }

      .vault-badge {
        font-family: var(--font-data);
        font-size: 10.5px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: var(--radius-full);
        background: rgba(45, 212, 168, 0.12);
        color: var(--positive);
      }

      .header-badges {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        flex-shrink: 0;
      }

      .key-status,
      .perm-count-badge {
        font-family: var(--font-data);
        font-size: 11px;
        font-weight: 500;
        padding: 2px 9px;
        border-radius: var(--radius-full);
        white-space: nowrap;
        flex-shrink: 0;
      }
      .key-status.active {
        background: rgba(45, 212, 168, 0.12);
        color: var(--positive);
      }
      .key-status.standby,
      .perm-count-badge {
        background: var(--accent-muted);
        color: var(--accent-text);
      }
      .key-status.pending {
        background: rgba(245, 166, 35, 0.12);
        color: var(--caution);
      }

      /* Unified Signing Key & Registration Form */
      .reg-form {
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
      }
      .reg-row-split {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 170px;
        gap: var(--sp-3);
      }
      .reg-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
      }
      .field-label-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--sp-2);
      }
      .reg-label {
        font-size: 11px;
        font-weight: 500;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .field-diff-tag {
        font-family: var(--font-data);
        font-size: 10px;
        color: var(--caution);
      }
      .iso-country-hint {
        font-family: var(--font-data);
        font-size: 11px;
        color: var(--accent-text);
      }

      .input-with-action {
        position: relative;
        display: flex;
        align-items: center;
      }
      .form-input {
        width: 100%;
        min-width: 0;
        padding: 10px var(--sp-3);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-sm);
        background: var(--bg-base);
        color: var(--text-bright);
        font-family: var(--font-data);
        font-size: 12.5px;
        caret-color: var(--accent-text);
        transition: border-color 150ms ease, background 150ms ease;
      }
      .form-input.has-trailing-btn {
        padding-right: 78px;
      }
      .form-input:hover:enabled {
        border-color: var(--text-disabled);
      }
      .form-input::placeholder {
        color: var(--text-disabled);
      }

      .btn-inline-copy {
        position: absolute;
        right: 5px;
        padding: 5px 10px;
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-sm);
        background: var(--bg-raised);
        color: var(--text-body);
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 150ms ease;
      }
      .btn-inline-copy:hover:enabled {
        border-color: var(--accent);
        color: var(--accent-text);
      }
      .btn-inline-copy.copied {
        border-color: rgba(45, 212, 168, 0.45);
        background: rgba(45, 212, 168, 0.12);
        color: var(--positive);
      }

      .reg-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--sp-3);
        margin-top: var(--sp-4);
        padding-top: var(--sp-3);
        border-top: 1px solid var(--border-subtle);
      }
      .reg-footnote {
        font-size: 11.5px;
        color: var(--text-muted);
      }
      .reg-footnote code {
        font-family: var(--font-data);
        color: var(--text-body);
      }
      .reg-actions {
        display: flex;
        gap: var(--sp-2);
        align-items: center;
      }

      .key-readout-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: var(--sp-2);
        background: var(--bg-base);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-sm);
        padding: 8px 8px 8px var(--sp-3);
      }
      .key-value {
        font-family: var(--font-data);
        font-size: 12.5px;
        color: var(--text-bright);
        overflow-wrap: anywhere;
        user-select: all;
      }

      .key-actions {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        flex-shrink: 0;
      }

      /* Buttons */
      .btn-primary {
        padding: 9px 14px;
        border: 1px solid var(--accent);
        border-radius: var(--radius-sm);
        background: var(--accent);
        color: #fff;
        font-family: var(--font-body);
        font-size: 11.5px;
        font-weight: 600;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        cursor: pointer;
        transition: background 150ms ease, border-color 150ms ease;
      }
      .btn-primary:hover:enabled {
        background: var(--accent-hover);
        border-color: var(--accent-hover);
      }

      .btn-ghost {
        padding: 7px 11px;
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-sm);
        background: var(--bg-base);
        color: var(--text-bright);
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.4px;
        text-transform: uppercase;
        cursor: pointer;
        transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
      }
      .btn-ghost:hover:enabled {
        background: var(--bg-hover);
        border-color: var(--accent);
        color: var(--accent-text);
      }
      .btn-ghost.copied {
        border-color: rgba(45, 212, 168, 0.45);
        color: var(--positive);
        background: rgba(45, 212, 168, 0.1);
      }
      .btn-danger-text {
        border-color: rgba(240, 68, 56, 0.35);
        color: var(--negative);
      }
      .btn-danger-text:hover:enabled {
        background: rgba(240, 68, 56, 0.1);
        border-color: var(--negative);
      }
      .btn-primary:disabled,
      .btn-ghost:disabled,
      .btn-emergency:disabled,
      .btn-rereg:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .btn-text-toggle {
        border: none;
        background: transparent;
        color: var(--text-muted);
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: var(--radius-sm);
        transition: color 150ms ease, background 150ms ease;
      }
      .btn-text-toggle:hover {
        color: var(--accent-text);
        background: var(--bg-base);
      }

      /* Finalizer keys */
      .fin-unsupported {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        padding: 10px var(--sp-3);
        margin-bottom: var(--sp-3);
        border: 1px solid var(--border-subtle);
        background: var(--bg-base);
        border-radius: var(--radius-sm);
        font-size: 12px;
        color: var(--text-body);
      }
      .fin-unsupported svg {
        flex-shrink: 0;
        color: var(--caution);
      }
      .fin-unsupported code {
        font-family: var(--font-data);
        font-size: 11px;
        color: var(--text-bright);
      }
      .finkey-active {
        margin-bottom: var(--sp-3);
      }
      .finkey-list {
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
        margin-bottom: var(--sp-3);
      }
      .finkey-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 10px;
        background: var(--bg-base);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-sm);
        gap: var(--sp-2);
      }
      .finkey-row.active-row {
        border-color: rgba(45, 212, 168, 0.3);
        background: rgba(45, 212, 168, 0.04);
      }
      .finkey-info {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        min-width: 0;
        flex: 1;
      }
      .finkey-id {
        font-family: var(--font-data);
        font-size: 11px;
        font-weight: 600;
        color: var(--text-muted);
        flex-shrink: 0;
      }
      .key-curve-tag.curve-bls {
        background: rgba(45, 212, 168, 0.14);
        color: var(--positive);
      }
      .finkey-text {
        font-family: var(--font-data);
        font-size: 12px;
        color: var(--text-bright);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
      }
      .finkey-text.expanded {
        white-space: normal;
        overflow-wrap: anywhere;
        line-height: 1.4;
      }
      .finkey-badge {
        font-size: 10px;
        font-weight: 600;
        padding: 2px 7px;
        border-radius: var(--radius-full);
        white-space: nowrap;
      }
      .finkey-badge.active {
        background: rgba(45, 212, 168, 0.12);
        color: var(--positive);
      }
      .finkey-badge.standby {
        background: var(--accent-muted);
        color: var(--accent-text);
      }
      .finkey-error {
        font-size: 12px;
        color: var(--negative);
        margin: var(--sp-3) 0 0;
      }
      .finkey-actions {
        display: flex;
        gap: var(--sp-2);
        flex-wrap: wrap;
      }
      .import-form {
        margin-top: var(--sp-3);
        padding: var(--sp-3);
        background: var(--bg-base);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-sm);
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
      }

      /* One-time config.ini reveal */
      .config-reveal {
        margin: var(--sp-3) 0;
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
      .key-desc {
        font-size: 12.5px;
        color: var(--text-muted);
        line-height: 1.5;
        margin: 0 0 var(--sp-3);
      }
      .config-line {
        display: block;
        font-family: var(--font-data);
        font-size: 12px;
        color: var(--text-bright);
        background: var(--bg-base);
        border: 1px solid var(--border-subtle);
        padding: var(--sp-3);
        border-radius: var(--radius-sm);
        margin-bottom: var(--sp-3);
        word-break: break-all;
        user-select: all;
      }
      .btn-close {
        padding: 2px var(--sp-2);
        line-height: 1;
        font-size: 18px;
        border-color: transparent;
        background: transparent;
      }

      /* Permission Structure — Single-Line Interactive Authority Rows */
      .section-desc {
        font-size: 13px;
        color: var(--text-muted);
        margin: 0;
      }
      .perm-tree {
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
      }
      .perm-node {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .perm-node.perm-child {
        padding-left: var(--sp-3);
        border-left: 1px solid var(--border-subtle);
      }
      .perm-node-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--sp-2);
      }
      .perm-title-group {
        display: flex;
        align-items: baseline;
        gap: 6px;
      }
      .perm-name {
        font-family: var(--font-data);
        font-size: 13px;
        font-weight: 600;
        color: var(--text-bright);
      }
      .perm-parent {
        font-family: var(--font-data);
        font-size: 11px;
        color: var(--text-muted);
      }
      .perm-threshold {
        font-family: var(--font-data);
        font-size: 10.5px;
        color: var(--text-muted);
      }
      .perm-auth-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .perm-auth-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: var(--sp-2);
        width: 100%;
        text-align: left;
        padding: 8px 10px;
        background: var(--bg-base);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: border-color 150ms ease, background 150ms ease;
      }
      .perm-auth-row:hover {
        border-color: var(--accent);
        background: var(--bg-hover);
      }
      .perm-auth-row.copied-row {
        border-color: rgba(45, 212, 168, 0.45);
        background: rgba(45, 212, 168, 0.06);
      }
      .perm-auth-row.static-row {
        cursor: default;
      }
      .perm-auth-row.static-row:hover {
        border-color: var(--border-subtle);
        background: var(--bg-base);
      }

      .key-curve-tag {
        font-family: var(--font-data);
        font-size: 10px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: var(--radius-sm);
        background: var(--bg-raised);
        color: var(--text-muted);
        border: 1px solid var(--border-subtle);
        letter-spacing: 0.3px;
      }
      .key-curve-tag[data-curve='K1'] {
        color: var(--accent-text);
        background: var(--accent-muted);
        border-color: transparent;
      }
      .key-curve-tag[data-curve='EM'] {
        color: var(--info);
        background: rgba(139, 124, 246, 0.12);
        border-color: transparent;
      }

      .perm-key,
      .perm-acct,
      .perm-wait {
        font-family: var(--font-data);
        font-size: 12px;
        color: var(--text-bright);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
      }
      .perm-key.expanded {
        white-space: normal;
        overflow-wrap: anywhere;
        line-height: 1.4;
      }
      .perm-acct {
        color: var(--accent-text);
      }
      .perm-wait {
        color: var(--text-body);
      }

      .perm-row-meta {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }
      .vault-mini-badge {
        font-family: var(--font-data);
        font-size: 10px;
        font-weight: 600;
        padding: 1px 6px;
        border-radius: var(--radius-full);
        background: rgba(45, 212, 168, 0.12);
        color: var(--positive);
      }
      .perm-weight {
        font-family: var(--font-data);
        font-size: 11px;
        font-weight: 500;
        color: var(--text-muted);
      }
      .perm-copy-label {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        color: var(--text-muted);
        padding: 2px 6px;
        border-radius: var(--radius-sm);
        background: var(--bg-raised);
        transition: color 150ms ease, background 150ms ease;
      }
      .perm-auth-row:hover .perm-copy-label {
        color: var(--accent-text);
      }
      .perm-copy-label.copied {
        color: var(--positive);
        background: rgba(45, 212, 168, 0.14);
      }

      @media (max-width: 1060px) {
        .workspace {
          grid-template-columns: minmax(0, 1fr);
        }
      }

      @media (max-width: 640px) {
        .status-strip-main {
          flex-direction: column;
          align-items: flex-start;
        }
        .status-detail {
          padding-left: 0;
          border-left: none;
        }
        .reg-row-split {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `,
  ],
})
export class BpKeysComponent {
  isRegistered = signal(true);
  busy = signal(false);
  refreshing = signal(false);
  showFullKeys = signal(false);
  copiedKey = signal<string | null>(null);
  vaultKeys = signal<Set<string>>(new Set());
  private copyTimer: ReturnType<typeof setTimeout> | null = null;
  producerInfo = signal<any>(null);
  savedConfig = signal<{ url: string; location: number; producer_key: string } | null>(null);
  /** FIO handle the producer registered under — required for FIO reg/unreg actions. */
  fioHandle = signal('');
  /** Actionable error shown in the emergency panel (e.g. no registered FIO handle). */
  emergencyError = signal('');
  /** Editable block-signing key for re-registration (defaults to last good key). */
  reregKey = signal('');

  producerKeyInVault = computed(() => {
    const key = this.producerInfo()?.producer_key;
    return !!key && this.isKeyInVault(key);
  });

  isKeyInVault(key: string): boolean {
    if (!key) return false;
    const set = this.vaultKeys();
    if (set.has(key)) return true;
    for (const vk of set) {
      if (sameKey(vk, key)) return true;
    }
    return false;
  }

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
  // Whether the active chain's system contract exposes finalizer-key actions
  // (i.e. it has activated Savanna). null = not yet checked. When false we gate
  // the finalizer UI so the user gets a clear message instead of a push failure.
  finalizersSupported = signal<boolean | null>(null);
  private finSupportChain: string | null = null;

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
  canImport = computed(
    () =>
      this.importKey().trim().startsWith('PUB_BLS') &&
      this.importPop().trim().startsWith('SIG_BLS'),
  );
  regDirty = computed(() => {
    const cfg = this.savedConfig();
    if (!cfg) return false;
    return (
      this.regKey() !== cfg.producer_key ||
      this.regUrl() !== cfg.url ||
      this.regLocation() !== cfg.location
    );
  });

  /**
   * The selected account's real permission tree, derived from `get_account`
   * (`info.permissions`). Nests permissions by their `parent` link and parses
   * each `required_auth` into keys / account-auths / waits so the UI can show
   * the actual public keys — not a hard-coded owner/active placeholder.
   */
  permTree = computed(() => {
    const perms = this.wallet.selectedAccount()?.info?.permissions ?? [];
    const names = new Set(perms.map((p) => p.perm_name));
    const childrenOf = (parent: string) =>
      perms
        .filter((p) => p.parent === parent)
        .sort((a, b) => a.perm_name.localeCompare(b.perm_name));

    const rows: {
      depth: number;
      name: string;
      parent: string;
      threshold: number;
      keys: { key: string; weight: number }[];
      accounts: { actor: string; permission: string; weight: number }[];
      waits: { wait_sec: number; weight: number }[];
    }[] = [];

    const visit = (perm: (typeof perms)[number], depth: number) => {
      const auth = perm.required_auth ?? {};
      rows.push({
        depth,
        name: perm.perm_name,
        parent: perm.parent ?? '',
        threshold: Number(auth.threshold ?? 1),
        keys: (auth.keys ?? []).map((k: any) => ({ key: normalizePubEm(k.key), weight: Number(k.weight ?? 1) })),
        accounts: (auth.accounts ?? []).map((a: any) => ({
          actor: a.permission?.actor ?? '',
          permission: a.permission?.permission ?? '',
          weight: Number(a.weight ?? 1),
        })),
        waits: (auth.waits ?? []).map((w: any) => ({
          wait_sec: Number(w.wait_sec ?? 0),
          weight: Number(w.weight ?? 1),
        })),
      });
      for (const child of childrenOf(perm.perm_name)) visit(child, depth + 1);
    };

    // Roots = permissions whose parent isn't itself a permission on this account
    // (normally just `owner`, whose parent is "").
    for (const root of perms
      .filter((p) => !p.parent || !names.has(p.parent))
      .sort((a, b) => a.perm_name.localeCompare(b.perm_name))) {
      visit(root, 0);
    }
    return rows;
  });

  constructor(
    public wallet: WalletStateService,
    private ipc: TauriIpcService,
    private tx: TransactionService,
    private fioApi: FioApiService,
  ) {
    effect(() => {
      const acct = this.wallet.selectedAccount();
      if (!acct) return;
      this.checkFinalizerSupport(acct.chainId);
      this.loadVaultKeys(acct.chainId);
      if (acct.isProducer) {
        this.loadProducerInfo(acct.chainId, acct.name);
        this.loadFinalizerKeys(acct.chainId, acct.name);
      }
    });
  }

  formatKey(key: string): string {
    if (!key || key.length <= 36) return key;
    return `${key.slice(0, 20)}…${key.slice(-10)}`;
  }

  keyCurve(key: string): string {
    if (key.startsWith('PUB_K1_') || key.startsWith('EOS') || key.startsWith('FIO')) return 'K1';
    if (key.startsWith('PUB_EM_')) return 'EM';
    if (key.startsWith('PUB_R1_')) return 'R1';
    if (key.startsWith('PUB_WA_')) return 'WA';
    if (key.startsWith('PUB_BLS_')) return 'BLS';
    return 'KEY';
  }

  locationLabel(code: number): string {
    return ISO_3166_NAMES[code | 0] ?? `Code ${code | 0}`;
  }

  private async loadVaultKeys(chainId: string) {
    try {
      const keys = await this.ipc.listPublicKeys(chainId);
      this.vaultKeys.set(new Set(keys ?? []));
    } catch {
      this.vaultKeys.set(new Set());
    }
  }

  async refreshAll() {
    const acct = this.wallet.selectedAccount();
    if (!acct || this.refreshing()) return;
    this.refreshing.set(true);
    try {
      this.finSupportChain = null;
      await Promise.all([
        this.wallet.refreshAccount(this.wallet.selectedIndex()),
        this.loadVaultKeys(acct.chainId),
        this.checkFinalizerSupport(acct.chainId),
        this.loadProducerInfo(acct.chainId, acct.name),
        this.loadFinalizerKeys(acct.chainId, acct.name),
      ]);
    } finally {
      this.refreshing.set(false);
    }
  }

  /**
   * Check whether the chain's system contract exposes the finalizer-key
   * actions (`regfinkey`), i.e. it has activated Savanna. Cached per chain so we
   * don't refetch the ABI on every account refresh. On error we leave support
   * as unknown (null) rather than blocking, since it may be a transient hiccup.
   */
  private async checkFinalizerSupport(chainId: string) {
    if (this.finSupportChain === chainId) return;
    this.finSupportChain = chainId;
    try {
      const abi = await this.ipc.getAbi(chainId, this.wallet.coreSystemContract?.() ?? 'eosio');
      const actions = abi?.abi?.actions ?? [];
      this.finalizersSupported.set(actions.some((a: any) => a.name === 'regfinkey'));
    } catch {
      this.finalizersSupported.set(null);
      this.finSupportChain = null; // allow a retry on the next account change
    }
  }

  private async loadFinalizerKeys(chainId: string, account: string) {
    try {
      const sysContract = this.wallet.coreSystemContract?.() ?? 'eosio';
      let finkeyRows: any[] = [];

      if (sysContract === 'sysio') {
        // Wire (`sysio`) KV table `finkeys` uses primary key `{ id }` and rejects
        // secondary-index string bounds over `/v1/chain/get_table_rows`.
        const result = await this.ipc.getTableRows(chainId, {
          code: sysContract,
          table: 'finkeys',
          scope: sysContract,
          limit: 500,
          json: true,
        });
        finkeyRows = (result?.rows ?? []).filter((r: any) => r.finalizer_name === account);
      } else {
        try {
          const result = await this.ipc.getTableRows(chainId, {
            code: sysContract,
            table: 'finkeys',
            scope: sysContract,
            index_position: 'secondary',
            key_type: 'i64',
            lower_bound: account,
            upper_bound: account,
            limit: 20,
            json: true,
          });
          finkeyRows = (result?.rows ?? []).filter(
            (r: any) => !r.finalizer_name || r.finalizer_name === account,
          );
        } catch {
          const fallback = await this.ipc.getTableRows(chainId, {
            code: sysContract,
            table: 'finkeys',
            scope: sysContract,
            limit: 500,
            json: true,
          });
          finkeyRows = (fallback?.rows ?? []).filter((r: any) => r.finalizer_name === account);
        }
      }

      const keys = finkeyRows.map((r: any) => ({
        id: Number(r.id),
        key: r.finalizer_key ?? '',
        binary: r.finalizer_key_binary ?? '',
      }));
      this.registeredFinKeys.set(keys.map(({ id, key }) => ({ id, key })));

      // Load active key from finalizers table.
      // Field layout varies: some versions store `active_key` (BLS pubkey string),
      // others store `active_key_id` (uint64 referencing finkeys.id).
      let finRow: any = null;
      try {
        const finResult = await this.ipc.getTableRows(chainId, {
          code: sysContract,
          table: 'finalizers',
          scope: sysContract,
          lower_bound: account,
          upper_bound: account,
          limit: 1,
          json: true,
        });
        finRow = finResult?.rows?.find(
          (r: any) => !r.finalizer_name || r.finalizer_name === account,
        );
      } catch {
        /* fallback below */
      }
      if (!finRow && sysContract === 'sysio') {
        const allFin = await this.ipc.getTableRows(chainId, {
          code: sysContract,
          table: 'finalizers',
          scope: sysContract,
          limit: 200,
          json: true,
        });
        finRow = (allFin?.rows ?? []).find((r: any) => r.finalizer_name === account);
      }

      let active: string | null = null;
      if (finRow) {
        if (typeof finRow.active_key === 'string' && finRow.active_key.startsWith('PUB_BLS')) {
          active = finRow.active_key;
        } else if (finRow.active_key_id != null) {
          const id = Number(finRow.active_key_id);
          active = keys.find((k) => k.id === id)?.key ?? null;
        }
        if (!active && finRow.active_key_binary) {
          active = keys.find((k) => k.binary && k.binary === finRow.active_key_binary)?.key ?? null;
        }
      }
      this.activeFinKey.set(active);
    } catch {
      // Chain may not support Savanna yet
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
      const { finalizer_key, proof_of_possession, finalizer_private_key, config_ini_line } =
        await this.ipc.generateFinalizerKey(acct.chainId);

      // Reveal the one-time config.ini line before asking to sign.
      // Intentional: if the user cancels the tx, they still have the backup
      // paired with the key stored locally.
      this.pendingPrivKey.set(finalizer_private_key);
      this.pendingConfigLine.set(config_ini_line);
      this.configCopied.set(false);
      this.privKeyCopied.set(false);

      // Push regfinkey action
      const ok = await this.confirmAction('Register Finalizer Key', [
        {
          account: this.wallet.coreSystemContract?.() ?? 'eosio',
          name: 'regfinkey',
          authorization: this.auth(),
          data: {
            finalizer_name: this.me(),
            finalizer_key,
            proof_of_possession,
          },
        },
      ]);

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
    this.importOpen.update((v) => !v);
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
      const ok = await this.confirmAction('Register Finalizer Key', [
        {
          account: this.wallet.coreSystemContract?.() ?? 'eosio',
          name: 'regfinkey',
          authorization: this.auth(),
          data: {
            finalizer_name: this.me(),
            finalizer_key: this.importKey().trim(),
            proof_of_possession: this.importPop().trim(),
          },
        },
      ]);

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
      const ok = await this.confirmAction('Activate Finalizer Key', [
        {
          account: this.wallet.coreSystemContract?.() ?? 'eosio',
          name: 'actfinkey',
          authorization: this.auth(),
          data: { finalizer_name: this.me(), finalizer_key: key },
        },
      ]);
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
      const ok = await this.confirmAction('Delete Finalizer Key', [
        {
          account: this.wallet.coreSystemContract?.() ?? 'eosio',
          name: 'delfinkey',
          authorization: this.auth(),
          data: { finalizer_name: this.me(), finalizer_key: key },
        },
      ]);
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
            goodKey =
              prev?.producer_key && !this.isPlaceholderKey(prev.producer_key)
                ? prev.producer_key
                : '';
          } catch {
            goodKey = '';
          }
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
          } catch {
            /* non-critical */
          }
        }
      }
    } catch {
      /* offline or not a producer */
    }
  }

  private me(): string {
    return this.wallet.selectedAccount()?.name ?? '';
  }
  private auth() {
    return [{ actor: this.me(), permission: 'active' }];
  }

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
    const result = await this.tx.confirm({
      chainId: account.chainId,
      publicKey: keys[0],
      actions,
      title,
    });
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
        actions = [
          {
            account: this.wallet.coreSystemContract?.() ?? 'eosio',
            name: 'unregprod',
            authorization: this.auth(),
            data: {
              fio_address: handle,
              max_fee: await this.fioFee('unregister_producer'),
              actor: this.me(),
            },
          },
        ];
      } else {
        actions = [
          {
            account: this.wallet.coreSystemContract?.() ?? 'eosio',
            name: 'unregprod',
            authorization: this.auth(),
            data: { producer: this.me() },
          },
        ];
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
      await this.confirmAction('Update Producer Registration', [
        {
          account: this.wallet.coreSystemContract?.() ?? 'eosio',
          name: 'regproducer',
          authorization: this.auth(),
          data: {
            producer: this.me(),
            producer_key: this.regKey().trim(),
            url: this.regUrl().trim(),
            location: this.regLocation() | 0,
          },
        },
      ]);
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
        actions = [
          {
            account: this.wallet.coreSystemContract?.() ?? 'eosio',
            name: 'regproducer',
            authorization: this.auth(),
            data: {
              fio_address: handle,
              fio_pub_key: signingKey,
              url: config.url,
              location: config.location,
              actor: this.me(),
              max_fee: await this.fioFee('register_producer'),
            },
          },
        ];
      } else {
        actions = [
          {
            account: this.wallet.coreSystemContract?.() ?? 'eosio',
            name: 'regproducer',
            authorization: this.auth(),
            data: {
              producer: this.me(),
              producer_key: signingKey,
              url: config.url,
              location: config.location,
            },
          },
        ];
      }
      const ok = await this.confirmAction('Re-register Producer', actions);
      if (ok) this.isRegistered.set(true);
    } catch (e: any) {
      this.emergencyError.set(e?.toString() ?? 'Failed to re-register producer');
    } finally {
      this.busy.set(false);
    }
  }

  async copyKey(key?: string) {
    if (!key) return;
    await navigator.clipboard.writeText(key);
    this.copiedKey.set(key);
    if (this.copyTimer) clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => {
      if (this.copiedKey() === key) this.copiedKey.set(null);
    }, 2000);
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
