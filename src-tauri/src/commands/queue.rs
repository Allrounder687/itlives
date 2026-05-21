use tauri::State;
use crate::wallpaper::providers::VideoResult;
use crate::wallpaper::state::{AppStateStore, WallpaperState, QueueAdvanceResult};
use crate::wallpaper;

#[tauri::command]
pub fn add_to_queue(
    state: State<'_, AppStateStore>,
    video: VideoResult,
) -> Result<WallpaperState, String> {
    wallpaper::state::add_to_queue(&state, video)
}

#[tauri::command]
pub fn remove_from_queue(
    state: State<'_, AppStateStore>,
    video: VideoResult,
) -> Result<WallpaperState, String> {
    wallpaper::state::remove_from_queue(&state, video)
}

#[tauri::command]
pub fn clear_queue(state: State<'_, AppStateStore>) -> Result<WallpaperState, String> {
    wallpaper::state::clear_queue(&state)
}

#[tauri::command]
pub fn set_rotation(
    state: State<'_, AppStateStore>,
    enabled: bool,
    interval_seconds: u64,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_rotation(&state, enabled, interval_seconds)
}

#[tauri::command]
pub fn advance_rotation(
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
        current.playback_speed,
        current.blur_strength,
        false, 
        None,
        None,
    )?;
    let persisted = wallpaper::state::mark_active(&state, advanced.video.clone())?;
    Ok(QueueAdvanceResult {
        video: advanced.video,
        state: persisted,
    })
}

#[tauri::command]
pub fn reorder_queue(
    state: State<'_, AppStateStore>,
    from_index: usize,
    to_index: usize,
) -> Result<WallpaperState, String> {
    wallpaper::state::reorder_queue(&state, from_index, to_index)
}
