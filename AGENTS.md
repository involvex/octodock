# OctoDock — Agent Instructions

> **Project:** OctoDock — Desktop multi-service dock
> **Stack:** Tauri v2, Rust, Bun, React 19, TypeScript, Tailwind CSS
> **Package Manager:** Bun (>=1.3.0). Do NOT use npm, yarn, or pnpm.

---

## Project Overview

OctoDock is a lightweight desktop utility that embeds multiple web services (Gmail, Keep, Reddit, Calendar, etc.) into a single dockable window. It lives in the system tray, toggles via **Alt+Space**, supports always-on-top pinning, and uses isolated native webviews per service for security and performance.

---

## Useful Commands

### Development

```bash
# Install dependencies
bun install

# Start development (frontend + Tauri backend with hot-reload)
bun run tauri dev
```

### Build

```bash
# Type-check frontend + build frontend assets
bun run build

# Full production build (frontend + Rust bundle for Windows NSIS/MSI)
bun run tauri build
```

### Rust Backend

```bash
# Check Rust compilation without producing a binary
cargo check --manifest-path src-tauri/Cargo.toml

# Run clippy for lint warnings
cargo clippy --manifest-path src-tauri/Cargo.toml

# Run Rust formatter
cargo fmt --manifest-path src-tauri/Cargo.toml
```

### Frontend Only

```bash
# Vite dev server (frontend only, no Tauri)
bun run dev

# TypeScript type-check
bunx tsc --noEmit

# Preview production build locally
bun run preview
```

### Tauri CLI

```bash
# Show Tauri environment info
bun run tauri info

# Add a Tauri plugin (from src-tauri/)
bunx tauri add <plugin-name>

# Icon generation from a source image
bunx tauri icon path/to/source.png
```

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Desktop Framework | Tauri v2 | 2.x |
| Backend Language | Rust | Edition 2021 (MSRV 1.77.2) |
| Package Manager | Bun | >=1.3.0 |
| Frontend Framework | React | 19.x |
| Language (Frontend) | TypeScript | 5.x (strict mode) |
| Build Tool | Vite | 8.x |
| CSS Framework | Tailwind CSS | 3.x |
| PostCSS | autoprefixer + tailwindcss | latest |

### Key Tauri Plugins (Rust side)

| Plugin | Purpose |
|---|---|
| `tauri-plugin-global-shortcut` | Alt+Space global hotkey |
| `tauri-plugin-single-instance` | Prevents multiple app instances |
| `tauri-plugin-window-state` | Persists window position/size |
| `tauri-plugin-opener` | Opens external links in system browser |
| `tauri-plugin-store` | Persists settings to `settings.json` |
| `tauri-plugin-log` | Dev-only logging |

### Key Tauri JS APIs (Frontend side)

| API | Purpose |
|---|---|
| `@tauri-apps/api/core` | `invoke()` for calling Rust commands |
| `@tauri-apps/api/window` | `getCurrentWindow()` for window control |
| `@tauri-apps/plugin-store` | `load()` / `get()` / `set()` for settings persistence |
| `@tauri-apps/plugin-opener` | Opening URLs externally from frontend |

---

## Project Structure

