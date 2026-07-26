import { useEffect, useState } from "react";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { ServiceContentArea } from "./components/ServiceContentArea";
import { SettingsModal } from "./components/SettingsModal";
import { ToastHost } from "./components/ToastHost";
import { useSettingsStore } from "./hooks/useSettingsStore";
import { toast } from "./lib/toast";

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

  return (
    <div className="h-full flex flex-col bg-gray-900 relative">
      <TitleBar
        onOpenSettings={() => setSettingsOpen(true)}
        activeService={activeService}
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
