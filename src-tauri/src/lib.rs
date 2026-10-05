mod overlay;
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
        .invoke_handler(tauri::generate_handler![
            open_main_window,
            overlay::hide_overlay,
            overlay::set_overlay_hit_regions,
        ])
        .setup(move |app| {
            overlay::create(app.handle())?;
            tray::create(app.handle())?;
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
