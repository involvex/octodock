use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{
    AppHandle, Manager, PhysicalPosition, PhysicalSize, State, Webview, WebviewBuilder, WebviewUrl,
    WebviewWindow,
};
use tauri_plugin_opener::OpenerExt;
use url::Url;

/// Inactive (non-active) service webviews older than this are closed to free memory.
pub const IDLE_UNLOAD_AFTER: Duration = Duration::from_secs(15 * 60);
/// How often the idle-unload background tick runs.
pub const IDLE_UNLOAD_TICK: Duration = Duration::from_secs(60);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Default)]
pub struct ServiceWindowState {
    pub active_id: Option<String>,
    /// Maps service_id → child `Webview` handle. We store the handles directly
    /// instead of labels because `app.get_webview(label)` can't find child
    /// webviews created via `Window::add_child()` — they're registered in
    /// wry's internal map but not in Tauri's `AppHandle` lookup.
    pub webviews: HashMap<String, Webview>,
    /// URL the webview was created with — used to detect edits that need recreate.
    pub urls: HashMap<String, String>,
    /// Extra hosts allowed for in-webview navigation (SSO, CDNs, etc.).
    pub allowed_hosts: HashMap<String, Vec<String>>,
    /// Last time each service webview was shown as the active embed.
    pub last_active_at: HashMap<String, Instant>,
    /// Service IDs currently being created. Prevents concurrent `add_child`
    /// races from leaving a webview that exists in wry but not in our map.
    pub pending: HashSet<String>,
}

impl ServiceWindowState {
    pub fn label_for(service_id: &str) -> String {
        format!("service:{service_id}")
    }
}

fn same_site(a: &Url, b: &Url) -> bool {
    a.scheme() == b.scheme()
        && a.host_str() == b.host_str()
        && a.port_or_known_default() == b.port_or_known_default()
}

fn host_matches_allowlist(host: &str, allowed_hosts: &[String]) -> bool {
    let host = host.to_ascii_lowercase();
    allowed_hosts.iter().any(|entry| {
        let entry = entry.trim().trim_start_matches('.').to_ascii_lowercase();
        if entry.is_empty() {
            return false;
        }
        host == entry || host.ends_with(&format!(".{entry}"))
    })
}

pub fn host_allowed(nav_url: &Url, base_url: &Url, allowed_hosts: &[String]) -> bool {
    if same_site(nav_url, base_url) {
        return true;
    }

    let Some(nav_host) = nav_url.host_str() else {
        return false;
    };
    let Some(base_host) = base_url.host_str() else {
        return false;
    };

    if host_matches_allowlist(nav_host, allowed_hosts) {
        return true;
    }

    let google_family = |host: &str| {
        host == "google.com"
            || host.ends_with(".google.com")
            || host == "googleusercontent.com"
            || host.ends_with(".googleusercontent.com")
            || host == "gstatic.com"
            || host.ends_with(".gstatic.com")
            || host == "youtube.com"
            || host.ends_with(".youtube.com")
    };

    if google_family(base_host) && google_family(nav_host) {
        return true;
    }

    if base_host.ends_with("reddit.com") && nav_host.ends_with("reddit.com") {
        return true;
    }

    // X / Twitter SPA loads its assets from twitter.com, twimg.com, and
    // t.co subdomains, and any user who navigates from x.com to twitter.com
    // (or vice versa) is still inside the same product. Treat the whole
    // family as same-site so the SPA stays embedded without each user
    // having to manually configure an allowlist.
    let x_family = |host: &str| {
        host == "x.com"
            || host.ends_with(".x.com")
            || host == "twitter.com"
            || host.ends_with(".twitter.com")
            || host == "twimg.com"
            || host.ends_with(".twimg.com")
            || host == "t.co"
            || host.ends_with(".t.co")
    };

    if x_family(base_host) && x_family(nav_host) {
        return true;
    }

    false
}

fn take_service_webview(guard: &mut ServiceWindowState, service_id: &str) -> Option<Webview> {
    guard.urls.remove(service_id);
    guard.allowed_hosts.remove(service_id);
    guard.last_active_at.remove(service_id);
    guard.webviews.remove(service_id)
}

fn touch_active(guard: &mut ServiceWindowState, service_id: &str) {
    guard
        .last_active_at
        .insert(service_id.to_string(), Instant::now());
}

