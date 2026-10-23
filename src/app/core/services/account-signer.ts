import { PublicKey } from '@wharfkit/antelope';
import { TauriIpcService } from './tauri-ipc.service';
import { WalletAccount } from './wallet-state.service';

export interface AccountSigner {
  publicKey: string;
  ledgerIndex?: number;
}

export interface ActionPermissionSigner extends AccountSigner {
  permission: string;
}

/**
 * Normalize a Wire `PUB_EM_` key (compressed 33-byte `02`/`03` or uncompressed 65-byte `04`
 * returned by `get_account`) into canonical compressed `PUB_EM_<66 lowercase hex>`.
 */
export function normalizePubEm(key: string): string {
  const trimmed = (key || '').trim();
  if (!trimmed.startsWith('PUB_EM_')) return trimmed;
  const hex = trimmed.slice(7);
  if (hex.length === 66 && (hex.startsWith('02') || hex.startsWith('03')) && /^[0-9a-fA-F]{66}$/.test(hex)) {
    return 'PUB_EM_' + hex.toLowerCase();
  }
  if (hex.length === 130 && hex.startsWith('04') && /^[0-9a-fA-F]{130}$/.test(hex)) {
    const x = hex.slice(2, 66).toLowerCase();
    const lastYNibble = parseInt(hex[129], 16);
    const prefix = lastYNibble % 2 === 0 ? '02' : '03';
    return 'PUB_EM_' + prefix + x;
  }
  return trimmed;
}

/**
 * Compare two Antelope / Wire public keys for equality, handling `EOS...` / `PUB_K1_...`
 * equivalence and compressing uncompressed `PUB_EM_04...` keys to `PUB_EM_02/03...`.
 */
export function sameKey(left: string, right: string): boolean {
  const a = normalizePubEm(left);
  const b = normalizePubEm(right);
  if (a === b) return true;
  if (a.startsWith('PUB_EM_') || b.startsWith('PUB_EM_')) return false;
  try {
    return PublicKey.from(a).equals(PublicKey.from(b));
  } catch {
    return false;
  }
}

/**
 * Return `(typeTag, compressed33Hex)` for sorting authority keys in canonical chain order:
 * `K1 = 0`, `R1 = 1`, `WA = 2`, `EM = 3`, followed by lexicographic comparison of the 33-byte
 * compressed key.
 */
export function keySortTuple(key: string): { tag: number; hex: string; normalizedKey: string } {
  const norm = normalizePubEm(key);
  if (norm.startsWith('PUB_EM_')) {
    return {
      tag: 3,
      hex: norm.slice(7).toLowerCase(),
      normalizedKey: norm,
    };
  }
  try {
    const pk = PublicKey.from(norm);
    const rawHex = pk.data.hexString.toLowerCase();
    const typeStr = String(pk.type);
    const tag = typeStr === 'R1' ? 1 : typeStr === 'WA' ? 2 : 0;
    return {
      tag,
      hex: rawHex,
      normalizedKey: String(pk),
    };
  } catch {
    const fallbackTag =
      norm.startsWith('PUB_K1_') || norm.startsWith('EOS') || norm.startsWith('FIO')
        ? 0
        : norm.startsWith('PUB_R1_')
          ? 1
          : norm.startsWith('PUB_WA_')
            ? 2
            : 99;
    return { tag: fallbackTag, hex: norm.toLowerCase(), normalizedKey: norm };
  }
}

/**
 * Sort authority keys by `(key_type_index, compressed_33_byte_key)` and normalize `PUB_EM_04...`
 * keys to canonical compressed `PUB_EM_02/03...`.
 */
export function sortAuthorityKeys<T extends { key: string; weight: number }>(keys: T[]): T[] {
  return [...keys]
    .map((entry) => {
      const info = keySortTuple(entry.key);
      return {
        entry: { ...entry, key: entry.key.startsWith('PUB_EM_') ? info.normalizedKey : entry.key.trim() },
        tag: info.tag,
        hex: info.hex,
      };
    })
    .sort((a, b) => {
      if (a.tag !== b.tag) return a.tag - b.tag;
      return a.hex < b.hex ? -1 : a.hex > b.hex ? 1 : 0;
    })
    .map((x) => x.entry);
}

