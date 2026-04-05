/**
 * ContractDeployer — Bootstraps the dev chain with system contracts,
 * test accounts, and initial token distribution.
 *
 * Uses `cleos` inside the nodeos container for all on-chain operations.
 * Adapted from hyperion-history-api/tests/e2e/lib/contract-deployer.ts
 */

import { execSync } from 'node:child_process';
import type { ChainEndpoints } from './chain-manager.js';

// Default development key (matches genesis.json initial_key)
const DEV_PRIVATE_KEY = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3';
const DEV_PUBLIC_KEY = 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV';

// Container name for exec commands
const CONTAINER = 'simpleos-test-nodeos';

export interface DeploymentResult {
    chainId: string;
    accounts: string[];
    tokenSymbol: string;
    devPrivateKey: string;
    devPublicKey: string;
}

export interface ContractDeployerConfig {
    tokenSymbol?: string;
    tokenMaxSupply?: string;
    tokenInitialIssue?: string;
    verbose?: boolean;
}

export class ContractDeployer {
    private endpoints: ChainEndpoints;
    private config: Required<ContractDeployerConfig>;

    // Test accounts — wallet testing requires known keys and realistic accounts
    // Note: Antelope names max 13 chars; 13th char restricted to [.12345a-j]
    private readonly testAccounts = [
        'alice',       // Primary test user
        'bob',         // Transfer recipient
        'carol',       // Watch-only test
        'exchange.1',  // Simulated exchange (tests memo requirement)
        'producer1',   // BP for voting tests
        'producer2',
        'producer3',
    ];

    constructor(endpoints: ChainEndpoints, config: ContractDeployerConfig = {}) {
        this.endpoints = endpoints;
        this.config = {
            tokenSymbol: config.tokenSymbol ?? 'TST',
            tokenMaxSupply: config.tokenMaxSupply ?? '1000000000.0000',
            tokenInitialIssue: config.tokenInitialIssue ?? '100000000.0000',
            verbose: config.verbose ?? false,
        };
    }

    private cleos(args: string): string {
        const cmd = `docker exec ${CONTAINER} cleos -u http://127.0.0.1:8888 ${args}`;
        try {
            const result = execSync(cmd, {
                stdio: this.config.verbose ? 'inherit' : 'pipe',
                timeout: 30000,
            });
            return result?.toString().trim() ?? '';
        } catch (err: any) {
            const output = err.stderr?.toString() ?? err.stdout?.toString() ?? err.message;
            if (this.config.verbose) {
                console.error(`   cleos error: ${output}`);
            }
            throw new Error(`cleos failed: ${output}`);
        }
    }

    private isExpectedError(msg: string): boolean {
        const safePatterns = [
            'already exists', 'already activated', 'already unlocked',
            'already imported', 'name is already taken',
            'already an existing account', 'duplicate transaction',
            'Cannot create wallet',
        ];
        return safePatterns.some(p => msg.toLowerCase().includes(p.toLowerCase()));
    }