/// Close inactive service webviews that have not been shown for `IDLE_UNLOAD_AFTER`.
pub fn unload_idle_service_webviews(state: &Mutex<ServiceWindowState>) {
    let Ok(mut guard) = state.lock() else {
        return;
    };
    let now = Instant::now();
    let active = guard.active_id.clone();
    let idle_ids: Vec<String> = guard
        .webviews
        .keys()
        .filter(|id| active.as_deref() != Some(id.as_str()))
        .filter(|id| {
            guard
                .last_active_at
                .get(*id)
                .map(|at| now.duration_since(*at) >= IDLE_UNLOAD_AFTER)
                .unwrap_or(true)
        })
        .cloned()
        .collect();

    for id in idle_ids {
        if let Some(webview) = take_service_webview(&mut guard, &id) {
            let _ = webview.close();
            log::debug!("Unloaded idle service webview '{id}'");
        }
    }
}

/// Spawn a background tick that unloads idle inactive service webviews.
pub fn start_idle_unload_ticker(app: AppHandle) {
    std::thread::Builder::new()
        .name("octodock-idle-unload".into())
        .spawn(move || loop {
            std::thread::sleep(IDLE_UNLOAD_TICK);
            let state = app.state::<Mutex<ServiceWindowState>>();
            unload_idle_service_webviews(&state);
        })
        .expect("spawn idle-unload ticker");
}

// Positioning failures must never prevent the webview from being shown —
// an embedded service that's merely mis-sized/mis-positioned is recoverable
// on the next resize/move event, but one that's silently left invisible
// forever (because an earlier `?` bailed out before reaching `.show()`)
// looks indistinguishable from a fully broken app.
//
// `bounds` here are relative to the *parent window's* client area, not the
// desktop — these are child webviews (see `switch_service`), not separate
// top-level windows, so there's no desktop-position/DPI translation to get
// wrong in the first place.
fn apply_bounds(webview: &Webview, bounds: &WindowBounds) {
    if bounds.width < 1.0 || bounds.height < 1.0 {
        return;
    }

    // Round rather than truncate — fractional DPI scale factors (e.g. 1.25x,
    // 1.5x on Windows) otherwise leave a stray 1px gap/overlap at the edges.
    if let Err(e) = webview.set_position(PhysicalPosition::new(
        bounds.x.round() as i32,
        bounds.y.round() as i32,
    )) {
        log::warn!("Failed to position service webview: {e}");
    }
    if let Err(e) = webview.set_size(PhysicalSize::new(
        bounds.width.round() as u32,
        bounds.height.round() as u32,
    )) {
        log::warn!("Failed to size service webview: {e}");
    }
}

fn open_external(app: &AppHandle, url: &Url) {
    let _ = app.opener().open_url(url.as_str(), None::<&str>);
}

/// Parent `Window` for child service webviews.
///
/// Do **not** inject `WebviewWindow` as a command argument: after the first
/// `add_child`, Tauri may attribute IPC to the focused child webview, and
/// deserializing `WebviewWindow` then fails with
/// "current webview is not a WebviewWindow". Look up the main window by label.
fn main_parent_window(app: &AppHandle) -> Result<tauri::Window, String> {
    if let Some(w) = app.get_window("main") {
        return Ok(w);
    }
    if let Some(ww) = app.get_webview_window("main") {
        return Ok(<WebviewWindow as AsRef<Webview>>::as_ref(&ww).window());
    }
    let windows: Vec<_> = app.windows().keys().cloned().collect();
    let webview_windows: Vec<_> = app.webview_windows().keys().cloned().collect();
    Err(format!(
        "main window not found (windows={windows:?}, webview_windows={webview_windows:?})"
    ))
}

pub fn hide_all_service_windows(_app: &AppHandle, state: &Mutex<ServiceWindowState>) {
    if let Ok(guard) = state.lock() {
        for webview in guard.webviews.values() {
            let _ = webview.hide();
        }
    }
}

pub fn show_active_service(_app: &AppHandle, state: &Mutex<ServiceWindowState>) {
    if let Ok(mut guard) = state.lock() {
        let Some(active_id) = guard.active_id.clone() else {
            return;
        };
        let shown = if let Some(webview) = guard.webviews.get(&active_id) {
            let _ = webview.show();
            true
        } else {
            false
        };
        if shown {
            touch_active(&mut guard, &active_id);
        }
    }
}

