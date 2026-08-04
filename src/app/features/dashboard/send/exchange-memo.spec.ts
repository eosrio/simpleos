import { describe, expect, it } from 'vitest';
import { describeMemoRule, exchangeName, validateExchangeMemo } from './exchange-memo';
import { Exchange } from '../../../core/services/tauri-ipc.service';

const BINANCE: Exchange = {
  account: 'binancecleos',
  label: 'Binance',
  memo_size: 9,
  memo_pattern: '^[0-9]+$',
};

/** Kraken publishes a numeric tag with no fixed width. */
const KRAKEN: Exchange = {
  account: 'krakenkraken',
  label: 'Kraken',
  memo_pattern: '^[0-9]+$',
};

/** An entry with a name only — memo required, shape unknown. */
const BARE: Exchange = { account: 'someexchange' };

describe('validateExchangeMemo', () => {
  it('requires a memo', () => {
    expect(validateExchangeMemo('', BINANCE)).toContain('requires a deposit memo');
    expect(validateExchangeMemo('   ', BINANCE)).toContain('requires a deposit memo');
    expect(validateExchangeMemo('', BARE)).toContain('someexchange');
  });

  it('accepts a well-formed memo', () => {
    expect(validateExchangeMemo('123456789', BINANCE)).toBe('');
    expect(validateExchangeMemo('4815162342', KRAKEN)).toBe('');
    expect(validateExchangeMemo('anything at all', BARE)).toBe('');
  });

  it('enforces the exact tag length', () => {
    expect(validateExchangeMemo('12345678', BINANCE)).toContain('has 8');
    expect(validateExchangeMemo('1234567890', BINANCE)).toContain('has 10');
    // No declared size — any length passes the pattern.
    expect(validateExchangeMemo('1', KRAKEN)).toBe('');
  });

  it('enforces the tag character set', () => {
    expect(validateExchangeMemo('12345678a', BINANCE)).toContain('does not look like');
    expect(validateExchangeMemo('abc', KRAKEN)).toContain('does not look like');
  });

  it('rejects surrounding whitespace that a copy-paste picks up', () => {
    expect(validateExchangeMemo(' 123456789', BINANCE)).toContain('spaces');
    expect(validateExchangeMemo('123456789\n', BINANCE)).toContain('spaces');
  });

  it('ignores a pattern that is not valid JS regex rather than blocking the send', () => {
    const broken: Exchange = { account: 'x', label: 'X', memo_pattern: '^[unclosed' };
    expect(validateExchangeMemo('12345', broken)).toBe('');
  });

  it('validates the UUID-style tag ported from v1', () => {
    const uuidExchange: Exchange = {
      account: 'eosusrwallet',
      memo_size: 36,
      memo_pattern: '^[a-f0-9]{8}-([a-f0-9]{4}-){3}[a-f0-9]{12}$',
    };
    expect(validateExchangeMemo('3f2504e0-4f89-11d3-9a0c-0305e82c3301', uuidExchange)).toBe('');
    expect(validateExchangeMemo('3f2504e04f8911d39a0c0305e82c33011', uuidExchange)).not.toBe('');
  });
});

describe('describeMemoRule', () => {
  it('describes size and character set together', () => {
    expect(describeMemoRule(BINANCE)).toBe('9 digits');
    expect(describeMemoRule(KRAKEN)).toBe('digits');
    expect(describeMemoRule({ account: 'x', memo_size: 16, memo_pattern: '^[a-f0-9]+$' })).toBe(
      '16 hex characters',
    );
    expect(describeMemoRule(BARE)).toBe('');
  });
});

describe('exchangeName', () => {
  it('falls back to the account when unlabeled', () => {
    expect(exchangeName(BINANCE)).toBe('Binance');
    expect(exchangeName(BARE)).toBe('someexchange');
  });
});
