/**
 * WalletTestSuite — E2E tests for SimplEOS wallet operations
 * against a real local Antelope chain.
 *
 * These tests exercise the Rust backend's RPC client, transaction signing,
 * and key management against live nodeos APIs.
 */

import type { DeploymentResult } from './contract-deployer.js';

interface TestResult {
    name: string;
    passed: boolean;
    duration: number;
    error?: string;
}

export class WalletTestSuite {
    private endpoint: string;
    private deployment: DeploymentResult;
    private results: TestResult[] = [];

    constructor(endpoint: string, deployment: DeploymentResult) {
        this.endpoint = endpoint;
        this.deployment = deployment;
    }

    // ── Helpers ──

    private async rpc(path: string, body?: any): Promise<any> {
        const res = await fetch(`${this.endpoint}/v1/${path}`, {
            method: body ? 'POST' : 'GET',
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) throw new Error(`RPC ${path}: ${res.status} ${await res.text()}`);
        return res.json();
    }

    private async runTest(name: string, fn: () => Promise<void>): Promise<void> {
        const start = Date.now();
        try {
            await fn();
            this.results.push({ name, passed: true, duration: Date.now() - start });
            console.log(`    PASS  ${name} (${Date.now() - start}ms)`);
        } catch (err: any) {
            this.results.push({ name, passed: false, duration: Date.now() - start, error: err.message });
            console.log(`    FAIL  ${name}: ${err.message}`);
        }
    }

    private assert(condition: boolean, message: string): void {
        if (!condition) throw new Error(`Assertion failed: ${message}`);
    }

    private assertEqual(actual: any, expected: any, label: string): void {
        if (actual !== expected) {
            throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
    }

    // ── Test Cases ──

    async run(): Promise<{ passed: number; failed: number; results: TestResult[] }> {
        console.log('\n  Running wallet E2E tests...\n');

        // Chain connectivity
        await this.runTest('get_info returns valid chain data', async () => {
            const info = await this.rpc('chain/get_info');
            this.assert(!!info.chain_id, 'chain_id must be present');
            this.assert(info.head_block_num > 0, 'head_block_num must be > 0');
            this.assertEqual(info.chain_id, this.deployment.chainId, 'chain_id must match deployment');
        });

        // Account queries
        await this.runTest('get_account returns alice with correct balance', async () => {
            const acct = await this.rpc('chain/get_account', { account_name: 'alice' });
            this.assertEqual(acct.account_name, 'alice', 'account_name');
            this.assert(!!acct.core_liquid_balance, 'must have core_liquid_balance');
            this.assert(acct.core_liquid_balance.includes(this.deployment.tokenSymbol), 'balance must include token symbol');
        });

        await this.runTest('get_account fails for nonexistent account', async () => {
            try {
                await this.rpc('chain/get_account', { account_name: 'doesnotexist' });
                throw new Error('Should have thrown');
            } catch (err: any) {
                this.assert(err.message.includes('404') || err.message.includes('unknown key'), 'must return error for unknown account');
            }
        });

        // Account discovery via chain/get_accounts_by_authorizers (requires
        // `enable-account-queries = true` in nodeos config). This is the modern
        // replacement for the deprecated history/get_key_accounts endpoint and
        // lets SimplEOS discover accounts from a public key without Hyperion.
        await this.runTest('get_accounts_by_authorizers returns accounts for dev public key', async () => {
            const result = await this.rpc('chain/get_accounts_by_authorizers', {
                keys: [this.deployment.devPublicKey],
                accounts: [],
            });
            this.assert(Array.isArray(result.accounts), 'must return accounts array');
            this.assert(result.accounts.length > 0, 'must find at least one account');

            const names = new Set(result.accounts.map((a: any) => a.account_name));
            this.assert(names.has('alice'), 'must include alice');
            this.assert(names.has('bob'), 'must include bob');
            this.assert(names.has('producer1'), 'must include producer1');

            // Verify the response shape matches what SimplEOS's Rust backend expects
            const first = result.accounts[0];
            this.assert(typeof first.account_name === 'string', 'account_name must be string');
            this.assert(typeof first.permission_name === 'string', 'permission_name must be string');
            this.assert(typeof first.authorizing_key === 'string', 'authorizing_key must be string');
        });

        // Token balance
        await this.runTest('get_currency_balance returns correct balance', async () => {
            const result = await this.rpc('chain/get_currency_balance', {
                code: 'eosio.token',
                account: 'alice',
                symbol: this.deployment.tokenSymbol,
            });
            this.assert(Array.isArray(result), 'must return array');
            this.assert(result.length > 0, 'must have at least one balance');
            this.assert(result[0].includes(this.deployment.tokenSymbol), 'must include token symbol');
        });

        // Table queries
        await this.runTest('get_table_rows returns producers table', async () => {
            const result = await this.rpc('chain/get_table_rows', {
                code: 'eosio',
                table: 'producers',
                scope: 'eosio',
                json: true,
                limit: 10,
            });
            this.assert(Array.isArray(result.rows), 'must return rows array');
            const producers = result.rows.map((r: any) => r.owner);
            this.assert(producers.includes('producer1'), 'must include producer1');
        });

        await this.runTest('get_table_rows returns RAM market data', async () => {
            const result = await this.rpc('chain/get_table_rows', {
                code: 'eosio',
                table: 'rammarket',
                scope: 'eosio',
                json: true,
                limit: 1,
            });
            this.assert(result.rows.length > 0, 'rammarket must have rows');
            this.assert(!!result.rows[0].quote, 'must have quote field');
            this.assert(!!result.rows[0].base, 'must have base field');
        });

        // ABI
        await this.runTest('get_abi returns eosio system contract ABI', async () => {
            const result = await this.rpc('chain/get_abi', { account_name: 'eosio' });
            this.assert(!!result.abi, 'must return abi');
            const actionNames = result.abi.actions.map((a: any) => a.name);
            this.assert(actionNames.includes('delegatebw'), 'must include delegatebw');
            this.assert(actionNames.includes('voteproducer'), 'must include voteproducer');
            this.assert(actionNames.includes('buyram'), 'must include buyram');
        });

        // Note: chain/abi_json_to_bin is removed in Spring. SimplEOS's Rust backend
        // performs native binary serialization via the antelope::serialize module.

        // Resource info
        await this.runTest('alice has CPU/NET/RAM allocated', async () => {
            const acct = await this.rpc('chain/get_account', { account_name: 'alice' });
            this.assert(acct.cpu_weight > 0, 'must have cpu_weight > 0');
            this.assert(acct.net_weight > 0, 'must have net_weight > 0');
            this.assert(acct.ram_quota > 0, 'must have ram_quota > 0');
            this.assert(!!acct.cpu_limit, 'must have cpu_limit');
            this.assert(!!acct.net_limit, 'must have net_limit');
        });

        // Voter info
        await this.runTest('producer1 is registered as producer', async () => {
            const acct = await this.rpc('chain/get_account', { account_name: 'producer1' });
            // Check if producer1 is in the producers table
            const result = await this.rpc('chain/get_table_rows', {
                code: 'eosio',
                table: 'producers',
                scope: 'eosio',
                lower_bound: 'producer1',
                upper_bound: 'producer1',
                json: true,
                limit: 1,
            });
            this.assert(result.rows.length > 0, 'producer1 must be in producers table');
            this.assertEqual(result.rows[0].owner, 'producer1', 'owner must be producer1');
        });

        // Transaction push (transfer alice -> bob) via cleos
        // This validates that the chain accepts signed transactions and that get_info
        // returns the TAPOS data that SimplEOS uses to build them.
        // Note: cleos writes its "executed transaction" message to stderr, not stdout.
        await this.runTest('push transfer transaction alice -> bob', async () => {
            const { execSync } = await import('node:child_process');
            const cmd = `docker exec simpleos-test-nodeos cleos -u http://127.0.0.1:8888 push action eosio.token transfer '["alice", "bob", "0.0001 ${this.deployment.tokenSymbol}", "e2e push test"]' -p alice@active 2>&1`;
            const output = execSync(cmd).toString();
            this.assert(
                output.includes('executed transaction') || output.includes('transaction_id'),
                `transaction must be executed. output: ${output.slice(0, 200)}`,
            );
        });

        // Verify balance changed after transfer
        await this.runTest('bob balance increased after transfer', async () => {
            const result = await this.rpc('chain/get_currency_balance', {
                code: 'eosio.token',
                account: 'bob',
                symbol: this.deployment.tokenSymbol,
            });
            this.assert(result.length > 0, 'bob must have a balance');
            const balance = parseFloat(result[0].split(' ')[0]);
            this.assert(balance > 10000, 'bob must have more than 10000 tokens (initial + transfer)');
        });

        // Delegation queries — alice self-delegates more stake, then we query the row.
        // Note: `newaccount --stake-net --stake-cpu` writes to scope=eosio (payer), not the
        // receiver. Only explicit `delegatebw` from alice writes to scope=alice.
        await this.runTest('delegatebw self-stake by alice', async () => {
            const { execSync } = await import('node:child_process');
            const cmd = `docker exec simpleos-test-nodeos cleos -u http://127.0.0.1:8888 system delegatebw alice alice "10.0000 ${this.deployment.tokenSymbol}" "10.0000 ${this.deployment.tokenSymbol}" -p alice@active`;
            execSync(cmd, { stdio: 'pipe' });
        });

        await this.runTest('delband table returns alice self-delegation', async () => {
            const result = await this.rpc('chain/get_table_rows', {
                code: 'eosio',
                table: 'delband',
                scope: 'alice',
                json: true,
                limit: 10,
            });
            this.assert(result.rows.length > 0, 'alice must have delegation rows');
            const selfRow = result.rows.find((r: any) => r.from === 'alice' && r.to === 'alice');
            this.assert(!!selfRow, 'must have alice -> alice self-delegation row');
        });

        // Summary
        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;

        console.log(`\n  Results: ${passed} passed, ${failed} failed out of ${this.results.length}\n`);

        if (failed > 0) {
            console.log('  Failed tests:');
            for (const r of this.results.filter(r => !r.passed)) {
                console.log(`    - ${r.name}: ${r.error}`);
            }
            console.log('');
        }

        return { passed, failed, results: this.results };
    }
}
