import { computed, Injectable, signal } from '@angular/core';
import { AccountInfo, ChainConfig, TauriIpcService } from './tauri-ipc.service';

export type AccountMode = 'full' | 'watch';

export interface TokenBalance {
  contract: string;
  symbol: string;
  amount: string;
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
  /** Ledger BIP44 key index, if imported from a Ledger device */
  ledgerIndex?: number;
}

@Injectable({ providedIn: 'root' })
export class WalletStateService {

  readonly locked = signal(true);
  /** Whether a secure vault has been created (keys imported, passphrase set). */
  readonly vaultExists = signal(false);
  /** Current security mode: SessionUnlock | SignPerUse | ManualToggle */
  readonly securityMode = signal<'SessionUnlock' | 'SignPerUse' | 'ManualToggle'>('SessionUnlock');
  readonly accounts = signal<WalletAccount[]>([]);
  readonly selectedIndex = signal(0);
  readonly chains = signal<ChainConfig[]>([]);
  readonly activeChainIndex = signal(0);
  readonly loading = signal(false);
  readonly connected = signal(false);
  readonly error = signal('');

  /** Whether Tauri backend is available (false when running in browser only) */
  readonly hasTauri = signal(false);

  readonly selectedAccount = computed(() => this.accounts()[this.selectedIndex()]);

  /** Whether the currently selected account is a registered block producer */
  readonly isProducer = computed(() => this.selectedAccount()?.isProducer ?? false);

  /** Whether the currently selected account can sign transactions (has keys imported) */
  readonly canSign = computed(() => this.selectedAccount()?.mode === 'full');

  /** Whether the currently selected account is watch-only */
  readonly isWatchOnly = computed(() => this.selectedAccount()?.mode === 'watch');

  readonly activeChain = computed(() => {
    const account = this.selectedAccount();
    if (account) {
      return this.chains().find(c => c.id === account.chainId) ?? this.chains()[0] ?? null;
    }
    return this.chains()[this.activeChainIndex()] ?? null;
  });

  readonly activeEndpoint = computed(() => {
    const chain = this.activeChain();
    return chain?.endpoints[0]?.url ?? '';
  });

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
        chains.map(chain =>
          this.ipc.initChainProviders(chain.id, chain.endpoints, chain.hyperion_apis)
        )
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
    const chain = this.chains().find(c => c.id === chainId);
    if (!chain) return null;

    this.loading.set(true);
    this.error.set('');

