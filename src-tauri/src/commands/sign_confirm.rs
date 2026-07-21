//! Trusted signing-confirmation registry and types (R2+R3).
//!
//! The Rust backend — not the renderer — is the single source of truth for the
//! bytes that get signed. `begin_sign` (task 8) builds the canonical
//! transaction, decodes it into a trustworthy [`SignSummary`], stores a
//! [`PendingSign`] in the [`SignRegistry`], and opens the trusted
//! `sign-confirm` window. That window renders the summary via
//! `get_pending_sign_request` and the user approves/rejects, which resolves the
//! pending request's oneshot. The renderer cannot reach the registry directly;
//! it only submits intents and awaits results.
//!
//! This module is the foundation (task 1). The fields are populated
//! incrementally by the WYSIWYS summary builder (task 5), the ESR/origin
//! capture (task 7), and the confirm-flow commands (task 8).
#![allow(dead_code)] // wired up by later R2+R3 tasks

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{
    AppHandle, Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};
use tokio::sync::oneshot;

use crate::antelope::provider::ProviderState;
use crate::antelope::signing;
use crate::antelope::transaction::{self, ActionDesc, BuiltAction, BuiltTransaction};
use crate::error::Error;
use crate::AppWallet;

/// Window label for the trusted confirmation window.
pub const SIGN_CONFIRM_LABEL: &str = "sign-confirm";

/// What an approved signature is ultimately used for.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SignMode {
    /// Sign and broadcast a transaction.
    Push,
    /// Sign a transaction without broadcasting (returns packed_trx + signature).
    SignOnly,
    /// Sign an ESR identity proof (no on-chain transaction).
    Identity,
    /// Export a private key as WIF (no signature; still requires confirmation).
    Export,
}

#[derive(Debug, Clone, Serialize)]
pub struct AuthSummary {
    pub actor: String,
    pub permission: String,
}

/// One action exactly as it will be signed, decoded locally for display.
#[derive(Debug, Clone, Serialize)]
pub struct ActionSummary {
    pub account: String,
    pub name: String,
    pub authorization: Vec<AuthSummary>,
    /// Locally-decoded action data — the bytes that will actually be signed.
    pub data: serde_json::Value,
    /// True if the displayed data was verified to round-trip to the signed
    /// bytes locally; false if it could only be obtained from an untrusted RPC.
    pub verified: bool,
    /// True for elevated-risk actions (auth/permission/code/vote changes, etc.).
    pub high_risk: bool,
    /// Optional human-readable warning for this action.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warning: Option<String>,
}

/// The complete, locally-derived description rendered in the trusted window.
///
/// Field names are `snake_case` to match the TypeScript interface in
/// `tauri-ipc.service.ts` (the project's IPC convention).
#[derive(Debug, Clone, Serialize)]
pub struct SignSummary {
    pub request_id: String,
    pub chain_id: String,
    pub title: String,
    pub signer_public_key: String,
    pub mode: SignMode,
    pub actions: Vec<ActionSummary>,
    /// Transaction expiration (unix seconds), when applicable.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expiration: Option<u32>,
    /// Deferred-transaction delay; non-zero is unusual and flagged in the UI.
    pub delay_sec: u32,
    /// True if the transaction carries context-free actions.
    pub has_context_free_actions: bool,
    /// Requesting origin (dapp window URL / ESR link host), for external requests.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub origin: Option<String>,
    /// Full callback URL the result will be delivered to (ESR), if any.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub callback_url: Option<String>,
    /// Identity-proof challenge/scope text, for login requests.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identity_scope: Option<String>,
    /// True if any action's data could not be locally verified (display warning).
    pub any_unverified: bool,
}

/// Everything `approve_sign` needs to execute once the user consents. Holding
/// the exact bytes here (rather than re-deriving from renderer input at approve
/// time) is what guarantees the user signs what they reviewed.
#[derive(Clone)]
pub enum SignPayload {
    /// A fully-built transaction: the exact packed bytes to sign.
    Transaction {
        packed_trx: Vec<u8>,
        broadcast: bool,
    },
    /// An ESR identity proof: a precomputed 32-byte digest (hex) + callback.
    Identity {
        digest_hex: String,
        callback_url: Option<String>,
        callback_payload: serde_json::Value,
    },
    /// A private-key export (the key is identified by the entry's signer pubkey).
    Export,
}

