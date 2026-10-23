import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PermissionsComponent } from './permissions';
import { AccountInfo, TauriIpcService } from '../../../core/services/tauri-ipc.service';
import { WalletAccount, WalletStateService } from '../../../core/services/wallet-state.service';
import { TransactionService } from '../../../core/services/transaction.service';
import { resolveActionPermissionAndSigner } from '../../../core/services/account-signer';
import { BpRewardsComponent, formatWireBaseUnits, mapWireClaimError } from '../bp-rewards/bp-rewards';

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


describe('authority editor (updateauth) and PUB_EM_ keys', () => {
  afterEach(() => TestBed.resetTestingModule());

  const UNCOMPRESSED_EM =
    'PUB_EM_04602efca9b2d30f01ad8ef1bedc7b194131aa15a8b095be5fc56c3b644a428b1368ac0c806a9e2b33915d8ad66202e093be0e87a4ac9d65d68a18e4d80ff7b318';
  const COMPRESSED_EM =
    'PUB_EM_02602efca9b2d30f01ad8ef1bedc7b194131aa15a8b095be5fc56c3b644a428b13';
  const WIRE_K1 = 'PUB_K1_6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5BoDq63';

  it('normalizes uncompressed PUB_EM_04... keys and matches compressed Vault keys', async () => {
    const { component, ipc } = await setup();
    (component.wallet as any).activeChain = () => ({ id: 'wax-chain', system_contract: 'sysio' });
    ipc.listPublicKeys.mockResolvedValue([COMPRESSED_EM]);
    await component.refresh();
    expect(component.canonicalKey(UNCOMPRESSED_EM)).toBe(COMPRESSED_EM);
    expect(component.hasVaultKey(UNCOMPRESSED_EM)).toBe(true);
  });

  it('detects and rejects 20-byte 0x Ethereum addresses while allowing MetaMask discovery', async () => {
    const { component, ipc } = await setup();
    (ipc as any).metamaskDiscoverKey = vi.fn().mockResolvedValue({
      public_key: COMPRESSED_EM,
      eth_address: '0xbFD24112203baA44E04F82fcB727824616930419',
    });
    component.openEditAuthority('active');
    component.newKeyInput.set('0xbFD24112203baA44E04F82fcB727824616930419');
    expect(component.is20ByteEthAddress()).toBe(true);
    await component.addKeyToAuthority();
    expect(component.authError()).toContain('Ethereum address (20 bytes)');

    await component.discoverFromMetaMask();
    expect(component.authKeys().some(k => k.key === COMPRESSED_EM)).toBe(true);
    expect(component.ethAddressFor(COMPRESSED_EM)).toBe('0xbFD24112203baA44E04F82fcB727824616930419');
  });

  it('sorts K1 keys before EM keys and submits sysio::updateauth without waits', async () => {
    const { component, ipc, tx } = await setup();
    (component.wallet as any).systemAccount = () => 'sysio';
    const info = accountInfo();
    info.permissions[1].required_auth = {
      threshold: 1,
      keys: [
        { key: UNCOMPRESSED_EM, weight: 1 },
        { key: WIRE_K1, weight: 1 },
      ],
      accounts: [],
    };
    ipc.getAccount.mockResolvedValue(info);
    ipc.listPublicKeys.mockResolvedValue([COMPRESSED_EM]);
    await component.refresh();

    component.openEditAuthority('active');
    expect(component.authKeys().map(k => k.key)).toEqual([WIRE_K1, COMPRESSED_EM]);
    expect(component.canReviewAuth()).toBe(true);

    await component.reviewAuthorityUpdate();
    expect(tx.confirm).toHaveBeenCalledExactlyOnceWith({
      chainId: 'wax-chain',
      publicKey: COMPRESSED_EM,
      ledgerIndex: undefined,
      title: 'Update Authority (eosriobrazil@active)',
      actions: [{
        account: 'sysio',
        name: 'updateauth',
        authorization: [{ actor: 'eosriobrazil', permission: 'active' }],
        data: {
          account: 'eosriobrazil',
          permission: 'active',
          parent: 'owner',
          auth: {
            threshold: 1,
            keys: [
              { key: WIRE_K1, weight: 1 },
              { key: COMPRESSED_EM, weight: 1 },
            ],
            accounts: [],
          },
        },
      }],
    });
  });

  it('enforces explicit <account>@owner confirmation guard when editing owner authority', async () => {
    const { component, ipc, tx } = await setup();
    const info = accountInfo();
    info.permissions[0].required_auth = {
      threshold: 1,
      keys: [{ key: COMPRESSED_EM, weight: 1 }],
      accounts: [],
    };
    ipc.getAccount.mockResolvedValue(info);
    ipc.listPublicKeys.mockResolvedValue([COMPRESSED_EM]);
    await component.refresh();

    component.openEditAuthority('owner');
    expect(component.canReviewAuth()).toBe(false);
    component.ownerConfirmText.set('wrong@owner');
    expect(component.canReviewAuth()).toBe(false);
    component.ownerConfirmText.set('eosriobrazil@owner');
    expect(component.canReviewAuth()).toBe(true);

    await component.reviewAuthorityUpdate();
    expect(tx.confirm).toHaveBeenCalledOnce();
    expect(tx.confirm.mock.calls[0][0].actions[0].authorization).toEqual([
      { actor: 'eosriobrazil', permission: 'owner' },
    ]);
  });

  it('preserves existing authority waits on non-sysio chains', async () => {
    const { component, ipc, tx } = await setup();
    (component.wallet as any).systemAccount = () => 'eosio';
    const info = accountInfo();
    info.permissions[1].required_auth = {
      threshold: 2,
      keys: [{ key: WIRE_K1, weight: 1 }],
      accounts: [],
      waits: [{ wait_sec: 3600, weight: 1 }],
    } as any;
    ipc.getAccount.mockResolvedValue(info);
    ipc.listPublicKeys.mockResolvedValue([WIRE_K1]);
    // owner key can sign when active has threshold 2
    info.permissions[0].required_auth = {
      threshold: 1,
      keys: [{ key: WIRE_K1, weight: 1 }],
      accounts: [],
    };
    await component.refresh();

    component.openEditAuthority('active');
    expect(component.totalAuthWeight()).toBe(2);
    expect(component.canReviewAuth()).toBe(true);

    await component.reviewAuthorityUpdate();
    expect(tx.confirm).toHaveBeenCalledOnce();
    expect(tx.confirm.mock.calls[0][0].actions[0].data.auth.waits).toEqual([
      { wait_sec: 3600, weight: 1 },
    ]);
  });

  it('resolves linked claim permission when key is available and falls back to active otherwise', async () => {
    const info = accountInfo();
    info.permissions.push({
      perm_name: 'claim',
      parent: 'active',
      required_auth: { threshold: 1, keys: [{ key: 'claim-wire-key', weight: 1 }] },
      linked_actions: [
        { account: 'sysio', action: 'claimpay' },
        { account: 'sysio', action: 'claimnodedis' },
      ],
    });
    const acct: WalletAccount = {
      name: 'eosriobrazil',
      chainId: 'wire-testnet',
      chainName: 'Wire Testnet',
      mode: 'full',
      info,
    };
    const ipcWithClaimKey = {
      getAccount: vi.fn().mockResolvedValue(info),
      listPublicKeys: vi.fn().mockResolvedValue(['claim-wire-key', 'active-key']),
    } as any;
    const res1 = await resolveActionPermissionAndSigner(
      ipcWithClaimKey,
      acct,
      'sysio',
      'claimpay',
      'active',
    );
    expect(res1.permission).toBe('claim');
    expect(res1.publicKey).toBe('claim-wire-key');

    const ipcOnlyActiveKey = {
      getAccount: vi.fn().mockResolvedValue(info),
      listPublicKeys: vi.fn().mockResolvedValue(['active-key']),
    } as any;
    const res2 = await resolveActionPermissionAndSigner(
      ipcOnlyActiveKey,
      acct,
      'sysio',
      'claimnodedis',
      'active',
    );
    expect(res2.permission).toBe('active');
    expect(res2.publicKey).toBe('active-key');
  });

  it('formats 9-decimal WIRE base units and maps Wire claim assertion messages', () => {
    expect(formatWireBaseUnits('12500000000')).toBe('12.500000000 WIRE');
    expect(formatWireBaseUnits('5')).toBe('0.000000005 WIRE');
    expect(formatWireBaseUnits('0')).toBe('0.000000000 WIRE');
    expect(
      mapWireClaimError('assertion failure with message: treasury balance is reserved against unclaimed epoch pay; try again later'),
    ).toContain('reserved against unclaimed epoch pay');
    expect(
      mapWireClaimError('assertion failure with message: claim amount below minimum threshold'),
    ).toContain('minimum claim threshold');
    expect(
      mapWireClaimError('assertion failure with message: no epoch pay to claim'),
    ).toContain('No unclaimed epoch pay');
  });

  it('keeps the Wire node-owner card visible from nodedist row on transient viewnodedist failure and skips history when unavailable', async () => {
    const info = accountInfo();
    const selectedAccount = signal<WalletAccount | null>({
      name: 'eosriobrazil',
      chainId: 'wire-id',
      chainName: 'Wire Testnet',
      mode: 'full',
      info,
      isNodeOwner: true,
      wireNodeDistRow: {
        total_allocation: '7500000.000000000 WIRE',
        claimed: '250000.000000000 WIRE',
      },
    });
    const wallet = {
      selectedAccount,
      hasTauri: signal(true),
      canSign: signal(true),
      activeChain: signal<any>({
        id: 'wire-id',
        name: 'Wire Testnet',
        symbol: 'WIRE',
        system_contract: 'sysio',
        token_contract: 'sysio.token',
        hyperion_apis: [],
        features: { history: false },
      }),
    };
    const ipc = {
      getTableRows: vi.fn().mockImplementation(async (_chainId: string, params: any) => {
        if (params.table === 'nodeowners') {
          return { rows: [{ owner: 'eosriobrazil', tier: 1 }] };
        }
        return { rows: [] };
      }),
      callReadOnlyAction: vi.fn().mockImplementation(async (_chain: string, _code: string, action: string) => {
        if (action === 'viewnodedist') {
          throw new Error('RPC timeout');
        }
        return {};
      }),
      getAccount: vi.fn().mockResolvedValue(info),
      listPublicKeys: vi.fn().mockResolvedValue(['active-key']),
      getActionsHistory: vi.fn(),
    };

    const view = TestBed.runInInjectionContext(
      () => new BpRewardsComponent(wallet as any, ipc as any, {} as any, {} as any, {} as any),
    );
    await view.refresh();

    expect(view.historyUnavailable()).toBe(true);
    expect(ipc.getActionsHistory).not.toHaveBeenCalled();
    expect(view.wireNodeDist()?.total_allocation).toBe('7500000.000000000 WIRE');
    expect(view.wireNodeDist()?.claimed).toBe('250000.000000000 WIRE');
    expect(view.wireNodeClaimableLoading()).toBe(true);
    expect(view.wireNodeTier()).toBe('T1');
    expect(view.wireLoadError()).toContain('Retry');

    // Only clear when chain explicitly reports account is not a node owner
    ipc.callReadOnlyAction.mockImplementation(async (_chain: string, _code: string, action: string) => {
      if (action === 'viewnodedist') {
        throw new Error('assertion failure with message: account is not a node owner');
      }
      return {};
    });
    await view.refresh();
    expect(view.wireNodeDist()).toBeNull();
    expect(view.wireLoadError()).toBe('');
  });
});
