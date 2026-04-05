import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TauriIpcService, ChainConfig, DiscoveryProgress, AccountAuthority, AnchorWalletEntry, ImportSelection } from '../../core/services/tauri-ipc.service';
import { WalletStateService } from '../../core/services/wallet-state.service';
import { NetworkService } from '../../core/services/network.service';
import { ChainIconComponent } from '../../shared/chain-icon';

type WizardStep = 'chain' | 'action' | 'form';
type ActionType = 'watch' | 'import' | 'backup' | 'anchor' | 'ledger';
type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'failed';

interface ChainOption {
  index: number;
  name: string;
  symbol: string;
  color: string;
  testnet: boolean;
}

const CHAIN_COLORS: Record<string, string> = {
  'Vaulta':         '#4aa82e',
  'WAX':            '#f78b1d',
  'Telos':          '#4facfe',
  'Ultra':          '#6f3de0',
  'FIO':            '#765cd6',
  'Libre':          '#0053e6',
  'XPR':            '#7543e3',
  'Jungle Testnet': '#2d8b35',
  'WAX Testnet':    '#f78b1d',
  'Telos Testnet':  '#4facfe',
  'Ultra Testnet':  '#6f3de0',
  'FIO Testnet':    '#765cd6',
  'XPR Testnet':    '#7543e3',
};

