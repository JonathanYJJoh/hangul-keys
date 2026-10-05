//! The floating keyboard overlay: a transparent, always-on-top window that
//! never takes keyboard focus and lets clicks pass through, except on its
//! toolbar.

use std::{
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    thread,
    time::Duration,
};

use serde::{Deserialize, Serialize};
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, State, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

use crate::settings;

pub const LABEL: &str = "overlay";
/// Overlay size in logical pixels at 100% size, before the user's size
/// setting and the monitor's DPI scaling.
const SIZE: (f64, f64) = (720.0, 252.0);
/// Gap between the overlay and the bottom of the screen, clearing the taskbar.
const BOTTOM_MARGIN: f64 = 80.0;
/// How often to check whether the mouse is over the toolbar.
const HOVER_POLL: Duration = Duration::from_millis(30);
const POSITION_FILE: &str = "overlay-position.json";

/// A rectangle in the overlay page's CSS pixels.
#[derive(Clone, Copy, Deserialize)]
pub struct Rect {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

impl Rect {
    fn contains(&self, x: f64, y: f64) -> bool {
        x >= self.x && x < self.x + self.width && y >= self.y && y < self.y + self.height
    }
}

#[derive(Clone, Copy, Serialize, Deserialize)]
struct SavedPosition {
    x: i32,
    y: i32,
}

#[derive(Default)]
pub struct OverlayState {
    visible: AtomicBool,
    /// Parts of the overlay that should receive clicks (the toolbar). The
    /// page reports these whenever its layout changes.
    hit_regions: Mutex<Vec<Rect>>,
    /// Where the user last dragged the overlay, saved to disk on exit.
    position: Mutex<Option<SavedPosition>>,
    /// What to restore when the overlay closes, if opening it switched the
    /// user to Korean.
    #[cfg(windows)]
    previous_input: Mutex<Option<crate::input_lang::Previous>>,
}

/// Creates the overlay window, hidden until the hotkey is pressed.
pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let scale = settings::current(app).overlay_scale;
    let overlay = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("overlay.html".into()))
        .title("Hangul Keys Overlay")
        .inner_size(SIZE.0 * scale, SIZE.1 * scale)
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .resizable(false)
        .maximizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        // Never take keyboard focus: keystrokes must keep going to the app
        // the user is typing in. Clicking the toolbar doesn't steal it either.
        .focused(false)
        .focusable(false)
        .visible(false)
        .build()?;
    overlay.set_ignore_cursor_events(true)?;

    *app.state::<OverlayState>().position.lock().unwrap() = load_position(app);

    let handle = app.clone();
    thread::spawn(move || watch_hover(handle));
    Ok(())
}

pub fn is_visible(app: &AppHandle) -> bool {
    app.state::<OverlayState>().visible.load(Ordering::Relaxed)
}

pub fn toggle(app: &AppHandle) {
    let Some(overlay) = app.get_webview_window(LABEL) else {
        return;
    };
    let state = app.state::<OverlayState>();
    let result = if state.visible.load(Ordering::Relaxed) {
        state.visible.store(false, Ordering::Relaxed);
        restore_language(app);
        overlay.hide()
    } else {
        state.visible.store(true, Ordering::Relaxed);
        // Keys released while hidden were never reported; start clean.
        let _ = overlay.emit("overlay-shown", ());
        if settings::current(app).auto_korean {
            switch_language(app);
        }
        place(app, &overlay).and_then(|_| overlay.show())
    };
    if let Err(e) = result {
        eprintln!("failed to toggle overlay: {e}");
    }
}

/// Turns on the Korean keyboard in the app being typed in. Runs on its own
/// thread because the switch waits briefly for Windows to apply it.
fn switch_language(app: &AppHandle) {
    #[cfg(windows)]
    {
        let app = app.clone();
        thread::spawn(move || {
            let previous = crate::input_lang::switch_to_korean();
            *app.state::<OverlayState>().previous_input.lock().unwrap() = previous;
        });
    }
}

/// Puts back the keyboard the user had before the overlay switched it.
fn restore_language(app: &AppHandle) {
    #[cfg(windows)]
    if let Some(previous) = app.state::<OverlayState>().previous_input.lock().unwrap().take() {
        thread::spawn(move || crate::input_lang::restore(previous));
    }
}

#[tauri::command]
pub fn hide_overlay(app: AppHandle) {
    if app.state::<OverlayState>().visible.load(Ordering::Relaxed) {
        toggle(&app);
    }
}

