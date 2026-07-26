# Contributing to OctoDock

Thanks for considering a contribution. This is a small Tauri + React project
— the bar for contributing is low, but a few conventions keep it consistent.

## Prerequisites

- [Bun](https://bun.sh) >= 1.3.0 — **do not** use npm, yarn, or pnpm
- Rust (stable, MSRV 1.77.2) with the `cargo` toolchain
- On Windows: the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)
  (WebView2 runtime, Visual Studio Build Tools with the C++ workload)

## Getting started

```bash
git clone https://github.com/involvex/octodock.git
cd octodock
bun install
bun run tauri dev
```

The window starts hidden by design — press **Alt+Space** (or check the tray
icon) to show it.

## Before opening a PR

Run the full check cycle locally; CI runs the same steps and will block
merges otherwise:

```bash
bun run lint
bun run format:check
bun test
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

If `format:check` fails, run `bun run format` and `cargo fmt --manifest-path
src-tauri/Cargo.toml`, then re-run the checks above.

## Project structure & conventions

See [`AGENTS.md`](AGENTS.md) for the full architecture overview, coding
conventions (Rust and TypeScript), and guidance on adding new services,
commands, or Tauri plugins. It's the same reference used by AI coding agents
working on this repo, so it's kept up to date.

Highlights:

- Keep `src-tauri/src/main.rs` thin — logic belongs in `lib.rs` or feature
  modules like `service_window.rs`.
- Tauri commands return `Result<T, String>`; avoid `.unwrap()` in handlers.
- Frontend state/IPC logic lives in `src/hooks/`; components stay
  presentational where possible.
- Dark mode only — don't add light-mode styling.

## Commit style

Keep commit messages short and focused on *why*, not just *what*. No strict
format is enforced, but please avoid bundling unrelated changes into one
commit.

## Reporting bugs / requesting features

Open a GitHub issue with reproduction steps (for bugs) or the use case (for
feature requests). Screenshots/screen recordings help a lot for UI issues.