/// A signing request awaiting the user's decision in the trusted window.
pub struct PendingSign {
    pub chain_id: String,
    pub signer_public_key: String,
    pub mode: SignMode,
    pub payload: SignPayload,
    pub summary: SignSummary,
    /// Resolves the awaiting `begin_sign` caller with the final result.
    pub responder: oneshot::Sender<Result<serde_json::Value, Error>>,
}

/// Managed state holding all in-flight signing requests.
pub struct SignRegistry {
    inner: Mutex<HashMap<String, PendingSign>>,
    /// The id of the request currently shown in the trusted window. Single-active
    /// keeps the window unambiguous (one confirmation at a time).
    active: Mutex<Option<String>>,
    counter: AtomicU64,
}

impl SignRegistry {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
            active: Mutex::new(None),
            counter: AtomicU64::new(1),
        }
    }

    /// Allocate a fresh, process-unique request id.
    pub fn next_id(&self) -> String {
        format!("sign_{}", self.counter.fetch_add(1, Ordering::Relaxed))
    }

    /// Register a pending request and mark it active. Errors if another request
    /// is already awaiting confirmation.
    pub fn begin(&self, id: String, pending: PendingSign) -> Result<(), Error> {
        let mut active = self.active.lock().unwrap();
        if active.is_some() {
            return Err(Error::Signing(
                "Another confirmation is already in progress".into(),
            ));
        }
        self.inner.lock().unwrap().insert(id.clone(), pending);
        *active = Some(id);
        Ok(())
    }

    /// Insert without touching the active marker (tests/diagnostics).
    pub fn insert(&self, id: String, pending: PendingSign) {
        self.inner.lock().unwrap().insert(id, pending);
    }

    /// The id of the request currently awaiting confirmation, if any.
    pub fn active_id(&self) -> Option<String> {
        self.active.lock().unwrap().clone()
    }

    /// Clone the summary for rendering in the trusted window.
    pub fn summary(&self, id: &str) -> Option<SignSummary> {
        self.inner
            .lock()
            .unwrap()
            .get(id)
            .map(|p| p.summary.clone())
    }

    /// Clone the inputs needed to execute an approval, WITHOUT removing the
    /// pending request — so a failed attempt (e.g. wrong passphrase) can retry.
    pub fn exec_inputs(&self, id: &str) -> Option<(String, String, SignPayload)> {
        self.inner.lock().unwrap().get(id).map(|p| {
            (
                p.chain_id.clone(),
                p.signer_public_key.clone(),
                p.payload.clone(),
            )
        })
    }

    /// Remove and return a pending request, clearing the active marker if it was
    /// the active one (used by approve/reject and window-close).
    pub fn take(&self, id: &str) -> Option<PendingSign> {
        let removed = self.inner.lock().unwrap().remove(id);
        if removed.is_some() {
            let mut active = self.active.lock().unwrap();
            if active.as_deref() == Some(id) {
                *active = None;
            }
        }
        removed
    }

    /// Count of in-flight requests (diagnostics/tests).
    pub fn len(&self) -> usize {
        self.inner.lock().unwrap().len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

impl Default for SignRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Open a FRESH trusted confirmation window for `request_id` and wire close =
/// reject. The window loads the app's OWN bundle (`tauri://localhost`); the
/// window-aware Angular bootstrap routes it to `/confirm`, which fetches the
/// summary via `get_pending_sign_request`. Being a separate webview, the
/// main/dapp renderer cannot script into it — it can neither forge nor suppress
/// a confirmation. (R2)
fn open_sign_confirm_window(app: &AppHandle, request_id: &str) -> Result<(), Error> {
    // Close any leftover window from a previous request before creating a fresh
    // one, so the close handler below always refers to the current request.
    if let Some(win) = app.get_webview_window(SIGN_CONFIRM_LABEL) {
        let _ = win.close();
    }

    let win = WebviewWindowBuilder::new(
        app,
        SIGN_CONFIRM_LABEL,
        WebviewUrl::App("index.html".into()),
    )
    .title("Confirm — SimplEOS")
    .inner_size(460.0, 680.0)
    .min_inner_size(380.0, 480.0)
    .resizable(false)
    .decorations(false)
    .center()
    .focused(true)
    .always_on_top(true)
    .build()
    .map_err(|e| Error::Signing(format!("Failed to open confirmation window: {e}")))?;

    // Close = reject: if the window is destroyed before a decision, resolve the
    // request as rejected so `begin_sign` does not hang. Idempotent — if the
    // request was already taken (approved/rejected), this is a no-op.
    let app_handle = app.clone();
    let id = request_id.to_string();
    win.on_window_event(move |event| {
        if let WindowEvent::Destroyed = event {
            if let Some(reg) = app_handle.try_state::<SignRegistry>() {
                if let Some(pending) = reg.take(&id) {
                    let _ = pending.responder.send(Err(Error::SignRejected));
                }
            }
        }
    });

    Ok(())
}

// ── Summary builder (R3 — what-you-see-is-what-you-sign) ──

/// Return a warning string for elevated-risk actions, or `None` for ordinary ones.
fn high_risk_warning(account: &str, name: &str, data: &serde_json::Value) -> Option<String> {
    // On Vaulta these actions arrive on `core.vaulta` (see try_native_serialize);
    // treat them as their eosio equivalents so the risk hints still apply.
    let account = if account == "core.vaulta" {
        "eosio"
    } else {
        account
    };
    match (account, name) {
        ("eosio", "updateauth") => Some("Changes account permissions/keys (updateauth).".into()),
        ("eosio", "deleteauth") => Some("Removes an account permission (deleteauth).".into()),
        ("eosio", "linkauth") => Some("Links a permission to a contract action (linkauth).".into()),
        ("eosio", "unlinkauth") => Some("Unlinks a permission (unlinkauth).".into()),
        ("eosio", "setcode") => Some("Deploys or changes contract code (setcode).".into()),
        ("eosio", "setabi") => Some("Changes a contract ABI (setabi).".into()),
        ("eosio", "voteproducer") => Some("Casts or changes producer votes (voteproducer).".into()),
        ("eosio", "delegatebw")
            if data
                .get("transfer")
                .and_then(|v| v.as_bool())
                .unwrap_or(false) =>
        {
            Some(
                "Delegates resources AND transfers token ownership (delegatebw transfer=true)."
                    .into(),
            )
        }
        _ => None,
    }
}

/// Build one [`ActionSummary`] from a built action, marking verification status
/// and accumulating whether any action is unverified.
fn action_summary(a: &BuiltAction, any_unverified: &mut bool) -> ActionSummary {
    let verified = a.provenance.is_locally_verified() && a.original_json.is_some();
    if !verified {
        *any_unverified = true;
    }

    // Display the reviewed JSON when we have it, otherwise the raw signed hex.
    let data = match &a.original_json {
        Some(json) => json.clone(),
        None => serde_json::json!({ "_unverified_hex": a.data_hex }),
    };

    let mut warnings: Vec<String> = Vec::new();
    let high_risk = high_risk_warning(&a.account, &a.name, &data);
    if let Some(w) = &high_risk {
        warnings.push(w.clone());
    }
    if !verified {
        warnings.push(
            "This action's data could not be verified locally against the bytes that will be \
             signed — it is shown as intended, not proven."
                .into(),
        );
    }

    ActionSummary {
        account: a.account.clone(),
        name: a.name.clone(),
        authorization: a
            .authorization
            .iter()
            .map(|au| AuthSummary {
                actor: au.actor.clone(),
                permission: au.permission.clone(),
            })
            .collect(),
        data,
        verified,
        high_risk: high_risk.is_some(),
        warning: if warnings.is_empty() {
            None
        } else {
            Some(warnings.join(" "))
        },
    }
}

/// Build the trusted-window [`SignSummary`] from a locally-built transaction.
///
/// `built` is produced by `transaction::build_tx`, which retains each action's
/// provenance and the originally-submitted JSON, so the summary reflects exactly
/// the bytes that will be signed and flags anything that could not be locally
/// verified.
#[allow(clippy::too_many_arguments)]
pub fn build_sign_summary(
    request_id: String,
    built: &BuiltTransaction,
    signer_public_key: &str,
    mode: SignMode,
    title: String,
    origin: Option<String>,
    callback_url: Option<String>,
    identity_scope: Option<String>,
) -> SignSummary {
    let mut any_unverified = false;
    let actions = built
        .actions
        .iter()
        .map(|a| action_summary(a, &mut any_unverified))
        .collect();

    SignSummary {
        request_id,
        chain_id: built.chain_id.clone(),
        title,
        signer_public_key: signer_public_key.to_string(),
        mode,
        actions,
        expiration: Some(built.expiration),
        delay_sec: built.delay_sec,
        has_context_free_actions: built.has_context_free_actions,
        origin,
        callback_url,
        identity_scope,
        any_unverified,
    }
}

// ── Trusted-confirmation commands (R2+R3, task 8) ──

/// Reject confirm-action commands not originating from the trusted window. App
/// commands are reachable from ANY window that has a capability (including the
/// main renderer), so without this a compromised main renderer could call
/// approve_sign / get_pending_sign_request directly and bypass the window — it
/// would learn the request_id and approve with no user interaction. (R2)
fn require_confirm_window(webview: &WebviewWindow) -> Result<(), Error> {
    if webview.label() != SIGN_CONFIRM_LABEL {
        return Err(Error::Signing(
            "forbidden: confirmation actions are only allowed from the trusted window".into(),
        ));
    }
    Ok(())
}

/// Reject signing-INITIATION commands originating from the trusted window itself
/// (the confirm window must only approve/reject, never start new flows).
fn forbid_confirm_window(webview: &WebviewWindow) -> Result<(), Error> {
    if webview.label() == SIGN_CONFIRM_LABEL {
        return Err(Error::Signing(
            "forbidden: cannot initiate signing from the confirmation window".into(),
        ));
    }
    Ok(())
}

/// Acquire the signer private key per the active security mode. `force_passphrase`
/// requires a fresh passphrase even in an unlocked session (used for key export —
/// SEC-006).
fn unlock_signing_key(
    wallet: &AppWallet,
    chain_id: &str,
    public_key: &str,
    passphrase: Option<String>,
    force_passphrase: bool,
) -> Result<zeroize::Zeroizing<Vec<u8>>, Error> {
    if force_passphrase || wallet.0.needs_passphrase_for_signing() {
        let pass = passphrase.ok_or(Error::InvalidPassphrase)?;
        wallet
            .0
            .decrypt_key_with_passphrase(chain_id, public_key, &pass)
    } else {
        wallet.0.decrypt_key(chain_id, public_key)
    }
}

/// POST an ESR callback result to its (https-only) URL, injecting the signature.
/// Runs in the backend so the renderer CSP can stay strict (SEC-005). Refined in
/// task 7.
async fn post_esr_callback(
    url: &str,
    mut payload: serde_json::Value,
    signature: &str,
) -> Result<(), Error> {
    if !url.starts_with("https://") {
        return Err(Error::Signing(format!(
            "Refusing non-https ESR callback: {url}"
        )));
    }
    if let Some(obj) = payload.as_object_mut() {
        obj.insert(
            "sig".into(),
            serde_json::Value::String(signature.to_string()),
        );
    }
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| Error::Rpc(e.to_string()))?;
    let resp = client
        .post(url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| Error::Rpc(format!("ESR callback failed: {e}")))?;
    log::info!("[esr] callback POSTed to {} status {}", url, resp.status());
    Ok(())
}

