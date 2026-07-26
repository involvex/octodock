export interface ServiceConfig {
  id: string;
  name: string;
  icon: string;
  url: string;
  /** When true, do not embed — show open-in-browser panel instead. */
  openInBrowser?: boolean;
}

export const DEFAULT_HOTKEY = "Alt+Space";

export const DEFAULT_SERVICES: ServiceConfig[] = [
  {
    id: "gmail",
    name: "Gmail",
    icon: "📧",
    url: "https://mail.google.com",
    openInBrowser: true,
  },
  {
    id: "keep",
    name: "Keep",
    icon: "📝",
    url: "https://keep.google.com",
    openInBrowser: false,
  },
  {
    id: "reddit",
    name: "Reddit",
    icon: "🤖",
    url: "https://www.reddit.com",
    openInBrowser: false,
  },
  {
    id: "calendar",
    name: "Calendar",
    icon: "📅",
    url: "https://calendar.google.com",
    openInBrowser: false,
  },
];

export function prefersBrowser(service: ServiceConfig): boolean {
  return service.openInBrowser === true;
}

/**
 * Resolves a favicon URL for a service via Google's favicon proxy, so the
 * sidebar/settings show each service's real branding instead of a generic
 * emoji. Returns null for URLs that can't be parsed (falls back to emoji).
 */
export function faviconUrl(url: string, size = 64): string | null {
  try {
    const host = new URL(url).host;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`;
  } catch {
    return null;
  }
}

export function normalizeHotkey(input: string): string {
  return input
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("+");
}

export function isLikelyHotkey(input: string): boolean {
  const normalized = normalizeHotkey(input);
  if (!normalized) return false;
  const parts = normalized.split("+");
  return parts.length >= 1 && parts.every((part) => part.length > 0);
}
