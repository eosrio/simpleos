/**
 * Formatting helpers for Antelope asset strings (`"4670.8101 EOS"`).
 *
 * Chains carry 4–8 decimals of precision on-chain, which is the right thing to
 * sign but the wrong thing to read at a glance. These helpers trade precision
 * for scannability in dense UI — always keep the raw string available (a title
 * attribute, a detail row) wherever a compact value is shown.
 */

export interface ParsedAsset {
  value: number;
  symbol: string;
}

/** Splits `"4670.8101 EOS"` into its numeric value and symbol, or `null` if unparseable. */
export function parseAsset(raw: string | null | undefined): ParsedAsset | null {
  if (!raw) return null;

  const match = raw.replace(/,/g, '').trim().match(/^(-?[0-9]+(?:\.[0-9]+)?)\s*([A-Za-z0-9]*)$/);
  if (!match) return null;

  const value = Number(match[1]);
  return Number.isFinite(value) ? { value, symbol: match[2] ?? '' } : null;
}

/**
 * Rounds a number to a fixed width that stays readable in a narrow column:
 * millions and billions collapse to `1.23M` / `1.23B`, five-figure balances drop
 * their decimals, everyday amounts keep two, and dust keeps enough digits to
 * avoid reading as zero.
 */
export function compactNumber(value: number): string {
  const magnitude = Math.abs(value);

  if (magnitude >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (magnitude >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (magnitude >= 1e4) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (magnitude >= 1) {
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (magnitude === 0) return '0';

  // Sub-unit dust: show up to four decimals, and never round a real balance to `0`.
  const trimmed = value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return Number(trimmed) === 0 ? '<0.0001' : trimmed;
}

/**
 * Compact form of a full asset string, symbol included — `"18088.0334794 WAX"`
 * becomes `"18,088 WAX"`. Returns an em dash when there is no balance, and the
 * input untouched when it does not look like an asset.
 */
export function compactAsset(raw: string | null | undefined): string {
  if (!raw) return '—';

  const parsed = parseAsset(raw);
  if (!parsed) return raw;

  const amount = compactNumber(parsed.value);
  return parsed.symbol ? `${amount} ${parsed.symbol}` : amount;
}
