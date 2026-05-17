import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { Store } from '@tauri-apps/plugin-store';

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

export interface ResourceLimit {
  used?: number;
  available?: number;
  max?: number;
}

export interface AccountInfo {
  account_name: string;
  core_liquid_balance?: string;
  ram_quota?: number;
  ram_usage?: number;
  net_weight?: number;
  cpu_weight?: number;
  cpu_limit?: ResourceLimit;
  net_limit?: ResourceLimit;
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

export interface AccountAuthority {
  account_name: string;
  permission_name: string;
}

export interface KeyAccountsResult {
  account_names: string[];
  authorities: AccountAuthority[];
}

export interface ImportResult {
  public_key: string;
  accounts: string[];
}

export interface TokenConfig {
  contract: string;
  symbol: string;
  precision: number;
}

export interface ChainConfig {
  id: string;
  name: string;
  symbol: string;
  precision: number;
  icon?: string;
  token_contract: string;
  extra_tokens: TokenConfig[];
  endpoints: { url: string; owner?: string }[];
  hyperion_apis: string[];
  explorers: { name: string; url: string; tx_url?: string; account_url?: string }[];
  features: ChainFeatures;
  testnet?: boolean;
  coingecko_id?: string;
  oracle_contract?: string;
  oracle_scope?: string;
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

export interface DiscoveryProgress {
  phase: 'producers' | 'bp_json' | 'testing' | 'done';
  message: string;
  progress: number;
  endpoints_found: number;
  healthy_count: number;
}

export interface CachedEndpointsResult {
  endpoints: DiscoveredEndpoint[];
  cached_at: number;
  fresh: boolean;
}

export interface DiscoveredEndpoint {
  url: string;
  endpoint_type: 'Api' | 'Hyperion';
  producer: string;
  latency_ms: number;
  healthy: boolean;
}

export interface ActiveEndpoints {
  rpc: string;
  hyperion: string;
  rpc_endpoints: EndpointState[];
  hyperion_endpoints: EndpointState[];
}

// ── Anchor Import Types ──

export interface AnchorWalletEntry {
  account: string;
  authority: string;
  chain_id: string;
  chain_name: string;
  symbol: string;
  pubkey: string;
  mode: string;
  is_testnet: boolean;
  hd_path: string | null;
  has_private_key: boolean;
}

export interface ParsedAnchorBackup {
  entries: AnchorWalletEntry[];
  has_encrypted_keys: boolean;
  total_hot_keys: number;
  total_ledger_keys: number;
}

export interface ImportSelection {
  account: string;
  authority: string;
  chain_id: string;
  pubkey: string;
  import_mode: 'full' | 'watch';
}

export interface AnchorImportResult {
  imported_full: number;
  imported_watch: number;
  skipped: number;
  errors: string[];
}

export interface BiometricStatus {
  available: boolean;
  configured: boolean;
  reason: string;
}

@Injectable({ providedIn: 'root' })
export class TauriIpcService {

  // ── Wallet ──

  async hasWallet(): Promise<boolean> {
    return invoke<boolean>('has_wallet');
  }

  async isLocked(): Promise<boolean> {
    return invoke<boolean>('is_locked');
  }

  async unlock(passphrase: string): Promise<boolean> {
    return invoke<boolean>('unlock', { passphrase });
  }

  async getSecurityMode(): Promise<string> {
    return invoke<string>('get_security_mode');
  }

  async setSecurityMode(mode: string): Promise<void> {
    return invoke<void>('set_security_mode', { mode });
  }

  async needsPassphraseForSigning(): Promise<boolean> {
    return invoke<boolean>('needs_passphrase_for_signing');
  }

  async needsLockscreen(): Promise<boolean> {
    return invoke<boolean>('needs_lockscreen');
  }

  async lock(): Promise<void> {
    return invoke<void>('lock');
  }

  async derivePublicKey(wif: string): Promise<string> {
    return invoke<string>('derive_public_key', { wif });
  }

  /** Convert an EOS/PUB_K1_ public key to FIO legacy format (`FIO...`). */
  async toFioPublicKey(key: string): Promise<string> {
    return invoke<string>('to_fio_public_key', { key });
  }

  async importKeyWithSession(wif: string, chainId: string): Promise<ImportResult> {
    return invoke<ImportResult>('import_key_with_session', { wif, chainId });
  }

  async importPrivateKey(wif: string, chainId: string, passphrase: string): Promise<ImportResult> {
    return invoke<ImportResult>('import_private_key', { wif, chainId, passphrase });
  }

