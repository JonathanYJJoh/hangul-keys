//! User settings, shared by the main window and the overlay.
//!
//! Rust owns the single copy: windows read it with `get_settings`, change it
//! with `update_settings`, and every window is told about each change through
//! a `settings-changed` event, so the overlay updates live.

use std::{fs, path::PathBuf, sync::Mutex};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::overlay;

const SETTINGS_FILE: &str = "settings.json";

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// Opacity of the overlay's keyboard, from 0.3 to 1.
    pub overlay_opacity: f64,
    /// Overlay size multiplier, from 0.75 to 1.5.
    pub overlay_scale: f64,
    /// Light up overlay keys while typing in other apps.
    pub highlight_keys: bool,
    /// Switch to the Windows Korean keyboard while the overlay is open.
    pub auto_korean: bool,
    /// Show romanization ("g", "eo") on keys.
    pub show_romanization: bool,
    /// Show the Shift letter (ㅃ, ㅆ...) in the corner of keys.
    pub show_shift_hints: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            overlay_opacity: 1.0,
            overlay_scale: 1.0,
            highlight_keys: true,
            auto_korean: true,
            show_romanization: true,
            show_shift_hints: true,
        }
    }
}

impl Settings {
    /// Keeps values in range, whatever the page or an edited file sends.
    fn clamped(mut self) -> Self {
        self.overlay_opacity = self.overlay_opacity.clamp(0.3, 1.0);
        self.overlay_scale = self.overlay_scale.clamp(0.75, 1.5);
        self
    }
}

#[derive(Default)]
pub struct SettingsState(Mutex<Settings>);

/// Current settings, for Rust code that needs them.
pub fn current(app: &AppHandle) -> Settings {
    app.state::<SettingsState>().0.lock().unwrap().clone()
}

pub fn load(app: &AppHandle) {
    let loaded = settings_file(app)
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|text| serde_json::from_str::<Settings>(&text).ok())
        .unwrap_or_default()
        .clamped();
    *app.state::<SettingsState>().0.lock().unwrap() = loaded;
}

#[tauri::command]
pub fn get_settings(state: State<SettingsState>) -> Settings {
    state.0.lock().unwrap().clone()
}

#[tauri::command]
pub fn update_settings(app: AppHandle, settings: Settings) -> Result<Settings, String> {
    let settings = settings.clamped();
    *app.state::<SettingsState>().0.lock().unwrap() = settings.clone();

    overlay::apply_scale(&app, settings.overlay_scale).map_err(|e| e.to_string())?;
    let _ = app.emit("settings-changed", settings.clone());
    save(&app, &settings).map_err(|e| format!("couldn't save settings: {e}"))?;
    Ok(settings)
}

fn settings_file(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|dir| dir.join(SETTINGS_FILE))
}

fn save(app: &AppHandle, settings: &Settings) -> std::io::Result<()> {
    let path = settings_file(app).ok_or(std::io::ErrorKind::NotFound)?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    let json = serde_json::to_string_pretty(settings).map_err(std::io::Error::other)?;
    fs::write(path, json)
}

#[cfg(test)]
mod tests {
    use super::Settings;

    #[test]
    fn clamps_out_of_range_values() {
        let s = Settings { overlay_opacity: 5.0, overlay_scale: 0.1, ..Settings::default() }.clamped();
        assert_eq!(s.overlay_opacity, 1.0);
        assert_eq!(s.overlay_scale, 0.75);
    }

    #[test]
    fn fills_missing_fields_with_defaults() {
        // Settings files from older versions won't have newer fields.
        let s: Settings = serde_json::from_str(r#"{ "overlayOpacity": 0.5 }"#).unwrap();
        assert_eq!(s.overlay_opacity, 0.5);
        assert!(s.highlight_keys);
    }
}
