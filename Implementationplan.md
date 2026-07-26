# OctoDock Implementation Plan

> **Status:** Draft | **Target:** Tauri v2 Desktop Utility App | **Stack:** Rust + Bun + TypeScript + Tailwind CSS

## 1. Project Initialization

### 1.1 Bootstrap Command

```bash
# Create Tauri v2 project with React + TypeScript
bun create tauri-app@latest octodock-temp -- --template react-ts --manager bun
cd octodock-temp

# Move contents to root (since we're already in octodock directory)
# Alternatively, initialize directly in current directory
```

### 1.2 Recommended: Fresh Init in Current Directory

Since we're already in `E:\repos\octodock`:

```bash
# Remove temp folder if created
# Initialize manually with bun + tauri
bun init -y
bun add @tauri-apps/cli@latest @tauri-apps/api@latest
bun add -D tailwindcss postcss autoprefixer
bunx tauri init --app-name "OctoDock" --window-title "OctoDock" --dev-url "http://localhost:5173" --before-dev-command "bun run dev" --before-build-command "bun run build" --ci
```

### 1.3 Add Required Tauri Plugins

```bash
cd src-tauri
cargo tauri add global-shortcut
cargo tauri add tray
cargo tauri add shell
```

Expected results:
- `tauri-plugin-global-shortcut` added to Cargo.toml
- `tauri-plugin-shell` added to Cargo.toml
- Tray feature enabled on main `tauri` dependency

---

## 2. Cargo.toml Optimization

Immediately after init, modify `src-tauri/Cargo.toml`:

```toml
[package]
name = "octodock"
version = "0.1.0"
edition = "2021"

[lib]
name = "octodock_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri-plugin-global-shortcut = "2"
tauri-plugin-shell = "2"

[profile.dev]
debug = 0          # No debug symbols in dev - massive speedup
incremental = false  # Disable incremental compilation
opt-level = 1       # Slightly optimized dev builds

[profile.release]
lto = true          # Link-time optimization
codegen-units = 1   # Maximum optimization
strip = true        # Strip binary
```

---

## 3. tauri.conf.json Configuration

Update `src-tauri/tauri.conf.json`:

```json
{
  "$schema": "./gen/schemas/desktop-schema.json",
  "productName": "OctoDock",
  "version": "0.1.0",
  "identifier": "com.octodock.app",
  "build": {
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist",
    "beforeDevCommand": "bun run dev",
    "beforeBuildCommand": "bun run build",
    "devtools": true
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "OctoDock",
        "width": 1200,
        "height": 800,
        "minWidth": 400,
        "minHeight": 300,
        "resizable": true,
        "decorations": true,
        "visible": false,
        "center": true
      }
    ],
    "security": {
      "csp": "default-src 'self'; frame-src https://mail.google.com https://keep.google.com https://www.reddit.com https://*.google.com https://*.googleusercontent.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'",
      "capabilities": ["default"]
    }
  },
  "bundle": {
    "active": true,
    "targets": ["nsis", "msi"],
    "icon": ["icons/icon.ico", "icons/icon.png"],
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": ""
    }
  }
}
```

Key settings explained:
- `visible: false` — App starts hidden (show via tray/hotkey)
- `resizable: true` — Enables Windows Snap Assist
- `decorations: true` — Standard window frame with native resize borders
- `devtools: true` — Enable webview devtools for debugging

---

## 4. Capabilities Configuration

Update `src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-set-focus",
    "core:window:allow-set-always-on-top",
    "core:window:allow-is-visible",
    "global-shortcut:default",
    "global-shortcut:allow-register",
    "global-shortcut:allow-unregister",
    "global-shortcut:allow-is-registered",
    "shell:default",
    "shell:allow-open"
  ]
}
```

---

## 5. Rust Backend Implementation

### 5.1 Project Structure

```
src-tauri/
├── src/
│   ├── main.rs          # Thin entry point
│   └── lib.rs           # All app logic
├── capabilities/
│   └── default.json
├── Cargo.toml
├── tauri.conf.json
└── build.rs
```

### 5.2 main.rs (Thin Entry Point)

```rust
// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    octodock_lib::run();
}
```

### 5.3 lib.rs (All Application Logic)

