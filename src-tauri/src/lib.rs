pub mod commands;
pub mod integrations;
mod wallpaper;
mod windows_theme;

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    LogicalSize, Manager, PhysicalPosition, Position, Size,
};
use wallpaper::state::AppStateStore;

fn restore_wallpaper_if_enabled(app: tauri::AppHandle, store: &AppStateStore) {
    let state = wallpaper::state::get(store);
    if state.restore_on_launch {
        let in_library = |v: &crate::wallpaper::providers::VideoResult| {
            state.favorites.iter().any(|item| item.video.local_path == v.local_path) ||
            state.imports.iter().any(|item| item.video.local_path == v.local_path)
        };
        let video_to_restore = state.current_video.as_ref()
            .filter(|v| in_library(v))
            .or_else(|| state.recents.iter().map(|i| &i.video).find(|v| in_library(v)));
        if let Some(video) = video_to_restore {
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
                    app.clone(),
                    &video.local_path,
                    state.wallpaper_scale_percent,
                    state.volume_percent,
                    &state.video_filter,
                    state.playback_speed,
                    state.blur_strength,
                    false,
                    None,
                    None,
                    None,
                );
            }
            let _ = crate::wallpaper::state::mark_active(store, video.clone());
        }

        // Also restore desktop effects if they exist in current_effects.json
        let data_dir = app
            .path()
            .app_local_data_dir()
            .unwrap_or_else(|_| std::path::PathBuf::from("."));
        let config_path = data_dir.join("current_effects.json");
        if config_path.exists() {
            if let Ok(layers_json) = std::fs::read_to_string(&config_path) {
                log::info!(
                    "[Startup] Found current_effects.json. Restoring desktop effects overlay..."
                );
                let app_clone = app.clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_millis(600)).await;
                    if let Err(e) = crate::commands::wallpaper_control::apply_desktop_effects(
                        app_clone,
                        layers_json,
                    ) {
                        log::error!("[Startup] Failed to restore desktop effects overlay: {}", e);
                    } else {
                        log::info!("[Startup] Desktop effects overlay restored successfully!");
                    }
                });
            }
        }
    }
}

fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItemBuilder::with_id("show", "Show Window").build(app)?;
    let hide = MenuItemBuilder::with_id("hide", "Hide Window").build(app)?;
    let mini_player = MenuItemBuilder::with_id("mini_player", "Mini Player").build(app)?;
    let restore = MenuItemBuilder::with_id("restore_last", "Restore Last Wallpaper").build(app)?;
    let stop = MenuItemBuilder::with_id("stop_wallpaper", "Stop Wallpaper").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[&show, &hide, &mini_player, &restore, &stop, &quit])
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
            "mini_player" => {
                if let Some(window) = app_handle.get_webview_window("mini_player") {
                    let visible = window.is_visible().unwrap_or(false);
                    if visible {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }
            }
            "restore_last" => {
                let store = app_handle.state::<AppStateStore>();
                let state = wallpaper::state::get(&store);
                if let Some(video) = state.current_video.as_ref() {
                    let _ = wallpaper::desktop::set_video(
                        app_handle.clone(),
                        &video.local_path,
                        state.wallpaper_scale_percent,
                        state.volume_percent,
                        &state.video_filter,
                        state.playback_speed,
                        state.blur_strength,
                        state.paused,
                        None,
                        None,
                        None,
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
                            let _ = window.set_position(Position::Physical(PhysicalPosition::new(
                                x as i32, y as i32,
                            )));
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
    let event_store = state_store.clone();

    // integrations server is started inside .setup() once the AppHandle is available

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .manage(state_store.clone())
        .on_window_event(move |window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    let state = wallpaper::state::get(&event_store);
                    if state.close_to_tray {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                }
            }
        })
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            wallpaper::performance::start_monitor(monitor_store.clone(), app.handle().clone());

            // Start local API server for Raycast & Rainmeter integrations (needs AppHandle)
            integrations::start(state_store.clone(), app.handle().clone());
            // set_video contains Win32 calls and sleeps that block the main thread.
            let app_handle_restore = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                restore_wallpaper_if_enabled(app_handle_restore, &restore_store);
            });

            crate::wallpaper::media::init_media_polling(app.handle().clone());

            build_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::video::fetch_video,
            commands::video::fetch_videos_list,
            commands::profiles::save_profile,
            commands::profiles::load_profile,
            commands::profiles::list_profiles,
            commands::profiles::delete_profile,
            crate::wallpaper::audio::start_audio_capture,
            crate::wallpaper::audio::stop_audio_capture,
            crate::wallpaper::media::media_play_pause,
            crate::wallpaper::media::media_next,
            crate::wallpaper::media::media_prev,
            crate::wallpaper::media::media_seek,
            crate::wallpaper::media::get_current_media_info,
            crate::wallpaper::media::media_get_volume,
            crate::wallpaper::media::media_set_volume,
            commands::wallpaper_control::apply_wallpaper,
            commands::wallpaper_control::next_wallpaper,
            commands::wallpaper_control::prev_wallpaper,
            commands::wallpaper_control::stop_wallpaper,
            commands::desktop_icons::invoke_throw_random_desktop_icon,
            commands::wallpaper_control::get_wallpaper_status,
            commands::settings::list_sources,
            commands::settings::cleanup_cache,
            commands::wallpaper_control::toggle_favorite,
            commands::settings::get_app_state,
            commands::queue::add_to_queue,
            commands::queue::remove_from_queue,
            commands::queue::clear_queue,
            commands::queue::import_folder_to_queue,
            commands::settings::set_restore_on_launch,
            commands::settings::set_window_behavior,
            commands::settings::set_auto_pause,
            commands::settings::set_keep_effects_running_on_pause,
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
            commands::settings::set_categories_filter,
            commands::settings::set_purity_filter,
            commands::settings::set_slideshow_source,
            commands::settings::set_discover_provider,
            commands::settings::get_system_wallpaper,
            commands::settings::check_dependencies,
            commands::settings::install_mpv,
            commands::settings::launch_external_app,
            commands::settings::extract_icon_base64,
            commands::settings::set_wallhaven_api_key,
            commands::settings::set_disabled_sources,
            commands::settings::set_pinterest_urls,
            commands::settings::toggle_hide_video,
            commands::video::fetch_wallhaven_collections,
            commands::batch::start_wallhaven_batch_download,
            commands::batch::cancel_batch_download,
            commands::batch::download_single_file,
            commands::batch::start_wallhaven_selection_download,
            commands::video::fetch_video_tags,
            commands::settings::get_monitors,
            commands::package::export_itl_package,
            commands::package::import_itl_package,
            commands::package::scan_wallpaper_engine_directory,
            windows_theme::sync_windows_accent_color,
            commands::window_info::get_active_window,
            commands::shell_control::toggle_desktop_icons,
            commands::shell_control::set_taskbar_state,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(move |_app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            let _ = wallpaper::desktop::stop_video();
        }
    });
}
