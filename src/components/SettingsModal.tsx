import { useEffect, useState } from "react";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import type { ServiceConfig } from "../hooks/useSettingsStore";
import { DEFAULT_HOTKEY } from "../lib/settings";
import { ServiceIcon } from "./ServiceIcon";
import { HotkeyRecorderButton } from "./HotkeyRecorder";
import { toast } from "../lib/toast";

interface SettingsModalProps {
  open: boolean;
  services: ServiceConfig[];
  hotkey: string;
  onClose: () => void;
  onAdd: (service: ServiceConfig) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onMove: (id: string, direction: -1 | 1) => Promise<void>;
  onUpdateService: (id: string, patch: Partial<ServiceConfig>) => Promise<void>;
  onSetHotkey: (hotkey: string) => Promise<string>;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

export function SettingsModal({
  open,
  services,
  hotkey,
  onClose,
  onAdd,
  onRemove,
  onMove,
  onUpdateService,
  onSetHotkey,
}: SettingsModalProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [icon, setIcon] = useState("🌐");
  const [error, setError] = useState<string | null>(null);
  const [hotkeyDraft, setHotkeyDraft] = useState(hotkey);
  const [hotkeyError, setHotkeyError] = useState<string | null>(null);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [autostartBusy, setAutostartBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const enabled = await isEnabled();
        if (!cancelled) setAutostartEnabled(enabled);
      } catch {
        if (!cancelled) setAutostartEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const handleAdd = async () => {
    setError(null);
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName || !trimmedUrl) {
      setError("Name and URL are required.");
      return;
    }

    try {
      const parsed = new URL(trimmedUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        setError("URL must start with http:// or https://");
        return;
      }
    } catch {
      setError("Invalid URL.");
      return;
    }

    const idBase = slugify(trimmedName) || "service";
    let id = idBase;
    let suffix = 1;
    while (services.some((s) => s.id === id)) {
      id = `${idBase}-${suffix}`;
      suffix += 1;
    }

    await onAdd({
      id,
      name: trimmedName,
      icon: icon.trim() || "🌐",
      url: trimmedUrl,
      openInBrowser: false,
    });
    setName("");
    setUrl("");
    setIcon("🌐");
  };

  const handleSaveHotkey = async () => {
    setHotkeyError(null);
    try {
      const applied = await onSetHotkey(hotkeyDraft);
      setHotkeyDraft(applied);
      toast(`Global hotkey set to ${applied}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to register hotkey";
      setHotkeyError(message);
      toast(message, "error");
    }
  };

  const handleToggleAutostart = async () => {
    setAutostartBusy(true);
    try {
      if (autostartEnabled) {
        await disable();
        setAutostartEnabled(false);
      } else {
        await enable();
        setAutostartEnabled(true);
      }
    } catch {
      // Keep previous state on failure.
    } finally {
      setAutostartBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[520px] max-w-[90vw] max-h-[80vh] overflow-auto rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-5">
          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wide text-gray-500">
              General
            </h3>
            <label className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950 px-3 py-2">
              <span className="text-sm text-white">Launch on startup</span>
              <input
                type="checkbox"
                checked={autostartEnabled}
                disabled={autostartBusy}
                onChange={() => void handleToggleAutostart()}
              />
            </label>
            <div className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 space-y-2">
              <label className="block text-sm text-white" htmlFor="hotkey">
                Global hotkey
              </label>
              <div className="flex gap-2">
                <input
                  id="hotkey"
                  value={hotkeyDraft}
                  onChange={(e) => setHotkeyDraft(e.target.value)}
                  placeholder={DEFAULT_HOTKEY}
                  className="flex-1 rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
                />
                <HotkeyRecorderButton onRecord={setHotkeyDraft} />
                <button
                  type="button"
                  onClick={() => void handleSaveHotkey()}
                  className="rounded-md bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-500"
                >
                  Save
                </button>
              </div>
              {hotkeyError ? (
                <p className="text-xs text-red-400">{hotkeyError}</p>
              ) : (
                <p className="text-xs text-gray-500">
                  Example: Alt+Space or Ctrl+Shift+O
                </p>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">
              Services
            </h3>
            <div className="space-y-2">
              {services.map((service, index) => (
                <div
                  key={service.id}
                  className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <ServiceIcon service={service} className="w-5 h-5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">
                        {service.name}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {service.url}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="px-2 text-gray-400 hover:text-white disabled:opacity-30"
                      disabled={index === 0}
                      onClick={() => void onMove(service.id, -1)}
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="px-2 text-gray-400 hover:text-white disabled:opacity-30"
                      disabled={index === services.length - 1}
                      onClick={() => void onMove(service.id, 1)}
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="px-2 text-red-400 hover:text-red-300"
                      onClick={() => void onRemove(service.id)}
                      title="Remove"
                    >
                      ⌫
                    </button>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-400">
                    <input
                      type="checkbox"
                      checked={service.openInBrowser === true}
                      onChange={(e) =>
                        void onUpdateService(service.id, {
                          openInBrowser: e.target.checked,
                        })
                      }
                    />
                    Open in browser (recommended for Google sign-in)
                  </label>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wide text-gray-500">
              Add service
            </h3>
            <div className="grid grid-cols-[64px_1fr] gap-2">
              <input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="rounded-md border border-gray-700 bg-gray-950 px-2 py-2 text-center text-lg"
                aria-label="Icon"
              />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
            />
            {error ? <p className="text-xs text-red-400">{error}</p> : null}
            <button
              type="button"
              onClick={() => void handleAdd()}
              className="rounded-md bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-500"
            >
              Add service
            </button>
          </section>

          <p className="text-xs text-gray-500">
            Close hides to tray; Quit from the tray menu exits fully.
          </p>
        </div>
      </div>
    </div>
  );
}
