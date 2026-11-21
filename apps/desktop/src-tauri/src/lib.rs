#[cfg(target_os = "macos")]
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        // On the Mac, closing the window (⌘W or the red button) hides it and the
        // app keeps running in the Dock, so the capture hotkeys keep working. ⌘Q quits.
        .on_window_event(|window, event| {
            #[cfg(target_os = "macos")]
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (window, event);
        })
        .build(tauri::generate_context!())
        .expect("error while building LAABS Video Vault");

    app.run(|_app, _event| {
        // Clicking the Dock icon brings the hidden window back.
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen { has_visible_windows: false, .. } = _event {
            if let Some(window) = _app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
    });
}
