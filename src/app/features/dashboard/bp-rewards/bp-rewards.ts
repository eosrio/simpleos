import { Component, computed, effect, signal, untracked, viewChild, ElementRef, OnDestroy } from '@angular/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { WalletStateService } from '../../../core/services/wallet-state.service';
import * as echarts from 'echarts';
import { TauriIpcService } from '../../../core/services/tauri-ipc.service';
import { TransactionService } from '../../../core/services/transaction.service';
import { TokenPriceService } from '../../../core/services/token-price.service';
import { FioApiService, fioNoHandleMessage } from '../../../core/services/fio-api.service';
import {
  normalizePubEm,
  resolveAccountSigner,
  resolveActionPermissionAndSigner,
} from '../../../core/services/account-signer';

interface ClaimAction {
  timestamp: string;
  trx_id: string;
  data: any;
  amount: string;
  rewardKind?: 'epoch' | 'node';
}

export interface WireNodeDistResult {
  total_allocation: string;
  claimed: string;
  claimable: string;
  can_claim: boolean | number;
}

export interface WireEpochInfo {
  current_epoch?: number;
  epoch_number?: number;
  last_epoch_time?: string;
  seconds_until_next?: number;
}

export function formatWireBaseUnits(balanceRaw: string | number | bigint | null | undefined): string {
  try {
    const clean = String(balanceRaw ?? '0').trim();
    if (!clean || !/^-?\d+$/.test(clean)) return '0.000000000 WIRE';
    const raw = BigInt(clean);
    const neg = raw < 0n ? '-' : '';
    const abs = raw < 0n ? -raw : raw;
    const whole = abs / 1_000_000_000n;
    const frac = (abs % 1_000_000_000n).toString().padStart(9, '0');
    return `${neg}${whole}.${frac} WIRE`;
  } catch {
    return '0.000000000 WIRE';
  }
}

export function mapWireClaimError(rawError: unknown): string {
  const msg = typeof rawError === 'string' ? rawError : (rawError as any)?.message ?? String(rawError ?? '');
  const lower = msg.toLowerCase();
  if (lower.includes('treasury balance is reserved against unclaimed epoch pay')) {
    return 'Treasury balance is currently reserved against unclaimed epoch pay; please try again after the treasury is topped up.';
  }
  if (lower.includes('claim amount below minimum threshold')) {
    return 'Claimable node owner balance has not yet reached the minimum claim threshold.';
  }
  if (lower.includes('all node owner rewards already claimed')) {
    return 'All node owner rewards for this allocation have already been claimed.';
  }
  if (
    lower.includes('no unclaimed pay found for account') ||
    lower.includes('no epoch pay to claim') ||
    lower.includes('no pay to claim')
  ) {
    return 'No unclaimed epoch pay is currently available for this account.';
  }
  if (lower.includes('account is not a node owner')) {
    return 'This account is not registered as a Wire node owner.';
  }
  return msg;
}

