import { Component, computed, effect, signal } from '@angular/core';
import { WalletStateService } from '../../../core/services/wallet-state.service';
import { TauriIpcService } from '../../../core/services/tauri-ipc.service';
import { TransactionService } from '../../../core/services/transaction.service';

/** Short relative time like `5m ago`, `3h`, `2d`, `in 4h`. */
function relativeTime(target: Date, now: Date): string {
  const diffMs = target.getTime() - now.getTime();
  const past = diffMs < 0;
  const abs = Math.abs(diffMs);
  const unit = (v: number, u: string) => `${v}${u}`;
  let core: string;
  if (abs < 60_000) core = unit(Math.floor(abs / 1000), 's');
  else if (abs < 3_600_000) core = unit(Math.floor(abs / 60_000), 'm');
  else if (abs < 86_400_000) core = unit(Math.floor(abs / 3_600_000), 'h');
  else core = unit(Math.floor(abs / 86_400_000), 'd');
  return past ? `${core} ago` : `in ${core}`;
}

interface Approval {
  actor: string;
  permission: string;
  time?: string;
}

interface MsigAction {
  account: string;
  name: string;
  authorization: { actor: string; permission: string }[];
  data: any;
}

interface MsigProposal {
  proposer: string;
  proposal_name: string;
  block_num?: number;
  /** Hyperion indexing timestamp of the `propose` action */
  '@timestamp'?: string;
  block_time?: string;
  requested_approvals: Approval[];
  provided_approvals: Approval[];
  executed?: boolean;
  /** Some Hyperion versions use `trx`, others `transaction`; we normalize. */
  trx?: { expiration?: string; actions?: MsigAction[] };
  transaction?: { expiration?: string; actions?: MsigAction[] };
}

interface ProposalDetails {
  /** Unix timestamp (seconds) */
  expiration: number;
  actions: MsigAction[];
}

