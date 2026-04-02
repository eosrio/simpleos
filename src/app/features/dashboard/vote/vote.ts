import { Component, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WalletStateService } from '../../../core/services/wallet-state.service';
import { ChainFeaturesService } from '../../../core/services/chain-features.service';

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
          <span class="summary-value">{{ wallet.selectedAccount()?.info?.core_liquid_balance ?? '0.0000' }}</span>
        </div>
        <div class="summary-card">
          <span class="summary-label">STAKED</span>
          <span class="summary-value">{{ formatStake() }}</span>
        </div>
        <div class="summary-card">
          <span class="summary-label">VOTE DECAY</span>
          <span class="summary-value decay">—</span>
        </div>
      </div>

      <!-- Staking section (adaptive) -->
      @if (features.hasStaking() && !features.capabilities().fioStaking) {
        <div class="section-card">
          <div class="section-header">
            <h3>Stake your {{ wallet.activeChain()?.symbol ?? 'tokens' }}</h3>
            <span class="panel-badge">{{ formatUnstakeDelay() }} unstake</span>
          </div>

          @if (features.isFreeChain()) {
            <p class="section-desc">Staking is optional — it provides voting weight and transaction priority on {{ wallet.selectedAccount()?.chainName }}.</p>
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
              <label>CPU ({{ wallet.activeChain()?.symbol }})</label>
              <input class="form-input" type="text"
                     [value]="cpuAmount()"
                     (input)="cpuAmount.set($any($event.target).value)"
                     placeholder="0.0000" />
            </div>
            <div class="form-group">
              <label>NET ({{ wallet.activeChain()?.symbol }})</label>
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
            <button class="btn-primary">SET STAKE</button>
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
            <input class="form-input" type="text" placeholder="Search producers..." />
          </div>

          <div class="vote-selection">
            <span class="vote-count">{{ selectedProducers().length }} / 30 selected</span>
            <button class="btn-primary" [disabled]="selectedProducers().length === 0">CONFIRM VOTE(S)</button>
          </div>

          <div class="producers-table">
            <div class="table-header">
              <span class="col-check"></span>
              <span class="col-rank">#</span>
              <span class="col-name">Name</span>
              <span class="col-location">Location</span>
              <span class="col-votes">Total Votes</span>
            </div>

            <!-- Mock producers -->
            @for (bp of mockProducers; track bp.owner; let i = $index) {
              <div class="table-row" [class.selected]="selectedProducers().includes(bp.owner)"
                   (click)="toggleProducer(bp.owner)">
                <span class="col-check">
                  <span class="checkbox" [class.checked]="selectedProducers().includes(bp.owner)"></span>
                </span>
                <span class="col-rank">{{ i + 1 }}</span>
                <span class="col-name data">{{ bp.owner }}</span>
                <span class="col-location">{{ bp.location }}</span>
                <span class="col-votes data">{{ bp.votes }}</span>
              </div>
            }
          </div>
        }

        @if (voteTab() === 'proxy') {
          <p class="section-desc">Choose a proxy to vote for block producers on your behalf. You can only vote through one proxy.</p>

          <div class="form-group">
            <label>Proxy account</label>
            <input class="form-input" type="text" placeholder="Enter proxy account name" />
          </div>

          <button class="btn-primary">CONFIRM VOTE</button>
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

  mockProducers = [
    { owner: 'eosriobrazil', location: 'Brazil', votes: '482.3M' },
    { owner: 'eosswedenbp', location: 'Sweden', votes: '451.1M' },
    { owner: 'eosnationftw', location: 'Canada', votes: '438.7M' },
    { owner: 'teamgreymass', location: 'Canada', votes: '421.2M' },
    { owner: 'eosflytomars', location: 'China', votes: '398.5M' },
    { owner: 'newdex.bp', location: 'China', votes: '387.9M' },
    { owner: 'atticlabeosb', location: 'USA', votes: '372.4M' },
    { owner: 'eoslaomaocom', location: 'Japan', votes: '356.8M' },
    { owner: 'big.one', location: 'China', votes: '341.2M' },
    { owner: 'eoscannonchn', location: 'China', votes: '328.6M' },
  ];

  constructor(
    public wallet: WalletStateService,
    public features: ChainFeaturesService,
  ) {
    effect(() => {
      const account = this.wallet.selectedAccount();
      if (account) {
        this.features.setMockCapabilities(account.chainName);
      }
    });
  }

  formatStake(): string {
    const acct = this.wallet.selectedAccount();
    if (!acct) return '0.0000';
    const total = ((acct.info.cpu_weight ?? 0) + (acct.info.net_weight ?? 0)) / 10000;
    return total.toFixed(4);
  }

  formatUnstakeDelay(): string {
    const sec = this.features.capabilities().unstakeDelaySec;
    if (sec === 0) return 'instant';
    return `${Math.round(sec / 86400)}-day`;
  }

  onSliderChange(value: string) {
    this.stakePercent.set(+value);
  }

  toggleProducer(owner: string) {
    this.selectedProducers.update(list => {
      if (list.includes(owner)) {
        return list.filter(p => p !== owner);
      }
      if (list.length >= 30) return list;
      return [...list, owner];
    });
  }
}