/// Execute a user-approved request: sign the exact stored bytes and (per mode)
/// broadcast / return the signature / export the key.
async fn execute_approved(
    chain_id: &str,
    signer_public_key: &str,
    payload: SignPayload,
    passphrase: Option<String>,
    extra_force_passphrase: bool,
    wallet: &AppWallet,
    providers: &ProviderState,
) -> Result<serde_json::Value, Error> {
    let force_passphrase = extra_force_passphrase || matches!(payload, SignPayload::Export);
    let key = unlock_signing_key(
        wallet,
        chain_id,
        signer_public_key,
        passphrase,
        force_passphrase,
    )?;

    match payload {
        SignPayload::Transaction {
            packed_trx,
            broadcast,
        } => {
            let signature = signing::sign_transaction(chain_id, &packed_trx, &key)?;
            if broadcast {
                let mut map = providers.0.lock().await;
                let pm = map
                    .get_mut(chain_id)
                    .ok_or_else(|| Error::ChainNotFound(chain_id.to_string()))?;
                let result = transaction::push_signed(pm, &packed_trx, &signature).await?;
                serde_json::to_value(result).map_err(|e| Error::Serialization(e.to_string()))
            } else {
                Ok(serde_json::json!({
                    "packed_trx": hex::encode(&packed_trx),
                    "signature": signature,
                }))
            }
        }
        SignPayload::Identity {
            digest_hex,
            callback_url,
            callback_payload,
        } => {
            let signature = signing::sign_digest(&digest_hex, &key)?;
            if let Some(url) = callback_url {
                post_esr_callback(&url, callback_payload, &signature).await?;
            }
            // The frontend uses the digest as a pseudo transaction id for display.
            Ok(serde_json::json!({ "signature": signature, "transaction_id": digest_hex }))
        }
        SignPayload::Export => Ok(serde_json::json!({ "wif": signing::wif_encode(&key) })),
    }
}

