import { afterEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BRIDGE_ROUTES, BridgeSnapshot, decimal, ethereumAddress, parseToken, quoteTransfer, uint } from './bridge-model';
import { EvmBridgeService, UltraEthereumAdapter } from './evm-bridge.service';
import { BridgesComponent } from '../../features/dashboard/bridges/bridges';
import { WalletStateService } from '../services/wallet-state.service';
import { TransactionService } from '../services/transaction.service';

const route = BRIDGE_ROUTES[0];
// Captured tokens.a shape; source fixture: tests/fixtures/ultra-bridge/tokens.a.json.
const uos = { symbol: '8,UOS', contract: 'eosio.token', min_swap_amount: '10000000000', max_swap_amount: '1000000000000000', evm_symbol: 'UOS', evm_precision: 4, evm_address: 'd13c7342e1ef687c5ad21b27c2b65d772cab5c8c', state: 1 };
const token = parseToken(uos);
const recipient = '0x52908400098527886E0F7030069857D2E4169EE7';
function snapshot(): BridgeSnapshot { return { tokens: [token], balances: { [token.id]: '1000.00000000' }, maintenanceAt: null, evmPaused: false, loadedAt: Date.now() }; }
const evm = { paused: false, schedule_version: '5', settlements: [{ counter: '68', block: '0' }] };
function deferred<T = any>() { let resolve!: (v: T) => void; const promise = new Promise<T>(yes => resolve = yes); return { promise, resolve }; }
afterEach(() => TestBed.resetTestingModule());

describe('bridge amount and address contract', () => {
  it('builds the deployed Ultra transfer using live precision and memo', () => {
    const result = quoteTransfer(route, snapshot(), token.id, 'eosrio', '100.1234', recipient);
    expect(result.action).toEqual({ account: 'eosio.token', name: 'transfer', authorization: [{ actor: 'eosrio', permission: 'active' }], data: { from: 'eosrio', to: 'ultra.swap', quantity: '100.12340000 UOS', memo: `ethereum,${recipient}` } });
    expect(result.received).toBe('100.1234 UOS');
  });
  it('rejects precision dust, scientific notation and out-of-range amounts', () => {
    for (const amount of ['100.00000001', '1e3', '-100', '1,000', '0', '99', '1001']) {
      expect(() => quoteTransfer(route, snapshot(), token.id, 'eosrio', amount, recipient)).toThrow();
    }
  });
  it('preserves integer accuracy and rejects lossy RPC integers', () => {
    expect(uint('18446744073709551615')).toBe(18446744073709551615n);
    expect(() => uint(9007199254740992)).toThrow();
    expect(decimal(1000000000000001n, 8)).toBe('10000000.00000001');
  });
  it('checks EIP-55 and rejects zero and bridge/token destinations', () => {
    expect(ethereumAddress(recipient.toLowerCase())).toBe(recipient);
    expect(() => ethereumAddress('0x52908400098527886E0F7030069857D2e4169EE7')).toThrow('checksum');
    for (const address of ['0x' + '0'.repeat(40), 'alice.eth', route.evmContract, token.evmAddress]) {
      expect(() => quoteTransfer(route, snapshot(), token.id, 'eosrio', '100', address)).toThrow();
    }
  });
  it('treats state 3 as active and respects destination decimal expansion', () => {
    const weth = parseToken({ ...uos, symbol: '9,WETH', min_swap_amount: '500000', max_swap_amount: '100000000000', evm_symbol: 'WETH', evm_precision: 18, state: 3 });
    const state = { ...snapshot(), tokens: [weth], balances: { [weth.id]: '1.000000000' } };
    expect(quoteTransfer(route, state, weth.id, 'eosrio', '0.0005', recipient).received).toBe('0.000500000000000000 WETH');
  });
  it('blocks maintenance, paused, stale, disabled and unavailable balance', () => {
    const variants = [{ ...snapshot(), maintenanceAt: Date.now() - 1 }, { ...snapshot(), evmPaused: true }, { ...snapshot(), loadedAt: Date.now() - 61000 }, { ...snapshot(), tokens: [{ ...token, active: false }] }, { ...snapshot(), balances: {} }];
    for (const state of variants) expect(() => quoteTransfer(route, state, token.id, 'eosrio', '100', recipient)).toThrow();
  });
});

