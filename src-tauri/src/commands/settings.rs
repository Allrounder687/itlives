use tauri::{State, Manager};
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

#[tauri::command]
pub fn set_theme(
    state: State<'_, AppStateStore>,
    theme: String,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_theme(&state, theme)
}

#[tauri::command]
pub fn check_dependencies() -> Vec<String> {
    let mut missing = Vec::new();
    if wallpaper::desktop::find_mpv().is_none() {
        missing.push("mpv".to_string());
    }
    missing
}

#[tauri::command]
pub async fn install_mpv() -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new("powershell");
        // We use powershell to run winget so we can capture output or handle it better if needed, 
        // but mostly to ensure we can run it minimized/hidden.
        cmd.args(&["-NoProfile", "-Command", "winget install shinchiro.mpv --accept-package-agreements --accept-source-agreements"]);
        cmd.creation_flags(0x08000000);

        let status = cmd.status().map_err(|e| format!("Failed to spawn winget process: {}", e))?;
        if status.success() {
            Ok(())
        } else {
            Err("Winget exited with an error code. Please try 'winget install shinchiro.mpv' manually in a terminal.".to_string())
        }
    }
    #[cfg(not(windows))]
    {
        Err("Auto-install is only supported on Windows.".to_string())
    }
}

#[tauri::command]
pub fn set_wallhaven_api_key(
    state: State<'_, AppStateStore>,
    key: String,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_wallhaven_api_key(&state, key)
}

#[tauri::command]
pub fn set_disabled_sources(
    state: State<'_, AppStateStore>,
    disabled: Vec<String>,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_disabled_sources(&state, disabled)
}

#[tauri::command]
pub fn set_pinterest_urls(
    state: State<'_, AppStateStore>,
    urls: Vec<String>,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_pinterest_urls(&state, urls)
}
#[tauri::command]
pub fn set_adult_pin(
    state: State<'_, AppStateStore>,
    pin: Option<String>,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_adult_pin(&state, pin)
}

#[tauri::command]
pub fn verify_adult_pin(
    state: State<'_, AppStateStore>,
    pin: String,
) -> bool {
    wallpaper::state::verify_adult_pin(&state, pin)
}

#[tauri::command]
pub fn toggle_hide_video(
    state: State<'_, AppStateStore>,
    video_id: String,
) -> Result<WallpaperState, String> {
    wallpaper::state::toggle_hide_video(&state, video_id)
}

#[derive(serde::Serialize)]
pub struct DisplayMonitor {
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub scale_factor: f64,
    pub is_primary: bool,
}

#[tauri::command]
pub fn get_monitors(app_handle: tauri::AppHandle) -> Result<Vec<DisplayMonitor>, String> {
    let mut result = Vec::new();
    
    let monitors = app_handle.available_monitors().map_err(|e| e.to_string())?;
    let primary = app_handle.primary_monitor().ok().flatten();
    
    for m in monitors {
        let name = m.name().unwrap_or(&"Unknown Display".to_string()).to_string();
        let size = m.size();
        let pos = m.position();
        let scale = m.scale_factor();
        let is_primary = if let Some(ref p) = primary {
            p.name() == m.name()
        } else {
            false
        };
        
        result.push(DisplayMonitor {
            name,
            width: size.width,
            height: size.height,
            x: pos.x,
            y: pos.y,
            scale_factor: scale,
            is_primary,
        });
    }
    
    Ok(result)
}
