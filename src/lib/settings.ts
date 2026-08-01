export interface ServiceConfig {
  id: string;
  name: string;
  icon: string;
  url: string;
  /**
   * Optional explicit icon image URL. Wins over known product icons and the
   * favicon proxy (useful when Google apps would otherwise all show the same G).
   */
  iconUrl?: string;
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
  iconUrl?: string;
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

// xAI Grok gates sign-in behind a Cloudflare challenge that detects the
// embedded WebView2 environment, opens the challenge in the external
// browser, and never returns usable session cookies to the dock. Same UX
// shape as the Google block — default to the browser fallback.
export const CLOUDFLARE_EMBED_BLOCKED_IDS = new Set(["grok"]);

/** Stable Google Workspace product logos (distinct — not the generic G favicon). */
const GSTATIC_PRODUCT = {
  gmail:
    "https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_48dp.png",
  keep: "https://www.gstatic.com/images/branding/product/1x/keep_2020q4_48dp.png",
  calendar:
    "https://www.gstatic.com/images/branding/product/1x/calendar_2020q4_48dp.png",
  drive:
    "https://www.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png",
  chat: "https://www.gstatic.com/images/branding/product/1x/chat_2020q4_48dp.png",
  meet: "https://www.gstatic.com/images/branding/product/1x/meet_2020q4_48dp.png",
} as const;

/**
 * Known product icons by service id prefix. `null` = skip favicon, use emoji
 * (favicon proxy would return an ambiguous Google G).
 */
const KNOWN_ICON_BY_ID: Record<string, string | null> = {
  gmail: GSTATIC_PRODUCT.gmail,
  keep: GSTATIC_PRODUCT.keep,
  calendar: GSTATIC_PRODUCT.calendar,
  drive: GSTATIC_PRODUCT.drive,
  chat: GSTATIC_PRODUCT.chat,
  meet: GSTATIC_PRODUCT.meet,
  gemini: null,
  docs: null,
  sheets: null,
  slides: null,
};

/** Hostname → product icon (same semantics as KNOWN_ICON_BY_ID). */
const KNOWN_ICON_BY_HOST: Record<string, string | null> = {
  "mail.google.com": GSTATIC_PRODUCT.gmail,
  "keep.google.com": GSTATIC_PRODUCT.keep,
  "calendar.google.com": GSTATIC_PRODUCT.calendar,
  "drive.google.com": GSTATIC_PRODUCT.drive,
  "chat.google.com": GSTATIC_PRODUCT.chat,
  "meet.google.com": GSTATIC_PRODUCT.meet,
  "gemini.google.com": null,
  "docs.google.com": null,
  "sheets.google.com": null,
  "slides.google.com": null,
};

export const DEFAULT_SERVICES: ServiceConfig[] = [
  {
    id: "gmail",
    name: "Gmail",
    icon: "📧",
    iconUrl: GSTATIC_PRODUCT.gmail,
    url: "https://mail.google.com",
    openInBrowser: true,
  },
  {
    id: "keep",
    name: "Keep",
    icon: "📝",
    iconUrl: GSTATIC_PRODUCT.keep,
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
    iconUrl: GSTATIC_PRODUCT.calendar,
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
  {
    idPrefix: "x",
    name: "X (Twitter)",
    icon: "𝕏",
    url: "https://x.com",
    openInBrowser: false,
    allowedHosts: ["twitter.com", "twimg.com", "t.co", "x.com"],
  },
  {
    idPrefix: "grok",
    name: "Grok",
    icon: "✨",
    url: "https://grok.com",
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

function knownIconForId(id: string): string | null | undefined {
  const exact = KNOWN_ICON_BY_ID[id];
  if (exact !== undefined) return exact;
  const prefix = Object.keys(KNOWN_ICON_BY_ID).find(
    (key) => id === key || id.startsWith(`${key}-`),
  );
  return prefix ? KNOWN_ICON_BY_ID[prefix] : undefined;
}

function isAmbiguousGoogleHost(host: string): boolean {
  return (
    host === "google.com" ||
    host.endsWith(".google.com") ||
    host === "googleusercontent.com" ||
    host.endsWith(".googleusercontent.com")
  );
}

/**
 * Image URL for the sidebar/settings icon, or `null` to render the emoji glyph.
 * Order: custom iconUrl → known product map → favicon (non-ambiguous hosts).
 */
export function resolveServiceIconSrc(
  service: Pick<ServiceConfig, "id" | "url" | "iconUrl">,
): string | null {
  const custom = service.iconUrl?.trim();
  if (custom) return custom;

  const byId = knownIconForId(service.id);
  if (byId !== undefined) return byId;

  const host = serviceHost(service.url);
  if (host) {
    const byHost = KNOWN_ICON_BY_HOST[host];
    if (byHost !== undefined) return byHost;
    if (isAmbiguousGoogleHost(host)) return null;
  }

  return faviconUrl(service.url);
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
    iconUrl: preset.iconUrl,
    url: preset.url,
    openInBrowser: preset.openInBrowser ?? false,
    allowedHosts: preset.allowedHosts ? [...preset.allowedHosts] : undefined,
  };
}
