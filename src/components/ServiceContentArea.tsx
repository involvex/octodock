import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { ServiceConfig } from "../hooks/useSettingsStore";
import { prefersBrowser } from "../lib/settings";
import { ServiceIcon } from "./ServiceIcon";

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ServiceContentAreaProps {
  service: ServiceConfig | null;
  onUpdateService: (id: string, patch: Partial<ServiceConfig>) => void;
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
  // innerPosition (client-area origin), not outerPosition (outer frame) —
  // getBoundingClientRect() is relative to the client area. Undecorated
  // resizable windows on Windows still carry an invisible resize-hit-test
  // border that shifts outerPosition away from the real content origin, most
  // dramatically when maximized (outerPosition can report large negative
  // values like (-8,-8) while content still starts at the true work-area
  // edge). Using outerPosition here silently drags the embedded service
  // webview up/left of where it belongs, which can bleed into the custom
  // titlebar and swallow clicks meant for the close/minimize buttons.
  const position = await window.innerPosition();

  return {
    x: position.x + rect.left * factor,
    y: position.y + rect.top * factor,
    width: rect.width * factor,
    height: rect.height * factor,
  };
}

export function ServiceContentArea({
  service,
  onUpdateService,
}: ServiceContentAreaProps) {
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
      // Skip while minimized: the container still reports its pre-minimize
      // size, which would otherwise reposition the service webview to float
      // on screen with no main window behind it. The titlebar's minimize
      // handler already hides service webviews; the next resize event after
      // restoring will re-sync and re-show them.
      if (await getCurrentWindow().isMinimized()) return;

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
        <ServiceIcon
          service={service}
          className="w-12 h-12"
          textClassName="text-4xl"
        />
        <h2 className="text-lg font-semibold text-white">{service.name}</h2>
        <p className="max-w-md text-sm text-gray-400">
          Google often blocks sign-in inside embedded webviews. Open{" "}
          {service.name} in your system browser instead, or turn off “Open in
          browser” in Settings to try embedding.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500"
            onClick={() => void openUrl(service.url)}
          >
            Open {service.name} in browser
          </button>
          <button
            type="button"
            className="rounded-md border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800"
            onClick={() =>
              onUpdateService(service.id, { openInBrowser: false })
            }
          >
            Try embedding anyway
          </button>
        </div>
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
