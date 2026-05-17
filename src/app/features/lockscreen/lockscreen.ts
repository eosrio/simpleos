import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WalletStateService } from '../../core/services/wallet-state.service';
import { TauriIpcService } from '../../core/services/tauri-ipc.service';
import { LoaderService } from '../../core/services/loader.service';
import { WindowControlsComponent } from '../../shared/window-controls';

@Component({
  selector: 'app-lockscreen',
  standalone: true,
  imports: [FormsModule, WindowControlsComponent],
  template: `
    <div class="lockscreen">
      <div class="lock-titlebar" data-tauri-drag-region>
        <div class="lock-titlebar-fill" data-tauri-drag-region></div>
        <app-window-controls />
      </div>
      <div class="lockscreen-inner">
        <!-- Animated logo -->
        <div class="logo-container"
             (mouseenter)="logoHover.set(true)"
             (mouseleave)="logoHover.set(false)">
          <div class="logo-glow" [class.active]="logoHover()"></div>
          <img src="assets/simpleos-logo.svg"
               alt="SimplEOS"
               class="logo"
               [class.hover]="logoHover()" />
        </div>

        <h1 class="brand">Simpl<span class="brand-accent">EOS</span></h1>

        @if ((pinAvailable() || biometricConfigured()) && !showPassphrase()) {
          <p class="subtitle">{{ biometricConfigured() ? 'Use Windows Hello to unlock' : 'Enter your PIN to unlock' }}</p>
          @if (biometricConfigured()) {
            <button type="button" class="btn-primary unlock-action" (click)="onBiometricUnlock()">
              Unlock with Windows Hello
            </button>
          }
          @if (pinAvailable()) {
            <form class="unlock-form" (ngSubmit)="onPinUnlock()">
              <div class="input-group">
                <input
                  type="password"
                  inputmode="numeric"
                  maxlength="6"
                  [value]="pin()"
                  (input)="pin.set($any($event.target).value)"
                  placeholder="PIN"
                  autofocus
                  autocomplete="off"
                />
              </div>
              @if (error()) {
                <p class="error-msg">{{ error() }}</p>
              }
              <button type="submit" class="btn-primary" [disabled]="!pin()">
                Unlock
              </button>
            </form>
          } @else if (error()) {
            <p class="error-msg">{{ error() }}</p>
          }
          <a class="import-link" (click)="showPassphrase.set(true)">Use passphrase instead</a>
        } @else {
          <p class="subtitle">Enter your passphrase to unlock</p>
          <form class="unlock-form" (ngSubmit)="onUnlock()">
            <div class="input-group">
              <input
                type="password"
                [value]="passphrase()"
                (input)="passphrase.set($any($event.target).value)"
                placeholder="Passphrase"
                autofocus
                autocomplete="current-password"
              />
            </div>
            @if (error()) {
              <p class="error-msg">{{ error() }}</p>
            }
            <button type="submit" class="btn-primary" [disabled]="!passphrase()">
              Unlock
            </button>
          </form>
          @if (pinAvailable() || biometricConfigured()) {
            <a class="import-link" (click)="showPassphrase.set(false)">Use quick unlock instead</a>
          }
        }

        <a class="import-link" (click)="goToImport()">Import a key</a>

        @if (showResetConfirm()) {
          <div class="reset-confirm">
            <p>This will delete all keys and wallet data. This cannot be undone.</p>
            <div class="reset-actions">
              <button class="btn-cancel" (click)="showResetConfirm.set(false)">Cancel</button>
              <button class="btn-danger" (click)="onReset()">Erase Everything</button>
            </div>
          </div>
        } @else {
          <a class="reset-link" (click)="showResetConfirm.set(true)">Reset wallet</a>
        }

        <span class="version">v2.0.0-alpha</span>
      </div>
    </div>
  `,
  styles: [`
    .lockscreen {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: var(--bg-deep);
      overflow: hidden;
    }

    /* Custom titlebar — transparent overlay so it doesn't interrupt the
       centered unlock layout. Drag region covers the full width minus
       window controls. */
    .lock-titlebar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 36px;
      display: flex;
      align-items: stretch;
      z-index: 10;
      -webkit-app-region: drag;
    }
    .lock-titlebar-fill {
      flex: 1 1 auto;
    }
    :host-context(html.os-mac) .lock-titlebar {
      padding-left: 84px;
    }

    .lockscreen-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-5);
      animation: fadeInUp 0.7s ease-out;
    }

    /* Logo */
    .logo-container {
      position: relative;
      width: 120px;
      height: 120px;
      cursor: default;
    }

    .logo {
      width: 100%;
      height: 100%;
      object-fit: contain;
      transition: transform 0.4s ease, filter 0.4s ease;
      filter: drop-shadow(0 0 12px rgba(0, 148, 210, 0.15));
      animation: logoEntrance 1s ease-out;
    }

    .logo.hover {
      transform: translateY(-4px) scale(1.05);
      filter: drop-shadow(0 0 24px rgba(0, 148, 210, 0.35));
    }

    .logo-glow {
      position: absolute;
      inset: -20px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(0, 148, 210, 0.08) 0%, transparent 70%);
      transition: opacity 0.4s ease;
      opacity: 0;
      pointer-events: none;
    }

    .logo-glow.active {
      opacity: 1;
    }

    /* Brand text */
    .brand {
      font-family: var(--font-body);
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 1px;
      color: var(--text-bright);
    }

    .brand-accent {
      color: var(--accent);
    }

    .subtitle {
      font-size: 14px;
      color: var(--text-muted);
      margin-bottom: var(--sp-2);
    }

    /* Form */
    .unlock-form {
      width: 320px;
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }

    .input-group {
      position: relative;
    }

    input {
      width: 100%;
      padding: var(--sp-3) var(--sp-4);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      background: var(--bg-raised);
      color: var(--text-bright);
      font-family: var(--font-body);
      font-size: 14px;
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }

    input::placeholder {
      color: var(--text-disabled);
    }

    .error-msg {
      font-size: 13px;
      color: var(--negative);
      text-align: center;
    }

    .btn-primary {
      width: 100%;
      padding: var(--sp-3);
      border: none;
      border-radius: var(--radius-sm);
      background: var(--accent);
      color: #ffffff;
      font-family: var(--font-body);
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 1px;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 150ms ease;
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--accent-hover);
    }

    .unlock-action {
      width: 320px;
    }

    .btn-primary:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .import-link {
      font-size: 13px;
      color: var(--accent);
      cursor: pointer;
      transition: color 150ms ease;
      text-decoration: none;
    }

    .import-link:hover {
      color: var(--accent-hover);
    }

    .reset-link {
      font-size: 12px;
      color: var(--text-disabled);
      cursor: pointer;
      transition: color 150ms ease;
      text-decoration: none;
    }
    .reset-link:hover { color: var(--negative); }

    .reset-confirm {
      width: 320px;
      padding: var(--sp-4);
      background: var(--bg-raised);
      border: 1px solid var(--negative);
      border-radius: var(--radius-md);
      text-align: center;
    }
    .reset-confirm p {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: var(--sp-4);
    }
    .reset-actions {
      display: flex;
      gap: var(--sp-3);
    }
    .btn-cancel, .btn-danger {
      flex: 1;
      padding: var(--sp-2) var(--sp-3);
      border-radius: var(--radius-sm);
      font-family: var(--font-body);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid var(--border-subtle);
    }
    .btn-cancel {
      background: var(--bg-base);
      color: var(--text-muted);
    }
    .btn-danger {
      background: var(--negative);
      color: #fff;
      border-color: var(--negative);
    }

    .version {
      font-size: 11px;
      color: var(--text-disabled);
      margin-top: var(--sp-6);
    }

    /* Animations */
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(16px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes logoEntrance {
      0% {
        opacity: 0;
        transform: scale(0.8) translateY(-12px);
        filter: drop-shadow(0 0 0 transparent);
      }
      60% {
        opacity: 1;
        transform: scale(1.03) translateY(0);
      }
      100% {
        transform: scale(1) translateY(0);
        filter: drop-shadow(0 0 12px rgba(0, 148, 210, 0.15));
      }
    }
  `],
})
export class LockscreenComponent {
  passphrase = signal('');
  pin = signal('');
  error = signal('');
  logoHover = signal(false);
  showResetConfirm = signal(false);
  pinAvailable = signal(false);
  biometricConfigured = signal(false);
  showPassphrase = signal(false);