/// Begin a transaction signing flow: build the canonical bytes, open the trusted
/// window with the decoded summary, and await the user's decision. Returns the
/// final result (broadcast `TransactionResult`, or `{packed_trx, signature}` for
/// sign-only) or an error / rejection.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn begin_sign(
    app: AppHandle,
    webview: WebviewWindow,
    chain_id: String,
    public_key: String,
    actions: Vec<ActionDesc>,
    broadcast: bool,
    title: Option<String>,
    origin: Option<String>,
    callback_url: Option<String>,
    providers: State<'_, ProviderState>,
    registry: State<'_, SignRegistry>,
) -> Result<serde_json::Value, Error> {
    forbid_confirm_window(&webview)?;
    let built = {
        let mut map = providers.0.lock().await;
        let pm = map
            .get_mut(&chain_id)
            .ok_or_else(|| Error::ChainNotFound(chain_id.clone()))?;
        transaction::build_tx(pm, &actions).await?
    };

    let mode = if broadcast {
        SignMode::Push
    } else {
        SignMode::SignOnly
    };
    let request_id = registry.next_id();
    let summary = build_sign_summary(
        request_id.clone(),
        &built,
        &public_key,
        mode,
        title.unwrap_or_else(|| "Confirm transaction".to_string()),
        origin,
        callback_url,
        None,
    );

    let (tx, rx) = oneshot::channel();
    registry.begin(
        request_id.clone(),
        PendingSign {
            chain_id,
            signer_public_key: public_key,
            mode,
            payload: SignPayload::Transaction {
                packed_trx: built.packed_trx,
                broadcast,
            },
            summary,
            responder: tx,
        },
    )?;

    if let Err(e) = open_sign_confirm_window(&app, &request_id) {
        let _ = registry.take(&request_id);
        return Err(e);
    }

    let result = rx.await.map_err(|_| Error::SignRejected)?;
    if let Some(win) = app.get_webview_window(SIGN_CONFIRM_LABEL) {
        let _ = win.close();
    }
    result
}

