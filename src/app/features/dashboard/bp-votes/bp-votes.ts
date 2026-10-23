import { Component, computed, effect, signal } from '@angular/core';
import { WalletStateService } from '../../../core/services/wallet-state.service';
import { TauriIpcService } from '../../../core/services/tauri-ipc.service';

interface VoterRow {
  owner: string;
  staked: number;
  is_proxy: boolean;
  proxy: string;
  producers: string[];
  last_vote_weight: string;
}

@Component({
  selector: 'app-bp-votes',
  standalone: true,
  template: `
    <div class="bp-votes-view">
      <!-- ── Top Header ── -->
      <header class="page-header">
        <div class="header-title-row">
          <h2>Vote Analytics</h2>
          <span class="header-sep">·</span>
          <span class="header-meta">{{ wallet.selectedAccount()?.name }} · {{ wallet.activeChain().name }}</span>
          <span class="rank-pill">Rank #{{ wallet.selectedAccount()?.producerRank ?? '—' }}</span>
        </div>
        <button class="btn-refresh" type="button" (click)="refresh()" [disabled]="loadingVoters()" title="Refresh voter analytics">
          <svg [class.spinning]="loadingVoters()" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          <span>{{ loadingVoters() ? 'Scanning…' : 'Refresh' }}</span>
        </button>
      </header>

      <!-- ── 4-Metric KPI Strip ── -->
      <div class="stats-grid">
        <div class="stat-card highlight">
          <span class="stat-label">TOTAL VOTE WEIGHT</span>
          <span class="stat-value accent">{{ totalVotes() }}</span>
          <span class="stat-sub">Stake-adjusted</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">VOTERS FOUND</span>
          <span class="stat-value">{{ voters().length }}</span>
          <span class="stat-sub">Scanned on-chain</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">DIRECT VOTERS</span>
          <span class="stat-value positive">{{ directCount() }}</span>
          <span class="stat-sub">{{ directPct() }}% of voters</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">PROXY VOTERS</span>
          <span class="stat-value">{{ proxyCount() }}</span>
          <span class="stat-sub">{{ proxyPct() }}% of voters</span>
        </div>
      </div>

      <!-- ── Top Voters Card ── -->
      <section class="section-card">
        <div class="card-header">
          <div class="card-title-row">
            <h3>Top Voters</h3>
            @if (voters().length > 0) {
              <span class="meta-pill">{{ filteredVoters().length }} of {{ voters().length }}</span>
            }
          </div>

          @if (voters().length > 0) {
            <div class="filter-bar">
              <div class="type-pills" role="group" aria-label="Filter voter type">
                <button type="button" class="pill-btn" [class.active]="typeFilter() === 'all'" (click)="typeFilter.set('all')">All</button>
                <button type="button" class="pill-btn" [class.active]="typeFilter() === 'direct'" (click)="typeFilter.set('direct')">Direct</button>
                <button type="button" class="pill-btn" [class.active]="typeFilter() === 'proxy'" (click)="typeFilter.set('proxy')">Proxy</button>
              </div>
              <input
                type="search"
                class="search-input"
                placeholder="Filter account…"
                [value]="searchQuery()"
                (input)="searchQuery.set($any($event.target).value)"
              />
            </div>
          }
        </div>

        @if (loadingVoters()) {
          <div class="empty-block">
            <p class="empty-title">Scanning on-chain voter table…</p>
            <p class="empty-sub">Reading voter rows for {{ wallet.selectedAccount()?.name }}.</p>
          </div>
        } @else if (voters().length === 0) {
          <div class="empty-block">
            <p class="empty-title">No voters found in the scanned range</p>
            <p class="empty-sub">Accounts voting directly or via proxy for {{ wallet.selectedAccount()?.name }} will appear here.</p>
          </div>
        } @else if (filteredVoters().length === 0) {
          <div class="empty-block">
            <p class="empty-title">No voters match "{{ searchQuery() }}"</p>
            <button type="button" class="btn-clear" (click)="searchQuery.set(''); typeFilter.set('all')">Reset filters</button>
          </div>
        } @else {
          <div class="voters-table">
            <div class="table-header">
              <span>#</span>
              <span>Account</span>
              <span>Stake / Weight</span>
              <span class="col-right">Type</span>
            </div>
            @for (voter of filteredVoters(); track voter.owner; let i = $index) {
              <div class="table-row">
                <span class="rank" [class.top-rank]="i < 3">{{ i + 1 }}</span>
                <div class="account-cell">
                  <button
                    type="button"
                    class="account-copy-btn"
                    [class.copied]="copiedAccount() === voter.owner"
                    (click)="copyAccount(voter.owner)"
                    [title]="'Copy account: ' + voter.owner"
                  >
                    <span>{{ voter.owner }}</span>
                    @if (copiedAccount() === voter.owner) {
                      <span class="copy-tag">✓ Copied</span>
                    }
                  </button>
                  <span class="prod-count" title="Number of producers in this voter's ballot">
                    {{ voter.producers.length }} BP{{ voter.producers.length === 1 ? '' : 's' }}
                  </span>
                </div>
                <div class="stake-cell">
                  <span class="data stake-val">{{ formatStaked(voter) }}</span>
                  <div class="share-track" [title]="voterSharePct(voter).toFixed(1) + '% of top contributor'">
                    <div class="share-fill" [style.width.%]="voterSharePct(voter)"></div>
                  </div>
                </div>
                <div class="col-right">
                  <span class="type-badge" [class.proxy]="voter.is_proxy" [class.direct]="!voter.is_proxy">
                    {{ voter.is_proxy ? 'Proxy' : 'Direct' }}
                  </span>
                </div>
              </div>
            }
          </div>
        }
      </section>
    </div>
  `,
  styles: [`
    .bp-votes-view {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: var(--sp-4);
      padding-bottom: var(--sp-8);
    }

    /* ── Header ── */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--sp-4);
      flex-wrap: wrap;
    }

    .header-title-row {
      display: flex;
      align-items: baseline;
      gap: var(--sp-2);
      flex-wrap: wrap;
    }

    h2 {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-bright);
      margin: 0;
      letter-spacing: -0.02em;
    }

    .header-sep {
      color: var(--text-disabled);
      font-size: 14px;
    }

    .header-meta {
      font-size: 13px;
      font-family: var(--font-data);
      color: var(--text-muted);
    }

    .rank-pill {
      display: inline-flex;
      align-items: center;
      padding: 2px 9px;
      border-radius: var(--radius-full);
      background: var(--bg-raised);
      border: 1px solid var(--border-subtle);
      font-family: var(--font-data);
      font-size: 11px;
      font-weight: 600;
      color: var(--accent-text);
      margin-left: var(--sp-1);
    }

    .btn-refresh {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 12px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-raised);
      color: var(--text-body);
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
    }
    .btn-refresh:hover:not(:disabled) {
      background: var(--bg-hover);
      border-color: var(--border);
      color: var(--text-bright);
    }
    .btn-refresh:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .spinning {
      animation: spin 0.9s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* ── Stats Grid ── */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--sp-3);
    }
    @media (max-width: 720px) {
      .stats-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    .stat-card {
      background: var(--bg-raised);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: var(--sp-3) var(--sp-4);
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }
    .stat-card.highlight {
      border-color: color-mix(in srgb, var(--accent) 32%, var(--border-subtle));
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--accent) 6%, transparent), transparent 75%),
        var(--bg-raised);
    }

    .stat-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      text-transform: uppercase;
    }

    .stat-value {
      font-family: var(--font-data);
      font-variant-numeric: tabular-nums;
      font-size: 17px;
      font-weight: 700;
      color: var(--text-bright);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .stat-value.accent {
      color: var(--accent-text);
    }
    .stat-value.positive {
      color: var(--positive);
    }

    .stat-sub {
      font-size: 11px;
      font-family: var(--font-data);
      font-variant-numeric: tabular-nums;
      color: var(--text-muted);
    }

    /* ── Section Card ── */
    .section-card {
      background: var(--bg-raised);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: var(--sp-5);
      display: flex;
      flex-direction: column;
      gap: var(--sp-4);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--sp-3);
      flex-wrap: wrap;
    }

    .card-title-row {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
    }

    .card-header h3 {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-bright);
      margin: 0;
    }

    .meta-pill {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: var(--radius-full);
      background: var(--bg-base);
      border: 1px solid var(--border-subtle);
      font-family: var(--font-data);
      font-size: 11px;
      color: var(--text-muted);
    }

    .filter-bar {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      flex-wrap: wrap;
    }

    .type-pills {
      display: inline-flex;
      padding: 2px;
      background: var(--bg-base);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
    }

    .pill-btn {
      padding: 4px 10px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--text-muted);
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: background 120ms ease, color 120ms ease;
    }
    .pill-btn:hover {
      color: var(--text-bright);
    }
    .pill-btn.active {
      background: var(--bg-raised);
      color: var(--accent-text);
    }

    .search-input {
      width: 180px;
      padding: 6px 10px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-base);
      color: var(--text-bright);
      font-family: var(--font-data);
      font-size: 12px;
      transition: border-color 150ms ease;
    }
    .search-input:focus {
      outline: none;
      border-color: var(--accent);
    }

    /* ── Voters Table ── */
    .voters-table {
      font-size: 13px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      background: var(--bg-base);
      overflow: hidden;
    }

    .table-header,
    .table-row {
      display: grid;
      grid-template-columns: 42px 1.4fr 1.3fr 90px;
      padding: 10px var(--sp-4);
      align-items: center;
      gap: var(--sp-2);
    }

    .table-header {
      font-size: 10px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      background: color-mix(in srgb, var(--bg-raised) 60%, var(--bg-base));
      border-bottom: 1px solid var(--border-subtle);
    }

    .col-right {
      text-align: right;
    }

    .table-row {
      color: var(--text-body);
      border-bottom: 1px solid var(--border-subtle);
      font-variant-numeric: tabular-nums;
      transition: background 120ms ease;
    }
    .table-row:last-child {
      border-bottom: none;
    }
    .table-row:hover {
      background: var(--bg-hover);
    }

    .rank {
      font-family: var(--font-data);
      font-size: 12px;
      color: var(--text-muted);
      font-weight: 600;
    }
    .rank.top-rank {
      color: var(--accent-text);
      font-weight: 700;
    }

    .account-cell {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      min-width: 0;
    }

    .account-copy-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 6px;
      margin-left: -6px;
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--accent-text);
      font-family: var(--font-data);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease;
    }
    .account-copy-btn:hover {
      background: var(--bg-raised);
      border-color: var(--border-subtle);
    }
    .account-copy-btn.copied {
      color: var(--positive);
    }

    .copy-tag {
      font-size: 10px;
      font-weight: 700;
      color: var(--positive);
    }

    .prod-count {
      font-family: var(--font-data);
      font-size: 10px;
      color: var(--text-muted);
      padding: 1px 6px;
      border-radius: var(--radius-full);
      background: var(--bg-raised);
      border: 1px solid var(--border-subtle);
    }

    .stake-cell {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .stake-val {
      font-size: 12.5px;
      font-weight: 600;
      color: var(--text-bright);
    }

    .share-track {
      width: 100%;
      max-width: 140px;
      height: 3px;
      border-radius: var(--radius-full);
      background: var(--bg-raised);
      overflow: hidden;
    }

    .share-fill {
      height: 100%;
      border-radius: var(--radius-full);
      background: var(--accent);
      opacity: 0.75;
    }

    .data {
      font-family: var(--font-data);
      font-variant-numeric: tabular-nums;
    }

    .type-badge {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: var(--radius-full);
      display: inline-block;
    }
    .type-badge.proxy {
      background: var(--accent-muted);
      color: var(--accent-text);
    }
    .type-badge.direct {
      background: rgba(45, 212, 168, 0.12);
      color: var(--positive);
    }

    /* ── Empty State ── */
    .empty-block {
      padding: var(--sp-5);
      border-radius: var(--radius-md);
      background: var(--bg-base);
      border: 1px dashed var(--border-subtle);
      text-align: center;
    }
    .empty-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-body);
      margin: 0 0 4px;
    }
    .empty-sub {
      font-size: 12px;
      color: var(--text-muted);
      margin: 0;
    }

    .btn-clear {
      margin-top: var(--sp-2);
      padding: 5px 12px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-raised);
      color: var(--accent-text);
      font-size: 12px;
      cursor: pointer;
    }
  `],
})
export class BpVotesComponent {
  voters = signal<VoterRow[]>([]);
  loadingVoters = signal(false);
  totalVotes = signal('—');
  proxyCount = signal(0);
  directCount = signal(0);
  searchQuery = signal('');
  typeFilter = signal<'all' | 'direct' | 'proxy'>('all');
  copiedAccount = signal('');