@Component({
  selector: 'app-bp-rewards',
  standalone: true,
  template: `
    <div class="bp-rewards-view">
      <!-- ── Top Header ── -->
      <header class="page-header">
        <div class="header-title-row">
          <h2>{{ isWire() ? 'Wire Rewards' : 'Rewards Analytics' }}</h2>
          <span class="header-sep">·</span>
          <span class="header-meta">{{ wallet.selectedAccount()?.name }} · {{ wallet.activeChain().name }}</span>
          @if (wallet.selectedAccount()?.isProducer) {
            <span class="rank-pill">Rank #{{ wallet.selectedAccount()?.producerRank ?? '—' }}</span>
          }
          @if (isWire() && wireNodeTier()) {
            <span class="rank-pill tier-pill">Node Tier {{ wireNodeTier() }}</span>
          }
        </div>
        <div class="header-actions">
          <button class="btn-refresh" type="button" (click)="refresh()" [disabled]="refreshing() || loadingHistory() || busy()" title="Refresh rewards data">
            <svg [class.spinning]="refreshing() || loadingHistory()" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            <span>{{ refreshing() || loadingHistory() ? 'Refreshing…' : 'Refresh' }}</span>
          </button>
          @if (!isWire()) {
            <button class="btn-primary" type="button" (click)="onClaimRewards()" [disabled]="busy() || !wallet.canSign()">
              {{ busy() ? 'Claiming…' : 'Claim Rewards' }}
            </button>
          }
        </div>
      </header>

      @if (wireLoadError()) {
        <div class="msg-banner error" role="alert">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>{{ wireLoadError() }}</span>
          <button class="btn-inline" type="button" (click)="refresh()" [disabled]="refreshing() || busy()">
            Retry
          </button>
        </div>
      }

      @if (claimError()) {
        <div class="msg-banner error" role="alert">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>{{ claimError() }}</span>
        </div>
      }

      @if (claimSuccess()) {
        <div class="msg-banner success" role="status">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          <span>{{ claimSuccess() }}</span>
        </div>
      }

      @if (isWire()) {
        <!-- ── Wire Reward Cards (Epoch Pay + Node Owner Vesting) ── -->
        <div class="wire-cards-grid">
          <!-- 1. Epoch Pay Card -->
          <section class="section-card wire-reward-card">
            <div class="card-header">
              <div class="card-title-row">
                <h3>Producer &amp; Finalizer Epoch Pay</h3>
                <span class="meta-pill">sysio::claimpay</span>
              </div>
              <span class="perm-badge" title="Permission used when signing claimpay">
                Signs with &#64;{{ wireClaimpayPerm() }}
              </span>
            </div>

            <div class="wire-hero-metric">
              <span class="stat-label">UNCLAIMED EPOCH PAY</span>
              <span class="wire-hero-value" [class.positive]="wireCanClaimPay()">{{ wirePayclaimBalance() }}</span>
              <span class="stat-sub">
                @if (wireCanClaimPay()) {
                  Ready to claim from T5 treasury
                } @else {
                  No unclaimed epoch pay accrued
                }
              </span>
            </div>

            <div class="wire-meta-grid">
              <div class="wire-meta-item">
                <span class="stat-label">NEXT EPOCH</span>
                <span class="wire-meta-val">{{ wireNextEpochCountdown() }}</span>
              </div>
              <div class="wire-meta-item">
                <span class="stat-label">PRODUCER STATUS</span>
                <span class="wire-meta-val">
                  @if (wireProducerRow(); as prod) {
                    {{ prod.is_active ? 'Active' : 'Inactive' }}
                    @if (prod.is_demoted) { · Demoted }
                  } @else {
                    Not registered
                  }
                </span>
              </div>
              @if (wireProducerRow(); as prod) {
                <div class="wire-meta-item">
                  <span class="stat-label">RANK SCORE</span>
                  <span class="wire-meta-val">{{ prod.rank_score ?? '—' }}</span>
                </div>
                <div class="wire-meta-item">
                  <span class="stat-label">MISSED ROUNDS</span>
                  <span class="wire-meta-val">{{ prod.consecutive_missed_rounds ?? 0 }}</span>
                </div>
              }
            </div>

            <div class="wire-card-actions">
              <button
                class="btn-primary"
                type="button"
                (click)="onClaimWireEpochPay()"
                [disabled]="busy() || !wallet.canSign() || !wireCanClaimPay()"
              >
                {{ busy() ? 'Claiming…' : 'Claim Epoch Pay' }}
              </button>
            </div>
          </section>

          <!-- 2. Node Owner Vesting Card -->
          @if (wireNodeDist(); as nd) {
            <section class="section-card wire-reward-card">
              <div class="card-header">
                <div class="card-title-row">
                  <h3>Node Owner Vesting</h3>
                  <span class="meta-pill">sysio::claimnodedis</span>
                  @if (wireNodeTier()) {
                    <span class="meta-pill tier-badge">{{ wireNodeTier() }}</span>
                  }
                </div>
                <span class="perm-badge" title="Permission used when signing claimnodedis">
                  Signs with &#64;{{ wireClaimnodedisPerm() }}
                </span>
              </div>

              <div class="wire-hero-metric">
                <span class="stat-label">CLAIMABLE NOW</span>
                @if (wireNodeClaimableLoading()) {
                  <span class="wire-hero-value muted">Loading…</span>
                  <span class="stat-sub">Fetching live vested claimable balance…</span>
                } @else {
                  <span class="wire-hero-value" [class.positive]="nd.can_claim">{{ nd.claimable }}</span>
                  <span class="stat-sub">
                    @if (nd.can_claim) {
                      Eligible for immediate claim
                    } @else if (nd.claimed === nd.total_allocation) {
                      All node owner rewards claimed
                    } @else {
                      Minimum claim threshold: {{ wireMinClaimable() }}
                    }
                  </span>
                }
              </div>

              <div class="vesting-bar-wrap">
                <div class="vesting-bar-labels">
                  <span>Vested Progress ({{ wireVestingPct() }}%)</span>
                  <span>{{ nd.claimed }} claimed / {{ nd.total_allocation }}</span>
                </div>
                <div class="vesting-bar-track">
                  <div class="vesting-bar-fill claimed" [style.width.%]="wireClaimedPct()"></div>
                  <div class="vesting-bar-fill claimable" [style.width.%]="wireClaimablePct()"></div>
                </div>
              </div>

              <div class="wire-meta-grid">
                <div class="wire-meta-item">
                  <span class="stat-label">TOTAL ALLOCATION</span>
                  <span class="wire-meta-val">{{ nd.total_allocation }}</span>
                </div>
                <div class="wire-meta-item">
                  <span class="stat-label">CLAIMED TO DATE</span>
                  <span class="wire-meta-val">{{ nd.claimed }}</span>
                </div>
              </div>

              <div class="wire-card-actions">
                <button
                  class="btn-primary"
                  type="button"
                  (click)="onClaimWireNodeRewards()"
                  [disabled]="busy() || !wallet.canSign() || wireNodeClaimableLoading() || !nd.can_claim"
                >
                  {{ busy() ? 'Claiming…' : 'Claim Node Rewards' }}
                </button>
              </div>
            </section>
          }
        </div>

        <!-- ── Dedicated claim Permission Helper ── -->
        @if (wallet.canSign()) {
          <section class="section-card claim-perm-card">
            <div class="card-header">
              <div class="card-title-row">
                <h3>Dedicated <code>claim</code> Permission</h3>
                @if (wireClaimFullyLinked()) {
                  <span class="meta-pill status-ok">Configured ✓</span>
                } @else {
                  <span class="meta-pill">Optional Automation Key</span>
                }
              </div>
              <button
                class="btn-refresh"
                type="button"
                (click)="toggleClaimSetup()"
                [disabled]="busy()"
              >
                {{ showClaimSetup() ? 'Close' : (wireHasClaimPerm() ? 'Update claim Permission' : 'Set up claim Permission') }}
              </button>
            </div>

            <p class="perm-helper-desc">
              Create or link a child <code>claim</code> permission under <code>active</code> restricted exclusively to
              <code>sysio::claimpay</code> and/or <code>sysio::claimnodedis</code> so automated scripts or hot keys can claim rewards without exposing your <code>active</code> authority.
            </p>

            @if (showClaimSetup()) {
              <div class="claim-setup-body">
                <div class="claim-setup-row">
                  <label class="field-label">Signing Public Key for <code>&#64;claim</code></label>
                  <button class="btn-inline" type="button" (click)="generateClaimKeyPair()" [disabled]="busy()">
                    + Generate New K1 Keypair
                  </button>
                </div>

                <input
                  class="form-input mono"
                  type="text"
                  spellcheck="false"
                  placeholder="EOS… / PUB_K1_… / PUB_EM_…"
                  [value]="claimPermKey()"
                  (input)="onClaimKeyInput($any($event.target).value)"
                />

                @if (generatedClaimWif()) {
                  <div class="wif-reveal-box">
                    <div class="wif-reveal-head">
                      <span>⚠ New <code>claim</code> Private Key (WIF) — save this for your claimer script</span>
                      <button class="btn-inline" type="button" (click)="copyClaimWif()">
                        {{ copiedClaimWif() ? 'Copied ✓' : 'Copy WIF' }}
                      </button>
                    </div>
                    <code class="mono">{{ generatedClaimWif() }}</code>
                  </div>
                }

                <div class="claim-links-checks">
                  <label class="check-item">
                    <input
                      type="checkbox"
                      [checked]="linkClaimpay()"
                      (change)="linkClaimpay.set($any($event.target).checked)"
                    />
                    <span>Link <code>sysio::claimpay</code> (Epoch Pay)</span>
                  </label>
                  <label class="check-item">
                    <input
                      type="checkbox"
                      [checked]="linkClaimnodedis()"
                      (change)="linkClaimnodedis.set($any($event.target).checked)"
                    />
                    <span>Link <code>sysio::claimnodedis</code> (Node Owner Vesting)</span>
                  </label>
                </div>

                <div class="wire-card-actions">
                  <button
                    class="btn-primary"
                    type="button"
                    (click)="submitClaimPermissionSetup()"
                    [disabled]="busy() || !claimPermKey().trim() || (!linkClaimpay() && !linkClaimnodedis())"
                  >
                    {{ busy() ? 'Submitting…' : 'Save & Link claim Permission' }}
                  </button>
                </div>
              </div>
            }
          </section>
        }
      }

      <!-- ── 6-Metric KPI Grid ── -->
      @if (!isWire() || !historyUnavailable()) {
        <div class="stats-grid">
          <div class="stat-card" [class.highlight]="hasUnpaidBlocks() || wireCanClaimPay()">
            <span class="stat-label">{{ isWire() ? 'UNCLAIMED EPOCH' : 'UNCLAIMED' }}</span>
            <span class="stat-value" [class.positive]="hasUnpaidBlocks() || wireCanClaimPay()">
              {{ isWire() ? wirePayclaimBalance() : unclaimedPay() }}
            </span>
            <span class="stat-sub">{{ (hasUnpaidBlocks() || wireCanClaimPay()) ? 'Ready to claim' : 'Up to date' }}</span>
          </div>
          <div class="stat-card" [title]="lastClaimRaw()">
            <span class="stat-label">LAST CLAIM</span>
            <span class="stat-value">{{ lastClaimTime() }}</span>
            @if (lastClaimRaw()) {
              <span class="stat-sub">{{ formatDateShort(lastClaimRaw()) }}</span>
            }
          </div>
          @if (!historyUnavailable()) {
            <div class="stat-card">
              <span class="stat-label">THIS MONTH</span>
              <span class="stat-value positive">{{ monthlyTotal() }}</span>
              @if (monthlyTotalUsd()) {
                <span class="stat-sub">{{ monthlyTotalUsd() }}</span>
              }
            </div>
            <div class="stat-card">
              <span class="stat-label">{{ lastMonthLabel() }}</span>
              <span class="stat-value">{{ lastMonthTotal() }}</span>
              @if (lastMonthTotalUsd()) {
                <span class="stat-sub">{{ lastMonthTotalUsd() }}</span>
              }
            </div>
            <div class="stat-card">
              <span class="stat-label">DAILY AVG (30D)</span>
              <span class="stat-value">{{ dailyAvg() }}</span>
              @if (dailyAvgUsd()) {
                <span class="stat-sub">{{ dailyAvgUsd() }}</span>
              }
            </div>
            <div class="stat-card">
              <span class="stat-label">CLAIMS (90D)</span>
              <span class="stat-value">{{ claimHistory().length }}</span>
              <span class="stat-sub">90-day window</span>
            </div>
          }
        </div>
      }

      @if (claimHistory().length > 0) {
        <section class="section-card">
          <div class="card-header">
            <div class="card-title-row">
              <h3>Rewards Over Time</h3>
              <span class="meta-pill">90 days</span>
            </div>
          </div>
          <div #chartEl class="chart-container"></div>
        </section>
      }

      <section class="section-card">
        <div class="card-header">
          <div class="card-title-row">
            <h3>Claim History</h3>
            @if (claimHistory().length > 0) {
              <span class="meta-pill">{{ claimHistory().length }} events</span>
            }
          </div>
        </div>

        @if (historyUnavailable()) {
          <div class="empty-block">
            <p class="empty-title">Claim history not available on {{ wallet.activeChain().name }}</p>
            <p class="empty-sub">This network does not have a history API configured, so past claim transactions and 90-day totals cannot be queried.</p>
          </div>
        } @else if (loadingHistory()) {
          <div class="empty-block">
            <p class="empty-title">Loading claim history…</p>
          </div>
        } @else if (claimHistory().length === 0) {
          <div class="empty-block">
            <p class="empty-title">No reward claims found in the last 90 days</p>
            <p class="empty-sub">When you claim rewards, payouts will appear here automatically.</p>
          </div>
        } @else {
          <div class="history-table">
            <div class="table-header">
              <span>Date</span>
              <span>Amount</span>
              <span>{{ isWire() ? 'Type' : 'USD Value' }}</span>
              <span class="col-right">Transaction</span>
            </div>
            @for (claim of claimHistory(); track claim.trx_id + claim.timestamp + (claim.rewardKind ?? '')) {
              <div class="table-row">
                <span class="date-cell">{{ formatDate(claim.timestamp) }}</span>
                <span class="data positive">{{ formatClaimAmount(claim) }}</span>
                @if (isWire()) {
                  <span class="data usd-value">
                    {{ claim.rewardKind === 'node' ? 'Node Owner' : 'Epoch Pay' }}
                  </span>
                } @else {
                  <span class="data usd-value">{{ formatClaimUsd(claim) || '—' }}</span>
                }
                <div class="tx-cell">
                  <button
                    type="button"
                    class="tx-copy-btn"
                    [class.copied]="copiedTx() === claim.trx_id"
                    (click)="copyTx(claim.trx_id)"
                    [title]="'Copy transaction ID: ' + claim.trx_id"
                  >
                    @if (copiedTx() === claim.trx_id) {
                      <span>✓ Copied</span>
                    } @else {
                      <span>{{ claim.trx_id.slice(0, 8) }}…{{ claim.trx_id.slice(-6) }}</span>
                    }
                  </button>
                  @if (explorerTxUrl(claim.trx_id); as url) {
                    <button
                      type="button"
                      class="tx-ext-btn"
                      (click)="openExternal(url)"
                      title="View transaction in block explorer"
                    >
                      ↗
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        }
      </section>
    </div>
  `,
  styles: [`
    .bp-rewards-view {
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

    .header-actions {
      display: flex;
      align-items: center;
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

    /* ── Wire Reward Cards ── */
    .wire-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: var(--sp-4);
    }

    .wire-reward-card {
      justify-content: space-between;
    }

    .perm-badge {
      font-family: var(--font-data);
      font-size: 11px;
      color: var(--text-muted);
      padding: 2px 8px;
      border-radius: var(--radius-sm);
      background: var(--bg-base);
      border: 1px solid var(--border-subtle);
    }

    .wire-hero-metric {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: var(--sp-3) var(--sp-4);
      border-radius: var(--radius-md);
      background: var(--bg-base);
      border: 1px solid var(--border-subtle);
    }

    .wire-hero-value {
      font-family: var(--font-data);
      font-size: 20px;
      font-weight: 700;
      color: var(--text-bright);
      font-variant-numeric: tabular-nums;
    }
    .wire-hero-value.positive {
      color: var(--positive);
    }
    .wire-hero-value.muted {
      color: var(--text-muted);
      font-weight: 600;
    }

    .wire-meta-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sp-3);
    }

    .wire-meta-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--sp-2) var(--sp-3);
      border-radius: var(--radius-sm);
      background: var(--bg-base);
      border: 1px solid var(--border-subtle);
    }

    .wire-meta-val {
      font-family: var(--font-data);
      font-size: 13px;
      font-weight: 600;
      color: var(--text-bright);
    }

    .vesting-bar-wrap {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .vesting-bar-labels {
      display: flex;
      justify-content: space-between;
      font-family: var(--font-data);
      font-size: 11px;
      color: var(--text-muted);
    }

    .vesting-bar-track {
      height: 8px;
      border-radius: 999px;
      background: var(--bg-base);
      border: 1px solid var(--border-subtle);
      overflow: hidden;
      display: flex;
    }

    .vesting-bar-fill.claimed {
      background: var(--accent);
      height: 100%;
    }

    .vesting-bar-fill.claimable {
      background: var(--positive);
      height: 100%;
    }

    .wire-card-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--sp-2);
    }

    /* ── Claim Permission Setup ── */
    .perm-helper-desc {
      margin: 0;
      font-size: 12px;
      line-height: 1.5;
      color: var(--text-muted);
    }

    .status-ok {
      color: var(--positive);
      border-color: color-mix(in srgb, var(--positive) 40%, var(--border-subtle));
    }

    .claim-setup-body {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
      padding-top: var(--sp-2);
      border-top: 1px solid var(--border-subtle);
    }

    .claim-setup-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--sp-2);
    }

    .field-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-body);
    }

    .btn-inline {
      background: transparent;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      color: var(--accent-text);
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 600;
      padding: 4px 10px;
      cursor: pointer;
    }
    .btn-inline:hover:not(:disabled) {
      border-color: var(--accent);
      background: var(--bg-base);
    }

    .form-input {
      width: 100%;
      box-sizing: border-box;
      padding: 8px 12px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-subtle);
      background: var(--bg-base);
      color: var(--text-bright);
      font-size: 12px;
    }

    .mono {
      font-family: var(--font-data);
    }

    .wif-reveal-box {
      padding: var(--sp-3);
      border-radius: var(--radius-sm);
      background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.35);
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 12px;
    }

    .wif-reveal-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--sp-2);
      color: var(--text-bright);
      font-weight: 600;
    }

    .claim-links-checks {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-4);
    }

    .check-item {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--text-body);
      cursor: pointer;
    }

    /* ── Stats Grid ── */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--sp-3);
    }
    @media (min-width: 980px) {
      .stats-grid {
        grid-template-columns: repeat(6, minmax(0, 1fr));
      }
    }
    @media (max-width: 640px) {
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
      border-color: color-mix(in srgb, var(--positive) 35%, var(--border-subtle));
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--positive) 6%, transparent), transparent 70%),
        var(--bg-raised);
    }

    .stat-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .stat-value {
      font-family: var(--font-data);
      font-variant-numeric: tabular-nums;
      font-size: 16px;
      font-weight: 700;
      color: var(--text-bright);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .stat-value.positive {
      color: var(--positive);
    }

    .stat-sub {
      font-size: 11px;
      font-family: var(--font-data);
      font-variant-numeric: tabular-nums;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ── Section Cards ── */
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
      flex-wrap: wrap;
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

    .chart-container {
      width: 100%;
      height: 210px;
    }

    /* ── Claim History Table ── */
    .history-table {
      font-size: 13px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      background: var(--bg-base);
      overflow: hidden;
    }

    .table-header,
    .table-row {
      display: grid;
      grid-template-columns: 1.2fr 1.2fr 0.9fr 1.1fr;
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

    .date-cell {
      font-size: 12px;
      color: var(--text-body);
    }

    .data {
      font-family: var(--font-data);
      font-variant-numeric: tabular-nums;
    }
    .positive {
      color: var(--positive);
      font-weight: 600;
    }
    .usd-value {
      color: var(--text-muted);
      font-size: 12px;
    }

    .tx-cell {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
    }

    .tx-copy-btn {
      padding: 3px 8px;
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--accent-text);
      font-family: var(--font-data);
      font-size: 12px;
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
    }
    .tx-copy-btn:hover {
      background: var(--bg-raised);
      border-color: var(--border-subtle);
    }
    .tx-copy-btn.copied {
      color: var(--positive);
      border-color: color-mix(in srgb, var(--positive) 35%, transparent);
      background: rgba(45, 212, 168, 0.08);
    }

    .tx-ext-btn {
      padding: 2px 6px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      background: var(--bg-raised);
      color: var(--text-muted);
      font-size: 11px;
      cursor: pointer;
      transition: color 120ms ease, border-color 120ms ease;
    }
    .tx-ext-btn:hover {
      color: var(--text-bright);
      border-color: var(--accent);
    }

    /* ── Empty & Banners ── */
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

    .msg-banner {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-3);
      border-radius: var(--radius-sm);
      font-size: 12px;
      line-height: 1.4;
    }
    .msg-banner.error {
      background: rgba(248, 113, 113, 0.1);
      border: 1px solid rgba(248, 113, 113, 0.3);
      color: var(--negative);
    }
    .msg-banner.success {
      background: rgba(45, 212, 168, 0.1);
      border: 1px solid rgba(45, 212, 168, 0.3);
      color: var(--positive);
    }

    .btn-primary {
      padding: 7px 14px;
      border: none;
      border-radius: var(--radius-sm);
      background: var(--accent);
      color: #fff;
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 150ms ease, opacity 150ms ease;
    }
    .btn-primary:hover:not(:disabled) {
      background: var(--accent-hover);
    }
    .btn-primary:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `],
})
export class BpRewardsComponent implements OnDestroy {
  busy = signal(false);
  refreshing = signal(false);
  claimError = signal('');
  claimSuccess = signal('');
  loadingHistory = signal(false);
  claimHistory = signal<ClaimAction[]>([]);
  unclaimedPay = signal('—');
  hasUnpaidBlocks = signal(false);
  lastClaimTime = signal('—');
  lastClaimRaw = signal('');
  monthlyTotal = signal('—');
  lastMonthTotal = signal('—');
  lastMonthLabel = signal('LAST MONTH');
  dailyAvg = signal('—');
  monthlyTotalUsd = signal('');
  lastMonthTotalUsd = signal('');
  dailyAvgUsd = signal('');
  copiedTx = signal('');