  constructor(
    private wallet: WalletStateService,
    private router: Router,
    private ipc: TauriIpcService,
    private loader: LoaderService,
  ) {
    this.checkPin();
    this.checkBiometric();
  }

  private async checkPin() {
    try {
      this.pinAvailable.set(await this.ipc.hasPin());
    } catch {
      this.pinAvailable.set(false);
    }
  }

  private async checkBiometric() {
    try {
      const status = await this.ipc.biometricStatus();
      this.biometricConfigured.set(status.available && status.configured);
    } catch {
      this.biometricConfigured.set(false);
    }
  }

  async onUnlock() {
    this.error.set('');
    this.loader.show('Unlocking wallet', 'Decrypting your vault');
    // Let the overlay paint before we start the CPU-heavy decrypt.
    await this.loader.yieldToPaint();
    try {
      const success = await this.wallet.unlock(this.passphrase());
      if (success) {
        this.loader.update('Loading accounts', 'Fetching chain data');
        this.router.navigate(['/dashboard']);
      } else {
        this.error.set('Invalid passphrase');
      }
    } catch {
      this.error.set('Failed to unlock wallet');
    } finally {
      this.loader.hide();
    }
  }

  async onPinUnlock() {
    this.error.set('');
    this.loader.show('Unlocking wallet', 'Deriving key from PIN');
    // Let the overlay paint before we hand off to the 70-round Rijndael
    // key derivation — otherwise the user sees a frozen UI.
    await this.loader.yieldToPaint();
    try {
      const success = await this.ipc.unlockWithPin(this.pin());
      if (success) {
        this.loader.update('Decrypting vault', 'Verifying stored keys');
        this.wallet.locked.set(false);
        // Restore accounts
        this.loader.update('Restoring accounts', 'Loading cached data');
        const restored = await this.wallet.restoreAccounts();
        if (!restored) {
          this.loader.update('Fetching accounts', 'Connecting to blockchain');
          await this.wallet.loadAccounts();
        } else {
          this.loader.update('Syncing balances', 'Refreshing chain data');
          this.wallet.refreshAllAccounts();
        }
        this.router.navigate(['/dashboard']);
      } else {
        this.error.set('Invalid PIN');
      }
    } catch {
      this.error.set('Invalid PIN');
    } finally {
      this.loader.hide();
    }
  }

