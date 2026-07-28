export interface ServiceConfig {
  id: string;
  name: string;
  icon: string;
  url: string;
  /** When true, do not embed — show open-in-browser panel instead. */
  openInBrowser?: boolean;
  /**
   * Extra hostnames allowed for in-webview navigation (SSO, CDN, etc.).
   * Matched as exact host or subdomain (e.g. `auth0.com` allows `foo.auth0.com`).
   */
  allowedHosts?: string[];
}

/** Curated add-from-preset entry; `idPrefix` seeds a unique runtime id. */
export interface ServicePreset {
  idPrefix: string;
  name: string;
  icon: string;
  url: string;
  openInBrowser?: boolean;
  allowedHosts?: string[];
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

/** One-click Settings presets (not installed by default). */
export const SERVICE_PRESETS: ServicePreset[] = [
  {
    idPrefix: "notion",
    name: "Notion",
    icon: "📓",
    url: "https://www.notion.so",
    openInBrowser: false,
    allowedHosts: ["notion.so", "notion.com", "amazonaws.com"],
  },
  {
    idPrefix: "slack",
    name: "Slack",
    icon: "💬",
    url: "https://app.slack.com",
    openInBrowser: false,
    allowedHosts: ["slack.com", "slack-edge.com", "slack-imgs.com"],
  },
  {
    idPrefix: "chatgpt",
    name: "ChatGPT",
    icon: "✨",
    url: "https://chatgpt.com",
    openInBrowser: false,
    allowedHosts: ["openai.com", "auth0.com", "chatgpt.com"],
  },
  {
    idPrefix: "linear",
    name: "Linear",
    icon: "📐",
    url: "https://linear.app",
    openInBrowser: false,
    allowedHosts: ["linear.app", "linearusercontent.com"],
  },
  {
    idPrefix: "github",
    name: "GitHub",
    icon: "🐙",
    url: "https://github.com",
    openInBrowser: false,
    allowedHosts: ["github.com", "githubusercontent.com", "githubassets.com"],
  },
  {
    idPrefix: "discord",
    name: "Discord",
    icon: "🎮",
    url: "https://discord.com/app",
    openInBrowser: false,
    allowedHosts: ["discord.com", "discordapp.com", "discord.gg"],
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

export function parseAllowedHosts(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export function serviceHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** True if a service already covers this preset (same host or id prefix). */
export function isPresetAlreadyAdded(
  services: ServiceConfig[],
  preset: ServicePreset,
): boolean {
  const presetHost = serviceHost(preset.url);
  return services.some((service) => {
    if (
      service.id === preset.idPrefix ||
      service.id.startsWith(`${preset.idPrefix}-`)
    ) {
      return true;
    }
    if (!presetHost) return false;
    const host = serviceHost(service.url);
    return host === presetHost;
  });
}

export function uniqueServiceId(
  idBase: string,
  services: ServiceConfig[],
): string {
  let id = idBase || "service";
  let suffix = 1;
  while (services.some((s) => s.id === id)) {
    id = `${idBase}-${suffix}`;
    suffix += 1;
  }
  return id;
}

export function serviceFromPreset(
  preset: ServicePreset,
  services: ServiceConfig[],
): ServiceConfig {
  return {
    id: uniqueServiceId(preset.idPrefix, services),
    name: preset.name,
    icon: preset.icon,
    url: preset.url,
    openInBrowser: preset.openInBrowser ?? false,
    allowedHosts: preset.allowedHosts ? [...preset.allowedHosts] : undefined,
  };
}
