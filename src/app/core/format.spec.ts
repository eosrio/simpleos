import { describe, expect, it } from 'vitest';
import { compactAsset, compactNumber, parseAsset } from './format';

describe('parseAsset', () => {
  it('splits an asset string into value and symbol', () => {
    expect(parseAsset('4670.8101 EOS')).toEqual({ value: 4670.8101, symbol: 'EOS' });
  });

  it('returns null for empty or non-asset input', () => {
    expect(parseAsset(undefined)).toBeNull();
    expect(parseAsset('')).toBeNull();
    expect(parseAsset('not an amount')).toBeNull();
  });
});

describe('compactNumber', () => {
  it('collapses large magnitudes', () => {
    expect(compactNumber(1_234_000)).toBe('1.23M');
    expect(compactNumber(2_500_000_000)).toBe('2.50B');
  });

  it('drops decimals from five-figure amounts and keeps two below that', () => {
    // Grouping separators are locale-dependent, so assert on the digits only.
    expect(compactNumber(18088.0334794).replace(/[^0-9]/g, '')).toBe('18088');
    expect(compactNumber(4670.8101)).toMatch(/^4.670[.,]81$/);
  });

  it('keeps dust readable instead of rounding it to zero', () => {
    expect(compactNumber(0.0021)).toBe('0.0021');
    expect(compactNumber(0.00001)).toBe('<0.0001');
    expect(compactNumber(0)).toBe('0');
  });
});

describe('compactAsset', () => {
  it('keeps the symbol alongside the rounded amount', () => {
    expect(compactAsset('1234000.0000 WAX')).toBe('1.23M WAX');
  });

  it('shows an em dash when there is no balance', () => {
    expect(compactAsset(undefined)).toBe('—');
    expect(compactAsset(null)).toBe('—');
  });

  it('passes through anything that is not an asset string', () => {
    expect(compactAsset('No cached price')).toBe('No cached price');
  });
});
