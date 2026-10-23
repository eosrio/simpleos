import { computed, Injectable, signal } from '@angular/core';
import { AccountInfo, ChainConfig, TauriIpcService } from './tauri-ipc.service';

export type AccountMode = 'full' | 'watch';

export interface TokenBalance {
  contract: string;
  symbol: string;
  amount: string;
}

export interface WireNodeDistTableRow {
  total_allocation: string;
  claimed: string;
  total_duration?: number;
}

export interface WalletAccount {
  name: string;
  chainId: string;
  chainName: string;
  info: AccountInfo;
  /** 'full' = keys imported, can sign. 'watch' = monitoring only, no keys. */
  mode: AccountMode;
  /** Additional token balances beyond the system token. */
  extraBalances?: TokenBalance[];
  /** Whether this account is a registered block producer */
  isProducer?: boolean;
  /** Producer rank (1-based), if a producer */
  producerRank?: number;
  /** Producer URL, if a producer */
  producerUrl?: string;
  /** Whether this account has a Wire `sysio::payclaims` row */
  hasPayclaim?: boolean;
  /** Whether this account is a Wire node owner (`sysio::nodedist` / `sysio.roa::nodeowners`) */
  isNodeOwner?: boolean;
  /** Cached `sysio::nodedist` row (allocation & claimed) for immediate Wire Rewards display */
  wireNodeDistRow?: WireNodeDistTableRow;
  /** Ledger BIP44 key index, if imported from a Ledger device */
  ledgerIndex?: number;
}

const LIBRE_MAINNET_CHAIN_ID = '38b1d7815474d0c60683ecbea321d723e83f5da6ae5f1c1f9fecc69d9ba96465';
const LEGACY_CHAIN_IDS: Record<string, string> = {
  '38b1d7815474d0c60c65a0f23d12e1fc64b8b8d42d0f754b3afe3044e4050eb1': LIBRE_MAINNET_CHAIN_ID,
};

@Injectable({ providedIn: 'root' })
export class WalletStateService {
  readonly locked = signal(true);
  /** Whether a secure vault has been created (keys imported, passphrase set). */
  readonly vaultExists = signal(false);
  /** Current security mode: SessionUnlock | SignPerUse | ManualToggle */
  readonly securityMode = signal<'SessionUnlock' | 'SignPerUse' | 'ManualToggle'>('SessionUnlock');
  readonly accounts = signal<WalletAccount[]>([]);
  readonly selectedIndex = signal<number | null>(null);
  readonly chains = signal<ChainConfig[]>([]);
  readonly activeChainIndex = signal(0);
  readonly loading = signal(false);
  readonly connected = signal(false);
  readonly error = signal('');

  /** Whether Tauri backend is available (false when running in browser only) */
  readonly hasTauri = signal(false);

  readonly selectedAccount = computed(() => {
    const index = this.selectedIndex();
    if (index === null) return null;
    return this.accounts()[index] ?? null;
  });

  readonly hasSelectedAccount = computed(() => this.selectedAccount() !== null);

  /** Whether the currently selected account is a registered block producer */
  readonly isProducer = computed(() => this.selectedAccount()?.isProducer ?? false);

  /** Whether the currently selected account has a Wire `sysio::payclaims` row */
  readonly hasPayclaim = computed(() => this.selectedAccount()?.hasPayclaim ?? false);

  /** Whether the currently selected account is a Wire node owner */
  readonly isNodeOwner = computed(() => this.selectedAccount()?.isNodeOwner ?? false);

  /** Whether the currently selected account has access to the Rewards tab */
  readonly hasRewardsAccess = computed(() => {
    const account = this.selectedAccount();
    if (!account) return false;
    return !!(account.isProducer || account.hasPayclaim || account.isNodeOwner);
  });

  /** Whether the currently selected account can sign transactions (has keys imported) */
  readonly canSign = computed(() => this.selectedAccount()?.mode === 'full');

  /** Whether the currently selected account is watch-only */
  readonly isWatchOnly = computed(() => this.selectedAccount()?.mode === 'watch');

  readonly activeChain = computed(() => {
    const account = this.selectedAccount();
    if (account) {
      return this.chains().find((c) => c.id === account.chainId) ?? this.chains()[0] ?? null;
    }
    return this.chains()[this.activeChainIndex()] ?? null;
  });

  /**
   * Whether the active chain is FIO protocol (mainnet OR testnet).
   * Uses `symbol` rather than `name` because testnets use distinct names
   * like "FIO Testnet" but share the same protocol-level symbol.
   */
  readonly isFio = computed(() => this.activeChain()?.symbol === 'FIO');

  readonly activeEndpoint = computed(() => {
    const chain = this.activeChain();
    return chain?.endpoints[0]?.url ?? '';
  });

