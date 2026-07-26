use std::collections::HashMap;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{
    AppHandle, Manager, PhysicalPosition, PhysicalSize, State, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};
use tauri_plugin_opener::OpenerExt;
use url::Url;

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
    pub windows: HashMap<String, String>,
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

pub fn host_allowed(nav_url: &Url, base_url: &Url) -> bool {
    if same_site(nav_url, base_url) {
        return true;
    }

    let Some(nav_host) = nav_url.host_str() else {
        return false;
    };
    let Some(base_host) = base_url.host_str() else {
        return false;
    };

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

    false
}

fn apply_bounds(window: &WebviewWindow, bounds: &WindowBounds) -> Result<(), String> {
    if bounds.width < 1.0 || bounds.height < 1.0 {
        return Ok(());
    }

    // Round rather than truncate — fractional DPI scale factors (e.g. 1.25x,
    // 1.5x on Windows) otherwise leave a stray 1px gap/overlap at the edges.
    window
        .set_position(PhysicalPosition::new(
            bounds.x.round() as i32,
            bounds.y.round() as i32,
        ))
        .map_err(|e| e.to_string())?;
    window
        .set_size(PhysicalSize::new(
            bounds.width.round() as u32,
            bounds.height.round() as u32,
        ))
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn open_external(app: &AppHandle, url: &Url) {
    let _ = app.opener().open_url(url.as_str(), None::<&str>);
}

pub fn hide_all_service_windows(app: &AppHandle, state: &Mutex<ServiceWindowState>) {
    if let Ok(guard) = state.lock() {
        for label in guard.windows.values() {
            if let Some(window) = app.get_webview_window(label) {
                let _ = window.hide();
            }
        }
    }
}

pub fn show_active_service(app: &AppHandle, state: &Mutex<ServiceWindowState>) {
    if let Ok(guard) = state.lock() {
        let Some(active_id) = guard.active_id.as_ref() else {
            return;
        };
        let Some(label) = guard.windows.get(active_id) else {
            return;
        };
        if let Some(window) = app.get_webview_window(label) {
            let _ = window.show();
        }
    }
}

#[tauri::command]
pub fn switch_service(
    app: AppHandle,
    state: State<'_, Mutex<ServiceWindowState>>,
    service_id: String,
    url: String,
    bounds: WindowBounds,
) -> Result<(), String> {
    let base_url = Url::parse(&url).map_err(|e| e.to_string())?;
    let label = ServiceWindowState::label_for(&service_id);

    {
        let mut guard = state.lock().map_err(|e| e.to_string())?;
        for existing_label in guard.windows.values() {
            if let Some(window) = app.get_webview_window(existing_label) {
                let _ = window.hide();
            }
        }
        guard.active_id = Some(service_id.clone());
        guard.windows.insert(service_id.clone(), label.clone());
    }

    if let Some(existing) = app.get_webview_window(&label) {
        apply_bounds(&existing, &bounds)?;
        existing.show().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let Some(main) = app.get_webview_window("main") else {
        return Err("main window not found".into());
    };

    let app_for_nav = app.clone();
    let base_for_nav = base_url.clone();
    let app_for_new = app.clone();

    let builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(base_url))
        .decorations(false)
        .resizable(false)
        .skip_taskbar(true)
        .visible(false)
        .always_on_top(false)
        .title(format!("OctoDock — {service_id}"))
        .parent(&main)
        .map_err(|e| e.to_string())?
        .on_navigation(move |nav_url| {
            if host_allowed(nav_url, &base_for_nav) {
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

    let window = builder.build().map_err(|e| e.to_string())?;
    apply_bounds(&window, &bounds)?;
    window.show().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_service_bounds(
    app: AppHandle,
    state: State<'_, Mutex<ServiceWindowState>>,
    bounds: WindowBounds,
) -> Result<(), String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let Some(active_id) = guard.active_id.as_ref() else {
        return Ok(());
    };
    let Some(label) = guard.windows.get(active_id) else {
        return Ok(());
    };
    if let Some(window) = app.get_webview_window(label) {
        apply_bounds(&window, &bounds)?;
        // Re-showing here is a no-op in the common resize/move case, but it
        // also covers restoring from a minimized main window, where the
        // service webview was hidden and needs to reappear once bounds are
        // known again.
        window.show().map_err(|e| e.to_string())?;
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
        assert!(host_allowed(&nav, &base));
    }

    #[test]
    fn allows_google_family_redirects() {
        let base = Url::parse("https://mail.google.com").unwrap();
        let nav = Url::parse("https://accounts.google.com/ServiceLogin").unwrap();
        assert!(host_allowed(&nav, &base));
    }

    #[test]
    fn rejects_unrelated_external_hosts() {
        let base = Url::parse("https://mail.google.com").unwrap();
        let nav = Url::parse("https://example.com").unwrap();
        assert!(!host_allowed(&nav, &base));
    }
}
