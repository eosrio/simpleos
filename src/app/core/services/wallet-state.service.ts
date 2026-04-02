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

/** Mock accounts for design testing — remove when backend is wired */
const MOCK_ACCOUNTS: WalletAccount[] = [
  {
    name: 'igorls.gm',
    chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
    chainName: 'Vaulta',
    mode: 'full',
    info: {
      account_name: 'igorls.gm',
      core_liquid_balance: '12,847.3291 EOS',
      ram_quota: 177000,
      ram_usage: 127400,
      net_weight: 21000000,
      cpu_weight: 21000000,
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
      ram_quota: 65000,
      ram_usage: 42300,
      net_weight: 5000000,
      cpu_weight: 15000000,
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
      ram_quota: 32000,
      ram_usage: 8900,
      net_weight: 2000000,
      cpu_weight: 8000000,
      permissions: [],
    },
  },
  {
    name: 'igorls.ultra',
    chainId: 'a]ultra-chain-id',
    chainName: 'Ultra',
    mode: 'full',
    info: {
      account_name: 'igorls.ultra',
      core_liquid_balance: '156.0000 UOS',
      ram_quota: 48000,
      ram_usage: 12000,
      net_weight: 1000000,
      cpu_weight: 3000000,
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
      ram_quota: 100000,
      ram_usage: 34000,
      net_weight: 0,
      cpu_weight: 0,
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
      ram_quota: 524000,
      ram_usage: 389000,
      net_weight: 150000000,
      cpu_weight: 350000000,
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
      ram_quota: 14822140,
      ram_usage: 6878028,
      net_weight: 0,
      cpu_weight: 0,
      permissions: [],
    },
  },
];

@Injectable({ providedIn: 'root' })
export class WalletStateService {

  readonly locked = signal(true);
  readonly accounts = signal<WalletAccount[]>([]);
  readonly selectedIndex = signal(0);
  readonly chains = signal<ChainConfig[]>([]);
  readonly activeChainIndex = signal(0);
  readonly loading = signal(false);

  /** Whether to use mock data for design testing */
  readonly useMocks = signal(true);

  readonly selectedAccount = computed(() => this.accounts()[this.selectedIndex()]);

  /** Whether the currently selected account is a registered block producer */
  readonly isProducer = computed(() => this.selectedAccount()?.isProducer ?? false);

  /** Whether the currently selected account can sign transactions (has keys imported) */
  readonly canSign = computed(() => this.selectedAccount()?.mode === 'full');

  /** Whether the currently selected account is watch-only */
  readonly isWatchOnly = computed(() => this.selectedAccount()?.mode === 'watch');

  readonly activeChain = computed(() => {
    // When using account-tab model, the chain comes from the selected account
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
      const chains = await this.ipc.getChainsConfig();
      this.chains.set(chains);
      const isLocked = await this.ipc.isLocked();
      this.locked.set(isLocked);
    } catch {
      // Tauri not available (running in browser for design testing)
      this.useMocks.set(true);
      this.locked.set(false);
      this.accounts.set(MOCK_ACCOUNTS);
    }
  }

  async unlock(passphrase: string): Promise<boolean> {
    if (this.useMocks()) {
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
    if (!this.useMocks()) {
      await this.ipc.lock();
    }
    this.locked.set(true);
    this.accounts.set([]);
  }

  async selectChain(index: number) {
    this.activeChainIndex.set(index);
    if (!this.locked() && !this.useMocks()) {
      await this.loadAccounts();
    }
  }

  async loadAccounts() {
    if (this.useMocks()) return;

    const chain = this.activeChain();
    if (!chain) return;

    this.loading.set(true);
    try {
      const publicKeys = await this.ipc.listPublicKeys(chain.id);
      const accounts: WalletAccount[] = [];

      for (const pubKey of publicKeys) {
        const result = await this.ipc.lookupKeyAccounts(this.activeEndpoint(), pubKey);
        for (const name of result.account_names) {
          const info = await this.ipc.getAccount(this.activeEndpoint(), name);
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
}
