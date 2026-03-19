use tauri::State;
use crate::wallpaper::providers::VideoResult;
use crate::wallpaper::state::{AppStateStore, WallpaperState};
use crate::wallpaper;

#[tauri::command]
pub async fn apply_wallpaper(
    state: State<'_, AppStateStore>,
    mut video: VideoResult,
    scale_percent: u64,
    start_time: Option<f64>,
    end_time: Option<f64>,
) -> Result<WallpaperState, String> {
    if video.local_path.is_empty() {
        log::info!("[Core] Download on apply triggered for source: {}", video.source);
        let provider = crate::wallpaper::providers::get_provider(&video.source)?;
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
        false, 
        start_time,
        end_time,
    )?;
    wallpaper::state::mark_active(&state, video)
}

#[tauri::command]
pub fn stop_wallpaper(state: State<'_, AppStateStore>) -> Result<WallpaperState, String> {
    wallpaper::desktop::stop_video()?;
    wallpaper::state::clear_active(&state)
}

#[tauri::command]
pub fn get_wallpaper_status() -> Option<String> {
    wallpaper::desktop::get_current()
}

#[tauri::command]
pub fn set_wallpaper_paused(
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
pub fn set_wallpaper_volume(
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
pub fn set_wallpaper_filter(
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
                None,
                None,
            )?;
        }
    }
    Ok(persisted)
}

#[tauri::command]
pub fn set_wallpaper_scale(
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
                None,
                None,
            )?;
        }
    }
    Ok(persisted)
}

#[tauri::command]
pub fn toggle_favorite(
    state: State<'_, AppStateStore>,
    video: VideoResult,
) -> Result<WallpaperState, String> {
    wallpaper::state::toggle_favorite(&state, video)
}
