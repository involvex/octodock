# OctoDock

[![CI](https://github.com/involvex/octodock/actions/workflows/ci.yml/badge.svg)](https://github.com/involvex/octodock/actions/workflows/ci.yml)
[![Release](https://github.com/involvex/octodock/actions/workflows/release.yml/badge.svg)](https://github.com/involvex/octodock/actions/workflows/release.yml)

Desktop multi-service dock built with **Tauri v2**, **Rust**, **Bun**, **React**, and **Tailwind CSS**.

Keep Gmail, Keep, Reddit, Calendar (or any web app) one hotkey away, without
living in a browser tab. Each service runs in its own isolated native
webview, tucked behind a single dockable window that lives in your system
tray.

## Features

- System tray + configurable global hotkey (default **Alt+Space**), with an
  in-app hotkey recorder — no shortcut syntax to memorize
- Close hides to tray (Quit from tray menu exits); tray **Settings** opens
  the modal; tooltip shows the current hotkey
- Always-on-top pin (persisted)
- Per-service **child** native webviews, with **Open in browser** fallback
  (Gmail / Keep / Calendar default to browser mode; toggle any service back
  to embedded from Settings or “Try embedding anyway”)
- Edit service name / URL / allowed hosts; titlebar **Reload** for embeds;
  removing a service destroys its webview
- Optional `allowedHosts` so SSO/CDN navigations stay in-webview
- Preset gallery in Settings (Notion, Slack, ChatGPT, …) for one-click add
- Idle inactive embeds unload after 15 minutes (recreated on next switch)
- In-app shortcuts: **Ctrl+1–9** select service, **Ctrl+Tab** /
  **Ctrl+Shift+Tab** next/prev, **Ctrl+Shift+O** open active URL in browser
- Real favicons in the sidebar and settings (falls back to an emoji if a
  favicon can't be resolved)
- Toast notifications for hotkey conflicts, background errors, and a
  one-time tip on first launch explaining the tray/hotkey workflow
- External links open in the system browser
- Configurable services (add / edit / remove / reorder / browser-vs-embed)
- Launch on startup toggle
- Window position/size persistence, DPI- and multi-monitor-aware webview
  bounds
- Single-instance lock (second launch focuses the existing window)

## Develop

```bash
bun install
bun run tauri dev
```

After launch the window starts hidden — use the tray icon or the configured
hotkey to show it.

For verbose **app** logs (not build noise from `tauri -v`), set:

```bash
# PowerShell
$env:RUST_LOG="debug"; bun run tauri dev
```

## Test & lint

```bash
bun run lint
bun run format:check
bun test
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

CI (`.github/workflows/ci.yml`) runs all of the above on every push and pull
request against `main`.

## Build

```bash
bun run tauri build
```

Produces NSIS and MSI installers under `src-tauri/target/release/bundle/`.

### Releasing

Pushing a tag matching `v*.*.*` (e.g. `v0.2.0`) triggers
`.github/workflows/release.yml`, which lints, tests, builds, and publishes a
draft GitHub Release with the Windows installers attached. See the comments
in that workflow for optional Authenticode code-signing secrets, and
[`docs/updater.md`](docs/updater.md) for wiring up auto-updates.

## Stack notes

- Package manager: Bun **1.3.x** only (pinned `bun@1.3.14` in `package.json` /
  CI — avoid Bun 1.4+/canary for installs)
- Dark mode only
- Bundle id: `com.octodock.desktop`
- `Cargo.toml` `[profile.dev]` uses `debug = 0`, `incremental = false`, `opt-level = 1`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
