import { Component, computed, effect, signal } from '@angular/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
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
      <!-- ── Top Header ── -->
      <header class="page-header">
        <div class="header-title-row">
          <h2>Multisig Inbox</h2>
          <span class="header-sep">·</span>
          <span class="header-meta">{{ me() }} · {{ wallet.activeChain().name }}</span>
          @if (source() === 'cached') {
            <span class="source-pill" title="Loaded from cache — status refreshed">Cached</span>
          } @else if (source() === 'scan') {
            <span class="source-pill active" title="Fresh on-chain scan">Scanned</span>
          } @else if (source() === 'hyperion') {
            <span class="source-pill active">Indexed</span>
          }
        </div>
        <div class="toolbar">
          @if (source() !== 'hyperion') {
            <button class="btn-refresh" type="button" (click)="rescanScopes()"
              [disabled]="scanning() || loading() || busy()"
              title="Walk proposer scopes on-chain to find proposals awaiting your signature">
              <svg [class.spinning]="scanning()" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              <span>{{ scanning() ? 'Scanning…' : 'Scan Scopes' }}</span>
            </button>
          }
        </div>
      </header>

      @if (scanning()) {
        <div class="scan-progress">
          <div class="scan-progress-bar"><div class="scan-progress-stripes"></div></div>
          <div class="scan-progress-text">
            Scanned <strong>{{ scanProgress().scanned }}</strong> scopes ·
            found <strong>{{ scanProgress().found }}</strong> awaiting you
          </div>
        </div>
      }

      <!-- Manual lookup — always available, primary fallback when no Hyperion -->
      <details class="manual-panel" [open]="source() === 'none'">
        <summary>
          <span class="summary-title">Look Up Proposal by Name</span>
          <span class="subtitle-inline">Direct on-chain query</span>
        </summary>
        <div class="manual-lookup">
          <input class="form-input" placeholder="Proposer account" [value]="manualProposer()"
            (input)="manualProposer.set($any($event.target).value)"
            (keydown.enter)="loadManual()" />
          <input class="form-input" placeholder="Proposal name" [value]="manualName()"
            (input)="manualName.set($any($event.target).value)"
            (keydown.enter)="loadManual()" />
          <button class="btn-primary"
            [disabled]="!manualProposer() || !manualName() || manualLoading()"
            (click)="loadManual()">
            {{ manualLoading() ? 'Loading…' : 'Load' }}
          </button>
        </div>
        @if (manualError()) {
          <p class="error">{{ manualError() }}</p>
        }
      </details>

      @if (loading()) {
        <div class="state-card loading">Loading proposals…</div>
      } @else if (source() === 'none' && manualProposals().length === 0 && !scanning()) {
        <div class="state-card warn">
          <div class="warn-row">
            <div>
              <h3>On-Chain Proposal Discovery</h3>
              <p>
                {{ wallet.activeChain().name }} does not use a Hyperion indexer. Scan proposer scopes directly on-chain or look up a proposal above.
              </p>
            </div>
            <button class="btn-primary" (click)="rescanScopes()" [disabled]="scanning()">
              Scan Scopes Now
            </button>
          </div>
        </div>
      } @else if (proposals().length === 0 && manualProposals().length === 0 && !scanning()) {
        <div class="state-card">
          <h3>Inbox Clear</h3>
          <p>
            @if (source() === 'scan') {
              Walked every proposer scope — no proposals are awaiting your signature.
            } @else if (source() === 'cached') {
              No cached proposals need your signature right now.
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
                  <button class="btn-ghost btn-tiny" (click)="dismissManual(p)">Dismiss</button>
                </div>
              }
              <div class="prop-head">
                <div class="prop-id">
                  <code class="prop-name">{{ p.proposal_name }}</code>
                  <span class="prop-sep">·</span>
                  <span class="prop-proposer">by <code>{{ p.proposer }}</code></span>
                </div>
                <div class="prop-status">
                  <span class="approval-count">
                    {{ p.provided_approvals.length }} / {{ p.requested_approvals.length + p.provided_approvals.length }} approved
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
                    {{ actions.length }} action{{ actions.length === 1 ? '' : 's' }}
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
                    <button class="btn-ghost btn-tiny" (click)="loadDetails(p)">Retry</button>
                  } @else {
                    <button class="btn-ghost btn-tiny" (click)="loadDetails(p)">Decode Actions</button>
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
                  <span class="approvals-label">Pending</span>
                  @for (a of p.requested_approvals; track a.actor) {
                    <code class="approver pending" [class.me]="a.actor === me()">
                      {{ a.actor }}&#64;{{ a.permission }}
                    </code>
                  }
                </div>
              </div>

              <div class="prop-actions-bar">
                <button class="btn-primary" (click)="approve(p)" [disabled]="busy()">Approve</button>
                <button class="btn-ghost" (click)="exec(p)" [disabled]="busy() || !canExec(p)"
                  [title]="canExec(p) ? '' : 'Not enough approvals yet'">Execute</button>
                <button class="btn-ghost btn-danger-text" (click)="unapprove(p)" [disabled]="busy()"
                  [title]="'Use if you previously approved and want to withdraw'">Unapprove</button>
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
    .msig-view {
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

    .source-pill {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: var(--radius-full);
      background: var(--bg-raised);
      border: 1px solid var(--border-subtle);
      font-family: var(--font-data);
      font-size: 10.5px;
      font-weight: 600;
      color: var(--text-muted);
    }
    .source-pill.active {
      color: var(--accent-text);
      border-color: color-mix(in srgb, var(--accent) 30%, var(--border-subtle));
    }

    .toolbar {
      display: flex;
      gap: var(--sp-2);
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

    .scan-progress {
      padding: var(--sp-3) var(--sp-4);
      background: var(--bg-raised);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
    }
    .scan-progress-bar {
      height: 4px;
      background: var(--bg-hover);
      border-radius: var(--radius-full);
      overflow: hidden;
      margin-bottom: var(--sp-2);
    }
    .scan-progress-stripes {
      height: 100%;
      background: linear-gradient(
        90deg,
        transparent 0%,
        var(--accent) 25%,
        var(--accent) 75%,
        transparent 100%
      );
      background-size: 200% 100%;
      animation: scan-slide 1.4s linear infinite;
    }
    @keyframes scan-slide {
      0%   { background-position: -100% 0; }
      100% { background-position:  100% 0; }
    }
    .scan-progress-text {
      font-size: 12px;
      color: var(--text-muted);
      font-family: var(--font-data);
    }
    .scan-progress-text strong { color: var(--text-bright); }

    .state-card {
      background: var(--bg-raised);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: var(--sp-5);
      text-align: center;
    }
    .state-card.loading { color: var(--text-muted); }
    .state-card.warn {
      text-align: left;
      border-color: rgba(245, 166, 35, 0.35);
      background: rgba(245, 166, 35, 0.05);
    }
    .warn-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--sp-4);
      flex-wrap: wrap;
    }
    .state-card h3 { font-size: 14px; font-weight: 600; color: var(--text-bright); margin: 0 0 4px; }
    .state-card p { font-size: 12.5px; color: var(--text-muted); margin: 0; }

    .manual-panel {
      background: var(--bg-raised);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: var(--sp-3) var(--sp-4);
    }
    .manual-panel summary {
      cursor: pointer;
      user-select: none;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-bright);
      display: flex;
      gap: var(--sp-2);
      align-items: baseline;
    }
    .subtitle-inline { color: var(--text-muted); font-size: 11px; font-weight: 400; font-family: var(--font-data); }
    .manual-panel[open] .manual-lookup { margin-top: var(--sp-3); }

    .manual-lookup {
      display: flex;
      gap: var(--sp-2);
      align-items: center;
    }
    .form-input {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-base);
      color: var(--text-bright);
      font-family: var(--font-data);
      font-size: 12.5px;
    }
    .form-input:focus { outline: none; border-color: var(--accent); }

    .prop-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
      padding: 0;
      margin: 0;
    }
    .prop-card {
      background: var(--bg-raised);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: var(--sp-4) var(--sp-5);
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
      font-weight: 700;
      color: var(--text-bright);
    }
    .prop-sep { color: var(--text-muted); }
    .prop-proposer { font-size: 12.5px; color: var(--text-muted); }
    .prop-proposer code { font-family: var(--font-data); color: var(--accent-text); }
    .prop-status { display: flex; gap: var(--sp-3); align-items: center; font-size: 12px; }
    .approval-count {
      font-family: var(--font-data);
      font-variant-numeric: tabular-nums;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: var(--radius-full);
      background: var(--accent-muted);
      color: var(--accent-text);
    }
    .expiry, .proposed-at { color: var(--text-muted); font-family: var(--font-data); font-size: 11px; }
    .expiry.urgent { color: var(--caution); font-weight: 600; }
    .expiry.expired { color: var(--negative); font-weight: 600; }

    .prop-actions-placeholder {
      display: flex;
      gap: var(--sp-2);
      align-items: center;
      padding: var(--sp-2) var(--sp-3);
      border: 1px dashed var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-base);
      font-size: 12px;
    }
    .btn-tiny { padding: 3px 8px; font-size: 10px; }
    .error-inline { color: var(--negative); }

    .prop-card.manual {
      border-color: color-mix(in srgb, var(--accent) 35%, var(--border-subtle));
    }
    .manual-badge {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10.5px;
      font-weight: 600;
      color: var(--accent-text);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding-bottom: var(--sp-2);
      border-bottom: 1px solid var(--border-subtle);
    }

    .prop-actions {
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-base);
      padding: var(--sp-3);
    }
    .prop-actions summary {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-body);
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
      font-size: 12.5px;
      font-weight: 600;
      color: var(--accent-text);
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
      background: var(--bg-raised);
      padding: var(--sp-2);
      border-radius: 4px;
      border: 1px solid var(--border-subtle);
      overflow-x: auto;
      color: var(--text-body);
      margin: 0;
    }

    .approvals-summary {
      display: flex;
      gap: var(--sp-4);
      flex-wrap: wrap;
      font-size: 12px;
    }
    .approvals-group { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .approvals-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .approver {
      font-family: var(--font-data);
      font-size: 11px;
      padding: 2px 7px;
      border-radius: 4px;
      background: rgba(45, 212, 168, 0.12);
      color: var(--positive);
    }
    .approver.pending { background: var(--bg-base); border: 1px solid var(--border-subtle); color: var(--text-muted); }
    .approver.me { border-color: var(--accent); color: var(--accent-text); }
    .muted { color: var(--text-muted); font-size: 11px; }

    .prop-actions-bar {
      display: flex;
      gap: var(--sp-2);
      justify-content: flex-end;
      padding-top: var(--sp-3);
      border-top: 1px solid var(--border-subtle);
    }

    .btn-primary {
      padding: 8px 16px;
      border: none; border-radius: var(--radius-sm);
      background: var(--accent); color: #fff;
      font-family: var(--font-body); font-size: 12px;
      font-weight: 600; letter-spacing: 0.04em;
      text-transform: uppercase; cursor: pointer;
    }
    .btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
    .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

    .btn-ghost {
      padding: 7px 12px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-base);
      color: var(--accent-text);
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      cursor: pointer;
    }
    .btn-ghost:hover:not(:disabled) { background: var(--accent-muted); border-color: var(--accent); }
    .btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-danger-text { border-color: rgba(248, 113, 113, 0.35); color: var(--negative); }
    .btn-danger-text:hover:not(:disabled) { background: rgba(240, 68, 56, 0.1); border-color: var(--negative); }

    .error { color: var(--negative); font-size: 12px; margin-top: var(--sp-2); }
  `],
})
export class MsigInboxComponent {
  loading = signal(false);
  busy = signal(false);
  source = signal<'hyperion' | 'scan' | 'cached' | 'none' | null>(null);
  /** True while a full scope-scan is in flight. */
  scanning = signal(false);
  scanProgress = signal<{ scanned: number; found: number; done: boolean }>({
    scanned: 0, found: 0, done: false,
  });
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
      this.resetState();
      this.load(acct.chainId, acct.name);
    });
  }

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
    this.scanProgress.set({ scanned: 0, found: 0, done: false });
  }

  private cacheKey(chainId: string) { return `msig_cache_${chainId}`; }

  private async load(chainId: string, account: string) {
    const token = ++this.activeLoadToken;
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.ipc.getMsigInbox(chainId, account, 50);
      if (token !== this.activeLoadToken) return;

      if (result.source === 'hyperion') {
        this.source.set('hyperion');
        this.proposals.set(result.proposals as MsigProposal[]);
        return;
      }

      const cached = await this.ipc.storeGet<{ proposer: string; proposal_name: string }[]>(
        this.cacheKey(chainId),
      );
      if (token !== this.activeLoadToken) return;

      if (!cached || cached.length === 0) {
        this.source.set('none');
        this.proposals.set([]);
        return;
      }

      const status = await this.ipc.refreshMsigStatus(chainId, account, cached);
      if (token !== this.activeLoadToken) return;
      this.source.set('cached');
      this.proposals.set(status.active as MsigProposal[]);

      if (status.dead.length > 0) {
        const deadSet = new Set(status.dead.map(d => `${d.proposer}:${d.proposal_name}`));
        const pruned = cached.filter(k => !deadSet.has(`${k.proposer}:${k.proposal_name}`));
        await this.ipc.storeSet(this.cacheKey(chainId), pruned);
      }
    } catch (e: any) {
      if (token !== this.activeLoadToken) return;
      this.error.set(e?.toString() ?? 'Failed to load inbox');
      this.proposals.set([]);
    } finally {
      if (token === this.activeLoadToken) this.loading.set(false);
    }
  }

  async rescanScopes() {
    const acct = this.wallet.selectedAccount();
    if (!acct || this.scanning()) return;

    this.scanning.set(true);
    this.scanProgress.set({ scanned: 0, found: 0, done: false });
    this.error.set('');
    this.proposals.set([]);

    const unlisteners: UnlistenFn[] = [];
    try {
      unlisteners.push(await listen<{ scanned: number; found: number; done: boolean }>(
        'msig-scan-progress',
        e => this.scanProgress.set(e.payload),
      ));
      unlisteners.push(await listen<MsigProposal>(
        'msig-scan-proposal',
        e => this.proposals.update(list => [...list, e.payload]),
      ));

      const result = await this.ipc.scanMsigScopesStream(acct.chainId, acct.name);
      this.source.set('scan');

      const keys = (result.proposals as MsigProposal[]).map(p => ({
        proposer: p.proposer,
        proposal_name: p.proposal_name,
      }));
      await this.ipc.storeSet(this.cacheKey(acct.chainId), keys);
    } catch (e: any) {
      this.error.set(e?.toString() ?? 'Scan failed');
    } finally {
      unlisteners.forEach(u => u());
      this.scanning.set(false);
    }
  }

  trackBy(p: MsigProposal) { return `${p.proposer}:${p.proposal_name}`; }

  canExec(p: MsigProposal): boolean {
    return p.requested_approvals.length === 0 && p.provided_approvals.length > 0;
  }

  actionsFor(p: MsigProposal): MsigAction[] | null {
    const fromHyperion = p.trx?.actions ?? p.transaction?.actions;
    if (fromHyperion && fromHyperion.length > 0) return fromHyperion;
    const loaded = this.details().get(this.trackBy(p));
    return loaded?.actions ?? null;
  }

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

    if (name === 'approve') {
      try {
        const details: any = await this.ipc.getMsigProposalDetails(acct.chainId, proposer, proposalName);
        if (details?.proposal_hash) data['proposal_hash'] = details.proposal_hash;
      } catch { /* approve without binding */ }
    }

    if (this.wallet.isFio()) {
      const endPoint = `msig_${name}`;
      let maxFee = 1_000_000_000;
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
          account: this.wallet.msigContract?.() ?? 'eosio.msig',
          name,
          authorization: this.auth(),
          data,
        }],
      });
      if (ok) {
        this.applyOptimistic(proposer, proposalName, name);
        this.scheduleRefresh(acct.chainId, acct.name, proposer, proposalName, name);
      }
    } catch (e: any) {
      this.error.set(e?.toString() ?? `Failed to ${name}`);
    } finally {
      this.busy.set(false);
    }
  }

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

  private scheduleRefresh(
    chainId: string,
    account: string,
    proposer: string,
    proposalName: string,
    action: 'approve' | 'unapprove' | 'exec',
  ) {
    const key = `${proposer}:${proposalName}`;

    if (action === 'exec') {
      this.proposals.update(list => list.filter(p => this.trackBy(p) !== key));
      this.manualProposals.update(list => list.filter(p => this.trackBy(p) !== key));
      this.load(chainId, account).catch(() => {});
      return;
    }

    setTimeout(() => {
      this.load(chainId, account).catch(() => {});
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