  /**
   * Core economic actions wrapped by Vaulta's `core.vaulta` contract (from its
   * ABI). After the EOS→Vaulta rebrand these assert if called on `eosio` and
   * must go to `core.vaulta`. Producer/consensus actions (regproducer,
   * regfinkey, actfinkey, …) are intentionally absent and stay on `eosio`.
   * Routing any of these to `core.vaulta` is always safe — that contract
   * implements them and forwards to the system contract.
   */
  private static readonly SYSTEM_WRAPPED_ACTIONS = new Set<string>([
    'claimrewards',
    'voteproducer',
    'voteupdate',
    'buyram',
    'buyramself',
    'buyrambytes',
    'buyramburn',
    'sellram',
    'ramtransfer',
    'ramburn',
    'giftram',
    'ungiftram',
    'delegatebw',
    'undelegatebw',
    'refund',
    'deposit',
    'withdraw',
    'buyrex',
    'sellrex',
    'mvtosavings',
    'mvfrsavings',
    'unstaketorex',
    'donatetorex',
    'powerup',
    'bidname',
    'bidrefund',
  ]);

  /**
   * Resolve the contract account for a core system action on the active chain.
   * - On `sysio` chains (Wire Network), all system actions live on `sysio`.
   * - On Vaulta (`core.vaulta`), wrapped economic actions route to `core.vaulta`
   *   while consensus/auth actions stay on `eosio`.
   */
  systemAccount(actionName: string): string {
    const sys = this.activeChain()?.system_contract;
    if (sys === 'sysio') {
      return 'sysio';
    }
    if (sys && sys !== 'eosio' && WalletStateService.SYSTEM_WRAPPED_ACTIONS.has(actionName)) {
      return sys;
    }
    return 'eosio';
  }

  /**
   * Base system contract for authority, consensus, and system table queries
   * (`eosio` on Antelope/Vaulta chains, `sysio` on Wire Network chains).
   */
  coreSystemContract(): string {
    return this.activeChain()?.system_contract === 'sysio' ? 'sysio' : 'eosio';
  }

  /**
   * Multisig contract for the active chain (`sysio.msig` on Wire Network, `eosio.msig` otherwise).
   */
  msigContract(): string {
    return this.activeChain()?.system_contract === 'sysio' ? 'sysio.msig' : 'eosio.msig';
  }

  constructor(private ipc: TauriIpcService) {}

  async initialize() {
    try {
      console.log('[wallet] initialize: loading chain configs...');
      let chains;
      try {
        chains = await this.ipc.getChainsConfig();
        console.log(`[wallet] initialize: got ${chains.length} chains`);
      } catch (e) {
        console.error('[wallet] initialize: getChainsConfig FAILED:', e);
        throw e;
      }
      this.chains.set(chains);
      this.hasTauri.set(true);

      console.log('[wallet] initialize: registering providers...');
      await Promise.all(
        chains.map((chain) =>
          this.ipc.initChainProviders(chain.id, chain.endpoints, chain.hyperion_apis),
        ),
      );
      console.log('[wallet] initialize: providers registered');

      try {
        console.log('[wallet] initialize: checking vault...');
        const hasVault = await withTimeout(this.ipc.hasWallet(), 3000, false);
        console.log(`[wallet] initialize: vault exists = ${hasVault}`);
        this.vaultExists.set(hasVault);

        if (hasVault) {
          // Load security mode preference
          const savedMode = await this.ipc.storeGet<string>('securityMode');
          if (savedMode) {
            this.securityMode.set(savedMode as any);
            await this.ipc.setSecurityMode(savedMode);
          }

          const needsLock = await this.ipc.needsLockscreen();
          console.log(`[wallet] initialize: mode=${this.securityMode()}, needsLock=${needsLock}`);
          this.locked.set(needsLock);
        } else {
          this.locked.set(false);
        }
      } catch (e) {
        console.warn('[wallet] initialize: vault check failed:', e);
        this.vaultExists.set(false);
        this.locked.set(false);
      }

      console.log('[wallet] initialize: complete');
    } catch (e) {
      console.warn('[wallet] initialize: Tauri not available, using mock mode', e);
      this.hasTauri.set(false);
      this.locked.set(false);
      this.chains.set(MOCK_CHAINS);
      this.accounts.set(MOCK_ACCOUNTS);
    }
  }

  /** Run health checks for a specific chain and return endpoint states. */
  async checkEndpoints(chainId: string) {
    if (!this.hasTauri()) return;
    try {
      await this.ipc.checkRpcEndpoints(chainId);
      await this.ipc.checkHyperionEndpoints(chainId);
      this.connected.set(true);
    } catch (e: any) {
      this.error.set(e?.toString() ?? 'Connection failed');
      this.connected.set(false);
    }
  }

