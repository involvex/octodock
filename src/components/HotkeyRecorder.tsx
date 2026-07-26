import { useEffect, useState } from "react";

interface HotkeyRecorderButtonProps {
  onRecord: (hotkey: string) => void;
}

function accelaratorForCode(e: KeyboardEvent): string | null {
  if (e.code.startsWith("Key") && e.code.length === 4) {
    return e.code.slice(3);
  }
  if (e.code.startsWith("Digit") && e.code.length === 6) {
    return e.code.slice(5);
  }
  if (e.code === "Space") return "Space";
  if (/^Arrow(Up|Down|Left|Right)$/.test(e.code)) return e.code;
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(e.code)) return e.code;
  if (
    [
      "Escape",
      "Tab",
      "Backspace",
      "Delete",
      "Enter",
      "Home",
      "End",
      "PageUp",
      "PageDown",
      "Insert",
    ].includes(e.code)
  ) {
    return e.code;
  }
  if (e.key.length === 1) return e.key.toUpperCase();
  return null;
}

const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta", "AltGraph"]);

/**
 * A button that, when clicked, captures the next key combination pressed by
 * the user and reports it as a Tauri-accelerator-formatted string (e.g.
 * "Ctrl+Shift+O") — no manual typing of shortcut syntax required.
 */
export function HotkeyRecorderButton({ onRecord }: HotkeyRecorderButtonProps) {
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setRecording(false);
        return;
      }

      if (MODIFIER_KEYS.has(e.key)) {
        return;
      }

      const mods: string[] = [];
      if (e.ctrlKey) mods.push("Ctrl");
      if (e.altKey) mods.push("Alt");
      if (e.shiftKey) mods.push("Shift");
      if (e.metaKey) mods.push("Super");

      if (mods.length === 0) {
        return;
      }

      const key = accelaratorForCode(e);
      if (!key) return;

      setRecording(false);
      onRecord([...mods, key].join("+"));
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [recording, onRecord]);

  return (
    <button
      type="button"
      onClick={() => setRecording((prev) => !prev)}
      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        recording
          ? "bg-amber-600 text-white"
          : "border border-gray-700 text-gray-300 hover:bg-gray-800"
      }`}
    >
      {recording ? "Press keys… (Esc to cancel)" : "Record"}
    </button>
  );
}
