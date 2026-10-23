//! Ephemeral localhost (`127.0.0.1:0`) browser bridge for MetaMask / EIP-1193 `personal_sign`.
//!
//! Because browser extensions (`window.ethereum`) only inject into HTTP/HTTPS pages inside the
//! user's system browser, this module spins up a single-use loopback HTTP server bound strictly
//! to `127.0.0.1:0`, protected by a 128-bit CSPRNG one-time session token, opens the system
//! browser to `http://127.0.0.1:<port>/?token=<token>`, and awaits the signed callback.
//!
//! Two operations are supported:
//! 1. [`discover_metamask_pub_em`]: prompts MetaMask to `personal_sign` a transparent discovery
//!    challenge so SimplEOS can recover the full 33-byte compressed secp256k1 public key (`PUB_EM_...`)
//!    and EIP-55 `0x...` address (since `eth_requestAccounts` only exposes the 20-byte address hash).
//! 2. [`sign_digest_via_metamask`]: prompts MetaMask to `personal_sign` the 32 raw bytes of a
//!    Wire transaction `signing_digest` (`params: ["0x" + signing_digest_hex, expected_eth_address]`),
//!    verifies that the recovered secp256k1 public key matches `expected_pub_em`, and returns
//!    the canonical `SIG_EM_<130 lowercase hex>` signature.

use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

use crate::antelope::signing;
use crate::error::Error;

const BRIDGE_TIMEOUT: Duration = Duration::from_secs(180);
const MAX_HTTP_REQ_BYTES: usize = 32 * 1024;

#[derive(Debug, Clone, serde::Serialize)]
pub struct MetaMaskKeyResult {
    pub public_key: String,
    pub eth_address: String,
}

#[derive(Clone)]
enum BridgeMode {
    Discover {
        challenge_text: String,
        challenge_hex: String,
    },
    SignDigest {
        signing_digest: [u8; 32],
        signing_digest_hex: String,
        eip191_hash_hex: String,
        expected_pub_em: String,
        expected_eth_address: String,
    },
}

/// Open the user's browser to connect MetaMask, sign a one-time public-key discovery challenge,
/// and recover the compressed `PUB_EM_...` key and `0x...` address.
#[tauri::command]
pub async fn metamask_discover_key(app: AppHandle) -> Result<MetaMaskKeyResult, Error> {
    let token_bytes: [u8; 16] = crate::rng::secure_array();
    let token = hex::encode(token_bytes);
    let challenge_text = format!(
        "SimplEOS Wire EM Public Key Discovery\n\
         This signature does not broadcast a transaction or cost gas.\n\
         Session: {}",
        token
    );
    let challenge_hex = format!("0x{}", hex::encode(challenge_text.as_bytes()));

    let sig_hex = run_loopback_bridge(
        &app,
        &token,
        BridgeMode::Discover {
            challenge_text: challenge_text.clone(),
            challenge_hex,
        },
    )
    .await?;

    let eip191 = signing::eip191_message_hash(challenge_text.as_bytes());
    let pub_em = signing::recover_pub_em_from_eip191(&eip191, &sig_hex)?;
    let eth_address = signing::eth_address_from_pub_em(&pub_em)?;

    Ok(MetaMaskKeyResult {
        public_key: pub_em,
        eth_address,
    })
}

/// Sign a 32-byte Wire transaction `signing_digest` via MetaMask in the user's default browser,
/// verify that the recovered public key matches `expected_pub_em`, and return `SIG_EM_...`.
pub async fn sign_digest_via_metamask(
    app: &AppHandle,
    signing_digest: &[u8; 32],
    expected_pub_em: &str,
) -> Result<String, Error> {
    let norm_pub_em = signing::normalize_pub_em(expected_pub_em)?;
    let expected_eth_address = signing::eth_address_from_pub_em(&norm_pub_em)?;
    let signing_digest_hex = hex::encode(signing_digest);
    let eip191_hash = signing::eip191_digest32(signing_digest);
    let eip191_hash_hex = hex::encode(eip191_hash);

    let token_bytes: [u8; 16] = crate::rng::secure_array();
    let token = hex::encode(token_bytes);

    let sig_hex = run_loopback_bridge(
        app,
        &token,
        BridgeMode::SignDigest {
            signing_digest: *signing_digest,
            signing_digest_hex,
            eip191_hash_hex,
            expected_pub_em: norm_pub_em.clone(),
            expected_eth_address,
        },
    )
    .await?;

    signing::verify_sig_em_for_pubkey(signing_digest, &sig_hex, &norm_pub_em)
}

