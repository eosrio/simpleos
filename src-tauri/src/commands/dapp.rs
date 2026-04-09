use tauri::{AppHandle, Emitter, Manager, WebviewUrl};

const DAPP_LABEL: &str = "dapp-browser";

fn get_dapp_window(app: &AppHandle) -> Option<tauri::WebviewWindow> {
    app.get_webview_window(DAPP_LABEL)
}

/// Open a DApp in a separate managed WebviewWindow.
///
/// This avoids the z-order and coordinate issues of child webviews on Linux/X11.
/// The DApp window is a standalone OS window with the Anchor bridge injected.
#[tauri::command]
pub async fn open_dapp_browser(app: AppHandle, url: String, title: String) -> Result<(), String> {
    // Close existing dapp window if any
    if let Some(win) = get_dapp_window(&app) {
        let _ = win.close();
    }

    let parsed: url::Url = url.parse().map_err(|e: url::ParseError| e.to_string())?;

    let nav_handle = app.clone();

    let dapp_window =
        tauri::WebviewWindowBuilder::new(&app, DAPP_LABEL, WebviewUrl::External(parsed.clone()))
            .title(format!("{} — SimplEOS", title))
            .inner_size(1024.0, 768.0)
            .min_inner_size(480.0, 360.0)
            .resizable(true)
            .center()
            .initialization_script(ANCHOR_BRIDGE_SCRIPT)
            .initialization_script(WHEEL_SCROLL_FIX_SCRIPT)
            .on_navigation(move |nav_url| {
                let url_str = nav_url.to_string();
                let scheme = nav_url.scheme();

                // Intercept ESR (EOSIO Signing Request) URIs — these are how
                // anchor-link DApps trigger wallet signing via the `esr://` protocol.
                if scheme == "esr" || scheme == "esr-anchor" || scheme == "anchor" {
                    log::info!("[dapp] Intercepted ESR request: {}", &url_str);
                    let _ = nav_handle.emit_to("main", "dapp-esr-request", &url_str);
                    return false; // Block the navigation — we handle it ourselves
                }

                let _ = nav_handle.emit_to("main", "dapp-navigation", &url_str);

                // Allow about:blank (used by some sites for iframes/popups)
                if scheme == "about" {
                    return true;
                }
                if scheme != "https" && scheme != "http" {
                    log::warn!("[dapp] Blocked navigation to non-HTTP scheme: {}", scheme);
                    return false;
                }
                let host = nav_url.host_str().unwrap_or("");
                if scheme == "http" && host != "localhost" && host != "127.0.0.1" {
                    log::warn!("[dapp] Blocked insecure HTTP navigation to: {}", host);
                    return false;
                }
                true
            })
            .build()
            .map_err(|e| e.to_string())?;

    // Emit the initial URL
    let _ = app.emit_to("main", "dapp-navigation", parsed.to_string());

    // When the dapp window is closed (by the user clicking X), notify the main
    // window so Angular can reset its state.
    let close_handle = app.clone();
    dapp_window.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            let _ = close_handle.emit_to("main", "dapp-closed", ());
        }
    });

    Ok(())
}

