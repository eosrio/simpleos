/**
 * ChainManager — Orchestrates Docker Compose lifecycle and health checks
 * for the local Antelope test chain.
 */

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

export interface ChainEndpoints {
    httpUrl: string;
    shipUrl: string;
}

const COMPOSE_DIR = resolve(import.meta.dir, '..');

export class ChainManager {
    private httpPort: number;
    private shipPort: number;

    constructor(httpPort = 18888, shipPort = 18080) {
        this.httpPort = httpPort;
        this.shipPort = shipPort;
    }

    get endpoints(): ChainEndpoints {
        return {
            httpUrl: `http://127.0.0.1:${this.httpPort}`,
            shipUrl: `ws://127.0.0.1:${this.shipPort}`,
        };
    }

    /**
     * Start the Docker Compose stack and wait for nodeos to be healthy.
     */
    async up(): Promise<ChainEndpoints> {
        console.log('Starting local chain...');
        execSync('docker compose up -d --build', {
            cwd: COMPOSE_DIR,
            stdio: 'inherit',
        });

        await this.waitForNodeos();
        console.log(`Chain ready at ${this.endpoints.httpUrl}`);
        return this.endpoints;
    }

    /**
     * Stop the Docker Compose stack.
     */
    async down(removeVolumes = false): Promise<void> {
        const flags = removeVolumes ? '--volumes' : '';
        console.log('Stopping local chain...');
        execSync(`docker compose down ${flags}`, {
            cwd: COMPOSE_DIR,
            stdio: 'inherit',
        });
    }

    /**
     * Show status of running services.
     */
    status(): void {
        execSync('docker compose ps', {
            cwd: COMPOSE_DIR,
            stdio: 'inherit',
        });
    }

    /**
     * Poll the nodeos HTTP API until it responds.
     */
    private async waitForNodeos(timeoutMs = 60000): Promise<void> {
        const start = Date.now();
        const url = `${this.endpoints.httpUrl}/v1/chain/get_info`;

        while (Date.now() - start < timeoutMs) {
            try {
                const res = await fetch(url);
                if (res.ok) {
                    const info = await res.json() as any;
                    console.log(`  nodeos v${info.server_version_string} — head block #${info.head_block_num}`);
                    return;
                }
            } catch {
                // Not ready yet
            }
            await new Promise(r => setTimeout(r, 1000));
        }
        throw new Error(`nodeos did not become healthy within ${timeoutMs / 1000}s`);
    }
}