/// Begin a private-key export flow. Always requires a passphrase factor in the
/// trusted window, even when the session is unlocked (SEC-006).
#[tauri::command]
pub async fn begin_export_key(
    app: AppHandle,
    webview: WebviewWindow,
    chain_id: String,
    public_key: String,
    registry: State<'_, SignRegistry>,
) -> Result<serde_json::Value, Error> {
    forbid_confirm_window(&webview)?;
    let request_id = registry.next_id();
    let summary = SignSummary {
        request_id: request_id.clone(),
        chain_id: chain_id.clone(),
        title: "Export private key".to_string(),
        signer_public_key: public_key.clone(),
        mode: SignMode::Export,
        actions: vec![],
        expiration: None,
        delay_sec: 0,
        has_context_free_actions: false,
        origin: None,
        callback_url: None,
        identity_scope: Some(format!("Reveal the private key for {public_key}")),
        any_unverified: false,
    };

    let (tx, rx) = oneshot::channel();
    registry.begin(
        request_id.clone(),
        PendingSign {
            chain_id,
            signer_public_key: public_key,
            mode: SignMode::Export,
            payload: SignPayload::Export,
            summary,
            responder: tx,
        },
    )?;

    if let Err(e) = open_sign_confirm_window(&app, &request_id) {
        let _ = registry.take(&request_id);
        return Err(e);
    }

    let result = rx.await.map_err(|_| Error::SignRejected)?;
    if let Some(win) = app.get_webview_window(SIGN_CONFIRM_LABEL) {
        let _ = win.close();
    }
    result
}

