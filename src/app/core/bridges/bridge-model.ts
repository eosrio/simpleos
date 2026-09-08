import { keccak_256 } from '@noble/hashes/sha3.js';
import type { TxAction } from '../services/transaction.service';

export interface BridgeRoute {
  id: string;
  sourceChainId: string;
  sourceName: string;
  destinationName: string;
  evmChainId: number;
  evmContract: string;
  officialUrl: string;
  protocol: 'ultra-ethereum';
  bridgeAccount: string;
  depositAccount: string;
  scope: string;
}

export const BRIDGE_ROUTES: readonly BridgeRoute[] = [{
  id: 'ultra-ethereum', protocol: 'ultra-ethereum', sourceName: 'Ultra', destinationName: 'Ethereum',
  sourceChainId: 'a9c481dfbc7d9506dc7e87e9a137c931b0a9303f64fd7a1d08b8230133920097',
  evmChainId: 1, evmContract: '0x95cCdDC90266F5A31732eFeF6Ab69Baf53a54E50',
  officialUrl: 'https://bridge.ultra.io/', bridgeAccount: 'ultra.bridge', depositAccount: 'ultra.swap', scope: 'ethereum',
}];

export interface BridgeToken {
  id: string; symbol: string; precision: number; contract: string;
  evmSymbol: string; evmPrecision: number; evmAddress: string;
  minimum: string; maximum: string; active: boolean;
}
export interface BridgeSnapshot {
  tokens: BridgeToken[]; balances: Record<string, string>;
  maintenanceAt: number | null; evmPaused: boolean; loadedAt: number;
}
export interface BridgeRequest {
  counter: string; sender: string; recipient: string; quantity: string; createdAt: number;
  attestations: number; threshold: number; scheduleId: string;
  status: 'validating' | 'attested' | 'settled' | 'schedule-changed' | 'unknown';
  statusDetail?: string;
}
export interface BridgeSubmission {
  transactionId: string; quantity: string; recipient: string; createdAt: number;
}
export interface BridgeQuote { quantity: string; received: string; recipient: string; action: TxAction; }

/** Reject lossy JSON numbers instead of silently rounding token limits/counters. */
export function uint(value: unknown): bigint {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 0)) throw new Error('Unsafe numeric value from bridge');
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d+$/.test(String(value))) throw new Error('Invalid bridge integer');
  const result = BigInt(value);
  if (result > (1n << 64n) - 1n) throw new Error('Bridge integer exceeds uint64');
  return result;
}
export function units(value: string, precision: number): bigint {
  if (!Number.isInteger(precision) || precision < 0 || precision > 18) throw new Error('Invalid token precision');
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(value)) throw new Error('Enter a plain positive amount, without commas or exponents.');
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > precision) throw new Error(`Use at most ${precision} decimal places.`);
  return BigInt(whole) * 10n ** BigInt(precision) + BigInt(fraction.padEnd(precision, '0') || '0');
}
export function decimal(value: bigint, precision: number): string {
  if (!precision) return value.toString();
  const digits = value.toString().padStart(precision + 1, '0');
  return `${digits.slice(0, -precision)}.${digits.slice(-precision)}`;
}
export function ethereumAddress(value: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value) || /^0x0{40}$/i.test(value)) throw new Error('Enter a nonzero Ethereum address (0x followed by 40 hexadecimal characters).');
  const body = value.slice(2), lower = body.toLowerCase();
  const hash = Array.from(keccak_256(new TextEncoder().encode(lower)), n => n.toString(16).padStart(2, '0')).join('');
  const checksum = [...lower].map((c, i) => parseInt(hash[i], 16) >= 8 ? c.toUpperCase() : c).join('');
  if (body !== lower && body !== body.toUpperCase() && body !== checksum) throw new Error('The Ethereum address checksum is invalid. Copy the address again from your wallet.');
  return `0x${checksum}`;
}

export function parseToken(row: any): BridgeToken {
  const match = /^(\d+),([A-Z]{1,7})$/.exec(row?.symbol ?? '');
  if (!match || Number(match[1]) > 18 || !/^[a-z1-5.]{1,12}$/.test(row.contract ?? '')) throw new Error('Invalid bridge token configuration');
  const evmPrecision = Number(row.evm_precision);
  if (!Number.isInteger(evmPrecision) || evmPrecision < 0 || evmPrecision > 18 || !/^[A-Z0-9]{1,12}$/.test(row.evm_symbol ?? '')) throw new Error('Invalid destination token configuration');
  const minimum = uint(row.min_swap_amount), maximum = uint(row.max_swap_amount);
  if (minimum > maximum) throw new Error('Invalid bridge limits');
  return { id: `${row.contract}:${row.symbol}`, symbol: match[2], precision: Number(match[1]), contract: row.contract,
    evmPrecision, evmSymbol: row.evm_symbol, evmAddress: ethereumAddress(`0x${String(row.evm_address).replace(/^0x/, '')}`),
    minimum: minimum.toString(), maximum: maximum.toString(), active: (Number(uint(row.state)) & 1) !== 0 };
}

export function quoteTransfer(route: BridgeRoute, snapshot: BridgeSnapshot, tokenId: string, sender: string, amount: string, destination: string, now = Date.now()): BridgeQuote {
  if (now - snapshot.loadedAt > 60_000) throw new Error('Bridge data is out of date. Refresh before continuing.');
  if (snapshot.maintenanceAt !== null && now >= snapshot.maintenanceAt) throw new Error('The bridge is under maintenance. Try again after it reopens.');
  if (snapshot.evmPaused) throw new Error('The Ethereum bridge is paused. Try again after it reopens.');
  const token = snapshot.tokens.find(t => t.id === tokenId);
  if (!token?.active) throw new Error('This token is not currently enabled for bridging.');
  const value = units(amount.trim(), token.precision);
  if (value <= 0n) throw new Error('Enter an amount greater than zero.');
  if (value < uint(token.minimum) || value > uint(token.maximum)) throw new Error(`Amount must be between ${decimal(uint(token.minimum), token.precision)} and ${decimal(uint(token.maximum), token.precision)} ${token.symbol}.`);
  if (value > (1n << 62n) - 1n) throw new Error('Amount exceeds the source chain asset limit.');
  const balance = snapshot.balances[token.id];
  if (balance === undefined) throw new Error('Token balance is unavailable. Refresh and try again.');
  if (value > units(balance, token.precision)) throw new Error('Amount exceeds your available token balance.');
  const divisor = 10n ** BigInt(Math.max(0, token.precision - token.evmPrecision));
  if (value % divisor !== 0n) throw new Error(`Ethereum ${token.evmSymbol} supports ${token.evmPrecision} decimals. Reduce the amount precision to avoid losing dust.`);
  const recipient = ethereumAddress(destination.trim());
  if (recipient.toLowerCase() === token.evmAddress.toLowerCase() || recipient.toLowerCase() === route.evmContract.toLowerCase()) throw new Error('Use your Ethereum wallet address, not a token or bridge contract.');
  const quantity = `${decimal(value, token.precision)} ${token.symbol}`;
  const receivedUnits = value / divisor * 10n ** BigInt(Math.max(0, token.evmPrecision - token.precision));
  return { quantity, received: `${decimal(receivedUnits, token.evmPrecision)} ${token.evmSymbol}`, recipient,
    action: { account: token.contract, name: 'transfer', authorization: [{ actor: sender, permission: 'active' }],
      data: { from: sender, to: route.depositAccount, quantity, memo: `${route.scope},${recipient}` } } };
}
