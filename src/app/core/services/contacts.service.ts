import { Injectable, inject, signal } from '@angular/core';
import { TauriIpcService } from './tauri-ipc.service';

/**
 * How a contact's address should be interpreted. A contact list is always
 * scoped to one chain, so the kind is a property of that chain's address
 * model — standard Antelope chains only ever use `account`, FIO uses
 * handles or raw public keys (it has no user-facing account names).
 */
export type ContactKind = 'account' | 'fio_handle' | 'fio_pubkey';

export interface Contact {
  /** User-chosen label. */
  name: string;
  /** Account name, FIO handle (`user@domain`), or FIO public key. */
  account: string;
  kind: ContactKind;
  /** Chain this contact belongs to. Mirrors the storage bucket it lives in. */
  chainId: string;
  /** Default transfer memo. Not supported on FIO (`trnsfiopubky` has no memo). */
  memo?: string;
}

/** Legacy flat list written by the pre-per-chain implementation. */
const LEGACY_KEY = 'contacts';
const MIGRATION_FLAG = 'contactsMigratedPerChain';

/** Per-chain bucket key, matching the `recentContracts:<chainId>` convention. */
export function contactsStoreKey(chainId: string): string {
  return `contacts:${chainId}`;
}

/** Antelope account name: a-z, 1-5 and dots, max 13 chars. */
const ACCOUNT_NAME_RE = /^[a-z1-5.]{1,13}$/;
/** FIO handle part: a-z, 0-9 and inner hyphens. */
const FIO_PART_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
/** FIO public key: `FIO` prefix + base58 body (same shape as a K1 key). */
const FIO_PUBKEY_RE = /^FIO[1-9A-HJ-NP-Za-km-z]{50,53}$/;
/** FIO caps the whole handle, `@` included, at 64 characters. */
const FIO_HANDLE_MAX = 64;

/** Classify a raw address for the chain it was entered on. */
export function detectContactKind(raw: string, isFio: boolean): ContactKind {
  const value = raw.trim();
  if (!isFio) return 'account';
  return value.startsWith('FIO') && !value.includes('@') ? 'fio_pubkey' : 'fio_handle';
}

/**
 * Canonical storage form. Account names and FIO handles are case-insensitive
 * on chain, so they are lowercased; FIO public keys are base58 and case is
 * significant, so they are only trimmed.
 */
export function normalizeContactAddress(raw: string, kind: ContactKind): string {
  const value = raw.trim();
  return kind === 'fio_pubkey' ? value : value.toLowerCase();
}

/** Validate an address for a chain. Returns an error message, or null if valid. */
export function validateContactAddress(raw: string, isFio: boolean): string | null {
  const value = raw.trim();
  if (!value) return 'Enter an address';

  if (!isFio) {
    if (value.includes('@')) return 'FIO Handles only work on the FIO chain';
    return ACCOUNT_NAME_RE.test(value.toLowerCase())
      ? null
      : 'Invalid account name. Use only a-z, 1-5 and . (max 13 chars)';
  }

  const kind = detectContactKind(value, true);
  if (kind === 'fio_pubkey') {
    return FIO_PUBKEY_RE.test(value) ? null : 'Invalid FIO public key';
  }

  const lower = value.toLowerCase();
  if (!lower.includes('@')) return 'Enter a FIO Handle (user@domain) or FIO public key';
  if (lower.length > FIO_HANDLE_MAX) return `FIO Handles are at most ${FIO_HANDLE_MAX} characters`;
  const [name, domain, ...rest] = lower.split('@');
  if (rest.length > 0) return 'A FIO Handle contains a single @';
  if (!FIO_PART_RE.test(name ?? '') || !FIO_PART_RE.test(domain ?? '')) {
    return 'Invalid FIO Handle. Use a-z, 0-9 and hyphens on both sides of @';
  }
  return null;
}

/** Two contacts are the same entry when their (normalized) addresses match. */
export function sameContactAddress(a: Contact, b: Contact): boolean {
  return a.kind === b.kind && a.account === b.account;
}

/**
 * Contact book, stored one list per chain.
 *
 * Contacts are chain-scoped because addresses are: an EOS account name means
 * nothing on WAX, and FIO's handles/public keys have no meaning anywhere else
 * (the app resolves handles through `get_pub_address` with `chain_code: FIO`).
 * Mainnet and testnet are separate chain IDs and therefore separate books.
 */
@Injectable({ providedIn: 'root' })
export class ContactsService {
  private ipc = inject(TauriIpcService);

  /** chainId -> contacts. Read through `list()` so templates stay reactive. */
  private readonly byChain = signal<Record<string, Contact[]>>({});
  private readonly inflight = new Map<string, Promise<void>>();
  private migration: Promise<void> | null = null;

  /** Contacts for one chain. Empty until `load(chainId)` resolves. */
  list(chainId: string | null | undefined): Contact[] {
    const map = this.byChain();
    if (!chainId) return [];
    return map[chainId] ?? [];
  }

