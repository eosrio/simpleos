import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WalletStateService } from '../../../core/services/wallet-state.service';
import { NetworkService } from '../../../core/services/network.service';
import { TauriIpcService } from '../../../core/services/tauri-ipc.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="settings-view">
      <h2>Settings</h2>

      <div class="settings-grid">
        <!-- Left column -->
        <div class="settings-col">

          <!-- Endpoint Management -->
          <div class="section-card">
            <h3>Network</h3>
            <p class="section-desc">Connected to <strong>{{ wallet.activeChain().name }}</strong></p>

            <div class="ep-section">
              <span class="ep-section-label">RPC Endpoints</span>
              <div class="endpoints-list">
                @if (network.endpointStatuses().length) {
                  @for (ep of network.endpointStatuses(); track ep.url) {
                    <div class="endpoint-row" [class.active-ep]="ep.url === network.activeRpc()">
                      <span class="ep-url">{{ ep.url }}</span>
                      <span class="ep-latency" [class.healthy]="ep.latency_ms > 0 && ep.latency_ms <= 800"
                            [class.slow]="ep.latency_ms > 800 && ep.latency_ms <= 1500"
                            [class.dead]="ep.latency_ms === 0 || ep.latency_ms > 1500">
                        @if (ep.latency_ms > 0 && ep.latency_ms <= 5000) {
                          {{ ep.latency_ms }}ms
                        } @else {
                          --
                        }
                      </span>
                    </div>
                  }
                } @else {
                  @for (ep of wallet.activeChain().endpoints; track ep.url) {
                    <div class="endpoint-row">
                      <span class="ep-url">{{ ep.url }}</span>
                      <span class="ep-latency" style="color: var(--text-muted)">{{ ep.owner ?? '' }}</span>
                    </div>
                  }
                }
              </div>
            </div>

            @if (network.hyperionStatuses().length) {
              <div class="ep-section">
                <span class="ep-section-label">Hyperion</span>
                <div class="endpoints-list">
                  @for (ep of network.hyperionStatuses(); track ep.url) {
                    <div class="endpoint-row" [class.active-ep]="ep.url === network.activeHyperion()">
                      <span class="ep-url">{{ ep.url }}</span>
                      <span class="ep-latency" [class.healthy]="ep.latency_ms > 0 && ep.latency_ms <= 800"
                            [class.slow]="ep.latency_ms > 800"
                            [class.dead]="ep.latency_ms === 0">
                        @if (ep.latency_ms > 0) {
                          {{ ep.latency_ms }}ms
                        } @else {
                          --
                        }
                      </span>
                    </div>
                  }
                </div>
              </div>
            }

            <div class="ep-actions">
              <button class="btn-ghost" (click)="network.checkEndpoints()" [disabled]="network.checking()">
                {{ network.checking() ? 'CHECKING...' : 'CHECK ENDPOINTS' }}
              </button>
            </div>

            <!-- Add Custom Endpoint -->
            @if (showAddEndpoint()) {
              <div class="backup-dialog">
                <input class="form-input" type="url" placeholder="https://api.example.com"
                       [value]="customEndpointUrl()"
                       (input)="customEndpointUrl.set($any($event.target).value)" />
                <div class="backup-actions">
                  <button class="btn-cancel btn-small" (click)="showAddEndpoint.set(false)">Cancel</button>
                  <button class="btn-primary btn-small" (click)="onAddEndpoint()"
                          [disabled]="!customEndpointUrl()">Add</button>
                </div>
              </div>
            } @else {
              <button class="btn-text-action" (click)="showAddEndpoint.set(true)">+ Add custom endpoint</button>
            }
          </div>

          <!-- Keys -->
          <div class="section-card">
            <h3>Keys</h3>
            <p class="section-desc">
              Mode: <strong>{{ wallet.canSign() ? 'Full (can sign)' : 'Watch only' }}</strong>
            </p>

            @if (storedKeys().length > 0) {
              <div class="key-list">
                @for (key of storedKeys(); track key) {
                  <div class="key-row">
                    <span class="key-value">{{ key }}</span>
                  </div>
                }
              </div>
            } @else {
              <p class="section-desc" style="color: var(--negative)">No keys stored for this chain</p>
            }

            <div class="tools-grid" style="margin-top: var(--sp-4)">
              <button class="tool-btn" (click)="checkStoredKeys()">Check Stored Keys</button>
              <button class="tool-btn" [disabled]="!wallet.canSign()" (click)="showViewKeyDialog.set(true)">View Private Key</button>
              <button class="tool-btn" (click)="onGenerateKey()">Generate Key Pair</button>
              <button class="tool-btn" (click)="testKeyring()">Test Keyring</button>
            </div>

            @if (keyringReport().length > 0) {
              <div class="key-list" style="margin-top: var(--sp-3)">
                @for (line of keyringReport(); track line) {
                  <div class="key-row" [style.color]="line.includes('FAILED') ? 'var(--negative)' : line.includes('OK') ? 'var(--positive, #22c55e)' : 'var(--text-muted)'">{{ line }}</div>
                }
              </div>
            }

            <!-- View Private Key Dialog -->
            @if (showViewKeyDialog()) {
              <div class="key-dialog">
                @if (!exportedWif()) {
                  <p class="key-dialog-hint">Select the key to export:</p>
                  <select class="key-select" [ngModel]="selectedExportKey()" (ngModelChange)="selectedExportKey.set($event)">
                    @for (key of storedKeys(); track key) {
                      <option [value]="key">{{ key }}</option>
                    }
                  </select>
                  <button class="btn-ghost" style="margin-top: var(--sp-3)" (click)="onExportKey()" [disabled]="!selectedExportKey()">
                    Reveal Key
                  </button>
                } @else {
                  <div class="exported-key">
                    <code class="wif-display">{{ exportedWif() }}</code>
                    <button class="btn-ghost btn-small" (click)="copyKey()">COPY</button>
                  </div>
                  <p class="key-dialog-warn">This key will be hidden in 30 seconds</p>
                }
                <button class="btn-text-close" (click)="closeKeyDialog()">Close</button>
              </div>
            }

            <!-- Generated Key Pair -->
            @if (generatedKey()) {
              <div class="key-dialog">
                <p class="key-dialog-hint">New key pair generated (not stored):</p>
                <div class="gen-key-field">
                  <label>Public Key</label>
                  <code class="gen-key-value">{{ generatedKey()!.public_key }}</code>
                </div>
                <div class="gen-key-field">
                  <label>Private Key (WIF)</label>
                  <div class="exported-key">
                    <code class="wif-display">{{ generatedKey()!.wif }}</code>
                    <button class="btn-ghost btn-small" (click)="copyGenKey()">COPY</button>
                  </div>
                </div>
                <p class="key-dialog-warn">Save this key securely. It will not be shown again.</p>
                <button class="btn-text-close" (click)="generatedKey.set(null)">Close</button>
              </div>
            }

            @if (keyError()) {
              <p class="section-desc" style="color: var(--negative); margin-top: var(--sp-2)">{{ keyError() }}</p>
            }
          </div>

          <!-- Accounts -->
          <div class="section-card">
            <h3>Accounts</h3>
            <div class="account-list">
              @for (acct of wallet.accounts(); track acct.name + acct.chainId; let i = $index) {
                <div class="account-row">
                  <div class="account-info">
                    <span class="account-name">{{ acct.name }}</span>
                    <span class="account-chain">{{ acct.chainName }}
                      @if (acct.mode === 'watch') {
                        <span class="watch-badge">watch</span>
                      }
                    </span>
                  </div>
                  <button class="btn-icon-danger" title="Remove account" (click)="onRemoveAccount(i)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              }
            </div>

            @if (confirmRemoveIndex() !== null) {
              <div class="confirm-bar">
                <span>Remove <strong>{{ wallet.accounts()[confirmRemoveIndex()!].name }}</strong>?</span>
                <div class="confirm-actions">
                  <button class="btn-cancel btn-small" (click)="confirmRemoveIndex.set(null)">Cancel</button>
                  <button class="btn-danger btn-small" (click)="doRemoveAccount()">Remove</button>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Right column -->
        <div class="settings-col">

          <!-- Security -->
          <div class="section-card">
            <h3>Security</h3>

            <div class="setting-item">
              <div>
                <span class="setting-label">Security Mode</span>
                <span class="setting-desc">How the wallet handles key access</span>
              </div>
            </div>

            <div class="mode-selector">
              <button class="mode-option" [class.active]="wallet.securityMode() === 'SessionUnlock'" (click)="setMode('SessionUnlock')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                <span class="mode-name">Unlock Once</span>
                <span class="mode-desc">Enter passphrase at startup, stays unlocked</span>
              </button>
              <button class="mode-option" [class.active]="wallet.securityMode() === 'SignPerUse'" (click)="setMode('SignPerUse')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span class="mode-name">Sign Per Use</span>
                <span class="mode-desc">Passphrase required for every transaction</span>
              </button>
              <button class="mode-option" [class.active]="wallet.securityMode() === 'ManualToggle'" (click)="setMode('ManualToggle')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span class="mode-name">Manual Toggle</span>
                <span class="mode-desc">Lock/unlock with a button, like Anchor</span>
              </button>
            </div>

            <!-- Change Passphrase -->
            <div class="setting-item">
              <span class="setting-label">Change Passphrase</span>
              <button class="btn-ghost btn-small" (click)="showChangePassphrase.set(true)">CHANGE</button>
            </div>

            @if (showChangePassphrase()) {
              <div class="backup-dialog">
                <input class="form-input" type="password" placeholder="Current passphrase"
                       [value]="oldPassphrase()"
                       (input)="oldPassphrase.set($any($event.target).value)" />
                <input class="form-input" type="password" placeholder="New passphrase (min 8 chars)"
                       [value]="newPassphrase()"
                       (input)="newPassphrase.set($any($event.target).value)" />
                <input class="form-input" type="password" placeholder="Confirm new passphrase"
                       [value]="confirmPassphrase()"
                       (input)="confirmPassphrase.set($any($event.target).value)" />
                <div class="backup-actions">
                  <button class="btn-cancel btn-small" (click)="closeChangePassphrase()">Cancel</button>
                  <button class="btn-primary btn-small" (click)="onChangePassphrase()"
                          [disabled]="!oldPassphrase() || newPassphrase().length < 8 || newPassphrase() !== confirmPassphrase() || changingPassphrase()">
                    {{ changingPassphrase() ? 'Changing...' : 'Change' }}
                  </button>
                </div>
                @if (passphraseError()) {
                  <p class="backup-msg error">{{ passphraseError() }}</p>
                }
                @if (passphraseSuccess()) {
                  <p class="backup-msg success">{{ passphraseSuccess() }}</p>
                }
              </div>
            }

            <!-- Lock & Auto-Lock -->
            <div class="setting-item">
              <div>
                <span class="setting-label">Auto-Lock Timeout</span>
                <span class="setting-desc">Lock wallet after inactivity</span>
              </div>
              <select class="timeout-select" [ngModel]="autoLockMinutes()" (ngModelChange)="onAutoLockChange($event)">
                <option [value]="0">Never</option>
                <option [value]="1">1 minute</option>
                <option [value]="5">5 minutes</option>
                <option [value]="15">15 minutes</option>
                <option [value]="30">30 minutes</option>
                <option [value]="60">1 hour</option>
              </select>
            </div>

            <div class="setting-item">
              <span class="setting-label">Lock Wallet</span>
              <button class="btn-ghost btn-small" (click)="lockWallet()">LOCK NOW</button>
            </div>

            <!-- Close to Tray -->
            <div class="setting-item">
              <div>
                <span class="setting-label">Close to Tray</span>
                <span class="setting-desc">Keep the wallet running in the background when the window is closed, so dApps can request signatures instantly.</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" [checked]="closeToTray()" (change)="onCloseToTrayChange($any($event.target).checked)" />
                <span class="toggle-slider"></span>
              </label>
            </div>

            <!-- Quick PIN -->
            <div class="setting-item">
              <div>
                <span class="setting-label">Quick Unlock PIN</span>
                <span class="setting-desc">{{ hasPinConfigured() ? 'PIN is set — use it on the lockscreen' : 'Set a 4-6 digit PIN for faster unlocking' }}</span>
              </div>
              @if (hasPinConfigured()) {
                <button class="btn-danger btn-small" (click)="onRemovePin()">REMOVE</button>
              } @else {
                <button class="btn-ghost btn-small" (click)="showPinSetup.set(true)">SET PIN</button>
              }
            </div>

            @if (showPinSetup()) {
              <div class="backup-dialog">
                <input class="form-input" type="password" placeholder="Current passphrase"
                       [value]="pinPassphrase()"
                       (input)="pinPassphrase.set($any($event.target).value)" />
                <input class="form-input" type="password" inputmode="numeric" maxlength="6"
                       placeholder="New PIN (4-6 digits)"
                       [value]="pinValue()"
                       (input)="pinValue.set($any($event.target).value)" />
                <div class="backup-actions">
                  <button class="btn-cancel btn-small" (click)="closePinSetup()">Cancel</button>
                  <button class="btn-primary btn-small" (click)="onSetPin()"
                          [disabled]="!pinPassphrase() || pinValue().length < 4">
                    Save PIN
                  </button>
                </div>
                @if (pinError()) {
                  <p class="backup-msg error">{{ pinError() }}</p>
                }
                @if (pinSuccess()) {
                  <p class="backup-msg success">{{ pinSuccess() }}</p>
                }
              </div>
            }

            <!-- Biometric Unlock -->
            <div class="setting-item">
              <div>
                <span class="setting-label">Biometric Unlock</span>
                <span class="setting-desc">
                  {{
                    biometricAvailable()
                      ? (hasBiometricConfigured() ? 'Windows Hello is set for this wallet' : 'Use Windows Hello for quick unlock')
                      : biometricReason()
                  }}
                </span>
              </div>
              @if (hasBiometricConfigured()) {
                <button class="btn-danger btn-small" (click)="onRemoveBiometric()">REMOVE</button>
              } @else {
                <button class="btn-ghost btn-small" (click)="showBiometricSetup.set(true)" [disabled]="!biometricAvailable()">ENABLE</button>
              }
            </div>

            @if (showBiometricSetup()) {
              <div class="backup-dialog">
                <input class="form-input" type="password" placeholder="Current passphrase"
                       [value]="biometricPassphrase()"
                       (input)="biometricPassphrase.set($any($event.target).value)" />
                <div class="backup-actions">
                  <button class="btn-cancel btn-small" (click)="closeBiometricSetup()">Cancel</button>
                  <button class="btn-primary btn-small" (click)="onSetBiometric()"
                          [disabled]="!biometricPassphrase() || biometricBusy()">
                    {{ biometricBusy() ? 'Waiting...' : 'Enable' }}
                  </button>
                </div>
                @if (biometricError()) {
                  <p class="backup-msg error">{{ biometricError() }}</p>
                }
                @if (biometricSuccess()) {
                  <p class="backup-msg success">{{ biometricSuccess() }}</p>
                }
              </div>
            }
          </div>

          <!-- Backup -->
          <div class="section-card">
            <h3>Backup</h3>

            <div class="setting-item">
              <div>
                <span class="setting-label">Export Backup</span>
                <span class="setting-desc">Save an encrypted copy of all keys</span>
              </div>
              <button class="btn-ghost btn-small" (click)="showExportDialog.set(true)"
                      [disabled]="backupBusy()">EXPORT</button>
            </div>

            @if (showExportDialog()) {
              <div class="backup-dialog">
                <input class="form-input" type="password" placeholder="Enter passphrase to export"
                       [value]="backupPassphrase()"
                       (input)="backupPassphrase.set($any($event.target).value)"
                       (keydown.enter)="onExportBackup()" />
                <div class="backup-actions">
                  <button class="btn-cancel btn-small" (click)="closeBackupDialog()">Cancel</button>
                  <button class="btn-primary btn-small" (click)="onExportBackup()"
                          [disabled]="!backupPassphrase() || backupBusy()">
                    {{ backupBusy() ? 'Exporting...' : 'Export' }}
                  </button>
                </div>
                @if (backupError()) {
                  <p class="backup-msg error">{{ backupError() }}</p>
                }
                @if (backupSuccess()) {
                  <p class="backup-msg success">{{ backupSuccess() }}</p>
                }
              </div>
            }

            <div class="setting-item">
              <div>
                <span class="setting-label">Import Backup</span>
                <span class="setting-desc">Restore keys from a SimplEOS backup file</span>
              </div>
              <button class="btn-ghost btn-small" (click)="showImportDialog.set(true)"
                      [disabled]="backupBusy()">IMPORT</button>
            </div>

            @if (showImportDialog()) {
              <div class="backup-dialog">
                <input class="form-input" type="file" accept=".json,.bkp"
                       (change)="onBackupFileSelected($event)" />
                @if (importFileLoaded()) {
                  <input class="form-input" type="password" placeholder="Backup passphrase"
                         [value]="backupPassphrase()"
                         (input)="backupPassphrase.set($any($event.target).value)"
                         (keydown.enter)="onImportBackup()" />
                  <div class="backup-actions">
                    <button class="btn-cancel btn-small" (click)="closeBackupDialog()">Cancel</button>
                    <button class="btn-primary btn-small" (click)="onImportBackup()"
                            [disabled]="!backupPassphrase() || backupBusy()">
                      {{ backupBusy() ? 'Importing...' : 'Import' }}
                    </button>
                  </div>
                }
                @if (backupError()) {
                  <p class="backup-msg error">{{ backupError() }}</p>
                }
                @if (backupSuccess()) {
                  <p class="backup-msg success">{{ backupSuccess() }}</p>
                }
              </div>
            }
          </div>

          <!-- Danger Zone -->
          <div class="section-card danger-zone">
            <h3>Danger Zone</h3>
            <div class="setting-item">
              <div>
                <span class="setting-label">Logout</span>
                <span class="setting-desc">Clear all data and keys from this device</span>
              </div>
              <button class="btn-danger btn-small" (click)="showLogoutConfirm.set(true)">LOGOUT</button>
            </div>

            @if (showLogoutConfirm()) {
              <div class="confirm-bar danger">
                <p style="margin: 0; font-size: 13px; color: var(--negative)">
                  This will permanently delete all keys and wallet data. This cannot be undone.
                </p>
                <p style="margin: var(--sp-2) 0 0; font-size: 12px; color: var(--text-muted)">
                  Type <strong>LOGOUT</strong> to confirm:
                </p>
                <input class="form-input" type="text" placeholder="Type LOGOUT"
                       [value]="logoutConfirmText()"
                       (input)="logoutConfirmText.set($any($event.target).value)" />
                <div class="confirm-actions">
                  <button class="btn-cancel btn-small" (click)="showLogoutConfirm.set(false); logoutConfirmText.set('')">Cancel</button>
                  <button class="btn-danger btn-small" (click)="onLogout()"
                          [disabled]="logoutConfirmText() !== 'LOGOUT'">Wipe Everything</button>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .settings-view { max-width: 860px; }
    h2 { font-size: 24px; margin-bottom: var(--sp-6); }

    .settings-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--sp-6);
    }
    .settings-col {
      display: flex;
      flex-direction: column;
      gap: var(--sp-6);
    }

    .section-card {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      padding: var(--sp-5);
    }
    .section-card h3 { font-size: 15px; margin-bottom: var(--sp-3); }
    .section-desc {
      font-size: 13px; color: var(--text-muted);
      margin-bottom: var(--sp-4);
    }
    .section-desc strong { color: var(--text-bright); }

    .danger-zone { border: 1px solid rgba(240, 68, 56, 0.2); }

    /* Endpoints */
    .ep-section { margin-bottom: var(--sp-3); }
    .ep-section-label {
      display: block;
      font-size: 11px;
      font-weight: 500;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: var(--sp-2);
    }
    .endpoints-list { margin-bottom: var(--sp-2); }
    .endpoint-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--sp-2) var(--sp-3);
      border-radius: var(--radius-sm);
      font-size: 12px;
      transition: background 150ms ease;
    }
    .endpoint-row:hover { background: var(--bg-hover); }
    .endpoint-row.active-ep {
      background: var(--accent-muted);
      border-left: 2px solid var(--accent);
    }
    .ep-url {
      font-family: var(--font-data);
      color: var(--text-body);
    }
    .ep-latency {
      font-family: var(--font-data);
      font-size: 11px;
      font-weight: 500;
    }
    .ep-latency.healthy { color: var(--positive, #22c55e); }
    .ep-latency.slow { color: #f59e0b; }
    .ep-latency.dead { color: var(--negative); }
    .ep-actions {
      display: flex;
      gap: var(--sp-2);
      margin-bottom: var(--sp-3);
    }

    /* Tools grid */
    .tools-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--sp-2);
    }
    .tool-btn {
      padding: var(--sp-3);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-body);
      font-family: var(--font-body);
      font-size: 12px;
      cursor: pointer;
      transition: background 150ms ease, border-color 150ms ease;
    }
    .tool-btn:hover {
      background: var(--bg-hover);
      border-color: var(--text-muted);
    }
    .tool-btn:disabled { opacity: 0.35; cursor: not-allowed; }

    /* Settings items */
    .setting-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--sp-3) 0;
      border-bottom: 1px solid var(--border-subtle);
    }
    .setting-item:last-child { border-bottom: none; }
    .setting-label {
      font-size: 13px;
      color: var(--text-body);
    }
    .setting-desc {
      display: block;
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 2px;
    }

    /* Mode selector */
    .mode-selector {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
      margin-bottom: var(--sp-4);
    }
    .mode-option {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-3);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: transparent;
      cursor: pointer;
      text-align: left;
      transition: border-color 0.15s, background 0.15s;
    }
    .mode-option:hover {
      background: var(--bg-hover);
      border-color: var(--text-muted);
    }
    .mode-option.active {
      border-color: var(--accent);
      background: var(--accent-muted);
    }
    .mode-option svg {
      flex-shrink: 0;
      color: var(--text-muted);
    }
    .mode-option.active svg { color: var(--accent); }
    .mode-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-bright);
      display: block;
    }
    .mode-desc {
      font-size: 11px;
      color: var(--text-muted);
      display: block;
      margin-top: 1px;
    }

    /* Buttons */
    .btn-ghost {
      padding: var(--sp-2) var(--sp-4);
      border: 1px solid var(--accent);
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--accent);
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 150ms ease;
    }
    .btn-ghost:hover { background: var(--accent-muted); }
    .btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

    .btn-danger {
      padding: var(--sp-2) var(--sp-4);
      border: 1px solid var(--negative);
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--negative);
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 150ms ease;
    }
    .btn-danger:hover { background: rgba(240, 68, 56, 0.1); }

    .btn-small { padding: var(--sp-1) var(--sp-3); font-size: 11px; }

    .btn-text-action {
      display: block;
      border: none;
      background: none;
      color: var(--accent);
      font-size: 12px;
      cursor: pointer;
      padding: var(--sp-2) 0;
    }
    .btn-text-action:hover { text-decoration: underline; }

    .btn-icon-danger {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 150ms ease;
    }
    .btn-icon-danger:hover {
      border-color: var(--negative);
      color: var(--negative);
      background: rgba(240, 68, 56, 0.08);
    }

    /* Key dialogs */
    .key-list { margin-bottom: var(--sp-3); }
    .key-row {
      padding: var(--sp-2) var(--sp-3);
      border-radius: var(--radius-sm);
      font-family: var(--font-data);
      font-size: 11px;
      color: var(--text-muted);
      word-break: break-all;
      border-bottom: 1px solid var(--border-subtle);
    }

    .key-dialog {
      margin-top: var(--sp-4);
      padding: var(--sp-4);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      background: var(--bg-deep);
    }
    .key-dialog-hint { font-size: 13px; color: var(--text-muted); margin-bottom: var(--sp-3); }
    .key-dialog-warn { font-size: 11px; color: var(--negative); margin-top: var(--sp-2); }
    .key-select {
      width: 100%;
      padding: var(--sp-2) var(--sp-3);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-card);
      color: var(--text-body);
      font-family: var(--font-data);
      font-size: 11px;
    }
    .exported-key {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
    }
    .wif-display {
      flex: 1;
      padding: var(--sp-2) var(--sp-3);
      background: var(--bg-card);
      border: 1px solid var(--accent);
      border-radius: var(--radius-sm);
      font-family: var(--font-data);
      font-size: 12px;
      color: var(--accent);
      word-break: break-all;
    }
    .btn-text-close {
      display: block;
      margin-top: var(--sp-3);
      border: none;
      background: none;
      color: var(--text-muted);
      font-size: 12px;
      cursor: pointer;
      text-decoration: underline;
    }

    .gen-key-field {
      margin-bottom: var(--sp-3);
    }
    .gen-key-field label {
      display: block;
      font-size: 11px;
      color: var(--text-muted);
      margin-bottom: var(--sp-1);
    }
    .gen-key-value {
      display: block;
      padding: var(--sp-2) var(--sp-3);
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      font-family: var(--font-data);
      font-size: 11px;
      color: var(--text-body);
      word-break: break-all;
    }

    /* Backup dialog */
    .backup-dialog {
      margin-top: var(--sp-3);
      padding: var(--sp-4);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      background: var(--bg-deep);
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }
    .backup-actions {
      display: flex;
      gap: var(--sp-2);
    }
    .backup-actions .btn-primary {
      flex: 1;
      border: none;
      border-radius: var(--radius-sm);
      background: var(--accent);
      color: #fff;
      font-family: var(--font-body);
      cursor: pointer;
    }
    .backup-actions .btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
    .backup-actions .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
    .backup-actions .btn-cancel {
      flex: 0;
      padding: var(--sp-1) var(--sp-3);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-base);
      color: var(--text-muted);
      font-family: var(--font-body);
      cursor: pointer;
    }
    .backup-msg {
      font-size: 12px;
      margin: 0;
    }
    .backup-msg.error { color: var(--negative); }
    .backup-msg.success { color: var(--positive); }
    .form-input {
      width: 100%;
      padding: var(--sp-2) var(--sp-3);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-base);
      color: var(--text-bright);
      font-family: var(--font-body);
      font-size: 13px;
    }
    .form-input:focus {
      outline: none;
      border-color: var(--accent);
    }
    .form-input::placeholder { color: var(--text-disabled); }
    .form-input[type="file"] { font-size: 12px; }

    .timeout-select {
      padding: var(--sp-1) var(--sp-3);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-card);
      color: var(--text-body);
      font-family: var(--font-body);
      font-size: 12px;
    }

    /* Toggle switch */
    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 40px;
      height: 22px;
      flex-shrink: 0;
    }
    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .toggle-slider {
      position: absolute;
      inset: 0;
      cursor: pointer;
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 22px;
      transition: background 150ms ease, border-color 150ms ease;
    }
    .toggle-slider::before {
      content: '';
      position: absolute;
      height: 16px;
      width: 16px;
      left: 2px;
      top: 50%;
      transform: translateY(-50%);
      background: var(--text-muted);
      border-radius: 50%;
      transition: transform 150ms ease, background 150ms ease;
    }
    .toggle-switch input:checked + .toggle-slider {
      background: var(--accent-muted);
      border-color: var(--accent);
    }
    .toggle-switch input:checked + .toggle-slider::before {
      transform: translate(18px, -50%);
      background: var(--accent);
    }

    /* Account list */
    .account-list { margin-bottom: var(--sp-2); }
    .account-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--sp-2) var(--sp-3);
      border-bottom: 1px solid var(--border-subtle);
    }
    .account-row:last-child { border-bottom: none; }
    .account-info { display: flex; flex-direction: column; }
    .account-name {
      font-family: var(--font-data);
      font-size: 13px;
      color: var(--text-bright);
    }
    .account-chain {
      font-size: 11px;
      color: var(--text-muted);
    }
    .watch-badge {
      display: inline-block;
      padding: 0 4px;
      margin-left: 4px;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: 1px solid #f59e0b;
      border-radius: 3px;
      color: #f59e0b;
    }

    .confirm-bar {
      margin-top: var(--sp-3);
      padding: var(--sp-3);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-deep);
    }
    .confirm-bar.danger {
      border-color: rgba(240, 68, 56, 0.3);
    }
    .confirm-bar span {
      font-size: 13px;
      color: var(--text-body);
    }
    .confirm-actions {
      display: flex;
      gap: var(--sp-2);
      margin-top: var(--sp-2);
    }
  `],
})
export class SettingsComponent {
  keyringReport = signal<string[]>([]);
  storedKeys = signal<string[]>([]);
  showViewKeyDialog = signal(false);
  selectedExportKey = signal('');
  exportedWif = signal('');
  keyError = signal('');
  generatedKey = signal<{ wif: string; public_key: string } | null>(null);
  private hideTimer: any;

  constructor(
    public wallet: WalletStateService,
    public network: NetworkService,
    private ipc: TauriIpcService,
    private router: Router,
  ) {
    this.loadPinStatus();
    this.loadBiometricStatus();
    this.loadAutoLockSetting();
    this.loadCloseToTraySetting();
  }

  async setMode(mode: 'SessionUnlock' | 'SignPerUse' | 'ManualToggle') {
    await this.wallet.setSecurityMode(mode);
  }

  async lockWallet() {
    await this.wallet.lock();
  }

  async testKeyring() {
    try {
      const report = await this.ipc.testKeyring();
      this.keyringReport.set(report);
    } catch (e: any) {
      this.keyringReport.set(['Test failed: ' + (e?.toString() ?? 'Unknown error')]);
    }
  }

  async checkStoredKeys() {
    this.keyError.set('');
    const account = this.wallet.selectedAccount();
    if (!account) return;
    try {
      const keys = await this.ipc.listPublicKeys(account.chainId);
      this.storedKeys.set(keys);
      if (keys.length === 0) {
        this.keyError.set('No keys found in keyring for chain ' + account.chainId.slice(0, 8));
      }
    } catch (e: any) {
      this.keyError.set(e?.toString() ?? 'Failed to list keys');
    }
  }

  async onExportKey() {
    const account = this.wallet.selectedAccount();
    const pubKey = this.selectedExportKey();
    if (!account || !pubKey) return;
    this.keyError.set('');
    try {
      const wif = await this.ipc.exportPrivateKey(account.chainId, pubKey);
      this.exportedWif.set(wif);
      clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => this.closeKeyDialog(), 30000);
    } catch (e: any) {
      this.keyError.set(e?.toString() ?? 'Failed to export key');
    }
  }

  copyKey() {
    navigator.clipboard.writeText(this.exportedWif());
  }

  closeKeyDialog() {
    clearTimeout(this.hideTimer);
    this.showViewKeyDialog.set(false);
    this.exportedWif.set('');
    this.selectedExportKey.set('');
  }

  // ── Key Generation ──

  async onGenerateKey() {
    this.keyError.set('');
    try {
      const pair = await this.ipc.generateKeyPair();
      this.generatedKey.set(pair);
    } catch (e: any) {
      this.keyError.set(e?.toString() ?? 'Failed to generate key');
    }
  }

  copyGenKey() {
    const key = this.generatedKey();
    if (key) navigator.clipboard.writeText(key.wif);
  }

  // ── Change Passphrase ──

  showChangePassphrase = signal(false);
  oldPassphrase = signal('');
  newPassphrase = signal('');
  confirmPassphrase = signal('');
  changingPassphrase = signal(false);
  passphraseError = signal('');
  passphraseSuccess = signal('');

  closeChangePassphrase() {
    this.showChangePassphrase.set(false);
    this.oldPassphrase.set('');
    this.newPassphrase.set('');
    this.confirmPassphrase.set('');
    this.passphraseError.set('');
    this.passphraseSuccess.set('');
  }

  async onChangePassphrase() {
    this.passphraseError.set('');
    this.passphraseSuccess.set('');

    if (this.newPassphrase() !== this.confirmPassphrase()) {
      this.passphraseError.set('New passphrases do not match');
      return;
    }
    if (this.newPassphrase().length < 8) {
      this.passphraseError.set('New passphrase must be at least 8 characters');
      return;
    }

    this.changingPassphrase.set(true);
    try {
      await this.ipc.changePassphrase(this.oldPassphrase(), this.newPassphrase());
      this.hasPinConfigured.set(false);
      this.hasBiometricConfigured.set(false);
      this.passphraseSuccess.set('Passphrase changed successfully. Quick unlock has been disabled.');
      setTimeout(() => this.closeChangePassphrase(), 2000);
    } catch (e: any) {
      const msg = e?.toString() ?? 'Failed to change passphrase';
      this.passphraseError.set(msg.includes('InvalidPassphrase') ? 'Current passphrase is incorrect' : msg);
    } finally {
      this.changingPassphrase.set(false);
    }
  }

  // ── Auto-Lock ──

  autoLockMinutes = signal(0);
  private autoLockTimer: any;

  private async loadAutoLockSetting() {
    try {
      const saved = await this.ipc.storeGet<number>('autoLockMinutes');
      if (saved !== null && saved > 0) {
        this.autoLockMinutes.set(saved);
        this.startAutoLockTimer(saved);
      }
    } catch { /* ignore */ }
  }

  async onAutoLockChange(minutes: number | string) {
    const mins = Number(minutes);
    this.autoLockMinutes.set(mins);
    await this.ipc.storeSet('autoLockMinutes', mins);
    clearInterval(this.autoLockTimer);
    if (mins > 0) {
      this.startAutoLockTimer(mins);
    }
  }

  private startAutoLockTimer(minutes: number) {
    clearInterval(this.autoLockTimer);
    let lastActivity = Date.now();

    // Reset timer on user activity
    const resetActivity = () => { lastActivity = Date.now(); };
    document.addEventListener('click', resetActivity);
    document.addEventListener('keydown', resetActivity);
    document.addEventListener('mousemove', resetActivity);

    this.autoLockTimer = setInterval(() => {
      const idle = Date.now() - lastActivity;
      if (idle >= minutes * 60 * 1000) {
        this.wallet.lock();
        clearInterval(this.autoLockTimer);
        document.removeEventListener('click', resetActivity);
        document.removeEventListener('keydown', resetActivity);
        document.removeEventListener('mousemove', resetActivity);
      }
    }, 10000); // Check every 10 seconds
  }

  // ── Close to Tray ──

  closeToTray = signal(true);

  private async loadCloseToTraySetting() {
    try {
      const saved = await this.ipc.storeGet<boolean>('closeToTray');
      // Default to true when the setting has never been written.
      const enabled = saved === null ? true : saved;
      this.closeToTray.set(enabled);
      // Re-sync to backend in case this is a fresh process and the user
      // had previously disabled the feature — the Rust default on boot is
      // true and reads from the store, but pushing again is harmless and
      // guarantees the two sides agree.
      await this.ipc.setCloseToTray(enabled);
    } catch { /* ignore */ }
  }

  async onCloseToTrayChange(enabled: boolean) {
    this.closeToTray.set(enabled);
    await this.ipc.storeSet('closeToTray', enabled);
    try {
      await this.ipc.setCloseToTray(enabled);
    } catch { /* ignore — backend will re-read on next start */ }
  }

  // ── PIN ──

  hasPinConfigured = signal(false);
  showPinSetup = signal(false);
  pinPassphrase = signal('');
  pinValue = signal('');
  pinError = signal('');
  pinSuccess = signal('');

  private async loadPinStatus() {
    try {
      this.hasPinConfigured.set(await this.ipc.hasPin());
    } catch {
      this.hasPinConfigured.set(false);
    }
  }

  closePinSetup() {
    this.showPinSetup.set(false);
    this.pinPassphrase.set('');
    this.pinValue.set('');
    this.pinError.set('');
    this.pinSuccess.set('');
  }

  async onSetPin() {
    this.pinError.set('');
    this.pinSuccess.set('');
    const pin = this.pinValue();
    if (!/^\d{4,6}$/.test(pin)) {
      this.pinError.set('PIN must be 4-6 digits');
      return;
    }
    try {
      await this.ipc.setPin(this.pinPassphrase(), pin);
      this.hasPinConfigured.set(true);
      this.pinSuccess.set('PIN set successfully');
      setTimeout(() => this.closePinSetup(), 1500);
    } catch (e: any) {
      this.pinError.set(e?.toString()?.includes('InvalidPassphrase') ? 'Incorrect passphrase' : (e?.toString() ?? 'Failed to set PIN'));
    }
  }

  async onRemovePin() {
    try {
      await this.ipc.removePin();
      this.hasPinConfigured.set(false);
    } catch { /* ignore */ }
  }

  // ── Biometric Unlock ──

  biometricAvailable = signal(false);
  hasBiometricConfigured = signal(false);
  biometricReason = signal('Biometric unlock is unavailable');
  showBiometricSetup = signal(false);
  biometricPassphrase = signal('');
  biometricBusy = signal(false);
  biometricError = signal('');
  biometricSuccess = signal('');

  private async loadBiometricStatus() {
    try {
      const status = await this.ipc.biometricStatus();
      this.biometricAvailable.set(status.available);
      this.hasBiometricConfigured.set(status.configured);
      this.biometricReason.set(status.reason);
    } catch (e: any) {
      this.biometricAvailable.set(false);
      this.hasBiometricConfigured.set(false);
      this.biometricReason.set(e?.toString() ?? 'Biometric unlock is unavailable');
    }
  }

  closeBiometricSetup() {
    this.showBiometricSetup.set(false);
    this.biometricPassphrase.set('');
    this.biometricBusy.set(false);
    this.biometricError.set('');
    this.biometricSuccess.set('');
  }

  async onSetBiometric() {
    this.biometricBusy.set(true);
    this.biometricError.set('');
    this.biometricSuccess.set('');
    try {
      await this.ipc.setBiometricUnlock(this.biometricPassphrase());
      this.hasBiometricConfigured.set(true);
      this.biometricSuccess.set('Biometric unlock enabled');
      setTimeout(() => this.closeBiometricSetup(), 1500);
    } catch (e: any) {
      const msg = e?.toString() ?? 'Failed to enable biometric unlock';
      this.biometricError.set(msg.includes('InvalidPassphrase') ? 'Incorrect passphrase' : msg);
    } finally {
      this.biometricBusy.set(false);
    }
  }

  async onRemoveBiometric() {
    try {
      await this.ipc.removeBiometricUnlock();
      this.hasBiometricConfigured.set(false);
    } catch { /* ignore */ }
  }

  // ── Backup ──

  showExportDialog = signal(false);
  showImportDialog = signal(false);
  backupPassphrase = signal('');
  backupBusy = signal(false);
  backupError = signal('');
  backupSuccess = signal('');
  importFileLoaded = signal(false);
  private importFileContent = '';

  closeBackupDialog() {
    this.showExportDialog.set(false);
    this.showImportDialog.set(false);
    this.backupPassphrase.set('');
    this.backupError.set('');
    this.backupSuccess.set('');
    this.importFileLoaded.set(false);
    this.importFileContent = '';
  }

  async onExportBackup() {
    this.backupBusy.set(true);
    this.backupError.set('');
    this.backupSuccess.set('');
    try {
      const json = await this.ipc.exportBackup(this.backupPassphrase());
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `simpleos-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.backupSuccess.set('Backup exported successfully');
    } catch (e: any) {
      this.backupError.set(e?.toString() ?? 'Export failed');
    } finally {
      this.backupBusy.set(false);
    }
  }

  onBackupFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.importFileContent = reader.result as string;
      this.importFileLoaded.set(true);
    };
    reader.readAsText(file);
  }

  async onImportBackup() {
    if (!this.importFileContent) return;
    this.backupBusy.set(true);
    this.backupError.set('');
    this.backupSuccess.set('');
    try {
      const count = await this.ipc.importBackup(this.importFileContent, this.backupPassphrase());
      this.backupSuccess.set(`Imported ${count} key${count !== 1 ? 's' : ''} successfully`);
      await this.wallet.unlock(this.backupPassphrase());
    } catch (e: any) {
      this.backupError.set(e?.toString() ?? 'Import failed');
    } finally {
      this.backupBusy.set(false);
    }
  }

  // ── Account Removal ──

  confirmRemoveIndex = signal<number | null>(null);

  onRemoveAccount(index: number) {
    this.confirmRemoveIndex.set(index);
  }

  async doRemoveAccount() {
    const index = this.confirmRemoveIndex();
    if (index === null) return;

    const account = this.wallet.accounts()[index];
    if (account && account.mode === 'full') {
      // Also remove the key from the keystore
      try {
        const keys = await this.ipc.listPublicKeys(account.chainId);
        // Find the key that belongs to this account by checking permissions
        for (const key of keys) {
          const hasOtherAccounts = this.wallet.accounts().some(
            (a, i) => i !== index && a.chainId === account.chainId && a.mode === 'full'
          );
          if (!hasOtherAccounts) {
            await this.ipc.removeKey(account.chainId, key);
          }
        }
      } catch { /* non-critical */ }
    }

    this.wallet.removeAccount(index);
    await this.wallet.saveAccounts();
    this.confirmRemoveIndex.set(null);
  }

  // ── Logout ──

  showLogoutConfirm = signal(false);
  logoutConfirmText = signal('');

  async onLogout() {
    if (this.logoutConfirmText() !== 'LOGOUT') return;
    try {
      await this.ipc.resetWallet();
      this.router.navigate(['/landing']);
    } catch (e: any) {
      console.error('Logout failed:', e);
    }
  }

  // ── Custom Endpoint ──

  showAddEndpoint = signal(false);
  customEndpointUrl = signal('');

  async onAddEndpoint() {
    const url = this.customEndpointUrl().trim();
    if (!url) return;
    const chain = this.wallet.activeChain();
    if (!chain) return;

    // Add to the chain's endpoints and re-init providers
    const newEndpoints = [...chain.endpoints, { url, owner: 'custom' }];
    await this.ipc.initChainProviders(chain.id, newEndpoints, chain.hyperion_apis);

    // Update local chain config
    this.wallet.chains.update(chains =>
      chains.map(c => c.id === chain.id ? { ...c, endpoints: newEndpoints } : c)
    );

    this.customEndpointUrl.set('');
    this.showAddEndpoint.set(false);

    // Run health check to show latency
    this.network.checkEndpoints();
  }
}
