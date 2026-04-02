import { Component } from '@angular/core';
import { WalletStateService } from '../../../core/services/wallet-state.service';
import { NetworkService } from '../../../core/services/network.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  template: `
    <div class="settings-view">
      <h2>Settings</h2>

      <div class="settings-grid">
        <!-- Left column -->
        <div class="settings-col">
          <div class="section-card">
            <h3>Network</h3>
            <p class="section-desc">Connected to <strong>{{ wallet.activeChain()?.name ?? '—' }}</strong></p>

            <div class="endpoints-list">
              @for (ep of wallet.activeChain()?.endpoints ?? []; track ep.url) {
                <div class="endpoint-row">
                  <span class="ep-url">{{ ep.url }}</span>
                  <span class="ep-owner">{{ ep.owner ?? '' }}</span>
                </div>
              }
            </div>

            <button class="btn-ghost" (click)="network.checkEndpoints()">CHECK ENDPOINTS</button>
          </div>

          <div class="section-card">
            <h3>Tools</h3>
            <div class="tools-grid">
              <button class="tool-btn">Key Generator</button>
              <button class="tool-btn">Export Backup</button>
              <button class="tool-btn">Import Backup</button>
              <button class="tool-btn">View Private Key</button>
            </div>
          </div>
        </div>

        <!-- Right column -->
        <div class="settings-col">
          <div class="section-card">
            <h3>Security</h3>

            <div class="setting-item">
              <span class="setting-label">Change Passphrase</span>
              <button class="btn-ghost btn-small">CHANGE</button>
            </div>

            <div class="setting-item">
              <span class="setting-label">Lock Wallet</span>
              <button class="btn-ghost btn-small" (click)="lockWallet()">LOCK NOW</button>
            </div>
          </div>

          <div class="section-card danger-zone">
            <h3>Danger Zone</h3>
            <div class="setting-item">
              <div>
                <span class="setting-label">Logout</span>
                <span class="setting-desc">Clear all data and keys from this device</span>
              </div>
              <button class="btn-danger btn-small">LOGOUT</button>
            </div>
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

    .endpoints-list {
      margin-bottom: var(--sp-4);
    }
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
    .ep-url {
      font-family: var(--font-data);
      color: var(--text-body);
    }
    .ep-owner {
      color: var(--text-muted);
      font-size: 11px;
    }

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
  `],
})
export class SettingsComponent {
  constructor(
    public wallet: WalletStateService,
    public network: NetworkService,
  ) {}

  async lockWallet() {
    await this.wallet.lock();
  }
}