@Component({
  selector: 'app-msig-inbox',
  standalone: true,
  template: `
    <div class="msig-view">
      <h2>Multisig Inbox</h2>
      <p class="subtitle">
        Proposals that still need a signature from
        <strong>{{ me() }}</strong>
        on <strong>{{ wallet.activeChain().name }}</strong>.
        @if (source() === 'scan') {
          <span class="source-hint" title="No Hyperion available — walked every scope in the eosio.msig::proposal table">
            · scope scan
          </span>
        }
      </p>

      <!-- Manual lookup — always available, primary fallback when no Hyperion -->
      <details class="manual-panel" [open]="source() === 'none'">
        <summary>
          <span>Look up a specific proposal</span>
          <span class="subtitle-inline">(useful when the inbox can't reach it)</span>
        </summary>
        <div class="manual-lookup">
          <input class="form-input" placeholder="proposer" [value]="manualProposer()"
            (input)="manualProposer.set($any($event.target).value)"
            (keydown.enter)="loadManual()" />
          <input class="form-input" placeholder="proposal_name" [value]="manualName()"
            (input)="manualName.set($any($event.target).value)"
            (keydown.enter)="loadManual()" />
          <button class="btn-primary"
            [disabled]="!manualProposer() || !manualName() || manualLoading()"
            (click)="loadManual()">
            {{ manualLoading() ? 'LOADING…' : 'LOAD' }}
          </button>
        </div>
        @if (manualError()) {
          <p class="error">{{ manualError() }}</p>
        }
      </details>

      @if (loading()) {
        <div class="state-card loading">Loading proposals…</div>
      } @else if (source() === 'none' && manualProposals().length === 0) {
        <div class="state-card warn">
          <h3>History API unavailable</h3>
          <p>
            {{ wallet.activeChain().name }} doesn't have a Hyperion endpoint configured, so
            we can't list proposals across the network. Use the lookup form above to inspect
            and approve a known proposal by its proposer + name.
          </p>
        </div>
      } @else if (proposals().length === 0 && manualProposals().length === 0) {
        <div class="state-card">
          <h3>Inbox empty</h3>
          <p>
            @if (source() === 'scan') {
              Walked every proposer scope — nothing awaiting your signature.
            } @else {
              No proposals awaiting your approval.
            }
          </p>
        </div>
      }

      @if (displayedProposals().length > 0) {
        <ul class="prop-list">
          @for (p of displayedProposals(); track trackBy(p)) {
            <li class="prop-card" [class.manual]="isManual(p)">
              @if (isManual(p)) {
                <div class="manual-badge">
                  <span>Loaded via lookup</span>
                  <button class="btn-ghost btn-tiny" (click)="dismissManual(p)">DISMISS</button>
                </div>
              }
              <div class="prop-head">
                <div class="prop-id">
                  <code class="prop-name">{{ p.proposal_name }}</code>
                  <span class="prop-sep">·</span>
                  <span class="prop-proposer">by {{ p.proposer }}</span>
                </div>
                <div class="prop-status">
                  <span class="approval-count">
                    {{ p.provided_approvals.length }} / {{ p.requested_approvals.length + p.provided_approvals.length }}
                  </span>
                  @if (proposedAt(p); as pa) {
                    <span class="proposed-at" [title]="pa.absolute">proposed {{ pa.relative }}</span>
                  }
                  @if (expiresAt(p); as ex) {
                    <span class="expiry" [class.urgent]="ex.soon" [class.expired]="ex.expired" [title]="ex.absolute">
                      {{ ex.expired ? 'expired ' + ex.relative : 'expires ' + ex.relative }}
                    </span>
                  }
                </div>
              </div>

              @if (actionsFor(p); as actions) {
                <details class="prop-actions" [open]="detailsOpen().has(trackBy(p))">
                  <summary (click)="onToggleDetails(p, $event)">
                    {{ actions.length }} action(s)
                  </summary>
                  @for (a of actions; track $index) {
                    <div class="action-row">
                      <code class="action-contract">{{ a.account }}::{{ a.name }}</code>
                      <div class="action-auth">
                        @for (auth of a.authorization; track $index) {
                          <code>{{ auth.actor }}&#64;{{ auth.permission }}</code>
                        }
                      </div>
                      <pre class="action-data">{{ prettyJson(a.data) }}</pre>
                    </div>
                  }
                </details>
              } @else {
                <div class="prop-actions-placeholder">
                  @if (loadingDetails().has(trackBy(p))) {
                    <span class="muted">Decoding actions…</span>
                  } @else if (detailsError().get(trackBy(p)); as err) {
                    <span class="muted error-inline">{{ err }}</span>
                    <button class="btn-ghost btn-tiny" (click)="loadDetails(p)">RETRY</button>
                  } @else {
                    <button class="btn-ghost btn-tiny" (click)="loadDetails(p)">DECODE ACTIONS</button>
                  }
                </div>
              }

              <div class="approvals-summary">
                <div class="approvals-group">
                  <span class="approvals-label">Approved</span>
                  @for (a of p.provided_approvals; track a.actor) {
                    <code class="approver">{{ a.actor }}&#64;{{ a.permission }}</code>
                  }
                  @if (p.provided_approvals.length === 0) {
                    <span class="muted">none yet</span>
                  }
                </div>
                <div class="approvals-group">
                  <span class="approvals-label">Still pending</span>
                  @for (a of p.requested_approvals; track a.actor) {
                    <code class="approver pending" [class.me]="a.actor === me()">
                      {{ a.actor }}&#64;{{ a.permission }}
                    </code>
                  }
                </div>
              </div>

              <div class="prop-actions-bar">
                <button class="btn-primary" (click)="approve(p)" [disabled]="busy()">APPROVE</button>
                <button class="btn-ghost" (click)="exec(p)" [disabled]="busy() || !canExec(p)"
                  [title]="canExec(p) ? '' : 'Not enough approvals yet'">EXECUTE</button>
                <button class="btn-ghost btn-danger-text" (click)="unapprove(p)" [disabled]="busy()"
                  [title]="'Use if you previously approved and want to withdraw'">UNAPPROVE</button>
              </div>
            </li>
          }
        </ul>
      }

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
    </div>
  `,
  styles: [`
    .msig-view { max-width: 900px; }
    h2 { font-size: 24px; margin-bottom: var(--sp-2); }
    .subtitle { font-size: 13px; color: var(--text-muted); margin-bottom: var(--sp-5); }
    .subtitle strong { color: var(--text-bright); }
    .source-hint { font-size: 11px; color: var(--text-disabled); margin-left: var(--sp-1); }

    .state-card {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      padding: var(--sp-6);
      text-align: center;
    }
    .state-card.loading { color: var(--text-muted); }
    .state-card.warn {
      text-align: left;
      border: 1px solid rgba(245, 166, 35, 0.35);
      background: rgba(245, 166, 35, 0.06);
    }
    .state-card h3 { font-size: 15px; margin-bottom: var(--sp-2); }
    .state-card p { font-size: 13px; color: var(--text-muted); margin-bottom: var(--sp-4); }

    .manual-lookup {
      display: flex;
      gap: var(--sp-2);
      align-items: center;
    }
    .form-input {
      flex: 1;
      padding: var(--sp-3);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-hover);
      color: var(--text-bright);
      font-family: var(--font-data);
      font-size: 13px;
    }
    .form-input:focus { outline: none; border-color: var(--accent); }

    .prop-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }
    .prop-card {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      padding: var(--sp-5);
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }

    .prop-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--sp-3);
      flex-wrap: wrap;
    }
    .prop-id { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
    .prop-name {
      font-family: var(--font-data);
      font-size: 14px;
      font-weight: 600;
      color: var(--text-bright);
    }
    .prop-sep { color: var(--text-disabled); }
    .prop-proposer { font-size: 13px; color: var(--text-muted); }
    .prop-status { display: flex; gap: var(--sp-3); align-items: center; font-size: 12px; }
    .approval-count {
      font-family: var(--font-data);
      padding: 2px 8px;
      border-radius: var(--radius-full);
      background: var(--accent-muted);
      color: var(--accent);
    }
    .expiry, .proposed-at { color: var(--text-muted); }
    .expiry.urgent { color: var(--caution); font-weight: 500; }
    .expiry.expired { color: var(--negative); font-weight: 500; }

    .prop-actions-placeholder {
      display: flex;
      gap: var(--sp-2);
      align-items: center;
      padding: var(--sp-2);
      border: 1px dashed var(--border-subtle);
      border-radius: var(--radius-sm);
      font-size: 12px;
    }
    .btn-tiny { padding: 2px var(--sp-2); font-size: 10px; }
    .error-inline { color: var(--negative); }

    .manual-panel {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      padding: var(--sp-3) var(--sp-4);
      margin-bottom: var(--sp-4);
    }
    .manual-panel summary {
      cursor: pointer;
      user-select: none;
      font-size: 13px;
      color: var(--text-bright);
      display: flex;
      gap: var(--sp-2);
      align-items: baseline;
    }
    .subtitle-inline { color: var(--text-muted); font-size: 11px; font-weight: 400; }
    .manual-panel[open] .manual-lookup { margin-top: var(--sp-3); }

    .prop-card.manual {
      border: 1px solid rgba(124, 92, 255, 0.3);
      background: linear-gradient(var(--bg-raised), var(--bg-raised)) padding-box,
                  rgba(124, 92, 255, 0.08);
    }
    .manual-badge {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding-bottom: var(--sp-2);
      border-bottom: 1px solid var(--border-subtle);
    }

    .prop-actions {
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      padding: var(--sp-3);
    }
    .prop-actions summary {
      font-size: 12px;
      color: var(--text-muted);
      cursor: pointer;
      user-select: none;
    }
    .action-row {
      margin-top: var(--sp-3);
      padding-top: var(--sp-3);
      border-top: 1px solid var(--border-subtle);
    }
    .action-row:first-of-type { border-top: none; padding-top: 0; }
    .action-contract {
      display: inline-block;
      font-family: var(--font-data);
      font-size: 13px;
      color: var(--accent);
      margin-bottom: var(--sp-1);
    }
    .action-auth { display: flex; gap: var(--sp-2); flex-wrap: wrap; margin-bottom: var(--sp-2); }
    .action-auth code {
      font-family: var(--font-data);
      font-size: 11px;
      color: var(--text-muted);
    }
    .action-data {
      font-family: var(--font-data);
      font-size: 11px;
      background: var(--bg-base);
      padding: var(--sp-2);
      border-radius: var(--radius-xs);
      overflow-x: auto;
      color: var(--text-body);
    }

    .approvals-summary {
      display: flex;
      gap: var(--sp-5);
      flex-wrap: wrap;
      font-size: 12px;
    }
    .approvals-group { display: flex; gap: var(--sp-2); align-items: center; flex-wrap: wrap; }
    .approvals-label {
      font-size: 11px;
      font-weight: 500;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .approver {
      font-family: var(--font-data);
      font-size: 11px;
      padding: 2px 6px;
      border-radius: var(--radius-xs);
      background: rgba(45, 212, 168, 0.1);
      color: var(--positive);
    }
    .approver.pending { background: var(--bg-hover); color: var(--text-muted); }
    .approver.me { outline: 1px solid var(--accent); color: var(--accent); }
    .muted { color: var(--text-disabled); font-size: 11px; }

    .prop-actions-bar {
      display: flex;
      gap: var(--sp-2);
      justify-content: flex-end;
      padding-top: var(--sp-2);
      border-top: 1px solid var(--border-subtle);
    }

    .btn-primary {
      padding: var(--sp-2) var(--sp-4);
      border: none; border-radius: var(--radius-sm);
      background: var(--accent); color: #fff;
      font-family: var(--font-body); font-size: 12px;
      font-weight: 500; letter-spacing: 0.5px;
      text-transform: uppercase; cursor: pointer;
    }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-ghost {
      padding: var(--sp-2) var(--sp-3);
      border: 1px solid var(--accent);
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--accent);
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      cursor: pointer;
    }
    .btn-ghost:hover { background: var(--accent-muted); }
    .btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-danger-text { border-color: var(--negative); color: var(--negative); }
    .btn-danger-text:hover { background: rgba(240, 68, 56, 0.1); }

    .error { color: var(--negative); font-size: 12px; margin-top: var(--sp-3); }
  `],
})
export class MsigInboxComponent {
  loading = signal(false);
  busy = signal(false);
  source = signal<'hyperion' | 'scan' | 'none' | null>(null);
  proposals = signal<MsigProposal[]>([]);
  error = signal('');

