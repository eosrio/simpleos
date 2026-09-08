import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WalletComponent } from '../../features/dashboard/wallet/wallet';
import { ResourcesComponent } from '../../features/dashboard/resources/resources';
import { VoteComponent } from '../../features/dashboard/vote/vote';
import { ChainFeaturesService } from './chain-features.service';
import { WalletStateService } from './wallet-state.service';

function deferred<T = any>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: any) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function account(name = 'alice', chainId = 'chain-a'): any {
  return { name, chainId, chainName: chainId, mode: 'full', info: { account_name: name, permissions: [], core_liquid_balance: '1.0000 TEST' } };
}
function walletMock() {
  return { selectedAccount: signal(account()), hasTauri: signal(true), activeChain: signal<any>({ id: 'chain-a', symbol: 'TEST' }) };
}
function history(id: string, count = 1): any {
  return { actions: Array.from({ length: count }, (_, i) => ({ trx_id: `${id}-${i}`, act: { name: 'transfer', data: {} } })) };
}
afterEach(() => TestBed.resetTestingModule());

describe('history request lifecycle', () => {
  it('does not retry a history service that the network does not provide', async () => {
    const wallet = walletMock(); wallet.activeChain.set({ id: 'ultra', features: { history: true }, hyperion_apis: [] });
    const ipc = { getActionsHistory: vi.fn() };
    const view = TestBed.runInInjectionContext(() => new WalletComponent(wallet as any, ipc as any));
    await view.loadHistory(0);
    expect(view.historyUnavailable()).toBe(true);
    expect(ipc.getActionsHistory).not.toHaveBeenCalled();
    expect(view.historyError()).toBe('');
  });
  it('does not clear the new account history when an older balance refresh completes', async () => {
    const pending = deferred();
    const wallet = { ...walletMock(), selectedIndex: () => 0, refreshAccount: () => pending.promise, saveAccounts: async () => {} };
    const ipc = { getActionsHistory: vi.fn().mockResolvedValue(history('bob')) };
    const view = TestBed.runInInjectionContext(() => new WalletComponent(wallet as any, ipc as any));
    const work = view.refreshAccount(); wallet.selectedAccount.set(account('bob', 'chain-b'));
    await view.loadHistory(0); pending.resolve(undefined); await work;
    expect(view.actions()[0].trx_id).toBe('bob-0');
    expect(ipc.getActionsHistory).toHaveBeenCalledTimes(1);
  });
  it('discards a late response from the previous account', async () => {
    const wallet = walletMock(); const first = deferred(); const second = deferred();
    const ipc = { getActionsHistory: vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise) };
    const view = TestBed.runInInjectionContext(() => new WalletComponent(wallet as any, ipc as any));
    const old = view.loadHistory(0);
    wallet.selectedAccount.set(account('bob', 'chain-b'));
    const latest = view.loadHistory(0);
    second.resolve(history('bob')); await latest;
    first.resolve(history('alice')); await old;
    expect(view.actions()[0].trx_id).toBe('bob-0');
  });
  it('keeps pagination available when Hyperion omits an exact total', async () => {
    const ipc = { getActionsHistory: vi.fn().mockResolvedValue(history('page', 20)) };
    const view = TestBed.runInInjectionContext(() => new WalletComponent(walletMock() as any, ipc as any));
    await view.loadHistory(0);
    expect(view.hasMore()).toBe(true);
    ipc.getActionsHistory.mockRejectedValue('offline'); await view.loadHistory(20);
    expect(view.actions()).toHaveLength(20);
    expect(view.historyError()).toContain('loaded transactions are still shown');
    expect(view.hasMore()).toBe(true);
  });
  it('does not accept malformed history as an empty successful page', async () => {
    const ipc = { getActionsHistory: vi.fn().mockResolvedValue({ error: 'maintenance' }) };
    const view = TestBed.runInInjectionContext(() => new WalletComponent(walletMock() as any, ipc as any));
    await view.loadHistory(0);
    expect(view.historyError()).toContain('Could not load history');
  });
  it('ignores an older filter request and prevents overlapping pagination', async () => {
    const a = deferred(); const b = deferred();
    const ipc = { getActionsHistory: vi.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise) };
    const view = TestBed.runInInjectionContext(() => new WalletComponent(walletMock() as any, ipc as any));
    const old = view.loadHistory(0);
    view.filterAction.set('voteproducer'); const current = view.loadHistory(0);
    await view.loadHistory(20);
    expect(ipc.getActionsHistory).toHaveBeenCalledTimes(2);
    b.resolve(history('filtered')); await current;
    a.resolve(history('unfiltered')); await old;
    expect(view.actions()[0].trx_id).toBe('filtered-0');
  });
});

