import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TauriIpcService } from '../../core/services/tauri-ipc.service';
import { WalletStateService } from '../../core/services/wallet-state.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="landing">
      <div class="landing-card">
        <h1>Welcome to SimplEOS</h1>
        <p>Import your private key to get started</p>

        <form (ngSubmit)="onImport()">
          <label>Chain</label>
          <select [value]="selectedChainIndex()" (change)="selectedChainIndex.set(+$any($event.target).value)">
            @for (chain of wallet.chains(); track chain.id; let i = $index) {
              <option [value]="i">{{ chain.name }} ({{ chain.symbol }})</option>
            }
          </select>

          <label>Private Key (WIF)</label>
          <input
            type="password"
            [value]="privateKey()"
            (input)="privateKey.set($any($event.target).value)"
            placeholder="5K..."
          />

          <label>Passphrase</label>
          <input
            type="password"
            [value]="passphrase()"
            (input)="passphrase.set($any($event.target).value)"
            placeholder="Create a passphrase"
          />

          <label>Confirm Passphrase</label>
          <input
            type="password"
            [value]="confirmPassphrase()"
            (input)="confirmPassphrase.set($any($event.target).value)"
            placeholder="Confirm passphrase"
          />

          @if (error()) {
            <p class="error">{{ error() }}</p>
          }

          @if (success()) {
            <p class="success">{{ success() }}</p>
          }

          <button type="submit" [disabled]="!canSubmit() || importing()">
            {{ importing() ? 'Importing...' : 'Import Key' }}
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .landing {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: var(--bg-primary);
    }
    .landing-card {
      padding: 3rem;
      border-radius: 12px;
      background: var(--bg-surface);
      box-shadow: 0 4px 24px rgba(0,0,0,0.1);
      min-width: 420px;
      max-width: 480px;
    }
    h1 { margin-bottom: 0.5rem; }
    p { color: var(--text-secondary); }
    label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      margin-top: 1rem;
      margin-bottom: 0.25rem;
    }
    input, select {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 1rem;
      box-sizing: border-box;
    }
    button {
      width: 100%;
      margin-top: 1.5rem;
      padding: 0.75rem;
      border: none;
      border-radius: 8px;
      background: var(--accent);
      color: white;
      font-size: 1rem;
      cursor: pointer;
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .error { color: var(--error); font-size: 0.875rem; margin-top: 0.5rem; }
    .success { color: var(--success); font-size: 0.875rem; margin-top: 0.5rem; }
  `],
})
export class LandingComponent {
  privateKey = signal('');
  passphrase = signal('');
  confirmPassphrase = signal('');
  selectedChainIndex = signal(0);
  error = signal('');
  success = signal('');
  importing = signal(false);

  constructor(
    private ipc: TauriIpcService,
    public wallet: WalletStateService,
    private router: Router,
  ) {}

  canSubmit(): boolean {
    return (
      this.privateKey().length > 0 &&
      this.passphrase().length >= 8 &&
      this.passphrase() === this.confirmPassphrase()
    );
  }

  async onImport() {
    this.error.set('');
    this.success.set('');
    this.importing.set(true);

    try {
      const chain = this.wallet.chains()[this.selectedChainIndex()];
      if (!chain) {
        this.error.set('No chain selected');
        return;
      }

      const result = await this.ipc.importPrivateKey(
        this.privateKey(),
        chain.id,
        this.passphrase(),
      );

      this.success.set(`Imported key: ${result.public_key.substring(0, 12)}...`);
      await this.wallet.selectChain(this.selectedChainIndex());
      await this.wallet.unlock(this.passphrase());

      setTimeout(() => this.router.navigate(['/dashboard']), 1500);
    } catch (e: any) {
      this.error.set(e?.toString() ?? 'Import failed');
    } finally {
      this.importing.set(false);
    }
  }
}