  // ── Wire Rewards State ──
  readonly isWire = computed(() => this.wallet.activeChain()?.system_contract === 'sysio');
  readonly historyUnavailable = computed(() => {
    const chain = this.wallet.activeChain();
    return (
      chain?.features?.history === false ||
      (this.wallet.hasTauri() && (chain?.hyperion_apis?.length ?? 0) === 0)
    );
  });
  readonly selectedIdentity = computed(() => {
    const acct = this.wallet.selectedAccount();
    return acct ? `${acct.chainId}:${acct.name}` : '';
  });
  wirePayclaimBalance = signal('0.000000000 WIRE');
  wireCanClaimPay = signal(false);
  wireEpochInfo = signal<WireEpochInfo | null>(null);
  wireProducerRow = signal<any | null>(null);
  wireNodeDist = signal<WireNodeDistResult | null>(null);
  wireNodeClaimableLoading = signal(false);
  wireLoadError = signal('');
  wireNodeTier = signal('');
  wireMinClaimable = signal('10.000000000 WIRE');

  private rewardsRequest = 0;
  private historyRequest = 0;

  // ── Wire `claim` Permission Helper State ──
  wireHasClaimPerm = signal(false);
  wireClaimpayLinked = signal(false);
  wireClaimnodedisLinked = signal(false);
  wireClaimpayPerm = signal('active');
  wireClaimnodedisPerm = signal('active');
  showClaimSetup = signal(false);
  claimPermKey = signal('');
  generatedClaimWif = signal('');
  copiedClaimWif = signal(false);
  linkClaimpay = signal(true);
  linkClaimnodedis = signal(false);

