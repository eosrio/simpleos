import { resolveAccountSigner } from './account-signer';
import { Injectable, inject, effect } from '@angular/core';
import { WalletStateService } from './wallet-state.service';
import { TauriIpcService } from './tauri-ipc.service';
import { AlertService } from './alert.service';
import { LinkSessionService } from './link-session.service';
import { deflateRaw, inflateRaw } from 'pako';
import { SigningRequest } from '@wharfkit/signing-request';

@Injectable({ providedIn: 'root' })
export class EsrService {
  private wallet = inject(WalletStateService);
  private ipc = inject(TauriIpcService);
  private alert = inject(AlertService);
  private linkSession = inject(LinkSessionService);

  private pendingEsr: string | null = null;

  constructor() {
    // Register as the ESR handler for incoming session messages
    this.linkSession.setEsrHandler((uri) => this.handleEsrRequest(uri));

    // Process any pending ESR request once an account becomes active
    effect(() => {
      const account = this.wallet.selectedAccount();
      if (account && this.pendingEsr) {
        const uri = this.pendingEsr;
        this.pendingEsr = null;
        // Small delay to allow the dashboard to render before showing modal
        setTimeout(() => this.handleEsrRequest(uri), 500);
      }
    });
  }

  private async getEsrOptions() {
    return {
      zlib: { deflateRaw, inflateRaw },
      abiProvider: {
        getAbi: async (account: any) => {
          const name = String(account);
          const chainId = this.wallet.selectedAccount()?.chainId;
          if (!chainId) throw new Error('No active chain');
          const result = await this.ipc.getAbi(chainId, name);
          return result.abi ?? result;
        },
      },
    };
  }

  async handleEsrRequest(esrUri: string) {
    const account = this.wallet.selectedAccount();
    if (!account) {
      console.log('[esr] Wallet locked or no active account. Queuing request until unlocked.');
      this.pendingEsr = esrUri;
      this.alert.info('Please unlock your wallet or add an account to process the signing request.');
      return;
    }

    console.log('[esr] Processing ESR request...', esrUri);

    try {
      const opts = await this.getEsrOptions();

      // Normalize the URI — anchor-link may use esr:, esr://, esr-anchor:, etc.
      let uri = esrUri;
      if (uri.startsWith('esr-anchor:')) uri = 'esr:' + uri.slice('esr-anchor:'.length);
      if (uri.startsWith('anchor:')) uri = 'esr:' + uri.slice('anchor:'.length);

      const request = SigningRequest.from(uri, opts);
      const esrChainId = request.getChainId().hexString;
      if (!request.isMultiChain() && esrChainId.toLowerCase() !== account.chainId.toLowerCase()) {
        throw new Error('Select an account on the chain requested by this signing request.');
      }
      // Use the active account's chain ID for key lookup — it matches the keystore
      const chainId = account.chainId;
      const requestedIdentity = request.getIdentity()?.toString();
      if (requestedIdentity && requestedIdentity !== account.name) {
        throw new Error(`This login requires the ${requestedIdentity} account`);
      }
      const signer = { actor: account.name, permission: request.getIdentityPermission()?.toString() ?? 'active' };
      const isIdentity = request.isIdentity();

      console.log('[esr] ESR chain:', esrChainId, 'account chain:', chainId, 'identity:', isIdentity);

      // Fetch chain info for TaPoS context
      const info = await this.ipc.getChainInfo(chainId);
      const ctx = {
        chainId,
        timestamp: info.head_block_time,
        block_num: info.last_irreversible_block_num,
        ref_block_num: info.last_irreversible_block_num & 0xffff,
        ref_block_prefix: parseInt(info.last_irreversible_block_id.slice(16, 24).match(/../g)!.reverse().join(''), 16),
        expire_seconds: 120,
      };

      const abis = await request.fetchAbis(opts.abiProvider);
      const resolved = request.resolve(abis, signer, ctx);

      const permissions = [...new Set(resolved.transaction.actions.flatMap(action => action.authorization)
        .filter(auth => auth.actor.toString() === account.name).map(auth => auth.permission.toString()))];
      const accountSigner = await resolveAccountSigner(this.ipc, account, permissions);
      if (accountSigner.ledgerIndex !== undefined) {
        throw new Error('ESR signing with Ledger is not supported yet. Use the transaction builder for hardware signing.');
      }

      const packedTransactionHex = Array.from(resolved.serializedTransaction,
        byte => byte.toString(16).padStart(2, '0')).join('');

      // Disclose the callback destination (SEC-004/005). getCallback templates the
      // signature into the URL; a placeholder is enough to surface the host.
      let callbackUrl: string | undefined;
      let origin: string | undefined;
      try {
        callbackUrl = resolved.getCallback([''])?.url;
        if (callbackUrl) origin = new URL(callbackUrl).host;
      } catch { /* request has no callback */ }

      // Sign via the backend trusted-confirmation window (R2+R3). The user
      // reviews the origin, callback, and actions and approves there; the renderer
      // never receives the signature until after explicit approval.
      let signResult: { signature: string };
      try {
        signResult = await this.ipc.beginEsrSign(
          chainId, accountSigner.publicKey, packedTransactionHex,
          {
            origin,
            callbackUrl,
          },
        );
      } catch (e: any) {
        const msg = typeof e === 'string' ? e : (e?.message ?? '');
        if (/rejected|cancelled|canceled|closed/i.test(msg)) {
          console.log('[esr] user declined the signing request');
          return;
        }
        throw e;
      }

      // Deliver the result to the dapp via the ESR callback. The destination was
      // disclosed and approved in the trusted window above.
      const callback = resolved.getCallback([signResult.signature]);
      if (callback && callback.url) {
        if (callback.background) {
          const res = await fetch(callback.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(callback.payload),
          });
          console.log('[esr] callback POSTed to', callback.url, 'status:', res.status);
        } else {
          console.log('[esr] foreground callback:', callback.url);
        }
      }
      console.log('[esr] ESR request completed');

    } catch (e: any) {
      console.error('[esr] ESR handling failed:', e);
      this.alert.error(`Signing request failed: ${e?.message ?? e}`);
    }
  }
}