    try {
      // Ensure providers are initialized and checked
      await this.checkEndpoints(chainId);

      // Fetch account info from chain
      const info = await this.ipc.getAccount(chainId, accountName);

      const account: WalletAccount = {
        name: info.account_name,
        chainId,
        chainName: chain.name,
        mode: 'watch',
        info,
      };

      // Check if this account is a producer
      try {
        const producers = await this.ipc.getProducers(chainId, 200);
        if (producers?.rows) {
          const bp = producers.rows.find((r: any) => r.owner === accountName);
          if (bp) {
            account.isProducer = true;
            account.producerUrl = bp.url;
            // Find rank
            const sorted = producers.rows
              .filter((r: any) => r.is_active === 1)
              .sort((a: any, b: any) => parseFloat(b.total_votes) - parseFloat(a.total_votes));
            const rank = sorted.findIndex((r: any) => r.owner === accountName);
            if (rank >= 0) account.producerRank = rank + 1;
          }
        }
      } catch {
        // Producer check is non-critical
      }

      // Add to accounts list and persist
      this.accounts.update(list => [...list, account]);
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
  async refreshAccount(index: number) {
    const account = this.accounts()[index];
    if (!account || !this.hasTauri()) return;

    try {
      const info = await this.ipc.getAccount(account.chainId, account.name);
      const chain = this.chains().find(c => c.id === account.chainId);

      // Fetch primary token balance from the chain's token contract
      if (chain && chain.token_contract !== 'eosio.token') {
        try {
          const bal = await this.ipc.getBalances(chain.id, account.name, chain.token_contract, chain.symbol);
          if (bal.length > 0) {
            info.core_liquid_balance = bal[0];
          }
        } catch { /* keep whatever get_account returned */ }
      }

      const extraBalances = chain ? await this.fetchExtraTokenBalances(chain, account.name) : [];
      this.accounts.update(list =>
        list.map((a, i) => i === index ? { ...a, info, extraBalances } : a)
      );
    } catch (e: any) {
      console.warn(`[wallet] refreshAccount FAILED for ${account.name}:`, e);
    }
  }

  /** Refresh all accounts. */
  async refreshAllAccounts() {
    const accounts = this.accounts();
    for (let i = 0; i < accounts.length; i++) {
      await this.refreshAccount(i);
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
        this.accounts.set(saved);
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
    try {
      const accts = this.accounts();
      console.log(`[wallet] saveAccounts: saving ${accts.length} accounts`);
      await this.ipc.storeSet('accounts', accts);
      console.log('[wallet] saveAccounts: done');
    } catch (e) {
      console.warn('[wallet] saveAccounts failed:', e);
    }
  }

  /** Full account discovery from chain. Used after import or manual refresh. */
  async loadAccounts() {
    if (!this.hasTauri()) return;

    this.loading.set(true);
    try {
      const allAccounts: WalletAccount[] = [];

      for (const chain of this.chains()) {
        const publicKeys = await this.ipc.listPublicKeys(chain.id);
        if (publicKeys.length === 0) continue;

        for (const pubKey of publicKeys) {
          try {
            const result = await this.ipc.lookupKeyAccounts(chain.id, pubKey);
            for (const name of result.account_names) {
              if (allAccounts.some(a => a.name === name && a.chainId === chain.id)) continue;
              try {
                const info = await this.ipc.getAccount(chain.id, name);
                // Override core_liquid_balance with the chain's primary token if needed
                if (chain.token_contract !== 'eosio.token') {
                  try {
                    const bal = await this.ipc.getBalances(chain.id, name, chain.token_contract, chain.symbol);
                    if (bal.length > 0) info.core_liquid_balance = bal[0];
                  } catch { /* keep get_account default */ }
                }
                const extraBalances = await this.fetchExtraTokenBalances(chain, name);
                allAccounts.push({
                  name, chainId: chain.id, chainName: chain.name, mode: 'full', info, extraBalances,
                });
              } catch (e) {
                console.warn(`[wallet] Failed to load ${name} on ${chain.name}:`, e);
              }
            }
          } catch (e) {
            console.warn(`[wallet] Key lookup failed for ${pubKey} on ${chain.name}:`, e);
          }
        }
      }

      const watchAccounts = this.accounts().filter(a => a.mode === 'watch');
      this.accounts.set([...allAccounts, ...watchAccounts]);

      // Persist to local store
      await this.saveAccounts();
    } finally {
      this.loading.set(false);
    }
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

  /** Fetch extra token balances for a chain's configured extra_tokens. */
  async fetchExtraTokenBalances(chain: import('./tauri-ipc.service').ChainConfig, accountName: string): Promise<TokenBalance[]> {
    const balances: TokenBalance[] = [];
    const tokens = chain.extra_tokens ?? [];
    console.log(`[wallet] fetchExtraTokenBalances: ${chain.name} has ${tokens.length} extra tokens for ${accountName}`);
    for (const token of tokens) {
      try {
        console.log(`[wallet] fetching ${token.symbol} from ${token.contract}...`);
        const result = await this.ipc.getBalances(chain.id, accountName, token.contract, token.symbol);
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
    this.selectedIndex.set(index);
  }

  /** Move an account tab from one position to another, preserving the selected account. */
  reorderAccount(fromIndex: number, toIndex: number) {
    const list = [...this.accounts()];
    if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) return;

    const selectedAccount = list[this.selectedIndex()];
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    this.accounts.set(list);

    // Keep the same account selected after reorder
    const newSelectedIndex = list.indexOf(selectedAccount);
    if (newSelectedIndex >= 0) this.selectedIndex.set(newSelectedIndex);

    this.saveAccounts();
  }

  /** Remove an account from the list. */
  removeAccount(index: number) {
    this.accounts.update(list => list.filter((_, i) => i !== index));
    if (this.selectedIndex() >= this.accounts().length) {
      this.selectedIndex.set(Math.max(0, this.accounts().length - 1));
    }
  }
}

// ── Mock accounts for design testing (when Tauri backend is not available) ──

const MOCK_CHAINS: ChainConfig[] = [
  { id: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906', name: 'Vaulta', symbol: 'A', precision: 4, token_contract: 'core.vaulta', extra_tokens: [{ contract: 'eosio.token', symbol: 'EOS', precision: 4 }], endpoints: [], hyperion_apis: [], explorers: [{ name: 'Vaultascan', url: 'https://eosscan.io', tx_url: 'https://eosscan.io/transaction/{txid}', account_url: 'https://eosscan.io/account/{account}' }, { name: 'EOS Authority', url: 'https://eosauthority.com', tx_url: 'https://eosauthority.com/transaction/{txid}?network=eos', account_url: 'https://eosauthority.com/account/{account}?network=eos' }, { name: 'Bloks.io', url: 'https://bloks.io', tx_url: 'https://bloks.io/transaction/{txid}', account_url: 'https://bloks.io/account/{account}' }], features: { send: true, vote: true, staking: true, rex: true, powerup: true, resource: true, dapps: true, history: true } },
  { id: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4', name: 'WAX', symbol: 'WAX', precision: 8, token_contract: 'eosio.token', extra_tokens: [], endpoints: [], hyperion_apis: [], explorers: [{ name: 'WaxBlock', url: 'https://waxblock.io', tx_url: 'https://waxblock.io/transaction/{txid}', account_url: 'https://waxblock.io/account/{account}' }, { name: 'Bloks.io', url: 'https://wax.bloks.io', tx_url: 'https://wax.bloks.io/transaction/{txid}', account_url: 'https://wax.bloks.io/account/{account}' }], features: { send: true, vote: true, staking: true, rex: false, powerup: true, resource: true, dapps: true, history: true } },
  { id: '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11', name: 'Telos', symbol: 'TLOS', precision: 4, token_contract: 'eosio.token', extra_tokens: [], endpoints: [], hyperion_apis: [], explorers: [{ name: 'Telos Explorer', url: 'https://explorer.telos.net', tx_url: 'https://explorer.telos.net/transaction/{txid}', account_url: 'https://explorer.telos.net/account/{account}' }], features: { send: true, vote: true, staking: true, rex: true, powerup: true, resource: true, dapps: true, history: true } },
  { id: 'ultra-chain-id', name: 'Ultra', symbol: 'UOS', precision: 4, token_contract: 'eosio.token', extra_tokens: [], endpoints: [], hyperion_apis: [], explorers: [{ name: 'Ultra Explorer', url: 'https://explorer.mainnet.ultra.io', tx_url: 'https://explorer.mainnet.ultra.io/tx/{txid}', account_url: 'https://explorer.mainnet.ultra.io/account/{account}' }], features: { send: true, vote: true, staking: true, rex: false, powerup: false, resource: true, dapps: false, history: true } },
  { id: 'fio-chain-id', name: 'FIO', symbol: 'FIO', precision: 9, token_contract: 'fio.token', extra_tokens: [], endpoints: [], hyperion_apis: [], explorers: [{ name: 'FIO Explorer', url: 'https://fio.bloks.io', tx_url: 'https://fio.bloks.io/transaction/{txid}', account_url: 'https://fio.bloks.io/account/{account}' }], features: { send: true, vote: true, staking: false, rex: false, powerup: false, resource: false, dapps: false, history: true } },
  { id: 'libre-chain-id', name: 'Libre', symbol: 'LIBRE', precision: 4, token_contract: 'eosio.token', extra_tokens: [], endpoints: [], hyperion_apis: [], explorers: [{ name: 'Libre Blocks', url: 'https://www.libreblocks.io', tx_url: 'https://www.libreblocks.io/tx/{txid}', account_url: 'https://www.libreblocks.io/address/{account}' }], features: { send: true, vote: true, staking: true, rex: false, powerup: false, resource: true, dapps: false, history: true } },
  { id: 'xpr-chain-id', name: 'XPR', symbol: 'XPR', precision: 4, token_contract: 'eosio.token', extra_tokens: [], endpoints: [], hyperion_apis: [], explorers: [{ name: 'XPR Explorer', url: 'https://explorer.xprnetwork.org', tx_url: 'https://explorer.xprnetwork.org/transaction/{txid}', account_url: 'https://explorer.xprnetwork.org/account/{account}' }], features: { send: true, vote: true, staking: true, rex: false, powerup: false, resource: true, dapps: false, history: true } },
  // Testnets
  { id: 'jungle4-testnet-id', name: 'Jungle Testnet', symbol: 'EOS', precision: 4, token_contract: 'eosio.token', extra_tokens: [], endpoints: [], hyperion_apis: [], explorers: [{ name: 'Jungle Bloks', url: 'https://jungle4.bloks.io', tx_url: 'https://jungle4.bloks.io/transaction/{txid}', account_url: 'https://jungle4.bloks.io/account/{account}' }], features: { send: true, vote: true, staking: true, rex: true, powerup: true, resource: true, dapps: false, history: true }, testnet: true },
  { id: 'wax-testnet-id', name: 'WAX Testnet', symbol: 'WAX', precision: 8, token_contract: 'eosio.token', extra_tokens: [], endpoints: [], hyperion_apis: [], explorers: [], features: { send: true, vote: true, staking: true, rex: false, powerup: true, resource: true, dapps: false, history: false }, testnet: true },
  { id: 'telos-testnet-id', name: 'Telos Testnet', symbol: 'TLOS', precision: 4, token_contract: 'eosio.token', extra_tokens: [], endpoints: [], hyperion_apis: [], explorers: [], features: { send: true, vote: true, staking: true, rex: true, powerup: true, resource: true, dapps: false, history: false }, testnet: true },
];

const MOCK_ACCOUNTS: WalletAccount[] = [
  {
    name: 'igorls.gm',
    chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
    chainName: 'Vaulta',
    mode: 'full',
    info: {
      account_name: 'igorls.gm',
      core_liquid_balance: '12,847.3291 A',
      ram_quota: 177000, ram_usage: 127400,
      net_weight: 21000000, cpu_weight: 21000000,
      permissions: [],
    },
  },
  {
    name: 'igor.wax',
    chainId: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
    chainName: 'WAX',
    mode: 'full',
    info: {
      account_name: 'igor.wax',
      core_liquid_balance: '3,250.00000000 WAX',
      ram_quota: 65000, ram_usage: 42300,
      net_weight: 5000000, cpu_weight: 15000000,
      permissions: [],
    },
  },
  {
    name: 'igorls.tlos',
    chainId: '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11',
    chainName: 'Telos',
    mode: 'full',
    info: {
      account_name: 'igorls.tlos',
      core_liquid_balance: '890.4200 TLOS',
      ram_quota: 32000, ram_usage: 8900,
      net_weight: 2000000, cpu_weight: 8000000,
      permissions: [],
    },
  },
  {
    name: 'igorls.ultra',
    chainId: 'ultra-chain-id',
    chainName: 'Ultra',
    mode: 'full',
    info: {
      account_name: 'igorls.ultra',
      core_liquid_balance: '156.0000 UOS',
      ram_quota: 48000, ram_usage: 12000,
      net_weight: 1000000, cpu_weight: 3000000,
      permissions: [],
    },
  },
  {
    name: 'igor@fio',
    chainId: 'fio-chain-id',
    chainName: 'FIO',
    mode: 'full',
    info: {
      account_name: 'igor@fio',
      core_liquid_balance: '2,100.000000000 FIO',
      ram_quota: 100000, ram_usage: 34000,
      net_weight: 0, cpu_weight: 0,
      permissions: [],
    },
  },
  {
    name: 'eosriobrazil',
    chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
    chainName: 'Vaulta',
    mode: 'full',
    isProducer: true,
    producerRank: 14,
    producerUrl: 'https://eosrio.io',
    info: {
      account_name: 'eosriobrazil',
      core_liquid_balance: '45,891.2030 A',
      ram_quota: 524000, ram_usage: 389000,
      net_weight: 150000000, cpu_weight: 350000000,
      permissions: [],
      voter_info: { is_proxy: 0, producers: [], staked: 500000000 },
    },
  },
  {
    name: 'b1',
    chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
    chainName: 'Vaulta',
    mode: 'watch',
    info: {
      account_name: 'b1',
      core_liquid_balance: '0.0000 A',
      ram_quota: 14822140, ram_usage: 6878028,
      net_weight: 0, cpu_weight: 0,
      permissions: [],
    },
  },
];

/** Race a promise against a timeout. Returns fallback if the promise doesn't resolve in time. */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}
