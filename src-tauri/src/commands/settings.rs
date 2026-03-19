use tauri::State;
use crate::wallpaper::providers::{self, VideoResult};
use crate::wallpaper::state::{AppStateStore, WallpaperState};
use crate::wallpaper;

#[tauri::command]
pub fn list_sources() -> Vec<String> {
    providers::list_providers()
}

#[tauri::command]
pub fn cleanup_cache(keep: usize) -> Result<usize, String> {
    wallpaper::desktop::cleanup_cache(keep)
}

#[tauri::command]
pub fn get_app_state(state: State<'_, AppStateStore>) -> WallpaperState {
    wallpaper::state::get(&state)
}

#[tauri::command]
pub fn set_restore_on_launch(
    state: State<'_, AppStateStore>,
    enabled: bool,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_restore_on_launch(&state, enabled)
}

#[tauri::command]
pub fn set_window_behavior(
    state: State<'_, AppStateStore>,
    close_to_tray: bool,
    minimize_to_tray: bool,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_window_behavior(&state, close_to_tray, minimize_to_tray)
}

#[tauri::command]
pub fn set_auto_pause(
    state: State<'_, AppStateStore>,
    enabled: bool,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_auto_pause(&state, enabled)
}

#[tauri::command]
pub fn import_local_video(
    state: State<'_, AppStateStore>,
    video: VideoResult,
) -> Result<WallpaperState, String> {
    wallpaper::state::import_local_video(&state, video)
}

#[tauri::command]
pub fn remove_imported_video(
    state: State<'_, AppStateStore>,
    video: VideoResult,
) -> Result<WallpaperState, String> {
    wallpaper::state::remove_imported_video(&state, video)
}

#[tauri::command]
pub fn remove_recent_video(
    state: State<'_, AppStateStore>,
    video: VideoResult,
) -> Result<WallpaperState, String> {
    wallpaper::state::remove_recent_video(&state, video)
}
