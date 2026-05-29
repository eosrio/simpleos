import { computed, Injectable, signal } from '@angular/core';
import { TauriIpcService } from './tauri-ipc.service';
import { WalletStateService } from './wallet-state.service';

/**
 * Detected resource capabilities for the active chain.
 * Determined by probing the system contract ABI and table state.
 */
export interface ChainCapabilities {
  /** Chain has delegatebw/undelegatebw for CPU/NET staking */
  staking: boolean;
  /** Chain has PowerUp model (1-day resource rental) */
  powerup: boolean;
  /** Chain has REX (Resource Exchange) */
  rex: boolean;
  /** Chain has Bancor RAM market (buyram/sellram) */
  ramBancor: boolean;
  /** Chain has fixed-price RAM (XPR model) */
  ramFixed: boolean;
  /** Chain has ramtransfer action */
  ramTransfer: boolean;
  /** Chain has refundram instead of sellram (Ultra) */
  ramRefund: boolean;
  /** Resources are effectively free (no staking needed for basic txns) */
  freeTransactions: boolean;
  /** Chain has FIO-style staking (stakefio/unstakefio, reward-only) */
  fioStaking: boolean;
  /** Chain has dual-token staking (XPR: SYS + XPR) */
  dualTokenStaking: boolean;
  /** Chain has XPR governance staking (stakexpr) */
  xprStaking: boolean;
  /** Unstaking delay in seconds for primary staking (0 = instant) */
  unstakeDelaySec: number;
  /** Chain supports Savannah fast finality */
  savannah: boolean;
}

const DEFAULT_CAPABILITIES: ChainCapabilities = {
  staking: false,
  powerup: false,
  rex: false,
  ramBancor: false,
  ramFixed: false,
  ramTransfer: false,
  ramRefund: false,
  freeTransactions: false,
  fioStaking: false,
  dualTokenStaking: false,
  xprStaking: false,
  unstakeDelaySec: 259200, // 3 days default
  savannah: false,
};

@Injectable({ providedIn: 'root' })
export class ChainFeaturesService {
  readonly capabilities = signal<ChainCapabilities>(DEFAULT_CAPABILITIES);
  readonly loading = signal(false);

  /** Convenience computed signals for template use */
  readonly hasStaking = computed(() => this.capabilities().staking);
  readonly hasPowerUp = computed(() => this.capabilities().powerup);
  readonly hasRex = computed(() => this.capabilities().rex);
  readonly hasRam = computed(() => this.capabilities().ramBancor || this.capabilities().ramFixed);
  readonly isFreeChain = computed(() => this.capabilities().freeTransactions);

  /** The primary resource model label for display */
  readonly primaryModel = computed(() => {
    const c = this.capabilities();
    if (c.freeTransactions && !c.staking) return 'free';
    if (c.fioStaking) return 'fio';
    if (c.powerup) return 'powerup';
    if (c.rex && c.staking) return 'rex+staking';
    if (c.staking) return 'staking';
    return 'unknown';
  });

  constructor(
    private ipc: TauriIpcService,
    private wallet: WalletStateService,
  ) {}

  /**
   * Probe the active chain to detect resource capabilities.
   * Call this when switching chains or connecting.
   */
  async detect() {
    const chain = this.wallet.activeChain();
    if (!chain) return;

    this.loading.set(true);
    try {
      const caps = { ...DEFAULT_CAPABILITIES };

      // Probe system contract ABI for available actions
      const abiActions = await this.probeAbiActions(chain.id);

      // Staking detection
      caps.staking = abiActions.has('delegatebw');

      // PowerUp detection
      if (abiActions.has('powerup')) {
        caps.powerup = await this.tableExists(chain.id, 'eosio', 'eosio', 'powup.state');
      }

      // REX detection
      if (abiActions.has('buyrex')) {
        caps.rex = await this.tableExists(chain.id, 'eosio', 'eosio', 'rexpool');
      }

      // RAM model detection
      caps.ramBancor = abiActions.has('buyram') && abiActions.has('sellram');
      caps.ramFixed = abiActions.has('buyram') && abiActions.has('setramoption');
      caps.ramTransfer = abiActions.has('ramtransfer');
      caps.ramRefund = abiActions.has('refundram');

      // If chain has refundram but not sellram, it's Ultra-style
      if (caps.ramRefund && !abiActions.has('sellram')) {
        caps.ramBancor = false;
      }

      // FIO detection
      caps.fioStaking = abiActions.has('stakefio');

      // XPR dual-token detection
      caps.xprStaking = abiActions.has('stakexpr');
      caps.dualTokenStaking = caps.xprStaking && abiActions.has('delegatebw');

      // Free transactions detection — check if account has effectively unlimited resources
      // or if chain is known to provide free transactions
      if (caps.fioStaking || caps.ramRefund) {
        caps.freeTransactions = true;
      }

      // Savannah detection — check for finalizer-related actions
      caps.savannah = abiActions.has('regfinkey') || abiActions.has('actfinkey');

      this.capabilities.set(caps);
    } catch {
      // Probing failed — use defaults
      this.capabilities.set(DEFAULT_CAPABILITIES);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * For mock/design mode — manually set capabilities based on chain name.
   */
  setMockCapabilities(chainName: string) {
    const name = chainName.toLowerCase();
    const caps = { ...DEFAULT_CAPABILITIES };

    switch (name) {
      case 'vaulta':
      case 'eos':
        caps.staking = true;
        caps.powerup = true;
        caps.rex = true;
        caps.ramBancor = true;
        caps.ramTransfer = true;
        caps.unstakeDelaySec = 259200;
        break;
      case 'wax':
        caps.staking = true;
        caps.powerup = true;
        caps.ramBancor = true;
        caps.unstakeDelaySec = 259200;
        break;
      case 'telos':
        caps.staking = true;
        caps.powerup = true;
        caps.rex = true;
        caps.ramBancor = true;
        caps.freeTransactions = true;
        caps.unstakeDelaySec = 259200;
        break;
      case 'ultra':
        caps.staking = true; // POWER staking for priority
        caps.freeTransactions = true;
        caps.ramRefund = true;
        caps.unstakeDelaySec = 259200;
        break;
      case 'fio':
        caps.freeTransactions = true;
        caps.fioStaking = true;
        caps.unstakeDelaySec = 604800; // 7 days
        break;
      case 'libre':
        caps.freeTransactions = true;
        caps.staking = true;
        caps.ramBancor = true;
        caps.unstakeDelaySec = 259200;
        break;
      case 'xpr':
      case 'proton':
        caps.freeTransactions = true;
        caps.staking = true;
        caps.xprStaking = true;
        caps.dualTokenStaking = true;
        caps.ramFixed = true;
        caps.unstakeDelaySec = 0; // SYS is instant
        break;
    }

    this.capabilities.set(caps);
  }

  private async probeAbiActions(chainId: string): Promise<Set<string>> {
    try {
      const abi = await this.ipc.getAbi(chainId, 'eosio');
      const actions = new Set<string>();
      if (abi?.abi?.actions) {
        for (const action of abi.abi.actions) {
          actions.add(action.name);
        }
      }
      return actions;
    } catch {
      return new Set();
    }
  }

  private async tableExists(chainId: string, code: string, scope: string, table: string): Promise<boolean> {
    try {
      const result = await this.ipc.getTableRows(chainId, {
        code, scope, table, limit: 1, json: true,
      });
      return result.rows.length > 0;
    } catch {
      return false;
    }
  }
}