/// Called by the trusted window on load to fetch the active request's summary.
#[tauri::command]
pub fn get_pending_sign_request(
    webview: WebviewWindow,
    registry: State<SignRegistry>,
) -> Result<SignSummary, Error> {
    require_confirm_window(&webview)?;
    registry
        .active_id()
        .and_then(|id| registry.summary(&id))
        .ok_or_else(|| Error::Signing("No pending signing request".into()))
}

/// Approve the active request. On success, resolves the awaiting `begin_sign`
/// caller and closes the window; on failure (e.g. wrong passphrase) the request
/// stays open so the user can retry.
#[tauri::command]
pub async fn approve_sign(
    app: AppHandle,
    webview: WebviewWindow,
    request_id: String,
    passphrase: Option<String>,
    wallet: State<'_, AppWallet>,
    providers: State<'_, ProviderState>,
    registry: State<'_, SignRegistry>,
) -> Result<(), Error> {
    require_confirm_window(&webview)?;
    let (chain_id, signer, payload) = registry
        .exec_inputs(&request_id)
        .ok_or_else(|| Error::Signing("Unknown or expired signing request".into()))?;

    // Strict policy forces a passphrase on every signature (SEC hardening, T9).
    let strict = load_policy(&app) == ConfirmationPolicy::Strict;
    let outcome = execute_approved(
        &chain_id, &signer, payload, passphrase, strict, &wallet, &providers,
    )
    .await?;

    if let Some(pending) = registry.take(&request_id) {
        let _ = pending.responder.send(Ok(outcome));
    }
    if let Some(win) = app.get_webview_window(SIGN_CONFIRM_LABEL) {
        let _ = win.close();
    }
    Ok(())
}

/// Reject the active request: resolves `begin_sign` as rejected and closes.
#[tauri::command]
pub fn reject_sign(
    app: AppHandle,
    webview: WebviewWindow,
    request_id: String,
    registry: State<SignRegistry>,
) -> Result<(), Error> {
    require_confirm_window(&webview)?;
    if let Some(pending) = registry.take(&request_id) {
        let _ = pending.responder.send(Err(Error::SignRejected));
    }
    if let Some(win) = app.get_webview_window(SIGN_CONFIRM_LABEL) {
        let _ = win.close();
    }
    Ok(())
}

// ── ESR signing (R3/R4, task 7+13) ──

#[derive(serde::Deserialize)]
pub struct EsrAuthInput {
    pub actor: String,
    pub permission: String,
}

/// A wharfkit-resolved action passed from the renderer for DISPLAY in the
/// trusted window. The signed value is the precomputed `digest_hex` (computed by
/// the request author), so these are shown but flagged unverified.
#[derive(serde::Deserialize)]
pub struct EsrAction {
    pub account: String,
    pub name: String,
    pub authorization: Vec<EsrAuthInput>,
    pub data: serde_json::Value,
}