function findSignerForPermissions(
  info: { permissions: any[] },
  accountName: string,
  permissions: string[],
  keys: string[],
  ledgerIndex?: number,
): AccountSigner {
  const authorities = permissions.map((name) =>
    info.permissions.find((p: any) => p.perm_name === name)?.required_auth,
  );
  if (
    !permissions.length ||
    authorities.some(
      (auth) => !auth || !Number.isSafeInteger(auth.threshold) || auth.threshold <= 0,
    )
  ) {
    throw new Error(`Cannot resolve ${accountName}@${permissions.join(',')}`);
  }
  const publicKey = keys.find((key) =>
    authorities.every((authority) =>
      authority!.keys?.some(
        (entry: { key: string; weight: number }) =>
          sameKey(key, entry.key) && entry.weight >= authority!.threshold,
      ),
    ),
  );
  if (publicKey) {
    return { publicKey: normalizePubEm(publicKey), ledgerIndex };
  }

  // Fallback for external EM signers (MetaMask / Ledger Ethereum app) where the `PUB_EM_`
  // key is authorized on-chain (`get_account`) and signed externally in the Confirm window.
  const firstAuth = authorities[0]!;
  const externalEm = firstAuth.keys?.find(
    (entry: { key: string; weight: number }) =>
      entry.key.startsWith('PUB_EM_') &&
      authorities.every((authority) =>
        authority!.keys?.some(
          (e: { key: string; weight: number }) =>
            sameKey(entry.key, e.key) && e.weight >= authority!.threshold,
        ),
      ),
  );
  if (externalEm) {
    return { publicKey: normalizePubEm(externalEm.key) };
  }

  throw new Error(
    `No available key can satisfy ${accountName}@${permissions.join(',')}. Import its key or use a multisig proposal.`,
  );
}

/** Resolve a single signer against the account's current on-chain permission. */
export async function resolveAccountSigner(
  ipc: TauriIpcService,
  account: WalletAccount,
  permission: string | string[] = 'active',
): Promise<AccountSigner> {
  if (account.mode === 'watch') throw new Error('This is a watch-only account');
  const info = await ipc.getAccount(account.chainId, account.name);
  const permissions = typeof permission === 'string' ? [permission] : permission;
  const keys =
    account.ledgerIndex === undefined
      ? await ipc.listPublicKeys(account.chainId)
      : [await ipc.ledgerGetPublicKey(0, account.ledgerIndex, false)];
  return findSignerForPermissions(info, account.name, permissions, keys, account.ledgerIndex);
}

/**
 * Resolve the permission and signer for a specific `(contract, action)` pair.
 * If the account has a permission explicitly linked via `linkauth` to `(contract, action)`
 * (such as `claim` linked to `sysio::claimpay` or `sysio::claimnodedis`) and a key
 * for that linked permission is available, returns that linked permission; otherwise
 * falls back to `fallbackPermission` (default `'active'`).
 */
export async function resolveActionPermissionAndSigner(
  ipc: TauriIpcService,
  account: WalletAccount,
  contract: string,
  action: string,
  fallbackPermission = 'active',
): Promise<ActionPermissionSigner> {
  if (account.mode === 'watch') throw new Error('This is a watch-only account');
  const info = await ipc.getAccount(account.chainId, account.name);
  const keys =
    account.ledgerIndex === undefined
      ? await ipc.listPublicKeys(account.chainId)
      : [await ipc.ledgerGetPublicKey(0, account.ledgerIndex, false)];

  const exactLinkedPerm = info.permissions.find((p: any) =>
    p.linked_actions?.some(
      (link: { account: string; action?: string }) =>
        link.account === contract && link.action === action,
    ),
  );
  const wildcardLinkedPerm = info.permissions.find((p: any) =>
    p.linked_actions?.some(
      (link: { account: string; action?: string }) =>
        link.account === contract && (!link.action || link.action === ''),
    ),
  );
  const linkedPermName = exactLinkedPerm?.perm_name ?? wildcardLinkedPerm?.perm_name;

  if (linkedPermName && linkedPermName !== fallbackPermission) {
    try {
      const signer = findSignerForPermissions(
        info,
        account.name,
        [linkedPermName],
        keys,
        account.ledgerIndex,
      );
      return { permission: linkedPermName, ...signer };
    } catch {
      // Fall back to fallbackPermission (e.g. `active`) if the linked permission's key is not locally available.
    }
  }

  const fallbackSigner = findSignerForPermissions(
    info,
    account.name,
    [fallbackPermission],
    keys,
    account.ledgerIndex,
  );
  return { permission: fallbackPermission, ...fallbackSigner };
}
