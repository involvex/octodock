import { useState } from "react";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { ServiceContentArea } from "./components/ServiceContentArea";
import { SettingsModal } from "./components/SettingsModal";
import { useSettingsStore } from "./hooks/useSettingsStore";

function App() {
  const {
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
  } = useSettingsStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

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
          <ServiceContentArea service={activeService} />
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
    </div>
  );
}

export default App;