const WIZARD_STEPS: { key: WizardStep; label: string }[] = [
  { key: 'chain',  label: 'Select Chain' },
  { key: 'action', label: 'Choose Action' },
  { key: 'form',   label: 'Setup' },
];

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [FormsModule, ChainIconComponent],
  template: `
    <div class="wizard">
      <!-- Background grain overlay -->
      <div class="bg-noise"></div>
      <div class="bg-glow" [style.--glow-color]="activeGlowColor()"></div>

      <div class="wizard-container">

        <!-- Top bar: logo + skip -->
        <div class="wizard-topbar">
          <div class="topbar-logo">
            <img src="assets/simpleos-logo.svg" alt="SimplEOS" class="topbar-icon" />
            <span class="topbar-name">Simpl<span class="topbar-accent">EOS</span></span>
          </div>
          @if (wallet.accounts().length > 0) {
            <button class="skip-btn" (click)="goToDashboard()">
              Dashboard
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          }
        </div>

        <!-- Step indicator rail -->
        <div class="step-rail">
          @for (s of wizardSteps; track s.key; let i = $index) {
            <div class="step-indicator"
                 [class.active]="stepIndex() >= i"
                 [class.current]="stepIndex() === i">
              <div class="step-dot">
                @if (stepIndex() > i) {
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                } @else {
                  <span class="step-num">{{ i + 1 }}</span>
                }
              </div>
              <span class="step-label">{{ s.label }}</span>
            </div>
            @if (i < wizardSteps.length - 1) {
              <div class="step-line" [class.filled]="stepIndex() > i"></div>
            }
          }
        </div>

        <!-- Main content area -->
        <div class="wizard-body" [attr.data-step]="wizardStep()">

          @switch (wizardStep()) {

            <!-- ═══ STEP 1: CHAIN SELECTION ═══ -->
            @case ('chain') {
              <div class="step-panel" style="animation: panelIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both">
                <div class="panel-header">
                  <h2>Choose your network</h2>
                  <p>Select the Antelope chain you want to connect to</p>
                </div>

                <div class="chain-grid">
                  @for (chain of mainnetChains(); track chain.index; let i = $index) {
                    <button class="chain-tile"
                            [class.selected]="selectedChainIndex() === chain.index"
                            [style.--tile-color]="chain.color"
                            [style.animation-delay]="(i * 50) + 'ms'"
                            (click)="onChainSelect(chain.index)">
                      <div class="tile-glow"></div>
                      <div class="tile-icon-wrap">
                        <chain-icon [chainName]="chain.name" [size]="32"></chain-icon>
                      </div>
                      <span class="tile-name">{{ chain.name }}</span>
                      <span class="tile-symbol">{{ chain.symbol }}</span>
                      @if (selectedChainIndex() === chain.index) {
                        <span class="tile-check">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </span>
                      }
                    </button>
                  }

                  <!-- Custom Chain tile -->
                  <button class="chain-tile custom-tile"
                          [class.selected]="isCustomChain()"
                          [style.--tile-color]="'#6b6f85'"
                          [style.animation-delay]="(chainOptions().length * 50) + 'ms'"
                          (click)="onCustomChain()">
                    <div class="tile-glow"></div>
                    <div class="tile-icon-wrap custom-icon-wrap">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    </div>
                    <span class="tile-name">Custom</span>
                    <span class="tile-symbol">RPC</span>
                  </button>
                </div>

                @if (testnetChains().length > 0) {
                  <div class="testnet-separator">
                    <span class="separator-line"></span>
                    <span class="separator-label">Testnets</span>
                    <span class="separator-line"></span>
                  </div>
                  <div class="chain-grid">
                    @for (chain of testnetChains(); track chain.index; let i = $index) {
                      <button class="chain-tile testnet-tile"
                              [class.selected]="selectedChainIndex() === chain.index"
                              [style.--tile-color]="chain.color"
                              [style.animation-delay]="(i * 50) + 'ms'"
                              (click)="onChainSelect(chain.index)">
                        <div class="tile-glow"></div>
                        <div class="tile-icon-wrap">
                          <chain-icon [chainName]="chain.name" [size]="32"></chain-icon>
                        </div>
                        <span class="tile-name">{{ chain.name }}</span>
                        <span class="tile-symbol">{{ chain.symbol }}</span>
                        <span class="testnet-badge">TEST</span>
                        @if (selectedChainIndex() === chain.index) {
                          <span class="tile-check">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </span>
                        }
                      </button>
                    }
                  </div>
                }

                <!-- Custom chain form (inline expand) -->
                @if (isCustomChain()) {
                  <div class="custom-chain-form" style="animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) both">
                    <div class="form-group">
                      <label>CHAIN NAME</label>
                      <input class="form-input" type="text"
                             placeholder="e.g. My Private Chain"
                             [value]="customChainName()"
                             (input)="customChainName.set($any($event.target).value)" />
                    </div>
                    <div class="form-row">
                      <div class="form-group" style="flex:1">
                        <label>TOKEN SYMBOL</label>
                        <input class="form-input" type="text"
                               placeholder="e.g. MYTKN"
                               [value]="customChainSymbol()"
                               (input)="customChainSymbol.set($any($event.target).value)" />
                      </div>
                      <div class="form-group" style="flex:1">
                        <label>CHAIN ID</label>
                        <input class="form-input" type="text"
                               placeholder="abc123..."
                               [value]="customChainId()"
                               (input)="customChainId.set($any($event.target).value)" />
                      </div>
                    </div>
                    <div class="form-group">
                      <label>API ENDPOINT</label>
                      <input class="form-input" type="text"
                             placeholder="https://api.example.com"
                             [value]="customEndpoint()"
                             (input)="customEndpoint.set($any($event.target).value)" />
                    </div>
                  </div>
                }

                <!-- Discovery progress -->
                <div class="discovery-panel" [class]="connectionStatus()">
                  @switch (connectionStatus()) {
                    @case ('connecting') {
                      <div class="discovery-status">
                        <span class="conn-dot pulse"></span>
                        <span class="discovery-message">{{ discoveryMessage() }}</span>
                      </div>
                      <div class="progress-bar-track">
                        <div class="progress-bar-fill" [style.width.%]="discoveryPercent()"></div>
                      </div>
                      <div class="discovery-stats">
                        @if (discoveryEndpointsFound() > 0) {
                          <span>{{ discoveryEndpointsFound() }} endpoints found</span>
                          <span class="stat-sep">/</span>
                        }
                        @if (discoveryHealthy() > 0) {
                          <span class="stat-healthy">{{ discoveryHealthy() }} healthy</span>
                        }
                      </div>
                    }
                    @case ('connected') {
                      <div class="discovery-status clickable" (click)="showEndpointList.set(!showEndpointList())">
                        <span class="conn-dot connected"></span>
                        <span>{{ selectedChain()?.name ?? customChainName() }} — {{ discoveryHealthy() || network.healthyCount() }} healthy endpoint{{ (discoveryHealthy() || network.healthyCount()) !== 1 ? 's' : '' }}</span>
                        <button class="refresh-btn" title="Re-discover endpoints" (click)="$event.stopPropagation(); connectToChain()">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                        </button>
                        <svg class="chevron" [class.open]="showEndpointList()" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                      @if (showEndpointList()) {
                        <div class="endpoint-list">
                          @for (ep of discoveredEndpointsSorted(); track ep.url) {
                            <div class="endpoint-row" [class.healthy]="ep.healthy" [class.failed]="!ep.healthy && ep.latency_ms !== 0">
                              <span class="ep-dot" [class.healthy]="ep.healthy"></span>
                              <span class="ep-url">{{ ep.url }}</span>
                              <span class="ep-producer">{{ ep.producer }}</span>
                              <span class="ep-type">{{ ep.endpoint_type === 'Hyperion' ? 'HYP' : 'API' }}</span>
                              @if (ep.healthy) {
                                <span class="ep-latency">{{ ep.latency_ms }}ms</span>
                              } @else {
                                <span class="ep-latency failed">--</span>
                              }
                            </div>
                          }
                        </div>
                      }
                    }
                    @case ('failed') {
                      <div class="discovery-status">
                        <span class="conn-dot failed"></span>
                        <span>Connection failed</span>
                        <button class="retry-link" (click)="connectToChain()">Retry</button>
                      </div>
                    }
                    @default {
                      <div class="discovery-status">
                        <span class="conn-dot"></span>
                        <span>Click Connect to discover endpoints</span>
                      </div>
                    }
                  }
                </div>

                <!-- Action buttons -->
                <div class="chain-actions">
                  @if (connectionStatus() === 'idle' || connectionStatus() === 'failed') {
                    <button class="btn-connect" (click)="connectToChain()">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                      Connect
                    </button>
                  }
                  <button class="btn-continue"
                          [disabled]="discoveryHealthy() === 0 && network.healthyCount() === 0"
                          (click)="goToAction()">
                    Continue
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              </div>
            }

            <!-- ═══ STEP 2: ACTION SELECTION ═══ -->
            @case ('action') {
              <div class="step-panel" style="animation: panelIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both">
                <div class="panel-header">
                  <button class="back-pill" (click)="wizardStep.set('chain')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    Back
                  </button>
                  <h2>How do you want to start?</h2>
                  <p>Connected to <strong>{{ selectedChain()?.name ?? customChainName() }}</strong></p>
                </div>

                <div class="action-cards">
                  <button class="action-card" (click)="selectAction('watch')">
                    <div class="action-icon watch-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </div>
                    <div class="action-text">
                      <strong>Watch Account</strong>
                      <span>Monitor balances, resources, and activity without importing keys</span>
                    </div>
                    <svg class="action-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>

                  <button class="action-card" (click)="selectAction('import')">
                    <div class="action-icon import-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                    </div>
                    <div class="action-text">
                      <strong>Import Key</strong>
                      <span>Import a private key (WIF) to sign transactions and manage your account</span>
                    </div>
                    <svg class="action-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>

                  <button class="action-card" (click)="selectAction('backup')">
                    <div class="action-icon backup-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </div>
                    <div class="action-text">
                      <strong>Restore Backup</strong>
                      <span>Import a SimplEOS backup file to restore your wallet</span>
                    </div>
                    <svg class="action-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>

                  <button class="action-card" (click)="selectAction('anchor')">
                    <div class="action-icon anchor-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>
                    </div>
                    <div class="action-text">
                      <strong>Import from Anchor</strong>
                      <span>Import accounts and keys from an Anchor wallet backup (.json)</span>
                    </div>
                    <svg class="action-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>

                  <button class="action-card" (click)="selectAction('ledger')">
                    <div class="action-icon ledger-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/><circle cx="12" cy="15" r="2"/></svg>
                    </div>
                    <div class="action-text">
                      <strong>Connect Ledger</strong>
                      <span>Import accounts from a Ledger hardware wallet via USB</span>
                    </div>
                    <svg class="action-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              </div>
            }

            <!-- ═══ STEP 3: FORM ═══ -->
            @case ('form') {
              <div class="step-panel" style="animation: panelIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both">
                <div class="panel-header">
                  <button class="back-pill" (click)="wizardStep.set('action')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    Back
                  </button>

                  @switch (selectedAction()) {
                    @case ('watch') {
                      <h2>Watch Account</h2>
                      <p>Enter an account name on <strong>{{ selectedChain()?.name ?? customChainName() }}</strong> to monitor</p>
                    }
                    @case ('import') {
                      <h2>Import Private Key</h2>
                      <p>Import your key to sign transactions on <strong>{{ selectedChain()?.name ?? customChainName() }}</strong></p>
                    }
                    @case ('backup') {
                      <h2>Restore Backup</h2>
                      <p>Upload a SimplEOS backup file (.bkp)</p>
                    }
                    @case ('anchor') {
                      <h2>Import from Anchor</h2>
                      <p>Select accounts and keys to import from your Anchor backup</p>
                    }
                    @case ('ledger') {
                      <h2>Connect Ledger</h2>
                      <p>Connect your Ledger device via USB and open the EOS app</p>
                    }
                  }
                </div>

                @switch (selectedAction()) {

                  <!-- ─── WATCH ─── -->
                  @case ('watch') {
                    <div class="form-card">
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
                        <div class="msg error-msg">{{ error() }}</div>
                      }
                      @if (success()) {
                        <div class="msg success-msg">{{ success() }}</div>
                      }

                      <button class="btn-primary" [disabled]="!accountName() || loading()"
                              (click)="onAddWatch()">
                        {{ loading() ? 'Looking up...' : 'Add Account' }}
                      </button>

                      @if (wallet.accounts().length > 0) {
                        <button class="btn-text" (click)="goToDashboard()">
                          Go to Dashboard ({{ wallet.accounts().length }} account{{ wallet.accounts().length !== 1 ? 's' : '' }})
                        </button>
                      }
                    </div>
                  }

                  <!-- ─── IMPORT ─── -->
                  @case ('import') {
                    <div class="form-card">
                      @switch (importStep()) {
                        @case (1) {
                          <p class="form-hint">Enter your private key (WIF format). We recommend importing your <strong>active</strong> key.</p>

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
                              @if (discoveredAuthorities().length > 0) {
                                @for (auth of discoveredAuthorities(); track auth.account_name + auth.permission_name) {
                                  <div class="discovered-item">
                                    <span class="acct-name">{{ auth.account_name }}</span>
                                    <span class="acct-perm">@{{ auth.permission_name }}</span>
                                  </div>
                                }
                              } @else {
                                @for (acct of discoveredAccounts(); track acct) {
                                  <div class="discovered-item">{{ acct }}</div>
                                }
                              }
                            </div>
                          }

                          @if (keySearching()) {
                            <div class="searching">
                              <span class="conn-dot pulse"></span>
                              Searching for accounts...
                            </div>
                          }

                          @if (error()) {
                            <div class="msg error-msg">{{ error() }}</div>
                          }

                          <button class="btn-primary"
                                  [disabled]="discoveredAccounts().length === 0 || keySearching()"
                                  (click)="onContinueToImport()">
                            Continue
                          </button>
                        }

                        @case (2) {
                          @if (wallet.vaultExists()) {
                            <!-- Vault already exists — just confirm passphrase -->
                            <p class="form-hint">Enter your wallet passphrase to add this key to your vault.</p>

                            <div class="form-group">
                              <label>PASSPHRASE</label>
                              <input type="password" class="form-input"
                                     placeholder="Enter passphrase"
                                     [value]="passphrase()"
                                     (input)="passphrase.set($any($event.target).value)"
                                     autofocus />
                            </div>
                          } @else {
                            <!-- First import — set new passphrase -->
                            <p class="form-hint">Set a passphrase to encrypt your private keys locally.</p>

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
                          }

                          @if (error()) {
                            <div class="msg error-msg">{{ error() }}</div>
                          }

                          @if (importing()) {
                            <div class="import-progress">
                              <div class="import-spinner"></div>
                              <span>{{ importStatus() }}</span>
                            </div>
                          }

                          <button class="btn-primary"
                                  [disabled]="importButtonDisabled()"
                                  (click)="onImportKey()">
                            {{ importing() ? 'Importing...' : 'Import Key' }}
                          </button>
                        }
                      }
                    </div>
                  }

                  <!-- ─── BACKUP ─── -->
                  @case ('backup') {
                    <div class="form-card">
                      <div class="backup-dropzone">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <p>Select a .bkp file</p>
                        <span class="hint">Backup import will be available once the key management backend is complete.</span>
                      </div>
                    </div>
                  }

                  <!-- ─── LEDGER IMPORT ─── -->
                  @case ('ledger') {
                    <div class="form-card">
                      @if (ledgerStep() === 'connect') {
                        <div class="ledger-connect">
                          <div class="ledger-icon-large">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/><circle cx="12" cy="15" r="2"/></svg>
                          </div>
                          <p>Connect your Ledger via USB and open the <strong>EOS app</strong></p>
                          <button class="btn-primary" (click)="onLedgerDetect()" [disabled]="ledgerBusy()">
                            {{ ledgerBusy() ? 'Detecting...' : 'DETECT LEDGER' }}
                          </button>
                          @if (error()) {
                            <p class="error-msg">{{ error() }}</p>
                          }
                        </div>
                      } @else if (ledgerStep() === 'keys') {
                        <p class="form-desc">Found {{ ledgerKeys().length }} key{{ ledgerKeys().length !== 1 ? 's' : '' }} on your Ledger:</p>
                        <div class="ledger-key-list">
                          @for (key of ledgerKeys(); track key.index) {
                            <div class="ledger-key-row">
                              <span class="ledger-slot">Slot {{ key.index }}</span>
                              <code class="ledger-pubkey">{{ key.public_key.slice(0, 16) }}...{{ key.public_key.slice(-8) }}</code>
                              @if (key.accounts.length > 0) {
                                <span class="ledger-accounts">{{ key.accounts.join(', ') }}</span>
                              } @else {
                                <span class="ledger-accounts muted">No accounts found</span>
                              }
                            </div>
                          }
                        </div>
                        <button class="btn-primary" (click)="onLedgerImport()" [disabled]="ledgerBusy()">
                          {{ ledgerBusy() ? 'Importing...' : 'IMPORT ACCOUNTS' }}
                        </button>
                        @if (error()) {
                          <p class="error-msg">{{ error() }}</p>
                        }
                      } @else {
                        <div class="success-msg">
                          <span class="success-check">&#10003;</span>
                          <p>Ledger accounts imported successfully!</p>
                          <button class="btn-primary" (click)="goToDashboard()">GO TO DASHBOARD</button>
                        </div>
                      }
                    </div>
                  }

                  <!-- ─── ANCHOR IMPORT ─── -->
                  @case ('anchor') {
                    <div class="form-card">
                      @switch (anchorStep()) {

                        <!-- Step 1: File picker -->
                        @case (1) {
                          <div class="backup-dropzone clickable" (click)="onPickAnchorFile()">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>
                            <p>Select Anchor backup file</p>
                            <span class="hint">Choose the .json file exported from Anchor wallet</span>
                          </div>
                          @if (anchorParsing()) {
                            <div class="searching">
                              <span class="conn-dot pulse"></span>
                              Parsing backup...
                            </div>
                          }
                          @if (error()) {
                            <div class="msg error-msg">{{ error() }}</div>
                          }
                        }

                        <!-- Step 2: Selection table -->
                        @case (2) {
                          <div class="anchor-summary">
                            <span>{{ anchorEntries().length }} wallets found</span>
                            <span class="stat-sep">/</span>
                            <span>{{ anchorHotCount() }} hot</span>
                            <span class="stat-sep">/</span>
                            <span>{{ anchorLedgerCount() }} ledger</span>
                          </div>

                          <div class="anchor-controls">
                            <label class="anchor-checkbox">
                              <input type="checkbox" [checked]="anchorShowTestnets()" (change)="anchorShowTestnets.set(!anchorShowTestnets())" />
                              Show testnets
                            </label>
                            <div class="anchor-batch-btns">
                              <button class="btn-text-sm" (click)="anchorSelectAll('full')">All Full</button>
                              <button class="btn-text-sm" (click)="anchorSelectAll('watch')">All Watch</button>
                              <button class="btn-text-sm" (click)="anchorSelectAll('skip')">None</button>
                            </div>
                          </div>

                          <div class="anchor-table">
                            @for (entry of anchorFilteredEntries(); track entry.pubkey + entry.chain_id + entry.authority) {
                              <div class="anchor-row" [class.ledger]="entry.mode === 'ledger'" [class.skipped]="anchorSelectionMap()[entry.pubkey + ':' + entry.chain_id] === 'skip'">
                                <div class="anchor-row-info">
                                  <span class="anchor-chain">{{ entry.chain_name }}</span>
                                  <span class="anchor-account">{{ entry.account }}<span class="anchor-perm">@{{ entry.authority }}</span></span>
                                  <span class="anchor-key" title="{{ entry.pubkey }}">{{ entry.pubkey.slice(0, 12) }}...</span>
                                </div>
                                <div class="anchor-row-action">
                                  @if (entry.mode === 'ledger') {
                                    <span class="anchor-badge ledger-badge">Ledger</span>
                                  } @else {
                                    <select class="anchor-select"
                                            [value]="anchorSelectionMap()[entry.pubkey + ':' + entry.chain_id]"
                                            (change)="onAnchorSelectionChange(entry, $any($event.target).value)">
                                      <option value="full">Full Import</option>
                                      <option value="watch">Watch Only</option>
                                      <option value="skip">Skip</option>
                                    </select>
                                  }
                                </div>
                              </div>
                            }
                          </div>

                          @if (error()) {
                            <div class="msg error-msg">{{ error() }}</div>
                          }

                          <button class="btn-primary"
                                  [disabled]="anchorSelectedCount() === 0"
                                  (click)="onAnchorContinue()">
                            Continue ({{ anchorSelectedCount() }} selected)
                          </button>
                        }

                        <!-- Step 3: Passwords -->
                        @case (3) {
                          @if (anchorNeedsPassword()) {
                            <div class="form-group">
                              <label>ANCHOR PASSWORD</label>
                              <input type="password" class="form-input"
                                     placeholder="Your Anchor wallet password"
                                     [value]="anchorPassword()"
                                     (input)="anchorPassword.set($any($event.target).value)"
                                     autofocus />
                              <span class="field-hint">Required to decrypt your private keys from the Anchor backup</span>
                            </div>
                          }

                          @if (wallet.vaultExists()) {
                            <div class="form-group">
                              <label>SIMPLEOS PASSPHRASE</label>
                              <input type="password" class="form-input"
                                     placeholder="Your SimplEOS wallet passphrase"
                                     [value]="passphrase()"
                                     (input)="passphrase.set($any($event.target).value)" />
                            </div>
                          } @else if (anchorNeedsPassword()) {
                            <div class="form-group">
                              <label>NEW SIMPLEOS PASSPHRASE</label>
                              <input type="password" class="form-input"
                                     placeholder="Minimum 8 characters"
                                     [value]="passphrase()"
                                     (input)="passphrase.set($any($event.target).value)" />
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
                          }

                          @if (error()) {
                            <div class="msg error-msg">{{ error() }}</div>
                          }

                          @if (importing()) {
                            <div class="import-progress">
                              <div class="import-spinner"></div>
                              <span>{{ importStatus() }}</span>
                            </div>
                          }

                          <button class="btn-primary"
                                  [disabled]="anchorImportDisabled()"
                                  (click)="onAnchorImport()">
                            {{ importing() ? 'Importing...' : 'Import' }}
                          </button>
                        }
                      }
                    </div>
                  }
                }

              </div>
            }
          }

        </div><!-- /wizard-body -->
      </div>
    </div>
  `,
  styleUrl: './landing.css',
})
export class LandingComponent implements OnInit, OnDestroy {
  readonly wizardSteps = WIZARD_STEPS;

