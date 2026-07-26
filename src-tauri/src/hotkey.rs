use std::str::FromStr;

use tauri_plugin_global_shortcut::Shortcut;

const DEFAULT_HOTKEY: &str = "Alt+Space";

pub fn default_hotkey() -> &'static str {
    DEFAULT_HOTKEY
}

/// Parse a human-readable shortcut like `Alt+Space` or `Ctrl+Shift+O`.
pub fn parse_shortcut(input: &str) -> Result<Shortcut, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err("Hotkey cannot be empty".into());
    }

    Shortcut::from_str(trimmed).map_err(|err| err.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri_plugin_global_shortcut::{Code, Modifiers};

    #[test]
    fn parses_alt_space() {
        let shortcut = parse_shortcut("Alt+Space").expect("parse");
        assert_eq!(shortcut.key, Code::Space);
        assert!(shortcut.mods.contains(Modifiers::ALT));
    }

    #[test]
    fn parses_ctrl_shift_o() {
        let shortcut = parse_shortcut("Ctrl+Shift+O").expect("parse");
        assert_eq!(shortcut.key, Code::KeyO);
        assert!(shortcut.mods.contains(Modifiers::CONTROL));
        assert!(shortcut.mods.contains(Modifiers::SHIFT));
    }

    #[test]
    fn rejects_empty() {
        assert!(parse_shortcut("").is_err());
        assert!(parse_shortcut("   ").is_err());
    }

    #[test]
    fn rejects_unknown_modifier() {
        assert!(parse_shortcut("Foo+Space").is_err());
    }
}