async fn run_loopback_bridge(
    app: &AppHandle,
    session_token: &str,
    mode: BridgeMode,
) -> Result<String, Error> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| Error::Signing(format!("Failed to bind MetaMask loopback bridge: {e}")))?;
    let port = listener
        .local_addr()
        .map_err(|e| Error::Signing(format!("Failed to read loopback port: {e}")))?
        .port();

    let url = format!("http://127.0.0.1:{port}/?token={session_token}");
    log::info!(
        "[metamask-bridge] Bound ephemeral loopback bridge on 127.0.0.1:{}",
        port
    );

    app.opener()
        .open_url(&url, None::<&str>)
        .map_err(|e| Error::Signing(format!("Failed to open browser for MetaMask: {e}")))?;

    let token_owned = session_token.to_string();
    let loop_fut = async move {
        loop {
            let (mut stream, _) = listener
                .accept()
                .await
                .map_err(|e| Error::Signing(format!("Loopback accept failed: {e}")))?;

            match tokio::time::timeout(
                Duration::from_secs(5),
                handle_connection(&mut stream, &token_owned, &mode),
            )
            .await
            {
                Ok(Ok(Some(outcome))) => return outcome,
                Ok(Ok(None)) => continue,
                Ok(Err(e)) => {
                    log::warn!("[metamask-bridge] Request error: {}", e);
                    continue;
                }
                Err(_) => {
                    log::debug!("[metamask-bridge] Idle socket timed out");
                    continue;
                }
            }
        }
    };

    tokio::time::timeout(BRIDGE_TIMEOUT, loop_fut)
        .await
        .map_err(|_| Error::Signing("MetaMask signing timed out after 3 minutes".into()))?
}