```
octodock/
├── src/                          # Frontend (React + TypeScript)
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Root component — layout orchestration
│   ├── styles.css                # Tailwind imports + global dark-mode styles
│   ├── vite-env.d.ts             # Vite type declarations
│   ├── components/
│   │   ├── TitleBar.tsx          # Custom titlebar with drag region, pin, min/max/close
│   │   ├── Sidebar.tsx           # Service icon navigation
│   │   ├── ServiceContentArea.tsx # Measures bounds, invokes Rust to position service webviews
│   │   └── SettingsModal.tsx     # Add/remove/reorder services
│   └── hooks/
│       ├── useAppState.ts        # Always-on-top state + persistence
│       └── useSettingsStore.ts   # Service config CRUD via Tauri Store
│
├── src-tauri/                    # Backend (Rust + Tauri)
│   ├── src/
│   │   ├── main.rs               # Thin entry point (calls lib::run)
│   │   ├── lib.rs                # App builder, tray, shortcuts, commands, window events
│   │   └── service_window.rs     # Per-service webview creation, navigation interception
│   ├── capabilities/
│   │   ├── default.json          # Main window permissions
│   │   └── desktop.json          # Desktop-only permissions (shortcuts, window-state)
│   ├── Cargo.toml                # Rust dependencies + optimized build profiles
│   ├── tauri.conf.json           # Tauri configuration (window, CSP, bundle)
│   └── build.rs                  # Tauri build script
│
├── index.html                    # HTML shell
├── package.json                  # Bun-managed dependencies
├── tsconfig.json                 # TypeScript config (strict, ESNext)
├── vite.config.ts                # Vite config with React plugin
├── tailwind.config.js            # Tailwind config (dark mode, custom colors)
├── postcss.config.js             # PostCSS with Tailwind + Autoprefixer
└── bun.lock                      # Bun lockfile
```

---

## Architecture

### Window Model

- **Main window**: Custom-decorated, starts hidden (`visible: false`), toggled by tray or Alt+Space.
- **Service windows**: Separate native webviews created as children of the main window. Each service gets its own `WebviewWindow` managed by Rust (`service_window.rs`).
- **Navigation interception**: External links are opened in the system browser via `tauri-plugin-opener`. Same-family navigation (e.g., Google subdomains) is allowed within the webview.

### State Flow

```
Frontend (React)                    Backend (Rust)
─────────────────                   ──────────────
useSettingsStore ──invoke()──►      switch_service (creates/shows webview)
useAppState ──────invoke()──►       set_always_on_top
ServiceContentArea ─invoke()──►     update_service_bounds
                                    toggle_window_visibility
```

### Settings Persistence

Settings are stored via `@tauri-apps/plugin-store` in a `settings.json` file. Keys include:
- `services` — Array of `ServiceConfig` (id, name, icon, url)
- `lastActiveService` — ID of the last selected service
- `alwaysOnTop` — Boolean for the pin state

---

## Best Practices & Guidelines

### General

- **Bun only.** Never use `npm`, `yarn`, or `pnpm`. All package management goes through `bun`.
- **Dark mode only.** Do not add light mode logic. The entire UI is dark-themed by design (`bg-gray-900` as base, `color-scheme: dark`).
- **No emojis in code** unless explicitly requested by the user.

### Rust Backend

- **Keep `main.rs` thin.** All logic belongs in `lib.rs` or feature modules (e.g., `service_window.rs`).
- **Use `Result<T, String>` for Tauri commands** — Tauri serializes the error string to the frontend.
- **Prefer `map_err(|e| e.to_string())?`** over `.unwrap()` in command handlers.
- **Mutex for shared state.** Use `std::sync::Mutex<T>` managed via `tauri::Builder::manage()`.
- **Error handling in setup.** Use `?` operator or `eprintln!` — never `.unwrap()` in `setup` closures.
- **Profile optimization.** Keep `[profile.dev]` with `debug = 0`, `incremental = false`, `opt-level = 1` to prevent `target/` folder bloat.
- **Release profile.** Use `lto = true`, `codegen-units = 1`, `strip = true` for minimal binary size.
- **Conditional compilation.** Desktop-only plugins (`global-shortcut`, `single-instance`, `window-state`) are behind `cfg(not(any(target_os = "android", target_os = "ios")))`.

### Frontend (TypeScript / React)