  async onBiometricUnlock() {
    this.error.set('');
    this.loader.show('Unlocking wallet', 'Waiting for Windows Hello');
    await this.loader.yieldToPaint();
    try {
      const success = await this.ipc.unlockWithBiometric();
      if (success) {
        this.loader.update('Decrypting vault', 'Verifying stored keys');
        this.wallet.locked.set(false);
        this.loader.update('Restoring accounts', 'Loading cached data');
        const restored = await this.wallet.restoreAccounts();
        if (!restored) {
          this.loader.update('Fetching accounts', 'Connecting to blockchain');
          await this.wallet.loadAccounts();
        } else {
          this.loader.update('Syncing balances', 'Refreshing chain data');
          this.wallet.refreshAllAccounts();
        }
        this.router.navigate(['/dashboard']);
      } else {
        this.error.set('Windows Hello unlock failed');
      }
    } catch (e: any) {
      this.error.set(e?.toString()?.includes('canceled') ? 'Windows Hello was canceled' : 'Windows Hello unlock failed');
    } finally {
      this.loader.hide();
    }
  }

  goToImport() {
    this.router.navigate(['/landing']);
  }

  async onReset() {
    try {
      await this.ipc.resetWallet();
      this.wallet.vaultExists.set(false);
      this.wallet.locked.set(false);
      this.wallet.accounts.set([]);
      this.router.navigate(['/landing']);
    } catch (e) {
      this.error.set('Reset failed: ' + e);
    }
  }
}