// `async fn` here is load-bearing, not stylistic: creating a webview
// deadlocks on Windows when called from a synchronous command — Tauri's IPC
// dispatch for sync commands runs inline in a way that can block the very
// main-thread message pump that WebView2 needs to finish creating the child
// webview. Marking the command `async` makes Tauri dispatch it through the
// async runtime instead, which sidesteps the deadlock. See:
// https://github.com/tauri-apps/wry/issues/583
#[tauri::command]
pub async fn switch_service(
    app: AppHandle,
    state: State<'_, Mutex<ServiceWindowState>>,
    service_id: String,
    url: String,
    bounds: WindowBounds,
    allowed_hosts: Option<Vec<String>>,
) -> Result<(), String> {
    let base_url = Url::parse(&url).map_err(|e| e.to_string())?;
    let label = ServiceWindowState::label_for(&service_id);
    let hosts = allowed_hosts.unwrap_or_default();

    log::debug!("switch_service → {service_id} ({url})");

    // Phase 1: Hide all existing webviews and check if we already have this one.
    // We store `Webview` handles directly (not labels) because
    // `app.get_webview(label)` can't find child webviews created via
    // `Window::add_child()`.
    {
        let mut guard = state.lock().map_err(|e| e.to_string())?;
        for webview in guard.webviews.values() {
            let _ = webview.hide();
        }
        guard.active_id = Some(service_id.clone());

        let needs_recreate = guard.webviews.contains_key(&service_id)
            && (guard.urls.get(&service_id).map(String::as_str) != Some(url.as_str())
                || guard
                    .allowed_hosts
                    .get(&service_id)
                    .cloned()
                    .unwrap_or_default()
                    != hosts);

        if needs_recreate {
            if let Some(old) = take_service_webview(&mut guard, &service_id) {
                let _ = old.close();
                log::debug!("Recreating service webview '{service_id}' after URL/hosts change");
            }
        }

        if guard.webviews.contains_key(&service_id) {
            if let Some(existing) = guard.webviews.get(&service_id) {
                apply_bounds(existing, &bounds);
                existing.show().map_err(|e| e.to_string())?;
            }
            touch_active(&mut guard, &service_id);
            log::debug!("Showing existing service webview '{service_id}'");
            return Ok(());
        }

        if !guard.pending.insert(service_id.clone()) {
            // Another call is already creating this webview. Ask the frontend
            // to retry shortly instead of blocking a tokio worker with sleep.
            return Err(format!("service webview '{service_id}' is creating"));
        }
    }

    // Services are embedded as *child webviews* of the main window rather
    // than separate owned `WebviewWindow`s. Owned windows are always drawn
    // above their owner in the OS z-order and live entirely outside the
    // main window's clipping/bounds, so any bug in the bounds we compute on
    // the frontend (DPI, multi-monitor, a stale/zero rect) makes them look
    // like a random detached floating window with no way to close it —
    // exactly the "opens in a bigger window on top, can't close it" failure
    // mode this replaces. A child webview can never escape its parent
    // window's bounds or z-order by construction.
    let main_window = match main_parent_window(&app) {
        Ok(w) => w,
        Err(e) => {
            if let Ok(mut guard) = state.lock() {
                guard.pending.remove(&service_id);
            }
            return Err(e);
        }
    };

    let app_for_nav = app.clone();
    let base_for_nav = base_url.clone();
    let hosts_for_nav = hosts.clone();
    let app_for_new = app.clone();

    let builder = WebviewBuilder::new(&label, WebviewUrl::External(base_url))
        .on_navigation(move |nav_url| {
            if host_allowed(nav_url, &base_for_nav, &hosts_for_nav) {
                true
            } else {
                open_external(&app_for_nav, nav_url);
                false
            }
        })
        .on_new_window(move |nav_url, _features| {
            open_external(&app_for_new, &nav_url);
            tauri::webview::NewWindowResponse::Deny
        });

    let position = PhysicalPosition::new(bounds.x.round() as i32, bounds.y.round() as i32);
    let size = PhysicalSize::new(
        bounds.width.round().max(1.0) as u32,
        bounds.height.round().max(1.0) as u32,
    );

    let webview = match main_window.add_child(builder, position, size) {
        Ok(w) => w,
        Err(e) => {
            let msg = e.to_string();
            log::warn!("add_child failed for '{service_id}': {msg}");
            if let Ok(mut guard) = state.lock() {
                guard.pending.remove(&service_id);
                if msg.contains("already exists") {
                    if let Some(existing) = guard.webviews.get(&service_id) {
                        apply_bounds(existing, &bounds);
                        let _ = existing.show();
                        return Ok(());
                    }
                }
            }
            return Err(msg);
        }
    };
    webview.show().map_err(|e| {
        if let Ok(mut guard) = state.lock() {
            guard.pending.remove(&service_id);
        }
        e.to_string()
    })?;

    {
        let mut guard = state.lock().map_err(|e| e.to_string())?;
        guard.pending.remove(&service_id);
        guard.urls.insert(service_id.clone(), url);
        guard.allowed_hosts.insert(service_id.clone(), hosts);
        guard.webviews.insert(service_id.clone(), webview);
        touch_active(&mut guard, &service_id);
    }

    log::info!("Created service webview '{service_id}'");
    Ok(())
}