- **TypeScript strict mode** is enabled. Respect `noUncheckedIndexedAccess` — index access returns `T | undefined`.
- **Use `void` prefix** for fire-and-forget async calls in event handlers (e.g., `void appWindow.hide()`).
- **Custom hooks for state.** All Tauri IPC and state management lives in `src/hooks/`.
- **Component responsibilities:**
  - `TitleBar` — Window controls, always-on-top toggle, settings trigger
  - `Sidebar` — Service icon selection
  - `ServiceContentArea` — Measures its own bounds, invokes Rust to position service webviews
  - `SettingsModal` — Service CRUD (add, remove, reorder)
- **No inline event handlers without `void`.** Tauri `invoke()` returns a Promise; always prefix with `void` in React event handlers to avoid floating promise warnings.
- **Cleanup on unmount.** `ResizeObserver`, event listeners, and Tauri `onResized`/`onMoved` listeners must be cleaned up in `useEffect` return functions.

### Tauri Configuration

- **`decorations: false`** — The app uses a custom titlebar. Do not enable native decorations.
- **CSP** is strict: `default-src 'self'`. If adding new external sources, update the CSP in `tauri.conf.json`.
- **Capabilities** are split: `default.json` for core window/opener/store, `desktop.json` for desktop-only features (shortcuts, window-state).
- **Capabilities are per-window.** New windows need their own capability entries.

### Security

- **Never add `'unsafe-eval'`** to the CSP unless absolutely necessary.
- **Navigation interception** is enforced in Rust (`service_window.rs`). Only same-site and known-family domains are allowed; everything else opens externally.
- **`on_new_window` returns `Deny`** — no new OS windows are spawned from webview content.
- **Capabilities follow least privilege.** Only grant the minimum permissions needed.
- **External links always open in the system browser**, never in-app.

### Performance

- **Service webviews are lazily created.** The first switch to a service creates its webview; subsequent switches show/hide it.
- **ResizeObserver** syncs service webview bounds efficiently — no polling.
- **Cargo dev profile** avoids debug symbols and incremental compilation to keep builds fast and the `target/` directory small.
- **Release builds** use LTO + single codegen unit + symbol stripping for minimal binary size.

### Adding a New Service

1. Define the `ServiceConfig` in `DEFAULT_SERVICES` (or via the Settings UI at runtime).
2. No Rust changes needed — service webviews are created dynamically by `service_window.rs`.
3. If the service domain family is not auto-allowed, add it to the `host_allowed()` function in `service_window.rs`.
4. Update the CSP `connect-src` / `frame-src` in `tauri.conf.json` if the service requires it.

### Adding a New Rust Command

1. Write the function with `#[tauri::command]` in `lib.rs` or a new module.
2. Register it in `tauri::generate_handler![]` in `lib.rs`.
3. If the command needs new permissions, add them to the appropriate capability file in `capabilities/`.
4. Call it from the frontend via `invoke("command_name", { ... })`.

### Adding a New Tauri Plugin

1. Add the Rust dependency to `src-tauri/Cargo.toml`.
2. Add the JS dependency: `bun add @tauri-apps/plugin-<name>`.
3. Register the plugin in `lib.rs` via `.plugin(...)`.
4. Add required permissions to `capabilities/default.json` or `capabilities/desktop.json`.
5. Rebuild the Tauri schema: `bun run tauri info` will regenerate `gen/schemas/`.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `Alt+Space` doesn't work | Another app may have registered it. Check `tauri-plugin-global-shortcut` logs or pick an alternative combo. |
| Service webview not visible | Check that `switch_service` was called with valid bounds. The bounds must have `width >= 1` and `height >= 1`. |
| External link opens in webview | The URL isn't matched by `host_allowed()` in `service_window.rs`. Add the domain family. |
| Cargo build is slow | Ensure `[profile.dev]` has `debug = 0` and `incremental = false`. Clean `target/` if needed. |
| Frontend changes not reflected | Run `bun run dev` separately to check Vite HMR. Tauri's `beforeDevCommand` should handle this automatically. |
| Settings not persisting | Check `settings.json` location (typically `%APPDATA%/com.octodock.desktop/`). Ensure `tauri-plugin-store` is registered. |
