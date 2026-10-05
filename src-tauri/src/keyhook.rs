//! System-wide key listening, so the overlay can light up keys while the user
//! types in other apps. Uses a Windows low-level keyboard hook (WH_KEYBOARD_LL).
//!
//! Keys are only observed, never blocked or changed, and are forwarded to the
//! overlay only while it is visible.

use std::{
    sync::{
        mpsc::{self, Sender},
        OnceLock,
    },
    thread,
};

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use windows::Win32::{
    Foundation::{LPARAM, LRESULT, WPARAM},
    UI::WindowsAndMessaging::{
        CallNextHookEx, DispatchMessageW, GetMessageW, SetWindowsHookExW, TranslateMessage,
        HC_ACTION, KBDLLHOOKSTRUCT, LLKHF_EXTENDED, MSG, WH_KEYBOARD_LL, WM_KEYDOWN,
        WM_SYSKEYDOWN,
    },
};

use crate::{overlay, settings};

/// Sent to the overlay page for every key press and release.
#[derive(Clone, Serialize)]
struct KeyEvent {
    /// Same names as the browser's KeyboardEvent.code, e.g. "KeyQ".
    code: &'static str,
    down: bool,
}

/// The hook callback can't capture variables, so it hands events to a normal
/// thread through this channel and returns to Windows immediately.
static EVENTS: OnceLock<Sender<KeyEvent>> = OnceLock::new();

pub fn start(app: AppHandle) {
    let (tx, rx) = mpsc::channel::<KeyEvent>();
    if EVENTS.set(tx).is_err() {
        return; // Already started.
    }

    thread::spawn(move || {
        for event in rx {
            if overlay::is_visible(&app) && settings::current(&app).highlight_keys {
                let _ = app.emit_to(overlay::LABEL, "global-key", event);
            }
        }
    });

    // A low-level hook is called on the thread that installed it, and only
    // while that thread is pumping messages, so it gets a thread of its own.
    thread::spawn(|| unsafe {
        if let Err(e) = SetWindowsHookExW(WH_KEYBOARD_LL, Some(hook_proc), None, 0) {
            eprintln!("failed to install keyboard hook: {e}");
            return;
        }
        let mut msg = MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).as_bool() {
            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    });
}

unsafe extern "system" fn hook_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code == HC_ACTION as i32 {
        // SAFETY: for WH_KEYBOARD_LL, lparam always points to a KBDLLHOOKSTRUCT.
        let info = unsafe { &*(lparam.0 as *const KBDLLHOOKSTRUCT) };
        let extended = info.flags.0 & LLKHF_EXTENDED.0 != 0;
        if let (Some(code), Some(events)) = (key_name(info.scanCode, extended), EVENTS.get()) {
            let message = wparam.0 as u32;
            let down = message == WM_KEYDOWN || message == WM_SYSKEYDOWN;
            let _ = events.send(KeyEvent { code, down });
        }
    }
    // Always pass the key along so it still reaches the app being typed in.
    unsafe { CallNextHookEx(None, code, wparam, lparam) }
}

/// Maps a physical key's scan code to its KeyboardEvent.code name.
///
/// Scan codes identify the key's position on the keyboard, not the letter the
/// OS layout assigns it, which is what a Dubeolsik overlay needs: the key
/// labeled Q is ㅂ regardless of language settings.
fn key_name(scan_code: u32, extended: bool) -> Option<&'static str> {
    // Extended keys (arrows, numpad Enter, right Ctrl...) reuse the scan codes
    // of other keys and don't appear on the overlay.
    if extended {
        return None;
    }
    Some(match scan_code {
        0x02 => "Digit1",
        0x03 => "Digit2",
        0x04 => "Digit3",
        0x05 => "Digit4",
        0x06 => "Digit5",
        0x07 => "Digit6",
        0x08 => "Digit7",
        0x09 => "Digit8",
        0x0A => "Digit9",
        0x0B => "Digit0",
        0x0C => "Minus",
        0x0D => "Equal",
        0x0E => "Backspace",
        0x0F => "Tab",
        0x10 => "KeyQ",
        0x11 => "KeyW",
        0x12 => "KeyE",
        0x13 => "KeyR",
        0x14 => "KeyT",
        0x15 => "KeyY",
        0x16 => "KeyU",
        0x17 => "KeyI",
        0x18 => "KeyO",
        0x19 => "KeyP",
        0x1A => "BracketLeft",
        0x1B => "BracketRight",
        0x1C => "Enter",
        0x1E => "KeyA",
        0x1F => "KeyS",
        0x20 => "KeyD",
        0x21 => "KeyF",
        0x22 => "KeyG",
        0x23 => "KeyH",
        0x24 => "KeyJ",
        0x25 => "KeyK",
        0x26 => "KeyL",
        0x27 => "Semicolon",
        0x28 => "Quote",
        0x29 => "Backquote",
        0x2A => "ShiftLeft",
        0x2B => "Backslash",
        0x2C => "KeyZ",
        0x2D => "KeyX",
        0x2E => "KeyC",
        0x2F => "KeyV",
        0x30 => "KeyB",
        0x31 => "KeyN",
        0x32 => "KeyM",
        0x33 => "Comma",
        0x34 => "Period",
        0x35 => "Slash",
        0x36 => "ShiftRight",
        0x39 => "Space",
        0x3A => "CapsLock",
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::key_name;

    #[test]
    fn maps_letter_rows_by_position() {
        assert_eq!(key_name(0x10, false), Some("KeyQ"));
        assert_eq!(key_name(0x1E, false), Some("KeyA"));
        assert_eq!(key_name(0x2C, false), Some("KeyZ"));
        assert_eq!(key_name(0x36, false), Some("ShiftRight"));
    }

    #[test]
    fn ignores_extended_and_unknown_keys() {
        assert_eq!(key_name(0x1C, true), None); // numpad Enter
        assert_eq!(key_name(0x48, false), None); // numpad 8
    }
}
