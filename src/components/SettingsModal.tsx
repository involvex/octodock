import { useEffect, useState } from "react";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import type { ServiceConfig } from "../hooks/useSettingsStore";
import {
  DEFAULT_HOTKEY,
  SERVICE_PRESETS,
  isPresetAlreadyAdded,
  parseAllowedHosts,
  serviceFromPreset,
  uniqueServiceId,
  type ServicePreset,
} from "../lib/settings";
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

function hostsToDraft(hosts: string[] | undefined): string {
  return (hosts ?? []).join(", ");
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
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
  const [iconUrlDraft, setIconUrlDraft] = useState("");
  const [allowedHostsDraft, setAllowedHostsDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hotkeyDraft, setHotkeyDraft] = useState(hotkey);
  const [hotkeyError, setHotkeyError] = useState<string | null>(null);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [autostartBusy, setAutostartBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editIconUrl, setEditIconUrl] = useState("");
  const [editHosts, setEditHosts] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

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

  const startEdit = (service: ServiceConfig) => {
    setEditingId(service.id);
    setEditName(service.name);
    setEditUrl(service.url);
    setEditIcon(service.icon);
    setEditIconUrl(service.iconUrl ?? "");
    setEditHosts(hostsToDraft(service.allowedHosts));
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const handleSaveEdit = async (id: string) => {
    setEditError(null);
    const trimmedName = editName.trim();
    const trimmedUrl = editUrl.trim();
    const trimmedIconUrl = editIconUrl.trim();
    if (!trimmedName || !trimmedUrl) {
      setEditError("Name and URL are required.");
      return;
    }
    if (!isValidHttpUrl(trimmedUrl)) {
      setEditError("URL must be a valid http(s) address.");
      return;
    }
    if (trimmedIconUrl && !isValidHttpUrl(trimmedIconUrl)) {
      setEditError("Icon URL must be a valid http(s) address.");
      return;
    }
    await onUpdateService(id, {
      name: trimmedName,
      url: trimmedUrl,
      icon: editIcon.trim() || "🌐",
      iconUrl: trimmedIconUrl || undefined,
      allowedHosts: parseAllowedHosts(editHosts),
    });
    setEditingId(null);
    toast("Service updated");
  };

  const handleAdd = async () => {
    setError(null);
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    const trimmedIconUrl = iconUrlDraft.trim();
    if (!trimmedName || !trimmedUrl) {
      setError("Name and URL are required.");
      return;
    }

    if (!isValidHttpUrl(trimmedUrl)) {
      setError("URL must start with http:// or https://");
      return;
    }
    if (trimmedIconUrl && !isValidHttpUrl(trimmedIconUrl)) {
      setError("Icon URL must start with http:// or https://");
      return;
    }

    const idBase = slugify(trimmedName) || "service";
    const id = uniqueServiceId(idBase, services);

    await onAdd({
      id,
      name: trimmedName,
      icon: icon.trim() || "🌐",
      iconUrl: trimmedIconUrl || undefined,
      url: trimmedUrl,
      openInBrowser: false,
      allowedHosts: parseAllowedHosts(allowedHostsDraft),
    });
    setName("");
    setUrl("");
    setIcon("🌐");
    setIconUrlDraft("");
    setAllowedHostsDraft("");
  };

  const handleAddPreset = async (preset: ServicePreset) => {
    if (isPresetAlreadyAdded(services, preset)) return;
    await onAdd(serviceFromPreset(preset, services));
    toast(`Added ${preset.name}`);
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
        toast("Launch on startup disabled");
      } else {
        await enable();
        setAutostartEnabled(true);
        toast("Launch on startup enabled");
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Couldn't change launch-on-startup";
      toast(message, "error");
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
                  Example: Alt+Space or Ctrl+Shift+L
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
                  {editingId === service.id ? (
                    <div className="space-y-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
                        aria-label="Service name"
                      />
                      <input
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
                        aria-label="Service URL"
                      />
                      <div className="grid grid-cols-[64px_1fr] gap-2">
                        <input
                          value={editIcon}
                          onChange={(e) => setEditIcon(e.target.value)}
                          className="rounded-md border border-gray-700 bg-gray-900 px-2 py-2 text-center text-lg"
                          aria-label="Emoji icon"
                          title="Emoji fallback"
                        />
                        <input
                          value={editIconUrl}
                          onChange={(e) => setEditIconUrl(e.target.value)}
                          placeholder="Icon image URL (optional)"
                          className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
                          aria-label="Icon URL"
                        />
                      </div>
                      <input
                        value={editHosts}
                        onChange={(e) => setEditHosts(e.target.value)}
                        placeholder="allowed hosts (comma-separated)"
                        className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
                        aria-label="Allowed hosts"
                      />
                      {editError ? (
                        <p className="text-xs text-red-400">{editError}</p>
                      ) : (
                        <p className="text-xs text-gray-500">
                          Extra hosts stay in the webview (SSO, CDNs). Example:
                          auth0.com, microsoftonline.com
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-500"
                          onClick={() => void handleSaveEdit(service.id)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <ServiceIcon service={service} className="w-5 h-5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">
                          {service.name}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {service.url}
                        </div>
                        {(service.allowedHosts?.length ?? 0) > 0 ? (
                          <div className="text-xs text-gray-600 truncate">
                            hosts: {service.allowedHosts?.join(", ")}
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="px-2 text-gray-400 hover:text-white"
                        onClick={() => startEdit(service)}
                        title="Edit"
                      >
                        ✎
                      </button>
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
                  )}
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
              Add from preset
            </h3>
            <div className="flex flex-wrap gap-2">
              {SERVICE_PRESETS.map((preset) => {
                const added = isPresetAlreadyAdded(services, preset);
                return (
                  <button
                    key={preset.idPrefix}
                    type="button"
                    disabled={added}
                    title={
                      added
                        ? `${preset.name} is already in your list`
                        : `Add ${preset.name}`
                    }
                    onClick={() => void handleAddPreset(preset)}
                    className="rounded-md border border-gray-700 bg-gray-950 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="mr-1">{preset.icon}</span>
                    {preset.name}
                  </button>
                );
              })}
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
            <input
              value={iconUrlDraft}
              onChange={(e) => setIconUrlDraft(e.target.value)}
              placeholder="Icon image URL (optional)"
              className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
            />
            <input
              value={allowedHostsDraft}
              onChange={(e) => setAllowedHostsDraft(e.target.value)}
              placeholder="Allowed hosts (optional): auth0.com, cdn.example.com"
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
            Close hides to tray; Quit from the tray menu exits fully. Shortcuts:
            Ctrl+1–9 switch services, Ctrl+Tab next, Ctrl+Shift+O open in
            browser.
          </p>
        </div>
      </div>
    </div>
  );
}