  wizardStep = signal<WizardStep>('chain');
  selectedAction = signal<ActionType>('watch');
  connectionStatus = signal<ConnectionStatus>('idle');
  selectedChainIndex = signal(0);
  isCustomChain = signal(false);
  loading = signal(false);

  // Discovery progress
  discoveryMessage = signal('');
  discoveryPercent = signal(0);
  discoveryEndpointsFound = signal(0);
  discoveryHealthy = signal(0);
  showEndpointList = signal(false);
  discoveredEndpoints = signal<import('../../core/services/tauri-ipc.service').DiscoveredEndpoint[]>([]);
  discoveredEndpointsSorted = computed(() =>
    [...this.discoveredEndpoints()]
      .sort((a, b) => {
        // Healthy first, then by latency
        if (a.healthy !== b.healthy) return a.healthy ? -1 : 1;
        if (a.healthy && b.healthy) return a.latency_ms - b.latency_ms;
        return 0;
      })
  );
  private unlistenDiscovery: (() => void) | null = null;

  // Custom chain
  customChainName = signal('');
  customChainSymbol = signal('');
  customChainId = signal('');
  customEndpoint = signal('');

  // Ledger
  ledgerStep = signal<'connect' | 'keys' | 'done'>('connect');
  ledgerBusy = signal(false);
  ledgerKeys = signal<{ index: number; public_key: string; path: string; accounts: string[] }[]>([]);

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
  discoveredAuthorities = signal<AccountAuthority[]>([]);
  passphrase = signal('');
  confirmPassphrase = signal('');
  importing = signal(false);
  importStatus = signal('Encrypting key...');

