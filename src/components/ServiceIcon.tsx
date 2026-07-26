import { useState } from "react";
import type { ServiceConfig } from "../hooks/useSettingsStore";
import { faviconUrl } from "../lib/settings";

interface ServiceIconProps {
  service: ServiceConfig;
  className?: string;
  textClassName?: string;
}

/**
 * Shows the service's real favicon when available, falling back to its
 * configured emoji glyph if the icon fails to load (offline, blocked host,
 * or a custom service whose favicon proxy lookup fails).
 */
export function ServiceIcon({
  service,
  className = "w-5 h-5",
  textClassName = "text-lg",
}: ServiceIconProps) {
  const src = faviconUrl(service.url);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <span className={textClassName}>{service.icon}</span>;
  }

  return (
    <img
      src={src}
      alt=""
      className={`${className} object-contain`}
      onError={() => setFailed(true)}
    />
  );
}
