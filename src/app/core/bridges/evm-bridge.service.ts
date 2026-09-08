import { Injectable } from '@angular/core';
import { Name } from '@wharfkit/antelope';
import { TauriIpcService, TableRowsParams } from '../services/tauri-ipc.service';
import { BRIDGE_ROUTES, BridgeRequest, BridgeRoute, BridgeSnapshot, BridgeSubmission, decimal, ethereumAddress, parseToken, quoteTransfer, uint, units } from './bridge-model';

/** A protocol adapter owns reads and transfer construction; the screen owns no contract rules. */
export interface EvmBridgeAdapter {
  route: BridgeRoute;
  loadSnapshot(account: string): Promise<BridgeSnapshot>;
  loadRequests(account: string): Promise<{ requests: BridgeRequest[]; more: boolean }>;
  quote: typeof quoteTransfer;
}

export class UltraEthereumAdapter implements EvmBridgeAdapter {
  readonly quote = quoteTransfer;
  constructor(readonly route: BridgeRoute, private ipc: TauriIpcService) {}
  private async table(table: string, params: Partial<TableRowsParams> = {}) {
    const response = await this.ipc.getTableRows(this.route.sourceChainId, {
      code: this.route.bridgeAccount, scope: this.route.scope, table, json: true, limit: 100, ...params,
    });
    if (!Array.isArray(response?.rows)) throw new Error('Invalid bridge table response');
    return response;
  }
  async loadSnapshot(account: string): Promise<BridgeSnapshot> {
    const [tokens, maintenance, chains, evm] = await Promise.all([
      this.table('tokens.a'), this.table('maint.a', { scope: this.route.bridgeAccount }),
      this.table('evms.a', { scope: this.route.bridgeAccount }), this.ipc.getEvmBridgeState(this.route.id, []),
    ]);
    if (tokens.more || maintenance.more || chains.more) throw new Error('Bridge configuration is incomplete. Retry after refreshing endpoints.');
    if (!chains.rows.some(row => row.evm_chain_name === this.route.scope && uint(row.evm_chain_id) === BigInt(this.route.evmChainId))) throw new Error('Bridge destination configuration changed.');
    const supported = tokens.rows.map(parseToken);
    if (new Set(supported.map(t => t.id)).size !== supported.length) throw new Error('Duplicate bridge token configuration');
    let maintenanceAt: number | null = null;
    if (maintenance.rows.length) {
      const time = maintenance.rows[0].maintenance_start_time;
      if (typeof time !== 'string') throw new Error('Invalid bridge maintenance state');
      maintenanceAt = Date.parse(/Z$|[+-]\d\d:\d\d$/.test(time) ? time : `${time}Z`);
      if (!Number.isFinite(maintenanceAt)) throw new Error('Invalid bridge maintenance time');
    }
    const balances: Record<string, string> = {};
    await Promise.all(supported.map(async token => {
      try {
        const values = await this.ipc.getBalances(this.route.sourceChainId, account, token.contract, token.symbol);
        if (!Array.isArray(values)) throw new Error('Invalid balance response');
        const asset = values.find(v => typeof v === 'string' && v.endsWith(` ${token.symbol}`));
        if (values.length && !asset) throw new Error('Wrong token in balance response');
        const value = asset ? asset.split(' ')[0] : decimal(0n, token.precision);
        balances[token.id] = decimal(units(value, token.precision), token.precision);
      } catch { /* An unavailable balance disables that token's quote, not other assets. */ }
    }));
    return { tokens: supported, balances, maintenanceAt, evmPaused: evm.paused, loadedAt: Date.now() };
  }
  async loadRequests(account: string) {
    const bound = Name.from(account).value.toString();
    const rows = await this.table('2evmreqs.a', { index_position: '2', key_type: 'i64', lower_bound: bound, upper_bound: bound, limit: 20 });
    const source = rows.rows.filter(row => row.sender === account);
    if (source.some(row => row.chain_id !== this.route.sourceChainId || uint(row.evm_chain_id) !== BigInt(this.route.evmChainId))) throw new Error('Unexpected network in bridge request');
    const counters = source.map(row => uint(row.counter).toString());
    let evm: Awaited<ReturnType<TauriIpcService['getEvmBridgeState']>> | null = null;
    let evmError = '';
    if (counters.length) {
      try { evm = await this.ipc.getEvmBridgeState(this.route.id, counters); }
      catch { evmError = 'Ethereum status is unavailable. Check the official bridge before claiming.'; }
    }
    const requests = await Promise.all(source.map(async (row): Promise<BridgeRequest> => {
      const counter = uint(row.counter).toString(), scheduleId = uint(row.schedule_id).toString();
      const match = /^(\d+),([A-Z]{1,7})$/.exec(row.symbol ?? '');
      if (!match || Number(match[1]) > 18) throw new Error('Invalid request token');
      const recipient = ethereumAddress(`0x${String(row.evm_receiving_address).replace(/^0x/, '')}`);
      const result: BridgeRequest = { counter, sender: account, recipient, quantity: `${decimal(uint(row.amount), Number(match[1]))} ${match[2]}`,
        createdAt: Number(uint(row.time)) * 1000, attestations: 0, threshold: 0, scheduleId, status: 'unknown', statusDetail: evmError };
      if (evm?.settlements.some(s => s.counter === counter && uint(s.block) > 0n)) {
        return { ...result, status: 'settled', statusDetail: 'The Ethereum contract marks this request settled. Verify the receipt on the official bridge; administrative repairs can also settle a request.' };
      }
      try {
        const [atts, schedules] = await Promise.all([
          this.table('2evmatts.a', { lower_bound: counter, upper_bound: counter, limit: 1 }),
          this.table('schedule.a', { lower_bound: scheduleId, upper_bound: scheduleId, limit: 1 }),
        ]);
        const schedule = schedules.rows.find(s => uint(s.version).toString() === scheduleId);
        if (!schedule || !Array.isArray(schedule.validators)) throw new Error('Missing validator schedule');
        result.threshold = Number(uint(schedule.threshold));
        if (!result.threshold || result.threshold > schedule.validators.length) throw new Error('Invalid validator threshold');
        const attestation = atts.rows.find(a => uint(a.counter).toString() === counter);
        if (attestation && !Array.isArray(attestation.attestations)) throw new Error('Invalid attestations');
        result.attestations = new Set((attestation?.attestations ?? []).filter((a: any) => schedule.validators.includes(a.validator) && /^(0x)?[a-fA-F0-9]{130}$/.test(a.ultra2evm_signature)).map((a: any) => a.validator)).size;
        if (evm) {
          if (evm.paused) result.statusDetail = 'The Ethereum bridge is paused.';
          else if (evm.schedule_version !== scheduleId) { result.status = 'schedule-changed'; result.statusDetail = 'This request uses an older validator schedule. Check the official bridge for recovery.'; }
          else result.status = result.attestations >= result.threshold ? 'attested' : 'validating';
        }
      } catch { result.status = 'unknown'; result.statusDetail = 'Validator status is unavailable. Refresh or check the official bridge.'; }
      return result;
    }));
    return { requests: requests.sort((a, b) => b.createdAt - a.createdAt), more: rows.more };
  }
}

