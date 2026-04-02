import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';

// ── Types matching Rust backend ──

export interface ChainInfo {
  server_version: string;
  chain_id: string;
  head_block_num: number;
  last_irreversible_block_num: number;
  head_block_time: string;
  head_block_id: string;
  last_irreversible_block_id: string;
  server_version_string?: string;
  fork_db_head_block_num?: number;
  last_irreversible_block_time?: string;
}

export interface AccountInfo {
  account_name: string;
  core_liquid_balance?: string;
  ram_quota?: number;
  ram_usage?: number;
  net_weight?: number;
  cpu_weight?: number;
  permissions: Permission[];
  voter_info?: any;
  total_resources?: any;
  self_delegated_bandwidth?: any;
  refund_request?: any;
}

export interface Permission {
  perm_name: string;
  parent: string;
  required_auth: any;
}

export interface TableRowsParams {
  code: string;
  table: string;
  scope: string;
  lower_bound?: string;
  upper_bound?: string;
  limit?: number;
  json?: boolean;
  key_type?: string;
  index_position?: string;
}

export interface TableRowsResult {
  rows: any[];
  more: boolean;
  next_key?: string;
}

export interface ImportResult {
  public_key: string;
  accounts: string[];
}

export interface ChainConfig {
  id: string;
  name: string;
  symbol: string;
  precision: number;
  icon?: string;
  endpoints: { url: string; owner?: string }[];
  hyperion_apis: string[];
  explorers: { name: string; url: string; tx_url?: string; account_url?: string }[];
  features: ChainFeatures;
}

export interface ChainFeatures {
  send: boolean;
  vote: boolean;
  staking: boolean;
  rex: boolean;
  powerup: boolean;
  resource: boolean;
  dapps: boolean;
  history: boolean;
}

export interface EndpointState {
  url: string;
  owner?: string;
  latency_ms: number;
}

export interface ActiveEndpoints {
  rpc: string;
  hyperion: string;
  rpc_endpoints: EndpointState[];
  hyperion_endpoints: EndpointState[];
}

@Injectable({ providedIn: 'root' })
export class TauriIpcService {

  // ── Wallet ──

  async isLocked(): Promise<boolean> {
    return invoke<boolean>('is_locked');
  }

  async unlock(passphrase: string): Promise<boolean> {
    return invoke<boolean>('unlock', { passphrase });
  }

  async lock(): Promise<void> {
    return invoke<void>('lock');
  }

  async importPrivateKey(wif: string, chainId: string, passphrase: string): Promise<ImportResult> {
    return invoke<ImportResult>('import_private_key', { wif, chainId, passphrase });
  }

  async listPublicKeys(chainId: string): Promise<string[]> {
    return invoke<string[]>('list_public_keys', { chainId });
  }

  async removeKey(chainId: string, publicKey: string): Promise<void> {
    return invoke<void>('remove_key', { chainId, publicKey });
  }

  // ── Network / Providers ──

  /** Register RPC + Hyperion endpoints for a chain. Call once per chain on startup. */
  async initChainProviders(
    chainId: string,
    rpcEndpoints: { url: string; owner?: string }[],
    hyperionEndpoints: string[],
  ): Promise<void> {
    return invoke<void>('init_chain_providers', {
      chainId,
      rpcEndpoints,
      hyperionEndpoints,
    });
  }

  /** Run parallel health checks on all RPC endpoints. Returns sorted state. */
  async checkRpcEndpoints(chainId: string): Promise<EndpointState[]> {
    return invoke<EndpointState[]>('check_rpc_endpoints', { chainId });
  }

  /** Run health checks on all Hyperion endpoints. */
  async checkHyperionEndpoints(chainId: string): Promise<EndpointState[]> {
    return invoke<EndpointState[]>('check_hyperion_endpoints', { chainId });
  }

  /** Get the currently active endpoints for a chain. */
  async getActiveEndpoints(chainId: string): Promise<ActiveEndpoints> {
    return invoke<ActiveEndpoints>('get_active_endpoints', { chainId });
  }

  // ── Chain queries (all go through provider with automatic failover) ──

  async getChainInfo(chainId: string): Promise<ChainInfo> {
    return invoke<ChainInfo>('get_chain_info', { chainId });
  }

  async getAccount(chainId: string, accountName: string): Promise<AccountInfo> {
    return invoke<AccountInfo>('get_account', { chainId, accountName });
  }

  async getBalances(chainId: string, account: string, code: string, symbol: string): Promise<string[]> {
    return invoke<string[]>('get_balances', { chainId, account, code, symbol });
  }

  async getAbi(chainId: string, accountName: string): Promise<any> {
    return invoke<any>('get_abi', { chainId, accountName });
  }

  async getTableRows(chainId: string, params: TableRowsParams): Promise<TableRowsResult> {
    return invoke<TableRowsResult>('get_table_rows', { chainId, params });
  }

  async getProducers(chainId: string, limit: number): Promise<any> {
    return invoke<any>('get_producers', { chainId, limit });
  }

  async lookupKeyAccounts(chainId: string, publicKey: string): Promise<{ account_names: string[] }> {
    return invoke<{ account_names: string[] }>('lookup_key_accounts', { chainId, publicKey });
  }

  async getActionsHistory(chainId: string, account: string, limit: number, skip: number): Promise<any> {
    return invoke<any>('get_actions_history', { chainId, account, limit, skip });
  }

  async getTokens(chainId: string, account: string): Promise<any> {
    return invoke<any>('get_tokens', { chainId, account });
  }

  // ── Config ──

  async getChainsConfig(): Promise<ChainConfig[]> {
    return invoke<ChainConfig[]>('get_chains_config');
  }
}
