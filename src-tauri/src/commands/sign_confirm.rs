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
    /// Hex-encoded 32-byte signing digest (`sha256(chain_id || packed_trx || zeros_32)`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signing_digest_hex: Option<String>,
    /// Hex-encoded 32-byte EIP-191 digest (`keccak256("\x19Ethereum Signed Message:\n32" || signing_digest)`),
    /// populated when signing with a Wire `PUB_EM_` key.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub eip191_hash_hex: Option<String>,
    /// EIP-55 Ethereum address (`0x...`) derived from `signer_public_key` when `is_em_signer` is true.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signer_eth_address: Option<String>,
    /// True when `signer_public_key` is a Wire `PUB_EM_` key.
    pub is_em_signer: bool,
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
    // On Vaulta (`core.vaulta`) and Wire (`sysio`) these actions arrive on the
    // chain's system contract (see try_native_serialize); treat them as their
    // eosio equivalents so the risk hints still apply.
    let account = if account == "core.vaulta" || account == "sysio" {
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
    let decoded_native = match a.name.as_str() {
        "transfer" => hex::decode(&a.data_hex)
            .ok()
            .and_then(|bytes| crate::antelope::serialize::decode_transfer(&bytes).ok()),
        "updateauth" if a.account == "sysio" || a.account == "eosio" || a.account == "core.vaulta" => {
            hex::decode(&a.data_hex)
                .ok()
                .and_then(|bytes| {
                    crate::antelope::serialize::decode_updateauth(&bytes, a.account == "sysio")
                        .ok()
                })
        }
        "claimpay" | "claimnodedis" if a.account == "sysio" || a.account == "eosio" => {
            hex::decode(&a.data_hex).ok().and_then(|bytes| {
                let arr: [u8; 8] = bytes.as_slice().try_into().ok()?;
                let name = crate::antelope::serialize::u64_to_name(u64::from_le_bytes(arr));
                if name.is_empty() {
                    return None;
                }
                Some(serde_json::json!({ "account_name": name }))
            })
        }
        _ => None,
    };
    let verified = decoded_native.is_some()
        || (a.name != "transfer"
            && a.provenance.is_locally_verified()
            && a.original_json.is_some());
    if !verified {
        *any_unverified = true;
    }
    let data = decoded_native
        .or_else(|| a.original_json.clone())
        .unwrap_or_else(|| serde_json::json!({ "_unverified_hex": a.data_hex }));

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

    let is_em_signer = signing::is_em_public_key(signer_public_key);
    let digest_opt = signing::compute_signing_digest(&built.chain_id, &built.packed_trx).ok();
    let signing_digest_hex = digest_opt.as_ref().map(hex::encode);
    let eip191_hash_hex = if is_em_signer {
        digest_opt
            .as_ref()
            .map(|d| hex::encode(signing::eip191_digest32(d)))
    } else {
        None
    };
    let signer_eth_address = if is_em_signer {
        signing::eth_address_from_pub_em(signer_public_key).ok()
    } else {
        None
    };

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
        signing_digest_hex,
        eip191_hash_hex,
        signer_eth_address,
        is_em_signer,
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

/// Execute a user-approved request: sign the exact stored bytes and (per mode)
/// broadcast / return the signature / export the key.
#[allow(clippy::too_many_arguments)]
async fn execute_approved(
    app: &AppHandle,
    request_id: &str,
    chain_id: &str,
    signer_public_key: &str,
    payload: SignPayload,
    passphrase: Option<String>,
    signer_backend: Option<String>,
    ledger_index: Option<u32>,
    extra_force_passphrase: bool,
    wallet: &AppWallet,
    providers: &ProviderState,
    registry: &SignRegistry,
) -> Result<serde_json::Value, Error> {
    match payload {
        SignPayload::Transaction {
            packed_trx,
            broadcast,
        } => {
            let backend = signer_backend
                .as_deref()
                .unwrap_or("vault")
                .trim()
                .to_lowercase();
            let signature = match backend.as_str() {
                "metamask" => {
                    let digest = signing::compute_signing_digest(chain_id, &packed_trx)?;
                    crate::metamask_bridge::sign_digest_via_metamask(
                        app,
                        &digest,
                        signer_public_key,
                    )
                    .await?
                }
                #[cfg(feature = "ledger")]
                "ledger_eth" => {
                    let digest = signing::compute_signing_digest(chain_id, &packed_trx)?;
                    let idx = ledger_index.unwrap_or(0);
                    let path = crate::ledger::protocol::eth_bip44_path(0, idx);
                    crate::ledger::protocol::sign_eth_personal_message_32(
                        &path,
                        &digest,
                        Some(signer_public_key),
                    )?
                }
                #[cfg(feature = "ledger")]
                "ledger_eos" => {
                    let idx = ledger_index.unwrap_or(0);
                    let path = crate::ledger::protocol::eos_bip44_path(0, idx);
                    let device_pub = crate::ledger::protocol::get_public_key(&path, false)?;
                    if device_pub != signer_public_key {
                        return Err(Error::Ledger(format!(
                            "Ledger EOS key mismatch at index {}: expected {}, got {}",
                            idx, signer_public_key, device_pub
                        )));
                    }
                    let chain_id_bytes = hex::decode(chain_id)
                        .map_err(|e| Error::Serialization(format!("Invalid chain_id hex: {e}")))?;
                    let mut signing_data =
                        Vec::with_capacity(chain_id_bytes.len() + packed_trx.len() + 32);
                    signing_data.extend_from_slice(&chain_id_bytes);
                    signing_data.extend_from_slice(&packed_trx);
                    signing_data.extend_from_slice(&[0u8; 32]);
                    crate::ledger::protocol::sign_transaction(&path, &signing_data)?
                }
                _ => {
                    let key = unlock_signing_key(
                        wallet,
                        chain_id,
                        signer_public_key,
                        passphrase,
                        extra_force_passphrase,
                    )?;
                    let sig = signing::sign_transaction_for_key(
                        chain_id,
                        &packed_trx,
                        &key,
                        signer_public_key,
                    )?;
                    if signing::is_em_public_key(signer_public_key) {
                        let digest = signing::compute_signing_digest(chain_id, &packed_trx)?;
                        signing::verify_sig_em_for_pubkey(&digest, &sig, signer_public_key)?
                    } else {
                        sig
                    }
                }
            };

            // Abort before broadcasting if the confirmation request was rejected or
            // its window was closed while awaiting an external signer (MetaMask/Ledger).
            if registry.summary(request_id).is_none() {
                return Err(Error::SignRejected);
            }

            if broadcast {
                let pm = &mut providers.get(chain_id).await?;
                let result = transaction::push_signed(pm, &packed_trx, &signature).await?;
                serde_json::to_value(result).map_err(|e| Error::Serialization(e.to_string()))
            } else {
                Ok(serde_json::json!({
                    "packed_trx": hex::encode(&packed_trx),
                    "signature": signature,
                }))
            }
        }
        SignPayload::Export => {
            let key = unlock_signing_key(
                wallet,
                chain_id,
                signer_public_key,
                passphrase,
                true,
            )?;
            let exported = if signing::is_em_public_key(signer_public_key) {
                format!("0x{}", hex::encode(&*key))
            } else {
                signing::wif_encode(&key)
            };
            Ok(serde_json::json!({ "wif": exported }))
        }
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
        let pm = &mut providers.get(&chain_id).await?;
        let built = transaction::build_tx(pm, &actions).await?;
        if broadcast
            && actions.iter().any(|a| {
                matches!(
                    a.name.as_str(),
                    "updateauth"
                        | "deleteauth"
                        | "linkauth"
                        | "unlinkauth"
                        | "claimpay"
                        | "claimnodedis"
                )
            })
        {
            transaction::preflight_compute_transaction(pm, &built.packed_trx, &[]).await?;
        }
        built
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
    let is_em_signer = signing::is_em_public_key(&public_key);
    let signer_eth_address = if is_em_signer {
        signing::eth_address_from_pub_em(&public_key).ok()
    } else {
        None
    };
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
        signing_digest_hex: None,
        eip191_hash_hex: None,
        signer_eth_address,
        is_em_signer,
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
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn approve_sign(
    app: AppHandle,
    webview: WebviewWindow,
    request_id: String,
    passphrase: Option<String>,
    signer_backend: Option<String>,
    ledger_index: Option<u32>,
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
        &app,
        &request_id,
        &chain_id,
        &signer,
        payload,
        passphrase,
        signer_backend,
        ledger_index,
        strict,
        &wallet,
        &providers,
        &registry,
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

/// Classify ESR intent from the exact bytes that will be signed.
fn inspect_esr(
    packed: &[u8],
) -> Result<
    (
        crate::antelope::serialize::ParsedTransaction,
        Option<String>,
    ),
    Error,
> {
    use crate::antelope::serialize::{parse_packed_transaction, u64_to_name};
    let parsed = parse_packed_transaction(packed)?;
    if !parsed.context_free_actions.is_empty() || parsed.extension_count != 0 {
        return Err(Error::Signing(
            "ESR context-free actions and extensions are not supported".into(),
        ));
    }
    if parsed.actions.is_empty() {
        return Err(Error::Signing("Empty ESR transaction".into()));
    }
    let candidate = parsed.actions.iter().any(|a| a.account.is_empty());
    let identity = if candidate {
        let a = &parsed.actions[0];
        if parsed.actions.len() != 1
            || !a.account.is_empty()
            || a.name != "identity"
            || parsed.ref_block_num != 0
            || parsed.ref_block_prefix != 0
            || parsed.delay_sec != 0
            || parsed.max_net_usage_words != 0
            || parsed.max_cpu_usage_ms != 0
            || a.authorization.len() != 1
        {
            return Err(Error::Signing("Invalid ESR identity envelope".into()));
        }
        let data = hex::decode(&a.data_hex).map_err(|e| Error::Serialization(e.to_string()))?;
        let offset = match data.len() {
            17 => 0,
            25 => 8,
            _ => return Err(Error::Signing("Invalid identity data".into())),
        };
        if data[offset] != 1 {
            return Err(Error::Signing("Identity permission is required".into()));
        }
        let actor = u64_to_name(u64::from_le_bytes(
            data[offset + 1..offset + 9].try_into().unwrap(),
        ));
        let permission = u64_to_name(u64::from_le_bytes(
            data[offset + 9..offset + 17].try_into().unwrap(),
        ));
        if actor.is_empty()
            || permission.is_empty()
            || a.authorization[0] != (actor.clone(), permission.clone())
        {
            return Err(Error::Signing(
                "Identity permission does not match authorization".into(),
            ));
        }
        let scope = if offset == 8 {
            u64_to_name(u64::from_le_bytes(data[..8].try_into().unwrap()))
        } else {
            String::new()
        };
        Some(format!(
            "{actor}@{permission}; scope: {}",
            if scope.is_empty() {
                "unspecified"
            } else {
                &scope
            }
        ))
    } else {
        None
    };
    Ok((parsed, identity))
}

/// The renderer submits packed bytes, never an independent digest or login flag.
#[tauri::command]
pub async fn begin_esr_sign(
    app: AppHandle,
    webview: WebviewWindow,
    chain_id: String,
    public_key: String,
    packed_transaction_hex: String,
    origin: Option<String>,
    callback_url: Option<String>,
    registry: State<'_, SignRegistry>,
) -> Result<serde_json::Value, Error> {
    forbid_confirm_window(&webview)?;
    if chain_id.len() != 64 || !chain_id.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(Error::Signing("Invalid ESR chain ID".into()));
    }
    if packed_transaction_hex.len() > 2 * 1024 * 1024 {
        return Err(Error::Signing("ESR transaction too large".into()));
    }
    let packed =
        hex::decode(packed_transaction_hex).map_err(|e| Error::Serialization(e.to_string()))?;
    let (parsed, identity_scope) = inspect_esr(&packed)?;
    let is_identity = identity_scope.is_some();
    let mode = if is_identity {
        SignMode::Identity
    } else {
        SignMode::SignOnly
    };
    let request_id = registry.next_id();
    let mut any_unverified = false;
    let actions = parsed
        .actions
        .iter()
        .map(|a| {
            let built = BuiltAction {
                account: a.account.clone(),
                name: a.name.clone(),
                data_hex: a.data_hex.clone(),
                authorization: a
                    .authorization
                    .iter()
                    .map(|(actor, permission)| transaction::AuthDesc {
                        actor: actor.clone(),
                        permission: permission.clone(),
                    })
                    .collect(),
                original_json: None,
                provenance: transaction::DataProvenance::PreSerialized,
            };
            action_summary(&built, &mut any_unverified)
        })
        .collect();
    let is_em_signer = signing::is_em_public_key(&public_key);
    let digest_opt = signing::compute_signing_digest(&chain_id, &packed).ok();
    let signing_digest_hex = digest_opt.as_ref().map(hex::encode);
    let eip191_hash_hex = if is_em_signer {
        digest_opt
            .as_ref()
            .map(|d| hex::encode(signing::eip191_digest32(d)))
    } else {
        None
    };
    let signer_eth_address = if is_em_signer {
        signing::eth_address_from_pub_em(&public_key).ok()
    } else {
        None
    };
    let summary = SignSummary {
        request_id: request_id.clone(),
        chain_id: chain_id.clone(),
        title: if is_identity {
            "Login request".into()
        } else {
            "Sign request".into()
        },
        signer_public_key: public_key.clone(),
        mode,
        actions,
        expiration: Some(parsed.expiration),
        delay_sec: parsed.delay_sec,
        has_context_free_actions: false,
        origin,
        callback_url,
        identity_scope,
        any_unverified: !is_identity && any_unverified,
        signing_digest_hex,
        eip191_hash_hex,
        signer_eth_address,
        is_em_signer,
    };
    let (tx, rx) = oneshot::channel();
    registry.begin(
        request_id.clone(),
        PendingSign {
            chain_id,
            signer_public_key: public_key,
            mode,
            payload: SignPayload::Transaction {
                packed_trx: packed,
                broadcast: false,
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
        if s.trim().eq_ignore_ascii_case("standard") {
            Self::Standard
        } else {
            Self::Strict
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
    let Ok(path) = policy_path(app) else {
        return ConfirmationPolicy::Strict;
    };
    match std::fs::read_to_string(path) {
        Ok(s) => ConfirmationPolicy::parse(&s),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => ConfirmationPolicy::Standard,
        Err(_) => ConfirmationPolicy::Strict,
    }
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
    if policy != "standard" && policy != "strict" {
        return Err(Error::Serialization("Unknown confirmation policy".into()));
    }
    // Verify the passphrase (unlocks the session, acceptable for a user-initiated
    // settings change).
    wallet.0.unlock(&passphrase)?;
    let p = ConfirmationPolicy::parse(&policy);
    let path = policy_path(&app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(Error::Io)?;
    }
    use std::io::Write;
    let mut temp = tempfile::NamedTempFile::new_in(path.parent().unwrap())?;
    temp.write_all(p.as_str().as_bytes())?;
    temp.as_file().sync_all()?;
    temp.persist(path).map_err(|e| Error::Io(e.error))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn esr_identity_bytes_match_wharfkit_v2_and_v3() {
        use sha2::{Digest, Sha256};
        let fixtures: serde_json::Value =
            serde_json::from_str(include_str!("../../../tests/fixtures/esr-identities.json"))
                .unwrap();
        for fixture in fixtures.as_array().unwrap() {
            let packed = hex::decode(fixture["packed"].as_str().unwrap()).unwrap();
            let (_, identity) = inspect_esr(&packed).unwrap();
            assert!(identity.unwrap().contains("alice@active"));
            let mut hasher = Sha256::new();
            hasher.update(hex::decode(fixture["chainId"].as_str().unwrap()).unwrap());
            hasher.update(&packed);
            hasher.update([0u8; 32]);
            assert_eq!(
                hex::encode(hasher.finalize()),
                fixture["digest"].as_str().unwrap()
            );
            let mut trailing = packed.clone();
            trailing.push(0);
            assert!(inspect_esr(&trailing).is_err());
            // A second, hidden action must never be accepted as a login.
            let mut multiple = packed;
            multiple[14] = 2; // action count in the identity fixture header
            assert!(inspect_esr(&multiple).is_err());
        }
    }

    #[test]
    fn transfers_cannot_be_classified_as_login_or_use_unrelated_display_json() {
        use crate::antelope::{serialize::*, transaction::*};
        let bytes = serialize_transfer("alice", "bob", "1.0000 EOS", "").unwrap();
        let packed = RawTransaction {
            expiration: 100,
            ref_block_num: 0,
            ref_block_prefix: 0,
            max_net_usage_words: 0,
            max_cpu_usage_ms: 0,
            delay_sec: 0,
            context_free_actions: vec![],
            actions: vec![serialize_action(
                "eosio.token",
                "transfer",
                &[("alice", "active")],
                &hex::encode(&bytes),
            )
            .unwrap()],
            transaction_extensions: vec![],
        }
        .serialize();
        assert!(inspect_esr(&packed).unwrap().1.is_none());
        let mut unverified = false;
        let summary = action_summary(
            &BuiltAction {
                account: "eosio.token".into(),
                name: "transfer".into(),
                authorization: vec![],
                data_hex: hex::encode(bytes),
                original_json: Some(serde_json::json!({"to":"carol","quantity":"1000.0000 EOS"})),
                provenance: DataProvenance::Native,
            },
            &mut unverified,
        );
        assert_eq!(summary.data["to"], "bob");
        assert_eq!(summary.data["quantity"], "1.0000 EOS");
    }

    #[test]
    fn malformed_policy_requires_strict_confirmation() {
        for policy in ["{}", "", "invalid", "null"] {
            assert_eq!(
                ConfirmationPolicy::parse(policy),
                ConfirmationPolicy::Strict
            );
        }
        assert_eq!(
            ConfirmationPolicy::parse("standard"),
            ConfirmationPolicy::Standard
        );
    }

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
            signing_digest_hex: None,
            eip191_hash_hex: None,
            signer_eth_address: None,
            is_em_signer: false,
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
                    data_hex: hex::encode(
                        crate::antelope::serialize::serialize_transfer(
                            "alice",
                            "bob",
                            "1.0000 EOS",
                            "",
                        )
                        .unwrap(),
                    ),
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
