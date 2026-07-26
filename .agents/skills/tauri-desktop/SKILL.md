---
description: Use when changing Tauri desktop commands, capabilities, app shell configuration, window settings, icons, bundle assets, native file dialog behavior, or platform-specific desktop behavior.
metadata:
    github-path: skills/tauri-desktop
    github-ref: refs/heads/main
    github-repo: https://github.com/AlekseiTovkachev/dragon-age-save-editor
    github-tree-sha: 450973d50799510347c65b9eaba77b7b7faa0b5c
    short-description: Tauri desktop shell guidance
name: tauri-desktop
---
# Tauri Desktop

## Start Here

- Check `src-tauri/src/main.rs` for exposed desktop commands.
- Check `src-tauri/tauri.conf.json` for app window, bundle, and icon configuration.
- Check `src-tauri/capabilities/default.json` for command permissions.
- Use `docs/manual-qa.md` for packaged desktop install smoke.

## Commands

```bash
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri dev
```

`npm run verify` includes the Tauri cargo check.

## Guardrails

- Keep platform-specific paths and commands cross-platform unless a branch is intentional.
- Update generated Tauri schema files when config changes produce them.
- Keep icon references valid for the configured desktop bundle targets.
- Exercise native dialog or shell behavior manually when browser smoke tests cannot cover it.