async fn handle_connection(
    stream: &mut TcpStream,
    expected_token: &str,
    mode: &BridgeMode,
) -> Result<Option<Result<String, Error>>, Error> {
    let mut buf = Vec::with_capacity(4096);
    let mut chunk = [0u8; 4096];

    let header_end = loop {
        let n = stream
            .read(&mut chunk)
            .await
            .map_err(|e| Error::Signing(format!("Read error: {e}")))?;
        if n == 0 {
            return Ok(None);
        }
        buf.extend_from_slice(&chunk[..n]);
        if buf.len() > MAX_HTTP_REQ_BYTES {
            return Err(Error::Signing("HTTP request too large".into()));
        }
        if let Some(pos) = find_header_end(&buf) {
            break pos;
        }
    };

    let (method, path, content_length) = {
        let headers_str = std::str::from_utf8(&buf[..header_end])
            .map_err(|_| Error::Signing("Invalid UTF-8 in HTTP headers".into()))?;
        let mut lines = headers_str.lines();
        let request_line = lines.next().unwrap_or("");
        let mut parts = request_line.split_whitespace();
        let method = parts.next().unwrap_or("").to_string();
        let path = parts.next().unwrap_or("").to_string();

        let content_length: usize = lines
            .filter_map(|line| {
                let (k, v) = line.split_once(':')?;
                if k.trim().eq_ignore_ascii_case("content-length") {
                    v.trim().parse::<usize>().ok()
                } else {
                    None
                }
            })
            .next()
            .unwrap_or(0);
        (method, path, content_length)
    };

    if content_length > MAX_HTTP_REQ_BYTES {
        return Err(Error::Signing("HTTP Content-Length exceeds limit".into()));
    }

    let body_start = header_end + 4;
    let target_len = body_start.saturating_add(content_length);
    while buf.len() < target_len {
        let n = stream
            .read(&mut chunk)
            .await
            .map_err(|e| Error::Signing(format!("Read body error: {e}")))?;
        if n == 0 {
            break;
        }
        buf.extend_from_slice(&chunk[..n]);
        if buf.len() > MAX_HTTP_REQ_BYTES {
            return Err(Error::Signing("HTTP body too large".into()));
        }
    }

    let body_bytes = if buf.len() >= body_start {
        &buf[body_start..target_len.min(buf.len())]
    } else {
        &[]
    };

    if method == "GET" && path.starts_with('/') {
        if path.starts_with("/favicon") {
            write_http_response(stream, "204 No Content", "text/plain", "").await?;
            return Ok(None);
        }
        let query_token = path
            .split_once('?')
            .and_then(|(_, q)| {
                q.split('&').find_map(|kv| {
                    let (k, v) = kv.split_once('=')?;
                    if k == "token" {
                        Some(v)
                    } else {
                        None
                    }
                })
            })
            .unwrap_or("");

        if query_token != expected_token {
            write_http_response(
                stream,
                "403 Forbidden",
                "text/plain; charset=utf-8",
                "Invalid or expired session token.",
            )
            .await?;
            return Ok(None);
        }

        let html = render_bridge_html(expected_token, mode);
        write_http_response(stream, "200 OK", "text/html; charset=utf-8", &html).await?;
        return Ok(None);
    }

    if method == "POST" && path == "/callback" {
        let payload: serde_json::Value = serde_json::from_slice(body_bytes)
            .map_err(|e| Error::Signing(format!("Invalid JSON callback: {e}")))?;
        let token = payload.get("token").and_then(|v| v.as_str()).unwrap_or("");
        if token != expected_token {
            write_http_response(
                stream,
                "403 Forbidden",
                "application/json",
                r#"{"ok":false,"error":"Invalid session token"}"#,
            )
            .await?;
            return Ok(None);
        }

        if let Some(err_msg) = payload.get("error").and_then(|v| v.as_str()) {
            write_http_response(
                stream,
                "200 OK",
                "application/json",
                r#"{"ok":true}"#,
            )
            .await?;
            if err_msg.to_lowercase().contains("reject")
                || err_msg.to_lowercase().contains("denied")
                || err_msg.to_lowercase().contains("cancel")
            {
                return Ok(Some(Err(Error::SignRejected)));
            }
            return Ok(Some(Err(Error::Signing(format!(
                "MetaMask error: {err_msg}"
            )))));
        }

        let signature = payload
            .get("signature")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // Validate signature before telling the browser page it succeeded
        if let BridgeMode::SignDigest {
            signing_digest,
            expected_pub_em,
            ..
        } = mode
        {
            if let Err(e) =
                signing::verify_sig_em_for_pubkey(signing_digest, &signature, expected_pub_em)
            {
                let resp = serde_json::json!({
                    "ok": false,
                    "error": e.to_string(),
                });
                write_http_response(stream, "400 Bad Request", "application/json", &resp.to_string())
                    .await?;
                return Ok(None);
            }
        }

        write_http_response(
            stream,
            "200 OK",
            "application/json",
            r#"{"ok":true}"#,
        )
        .await?;
        return Ok(Some(Ok(signature)));
    }

    write_http_response(stream, "404 Not Found", "text/plain", "Not Found").await?;
    Ok(None)
}

fn find_header_end(buf: &[u8]) -> Option<usize> {
    buf.windows(4).position(|w| w == b"\r\n\r\n")
}

async fn write_http_response(
    stream: &mut TcpStream,
    status: &str,
    content_type: &str,
    body: &str,
) -> Result<(), Error> {
    let resp = format!(
        "HTTP/1.1 {status}\r\n\
         Content-Type: {content_type}\r\n\
         Content-Length: {}\r\n\
         Cache-Control: no-store\r\n\
         Connection: close\r\n\r\n\
         {body}",
        body.len()
    );
    stream
        .write_all(resp.as_bytes())
        .await
        .map_err(|e| Error::Signing(format!("Write response error: {e}")))?;
    let _ = stream.flush().await;
    Ok(())
}

