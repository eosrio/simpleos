import { Component, signal } from '@angular/core';
import { WalletStateService } from '../../../core/services/wallet-state.service';

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
              <p>Your node is actively producing blocks at rank <strong>#{{ wallet.selectedAccount()?.producerRank }}</strong></p>
            </div>
            <button class="btn-emergency" (click)="toggleRegistration()">
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
            <button class="btn-rereg" (click)="toggleRegistration()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              RE-REGISTER NOW
            </button>
          </div>
          <div class="saved-config">
            <span class="config-item"><strong>URL:</strong> {{ wallet.selectedAccount()?.producerUrl ?? '—' }}</span>
            <span class="config-item"><strong>Location:</strong> 76 (BR)</span>
            <span class="config-item"><strong>Key:</strong> EOS7wBG...a1b2c3</span>
          </div>
        }
      </div>

      <div class="keys-grid">
        <div class="key-card">
          <div class="key-header">
            <h3>Active Block Signing Key</h3>
            <span class="key-status active">Active</span>
          </div>
          <code class="key-value">EOS7wBG...mock...signing...key...a1b2c3</code>
          <div class="key-actions">
            <button class="btn-ghost">ROTATE KEY</button>
            <button class="btn-ghost">COPY</button>
          </div>
        </div>

        <div class="key-card">
          <div class="key-header">
            <h3>Standby Signing Key</h3>
            <span class="key-status standby">Standby</span>
          </div>
          <code class="key-value">EOS6kR9...mock...standby...key...d4e5f6</code>
          <div class="key-actions">
            <button class="btn-ghost">PROMOTE</button>
            <button class="btn-ghost">COPY</button>
          </div>
        </div>

        <div class="key-card">
          <div class="key-header">
            <h3>Finalizer Key (Savannah)</h3>
            <span class="key-status pending">Not Registered</span>
          </div>
          <p class="key-desc">BLS finalizer key for Savannah fast finality consensus. Required for participation in the Instant Finality protocol.</p>
          <button class="btn-primary">GENERATE FINALIZER KEY</button>
        </div>
      </div>

      <div class="section-card">
        <h3>Permission Structure</h3>
        <p class="section-desc">Active permissions on {{ wallet.selectedAccount()?.name }}</p>
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
  `],
})
export class BpKeysComponent {
  isRegistered = signal(true);

  constructor(public wallet: WalletStateService) {}

  toggleRegistration() {
    this.isRegistered.update(v => !v);
  }
}
