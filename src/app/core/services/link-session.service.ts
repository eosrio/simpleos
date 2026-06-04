import { Injectable } from '@angular/core';

/**
 * Anchor-link sealed-session transport — DISABLED for v1 (R4).
 *
 * The persistent buoy WebSocket + SealedMessage (AES-256-CBC) channel was
 * dropped: it was unauthenticated, had no replay protection, and did not pin the
 * peer key (SEC-014 / SEC-032 / SEC-058), and the persistent anchor-link session
 * is not launch-critical. ESR remains fully supported via `esr://` deep links
 * and the dapp browser's `esr:` navigation interception, which deliver requests
 * straight to {@link EsrService} (and now flow through the trusted confirmation
 * window).
 *
 * This stub preserves the public surface so callers don't need conditional
 * wiring. `setEsrHandler` is retained for source compatibility but is no longer
 * invoked (no sealed-session messages arrive); `restoreSessions` is a no-op.
 *
 * If a persistent session is reintroduced later, it must use an authenticated
 * AEAD construction + nonce/replay tracking + peer-key pinning (see the
 * remediation plan), never the raw CBC format.
 */
@Injectable({ providedIn: 'root' })
export class LinkSessionService {
  private esrHandler: ((uri: string) => void) | null = null;

  /** Retained for source compatibility; the handler is no longer invoked here. */
  setEsrHandler(handler: (uri: string) => void): void {
    this.esrHandler = handler;
  }

  /** No persistent sessions in v1. */
  async restoreSessions(): Promise<void> {
    void this.esrHandler;
  }
}
