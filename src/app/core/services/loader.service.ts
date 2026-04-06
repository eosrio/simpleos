import { Injectable, signal } from '@angular/core';

/**
 * Global fullscreen loader controller.
 *
 * Use for long-running synchronous-feeling operations (PIN unlock,
 * vault decryption, chain imports) where we need to block the UI
 * and show a branded loading state.
 *
 * Supports nested calls via reference counting so multiple async
 * operations can share the overlay without fighting each other.
 */
@Injectable({ providedIn: 'root' })
export class LoaderService {
  /** Whether the overlay should be visible. */
  readonly visible = signal(false);

  /** Primary status line (e.g. "Unlocking wallet"). */
  readonly message = signal('Loading');

  /** Optional secondary hint (e.g. "Deriving key from PIN"). */
  readonly hint = signal<string | null>(null);

  private depth = 0;

  /**
   * Show the overlay. Safe to call from nested contexts — the overlay
   * stays visible until a matching `hide()` for every `show()`.
   */
  show(message = 'Loading', hint: string | null = null): void {
    this.depth++;
    this.message.set(message);
    this.hint.set(hint);
    this.visible.set(true);
  }

  /** Update text without changing visibility (e.g. advancing between stages). */
  update(message: string, hint: string | null = null): void {
    this.message.set(message);
    this.hint.set(hint);
  }

  /** Hide one level of the overlay. Only closes when depth reaches zero. */
  hide(): void {
    this.depth = Math.max(0, this.depth - 1);
    if (this.depth === 0) {
      this.visible.set(false);
      this.hint.set(null);
    }
  }

  /** Force-close the overlay regardless of depth. Use sparingly. */
  reset(): void {
    this.depth = 0;
    this.visible.set(false);
    this.hint.set(null);
  }

  /**
   * Convenience wrapper: runs `fn` with the overlay visible and hides it
   * when the promise settles (success or failure). Yields to the browser
   * between showing the overlay and running `fn` so the first frame is
   * painted before any CPU-heavy work starts.
   */
  async wrap<T>(message: string, fn: () => Promise<T>, hint: string | null = null): Promise<T> {
    this.show(message, hint);
    await this.yieldToPaint();
    try {
      return await fn();
    } finally {
      this.hide();
    }
  }

  /**
   * Resolves after the browser has had a chance to paint the current
   * signal state. Use this after `show()` when the next line of code
   * is CPU-heavy (crypto, decryption, large sync parsing) so the
   * overlay actually appears instead of being stuck behind a frozen
   * main thread.
   *
   * We wait for two animation frames: the first schedules the paint
   * after Angular's change-detection microtask flushes the signal
   * update; the second fires only after the frame has been committed
   * to the screen.
   */
  yieldToPaint(): Promise<void> {
    return new Promise<void>(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  }
}
