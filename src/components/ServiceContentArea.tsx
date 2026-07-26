import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { ServiceConfig } from "../hooks/useSettingsStore";

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

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !service) return;

    let cancelled = false;

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
  }, [service]);

  return (
    <div
      ref={containerRef}
      className="flex-1 relative bg-gray-950"
      aria-label="Service content area"
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-gray-500 text-sm">
          {service ? `Loading ${service.name}…` : "No service selected"}
        </span>
      </div>
    </div>
  );
}
