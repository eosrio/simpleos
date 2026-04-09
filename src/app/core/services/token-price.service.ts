import { Injectable, signal, computed } from '@angular/core';
import { TauriIpcService, ChainConfig } from './tauri-ipc.service';
import { WalletStateService } from './wallet-state.service';

export type PriceSource = 'oracle' | 'coingecko' | 'cache';

export interface TokenPrice {
  usdPrice: number;
  source: PriceSource;
  updatedAt: number;
  stale: boolean;
}

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_KEY = 'tokenPrices';

@Injectable({ providedIn: 'root' })
export class TokenPriceService {
  private readonly _prices = signal<Map<string, TokenPrice>>(new Map());
  readonly prices = this._prices.asReadonly();
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private ipc: TauriIpcService,
    private wallet: WalletStateService,
  ) {}

  /** Initialize the service: restore cache, fetch fresh prices, start auto-refresh. */
  async initialize() {
    await this.restoreCache();
    this.refreshAll();
    this.intervalId = setInterval(() => this.refreshAll(), REFRESH_INTERVAL_MS);
  }

  /** Get the current price for a symbol. Returns null if unavailable. */
  getPrice(symbol: string): TokenPrice | null {
    return this._prices().get(symbol.toUpperCase()) ?? null;
  }

  /** Convert a token amount string (e.g. "1234.5678 EOS") to USD. */
  toUsd(amountStr: string): number | null {
    if (!amountStr) return null;
    const match = amountStr.match(/^([0-9.]+)\s*([A-Za-z]+)$/);
    if (!match) return null;
    const amount = parseFloat(match[1]);
    const symbol = match[2].toUpperCase();
    const price = this.getPrice(symbol);
    if (!price) return null;
    return amount * price.usdPrice;
  }

  /** Format a USD value for display. */
  formatUsd(value: number | null): string {
    if (value === null || value === undefined) return '';
    if (value >= 1_000_000) return `≈ $${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `≈ $${(value / 1_000).toFixed(2)}K`;
    if (value >= 1) return `≈ $${value.toFixed(2)}`;
    return `≈ $${value.toFixed(4)}`;
  }

  /** Refresh all prices: oracle first for chains that support it, then CoinGecko batch for the rest. */
  async refreshAll() {
    const chains = this.wallet.chains();
    if (chains.length === 0) return;

    const map = new Map(this._prices());
    const needsApi: ChainConfig[] = [];

    // Tier 1: On-chain oracles (parallel)
    const oracleChains = chains.filter(c => c.oracle_contract && c.oracle_scope && !c.testnet);
    const oracleResults = await Promise.allSettled(
      oracleChains.map(c => this.fetchOraclePrice(c))
    );

    for (let i = 0; i < oracleChains.length; i++) {
      const chain = oracleChains[i];
      const result = oracleResults[i];
      if (result.status === 'fulfilled' && result.value !== null) {
        map.set(chain.symbol.toUpperCase(), {
          usdPrice: result.value,
          source: 'oracle',
          updatedAt: Date.now(),
          stale: false,
        });
        // Also set the EOS alias for Vaulta
        if (chain.symbol === 'A') {
          map.set('EOS', { usdPrice: result.value, source: 'oracle', updatedAt: Date.now(), stale: false });
        }
      } else {
        needsApi.push(chain);
      }
    }

    // Tier 2: CoinGecko batch for chains without oracle or where oracle failed
    const apiChains = [...needsApi, ...chains.filter(c => (!c.oracle_contract || !c.oracle_scope) && c.coingecko_id && !c.testnet)];
    if (apiChains.length > 0) {
      const apiPrices = await this.fetchCoinGeckoPrices(apiChains);
      for (const [symbol, price] of apiPrices) {
        // Only override if we don't already have a fresh oracle price
        if (!map.has(symbol) || map.get(symbol)!.source !== 'oracle') {
          map.set(symbol, price);
        }
      }
    }

    this._prices.set(map);
    await this.persistCache(map);
  }

  /** Query DelphiOracle for a USD price. Returns price in USD or null. */
  private async fetchOraclePrice(chain: ChainConfig): Promise<number | null> {
    try {
      const result = await this.ipc.getTableRows(chain.id, {
        code: chain.oracle_contract!,
        table: 'datapoints',
        scope: chain.oracle_scope!,
        limit: 1,
        json: true,
      });
      const row = result.rows?.[0];
      if (!row) return null;
      // DelphiOracle stores median price as integer with 4 decimals (e.g. 12345 = $1.2345)
      const median = row.median ?? row.value ?? 0;
      return median / 10000;
    } catch {
      return null;
    }
  }

  /** Batch-fetch prices from CoinGecko free API. */
  private async fetchCoinGeckoPrices(chains: ChainConfig[]): Promise<Map<string, TokenPrice>> {
    const result = new Map<string, TokenPrice>();
    const idToSymbol = new Map<string, string>();
    const ids: string[] = [];

    for (const c of chains) {
      if (!c.coingecko_id) continue;
      if (ids.includes(c.coingecko_id)) continue;
      ids.push(c.coingecko_id);
      idToSymbol.set(c.coingecko_id, c.symbol.toUpperCase());
    }

    if (ids.length === 0) return result;

    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`;
      const response = await fetch(url);
      if (!response.ok) return result;
      const data = await response.json();

      for (const [cgId, symbol] of idToSymbol) {
        const usd = data[cgId]?.usd;
        if (typeof usd === 'number') {
          const entry: TokenPrice = { usdPrice: usd, source: 'coingecko', updatedAt: Date.now(), stale: false };
          result.set(symbol, entry);
          // Also set the EOS alias for Vaulta
          if (cgId === 'eos') {
            result.set('EOS', entry);
          }
        }
      }
    } catch {
      // API failure — will fall through to cache
    }

    return result;
  }

  /** Restore cached prices from local store. */
  private async restoreCache() {
    try {
      const saved = await this.ipc.storeGet<Record<string, TokenPrice>>(CACHE_KEY);
      if (!saved) return;
      const map = new Map<string, TokenPrice>();
      const now = Date.now();
      for (const [symbol, entry] of Object.entries(saved)) {
        map.set(symbol, {
          ...entry,
          source: 'cache',
          stale: (now - entry.updatedAt) > STALE_THRESHOLD_MS,
        });
      }
      this._prices.set(map);
    } catch { /* no cache */ }
  }

  /** Persist current prices to local store. */
  private async persistCache(map: Map<string, TokenPrice>) {
    try {
      const obj: Record<string, TokenPrice> = {};
      for (const [k, v] of map) {
        obj[k] = v;
      }
      await this.ipc.storeSet(CACHE_KEY, obj);
    } catch { /* best effort */ }
  }
}
