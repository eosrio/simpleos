/**
 * WebKitGTK mouse wheel scroll fix.
 *
 * WebKitGTK (used by Tauri on Linux) has a long-standing bug where mouse wheel
 * scrolling is extremely sluggish due to its smooth-scrolling implementation.
 * Scroll bar dragging works fine — only the wheel pipeline is broken.
 *
 * Fix: intercept wheel events, find the nearest scrollable ancestor, and apply
 * the delta directly via scrollBy(). This bypasses WebKit's smooth-scroll path.
 *
 * Refs:
 *   https://github.com/tauri-apps/tauri/issues/3308
 *   https://bugs.webkit.org/show_bug.cgi?id=210460
 */

const SCROLL_MULTIPLIER = 1; // Line-mode already gives reasonable deltas once we bypass smooth.
const LINE_HEIGHT_PX = 40;   // Used when deltaMode === DOM_DELTA_LINE.
const PAGE_HEIGHT_PX = 400;  // Used when deltaMode === DOM_DELTA_PAGE.

function isScrollable(el: Element): boolean {
  const style = getComputedStyle(el);
  const overflowY = style.overflowY;
  const overflowX = style.overflowX;
  const canScrollY =
    (overflowY === 'auto' || overflowY === 'scroll') &&
    el.scrollHeight > el.clientHeight;
  const canScrollX =
    (overflowX === 'auto' || overflowX === 'scroll') &&
    el.scrollWidth > el.clientWidth;
  return canScrollY || canScrollX;
}

function findScrollableAncestor(target: EventTarget | null): Element | null {
  let node = target as Element | null;
  while (node && node !== document.body && node !== document.documentElement) {
    if (isScrollable(node)) return node;
    node = node.parentElement;
  }
  // Fall through to scrolling element (html/body)
  return document.scrollingElement ?? document.documentElement;
}

function normalizeDelta(e: WheelEvent): { dx: number; dy: number } {
  let { deltaX, deltaY } = e;
  if (e.deltaMode === 1 /* DOM_DELTA_LINE */) {
    deltaX *= LINE_HEIGHT_PX;
    deltaY *= LINE_HEIGHT_PX;
  } else if (e.deltaMode === 2 /* DOM_DELTA_PAGE */) {
    deltaX *= PAGE_HEIGHT_PX;
    deltaY *= PAGE_HEIGHT_PX;
  }
  return { dx: deltaX * SCROLL_MULTIPLIER, dy: deltaY * SCROLL_MULTIPLIER };
}

/**
 * Enable the wheel scroll fix. Safe to call once at app startup.
 * Only activates on Linux where WebKitGTK is in use.
 */
export function installWheelScrollFix(): void {
  // Only needed on Linux (WebKitGTK). macOS uses WKWebView, Windows uses WebView2 — both are fine.
  const ua = navigator.userAgent;
  if (!/Linux/i.test(ua)) return;

  const onWheel = (e: WheelEvent) => {
    // Let the OS handle pinch-zoom and ctrl-wheel (zoom) gestures.
    if (e.ctrlKey) return;

    const scrollable = findScrollableAncestor(e.target);
    if (!scrollable) return;

    const { dx, dy } = normalizeDelta(e);
    if (dx === 0 && dy === 0) return;

    e.preventDefault();
    scrollable.scrollBy({ left: dx, top: dy, behavior: 'instant' as ScrollBehavior });
  };

  window.addEventListener('wheel', onWheel, { passive: false });
}
