mod wallpaper;

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, State,
};
use wallpaper::providers::{self, SearchConfig, VideoResult};
use wallpaper::state::{AppStateStore, QueueAdvanceResult, WallpaperState};

#[tauri::command]
async fn fetch_video(source: String, query: String, order: String) -> Result<VideoResult, String> {
    let provider = providers::get_provider(&source)?;
    let config = SearchConfig {
        query,
        order,
        count: 40,
        page: 0,
    };
    provider.fetch_video(&config).await
}

#[tauri::command]
async fn fetch_videos_list(source: String, query: String, order: String, page: u32) -> Result<Vec<VideoResult>, String> {
    let provider = providers::get_provider(&source)?;
    let config = SearchConfig {
        query,
        order,
        count: 40,
        page,
    };
    provider.fetch_videos_list(&config).await
}

#[tauri::command]
async fn apply_wallpaper(
    state: State<'_, AppStateStore>,
    mut video: VideoResult,
    scale_percent: u64,
) -> Result<WallpaperState, String> {
    if video.local_path.is_empty() {
        log::info!("[Core] Download on apply triggered for source: {}", video.source);
        let provider = providers::get_provider(&video.source)?;
        let local_path = provider.download_video(&video).await?;
        video.local_path = local_path;
        
        let _ = wallpaper::desktop::cleanup_cache(15);
    }

    let current = wallpaper::state::get(&state);
    wallpaper::desktop::set_video(
        &video.local_path,
        scale_percent,
        current.volume_percent,
        &current.video_filter,
        false, // Explicitly start playing instead of using previous state
    )?;
    wallpaper::state::mark_active(&state, video)
}

#[tauri::command]
fn stop_wallpaper(state: State<'_, AppStateStore>) -> Result<WallpaperState, String> {
    wallpaper::desktop::stop_video()?;
    wallpaper::state::clear_active(&state)
}

#[tauri::command]
fn get_wallpaper_status() -> Option<String> {
    wallpaper::desktop::get_current()
}

#[tauri::command]
fn list_sources() -> Vec<String> {
    providers::list_providers()
}

#[tauri::command]
fn cleanup_cache(keep: usize) -> Result<usize, String> {
    wallpaper::desktop::cleanup_cache(keep)
}

#[tauri::command]
fn toggle_favorite(
    state: State<'_, AppStateStore>,
    video: VideoResult,
) -> Result<WallpaperState, String> {
    wallpaper::state::toggle_favorite(&state, video)
}

#[tauri::command]
fn get_app_state(state: State<'_, AppStateStore>) -> WallpaperState {
    wallpaper::state::get(&state)
}

#[tauri::command]
fn add_to_queue(
    state: State<'_, AppStateStore>,
    video: VideoResult,
) -> Result<WallpaperState, String> {
    wallpaper::state::add_to_queue(&state, video)
}

#[tauri::command]
fn remove_from_queue(
    state: State<'_, AppStateStore>,
    video: VideoResult,
) -> Result<WallpaperState, String> {
    wallpaper::state::remove_from_queue(&state, video)
}

#[tauri::command]
fn clear_queue(state: State<'_, AppStateStore>) -> Result<WallpaperState, String> {
    wallpaper::state::clear_queue(&state)
}

#[tauri::command]
fn set_rotation(
    state: State<'_, AppStateStore>,
    enabled: bool,
    interval_seconds: u64,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_rotation(&state, enabled, interval_seconds)
}

#[tauri::command]
fn advance_rotation(
    state: State<'_, AppStateStore>,
    scale_percent: u64,
) -> Result<QueueAdvanceResult, String> {
    let current = wallpaper::state::get(&state);
    let advanced = wallpaper::state::advance_queue(&state)?;
    wallpaper::desktop::set_video(
        &advanced.video.local_path,
        scale_percent,
        current.volume_percent,
        &current.video_filter,
        false, // Explicitly start playing
    )?;
    let persisted = wallpaper::state::mark_active(&state, advanced.video.clone())?;
    Ok(QueueAdvanceResult {
        video: advanced.video,
        state: persisted,
    })
}

#[tauri::command]
fn set_restore_on_launch(
    state: State<'_, AppStateStore>,
    enabled: bool,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_restore_on_launch(&state, enabled)
}

#[tauri::command]
fn set_window_behavior(
    state: State<'_, AppStateStore>,
    close_to_tray: bool,
    minimize_to_tray: bool,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_window_behavior(&state, close_to_tray, minimize_to_tray)
}

#[tauri::command]
fn set_auto_pause(
    state: State<'_, AppStateStore>,
    enabled: bool,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_auto_pause(&state, enabled)
}

#[tauri::command]
fn set_wallpaper_paused(
    state: State<'_, AppStateStore>,
    paused: bool,
) -> Result<WallpaperState, String> {
    let persisted = wallpaper::state::set_paused(&state, paused)?;
    if persisted.is_playing {
        wallpaper::desktop::set_paused(paused)?;
    }
    Ok(persisted)
}

#[tauri::command]
fn set_wallpaper_volume(
    state: State<'_, AppStateStore>,
    volume_percent: u64,
) -> Result<WallpaperState, String> {
    let persisted = wallpaper::state::set_volume_percent(&state, volume_percent)?;
    if persisted.is_playing {
        wallpaper::desktop::set_volume(persisted.volume_percent)?;
    }
    Ok(persisted)
}

