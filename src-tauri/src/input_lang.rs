//! Reads and switches the Windows input language of the app being typed in,
//! so opening the overlay can turn on the Korean keyboard (in 가 mode) and
//! the overlay can show which mode is active.
//!
//! Windows tracks the input language per window, and the Korean IME has its
//! own Hangul (가) / English (A) toggle on top of that, so both are handled.

use std::{thread, time::Duration};

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use windows::Win32::{
    Foundation::{HWND, LPARAM, WPARAM},
    UI::{
        Input::{
            Ime::ImmGetDefaultIMEWnd,
            KeyboardAndMouse::{GetKeyboardLayout, GetKeyboardLayoutList, HKL},
        },
        WindowsAndMessaging::{
            GetForegroundWindow, GetWindowThreadProcessId, PostMessageW, SendMessageTimeoutW,
            SMTO_ABORTIFHUNG, WM_IME_CONTROL, WM_INPUTLANGCHANGEREQUEST,
        },
    },
};

use crate::overlay;

const LANG_KOREAN: u16 = 0x0412;
/// WM_IME_CONTROL requests, from imm.h.
const IMC_GETCONVERSIONMODE: usize = 0x0001;
const IMC_SETCONVERSIONMODE: usize = 0x0002;
/// Conversion-mode bit that means "typing Hangul" rather than Latin letters.
const IME_CMODE_NATIVE: usize = 0x0001;
/// Don't let a frozen app freeze ours.
const SEND_TIMEOUT_MS: u32 = 100;
const POLL: Duration = Duration::from_millis(250);

/// What the overlay's badge shows.
#[derive(Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum InputMode {
    /// Korean keyboard, typing Hangul (가).
    Hangul,
    /// Korean keyboard, typing Latin letters (A).
    Latin,
    /// Another language's keyboard (usually English).
    Other,
    /// The Korean keyboard isn't installed in Windows.
    Missing,
}

/// The installed Korean keyboard layout, if there is one.
fn korean_layout() -> Option<HKL> {
    unsafe {
        let count = GetKeyboardLayoutList(None);
        let mut layouts = vec![HKL::default(); count.max(0) as usize];
        let filled = GetKeyboardLayoutList(Some(&mut layouts)).max(0) as usize;
        layouts.truncate(filled);
        layouts.into_iter().find(|&hkl| lang_id(hkl) == LANG_KOREAN)
    }
}

pub fn korean_installed() -> bool {
    korean_layout().is_some()
}

fn lang_id(hkl: HKL) -> u16 {
    (hkl.0 as usize & 0xFFFF) as u16
}

fn foreground() -> Option<HWND> {
    let hwnd = unsafe { GetForegroundWindow() };
    (!hwnd.is_invalid()).then_some(hwnd)
}

fn layout_of(hwnd: HWND) -> HKL {
    unsafe { GetKeyboardLayout(GetWindowThreadProcessId(hwnd, None)) }
}

/// Sends a WM_IME_CONTROL request to the window's IME, returning its answer.
fn ime_control(hwnd: HWND, request: usize, value: usize) -> Option<usize> {
    unsafe {
        let ime = ImmGetDefaultIMEWnd(hwnd);
        if ime.is_invalid() {
            return None;
        }
        let mut result = 0usize;
        let ok = SendMessageTimeoutW(
            ime,
            WM_IME_CONTROL,
            WPARAM(request),
            LPARAM(value as isize),
            SMTO_ABORTIFHUNG,
            SEND_TIMEOUT_MS,
            Some(&mut result),
        );
        (ok.0 != 0).then_some(result)
    }
}

pub fn current_mode() -> InputMode {
    if !korean_installed() {
        return InputMode::Missing;
    }
    let Some(hwnd) = foreground() else {
        return InputMode::Other;
    };
    if lang_id(layout_of(hwnd)) != LANG_KOREAN {
        return InputMode::Other;
    }
    match ime_control(hwnd, IMC_GETCONVERSIONMODE, 0) {
        Some(mode) if mode & IME_CMODE_NATIVE != 0 => InputMode::Hangul,
        _ => InputMode::Latin,
    }
}

/// Asks the foreground window to switch keyboard layouts. Windows applies
/// this asynchronously, in that app's own thread.
fn request_layout(hwnd: HWND, hkl: HKL) {
    unsafe {
        let _ = PostMessageW(Some(hwnd), WM_INPUTLANGCHANGEREQUEST, WPARAM(0), LPARAM(hkl.0 as isize));
    }
}

fn set_hangul(hwnd: HWND, on: bool) {
    if let Some(mode) = ime_control(hwnd, IMC_GETCONVERSIONMODE, 0) {
        let mode = if on { mode | IME_CMODE_NATIVE } else { mode & !IME_CMODE_NATIVE };
        ime_control(hwnd, IMC_SETCONVERSIONMODE, mode);
    }
}

/// What switch_to_korean() changed, so it can be undone.
#[derive(Clone, Copy)]
pub enum Previous {
    /// Another language's keyboard (a raw HKL, so it can cross threads).
    Layout(isize),
    /// The Korean keyboard, but in A (Latin) mode.
    KoreanLatin,
}

/// Switches the app being typed in to Korean, in 가 mode. Returns what was
/// active before, or None if it was already Korean in 가 mode.
pub fn switch_to_korean() -> Option<Previous> {
    let korean = korean_layout()?;
    let hwnd = foreground()?;
    let previous = match current_mode() {
        InputMode::Hangul | InputMode::Missing => return None,
        InputMode::Latin => Previous::KoreanLatin,
        InputMode::Other => {
            let layout = layout_of(hwnd);
            request_layout(hwnd, korean);
            // The IME only exists once the switch has happened.
            thread::sleep(Duration::from_millis(150));
            Previous::Layout(layout.0 as isize)
        }
    };
    set_hangul(hwnd, true);
    Some(previous)
}

/// Undoes switch_to_korean() in whichever app is now in front.
pub fn restore(previous: Previous) {
    let Some(hwnd) = foreground() else {
        return;
    };
    match previous {
        Previous::Layout(layout) => request_layout(hwnd, HKL(layout as *mut _)),
        Previous::KoreanLatin => set_hangul(hwnd, false),
    }
}

/// The badge button: 가 ↔ A on the Korean keyboard, or switch to Korean.
pub fn toggle_hangul() {
    match current_mode() {
        InputMode::Hangul => foreground().into_iter().for_each(|h| set_hangul(h, false)),
        InputMode::Latin => foreground().into_iter().for_each(|h| set_hangul(h, true)),
        InputMode::Other => {
            switch_to_korean();
        }
        InputMode::Missing => {}
    }
}

/// While the overlay is showing, reports the input mode whenever it changes:
/// the user may switch apps or press the 한/영 key at any time.
pub fn watch(app: AppHandle) {
    thread::spawn(move || {
        let mut last = None;
        loop {
            thread::sleep(POLL);
            if !overlay::is_visible(&app) {
                last = None; // Report again as soon as it reopens.
                continue;
            }
            let mode = current_mode();
            if last != Some(mode) {
                last = Some(mode);
                let _ = app.emit_to(overlay::LABEL, "input-mode", mode);
            }
        }
    });
}
