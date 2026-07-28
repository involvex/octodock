import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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
  /** True when a React overlay (e.g. Settings) must sit above service webviews. */
  overlayOpen?: boolean;
}

async function measureBounds(
  element: HTMLElement,
): Promise<WindowBounds | null> {
  const rect = element.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) {
    return null;
  }

  // Services are embedded as child webviews of the main window (see
  // `switch_service` in service_window.rs), so their bounds are relative to
  // the *parent window's client area*, not the desktop. That means no
  // `innerPosition()`/desktop-origin math is needed here at all — unlike a
  // separate top-level window, a child webview can't end up positioned
  // relative to the wrong monitor or drift from the main window's frame.
  const factor = await getCurrentWindow().scaleFactor();

  return {
    x: rect.left * factor,
    y: rect.top * factor,
    width: rect.width * factor,
    height: rect.height * factor,
  };
}

export function ServiceContentArea({
  service,
  onUpdateService,
  overlayOpen = false,
}: ServiceContentAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const browserMode = service ? prefersBrowser(service) : false;

  useEffect(() => {
    // Browser-mode CTA has no containerRef — must still hide embedded
    // webviews, otherwise the previous service stays painted on top.
    if (!service) return;

    // Native child webviews paint above React. Keep them hidden while any
    // full-window overlay (Settings) is open so the modal stays usable.
    if (overlayOpen || browserMode) {
      void invoke("hide_service_windows");
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;

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
          allowedHosts: service.allowedHosts ?? [],
        });
      } else {
        await invoke("update_service_bounds", { bounds });
      }
    };

    // The main window starts hidden in the tray, and React mounts (and
    // restores the last-active service) well before the user ever shows it.
    // Creating the service's native WebviewWindow immediately would spin up
    // a second full WebView2 instance in the background on every launch —
    // slow, resource-heavy, and pointless if the user never opens the dock.
    // Defer the first switch_service call until the main window is actually
    // shown, either because it already is (rare) or via the "shown" event
    // the backend emits from the tray/hotkey/single-instance show paths.
    let created = false;
    let inFlight = false;
    let pollId = 0;
    let pollAttempts = 0;
    const MAX_POLL_ATTEMPTS = 60;

    const createWhenShown = async () => {
      // Latch inFlight before any await so poll/resize/shown cannot stack
      // concurrent switch_service calls.
      if (created || cancelled || inFlight) return;
      inFlight = true;
      try {
        if (!(await getCurrentWindow().isVisible())) return;
        if (await getCurrentWindow().isMinimized()) return;
        // Only latch `created` once we have real bounds to create the webview
        // with. The container can still report a zero-size rect for a frame
        // or two right as the main window becomes visible; bailing out here
        // without setting `created` lets the next poll/resize/move event
        // retry instead of leaving the service permanently un-created.
        const bounds = await measureBounds(el);
        if (!bounds || cancelled) return;
        try {
          await invoke("switch_service", {
            serviceId: service.id,
            url: service.url,
            bounds,
            allowedHosts: service.allowedHosts ?? [],
          });
          if (cancelled) return;
          created = true;
          window.clearInterval(pollId);
        } catch (e) {
          const msg =
            typeof e === "string"
              ? e
              : e instanceof Error
                ? e.message
                : String(e);
          if (msg.includes("already exists") || msg.includes("is creating")) {
            // Creation race — show whatever won, or let the next poll retry.
            if (msg.includes("already exists")) {
              void invoke("show_active_service_window");
              created = true;
              window.clearInterval(pollId);
            }
            return;
          }
          console.error("switch_service failed:", msg);
        }
      } finally {
        inFlight = false;
      }
    };

    void createWhenShown();

    const unlistenShownPromise = listen("main-window-shown", () => {
      void createWhenShown();
    });

    // Defense-in-depth against the "shown" event firing before this
    // listener finishes its async IPC registration (a real race on the
    // very first launch): poll briefly until the webview is created so a
    // missed event can never leave the app permanently stuck with no
    // visible service content.
    pollId = window.setInterval(() => {
      pollAttempts += 1;
      if (pollAttempts > MAX_POLL_ATTEMPTS) {
        window.clearInterval(pollId);
        return;
      }
      void createWhenShown();
    }, 400);

    const observer = new ResizeObserver(() => {
      if (created) void sync(false);
      else void createWhenShown();
    });
    observer.observe(el);

    const unlistenPromise = Promise.all([
      getCurrentWindow().onResized(() => {
        if (created) void sync(false);
        else void createWhenShown();
      }),
      getCurrentWindow().onMoved(() => {
        if (created) void sync(false);
      }),
    ]);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      observer.disconnect();
      void unlistenShownPromise.then((unlisten) => unlisten());
      void unlistenPromise.then((unlistens) => {
        for (const unlisten of unlistens) {
          unlisten();
        }
      });
    };
  }, [service, browserMode, overlayOpen]);

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