  // Anchor import
  anchorStep = signal(1);
  anchorJson = signal('');
  anchorParsing = signal(false);
  anchorEntries = signal<AnchorWalletEntry[]>([]);
  anchorShowTestnets = signal(false);
  anchorPassword = signal('');
  anchorSelections = signal<Record<string, 'full' | 'watch' | 'skip'>>({});

  anchorSelectionMap = computed(() => this.anchorSelections());

  anchorHotCount = computed(() => this.anchorEntries().filter(e => e.mode === 'hot').length);
  anchorLedgerCount = computed(() => this.anchorEntries().filter(e => e.mode === 'ledger').length);

  anchorFilteredEntries = computed(() => {
    const show = this.anchorShowTestnets();
    return this.anchorEntries().filter(e => show || !e.is_testnet);
  });

  anchorSelectedCount = computed(() => {
    const sels = this.anchorSelections();
    return this.anchorFilteredEntries().filter(e => {
      const key = e.pubkey + ':' + e.chain_id;
      const mode = sels[key] ?? (e.mode === 'ledger' ? 'skip' : 'full');
      return mode !== 'skip';
    }).length;
  });

  anchorNeedsPassword = computed(() => {
    const sels = this.anchorSelections();
    return this.anchorFilteredEntries().some(e => {
      const key = e.pubkey + ':' + e.chain_id;
      return (sels[key] ?? 'full') === 'full' && e.mode === 'hot';
    });
  });

