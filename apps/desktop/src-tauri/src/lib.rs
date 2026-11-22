use tauri::{Manager, WebviewWindowBuilder};

/// Release builds serve the app from `http://localhost:PORT` instead of
/// `tauri://localhost`. YouTube's embed won't play without a `Referer`
/// (error 153), and WebKit sends none from the `tauri://` scheme. Dev builds
/// already load from Vite's `http://localhost:1420`.
///
/// Keep this port the same from release to release: the sign-in is kept in
/// localStorage, which belongs to the origin, so a new port signs everyone out.
/// It must also match `remote.urls` in `capabilities/default.json`.
#[cfg(not(debug_assertions))]
const PORT: u16 = 41420;
#[cfg(debug_assertions)]
use tauri_plugin_localhost as _;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(not(debug_assertions))]
    let builder = builder.plugin(tauri_plugin_localhost::Builder::new(PORT).build());

    let app = builder
        // The main window is `"create": false` in tauri.conf.json so it can be
        // pointed at the localhost server here in release builds.
        .setup(|app| {
            #[allow(unused_mut)]
            let mut config = app
                .config()
                .app
                .windows
                .iter()
                .find(|w| w.label == "main")
                .cloned()
                .expect("tauri.conf.json has no main window");
            #[cfg(not(debug_assertions))]
            {
                config.url = tauri::WebviewUrl::External(
                    format!("http://localhost:{PORT}").parse().expect("valid localhost URL"),
                );
            }
            WebviewWindowBuilder::from_config(app.handle(), &config)?.build()?;
            Ok(())
        })
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
