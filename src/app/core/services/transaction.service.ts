import { Injectable, signal, computed } from '@angular/core';
import { TauriIpcService } from './tauri-ipc.service';
import { WalletStateService } from './wallet-state.service';

export interface TxAction {
  account: string;
  name: string;
  authorization: { actor: string; permission: string }[];
  data: Record<string, any>;
}

export interface TxRequest {
  chainId: string;
  publicKey: string;
  actions: TxAction[];
  title?: string;
  /** When true, success phase shows "Login Successful" instead of "Transaction Sent" */
  isLogin?: boolean;
}

export interface TxResult {
  transaction_id: string;
  block_num?: number;
  block_time?: string;
}

type ModalPhase = 'hidden' | 'review' | 'signing' | 'success' | 'error';

@Injectable({ providedIn: 'root' })
export class TransactionService {

  // ── Modal state ──
  readonly phase = signal<ModalPhase>('hidden');
  readonly request = signal<TxRequest | null>(null);
  readonly passphrase = signal('');
  readonly needsPassphrase = signal(false);
  readonly result = signal<TxResult | null>(null);
  readonly errorMessage = signal('');

  readonly visible = computed(() => this.phase() !== 'hidden');

  // Promise callbacks stored for the current request
  private resolve: ((result: TxResult | null) => void) | null = null;
  private customSignHandler?: () => Promise<TxResult>;

  constructor(
    private ipc: TauriIpcService,
    private wallet: WalletStateService,
  ) {}

  /**
   * Open the confirmation modal and return a promise that resolves
   * when the transaction completes (or null if cancelled).
   */
  async confirm(request: TxRequest, customSign?: () => Promise<TxResult>): Promise<TxResult | null> {
    // Check if passphrase is needed for signing
    let needsPass = false;
    if (this.wallet.hasTauri()) {
      try {
        needsPass = await this.ipc.needsPassphraseForSigning();
      } catch { /* default to false */ }
    }

    this.request.set(request);
    this.needsPassphrase.set(needsPass);
    this.passphrase.set('');
    this.result.set(null);
    this.errorMessage.set('');
    this.phase.set('review');
    this.customSignHandler = customSign;

    return new Promise<TxResult | null>(resolve => {
      this.resolve = resolve;
    });
  }

  /** User cancels the modal. */
  cancel() {
    this.phase.set('hidden');
    this.resolve?.(null);
    this.resolve = null;
  }

  /** User dismisses the success/error result. */
  dismiss() {
    const r = this.result();
    this.phase.set('hidden');
    this.resolve?.(r);
    this.resolve = null;
  }

  /** User confirms — sign and push the transaction. */
  async sign() {
    const req = this.request();
    if (!req) return;

    if (this.needsPassphrase() && !this.passphrase()) {
      this.errorMessage.set('Passphrase is required');
      return;
    }

    this.phase.set('signing');
    this.errorMessage.set('');

    try {
      let result: TxResult;

      if (this.customSignHandler) {
        // Evaluate the custom sign handler if one was provided
        result = await this.customSignHandler();
      } else if (this.needsPassphrase()) {
        result = await this.ipc.signAndPushWithPassphrase(
          req.chainId, req.publicKey, this.passphrase(), req.actions,
        );
      } else {
        result = await this.ipc.signAndPush(req.chainId, req.publicKey, req.actions);
      }

      this.result.set(result);
      this.phase.set('success');
    } catch (e: any) {
      console.error('[tx] sign failed:', e);
      this.errorMessage.set(parseError(e));
      this.phase.set('error');
    }
  }
}

function parseError(e: any): string {
  const raw = typeof e === 'string' ? e : e?.message ?? 'Transaction failed';

  // Parse Antelope RPC error JSON embedded in the string
  // Format: "Rpc(\"...\") " or JSON with error.details[].message
  const jsonMatch = raw.match(/\{[\s\S]*"error"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const details = parsed?.error?.details;
      if (Array.isArray(details) && details.length > 0) {
        return friendlyMessage(details[0].message ?? raw);
      }
      if (parsed?.error?.what) {
        return friendlyMessage(parsed.error.what);
      }
    } catch { /* fall through */ }
  }

  return friendlyMessage(raw);
}

/** Map common Antelope assertion messages to user-friendly text. */
function friendlyMessage(msg: string): string {
  // Strip "assertion failure with message: " prefix
  const cleaned = msg.replace(/^assertion failure with message:\s*/i, '');

  const patterns: [RegExp, string][] = [
    [/overdrawn balance/i, 'Insufficient balance for this transaction'],
    [/insufficient ram/i, 'Not enough RAM. Buy more RAM to proceed'],
    [/billed CPU time.*exceeded/i, 'Not enough CPU. Stake more or use PowerUp'],
    [/deadline exceeded/i, 'Transaction timed out. Try again'],
    [/account does not exist/i, 'Recipient account does not exist'],
    [/symbol precision mismatch/i, 'Token amount has wrong decimal precision'],
    [/unable to find key/i, 'Signing key not found for this account'],
    [/invalid authority/i, 'Your account does not have permission for this action'],
    [/expired transaction/i, 'Transaction expired. Try again'],
    [/duplicate transaction/i, 'This transaction was already submitted'],
    [/tx_net_usage_exceeded/i, 'Not enough NET bandwidth. Stake more or use PowerUp'],
    [/leeway_deadline_exception/i, 'Network congestion. Try again shortly'],
    [/missing required authority/i, 'Missing required permission for this action'],
    [/eosio_assert_message/i, cleaned],
    [/WalletLocked/i, 'Wallet is locked. Unlock first'],
    [/InvalidPassphrase/i, 'Incorrect passphrase'],
    [/KeyNotFound/i, 'No signing key found for this account'],
    [/ChainNotFound/i, 'Chain not connected. Check your network'],
  ];

  for (const [re, friendly] of patterns) {
    if (re.test(msg)) return friendly;
  }

  // Clean up Rust error wrapping
  const rustMatch = cleaned.match(/^Rpc\("(.*)"\)$/s);
  if (rustMatch) return rustMatch[1].slice(0, 200);

  return cleaned.slice(0, 300);
}
