import { useState } from "react";
import type { ServiceConfig } from "../hooks/useSettingsStore";
import { resolveServiceIconSrc } from "../lib/settings";

interface ServiceIconProps {
  service: ServiceConfig;
  className?: string;
  textClassName?: string;
}

/**
 * Shows a product-specific / custom icon when available, otherwise the
 * configured emoji. Avoids the Google favicon proxy for known Google apps
 * (it collapses Gmail/Keep/Calendar/… to the same colorful G).
 */
export function ServiceIcon({
  service,
  className = "w-5 h-5",
  textClassName = "text-lg",
}: ServiceIconProps) {
  const src = resolveServiceIconSrc(service);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = src !== null && failedSrc === src;

  if (!src || failed) {
    return <span className={textClassName}>{service.icon}</span>;
  }

  return (
    <img
      src={src}
      alt=""
      className={`${className} object-contain rounded-sm`}
      onError={() => setFailedSrc(src)}
    />
  );
}
