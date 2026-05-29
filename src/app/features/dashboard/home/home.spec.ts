import { describe, expect, it, vi } from 'vitest';
import { portfolioTokenUsdValue } from './portfolio-value';

describe('portfolioTokenUsdValue', () => {
  it('uses USD pricing for mainnet balances', () => {
    const toUsd = vi.fn().mockReturnValue(12.34);

    expect(portfolioTokenUsdValue('100.0000 EOS', { name: 'Vaulta', testnet: false }, toUsd)).toBe(
      12.34,
    );
    expect(toUsd).toHaveBeenCalledWith('100.0000 EOS');
  });

  it('does not price testnet balances that share mainnet symbols', () => {
    const toUsd = vi.fn().mockReturnValue(50_000);

    for (const symbol of ['EOS', 'TLOS', 'WAX', 'UOS', 'FIO', 'XPR']) {
      expect(
        portfolioTokenUsdValue(
          `1000000.0000 ${symbol}`,
          { name: `${symbol} Testnet`, testnet: true },
          toUsd,
        ),
      ).toBeNull();
    }

    expect(toUsd).not.toHaveBeenCalled();
  });

  it('does not price chains named as testnets even without an explicit flag', () => {
    const toUsd = vi.fn().mockReturnValue(12.34);

    expect(portfolioTokenUsdValue('100.0000 EOS', { name: 'Custom Testnet' }, toUsd)).toBeNull();
    expect(toUsd).not.toHaveBeenCalled();
  });

  it('does not price balances when the chain cannot be resolved', () => {
    const toUsd = vi.fn().mockReturnValue(12.34);

    expect(portfolioTokenUsdValue('100.0000 WAX', null, toUsd)).toBeNull();
    expect(toUsd).not.toHaveBeenCalled();
  });
});
