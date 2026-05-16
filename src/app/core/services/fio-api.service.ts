import { Injectable, inject } from '@angular/core';
import { TauriIpcService } from './tauri-ipc.service';

export interface FioNamesResponse {
  fio_domains: {
    fio_domain: string;
    expiration: string;
    is_public: number;
  }[];
  fio_addresses: {
    fio_address: string;
    expiration: string;
  }[];
}

/**
 * User-facing guidance when a producer-identity action needs a live FIO
 * handle but the account owns none. Points at the *cheap* fix (an address on
 * an existing public domain) rather than the ~1300-FIO domain registration
 * people wrongly assume they need.
 */
export function fioNoHandleMessage(action: string): string {
  return (
    `This account owns no currently-registered FIO handle, which FIO requires to ${action}. ` +
    `A producer's original handle is often burned when its domain expires — the producer keeps ` +
    `running, but the handle no longer exists on-chain. Fix: open FIO Handles → "Register Crypto ` +
    `Handle" and register a handle on an existing public domain (a few FIO, seconds). Do NOT ` +
    `register a new domain — that costs ~1300 FIO and is not needed. Then retry.`
  );
}

@Injectable({ providedIn: 'root' })
export class FioApiService {
  private ipc = inject(TauriIpcService);

  /**
   * Fetch all domains and addresses owned by a specific FIO public key.
   */
  async getFioNames(chainId: string, publicKey: string): Promise<FioNamesResponse> {
    try {
      const data = await this.ipc.fioGetNames(chainId, publicKey);
      return {
        fio_domains: data.fio_domains || [],
        fio_addresses: data.fio_addresses || []
      };
    } catch {
      return { fio_domains: [], fio_addresses: [] };
    }
  }

  /**
   * Use the native Rust bindings to fetch the minimum required max_fee.
   * Typical endPoints: 'register_fio_address', 'register_fio_domain', 'renew_fio_domain'
   */
  async getFee(chainId: string, endpointName: string, fioAddress: string = ''): Promise<number> {
    const res = await this.ipc.fioGetFee(chainId, endpointName, fioAddress);
    // Add a safe margin of 20% to prevent "fee exceeds max_fee" boundary errors
    const feeWithMargin = Math.floor(res.fee * 1.2);
    return feeWithMargin;
  }

  /**
   * Resolve a currently-registered FIO handle owned by `account`, or '' if it
   * owns none. Producer-identity actions (`unregprod`, `bpclaim`,
   * `regproducer`) require a *live* handle owned by the actor — but two
   * things commonly break naive resolution:
   *
   *  1. `get_fio_names` needs the FIO-prefixed pubkey; the on-chain account
   *     stores EOS/PUB_K1_ format, so we convert via `to_fio_public_key`.
   *  2. A producer's original handle/domain can be *burned* (expired and
   *     removed) while the `producers` row survives — so the handle stored on
   *     that row is unusable. We only ever return a handle that `get_fio_names`
   *     currently reports as registered, never a stale producers-row value.
   *
   * Returning '' lets callers surface an actionable error instead of pushing
   * a transaction the chain will reject with a cryptic assertion.
   *
   * @param preferred optional handle to keep using if it is *still* currently
   *        registered (e.g. the handle a producer registered under).
   */
  async resolveOwnedHandle(
    account: { chainId: string; info?: any } | null | undefined,
    preferred = '',
  ): Promise<string> {
    if (!account) return '';
    try {
      const activePerm = account.info?.permissions?.find(
        (p: any) => p.perm_name === 'active',
      );
      const rawKey = activePerm?.required_auth?.keys?.[0]?.key;
      if (!rawKey) return '';
      const fioKey = await this.ipc.toFioPublicKey(rawKey);
      const data = await this.ipc.fioGetNames(account.chainId, fioKey);
      const registered: string[] = (data?.fio_addresses ?? [])
        .map((a: any) => a?.fio_address)
        .filter(Boolean);
      console.info('[fio.resolveOwnedHandle]', { fioKey, registered, preferred });
      if (!registered.length) return '';
      return preferred && registered.includes(preferred)
        ? preferred
        : registered[0];
    } catch (e) {
      console.warn('[fio.resolveOwnedHandle] failed', e);
      return '';
    }
  }
}
