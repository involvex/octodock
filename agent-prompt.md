Act as an expert Tauri v2, Rust, and TypeScript developer. Execute the development plan for a desktop utility app named "OctoDock".

Tech Stack: Tauri v2, Rust, Bun, TypeScript, Tailwind CSS.

Instructions & Constraints:
1. Initialize the project using `bun`. All package management MUST be done via `bun`.
2. Enforce a strict Dark Mode as the default and only theme across the entire application (Tailwind config, CSS, and native Tauri window frame).
3. Configure `Cargo.toml` [profile.dev] immediately with `debug = 0`, `incremental = false`, and `opt-level = 1` to strictly prevent target folder bloat.
4. Window Setup: The main window must be `resizable: true` (to allow Windows Snap Assist), start hidden, and use custom drag regions in the UI.
5. Implement a system tray icon and a global hotkey (e.g., Alt+Space) via Tauri v2 plugins to toggle the main window's visibility. Focus the window when shown.
6. Build a custom titlebar in the UI containing a toggle button for "Always on Top". Wire this button to the Tauri Window API `setAlwaysOnTop`.
7. Create a sidebar layout to switch between embedded services (e.g., Gmail, Google Keep). Use isolated iframes for the content.
8. Intercept all external link clicks within these iframes and force them to open in the user's default OS browser using the Tauri shell plugin.

Provide the exact CLI commands to bootstrap the project, the optimized `Cargo.toml`, the Rust `main.rs` setup for tray/hotkeys, and the React/TS component for the layout and window state management. Keep code responses dense, technical, and ready to compile.