```rust
// src-tauri/src/lib.rs
use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    menu::{Menu, MenuItem},
    Manager,
};
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

mod tray;

#[tauri::command]
fn toggle_window_visibility(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
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
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut_matched, event| {
                    if event.state == ShortcutState::Pressed {
                        if shortcut_matched.state == ShortcutState::Pressed {
                            toggle_window_visibility(app.clone());
                        }
                    }
                })
                .build(),
        )
        .setup(move |app| {
            // Register global shortcut
            app.global_shortcut().register(shortcut).unwrap_or_else(|e| {
                eprintln!("Failed to register shortcut: {}", e);
            });

            // Build system tray
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
        .invoke_handler(tauri::generate_handler![
            toggle_window_visibility,
            set_always_on_top,
            is_always_on_top,
            is_window_visible
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 6. Frontend Setup

### 6.1 Tailwind Configuration

Create `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          900: '#111827',
          800: '#1f2937',
          700: '#374151',
        }
      }
    }
  },
  plugins: [],
}
```

Create `postcss.config.js`:

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

Update `src/styles.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color-scheme: dark;
  color: #ffffff;
  background-color: #111827;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #root {
  height: 100%;
  overflow: hidden;
}

/* Force dark mode */
html {
  color-scheme: dark;
}
```

### 6.2 App State Hook

Create `src/hooks/useAppState.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function useAppState() {
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check initial state
    invoke<boolean>('is_always_on_top').then(setIsAlwaysOnTop);
    invoke<boolean>('is_window_visible').then(setIsVisible);
  }, []);

  const toggleAlwaysOnTop = useCallback(async () => {
    const newValue = !isAlwaysOnTop;
    await invoke('set_always_on_top', { onTop: newValue });
    setIsAlwaysOnTop(newValue);
  }, [isAlwaysOnTop]);

  return {
    isAlwaysOnTop,
    isVisible,
    toggleAlwaysOnTop,
  };
}
```

### 6.3 Custom Titlebar Component

Create `src/components/TitleBar.tsx`:

```typescript
import { invoke } from '@tauri-apps/api/core';
import { useAppState } from '../hooks/useAppState';