  readonly wireClaimFullyLinked = computed(() => {
    if (!this.wireHasClaimPerm()) return false;
    const needsPay = !!(this.wallet.selectedAccount()?.isProducer || this.wireCanClaimPay());
    const needsNode = !!this.wireNodeDist();
    if (needsPay && !this.wireClaimpayLinked()) return false;
    if (needsNode && !this.wireClaimnodedisLinked()) return false;
    return this.wireClaimpayLinked() || this.wireClaimnodedisLinked();
  });

  readonly wireNextEpochCountdown = computed(() => {
    const ep = this.wireEpochInfo();
    const secs = Number(ep?.seconds_until_next ?? NaN);
    if (!Number.isFinite(secs) || secs < 0) return '—';
    const mins = Math.floor(secs / 60);
    const rem = Math.floor(secs % 60);
    if (mins > 0) return `${mins}m ${rem}s`;
    return `${rem}s`;
  });

  readonly wireClaimedPct = computed(() => {
    const nd = this.wireNodeDist();
    if (!nd) return 0;
    const total = this.parseAmount(nd.total_allocation);
    if (total <= 0) return 0;
    return Math.min(100, Math.max(0, (this.parseAmount(nd.claimed) / total) * 100));
  });

  readonly wireClaimablePct = computed(() => {
    const nd = this.wireNodeDist();
    if (!nd) return 0;
    const total = this.parseAmount(nd.total_allocation);
    if (total <= 0) return 0;
    return Math.min(
      100 - this.wireClaimedPct(),
      Math.max(0, (this.parseAmount(nd.claimable) / total) * 100),
    );
  });

