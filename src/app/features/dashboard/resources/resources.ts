import { Component, effect, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WalletStateService } from '../../../core/services/wallet-state.service';
import { ChainFeaturesService } from '../../../core/services/chain-features.service';
import { TauriIpcService } from '../../../core/services/tauri-ipc.service';
import { TransactionService } from '../../../core/services/transaction.service';

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
              <strong>Free transactions on {{ wallet.selectedAccount()!.chainName }}</strong>
              <p>This chain provides resources at no cost. Resource management is optional.</p>
            </div>
          </div>
        }

        <!-- Resource meters -->
        @if (wallet.selectedAccount(); as acct) {
          <div class="meters-row">
            <div class="meter-card" [class.warning]="cpuPct() > 70" [class.critical]="cpuPct() > 85">
              <div class="meter-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>
              </div>
              <div class="meter-info">
                <span class="meter-label">CPU</span>
                <span class="meter-avail">{{ formatCpuAvailable(acct.info.cpu_limit) }}</span>
                <span class="meter-sub">Available</span>
              </div>
              <div class="meter-right">
                <span class="meter-pct" [class.warning]="cpuPct() > 70" [class.critical]="cpuPct() > 85">{{ cpuPct() }}%</span>
                <div class="meter-bar"><div class="meter-fill" [class.warning]="cpuPct() > 70" [class.critical]="cpuPct() > 85" [style.width.%]="cpuPct()"></div></div>
              </div>
            </div>

            <div class="meter-card" [class.warning]="netPct() > 70" [class.critical]="netPct() > 85">
              <div class="meter-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
              </div>
              <div class="meter-info">
                <span class="meter-label">NET</span>
                <span class="meter-avail">{{ formatNetAvailable(acct.info.net_limit) }}</span>
                <span class="meter-sub">Available</span>
              </div>
              <div class="meter-right">
                <span class="meter-pct" [class.warning]="netPct() > 70" [class.critical]="netPct() > 85">{{ netPct() }}%</span>
                <div class="meter-bar"><div class="meter-fill" [class.warning]="netPct() > 70" [class.critical]="netPct() > 85" [style.width.%]="netPct()"></div></div>
              </div>
            </div>

            <div class="meter-card" [class.warning]="ramPct() > 70" [class.critical]="ramPct() > 85">
              <div class="meter-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="14"/><line x1="10" y1="10" x2="10" y2="14"/><line x1="14" y1="10" x2="14" y2="14"/><line x1="18" y1="10" x2="18" y2="14"/></svg>
              </div>
              <div class="meter-info">
                <span class="meter-label">RAM</span>
                <span class="meter-avail">{{ formatBytes(Math.max(0, (acct.info.ram_quota ?? 0) - (acct.info.ram_usage ?? 0))) }}</span>
                <span class="meter-sub">Available</span>
              </div>
              <div class="meter-right">
                <span class="meter-pct" [class.warning]="ramPct() > 70" [class.critical]="ramPct() > 85">{{ ramPct() }}% used</span>
                <div class="meter-bar"><div class="meter-fill" [class.warning]="ramPct() > 70" [class.critical]="ramPct() > 85" [style.width.%]="ramPct()"></div></div>
              </div>
            </div>
          </div>
        }

        <div class="panels-grid">

          <!-- ═══ PowerUp Panel ═══ -->
          @if (features.hasPowerUp()) {
            <div class="panel">
              <div class="panel-header">
                <h3>PowerUp</h3>
                <span class="panel-badge">{{ powerupDays() }}-day rental</span>
              </div>

              <!-- Market utilization -->
              @if (powerupLoaded()) {
                <div class="market-stats">
                  <div class="market-stat">
                    <span class="stat-label">CPU Market</span>
                    <span class="stat-value">{{ cpuMarketPct() }}% used</span>
                  </div>
                  <div class="market-stat">
                    <span class="stat-label">NET Market</span>
                    <span class="stat-value">{{ netMarketPct() }}% used</span>
                  </div>
                </div>
              }

              <p class="panel-desc">Rent CPU and NET resources. Pay only for what you use.</p>

              <div class="form-group">
                <label>CPU (% of network)</label>
                <div class="input-row">
                  <input class="form-input" type="number" step="0.001" min="0"
                         [ngModel]="cpuPercent()"
                         (ngModelChange)="cpuPercent.set($event); estimateCost()" />
                  <span class="input-suffix">%</span>
                </div>
              </div>

              <div class="form-group">
                <label>NET (% of network)</label>
                <div class="input-row">
                  <input class="form-input" type="number" step="0.001" min="0"
                         [ngModel]="netPercent()"
                         (ngModelChange)="netPercent.set($event); estimateCost()" />
                  <span class="input-suffix">%</span>
                </div>
              </div>

              <div class="cost-estimate" [class.loading]="estimating()">
                <span>Estimated cost:</span>
                @if (estimating()) {
                  <span class="cost-value">calculating...</span>
                } @else {
                  <span class="cost-value">{{ estimatedFee() }}</span>
                }
              </div>

              @if (powerupError()) {
                <div class="msg error-msg">{{ powerupError() }}</div>
              }

              @if (powerupSuccess()) {
                <div class="msg success-msg">{{ powerupSuccess() }}</div>
              }

              <button class="btn-primary" [disabled]="!canPowerUp() || executing()"
                      (click)="executePowerUp()">
                {{ executing() ? 'POWERING UP...' : 'POWER UP' }}
              </button>

              <!-- Active orders -->
              @if (activeOrders().length > 0) {
                <div class="orders-section">
                  <label>ACTIVE RENTALS</label>
                  @for (order of activeOrders(); track order.id) {
                    <div class="order-row">
                      <div class="order-resources">
                        <span>CPU: {{ formatWeight(order.cpu_weight) }}</span>
                        <span>NET: {{ formatWeight(order.net_weight) }}</span>
                      </div>
                      <span class="order-expires">expires {{ formatExpiry(order.expires) }}</span>
                    </div>
                  }
                </div>
              }
            </div>
          }

          <!-- ═══ Staking Panel ═══ -->
          @if (features.hasStaking() && !features.capabilities().fioStaking && !features.capabilities().xprStaking) {
            <div class="panel">
              <div class="panel-header">
                <h3>Stake {{ wallet.activeChain().symbol }}</h3>
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
                  <input class="form-input" type="text" placeholder="0.0000"
                         [value]="stakeCpu()" (input)="stakeCpu.set($any($event.target).value)" />
                </div>
                <div class="form-group">
                  <label>NET</label>
                  <input class="form-input" type="text" placeholder="0.0000"
                         [value]="stakeNet()" (input)="stakeNet.set($any($event.target).value)" />
                </div>
              </div>

              <div class="btn-row">
                <button class="btn-primary" (click)="onStake()">STAKE</button>
                <button class="btn-ghost" (click)="onUnstake()">UNSTAKE</button>
              </div>
            </div>
          }

          <!-- ═══ REX Panel ═══ -->
          @if (features.hasRex()) {
            <div class="panel">
              <div class="panel-header">
                <h3>REX</h3>
                <span class="panel-badge">4-5 day maturity</span>
              </div>
              <p class="panel-desc">Resource Exchange — earn network fees by staking into REX. Also provides CPU/NET resources.</p>

              <div class="rex-stats">
                <div class="stat">
                  <span class="stat-label">REX Balance</span>
                  <span class="stat-value">{{ rexBalance() }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">Value</span>
                  <span class="stat-value">{{ rexValue() }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">Maturity</span>
                  <span class="stat-value" [class.matured]="rexMatured()">{{ rexMaturityLabel() }}</span>
                </div>
              </div>

              <div class="form-group">
                <label>Amount to deposit</label>
                <input class="form-input" type="text" placeholder="0.0000"
                       [value]="rexAmount()" (input)="rexAmount.set($any($event.target).value)" />
              </div>

              <div class="btn-row">
                <button class="btn-primary" (click)="onBuyRex()">BUY REX</button>
                <button class="btn-ghost" (click)="onSellRex()">SELL REX</button>
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
                <span class="price-value">{{ ramPrice() }} {{ wallet.activeChain().symbol }}/KB</span>
              </div>

              <div class="form-group">
                <label>Buy RAM</label>
                <div class="input-row">
                  <input class="form-input" type="text" placeholder="0"
                         [value]="ramBuyKb()" (input)="ramBuyKb.set($any($event.target).value)" />
                  <span class="input-suffix">KB</span>
                </div>
              </div>
              <button class="btn-primary btn-full" (click)="onBuyRam()">BUY RAM</button>

              <div class="form-group" style="margin-top: var(--sp-5)">
                <label>Sell RAM</label>
                <div class="input-row">
                  <input class="form-input" type="text" placeholder="0"
                         [value]="ramSellKb()" (input)="ramSellKb.set($any($event.target).value)" />
                  <span class="input-suffix">KB</span>
                </div>
              </div>
              <button class="btn-danger btn-full" (click)="onSellRam()">SELL RAM</button>

              <!-- RAM Transfer (Vaulta) -->
              @if (features.capabilities().ramTransfer) {
                <div class="ram-transfer-section">
                  <label>Transfer RAM</label>
                  <div class="form-group">
                    <input class="form-input" type="text" placeholder="Receiver account"
                           [value]="ramTransferTo()" (input)="ramTransferTo.set($any($event.target).value)" />
                  </div>
                  <div class="input-row" style="margin-bottom: var(--sp-3)">
                    <input class="form-input" type="text" placeholder="0"
                           [value]="ramTransferBytes()" (input)="ramTransferBytes.set($any($event.target).value)" />
                    <span class="input-suffix">KB</span>
                  </div>
                  <button class="btn-ghost btn-full" (click)="onRamTransfer()">TRANSFER RAM</button>
                </div>
              }
            </div>
          }

          <!-- ═══ RAM Panel (Ultra - Refund) ═══ -->
          @if (features.capabilities().ramRefund && !features.capabilities().ramBancor) {
            <div class="panel">
              <div class="panel-header">
                <h3>RAM</h3>
                <span class="panel-badge">Refundable</span>
              </div>
              <p class="panel-desc">On Ultra, RAM can be purchased and refunded at no cost.</p>

              <div class="form-group">
                <label>Buy RAM</label>
                <div class="input-row">
                  <input class="form-input" type="text" placeholder="0"
                         [value]="ramBuyKb()" (input)="ramBuyKb.set($any($event.target).value)" />
                  <span class="input-suffix">KB</span>
                </div>
              </div>
              <button class="btn-primary btn-full" (click)="onBuyRam()">BUY RAM</button>

              <div class="form-group" style="margin-top: var(--sp-5)">
                <label>Refund RAM</label>
                <div class="input-row">
                  <input class="form-input" type="text" placeholder="0"
                         [value]="ramSellKb()" (input)="ramSellKb.set($any($event.target).value)" />
                  <span class="input-suffix">KB</span>
                </div>
              </div>
              <button class="btn-danger btn-full" (click)="onRefundRam()">REFUND RAM</button>
            </div>
          }

          <!-- ═══ FIO Staking ═══ -->
          @if (features.capabilities().fioStaking) {
            <div class="panel">
              <div class="panel-header">
                <h3>FIO Staking</h3>
                <span class="panel-badge">7-day unstake</span>
              </div>
              <p class="panel-desc">Stake FIO to earn rewards. Resources are provided automatically.</p>

              <div class="form-group">
                <label>Amount to stake</label>
                <input class="form-input" type="text" placeholder="0.000000000"
                       [value]="fioAmount()" (input)="fioAmount.set($any($event.target).value)" />
              </div>

              <div class="btn-row">
                <button class="btn-primary" (click)="onStakeFio()">STAKE FIO</button>
                <button class="btn-ghost" (click)="onUnstakeFio()">UNSTAKE FIO</button>
              </div>
            </div>
          }

          <!-- ═══ XPR Staking ═══ -->
          @if (features.capabilities().xprStaking) {
            <div class="panel">
              <div class="panel-header">
                <h3>XPR Staking</h3>
                <span class="panel-badge">14-day unstake</span>
              </div>
              <p class="panel-desc">Stake XPR for governance weight and staking rewards.</p>

              <div class="form-group">
                <label>Stake XPR</label>
                <input class="form-input" type="text" placeholder="0.0000"
                       [value]="xprAmount()" (input)="xprAmount.set($any($event.target).value)" />
              </div>

              <div class="btn-row">
                <button class="btn-primary" (click)="onStakeXpr()">STAKE XPR</button>
                <button class="btn-ghost" (click)="onUnstakeXpr()">UNSTAKE XPR</button>
              </div>
            </div>
          }

          <!-- ═══ Delegation Panel ═══ -->
          @if (features.hasStaking()) {
            <div class="panel">
              <div class="panel-header">
                <h3>Delegate Resources</h3>
              </div>
              <p class="panel-desc">Delegate CPU and NET to another account.</p>

              <div class="form-group">
                <label>Receiver</label>
                <input class="form-input" type="text" placeholder="Account name"
                       [value]="delReceiver()" (input)="delReceiver.set($any($event.target).value)" />
              </div>

              <div class="stake-split">
                <div class="form-group">
                  <label>CPU</label>
                  <input class="form-input" type="text" placeholder="0.0000"
                         [value]="delCpu()" (input)="delCpu.set($any($event.target).value)" />
                </div>
                <div class="form-group">
                  <label>NET</label>
                  <input class="form-input" type="text" placeholder="0.0000"
                         [value]="delNet()" (input)="delNet.set($any($event.target).value)" />
                </div>
              </div>

              <div class="btn-row">
                <button class="btn-primary" (click)="onDelegate()">DELEGATE</button>
                <button class="btn-ghost" (click)="onUndelegate()">UNDELEGATE</button>
              </div>

              <!-- Current Delegations List -->
              @if (delegations().length > 0) {
                <div class="delegations-section">
                  <label>ACTIVE DELEGATIONS</label>
                  @for (del of delegations(); track del.to) {
                    <div class="delegation-row">
                      <span class="del-to data">{{ del.to }}</span>
                      <div class="del-amounts">
                        <span class="data">CPU: {{ del.cpu_weight }}</span>
                        <span class="data">NET: {{ del.net_weight }}</span>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }

        </div>
      }
    </div>
  `,
  styleUrl: './resources.css',
})
export class ResourcesComponent {
  // PowerUp form state
  cpuPercent = signal(0.01);
  netPercent = signal(0.001);
  estimatedFee = signal('—');
  estimating = signal(false);
  executing = signal(false);
  powerupError = signal('');
  powerupSuccess = signal('');

  // PowerUp chain data
  powerupState = signal<any>(null);
  activeOrders = signal<any[]>([]);
  powerupLoaded = signal(false);

  // Debounce timer for cost estimation
  private estimateTimer: any;

  cpuMarketPct = computed(() => {
    const s = this.powerupState();
    if (!s?.cpu) return '0.0';
    return ((s.cpu.utilization / s.cpu.weight) * 100).toFixed(2);
  });

  netMarketPct = computed(() => {
    const s = this.powerupState();
    if (!s?.net) return '0.0';
    return ((s.net.utilization / s.net.weight) * 100).toFixed(2);
  });

  powerupDays = computed(() => this.powerupState()?.powerup_days ?? 1);

  canPowerUp = computed(() => {
    return (this.cpuPercent() > 0 || this.netPercent() > 0) &&
           this.estimatedFee() !== '—' &&
           !this.estimating() &&
           !this.executing() &&
           this.wallet.selectedAccount()?.mode === 'full';
  });

  constructor(
    public wallet: WalletStateService,
    public features: ChainFeaturesService,
    private ipc: TauriIpcService,
    private tx: TransactionService,
  ) {
    // React to account changes — detect features and load chain data
    effect(() => {
      const account = this.wallet.selectedAccount();
      if (account) {
        if (this.wallet.hasTauri()) {
          this.features.detect().then(() => {
            this.loadPowerUpData();
            this.loadRamPrice();
            this.loadRexBalance();
            this.loadDelegations();
          });
        } else {
          this.features.setMockCapabilities(account.chainName);
        }
      }
    });
  }

  // ── PowerUp Data Loading ──

  async loadPowerUpData() {
    const account = this.wallet.selectedAccount();
    if (!account) return;

    try {
      const summary = await this.ipc.getPowerUpInfo(account.chainId, account.name);
      this.powerupState.set(summary.state);
      this.activeOrders.set(summary.active_orders ?? []);
      this.powerupLoaded.set(true);
    } catch (e) {
      console.warn('[resources] PowerUp data not available:', e);
      this.powerupLoaded.set(false);
    }
  }

  // ── Cost Estimation ──

  estimateCost() {
    clearTimeout(this.estimateTimer);
    this.estimateTimer = setTimeout(() => this.doEstimate(), 300);
  }

  private async doEstimate() {
    const account = this.wallet.selectedAccount();
    if (!account || !this.wallet.hasTauri()) return;

    const cpuFrac = (this.cpuPercent() || 0) / 100;
    const netFrac = (this.netPercent() || 0) / 100;

    if (cpuFrac <= 0 && netFrac <= 0) {
      this.estimatedFee.set('—');
      return;
    }

    this.estimating.set(true);
    this.powerupError.set('');

    try {
      const est = await this.ipc.estimatePowerUp(account.chainId, cpuFrac, netFrac);
      this.estimatedFee.set(est.fee);
    } catch (e: any) {
      this.estimatedFee.set('—');
      this.powerupError.set(e?.toString() ?? 'Estimation failed');
    } finally {
      this.estimating.set(false);
    }
  }

  // ── PowerUp Execution ──

  async executePowerUp() {
    const account = this.wallet.selectedAccount();
    if (!account) return;

    const state = this.powerupState();
    if (!state) return;

    this.executing.set(true);
    this.powerupError.set('');
    this.powerupSuccess.set('');

    try {
      const cpuFrac = Math.round((this.cpuPercent() / 100) * 1e15);
      const netFrac = Math.round((this.netPercent() / 100) * 1e15);

      // Add 20% fee buffer for slippage
      const feeStr = this.estimatedFee();
      const feeAmount = parseFloat(feeStr.split(' ')[0] || '0');
      const feeSymbol = feeStr.split(' ')[1] || 'EOS';
      const maxPayment = `${(feeAmount * 1.2).toFixed(4)} ${feeSymbol}`;

      const keys = await this.ipc.listPublicKeys(account.chainId);
      if (keys.length === 0) {
        this.powerupError.set('No signing key found for this account');
        return;
      }

      const actions = [{
        account: 'eosio',
        name: 'powerup',
        authorization: [{ actor: account.name, permission: 'active' }],
        data: {
          payer: account.name,
          receiver: account.name,
          days: state.powerup_days,
          net_frac: netFrac,
          cpu_frac: cpuFrac,
          max_payment: maxPayment,
        },
      }];

      const result = await this.tx.confirm({
        chainId: account.chainId,
        publicKey: keys[0],
        actions,
        title: 'PowerUp Resources',
      });

      if (result) {
        this.powerupSuccess.set(`PowerUp successful! TX: ${result.transaction_id.slice(0, 12)}...`);
        await this.loadPowerUpData();
        await this.wallet.refreshAccount(this.wallet.selectedIndex());
      }
    } catch (e: any) {
      this.powerupError.set(e?.toString() ?? 'PowerUp failed');
    } finally {
      this.executing.set(false);
    }
  }

  // ── Panel input signals ──

  stakeCpu = signal('');
  stakeNet = signal('');
  rexAmount = signal('');
  ramBuyKb = signal('');
  ramSellKb = signal('');
  ramPrice = signal('—');
  fioAmount = signal('');
  xprAmount = signal('');
  delReceiver = signal('');
  delCpu = signal('');
  delNet = signal('');
  ramTransferTo = signal('');
  ramTransferBytes = signal('');

  // REX balance data
  rexBalance = signal('—');
  rexValue = signal('—');
  rexMaturityLabel = signal('—');
  rexMatured = signal(false);

  // Delegation list
  delegations = signal<{ to: string; cpu_weight: string; net_weight: string }[]>([]);

  // ── Helpers ──

  private async confirmAction(title: string, actions: any[]) {
    const account = this.wallet.selectedAccount();
    if (!account) return;
    const keys = await this.ipc.listPublicKeys(account.chainId);
    if (keys.length === 0) return;
    const result = await this.tx.confirm({ chainId: account.chainId, publicKey: keys[0], actions, title });
    if (result) {
      await this.wallet.refreshAccount(this.wallet.selectedIndex());
    }
  }

  private sym(): string {
    const chain = this.wallet.activeChain();
    return chain?.symbol ?? 'EOS';
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

  // ── Staking ──

  async onStake() {
    const cpu = this.stakeCpu(), net = this.stakeNet();
    if (!cpu && !net) return;
    await this.confirmAction('Stake Resources', [{
      account: 'eosio', name: 'delegatebw', authorization: this.auth(),
      data: { from: this.me(), receiver: this.me(), stake_net_quantity: this.qty(net), stake_cpu_quantity: this.qty(cpu), transfer: false },
    }]);
  }

  async onUnstake() {
    const cpu = this.stakeCpu(), net = this.stakeNet();
    if (!cpu && !net) return;
    await this.confirmAction('Unstake Resources', [{
      account: 'eosio', name: 'undelegatebw', authorization: this.auth(),
      data: { from: this.me(), receiver: this.me(), unstake_net_quantity: this.qty(net), unstake_cpu_quantity: this.qty(cpu) },
    }]);
  }

  // ── REX ──

  async onBuyRex() {
    const amt = this.rexAmount();
    if (!amt) return;
    await this.confirmAction('Buy REX', [
      { account: 'eosio', name: 'deposit', authorization: this.auth(), data: { owner: this.me(), amount: this.qty(amt) } },
      { account: 'eosio', name: 'buyrex', authorization: this.auth(), data: { from: this.me(), amount: this.qty(amt) } },
    ]);
  }

  async onSellRex() {
    const amt = this.rexAmount();
    if (!amt) return;
    await this.confirmAction('Sell REX', [
      { account: 'eosio', name: 'sellrex', authorization: this.auth(), data: { from: this.me(), rex: this.qty(amt) } },
      { account: 'eosio', name: 'withdraw', authorization: this.auth(), data: { owner: this.me(), amount: this.qty(amt) } },
    ]);
  }

  // ── RAM ──

  async onBuyRam() {
    const kb = parseFloat(this.ramBuyKb() || '0');
    if (kb <= 0) return;
    await this.confirmAction('Buy RAM', [{
      account: 'eosio', name: 'buyrambytes', authorization: this.auth(),
      data: { payer: this.me(), receiver: this.me(), bytes: Math.round(kb * 1024) },
    }]);
  }

  async onSellRam() {
    const kb = parseFloat(this.ramSellKb() || '0');
    if (kb <= 0) return;
    await this.confirmAction('Sell RAM', [{
      account: 'eosio', name: 'sellram', authorization: this.auth(),
      data: { account: this.me(), bytes: Math.round(kb * 1024) },
    }]);
  }

  async onRamTransfer() {
    const kb = parseFloat(this.ramTransferBytes() || '0');
    const to = this.ramTransferTo().trim();
    if (kb <= 0 || !to) return;
    await this.confirmAction('Transfer RAM', [{
      account: 'eosio', name: 'ramtransfer', authorization: this.auth(),
      data: { from: this.me(), to, bytes: Math.round(kb * 1024), memo: '' },
    }]);
  }

  async onRefundRam() {
    const kb = parseFloat(this.ramSellKb() || '0');
    if (kb <= 0) return;
    await this.confirmAction('Refund RAM', [{
      account: 'eosio', name: 'refundram', authorization: this.auth(),
      data: { owner: this.me(), bytes: Math.round(kb * 1024) },
    }]);
  }

  // ── RAM Price Loading ──

  private async loadRamPrice() {
    const account = this.wallet.selectedAccount();
    if (!account) return;
    try {
      const result = await this.ipc.getTableRows(account.chainId, {
        code: 'eosio', table: 'rammarket', scope: 'eosio', limit: 1, json: true,
      });
      if (result.rows.length > 0) {
        const row = result.rows[0];
        // Bancor formula: price = quote_balance / base_balance
        const quoteBalance = parseFloat(row.quote?.balance?.split(' ')[0] ?? '0');
        const baseBalance = parseFloat(row.base?.balance?.split(' ')[0] ?? '0');
        if (baseBalance > 0) {
          const pricePerByte = quoteBalance / baseBalance;
          const pricePerKb = pricePerByte * 1024;
          this.ramPrice.set(pricePerKb.toFixed(4));
        }
      }
    } catch {
      this.ramPrice.set('—');
    }
  }

  // ── REX Balance Loading ──

  private async loadRexBalance() {
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
        // REX value = vote_stake (amount of SYS tokens backing the REX)
        this.rexValue.set(row.vote_stake ?? '—');
        // Maturity: rex_maturities is an array of {first: timestamp, second: amount}
        const maturities = row.rex_maturities ?? [];
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
        }
      } else {
        this.rexBalance.set('0.0000 REX');
        this.rexValue.set('—');
        this.rexMaturityLabel.set('—');
        this.rexMatured.set(false);
      }
    } catch {
      this.rexBalance.set('—');
      this.rexValue.set('—');
      this.rexMaturityLabel.set('—');
    }
  }

  // ── Delegation List Loading ──

  private async loadDelegations() {
    const account = this.wallet.selectedAccount();
    if (!account) return;
    try {
      const result = await this.ipc.getTableRows(account.chainId, {
        code: 'eosio', table: 'delband', scope: account.name,
        limit: 100, json: true,
      });
      const delegations = result.rows
        .filter((r: any) => r.to !== account.name) // exclude self-delegation
        .map((r: any) => ({
          to: r.to,
          cpu_weight: r.cpu_weight ?? '0.0000',
          net_weight: r.net_weight ?? '0.0000',
        }));
      this.delegations.set(delegations);
    } catch {
      this.delegations.set([]);
    }
  }

  // ── FIO ──

  async onStakeFio() {
    const amt = this.fioAmount();
    if (!amt) return;
    const maxFee = await this.fioFee('stake_fio_tokens');
    await this.confirmAction('Stake FIO', [{
      account: 'fio.staking', name: 'stakefio', authorization: this.auth(),
      data: { fio_address: '', amount: Math.round(parseFloat(amt) * 1e9), max_fee: maxFee, actor: this.me(), tpid: '' },
    }]);
  }

  async onUnstakeFio() {
    const amt = this.fioAmount();
    if (!amt) return;
    const maxFee = await this.fioFee('unstake_fio_tokens');
    await this.confirmAction('Unstake FIO', [{
      account: 'fio.staking', name: 'unstakefio', authorization: this.auth(),
      data: { fio_address: '', amount: Math.round(parseFloat(amt) * 1e9), max_fee: maxFee, actor: this.me(), tpid: '' },
    }]);
  }

  /** Fetch FIO fee for a given endpoint, with fallback. */
  private async fioFee(endPoint: string): Promise<number> {
    const acct = this.wallet.selectedAccount();
    if (!acct) return 2000000000;
    try {
      const result = await this.ipc.fioGetFee(acct.chainId, endPoint, '');
      return result?.fee ?? 2000000000;
    } catch {
      return 2000000000; // ~2 FIO default
    }
  }

  // ── XPR ──

  async onStakeXpr() {
    const amt = this.xprAmount();
    if (!amt) return;
    await this.confirmAction('Stake XPR', [{
      account: 'eosio', name: 'stakexpr', authorization: this.auth(),
      data: { owner: this.me(), quantity: this.qty(amt) },
    }]);
  }

  async onUnstakeXpr() {
    const amt = this.xprAmount();
    if (!amt) return;
    await this.confirmAction('Unstake XPR', [{
      account: 'eosio', name: 'unstakexpr', authorization: this.auth(),
      data: { owner: this.me(), quantity: this.qty(amt) },
    }]);
  }

  // ── Delegation ──

  async onDelegate() {
    const cpu = this.delCpu(), net = this.delNet(), recv = this.delReceiver();
    if (!recv || (!cpu && !net)) return;
    await this.confirmAction('Delegate Resources', [{
      account: 'eosio', name: 'delegatebw', authorization: this.auth(),
      data: { from: this.me(), receiver: recv, stake_net_quantity: this.qty(net), stake_cpu_quantity: this.qty(cpu), transfer: false },
    }]);
  }

  async onUndelegate() {
    const cpu = this.delCpu(), net = this.delNet(), recv = this.delReceiver();
    if (!recv || (!cpu && !net)) return;
    await this.confirmAction('Undelegate Resources', [{
      account: 'eosio', name: 'undelegatebw', authorization: this.auth(),
      data: { from: this.me(), receiver: recv, unstake_net_quantity: this.qty(net), unstake_cpu_quantity: this.qty(cpu) },
    }]);
  }

  // Expose Math to template
  Math = Math;

  // ── Resource Meters ──

  cpuPct(): number {
    const limit = this.wallet.selectedAccount()?.info.cpu_limit;
    if (!limit?.max || limit.max <= 0) return 0;
    return Math.min(100, Math.round(((limit.used ?? 0) / limit.max) * 100));
  }

  netPct(): number {
    const limit = this.wallet.selectedAccount()?.info.net_limit;
    if (!limit?.max || limit.max <= 0) return 0;
    return Math.min(100, Math.round(((limit.used ?? 0) / limit.max) * 100));
  }

  ramPct(): number {
    const acct = this.wallet.selectedAccount();
    if (!acct) return 0;
    const quota = acct.info.ram_quota ?? 1;
    const usage = acct.info.ram_usage ?? 0;
    return quota > 0 ? Math.min(100, Math.round((usage / quota) * 100)) : 0;
  }

  // ── Formatters ──

  formatCpuAvailable(limit?: import('../../../core/services/tauri-ipc.service').ResourceLimit | null): string {
    if (!limit?.available) return '—';
    const us = limit.available;
    if (us >= 1000000) return (us / 1000000).toFixed(1) + ' s';
    if (us >= 1000) return (us / 1000).toFixed(0) + ' ms';
    return us + ' us';
  }

  formatNetAvailable(limit?: import('../../../core/services/tauri-ipc.service').ResourceLimit | null): string {
    if (!limit?.available) return '—';
    return this.formatBytes(limit.available);
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

  formatExpiry(expires: string): string {
    const d = new Date(expires + 'Z');
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    if (diffMs <= 0) return 'expired';
    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    if (hours > 24) return `in ${Math.floor(hours / 24)}d ${hours % 24}h`;
    if (hours > 0) return `in ${hours}h ${mins}m`;
    return `in ${mins}m`;
  }
}