@Injectable({ providedIn: 'root' })
export class EvmBridgeService {
  constructor(private ipc: TauriIpcService) {}
  routes(chainId: string) { return BRIDGE_ROUTES.filter(route => route.sourceChainId === chainId); }
  adapter(route: BridgeRoute): EvmBridgeAdapter {
    switch (route.protocol) { case 'ultra-ethereum': return new UltraEthereumAdapter(route, this.ipc); }
  }
  private key(route: BridgeRoute, account: string) { return `bridge_transfers:${route.id}:${account}`; }
  async submissions(route: BridgeRoute, account: string): Promise<BridgeSubmission[]> {
    const value = await this.ipc.storeGet<unknown>(this.key(route, account));
    if (!Array.isArray(value)) return [];
    return value.filter((s: any) => /^[a-f0-9]{64}$/i.test(s?.transactionId) && typeof s.quantity === 'string' &&
      /^0x[0-9a-f]{40}$/i.test(s.recipient) && Number.isFinite(s.createdAt)).slice(0, 50);
  }
  async remember(route: BridgeRoute, account: string, submission: BridgeSubmission) {
    const previous = await this.submissions(route, account);
    await this.ipc.storeSet(this.key(route, account), [submission, ...previous.filter(s => s.transactionId !== submission.transactionId)].slice(0, 50));
  }
}
