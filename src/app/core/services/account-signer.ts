import { PublicKey } from '@wharfkit/antelope';
import { TauriIpcService } from './tauri-ipc.service';
import { WalletAccount } from './wallet-state.service';

export interface AccountSigner { publicKey: string; ledgerIndex?: number }

function sameKey(left: string, right: string): boolean {
  if (left === right) return true;
  try { return PublicKey.from(left).equals(PublicKey.from(right)); } catch { return false; }
}

/** Resolve a single signer against the account's current on-chain permission. */
export async function resolveAccountSigner(
  ipc: TauriIpcService, account: WalletAccount, permission: string | string[] = 'active',
): Promise<AccountSigner> {
  if (account.mode === 'watch') throw new Error('This is a watch-only account');
  const info = await ipc.getAccount(account.chainId, account.name);
  const permissions = typeof permission === 'string' ? [permission] : permission;
  const authorities = permissions.map(name => info.permissions.find(p => p.perm_name === name)?.required_auth);
  if (!permissions.length || authorities.some(auth => !auth || !Number.isSafeInteger(auth.threshold) || auth.threshold <= 0)) {
    throw new Error(`Cannot resolve ${account.name}@${permissions.join(',')}`);
  }
  const keys = account.ledgerIndex === undefined
    ? await ipc.listPublicKeys(account.chainId)
    : [await ipc.ledgerGetPublicKey(0, account.ledgerIndex, false)];
  const publicKey = keys.find(key => authorities.every(authority =>
    authority.keys?.some((entry: { key: string; weight: number }) =>
      sameKey(key, entry.key) && entry.weight >= authority.threshold)));
  if (!publicKey) {
    throw new Error(`No available key can satisfy ${account.name}@${permission}. Import its key or use a multisig proposal.`);
  }
  return { publicKey, ledgerIndex: account.ledgerIndex };
}