  async listPublicKeys(chainId: string): Promise<string[]> {
    return invoke<string[]>('list_public_keys', { chainId });
  }

  async exportPrivateKey(chainId: string, publicKey: string): Promise<string> {
    return invoke<string>('export_private_key', { chainId, publicKey });
  }

  async testKeyring(): Promise<string[]> {
    return invoke<string[]>('test_keyring');
  }

  async changePassphrase(oldPassphrase: string, newPassphrase: string): Promise<void> {
    return invoke<void>('change_passphrase', { oldPassphrase, newPassphrase });
  }

  async generateKeyPair(): Promise<{ wif: string; public_key: string }> {
    return invoke<{ wif: string; public_key: string }>('generate_key_pair');
  }

  async resetWallet(): Promise<void> {
    return invoke<void>('reset_wallet');
  }

  // ── Tray / Window ──

  async setCloseToTray(enabled: boolean): Promise<void> {
    return invoke<void>('set_close_to_tray', { enabled });
  }

  async getCloseToTray(): Promise<boolean> {
    return invoke<boolean>('get_close_to_tray');
  }

  async showMainWindow(): Promise<void> {
    return invoke<void>('show_main_window');
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

  async lookupKeyAccounts(chainId: string, publicKey: string): Promise<KeyAccountsResult> {
    return invoke<KeyAccountsResult>('lookup_key_accounts', { chainId, publicKey });
  }

  async getMsigInbox(chainId: string, account: string, limit = 50): Promise<{
    source: 'hyperion' | 'scan' | 'none';
    proposals: any[];
  }> {
    return invoke('get_msig_inbox', { chainId, account, limit });
  }

  async getMsigProposalDetails(chainId: string, proposer: string, proposalName: string): Promise<{
    expiration: number;
    actions: { account: string; name: string; authorization: { actor: string; permission: string }[]; data: any }[];
    requested_approvals: { actor: string; permission: string; time?: string }[];
    provided_approvals: { actor: string; permission: string; time?: string }[];
  }> {
    return invoke('get_msig_proposal_details', { chainId, proposer, proposalName });
  }

  /** Check current on-chain status of a known set of proposals. Fast — just reads approvals2. */
  async refreshMsigStatus(chainId: string, account: string, keys: { proposer: string; proposal_name: string }[]): Promise<{
    active: any[];
    dead: { proposer: string; proposal_name: string }[];
  }> {
    return invoke('refresh_msig_status', { chainId, account, keys });
  }

  /** Full scope-walk of eosio.msig::proposal. Emits `msig-scan-progress` and `msig-scan-proposal` events during the walk. */
  async scanMsigScopesStream(chainId: string, account: string, maxScopes?: number): Promise<{
    proposals: any[];
    scanned: number;
  }> {
    return invoke('scan_msig_scopes_stream', { chainId, account, maxScopes });
  }

  async getActionsHistory(chainId: string, account: string, limit: number, skip: number, filters?: { actName?: string; after?: string; before?: string }): Promise<any> {
    return invoke<any>('get_actions_history', {
      chainId, account, limit, skip,
      actName: filters?.actName ?? null,
      after: filters?.after ?? null,
      before: filters?.before ?? null,
    });
  }

  async getTokens(chainId: string, account: string): Promise<any> {
    return invoke<any>('get_tokens', { chainId, account });
  }

  // ── Discovery ──

  async loadCachedEndpoints(chainId: string): Promise<CachedEndpointsResult> {
    return invoke<CachedEndpointsResult>('load_cached_endpoints', { chainId });
  }

  async discoverEndpoints(chainId: string): Promise<DiscoveredEndpoint[]> {
    return invoke<DiscoveredEndpoint[]>('discover_endpoints', { chainId });
  }

  async onDiscoveryProgress(callback: (progress: DiscoveryProgress) => void): Promise<UnlistenFn> {
    return listen<DiscoveryProgress>('discovery-progress', (event) => {
      callback(event.payload);
    });
  }

  // ── Transactions ──

  async signAndPush(chainId: string, publicKey: string, actions: any[]): Promise<{ transaction_id: string }> {
    return invoke<{ transaction_id: string }>('sign_and_push', { chainId, publicKey, actions });
  }

  async signAndPushWithPassphrase(chainId: string, publicKey: string, passphrase: string, actions: any[]): Promise<{ transaction_id: string }> {
    return invoke<{ transaction_id: string }>('sign_and_push_with_passphrase', { chainId, publicKey, passphrase, actions });
  }

  async signDigest(chainId: string, publicKey: string, digestHex: string): Promise<string> {
    return invoke<string>('sign_digest', { chainId, publicKey, digestHex });
  }

  // ── PowerUp ──

  async getPowerUpInfo(chainId: string, account: string): Promise<any> {
    return invoke<any>('get_powerup_info', { chainId, account });
  }

  async estimatePowerUp(chainId: string, cpuFrac: number, netFrac: number): Promise<any> {
    return invoke<any>('estimate_powerup', { chainId, cpuFrac, netFrac });
  }

  // ── Ledger ──

  async ledgerListDevices(): Promise<string[]> {
    return invoke<string[]>('ledger_list_devices');
  }

  async ledgerGetAppConfig(): Promise<{ major: number; minor: number; patch: number; allow_unknown: boolean; verbose: boolean }> {
    return invoke('ledger_get_app_config');
  }

  async ledgerGetPublicKey(account: number, index: number, confirm: boolean): Promise<string> {
    return invoke<string>('ledger_get_public_key', { account, index, confirm });
  }

  async ledgerDiscoverKeys(maxIndex: number): Promise<{ path: string; public_key: string; index: number }[]> {
    return invoke('ledger_discover_keys', { maxIndex });
  }

  async ledgerSignAndPush(chainId: string, accountIndex: number, actions: any[]): Promise<{ transaction_id: string }> {
    return invoke('ledger_sign_and_push', { chainId, accountIndex, actions });
  }

  /** Start background polling for Ledger device connect/disconnect events. */
  async ledgerWatchDevices(): Promise<void> {
    return invoke<void>('ledger_watch_devices');
  }

  /** Listen for Ledger device connection events. Returns an unlisten function. */
  async onLedgerConnected(callback: (deviceName: string) => void): Promise<UnlistenFn> {
    return listen<string>('ledger-connected', (event) => {
      callback(event.payload);
    });
  }

  /** Listen for Ledger device disconnection events. Returns an unlisten function. */
  async onLedgerDisconnected(callback: (deviceName: string) => void): Promise<UnlistenFn> {
    return listen<string>('ledger-disconnected', (event) => {
      callback(event.payload);
    });
  }

  // ── Finalizer Keys (BLS) ──

  async generateFinalizerKey(chainId: string): Promise<{
    finalizer_key: string;
    proof_of_possession: string;
    finalizer_private_key: string;
    config_ini_line: string;
  }> {
    return invoke('generate_finalizer_key', { chainId });
  }

  async listFinalizerKeys(chainId: string): Promise<string[]> {
    return invoke<string[]>('list_finalizer_keys', { chainId });
  }

  async getFinalizerPop(chainId: string, finalizerKey: string): Promise<{ finalizer_key: string; proof_of_possession: string }> {
    return invoke<{ finalizer_key: string; proof_of_possession: string }>('get_finalizer_pop', { chainId, finalizerKey });
  }

  // ── FIO ──

  async fioGetFee(chainId: string, endPoint: string, fioAddress: string): Promise<{ fee: number }> {
    return invoke<{ fee: number }>('fio_get_fee', { chainId, endPoint, fioAddress });
  }

  async fioGetNames(chainId: string, fioPublicKey: string): Promise<any> {
    return invoke<any>('fio_get_names', { chainId, fioPublicKey });
  }

  async fioGetPubAddress(chainId: string, fioAddress: string): Promise<{ public_address: string }> {
    return invoke<{ public_address: string }>('fio_get_pub_address', { chainId, fioAddress });
  }

  // ── PIN ──

  async setPin(passphrase: string, pin: string): Promise<void> {
    return invoke<void>('set_pin', { passphrase, pin });
  }

  async unlockWithPin(pin: string): Promise<boolean> {
    return invoke<boolean>('unlock_with_pin', { pin });
  }

  async hasPin(): Promise<boolean> {
    return invoke<boolean>('has_pin');
  }

  async removePin(): Promise<void> {
    return invoke<void>('remove_pin');
  }

  // ── Biometric Unlock ──

  async biometricStatus(): Promise<BiometricStatus> {
    return invoke<BiometricStatus>('biometric_status');
  }

  async setBiometricUnlock(passphrase: string): Promise<void> {
    return invoke<void>('set_biometric_unlock', { passphrase });
  }

  async unlockWithBiometric(): Promise<boolean> {
    return invoke<boolean>('unlock_with_biometric');
  }

  async hasBiometricUnlock(): Promise<boolean> {
    return invoke<boolean>('has_biometric_unlock');
  }

  async removeBiometricUnlock(): Promise<void> {
    return invoke<void>('remove_biometric_unlock');
  }

  // ── Backup ──

  async exportBackup(passphrase: string): Promise<string> {
    return invoke<string>('export_backup', { passphrase });
  }

  async importBackup(json: string, passphrase: string): Promise<number> {
    return invoke<number>('import_backup', { json, passphrase });
  }

  // ── Anchor Import ──

  async parseAnchorBackup(json: string): Promise<ParsedAnchorBackup> {
    return invoke<ParsedAnchorBackup>('parse_anchor_backup', { json });
  }

  async verifyAnchorPassword(json: string, password: string): Promise<boolean> {
    return invoke<boolean>('verify_anchor_password', { json, password });
  }

  async importAnchorEntries(
    json: string,
    anchorPassword: string,
    simpleosPassphrase: string,
    selections: ImportSelection[],
  ): Promise<AnchorImportResult> {
    return invoke<AnchorImportResult>('import_anchor_entries', {
      json,
      anchorPassword,
      simpleosPassphrase,
      selections,
    });
  }

  // ── Config ──

  async getChainsConfig(): Promise<ChainConfig[]> {
    return invoke<ChainConfig[]>('get_chains_config');
  }

  // ── DApp Browser ──

  async openDappBrowser(url: string, title: string): Promise<void> {
    return invoke<void>('open_dapp_browser', { url, title });
  }

  async closeDappBrowser(): Promise<void> {
    return invoke<void>('close_dapp_browser');
  }

  async navigateDapp(url: string): Promise<void> {
    return invoke<void>('navigate_dapp', { url });
  }

  async reloadDapp(): Promise<void> {
    return invoke<void>('reload_dapp');
  }

  async dappGoBack(): Promise<void> {
    return invoke<void>('dapp_go_back');
  }

  async dappGoForward(): Promise<void> {
    return invoke<void>('dapp_go_forward');
  }

  async dappResolveSigning(requestId: string, result: any): Promise<void> {
    return invoke<void>('dapp_resolve_signing', { requestId, result });
  }

  async dappRejectSigning(requestId: string, reason: string): Promise<void> {
    return invoke<void>('dapp_reject_signing', { requestId, reason });
  }

  async onDappSigningRequest(callback: (request: { id: string; actions: any[]; chainId: string | null; origin: string }) => void): Promise<UnlistenFn> {
    return listen<string>('dapp-signing-request', (event) => {
      try {
        const parsed = JSON.parse(event.payload);
        callback(parsed);
      } catch { /* ignore malformed */ }
    });
  }

  // ── Local Store (non-sensitive persistence via tauri-plugin-store) ──

  private store: Store | null = null;

  private async getStore(): Promise<Store> {
    if (!this.store) {
      this.store = await Store.load('wallet-state.json');
    }
    return this.store;
  }

  async storeSet(key: string, value: any): Promise<void> {
    const store = await this.getStore();
    await store.set(key, value);
    await store.save();
  }

  async storeGet<T>(key: string): Promise<T | null> {
    const store = await this.getStore();
    const val = await store.get<T>(key);
    return val ?? null;
  }

  // ── Link Sessions (Anchor-Link Protocol) ──

  async createLinkSession(buoyUrl: string): Promise<{ channel_url: string; link_key: string; link_key_hex: string; link_name: string; channel_uuid: string }> {
    return invoke('create_link_session', { buoyUrl });
  }

  async unsealMessage(ciphertextHex: string, nonce: number, fromKey: string, sessionPubkeyHex: string): Promise<string> {
    return invoke<string>('unseal_message', { ciphertextHex, nonce, fromKey, sessionPubkeyHex });
  }

  async sealMessage(payload: string, nonce: number, toKeyHex: string, sessionPubkeyHex: string): Promise<string> {
    return invoke<string>('seal_message', { payload, nonce, toKeyHex, sessionPubkeyHex });
  }

  async deleteLinkSession(sessionPubkeyHex: string): Promise<void> {
    return invoke<void>('delete_link_session', { sessionPubkeyHex });
  }

  async storeDelete(key: string): Promise<void> {
    const store = await this.getStore();
    await store.delete(key);
    await store.save();
  }
}
