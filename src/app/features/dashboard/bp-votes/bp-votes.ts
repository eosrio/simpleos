import { Component, effect, signal } from '@angular/core';
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
      <div class="bp-badge">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
        <span>Block Producer</span>
      </div>
      <h2>Vote Analytics</h2>

      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-label">TOTAL VOTES</span>
          <span class="stat-value">{{ totalVotes() }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">VOTERS FOUND</span>
          <span class="stat-value">{{ voters().length }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">PROXY VOTERS</span>
          <span class="stat-value">{{ proxyCount() }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">DIRECT VOTERS</span>
          <span class="stat-value">{{ directCount() }}</span>
        </div>
      </div>

      <div class="section-card">
        <h3>Top Voters</h3>
        <p class="section-desc">Largest vote weight contributors to {{ wallet.selectedAccount()!.name }}</p>

        @if (loadingVoters()) {
          <p class="section-desc">Loading voter data...</p>
        } @else if (voters().length === 0) {
          <p class="section-desc">No voter data found.</p>
        } @else {
          <div class="voters-table">
            <div class="table-header">
              <span>#</span>
              <span>Account</span>
              <span>Staked</span>
              <span>Type</span>
            </div>
            @for (voter of voters(); track voter.owner; let i = $index) {
              <div class="table-row">
                <span class="rank">{{ i + 1 }}</span>
                <span class="data account">{{ voter.owner }}</span>
                <span class="data">{{ formatStaked(voter) }}</span>
                <span class="type-badge" [class.proxy]="voter.is_proxy" [class.direct]="!voter.is_proxy">
                  {{ voter.is_proxy ? 'Proxy' : 'Direct' }}
                </span>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .bp-votes-view { max-width: 800px; }

    .bp-badge {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-1) var(--sp-3); background: var(--accent-muted);
      color: var(--accent); border-radius: var(--radius-full);
      font-size: 12px; font-weight: 500; margin-bottom: var(--sp-3);
    }
    h2 { font-size: 24px; margin-bottom: var(--sp-6); }

    .stats-row {
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: var(--sp-4); margin-bottom: var(--sp-6);
    }
    .stat-card {
      background: var(--bg-raised); border-radius: var(--radius-md); padding: var(--sp-4);
    }
    .stat-label {
      display: block; font-size: 11px; font-weight: 500;
      letter-spacing: 1.5px; color: var(--text-muted); margin-bottom: var(--sp-1);
    }
    .stat-value {
      font-family: var(--font-data); font-size: 18px; font-weight: 600; color: var(--text-bright);
    }

    .section-card {
      background: var(--bg-raised); border-radius: var(--radius-md); padding: var(--sp-5);
    }
    .section-card h3 { font-size: 15px; margin-bottom: var(--sp-2); }
    .section-desc { font-size: 13px; color: var(--text-muted); margin-bottom: var(--sp-5); }

    .voters-table { font-size: 13px; }
    .table-header, .table-row {
      display: grid;
      grid-template-columns: 0.4fr 1.5fr 1.2fr 0.8fr;
      padding: var(--sp-3) var(--sp-2);
      border-bottom: 1px solid var(--border-subtle);
      align-items: center;
    }
    .table-header {
      font-size: 11px; font-weight: 500; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .table-row { color: var(--text-body); }
    .table-row:last-child { border-bottom: none; }
    .table-row:hover { background: var(--bg-hover); }
    .rank { color: var(--text-muted); font-weight: 500; }
    .data { font-family: var(--font-data); }
    .account { color: var(--accent); cursor: pointer; }
    .account:hover { text-decoration: underline; }
    .type-badge {
      font-size: 11px; font-weight: 500; padding: 2px var(--sp-2);
      border-radius: var(--radius-full); display: inline-block; text-align: center;
    }
    .type-badge.proxy { background: var(--accent-muted); color: var(--accent); }
    .type-badge.direct { background: rgba(45, 212, 168, 0.12); color: var(--positive); }
  `],
})
export class BpVotesComponent {
  voters = signal<VoterRow[]>([]);
  loadingVoters = signal(false);
  totalVotes = signal('—');
  proxyCount = signal(0);
  directCount = signal(0);

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
      // Fetch voters table and filter for those voting for this producer
      // This is expensive on-chain — we scan in batches
      const found: VoterRow[] = [];
      let lower = '';
      const limit = 500;
      let iterations = 0;

      while (iterations < 10) { // cap at 5000 voters scanned
        const result = await this.ipc.getTableRows(chainId, {
          code: 'eosio', table: 'voters', scope: 'eosio',
          lower_bound: lower, limit, json: true,
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

      // Sort by staked (EOS) or last_vote_weight (FIO) descending
      found.sort((a, b) => {
        // If staked is available and non-zero, use it; otherwise fall back to vote weight
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
    // FIO has no `staked` field — use last_vote_weight
    if (voter.staked > 0) {
      const precision = this.wallet.activeChain()?.precision ?? 4;
      const divisor = Math.pow(10, precision);
      const tokens = voter.staked / divisor;
      if (tokens >= 1e6) return (tokens / 1e6).toFixed(1) + 'M';
      if (tokens >= 1e3) return (tokens / 1e3).toFixed(1) + 'K';
      return tokens.toFixed(precision);
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

    // Convert raw `total_votes` (Σ staked_SUFs × decay_weight) to stake-equivalent tokens.
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
