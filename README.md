# OctoDock

Desktop multi-service dock built with **Tauri v2**, **Rust**, **Bun**, **React**, and **Tailwind CSS**.

## Features

- System tray + **Alt+Space** global hotkey to show/hide
- Close hides to tray (Quit from tray menu exits)
- Always-on-top pin (persisted)
- Per-service native webviews (Gmail, Keep, Reddit, Calendar by default)
- External links open in the system browser
- Configurable services (add / remove / reorder) via Settings
- Window position/size persistence
- Single-instance lock (second launch focuses the existing window)

## Develop

```bash
bun install
bun run tauri dev
```

After launch the window starts hidden — use the tray icon or **Alt+Space** to show it.

## Build

```bash
bun run tauri build
```

## Stack notes

- Package manager: Bun only
- Dark mode only
- `Cargo.toml` `[profile.dev]` uses `debug = 0`, `incremental = false`, `opt-level = 1`
