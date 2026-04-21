import { Component, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WalletStateService } from '../../../core/services/wallet-state.service';
import { ChainFeaturesService } from '../../../core/services/chain-features.service';
import { TauriIpcService } from '../../../core/services/tauri-ipc.service';
import { TransactionService } from '../../../core/services/transaction.service';

interface ProducerRow {
  owner: string;
  url: string;
  location: string;
  total_votes: string;
  is_active: number;
}

@Component({
  selector: 'app-vote',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="vote-view">
      <h2>Vote / Stake</h2>

      <!-- Summary cards -->
      <div class="summary-row">
        <div class="summary-card">
          <span class="summary-label">TOTAL</span>
          <span class="summary-value">{{ wallet.selectedAccount().info.core_liquid_balance ?? '0.0000' }}</span>
        </div>
        <div class="summary-card">
          <span class="summary-label">STAKED</span>
          <span class="summary-value">{{ formatStake() }}</span>
        </div>
        <div class="summary-card">
          <span class="summary-label">VOTE DECAY</span>
          <span class="summary-value" [class.decay]="voteDecayPct() > 10">{{ voteDecayDisplay() }}</span>
        </div>
      </div>

      <!-- Staking section (adaptive) -->
      @if (features.hasStaking() && !features.capabilities().fioStaking) {
        <div class="section-card">
          <div class="section-header">
            <h3>Stake your {{ wallet.activeChain().symbol }}</h3>
            <span class="panel-badge">{{ formatUnstakeDelay() }} unstake</span>
          </div>

          @if (features.isFreeChain()) {
            <p class="section-desc">Staking is optional — it provides voting weight and transaction priority on {{ wallet.selectedAccount().chainName }}.</p>
          } @else {
            <p class="section-desc">Staked tokens are used for voting and resource allocation. You can unstake at any time.</p>
          }

          <!-- Percentage slider -->
          <div class="stake-slider-section">
            <div class="slider-labels">
              <span>0%</span>
              <span>{{ stakePercent() }}%</span>
              <span>100%</span>
            </div>
            <input type="range" class="stake-slider"
                   min="0" max="100" step="1"
                   [value]="stakePercent()"
                   (input)="onSliderChange($any($event.target).value)" />
          </div>

          <div class="stake-split">
            <div class="form-group">
              <label>CPU ({{ wallet.activeChain().symbol }})</label>
              <input class="form-input" type="text"
                     [value]="cpuAmount()"
                     (input)="cpuAmount.set($any($event.target).value)"
                     placeholder="0.0000" />
            </div>
            <div class="form-group">
              <label>NET ({{ wallet.activeChain().symbol }})</label>
              <input class="form-input" type="text"
                     [value]="netAmount()"
                     (input)="netAmount.set($any($event.target).value)"
                     placeholder="0.0000" />
            </div>
          </div>

          <!-- Advanced: staking ratio -->
          @if (showAdvanced()) {
            <div class="ratio-section">
              <div class="ratio-labels">
                <span>NET Focus</span>
                <span>CPU Focus</span>
              </div>
              <input type="range" class="ratio-slider"
                     min="10" max="90" step="5"
                     [value]="cpuRatio()"
                     (input)="cpuRatio.set(+$any($event.target).value)" />
              <div class="ratio-display">
                <span>CPU: {{ cpuRatio() }}%</span>
                <span>NET: {{ 100 - cpuRatio() }}%</span>
              </div>
            </div>
          }

          <div class="btn-row">
            <button class="btn-primary" (click)="onSetStake()">SET STAKE</button>
            <button class="btn-text" (click)="showAdvanced.set(!showAdvanced())">
              {{ showAdvanced() ? 'Hide' : 'Advanced' }}
            </button>
          </div>
        </div>
      }

      <!-- FIO staking (rewards only, no vote weight) -->
      @if (features.capabilities().fioStaking) {
        <div class="section-card">
          <div class="section-header">
            <h3>FIO Staking</h3>
            <span class="panel-badge">7-day unstake</span>
          </div>
          <p class="section-desc">Stake FIO tokens to earn staking rewards. Voting uses FIO Addresses, not staked weight.</p>

          <div class="form-group">
            <label>Amount</label>
            <input class="form-input" type="text" placeholder="0.000000000" />
          </div>
          <div class="btn-row">
            <button class="btn-primary">STAKE FIO</button>
            <button class="btn-ghost">UNSTAKE FIO</button>
          </div>
        </div>
      }

      <!-- XPR governance staking -->
      @if (features.capabilities().xprStaking) {
        <div class="section-card">
          <div class="section-header">
            <h3>XPR Governance Staking</h3>
            <span class="panel-badge">14-day unstake</span>
          </div>
          <p class="section-desc">Stake XPR for governance voting weight and staking rewards.</p>

          <div class="form-group">
            <label>Amount (XPR)</label>
            <input class="form-input" type="text" placeholder="0.0000" />
          </div>
          <div class="btn-row">
            <button class="btn-primary">STAKE XPR</button>
            <button class="btn-ghost">UNSTAKE XPR</button>
          </div>
        </div>
      }

      <!-- BP voting section -->
      <div class="section-card">
        <div class="section-tabs">
          <button class="tab" [class.active]="voteTab() === 'bp'" (click)="voteTab.set('bp')">Vote for Block Producers</button>
          <button class="tab" [class.active]="voteTab() === 'proxy'" (click)="voteTab.set('proxy')">Vote through a Proxy</button>
        </div>

        @if (voteTab() === 'bp') {
          <p class="section-desc">Select up to 30 block producers to vote for. Your vote weight is based on your staked tokens.</p>

          <div class="search-bar">
            <input class="form-input" type="text" placeholder="Search producers..."
                   [value]="searchQuery()" (input)="searchQuery.set($any($event.target).value)" />
          </div>

          <div class="vote-selection">
            <span class="vote-count">{{ selectedProducers().length }} / 30 selected</span>
            <button class="btn-primary" [disabled]="selectedProducers().length === 0"
                    (click)="onConfirmVote()">CONFIRM VOTE(S)</button>
          </div>

          @if (loadingProducers()) {
            <p class="section-desc">Loading producers...</p>
          } @else {
            <div class="producers-table">
              <div class="table-header">
                <span class="col-check"></span>
                <span class="col-rank">#</span>
                <span class="col-name">Name</span>
                <span class="col-votes">Total Votes</span>
                <span class="col-url">URL</span>
              </div>

              @for (bp of filteredProducers(); track bp.owner; let i = $index) {
                <div class="table-row" [class.selected]="selectedProducers().includes(bp.owner)"
                     (click)="toggleProducer(bp.owner)">
                  <span class="col-check">
                    <span class="checkbox" [class.checked]="selectedProducers().includes(bp.owner)"></span>
                  </span>
                  <span class="col-rank">{{ i + 1 }}</span>
                  <span class="col-name data">{{ bp.owner }}</span>
                  <span class="col-votes data">{{ formatVotes(bp.total_votes) }}</span>
                  <span class="col-url truncate">{{ bp.url }}</span>
                </div>
              }
            </div>
          }
        }

        @if (voteTab() === 'proxy') {
          <p class="section-desc">Choose a proxy to vote for block producers on your behalf. You can only vote through one proxy.</p>

          <div class="form-group">
            <label>Proxy account</label>
            <input class="form-input" type="text" placeholder="Enter proxy account name"
                   [value]="proxyAccount()" (input)="proxyAccount.set($any($event.target).value)" />
          </div>

          <button class="btn-primary" [disabled]="!proxyAccount()"
                  (click)="onConfirmProxy()">CONFIRM VOTE</button>
        }
      </div>
    </div>
  `,
  styles: [`
    .vote-view { max-width: 860px; }
    h2 { font-size: 24px; margin-bottom: var(--sp-6); }

    .summary-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--sp-4);
      margin-bottom: var(--sp-6);
    }
    .summary-card {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      padding: var(--sp-4) var(--sp-5);
    }
    .summary-label {
      display: block; font-size: 11px; font-weight: 500;
      letter-spacing: 1.5px; color: var(--text-muted); margin-bottom: var(--sp-1);
    }
    .summary-value {
      font-family: var(--font-data); font-size: 20px; font-weight: 600; color: var(--text-bright);
    }
    .summary-value.decay { color: var(--negative); }

    .section-card {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      padding: var(--sp-6);
      margin-bottom: var(--sp-6);
    }
    .section-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: var(--sp-2);
    }
    .section-header h3 { font-size: 16px; }
    .section-desc { font-size: 13px; color: var(--text-muted); margin-bottom: var(--sp-5); }

    .panel-badge {
      font-family: var(--font-data); font-size: 10px; font-weight: 500;
      color: var(--accent); background: var(--accent-muted);
      padding: 2px var(--sp-2); border-radius: var(--radius-full);
    }

    /* Staking slider */
    .stake-slider-section { margin-bottom: var(--sp-5); }
    .slider-labels {
      display: flex; justify-content: space-between;
      font-size: 11px; color: var(--text-muted); margin-bottom: var(--sp-1);
      font-family: var(--font-data);
    }
    .stake-slider, .ratio-slider {
      width: 100%;
      height: 6px;
      -webkit-appearance: none;
      appearance: none;
      background: var(--bg-hover);
      border-radius: var(--radius-full);
      outline: none;
    }
    .stake-slider::-webkit-slider-thumb, .ratio-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 16px; height: 16px;
      border-radius: 50%;
      background: var(--accent);
      cursor: pointer;
      border: 2px solid var(--bg-deep);
    }

    /* Ratio section */
    .ratio-section {
      background: var(--bg-hover);
      border-radius: var(--radius-sm);
      padding: var(--sp-4);
      margin-bottom: var(--sp-4);
    }
    .ratio-labels {
      display: flex; justify-content: space-between;
      font-size: 11px; color: var(--text-muted); margin-bottom: var(--sp-2);
    }
    .ratio-display {
      display: flex; justify-content: space-between;
      font-family: var(--font-data); font-size: 12px; color: var(--text-body);
      margin-top: var(--sp-2);
    }

    .stake-split { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); margin-bottom: var(--sp-4); }

    /* Tabs */
    .section-tabs {
      display: flex; gap: var(--sp-1); margin-bottom: var(--sp-4);
    }
    .tab {
      padding: var(--sp-2) var(--sp-4);
      border: none; border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-muted);
      font-family: var(--font-body); font-size: 13px; font-weight: 500;
      cursor: pointer; transition: color 150ms ease, background 150ms ease;
    }
    .tab:hover { color: var(--text-body); background: var(--bg-hover); }
    .tab.active { color: var(--accent); background: var(--accent-muted); }

    .search-bar { margin-bottom: var(--sp-4); }

    /* Vote selection header */
    .vote-selection {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: var(--sp-4);
    }
    .vote-count {
      font-family: var(--font-data); font-size: 13px; color: var(--text-muted);
    }

    /* Producers table */
    .producers-table { font-size: 13px; }
    .table-header, .table-row {
      display: grid;
      grid-template-columns: 36px 40px 1.5fr 1fr 1fr;
      padding: var(--sp-2) var(--sp-3);
      border-bottom: 1px solid var(--border-subtle);
      align-items: center;
    }
    .col-url { font-size: 11px; color: var(--text-disabled); }
    .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .table-header {
      font-size: 11px; font-weight: 500; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .table-row {
      color: var(--text-body); cursor: pointer;
      transition: background 150ms ease;
    }
    .table-row:hover { background: var(--bg-hover); }
    .table-row.selected { background: var(--accent-muted); }
    .table-row:last-child { border-bottom: none; }

    .data { font-family: var(--font-data); }
    .col-check { display: flex; justify-content: center; }
    .col-rank { text-align: center; color: var(--text-muted); }

    .checkbox {
      width: 16px; height: 16px;
      border: 1.5px solid var(--border-subtle);
      border-radius: 3px;
      display: inline-block;
      transition: background 150ms ease, border-color 150ms ease;
    }
    .checkbox.checked {
      background: var(--accent);
      border-color: var(--accent);
    }

    /* Form */
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

    /* Buttons */
    .btn-row { display: flex; gap: var(--sp-3); align-items: center; }
    .btn-primary {
      padding: var(--sp-2) var(--sp-5);
      border: none; border-radius: var(--radius-sm);
      background: var(--accent); color: #fff;
      font-family: var(--font-body); font-size: 12px;
      font-weight: 500; letter-spacing: 1px; text-transform: uppercase;
      cursor: pointer; transition: background 150ms ease;
    }
    .btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-ghost {
      padding: var(--sp-2) var(--sp-4);
      border: 1px solid var(--accent); border-radius: var(--radius-sm);
      background: transparent; color: var(--accent);
      font-family: var(--font-body); font-size: 12px;
      font-weight: 500; letter-spacing: 1px; text-transform: uppercase;
      cursor: pointer; transition: background 150ms ease;
    }
    .btn-ghost:hover { background: var(--accent-muted); }
    .btn-text {
      border: none; background: none; color: var(--text-muted);
      font-family: var(--font-body); font-size: 12px;
      cursor: pointer; text-decoration: underline;
      transition: color 150ms ease;
    }
    .btn-text:hover { color: var(--accent); }
  `],
})
export class VoteComponent {
  voteTab = signal<'bp' | 'proxy'>('bp');
  stakePercent = signal(0);
  cpuAmount = signal('');
  netAmount = signal('');
  cpuRatio = signal(75);
  showAdvanced = signal(false);
  selectedProducers = signal<string[]>([]);
  searchQuery = signal('');
  proxyAccount = signal('');

  // Real producer data
  producers = signal<ProducerRow[]>([]);
  loadingProducers = signal(false);

  filteredProducers = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const list = this.producers();
    if (!q) return list;
    return list.filter(bp => bp.owner.includes(q) || bp.url?.toLowerCase().includes(q));
  });

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
          this.features.detect();
        } else {
          this.features.setMockCapabilities(account.chainName);
        }
        this.loadProducers(account.chainId);
        this.loadCurrentVotes(account);
      }
    });
  }

  private async loadProducers(chainId: string) {
    this.loadingProducers.set(true);
    try {
      const result = await this.ipc.getProducers(chainId, 200);
      const rows: ProducerRow[] = (result?.rows ?? result?.producers ?? [])
        .filter((r: any) => r.is_active === 1 || parseFloat(r.total_votes) > 0)
        .sort((a: any, b: any) => parseFloat(b.total_votes) - parseFloat(a.total_votes));
      this.producers.set(rows);
    } catch {
      this.producers.set([]);
    } finally {
      this.loadingProducers.set(false);
    }
  }

  private loadCurrentVotes(account: any) {
    const voterInfo = account.info?.voter_info;
    if (voterInfo?.producers?.length) {
      this.selectedProducers.set([...voterInfo.producers]);
    } else {
      this.selectedProducers.set([]);
    }
    if (voterInfo?.proxy) {
      this.proxyAccount.set(voterInfo.proxy);
    }
  }

  // ── Helpers ──

  private sym(): string { return this.wallet.activeChain()?.symbol ?? 'EOS'; }
  private prec(): number { return this.wallet.activeChain()?.precision ?? 4; }
  private qty(amount: string): string { return `${parseFloat(amount || '0').toFixed(this.prec())} ${this.sym()}`; }
  private me(): string { return this.wallet.selectedAccount()?.name ?? ''; }
  private auth() { return [{ actor: this.me(), permission: 'active' }]; }

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

  // ── Actions ──

  async onSetStake() {
    const cpu = this.cpuAmount(), net = this.netAmount();
    if (!cpu && !net) return;
    await this.confirmAction('Stake Resources', [{
      account: 'eosio', name: 'delegatebw', authorization: this.auth(),
      data: { from: this.me(), receiver: this.me(), stake_net_quantity: this.qty(net), stake_cpu_quantity: this.qty(cpu), transfer: false },
    }]);
  }

  async onConfirmVote() {
    const prods = [...this.selectedProducers()].sort();
    if (prods.length === 0) return;

    const isFio = this.wallet.isFio();
    const data: any = { voter: this.me(), proxy: '', producers: prods };

    // FIO requires fio_address and max_fee
    if (isFio) {
      data.fio_address = '';
      data.max_fee = await this.fioFee('vote_producer');
    }

    await this.confirmAction('Vote for Producers', [{
      account: 'eosio', name: 'voteproducer', authorization: this.auth(), data,
    }]);
  }

  async onConfirmProxy() {
    const proxy = this.proxyAccount().trim();
    if (!proxy) return;

    const isFio = this.wallet.isFio();

    if (isFio) {
      // FIO uses a separate voteproxy action
      const maxFee = await this.fioFee('proxy_vote');
      await this.confirmAction('Vote via Proxy', [{
        account: 'eosio', name: 'voteproxy', authorization: this.auth(),
        data: { proxy, fio_address: '', actor: this.me(), max_fee: maxFee },
      }]);
    } else {
      await this.confirmAction('Vote via Proxy', [{
        account: 'eosio', name: 'voteproducer', authorization: this.auth(),
        data: { voter: this.me(), proxy, producers: [] },
      }]);
    }
  }

  /** Fetch FIO fee for a given endpoint. */
  private async fioFee(endPoint: string): Promise<number> {
    const acct = this.wallet.selectedAccount();
    if (!acct) return 2000000000;
    try {
      const result = await this.ipc.fioGetFee(acct.chainId, endPoint, '');
      return result?.fee ?? 2000000000;
    } catch {
      return 2000000000;
    }
  }

  // ── Vote Decay ──

  /**
   * EOSIO vote decay: votes lose weight over time unless refreshed.
   * Weight = staked * 2^(weeks_since_epoch / 52)
   * The last_vote_weight in voter_info captures the weight at the time of voting.
   * Current weight = staked * 2^(current_weeks / 52)
   * Decay % = 1 - (last_vote_weight / current_weight) * 100
   */
  voteDecayPct = computed(() => {
    const acct = this.wallet.selectedAccount();
    if (!acct) return 0;
    const voterInfo = acct.info?.voter_info;
    if (!voterInfo) return 0;

    const lastVoteWeight = parseFloat(voterInfo.last_vote_weight ?? '0');
    if (lastVoteWeight <= 0) return 0;

    const staked = voterInfo.staked ?? ((acct.info.cpu_weight ?? 0) + (acct.info.net_weight ?? 0));
    if (staked <= 0) return 0;

    // EOSIO epoch: January 1, 2000 00:00:00 UTC
    const epochMs = Date.UTC(2000, 0, 1);
    const nowWeeks = (Date.now() - epochMs) / (7 * 24 * 3600 * 1000);
    const currentWeight = (staked / 10000) * Math.pow(2, nowWeeks / 52);

    if (currentWeight <= 0) return 0;
    const decay = (1 - lastVoteWeight / currentWeight) * 100;
    return Math.max(0, Math.min(100, decay));
  });

  voteDecayDisplay = computed(() => {
    const pct = this.voteDecayPct();
    if (pct <= 0) return 'none';
    if (pct < 1) return '<1%';
    return `${pct.toFixed(1)}%`;
  });

  // ── Formatters ──

  formatStake(): string {
    const acct = this.wallet.selectedAccount();
    if (!acct) return '0.0000';
    // Actual staked tokens for voting power live in voter_info.staked (raw int, precision 4).
    // cpu_weight/net_weight represent resource delegation, which is a separate concept.
    const staked = acct.info?.voter_info?.staked;
    if (typeof staked === 'number' && staked > 0) {
      return (staked / 10000).toFixed(4);
    }
    return '0.0000';
  }

  formatUnstakeDelay(): string {
    const sec = this.features.capabilities().unstakeDelaySec;
    if (sec === 0) return 'instant';
    return `${Math.round(sec / 86400)}-day`;
  }

  /**
   * EOSIO producer total_votes is a time-weighted sum: staked_tokens * 2^(weeks_since_epoch / 52).
   * Remove the growth factor to display the underlying token amount that voters have staked.
   */
  private voteGrowthFactor(): number {
    const epochMs = Date.UTC(2000, 0, 1);
    const nowWeeks = (Date.now() - epochMs) / (7 * 24 * 3600 * 1000);
    return Math.pow(2, nowWeeks / 52);
  }

  formatVotes(votes: string): string {
    const n = parseFloat(votes);
    if (isNaN(n) || n <= 0) return '0';
    const tokens = n / this.voteGrowthFactor();
    const symbol = this.wallet.activeChain().symbol;
    let body: string;
    if (tokens >= 1e9) body = (tokens / 1e9).toFixed(2) + 'B';
    else if (tokens >= 1e6) body = (tokens / 1e6).toFixed(2) + 'M';
    else if (tokens >= 1e3) body = (tokens / 1e3).toFixed(2) + 'K';
    else body = tokens.toFixed(2);
    return `${body} ${symbol}`;
  }

  onSliderChange(value: string) {
    this.stakePercent.set(+value);
  }

  toggleProducer(owner: string) {
    this.selectedProducers.update(list => {
      if (list.includes(owner)) return list.filter(p => p !== owner);
      if (list.length >= 30) return list;
      return [...list, owner];
    });
  }
}
