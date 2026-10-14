import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PermissionsComponent } from './permissions';
import { AccountInfo, TauriIpcService } from '../../../core/services/tauri-ipc.service';
import { WalletAccount, WalletStateService } from '../../../core/services/wallet-state.service';
import { TransactionService } from '../../../core/services/transaction.service';

function accountInfo(): AccountInfo {
  return { account_name: 'eosriobrazil', permissions: [
    { perm_name: 'owner', parent: '', required_auth: {}, linked_actions: [] },
    { perm_name: 'active', parent: 'owner', required_auth: { threshold: 1, keys: [{ key: 'active-key', weight: 1 }] }, linked_actions: [] },
    { perm_name: 'claim2', parent: 'active', required_auth: { threshold: 1, keys: [{ key: 'claim-key', weight: 1 }] },
      linked_actions: [{ account: 'eosio', action: 'claimrewards' }] },
  ] };
}

const abi = { abi: { actions: [{ name: 'claimstandby' }, { name: 'claimrewards' }] } };

async function setup(mode: 'full' | 'watch' = 'full', ledgerIndex?: number) {
  const info = accountInfo();
  const account: WalletAccount = { name: 'eosriobrazil', chainId: 'wax-chain', chainName: 'WAX', mode, ledgerIndex, info };
  const wallet = { selectedAccount: signal<WalletAccount | null>(account) };
  const ipc = {
    getAccount: vi.fn().mockResolvedValue(info), getAbi: vi.fn().mockResolvedValue(abi),
    listPublicKeys: vi.fn().mockResolvedValue(['claim-key', 'active-key']),
    ledgerGetPublicKey: vi.fn().mockResolvedValue('active-key'),
  };
  const tx = { confirm: vi.fn().mockResolvedValue(null) };
  TestBed.configureTestingModule({ imports: [PermissionsComponent], providers: [
    { provide: WalletStateService, useValue: wallet },
    { provide: TauriIpcService, useValue: ipc },
    { provide: TransactionService, useValue: tx },
  ] });
  const fixture = TestBed.createComponent(PermissionsComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { component: fixture.componentInstance, fixture, wallet, ipc, tx };
}

async function fill(component: PermissionsComponent) {
  component.setContract('eosio');
  await component.loadActions();
  component.action.set('claimstandby');
  component.permission.set('claim2');
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

describe('action permission linking', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('builds the exact requested linkauth using the active key, not the target permission key', async () => {
    const { component, ipc, tx } = await setup();
    await fill(component);
    await component.reviewLink();
    expect(tx.confirm).toHaveBeenCalledExactlyOnceWith({
      chainId: 'wax-chain', publicKey: 'active-key', ledgerIndex: undefined, title: 'Link Action Permission',
      actions: [{ account: 'eosio', name: 'linkauth', authorization: [{ actor: 'eosriobrazil', permission: 'active' }],
        data: { account: 'eosriobrazil', code: 'eosio', type: 'claimstandby', requirement: 'claim2' } }],
    });
    expect(ipc.getAbi).toHaveBeenCalledWith('wax-chain', 'eosio');
    expect(component.transactionId()).toBe(''); // cancellation is not success
  });

  it('renders live links and uses labelled form controls to open review', async () => {
    const { fixture, component, tx } = await setup();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toContain('claimrewards');
    const contract = root.querySelector<HTMLInputElement>('#link-contract')!;
    contract.value = 'eosio'; contract.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (Array.from(root.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Load actions'))!.click();
    await fixture.whenStable(); fixture.detectChanges();
    for (const [id, value] of [['link-action', 'claimstandby'], ['link-permission', 'claim2']]) {
      const select = root.querySelector<HTMLSelectElement>(`#${id}`)!;
      select.value = value; select.dispatchEvent(new Event('change'));
    }
    fixture.detectChanges();
    expect(root.textContent).toContain('eosriobrazil@claim2');
    root.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();
    expect(tx.confirm).toHaveBeenCalledOnce();
    expect(component.busy()).toBe(false);
  });

  it('supports Ledger accounts without importing a software key', async () => {
    const { component, ipc, tx } = await setup('full', 3);
    ipc.listPublicKeys.mockResolvedValue([]);
    await fill(component); await component.reviewLink();
    expect(tx.confirm.mock.calls[0][0].ledgerIndex).toBe(3);
    expect(ipc.listPublicKeys).not.toHaveBeenCalled();
  });

  it('blocks watch-only accounts', async () => {
    const { component, tx } = await setup('watch');
    await fill(component); await component.reviewLink();
    expect(component.canReview()).toBe(false);
    expect(tx.confirm).not.toHaveBeenCalled();
  });

  it('blocks signing when only the claim2 key is available', async () => {
    const { component, ipc, tx } = await setup();
    ipc.listPublicKeys.mockResolvedValue(['claim-key']);
    await fill(component); await component.reviewLink();
    expect(tx.confirm).not.toHaveBeenCalled();
    expect(component.error()).toContain('No available key can satisfy eosriobrazil@active');
  });

  it('refreshes links after a successful transaction and blocks a duplicate', async () => {
    const { component, ipc, tx } = await setup();
    await fill(component);
    tx.confirm.mockImplementation(async () => {
      const updated = accountInfo();
      updated.permissions[2].linked_actions!.push({ account: 'eosio', action: 'claimstandby' });
      ipc.getAccount.mockResolvedValue(updated);
      return { transaction_id: 'confirmed-transaction' };
    });
    await component.reviewLink();
    expect(component.transactionId()).toBe('confirmed-transaction');
    expect(component.currentLink()?.permission).toBe('claim2');
    expect(component.canReview()).toBe(false);
  });

  it('shows a transaction error and retains the draft for retry', async () => {
    const { component, tx } = await setup();
    tx.confirm.mockRejectedValue('Network unavailable');
    await fill(component); await component.reviewLink();
    expect(component.error()).toBe('Network unavailable');
    expect(component.action()).toBe('claimstandby');
    expect(component.transactionId()).toBe('');
    expect(component.busy()).toBe(false);
  });

  it('does not turn missing linked-action support into an empty-list claim', async () => {
    const { component, ipc, fixture } = await setup();
    const info = accountInfo(); info.permissions.forEach(p => { delete p.linked_actions; });
    ipc.getAccount.mockResolvedValue(info); await component.refresh(); fixture.detectChanges();
    expect(component.linksAvailable()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('does not report all linked actions');
    expect(fixture.nativeElement.textContent).not.toContain('No explicit action links yet');
  });

  it('renders a contract-wide link as All actions without allowing a wildcard edit', async () => {
    const { component, ipc, fixture } = await setup();
    const info = accountInfo();
    info.permissions[2].linked_actions!.push({ account: 'other.worlds', action: '' });
    ipc.getAccount.mockResolvedValue(info);
    await component.refresh(); fixture.detectChanges();
    const rows = Array.from(fixture.nativeElement.querySelectorAll('tbody tr')) as HTMLElement[];
    const wildcard = rows.find(row => row.textContent?.includes('other.worlds'))!;
    expect(wildcard.textContent).toContain('All actions');
    expect(wildcard.querySelector('button')).toBeNull();
    await fill(component);
    expect(component.canReview()).toBe(true);
  });

  it('rejects invalid names before requesting an ABI', async () => {
    const { component, ipc } = await setup();
    for (const invalid of ['EOSIO', 'abcdefghijklz', 'eosio.', '.....', 'eosio6', '']) {
      component.setContract(invalid); await component.loadActions();
      expect(component.actionError()).toContain('valid contract');
    }
    expect(ipc.getAbi).not.toHaveBeenCalled();
  });

  it('fails closed when the ABI lookup fails', async () => {
    const { component, ipc, tx } = await setup();
    ipc.getAbi.mockRejectedValue('offline');
    await fill(component); await component.reviewLink();
    expect(component.actionError()).toContain('offline');
    expect(tx.confirm).not.toHaveBeenCalled();
  });

  it('rechecks a removed permission and changed ABI before signing', async () => {
    const { component, ipc, tx } = await setup();
    await fill(component);
    const info = accountInfo(); info.permissions.pop(); ipc.getAccount.mockResolvedValue(info);
    await component.reviewLink();
    expect(component.error()).toContain('no longer available');
    expect(tx.confirm).not.toHaveBeenCalled();
    ipc.getAccount.mockResolvedValue(accountInfo()); await component.refresh();
    component.permission.set('claim2');
    ipc.getAbi.mockResolvedValue({ abi: { actions: [] } });
    await component.reviewLink();
    expect(component.error()).toContain('no longer in the contract ABI');
    expect(tx.confirm).not.toHaveBeenCalled();
  });

  it('ignores an ABI response when the contract input changes', async () => {
    const { component, ipc } = await setup();
    const late = deferred<typeof abi>(); ipc.getAbi.mockReturnValue(late.promise);
    component.setContract('eosio'); const pending = component.loadActions();
    component.setContract('eosio.token'); late.resolve(abi); await pending;
    expect(component.actions()).toEqual([]);
    expect(component.loadedContract()).toBe('');
  });

  it('does not open confirmation after switching accounts during preflight', async () => {
    const { component, ipc, wallet, tx } = await setup();
    await fill(component);
    const late = deferred<AccountInfo>(); ipc.getAccount.mockReturnValue(late.promise);
    const pending = component.reviewLink();
    wallet.selectedAccount.set({ ...wallet.selectedAccount()!, name: 'otheraccount' });
    late.resolve(accountInfo()); await pending;
    expect(tx.confirm).not.toHaveBeenCalled();
  });

  it('ignores old account responses and resets the form when the network changes', async () => {
    const { component, fixture, ipc, wallet } = await setup();
    await fill(component);
    const late = deferred<AccountInfo>(); ipc.getAccount.mockReturnValueOnce(late.promise);
    const pending = component.refresh();
    const next = { account_name: 'alice', permissions: [] };
    ipc.getAccount.mockResolvedValue(next);
    wallet.selectedAccount.set({ ...wallet.selectedAccount()!, name: 'alice', chainId: 'other-chain' });
    fixture.detectChanges(); await fixture.whenStable();
    late.resolve(accountInfo()); await pending;
    expect(component.info()?.account_name).toBe('alice');
    expect(component.contract()).toBe('');
    expect(component.permission()).toBe('');
  });

  it('blocks a stale form immediately when the same account is selected on another chain', async () => {
    const { component, wallet, tx } = await setup();
    await fill(component);
    expect(component.canReview()).toBe(true);
    wallet.selectedAccount.set({ ...wallet.selectedAccount()!, chainId: 'other-chain' });
    await component.reviewLink();
    expect(component.canReview()).toBe(false);
    expect(tx.confirm).not.toHaveBeenCalled();
  });

  it('does not open a second review while one is pending', async () => {
    const { component, tx } = await setup();
    await fill(component);
    const late = deferred<null>(); tx.confirm.mockReturnValue(late.promise);
    const pending = component.reviewLink();
    await component.reviewLink();
    late.resolve(null); await pending;
    expect(tx.confirm).toHaveBeenCalledOnce();
  });

  it('prefills an existing link for editing without submitting it', async () => {
    const { component, fixture, tx } = await setup();
    component.editLink(component.links()[0]);
    await fixture.whenStable();
    expect(component.contract()).toBe('eosio');
    expect(component.action()).toBe('claimrewards');
    expect(component.permission()).toBe('claim2');
    expect(component.unchanged()).toBe(true);
    expect(tx.confirm).not.toHaveBeenCalled();
  });
});