#[tauri::command]
pub fn close_service_webview(
    state: State<'_, Mutex<ServiceWindowState>>,
    service_id: String,
) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    if let Some(webview) = take_service_webview(&mut guard, &service_id) {
        let _ = webview.close();
        log::info!("Closed service webview '{service_id}'");
    }
    if guard.active_id.as_deref() == Some(service_id.as_str()) {
        guard.active_id = None;
    }
    Ok(())
}

#[tauri::command]
pub fn reload_service(
    state: State<'_, Mutex<ServiceWindowState>>,
    service_id: Option<String>,
) -> Result<(), String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let id = service_id
        .or_else(|| guard.active_id.clone())
        .ok_or_else(|| "no active service".to_string())?;
    let webview = guard
        .webviews
        .get(&id)
        .ok_or_else(|| format!("service webview '{id}' not found"))?;
    webview.reload().map_err(|e| e.to_string())?;
    log::debug!("Reloaded service webview '{id}'");
    Ok(())
}

#[tauri::command]
pub async fn update_service_bounds(
    _app: AppHandle,
    state: State<'_, Mutex<ServiceWindowState>>,
    bounds: WindowBounds,
) -> Result<(), String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let Some(active_id) = guard.active_id.as_ref() else {
        return Ok(());
    };
    if let Some(webview) = guard.webviews.get(active_id) {
        apply_bounds(webview, &bounds);
        // Re-showing here is a no-op in the common resize/move case, but it
        // also covers restoring from a minimized main window, where the
        // service webview was hidden and needs to reappear once bounds are
        // known again.
        webview.show().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn hide_service_windows(
    app: AppHandle,
    state: State<'_, Mutex<ServiceWindowState>>,
) -> Result<(), String> {
    hide_all_service_windows(&app, &state);
    Ok(())
}

#[tauri::command]
pub fn show_active_service_window(
    app: AppHandle,
    state: State<'_, Mutex<ServiceWindowState>>,
) -> Result<(), String> {
    show_active_service(&app, &state);
    Ok(())
}

#[tauri::command]
pub fn open_url_in_browser(app: AppHandle, url: String) -> Result<(), String> {
    let parsed = Url::parse(&url).map_err(|e| e.to_string())?;
    open_external(&app, &parsed);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_same_site_navigation() {
        let base = Url::parse("https://mail.google.com").unwrap();
        let nav = Url::parse("https://mail.google.com/mail/u/0").unwrap();
        assert!(host_allowed(&nav, &base, &[]));
    }

    #[test]
    fn allows_google_family_redirects() {
        let base = Url::parse("https://mail.google.com").unwrap();
        let nav = Url::parse("https://accounts.google.com/ServiceLogin").unwrap();
        assert!(host_allowed(&nav, &base, &[]));
    }

    #[test]
    fn allows_x_family_redirects() {
        let base = Url::parse("https://x.com").unwrap();
        let nav = Url::parse("https://abs.twimg.com/stuff").unwrap();
        assert!(host_allowed(&nav, &base, &[]));

        let base = Url::parse("https://x.com").unwrap();
        let nav = Url::parse("https://twitter.com/i/flow/login").unwrap();
        assert!(host_allowed(&nav, &base, &[]));

        let base = Url::parse("https://twitter.com").unwrap();
        let nav = Url::parse("https://t.co/abc").unwrap();
        assert!(host_allowed(&nav, &base, &[]));
    }

    #[test]
    fn rejects_unrelated_external_hosts() {
        let base = Url::parse("https://mail.google.com").unwrap();
        let nav = Url::parse("https://example.com").unwrap();
        assert!(!host_allowed(&nav, &base, &[]));
    }

    #[test]
    fn allows_configured_extra_hosts() {
        let base = Url::parse("https://app.notion.so").unwrap();
        let nav = Url::parse("https://login.microsoftonline.com/oauth").unwrap();
        let allowed = vec!["microsoftonline.com".to_string()];
        assert!(host_allowed(&nav, &base, &allowed));
    }

    #[test]
    fn allowlist_matches_subdomains() {
        assert!(host_matches_allowlist(
            "foo.auth0.com",
            &["auth0.com".to_string()]
        ));
        assert!(!host_matches_allowlist(
            "evilauth0.com",
            &["auth0.com".to_string()]
        ));
    }
}