  anchorImportDisabled = computed(() => {
    if (this.importing()) return true;
    if (this.anchorNeedsPassword()) {
      if (!this.anchorPassword()) return true;
      if (!this.wallet.vaultExists()) {
        if (this.passphrase().length < 8) return true;
        if (this.passphrase() !== this.confirmPassphrase()) return true;
      } else {
        if (!this.passphrase()) return true;
      }
    }
    return this.anchorSelectedCount() === 0;
  });

  importButtonDisabled = computed(() => {
    if (this.importing()) return true;
    if (this.wallet.vaultExists()) {
      // Existing vault — just need a passphrase
      return this.passphrase().length < 1;
    }
    // New vault — need passphrase >= 8 chars + confirmation match
    return this.passphrase().length < 8 || this.passphrase() !== this.confirmPassphrase();
  });

  selectedChain = computed(() =>
    this.isCustomChain() ? null : this.wallet.chains()[this.selectedChainIndex()]
  );

  chainOptions = computed<ChainOption[]>(() =>
    this.wallet.chains().map((chain, index) => {
      const color = CHAIN_COLORS[chain.name] ?? '#6b6f85';
      return { index, name: chain.name, symbol: chain.symbol, color, testnet: !!chain.testnet };
    })
  );

  mainnetChains = computed(() => this.chainOptions().filter(c => !c.testnet));
  testnetChains = computed(() => this.chainOptions().filter(c => c.testnet));

  stepIndex = computed(() => {
    const map: Record<WizardStep, number> = { chain: 0, action: 1, form: 2 };
    return map[this.wizardStep()];
  });

