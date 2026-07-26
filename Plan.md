### OctoDock

**Kurzfassung:** Der vollständige Entwicklungsplan für **OctoDock** (ein sehr passender Name für ein vielseitiges Multi-Tool) definiert den Bau einer Tauri v2 App. Der Stack nutzt Rust für das Backend (optimiert auf minimalen Speicherplatz) und TypeScript/Tailwind über Bun für das Frontend. Features: Dark Mode nativ, System-Tray, Hotkeys, Resizable Floating-Window und Always-on-Top-Toggle.


### App-Name: OctoDock

*Begründung:* Prägnant, merkbar. "Octo" impliziert Multitasking (viele Arme/Tabs wie Gmail, Keep), "Dock" steht für die Andockbarkeit via Windows Snap.


### Development Plan: OctoDock

#### Phase 1: Projekt-Setup & Rust-Optimierung

* **Initialisierung:** Scaffolding via `bun create tauri-app@latest`. Auswahl: TypeScript, React/Vanilla (je nach Präferenz), Tailwind CSS.
* **Dependencies:** Installation der Tauri-Plugins für Hotkeys, Tray und Shell (`bun tauri add global-shortcut tray shell`).
* **Build-Optimierung:** Anpassung der `Cargo.toml` (`[profile.dev] debug = 0`, `incremental = false`), um den Rust `target`-Ordner klein zu halten.

#### Phase 2: Core Backend (Rust & Tauri API)

* **Window Config (`tauri.conf.json`):**
* `resizable: true` (erlaubt natives Windows-Snapping).
* `decorations: true` (für standardisierte Resize-Ränder, Styling wird in den Dark Mode gezwungen).
* `visible: false` (Startet versteckt im Hintergrund).


* **System Tray:** Implementierung eines simplen Tray-Icons. Linksklick toggelt die Sichtbarkeit des Hauptfensters. Rechtsklick öffnet ein Menü (z. B. "Quit").
* **Global Hotkey:** Registrierung von z. B. `Alt + Space` via `tauri-plugin-global-shortcut`. Ruft dieselbe Toggle-Funktion auf wie das Tray-Icon. Beim Einblenden wird das Fenster fokussiert.

#### Phase 3: Frontend & Window Management

* **UI/UX:** Strikte Durchsetzung des Dark Modes über Tailwind (`bg-gray-900 text-white`). Keine Light-Mode-Logik.
* **Titlebar / Header:** Bau einer schlanken, custom Titlebar (`data-tauri-drag-region`), um das Fenster verschiebbar zu machen.
* **Always-on-Top Toggle:** Einbindung eines Pin-Icons in der Titlebar. Bei Klick wird `getCurrentWindow().setAlwaysOnTop(true/false)` getriggert. Der State wird im UI visuell hervorgehoben.

#### Phase 4: Webview-Integration & Routing

* **App-Navigation:** Eine Sidebar (links) mit Icons für Gmail, Google Keep, Reddit etc.
* **Content-Bereich:** Einbindung der Dienste als `<iframe>`. Alternativ dynamische Erzeugung von Child-Webviews über die Rust-API (performanter, aber komplexer in der Kommunikation).
* **Link-Handling:** Intercepting von Klicks auf externe Links. Alle Links mit `target="_blank"` oder Abweichungen von der Basis-URL werden abgefangen und über `@tauri-apps/plugin-shell` im Standard-Systembrowser (z. B. Edge) geöffnet.