    private async setupWallet(): Promise<void> {
        console.log('  Setting up cleos wallet...');
        try {
            this.cleos('wallet create --to-console');
        } catch (err: any) {
            if (!this.isExpectedError(err.message)) {
                try {
                    this.cleos('wallet unlock --password PW5KExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
                } catch (unlockErr: any) {
                    if (!this.isExpectedError(unlockErr.message)) throw unlockErr;
                }
            }
        }
        try {
            this.cleos(`wallet import --private-key ${DEV_PRIVATE_KEY}`);
        } catch (err: any) {
            if (!this.isExpectedError(err.message)) throw err;
        }
    }

    private async deploySystemContracts(): Promise<void> {
        console.log('  Deploying system contracts...');

        // Create system accounts
        const systemAccounts = [
            'eosio.bpay', 'eosio.msig', 'eosio.names', 'eosio.ram',
            'eosio.ramfee', 'eosio.saving', 'eosio.stake', 'eosio.token',
            'eosio.vpay', 'eosio.rex', 'eosio.fees',
        ];

        for (const acct of systemAccounts) {
            try {
                this.cleos(`create account eosio ${acct} ${DEV_PUBLIC_KEY} ${DEV_PUBLIC_KEY}`);
            } catch (err: any) {
                if (!this.isExpectedError(err.message)) {
                    throw new Error(`Failed to create system account ${acct}: ${err.message}`);
                }
            }
        }

        // Deploy eosio.token
        this.cleos('set contract eosio.token /contracts/system/eosio.token');

        // Deploy eosio.msig
        this.cleos('set contract eosio.msig /contracts/system/eosio.msig');

        // Activate PREACTIVATE_FEATURE via producer API
        try {
            execSync(`docker exec ${CONTAINER} curl -sf -X POST http://127.0.0.1:8888/v1/producer/schedule_protocol_feature_activations -d '{"protocol_features_to_activate": ["0ec7e080177b2c02b278d5088611686b49d739925a92d9bfcacd7fc6b74053bd"]}'`, {
                stdio: this.config.verbose ? 'inherit' : 'pipe',
            });
        } catch (err: any) {
            if (!this.isExpectedError(err.message)) {
                console.warn(`   PREACTIVATE_FEATURE activation warning: ${err.message}`);
            }
        }

        await this.waitBlocks(3);

        // Deploy eosio.boot (provides 'activate' action)
        this.cleos('set contract eosio /contracts/system/eosio.boot');
        await this.waitBlocks(2);

        // Activate all supported protocol features in dependency order
        console.log('  Activating protocol features...');
        try {
            const featuresJson = execSync(
                `docker exec ${CONTAINER} curl -sf http://127.0.0.1:8888/v1/producer/get_supported_protocol_features`,
                { stdio: 'pipe' }
            ).toString();
            const features = JSON.parse(featuresJson) as Array<{
                feature_digest: string;
                specification: Array<{ name: string; value: string }>;
                dependencies: string[];
            }>;

            const featureMap = new Map<string, { name: string; digest: string; deps: string[] }>();
            for (const f of features) {
                const name = f.specification.find(s => s.name === 'builtin_feature_codename')?.value ?? 'unknown';
                featureMap.set(f.feature_digest, { name, digest: f.feature_digest, deps: f.dependencies ?? [] });
            }

            const activated = new Set<string>();
            activated.add('0ec7e080177b2c02b278d5088611686b49d739925a92d9bfcacd7fc6b74053bd');

            const activateInOrder = (digest: string): void => {
                if (activated.has(digest)) return;
                const feature = featureMap.get(digest);
                if (!feature) return;
                for (const dep of feature.deps) activateInOrder(dep);
                try {
                    this.cleos(`push action eosio activate '["${digest}"]' -p eosio@active`);
                    activated.add(digest);
                } catch (err: any) {
                    if (this.isExpectedError(err.message)) {
                        activated.add(digest);
                    }
                }
            };

            for (const [digest] of featureMap) activateInOrder(digest);
            console.log(`    ${activated.size} features activated`);
        } catch {
            console.error('   Could not fetch/activate supported features');
        }

        await this.waitBlocks(3);

        // Deploy eosio.system
        this.cleos('set contract eosio /contracts/system/eosio.system');

        // Create token and initialize system (idempotent — skip if already done)
        const sym = this.config.tokenSymbol;
        const maxSupply = `${this.config.tokenMaxSupply} ${sym}`;
        const initialIssue = `${this.config.tokenInitialIssue} ${sym}`;
        try {
            this.cleos(`push action eosio.token create '["eosio", "${maxSupply}"]' -p eosio.token@active`);
        } catch (err: any) {
            if (!err.message.toLowerCase().includes('already exists')) throw err;
        }
        try {
            this.cleos(`push action eosio.token issue '["eosio", "${initialIssue}", "initial issue"]' -p eosio@active`);
        } catch (err: any) {
            // Second issue may not matter — continue
            if (!this.isExpectedError(err.message)) {
                console.warn(`   token issue warning: ${err.message.slice(0, 100)}`);
            }
        }
        try {
            this.cleos(`push action eosio init '[0, "4,${sym}"]' -p eosio@active`);
        } catch (err: any) {
            // init is a one-time action; subsequent calls fail with "system contract already initialized"
            if (!err.message.toLowerCase().includes('already') && !err.message.toLowerCase().includes('assertion failure')) {
                throw err;
            }
        }

        console.log('  System contracts deployed');
    }

    private async setupTestAccounts(): Promise<void> {
        console.log('  Creating test accounts...');
        const transferAmount = `10000.0000 ${this.config.tokenSymbol}`;

        for (const acct of this.testAccounts) {
            try {
                this.cleos(`system newaccount eosio ${acct} ${DEV_PUBLIC_KEY} ${DEV_PUBLIC_KEY} --stake-net "100.0000 ${this.config.tokenSymbol}" --stake-cpu "100.0000 ${this.config.tokenSymbol}" --buy-ram-kbytes 1024`);
            } catch (err: any) {
                if (!this.isExpectedError(err.message)) {
                    throw new Error(`Failed to create ${acct}: ${err.message}`);
                }
            }

            try {
                this.cleos(`push action eosio.token transfer '["eosio", "${acct}", "${transferAmount}", "test setup"]' -p eosio@active`);
            } catch (err: any) {
                if (!this.isExpectedError(err.message)) {
                    console.warn(`   Token transfer to ${acct} failed: ${err.message.slice(0, 100)}`);
                }
            }
        }

        // Register producers for voting tests
        for (const bp of ['producer1', 'producer2', 'producer3']) {
            try {
                this.cleos(`system regproducer ${bp} ${DEV_PUBLIC_KEY} https://${bp}.test 0`);
            } catch (err: any) {
                if (!this.isExpectedError(err.message)) {
                    console.warn(`   regproducer ${bp} failed: ${err.message.slice(0, 100)}`);
                }
            }
        }

        console.log(`  ${this.testAccounts.length} test accounts ready`);
    }

    private async waitBlocks(count: number): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, count * 500 + 200));
    }

    /**
     * Get the chain_id from the running node.
     */
    async getChainId(): Promise<string> {
        const res = await fetch(`${this.endpoints.httpUrl}/v1/chain/get_info`);
        const info = await res.json() as any;
        return info.chain_id;
    }

    /**
     * Run the full deployment pipeline.
     */
    async deploy(): Promise<DeploymentResult> {
        console.log('\n  Starting chain bootstrap...\n');

        await this.setupWallet();
        await this.deploySystemContracts();
        await this.setupTestAccounts();

        const chainId = await this.getChainId();

        console.log('\n  Chain bootstrap complete!\n');
        console.log(`  Chain ID: ${chainId}`);
        console.log(`  Endpoint: ${this.endpoints.httpUrl}`);
        console.log(`  Token:    ${this.config.tokenSymbol}`);
        console.log(`  Dev Key:  ${DEV_PRIVATE_KEY}`);
        console.log(`  Accounts: ${this.testAccounts.join(', ')}\n`);

        return {
            chainId,
            accounts: ['eosio', 'eosio.token', ...this.testAccounts],
            tokenSymbol: this.config.tokenSymbol,
            devPrivateKey: DEV_PRIVATE_KEY,
            devPublicKey: DEV_PUBLIC_KEY,
        };
    }
}
