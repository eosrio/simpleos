import { Component, effect, signal } from '@angular/core';
import { WalletStateService } from '../../../core/services/wallet-state.service';
import { TauriIpcService } from '../../../core/services/tauri-ipc.service';
import { TransactionService } from '../../../core/services/transaction.service';

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
              <p>Your node is actively producing blocks at rank <strong>#{{ wallet.selectedAccount().producerRank }}</strong></p>
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
          @if (savedConfig()) {
            <div class="saved-config">
              <span class="config-item"><strong>URL:</strong> {{ savedConfig()!.url }}</span>
              <span class="config-item"><strong>Location:</strong> {{ savedConfig()!.location }}</span>
              <span class="config-item"><strong>Key:</strong> {{ savedConfig()!.producer_key.slice(0, 12) }}...{{ savedConfig()!.producer_key.slice(-6) }}</span>
            </div>
          }
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

          <button class="btn-primary" (click)="onGenerateFinKey()" [disabled]="busy()">
            {{ busy() ? 'Generating...' : 'GENERATE FINALIZER KEY' }}
          </button>

          @if (finKeyError()) {
            <p class="finkey-error">{{ finKeyError() }}</p>
          }
        </div>
      </div>

      <div class="section-card">
        <h3>Permission Structure</h3>
        <p class="section-desc">Active permissions on {{ wallet.selectedAccount().name }}</p>
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
  `],
})
export class BpKeysComponent {
  isRegistered = signal(true);
  busy = signal(false);
  producerInfo = signal<any>(null);
  savedConfig = signal<{ url: string; location: number; producer_key: string } | null>(null);

  // Finalizer keys
  registeredFinKeys = signal<{ id: number; key: string }[]>([]);
  activeFinKey = signal<string | null>(null);
  finKeyError = signal('');

  constructor(
    public wallet: WalletStateService,
    private ipc: TauriIpcService,
    private tx: TransactionService,
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

      // Load active key from finalizers table
      const finResult = await this.ipc.getTableRows(chainId, {
        code: 'eosio', table: 'finalizers', scope: 'eosio',
        lower_bound: account, upper_bound: account,
        limit: 1, json: true,
      });
      const finRow = finResult?.rows?.[0];
      if (finRow?.active_key) {
        this.activeFinKey.set(finRow.active_key);
      } else {
        this.activeFinKey.set(null);
      }
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
      const { finalizer_key, proof_of_possession } = await this.ipc.generateFinalizerKey(acct.chainId);

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
        this.isRegistered.set(row.is_active === 1 || parseFloat(row.total_votes) > 0);
        this.savedConfig.set({
          url: row.url ?? '',
          location: row.location ?? 0,
          producer_key: row.producer_key ?? row.producer_public_key ?? '',
        });
        try {
          await this.ipc.storeSet(`bp_config_${account}`, this.savedConfig());
        } catch { /* non-critical */ }
      }
    } catch { /* offline or not a producer */ }
  }

  private me(): string { return this.wallet.selectedAccount()?.name ?? ''; }
  private auth() { return [{ actor: this.me(), permission: 'active' }]; }

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
    try {
      const ok = await this.confirmAction('Unregister Producer', [{
        account: 'eosio', name: 'unregprod', authorization: this.auth(),
        data: { producer: this.me() },
      }]);
      if (ok) this.isRegistered.set(false);
    } finally {
      this.busy.set(false);
    }
  }

  async onReregister() {
    const config = this.savedConfig();
    if (!config) return;

    this.busy.set(true);
    try {
      const ok = await this.confirmAction('Re-register Producer', [{
        account: 'eosio', name: 'regproducer', authorization: this.auth(),
        data: {
          producer: this.me(),
          producer_key: config.producer_key,
          url: config.url,
          location: config.location,
        },
      }]);
      if (ok) this.isRegistered.set(true);
    } finally {
      this.busy.set(false);
    }
  }

  copyKey(key?: string) {
    if (key) navigator.clipboard.writeText(key);
  }
}
