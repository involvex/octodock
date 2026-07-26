import type { ServiceConfig } from "../hooks/useSettingsStore";
import { ServiceIcon } from "./ServiceIcon";

interface SidebarProps {
  services: ServiceConfig[];
  activeService: string;
  onServiceChange: (id: string) => void;
}

export function Sidebar({
  services,
  activeService,
  onServiceChange,
}: SidebarProps) {
  return (
    <div className="w-14 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-2 gap-1">
      {services.map((service) => (
        <button
          key={service.id}
          onClick={() => onServiceChange(service.id)}
          className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-colors ${
            activeService === service.id
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:bg-gray-800 hover:text-white"
          }`}
          title={service.name}
          type="button"
        >
          <ServiceIcon service={service} className="w-6 h-6" />
        </button>
      ))}
    </div>
  );
}