  /** Add a watch-only account by name. Fetches account data from the chain. */
  async addWatchAccount(accountName: string, chainId: string): Promise<WalletAccount | null> {
    const chain = this.chains().find((c) => c.id === chainId);
    if (!chain) return null;

    this.loading.set(true);
    this.error.set('');

    try {
      // Ensure providers are initialized and checked
      await this.checkEndpoints(chainId);

      // Fetch account info from chain
      const info = await this.ipc.getAccount(chainId, accountName);
      await this.loadPrimaryBalance(chain, accountName, info);

      const account: WalletAccount = {
        name: info.account_name,
        chainId,
        chainName: chain.name,
        mode: 'watch',
        info,
      };

      // Check if this account is a producer / has Wire reward roles
      await this.populateRewardRoles(chain, account);

      // Add to accounts list and persist
      this.accounts.update((list) => [...list, account]);
      await this.saveAccounts();
      return account;
    } catch (e: any) {
      this.error.set(e?.toString() ?? `Account "${accountName}" not found`);
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  /** Refresh a single account's data from the chain. */
  private readonly refreshRequests = new Map<string, number>();
  async refreshAccount(index: number | null) {
    if (index === null) return;

    const account = this.accounts()[index];
    if (!account || !this.hasTauri()) return;
    const identity = `${account.chainId}:${account.name}`;
    const request = (this.refreshRequests.get(identity) ?? 0) + 1;
    this.refreshRequests.set(identity, request);

    try {
      const info = await this.ipc.getAccount(account.chainId, account.name);
      const chain = this.chains().find((c) => c.id === account.chainId);

      if (chain) await this.loadPrimaryBalance(chain, account.name, info);

      const extraBalances = chain ? await this.fetchExtraTokenBalances(chain, account.name) : [];

      const updated: WalletAccount = {
        ...account,
        info,
        extraBalances,
      };
      await this.populateRewardRoles(chain, updated);

      if (this.refreshRequests.get(identity) !== request) return;
      this.accounts.update((list) =>
        list.map((a) =>
          a.name === account.name && a.chainId === account.chainId ? updated : a,
        ),
      );
      await this.saveAccounts();
    } catch (e: any) {
      console.warn(`[wallet] refreshAccount FAILED for ${account.name}:`, e);
    }
  }

  /** Refresh all accounts, starting with the currently selected account. */
  async refreshAllAccounts() {
    const refreshed = new Set<string>();
    const keyOf = (a: WalletAccount) => `${a.chainId}:${a.name}`;

    while (true) {
      const accounts = this.accounts();
      const selIdx = this.selectedIndex();
      let nextIdx = -1;

      if (
        selIdx !== null &&
        selIdx >= 0 &&
        selIdx < accounts.length &&
        !refreshed.has(keyOf(accounts[selIdx]))
      ) {
        nextIdx = selIdx;
      } else {
        nextIdx = accounts.findIndex((a) => !refreshed.has(keyOf(a)));
      }

      if (nextIdx < 0) break;
      refreshed.add(keyOf(accounts[nextIdx]));
      await this.refreshAccount(nextIdx);
    }
  }

  async unlock(passphrase: string): Promise<boolean> {
    if (!this.hasTauri()) {
      this.locked.set(false);
      this.accounts.set(MOCK_ACCOUNTS);
      return true;
    }
    try {
      console.log('[wallet] unlock: calling backend...');
      const result = await this.ipc.unlock(passphrase);
      console.log(`[wallet] unlock: result = ${result}`);
      if (result) {
        this.locked.set(false);
        // Try restoring from local cache first (instant)
        const restored = await this.restoreAccounts();
        if (!restored) {
          console.log('[wallet] unlock: no cached accounts, running full discovery...');
          // Full discovery — may be slow but only happens once (first unlock after import)
          try {
            await withTimeout(this.loadAccounts(), 15000, undefined);
          } catch (e) {
            console.warn('[wallet] unlock: loadAccounts timed out or failed:', e);
          }
        } else {
          // Background refresh — don't block
          console.log('[wallet] unlock: refreshing accounts in background...');
          this.refreshAllAccounts().then(() => this.saveAccounts());
        }
      }
      return result;
    } catch (e) {
      console.warn('[wallet] unlock: failed:', e);
      return false;
    }
  }

  async lock() {
    if (this.hasTauri()) {
      await this.ipc.lock();
    }
    this.locked.set(true);
    this.accounts.set([]);
    this.selectedIndex.set(null);
  }

  async selectChain(index: number) {
    this.activeChainIndex.set(index);
    if (!this.locked() && this.hasTauri()) {
      await this.loadAccounts();
    }
  }

  /** Restore accounts from local store. Instant, no network calls. */
  async restoreAccounts(): Promise<boolean> {
    if (!this.hasTauri()) return false;
    try {
      console.log('[wallet] restoreAccounts: reading from store...');
      const saved = await this.ipc.storeGet<WalletAccount[]>('accounts');
      console.log('[wallet] restoreAccounts: got', saved ? `${saved.length} accounts` : 'null');
      if (saved && saved.length > 0) {
        const previousSelection = this.selectedAccount();
        const normalized = saved.map((account) => this.normalizeStoredAccount(account));
        this.accounts.set(normalized);
        this.restoreSelection(previousSelection, normalized);
        if (
          normalized.some(
            (account, index) =>
              account.chainId !== saved[index]?.chainId ||
              account.chainName !== saved[index]?.chainName,
          )
        ) {
          await this.saveAccounts();
        }
        return true;
      }
    } catch (e) {
      console.warn('[wallet] restoreAccounts failed:', e);
    }
    return false;
  }

  /** Save current accounts to local store. */
  async saveAccounts() {
    if (!this.hasTauri()) return;
    if (typeof (this.ipc as any).storeSet !== 'function') return;
    try {
      const accts = this.accounts();
      console.log(`[wallet] saveAccounts: saving ${accts.length} accounts`);
      await this.ipc.storeSet('accounts', accts);
      console.log('[wallet] saveAccounts: done');
    } catch (e) {
      console.warn('[wallet] saveAccounts failed:', e);
    }
  }

  /** Add an imported account to the visible wallet list, even if live metadata is temporarily unavailable. */
  async addImportedAccount(
    accountName: string,
    chainId: string,
    mode: AccountMode,
    options: { ledgerIndex?: number; hydrate?: boolean } = {},
  ): Promise<WalletAccount | null> {
    const normalizedChainId = this.normalizeChainId(chainId);
    const chain = this.chains().find((c) => c.id === normalizedChainId);
    const name = accountName.trim();
    if (!chain || !name) return null;

    const placeholder: WalletAccount = {
      name,
      chainId: normalizedChainId,
      chainName: chain.name,
      mode,
      info: this.placeholderAccountInfo(name),
      ledgerIndex: options.ledgerIndex,
    };

    this.upsertAccount(placeholder, false);

    if (options.hydrate === false) {
      return (
        this.accounts().find((a) => a.name === name && a.chainId === normalizedChainId) ??
        placeholder
      );
    }

    let info: AccountInfo = this.placeholderAccountInfo(name);
    let extraBalances: TokenBalance[] = [];
    let hasFreshInfo = false;

    try {
      await this.checkEndpoints(normalizedChainId);
      info = await this.ipc.getAccount(normalizedChainId, name);
      hasFreshInfo = true;

      await this.loadPrimaryBalance(chain, name, info);

      extraBalances = await this.fetchExtraTokenBalances(chain, name);
    } catch (e) {
      console.warn(
        `[wallet] Account metadata unavailable for ${name} on ${chain.name}; caching import anyway:`,
        e,
      );
    }

    const account: WalletAccount = {
      name: info.account_name || name,
      chainId: normalizedChainId,
      chainName: chain.name,
      mode,
      info,
      extraBalances,
      ledgerIndex: options.ledgerIndex,
    };

    if (hasFreshInfo) {
      await this.populateRewardRoles(chain, account);
    }

    this.upsertAccount(account, hasFreshInfo);

    return (
      this.accounts().find((a) => a.name === account.name && a.chainId === account.chainId) ??
      account
    );
  }

  /** Full account discovery from chain. Used after import or manual refresh. */
  async loadAccounts() {
    if (!this.hasTauri()) return;

    this.loading.set(true);
    try {
      const previousSelection = this.selectedAccount();
      const allAccounts: WalletAccount[] = [];

      for (const chain of this.chains()) {
        const publicKeys = await this.ipc.listPublicKeys(chain.id);
        if (publicKeys.length === 0) continue;

        for (const pubKey of publicKeys) {
          try {
            const result = await this.ipc.lookupKeyAccounts(chain.id, pubKey);
            for (const name of result.account_names) {
              if (allAccounts.some((a) => a.name === name && a.chainId === chain.id)) continue;
              try {
                const info = await this.ipc.getAccount(chain.id, name);
                await this.loadPrimaryBalance(chain, name, info);
                const extraBalances = await this.fetchExtraTokenBalances(chain, name);
                const acct: WalletAccount = {
                  name,
                  chainId: chain.id,
                  chainName: chain.name,
                  mode: 'full',
                  info,
                  extraBalances,
                };
                await this.populateRewardRoles(chain, acct);
                allAccounts.push(acct);
              } catch (e) {
                console.warn(`[wallet] Failed to load ${name} on ${chain.name}:`, e);
              }
            }
          } catch (e) {
            console.warn(`[wallet] Key lookup failed for ${pubKey} on ${chain.name}:`, e);
          }
        }
      }

      const watchAccounts = this.accounts().filter((a) => a.mode === 'watch');
      const nextAccounts = [...allAccounts, ...watchAccounts];
      this.accounts.set(nextAccounts);
      this.restoreSelection(previousSelection, nextAccounts);

      // Persist to local store
      await this.saveAccounts();
    } finally {
      this.loading.set(false);
    }
  }

  private placeholderAccountInfo(accountName: string): AccountInfo {
    return {
      account_name: accountName,
      permissions: [],
    };
  }

  private normalizeStoredAccount(account: WalletAccount): WalletAccount {
    const chainId = this.normalizeChainId(account.chainId);
    const chain = this.chains().find((c) => c.id === chainId);
    if (chainId === account.chainId && (!chain || chain.name === account.chainName)) return account;
    return {
      ...account,
      chainId,
      chainName: chain?.name ?? account.chainName,
    };
  }

  private normalizeChainId(chainId: string): string {
    return LEGACY_CHAIN_IDS[chainId] ?? chainId;
  }

  private upsertAccount(account: WalletAccount, hasFreshInfo: boolean) {
    this.accounts.update((list) => {
      const index = list.findIndex((a) => a.name === account.name && a.chainId === account.chainId);
      if (index < 0) return [...list, account];

      const existing = list[index];
      const next = [...list];
      next[index] = {
        ...existing,
        ...account,
        mode: existing.mode === 'full' || account.mode === 'full' ? 'full' : 'watch',
        info: hasFreshInfo ? account.info : existing.info,
        extraBalances: hasFreshInfo ? account.extraBalances : existing.extraBalances,
        isProducer: account.isProducer ?? existing.isProducer,
        producerRank: account.producerRank ?? existing.producerRank,
        producerUrl: account.producerUrl ?? existing.producerUrl,
        hasPayclaim: account.hasPayclaim ?? existing.hasPayclaim,
        isNodeOwner: account.isNodeOwner ?? existing.isNodeOwner,
        wireNodeDistRow: account.wireNodeDistRow ?? existing.wireNodeDistRow,
        ledgerIndex: account.ledgerIndex ?? existing.ledgerIndex,
      };
      return next;
    });
  }

  private async populateRewardRoles(chain: ChainConfig | undefined, account: WalletAccount) {
    let isProducer = account.isProducer ?? false;
    let producerRank: number | undefined = account.producerRank;
    let producerUrl = account.producerUrl;
    let hasPayclaim = account.hasPayclaim ?? false;
    let isNodeOwner = account.isNodeOwner ?? false;
    let wireNodeDistRow = account.wireNodeDistRow;

    if (chain?.system_contract === 'sysio') {
      const [prodRow, payclaimRow, nodedistRow] = await Promise.allSettled([
        this.ipc.getTableRows(account.chainId, {
          code: 'sysio',
          scope: 'sysio',
          table: 'producers',
          lower_bound: account.name,
          upper_bound: account.name,
          limit: 1,
          json: true,
        }),
        this.ipc.getTableRows(account.chainId, {
          code: 'sysio',
          scope: 'sysio',
          table: 'payclaims',
          lower_bound: account.name,
          upper_bound: account.name,
          limit: 1,
          json: true,
        }),
        this.ipc.getTableRows(account.chainId, {
          code: 'sysio',
          scope: 'sysio',
          table: 'nodedist',
          lower_bound: account.name,
          upper_bound: account.name,
          limit: 1,
          json: true,
        }),
      ]);

      if (prodRow.status === 'fulfilled' && Array.isArray(prodRow.value?.rows)) {
        const prow = prodRow.value.rows[0];
        if (prow?.owner === account.name) {
          isProducer = true;
          producerUrl = prow.url ?? producerUrl;
        } else {
          isProducer = false;
        }
      }
      if (payclaimRow.status === 'fulfilled' && Array.isArray(payclaimRow.value?.rows)) {
        hasPayclaim = payclaimRow.value.rows[0]?.account_name === account.name;
      }
      if (nodedistRow.status === 'fulfilled' && Array.isArray(nodedistRow.value?.rows)) {
        const nrow = nodedistRow.value.rows[0];
        if (nrow?.account_name === account.name) {
          isNodeOwner = true;
          if (typeof nrow.total_allocation === 'string' && typeof nrow.claimed === 'string') {
            wireNodeDistRow = {
              total_allocation: nrow.total_allocation,
              claimed: nrow.claimed,
              total_duration:
                nrow.total_duration !== undefined ? Number(nrow.total_duration) : undefined,
            };
          }
        } else {
          try {
            const roaRes = await this.ipc.getTableRows(account.chainId, {
              code: 'sysio.roa',
              scope: '0',
              table: 'nodeowners',
              lower_bound: account.name,
              upper_bound: account.name,
              limit: 1,
              json: true,
            });
            isNodeOwner = roaRes?.rows?.[0]?.owner === account.name;
            if (!isNodeOwner) wireNodeDistRow = undefined;
          } catch {
            // ignore if sysio.roa is absent
          }
        }
      }
    } else {
      try {
        const producers = await this.ipc.getProducers(account.chainId, 200);
        const bpList = producers?.rows ?? producers?.producers ?? [];
        const bp = bpList.find((r: any) => r.owner === account.name);
        if (bp) {
          isProducer = true;
          producerUrl = bp.url;
          const sorted = bpList
            .filter((r: any) => r.is_active === 1 || r.is_active === true)
            .sort(
              (a: any, b: any) =>
                parseFloat(b.total_votes ?? b.rank_score ?? '0') -
                parseFloat(a.total_votes ?? a.rank_score ?? '0'),
            );
          const rank = sorted.findIndex((r: any) => r.owner === account.name);
          if (rank >= 0) producerRank = rank + 1;
        } else {
          isProducer = false;
          producerRank = undefined;
        }
      } catch (e) {
        isProducer = account.isProducer ?? false;
        producerRank = account.producerRank;
        console.warn(`[wallet] producer check failed for ${account.name}@${account.chainName}:`, e);
      }
    }

    account.isProducer = isProducer;
    account.producerRank = producerRank;
    account.producerUrl = producerUrl;
    account.hasPayclaim = hasPayclaim;
    account.isNodeOwner = isNodeOwner;
    account.wireNodeDistRow = wireNodeDistRow;
  }

  async setSecurityMode(mode: 'SessionUnlock' | 'SignPerUse' | 'ManualToggle') {
    this.securityMode.set(mode);
    if (this.hasTauri()) {
      await this.ipc.setSecurityMode(mode);
      await this.ipc.storeSet('securityMode', mode);
      // Update lock state based on new mode
      if (mode === 'SignPerUse') {
        this.locked.set(false); // Don't show lockscreen, but signing will prompt
      }
    }
  }

  /** Account RPCs may omit liquid balances even for eosio.token (notably XPR). */
  private async loadPrimaryBalance(chain: ChainConfig, name: string, info: AccountInfo) {
    const balanceSymbol = info.core_liquid_balance?.trim().split(/\s+/)[1];
    if (chain.token_contract === 'eosio.token' && balanceSymbol === chain.symbol) return;
    try {
      const balances = await this.ipc.getBalances(chain.id, name, chain.token_contract, chain.symbol);
      info.core_liquid_balance = balances[0] ?? `${(0).toFixed(chain.precision)} ${chain.symbol}`;
    } catch (error) {
      console.warn(`[wallet] Primary balance unavailable for ${name} on ${chain.name}:`, error);
    }
  }

  /** Fetch extra token balances for a chain's configured extra_tokens. */
  async fetchExtraTokenBalances(
    chain: import('./tauri-ipc.service').ChainConfig,
    accountName: string,
  ): Promise<TokenBalance[]> {
    const balances: TokenBalance[] = [];
    const tokens = chain.extra_tokens ?? [];
    console.log(
      `[wallet] fetchExtraTokenBalances: ${chain.name} has ${tokens.length} extra tokens for ${accountName}`,
    );
    for (const token of tokens) {
      try {
        console.log(`[wallet] fetching ${token.symbol} from ${token.contract}...`);
        const result = await this.ipc.getBalances(
          chain.id,
          accountName,
          token.contract,
          token.symbol,
        );
        console.log(`[wallet] ${token.symbol} result:`, result);
        if (result.length > 0) {
          balances.push({ contract: token.contract, symbol: token.symbol, amount: result[0] });
        }
      } catch (e) {
        console.warn(`[wallet] Failed to fetch ${token.symbol}:`, e);
      }
    }
    return balances;
  }

  selectAccount(index: number) {
    if (index < 0 || index >= this.accounts().length) {
      this.selectedIndex.set(null);
      return;
    }
    this.selectedIndex.set(index);
    const acct = this.accounts()[index];
    if (
      acct &&
      this.hasTauri() &&
      acct.isProducer === undefined &&
      acct.hasPayclaim === undefined &&
      acct.isNodeOwner === undefined
    ) {
      void this.refreshAccount(index);
    }
  }

  clearSelectedAccount() {
    this.selectedIndex.set(null);
  }

  /** Move an account tab from one position to another, preserving the selected account. */
  reorderAccount(fromIndex: number, toIndex: number) {
    const list = [...this.accounts()];
    if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) return;

    const selectedAccount = this.selectedAccount();
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    this.accounts.set(list);

    // Keep the same account selected after reorder
    if (!selectedAccount) {
      this.selectedIndex.set(null);
    } else {
      const newSelectedIndex = list.findIndex(
        (account) =>
          account.chainId === selectedAccount.chainId && account.name === selectedAccount.name,
      );
      this.selectedIndex.set(newSelectedIndex >= 0 ? newSelectedIndex : null);
    }

    this.saveAccounts();
  }

  /** Remove an account from the list. */
  removeAccount(index: number) {
    const selectedAccount = this.selectedAccount();
    const currentIndex = this.selectedIndex();
    this.accounts.update((list) => list.filter((_, i) => i !== index));

    if (currentIndex === null || !selectedAccount) {
      this.selectedIndex.set(null);
      return;
    }

    if (currentIndex === index) {
      this.selectedIndex.set(null);
      return;
    }

    const nextIndex = this.accounts().findIndex(
      (account) =>
        account.chainId === selectedAccount.chainId && account.name === selectedAccount.name,
    );
    this.selectedIndex.set(nextIndex >= 0 ? nextIndex : null);
  }

  private restoreSelection(selectedAccount: WalletAccount | null, accounts: WalletAccount[]) {
    if (!selectedAccount) {
      this.selectedIndex.set(null);
      return;
    }

    const nextIndex = accounts.findIndex(
      (account) =>
        account.chainId === selectedAccount.chainId && account.name === selectedAccount.name,
    );
    this.selectedIndex.set(nextIndex >= 0 ? nextIndex : null);
  }
}

// ── Mock accounts for design testing (when Tauri backend is not available) ──

const MOCK_CHAINS: ChainConfig[] = [
  {
    id: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
    name: 'Vaulta',
    symbol: 'A',
    precision: 4,
    token_contract: 'core.vaulta',
    system_contract: 'core.vaulta',
    extra_tokens: [{ contract: 'eosio.token', symbol: 'EOS', precision: 4 }],
    endpoints: [],
    hyperion_apis: [],
    explorers: [
      {
        name: 'Vaultascan',
        url: 'https://eosscan.io',
        tx_url: 'https://eosscan.io/transaction/{txid}',
        account_url: 'https://eosscan.io/account/{account}',
      },
      {
        name: 'EOS Authority',
        url: 'https://eosauthority.com',
        tx_url: 'https://eosauthority.com/transaction/{txid}?network=eos',
        account_url: 'https://eosauthority.com/account/{account}?network=eos',
      },
      {
        name: 'Bloks.io',
        url: 'https://bloks.io',
        tx_url: 'https://bloks.io/transaction/{txid}',
        account_url: 'https://bloks.io/account/{account}',
      },
    ],
    features: {
      send: true,
      vote: true,
      staking: true,
      rex: true,
      powerup: true,
      resource: true,
      dapps: true,
      history: true,
    },
  },
  {
    id: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
    name: 'WAX',
    symbol: 'WAX',
    precision: 8,
    token_contract: 'eosio.token',
    extra_tokens: [],
    endpoints: [],
    hyperion_apis: [],
    explorers: [
      {
        name: 'WaxBlock',
        url: 'https://waxblock.io',
        tx_url: 'https://waxblock.io/transaction/{txid}',
        account_url: 'https://waxblock.io/account/{account}',
      },
      {
        name: 'Bloks.io',
        url: 'https://wax.bloks.io',
        tx_url: 'https://wax.bloks.io/transaction/{txid}',
        account_url: 'https://wax.bloks.io/account/{account}',
      },
    ],
    features: {
      send: true,
      vote: true,
      staking: true,
      rex: false,
      powerup: true,
      resource: true,
      dapps: true,
      history: true,
    },
  },
  {
    id: '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11',
    name: 'Telos',
    symbol: 'TLOS',
    precision: 4,
    token_contract: 'eosio.token',
    extra_tokens: [],
    endpoints: [],
    hyperion_apis: [],
    explorers: [
      {
        name: 'Telos Explorer',
        url: 'https://explorer.telos.net',
        tx_url: 'https://explorer.telos.net/transaction/{txid}',
        account_url: 'https://explorer.telos.net/account/{account}',
      },
    ],
    features: {
      send: true,
      vote: true,
      staking: true,
      rex: true,
      powerup: true,
      resource: true,
      dapps: true,
      history: true,
    },
  },
  {
    id: 'ultra-chain-id',
    name: 'Ultra',
    symbol: 'UOS',
    precision: 4,
    token_contract: 'eosio.token',
    extra_tokens: [],
    endpoints: [],
    hyperion_apis: [],
    explorers: [
      {
        name: 'Ultra Explorer',
        url: 'https://explorer.mainnet.ultra.io',
        tx_url: 'https://explorer.mainnet.ultra.io/tx/{txid}',
        account_url: 'https://explorer.mainnet.ultra.io/account/{account}',
      },
    ],
    features: {
      send: true,
      vote: true,
      staking: true,
      rex: false,
      powerup: false,
      resource: true,
      dapps: false,
      history: true,
    },
  },
  {
    id: 'fio-chain-id',
    name: 'FIO',
    symbol: 'FIO',
    precision: 9,
    token_contract: 'fio.token',
    extra_tokens: [],
    endpoints: [],
    hyperion_apis: [],
    explorers: [
      {
        name: 'FIO Explorer',
        url: 'https://fio.bloks.io',
        tx_url: 'https://fio.bloks.io/transaction/{txid}',
        account_url: 'https://fio.bloks.io/account/{account}',
      },
    ],
    features: {
      send: true,
      vote: true,
      staking: false,
      rex: false,
      powerup: false,
      resource: false,
      dapps: false,
      history: true,
    },
  },
  {
    id: LIBRE_MAINNET_CHAIN_ID,
    name: 'Libre',
    symbol: 'LIBRE',
    precision: 4,
    token_contract: 'eosio.token',
    extra_tokens: [],
    endpoints: [],
    hyperion_apis: [],
    explorers: [
      {
        name: 'Libre Blocks',
        url: 'https://www.libreblocks.io',
        tx_url: 'https://www.libreblocks.io/tx/{txid}',
        account_url: 'https://www.libreblocks.io/address/{account}',
      },
    ],
    features: {
      send: true,
      vote: true,
      staking: true,
      rex: false,
      powerup: false,
      resource: true,
      dapps: false,
      history: true,
    },
  },
  {
    id: 'xpr-chain-id',
    name: 'XPR',
    symbol: 'XPR',
    precision: 4,
    token_contract: 'eosio.token',
    extra_tokens: [],
    endpoints: [],
    hyperion_apis: [],
    explorers: [
      {
        name: 'XPR Explorer',
        url: 'https://explorer.xprnetwork.org',
        tx_url: 'https://explorer.xprnetwork.org/transaction/{txid}',
        account_url: 'https://explorer.xprnetwork.org/account/{account}',
      },
    ],
    features: {
      send: true,
      vote: true,
      staking: true,
      rex: false,
      powerup: false,
      resource: true,
      dapps: false,
      history: true,
    },
  },
  // Testnets
  {
    id: 'jungle4-testnet-id',
    name: 'Jungle Testnet',
    symbol: 'EOS',
    precision: 4,
    token_contract: 'eosio.token',
    extra_tokens: [],
    endpoints: [],
    hyperion_apis: [],
    explorers: [
      {
        name: 'Jungle Bloks',
        url: 'https://jungle4.bloks.io',
        tx_url: 'https://jungle4.bloks.io/transaction/{txid}',
        account_url: 'https://jungle4.bloks.io/account/{account}',
      },
    ],
    features: {
      send: true,
      vote: true,
      staking: true,
      rex: true,
      powerup: true,
      resource: true,
      dapps: false,
      history: true,
    },
    testnet: true,
  },
  {
    id: 'wax-testnet-id',
    name: 'WAX Testnet',
    symbol: 'WAX',
    precision: 8,
    token_contract: 'eosio.token',
    extra_tokens: [],
    endpoints: [],
    hyperion_apis: [],
    explorers: [],
    features: {
      send: true,
      vote: true,
      staking: true,
      rex: false,
      powerup: true,
      resource: true,
      dapps: false,
      history: false,
    },
    testnet: true,
  },
  {
    id: 'telos-testnet-id',
    name: 'Telos Testnet',
    symbol: 'TLOS',
    precision: 4,
    token_contract: 'eosio.token',
    extra_tokens: [],
    endpoints: [],
    hyperion_apis: [],
    explorers: [],
    features: {
      send: true,
      vote: true,
      staking: true,
      rex: true,
      powerup: true,
      resource: true,
      dapps: false,
      history: false,
    },
    testnet: true,
  },
  {
    id: '9ccd94e823fda51363bd4265ad618a909c4985c445078c79f8d030fe9697b71d',
    name: 'Wire Testnet',
    symbol: 'WIRE',
    precision: 9,
    token_contract: 'sysio.token',
    system_contract: 'sysio',
    extra_tokens: [{ contract: 'sysio.token', symbol: 'SYS', precision: 4 }],
    endpoints: [{ url: 'https://testnet.wire.eosrio.io' }],
    hyperion_apis: [],
    explorers: [],
    features: {
      send: true,
      vote: true,
      staking: false,
      rex: false,
      powerup: false,
      resource: true,
      dapps: false,
      history: false,
    },
    testnet: true,
  },
];

const MOCK_ACCOUNTS: WalletAccount[] = [
  {
    name: 'alice.gm',
    chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
    chainName: 'Vaulta',
    mode: 'full',
    info: {
      account_name: 'alice.gm',
      core_liquid_balance: '12,847.3291 A',
      ram_quota: 177000,
      ram_usage: 127400,
      net_weight: 21000000,
      cpu_weight: 21000000,
      // ~72% RAM, high CPU — surfaces on resource health panel
      cpu_limit: { used: 176_000, available: 24_000, max: 200_000 },
      net_limit: { used: 120_000, available: 880_000, max: 1_000_000 },
      permissions: [],
    },
  },
  {
    name: 'alicewallet1',
    chainId: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
    chainName: 'WAX',
    mode: 'full',
    info: {
      account_name: 'alicewallet1',
      core_liquid_balance: '3,250.00000000 WAX',
      ram_quota: 65000,
      ram_usage: 42300,
      net_weight: 5000000,
      cpu_weight: 15000000,
      cpu_limit: { used: 40_000, available: 160_000, max: 200_000 },
      net_limit: { used: 50_000, available: 450_000, max: 500_000 },
      permissions: [],
    },
  },
  {
    name: 'alice.tlos',
    chainId: '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11',
    chainName: 'Telos',
    mode: 'full',
    info: {
      account_name: 'alice.tlos',
      core_liquid_balance: '890.4200 TLOS',
      ram_quota: 32000,
      ram_usage: 8900,
      net_weight: 2000000,
      cpu_weight: 8000000,
      cpu_limit: { used: 12_000, available: 188_000, max: 200_000 },
      net_limit: { used: 8_000, available: 492_000, max: 500_000 },
      permissions: [],
    },
  },
  {
    name: 'alice.ultra',
    chainId: 'ultra-chain-id',
    chainName: 'Ultra',
    mode: 'full',
    info: {
      account_name: 'alice.ultra',
      core_liquid_balance: '156.0000 UOS',
      ram_quota: 48000,
      ram_usage: 12000,
      net_weight: 1000000,
      cpu_weight: 3000000,
      cpu_limit: { used: 5_000, available: 95_000, max: 100_000 },
      net_limit: { used: 3_000, available: 97_000, max: 100_000 },
      permissions: [],
    },
  },
  {
    name: 'alice@fio',
    chainId: 'fio-chain-id',
    chainName: 'FIO',
    mode: 'full',
    info: {
      account_name: 'alice@fio',
      core_liquid_balance: '2,100.000000000 FIO',
      ram_quota: 100000,
      ram_usage: 34000,
      net_weight: 0,
      cpu_weight: 0,
      permissions: [],
    },
  },
  {
    name: 'bob.gm',
    chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
    chainName: 'Vaulta',
    mode: 'full',
    isProducer: true,
    producerRank: 14,
    producerUrl: 'https://eosrio.io',
    info: {
      account_name: 'bob.gm',
      core_liquid_balance: '45,891.2030 A',
      ram_quota: 524000,
      ram_usage: 389000,
      net_weight: 150000000,
      cpu_weight: 350000000,
      // healthy CPU/NET; RAM ~74% warning
      cpu_limit: { used: 45_000, available: 955_000, max: 1_000_000 },
      net_limit: { used: 80_000, available: 1_920_000, max: 2_000_000 },
      permissions: [],
      voter_info: { is_proxy: 0, producers: [], staked: 500000000 },
    },
  },
  {
    name: 'carol.gm',
    chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
    chainName: 'Vaulta',
    mode: 'watch',
    info: {
      account_name: 'carol.gm',
      core_liquid_balance: '0.0000 A',
      ram_quota: 14822140,
      ram_usage: 6878028,
      net_weight: 0,
      cpu_weight: 0,
      cpu_limit: { used: 0, available: 1, max: 1 },
      net_limit: { used: 0, available: 1, max: 1 },
      permissions: [],
    },
  },
];

/** Race a promise against a timeout. Returns fallback if the promise doesn't resolve in time. */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}
