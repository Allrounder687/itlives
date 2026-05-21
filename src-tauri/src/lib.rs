mod wallpaper;
pub mod commands;
pub mod integrations;

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Position, PhysicalPosition, Size, LogicalSize
};
use wallpaper::state::AppStateStore;

fn restore_wallpaper_if_enabled(store: &AppStateStore) {
    let state = wallpaper::state::get(store);
    if state.restore_on_launch && state.is_playing {
        if let Some(video) = state.current_video.as_ref() {
            let path_lower = video.local_path.to_lowercase();
            let is_static_image = path_lower.ends_with(".jpg") 
                || path_lower.ends_with(".jpeg") 
                || path_lower.ends_with(".png") 
                || path_lower.ends_with(".webp")
                || video.source == "wallhaven"
                || video.source == "pinterest";

            if is_static_image {
                let _ = wallpaper::desktop::set_static_image(&video.local_path);
            } else {
                let _ = wallpaper::desktop::set_video(
                    &video.local_path,
                    state.wallpaper_scale_percent,
                    state.volume_percent,
                    &state.video_filter,
                    state.playback_speed,
                    state.blur_strength,
                    state.paused,
                    None,
                    None,
                );
            }
        }
    }
}

fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItemBuilder::with_id("show", "Show Window").build(app)?;
    let hide = MenuItemBuilder::with_id("hide", "Hide Window").build(app)?;
    let restore = MenuItemBuilder::with_id("restore_last", "Restore Last Wallpaper").build(app)?;
    let stop = MenuItemBuilder::with_id("stop_wallpaper", "Stop Wallpaper").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[&show, &hide, &restore, &stop, &quit])
        .build()?;

    let icon = app.default_window_icon().cloned();

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(false)
        .icon(icon.expect("default icon"))
        .on_menu_event(|app_handle, event| match event.id().as_ref() {
            "show" => {
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            "hide" => {
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            "restore_last" => {
                let store = app_handle.state::<AppStateStore>();
                let state = wallpaper::state::get(&store);
                if let Some(video) = state.current_video.as_ref() {
                    let _ = wallpaper::desktop::set_video(
                        &video.local_path,
                        state.wallpaper_scale_percent,
                        state.volume_percent,
                        &state.video_filter,
                        state.playback_speed,
                        state.blur_strength,
                        state.paused,
                        None,
                        None
                    );
                }
            }
            "stop_wallpaper" => {
                let _ = wallpaper::desktop::stop_video();
                let store = app_handle.state::<AppStateStore>();
                let _ = wallpaper::state::clear_active(&store);
            }
            "quit" => {
                app_handle.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app_handle = tray.app_handle();
                if let Some(window) = app_handle.get_webview_window("tray_menu") {
                    let visible = window.is_visible().unwrap_or(false);
                    if visible {
                        let _ = window.hide();
                    } else {
                        if let Ok(Some(m)) = window.current_monitor() {
                             let size = m.size();
                             let scale = m.scale_factor();
                             let _ = window.set_size(Size::Logical(LogicalSize::new(380.0, 480.0)));
                             let x = size.width as f64 - (380.0 * scale) - (15.0 * scale);
                             let y = size.height as f64 - (480.0 * scale) - (50.0 * scale);
                             let _ = window.set_position(Position::Physical(PhysicalPosition::new(x as i32, y as i32)));
                        }
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state_store = AppStateStore::new();
    let restore_store = state_store.clone();
    let monitor_store = state_store.clone();

    // Start local API server for Raycast & Rainmeter integrations
    integrations::start(state_store.clone());

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .manage(state_store)
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            wallpaper::performance::start_monitor(monitor_store.clone());

            // Moving wallpaper restoration to a background thread to prevent GUI hang on startup.
            // set_video contains Win32 calls and sleeps that block the main thread.
            tauri::async_runtime::spawn(async move {
                restore_wallpaper_if_enabled(&restore_store);
            });

            build_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::video::fetch_video,
            commands::video::fetch_videos_list,
            commands::wallpaper_control::apply_wallpaper,
            commands::wallpaper_control::stop_wallpaper,
            commands::wallpaper_control::get_wallpaper_status,
            commands::settings::list_sources,
            commands::settings::cleanup_cache,
            commands::wallpaper_control::toggle_favorite,
            commands::settings::get_app_state,
            commands::queue::add_to_queue,
            commands::queue::remove_from_queue,
            commands::queue::clear_queue,
            commands::queue::set_rotation,
            commands::queue::advance_rotation,
            commands::settings::set_restore_on_launch,
            commands::settings::set_window_behavior,
            commands::settings::set_auto_pause,
            commands::wallpaper_control::set_wallpaper_paused,
            commands::wallpaper_control::set_wallpaper_volume,
            commands::wallpaper_control::set_wallpaper_filter,
            commands::wallpaper_control::set_wallpaper_scale,
            commands::settings::import_local_video,
            commands::settings::remove_imported_video,
            commands::settings::remove_recent_video,
            commands::video::fetch_youtube_meta,
            commands::video::download_youtube_clip,
            commands::video::check_ytdlp_installed,
            commands::video::install_ytdlp,
            commands::video::check_ffmpeg_installed,
            commands::video::install_ffmpeg,
            commands::queue::reorder_queue,
            commands::video::save_thumbnail,
            commands::wallpaper_control::apply_desktop_effects,
            commands::wallpaper_control::get_current_effects,
            commands::wallpaper_control::set_wallpaper_speed,
            commands::wallpaper_control::set_wallpaper_blur,
            commands::settings::set_theme,
            commands::settings::check_dependencies,
            commands::settings::install_mpv,
            commands::settings::set_wallhaven_api_key,
            commands::settings::set_disabled_sources,
            commands::settings::set_pinterest_urls,
            commands::settings::set_adult_pin,
            commands::settings::verify_adult_pin,
            commands::settings::toggle_hide_video,
        ])
        .run(tauri::generate_context!())


        .expect("error while running tauri application");
}
