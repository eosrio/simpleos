import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WalletStateService } from '../../core/services/wallet-state.service';

@Component({
  selector: 'app-lockscreen',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="lockscreen">
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

        <a class="import-link" (click)="goToImport()">Import a key</a>

        <span class="version">v2.0.0-alpha</span>
      </div>
    </div>
  `,
  styles: [`
    .lockscreen {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: var(--bg-deep);
      overflow: hidden;
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
  error = signal('');
  logoHover = signal(false);

  constructor(
    private wallet: WalletStateService,
    private router: Router,
  ) {}

  async onUnlock() {
    this.error.set('');
    try {
      const success = await this.wallet.unlock(this.passphrase());
      if (success) {
        this.router.navigate(['/dashboard']);
      } else {
        this.error.set('Invalid passphrase');
      }
    } catch {
      this.error.set('Failed to unlock wallet');
    }
  }

  goToImport() {
    this.router.navigate(['/landing']);
  }
}