/// Resizes the overlay for the size setting; the page scales its content.
pub fn apply_scale(app: &AppHandle, scale: f64) -> tauri::Result<()> {
    match app.get_webview_window(LABEL) {
        Some(overlay) => overlay.set_size(LogicalSize::new(SIZE.0 * scale, SIZE.1 * scale)),
        None => Ok(()),
    }
}

/// Forgets where the user dragged the overlay and moves it back to the
/// bottom center of the screen.
#[tauri::command]
pub fn reset_overlay_position(app: AppHandle) -> Result<(), String> {
    *app.state::<OverlayState>().position.lock().unwrap() = None;
    if let Some(path) = position_file(&app) {
        let _ = fs::remove_file(path);
    }
    match app.get_webview_window(LABEL) {
        Some(overlay) if is_visible(&app) => place(&app, &overlay).map_err(|e| e.to_string()),
        _ => Ok(()),
    }
}

#[tauri::command]
pub fn set_overlay_hit_regions(state: State<OverlayState>, regions: Vec<Rect>) {
    *state.hit_regions.lock().unwrap() = regions;
}

/// Puts the overlay where the user last left it, or at the bottom center of
/// the screen the mouse is on.
fn place(app: &AppHandle, overlay: &WebviewWindow) -> tauri::Result<()> {
    let saved = *app.state::<OverlayState>().position.lock().unwrap();
    if let Some(p) = saved {
        // Skip it if that spot is no longer on any screen (monitor unplugged).
        if app.monitor_from_point(p.x as f64 + 1.0, p.y as f64 + 1.0)?.is_some() {
            return overlay.set_position(PhysicalPosition::new(p.x, p.y));
        }
    }

    let cursor = app.cursor_position()?;
    let monitor = match app.monitor_from_point(cursor.x, cursor.y)? {
        Some(m) => m,
        None => match app.primary_monitor()? {
            Some(m) => m,
            None => return Ok(()),
        },
    };

    let scale = monitor.scale_factor() * settings::current(app).overlay_scale;
    let (screen_pos, screen_size) = (monitor.position(), monitor.size());
    let width = (SIZE.0 * scale) as i32;
    let height = (SIZE.1 * scale) as i32;

    let x = screen_pos.x + (screen_size.width as i32 - width) / 2;
    let y = screen_pos.y + screen_size.height as i32 - height - (BOTTOM_MARGIN * scale) as i32;
    overlay.set_position(PhysicalPosition::new(x, y))
}

/// Windows can't make only part of a window click-through, so this polls the
/// mouse and turns click-through off while it's over the toolbar.
fn watch_hover(app: AppHandle) {
    let mut ignoring = true;
    loop {
        thread::sleep(HOVER_POLL);
        let Some(overlay) = app.get_webview_window(LABEL) else {
            continue;
        };
        let state = app.state::<OverlayState>();
        let hovering =
            state.visible.load(Ordering::Relaxed) && cursor_on_toolbar(&app, &overlay, &state);

        if hovering == ignoring && overlay.set_ignore_cursor_events(!hovering).is_ok() {
            ignoring = !hovering;
        }
    }
}

fn cursor_on_toolbar(app: &AppHandle, overlay: &WebviewWindow, state: &OverlayState) -> bool {
    let (Ok(cursor), Ok(origin), Ok(scale)) =
        (app.cursor_position(), overlay.inner_position(), overlay.scale_factor())
    else {
        return false;
    };
    // Convert screen pixels to the page's CSS pixels.
    let x = (cursor.x - origin.x as f64) / scale;
    let y = (cursor.y - origin.y as f64) / scale;
    state.hit_regions.lock().unwrap().iter().any(|r| r.contains(x, y))
}

pub fn remember_position(app: &AppHandle, position: PhysicalPosition<i32>) {
    let state = app.state::<OverlayState>();
    // Moves while hidden are window setup, not the user dragging it.
    if state.visible.load(Ordering::Relaxed) {
        *state.position.lock().unwrap() = Some(SavedPosition { x: position.x, y: position.y });
    }
}

fn position_file(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|dir| dir.join(POSITION_FILE))
}

fn load_position(app: &AppHandle) -> Option<SavedPosition> {
    let text = fs::read_to_string(position_file(app)?).ok()?;
    serde_json::from_str(&text).ok()
}

pub fn save_position(app: &AppHandle) {
    let Some(position) = *app.state::<OverlayState>().position.lock().unwrap() else {
        return;
    };
    let Some(path) = position_file(app) else {
        return;
    };
    let result = path
        .parent()
        .map_or(Ok(()), fs::create_dir_all)
        .and_then(|_| fs::write(&path, serde_json::to_string(&position).unwrap_or_default()));
    if let Err(e) = result {
        eprintln!("failed to save overlay position: {e}");
    }
}
