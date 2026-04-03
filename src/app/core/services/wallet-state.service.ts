import { computed, Injectable, signal } from '@angular/core';
import { AccountInfo, ChainConfig, TauriIpcService } from './tauri-ipc.service';

export type AccountMode = 'full' | 'watch';

export interface WalletAccount {
  name: string;
  chainId: string;
  chainName: string;
  info: AccountInfo;
  /** 'full' = keys imported, can sign. 'watch' = monitoring only, no keys. */
  mode: AccountMode;
  /** Whether this account is a registered block producer */
  isProducer?: boolean;
  /** Producer rank (1-based), if a producer */
  producerRank?: number;
  /** Producer URL, if a producer */
  producerUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class WalletStateService {

  readonly locked = signal(true);
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
      // Load chain configs from Rust backend
      const chains = await this.ipc.getChainsConfig();
      this.chains.set(chains);
      this.hasTauri.set(true);

      // Initialize providers for each chain
      for (const chain of chains) {
        await this.ipc.initChainProviders(
          chain.id,
          chain.endpoints,
          chain.hyperion_apis,
        );
      }

      const isLocked = await this.ipc.isLocked();
      this.locked.set(isLocked);
    } catch (e) {
      // Tauri not available — running in browser for dev/design
      console.warn('Tauri backend not available, using mock mode');
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

      // Add to accounts list
      this.accounts.update(list => [...list, account]);
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
      this.accounts.update(list =>
        list.map((a, i) => i === index ? { ...a, info } : a)
      );
    } catch (e: any) {
      console.warn(`Failed to refresh ${account.name}:`, e);
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
    const result = await this.ipc.unlock(passphrase);
    if (result) {
      this.locked.set(false);
      await this.loadAccounts();
    }
    return result;
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

  async loadAccounts() {
    if (!this.hasTauri()) return;

    const chain = this.activeChain();
    if (!chain) return;

    this.loading.set(true);
    try {
      const publicKeys = await this.ipc.listPublicKeys(chain.id);
      const accounts: WalletAccount[] = [];

      for (const pubKey of publicKeys) {
        const result = await this.ipc.lookupKeyAccounts(chain.id, pubKey);
        for (const name of result.account_names) {
          const info = await this.ipc.getAccount(chain.id, name);
          accounts.push({ name, chainId: chain.id, chainName: chain.name, mode: 'full', info });
        }
      }

      this.accounts.set(accounts);
    } finally {
      this.loading.set(false);
    }
  }

  selectAccount(index: number) {
    this.selectedIndex.set(index);
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
  { id: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906', name: 'Vaulta', symbol: 'EOS', precision: 4, endpoints: [], hyperion_apis: [], explorers: [], features: { send: true, vote: true, staking: true, rex: true, powerup: true, resource: true, dapps: true, history: true } },
  { id: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4', name: 'WAX', symbol: 'WAX', precision: 8, endpoints: [], hyperion_apis: [], explorers: [], features: { send: true, vote: true, staking: true, rex: false, powerup: true, resource: true, dapps: true, history: true } },
  { id: '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11', name: 'Telos', symbol: 'TLOS', precision: 4, endpoints: [], hyperion_apis: [], explorers: [], features: { send: true, vote: true, staking: true, rex: true, powerup: true, resource: true, dapps: true, history: true } },
  { id: 'ultra-chain-id', name: 'Ultra', symbol: 'UOS', precision: 4, endpoints: [], hyperion_apis: [], explorers: [], features: { send: true, vote: true, staking: true, rex: false, powerup: false, resource: true, dapps: false, history: true } },
  { id: 'fio-chain-id', name: 'FIO', symbol: 'FIO', precision: 9, endpoints: [], hyperion_apis: [], explorers: [], features: { send: true, vote: true, staking: false, rex: false, powerup: false, resource: false, dapps: false, history: true } },
  { id: 'libre-chain-id', name: 'Libre', symbol: 'LIBRE', precision: 4, endpoints: [], hyperion_apis: [], explorers: [], features: { send: true, vote: true, staking: true, rex: false, powerup: false, resource: true, dapps: false, history: true } },
  { id: 'xpr-chain-id', name: 'XPR', symbol: 'XPR', precision: 4, endpoints: [], hyperion_apis: [], explorers: [], features: { send: true, vote: true, staking: true, rex: false, powerup: false, resource: true, dapps: false, history: true } },
];

const MOCK_ACCOUNTS: WalletAccount[] = [
  {
    name: 'igorls.gm',
    chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
    chainName: 'Vaulta',
    mode: 'full',
    info: {
      account_name: 'igorls.gm',
      core_liquid_balance: '12,847.3291 EOS',
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
      core_liquid_balance: '45,891.2030 EOS',
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
      core_liquid_balance: '0.0000 EOS',
      ram_quota: 14822140, ram_usage: 6878028,
      net_weight: 0, cpu_weight: 0,
      permissions: [],
    },
  },
];
