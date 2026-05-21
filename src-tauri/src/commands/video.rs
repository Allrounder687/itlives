use tauri::{State, Window};
use crate::wallpaper::providers::{self, SearchConfig, VideoResult};
use crate::wallpaper::state::AppStateStore;

#[tauri::command]
pub async fn fetch_video(
    state: State<'_, AppStateStore>,
    source: String,
    query: String,
    order: String,
) -> Result<VideoResult, String> {
    let app_state = state.snapshot();
    let api_key = Some(app_state.wallhaven_api_key);
    let disabled = app_state.disabled_sources;

    if disabled.contains(&source) {
        return Err(format!("The wallpaper source '{}' has been disabled in settings.", source));
    }

    // For unified source, pick a random SFW provider and fetch from it
    if source == "unified" || source == "all" {
        let mut sfw_providers = vec!["motionbgs", "alphacoders"];
        sfw_providers.retain(|p| !disabled.contains(&p.to_string()));

        if sfw_providers.is_empty() {
            return Err("All unified live wallpaper sources have been disabled in settings.".to_string());
        }

        let chosen = {
            use rand::seq::SliceRandom;
            let mut rng = rand::thread_rng();
            *sfw_providers.choose(&mut rng).unwrap_or(&"motionbgs")
        };
        let provider = providers::get_provider(chosen)?;
        let config = SearchConfig { query, order, count: 40, page: 1, api_key };
        return provider.fetch_video(&config).await;
    }
    let provider = providers::get_provider(&source)?;
    let config = SearchConfig {
        query,
        order,
        count: 40,
        page: 0,
        api_key,
    };
    provider.fetch_video(&config).await
}

#[tauri::command]
pub async fn fetch_videos_list(
    state: State<'_, AppStateStore>,
    source: String,
    query: String,
    order: String,
    page: u32,
) -> Result<Vec<VideoResult>, String> {
    let app_state = state.snapshot();
    let api_key = Some(app_state.wallhaven_api_key);
    let disabled = app_state.disabled_sources;

    if disabled.contains(&source) {
        return Err(format!("The wallpaper source '{}' has been disabled in settings.", source));
    }

    if source == "all" || source == "unified" {
        // Fan out to all SFW providers concurrently and merge results
        let mut providers_list = vec!["motionbgs", "alphacoders"];
        providers_list.retain(|p| !disabled.contains(&p.to_string()));

        if providers_list.is_empty() {
            return Ok(Vec::new());
        }

        let config = SearchConfig {
            query,
            order,
            count: 20, // Fetch fewer per provider to keep weight low
            page,
            api_key: api_key.clone(),
        };

        let mut all_results = Vec::new();
        
        // Concurrent fetching for better performance
        let mut tasks = Vec::new();
        for p_name in providers_list {
            let config_clone = config.clone();
            tasks.push(tokio::spawn(async move {
                if let Ok(p) = providers::get_provider(p_name) {
                    p.fetch_videos_list(&config_clone).await.unwrap_or_default()
                } else {
                    Vec::new()
                }
            }));
        }

        for task in tasks {
            if let Ok(res) = task.await {
                all_results.extend(res);
            }
        }
        
        // Sort by ID or shuffle? Shuffling makes it feel more "unified"
        use rand::seq::SliceRandom;
        let mut rng = rand::thread_rng();
        all_results.shuffle(&mut rng);
        
        return Ok(all_results);
    }

    let provider = providers::get_provider(&source)?;
    let config = SearchConfig {
        query,
        order,
        count: 40,
        page,
        api_key,
    };
    provider.fetch_videos_list(&config).await
}

/// Fetches YouTube video metadata (title, duration, thumbnail) without downloading.
#[tauri::command]
pub async fn fetch_youtube_meta(url: String) -> Result<VideoResult, String> {
    let meta = tokio::task::spawn_blocking(move || {
        crate::wallpaper::providers::youtube::fetch_metadata(&url)
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
pub async fn download_youtube_clip(
    state: State<'_, AppStateStore>,
    url: String,
    start_time: f64,
    end_time: f64,
    max_height: u32,
    window: Window,
) -> Result<VideoResult, String> {
    // Fetch metadata first for title/thumbnail info
    let meta_url = url.clone();
    let meta = tokio::task::spawn_blocking(move || {
        crate::wallpaper::providers::youtube::fetch_metadata(&meta_url)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    let dl_url = url.clone();
    let dl_id = meta.id.clone();
    let local_path = tokio::task::spawn_blocking(move || {
        crate::wallpaper::providers::youtube::download_clip(&dl_url, &dl_id, start_time, end_time, max_height, Some(&window))
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
    let _ = crate::wallpaper::state::import_local_video(&state, video.clone());

    Ok(video)
}

#[tauri::command]
pub async fn save_thumbnail(
    state: State<'_, AppStateStore>,
    local_path: String,
    base64_data: String,
) -> Result<crate::wallpaper::state::WallpaperState, String> {
    use base64::{Engine as _, engine::general_purpose};
    
    let path = std::path::PathBuf::from(&local_path);
    let id = path.file_stem().and_then(|s| s.to_str()).unwrap_or("unknown");
    
    let base_dir = crate::wallpaper::desktop::app_data_dir().join("thumbnails");
    let _ = std::fs::create_dir_all(&base_dir);
    let thumb_path = base_dir.join(format!("{}.jpg", id));
    
    let clean_base64 = if let Some(pos) = base64_data.find(",") {
        &base64_data[pos+1..]
    } else {
        &base64_data
    };

    let bytes = general_purpose::STANDARD.decode(clean_base64).map_err(|e| e.to_string())?;
    std::fs::write(&thumb_path, bytes).map_err(|e| e.to_string())?;

    crate::wallpaper::state::set_thumbnail(&state, local_path, thumb_path.to_string_lossy().to_string())
}
