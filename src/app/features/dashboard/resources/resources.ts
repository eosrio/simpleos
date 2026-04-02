import { Component, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WalletStateService } from '../../../core/services/wallet-state.service';
import { ChainFeaturesService } from '../../../core/services/chain-features.service';

@Component({
  selector: 'app-resources',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="resources-view">
      <h2>Resources</h2>

      @if (features.loading()) {
        <div class="skeleton-row">
          <div class="skeleton skeleton-panel"></div>
          <div class="skeleton skeleton-panel"></div>
        </div>
      } @else {

        <!-- Free chain banner -->
        @if (features.isFreeChain()) {
          <div class="free-banner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <div>
              <strong>Free transactions on {{ wallet.selectedAccount()?.chainName }}</strong>
              <p>This chain provides resources at no cost. Resource management is optional.</p>
            </div>
          </div>
        }

        <!-- Resource meters (always shown if account has them) -->
        @if (wallet.selectedAccount()) {
          <div class="meters-row">
            <div class="meter-card">
              <div class="meter-header">
                <span class="meter-label">CPU</span>
                <span class="meter-pct" [class.warning]="cpuPct() > 70" [class.critical]="cpuPct() > 85">{{ cpuPct() }}%</span>
              </div>
              <div class="meter-bar"><div class="meter-fill" [class.warning]="cpuPct() > 70" [class.critical]="cpuPct() > 85" [style.width.%]="cpuPct()"></div></div>
              <span class="meter-detail">Staked: {{ formatWeight(wallet.selectedAccount()!.info.cpu_weight) }}</span>
            </div>
            <div class="meter-card">
              <div class="meter-header">
                <span class="meter-label">NET</span>
                <span class="meter-pct">0%</span>
              </div>
              <div class="meter-bar"><div class="meter-fill" style="width:0%"></div></div>
              <span class="meter-detail">Staked: {{ formatWeight(wallet.selectedAccount()!.info.net_weight) }}</span>
            </div>
            <div class="meter-card">
              <div class="meter-header">
                <span class="meter-label">RAM</span>
                <span class="meter-pct" [class.warning]="ramPct() > 70" [class.critical]="ramPct() > 85">{{ ramPct() }}%</span>
              </div>
              <div class="meter-bar"><div class="meter-fill" [class.warning]="ramPct() > 70" [class.critical]="ramPct() > 85" [style.width.%]="ramPct()"></div></div>
              <span class="meter-detail">{{ formatBytes(wallet.selectedAccount()!.info.ram_usage ?? 0) }} / {{ formatBytes(wallet.selectedAccount()!.info.ram_quota ?? 0) }}</span>
            </div>
          </div>
        }

        <div class="panels-grid">

          <!-- ═══ PowerUp Panel (Vaulta, WAX, Telos) ═══ -->
          @if (features.hasPowerUp()) {
            <div class="panel">
              <div class="panel-header">
                <h3>PowerUp</h3>
                <span class="panel-badge">1-day rental</span>
              </div>
              <p class="panel-desc">Rent CPU and NET resources for 24 hours. Pay only for what you use.</p>

              <div class="form-group">
                <label>CPU (% of network)</label>
                <div class="input-row">
                  <input class="form-input" type="text" placeholder="0.01" />
                  <span class="input-suffix">%</span>
                </div>
              </div>

              <div class="form-group">
                <label>NET (% of network)</label>
                <div class="input-row">
                  <input class="form-input" type="text" placeholder="0.01" />
                  <span class="input-suffix">%</span>
                </div>
              </div>

              <div class="cost-estimate">
                <span>Estimated cost:</span>
                <span class="cost-value">— {{ wallet.activeChain()?.symbol }}</span>
              </div>

              <button class="btn-primary">POWER UP</button>
            </div>
          }

          <!-- ═══ Staking Panel (most chains) ═══ -->
          @if (features.hasStaking() && !features.capabilities().fioStaking && !features.capabilities().xprStaking) {
            <div class="panel">
              <div class="panel-header">
                <h3>Stake {{ wallet.activeChain()?.symbol }}</h3>
                <span class="panel-badge">{{ formatUnstakeDelay() }} unstake</span>
              </div>

              @if (features.isFreeChain()) {
                <p class="panel-desc">Staking is optional on this chain — it provides transaction priority and voting weight.</p>
              } @else {
                <p class="panel-desc">Stake tokens to allocate CPU and NET resources for transactions.</p>
              }

              <div class="stake-split">
                <div class="form-group">
                  <label>CPU</label>
                  <input class="form-input" type="text" placeholder="0.0000" />
                </div>
                <div class="form-group">
                  <label>NET</label>
                  <input class="form-input" type="text" placeholder="0.0000" />
                </div>
              </div>

              <div class="btn-row">
                <button class="btn-primary">STAKE</button>
                <button class="btn-ghost">UNSTAKE</button>
              </div>
            </div>
          }

          <!-- ═══ REX Panel (Vaulta, Telos) ═══ -->
          @if (features.hasRex()) {
            <div class="panel">
              <div class="panel-header">
                <h3>REX</h3>
                <span class="panel-badge">4-5 day maturity</span>
              </div>
              <p class="panel-desc">Resource Exchange — earn network fees by staking into REX. Also provides CPU/NET resources.</p>

              <div class="rex-stats">
                <div class="stat"><span class="stat-label">REX Balance</span><span class="stat-value">—</span></div>
                <div class="stat"><span class="stat-label">Value</span><span class="stat-value">—</span></div>
              </div>

              <div class="form-group">
                <label>Amount to deposit</label>
                <input class="form-input" type="text" placeholder="0.0000" />
              </div>

              <div class="btn-row">
                <button class="btn-primary">BUY REX</button>
                <button class="btn-ghost">SELL REX</button>
              </div>
            </div>
          }

          <!-- ═══ RAM Panel (Bancor) ═══ -->
          @if (features.capabilities().ramBancor) {
            <div class="panel">
              <div class="panel-header">
                <h3>RAM Market</h3>
                <span class="panel-badge">Bancor</span>
              </div>

              <div class="ram-price">
                <span>Current price</span>
                <span class="price-value">— {{ wallet.activeChain()?.symbol }}/KB</span>
              </div>

              <div class="form-group">
                <label>Buy RAM</label>
                <div class="input-row">
                  <input class="form-input" type="text" placeholder="0" />
                  <span class="input-suffix">KB</span>
                </div>
              </div>
              <button class="btn-primary btn-full">BUY RAM</button>

              <div class="form-group" style="margin-top: var(--sp-5)">
                <label>Sell RAM</label>
                <div class="input-row">
                  <input class="form-input" type="text" placeholder="0" />
                  <span class="input-suffix">KB</span>
                </div>
              </div>
              <button class="btn-danger btn-full">SELL RAM</button>

              @if (features.capabilities().ramTransfer) {
                <div class="form-group" style="margin-top: var(--sp-5)">
                  <label>Transfer RAM to</label>
                  <input class="form-input" type="text" placeholder="Account name" />
                  <div class="input-row" style="margin-top: var(--sp-2)">
                    <input class="form-input" type="text" placeholder="0" />
                    <span class="input-suffix">bytes</span>
                  </div>
                </div>
                <button class="btn-ghost btn-full">TRANSFER RAM</button>
              }
            </div>
          }

          <!-- ═══ RAM Panel (Fixed Price — XPR) ═══ -->
          @if (features.capabilities().ramFixed) {
            <div class="panel">
              <div class="panel-header">
                <h3>RAM</h3>
                <span class="panel-badge">Fixed price</span>
              </div>
              <p class="panel-desc">RAM is priced at a fixed rate set by block producers.</p>

              <div class="form-group">
                <label>Buy RAM (bytes)</label>
                <input class="form-input" type="text" placeholder="0" />
              </div>
              <button class="btn-primary btn-full">BUY RAM</button>

              <div class="form-group" style="margin-top: var(--sp-5)">
                <label>Sell RAM (bytes)</label>
                <input class="form-input" type="text" placeholder="0" />
              </div>
              <button class="btn-danger btn-full">SELL RAM</button>
            </div>
          }

          <!-- ═══ RAM Panel (Ultra — refundram) ═══ -->
          @if (features.capabilities().ramRefund) {
            <div class="panel">
              <div class="panel-header">
                <h3>RAM</h3>
                <span class="panel-badge">Refundable</span>
              </div>
              <p class="panel-desc">RAM is purchased at a linear price. Refund returns a proportional amount based on your purchase history.</p>

              <div class="form-group">
                <label>Buy RAM</label>
                <input class="form-input" type="text" placeholder="0.0000 UOS" />
              </div>
              <button class="btn-primary btn-full">BUY RAM</button>

              <div class="form-group" style="margin-top: var(--sp-5)">
                <label>Refund RAM (bytes)</label>
                <input class="form-input" type="text" placeholder="0" />
              </div>
              <button class="btn-ghost btn-full">REFUND RAM</button>
            </div>
          }

          <!-- ═══ FIO Staking (rewards only) ═══ -->
          @if (features.capabilities().fioStaking) {
            <div class="panel">
              <div class="panel-header">
                <h3>FIO Staking</h3>
                <span class="panel-badge">7-day unstake</span>
              </div>
              <p class="panel-desc">Stake FIO tokens to earn staking rewards. Resources are provided automatically — no staking required for transactions.</p>

              <div class="fio-info">
                <div class="stat"><span class="stat-label">Bundled Txns</span><span class="stat-value">— / 100</span></div>
                <div class="stat"><span class="stat-label">Staked</span><span class="stat-value">— FIO</span></div>
                <div class="stat"><span class="stat-label">Rewards</span><span class="stat-value">— FIO</span></div>
              </div>

              <div class="form-group">
                <label>Amount to stake</label>
                <input class="form-input" type="text" placeholder="0.000000000" />
              </div>

              <div class="btn-row">
                <button class="btn-primary">STAKE FIO</button>
                <button class="btn-ghost">UNSTAKE FIO</button>
              </div>
            </div>
          }

          <!-- ═══ XPR Governance Staking ═══ -->
          @if (features.capabilities().xprStaking) {
            <div class="panel">
              <div class="panel-header">
                <h3>XPR Staking</h3>
                <span class="panel-badge">14-day unstake</span>
              </div>
              <p class="panel-desc">Stake XPR for governance voting weight and staking rewards. Resource staking (SYS) is instant.</p>

              <div class="form-group">
                <label>Stake XPR</label>
                <input class="form-input" type="text" placeholder="0.0000" />
              </div>

              <div class="btn-row">
                <button class="btn-primary">STAKE XPR</button>
                <button class="btn-ghost">UNSTAKE XPR</button>
              </div>
            </div>
          }

          <!-- ═══ Delegation Panel (any chain with staking) ═══ -->
          @if (features.hasStaking()) {
            <div class="panel">
              <div class="panel-header">
                <h3>Delegate Resources</h3>
              </div>
              <p class="panel-desc">Delegate CPU and NET to another account.</p>

              <div class="form-group">
                <label>Receiver</label>
                <input class="form-input" type="text" placeholder="Account name" />
              </div>

              <div class="stake-split">
                <div class="form-group">
                  <label>CPU</label>
                  <input class="form-input" type="text" placeholder="0.0000" />
                </div>
                <div class="form-group">
                  <label>NET</label>
                  <input class="form-input" type="text" placeholder="0.0000" />
                </div>
              </div>

              <div class="btn-row">
                <button class="btn-primary">DELEGATE</button>
                <button class="btn-ghost">UNDELEGATE</button>
              </div>
            </div>
          }

        </div>
      }
    </div>
  `,
  styles: [`
    .resources-view { max-width: 900px; }
    h2 { font-size: 24px; margin-bottom: var(--sp-6); }

    /* Free chain banner */
    .free-banner {
      display: flex;
      align-items: flex-start;
      gap: var(--sp-3);
      padding: var(--sp-4) var(--sp-5);
      background: rgba(45, 212, 168, 0.06);
      border: 1px solid rgba(45, 212, 168, 0.15);
      border-radius: var(--radius-md);
      margin-bottom: var(--sp-6);
      color: var(--positive);
    }
    .free-banner strong { display: block; margin-bottom: 2px; }
    .free-banner p { font-size: 13px; color: var(--text-muted); margin: 0; }

    /* Resource meters */
    .meters-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--sp-4);
      margin-bottom: var(--sp-6);
    }
    .meter-card {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      padding: var(--sp-4);
    }
    .meter-header { display: flex; justify-content: space-between; margin-bottom: var(--sp-2); }
    .meter-label { font-family: var(--font-data); font-size: 12px; font-weight: 600; color: var(--text-bright); }
    .meter-pct { font-family: var(--font-data); font-size: 11px; color: var(--text-muted); }
    .meter-pct.warning { color: var(--caution); }
    .meter-pct.critical { color: var(--negative); }
    .meter-bar { height: 4px; background: var(--bg-hover); border-radius: var(--radius-full); overflow: hidden; margin-bottom: var(--sp-2); }
    .meter-fill { height: 100%; background: var(--accent); border-radius: var(--radius-full); transition: width 300ms ease; }
    .meter-fill.warning { background: var(--caution); }
    .meter-fill.critical { background: var(--negative); }
    .meter-detail { font-family: var(--font-data); font-size: 12px; color: var(--text-muted); }

    /* Panels grid */
    .panels-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--sp-5);
    }

    .panel {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      padding: var(--sp-5);
    }
    .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-3); }
    .panel-header h3 { font-size: 15px; }
    .panel-badge {
      font-family: var(--font-data);
      font-size: 10px;
      font-weight: 500;
      color: var(--accent);
      background: var(--accent-muted);
      padding: 2px var(--sp-2);
      border-radius: var(--radius-full);
      letter-spacing: 0.5px;
    }
    .panel-desc { font-size: 13px; color: var(--text-muted); margin-bottom: var(--sp-4); }

    /* Forms */
    .form-group { margin-bottom: var(--sp-4); }
    label {
      display: block; font-size: 11px; font-weight: 500;
      color: var(--text-muted); text-transform: uppercase;
      letter-spacing: 0.5px; margin-bottom: var(--sp-2);
    }
    .form-input {
      width: 100%;
      padding: var(--sp-2) var(--sp-3);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-base);
      color: var(--text-bright);
      font-family: var(--font-data);
      font-size: 13px;
    }
    .form-input::placeholder { color: var(--text-disabled); }

    .input-row { display: flex; gap: var(--sp-2); align-items: center; }
    .input-row .form-input { flex: 1; }
    .input-suffix { font-family: var(--font-data); font-size: 12px; color: var(--text-muted); white-space: nowrap; }

    .stake-split { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }

    /* Cost estimate */
    .cost-estimate {
      display: flex; justify-content: space-between;
      padding: var(--sp-2) var(--sp-3);
      background: var(--bg-hover);
      border-radius: var(--radius-sm);
      font-size: 12px; color: var(--text-muted);
      margin-bottom: var(--sp-4);
    }
    .cost-value { font-family: var(--font-data); color: var(--text-bright); }

    /* RAM price */
    .ram-price {
      display: flex; justify-content: space-between;
      padding: var(--sp-2) var(--sp-3);
      background: var(--bg-hover);
      border-radius: var(--radius-sm);
      font-size: 12px; color: var(--text-muted);
      margin-bottom: var(--sp-4);
    }
    .price-value { font-family: var(--font-data); color: var(--text-bright); }

    /* Stats */
    .rex-stats, .fio-info {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
      gap: var(--sp-3);
      margin-bottom: var(--sp-4);
    }
    .stat { text-align: center; }
    .stat-label { display: block; font-size: 10px; color: var(--text-muted); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 2px; }
    .stat-value { font-family: var(--font-data); font-size: 15px; font-weight: 600; color: var(--text-bright); }

    /* Buttons */
    .btn-row { display: flex; gap: var(--sp-2); }
    .btn-primary, .btn-ghost, .btn-danger {
      padding: var(--sp-2) var(--sp-4);
      border-radius: var(--radius-sm);
      font-family: var(--font-body);
      font-size: 12px; font-weight: 500;
      letter-spacing: 1px; text-transform: uppercase;
      cursor: pointer; transition: background 150ms ease, opacity 150ms ease;
    }
    .btn-primary { border: none; background: var(--accent); color: #fff; flex: 1; }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-ghost { border: 1px solid var(--accent); background: transparent; color: var(--accent); flex: 1; }
    .btn-ghost:hover { background: var(--accent-muted); }
    .btn-danger { border: none; background: var(--negative); color: #fff; flex: 1; }
    .btn-danger:hover { opacity: 0.85; }
    .btn-full { width: 100%; }

    /* Skeleton */
    .skeleton-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-5); }
    .skeleton { background: var(--bg-raised); border-radius: var(--radius-md); animation: pulse 1.5s infinite ease-in-out; }
    .skeleton-panel { height: 300px; }
    @keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.3; } }
  `],
})
export class ResourcesComponent {
  constructor(
    public wallet: WalletStateService,
    public features: ChainFeaturesService,
  ) {
    // React to account changes — re-detect chain features
    effect(() => {
      const account = this.wallet.selectedAccount();
      if (account) {
        this.features.setMockCapabilities(account.chainName);
      }
    });
  }

  cpuPct(): number {
    const acct = this.wallet.selectedAccount();
    if (!acct) return 0;
    return 0; // Placeholder — needs usage data from get_account
  }

  ramPct(): number {
    const acct = this.wallet.selectedAccount();
    if (!acct) return 0;
    const quota = acct.info.ram_quota ?? 1;
    const usage = acct.info.ram_usage ?? 0;
    return quota > 0 ? Math.min(100, Math.round((usage / quota) * 100)) : 0;
  }

  formatWeight(weight?: number | null): string {
    if (!weight) return '0.0000';
    return (weight / 10000).toFixed(4);
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  formatUnstakeDelay(): string {
    const sec = this.features.capabilities().unstakeDelaySec;
    if (sec === 0) return 'instant';
    const days = Math.round(sec / 86400);
    return `${days}-day`;
  }
}
