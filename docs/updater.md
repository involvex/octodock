# Enabling auto-updates (optional)

OctoDock ships with `tauri-plugin-updater` wired up but **disabled by
default** behind the `updater` Cargo feature, because it needs a signing
keypair and a hosted update manifest before it can do anything useful. This
doc is the checklist for turning it on when you're ready to ship updates.

## 1. Generate a signing keypair

```bash
bunx tauri signer generate -w ~/.tauri/octodock.key
```

This prints a public key (`pubkey`) and writes a private key file. Keep the
private key secret — treat it like any other signing credential.

## 2. Configure `tauri.conf.json`

Add an `updater` plugin config with the public key and one or more endpoints
that serve a [update manifest JSON](https://v2.tauri.app/plugin/updater/#static-json-file):

```jsonc
{
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "<paste the pubkey from step 1>",
      "endpoints": [
        "https://github.com/<owner>/<repo>/releases/latest/download/latest.json"
      ]
    }
  }
}
```

## 3. Enable the Cargo feature

Build with the feature turned on (or add `updater` to a `default = [...]`
list in `src-tauri/Cargo.toml` once you're ready to ship it permanently):

```bash
cargo build --manifest-path src-tauri/Cargo.toml --features updater
```

## 4. Grant the capability permission

Add the updater permissions to `src-tauri/capabilities/desktop.json`:

```jsonc
"updater:default"
```

## 5. Add the frontend check

Install the JS plugin and call it from the UI (e.g. on startup, or from a
"Check for updates" menu item):

```bash
bun add @tauri-apps/plugin-updater @tauri-apps/plugin-process
```

```ts
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

const update = await check();
if (update) {
  await update.downloadAndInstall();
  await relaunch();
}
```

## 6. Wire up CI signing

The release workflow (`.github/workflows/release.yml`) already forwards
`TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` env vars
to `tauri-action`. Add them as repository secrets (Settings → Secrets and
variables → Actions) once you have a keypair from step 1, and `tauri-action`
will sign the built artifacts and produce the `latest.json` manifest
automatically.

## Notes

- Until all of the above is done, leave the `updater` feature off — an
  unconfigured updater plugin has no endpoint to check and is dead weight.
- Windows Authenticode code signing (SmartScreen) and update-artifact signing
  (this doc) are two separate concerns; see the comments in
  `.github/workflows/release.yml` for the former.
