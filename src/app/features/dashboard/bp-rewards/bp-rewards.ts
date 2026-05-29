import { Component, effect, signal, viewChild, ElementRef, OnDestroy } from '@angular/core';
import { WalletStateService } from '../../../core/services/wallet-state.service';
import * as echarts from 'echarts';
import { TauriIpcService } from '../../../core/services/tauri-ipc.service';
import { TransactionService } from '../../../core/services/transaction.service';
import { TokenPriceService } from '../../../core/services/token-price.service';
import { FioApiService, fioNoHandleMessage } from '../../../core/services/fio-api.service';

interface ClaimAction {
  timestamp: string;
  trx_id: string;
  data: any;
  amount: string;
}

@Component({
  selector: 'app-bp-rewards',
  standalone: true,
  template: `
    <div class="bp-rewards-view">
      <div class="bp-badge">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
        <span>Block Producer</span>
      </div>
      <h2>Rewards Analytics</h2>

      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-label">UNCLAIMED</span>
          <span class="stat-value positive">{{ unclaimedPay() }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">LAST CLAIM</span>
          <span class="stat-value">{{ lastClaimTime() }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">THIS MONTH</span>
          <span class="stat-value positive">{{ monthlyTotal() }}</span>
          @if (monthlyTotalUsd()) {
            <span class="stat-usd">{{ monthlyTotalUsd() }}</span>
          }
        </div>
        <div class="stat-card">
          <span class="stat-label">{{ lastMonthLabel() }}</span>
          <span class="stat-value">{{ lastMonthTotal() }}</span>
          @if (lastMonthTotalUsd()) {
            <span class="stat-usd">{{ lastMonthTotalUsd() }}</span>
          }
        </div>
        <div class="stat-card">
          <span class="stat-label">DAILY AVG (30D)</span>
          <span class="stat-value">{{ dailyAvg() }}</span>
          @if (dailyAvgUsd()) {
            <span class="stat-usd">{{ dailyAvgUsd() }}</span>
          }
        </div>
        <div class="stat-card">
          <span class="stat-label">CLAIMS (90D)</span>
          <span class="stat-value">{{ claimHistory().length }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">RANK</span>
          <span class="stat-value">#{{ wallet.selectedAccount()!.producerRank ?? '—' }}</span>
        </div>
      </div>

      @if (claimHistory().length > 0) {
        <div class="section-card" style="margin-bottom: var(--sp-6);">
          <div class="section-header">
            <h3>Rewards Over Time (90 days)</h3>
          </div>
          <div #chartEl class="chart-container"></div>
        </div>
      }

      <div class="section-card">
        <div class="section-header">
          <h3>Claim History</h3>
          <button class="btn-primary" (click)="onClaimRewards()" [disabled]="busy()">CLAIM REWARDS</button>
        </div>
        @if (claimError()) {
          <p class="loading-text" style="color: var(--danger, #ff6b6b)">{{ claimError() }}</p>
        }

        @if (loadingHistory()) {
          <p class="loading-text">Loading claim history...</p>
        } @else if (claimHistory().length === 0) {
          <p class="loading-text">No claim history found.</p>
        } @else {
          <div class="history-table">
            <div class="table-header">
              <span>Date</span>
              <span>Amount</span>
              <span>USD</span>
              <span>TX</span>
            </div>
            @for (claim of claimHistory(); track claim.trx_id) {
              <div class="table-row">
                <span>{{ formatDate(claim.timestamp) }}</span>
                <span class="data positive">{{ formatClaimAmount(claim) }}</span>
                <span class="data usd-value">{{ formatClaimUsd(claim) }}</span>
                <span class="tx-link">{{ claim.trx_id.slice(0, 8) }}...{{ claim.trx_id.slice(-4) }}</span>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .bp-rewards-view { max-width: 800px; }

    .bp-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      padding: var(--sp-1) var(--sp-3);
      background: var(--accent-muted);
      color: var(--accent);
      border-radius: var(--radius-full);
      font-size: 12px;
      font-weight: 500;
      margin-bottom: var(--sp-3);
    }

    h2 { font-size: 24px; margin-bottom: var(--sp-6); }

    .stats-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--sp-4);
      margin-bottom: var(--sp-6);
    }
    .stat-card {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      padding: var(--sp-4);
    }
    .stat-label {
      display: block; font-size: 11px; font-weight: 500;
      letter-spacing: 1.5px; color: var(--text-muted); margin-bottom: var(--sp-1);
    }
    .stat-value {
      font-family: var(--font-data); font-size: 18px; font-weight: 600; color: var(--text-bright);
    }
    .stat-value.positive { color: var(--positive); }
    .stat-usd {
      display: block; font-size: 12px; font-family: var(--font-data);
      color: var(--text-muted); margin-top: 2px;
    }

    .chart-container {
      width: 100%;
      height: 220px;
    }

    .section-card {
      background: var(--bg-raised);
      border-radius: var(--radius-md);
      padding: var(--sp-5);
    }
    .section-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: var(--sp-5);
    }
    .section-header h3 { font-size: 15px; }

    .history-table { font-size: 13px; }
    .table-header, .table-row {
      display: grid;
      grid-template-columns: 1.2fr 1.2fr 0.9fr 1fr;
      padding: var(--sp-3) var(--sp-2);
      border-bottom: 1px solid var(--border-subtle);
    }
    .table-header {
      font-size: 11px; font-weight: 500; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .table-row { color: var(--text-body); }
    .table-row:last-child { border-bottom: none; }
    .table-row:hover { background: var(--bg-hover); }
    .data { font-family: var(--font-data); }
    .positive { color: var(--positive); }
    .usd-value { color: var(--text-muted); font-size: 12px; }
    .tx-link {
      font-family: var(--font-data); color: var(--accent); cursor: pointer;
      font-size: 12px;
    }
    .tx-link:hover { text-decoration: underline; }

    .btn-primary {
      padding: var(--sp-2) var(--sp-4);
      border: none; border-radius: var(--radius-sm);
      background: var(--accent); color: #fff;
      font-family: var(--font-body); font-size: 12px;
      font-weight: 500; letter-spacing: 1px;
      text-transform: uppercase; cursor: pointer;
      transition: background 150ms ease;
    }
    .btn-primary:hover { background: var(--accent-hover); }
  `],
})
export class BpRewardsComponent implements OnDestroy {
  busy = signal(false);
  claimError = signal('');
  loadingHistory = signal(false);
  claimHistory = signal<ClaimAction[]>([]);
  unclaimedPay = signal('—');
  lastClaimTime = signal('—');
  monthlyTotal = signal('—');
  lastMonthTotal = signal('—');
  lastMonthLabel = signal('LAST MONTH');
  dailyAvg = signal('—');
  monthlyTotalUsd = signal('');
  lastMonthTotalUsd = signal('');
  dailyAvgUsd = signal('');

