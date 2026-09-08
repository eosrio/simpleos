import { Component, computed, effect, OnDestroy, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { open } from '@tauri-apps/plugin-shell';
import { WalletStateService } from '../../../core/services/wallet-state.service';
import { TransactionService } from '../../../core/services/transaction.service';
import { EvmBridgeService } from '../../../core/bridges/evm-bridge.service';
import { BridgeRequest, BridgeSnapshot, BridgeSubmission, decimal, uint, units } from '../../../core/bridges/bridge-model';

@Component({ selector: 'app-bridges', standalone: true, imports: [FormsModule],
  templateUrl: './bridges.html', styleUrl: './bridges.css' })
export class BridgesComponent implements OnDestroy {
  readonly availableRoutes = computed(() => this.bridges.routes(this.wallet.selectedAccount()?.chainId ?? ''));
  readonly routeId = signal('');
  readonly route = computed(() => this.availableRoutes().find(r => r.id === this.routeId()) ?? null);
  readonly snapshot = signal<BridgeSnapshot | null>(null);
  readonly tokenId = signal('');
  readonly token = computed(() => this.snapshot()?.tokens.find(t => t.id === this.tokenId()));
  readonly amount = signal('');
  readonly recipient = signal('');
  readonly direction = signal<'outbound' | 'inbound'>('outbound');
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly loadError = signal('');
  readonly error = signal('');
  readonly notice = signal('');
  readonly requests = signal<BridgeRequest[]>([]);
  readonly requestsLoading = signal(false);
  readonly requestsError = signal('');
  readonly moreRequests = signal(false);
  readonly submissions = signal<BridgeSubmission[]>([]);
  readonly latest = signal<BridgeSubmission | null>(null);
  readonly acknowledged = signal(false);
  readonly balance = computed(() => this.snapshot()?.balances[this.tokenId()]);
  readonly quote = computed(() => {
    const route = this.route(), snapshot = this.snapshot(), account = this.wallet.selectedAccount();
    if (!route || !snapshot || !account) return null;
    try { return this.bridges.adapter(route).quote(route, snapshot, this.tokenId(), account.name, this.amount(), this.recipient()); }
    catch { return null; }
  });
  readonly validation = computed(() => {
    const route = this.route(), snapshot = this.snapshot(), account = this.wallet.selectedAccount();
    if (!route || !snapshot || !account || (!this.amount() && !this.recipient())) return '';
    try { this.bridges.adapter(route).quote(route, snapshot, this.tokenId(), account.name, this.amount(), this.recipient()); return ''; }
    catch (e) { return this.message(e); }
  });
  readonly canReview = computed(() => !!this.quote() && this.acknowledged() && this.wallet.selectedAccount()?.mode === 'full' && !this.busy() && !this.loading());
  private identity = '';
  private generation = 0;
  private snapshotRequest = 0;
  private progressRequest = 0;
  private destroyed = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(public wallet: WalletStateService, private bridges: EvmBridgeService, private tx: TransactionService) {
    effect(() => {
      const account = this.wallet.selectedAccount();
      const identity = account ? `${account.chainId}:${account.name}` : '';
      untracked(() => {
        if (this.identity === identity) return;
        this.identity = identity;
        this.selectRoute(this.availableRoutes()[0]?.id ?? '');
      });
    });
  }
  ngOnDestroy() { this.destroyed = true; this.generation++; clearTimeout(this.timer); }
  private current(generation: number, identity: string) {
    const account = this.wallet.selectedAccount();
    return !this.destroyed && generation === this.generation && identity === `${account?.chainId}:${account?.name}`;
  }
  selectRoute(id: string) {
    this.generation++; clearTimeout(this.timer);
    this.routeId.set(id); this.snapshot.set(null); this.requests.set([]); this.submissions.set([]); this.latest.set(null);
    this.amount.set(''); this.recipient.set(''); this.tokenId.set(''); this.acknowledged.set(false);
    this.error.set(''); this.loadError.set(''); this.requestsError.set(''); this.notice.set('');
    this.loading.set(false); this.requestsLoading.set(false); this.busy.set(false);
    if (this.route()) {
      void this.refresh(); void this.refreshProgress(); void this.restoreSubmissions();
    }
  }
  async refresh() {
    const route = this.route(), account = this.wallet.selectedAccount();
    if (!route || !account) return;
    const generation = this.generation, identity = `${account.chainId}:${account.name}`, request = ++this.snapshotRequest;
    this.loading.set(true); this.loadError.set(''); this.snapshot.set(null);
    try {
      const data = await this.bridges.adapter(route).loadSnapshot(account.name);
      if (!this.current(generation, identity) || request !== this.snapshotRequest) return;
      this.snapshot.set(data);
      if (!data.tokens.some(t => t.id === this.tokenId() && t.active)) this.tokenId.set(data.tokens.find(t => t.active)?.id ?? '');
    } catch (e) { if (this.current(generation, identity) && request === this.snapshotRequest) this.loadError.set(`Could not load bridge data. ${this.message(e)}`); }
    finally { if (this.current(generation, identity) && request === this.snapshotRequest) this.loading.set(false); }
  }
  async refreshProgress() {
    const route = this.route(), account = this.wallet.selectedAccount();
    if (!route || !account) return;
    const generation = this.generation, identity = `${account.chainId}:${account.name}`, request = ++this.progressRequest;
    clearTimeout(this.timer); this.requestsLoading.set(true); this.requestsError.set('');
    try {
      const result = await this.bridges.adapter(route).loadRequests(account.name);
      if (!this.current(generation, identity) || request !== this.progressRequest) return;
      this.requests.set(result.requests); this.moreRequests.set(result.more);
    } catch (e) { if (this.current(generation, identity) && request === this.progressRequest) this.requestsError.set(`Progress could not be refreshed. ${this.message(e)}`); }
    finally {
      if (this.current(generation, identity) && request === this.progressRequest) {
        this.requestsLoading.set(false);
        // No overlapping polls; failed reads back off and navigation cancels the timer.
        this.timer = setTimeout(() => void this.refreshProgress(), this.requestsError() ? 60_000 : 30_000);
      }
    }
  }
  private async restoreSubmissions() {
    const route = this.route(), account = this.wallet.selectedAccount();
    if (!route || !account) return;
    const generation = this.generation, identity = `${account.chainId}:${account.name}`;
    try { const items = await this.bridges.submissions(route, account.name); if (this.current(generation, identity)) this.submissions.set(items); }
    catch { if (this.current(generation, identity)) this.notice.set('Saved submission details could not be loaded. Live bridge requests are still available.'); }
  }
  useMaximum() {
    const token = this.token(), balance = this.balance();
    if (!token || balance === undefined) return;
    const divisor = 10n ** BigInt(Math.max(0, token.precision - token.evmPrecision));
    const available = units(balance, token.precision), maximum = uint(token.maximum);
    this.amount.set(decimal((available < maximum ? available : maximum) / divisor * divisor, token.precision));
  }
  limit(value: string, precision: number) { return decimal(uint(value), precision); }
  date(value: number) { return new Date(value).toLocaleString(); }
  status(request: BridgeRequest) {
    return { validating: 'Waiting for validators', attested: 'Validator proofs collected', settled: 'Settled on Ethereum', 'schedule-changed': 'Recovery may be needed', unknown: 'Status unavailable' }[request.status];
  }
  async reviewTransfer() {
    if (!this.canReview()) return;
    const route = this.route()!, account = this.wallet.selectedAccount()!, generation = this.generation;
    const identity = `${account.chainId}:${account.name}`, tokenId = this.tokenId(), amount = this.amount(), recipient = this.recipient();
    const quoted = this.quote()!;
    this.busy.set(true); this.error.set(''); this.latest.set(null);
    try {
      const adapter = this.bridges.adapter(route);
      const snapshot = await adapter.loadSnapshot(account.name);
      if (!this.current(generation, identity)) return;
      this.snapshot.set(snapshot);
      const fresh = adapter.quote(route, snapshot, tokenId, account.name, amount, recipient);
      if (fresh.quantity !== quoted.quantity || fresh.received !== quoted.received || JSON.stringify(fresh.action) !== JSON.stringify(quoted.action)) throw new Error('The bridge configuration changed. Review the updated details before sending.');
      const result = await this.tx.confirm({ chainId: account.chainId, publicKey: '', title: `Bridge to ${route.destinationName}`,
        actions: [fresh.action] });
      if (!result?.transaction_id) return;
      // Save the original account's receipt even if selection changed during confirmation.
      const submission = { transactionId: result.transaction_id, quantity: fresh.quantity, recipient: fresh.recipient, createdAt: Date.now() };
      let saved = true;
      try { await this.bridges.remember(route, account.name, submission); } catch { saved = false; }
      if (!this.current(generation, identity)) return;
      this.latest.set(submission); this.amount.set(''); this.acknowledged.set(false);
      this.submissions.update(rows => [submission, ...rows.filter(s => s.transactionId !== submission.transactionId)].slice(0, 50));
      if (!saved) this.notice.set('Transfer submitted, but its details could not be saved. Copy the transaction ID below before leaving.');
      void this.refresh(); void this.refreshProgress();
    } catch (e) { if (this.current(generation, identity)) this.error.set(this.message(e)); }
    finally { if (this.current(generation, identity)) this.busy.set(false); }
  }
  async openOfficial() {
    const route = this.route(); if (!route) return;
    try { await open(route.officialUrl); } catch (e) { this.error.set(`Could not open ${route.officialUrl} ${this.message(e)}`); }
  }
  async copy(value: string) {
    try { await navigator.clipboard.writeText(value); this.notice.set('Copied to clipboard.'); }
    catch { this.notice.set('Clipboard unavailable. Select and copy the displayed value.'); }
  }
  private message(e: unknown) { return e instanceof Error ? e.message : String(e); }
}
