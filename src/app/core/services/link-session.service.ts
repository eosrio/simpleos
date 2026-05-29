import { Injectable, inject, effect } from '@angular/core';
import { TauriIpcService } from './tauri-ipc.service';
import { WalletStateService } from './wallet-state.service';
import { AlertService } from './alert.service';

const DEFAULT_BUOY_URL = 'cb.anchor.link';
const STORE_KEY = 'link_sessions';
const BUOY_URL_KEY = 'buoy_url';

export interface LinkSessionMeta {
  /** Hex-encoded compressed public key (for keystore lookups and crypto ops) */
  linkKeyHex: string;
  /** Full channel URL (https://...) */
  channelUrl: string;
  /** Channel UUID (path segment for WebSocket) */
  channelUuid: string;
  /** Buoy host used for this session */
  buoyUrl: string;
  /** Chain ID this session is associated with */
  chainId: string;
  /** dApp name or identifier (from the ESR callback) */
  appName?: string;
}

interface SealedMessage {
  from: string;
  nonce: number | string;
  ciphertext: string;
  checksum: number;
}

@Injectable({ providedIn: 'root' })
export class LinkSessionService {
  private ipc = inject(TauriIpcService);
  private wallet = inject(WalletStateService);
  private alert = inject(AlertService);

  private connections = new Map<string, WebSocket>();
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private reconnectAttempts = new Map<string, number>();

  /** Queued sealed messages received while the wallet was locked */
  private pendingMessages: Array<{ session: LinkSessionMeta; msg: SealedMessage }> = [];

  /** EsrService reference, set lazily to avoid circular DI */
  private esrHandler: ((uri: string) => void) | null = null;

  constructor() {
    // When wallet unlocks, process any queued messages
    effect(() => {
      const locked = this.wallet.locked();
      if (!locked && this.pendingMessages.length > 0) {
        const msgs = [...this.pendingMessages];
        this.pendingMessages = [];
        for (const { session, msg } of msgs) {
          this.processMessage(session, msg);
        }
      }
    });
  }

  /** Set the ESR handler function (called by EsrService to avoid circular DI) */
  setEsrHandler(handler: (uri: string) => void) {
    this.esrHandler = handler;
  }

  /** Get the configured buoy URL, or the default */
  async getBuoyUrl(): Promise<string> {
    const custom = await this.ipc.storeGet<string>(BUOY_URL_KEY);
    return custom || DEFAULT_BUOY_URL;
  }

  /** Create a new session and start listening on the channel */
  async createSession(chainId: string): Promise<{ channelUrl: string; linkKey: string; linkName: string }> {
    const buoyUrl = await this.getBuoyUrl();
    const info = await this.ipc.createLinkSession(buoyUrl);

    const meta: LinkSessionMeta = {
      linkKeyHex: info.link_key_hex,
      channelUrl: info.channel_url,
      channelUuid: info.channel_uuid,
      buoyUrl,
      chainId,
    };

    // Persist session metadata
    const sessions = await this.loadSessions();
    sessions.push(meta);
    await this.ipc.storeSet(STORE_KEY, sessions);

    // Start WebSocket listener
    this.connectChannel(meta);

    return {
      channelUrl: info.channel_url,
      linkKey: info.link_key,
      linkName: info.link_name,
    };
  }

  /** Restore and reconnect all persisted sessions (called on app startup) */
  async restoreSessions(): Promise<void> {
    const sessions = await this.loadSessions();
    if (sessions.length === 0) return;

    console.log(`[link-session] Restoring ${sessions.length} session(s)...`);
    for (const session of sessions) {
      this.connectChannel(session);
    }
  }

  /** Delete a session: close WebSocket, remove key, remove from store */
  async deleteSession(linkKeyHex: string): Promise<void> {
    this.closeChannel(linkKeyHex);
    await this.ipc.deleteLinkSession(linkKeyHex).catch(() => {});

    const sessions = await this.loadSessions();
    const filtered = sessions.filter(s => s.linkKeyHex !== linkKeyHex);
    await this.ipc.storeSet(STORE_KEY, filtered);

    console.log(`[link-session] Deleted session ${linkKeyHex.slice(0, 16)}`);
  }

