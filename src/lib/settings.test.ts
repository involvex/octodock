import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SERVICES,
  faviconUrl,
  isLikelyHotkey,
  normalizeHotkey,
  prefersBrowser,
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
});