  manualProposer = signal('');
  manualName = signal('');
  manualLoading = signal(false);
  manualError = signal('');
  /** Proposals explicitly loaded via the lookup form; shown alongside the inbox. */
  manualProposals = signal<MsigProposal[]>([]);

  /** Lazily-loaded decoded details, keyed by `${proposer}:${proposal_name}`. */
  details = signal<Map<string, ProposalDetails>>(new Map());
  loadingDetails = signal<Set<string>>(new Set());
  detailsError = signal<Map<string, string>>(new Map());
  detailsOpen = signal<Set<string>>(new Set());

  me = computed(() => this.wallet.selectedAccount()?.name ?? '');

  /** Manual lookups rendered above the auto-loaded inbox. */
  displayedProposals = computed(() => [...this.manualProposals(), ...this.proposals()]);

  isManual(p: MsigProposal): boolean {
    const key = this.trackBy(p);
    return this.manualProposals().some(x => this.trackBy(x) === key);
  }

  constructor(
    public wallet: WalletStateService,
    private ipc: TauriIpcService,
    private tx: TransactionService,
  ) {
    effect(() => {
      const acct = this.wallet.selectedAccount();
      if (!acct) return;
      // Wipe all per-account state before refetching so nothing from the
      // previous account lingers in the UI while the new load is in flight.
      this.resetState();
      this.load(acct.chainId, acct.name);
    });
  }