  activeGlowColor = computed(() => {
    if (this.isCustomChain()) return 'rgba(107, 111, 133, 0.06)';
    const chain = this.chainOptions()[this.selectedChainIndex()];
    if (!chain) return 'rgba(0, 148, 210, 0.06)';
    // Convert hex to rgba with low opacity
    const hex = chain.color;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.07)`;
  });

  constructor(
    private ipc: TauriIpcService,
    public wallet: WalletStateService,
    public network: NetworkService,
    private router: Router,
  ) {}

  async ngOnInit() {
    if (this.wallet.hasTauri()) {
      // Listen for discovery progress events from Rust
      this.unlistenDiscovery = await this.ipc.onDiscoveryProgress((progress: DiscoveryProgress) => {
        this.discoveryMessage.set(progress.message);
        this.discoveryPercent.set(Math.round(progress.progress * 100));
        this.discoveryEndpointsFound.set(progress.endpoints_found);
        this.discoveryHealthy.set(progress.healthy_count);
      });

      // Load cache for the initially selected chain
      if (this.wallet.chains().length > 0) {
        await this.onChainSelect(0);
      }
    }
  }

  ngOnDestroy() {
    this.unlistenDiscovery?.();
  }

  async onChainSelect(index: number) {
    this.isCustomChain.set(false);
    this.selectedChainIndex.set(index);
    this.connectionStatus.set('idle');
    this.discoveryMessage.set('');
    this.discoveryPercent.set(0);
    this.discoveryEndpointsFound.set(0);
    this.discoveryHealthy.set(0);
    this.discoveredEndpoints.set([]);
    this.showEndpointList.set(false);

    // Try to load cached endpoints instantly
    if (this.wallet.hasTauri()) {
      const chain = this.wallet.chains()[index];
      if (!chain) return;
      try {
        const cached = await this.ipc.loadCachedEndpoints(chain.id);
        if (cached.endpoints.length > 0) {
          const healthy = cached.endpoints.filter(e => e.healthy);
          this.discoveredEndpoints.set(cached.endpoints);
          this.discoveryEndpointsFound.set(cached.endpoints.length);
          this.discoveryHealthy.set(healthy.length);

          if (healthy.length > 0) {
            // Register cached endpoints with the provider
            await this.wallet.checkEndpoints(chain.id);
            this.connectionStatus.set('connected');
            if (!cached.fresh) {
              this.discoveryMessage.set('Cache is stale — click Connect to refresh');
            }
          }
        }
      } catch {
        // No cache — that's fine
      }
    }
  }

  onCustomChain() {
    this.isCustomChain.set(true);
    this.connectionStatus.set('idle');
  }

  async connectToChain() {
    let chain = this.selectedChain();

    // Handle custom chain: build a dynamic ChainConfig and register it
    if (!chain && this.isCustomChain()) {
      const endpoint = this.customEndpoint().trim();
      const name = this.customChainName().trim() || 'Custom';
      const symbol = this.customChainSymbol().trim() || 'TOKEN';
      const chainId = this.customChainId().trim();

      if (!endpoint) return;

      // If no chain ID provided, fetch it from the endpoint
      let resolvedChainId = chainId;
      if (!resolvedChainId && this.wallet.hasTauri()) {
        try {
          this.connectionStatus.set('connecting');
          this.discoveryMessage.set('Fetching chain info...');
          // Register a temporary provider to fetch chain info
          await this.ipc.initChainProviders('__probe__', [{ url: endpoint }], []);
          const info = await this.ipc.getChainInfo('__probe__');
          resolvedChainId = info.chain_id;
        } catch {
          this.connectionStatus.set('failed');
          return;
        }
      }

      if (!resolvedChainId) return;

      // Create the dynamic chain config
      const customConfig: ChainConfig = {
        id: resolvedChainId,
        name,
        symbol,
        precision: 4,
        token_contract: 'eosio.token',
        extra_tokens: [],
        endpoints: [{ url: endpoint }],
        hyperion_apis: [],
        explorers: [],
        features: { send: true, vote: true, staking: true, rex: false, powerup: false, resource: true, dapps: false, history: false },
      };

      // Add to wallet chains and register providers
      this.wallet.chains.update(chains => {
        if (chains.some(c => c.id === resolvedChainId)) return chains;
        return [...chains, customConfig];
      });

      if (this.wallet.hasTauri()) {
        await this.ipc.initChainProviders(resolvedChainId, customConfig.endpoints, []);
      }

      // Select the newly added chain
      const idx = this.wallet.chains().findIndex(c => c.id === resolvedChainId);
      if (idx >= 0) {
        this.isCustomChain.set(false);
        this.selectedChainIndex.set(idx);
      }
      chain = this.wallet.chains().find(c => c.id === resolvedChainId) ?? null;
    }

    if (!chain || !this.wallet.hasTauri()) return;

    this.connectionStatus.set('connecting');
    this.discoveryMessage.set('Starting endpoint discovery...');
    this.discoveryPercent.set(0);

    try {
      const endpoints = await this.ipc.discoverEndpoints(chain.id);
      this.discoveredEndpoints.set(endpoints);
      const healthy = endpoints.filter(e => e.healthy).length;
      this.discoveryHealthy.set(healthy);

      if (healthy > 0) {
        this.connectionStatus.set('connected');
      } else {
        // Fallback: try the hardcoded endpoints
        this.discoveryMessage.set('No bp.json endpoints found, testing defaults...');
        await this.wallet.checkEndpoints(chain.id);
        if (this.network.healthyCount() > 0) {
          this.connectionStatus.set('connected');
        } else {
          this.connectionStatus.set('failed');
        }
      }
    } catch (e) {
      console.warn('Discovery failed, trying defaults:', e);
      // Fallback to simple endpoint check
      try {
        await this.wallet.checkEndpoints(chain.id);
        if (this.network.healthyCount() > 0) {
          this.connectionStatus.set('connected');
        } else {
          this.connectionStatus.set('failed');
        }
      } catch {
        this.connectionStatus.set('failed');
      }
    }
  }

  goToAction() {
    this.wizardStep.set('action');
  }

  selectAction(action: ActionType) {
    this.selectedAction.set(action);
    this.error.set('');
    this.success.set('');
    this.wizardStep.set('form');
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
        const account = await this.wallet.addWatchAccount(name, chain.id);
        if (account) {
          this.success.set(`Added ${account.name} on ${chain.name}${account.isProducer ? ' (Block Producer #' + account.producerRank + ')' : ''}`);
          this.accountName.set('');
        } else {
          this.error.set(this.wallet.error() || `Account "${name}" not found on ${chain.name}`);
        }
      } else {
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

  /** Continue from key entry to passphrase/import step.
   *  If the session is already unlocked, import directly — no passphrase needed. */
  async onContinueToImport() {
    if (this.wallet.vaultExists() && !this.wallet.locked()) {
      // Session already unlocked — import directly using the session key
      await this.onImportWithSession();
    } else {
      this.importStep.set(2);
    }
  }

  /** Import using the existing unlocked session — no passphrase prompt. */
  private async onImportWithSession() {
    const chain = this.selectedChain();
    if (!chain) return;

    this.error.set('');
    this.importing.set(true);
    this.importStatus.set('Encrypting key...');

    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const result = await this.ipc.importKeyWithSession(this.privateKey(), chain.id);
      console.log(`[import] Key imported with session: ${result.public_key}`);
      this.importStatus.set('Loading accounts...');

      const accounts = this.discoveredAccounts();
      for (const name of accounts) {
        this.importStatus.set(`Loading ${name}...`);
        try {
          const info = await this.ipc.getAccount(chain.id, name);
          const extraBalances = await this.wallet.fetchExtraTokenBalances(chain, name);
          this.wallet.accounts.update(list => [
            ...list,
            { name, chainId: chain.id, chainName: chain.name, mode: 'full' as const, info, extraBalances },
          ]);
        } catch (e) {
          console.warn(`[import] Failed to load account ${name}:`, e);
        }
      }

      this.importStatus.set('Done!');
      await this.wallet.saveAccounts();
      this.router.navigate(['/dashboard']);
    } catch (e: any) {
      this.error.set(e?.toString() ?? 'Import failed');
      this.importStep.set(2); // Fall back to passphrase entry
    } finally {
      this.importing.set(false);
    }
  }

  private keyInputTimeout: any;

  async onKeyInput(value: string) {
    this.privateKey.set(value);
    this.discoveredAccounts.set([]);
    this.error.set('');

    // Debounce — wait 300ms after user stops typing
    clearTimeout(this.keyInputTimeout);

    // WIF keys are 51 chars (uncompressed) or 52 (compressed)
    if (value.length >= 51 && this.wallet.hasTauri()) {
      this.keyInputTimeout = setTimeout(() => this.lookupKeyAccounts(value), 300);
    }
  }

  private async lookupKeyAccounts(wif: string) {
    const chain = this.selectedChain();
    if (!chain) return;

    this.keySearching.set(true);
    this.error.set('');

    try {
      // Step 1: Validate WIF and get public key (no passphrase needed yet)
      // We do a temporary import to get the public key, but we use generate_key_pair
      // endpoint just to validate. Actually, let's use the import with a temp passphrase
      // and then remove it. Better: add a validate_wif command.
      // For now, import with a dummy passphrase to get the public key, then remove.
      // Actually the simplest approach: call import, get pub key, lookup accounts, remove key.
      // But that's messy. Let's just use lookup_key_accounts with the WIF-derived pub key.

      // We need a "derive public key from WIF" command. Let's add it to IPC.
      // For now, we can try to lookup accounts — if the WIF is invalid, import will fail later.
      // The backend already has public_key_from_wif in signing.rs.

      // Use generate_key_pair as a no-op test... actually let's just call import
      // and check for errors. If valid, we get the public key.
      // Better approach: add a validate_wif IPC command.

      // Simplest correct approach: try to discover accounts via public key.
      // We need the public key from the WIF. Let's call a new command.
      const pubKey = await this.ipc.derivePublicKey(wif);

      // Step 2: Lookup accounts associated with this key on the selected chain
      const result = await this.ipc.lookupKeyAccounts(chain.id, pubKey);

      if (result.account_names.length > 0) {
        this.discoveredAccounts.set(result.account_names);
        this.discoveredAuthorities.set(result.authorities ?? []);
      } else {
        this.error.set('No accounts found for this key on ' + chain.name);
      }
    } catch (e: any) {
      const msg = e?.toString() ?? '';
      if (msg.includes('WIF') || msg.includes('checksum') || msg.includes('Invalid')) {
        this.error.set('Invalid private key format');
      } else {
        this.error.set('Could not verify key: ' + msg);
      }
    } finally {
      this.keySearching.set(false);
    }
  }

  async onImportKey() {
    const chain = this.selectedChain();
    if (!chain) return;

    this.error.set('');
    this.importing.set(true);
    this.importStatus.set('Encrypting key...');

    // Yield to let the UI update before the heavy PBKDF2 call
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const result = await this.ipc.importPrivateKey(
        this.privateKey(),
        chain.id,
        this.passphrase(),
      );

      console.log(`[import] Key imported: ${result.public_key}`);
      this.importStatus.set('Loading accounts...');

      this.wallet.vaultExists.set(true);
      this.wallet.locked.set(false);

      const accounts = this.discoveredAccounts();
      for (const name of accounts) {
        this.importStatus.set(`Loading ${name}...`);
        try {
          const info = await this.ipc.getAccount(chain.id, name);
          this.wallet.accounts.update(list => [
            ...list,
            {
              name,
              chainId: chain.id,
              chainName: chain.name,
              mode: 'full' as const,
              info,
            },
          ]);
        } catch (e) {
          console.warn(`[import] Failed to load account ${name}:`, e);
        }
      }

      this.importStatus.set('Done!');
      await this.wallet.saveAccounts();
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

  // ── Ledger Import ──

  async onLedgerDetect() {
    this.ledgerBusy.set(true);
    this.error.set('');
    try {
      // Check device is connected and EOS app is open
      const config = await this.ipc.ledgerGetAppConfig();
      if (!config) {
        this.error.set('Could not connect to Ledger. Make sure the EOS app is open.');
        return;
      }

      // Discover keys (scan slots 0-4)
      const rawKeys = await this.ipc.ledgerDiscoverKeys(5);
      const chain = this.selectedChain();
      if (!chain) return;

      // For each key, look up accounts on the selected chain
      const keysWithAccounts: typeof this.ledgerKeys extends () => infer T ? T : never = [];
      for (const key of rawKeys) {
        let accounts: string[] = [];
        try {
          const result = await this.ipc.lookupKeyAccounts(chain.id, key.public_key);
          accounts = result.account_names ?? [];
        } catch { /* no accounts for this key */ }
        keysWithAccounts.push({
          index: key.index,
          public_key: key.public_key,
          path: key.path,
          accounts,
        });
      }

      this.ledgerKeys.set(keysWithAccounts);
      this.ledgerStep.set('keys');
    } catch (e: any) {
      this.error.set(e?.toString() ?? 'Failed to connect to Ledger');
    } finally {
      this.ledgerBusy.set(false);
    }
  }

  async onLedgerImport() {
    this.ledgerBusy.set(true);
    this.error.set('');
    const chain = this.selectedChain();
    if (!chain) return;

    try {
      for (const key of this.ledgerKeys()) {
        for (const accountName of key.accounts) {
          // Check if already imported
          if (this.wallet.accounts().some(a => a.name === accountName && a.chainId === chain.id)) continue;

          const info = await this.ipc.getAccount(chain.id, accountName);
          this.wallet.accounts.update(list => [...list, {
            name: accountName,
            chainId: chain.id,
            chainName: chain.name,
            mode: 'full' as const,
            info,
            ledgerIndex: key.index,
          }]);
        }
      }

      await this.wallet.saveAccounts();
      this.ledgerStep.set('done');
    } catch (e: any) {
      this.error.set(e?.toString() ?? 'Import failed');
    } finally {
      this.ledgerBusy.set(false);
    }
  }

  // ── Anchor Import ──

  async onPickAnchorFile() {
    this.error.set('');
    try {
      // Use native file input to pick JSON
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        this.anchorParsing.set(true);
        try {
          const text = await file.text();
          this.anchorJson.set(text);
          const parsed = await this.ipc.parseAnchorBackup(text);
          this.anchorEntries.set(parsed.entries);

          // Default selections: hot→full, ledger→skip
          const sels: Record<string, 'full' | 'watch' | 'skip'> = {};
          for (const e of parsed.entries) {
            const key = e.pubkey + ':' + e.chain_id;
            sels[key] = e.mode === 'ledger' ? 'skip' : 'full';
          }
          this.anchorSelections.set(sels);
          this.anchorStep.set(2);
        } catch (e: any) {
          this.error.set('Failed to parse backup: ' + (e?.toString() ?? 'Unknown error'));
        } finally {
          this.anchorParsing.set(false);
        }
      };
      input.click();
    } catch (e: any) {
      this.error.set(e?.toString() ?? 'Failed to open file');
    }
  }

  onAnchorSelectionChange(entry: AnchorWalletEntry, mode: string) {
    const key = entry.pubkey + ':' + entry.chain_id;
    this.anchorSelections.update(s => ({ ...s, [key]: mode as 'full' | 'watch' | 'skip' }));
  }

  anchorSelectAll(mode: 'full' | 'watch' | 'skip') {
    const sels: Record<string, 'full' | 'watch' | 'skip'> = {};
    for (const e of this.anchorFilteredEntries()) {
      const key = e.pubkey + ':' + e.chain_id;
      sels[key] = e.mode === 'ledger' ? 'skip' : mode;
    }
    this.anchorSelections.set(sels);
  }

  onAnchorContinue() {
    this.error.set('');
    if (this.anchorNeedsPassword() || !this.wallet.vaultExists()) {
      this.anchorStep.set(3);
    } else {
      // All watch-only, no passwords needed
      this.onAnchorImport();
    }
  }

  async onAnchorImport() {
    this.error.set('');
    this.importing.set(true);
    this.importStatus.set('Verifying password...');

    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      // Verify Anchor password first if needed
      if (this.anchorNeedsPassword()) {
        const valid = await this.ipc.verifyAnchorPassword(this.anchorJson(), this.anchorPassword());
        if (!valid) {
          this.error.set('Incorrect Anchor password');
          this.importing.set(false);
          return;
        }
      }

      this.importStatus.set('Importing keys...');

      // Build selections array
      const sels = this.anchorSelections();
      const selections: ImportSelection[] = [];
      for (const entry of this.anchorFilteredEntries()) {
        const key = entry.pubkey + ':' + entry.chain_id;
        const mode = sels[key] ?? 'skip';
        if (mode === 'skip') continue;
        selections.push({
          account: entry.account,
          authority: entry.authority,
          chain_id: entry.chain_id,
          pubkey: entry.pubkey,
          import_mode: mode as 'full' | 'watch',
        });
      }

      const result = await this.ipc.importAnchorEntries(
        this.anchorJson(),
        this.anchorPassword(),
        this.passphrase(),
        selections,
      );

      this.importStatus.set('Loading accounts...');

      // Update vault state
      if (result.imported_full > 0) {
        this.wallet.vaultExists.set(true);
        this.wallet.locked.set(false);
      }

      // Load account info for each imported entry
      for (const sel of selections) {
        this.importStatus.set(`Loading ${sel.account}...`);
        try {
          // Initialize chain provider if not yet done
          const chain = this.wallet.chains().find(c => c.id === sel.chain_id);
          if (chain) {
            await this.wallet.checkEndpoints(sel.chain_id);
            const info = await this.ipc.getAccount(sel.chain_id, sel.account);
            this.wallet.accounts.update(list => {
              // Avoid duplicates
              if (list.some(a => a.name === sel.account && a.chainId === sel.chain_id)) return list;
              // Only set 'full' if keys were actually imported (no errors for this entry)
              const keyImported = sel.import_mode === 'full' && result.imported_full > 0;
              return [...list, {
                name: sel.account,
                chainId: sel.chain_id,
                chainName: chain.name,
                mode: keyImported ? 'full' as const : 'watch' as const,
                info,
              }];
            });
          }
        } catch (e) {
          console.warn(`[anchor-import] Failed to load ${sel.account}:`, e);
        }
      }

      await this.wallet.saveAccounts();

      const summary = [];
      if (result.imported_full > 0) summary.push(`${result.imported_full} full`);
      if (result.imported_watch > 0) summary.push(`${result.imported_watch} watch-only`);
      if (result.errors.length > 0) summary.push(`${result.errors.length} errors`);
      this.importStatus.set(`Done! Imported ${summary.join(', ')}`);

      if (result.errors.length > 0) {
        this.error.set(result.errors.join('\n'));
        // Don't auto-navigate if there were errors
      } else {
        // Navigate to dashboard after brief delay only if no errors
        setTimeout(() => this.router.navigate(['/dashboard']), 1000);
      }
    } catch (e: any) {
      this.error.set(e?.toString() ?? 'Import failed');
    } finally {
      this.importing.set(false);
    }
  }
}