#[tauri::command]
fn set_wallpaper_filter(
    state: State<'_, AppStateStore>,
    video_filter: String,
) -> Result<WallpaperState, String> {
    let persisted = wallpaper::state::set_video_filter(&state, video_filter)?;
    if persisted.is_playing {
        if let Some(video) = persisted.current_video.as_ref() {
            wallpaper::desktop::set_video(
                &video.local_path,
                persisted.wallpaper_scale_percent,
                persisted.volume_percent,
                &persisted.video_filter,
                persisted.paused,
            )?;
        }
    }
    Ok(persisted)
}

#[tauri::command]
fn set_wallpaper_scale(
    state: State<'_, AppStateStore>,
    scale_percent: u64,
) -> Result<WallpaperState, String> {
    let persisted = wallpaper::state::set_wallpaper_scale_percent(&state, scale_percent)?;
    if persisted.is_playing {
        if let Some(video) = persisted.current_video.as_ref() {
            wallpaper::desktop::set_video(
                &video.local_path,
                persisted.wallpaper_scale_percent,
                persisted.volume_percent,
                &persisted.video_filter,
                persisted.paused,
            )?;
        }
    }
    Ok(persisted)
}

#[tauri::command]
fn import_local_video(
    state: State<'_, AppStateStore>,
    video: VideoResult,
) -> Result<WallpaperState, String> {
    wallpaper::state::import_local_video(&state, video)
}

#[tauri::command]
fn remove_imported_video(
    state: State<'_, AppStateStore>,
    video: VideoResult,
) -> Result<WallpaperState, String> {
    wallpaper::state::remove_imported_video(&state, video)
}

#[tauri::command]
fn remove_recent_video(
    state: State<'_, AppStateStore>,
    video: VideoResult,
) -> Result<WallpaperState, String> {
    wallpaper::state::remove_recent_video(&state, video)
}

/// Fetches YouTube video metadata (title, duration, thumbnail) without downloading.
#[tauri::command]
async fn fetch_youtube_meta(url: String) -> Result<VideoResult, String> {
    let meta = tokio::task::spawn_blocking(move || {
        wallpaper::providers::youtube::fetch_metadata(&url)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    Ok(VideoResult {
        id: meta.id.clone(),
        video_url: String::new(),
        thumbnail_url: meta.thumbnail.unwrap_or_default(),
        local_path: String::new(),
        duration: meta.duration.unwrap_or(0.0),
        width: meta.width.unwrap_or(1920),
        height: meta.height.unwrap_or(1080),
        source: "youtube".to_string(),
        start_time: None,
        end_time: None,
    })
}

/// Downloads a time-trimmed YouTube clip and returns a VideoResult with local_path.
#[tauri::command]
async fn download_youtube_clip(
    state: State<'_, AppStateStore>,
    url: String,
    start_time: f64,
    end_time: f64,
    max_height: u32,
    window: tauri::Window,
) -> Result<VideoResult, String> {
    // Fetch metadata first for title/thumbnail info
    let meta_url = url.clone();
    let meta = tokio::task::spawn_blocking(move || {
        wallpaper::providers::youtube::fetch_metadata(&meta_url)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    let dl_url = url.clone();
    let dl_id = meta.id.clone();
    let local_path = tokio::task::spawn_blocking(move || {
        wallpaper::providers::youtube::download_clip(&dl_url, &dl_id, start_time, end_time, max_height, Some(&window))
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    let video = VideoResult {
        id: meta.id.clone(),
        video_url: url,
        thumbnail_url: meta.thumbnail.unwrap_or_default(),
        local_path,
        duration: end_time - start_time,
        width: meta.width.unwrap_or(1920),
        height: meta.height.unwrap_or(1080),
        source: "youtube".to_string(),
        start_time: Some(start_time),
        end_time: Some(end_time),
    };

    // Auto-save to Imports so it appears in the Library permanently
    let _ = wallpaper::state::import_local_video(&state, video.clone());

    Ok(video)
}

fn restore_wallpaper_if_enabled(store: &AppStateStore) {
    let state = wallpaper::state::get(store);
    if state.restore_on_launch && state.is_playing {
        if let Some(video) = state.current_video.as_ref() {
            let _ = wallpaper::desktop::set_video(
                &video.local_path,
                state.wallpaper_scale_percent,
                state.volume_percent,
                &state.video_filter,
                state.paused,
            );
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
                    let _ = wallpaper::desktop::set_video(&video.local_path, state.wallpaper_scale_percent, state.volume_percent, &state.video_filter, state.paused);
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
                if let Some(window) = app_handle.get_webview_window("main") {
                    let visible = window.is_visible().unwrap_or(true);
                    if visible {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.unminimize();
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

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
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
            restore_wallpaper_if_enabled(&restore_store);
            build_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fetch_video,
            fetch_videos_list,
            apply_wallpaper,
            stop_wallpaper,
            get_wallpaper_status,
            list_sources,
            cleanup_cache,
            toggle_favorite,
            get_app_state,
            add_to_queue,
            remove_from_queue,
            clear_queue,
            set_rotation,
            advance_rotation,
            set_restore_on_launch,
            set_window_behavior,
            set_auto_pause,
            set_wallpaper_paused,
            set_wallpaper_volume,
            set_wallpaper_filter,
            set_wallpaper_scale,
            import_local_video,
            remove_imported_video,
            remove_recent_video,
            fetch_youtube_meta,
            download_youtube_clip,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
