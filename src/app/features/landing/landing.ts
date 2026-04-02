import { Component, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TauriIpcService } from '../../core/services/tauri-ipc.service';
import { WalletStateService } from '../../core/services/wallet-state.service';
import { NetworkService } from '../../core/services/network.service';

type OnboardingStep = 'home' | 'watch' | 'import' | 'backup';
type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'failed';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="landing">
      <div class="landing-inner">

        <!-- Animated logo — always present, transforms based on step -->
        <div class="logo-area" [class.compact]="step() !== 'home'">
          <img src="assets/simpleos-logo.svg" alt="SimplEOS"
               class="landing-logo"
               [class.compact]="step() !== 'home'" />
          <div class="logo-text" [class.compact]="step() !== 'home'">
            <h1>Simpl<span class="accent">EOS</span></h1>
            @if (step() === 'home') {
              <p class="tagline">Your secure Antelope wallet</p>
            }
          </div>
        </div>

        <!-- Step content with fade transition -->
        <div class="step-content" [attr.data-step]="step()">

        @switch (step()) {

          @case ('home') {

            <div class="chain-select-group">
              <label>SELECT CHAIN</label>
              <select class="form-input"
                      [value]="selectedChainIndex()"
                      (change)="onChainSelect(+$any($event.target).value)">
                @for (chain of wallet.chains(); track chain.id; let i = $index) {
                  <option [value]="i">{{ chain.name }} ({{ chain.symbol }})</option>
                }
              </select>

              <!-- Connection status -->
              <div class="connection-status" [class]="connectionStatus()">
                @switch (connectionStatus()) {
                  @case ('connecting') {
                    <span class="status-dot pulse"></span>
                    <span>Connecting to {{ selectedChain()?.name }}...</span>
                  }
                  @case ('connected') {
                    <span class="status-dot connected"></span>
                    <span>Connected — {{ network.healthyCount() }} healthy endpoint{{ network.healthyCount() !== 1 ? 's' : '' }}</span>
                  }
                  @case ('failed') {
                    <span class="status-dot failed"></span>
                    <span>Connection failed</span>
                    <button class="retry-btn" (click)="connectToChain()">RETRY</button>
                  }
                  @default {
                    <span class="status-dot"></span>
                    <span>Not connected</span>
                  }
                }
              </div>
            </div>

            <div class="entry-paths">
              <button class="path-card" (click)="step.set('watch')">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <div>
                  <strong>Watch Account</strong>
                  <span>Monitor any account without importing keys</span>
                </div>
              </button>

              <button class="path-card" (click)="step.set('import')"
                      [disabled]="connectionStatus() !== 'connected'">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                <div>
                  <strong>Import Key</strong>
                  <span>Import a private key to sign transactions</span>
                </div>
              </button>

              <button class="path-card" (click)="step.set('backup')">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <div>
                  <strong>Import Backup</strong>
                  <span>Restore from a SimplEOS backup file</span>
                </div>
              </button>
            </div>

            @if (wallet.accounts().length > 0) {
              <button class="go-dashboard" (click)="goToDashboard()">
                Go to Dashboard ({{ wallet.accounts().length }} account{{ wallet.accounts().length !== 1 ? 's' : '' }})
              </button>
            }
          }

          <!-- ═══ WATCH ACCOUNT ═══ -->
          @case ('watch') {
            <div class="step-header">
              <button class="back-btn" (click)="step.set('home')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              </button>
              <h2>Watch Account</h2>
            </div>
            <p class="step-desc">Enter an account name to monitor. No keys required — you can add them later to enable signing.</p>

            <div class="form-group">
              <label>CHAIN</label>
              <select class="form-input"
                      [value]="selectedChainIndex()"
                      (change)="onChainSelect(+$any($event.target).value)">
                @for (chain of wallet.chains(); track chain.id; let i = $index) {
                  <option [value]="i">{{ chain.name }} ({{ chain.symbol }})</option>
                }
              </select>
            </div>

            <div class="form-group">
              <label>ACCOUNT NAME</label>
              <input class="form-input" type="text"
                     placeholder="e.g. eosriobrazil"
                     [value]="accountName()"
                     (input)="accountName.set($any($event.target).value)"
                     (keyup.enter)="onAddWatch()"
                     autofocus />
            </div>

            @if (error()) {
              <div class="error-msg">{{ error() }}</div>
            }

            @if (success()) {
              <div class="success-msg">{{ success() }}</div>
            }

            <button class="btn-primary" [disabled]="!accountName() || loading()"
                    (click)="onAddWatch()">
              {{ loading() ? 'Looking up...' : 'ADD ACCOUNT' }}
            </button>

            @if (wallet.accounts().length > 0) {
              <button class="btn-text" (click)="goToDashboard()">
                Skip — go to dashboard
              </button>
            }
          }

          <!-- ═══ IMPORT KEY ═══ -->
          @case ('import') {
            <div class="step-header">
              <button class="back-btn" (click)="step.set('home')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              </button>
              <h2>Import Private Key</h2>
            </div>

            @switch (importStep()) {
              @case (1) {
                <p class="step-desc">Enter your private key (WIF format). We recommend importing your <strong>active</strong> key.</p>

                <div class="form-group">
                  <label>PRIVATE KEY</label>
                  <div class="key-input-row">
                    <input [type]="showKey() ? 'text' : 'password'" class="form-input"
                           placeholder="5K..."
                           [value]="privateKey()"
                           (input)="onKeyInput($any($event.target).value)"
                           autofocus />
                    <button class="toggle-vis" (click)="showKey.set(!showKey())">
                      @if (showKey()) {
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      } @else {
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                </div>

                @if (discoveredAccounts().length > 0) {
                  <div class="discovered">
                    <label>DISCOVERED ACCOUNTS</label>
                    @for (acct of discoveredAccounts(); track acct) {
                      <div class="discovered-item">{{ acct }}</div>
                    }
                  </div>
                }

                @if (keySearching()) {
                  <div class="searching">
                    <span class="status-dot pulse"></span>
                    Searching for accounts...
                  </div>
                }

                @if (error()) {
                  <div class="error-msg">{{ error() }}</div>
                }

                <button class="btn-primary"
                        [disabled]="discoveredAccounts().length === 0 || keySearching()"
                        (click)="importStep.set(2)">
                  CONTINUE
                </button>
              }

              @case (2) {
                <p class="step-desc">Set a passphrase to encrypt your private key. This is required to confirm transactions.</p>

                <div class="form-group">
                  <label>PASSPHRASE</label>
                  <input type="password" class="form-input"
                         placeholder="Minimum 8 characters"
                         [value]="passphrase()"
                         (input)="passphrase.set($any($event.target).value)"
                         autofocus />
                  <span class="char-hint">{{ passphrase().length }} / 8+</span>
                </div>

                <div class="form-group">
                  <label>CONFIRM PASSPHRASE</label>
                  <input type="password" class="form-input"
                         placeholder="Repeat passphrase"
                         [value]="confirmPassphrase()"
                         (input)="confirmPassphrase.set($any($event.target).value)" />
                  @if (confirmPassphrase() && passphrase() !== confirmPassphrase()) {
                    <span class="field-error">Passphrases do not match</span>
                  }
                </div>

                @if (error()) {
                  <div class="error-msg">{{ error() }}</div>
                }

                <button class="btn-primary"
                        [disabled]="passphrase().length < 8 || passphrase() !== confirmPassphrase() || importing()"
                        (click)="onImportKey()">
                  {{ importing() ? 'Importing...' : 'IMPORT KEY' }}
                </button>
              }
            }
          }

          <!-- ═══ IMPORT BACKUP ═══ -->
          @case ('backup') {
            <div class="step-header">
              <button class="back-btn" (click)="step.set('home')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              </button>
              <h2>Import Backup</h2>
            </div>
            <p class="step-desc">Select a SimplEOS backup file (.bkp) to restore your accounts. Supports both v1 and v2 backup formats.</p>

            <div class="backup-dropzone">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <p>Select a .bkp file</p>
              <span class="hint">Backup import will be available once the key management backend is complete.</span>
            </div>
          }
        }

        </div><!-- /step-content -->
      </div>
    </div>
  `,
  styles: [`
    .landing {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: var(--bg-deep);
      overflow-y: auto;
    }

    .landing-inner {
      width: 460px;
      padding: var(--sp-10) 0;
    }

    /* Logo area — animates between hero and compact */
    .logo-area {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-4);
      margin-bottom: var(--sp-8);
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .logo-area.compact {
      flex-direction: row;
      gap: var(--sp-3);
      margin-bottom: var(--sp-5);
    }

    .landing-logo {
      width: 80px;
      height: 80px;
      filter: drop-shadow(0 0 16px rgba(0, 148, 210, 0.2));
      animation: logoFloat 3s ease-in-out infinite;
      transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                  height 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                  filter 0.4s ease;
    }
    .landing-logo.compact {
      width: 36px;
      height: 36px;
      filter: drop-shadow(0 0 8px rgba(0, 148, 210, 0.15));
      animation: logoGlow 2s ease-in-out infinite;
    }

    @keyframes logoFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }
    @keyframes logoGlow {
      0%, 100% { filter: drop-shadow(0 0 8px rgba(0, 148, 210, 0.15)); }
      50% { filter: drop-shadow(0 0 14px rgba(0, 148, 210, 0.3)); }
    }

    .logo-text {
      text-align: center;
      transition: all 0.3s ease;
    }
    .logo-text.compact {
      text-align: left;
    }
    .logo-text h1 {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 1px;
      transition: font-size 0.3s ease;
    }
    .logo-text.compact h1 {
      font-size: 20px;
    }
    .accent { color: var(--accent); }
    .tagline {
      font-size: 14px;
      color: var(--text-muted);
      margin-top: var(--sp-1);
      animation: fadeIn 0.5s ease;
    }

    /* Step content transitions */
    .step-content {
      animation: stepIn 0.3s ease-out;
    }
    @keyframes stepIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* Chain selector */
    .chain-select-group {
      margin-bottom: var(--sp-6);
    }

    .connection-status {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      margin-top: var(--sp-3);
      font-size: 12px;
      color: var(--text-muted);
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-disabled);
      flex-shrink: 0;
    }
    .status-dot.connected { background: var(--positive); }
    .status-dot.failed { background: var(--negative); }
    .status-dot.pulse { background: var(--accent); animation: pulse-dot 1.2s infinite; }
    @keyframes pulse-dot {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    .retry-btn {
      margin-left: auto;
      padding: 2px var(--sp-2);
      border: 1px solid var(--accent);
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--accent);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.5px;
      cursor: pointer;
    }

    /* Entry paths */
    .entry-paths {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
      margin-bottom: var(--sp-6);
    }
    .path-card {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      padding: var(--sp-4) var(--sp-5);
      background: var(--bg-raised);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      cursor: pointer;
      text-align: left;
      color: var(--text-muted);
      transition: background 150ms ease, border-color 150ms ease;
    }
    .path-card:hover:not(:disabled) {
      background: var(--bg-hover);
      border-color: var(--accent);
      color: var(--text-body);
    }
    .path-card:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .path-card strong {
      display: block;
      font-size: 14px;
      color: var(--text-bright);
      margin-bottom: 2px;
    }
    .path-card span {
      font-size: 12px;
    }

    .go-dashboard {
      display: block;
      width: 100%;
      padding: var(--sp-3);
      border: 1px solid var(--accent);
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--accent);
      font-family: var(--font-body);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      text-align: center;
      transition: background 150ms ease;
    }
    .go-dashboard:hover { background: var(--accent-muted); }

    /* Step header */
    .step-header {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      margin-bottom: var(--sp-2);
    }
    .step-header h2 { font-size: 22px; }
    .back-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: color 150ms ease, border-color 150ms ease;
    }
    .back-btn:hover { color: var(--accent); border-color: var(--accent); }
    .step-desc {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: var(--sp-6);
    }
    .step-desc strong { color: var(--text-body); }

    /* Forms */
    .form-group { margin-bottom: var(--sp-5); }
    label {
      display: block;
      font-size: 11px;
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
      background: var(--bg-raised);
      color: var(--text-bright);
      font-family: var(--font-data);
      font-size: 14px;
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }
    .form-input::placeholder { color: var(--text-disabled); }

    .key-input-row {
      display: flex;
      gap: var(--sp-2);
    }
    .key-input-row .form-input { flex: 1; }
    .toggle-vis {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      background: var(--bg-raised);
      color: var(--text-muted);
      cursor: pointer;
      transition: color 150ms ease;
    }
    .toggle-vis:hover { color: var(--accent); }

    .char-hint {
      display: block;
      text-align: right;
      font-size: 11px;
      color: var(--text-disabled);
      margin-top: var(--sp-1);
    }
    .field-error {
      display: block;
      font-size: 12px;
      color: var(--negative);
      margin-top: var(--sp-1);
    }

    /* Discovered accounts */
    .discovered {
      margin-bottom: var(--sp-5);
    }
    .discovered-item {
      font-family: var(--font-data);
      font-size: 13px;
      color: var(--text-bright);
      padding: var(--sp-2) var(--sp-3);
      background: var(--accent-muted);
      border-radius: var(--radius-sm);
      margin-top: var(--sp-2);
    }
    .searching {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: var(--sp-4);
    }

    /* Messages */
    .error-msg {
      font-size: 13px;
      color: var(--negative);
      background: rgba(240, 68, 56, 0.08);
      border: 1px solid rgba(240, 68, 56, 0.15);
      border-radius: var(--radius-sm);
      padding: var(--sp-3) var(--sp-4);
      margin-bottom: var(--sp-4);
    }
    .success-msg {
      font-size: 13px;
      color: var(--positive);
      background: rgba(45, 212, 168, 0.08);
      border: 1px solid rgba(45, 212, 168, 0.15);
      border-radius: var(--radius-sm);
      padding: var(--sp-3) var(--sp-4);
      margin-bottom: var(--sp-4);
    }

    /* Buttons */
    .btn-primary {
      display: block;
      width: 100%;
      padding: var(--sp-3);
      border: none;
      border-radius: var(--radius-sm);
      background: var(--accent);
      color: #fff;
      font-family: var(--font-body);
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 1px;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 150ms ease;
    }
    .btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-text {
      display: block;
      width: 100%;
      margin-top: var(--sp-3);
      border: none;
      background: none;
      color: var(--text-muted);
      font-size: 13px;
      cursor: pointer;
      text-align: center;
      text-decoration: underline;
    }
    .btn-text:hover { color: var(--accent); }

    /* Backup dropzone */
    .backup-dropzone {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-10);
      border: 2px dashed var(--border-subtle);
      border-radius: var(--radius-md);
      text-align: center;
      color: var(--text-muted);
    }
    .backup-dropzone p { font-size: 14px; color: var(--text-body); }
    .hint { font-size: 11px; color: var(--text-disabled); max-width: 300px; }
  `],
})
export class LandingComponent implements OnInit {
  step = signal<OnboardingStep>('home');
  connectionStatus = signal<ConnectionStatus>('idle');
  selectedChainIndex = signal(0);
  loading = signal(false);

  // Watch account
  accountName = signal('');
  error = signal('');
  success = signal('');

  // Import key
  importStep = signal(1);
  privateKey = signal('');
  showKey = signal(false);
  keySearching = signal(false);
  discoveredAccounts = signal<string[]>([]);
  passphrase = signal('');
  confirmPassphrase = signal('');
  importing = signal(false);

  selectedChain = computed(() => this.wallet.chains()[this.selectedChainIndex()]);

  constructor(
    private ipc: TauriIpcService,
    public wallet: WalletStateService,
    public network: NetworkService,
    private router: Router,
  ) {}

  async ngOnInit() {
    // Auto-connect to first chain if Tauri is available
    if (this.wallet.hasTauri() && this.wallet.chains().length > 0) {
      await this.connectToChain();
    }
  }

  async onChainSelect(index: number) {
    this.selectedChainIndex.set(index);
    this.connectionStatus.set('idle');
    if (this.wallet.hasTauri()) {
      await this.connectToChain();
    }
  }

  async connectToChain() {
    const chain = this.selectedChain();
    if (!chain) return;

    this.connectionStatus.set('connecting');
    try {
      await this.wallet.checkEndpoints(chain.id);
      this.connectionStatus.set('connected');
    } catch {
      this.connectionStatus.set('failed');
    }
  }

  // ── Watch Account ──

  async onAddWatch() {
    const name = this.accountName().trim().toLowerCase();
    if (!name) return;

    const chain = this.selectedChain();
    if (!chain) return;

    this.error.set('');
    this.success.set('');
    this.loading.set(true);

    try {
      if (this.wallet.hasTauri()) {
        // Real chain lookup
        const account = await this.wallet.addWatchAccount(name, chain.id);
        if (account) {
          this.success.set(`Added ${account.name} on ${chain.name}${account.isProducer ? ' (Block Producer #' + account.producerRank + ')' : ''}`);
          this.accountName.set('');
        } else {
          this.error.set(this.wallet.error() || `Account "${name}" not found on ${chain.name}`);
        }
      } else {
        // Mock mode — simulate adding
        this.success.set(`Added ${name} on ${chain.name} (mock mode)`);
        this.accountName.set('');
      }
    } catch (e: any) {
      this.error.set(e?.toString() ?? 'Failed to add account');
    } finally {
      this.loading.set(false);
    }
  }

  // ── Import Key ──

  async onKeyInput(value: string) {
    this.privateKey.set(value);
    this.discoveredAccounts.set([]);
    this.error.set('');

    // Auto-search when key looks complete (WIF is 51 chars)
    if (value.length >= 51 && this.wallet.hasTauri()) {
      this.keySearching.set(true);
      try {
        // TODO: Derive public key from WIF in Rust, then lookup accounts
        // For now this is a placeholder — needs the WIF decode command
        this.keySearching.set(false);
        this.error.set('Key import requires the Rust WIF decoder (coming soon)');
      } catch (e: any) {
        this.error.set(e?.toString() ?? 'Key verification failed');
        this.keySearching.set(false);
      }
    }
  }

  async onImportKey() {
    const chain = this.selectedChain();
    if (!chain) return;

    this.error.set('');
    this.importing.set(true);

    try {
      const result = await this.ipc.importPrivateKey(
        this.privateKey(),
        chain.id,
        this.passphrase(),
      );

      // Success — navigate to dashboard
      await this.wallet.unlock(this.passphrase());
      this.router.navigate(['/dashboard']);
    } catch (e: any) {
      this.error.set(e?.toString() ?? 'Import failed');
    } finally {
      this.importing.set(false);
    }
  }

  goToDashboard() {
    this.wallet.locked.set(false);
    this.router.navigate(['/dashboard']);
  }
}
