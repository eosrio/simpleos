import type { ChainConfig } from '../../../core/services/tauri-ipc.service';

export type PortfolioPriceChain = Pick<ChainConfig, 'name' | 'testnet'> | null | undefined;

export function isTestnetPortfolioChain(chain: PortfolioPriceChain): boolean {
  return !!chain && (chain.testnet === true || /\btestnet\b/i.test(chain.name));
}

export function portfolioTokenUsdValue(
  balance: string | null | undefined,
  chain: PortfolioPriceChain,
  toUsd: (balance: string) => number | null,
): number | null {
  if (!balance || !chain || isTestnetPortfolioChain(chain)) {
    return null;
  }

  return toUsd(balance);
}
