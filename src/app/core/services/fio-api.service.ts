import { Injectable, inject } from '@angular/core';
import { TauriIpcService } from './tauri-ipc.service';

export interface FioNamesResponse {
  fio_domains: {
    fio_domain: string;
    expiration: string;
    is_public: number;
  }[];
  fio_addresses: {
    fio_address: string;
    expiration: string;
  }[];
}

@Injectable({ providedIn: 'root' })
export class FioApiService {
  private ipc = inject(TauriIpcService);

  /**
   * Fetch all domains and addresses owned by a specific FIO public key.
   */
  async getFioNames(chainId: string, publicKey: string): Promise<FioNamesResponse> {
    try {
      const data = await this.ipc.fioGetNames(chainId, publicKey);
      return {
        fio_domains: data.fio_domains || [],
        fio_addresses: data.fio_addresses || []
      };
    } catch {
      return { fio_domains: [], fio_addresses: [] };
    }
  }

  /**
   * Use the native Rust bindings to fetch the minimum required max_fee.
   * Typical endPoints: 'register_fio_address', 'register_fio_domain', 'renew_fio_domain'
   */
  async getFee(chainId: string, endpointName: string, fioAddress: string = ''): Promise<number> {
    const res = await this.ipc.fioGetFee(chainId, endpointName, fioAddress);
    // Add a safe margin of 20% to prevent "fee exceeds max_fee" boundary errors
    const feeWithMargin = Math.floor(res.fee * 1.2);
    return feeWithMargin;
  }
}
