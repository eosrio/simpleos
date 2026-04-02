import { computed, Injectable, signal } from '@angular/core';
import { TauriIpcService } from './tauri-ipc.service';
import { WalletStateService } from './wallet-state.service';

export interface EndpointStatus {
  url: string;
  owner?: string;
  healthy: boolean;
  latencyMs?: number;
}

@Injectable({ providedIn: 'root' })
export class NetworkService {

  readonly endpointStatuses = signal<EndpointStatus[]>([]);
  readonly selectedEndpointIndex = signal(0);

  readonly activeEndpoint = computed(() => {
    const statuses = this.endpointStatuses();
    const idx = this.selectedEndpointIndex();
    return statuses[idx]?.url ?? this.wallet.activeEndpoint();
  });

  constructor(
    private ipc: TauriIpcService,
    private wallet: WalletStateService,
  ) {}

  async checkEndpoints() {
    const chain = this.wallet.activeChain();
    if (!chain) return;

    const statuses: EndpointStatus[] = [];
    for (const ep of chain.endpoints) {
      const start = performance.now();
      const healthy = await this.ipc.checkEndpointHealth(ep.url, chain.id);
      const latencyMs = Math.round(performance.now() - start);
      statuses.push({ url: ep.url, owner: ep.owner, healthy, latencyMs });
    }

    // Sort by latency, healthy first
    statuses.sort((a, b) => {
      if (a.healthy !== b.healthy) return a.healthy ? -1 : 1;
      return (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity);
    });

    this.endpointStatuses.set(statuses);
    this.selectedEndpointIndex.set(0);
  }

  selectEndpoint(index: number) {
    this.selectedEndpointIndex.set(index);
  }
}