describe('chain capability discovery', () => {
  it('does not let an old network overwrite current capabilities or loading state', async () => {
    const oldAbi = deferred(); const newAbi = deferred(); const wallet = walletMock();
    const ipc = { getAbi: vi.fn().mockReturnValueOnce(oldAbi.promise).mockReturnValueOnce(newAbi.promise) };
    const features = new ChainFeaturesService(ipc as any, wallet as any);
    const first = features.detect(); wallet.activeChain.set({ id: 'chain-b', symbol: 'TEST' });
    const second = features.detect();
    oldAbi.resolve({ abi: { actions: [{ name: 'delegatebw' }] } }); await first;
    expect(features.loading()).toBe(true);
    expect(features.capabilities().staking).toBe(false);
    newAbi.resolve({ abi: { actions: [{ name: 'refundram' }] } }); await second;
    expect(features.capabilities().ramRefund).toBe(true);
  });
  it('exposes transient errors instead of silently claiming no capabilities', async () => {
    const ipc = { getAbi: vi.fn().mockRejectedValue('offline') };
    const features = new ChainFeaturesService(ipc as any, walletMock() as any);
    await features.detect(); expect(features.loadError()).toContain('retry');
    ipc.getAbi.mockResolvedValue({ abi: { actions: [{ name: 'delegatebw' }] } });
    await features.detect(); expect(features.loadError()).toBe(''); expect(features.hasStaking()).toBe(true);
  });
  it('detects FIO staking from fio.staking rather than only eosio', async () => {
    const wallet = walletMock(); wallet.activeChain.set({ id: 'fio', symbol: 'FIO' });
    const ipc = { getAbi: vi.fn().mockImplementation(async (_chain, contract) => ({ abi: { actions: contract === 'fio.staking' ? [{ name: 'stakefio' }] : [] } })) };
    const features = new ChainFeaturesService(ipc as any, wallet as any);
    await features.detect();
    expect(features.capabilities().fioStaking).toBe(true);
    expect(ipc.getAbi).toHaveBeenCalledWith('fio', 'fio.staking');
  });
  it('includes configured wrapper actions while retaining eosio table state', async () => {
    const wallet = walletMock(); wallet.activeChain.set({ id: 'vaulta', symbol: 'A', system_contract: 'core.vaulta' });
    const ipc = {
      getAbi: vi.fn().mockImplementation(async (_chain, contract) => ({ abi: { actions: contract === 'core.vaulta' ? [{ name: 'powerup' }] : [] } })),
      getTableRows: vi.fn().mockResolvedValue({ rows: [{}] }),
    };
    const features = new ChainFeaturesService(ipc as any, wallet as any); await features.detect();
    expect(features.hasPowerUp()).toBe(true);
    expect(ipc.getTableRows.mock.calls[0][1].code).toBe('eosio');
  });
});

describe('resource and governance response ownership', () => {
  it('discards resource data after switching accounts', async () => {
    const wallet = walletMock(); const pending = deferred();
    const view = TestBed.runInInjectionContext(() => new ResourcesComponent(wallet as any, {} as any, { getPowerUpInfo: () => pending.promise } as any, {} as any));
    const work = view.loadPowerUpData(); wallet.selectedAccount.set(account('bob', 'chain-b'));
    pending.resolve({ state: { powerup_days: 999 }, active_orders: [{}] }); await work;
    expect(view.powerupLoaded()).toBe(false); expect(view.activeOrders()).toEqual([]);
  });
  it('does not let an old producer response prune the new network vote selection', async () => {
    const wallet = walletMock(); const a = deferred(); const b = deferred();
    const ipc = { getProducers: vi.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise) };
    const view = TestBed.runInInjectionContext(() => new VoteComponent(wallet as any, {} as any, ipc as any, {} as any));
    const old = (view as any).loadProducers('chain-a');
    wallet.selectedAccount.set(account('bob', 'chain-b'));
    const current = (view as any).loadProducers('chain-b'); view.selectedProducers.set(['newproducer']);
    b.resolve({ rows: [{ owner: 'newproducer', is_active: 1, total_votes: '1' }] }); await current;
    a.resolve({ rows: [{ owner: 'newproducer', is_active: 0, total_votes: '1' }] }); await old;
    expect(view.selectedProducers()).toEqual(['newproducer']);
    expect(view.producers()[0].is_active).toBe(1);
  });
  it('reports producer lookup failure for retry', async () => {
    const view = TestBed.runInInjectionContext(() => new VoteComponent(walletMock() as any, {} as any, { getProducers: vi.fn().mockRejectedValue('offline') } as any, {} as any));
    await (view as any).loadProducers('chain-a');
    expect(view.producerError()).toContain('retry');
  });
});

describe('wallet account refresh ownership', () => {
  it('loads XPR from the token contract when get_account omits the liquid balance', async () => {
    const info = { ...account('eosrio', 'xpr').info, core_liquid_balance: undefined };
    const ipc = { getAccount: async () => ({ ...info }), getBalances: vi.fn().mockResolvedValue(['74797.0757 XPR']), getProducers: async () => ({ rows: [] }) };
    const wallet = new WalletStateService(ipc as any);
    wallet.hasTauri.set(true);
    wallet.chains.set([{ id: 'xpr', name: 'XPR', symbol: 'XPR', precision: 4, token_contract: 'eosio.token', extra_tokens: [] } as any]);
    wallet.accounts.set([account('eosrio', 'xpr')]);
    await wallet.refreshAccount(0);
    expect(wallet.accounts()[0].info.core_liquid_balance).toBe('74797.0757 XPR');
  });
  it('does not overwrite another account when an account is removed during refresh', async () => {
    const pending = deferred();
    const wallet = new WalletStateService({ getAccount: () => pending.promise, getProducers: async () => ({ rows: [] }) } as any);
    wallet.hasTauri.set(true); wallet.accounts.set([account('alice'), account('bob')]);
    const refresh = wallet.refreshAccount(0);
    wallet.accounts.set([account('bob')]); pending.resolve(account('alice').info); await refresh;
    expect(wallet.accounts()[0].info.account_name).toBe('bob');
  });
});
