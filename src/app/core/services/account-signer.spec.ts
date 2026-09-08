import { describe, expect, it, vi } from 'vitest';
import { signal } from '@angular/core';
import { resolveAccountSigner } from './account-signer';
import { TransactionService } from './transaction.service';

function setup(threshold = 1, mode = 'full', ledgerIndex?: number) {
  const account = { name: 'bob', chainId: 'chain', mode, ledgerIndex };
  const ipc = {
    getAccount: vi.fn().mockResolvedValue({ permissions: [
      { perm_name: 'active', required_auth: { threshold, keys: [{ key: 'bob-key', weight: 1 }] } },
      { perm_name: 'owner', required_auth: { threshold: 1, keys: [{ key: 'owner-key', weight: 1 }] } },
    ] }),
    listPublicKeys: vi.fn().mockResolvedValue(['alice-key', 'bob-key', 'owner-key']),
    ledgerGetPublicKey: vi.fn().mockResolvedValue('bob-key'),
    beginSign: vi.fn().mockResolvedValue({ transaction_id: 'tx' }),
  };
  return { account, ipc };
}

describe('account signer', () => {
  it('rejects watch-only accounts before accessing keys', async () => {
    const { account, ipc } = setup(1, 'watch');
    await expect(resolveAccountSigner(ipc as any, account as any)).rejects.toThrow('watch-only');
    expect(ipc.listPublicKeys).not.toHaveBeenCalled();
  });
  it('does not confuse holding a key with satisfying a multisig threshold', async () => {
    const { account, ipc } = setup(2);
    await expect(resolveAccountSigner(ipc as any, account as any)).rejects.toThrow('multisig');
  });
  it('uses the requested owner permission', async () => {
    const { account, ipc } = setup();
    expect(await resolveAccountSigner(ipc as any, account as any, 'owner')).toEqual({ publicKey: 'owner-key', ledgerIndex: undefined });
  });
  it('corrects first-key guesses at the shared transaction boundary', async () => {
    const { account, ipc } = setup();
    const tx = new TransactionService(ipc as any, { hasTauri: signal(true), selectedAccount: signal(account) } as any);
    await tx.confirm({ chainId: 'chain', publicKey: 'alice-key', actions: [{ account: 'eosio.token', name: 'transfer', authorization: [{ actor: 'bob', permission: 'active' }], data: {} }] });
    expect(ipc.beginSign.mock.calls[0][1]).toBe('bob-key');
  });
  it('routes an older caller through Ledger when the account has a device index', async () => {
    const { account, ipc } = setup(1, 'full', 2);
    const tx = new TransactionService(ipc as any, { hasTauri: signal(true), selectedAccount: signal(account) } as any);
    const completion = tx.confirm({ chainId: 'chain', publicKey: 'alice-key', actions: [{ account: 'eosio.token', name: 'transfer', authorization: [{ actor: 'bob', permission: 'active' }], data: {} }] });
    await vi.waitFor(() => expect(tx.phase()).toBe('review'));
    expect(tx.request()?.ledgerIndex).toBe(2);
    expect(tx.needsPassphrase()).toBe(false);
    expect(ipc.beginSign).not.toHaveBeenCalled();
    tx.cancel();
    await completion;
  });
});
