mod service_window;

use std::sync::Mutex;

use service_window::{
    hide_all_service_windows, hide_service_windows, show_active_service,
    show_active_service_window, switch_service, update_service_bounds, ServiceWindowState,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[tauri::command]
fn toggle_window_visibility(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let visible = window.is_visible().unwrap_or(false);
        let state = app.state::<Mutex<ServiceWindowState>>();
        if visible {
            let _ = window.hide();
            hide_all_service_windows(&app, &state);
        } else {
            let _ = window.show();
            let _ = window.set_focus();
            show_active_service(&app, &state);
        }
    }
}

#[tauri::command]
fn set_always_on_top(app: tauri::AppHandle, on_top: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.set_always_on_top(on_top).map_err(|e| e.to_string())?;
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let shortcut = Shortcut::new(Some(Modifiers::ALT), Code::Space);

    tauri::Builder::default()
        .manage(Mutex::new(ServiceWindowState::default()))
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let state = app.state::<Mutex<ServiceWindowState>>();
                show_active_service(app, &state);
            }
        }))
        .plugin(tauri_plugin_opener::init())
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
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            if let Err(err) = app.global_shortcut().register(shortcut) {
                eprintln!("Failed to register Alt+Space shortcut: {err}");
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
            show_active_service_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
