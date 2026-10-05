#[cfg(windows)]
mod input_lang;
#[cfg(windows)]
mod keyhook;
mod overlay;
mod settings;
mod tray;

use tauri::{Manager, RunEvent, WindowEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Brings the main window to the front, e.g. from the tray or the overlay.
pub fn show_main_window(app: &tauri::AppHandle) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.unminimize();
        let _ = main.set_focus();
    }
}

#[tauri::command]
fn open_main_window(app: tauri::AppHandle) {
    show_main_window(&app);
}

/// Whether the Windows Korean keyboard is installed.
#[tauri::command]
fn korean_keyboard_installed() -> bool {
    #[cfg(windows)]
    return input_lang::korean_installed();
    #[cfg(not(windows))]
    false
}

/// The overlay's 한/A badge: toggles Hangul mode in the app being typed in.
#[tauri::command]
fn toggle_hangul() {
    #[cfg(windows)]
    std::thread::spawn(input_lang::toggle_hangul);
}

/// Opens the Windows page where the Korean keyboard can be added.
#[tauri::command]
fn open_language_settings(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url("ms-settings:regionlanguage", None::<&str>)
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let toggle_shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyK);

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if shortcut == &toggle_shortcut && event.state() == ShortcutState::Pressed {
                        overlay::toggle(app);
                    }
                })
                .build(),
        )
        .manage(overlay::OverlayState::default())
        .manage(settings::SettingsState::default())
        .invoke_handler(tauri::generate_handler![
            open_main_window,
            korean_keyboard_installed,
            toggle_hangul,
            open_language_settings,
            overlay::hide_overlay,
            overlay::reset_overlay_position,
            overlay::set_overlay_hit_regions,
            settings::get_settings,
            settings::update_settings,
        ])
        .setup(move |app| {
            settings::load(app.handle());
            overlay::create(app.handle())?;
            tray::create(app.handle())?;
            #[cfg(windows)]
            {
                keyhook::start(app.handle().clone());
                input_lang::watch(app.handle().clone());
            }
            app.global_shortcut().register(toggle_shortcut)?;
            Ok(())
        })
        .on_window_event(|window, event| match event {
            // Closing the main window hides it to the tray, so the overlay and
            // hotkey keep working. "Quit" in the tray menu really exits.
            WindowEvent::CloseRequested { api, .. } if window.label() == "main" => {
                api.prevent_close();
                let _ = window.hide();
            }
            WindowEvent::Moved(position) if window.label() == overlay::LABEL => {
                overlay::remember_position(window.app_handle(), *position);
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app, event| {
        if let RunEvent::Exit = event {
            overlay::save_position(app);
        }
    });
}