  readonly wireVestingPct = computed(() =>
    (this.wireClaimedPct() + this.wireClaimablePct()).toFixed(2),
  );

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
      const identity = this.selectedIdentity();
      if (!identity) return;
      const acct = untracked(() => this.wallet.selectedAccount());
      if (!acct) return;

      untracked(() => {
        this.wireLoadError.set('');
        this.claimError.set('');
        this.claimSuccess.set('');
        if (acct.wireNodeDistRow) {
          this.wireNodeDist.set({
            total_allocation: acct.wireNodeDistRow.total_allocation,
            claimed: acct.wireNodeDistRow.claimed,
            claimable: '',
            can_claim: false,
          });
          this.wireNodeClaimableLoading.set(true);
        } else {
          this.wireNodeDist.set(null);
          this.wireNodeClaimableLoading.set(false);
          this.wireNodeTier.set('');
        }
        void this.loadRewardsData(acct.chainId, acct.name);
        void this.loadClaimHistory(acct.chainId, acct.name);
      });
    });

    effect(() => {
      const row = this.wallet.selectedAccount()?.wireNodeDistRow;
      if (!row) return;
      untracked(() => {
        if (!this.wireNodeDist()) {
          this.wireNodeDist.set({
            total_allocation: row.total_allocation,
            claimed: row.claimed,
            claimable: '',
            can_claim: false,
          });
          this.wireNodeClaimableLoading.set(true);
        }
      });
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
    this.rewardsRequest++;
    this.historyRequest++;
    this.resizeObserver?.disconnect();
    this.chartInstance?.dispose();
  }

  private isCurrentAccount(chainId: string, account: string): boolean {
    const acct = this.wallet.selectedAccount();
    return !!acct && acct.chainId === chainId && acct.name === account;
  }

  async refresh() {
    const acct = this.wallet.selectedAccount();
    if (!acct) return;
    this.refreshing.set(true);
    try {
      await Promise.all([
        this.loadRewardsData(acct.chainId, acct.name),
        this.loadClaimHistory(acct.chainId, acct.name),
      ]);
    } finally {
      this.refreshing.set(false);
    }
  }

  async copyTx(trxId: string) {
    if (!trxId) return;
    try {
      await navigator.clipboard.writeText(trxId);
      this.copiedTx.set(trxId);
      setTimeout(() => {
        if (this.copiedTx() === trxId) this.copiedTx.set('');
      }, 1800);
    } catch { /* ignore */ }
  }

  explorerTxUrl(trxId: string): string | null {
    const explorer = this.wallet.activeChain()?.explorers?.[0];
    const tpl = explorer?.tx_url ?? explorer?.transaction_url;
    if (!tpl || !trxId) return null;
    return tpl.replace('{transaction}', trxId).replace('{tx}', trxId);
  }

  async openExternal(url: string) {
    try {
      await openUrl(url);
    } catch {
      window.open(url, '_blank', 'noopener');
    }
  }

  private parseAmount(raw: string): number {
    if (!raw) return 0;
    const match = raw.match(/^([0-9.]+)/);
    return match ? parseFloat(match[1]) : 0;
  }

  private getSymbol(history: ClaimAction[]): string {
    const first = history.find((h) => h.amount);
    if (!first) return this.wallet.activeChain()?.symbol ?? '';
    const match = first.amount.match(/\s*([A-Za-z]+)$/);
    return match ? match[1] : '';
  }

  private computeStats(history: ClaimAction[]) {
    const symbol = this.getSymbol(history);
    const hasAmounts = history.some((h) => h.amount);

    if (history.length > 0 && history[0].timestamp) {
      this.lastClaimRaw.set(history[0].timestamp);
      this.lastClaimTime.set(this.relativeTime(history[0].timestamp));
    }

    if (!hasAmounts) {
      const now = new Date();
      const thisMonth = history.filter((h) => {
        const d = new Date(h.timestamp);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      this.monthlyTotal.set(`${thisMonth.length} claims`);
      this.monthlyTotalUsd.set('');

      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      this.lastMonthLabel.set(
        prevMonth.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      );
      const lastMonth = history.filter((h) => {
        const d = new Date(h.timestamp);
        return d.getMonth() === prevMonth.getMonth() && d.getFullYear() === prevMonth.getFullYear();
      });
      this.lastMonthTotal.set(`${lastMonth.length} claims`);
      this.lastMonthTotalUsd.set('');

      const thirtyDaysAgo = Date.now() - 30 * 86400_000;
      const recent = history.filter((h) => new Date(h.timestamp).getTime() >= thirtyDaysAgo);
      const avg = recent.length > 0 ? (recent.length / 30).toFixed(1) : '0';
      this.dailyAvg.set(`${avg} claims/d`);
      this.dailyAvgUsd.set('');
      return;
    }

    const now = new Date();
    let monthSum = 0;
    for (const h of history) {
      const d = new Date(h.timestamp);
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
        monthSum += this.parseAmount(h.amount);
      }
    }
    this.monthlyTotal.set(
      monthSum > 0 ? `${this.formatNumber(monthSum)} ${symbol}` : `0 ${symbol}`,
    );
    const monthUsd = this.priceService.toUsd(`${monthSum} ${symbol}`);
    this.monthlyTotalUsd.set(monthUsd !== null ? this.priceService.formatUsd(monthUsd) : '');

    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    this.lastMonthLabel.set(
      prevMonth.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    );
    let lastMonthSum = 0;
    for (const h of history) {
      const d = new Date(h.timestamp);
      if (d.getMonth() === prevMonth.getMonth() && d.getFullYear() === prevMonth.getFullYear()) {
        lastMonthSum += this.parseAmount(h.amount);
      }
    }
    this.lastMonthTotal.set(
      lastMonthSum > 0 ? `${this.formatNumber(lastMonthSum)} ${symbol}` : `0 ${symbol}`,
    );
    const lastMonthUsd = this.priceService.toUsd(`${lastMonthSum} ${symbol}`);
    this.lastMonthTotalUsd.set(
      lastMonthUsd !== null ? this.priceService.formatUsd(lastMonthUsd) : '',
    );

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
    const accentColor =
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#6ee7b7';
    const mutedColor =
      getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#888';
    const borderColor =
      getComputedStyle(document.documentElement).getPropertyValue('--border-subtle').trim() ||
      'rgba(255,255,255,0.1)';

    const symbol = this.getSymbol(history);
    const hasAmounts = history.some((h) => h.amount);

    const aggregated = new Map<string, number>();
    for (const h of [...history].reverse()) {
      const dStr = new Date(h.timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
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
      grid: { top: 16, right: 16, bottom: 24, left: hasAmounts ? 60 : 35 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: {
          color: mutedColor,
          fontSize: 10,
          fontFamily: 'var(--font-body)',
          interval: Math.max(0, Math.floor(dates.length / 10) - 1),
        },
        axisLine: { lineStyle: { color: borderColor } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: borderColor, type: 'dashed' } },
        axisLabel: {
          color: mutedColor,
          fontSize: 10,
          fontFamily: 'var(--font-data)',
          formatter: (v: number) => (hasAmounts ? this.formatNumber(v) : String(v)),
        },
      },
      series: [
        {
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
        },
      ],
    };
    this.chartInstance!.setOption(option, true);
  }

  private async loadRewardsData(chainId: string, account: string) {
    const request = ++this.rewardsRequest;
    if (this.isWire()) {
      await this.loadWireRewardsData(chainId, account, request);
      return;
    }

    try {
      const result = await this.ipc.getProducers(chainId, 200);
      if (request !== this.rewardsRequest || !this.isCurrentAccount(chainId, account)) return;
      const list: any[] = result?.rows ?? result?.producers ?? [];
      const row = list.find((r: any) => r.owner === account);
      if (row) {
        const unpaid = Number(row.unpaid_blocks ?? 0);
        this.hasUnpaidBlocks.set(unpaid > 0);
        this.unclaimedPay.set(unpaid > 0 ? `${unpaid.toLocaleString()} blocks` : '0 blocks');
        const claimTime = row.last_claim_time;
        if (claimTime && claimTime !== '1970-01-01T00:00:00.000' && claimTime !== '1970-01-01T00:00:00') {
          this.lastClaimRaw.set(claimTime);
          this.lastClaimTime.set(this.relativeTime(claimTime));
        } else {
          this.lastClaimRaw.set('');
          this.lastClaimTime.set('Never');
        }
      }
    } catch {
      /* offline */
    }
  }

  private async loadWireRewardsData(chainId: string, account: string, request: number) {
    const [
      payclaimsRes,
      epochRes,
      prodRes,
      nodeDistRes,
      nodedistTableRes,
      roaRes,
      emitCfgRes,
      acctRes,
    ] = await Promise.allSettled([
      this.ipc.getTableRows(chainId, {
        code: 'sysio',
        scope: 'sysio',
        table: 'payclaims',
        lower_bound: account,
        upper_bound: account,
        limit: 1,
        json: true,
      }),
      this.ipc.callReadOnlyAction<WireEpochInfo>(chainId, 'sysio', 'viewepoch', {}),
      this.ipc.getTableRows(chainId, {
        code: 'sysio',
        scope: 'sysio',
        table: 'producers',
        lower_bound: account,
        upper_bound: account,
        limit: 1,
        json: true,
      }),
      this.ipc.callReadOnlyAction<WireNodeDistResult>(chainId, 'sysio', 'viewnodedist', {
        account_name: account,
      }),
      this.ipc.getTableRows(chainId, {
        code: 'sysio',
        scope: 'sysio',
        table: 'nodedist',
        lower_bound: account,
        upper_bound: account,
        limit: 1,
        json: true,
      }),
      this.ipc.getTableRows(chainId, {
        code: 'sysio.roa',
        scope: '0',
        table: 'nodeowners',
        lower_bound: account,
        upper_bound: account,
        limit: 1,
        json: true,
      }),
      this.ipc.callReadOnlyAction<{ min_claimable?: string }>(
        chainId,
        'sysio',
        'viewemitcfg',
        {},
      ),
      this.ipc.getAccount(chainId, account),
    ]);

    if (request !== this.rewardsRequest || !this.isCurrentAccount(chainId, account)) return;

    // 1. Payclaims
    if (payclaimsRes.status === 'fulfilled' && Array.isArray(payclaimsRes.value?.rows)) {
      const row = payclaimsRes.value.rows[0];
      if (row && row.account_name === account) {
        const rawBal = String(row.balance ?? '0');
        let positive = false;
        try {
          positive = BigInt(rawBal) > 0n;
        } catch {
          positive = false;
        }
        this.wirePayclaimBalance.set(formatWireBaseUnits(rawBal));
        this.wireCanClaimPay.set(positive);
      } else {
        this.wirePayclaimBalance.set('0.000000000 WIRE');
        this.wireCanClaimPay.set(false);
      }
    }

    // 2. Epoch info
    if (epochRes.status === 'fulfilled' && epochRes.value) {
      this.wireEpochInfo.set(epochRes.value);
    }

    // 3. Producer row
    if (prodRes.status === 'fulfilled' && Array.isArray(prodRes.value?.rows)) {
      const prow = prodRes.value.rows[0];
      this.wireProducerRow.set(prow?.owner === account ? prow : null);
    }

    // 4. Node distribution & tier
    const updateTierFromRoa = () => {
      if (roaRes.status === 'fulfilled' && Array.isArray(roaRes.value?.rows)) {
        const tierRow = roaRes.value.rows[0];
        if (tierRow?.owner === account && tierRow.tier !== undefined && tierRow.tier !== null) {
          const rawTier = String(tierRow.tier).trim();
          this.wireNodeTier.set(rawTier ? (rawTier.startsWith('T') ? rawTier : `T${rawTier}`) : '');
        } else {
          this.wireNodeTier.set('');
        }
      }
    };

    const seedFromNodedistTable = (): boolean => {
      const tableRow =
        nodedistTableRes.status === 'fulfilled' && Array.isArray(nodedistTableRes.value?.rows)
          ? nodedistTableRes.value.rows[0]
          : null;
      const fallbackRow =
        tableRow?.account_name === account
          ? tableRow
          : this.wallet.selectedAccount()?.wireNodeDistRow;
      if (
        fallbackRow &&
        typeof fallbackRow.total_allocation === 'string' &&
        typeof fallbackRow.claimed === 'string'
      ) {
        if (!this.wireNodeDist()) {
          this.wireNodeDist.set({
            total_allocation: fallbackRow.total_allocation,
            claimed: fallbackRow.claimed,
            claimable: '',
            can_claim: false,
          });
        }
        this.wireNodeClaimableLoading.set(true);
        return true;
      }
      return false;
    };

    if (
      nodeDistRes.status === 'fulfilled' &&
      nodeDistRes.value &&
      typeof nodeDistRes.value.total_allocation === 'string'
    ) {
      this.wireNodeDist.set(nodeDistRes.value);
      this.wireNodeClaimableLoading.set(false);
      this.wireLoadError.set('');
      updateTierFromRoa();
    } else {
      const reason =
        nodeDistRes.status === 'rejected'
          ? nodeDistRes.reason
          : new Error(`Unexpected viewnodedist payload: ${JSON.stringify(nodeDistRes.value)}`);
      console.warn(`[bp-rewards] viewnodedist failed for ${account}@${chainId}:`, reason);
      const errMsg = (
        typeof reason === 'string' ? reason : (reason as any)?.message ?? String(reason ?? '')
      ).toLowerCase();

      if (errMsg.includes('account is not a node owner')) {
        this.wireNodeDist.set(null);
        this.wireNodeTier.set('');
        this.wireNodeClaimableLoading.set(false);
        this.wireLoadError.set('');
      } else {
        const hasFallback = seedFromNodedistTable();
        updateTierFromRoa();
        if (this.wireNodeDist() || hasFallback || this.wallet.selectedAccount()?.isNodeOwner) {
          this.wireLoadError.set(
            'Could not load live node reward details from the network. Click Retry to try again.',
          );
        }
      }
    }

    // 5. Emission config
    if (
      emitCfgRes.status === 'fulfilled' &&
      emitCfgRes.value?.min_claimable !== undefined &&
      emitCfgRes.value?.min_claimable !== null
    ) {
      const rawMin = String(emitCfgRes.value.min_claimable).trim();
      this.wireMinClaimable.set(/^-?\d+$/.test(rawMin) ? formatWireBaseUnits(rawMin) : rawMin);
    }

    // 6. Account permissions (`claim` permission & `linkauth` inspection)
    if (acctRes.status === 'fulfilled' && acctRes.value?.permissions) {
      const perms = acctRes.value.permissions;
      const claimPerm = perms.find((p: any) => p.perm_name === 'claim');
      this.wireHasClaimPerm.set(!!claimPerm);
      const claimpayPerm = perms.find((p: any) =>
        p.linked_actions?.some(
          (l: any) => l.account === 'sysio' && (l.action === 'claimpay' || !l.action),
        ),
      );
      const claimnodedisPerm = perms.find((p: any) =>
        p.linked_actions?.some(
          (l: any) => l.account === 'sysio' && (l.action === 'claimnodedis' || !l.action),
        ),
      );
      this.wireClaimpayLinked.set(claimpayPerm?.perm_name === 'claim');
      this.wireClaimnodedisLinked.set(claimnodedisPerm?.perm_name === 'claim');

      if (!this.claimPermKey() && claimPerm?.required_auth?.keys?.[0]?.key) {
        this.claimPermKey.set(normalizePubEm(claimPerm.required_auth.keys[0].key));
      }
    }

    // Resolve actual signing permission for each Wire claim action (requires matching key in wallet)
    const selectedAcct = this.wallet.selectedAccount();
    if (selectedAcct && selectedAcct.chainId === chainId && selectedAcct.name === account) {
      const acctWithInfo =
        acctRes.status === 'fulfilled' && acctRes.value
          ? { ...selectedAcct, info: acctRes.value }
          : selectedAcct;
      try {
        const sPay = await resolveActionPermissionAndSigner(
          this.ipc,
          acctWithInfo,
          'sysio',
          'claimpay',
          'active',
        );
        if (request === this.rewardsRequest && this.isCurrentAccount(chainId, account)) {
          this.wireClaimpayPerm.set(sPay.permission);
        }
      } catch {
        if (request === this.rewardsRequest && this.isCurrentAccount(chainId, account)) {
          this.wireClaimpayPerm.set('active');
        }
      }
      try {
        const sNode = await resolveActionPermissionAndSigner(
          this.ipc,
          acctWithInfo,
          'sysio',
          'claimnodedis',
          'active',
        );
        if (request === this.rewardsRequest && this.isCurrentAccount(chainId, account)) {
          this.wireClaimnodedisPerm.set(sNode.permission);
        }
      } catch {
        if (request === this.rewardsRequest && this.isCurrentAccount(chainId, account)) {
          this.wireClaimnodedisPerm.set('active');
        }
      }
    }
  }

  private async loadClaimHistory(chainId: string, account: string) {
    const request = ++this.historyRequest;
    if (this.historyUnavailable()) {
      this.loadingHistory.set(false);
      this.claimHistory.set([]);
      return;
    }
    this.loadingHistory.set(true);
    try {
      const chain = this.wallet.activeChain();
      const isFio = chain?.token_contract === 'fio.token';
      const isWire = chain?.system_contract === 'sysio';
      const after90d = new Date(Date.now() - 90 * 86400_000).toISOString();

      if (isWire) {
        const result = await this.ipc.getActionsHistory(chainId, account, 100, 0, {
          actName: 'transfer',
          after: after90d,
        });
        if (request !== this.historyRequest || !this.isCurrentAccount(chainId, account)) return;
        const raw: any[] = result?.actions ?? [];
        const wireClaims = raw
          .filter((a: any) => {
            const from = a.act?.data?.from;
            const to = a.act?.data?.to;
            const memo = a.act?.data?.memo;
            return (
              from === 'sysio' &&
              to === account &&
              (memo === 'T5 epoch pay claim' || memo === 'Node Owner distribution')
            );
          })
          .map(
            (a: any): ClaimAction => ({
              timestamp: a['@timestamp'] ?? '',
              trx_id: a.trx_id ?? '',
              data: a.act?.data ?? {},
              amount: a.act?.data?.quantity ?? '',
              rewardKind: a.act?.data?.memo === 'Node Owner distribution' ? 'node' : 'epoch',
            }),
          );
        this.claimHistory.set(wireClaims);
        this.computeStats(wireClaims);
      } else if (isFio) {
        const result = await this.ipc.getActionsHistory(chainId, account, 100, 0, {
          actName: 'transfer',
          after: after90d,
        });
        if (request !== this.historyRequest || !this.isCurrentAccount(chainId, account)) return;
        const raw: any[] = result?.actions ?? [];
        const treasury = raw.filter(
          (a: any) => a.act?.data?.from === 'fio.treasury' && a.act?.data?.to === account,
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
        const result = await this.ipc.getActionsHistory(chainId, account, 100, 0, {
          actName: 'transfer',
          after: after90d,
        });
        if (request !== this.historyRequest || !this.isCurrentAccount(chainId, account)) return;
        const raw: any[] = result?.actions ?? [];
        const bpPayouts = raw.filter((a: any) => {
          const from = a.act?.data?.from;
          const to = a.act?.data?.to;
          return (
            (from === 'eosio.bpay' ||
              from === 'eosio.vpay' ||
              from === 'sysio.bpay' ||
              from === 'sysio.vpay') &&
            to === account
          );
        });

        if (bpPayouts.length > 0) {
          const byTx = new Map<string, ClaimAction>();
          for (const a of bpPayouts) {
            const trxId = a.trx_id ?? '';
            const qty = a.act?.data?.quantity ?? '';
            const existing = byTx.get(trxId);
            if (existing) {
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
          const fallback = await this.ipc.getActionsHistory(chainId, account, 100, 0, {
            actName: 'claimrewards',
            after: after90d,
          });
          if (request !== this.historyRequest || !this.isCurrentAccount(chainId, account)) return;
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
      if (request === this.historyRequest && this.isCurrentAccount(chainId, account)) {
        this.claimHistory.set([]);
        this.computeStats([]);
      }
    } finally {
      if (request === this.historyRequest) {
        this.loadingHistory.set(false);
      }
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

  private async fioAddr(): Promise<string> {
    return this.fioApi.resolveOwnedHandle(this.wallet.selectedAccount());
  }

  async onClaimWireEpochPay() {
    const account = this.wallet.selectedAccount();
    if (!account) return;
    this.busy.set(true);
    this.claimError.set('');
    this.claimSuccess.set('');
    try {
      const signer = await resolveActionPermissionAndSigner(
        this.ipc,
        account,
        'sysio',
        'claimpay',
        'active',
      );
      const result = await this.tx.confirm({
        chainId: account.chainId,
        publicKey: signer.publicKey,
        ledgerIndex: signer.ledgerIndex,
        title: `Claim Epoch Pay (${account.name})`,
        actions: [
          {
            account: 'sysio',
            name: 'claimpay',
            authorization: [{ actor: account.name, permission: signer.permission }],
            data: { account_name: account.name },
          },
        ],
      });
      if (result) {
        this.claimSuccess.set(
          `Epoch pay claimed (TX: ${result.transaction_id?.slice(0, 10) ?? 'sent'}…)`,
        );
        await this.wallet.refreshAccount(this.wallet.selectedIndex());
        await this.loadRewardsData(account.chainId, account.name);
        await this.loadClaimHistory(account.chainId, account.name);
      }
    } catch (e: any) {
      this.claimError.set(mapWireClaimError(e));
    } finally {
      this.busy.set(false);
    }
  }

  async onClaimWireNodeRewards() {
    const account = this.wallet.selectedAccount();
    if (!account) return;
    this.busy.set(true);
    this.claimError.set('');
    this.claimSuccess.set('');
    try {
      const signer = await resolveActionPermissionAndSigner(
        this.ipc,
        account,
        'sysio',
        'claimnodedis',
        'active',
      );
      const result = await this.tx.confirm({
        chainId: account.chainId,
        publicKey: signer.publicKey,
        ledgerIndex: signer.ledgerIndex,
        title: `Claim Node Rewards (${account.name})`,
        actions: [
          {
            account: 'sysio',
            name: 'claimnodedis',
            authorization: [{ actor: account.name, permission: signer.permission }],
            data: { account_name: account.name },
          },
        ],
      });
      if (result) {
        this.claimSuccess.set(
          `Node owner rewards claimed (TX: ${result.transaction_id?.slice(0, 10) ?? 'sent'}…)`,
        );
        await this.wallet.refreshAccount(this.wallet.selectedIndex());
        await this.loadRewardsData(account.chainId, account.name);
        await this.loadClaimHistory(account.chainId, account.name);
      }
    } catch (e: any) {
      this.claimError.set(mapWireClaimError(e));
    } finally {
      this.busy.set(false);
    }
  }

  toggleClaimSetup() {
    const next = !this.showClaimSetup();
    this.showClaimSetup.set(next);
    if (next) {
      const acct = this.wallet.selectedAccount();
      this.linkClaimpay.set(!!(acct?.isProducer || this.wireCanClaimPay() || !this.wireNodeDist()));
      this.linkClaimnodedis.set(!!this.wireNodeDist());
    }
  }

  onClaimKeyInput(val: string) {
    this.claimPermKey.set(val.trim());
    this.generatedClaimWif.set('');
  }

  async generateClaimKeyPair() {
    this.claimError.set('');
    try {
      const kp = await this.ipc.generateKeyPair();
      this.claimPermKey.set(kp.public_key);
      this.generatedClaimWif.set(kp.wif);
    } catch (e: any) {
      this.claimError.set(e?.toString() ?? 'Failed to generate keypair');
    }
  }

  async copyClaimWif() {
    const wif = this.generatedClaimWif();
    if (!wif) return;
    try {
      await navigator.clipboard.writeText(wif);
      this.copiedClaimWif.set(true);
      setTimeout(() => this.copiedClaimWif.set(false), 1800);
    } catch { /* ignore */ }
  }

  async submitClaimPermissionSetup() {
    const account = this.wallet.selectedAccount();
    const key = normalizePubEm(this.claimPermKey().trim());
    if (!account || !key) return;

    this.busy.set(true);
    this.claimError.set('');
    this.claimSuccess.set('');
    try {
      const signer = await resolveAccountSigner(this.ipc, account, 'active');
      const auth = [{ actor: account.name, permission: 'active' }];
      const actions: any[] = [
        {
          account: 'sysio',
          name: 'updateauth',
          authorization: auth,
          data: {
            account: account.name,
            permission: 'claim',
            parent: 'active',
            auth: {
              threshold: 1,
              keys: [{ key, weight: 1 }],
              accounts: [],
            },
          },
        },
      ];

      if (this.linkClaimpay() && !this.wireClaimpayLinked()) {
        actions.push({
          account: 'sysio',
          name: 'linkauth',
          authorization: auth,
          data: {
            account: account.name,
            code: 'sysio',
            type: 'claimpay',
            requirement: 'claim',
          },
        });
      }

      if (this.linkClaimnodedis() && !this.wireClaimnodedisLinked()) {
        actions.push({
          account: 'sysio',
          name: 'linkauth',
          authorization: auth,
          data: {
            account: account.name,
            code: 'sysio',
            type: 'claimnodedis',
            requirement: 'claim',
          },
        });
      }

      const result = await this.tx.confirm({
        chainId: account.chainId,
        publicKey: signer.publicKey,
        ledgerIndex: signer.ledgerIndex,
        title: `Configure @claim Permission (${account.name})`,
        actions,
      });

      if (result) {
        this.claimSuccess.set(
          `Configured @claim permission (TX: ${result.transaction_id?.slice(0, 10) ?? 'sent'}…)`,
        );
        this.showClaimSetup.set(false);
        await this.wallet.refreshAccount(this.wallet.selectedIndex());
        await this.loadRewardsData(account.chainId, account.name);
      }
    } catch (e: any) {
      this.claimError.set(mapWireClaimError(e));
    } finally {
      this.busy.set(false);
    }
  }

  async onClaimRewards() {
    const account = this.wallet.selectedAccount();
    if (!account) return;
    if (this.isWire()) {
      await this.onClaimWireEpochPay();
      return;
    }

    this.busy.set(true);
    this.claimError.set('');
    this.claimSuccess.set('');
    try {
      const chain = this.wallet.activeChain();
      const isFio = chain?.token_contract === 'fio.token';
      const targetContract = isFio ? 'fio.treasury' : this.wallet.systemAccount('claimrewards');
      const targetAction = isFio ? 'bpclaim' : 'claimrewards';

      const signer = await resolveActionPermissionAndSigner(
        this.ipc,
        account,
        targetContract,
        targetAction,
        'active',
      );

      let actions: any[];
      if (isFio) {
        const handle = await this.fioAddr();
        if (!handle) {
          this.claimError.set(fioNoHandleMessage('claim BP rewards'));
          return;
        }
        actions = [
          {
            account: 'fio.treasury',
            name: 'bpclaim',
            authorization: [{ actor: account.name, permission: signer.permission }],
            data: { fio_address: handle, actor: account.name },
          },
        ];
      } else {
        actions = [
          {
            account: targetContract,
            name: 'claimrewards',
            authorization: [{ actor: account.name, permission: signer.permission }],
            data: { owner: account.name },
          },
        ];
      }

      const result = await this.tx.confirm({
        chainId: account.chainId,
        publicKey: signer.publicKey,
        ledgerIndex: signer.ledgerIndex,
        actions,
        title: 'Claim Rewards',
      });
      if (result) {
        this.claimSuccess.set(`Rewards claimed (TX: ${result.transaction_id?.slice(0, 10) ?? 'sent'}…)`);
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
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatDateShort(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
    const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
    const diff = Date.now() - d.getTime();
    if (isNaN(diff) || diff < 0) return 'Just now';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}