export function TitleBar() {
  const { isAlwaysOnTop, toggleAlwaysOnTop } = useAppState();

  const handleMinimize = () => invoke('minimize');
  const handleMaximize = () => invoke('maximize');
  const handleClose = () => invoke('hide'); // Hide to tray instead of close

  return (
    <div
      data-tauri-drag-region
      className="h-8 bg-gray-900 flex items-center justify-between border-b border-gray-800 select-none"
    >
      <div className="flex items-center px-3" data-tauri-drag-region>
        <span className="text-sm font-medium text-gray-300">OctoDock</span>
      </div>

      <div className="flex items-center h-full">
        {/* Always on Top Toggle */}
        <button
          onClick={toggleAlwaysOnTop}
          className={`h-full px-3 flex items-center justify-center transition-colors ${
            isAlwaysOnTop
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`}
          title={isAlwaysOnTop ? 'Unpin from top' : 'Pin to top'}
        >
          <svg
            className="w-4 h-4"
            fill={isAlwaysOnTop ? 'currentColor' : 'none'}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
            />
          </svg>
        </button>

        {/* Minimize */}
        <button
          onClick={handleMinimize}
          className="h-full px-3 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          title="Minimize"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>

        {/* Maximize/Restore */}
        <button
          onClick={handleMaximize}
          className="h-full px-3 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          title="Maximize"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4"
            />
          </svg>
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          className="h-full px-3 text-gray-400 hover:bg-red-600 hover:text-white transition-colors"
          title="Close to tray"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
```

### 6.4 Sidebar Component

Create `src/components/Sidebar.tsx`:

```typescript
interface Service {
  id: string;
  name: string;
  icon: string;
  url: string;
}

const services: Service[] = [
  { id: 'gmail', name: 'Gmail', icon: '📧', url: 'https://mail.google.com' },
  { id: 'keep', name: 'Keep', icon: '📝', url: 'https://keep.google.com' },
  { id: 'reddit', name: 'Reddit', icon: '🤖', url: 'https://www.reddit.com' },
  { id: 'calendar', name: 'Calendar', icon: '📅', url: 'https://calendar.google.com' },
];

interface SidebarProps {
  activeService: string;
  onServiceChange: (id: string) => void;
}

export function Sidebar({ activeService, onServiceChange }: SidebarProps) {
  return (
    <div className="w-14 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-2 gap-1">
      {services.map((service) => (
        <button
          key={service.id}
          onClick={() => onServiceChange(service.id)}
          className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-colors ${
            activeService === service.id
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`}
          title={service.name}
        >
          {service.icon}
        </button>
      ))}
    </div>
  );
}
```

### 6.5 Main App Component

Create `src/App.tsx`:

```typescript
import { useState, useCallback, useRef, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-shell';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';

interface Service {
  id: string;
  url: string;
}

const services: Record<string, Service> = {
  gmail: { id: 'gmail', url: 'https://mail.google.com' },
  keep: { id: 'keep', url: 'https://keep.google.com' },
  reddit: { id: 'reddit', url: 'https://www.reddit.com' },
  calendar: { id: 'calendar', url: 'https://calendar.google.com' },
};

function App() {
  const [activeService, setActiveService] = useState('gmail');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const currentUrl = services[activeService]?.url || 'https://mail.google.com';

  // Intercept clicks on external links within iframe
  const handleIframeLoad = useCallback(() => {
    // Note: Due to cross-origin restrictions, we cannot directly access iframe content
    // The webview itself handles most navigation internally
    // For external links, we rely on the CSP and shell plugin
  }, []);

  // Handle messages from iframe for link interception
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Validate message origin
      const allowedOrigins = [
        'https://mail.google.com',
        'https://keep.google.com',
        'https://www.reddit.com',
        'https://calendar.google.com',
      ];

      if (!allowedOrigins.includes(event.origin)) return;

      // Check if link should open externally
      const data = event.data;
      if (data?.type === 'external-link' && data?.url) {
        await open(data.url);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="h-full flex flex-col bg-gray-900">
      <TitleBar />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeService={activeService} onServiceChange={setActiveService} />

        <div className="flex-1 relative">
          <iframe
            ref={iframeRef}
            src={currentUrl}
            className="absolute inset-0 w-full h-full bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            loading="lazy"
            onLoad={handleIframeLoad}
          />

          {/* Overlay notification for loading state */}
          <div className="absolute inset-0 bg-gray-900 flex items-center justify-center pointer-events-none opacity-0 transition-opacity">
            <span className="text-gray-400">Loading...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
```

### 6.6 Update main.tsx

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 6.7 Update index.html

```html
<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OctoDock</title>
  </head>
  <body class="bg-gray-900">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## 7. Build & Verification Commands

### Development
```bash
bun run tauri dev
```

### Production Build
```bash
bun run tauri build
```

### Verify Setup
```bash
# Check Rust compilation
cargo check --manifest-path src-tauri/Cargo.toml

# Verify tauri.conf.json schema
bun run tauri info
```

---

## 8. Implementation Phases Summary

| Phase | Task | Status |
|-------|------|--------|
| 1 | Project Initialization with Bun + Tauri CLI | Pending |
| 2 | Cargo.toml Optimization (debug=0, incremental=false) | Pending |
| 3 | tauri.conf.json Configuration (hidden window, resizable) | Pending |
| 4 | Capabilities Setup (permissions for window, tray, shortcuts) | Pending |
| 5 | lib.rs Implementation (tray, global shortcut, commands) | Pending |
| 6 | Tailwind CSS Dark Mode Configuration | Pending |
| 7 | TitleBar Component with Always-on-Top Toggle | Pending |
| 8 | Sidebar Component with Service Icons | Pending |
| 9 | App Component with iframe and Link Interception | Pending |
| 10 | Build Verification | Pending |

---

## 9. Known Constraints & Considerations

1. **CSP for iframes**: The CSP in tauri.conf.json must include frame-src for embedded services. Google services may block embedding in iframes due to X-Frame-Options headers.

2. **Alternative to iframes**: If Google services block iframe embedding, consider:
   - Using Tauri webview windows for each service (more complex IPC)
   - Opening services in the default browser instead

3. **Cross-origin restrictions**: JavaScript cannot intercept link clicks inside cross-origin iframes. The iframe sandbox provides some protection but external link handling requires:
   - User right-click → "Open in browser"
   - Or: Content script injection (if service supports it)

4. **Tray icon**: Requires an icon file. Default uses the app icon from `app.default_window_icon()`.

5. **Global shortcut registration**: May fail if another app already uses Alt+Space. Consider alternative shortcuts like Ctrl+Shift+O.

6. **Windows Snap**: Requires `resizable: true` in tauri.conf.json, which is already set.

---

## 10. File Checklist

Before running `bun run tauri dev`, ensure these files exist:

```
octodock/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── App.css (or styles.css)
│   ├── components/
│   │   ├── TitleBar.tsx
│   │   └── Sidebar.tsx
│   └── hooks/
│       └── useAppState.ts
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   └── lib.rs
│   ├── capabilities/
│   │   └── default.json
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── build.rs
├── index.html
├── tailwind.config.js
├── postcss.config.js
├── package.json
├── tsconfig.json
├── vite.config.ts
└── bun.lockb
```