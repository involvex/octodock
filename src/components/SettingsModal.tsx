import { useState } from "react";
import type { ServiceConfig } from "../hooks/useSettingsStore";

interface SettingsModalProps {
  open: boolean;
  services: ServiceConfig[];
  onClose: () => void;
  onAdd: (service: ServiceConfig) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onMove: (id: string, direction: -1 | 1) => Promise<void>;
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
  onClose,
  onAdd,
  onRemove,
  onMove,
}: SettingsModalProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [icon, setIcon] = useState("🌐");
  const [error, setError] = useState<string | null>(null);

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
    });
    setName("");
    setUrl("");
    setIcon("🌐");
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[480px] max-w-[90vw] max-h-[80vh] overflow-auto rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
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

        <div className="p-4 space-y-4">
          <section>
            <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">
              Services
            </h3>
            <div className="space-y-2">
              {services.map((service, index) => (
                <div
                  key={service.id}
                  className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2"
                >
                  <span className="text-lg">{service.icon}</span>
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
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              Add service
            </button>
          </section>

          <p className="text-xs text-gray-500">
            Tip: Alt+Space toggles OctoDock. Close hides to tray; Quit from the
            tray menu exits fully.
          </p>
        </div>
      </div>
    </div>
  );
}
