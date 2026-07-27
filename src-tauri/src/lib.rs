mod hotkey;
mod service_window;

use std::sync::Mutex;

use hotkey::{default_hotkey, parse_shortcut};
use service_window::{
    hide_all_service_windows, hide_service_windows, open_url_in_browser, show_active_service,
    show_active_service_window, switch_service, update_service_bounds, ServiceWindowState,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[derive(Default)]
struct HotkeyState {
    current: Option<Shortcut>,
    label: String,
}

fn log_level_from_env() -> log::LevelFilter {
    let raw = std::env::var("OCTODOCK_LOG")
        .or_else(|_| std::env::var("RUST_LOG"))
        .unwrap_or_default()
        .to_ascii_lowercase();

    if raw.contains("trace") {
        log::LevelFilter::Trace
    } else if raw.contains("debug") {
        log::LevelFilter::Debug
    } else if raw.contains("warn") {
        log::LevelFilter::Warn
    } else if raw.contains("error") {
        log::LevelFilter::Error
    } else if raw.contains("info") {
        log::LevelFilter::Info
    } else if cfg!(debug_assertions) {
        log::LevelFilter::Debug
    } else {
        log::LevelFilter::Info
    }
}

// Service webviews (Gmail, Keep, etc.) are only ever created once the main
// window is actually shown to the user. Emitting this lets the frontend defer
// the (potentially slow, sometimes Google-anti-automation-blocked) WebView2
// creation instead of eagerly spinning one up the instant the app boots
// hidden into the tray.
fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("main-window-shown", ());
        let state = app.state::<Mutex<ServiceWindowState>>();
        show_active_service(app, &state);
        log::debug!("Main window shown");
    }
}

#[tauri::command]
fn toggle_window_visibility(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let visible = window.is_visible().unwrap_or(false);
        log::debug!("toggle_window_visibility (was_visible={visible})");
        if visible {
            let state = app.state::<Mutex<ServiceWindowState>>();
            let _ = window.hide();
            hide_all_service_windows(&app, &state);
        } else {
            show_main_window(&app);
        }
    }
}

#[tauri::command]
fn set_always_on_top(app: tauri::AppHandle, on_top: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window
            .set_always_on_top(on_top)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn is_always_on_top(app: tauri::AppHandle) -> bool {
    if let Some(window) = app.get_webview_window("main") {
        window.is_always_on_top().unwrap_or(false)
    } else {
        false
    }
}

#[tauri::command]
fn is_window_visible(app: tauri::AppHandle) -> bool {
    if let Some(window) = app.get_webview_window("main") {
        window.is_visible().unwrap_or(false)
    } else {
        false
    }
}

#[tauri::command]
fn get_hotkey(state: tauri::State<'_, Mutex<HotkeyState>>) -> Result<String, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    if guard.label.is_empty() {
        Ok(default_hotkey().to_string())
    } else {
        Ok(guard.label.clone())
    }
}

#[tauri::command]
fn set_hotkey(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<HotkeyState>>,
    hotkey: String,
) -> Result<String, String> {
    let shortcut = parse_shortcut(&hotkey)?;
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    let label = hotkey.trim().to_string();

    // Same combo already registered — just refresh the label.
    if guard.current.as_ref() == Some(&shortcut) {
        guard.label = label.clone();
        log::debug!("Hotkey already registered: {label}");
        return Ok(label);
    }

    // Register the new shortcut *before* dropping the old one so a conflict
    // never leaves the app with zero hotkey.
    if let Err(err) = app.global_shortcut().register(shortcut) {
        log::warn!("Failed to register hotkey '{label}': {err}");
        return Err(err.to_string());
    }

    if let Some(previous) = guard.current.take() {
        if let Err(err) = app.global_shortcut().unregister(previous) {
            log::warn!("Failed to unregister previous hotkey: {err}");
        }
    }

    guard.current = Some(shortcut);
    guard.label = label.clone();
    log::info!("Registered hotkey: {label}");
    Ok(label)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .manage(Mutex::new(ServiceWindowState::default()))
        .manage(Mutex::new(HotkeyState {
            current: None,
            label: default_hotkey().to_string(),
        }))
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            show_main_window(app);
        }))
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_opener::init());

    #[cfg(feature = "updater")]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::all()
                        - tauri_plugin_window_state::StateFlags::VISIBLE
                        - tauri_plugin_window_state::StateFlags::DECORATIONS,
                )
                .build(),
        )
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        toggle_window_visibility(app.clone());
                    }
                })
                .build(),
        )
        .setup(|app| {
            let level = log_level_from_env();
            let install_log_plugin = cfg!(debug_assertions)
                || std::env::var_os("OCTODOCK_LOG").is_some()
                || std::env::var_os("RUST_LOG").is_some();
            if install_log_plugin {
                app.handle()
                    .plugin(tauri_plugin_log::Builder::default().level(level).build())?;
                log::info!("Log plugin ready (level={level})");
            }

            // Try to register a sensible default hotkey so the app is usable
            // immediately, even before React loads and calls `set_hotkey` with
            // the saved value. If another app already owns this combo we log
            // and move on — the frontend will toast and let the user pick
            // another combo in Settings.
            let default = parse_shortcut(default_hotkey()).expect("default hotkey parses");
            match app.global_shortcut().register(default) {
                Ok(()) => {
                    if let Ok(mut state) = app.state::<Mutex<HotkeyState>>().lock() {
                        state.current = Some(default);
                        state.label = default_hotkey().to_string();
                    }
                    log::info!("Registered default hotkey: {}", default_hotkey());
                }
                Err(err) => {
                    log::warn!(
                        "Failed to register default hotkey '{}': {err}",
                        default_hotkey()
                    );
                    eprintln!(
                        "Failed to register default hotkey '{}': {err}",
                        default_hotkey()
                    );
                }
            }

            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_item = MenuItem::with_id(app, "show", "Show/Hide", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("OctoDock")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        toggle_window_visibility(app.clone());
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_window_visibility(tray.app_handle().clone());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }

            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
                let app = window.app_handle();
                let state = app.state::<Mutex<ServiceWindowState>>();
                hide_all_service_windows(app, &state);
            }
        })
        .invoke_handler(tauri::generate_handler![
            toggle_window_visibility,
            set_always_on_top,
            is_always_on_top,
            is_window_visible,
            switch_service,
            update_service_bounds,
            hide_service_windows,
            show_active_service_window,
            open_url_in_browser,
            get_hotkey,
            set_hotkey
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