/// Close the DApp browser window.
#[tauri::command]
pub async fn close_dapp_browser(app: AppHandle) -> Result<(), String> {
    if let Some(win) = get_dapp_window(&app) {
        win.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Navigate the dapp browser to a new URL.
#[tauri::command]
pub async fn navigate_dapp(app: AppHandle, url: String) -> Result<(), String> {
    let win = get_dapp_window(&app).ok_or("DApp browser not open")?;
    let parsed: url::Url = url.parse().map_err(|e: url::ParseError| e.to_string())?;
    win.navigate(parsed).map_err(|e| e.to_string())
}

/// Reload the current dapp page.
#[tauri::command]
pub async fn reload_dapp(app: AppHandle) -> Result<(), String> {
    let win = get_dapp_window(&app).ok_or("DApp browser not open")?;
    win.eval("location.reload()")
        .map_err(|e: tauri::Error| e.to_string())
}

/// Navigate back in the dapp browser history.
#[tauri::command]
pub async fn dapp_go_back(app: AppHandle) -> Result<(), String> {
    let win = get_dapp_window(&app).ok_or("DApp browser not open")?;
    win.eval("history.back()")
        .map_err(|e: tauri::Error| e.to_string())
}

/// Navigate forward in the dapp browser history.
#[tauri::command]
pub async fn dapp_go_forward(app: AppHandle) -> Result<(), String> {
    let win = get_dapp_window(&app).ok_or("DApp browser not open")?;
    win.eval("history.forward()")
        .map_err(|e: tauri::Error| e.to_string())
}

/// Deliver a signing result back to the dapp webview.
#[tauri::command]
pub async fn dapp_resolve_signing(
    app: AppHandle,
    request_id: String,
    result: serde_json::Value,
) -> Result<(), String> {
    let win = get_dapp_window(&app).ok_or("DApp browser not open")?;
    let json = serde_json::to_string(&result).map_err(|e| e.to_string())?;
    let script = format!(
        "window.__simpleos_bridge && window.__simpleos_bridge._resolveRequest('{}', {})",
        request_id, json
    );
    win.eval(&script).map_err(|e: tauri::Error| e.to_string())
}

/// Reject a signing request back to the dapp webview.
#[tauri::command]
pub async fn dapp_reject_signing(
    app: AppHandle,
    request_id: String,
    reason: String,
) -> Result<(), String> {
    let win = get_dapp_window(&app).ok_or("DApp browser not open")?;
    let script = format!(
        "window.__simpleos_bridge && window.__simpleos_bridge._rejectRequest('{}', '{}')",
        request_id,
        reason.replace('\'', "\\'")
    );
    win.eval(&script).map_err(|e: tauri::Error| e.to_string())
}

/// Anchor protocol bridge injected into every dapp webview.
///
/// This script impersonates the Anchor Wallet by:
/// 1. Intercepting `eosjs` SignatureProvider calls
/// 2. Intercepting `anchor-link` transport connection attempts
/// 3. Posting signing requests to the parent Tauri window via events
/// 4. Resolving/rejecting promises when the wallet responds
///
/// DApps see this wallet as "Anchor" and can interact normally.
const ANCHOR_BRIDGE_SCRIPT: &str = r#"
(function() {
    'use strict';

    // ── State ──
    const pendingRequests = {};
    let requestCounter = 0;

    // ── Bridge API (called by Tauri to resolve/reject) ──
    window.__simpleos_bridge = {
        version: '2.0.0',
        bridge: 'anchor-compat',
        ready: true,

        _resolveRequest(id, result) {
            const pending = pendingRequests[id];
            if (pending) {
                pending.resolve(result);
                delete pendingRequests[id];
            }
        },

        _rejectRequest(id, reason) {
            const pending = pendingRequests[id];
            if (pending) {
                pending.reject(new Error(reason || 'User rejected the request'));
                delete pendingRequests[id];
            }
        },

        // Called by dApps or anchor-link to submit a signing request
        async sign(actions, chainId) {
            const id = 'req_' + (++requestCounter) + '_' + Date.now();

            return new Promise((resolve, reject) => {
                pendingRequests[id] = { resolve, reject };

                // Post to parent Tauri window
                if (window.__TAURI_INTERNALS__) {
                    window.__TAURI_INTERNALS__.invoke('plugin:event|emit', {
                        event: 'dapp-signing-request',
                        payload: JSON.stringify({
                            id: id,
                            actions: actions,
                            chainId: chainId || null,
                            origin: window.location.origin,
                            timestamp: Date.now(),
                        }),
                    }).catch(function(err) {
                        // Fallback: try postMessage
                        console.warn('[SimplEOS Bridge] emit failed, trying postMessage:', err);
                        window.parent.postMessage({
                            type: 'simpleos-signing-request',
                            id: id,
                            actions: actions,
                            chainId: chainId,
                            origin: window.location.origin,
                        }, '*');
                    });
                }

                // Auto-reject after 5 minutes
                setTimeout(function() {
                    if (pendingRequests[id]) {
                        pendingRequests[id].reject(new Error('Signing request timed out'));
                        delete pendingRequests[id];
                    }
                }, 300000);
            });
        },
    };

    // ── Anchor Link Transport Impersonation ──
    class SimpleOSTransport {
        constructor(options) {
            this.options = options || {};
        }

        async prepare(request, session) {
            return request;
        }

        async showLoading() {}
        async hideLoading() {}

        async sign(resolved) {
            const actions = [];
            if (resolved && resolved.transaction) {
                const trx = resolved.transaction;
                if (trx.actions) {
                    for (const act of trx.actions) {
                        actions.push({
                            account: typeof act.account === 'string' ? act.account : act.account.toString(),
                            name: typeof act.name === 'string' ? act.name : act.name.toString(),
                            authorization: act.authorization.map(function(auth) {
                                return {
                                    actor: typeof auth.actor === 'string' ? auth.actor : auth.actor.toString(),
                                    permission: typeof auth.permission === 'string' ? auth.permission : auth.permission.toString(),
                                };
                            }),
                            data: act.data,
                        });
                    }
                }
            }

            const chainId = resolved.request ? resolved.request.getChainId() : null;
            const result = await window.__simpleos_bridge.sign(actions, chainId);
            return result;
        }

        async onSuccess(request, result) {}
        async onFailure(request, error) {}
        async onRequest(request, cancel) {}
    }

    // Expose transport globally so anchor-link can find it
    window.AnchorLinkBrowserTransport = SimpleOSTransport;
    window.SimpleOSTransport = SimpleOSTransport;

    // ── UAL (Universal Authenticator Library) Support ──
    if (!window.__simpleos_ual_registered) {
        window.__simpleos_ual_registered = true;
        window.scatter = window.scatter || null;
        window.dispatchEvent(new CustomEvent('simpleos:ready', { detail: { version: '2.0.0' } }));
    }

    console.log('[SimplEOS] Anchor signing bridge loaded (v2.0)');
})();
"#;

/// WebKitGTK wheel scroll fix — injected into the DApp window on Linux.
///
/// WebKitGTK's smooth-scrolling is broken, making mouse wheel scrolling extremely
/// sluggish. This intercepts wheel events and applies the delta directly via
/// scrollBy(), bypassing the broken smooth-scroll pipeline.
///
/// Refs:
///   https://github.com/tauri-apps/tauri/issues/3308
///   https://bugs.webkit.org/show_bug.cgi?id=210460
const WHEEL_SCROLL_FIX_SCRIPT: &str = r#"
(function() {
    'use strict';
    if (!/Linux/i.test(navigator.userAgent)) return;

    var LINE_HEIGHT = 40;
    var PAGE_HEIGHT = 400;

    function isScrollable(el) {
        var s = getComputedStyle(el);
        var oy = s.overflowY, ox = s.overflowX;
        return ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) ||
               ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth);
    }

    function findScrollable(target) {
        var node = target;
        while (node && node !== document.body && node !== document.documentElement) {
            if (isScrollable(node)) return node;
            node = node.parentElement;
        }
        return document.scrollingElement || document.documentElement;
    }

    window.addEventListener('wheel', function(e) {
        if (e.ctrlKey) return;
        var el = findScrollable(e.target);
        if (!el) return;
        var dx = e.deltaX, dy = e.deltaY;
        if (e.deltaMode === 1) { dx *= LINE_HEIGHT; dy *= LINE_HEIGHT; }
        else if (e.deltaMode === 2) { dx *= PAGE_HEIGHT; dy *= PAGE_HEIGHT; }
        if (dx === 0 && dy === 0) return;
        e.preventDefault();
        el.scrollBy({ left: dx, top: dy, behavior: 'instant' });
    }, { passive: false });
})();
"#;
