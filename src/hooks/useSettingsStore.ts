import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { load, type Store } from "@tauri-apps/plugin-store";
import {
  DEFAULT_HOTKEY,
  DEFAULT_SERVICES,
  GOOGLE_EMBED_BLOCKED_IDS,
  isLikelyHotkey,
  normalizeHotkey,
  type ServiceConfig,
} from "../lib/settings";
import { toast } from "../lib/toast";

export type { ServiceConfig };
export { DEFAULT_SERVICES, DEFAULT_HOTKEY };

// Bumped whenever a one-time migration below needs to run against
// already-persisted settings.json files. Each migration is applied at most
// once per store (gated by comparing against the last-applied version), so
// re-toggling "Try embedding anyway" afterwards is never overwritten again.
const SETTINGS_VERSION = 2;

async function getStore(): Promise<Store> {
  const store = await load("settings.json", { autoSave: true });
  const version = (await store.get<number>("settingsVersion")) ?? 1;
  const existing = await store.get<ServiceConfig[]>("services");
  if (!existing || existing.length === 0) {
    await store.set("services", DEFAULT_SERVICES);
  } else {
    const migrated = existing.map((service) => {
      // v2: Keep and Calendar (like Gmail before it) are blocked by Google
      // when embedded. Earlier defaults shipped them with
      // `openInBrowser: false`, so pre-v2 stores need a one-time flip to
      // the browser fallback regardless of whether the flag was explicitly
      // `false` or simply missing.
      if (
        version < 2 &&
        GOOGLE_EMBED_BLOCKED_IDS.has(service.id) &&
        service.openInBrowser !== true
      ) {
        return { ...service, openInBrowser: true };
      }
      return service;
    });
    await store.set("services", migrated);
  }
  if (version < SETTINGS_VERSION) {
    await store.set("settingsVersion", SETTINGS_VERSION);
  }
  if (!(await store.get("lastActiveService"))) {
    await store.set("lastActiveService", DEFAULT_SERVICES[0]?.id ?? "gmail");
  }
  if (!(await store.get("hotkey"))) {
    await store.set("hotkey", DEFAULT_HOTKEY);
  }
  return store;
}

async function markTrayTipSeenInStore(): Promise<void> {
  const store = await getStore();
  await store.set("hasSeenTrayTip", true);
}

export function useSettingsStore() {
  const [services, setServices] = useState<ServiceConfig[]>(DEFAULT_SERVICES);
  const [activeServiceId, setActiveServiceId] = useState(
    DEFAULT_SERVICES[0]?.id ?? "gmail",
  );
  const [hotkey, setHotkeyState] = useState(DEFAULT_HOTKEY);
  const [ready, setReady] = useState(false);
  const [hasSeenTrayTip, setHasSeenTrayTip] = useState(true);

  useEffect(() => {
    void (async () => {
      const store = await getStore();
      const loadedServices =
        (await store.get<ServiceConfig[]>("services")) ?? DEFAULT_SERVICES;
      const last =
        (await store.get<string>("lastActiveService")) ??
        loadedServices[0]?.id ??
        "gmail";
      const savedHotkey = (await store.get<string>("hotkey")) ?? DEFAULT_HOTKEY;
      const seenTrayTip = (await store.get<boolean>("hasSeenTrayTip")) ?? false;

      setServices(loadedServices);
      setHasSeenTrayTip(seenTrayTip);
      setActiveServiceId(
        loadedServices.some((s) => s.id === last)
          ? last
          : (loadedServices[0]?.id ?? "gmail"),
      );
      setHotkeyState(savedHotkey);

      try {
        await invoke("set_hotkey", { hotkey: savedHotkey });
      } catch {
        // Keep UI value; registration may fail if already taken by another app.
        toast(
          `Couldn't register hotkey ${savedHotkey} — it may be in use by another app. Change it in Settings.`,
          "error",
        );
      }

      setReady(true);
    })();
  }, []);

  const persistServices = useCallback(async (next: ServiceConfig[]) => {
    setServices(next);
    const store = await getStore();
    await store.set("services", next);
  }, []);

  const setActiveService = useCallback(async (id: string) => {
    setActiveServiceId(id);
    const store = await getStore();
    await store.set("lastActiveService", id);
  }, []);

  const addService = useCallback(
    async (service: ServiceConfig) => {
      const next = [...services, service];
      await persistServices(next);
      await setActiveService(service.id);
    },
    [persistServices, services, setActiveService],
  );

  const removeService = useCallback(
    async (id: string) => {
      try {
        await invoke("close_service_webview", { serviceId: id });
      } catch (err) {
        console.warn("close_service_webview failed:", err);
      }
      const next = services.filter((s) => s.id !== id);
      await persistServices(next.length > 0 ? next : DEFAULT_SERVICES);
      if (activeServiceId === id) {
        await setActiveService(
          next[0]?.id ?? DEFAULT_SERVICES[0]?.id ?? "gmail",
        );
      }
    },
    [activeServiceId, persistServices, services, setActiveService],
  );

  const moveService = useCallback(
    async (id: string, direction: -1 | 1) => {
      const index = services.findIndex((s) => s.id === id);
      if (index < 0) return;
      const target = index + direction;
      if (target < 0 || target >= services.length) return;
      const next = [...services];
      const [item] = next.splice(index, 1);
      if (!item) return;
      next.splice(target, 0, item);
      await persistServices(next);
    },
    [persistServices, services],
  );

  const updateService = useCallback(
    async (id: string, patch: Partial<ServiceConfig>) => {
      const current = services.find((s) => s.id === id);
      const next = services.map((service) =>
        service.id === id ? { ...service, ...patch } : service,
      );
      await persistServices(next);

      const urlChanged =
        patch.url !== undefined &&
        current !== undefined &&
        patch.url !== current.url;
      const hostsChanged =
        patch.allowedHosts !== undefined &&
        JSON.stringify(patch.allowedHosts ?? []) !==
          JSON.stringify(current?.allowedHosts ?? []);

      // URL / allowlist changes need a fresh child webview so navigation
      // interception and the loaded document match the new config.
      if (urlChanged || hostsChanged) {
        try {
          await invoke("close_service_webview", { serviceId: id });
        } catch (err) {
          console.warn("close_service_webview failed:", err);
        }
      }
    },
    [persistServices, services],
  );

  const setHotkey = useCallback(async (value: string) => {
    const normalized = normalizeHotkey(value);
    if (!isLikelyHotkey(normalized)) {
      throw new Error("Invalid hotkey");
    }
    const applied = await invoke<string>("set_hotkey", { hotkey: normalized });
    setHotkeyState(applied);
    const store = await getStore();
    await store.set("hotkey", applied);
    return applied;
  }, []);

  const markTrayTipSeen = useCallback(() => {
    setHasSeenTrayTip(true);
    void markTrayTipSeenInStore();
  }, []);

  const activeService =
    services.find((s) => s.id === activeServiceId) ?? services[0] ?? null;

  return {
    ready,
    services,
    activeServiceId,
    activeService,
    hotkey,
    hasSeenTrayTip,
    markTrayTipSeen,
    setActiveService,
    addService,
    removeService,
    moveService,
    updateService,
    setHotkey,
  };
}
