import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { LandingComponent } from './landing';

function setup() {
  const account = { name: 'alice', chainId: 'chain' };
  const wallet = {
    vaultExists: signal(false), locked: signal(true), accounts: signal<any[]>([]),
    addImportedAccount: vi.fn().mockImplementation(async () => { wallet.accounts.set([account]); return account; }),
    saveAccounts: vi.fn().mockResolvedValue(undefined), selectAccount: vi.fn(),
  };
  const ipc = {
    importBackup: vi.fn().mockResolvedValue(1),
    lookupKeyAccounts: vi.fn().mockResolvedValue({ account_names: ['alice'] }),
  };
  const router = { navigate: vi.fn().mockResolvedValue(true) };
  const component = new LandingComponent(ipc as any, wallet as any, {} as any, router as any);
  component.backupJson.set(JSON.stringify({ version: 'simpleos-v2', keys: [{ chain_id: 'chain', public_key: 'key' }] }));
  component.passphrase.set('backup-password');
  return { component, wallet, ipc, router };
}

describe('first-run backup restore', () => {
  it('restores keys, persists discovered accounts, then opens the dashboard', async () => {
    const { component, wallet, ipc, router } = setup();
    await component.onRestoreBackup();
    expect(ipc.importBackup).toHaveBeenCalled();
    expect(wallet.vaultExists()).toBe(true);
    expect(wallet.locked()).toBe(false);
    expect(wallet.saveAccounts).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.passphrase()).toBe('');
  });
  it('does not activate or navigate after a failed backend restore', async () => {
    const { component, wallet, ipc, router } = setup();
    ipc.importBackup.mockRejectedValue('Invalid passphrase');
    await component.onRestoreBackup();
    expect(wallet.vaultExists()).toBe(false);
    expect(wallet.locked()).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.error()).toContain('Invalid passphrase');
  });
  it('keeps restored keys and explains offline account discovery', async () => {
    const { component, wallet, ipc, router } = setup();
    ipc.lookupKeyAccounts.mockRejectedValue('offline');
    await component.onRestoreBackup();
    expect(wallet.vaultExists()).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.success()).toContain('keys are saved');
  });
});
