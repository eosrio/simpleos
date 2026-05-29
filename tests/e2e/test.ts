#!/usr/bin/env bun
/**
 * SimplEOS E2E Test CLI
 *
 * Usage:
 *   bun run tests/e2e/test.ts infra up          # Start local chain
 *   bun run tests/e2e/test.ts infra down         # Stop (add --volumes to wipe)
 *   bun run tests/e2e/test.ts infra status       # Show service status
 *   bun run tests/e2e/test.ts deploy             # Deploy contracts + create accounts
 *   bun run tests/e2e/test.ts test               # Run wallet E2E tests
 *   bun run tests/e2e/test.ts run                # Full pipeline: up + deploy + test
 *   bun run tests/e2e/test.ts clean              # Stop + remove volumes
 */

import { ChainManager } from './lib/chain-manager.js';
import { ContractDeployer } from './lib/contract-deployer.js';
import { WalletTestSuite } from './lib/wallet-tests.js';

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];

const chainManager = new ChainManager();

async function main() {
    switch (command) {
        case 'infra':
            await handleInfra();
            break;

        case 'deploy':
            await handleDeploy();
            break;

        case 'test':
            await handleTest();
            break;

        case 'run':
            await handleFullPipeline();
            break;

        case 'clean':
            await chainManager.down(true);
            console.log('Cleaned up all volumes and containers.');
            break;

        default:
            printUsage();
            break;
    }
}

async function handleInfra() {
    switch (subcommand) {
        case 'up':
            await chainManager.up();
            break;
        case 'down':
            await chainManager.down(args.includes('--volumes'));
            break;
        case 'status':
            chainManager.status();
            break;
        default:
            console.log('Usage: infra [up|down|status]');
    }
}

async function handleDeploy(): Promise<void> {
    const endpoints = chainManager.endpoints;
    const deployer = new ContractDeployer(endpoints, {
        verbose: args.includes('--verbose'),
    });
    await deployer.deploy();
}

async function handleTest(): Promise<void> {
    const endpoints = chainManager.endpoints;
    const deployer = new ContractDeployer(endpoints);

    // Get chain info for deployment result
    const chainId = await deployer.getChainId();
    const deployment = {
        chainId,
        accounts: ['eosio', 'eosio.token', 'alice', 'bob', 'carol', 'exchange.1', 'producer1', 'producer2', 'producer3'],
        tokenSymbol: 'TST',
        devPrivateKey: '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3',
        devPublicKey: 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV',
    };

    const suite = new WalletTestSuite(endpoints.httpUrl, deployment);
    const { failed } = await suite.run();

    if (failed > 0) {
        process.exit(1);
    }
}

async function handleFullPipeline(): Promise<void> {
    console.log('=== SimplEOS E2E Test Pipeline ===\n');

    // Step 1: Start infrastructure
    console.log('Step 1/3: Starting local chain...');
    await chainManager.up();

    // Step 2: Deploy contracts
    console.log('\nStep 2/3: Deploying contracts...');
    const deployer = new ContractDeployer(chainManager.endpoints, {
        verbose: args.includes('--verbose'),
    });
    const deployment = await deployer.deploy();

    // Step 3: Run tests
    console.log('\nStep 3/3: Running tests...');
    const suite = new WalletTestSuite(chainManager.endpoints.httpUrl, deployment);
    const { passed, failed } = await suite.run();

    // Summary
    console.log('=== Pipeline Complete ===');
    console.log(`Results: ${passed} passed, ${failed} failed`);

    if (failed > 0) {
        process.exit(1);
    }
}

function printUsage() {
    console.log(`
SimplEOS E2E Test CLI

Commands:
  infra up          Start the local Antelope chain (Docker)
  infra down        Stop the chain (add --volumes to wipe data)
  infra status      Show running services
  deploy            Deploy system contracts and create test accounts
  test              Run the wallet E2E test suite
  run               Full pipeline: start chain + deploy + test
  clean             Stop chain and remove all data

Options:
  --verbose         Show cleos output during deployment
  --volumes         Remove Docker volumes on 'infra down'

Examples:
  bun run tests/e2e/test.ts run                 # Full pipeline
  bun run tests/e2e/test.ts run --verbose        # With deployment output
  bun run tests/e2e/test.ts test                 # Run tests only (chain must be running)
  bun run tests/e2e/test.ts clean                # Cleanup everything
`);
}

main().catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});
