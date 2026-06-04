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
  mode?: TxExecutionMode;
  ledgerIndex?: number;
  /** When true, success phase shows "Login Successful" instead of "Transaction Sent" */
  isLogin?: boolean;
}

export interface TxResult {
  transaction_id: string;
  block_num?: number;
  block_time?: string;
}

export interface TxSignOnlyResult {
  packed_trx: string;
  signature: string;
}

export type TxExecutionMode = 'push' | 'signOnly' | 'export';
export type TxCompletion = TxResult | TxSignOnlyResult;

type ModalPhase = 'hidden' | 'review' | 'signing' | 'success' | 'error';

@Injectable({ providedIn: 'root' })
export class TransactionService {

  // ── Modal state ──
  readonly phase = signal<ModalPhase>('hidden');
  readonly request = signal<TxRequest | null>(null);
  readonly passphrase = signal('');
  readonly needsPassphrase = signal(false);
  readonly result = signal<TxCompletion | null>(null);
  readonly errorMessage = signal('');
  readonly debugDetails = signal('');

  readonly visible = computed(() => this.phase() !== 'hidden');
  readonly mode = computed<TxExecutionMode>(() => this.request()?.mode ?? 'push');

  // Promise callbacks stored for the current request
  private resolve: ((result: TxCompletion | null) => void) | null = null;

  constructor(
    private ipc: TauriIpcService,
    private wallet: WalletStateService,
  ) {}

  /**
   * Open the confirmation modal and return a promise that resolves
   * when the transaction completes (or null if cancelled).
   */
  async confirm(request: TxRequest & { mode: 'signOnly' }): Promise<TxCompletion | null>;
  async confirm(request: TxRequest): Promise<TxResult | null>;
  async confirm(request: TxRequest): Promise<TxCompletion | null> {
    // R2+R3: plain key signing goes through the backend-owned trusted
    // confirmation window — the renderer can neither forge nor suppress it, and
    // the bytes shown there are the bytes that get signed. Only Ledger (the
    // device is the trust anchor) still uses the legacy in-renderer modal.
    if (this.wallet.hasTauri() && request.ledgerIndex === undefined) {
      return this.confirmViaTrustedWindow(request);
    }

    // ── Legacy in-renderer modal path (Ledger / custom-sign) ──
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
    this.debugDetails.set('');
    this.phase.set('review');

    return new Promise<TxCompletion | null>(resolve => {
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
      let result: TxCompletion;

      // This legacy modal path now only handles Ledger signing (the device is the
      // trust anchor). All key-based signing goes through the trusted confirmation
      // window via confirmViaTrustedWindow().
      if (req.ledgerIndex !== undefined) {
        result = req.mode === 'signOnly'
          ? await this.ipc.ledgerSignTransaction(req.chainId, req.ledgerIndex, req.actions)
          : await this.ipc.ledgerSignAndPush(req.chainId, req.ledgerIndex, req.actions);
      } else {
        throw new Error('Signing must go through the trusted confirmation window');
      }

      this.result.set(result);
      this.phase.set('success');
    } catch (e: any) {
      console.error('[tx] sign failed:', e);
      this.errorMessage.set(parseError(e));
      this.debugDetails.set(JSON.stringify({
        title: req.title ?? 'Confirm Transaction',
        mode: req.mode ?? 'push',
        chainId: req.chainId,
        publicKey: req.publicKey,
        ledgerIndex: req.ledgerIndex,
        actionCount: req.actions.length,
        actions: req.actions,
        error: typeof e === 'string' ? e : e?.message ?? String(e),
      }, null, 2));
      this.phase.set('error');
    }
  }

  /**
   * R2+R3: route signing through the backend trusted-confirmation window. The
   * backend builds the canonical bytes, opens the `sign-confirm` window with the
   * decoded summary, and resolves with the result (or rejects on cancel).
   */
  private async confirmViaTrustedWindow(request: TxRequest): Promise<TxCompletion | null> {
    const broadcast = (request.mode ?? 'push') !== 'signOnly';
    try {
      const result = await this.ipc.beginSign(
        request.chainId,
        request.publicKey,
        request.actions,
        broadcast,
        { title: request.title },
      );
      return result as TxCompletion;
    } catch (e: any) {
      if (this.isRejection(e)) return null; // user cancelled / closed the window
      throw e;
    }
  }

  private isRejection(e: any): boolean {
    const msg = typeof e === 'string' ? e : (e?.message ?? '');
    return /rejected|cancelled|canceled|window was closed/i.test(msg);
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
  if (rustMatch) return rustMatch[1].slice(0, 1200);

  return cleaned.slice(0, 1200);
}