  /** Load a chain's book from disk (once per chain, unless `force`). */
  async load(chainId: string, force = false): Promise<void> {
    if (!chainId) return;
    if (!force && (chainId in this.byChain() || this.inflight.has(chainId))) {
      return this.inflight.get(chainId) ?? Promise.resolve();
    }

    const task = (async () => {
      await this.runMigration();
      try {
        const saved = await this.ipc.storeGet<Contact[]>(contactsStoreKey(chainId));
        const list = (saved ?? [])
          .map((c) => this.normalize(c, chainId))
          .filter((c) => c.account.length > 0);
        this.byChain.update((map) => ({ ...map, [chainId]: list }));
      } catch {
        // Leave the chain unloaded so a later call retries.
      } finally {
        this.inflight.delete(chainId);
      }
    })();

    this.inflight.set(chainId, task);
    return task;
  }

  /**
   * Add a contact, or replace `replacing` when editing an existing one.
   * Returns false when the address already exists on this chain.
   */
  async upsert(
    chainId: string,
    contact: Omit<Contact, 'chainId'>,
    replacing?: Contact | null,
  ): Promise<boolean> {
    if (!chainId) return false;
    const entry: Contact = {
      name: contact.name.trim(),
      account: normalizeContactAddress(contact.account, contact.kind),
      kind: contact.kind,
      chainId,
      // FIO transfers carry no memo — never persist one for a FIO contact.
      memo: contact.kind === 'account' ? contact.memo?.trim() || undefined : undefined,
    };
    if (!entry.name || !entry.account) return false;

    const current = this.list(chainId);
    const clashes = current.some(
      (c) => sameContactAddress(c, entry) && !(replacing && sameContactAddress(c, replacing)),
    );
    if (clashes) return false;

    const next = replacing
      ? current.map((c) => (sameContactAddress(c, replacing) ? entry : c))
      : [...current, entry];

    this.byChain.update((map) => ({ ...map, [chainId]: next }));
    await this.persist(chainId);
    return true;
  }

  async remove(chainId: string, contact: Contact): Promise<void> {
    if (!chainId) return;
    const next = this.list(chainId).filter((c) => !sameContactAddress(c, contact));
    this.byChain.update((map) => ({ ...map, [chainId]: next }));
    await this.persist(chainId);
  }

  /** Whether an address is already saved on this chain. */
  has(chainId: string, account: string, kind: ContactKind): boolean {
    const normalized = normalizeContactAddress(account, kind);
    return this.list(chainId).some((c) => c.kind === kind && c.account === normalized);
  }

  private async persist(chainId: string): Promise<void> {
    await this.ipc.storeSet(contactsStoreKey(chainId), this.list(chainId));
  }

  /** Back-fill records written before `kind` existed, and re-normalize. */
  private normalize(raw: any, chainId: string): Contact {
    const account = String(raw?.account ?? '').trim();
    const kind: ContactKind =
      raw?.kind === 'account' || raw?.kind === 'fio_handle' || raw?.kind === 'fio_pubkey'
        ? raw.kind
        : account.includes('@')
          ? 'fio_handle'
          : FIO_PUBKEY_RE.test(account)
            ? 'fio_pubkey'
            : 'account';
    return {
      name: String(raw?.name ?? '').trim(),
      account: normalizeContactAddress(account, kind),
      kind,
      chainId,
      memo: kind === 'account' ? String(raw?.memo ?? '').trim() || undefined : undefined,
    };
  }

  /**
   * One-time split of the legacy flat `contacts` list into per-chain buckets.
   * The legacy key is left on disk untouched: rows that carry no `chainId`
   * cannot be attributed to a chain, so they are skipped here rather than
   * guessed at or dropped from storage.
   */
  private runMigration(): Promise<void> {
    if (!this.migration) {
      this.migration = this.migrateLegacy().catch(() => {
        // Allow a retry on the next load rather than wedging the book.
        this.migration = null;
      });
    }
    return this.migration;
  }

  private async migrateLegacy(): Promise<void> {
    if (await this.ipc.storeGet<boolean>(MIGRATION_FLAG)) return;

    const legacy = await this.ipc.storeGet<any[]>(LEGACY_KEY);
    if (Array.isArray(legacy) && legacy.length > 0) {
      const groups = new Map<string, Contact[]>();
      let unattributed = 0;
      for (const row of legacy) {
        const chainId = typeof row?.chainId === 'string' ? row.chainId.trim() : '';
        if (!chainId) {
          unattributed++;
          continue;
        }
        const list = groups.get(chainId) ?? [];
        list.push(this.normalize(row, chainId));
        groups.set(chainId, list);
      }
      if (unattributed > 0) {
        console.warn(
          `[contacts] ${unattributed} legacy contact(s) had no chain and were left in the "${LEGACY_KEY}" key`,
        );
      }

      for (const [chainId, list] of groups) {
        const existing = (await this.ipc.storeGet<Contact[]>(contactsStoreKey(chainId))) ?? [];
        const merged = existing.map((c) => this.normalize(c, chainId));
        for (const contact of list) {
          if (!contact.account) continue;
          if (!merged.some((c) => sameContactAddress(c, contact))) merged.push(contact);
        }
        await this.ipc.storeSet(contactsStoreKey(chainId), merged);
      }
    }

    await this.ipc.storeSet(MIGRATION_FLAG, true);
  }
}
