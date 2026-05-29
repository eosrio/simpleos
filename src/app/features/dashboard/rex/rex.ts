import { Component, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WalletStateService } from '../../../core/services/wallet-state.service';
import { ChainFeaturesService } from '../../../core/services/chain-features.service';
import { TauriIpcService } from '../../../core/services/tauri-ipc.service';
import { TransactionService } from '../../../core/services/transaction.service';

@Component({
  selector: 'app-rex',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="rex-view">
      <h2>REX</h2>
      <p class="page-desc">Resource Exchange — stake tokens into REX to earn rewards from network fees and RAM trading.</p>

      <div class="rex-grid">
        <div class="section-card">
          <h3>Buy REX</h3>
          <div class="form-group">
            <label>Amount ({{ wallet.activeChain().symbol }})</label>
            <input class="form-input" type="text" placeholder="0.0000"
                   [value]="buyAmount()" (input)="buyAmount.set($any($event.target).value)" />
          </div>
          <button class="btn-primary" [disabled]="!buyAmount()" (click)="onBuyRex()">BUY REX</button>
        </div>

        <div class="section-card">
          <h3>Sell REX</h3>
          <div class="form-group">
            <label>REX amount</label>
            <input class="form-input" type="text" placeholder="0.0000"
                   [value]="sellAmount()" (input)="sellAmount.set($any($event.target).value)" />
          </div>
          <button class="btn-primary" [disabled]="!sellAmount()" (click)="onSellRex()">SELL REX</button>
        </div>
      </div>

      <div class="section-card">
        <h3>REX Balance</h3>
        <div class="rex-info-row">
          <div class="rex-info">
            <span class="info-label">REX Balance</span>
            <span class="info-value">{{ rexBalance() }}</span>
          </div>
          <div class="rex-info">
            <span class="info-label">Matured REX</span>
            <span class="info-value">{{ maturedRex() }}</span>
          </div>
          <div class="rex-info">
            <span class="info-label">Savings</span>
            <span class="info-value">{{ rexSavings() }}</span>
          </div>
        </div>
        <div class="rex-info-row" style="margin-top: var(--sp-4); border-top: 1px solid var(--border-subtle); padding-top: var(--sp-4);">
          <div class="rex-info">
            <span class="info-label">Backing Value</span>
            <span class="info-value">{{ rexValue() }}</span>
          </div>
          <div class="rex-info">
            <span class="info-label">Next Maturity</span>
            <span class="info-value" [class.matured]="rexMatured()">{{ rexMaturityLabel() }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .rex-view { max-width: 800px; }
    h2 { font-size: 24px; margin-bottom: var(--sp-2); }
    .page-desc { font-size: 13px; color: var(--text-muted); margin-bottom: var(--sp-6); }

    .rex-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--sp-4);
      margin-bottom: var(--sp-6);
    }
    .section-card {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      padding: var(--sp-6);
    }
    .section-card h3 { font-size: 16px; margin-bottom: var(--sp-4); }

    .form-group { margin-bottom: var(--sp-4); }
    label {
      display: block; font-size: 12px; font-weight: 500;
      color: var(--text-muted); text-transform: uppercase;
      letter-spacing: 0.5px; margin-bottom: var(--sp-2);
    }
    .form-input {
      width: 100%;
      padding: var(--sp-3) var(--sp-4);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      background: var(--bg-base);
      color: var(--text-bright);
      font-family: var(--font-data);
      font-size: 14px;
    }
    .form-input::placeholder { color: var(--text-disabled); }

    .btn-primary {
      width: 100%;
      padding: var(--sp-3);
      border: none; border-radius: var(--radius-sm);
      background: var(--accent); color: #fff;
      font-family: var(--font-body); font-size: 13px;
      font-weight: 500; letter-spacing: 1px;
      text-transform: uppercase; cursor: pointer;
      transition: background 150ms ease;
    }
    .btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

    .rex-info-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--sp-4);
      margin-bottom: var(--sp-2);
    }
    .rex-info { text-align: center; }
    .info-label {
      display: block; font-size: 11px;
      color: var(--text-muted); letter-spacing: 1px;
      text-transform: uppercase; margin-bottom: var(--sp-1);
    }
    .info-value {
      font-family: var(--font-data); font-size: 18px;
      font-weight: 600; color: var(--text-bright);
    }
    .info-value.matured { color: var(--positive); }
  `],
})
export class RexComponent {
  buyAmount = signal('');
  sellAmount = signal('');

  rexBalance = signal('0.0000 REX');
  maturedRex = signal('0.0000 REX');
  rexSavings = signal('0.0000 REX');
  rexValue = signal('—');
  rexMaturityLabel = signal('—');
  rexMatured = signal(false);

  constructor(
    public wallet: WalletStateService,
    public features: ChainFeaturesService,
    private ipc: TauriIpcService,
    private tx: TransactionService,
  ) {
    effect(() => {
      const account = this.wallet.selectedAccount();
      if (account) {
        if (this.wallet.hasTauri()) {
          this.features.detect().then(() => {
            this.loadRexBalance();
          });
        } else {
          this.rexBalance.set('120.0000 REX');
          this.maturedRex.set('80.0000 REX');
          this.rexSavings.set('40.0000 REX');
          this.rexValue.set(`120.0000 ${this.wallet.activeChain().symbol}`);
          this.rexMaturityLabel.set('fully matured');
          this.rexMatured.set(true);
        }
      }
    });
  }

  async loadRexBalance() {
    const account = this.wallet.selectedAccount();
    if (!account) return;
    try {
      const result = await this.ipc.getTableRows(account.chainId, {
        code: 'eosio', table: 'rexbal', scope: 'eosio',
        lower_bound: account.name, upper_bound: account.name,
        limit: 1, json: true,
      });
      if (result.rows.length > 0) {
        const row = result.rows[0];
        this.rexBalance.set(row.rex_balance ?? '0.0000 REX');
        this.rexValue.set(row.vote_stake ?? '—');
        
        const maturedVal = typeof row.matured_rex === 'number'
          ? (row.matured_rex / 10000).toFixed(4)
          : (parseFloat(row.matured_rex ?? '0') / 10000).toFixed(4);
        this.maturedRex.set(`${maturedVal} REX`);

        const maturities = row.rex_maturities ?? [];
        let savingsVal = 0;
        if (maturities.length === 0) {
          this.rexMaturityLabel.set('fully matured');
          this.rexMatured.set(true);
        } else {
          const nextMaturity = new Date(maturities[0].first + 'Z');
          const now = new Date();
          if (nextMaturity <= now) {
            this.rexMaturityLabel.set('matured');
            this.rexMatured.set(true);
          } else {
            const hoursLeft = Math.ceil((nextMaturity.getTime() - now.getTime()) / 3600000);
            this.rexMaturityLabel.set(hoursLeft > 24 ? `${Math.ceil(hoursLeft / 24)}d left` : `${hoursLeft}h left`);
            this.rexMatured.set(false);
          }
          
          for (const mat of maturities) {
            const matTime = mat.first ?? mat.key;
            const matVal = mat.second ?? mat.value;
            if (matTime && matVal) {
              const maturityTimeHours = (new Date(matTime + 'Z').getTime() - Date.now()) / (1000 * 60 * 60);
              if (maturityTimeHours > 128) {
                savingsVal += matVal;
              }
            }
          }
        }
        this.rexSavings.set(`${(savingsVal / 10000).toFixed(4)} REX`);
      } else {
        this.rexBalance.set('0.0000 REX');
        this.maturedRex.set('0.0000 REX');
        this.rexSavings.set('0.0000 REX');
        this.rexValue.set('—');
        this.rexMaturityLabel.set('—');
        this.rexMatured.set(false);
      }
    } catch {
      this.rexBalance.set('—');
      this.maturedRex.set('—');
      this.rexSavings.set('—');
      this.rexValue.set('—');
      this.rexMaturityLabel.set('—');
      this.rexMatured.set(false);
    }
  }

  private async confirmAction(title: string, actions: any[]) {
    const account = this.wallet.selectedAccount();
    if (!account) return;
    const keys = await this.ipc.listPublicKeys(account.chainId);
    if (keys.length === 0) return;
    const result = await this.tx.confirm({ chainId: account.chainId, publicKey: keys[0], actions, title });
    if (result) {
      await this.wallet.refreshAccount(this.wallet.selectedIndex());
      await this.loadRexBalance();
    }
  }

  private sym(): string {
    return this.wallet.activeChain()?.symbol ?? 'EOS';
  }

  private prec(): number {
    return this.wallet.activeChain()?.precision ?? 4;
  }

  private qty(amount: string): string {
    return `${parseFloat(amount || '0').toFixed(this.prec())} ${this.sym()}`;
  }

  private auth(): { actor: string; permission: string }[] {
    const name = this.wallet.selectedAccount()?.name ?? '';
    return [{ actor: name, permission: 'active' }];
  }

  private me(): string {
    return this.wallet.selectedAccount()?.name ?? '';
  }

  async onBuyRex() {
    const amt = this.buyAmount();
    if (!amt) return;
    await this.confirmAction('Buy REX', [
      { account: 'eosio', name: 'deposit', authorization: this.auth(), data: { owner: this.me(), amount: this.qty(amt) } },
      { account: 'eosio', name: 'buyrex', authorization: this.auth(), data: { from: this.me(), amount: this.qty(amt) } },
    ]);
    this.buyAmount.set('');
  }

  async onSellRex() {
    const amt = this.sellAmount();
    if (!amt) return;
    await this.confirmAction('Sell REX', [
      { account: 'eosio', name: 'sellrex', authorization: this.auth(), data: { from: this.me(), rex: this.qty(amt) } },
      { account: 'eosio', name: 'withdraw', authorization: this.auth(), data: { owner: this.me(), amount: this.qty(amt) } },
    ]);
    this.sellAmount.set('');
  }
}
