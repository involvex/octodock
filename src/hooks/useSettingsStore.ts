import { useCallback, useEffect, useState } from "react";
import { load, type Store } from "@tauri-apps/plugin-store";

export interface ServiceConfig {
  id: string;
  name: string;
  icon: string;
  url: string;
}

export const DEFAULT_SERVICES: ServiceConfig[] = [
  { id: "gmail", name: "Gmail", icon: "📧", url: "https://mail.google.com" },
  { id: "keep", name: "Keep", icon: "📝", url: "https://keep.google.com" },
  { id: "reddit", name: "Reddit", icon: "🤖", url: "https://www.reddit.com" },
  {
    id: "calendar",
    name: "Calendar",
    icon: "📅",
    url: "https://calendar.google.com",
  },
];

async function getStore(): Promise<Store> {
  const store = await load("settings.json", { autoSave: true });
  const existing = await store.get<ServiceConfig[]>("services");
  if (!existing || existing.length === 0) {
    await store.set("services", DEFAULT_SERVICES);
  }
  if (!(await store.get("lastActiveService"))) {
    await store.set("lastActiveService", DEFAULT_SERVICES[0]?.id ?? "gmail");
  }
  return store;
}

export function useSettingsStore() {
  const [services, setServices] = useState<ServiceConfig[]>(DEFAULT_SERVICES);
  const [activeServiceId, setActiveServiceId] = useState(
    DEFAULT_SERVICES[0]?.id ?? "gmail",
  );
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
      setServices(loadedServices);
      setActiveServiceId(
        loadedServices.some((s) => s.id === last)
          ? last
          : (loadedServices[0]?.id ?? "gmail"),
      );
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

  const activeService =
    services.find((s) => s.id === activeServiceId) ?? services[0] ?? null;

  return {
    ready,
    services,
    activeServiceId,
    activeService,
    setActiveService,
    addService,
    removeService,
    moveService,
  };
}