  /** Monotonically increasing token — any in-flight load whose token is older than
   *  `activeLoadToken` has been superseded and must not mutate state. Prevents a
   *  stale response from overwriting fresh data when the user switches fast. */
  private activeLoadToken = 0;

  private resetState() {
    this.activeLoadToken++;
    this.proposals.set([]);
    this.manualProposals.set([]);
    this.source.set(null);
    this.error.set('');
    this.details.set(new Map());
    this.detailsOpen.set(new Set());
    this.detailsError.set(new Map());
    this.loadingDetails.set(new Set());
    this.manualProposer.set('');
    this.manualName.set('');
    this.manualError.set('');
    this.manualLoading.set(false);
  }

  private async load(chainId: string, account: string) {
    const token = ++this.activeLoadToken;
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.ipc.getMsigInbox(chainId, account, 50);
      // Drop the response if the user has switched accounts since the call fired.
      if (token !== this.activeLoadToken) return;
      this.source.set(result.source);
      this.proposals.set(result.proposals as MsigProposal[]);
    } catch (e: any) {
      if (token !== this.activeLoadToken) return;
      this.error.set(e?.toString() ?? 'Failed to load inbox');
      this.proposals.set([]);
    } finally {
      if (token === this.activeLoadToken) this.loading.set(false);
    }
  }

  trackBy(p: MsigProposal) { return `${p.proposer}:${p.proposal_name}`; }

  canExec(p: MsigProposal): boolean {
    return p.requested_approvals.length === 0 && p.provided_approvals.length > 0;
  }

  /** Decoded actions come from either the Hyperion payload or the lazy-loaded fallback. */
  actionsFor(p: MsigProposal): MsigAction[] | null {
    const fromHyperion = p.trx?.actions ?? p.transaction?.actions;
    if (fromHyperion && fromHyperion.length > 0) return fromHyperion;
    const loaded = this.details().get(this.trackBy(p));
    return loaded?.actions ?? null;
  }

  /** Extract a proposed-at date: Hyperion's `@timestamp` or `block_time`. */
  proposedAt(p: MsigProposal): { relative: string; absolute: string } | null {
    const ts = p['@timestamp'] ?? p.block_time;
    if (!ts) return null;
    const date = new Date(ts.endsWith('Z') ? ts : ts + 'Z');
    if (isNaN(date.getTime())) return null;
    return {
      relative: relativeTime(date, new Date()),
      absolute: date.toLocaleString(),
    };
  }

  /** Expiration comes from Hyperion's trx OR the lazily-loaded details. */
  expiresAt(p: MsigProposal): { relative: string; absolute: string; soon: boolean; expired: boolean } | null {
    const fromHyperion = p.trx?.expiration ?? p.transaction?.expiration;
    let expMs: number | null = null;
    if (fromHyperion) {
      const d = new Date(fromHyperion.endsWith('Z') ? fromHyperion : fromHyperion + 'Z');
      if (!isNaN(d.getTime())) expMs = d.getTime();
    }
    if (expMs === null) {
      const loaded = this.details().get(this.trackBy(p));
      if (loaded?.expiration) expMs = loaded.expiration * 1000;
    }
    if (expMs === null) return null;
    const now = Date.now();
    const delta = expMs - now;
    const expired = delta <= 0;
    return {
      relative: relativeTime(new Date(expMs), new Date(now)),
      absolute: new Date(expMs).toLocaleString(),
      soon: !expired && delta < 24 * 3600_000,
      expired,
    };
  }

  onToggleDetails(p: MsigProposal, ev: Event) {
    const key = this.trackBy(p);
    const open = this.detailsOpen();
    const next = new Set(open);
    if (open.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
      // If we don't have actions yet, kick off decode.
      if (!this.actionsFor(p)) {
        ev.preventDefault();
        this.loadDetails(p);
      }
    }
    this.detailsOpen.set(next);
  }

  async loadDetails(p: MsigProposal) {
    const key = this.trackBy(p);
    const acct = this.wallet.selectedAccount();
    if (!acct) return;

    const loading = new Set(this.loadingDetails());
    loading.add(key);
    this.loadingDetails.set(loading);

    const errs = new Map(this.detailsError());
    errs.delete(key);
    this.detailsError.set(errs);

    try {
      const res = await this.ipc.getMsigProposalDetails(acct.chainId, p.proposer, p.proposal_name);
      const map = new Map(this.details());
      map.set(key, res);
      this.details.set(map);
      // Auto-expand the details block once we have data.
      const open = new Set(this.detailsOpen());
      open.add(key);
      this.detailsOpen.set(open);
    } catch (e: any) {
      const errs = new Map(this.detailsError());
      errs.set(key, e?.toString() ?? 'Failed to decode');
      this.detailsError.set(errs);
    } finally {
      const loading = new Set(this.loadingDetails());
      loading.delete(key);
      this.loadingDetails.set(loading);
    }
  }

  prettyJson(v: any): string {
    try { return JSON.stringify(v, null, 2); }
    catch { return String(v); }
  }

  private auth() {
    return [{ actor: this.me(), permission: 'active' }];
  }

  private async pushMsigAction(
    title: string,
    name: 'approve' | 'unapprove' | 'exec',
    proposer: string,
    proposalName: string,
  ) {
    const acct = this.wallet.selectedAccount();
    if (!acct) return;

    const data: Record<string, any> = { proposer, proposal_name: proposalName };
    if (name === 'approve' || name === 'unapprove') {
      data['level'] = { actor: this.me(), permission: 'active' };
    } else {
      data['executer'] = this.me();
    }

    // FIO's msig contract requires `max_fee` on every action (fee-metered chain).
    // Query the actual fee and cap at 2x, with a generous floor in case the fee
    // lookup returns 0/unset.
    if (this.wallet.isFio()) {
      const endPoint = `msig_${name}`; // msig_approve / msig_unapprove / msig_exec
      let maxFee = 1_000_000_000; // 1 FIO floor in SUFs (9 decimals)
      try {
        const { fee } = await this.ipc.fioGetFee(acct.chainId, endPoint, '');
        if (fee > 0) maxFee = Math.max(fee * 2, maxFee);
      } catch { /* keep floor */ }
      data['max_fee'] = maxFee;
    }

    this.busy.set(true);
    this.error.set('');
    try {
      const keys = await this.ipc.listPublicKeys(acct.chainId);
      if (keys.length === 0) {
        this.error.set('No signing keys available for this account');
        return;
      }
      const ok = await this.tx.confirm({
        chainId: acct.chainId,
        publicKey: keys[0],
        title,
        actions: [{
          account: 'eosio.msig',
          name,
          authorization: this.auth(),
          data,
        }],
      });
      if (ok) {
        // 1. Optimistic update for instant feedback — Hyperion lags a few seconds
        //    behind chain state and the inbox reload might still show the old list.
        this.applyOptimistic(proposer, proposalName, name);
        // 2. Fire authoritative refetches in the background so the UI becomes
        //    correct once the chain/indexer catches up.
        this.scheduleRefresh(acct.chainId, acct.name, proposer, proposalName, name);
      }
    } catch (e: any) {
      this.error.set(e?.toString() ?? `Failed to ${name}`);
    } finally {
      this.busy.set(false);
    }
  }

  /** Move `me` between requested/provided locally so the card updates before any refetch. */
  private applyOptimistic(
    proposer: string,
    proposalName: string,
    action: 'approve' | 'unapprove' | 'exec',
  ) {
    const key = `${proposer}:${proposalName}`;
    const mutate = (p: MsigProposal): MsigProposal => {
      if (this.trackBy(p) !== key) return p;
      if (action === 'exec') {
        return { ...p, executed: true };
      }
      const actor = this.me();
      const nowIso = new Date().toISOString().replace(/\.\d+Z$/, '');

      if (action === 'approve') {
        const entry = p.requested_approvals.find(a => a.actor === actor);
        const perm = entry?.permission ?? 'active';
        return {
          ...p,
          requested_approvals: p.requested_approvals.filter(a => a.actor !== actor),
          provided_approvals: [
            ...p.provided_approvals.filter(a => a.actor !== actor),
            { actor, permission: perm, time: nowIso },
          ],
        };
      }
      // unapprove: move back to requested
      const entry = p.provided_approvals.find(a => a.actor === actor);
      const perm = entry?.permission ?? 'active';
      return {
        ...p,
        provided_approvals: p.provided_approvals.filter(a => a.actor !== actor),
        requested_approvals: [
          ...p.requested_approvals.filter(a => a.actor !== actor),
          { actor, permission: perm, time: nowIso },
        ],
      };
    };

    this.proposals.update(list => list.map(mutate));
    this.manualProposals.update(list => list.map(mutate));
  }

  /** Authoritative refetch scheduled after a successful action. */
  private scheduleRefresh(
    chainId: string,
    account: string,
    proposer: string,
    proposalName: string,
    action: 'approve' | 'unapprove' | 'exec',
  ) {
    const key = `${proposer}:${proposalName}`;

    if (action === 'exec') {
      // Executed proposals are deleted from the msig table — drop locally too.
      this.proposals.update(list => list.filter(p => this.trackBy(p) !== key));
      this.manualProposals.update(list => list.filter(p => this.trackBy(p) !== key));
      this.load(chainId, account).catch(() => {});
      return;
    }

    // Short delay so Hyperion / table state has time to catch up, otherwise the
    // refetch would overwrite our optimistic update with stale data.
    setTimeout(() => {
      // Refresh the inbox list — filtering is re-applied, so the proposal may
      // disappear from the list (it no longer needs `account`'s signature).
      this.load(chainId, account).catch(() => {});
      // If the same proposal is also showing as a manual lookup, refresh its
      // approvals in-place so the card stays but shows fresh state.
      const inManual = this.manualProposals().some(p => this.trackBy(p) === key);
      if (inManual) {
        this.refreshManualProposal(chainId, proposer, proposalName).catch(() => {});
      }
    }, 1500);
  }

  private async refreshManualProposal(chainId: string, proposer: string, proposalName: string) {
    const d = await this.ipc.getMsigProposalDetails(chainId, proposer, proposalName);
    const key = `${proposer}:${proposalName}`;
    this.manualProposals.update(list => list.map(p => {
      if (this.trackBy(p) !== key) return p;
      return {
        ...p,
        requested_approvals: d.requested_approvals,
        provided_approvals: d.provided_approvals,
      };
    }));
    // Also refresh the details cache (actions/expiration) in case it was re-proposed.
    const map = new Map(this.details());
    map.set(key, { expiration: d.expiration, actions: d.actions });
    this.details.set(map);
  }

  approve(p: MsigProposal) {
    this.pushMsigAction(`Approve ${p.proposer}::${p.proposal_name}`, 'approve', p.proposer, p.proposal_name);
  }

  unapprove(p: MsigProposal) {
    this.pushMsigAction(`Unapprove ${p.proposer}::${p.proposal_name}`, 'unapprove', p.proposer, p.proposal_name);
  }

  exec(p: MsigProposal) {
    this.pushMsigAction(`Execute ${p.proposer}::${p.proposal_name}`, 'exec', p.proposer, p.proposal_name);
  }

  async loadManual() {
    const proposer = this.manualProposer().trim();
    const name = this.manualName().trim();
    const acct = this.wallet.selectedAccount();
    if (!proposer || !name || !acct) return;

    // Prevent duplicate load of the same proposal.
    const key = `${proposer}:${name}`;
    if (this.manualProposals().some(p => this.trackBy(p) === key)
        || this.proposals().some(p => this.trackBy(p) === key)) {
      this.manualError.set('Already loaded above');
      return;
    }

    this.manualLoading.set(true);
    this.manualError.set('');
    try {
      const d = await this.ipc.getMsigProposalDetails(acct.chainId, proposer, name);
      // Reuse the details cache so the card renders immediately without a second fetch.
      const map = new Map(this.details());
      map.set(key, { expiration: d.expiration, actions: d.actions });
      this.details.set(map);

      const proposal: MsigProposal = {
        proposer,
        proposal_name: name,
        requested_approvals: d.requested_approvals,
        provided_approvals: d.provided_approvals,
        trx: {
          expiration: new Date(d.expiration * 1000).toISOString().replace(/\.\d+Z$/, ''),
          actions: d.actions,
        },
      };
      this.manualProposals.update(list => [proposal, ...list]);
      // Expand the actions panel by default for manual lookups.
      const open = new Set(this.detailsOpen());
      open.add(key);
      this.detailsOpen.set(open);

      this.manualProposer.set('');
      this.manualName.set('');
    } catch (e: any) {
      this.manualError.set(e?.toString() ?? 'Failed to load proposal');
    } finally {
      this.manualLoading.set(false);
    }
  }

  dismissManual(p: MsigProposal) {
    const key = this.trackBy(p);
    this.manualProposals.update(list => list.filter(x => this.trackBy(x) !== key));
  }
}
