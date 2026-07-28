import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SERVICES,
  SERVICE_PRESETS,
  faviconUrl,
  isLikelyHotkey,
  isPresetAlreadyAdded,
  normalizeHotkey,
  parseAllowedHosts,
  prefersBrowser,
  serviceFromPreset,
  serviceHost,
  uniqueServiceId,
} from "./settings";

describe("settings helpers", () => {
  test("gmail defaults to open-in-browser mode", () => {
    const gmail = DEFAULT_SERVICES.find((s) => s.id === "gmail");
    expect(gmail).toBeDefined();
    expect(prefersBrowser(gmail!)).toBe(true);
  });

  test("reddit embeds by default", () => {
    const reddit = DEFAULT_SERVICES.find((s) => s.id === "reddit");
    expect(reddit).toBeDefined();
    expect(prefersBrowser(reddit!)).toBe(false);
  });

  test("normalizeHotkey trims parts", () => {
    expect(normalizeHotkey(" Alt + Space ")).toBe("Alt+Space");
  });

  test("isLikelyHotkey rejects empty", () => {
    expect(isLikelyHotkey("")).toBe(false);
    expect(isLikelyHotkey("   ")).toBe(false);
    expect(isLikelyHotkey("Ctrl+Shift+O")).toBe(true);
  });

  test("faviconUrl resolves the host via the favicon proxy", () => {
    expect(faviconUrl("https://mail.google.com/mail")).toBe(
      "https://www.google.com/s2/favicons?domain=mail.google.com&sz=64",
    );
  });

  test("faviconUrl returns null for unparseable URLs", () => {
    expect(faviconUrl("not-a-url")).toBeNull();
  });

  test("parseAllowedHosts splits commas and whitespace", () => {
    expect(
      parseAllowedHosts("auth0.com, MicrosoftOnline.com  cdn.example"),
    ).toEqual(["auth0.com", "microsoftonline.com", "cdn.example"]);
  });

  test("serviceHost extracts hostname", () => {
    expect(serviceHost("https://WWW.Notion.so/workspace")).toBe(
      "www.notion.so",
    );
    expect(serviceHost("bad")).toBeNull();
  });

  test("uniqueServiceId suffixes collisions", () => {
    expect(uniqueServiceId("notion", [])).toBe("notion");
    expect(
      uniqueServiceId("notion", [
        { id: "notion", name: "N", icon: "", url: "" },
      ]),
    ).toBe("notion-1");
  });

  test("isPresetAlreadyAdded matches host or id prefix", () => {
    const notion = SERVICE_PRESETS.find((p) => p.idPrefix === "notion")!;
    expect(isPresetAlreadyAdded([], notion)).toBe(false);
    expect(
      isPresetAlreadyAdded(
        [
          {
            id: "notion",
            name: "Notion",
            icon: "",
            url: "https://www.notion.so",
          },
        ],
        notion,
      ),
    ).toBe(true);
    expect(
      isPresetAlreadyAdded(
        [
          {
            id: "custom",
            name: "Notes",
            icon: "",
            url: "https://www.notion.so/abc",
          },
        ],
        notion,
      ),
    ).toBe(true);
  });

  test("serviceFromPreset copies allowlist and assigns unique id", () => {
    const chatgpt = SERVICE_PRESETS.find((p) => p.idPrefix === "chatgpt")!;
    const created = serviceFromPreset(chatgpt, [
      { id: "chatgpt", name: "Old", icon: "", url: "https://example.com" },
    ]);
    expect(created.id).toBe("chatgpt-1");
    expect(created.allowedHosts).toEqual(chatgpt.allowedHosts);
    expect(created.openInBrowser).toBe(false);
  });

  test("SERVICE_PRESETS have unique id prefixes", () => {
    const prefixes = SERVICE_PRESETS.map((p) => p.idPrefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });
});