  directPct = computed(() => {
    const total = this.voters().length;
    return total > 0 ? Math.round((this.directCount() / total) * 100) : 0;
  });

  proxyPct = computed(() => {
    const total = this.voters().length;
    return total > 0 ? Math.round((this.proxyCount() / total) * 100) : 0;
  });

  filteredVoters = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const tf = this.typeFilter();
    return this.voters().filter(v => {
      if (tf === 'direct' && v.is_proxy) return false;
      if (tf === 'proxy' && !v.is_proxy) return false;
      if (q && !v.owner.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  private maxVoterMetric = computed(() => {
    const list = this.voters();
    if (list.length === 0) return 0;
    return Math.max(...list.map(v => this.voterNumericMetric(v)), 0);
  });

  constructor(
    public wallet: WalletStateService,
    private ipc: TauriIpcService,
  ) {
    effect(() => {
      const acct = this.wallet.selectedAccount();
      if (acct?.isProducer) {
        this.loadProducerVoteWeight(acct.chainId, acct.name);
        this.loadVoters(acct.chainId, acct.name);
      }
    });
  }

  async refresh() {
    const acct = this.wallet.selectedAccount();
    if (!acct) return;
    await Promise.all([
      this.loadProducerVoteWeight(acct.chainId, acct.name),
      this.loadVoters(acct.chainId, acct.name),
    ]);
  }

  async copyAccount(name: string) {
    if (!name) return;
    try {
      await navigator.clipboard.writeText(name);
      this.copiedAccount.set(name);
      setTimeout(() => {
        if (this.copiedAccount() === name) this.copiedAccount.set('');
      }, 1600);
    } catch { /* ignore */ }
  }

  voterNumericMetric(voter: VoterRow): number {
    return voter.staked > 0 ? voter.staked : parseFloat(voter.last_vote_weight) || 0;
  }

  voterSharePct(voter: VoterRow): number {
    const max = this.maxVoterMetric();
    if (max <= 0) return 0;
    return Math.max(3, Math.min(100, (this.voterNumericMetric(voter) / max) * 100));
  }

  private async loadProducerVoteWeight(chainId: string, account: string) {
    try {
      const result = await this.ipc.getProducers(chainId, 200);
      const list: any[] = result?.rows ?? result?.producers ?? [];
      const row = list.find((r: any) => r.owner === account);
      if (row?.total_votes) {
        this.totalVotes.set(this.formatVoteWeight(row.total_votes));
      }
    } catch { /* offline */ }
  }

  /**
   * Antelope vote decay multiplier.
   * stake2vote(staked) = staked_SUFs * 2^((weeks_since_2000-01-01) / 52).
   * Returns `undefined` for chains that don't use time-decay (FIO).
   */
  private voteDecayMultiplier(): number | undefined {
    const sym = this.wallet.activeChain()?.symbol;
    if (sym === 'FIO') return undefined;
    const epoch = 946684800; // 2000-01-01 UTC
    const weeks = Math.floor((Date.now() / 1000 - epoch) / 604800);
    return Math.pow(2, weeks / 52);
  }

  private async loadVoters(chainId: string, account: string) {
    this.loadingVoters.set(true);
    try {
      const found: VoterRow[] = [];
      let lower = '';
      const limit = 500;
      let iterations = 0;

      while (iterations < 10) {
        const result = await this.ipc.getTableRows(chainId, {
          code: this.wallet.coreSystemContract?.() ?? 'eosio',
          table: 'voters',
          scope: this.wallet.coreSystemContract?.() ?? 'eosio',
          lower_bound: lower,
          limit,
          json: true,
        });
        const rows: any[] = result?.rows ?? [];
        if (rows.length === 0) break;

        for (const row of rows) {
          const prods: string[] = row.producers ?? [];
          if (prods.includes(account)) {
            found.push({
              owner: row.owner,
              staked: row.staked ?? 0,
              is_proxy: row.is_proxy === 1,
              proxy: row.proxy ?? '',
              producers: prods,
              last_vote_weight: row.last_vote_weight ?? '0',
            });
          }
        }

        if (!result?.more) break;
        lower = result.next_key ?? rows[rows.length - 1].owner;
        iterations++;
      }

      found.sort((a, b) => {
        const aVal = a.staked > 0 ? a.staked : parseFloat(a.last_vote_weight);
        const bVal = b.staked > 0 ? b.staked : parseFloat(b.last_vote_weight);
        return bVal - aVal;
      });
      this.voters.set(found);
      this.proxyCount.set(found.filter(v => v.is_proxy).length);
      this.directCount.set(found.filter(v => !v.is_proxy).length);
    } catch {
      this.voters.set([]);
    } finally {
      this.loadingVoters.set(false);
    }
  }

  formatStaked(voter: VoterRow): string {
    const sym = this.wallet.activeChain()?.symbol ?? '';
    if (voter.staked > 0) {
      const precision = this.wallet.activeChain()?.precision ?? 4;
      const divisor = Math.pow(10, precision);
      const tokens = voter.staked / divisor;
      if (tokens >= 1e6) return (tokens / 1e6).toFixed(1) + 'M ' + sym;
      if (tokens >= 1e3) return (tokens / 1e3).toFixed(1) + 'K ' + sym;
      return tokens.toFixed(Math.min(precision, 4)) + ' ' + sym;
    }
    const weight = parseFloat(voter.last_vote_weight);
    if (weight >= 1e12) return (weight / 1e12).toFixed(1) + 'T';
    if (weight >= 1e9) return (weight / 1e9).toFixed(1) + 'B';
    if (weight >= 1e6) return (weight / 1e6).toFixed(1) + 'M';
    if (weight >= 1e3) return (weight / 1e3).toFixed(1) + 'K';
    return weight.toFixed(0);
  }

  private formatVoteWeight(votes: string): string {
    let n = parseFloat(votes);
    if (isNaN(n) || n === 0) return '0';

    const precision = this.wallet.activeChain()?.precision ?? 4;
    const decay = this.voteDecayMultiplier();
    n = n / Math.pow(10, precision);
    if (decay) n = n / decay;

    const sym = this.wallet.activeChain()?.symbol ?? '';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B ' + sym;
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M ' + sym;
    if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K ' + sym;
    return n.toFixed(2) + ' ' + sym;
  }
}
