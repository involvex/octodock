export interface ServiceConfig {
  id: string;
  name: string;
  icon: string;
  url: string;
  /** When true, do not embed — show open-in-browser panel instead. */
  openInBrowser?: boolean;
}

export const DEFAULT_HOTKEY = "Alt+Space";

// Google actively blocks sign-in inside embedded/automated webviews for
// *any* accounts.google.com-gated property, not just Gmail — Keep and
// Calendar hit the exact same "This browser or app may not be secure"
// wall. All three default to the browser fallback; only Reddit (no such
// block) defaults to embedding.
export const GOOGLE_EMBED_BLOCKED_IDS = new Set(["gmail", "keep", "calendar"]);

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
    openInBrowser: true,
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
    openInBrowser: true,
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