/// Begin an ESR (EOSIO Signing Request) confirmation. Unlike `begin_sign`, the
/// signed value is the wharfkit-resolved `digest_hex` rather than bytes the
/// backend rebuilt — so the actions are shown for context but marked unverified,
/// and the requesting origin + callback URL are shown prominently (SEC-004).
/// After approval the renderer receives the signature and performs the ESR
/// callback (the callback host was disclosed and acknowledged here).
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn begin_esr_sign(
    app: AppHandle,
    webview: WebviewWindow,
    chain_id: String,
    public_key: String,
    actions: Vec<EsrAction>,
    digest_hex: String,
    is_identity: bool,
    origin: Option<String>,
    callback_url: Option<String>,
    identity_scope: Option<String>,
    registry: State<'_, SignRegistry>,
) -> Result<serde_json::Value, Error> {
    forbid_confirm_window(&webview)?;
    // Basic hardening: the digest must be 32 bytes of hex (SEC-033 / hostile ESR).
    if digest_hex.len() != 64 || !digest_hex.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(Error::Signing(
            "ESR signing digest must be 32-byte hex".into(),
        ));
    }

    let request_id = registry.next_id();
    let action_summaries: Vec<ActionSummary> = actions
        .iter()
        .map(|a| {
            let hr = high_risk_warning(&a.account, &a.name, &a.data);
            ActionSummary {
                account: a.account.clone(),
                name: a.name.clone(),
                authorization: a
                    .authorization
                    .iter()
                    .map(|au| AuthSummary {
                        actor: au.actor.clone(),
                        permission: au.permission.clone(),
                    })
                    .collect(),
                data: a.data.clone(),
                // The signed digest is computed by the request author from these
                // actions; we cannot locally prove the digest matches.
                verified: false,
                high_risk: hr.is_some(),
                warning: hr,
            }
        })
        .collect();

    let mode = if is_identity {
        SignMode::Identity
    } else {
        SignMode::SignOnly
    };
    let title = if is_identity {
        "Login request".to_string()
    } else {
        "Sign request".to_string()
    };
    let summary = SignSummary {
        request_id: request_id.clone(),
        chain_id: chain_id.clone(),
        title,
        signer_public_key: public_key.clone(),
        mode,
        actions: action_summaries,
        expiration: None,
        delay_sec: 0,
        has_context_free_actions: false,
        origin,
        // Shown for disclosure; the renderer performs the POST after approval.
        callback_url,
        identity_scope,
        any_unverified: !is_identity,
    };

    let (tx, rx) = oneshot::channel();
    registry.begin(
        request_id.clone(),
        PendingSign {
            chain_id,
            signer_public_key: public_key,
            mode,
            payload: SignPayload::Identity {
                digest_hex,
                callback_url: None, // renderer performs the ESR callback after approval
                callback_payload: serde_json::Value::Null,
            },
            summary,
            responder: tx,
        },
    )?;

    if let Err(e) = open_sign_confirm_window(&app, &request_id) {
        let _ = registry.take(&request_id);
        return Err(e);
    }

    let result = rx.await.map_err(|_| Error::SignRejected)?;
    if let Some(win) = app.get_webview_window(SIGN_CONFIRM_LABEL) {
        let _ = win.close();
    }
    result
}

// ── Confirmation policy (R2+R3, task 9) ──

/// User-configurable confirmation strength. BOTH tiers always use the trusted
/// window (the floor is absolute — no tier can bypass it); the difference is
/// whether a passphrase factor is required for routine signatures.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfirmationPolicy {
    /// Default: passphrase per the active security mode (a routine SessionUnlock
    /// signature needs only the explicit approval in the trusted window).
    Standard,
    /// Hardened: require a passphrase in the trusted window for EVERY signature.
    Strict,
}

impl ConfirmationPolicy {
    fn as_str(self) -> &'static str {
        match self {
            Self::Standard => "standard",
            Self::Strict => "strict",
        }
    }
    fn parse(s: &str) -> Self {
        if s.trim().eq_ignore_ascii_case("strict") {
            Self::Strict
        } else {
            Self::Standard
        }
    }
}

/// Path of the backend-owned policy file. It is written ONLY by
/// `set_confirmation_policy` (passphrase-gated), never via the renderer-writable
/// tauri-store, so a compromised renderer cannot weaken confirmation strength.
fn policy_path(app: &AppHandle) -> Result<std::path::PathBuf, Error> {
    let dir = app.path().app_data_dir().map_err(|e| {
        Error::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            e.to_string(),
        ))
    })?;
    Ok(dir.join("confirm_policy"))
}

fn load_policy(app: &AppHandle) -> ConfirmationPolicy {
    policy_path(app)
        .ok()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .map(|s| ConfirmationPolicy::parse(&s))
        .unwrap_or(ConfirmationPolicy::Standard)
}

#[tauri::command]
pub fn get_confirmation_policy(app: AppHandle) -> Result<String, Error> {
    Ok(load_policy(&app).as_str().to_string())
}

