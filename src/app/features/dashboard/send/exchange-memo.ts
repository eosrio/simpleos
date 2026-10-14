import { Exchange } from '../../../core/services/tauri-ipc.service';

/**
 * Memo validation for exchange deposit accounts.
 *
 * Everyone depositing to an exchange sends to the same on-chain account; the
 * memo is the only thing that routes the transfer to a customer. A missing or
 * malformed memo normally means the funds are gone, so these checks block the
 * send instead of merely warning. The rules come from the chain's own config
 * (`chain_config.rs`) — they are never inferred from the account name.
 */

/** Compile a config-supplied pattern, ignoring one that is not valid JS regex. */
function compilePattern(pattern: string | undefined): RegExp | null {
  if (!pattern) return null;
  try {
    return new RegExp(pattern);
  } catch {
    // A broken pattern must not block an otherwise valid deposit.
    console.warn('[send] ignoring invalid exchange memo pattern:', pattern);
    return null;
  }
}

/** Plain-language name for the characters a pattern accepts. */
function charsetNoun(pattern: string | undefined): string {
  switch (pattern) {
    case '^[0-9]+$':
      return 'digits';
    case '^[a-f0-9]+$':
      return 'hex characters';
    case '^[a-z]+$':
      return 'lowercase letters';
    default:
      return 'characters';
  }
}

/** Short description of what the exchange expects, e.g. "9 digits". */
export function describeMemoRule(exchange: Exchange): string {
  const noun = charsetNoun(exchange.memo_pattern);
  if (exchange.memo_size) return `${exchange.memo_size} ${noun}`;
  return exchange.memo_pattern ? noun : '';
}

/** Name to show in warnings — the exchange's label, or its account. */
export function exchangeName(exchange: Exchange): string {
  return exchange.label || exchange.account;
}

/**
 * Why `memo` is unacceptable for `exchange`, or '' when it is acceptable.
 */
export function validateExchangeMemo(memo: string, exchange: Exchange): string {
  const name = exchangeName(exchange);

  if (!memo.trim()) {
    return `${name} requires a deposit memo — sending without one loses the funds`;
  }
  if (memo !== memo.trim()) {
    return 'Remove the leading or trailing spaces from the memo';
  }

  if (exchange.memo_size && memo.length !== exchange.memo_size) {
    const rule = describeMemoRule(exchange);
    return `${name} deposit memos are exactly ${rule || `${exchange.memo_size} characters`} — this one has ${memo.length}`;
  }

  const pattern = compilePattern(exchange.memo_pattern);
  if (pattern && !pattern.test(memo)) {
    const rule = describeMemoRule(exchange);
    return rule
      ? `This does not look like a ${name} deposit memo (expected ${rule})`
      : `This does not look like a ${name} deposit memo`;
  }

  return '';
}
