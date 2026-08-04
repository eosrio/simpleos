import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  Contact,
  ContactsService,
  contactsStoreKey,
  detectContactKind,
  normalizeContactAddress,
  validateContactAddress,
} from './contacts.service';
import { TauriIpcService } from './tauri-ipc.service';

const EOS = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';
const WAX = '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4';
const FIO = '21dcae42c0182200e93f954a074011f9048a7624c6fe81d3c9541a614a88bd1c';

/** A real FIO public key shape: `FIO` + 50-53 base58 chars. */
const FIO_KEY = 'FIO5kJKNHwctcfUM5XZyiWSqSTM5HTzznJP9F3ZdbhaQAHEVq575o';

class FakeStore {
  data = new Map<string, unknown>();
  async storeGet<T>(key: string): Promise<T | null> {
    return (this.data.get(key) as T) ?? null;
  }
  async storeSet(key: string, value: unknown): Promise<void> {
    this.data.set(key, JSON.parse(JSON.stringify(value)));
  }
}

function makeService(store: FakeStore): ContactsService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: TauriIpcService, useValue: store }],
  });
  return TestBed.inject(ContactsService);
}

describe('contact address validation', () => {
  it('accepts Antelope account names on non-FIO chains', () => {
    expect(validateContactAddress('bob.gm', false)).toBeNull();
    expect(validateContactAddress('eosio.token', false)).toBeNull();
    expect(validateContactAddress('BOB.GM', false)).toBeNull();
  });

  it('rejects malformed account names on non-FIO chains', () => {
    expect(validateContactAddress('bob6', false)).not.toBeNull();
    expect(validateContactAddress('waytoolongaccountname', false)).not.toBeNull();
    expect(validateContactAddress('', false)).not.toBeNull();
  });

  it('rejects FIO Handles on non-FIO chains', () => {
    // get_pub_address is queried with chain_code FIO — a handle is meaningless elsewhere.
    expect(validateContactAddress('bob@fiotestnet', false)).toBe(
      'FIO Handles only work on the FIO chain',
    );
  });

  it('accepts FIO Handles and public keys on FIO', () => {
    expect(validateContactAddress('bob@edge', true)).toBeNull();
    expect(validateContactAddress('my-handle@my-domain', true)).toBeNull();
    expect(validateContactAddress('BOB@EDGE', true)).toBeNull();
    expect(validateContactAddress(FIO_KEY, true)).toBeNull();
  });

  it('rejects malformed FIO addresses', () => {
    expect(validateContactAddress('bob', true)).not.toBeNull();
    expect(validateContactAddress('bob@', true)).not.toBeNull();
    expect(validateContactAddress('@edge', true)).not.toBeNull();
    expect(validateContactAddress('bob@edge@extra', true)).not.toBeNull();
    expect(validateContactAddress('-bob@edge', true)).not.toBeNull();
    expect(validateContactAddress('bo b@edge', true)).not.toBeNull();
    expect(validateContactAddress('FIOnotakey', true)).not.toBeNull();
    expect(validateContactAddress(`${'a'.repeat(60)}@edge`, true)).not.toBeNull();
  });

  it('classifies FIO addresses by shape', () => {
    expect(detectContactKind('bob.gm', false)).toBe('account');
    expect(detectContactKind('bob@edge', true)).toBe('fio_handle');
    expect(detectContactKind(FIO_KEY, true)).toBe('fio_pubkey');
    // A handle on a domain starting with "FIO" is still a handle.
    expect(detectContactKind('bob@fiotest', true)).toBe('fio_handle');
  });

  it('lowercases names and handles but preserves base58 key case', () => {
    expect(normalizeContactAddress('  BOB.GM ', 'account')).toBe('bob.gm');
    expect(normalizeContactAddress(' BOB@EDGE ', 'fio_handle')).toBe('bob@edge');
    expect(normalizeContactAddress(` ${FIO_KEY} `, 'fio_pubkey')).toBe(FIO_KEY);
  });
});

