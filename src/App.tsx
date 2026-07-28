import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { ServiceContentArea } from "./components/ServiceContentArea";
import { SettingsModal } from "./components/SettingsModal";
import { ToastHost } from "./components/ToastHost";
import { useSettingsStore } from "./hooks/useSettingsStore";
import { prefersBrowser } from "./lib/settings";
import { toast } from "./lib/toast";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

function App() {
  const {
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
  } = useSettingsStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Safety net: surface any otherwise-unhandled invoke() rejection as a
  // toast instead of failing silently in the devtools console.
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      const reason = event.reason as unknown;
      const message = reason instanceof Error ? reason.message : String(reason);
      toast(message, "error");
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  // First time the window is actually shown to the user (it starts hidden
  // in the tray), let them know how to bring it back.
  useEffect(() => {
    if (!ready || hasSeenTrayTip) return;

    const showTip = () => {
      toast(
        `OctoDock lives in your tray — press ${hotkey} to show or hide it.`,
      );
      markTrayTipSeen();
    };

    if (!document.hidden) {
      showTip();
      return;
    }

    const handleVisibility = () => {
      if (!document.hidden) {
        document.removeEventListener("visibilitychange", handleVisibility);
        showTip();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [ready, hasSeenTrayTip, hotkey, markTrayTipSeen]);

  // Child service webviews paint above the main React UI. Hide them while
  // Settings is open so the modal is visible and interactive; restore on close.
  useEffect(() => {
    if (!ready) return;
    if (settingsOpen) {
      void invoke("hide_service_windows");
    } else {
      void invoke("show_active_service_window");
    }
  }, [settingsOpen, ready]);

  // Tray "Settings" menu item shows the window and asks the UI to open Settings.
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void listen("open-settings", () => {
      setSettingsOpen(true);
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // In-app service shortcuts (not global — only while the main window is focused).
  useEffect(() => {
    if (!ready) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (settingsOpen || isTypingTarget(event.target)) return;
      if (!(event.ctrlKey || event.metaKey)) return;

      if (event.key === "Tab") {
        event.preventDefault();
        if (services.length === 0) return;
        const currentIndex = Math.max(
          0,
          services.findIndex((s) => s.id === activeServiceId),
        );
        const delta = event.shiftKey ? -1 : 1;
        const nextIndex =
          (currentIndex + delta + services.length) % services.length;
        const next = services[nextIndex];
        if (next) void setActiveService(next.id);
        return;
      }

      if (event.key === "O" && event.shiftKey && activeService) {
        event.preventDefault();
        void openUrl(activeService.url);
        return;
      }

      if (event.shiftKey || event.altKey) return;
      const digit = Number.parseInt(event.key, 10);
      if (digit >= 1 && digit <= 9) {
        const service = services[digit - 1];
        if (service) {
          event.preventDefault();
          void setActiveService(service.id);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    ready,
    settingsOpen,
    services,
    activeServiceId,
    activeService,
    setActiveService,
  ]);

  const canReload =
    !!activeService && !prefersBrowser(activeService) && !settingsOpen;

  return (
    <div className="h-full flex flex-col bg-gray-900 relative">
      <TitleBar
        onOpenSettings={() => setSettingsOpen(true)}
        activeService={activeService}
        canReload={canReload}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          services={services}
          activeService={activeServiceId}
          onServiceChange={(id) => {
            void setActiveService(id);
          }}
        />

        {ready ? (
          <ServiceContentArea
            service={activeService}
            onUpdateService={updateService}
            overlayOpen={settingsOpen}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
            Loading settings…
          </div>
        )}
      </div>

      {settingsOpen ? (
        <SettingsModal
          key={hotkey}
          open={settingsOpen}
          services={services}
          hotkey={hotkey}
          onClose={() => setSettingsOpen(false)}
          onAdd={addService}
          onRemove={removeService}
          onMove={moveService}
          onUpdateService={updateService}
          onSetHotkey={setHotkey}
        />
      ) : null}

      <ToastHost />
    </div>
  );
}

export default App;
