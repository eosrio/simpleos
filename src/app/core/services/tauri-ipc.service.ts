import { Injectable, signal } from '@angular/core';
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
  chain_id: string;
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

  // ── Chain ──

  async getChainInfo(endpoint: string): Promise<ChainInfo> {
    return invoke<ChainInfo>('get_chain_info', { endpoint });
  }

  async getAccount(endpoint: string, accountName: string): Promise<AccountInfo> {
    return invoke<AccountInfo>('get_account', { endpoint, accountName });
  }

  async getBalances(endpoint: string, account: string, code: string, symbol: string): Promise<string[]> {
    return invoke<string[]>('get_balances', { endpoint, account, code, symbol });
  }

  async getTableRows(endpoint: string, params: TableRowsParams): Promise<TableRowsResult> {
    return invoke<TableRowsResult>('get_table_rows', { endpoint, params });
  }

  async getProducers(endpoint: string, limit: number): Promise<any> {
    return invoke<any>('get_producers', { endpoint, limit });
  }

  async getActionsHistory(hyperionUrl: string, account: string, limit: number, skip: number): Promise<any> {
    return invoke<any>('get_actions_history', { hyperionUrl, account, limit, skip });
  }

  async getTokens(hyperionUrl: string, account: string): Promise<any> {
    return invoke<any>('get_tokens', { hyperionUrl, account });
  }

  async lookupKeyAccounts(endpoint: string, publicKey: string): Promise<{ account_names: string[] }> {
    return invoke<{ account_names: string[] }>('lookup_key_accounts', { endpoint, publicKey });
  }

  async checkEndpointHealth(endpoint: string, expectedChainId: string): Promise<boolean> {
    return invoke<boolean>('check_endpoint_health', { endpoint, expectedChainId });
  }

  // ── Config ──

  async getChainsConfig(): Promise<ChainConfig[]> {
    return invoke<ChainConfig[]>('get_chains_config');
  }
}
