import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useAppState } from "../hooks/useAppState";
import type { ServiceConfig } from "../hooks/useSettingsStore";

interface TitleBarProps {
  onOpenSettings: () => void;
  activeService: ServiceConfig | null;
  /** When true, show Reload (embedded services only). */
  canReload?: boolean;
}

export function TitleBar({
  onOpenSettings,
  activeService,
  canReload = false,
}: TitleBarProps) {
  const { isAlwaysOnTop, toggleAlwaysOnTop } = useAppState();
  const appWindow = getCurrentWindow();

  // Service webviews are child views layered in the content area, so
  // minimizing/hiding the main window must explicitly hide them too —
  // otherwise they stay floating on screen with nothing behind them.
  const handleMinimize = () => {
    void invoke("hide_service_windows");
    void appWindow.minimize();
  };
  const handleMaximize = () => {
    void appWindow.toggleMaximize();
  };
  const handleClose = () => {
    void invoke("hide_service_windows");
    void appWindow.hide();
  };
  const handleReload = () => {
    if (!activeService) return;
    void invoke("reload_service", { serviceId: activeService.id });
  };

  return (
    <div
      data-tauri-drag-region
      className="h-8 bg-gray-900 flex items-center justify-between border-b border-gray-800 select-none"
    >
      <div className="flex items-center px-3 gap-2" data-tauri-drag-region>
        <span className="text-sm font-medium text-gray-300">OctoDock</span>
        {activeService ? (
          <span className="text-xs text-gray-500" data-tauri-drag-region>
            {activeService.name}
          </span>
        ) : null}
      </div>

      <div className="flex items-center h-full">
        {canReload && activeService ? (
          <button
            onClick={handleReload}
            className="h-full px-3 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors text-xs"
            title={`Reload ${activeService.name}`}
            type="button"
          >
            ↻ Reload
          </button>
        ) : null}

        {activeService ? (
          <button
            onClick={() => void openUrl(activeService.url)}
            className="h-full px-3 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors text-xs"
            title={`Open ${activeService.name} in browser`}
            type="button"
          >
            ↗ Browser
          </button>
        ) : null}

        <button
          onClick={onOpenSettings}
          className="h-full px-3 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          title="Settings"
          type="button"
        >
          ⚙️
        </button>

        <button
          onClick={() => void toggleAlwaysOnTop()}
          className={`h-full px-3 flex items-center justify-center transition-colors ${
            isAlwaysOnTop
              ? "bg-teal-600 text-white"
              : "text-gray-400 hover:bg-gray-800 hover:text-white"
          }`}
          title={isAlwaysOnTop ? "Unpin from top" : "Pin to top"}
          type="button"
        >
          <svg
            className="w-4 h-4"
            fill={isAlwaysOnTop ? "currentColor" : "none"}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
            />
          </svg>
        </button>

        <button
          onClick={handleMinimize}
          className="h-full px-3 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          title="Minimize"
          type="button"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 12H4"
            />
          </svg>
        </button>

        <button
          onClick={handleMaximize}
          className="h-full px-3 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          title="Maximize"
          type="button"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4"
            />
          </svg>
        </button>

        <button
          onClick={handleClose}
          className="h-full px-3 text-gray-400 hover:bg-red-600 hover:text-white transition-colors"
          title="Close to tray"
          type="button"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