describe('ContactsService', () => {
  let store: FakeStore;
  let svc: ContactsService;

  beforeEach(() => {
    store = new FakeStore();
    svc = makeService(store);
  });

  it('keeps books separate per chain', async () => {
    await svc.load(EOS);
    await svc.load(WAX);

    await svc.upsert(EOS, { name: 'Alice', account: 'alice.gm', kind: 'account' });
    await svc.upsert(WAX, { name: 'Bob', account: 'bob.wam', kind: 'account' });

    expect(svc.list(EOS).map((c) => c.account)).toEqual(['alice.gm']);
    expect(svc.list(WAX).map((c) => c.account)).toEqual(['bob.wam']);
    expect(store.data.has(contactsStoreKey(EOS))).toBe(true);
    expect(store.data.has(contactsStoreKey(WAX))).toBe(true);
  });

  it('allows the same account name on two chains', async () => {
    await svc.load(EOS);
    await svc.load(WAX);
    expect(await svc.upsert(EOS, { name: 'Same', account: 'shared.gm', kind: 'account' })).toBe(
      true,
    );
    expect(await svc.upsert(WAX, { name: 'Same', account: 'shared.gm', kind: 'account' })).toBe(
      true,
    );
    expect(svc.has(EOS, 'shared.gm', 'account')).toBe(true);
    expect(svc.has(WAX, 'shared.gm', 'account')).toBe(true);
  });

  it('rejects a duplicate address on the same chain', async () => {
    await svc.load(EOS);
    expect(await svc.upsert(EOS, { name: 'Alice', account: 'alice.gm', kind: 'account' })).toBe(
      true,
    );
    expect(await svc.upsert(EOS, { name: 'Alice 2', account: 'ALICE.GM', kind: 'account' })).toBe(
      false,
    );
    expect(svc.list(EOS)).toHaveLength(1);
  });

  it('never stores a memo for FIO contacts', async () => {
    await svc.load(FIO);
    await svc.upsert(FIO, {
      name: 'Bob',
      account: 'BOB@edge',
      kind: 'fio_handle',
      memo: 'ignored',
    });

    const [contact] = svc.list(FIO);
    expect(contact.account).toBe('bob@edge');
    expect(contact.memo).toBeUndefined();
  });

  it('edits and deletes within one chain only', async () => {
    await svc.load(EOS);
    await svc.load(WAX);
    await svc.upsert(EOS, { name: 'Alice', account: 'alice.gm', kind: 'account' });
    await svc.upsert(WAX, { name: 'Alice', account: 'alice.gm', kind: 'account' });

    const original = svc.list(EOS)[0];
    await svc.upsert(EOS, { name: 'Alice A', account: 'alicetwo.gm', kind: 'account' }, original);
    expect(svc.list(EOS).map((c) => c.account)).toEqual(['alicetwo.gm']);
    expect(svc.list(WAX).map((c) => c.account)).toEqual(['alice.gm']);

    await svc.remove(EOS, svc.list(EOS)[0]);
    expect(svc.list(EOS)).toEqual([]);
    expect(svc.list(WAX)).toHaveLength(1);
  });

  it('reloads a persisted book from the store', async () => {
    await svc.load(EOS);
    await svc.upsert(EOS, { name: 'Alice', account: 'alice.gm', kind: 'account', memo: 'rent' });

    const fresh = makeService(store);
    await fresh.load(EOS);
    expect(fresh.list(EOS)).toEqual([
      { name: 'Alice', account: 'alice.gm', kind: 'account', chainId: EOS, memo: 'rent' },
    ]);
  });

  it('migrates the legacy flat list into per-chain buckets', async () => {
    store.data.set('contacts', [
      { name: 'Alice', account: 'Alice.gm', chainId: EOS, memo: 'rent' },
      { name: 'Bob', account: 'bob.wam', chainId: WAX },
      { name: 'Carl', account: 'carl@edge', chainId: FIO, memo: 'dropped' },
      { name: 'Orphan', account: 'orphan.gm' },
    ]);

    for (const chainId of [EOS, WAX, FIO]) await svc.load(chainId);

    expect(svc.list(EOS)).toEqual([
      { name: 'Alice', account: 'alice.gm', kind: 'account', chainId: EOS, memo: 'rent' },
    ]);
    expect(svc.list(WAX).map((c) => c.account)).toEqual(['bob.wam']);
    // FIO rows keep the handle but lose the meaningless memo.
    expect(svc.list(FIO)).toEqual([
      { name: 'Carl', account: 'carl@edge', kind: 'fio_handle', chainId: FIO, memo: undefined },
    ]);
    // Chain-less rows are not guessed at, and the legacy key is left intact.
    expect(store.data.get('contacts')).toBeDefined();
    expect(store.data.get('contactsMigratedPerChain')).toBe(true);
  });

  it('migrates only once', async () => {
    store.data.set('contacts', [{ name: 'Alice', account: 'alice.gm', chainId: EOS }]);
    await svc.load(EOS);
    await svc.remove(EOS, svc.list(EOS)[0]);

    const fresh = makeService(store);
    await fresh.load(EOS);
    expect(fresh.list(EOS)).toEqual([]);
  });

  it('back-fills kind for records written before it existed', async () => {
    store.data.set('contactsMigratedPerChain', true);
    store.data.set(contactsStoreKey(FIO), [
      { name: 'Handle', account: 'bob@edge', chainId: FIO },
      { name: 'Key', account: FIO_KEY, chainId: FIO },
    ] as Partial<Contact>[]);

    await svc.load(FIO);
    expect(svc.list(FIO).map((c) => c.kind)).toEqual(['fio_handle', 'fio_pubkey']);
  });
});
