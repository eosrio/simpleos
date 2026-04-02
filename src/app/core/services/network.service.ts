import { computed, Injectable, signal } from '@angular/core';
import { ActiveEndpoints, EndpointState, TauriIpcService } from './tauri-ipc.service';
import { WalletStateService } from './wallet-state.service';

@Injectable({ providedIn: 'root' })
export class NetworkService {

  readonly endpointStatuses = signal<EndpointState[]>([]);
  readonly hyperionStatuses = signal<EndpointState[]>([]);
  readonly activeRpc = signal('');
  readonly activeHyperion = signal('');
  readonly checking = signal(false);

  readonly healthyCount = computed(() =>
    this.endpointStatuses().filter(e => e.latency_ms > 0 && e.latency_ms <= 1200).length
  );

  constructor(
    private ipc: TauriIpcService,
    private wallet: WalletStateService,
  ) {}

  /** Run health checks for the active chain's endpoints. */
  async checkEndpoints() {
    const chain = this.wallet.activeChain();
    if (!chain || !this.wallet.hasTauri()) return;

    this.checking.set(true);
    try {
      const rpcResults = await this.ipc.checkRpcEndpoints(chain.id);
      this.endpointStatuses.set(rpcResults);

      const hyperionResults = await this.ipc.checkHyperionEndpoints(chain.id);
      this.hyperionStatuses.set(hyperionResults);

      const active = await this.ipc.getActiveEndpoints(chain.id);
      this.activeRpc.set(active.rpc);
      this.activeHyperion.set(active.hyperion);
    } catch (e) {
      console.warn('Endpoint check failed:', e);
    } finally {
      this.checking.set(false);
    }
  }
}