  chartEl = viewChild<ElementRef<HTMLDivElement>>('chartEl');
  private chartInstance: echarts.ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    public wallet: WalletStateService,
    private ipc: TauriIpcService,
    private tx: TransactionService,
    private priceService: TokenPriceService,
    private fioApi: FioApiService,
  ) {
    effect(() => {
      const acct = this.wallet.selectedAccount();
      if (acct?.isProducer) {
        this.loadRewardsData(acct.chainId, acct.name);
        this.loadClaimHistory(acct.chainId, acct.name);
      }
    });

    effect(() => {
      const el = this.chartEl()?.nativeElement;
      const history = this.claimHistory();

      if (!el || history.length === 0) {
        if (this.chartInstance) {
          this.chartInstance.dispose();
          this.chartInstance = null;
          this.resizeObserver?.disconnect();
          this.resizeObserver = null;
        }
        return;
      }

      if (!this.chartInstance) {
        this.chartInstance = echarts.init(el);
        this.resizeObserver = new ResizeObserver(() => this.chartInstance?.resize());
        this.resizeObserver.observe(el);
      } else if (this.chartInstance.getDom() !== el) {
        this.chartInstance.dispose();
        this.resizeObserver?.disconnect();
        this.chartInstance = echarts.init(el);
        this.resizeObserver = new ResizeObserver(() => this.chartInstance?.resize());
        this.resizeObserver.observe(el);
      }

      this.updateChart(history);
    });
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    this.chartInstance?.dispose();
  }

  private parseAmount(raw: string): number {
    if (!raw) return 0;
    const match = raw.match(/^([0-9.]+)/);
    return match ? parseFloat(match[1]) : 0;
  }

  private getSymbol(history: ClaimAction[]): string {
    const first = history.find(h => h.amount);
    if (!first) return '';
    const match = first.amount.match(/\s*([A-Za-z]+)$/);
    return match ? match[1] : '';
  }

  private computeStats(history: ClaimAction[]) {
    const symbol = this.getSymbol(history);
    const hasAmounts = history.some(h => h.amount);

    if (!hasAmounts) {
      // Count-based stats (no token amounts available)
      const now = new Date();
      const thisMonth = history.filter(h => {
        const d = new Date(h.timestamp);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      this.monthlyTotal.set(`${thisMonth.length} claims`);
      this.monthlyTotalUsd.set('');

      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      this.lastMonthLabel.set(prevMonth.toLocaleDateString('en-US', { month: 'short' }).toUpperCase());
      const lastMonth = history.filter(h => {
        const d = new Date(h.timestamp);
        return d.getMonth() === prevMonth.getMonth() && d.getFullYear() === prevMonth.getFullYear();
      });
      this.lastMonthTotal.set(`${lastMonth.length} claims`);
      this.lastMonthTotalUsd.set('');

      const thirtyDaysAgo = Date.now() - 30 * 86400_000;
      const recent = history.filter(h => new Date(h.timestamp).getTime() >= thirtyDaysAgo);
      const avg = recent.length > 0 ? (recent.length / 30).toFixed(1) : '0';
      this.dailyAvg.set(`${avg} claims/d`);
      this.dailyAvgUsd.set('');
      return;
    }

    // Token-amount stats
    const now = new Date();
    let monthSum = 0;
    for (const h of history) {
      const d = new Date(h.timestamp);
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
        monthSum += this.parseAmount(h.amount);
      }
    }
    this.monthlyTotal.set(monthSum > 0 ? `${this.formatNumber(monthSum)} ${symbol}` : `0 ${symbol}`);
    const monthUsd = this.priceService.toUsd(`${monthSum} ${symbol}`);
    this.monthlyTotalUsd.set(monthUsd !== null ? this.priceService.formatUsd(monthUsd) : '');

    // Last full month
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    this.lastMonthLabel.set(prevMonth.toLocaleDateString('en-US', { month: 'short' }).toUpperCase());
    let lastMonthSum = 0;
    for (const h of history) {
      const d = new Date(h.timestamp);
      if (d.getMonth() === prevMonth.getMonth() && d.getFullYear() === prevMonth.getFullYear()) {
        lastMonthSum += this.parseAmount(h.amount);
      }
    }
    this.lastMonthTotal.set(lastMonthSum > 0 ? `${this.formatNumber(lastMonthSum)} ${symbol}` : `0 ${symbol}`);
    const lastMonthUsd = this.priceService.toUsd(`${lastMonthSum} ${symbol}`);
    this.lastMonthTotalUsd.set(lastMonthUsd !== null ? this.priceService.formatUsd(lastMonthUsd) : '');

    const thirtyDaysAgo = Date.now() - 30 * 86400_000;
    let sum30 = 0;
    for (const h of history) {
      if (new Date(h.timestamp).getTime() >= thirtyDaysAgo) {
        sum30 += this.parseAmount(h.amount);
      }
    }
    const avg = sum30 / 30;
    this.dailyAvg.set(avg > 0 ? `${this.formatNumber(avg)} ${symbol}` : `0 ${symbol}`);
    const avgUsd = this.priceService.toUsd(`${avg} ${symbol}`);
    this.dailyAvgUsd.set(avgUsd !== null ? this.priceService.formatUsd(avgUsd) : '');
  }

  private formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(2) + 'K';
    return n.toFixed(2);
  }

  private updateChart(history: ClaimAction[]) {
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#6ee7b7';
    const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#888';
    const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border-subtle').trim() || 'rgba(255,255,255,0.1)';

    const symbol = this.getSymbol(history);
    const hasAmounts = history.some(h => h.amount);

    const aggregated = new Map<string, number>();
    for (const h of [...history].reverse()) {
      const dStr = new Date(h.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const val = hasAmounts ? this.parseAmount(h.amount) : 1;
      aggregated.set(dStr, (aggregated.get(dStr) || 0) + val);
    }

    const dates = Array.from(aggregated.keys());
    const values = Array.from(aggregated.values());

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1e1e2e',
        borderColor: borderColor,
        textStyle: { color: '#fff', fontSize: 12 },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          const v = p.value as number;
          const label = hasAmounts ? `${this.formatNumber(v)} ${symbol}` : `${v} claim(s)`;
          return `<b>${p.name}</b><br/>${label}`;
        },
      },
      grid: { top: 20, right: 16, bottom: 24, left: hasAmounts ? 65 : 35 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { color: mutedColor, fontSize: 10, fontFamily: 'var(--font-body)', interval: Math.max(0, Math.floor(dates.length / 10) - 1) },
        axisLine: { lineStyle: { color: borderColor } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: borderColor, type: 'dashed' } },
        axisLabel: {
          color: mutedColor, fontSize: 10, fontFamily: 'var(--font-data)',
          formatter: (v: number) => hasAmounts ? this.formatNumber(v) : String(v),
        },
      },
      series: [{
        data: values,
        type: 'bar',
        barMaxWidth: 18,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: accentColor },
            { offset: 1, color: accentColor + '44' },
          ]),
          borderRadius: [3, 3, 0, 0],
        },
        emphasis: {
          itemStyle: { color: accentColor },
        },
      }],
    };
    this.chartInstance!.setOption(option, true);
  }

  private async loadRewardsData(chainId: string, account: string) {
    try {
      const result = await this.ipc.getProducers(chainId, 200);
      const list: any[] = result?.rows ?? result?.producers ?? [];
      const row = list.find((r: any) => r.owner === account);
      if (row) {
        const unpaid = row.unpaid_blocks ?? 0;
        this.unclaimedPay.set(unpaid > 0 ? `${unpaid} blocks` : 'None');
        // FIO uses last_claim_time, standard chains also use last_claim_time
        const claimTime = row.last_claim_time;
        if (claimTime && claimTime !== '1970-01-01T00:00:00.000') {
          this.lastClaimTime.set(this.relativeTime(claimTime));
        } else {
          this.lastClaimTime.set('Never');
        }
      }
    } catch { /* offline */ }
  }

  private async loadClaimHistory(chainId: string, account: string) {
    this.loadingHistory.set(true);
    try {
      const chain = this.wallet.activeChain();
      const isFio = chain?.token_contract === 'fio.token';
      const after90d = new Date(Date.now() - 90 * 86400_000).toISOString();

      if (isFio) {
        // FIO: the reward amount is in transfer actions from fio.treasury
        const result = await this.ipc.getActionsHistory(chainId, account, 100, 0, { actName: 'transfer', after: after90d });
        const raw: any[] = result?.actions ?? [];
        const treasury = raw.filter((a: any) =>
          a.act?.data?.from === 'fio.treasury' && a.act?.data?.to === account
        );
        const claims = treasury.map((a: any) => ({
          timestamp: a['@timestamp'] ?? '',
          trx_id: a.trx_id ?? '',
          data: a.act?.data ?? {},
          amount: a.act?.data?.quantity ?? '',
        }));
        this.claimHistory.set(claims);
        this.computeStats(claims);
      } else {
        // EOS/Vaulta: fetch transfer actions where eosio.bpay or eosio.vpay sent to this account
        const result = await this.ipc.getActionsHistory(chainId, account, 100, 0, { actName: 'transfer', after: after90d });
        const raw: any[] = result?.actions ?? [];
        const bpPayouts = raw.filter((a: any) => {
          const from = a.act?.data?.from;
          const to = a.act?.data?.to;
          return (from === 'eosio.bpay' || from === 'eosio.vpay') && to === account;
        });

        if (bpPayouts.length > 0) {
          // Group bpay + vpay transfers from the same tx into a single claim entry
          const byTx = new Map<string, ClaimAction>();
          for (const a of bpPayouts) {
            const trxId = a.trx_id ?? '';
            const qty = a.act?.data?.quantity ?? '';
            const existing = byTx.get(trxId);
            if (existing) {
              // Sum amounts from same tx (bpay + vpay)
              existing.amount = this.sumAmounts(existing.amount, qty);
            } else {
              byTx.set(trxId, {
                timestamp: a['@timestamp'] ?? '',
                trx_id: trxId,
                data: a.act?.data ?? {},
                amount: qty,
              });
            }
          }
          const claims = Array.from(byTx.values());
          this.claimHistory.set(claims);
          this.computeStats(claims);
        } else {
          // Fallback: no transfer payouts found, show claimrewards as count-only
          const fallback = await this.ipc.getActionsHistory(chainId, account, 100, 0, { actName: 'claimrewards', after: after90d });
          const fallbackRaw: any[] = fallback?.actions ?? [];
          const claims = fallbackRaw.map((a: any) => ({
            timestamp: a['@timestamp'] ?? '',
            trx_id: a.trx_id ?? '',
            data: a.act?.data ?? {},
            amount: '',
          }));
          this.claimHistory.set(claims);
          this.computeStats(claims);
        }
      }
    } catch {
      this.claimHistory.set([]);
    } finally {
      this.loadingHistory.set(false);
    }
  }

  private sumAmounts(a: string, b: string): string {
    const numA = this.parseAmount(a);
    const numB = this.parseAmount(b);
    const symbol = this.getSymbolFromAmount(a) || this.getSymbolFromAmount(b);
    const precision = this.getPrecision(a) || this.getPrecision(b) || 4;
    return `${(numA + numB).toFixed(precision)} ${symbol}`;
  }

  private getSymbolFromAmount(raw: string): string {
    const match = raw.match(/\s*([A-Za-z]+)$/);
    return match ? match[1] : '';
  }

  private getPrecision(raw: string): number {
    const match = raw.match(/\.(\d+)/);
    return match ? match[1].length : 0;
  }

  /** Currently-registered FIO handle owned by this account, or '' if none. */
  private async fioAddr(): Promise<string> {
    return this.fioApi.resolveOwnedHandle(this.wallet.selectedAccount());
  }

  async onClaimRewards() {
    const account = this.wallet.selectedAccount();
    if (!account) return;
    this.busy.set(true);
    this.claimError.set('');
    try {
      const keys = await this.ipc.listPublicKeys(account.chainId);
      if (keys.length === 0) return;

      // FIO uses bpclaim on fio.treasury, standard chains use claimrewards on eosio
      const chain = this.wallet.activeChain();
      const isFio = chain?.token_contract === 'fio.token';

      let actions: any[];
      if (isFio) {
        const handle = await this.fioAddr();
        if (!handle) {
          this.claimError.set(fioNoHandleMessage('claim BP rewards'));
          return;
        }
        actions = [{
          account: 'fio.treasury', name: 'bpclaim',
          authorization: [{ actor: account.name, permission: 'active' }],
          data: { fio_address: handle, actor: account.name },
        }];
      } else {
        actions = [{
          account: 'eosio', name: 'claimrewards',
          authorization: [{ actor: account.name, permission: 'active' }],
          data: { owner: account.name },
        }];
      }

      const result = await this.tx.confirm({
        chainId: account.chainId, publicKey: keys[0], actions,
        title: 'Claim Rewards',
      });
      if (result) {
        await this.wallet.refreshAccount(this.wallet.selectedIndex());
        await this.loadRewardsData(account.chainId, account.name);
        await this.loadClaimHistory(account.chainId, account.name);
      }
    } catch (e: any) {
      this.claimError.set(e?.toString() ?? 'Failed to claim rewards');
    } finally {
      this.busy.set(false);
    }
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  formatClaimAmount(claim: ClaimAction): string {
    if (claim.amount) return claim.amount;
    return 'Claimed';
  }

  formatClaimUsd(claim: ClaimAction): string {
    if (!claim.amount) return '';
    const usd = this.priceService.toUsd(claim.amount);
    return usd !== null ? this.priceService.formatUsd(usd) : '';
  }

  private relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}
