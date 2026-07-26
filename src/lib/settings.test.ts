import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SERVICES,
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
});
