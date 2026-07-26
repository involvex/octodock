# OctoDock

Desktop multi-service dock built with **Tauri v2**, **Rust**, **Bun**, **React**, and **Tailwind CSS**.

## Features

- System tray + configurable global hotkey (default **Alt+Space**)
- Close hides to tray (Quit from tray menu exits)
- Always-on-top pin (persisted)
- Per-service native webviews, with **Open in browser** fallback (Gmail defaults to browser mode)
- External links open in the system browser
- Configurable services (add / remove / reorder / browser-vs-embed)
- Launch on startup toggle
- Window position/size persistence
- Single-instance lock (second launch focuses the existing window)

## Develop

```bash
bun install
bun run tauri dev
```

After launch the window starts hidden — use the tray icon or the configured hotkey to show it.

## Test

```bash
bun test
cargo test --manifest-path src-tauri/Cargo.toml
```

## Build

```bash
bun run tauri build
```

## Stack notes

- Package manager: Bun only
- Dark mode only
- Bundle id: `com.octodock.desktop`
- `Cargo.toml` `[profile.dev]` uses `debug = 0`, `incremental = false`, `opt-level = 1`
