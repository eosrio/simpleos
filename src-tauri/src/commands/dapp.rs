use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, WebviewUrl};

const DAPP_LABEL: &str = "dapp-browser";

fn get_dapp_webview(app: &AppHandle) -> Option<tauri::Webview> {
    app.get_webview(DAPP_LABEL)
}

/// Open an in-app child webview positioned over the specified rectangle
/// within the main window.
#[tauri::command]
pub async fn open_dapp_browser(
    app: AppHandle,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    // Close existing dapp webview if any
    if let Some(wv) = get_dapp_webview(&app) {
        let _ = wv.close();
    }

    let parsed: url::Url = url.parse().map_err(|e: url::ParseError| e.to_string())?;

    let main_window = app
        .get_window("main")
        .ok_or("Main window not found")?;

    // Clone handle for the on_navigation closure
    let nav_handle = app.clone();

    let builder =
        tauri::webview::WebviewBuilder::new(DAPP_LABEL, WebviewUrl::External(parsed.clone()))
            .initialization_script(ANCHOR_BRIDGE_SCRIPT)
            .on_navigation(move |nav_url| {
                // Emit navigation event to the main webview so the Angular chrome bar
                // can update the displayed URL.
                let url_str = nav_url.to_string();
                let _ = nav_handle.emit_to("main", "dapp-navigation", &url_str);

                // CSP: Block non-HTTPS navigations (except localhost for dev)
                let scheme = nav_url.scheme();
                if scheme != "https" && scheme != "http" {
                    // Block data:, javascript:, blob: navigations
                    log::warn!("[dapp] Blocked navigation to non-HTTP scheme: {}", scheme);
                    return false;
                }
                // Allow localhost/127.0.0.1 for development
                let host = nav_url.host_str().unwrap_or("");
                if scheme == "http" && host != "localhost" && host != "127.0.0.1" {
                    log::warn!("[dapp] Blocked insecure HTTP navigation to: {}", host);
                    return false;
                }
                true
            });

    main_window
        .add_child(
            builder,
            LogicalPosition::new(x, y),
            LogicalSize::new(width, height),
        )
        .map_err(|e| e.to_string())?;

    // Emit the initial URL so the chrome bar picks it up immediately
    let _ = app.emit_to("main", "dapp-navigation", parsed.to_string());

    Ok(())
}

/// Close the dapp browser webview.
#[tauri::command]
pub async fn close_dapp_browser(app: AppHandle) -> Result<(), String> {
    if let Some(wv) = get_dapp_webview(&app) {
        wv.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Navigate the dapp browser to a new URL.
#[tauri::command]
pub async fn navigate_dapp(app: AppHandle, url: String) -> Result<(), String> {
    let wv = get_dapp_webview(&app).ok_or("DApp browser not open")?;
    let parsed: url::Url = url.parse().map_err(|e: url::ParseError| e.to_string())?;
    wv.navigate(parsed).map_err(|e| e.to_string())
}

/// Resize and reposition the dapp browser webview.
#[tauri::command]
pub async fn resize_dapp_browser(
    app: AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let wv = get_dapp_webview(&app).ok_or("DApp browser not open")?;
    wv.set_position(LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
    wv.set_size(LogicalSize::new(width, height))
        .map_err(|e| e.to_string())
}

/// Reload the current dapp page.
#[tauri::command]
pub async fn reload_dapp(app: AppHandle) -> Result<(), String> {
    let wv = get_dapp_webview(&app).ok_or("DApp browser not open")?;
    wv.eval("location.reload()").map_err(|e: tauri::Error| e.to_string())
}

/// Navigate back in the dapp browser history.
#[tauri::command]
pub async fn dapp_go_back(app: AppHandle) -> Result<(), String> {
    let wv = get_dapp_webview(&app).ok_or("DApp browser not open")?;
    wv.eval("history.back()").map_err(|e: tauri::Error| e.to_string())
}

/// Navigate forward in the dapp browser history.
#[tauri::command]
pub async fn dapp_go_forward(app: AppHandle) -> Result<(), String> {
    let wv = get_dapp_webview(&app).ok_or("DApp browser not open")?;
    wv.eval("history.forward()").map_err(|e: tauri::Error| e.to_string())
}

/// Deliver a signing result back to the dapp webview.
/// Called by the main window after the user approves/rejects a signing request.
#[tauri::command]
pub async fn dapp_resolve_signing(
    app: AppHandle,
    request_id: String,
    result: serde_json::Value,
) -> Result<(), String> {
    let wv = get_dapp_webview(&app).ok_or("DApp browser not open")?;
    let json = serde_json::to_string(&result).map_err(|e| e.to_string())?;
    let script = format!(
        "window.__simpleos_bridge && window.__simpleos_bridge._resolveRequest('{}', {})",
        request_id, json
    );
    wv.eval(&script).map_err(|e: tauri::Error| e.to_string())
}

/// Reject a signing request back to the dapp webview.
#[tauri::command]
pub async fn dapp_reject_signing(
    app: AppHandle,
    request_id: String,
    reason: String,
) -> Result<(), String> {
    let wv = get_dapp_webview(&app).ok_or("DApp browser not open")?;
    let script = format!(
        "window.__simpleos_bridge && window.__simpleos_bridge._rejectRequest('{}', '{}')",
        request_id,
        reason.replace('\'', "\\'")
    );
    wv.eval(&script).map_err(|e: tauri::Error| e.to_string())
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
    // When anchor-link tries to create a transport, we intercept it.
    // This works because anchor-link checks for `window.AnchorLinkBrowserTransport`
    // or similar injection points.

    class SimpleOSTransport {
        constructor(options) {
            this.options = options || {};
        }

        async prepare(request, session) {
            // Return the request as-is (no QR code needed for embedded wallet)
            return request;
        }

        async showLoading() {}
        async hideLoading() {}

        async sign(resolved) {
            // Extract actions from the resolved signing request
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

        async onSuccess(request, result) {
            // Optional: notify dApp of success
        }

        async onFailure(request, error) {
            // Optional: notify dApp of failure
        }

        async onRequest(request, cancel) {
            // For link-based flow — we handle inline
        }
    }

    // Expose transport globally so anchor-link can find it
    window.AnchorLinkBrowserTransport = SimpleOSTransport;
    window.SimpleOSTransport = SimpleOSTransport;

    // ── UAL (Universal Authenticator Library) Support ──
    // Some dApps use UAL and look for registered authenticators.
    // We register as an Anchor-compatible authenticator.

    if (!window.__simpleos_ual_registered) {
        window.__simpleos_ual_registered = true;

        // Override ScatterJS / eos-transit detection
        window.scatter = window.scatter || null;

        // Signal readiness
        window.dispatchEvent(new CustomEvent('simpleos:ready', { detail: { version: '2.0.0' } }));
    }

    console.log('[SimplEOS] Anchor signing bridge loaded (v2.0)');
})();
"#;
