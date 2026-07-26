import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { ServiceConfig } from "../hooks/useSettingsStore";
import { prefersBrowser } from "../lib/settings";

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ServiceContentAreaProps {
  service: ServiceConfig | null;
}

async function measureBounds(
  element: HTMLElement,
): Promise<WindowBounds | null> {
  const rect = element.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) {
    return null;
  }

  const window = getCurrentWindow();
  const factor = await window.scaleFactor();
  const position = await window.outerPosition();

  return {
    x: position.x + rect.left * factor,
    y: position.y + rect.top * factor,
    width: rect.width * factor,
    height: rect.height * factor,
  };
}

export function ServiceContentArea({ service }: ServiceContentAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const browserMode = service ? prefersBrowser(service) : false;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !service) return;

    let cancelled = false;

    if (browserMode) {
      void invoke("hide_service_windows");
      return () => {
        cancelled = true;
      };
    }

    const sync = async (switchService: boolean) => {
      const bounds = await measureBounds(el);
      if (!bounds || cancelled) return;

      if (switchService) {
        await invoke("switch_service", {
          serviceId: service.id,
          url: service.url,
          bounds,
        });
      } else {
        await invoke("update_service_bounds", { bounds });
      }
    };

    void sync(true);

    const observer = new ResizeObserver(() => {
      void sync(false);
    });
    observer.observe(el);

    const unlistenPromise = Promise.all([
      getCurrentWindow().onResized(() => {
        void sync(false);
      }),
      getCurrentWindow().onMoved(() => {
        void sync(false);
      }),
    ]);

    return () => {
      cancelled = true;
      observer.disconnect();
      void unlistenPromise.then((unlistens) => {
        for (const unlisten of unlistens) {
          unlisten();
        }
      });
    };
  }, [service, browserMode]);

  if (!service) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm bg-gray-950">
        No service selected
      </div>
    );
  }

  if (browserMode) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-gray-950 px-6 text-center">
        <div className="text-4xl">{service.icon}</div>
        <h2 className="text-lg font-semibold text-white">{service.name}</h2>
        <p className="max-w-md text-sm text-gray-400">
          Google often blocks sign-in inside embedded webviews. Open{" "}
          {service.name} in your system browser instead, or turn off “Open in
          browser” in Settings to try embedding.
        </p>
        <button
          type="button"
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500"
          onClick={() => void openUrl(service.url)}
        >
          Open {service.name} in browser
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 relative bg-gray-950"
      aria-label="Service content area"
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-gray-500 text-sm">Loading {service.name}…</span>
      </div>
    </div>
  );
}
