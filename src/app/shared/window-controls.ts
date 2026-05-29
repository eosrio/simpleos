import { Component, OnDestroy, OnInit, signal } from '@angular/core';

/**
 * Flat window controls (minimize / maximize / close) for the custom titlebar.
 *
 * Renders nothing when running outside Tauri (plain browser dev server) or on
 * macOS — on macOS the window uses `titleBarStyle: "Overlay"` so the native
 * traffic lights remain visible and handle these actions.
 *
 * The close button delegates to `window.close()`, which is intercepted by the
 * Rust `on_window_event` CloseRequested handler — so it respects the user's
 * close-to-tray preference automatically.
 */
@Component({
  selector: 'app-window-controls',
  standalone: true,
  template: `
    @if (visible()) {
      <div class="win-controls">
        <button class="win-btn" type="button" tabindex="-1" aria-label="Minimize" (click)="minimize()">
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M0 5 H10" stroke="currentColor" stroke-width="1" />
          </svg>
        </button>
        <button class="win-btn" type="button" tabindex="-1"
                [attr.aria-label]="maximized() ? 'Restore' : 'Maximize'"
                (click)="toggleMaximize()">
          @if (maximized()) {
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
              <rect x="1.5" y="2.5" width="6" height="6" />
              <path d="M3 2.5 V1 H8.5 V7" />
            </svg>
          } @else {
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
              <rect x="1" y="1" width="8" height="8" />
            </svg>
          }
        </button>
        <button class="win-btn close" type="button" tabindex="-1" aria-label="Close" (click)="close()">
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M1 1 L9 9 M9 1 L1 9" stroke="currentColor" stroke-width="1" />
          </svg>
        </button>
      </div>
    }
  `,
  styles: [`
    :host {
      display: contents;
    }
    .win-controls {
      display: flex;
      align-self: stretch;
      flex-shrink: 0;
      -webkit-app-region: no-drag;
    }
    .win-btn {
      width: 46px;
      min-width: 46px;
      align-self: stretch;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      margin: 0;
      background: transparent;
      border: 0;
      color: var(--text-muted);
      cursor: pointer;
      transition: background 120ms ease, color 120ms ease;
      -webkit-app-region: no-drag;
    }
    .win-btn:hover {
      background: var(--bg-hover);
      color: var(--text-bright);
    }
    .win-btn.close:hover {
      background: #e81123;
      color: #fff;
    }
    .win-btn:focus { outline: none; }
    .win-btn:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }
  `],
})
export class WindowControlsComponent implements OnInit, OnDestroy {
  readonly visible = signal(false);
  readonly maximized = signal(false);

  private unlistenResize?: () => void;

  async ngOnInit() {
    // Skip in SSR / plain browser dev server
    if (typeof window === 'undefined') return;
    if (!('__TAURI_INTERNALS__' in window)) return;

    // On macOS we keep native traffic lights — don't draw our own.
    const isMac = /Mac/i.test(navigator.platform) || /Mac/i.test(navigator.userAgent);
    if (isMac) return;

    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      this.visible.set(true);
      this.maximized.set(await win.isMaximized());
      this.unlistenResize = await win.onResized(async () => {
        this.maximized.set(await win.isMaximized());
      });
    } catch (err) {
      console.warn('[window-controls] failed to initialize:', err);
    }
  }

  ngOnDestroy() {
    this.unlistenResize?.();
  }

  private async withWindow(action: (win: Awaited<ReturnType<typeof import('@tauri-apps/api/window').getCurrentWindow>>) => Promise<void>) {
    if (!this.visible()) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await action(getCurrentWindow());
    } catch (err) {
      console.warn('[window-controls] action failed:', err);
    }
  }

  minimize() { this.withWindow(w => w.minimize()); }
  toggleMaximize() { this.withWindow(w => w.toggleMaximize()); }
  close() { this.withWindow(w => w.close()); }
}
