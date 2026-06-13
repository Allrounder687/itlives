use crate::wallpaper;
use crate::wallpaper::providers::VideoResult;
use crate::wallpaper::state::{AppStateStore, WallpaperState};
use tauri::State;

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
pub fn reorder_queue(
    state: State<'_, AppStateStore>,
    from_index: usize,
    to_index: usize,
) -> Result<WallpaperState, String> {
    wallpaper::state::reorder_queue(&state, from_index, to_index)
}

#[tauri::command]
pub fn import_folder_to_queue(
    state: State<'_, AppStateStore>,
    folder_path: String,
) -> Result<WallpaperState, String> {
    use std::fs;
    let mut videos = Vec::new();

    fn is_supported_media(path: &str) -> bool {
        let path_lower = path.to_lowercase();
        path_lower.ends_with(".mp4")
            || path_lower.ends_with(".webm")
            || path_lower.ends_with(".mkv")
            || path_lower.ends_with(".avi")
            || path_lower.ends_with(".mov")
            || path_lower.ends_with(".jpg")
            || path_lower.ends_with(".jpeg")
            || path_lower.ends_with(".png")
            || path_lower.ends_with(".webp")
            || path_lower.ends_with(".bmp")
            || path_lower.ends_with(".gif")
    }

    if let Ok(entries) = fs::read_dir(&folder_path) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_file() {
                    let path_str = entry.path().to_string_lossy().into_owned();
                    if is_supported_media(&path_str) {
                        let id = entry
                            .path()
                            .file_stem()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .into_owned();
                        videos.push(VideoResult {
                            id,
                            video_url: String::new(),
                            thumbnail_url: String::new(),
                            local_path: path_str,
                            duration: 0.0,
                            width: 0,
                            height: 0,
                            source: "local".to_string(),
                            start_time: None,
                            end_time: None,
                            tags: None,
                        });
                    }
                }
            }
        }
    }

    if videos.is_empty() {
        return Err("No supported media files found in folder".to_string());
    }

    wallpaper::state::add_multiple_to_queue(&state, videos)
}