/// Change the confirmation policy. Requires the wallet passphrase so a
/// compromised renderer cannot weaken confirmation strength on its own.
#[tauri::command(async)]
pub fn set_confirmation_policy(
    app: AppHandle,
    policy: String,
    passphrase: String,
    wallet: State<AppWallet>,
) -> Result<(), Error> {
    // Verify the passphrase (unlocks the session, acceptable for a user-initiated
    // settings change).
    wallet.0.unlock(&passphrase)?;
    let p = ConfirmationPolicy::parse(&policy);
    let path = policy_path(&app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(Error::Io)?;
    }
    std::fs::write(&path, p.as_str()).map_err(Error::Io)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dummy_summary(id: &str) -> SignSummary {
        SignSummary {
            request_id: id.to_string(),
            chain_id: "aca376f2".into(),
            title: "Test".into(),
            signer_public_key: "EOS6MRy".into(),
            mode: SignMode::Push,
            actions: vec![],
            expiration: Some(0),
            delay_sec: 0,
            has_context_free_actions: false,
            origin: None,
            callback_url: None,
            identity_scope: None,
            any_unverified: false,
        }
    }

    #[test]
    fn ids_are_unique_and_monotonic() {
        let reg = SignRegistry::new();
        let a = reg.next_id();
        let b = reg.next_id();
        assert_ne!(a, b);
        assert!(a.starts_with("sign_"));
    }

    #[test]
    fn insert_summary_take_roundtrip() {
        let reg = SignRegistry::new();
        let (tx, _rx) = oneshot::channel();
        let id = reg.next_id();
        reg.insert(
            id.clone(),
            PendingSign {
                chain_id: "aca376f2".into(),
                signer_public_key: "EOS6MRy".into(),
                mode: SignMode::Push,
                payload: SignPayload::Export,
                summary: dummy_summary(&id),
                responder: tx,
            },
        );
        assert_eq!(reg.len(), 1);
        assert!(reg.summary(&id).is_some());
        assert!(reg.take(&id).is_some());
        assert!(reg.is_empty());
        assert!(reg.summary(&id).is_none());
    }

    #[test]
    fn summary_flags_high_risk_and_unverified() {
        use crate::antelope::transaction::{
            AuthDesc, BuiltAction, BuiltTransaction, DataProvenance,
        };
        let built = BuiltTransaction {
            packed_trx: vec![1, 2, 3],
            chain_id: "aca376f2".into(),
            expiration: 100,
            delay_sec: 0,
            has_context_free_actions: false,
            actions: vec![
                BuiltAction {
                    account: "eosio.token".into(),
                    name: "transfer".into(),
                    authorization: vec![AuthDesc {
                        actor: "alice".into(),
                        permission: "active".into(),
                    }],
                    data_hex: "00".into(),
                    original_json: Some(serde_json::json!({
                        "from": "alice", "to": "bob", "quantity": "1.0000 EOS", "memo": ""
                    })),
                    provenance: DataProvenance::Native,
                },
                BuiltAction {
                    account: "eosio".into(),
                    name: "updateauth".into(),
                    authorization: vec![AuthDesc {
                        actor: "alice".into(),
                        permission: "owner".into(),
                    }],
                    data_hex: "ff".into(),
                    original_json: None, // RPC fallback → cannot be locally verified
                    provenance: DataProvenance::Rpc,
                },
            ],
        };
        let s = build_sign_summary(
            "sign_1".into(),
            &built,
            "EOS6MRy",
            SignMode::Push,
            "T".into(),
            None,
            None,
            None,
        );
        assert_eq!(s.actions.len(), 2);
        // Native + JSON → verified, not high-risk.
        assert!(s.actions[0].verified);
        assert!(!s.actions[0].high_risk);
        // RPC + no JSON → unverified; updateauth → high-risk with a warning.
        assert!(!s.actions[1].verified);
        assert!(s.actions[1].high_risk);
        assert!(s.actions[1].warning.is_some());
        assert!(s.any_unverified);
    }

    #[test]
    fn registry_enforces_single_active() {
        let reg = SignRegistry::new();
        let (tx, _rx) = oneshot::channel();
        let id = reg.next_id();
        reg.begin(
            id.clone(),
            PendingSign {
                chain_id: "c".into(),
                signer_public_key: "k".into(),
                mode: SignMode::Export,
                payload: SignPayload::Export,
                summary: dummy_summary(&id),
                responder: tx,
            },
        )
        .unwrap();
        assert_eq!(reg.active_id().as_deref(), Some(id.as_str()));

        // A second concurrent request is rejected.
        let (tx2, _rx2) = oneshot::channel();
        let id2 = reg.next_id();
        assert!(reg
            .begin(
                id2.clone(),
                PendingSign {
                    chain_id: "c".into(),
                    signer_public_key: "k".into(),
                    mode: SignMode::Export,
                    payload: SignPayload::Export,
                    summary: dummy_summary(&id2),
                    responder: tx2,
                },
            )
            .is_err());

        // Taking the active request clears the active marker.
        assert!(reg.take(&id).is_some());
        assert!(reg.active_id().is_none());
    }
}