  /** Close all WebSocket connections */
  destroy() {
    for (const [key] of this.connections) {
      this.closeChannel(key);
    }
  }

  /** Get all active sessions */
  async getSessions(): Promise<LinkSessionMeta[]> {
    return this.loadSessions();
  }

  // ── Private ──

  private async loadSessions(): Promise<LinkSessionMeta[]> {
    return (await this.ipc.storeGet<LinkSessionMeta[]>(STORE_KEY)) || [];
  }

  private connectChannel(session: LinkSessionMeta) {
    const { linkKeyHex, channelUuid, buoyUrl } = session;

    // Don't double-connect
    if (this.connections.has(linkKeyHex)) return;

    const wsUrl = `wss://${buoyUrl}/${channelUuid}`;
    console.log(`[link-session] Connecting to ${wsUrl}`);

    const ws = new WebSocket(wsUrl);
    this.connections.set(linkKeyHex, ws);

    ws.onopen = () => {
      console.log(`[link-session] Channel open: ${linkKeyHex.slice(0, 16)}`);
      this.reconnectAttempts.set(linkKeyHex, 0);
    };

    ws.onmessage = (event) => {
      try {
        const msg: SealedMessage = JSON.parse(event.data);
        if (!msg.from || msg.nonce === undefined || !msg.ciphertext) {
          console.warn('[link-session] Ignoring malformed message:', event.data);
          return;
        }

        if (this.wallet.locked()) {
          console.log('[link-session] Wallet locked, queuing sealed message');
          this.pendingMessages.push({ session, msg });
          this.alert.info('Signing request received. Please unlock your wallet.');
          return;
        }

        this.processMessage(session, msg);
      } catch (err) {
        console.error('[link-session] Failed to handle message:', err);
      }
    };

    ws.onclose = (event) => {
      console.log(`[link-session] Channel closed: ${linkKeyHex.slice(0, 16)}, code=${event.code}`);
      this.connections.delete(linkKeyHex);
      this.scheduleReconnect(session);
    };

    ws.onerror = (err) => {
      console.error(`[link-session] Channel error: ${linkKeyHex.slice(0, 16)}`, err);
    };
  }

  private async processMessage(session: LinkSessionMeta, msg: SealedMessage) {
    try {
      console.log(`[link-session] Decrypting message from ${msg.from.slice(0, 16)}`);
      const nonce = typeof msg.nonce === 'string' ? parseInt(msg.nonce, 10) : msg.nonce;
      const esrUri = await this.ipc.unsealMessage(
        msg.ciphertext,
        nonce,
        msg.from,
        session.linkKeyHex,
      );

      console.log('[link-session] Decrypted ESR request, routing to handler');
      if (this.esrHandler) {
        this.esrHandler(esrUri);
      } else {
        console.warn('[link-session] No ESR handler registered, dropping message');
      }
    } catch (err: any) {
      console.error('[link-session] Failed to unseal message:', err);
      this.alert.error(`Failed to decrypt signing request: ${err?.message ?? err}`);
    }
  }

  private closeChannel(linkKeyHex: string) {
    const ws = this.connections.get(linkKeyHex);
    if (ws) {
      ws.onclose = null; // Prevent reconnect
      ws.close();
      this.connections.delete(linkKeyHex);
    }
    const timer = this.reconnectTimers.get(linkKeyHex);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(linkKeyHex);
    }
    this.reconnectAttempts.delete(linkKeyHex);
  }

  private scheduleReconnect(session: LinkSessionMeta) {
    const { linkKeyHex } = session;
    const attempts = this.reconnectAttempts.get(linkKeyHex) || 0;
    const delay = Math.min(1000 * Math.pow(2, attempts), 30000);

    console.log(`[link-session] Reconnecting ${linkKeyHex.slice(0, 16)} in ${delay}ms (attempt ${attempts + 1})`);

    const timer = setTimeout(() => {
      this.reconnectTimers.delete(linkKeyHex);
      this.reconnectAttempts.set(linkKeyHex, attempts + 1);
      this.connectChannel(session);
    }, delay);

    this.reconnectTimers.set(linkKeyHex, timer);
  }
}
