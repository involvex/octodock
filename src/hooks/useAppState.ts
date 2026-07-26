import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";

export function useAppState() {
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const store = await load("settings.json", { autoSave: true });
        const saved = await store.get<boolean>("alwaysOnTop");
        if (typeof saved === "boolean") {
          await invoke("set_always_on_top", { onTop: saved });
          setIsAlwaysOnTop(saved);
          return;
        }
      } catch {
        // Fall through to live window state.
      }

      try {
        const current = await invoke<boolean>("is_always_on_top");
        setIsAlwaysOnTop(current);
      } catch {
        setIsAlwaysOnTop(false);
      }
    })();
  }, []);

  const toggleAlwaysOnTop = useCallback(async () => {
    const next = !isAlwaysOnTop;
    await invoke("set_always_on_top", { onTop: next });
    setIsAlwaysOnTop(next);
    try {
      const store = await load("settings.json", { autoSave: true });
      await store.set("alwaysOnTop", next);
    } catch {
      // Persistence is best-effort.
    }
  }, [isAlwaysOnTop]);

  return {
    isAlwaysOnTop,
    toggleAlwaysOnTop,
  };
}
