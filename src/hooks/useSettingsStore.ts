import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { load, type Store } from "@tauri-apps/plugin-store";
import {
  DEFAULT_HOTKEY,
  DEFAULT_SERVICES,
  isLikelyHotkey,
  normalizeHotkey,
  type ServiceConfig,
} from "../lib/settings";

export type { ServiceConfig };
export { DEFAULT_SERVICES, DEFAULT_HOTKEY };

async function getStore(): Promise<Store> {
  const store = await load("settings.json", { autoSave: true });
  const existing = await store.get<ServiceConfig[]>("services");
  if (!existing || existing.length === 0) {
    await store.set("services", DEFAULT_SERVICES);
  } else {
    // Ensure Gmail keeps browser fallback if older stores lack the flag.
    const migrated = existing.map((service) =>
      service.id === "gmail" && service.openInBrowser === undefined
        ? { ...service, openInBrowser: true }
        : service,
    );
    await store.set("services", migrated);
  }
  if (!(await store.get("lastActiveService"))) {
    await store.set("lastActiveService", DEFAULT_SERVICES[0]?.id ?? "gmail");
  }
  if (!(await store.get("hotkey"))) {
    await store.set("hotkey", DEFAULT_HOTKEY);
  }
  return store;
}

export function useSettingsStore() {
  const [services, setServices] = useState<ServiceConfig[]>(DEFAULT_SERVICES);
  const [activeServiceId, setActiveServiceId] = useState(
    DEFAULT_SERVICES[0]?.id ?? "gmail",
  );
  const [hotkey, setHotkeyState] = useState(DEFAULT_HOTKEY);
  const [ready, setReady] = useState(false);

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

      setServices(loadedServices);
      setActiveServiceId(
        loadedServices.some((s) => s.id === last)
          ? last
          : (loadedServices[0]?.id ?? "gmail"),
      );
      setHotkeyState(savedHotkey);

      try {
        await invoke("set_hotkey", { hotkey: savedHotkey });
      } catch {
        // Keep UI value; registration may fail if already taken.
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
      const next = services.map((service) =>
        service.id === id ? { ...service, ...patch } : service,
      );
      await persistServices(next);
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

  const activeService =
    services.find((s) => s.id === activeServiceId) ?? services[0] ?? null;

  return {
    ready,
    services,
    activeServiceId,
    activeService,
    hotkey,
    setActiveService,
    addService,
    removeService,
    moveService,
    updateService,
    setHotkey,
  };
}