fn render_bridge_html(token: &str, mode: &BridgeMode) -> String {
    let (title, subtitle, button_label, details_html, js_config) = match mode {
        BridgeMode::Discover {
            challenge_text,
            challenge_hex,
        } => (
            "Connect MetaMask (PUB_EM_)".to_string(),
            "Sign a one-time discovery message in MetaMask so SimplEOS can recover your compressed secp256k1 public key (PUB_EM_...).".to_string(),
            "Connect & Derive PUB_EM_ Key".to_string(),
            format!(
                r#"<div class="field"><span class="label">Challenge</span><pre class="mono">{}</pre></div>"#,
                challenge_text
            ),
            serde_json::json!({
                "mode": "discover",
                "token": token,
                "challengeHex": challenge_hex,
            })
            .to_string(),
        ),
        BridgeMode::SignDigest {
            signing_digest_hex,
            eip191_hash_hex,
            expected_pub_em,
            expected_eth_address,
            ..
        } => (
            "Sign Wire Transaction with MetaMask".to_string(),
            "Verify that the 32-byte signing digest below matches the SimplEOS Confirmation window, then approve in MetaMask.".to_string(),
            "Sign with MetaMask".to_string(),
            format!(
                r#"<div class="field"><span class="label">Expected Ethereum Account</span><div class="mono">{}</div></div>
                   <div class="field"><span class="label">Wire Public Key (PUB_EM_)</span><div class="mono">{}</div></div>
                   <div class="field"><span class="label">Signing Digest (32 bytes passed to personal_sign)</span><div class="mono">0x{}</div></div>
                   <div class="field"><span class="label">EIP-191 Hash</span><div class="mono">0x{}</div></div>"#,
                expected_eth_address, expected_pub_em, signing_digest_hex, eip191_hash_hex
            ),
            serde_json::json!({
                "mode": "sign",
                "token": token,
                "digestHex": format!("0x{}", signing_digest_hex),
                "expectedAddress": expected_eth_address,
            })
            .to_string(),
        ),
    };

    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{title} — SimplEOS</title>
<style>
  :root {{
    color-scheme: dark;
  }}
  body {{
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0b0f17;
    color: #e5e7eb;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    padding: 24px;
  }}
  .card {{
    width: 100%;
    max-width: 520px;
    background: #131b2e;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px;
    padding: 28px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
  }}
  .badge {{
    display: inline-block;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    background: rgba(99, 102, 241, 0.18);
    color: #818cf8;
    margin-bottom: 12px;
  }}
  h1 {{
    margin: 0 0 8px;
    font-size: 20px;
    font-weight: 600;
  }}
  p.sub {{
    margin: 0 0 20px;
    font-size: 13px;
    line-height: 1.5;
    color: #9ca3af;
  }}
  .field {{
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px;
    padding: 10px 12px;
    margin-bottom: 10px;
  }}
  .label {{
    display: block;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #9ca3af;
    margin-bottom: 4px;
  }}
  .mono {{
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    word-break: break-all;
    color: #f3f4f6;
    margin: 0;
    white-space: pre-wrap;
  }}
  .actions {{
    display: flex;
    gap: 10px;
    margin-top: 20px;
  }}
  button {{
    flex: 1;
    padding: 12px 16px;
    border-radius: 10px;
    border: none;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }}
  button:disabled {{
    opacity: 0.5;
    cursor: not-allowed;
  }}
  .btn-primary {{
    background: #6366f1;
    color: #fff;
  }}
  .btn-secondary {{
    background: rgba(255,255,255,0.08);
    color: #d1d5db;
  }}
  #status {{
    margin-top: 14px;
    font-size: 13px;
    line-height: 1.4;
    padding: 10px 12px;
    border-radius: 8px;
    display: none;
  }}
  .status-info {{ display: block !important; background: rgba(59,130,246,0.15); color: #93c5fd; }}
  .status-ok {{ display: block !important; background: rgba(16,185,129,0.15); color: #6ee7b7; }}
  .status-err {{ display: block !important; background: rgba(239,68,68,0.15); color: #fca5a5; }}
</style>
</head>
<body>
  <div class="card">
    <span class="badge">SimplEOS · Wire EM Bridge</span>
    <h1>{title}</h1>
    <p class="sub">{subtitle}</p>
    {details_html}
    <div class="actions">
      <button id="cancelBtn" class="btn-secondary">Cancel</button>
      <button id="signBtn" class="btn-primary">{button_label}</button>
    </div>
    <div id="status"></div>
  </div>
  <script>
    const CFG = {js_config};
    const statusEl = document.getElementById('status');
    const signBtn = document.getElementById('signBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    let discoveredProviders = [];
    window.addEventListener('eip6963:announceProvider', (event) => {{
      if (event && event.detail && event.detail.provider) {{
        discoveredProviders.push(event.detail);
      }}
    }});
    try {{
      window.dispatchEvent(new Event('eip6963:requestProvider'));
    }} catch (_) {{}}

    function resolveEthereumProvider() {{
      const mm = discoveredProviders.find(
        (d) =>
          (d.info && d.info.rdns === 'io.metamask') ||
          (d.info && typeof d.info.name === 'string' && d.info.name.toLowerCase().includes('metamask'))
      );
      if (mm) return mm.provider;
      if (discoveredProviders.length > 0) return discoveredProviders[0].provider;
      if (window.ethereum && Array.isArray(window.ethereum.providers)) {{
        const sub = window.ethereum.providers.find((p) => p && p.isMetaMask);
        if (sub) return sub;
      }}
      return window.ethereum || null;
    }}

    function setStatus(kind, msg) {{
      statusEl.className = 'status-' + kind;
      statusEl.textContent = msg;
    }}

    async function runFlow() {{
      const provider = resolveEthereumProvider();
      if (!provider) {{
        setStatus('err', 'No Ethereum provider (EIP-6963 / window.ethereum) detected in this browser. Open this URL in Chrome/Brave/Firefox with MetaMask enabled.');
        return;
      }}
      signBtn.disabled = true;
      setStatus('info', 'Requesting account & signature from MetaMask...');
      try {{
        const accounts = await provider.request({{ method: 'eth_requestAccounts' }});
        if (!accounts || !accounts.length) {{
          throw new Error('No Ethereum account returned by MetaMask');
        }}
        let signerAddr = accounts[0];
        if (CFG.mode === 'sign' && CFG.expectedAddress) {{
          const match = accounts.find(a => a.toLowerCase() === CFG.expectedAddress.toLowerCase());
          if (!match) {{
            throw new Error('Connected MetaMask account (' + signerAddr + ') does not match expected Wire EM address (' + CFG.expectedAddress + '). Switch accounts in MetaMask and click Sign again.');
          }}
          signerAddr = match;
        }}
        const msgHex = CFG.mode === 'discover' ? CFG.challengeHex : CFG.digestHex;
        const signature = await provider.request({{
          method: 'personal_sign',
          params: [msgHex, signerAddr],
        }});
        const res = await fetch('/callback', {{
          method: 'POST',
          headers: {{ 'Content-Type': 'application/json' }},
          body: JSON.stringify({{ token: CFG.token, signature }}),
        }});
        const data = await res.json();
        if (!res.ok || !data.ok) {{
          throw new Error(data.error || 'Signature verification failed');
        }}
        setStatus('ok', 'Signature verified and sent to SimplEOS! You can close this tab.');
        cancelBtn.disabled = true;
        setTimeout(() => {{ try {{ window.close(); }} catch (_) {{}} }}, 1200);
      }} catch (err) {{
        signBtn.disabled = false;
        setStatus('err', err && err.message ? err.message : String(err));
      }}
    }}

    signBtn.addEventListener('click', runFlow);
    cancelBtn.addEventListener('click', async () => {{
      signBtn.disabled = true;
      cancelBtn.disabled = true;
      try {{
        await fetch('/callback', {{
          method: 'POST',
          headers: {{ 'Content-Type': 'application/json' }},
          body: JSON.stringify({{ token: CFG.token, error: 'User rejected request' }}),
        }});
      }} catch (_) {{}}
      setStatus('err', 'Cancelled. You can close this tab.');
    }});

    // Auto-start on load if an Ethereum provider is ready
    window.addEventListener('load', () => {{
      try {{ window.dispatchEvent(new Event('eip6963:requestProvider')); }} catch (_) {{}}
      setTimeout(() => {{
        if (resolveEthereumProvider()) runFlow();
      }}, 250);
    }});
  </script>
</body>
</html>"#
    )
}
