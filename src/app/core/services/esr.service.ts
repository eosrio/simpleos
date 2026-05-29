import { Injectable, inject, effect } from '@angular/core';
import { WalletStateService } from './wallet-state.service';
import { TauriIpcService } from './tauri-ipc.service';
import { AlertService } from './alert.service';
import { TransactionService } from './transaction.service';
import { LinkSessionService } from './link-session.service';
import { deflateRaw, inflateRaw } from 'pako';
import { SigningRequest } from '@wharfkit/signing-request';

@Injectable({ providedIn: 'root' })
export class EsrService {
  private wallet = inject(WalletStateService);
  private ipc = inject(TauriIpcService);
  private alert = inject(AlertService);
  private tx = inject(TransactionService);
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
    if (this.tx.visible()) {
      console.warn('[esr] Ignoring ESR request, another transaction is already in review.');
      return;
    }

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
      // Use the active account's chain ID for key lookup — it matches the keystore
      const chainId = account.chainId;
      const signer = { actor: account.name, permission: 'active' };
      const isIdentity = request.isIdentity();

      console.log('[esr] ESR chain:', esrChainId, 'account chain:', chainId, 'identity:', isIdentity);

      // Fetch chain info for TaPoS context
      const info = await this.ipc.getChainInfo(chainId);
      const ctx = {
        timestamp: info.head_block_time,
        block_num: info.last_irreversible_block_num,
        ref_block_num: info.last_irreversible_block_num & 0xffff,
        ref_block_prefix: parseInt(info.last_irreversible_block_id.slice(16, 24).match(/../g)!.reverse().join(''), 16),
        expire_seconds: 120,
      };

      const abis = await request.fetchAbis(opts.abiProvider);
      const resolved = request.resolve(abis, signer, ctx);

      const keys = await this.ipc.listPublicKeys(chainId);
      console.log('[esr] Keys for chain', chainId, ':', keys);
      if (keys.length === 0) {
        this.alert.error(`No signing key available for chain ${chainId}`);
        return;
      }

      // For identity requests, prepare session fields before showing the modal
      let sessionFields: { link_ch: string; link_key: string; link_name: string } | null = null;
      if (isIdentity) {
        try {
          const session = await this.linkSession.createSession(chainId);
          sessionFields = {
            link_ch: session.channelUrl,
            link_key: session.linkKey,
            link_name: session.linkName,
          };
          console.log('[esr] Session created for identity request:', sessionFields.link_ch);
        } catch (err) {
          console.error('[esr] Failed to create link session (continuing without):', err);
        }
      }

      // Show the Transaction Modal for explicit review
      const result = await this.tx.confirm({
        chainId,
        publicKey: keys[0],
        actions: resolved.transaction.actions.map(act => ({
          account: act.account.toString(),
          name: act.name.toString(),
          authorization: act.authorization.map(auth => ({
            actor: auth.actor.toString(),
            permission: auth.permission.toString()
          })),
          data: act.data as any
        })),
        title: isIdentity ? 'Login with SimplEOS (Anchor)' : 'Sign ESR Request (Anchor)',
        isLogin: isIdentity,
      }, async () => {
        // Custom signing logic: just sign the digest and fire the callback
        const digest = resolved.signingDigest.hexString;
        console.log('[esr] Signing digest:', digest);

        let signature: string;
        if (this.tx.needsPassphrase()) {
          const unlocked = await this.ipc.unlock(this.tx.passphrase());
          if (!unlocked) throw new Error('Invalid passphrase');
          signature = await this.ipc.signDigest(chainId, keys[0], digest);
          // Relock if it's supposed to be locked (e.g. SignPerUse mode)
          await this.ipc.lock();
        } else {
          signature = await this.ipc.signDigest(chainId, keys[0], digest);
        }

        console.log('[esr] Signature obtained');

        // Build and POST the callback
        const callback = resolved.getCallback([signature]);
        if (callback && callback.url) {
          // Merge session fields into callback payload for identity requests
          const payload = sessionFields
            ? { ...callback.payload, ...sessionFields }
            : callback.payload;

          if (callback.background) {
            const res = await fetch(callback.url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            console.log('[esr] ESR callback POSTed to', callback.url, 'status:', res.status);
          } else {
            console.log('[esr] ESR foreground callback:', callback.url);
          }
        } else {
          console.log('[esr] ESR request has no callback');
        }

        return { transaction_id: digest }; // Return the digest as the dummy tx id
      });

      if (result) {
        console.log('[esr] ESR request completed successfully');
      }

    } catch (e: any) {
      console.error('[esr] ESR handling failed:', e);
      this.alert.error(`Signing request failed: ${e?.message ?? e}`);
    }
  }
}
