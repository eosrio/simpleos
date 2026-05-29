import { Component, OnDestroy, OnInit, signal } from '@angular/core';

type ResizeDirection =
  | 'North' | 'NorthEast' | 'East' | 'SouthEast'
  | 'South' | 'SouthWest' | 'West' | 'NorthWest';

/**
 * Invisible resize handles for the custom frameless window.
 *
 * Tauri v2 with `decorations: false` does not provide edge-resize handles
 * on Linux (GTK/WebKit) — unlike Windows and macOS which have some native
 * edge detection. We draw 8 thin `position: fixed` elements (4 edges, 4
 * corners) that call `startResizeDragging()` on mousedown with the correct
 * direction. They hide themselves when the window is maximized.
 *
 * Mount this once at the app root so it overlays every route.
 */
@Component({
  selector: 'app-resize-handles',
  standalone: true,
  template: `
    @if (enabled()) {
      <div class="rh rh-n"  (mousedown)="start($event, 'North')"></div>
      <div class="rh rh-s"  (mousedown)="start($event, 'South')"></div>
      <div class="rh rh-w"  (mousedown)="start($event, 'West')"></div>
      <div class="rh rh-e"  (mousedown)="start($event, 'East')"></div>
      <div class="rh rh-nw" (mousedown)="start($event, 'NorthWest')"></div>
      <div class="rh rh-ne" (mousedown)="start($event, 'NorthEast')"></div>
      <div class="rh rh-sw" (mousedown)="start($event, 'SouthWest')"></div>
      <div class="rh rh-se" (mousedown)="start($event, 'SouthEast')"></div>
    }
  `,
  styles: [`
    :host { display: contents; }
    .rh {
      position: fixed;
      z-index: 9999;
      background: transparent;
      /* Edges sit outside any drag region, so no -webkit-app-region needed. */
    }
    /* Edges — 4px thick, inset 10px from corners so corner handles win there. */
    .rh-n { top: 0;    left: 10px; right: 10px; height: 4px; cursor: n-resize; }
    .rh-s { bottom: 0; left: 10px; right: 10px; height: 4px; cursor: s-resize; }
    .rh-w { left: 0;  top: 10px;  bottom: 10px; width: 4px;  cursor: w-resize; }
    .rh-e { right: 0; top: 10px;  bottom: 10px; width: 4px;  cursor: e-resize; }
    /* Corners — 10×10 squares with diagonal cursors. */
    .rh-nw { top: 0;    left: 0;    width: 10px; height: 10px; cursor: nw-resize; }
    .rh-ne { top: 0;    right: 0;   width: 10px; height: 10px; cursor: ne-resize; }
    .rh-sw { bottom: 0; left: 0;    width: 10px; height: 10px; cursor: sw-resize; }
    .rh-se { bottom: 0; right: 0;   width: 10px; height: 10px; cursor: se-resize; }
  `],
})
export class ResizeHandlesComponent implements OnInit, OnDestroy {
  readonly enabled = signal(false);
  private unlistenResize?: () => void;

  async ngOnInit() {
    if (typeof window === 'undefined') return;
    if (!('__TAURI_INTERNALS__' in window)) return;

    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      const maximized = await win.isMaximized();
      this.enabled.set(!maximized);
      this.unlistenResize = await win.onResized(async () => {
        this.enabled.set(!(await win.isMaximized()));
      });
    } catch (err) {
      console.warn('[resize-handles] init failed:', err);
    }
  }

  ngOnDestroy() {
    this.unlistenResize?.();
  }

  async start(e: MouseEvent, direction: ResizeDirection) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().startResizeDragging(direction);
    } catch (err) {
      console.warn('[resize-handles] start failed:', err);
    }
  }
}