describe('Ultra bridge adapter', () => {
  it('reads live mappings and exact balances instead of chain default precision', async () => {
    const ipc: any = { getEvmBridgeState: vi.fn().mockResolvedValue(evm), getBalances: vi.fn().mockResolvedValue(['500.12340000 UOS']), getTableRows: vi.fn().mockImplementation(async (_id, p) => ({ rows: p.table === 'tokens.a' ? [uos] : p.table === 'evms.a' ? [{ evm_chain_id: 1, evm_chain_name: 'ethereum' }] : [], more: false })) };
    const result = await new UltraEthereumAdapter(route, ipc).loadSnapshot('eosrio');
    expect(result.tokens[0].precision).toBe(8);
    expect(result.balances[token.id]).toBe('500.12340000');
    expect(ipc.getBalances).toHaveBeenCalledWith(route.sourceChainId, 'eosrio', 'eosio.token', 'UOS');
    ipc.getBalances.mockRejectedValue('offline');
    expect((await new UltraEthereumAdapter(route, ipc).loadSnapshot('eosrio')).balances[token.id]).toBeUndefined();
    ipc.getTableRows.mockRejectedValue('offline');
    await expect(new UltraEthereumAdapter(route, ipc).loadSnapshot('eosrio')).rejects.toThrow();
  });
  it('counts only distinct schedule members and never labels proof threshold as payout', async () => {
    // Synthetic pending request from the live ABI; no pending rows existed at capture.
    const row = { counter: '68', schedule_id: '5', chain_id: route.sourceChainId, evm_chain_id: 1, sender: 'eosrio', symbol: '8,UOS', amount: '10000000000', time: 100, evm_receiving_address: recipient.slice(2) };
    const att = (validator: string) => ({ validator, ultra2evm_signature: '11'.repeat(65) });
    const ipc: any = { getEvmBridgeState: vi.fn().mockResolvedValue(evm), getTableRows: vi.fn().mockImplementation(async (_id, p) => ({ more: false, rows: p.table === '2evmreqs.a' ? [row] : p.table === 'schedule.a' ? [{ version: 5, validators: ['val1', 'val2'], threshold: 2 }] : [{ counter: '68', attestations: [att('val1'), att('val1'), att('imposter')] }] })) };
    const adapter = new UltraEthereumAdapter(route, ipc);
    expect((await adapter.loadRequests('eosrio')).requests[0]).toMatchObject({ attestations: 1, status: 'validating' });
    ipc.getEvmBridgeState.mockResolvedValue({ ...evm, schedule_version: '6' });
    expect((await adapter.loadRequests('eosrio')).requests[0].status).toBe('schedule-changed');
    ipc.getEvmBridgeState.mockResolvedValue({ ...evm, settlements: [{ counter: '68', block: '123' }] });
    expect((await adapter.loadRequests('eosrio')).requests[0]).toMatchObject({ status: 'settled', statusDetail: expect.stringContaining('administrative repairs') });
    ipc.getEvmBridgeState.mockRejectedValue('offline');
    expect((await adapter.loadRequests('eosrio')).requests[0].status).toBe('unknown');
  });
});

function view() {
  const wallet: any = { selectedAccount: signal({ name: 'eosrio', chainId: route.sourceChainId, mode: 'full' }), hasTauri: () => true };
  const adapter = { route, quote: quoteTransfer, loadSnapshot: vi.fn().mockImplementation(async () => snapshot()), loadRequests: vi.fn().mockResolvedValue({ requests: [], more: false }) };
  const bridges: any = { routes: (chain: string) => chain === route.sourceChainId ? [route] : [], adapter: () => adapter, submissions: vi.fn().mockResolvedValue([]), remember: vi.fn().mockResolvedValue(undefined) };
  const tx: any = { confirm: vi.fn().mockResolvedValue({ transaction_id: 'a'.repeat(64) }) };
  TestBed.configureTestingModule({ imports: [BridgesComponent], providers: [{ provide: WalletStateService, useValue: wallet }, { provide: EvmBridgeService, useValue: bridges }, { provide: TransactionService, useValue: tx }] });
  const fixture = TestBed.createComponent(BridgesComponent);
  fixture.detectChanges();
  return { wallet, bridges, adapter, tx, fixture, component: fixture.componentInstance };
}
async function ready() { const state = view(); await state.fixture.whenStable(); state.fixture.detectChanges(); state.component.amount.set('100'); state.component.recipient.set(recipient); state.component.acknowledged.set(true); return state; }
describe('bridge screen', () => {
  it('renders the custom flow and an Ethereum-only handoff without requiring Ultra Wallet', async () => {
    const { fixture } = await ready();
    expect(fixture.nativeElement.textContent).toContain('Resume Transfer to EVM');
    expect(fixture.nativeElement.textContent).toContain('Your Ultra account does not need to connect');
  });
  it('rechecks configuration, signs the native action, and saves submission separately from completion', async () => {
    const { component, tx, bridges } = await ready();
    await component.reviewTransfer();
    expect(tx.confirm.mock.calls[0][0].actions[0].data.to).toBe('ultra.swap');
    expect(bridges.remember).toHaveBeenCalledWith(route, 'eosrio', expect.objectContaining({ transactionId: 'a'.repeat(64), quantity: '100.00000000 UOS' }));
    expect(component.latest()?.transactionId).toBe('a'.repeat(64));
  });
  it('does not sign if maintenance begins during preflight', async () => {
    const { component, adapter, tx } = await ready();
    adapter.loadSnapshot.mockResolvedValue({ ...snapshot(), evmPaused: true });
    await component.reviewTransfer(); expect(tx.confirm).not.toHaveBeenCalled(); expect(component.error()).toContain('paused');
  });
  it('ignores old-account preflight and blocks overlapping submissions', async () => {
    const { component, adapter, wallet, tx } = await ready(); const waiting = deferred();
    adapter.loadSnapshot.mockReturnValue(waiting.promise);
    const first = component.reviewTransfer(); await component.reviewTransfer();
    wallet.selectedAccount.set({ name: 'bob', chainId: route.sourceChainId, mode: 'full' });
    waiting.resolve(snapshot()); await first;
    expect(tx.confirm).not.toHaveBeenCalled();
  });
  it('blocks watch-only accounts and retains transaction details after a save failure', async () => {
    const { component, wallet, bridges } = await ready();
    wallet.selectedAccount.set({ ...wallet.selectedAccount(), mode: 'watch' }); expect(component.canReview()).toBe(false);
    wallet.selectedAccount.set({ ...wallet.selectedAccount(), mode: 'full' }); bridges.remember.mockRejectedValue('disk unavailable');
    await component.reviewTransfer(); expect(component.notice()).toContain('could not be saved'); expect(component.latest()).not.toBeNull();
  });
});
