use crate::wallpaper::providers::{self, SearchConfig, VideoResult};
use crate::wallpaper::state::AppStateStore;
use tauri::{Emitter, State, Window};

fn hex_to_color_name(hex: &str) -> Option<&'static str> {
    match hex {
        "cc3333" => Some("red"),
        "ea4c88" => Some("pink"),
        "993399" => Some("purple"),
        "0066cc" => Some("blue"),
        "0099cc" => Some("light blue"),
        "66cccc" => Some("teal"),
        "669900" => Some("green"),
        "77cc33" => Some("lime"),
        "ffff00" => Some("yellow"),
        "ffcc33" => Some("gold"),
        "ff9900" => Some("orange"),
        "ff6600" => Some("dark orange"),
        "663300" => Some("brown"),
        "000000" => Some("black"),
        "424153" => Some("dark gray"),
        "999999" => Some("gray"),
        "cccccc" => Some("light gray"),
        "ffffff" => Some("white"),
        _ => None,
    }
}

fn clean_search_query(q: &str) -> String {
    let trimmed = q.trim();
    if trimmed.is_empty()
        || trimmed.to_lowercase() == "all"
        || trimmed.to_lowercase() == "wallpaper"
        || trimmed.to_lowercase() == "wallpapers"
    {
        return trimmed.to_string();
    }

    let mut cleaned = trimmed.to_lowercase();
    if cleaned.ends_with(" wallpapers") {
        cleaned = cleaned
            .strip_suffix(" wallpapers")
            .unwrap_or(&cleaned)
            .to_string();
    } else if cleaned.ends_with(" wallpaper") {
        cleaned = cleaned
            .strip_suffix(" wallpaper")
            .unwrap_or(&cleaned)
            .to_string();
    } else if cleaned.ends_with(" walls") {
        cleaned = cleaned
            .strip_suffix(" walls")
            .unwrap_or(&cleaned)
            .to_string();
    } else if cleaned.ends_with(" wall") {
        cleaned = cleaned
            .strip_suffix(" wall")
            .unwrap_or(&cleaned)
            .to_string();
    }

    cleaned.trim().to_string()
}

#[tauri::command]
pub async fn fetch_video(
    state: State<'_, AppStateStore>,
    source: String,
    query: String,
    order: String,
    categories: Option<String>,
    purity: Option<String>,
) -> Result<VideoResult, String> {
    let app_state = state.snapshot();
    let api_key = Some(app_state.wallhaven_api_key);
    let disabled = app_state.disabled_sources;

    if disabled.contains(&source) {
        return Err(format!(
            "The wallpaper source '{}' has been disabled in settings.",
            source
        ));
    }

    let cleaned_query = clean_search_query(&query);

    // For unified source, pick a random SFW provider and fetch from it
    if source == "unified" || source == "all" {
        let mut sfw_providers = vec![
            "motionbgs",
            "alphacoders",
            "wallhaven",
            "pinterest",
            "wallpaperwaves",
        ];
        sfw_providers.retain(|p| !disabled.contains(&p.to_string()));

        if sfw_providers.is_empty() {
            return Err(
                "All unified live wallpaper sources have been disabled in settings.".to_string(),
            );
        }

        let chosen = {
            use rand::seq::SliceRandom;
            let mut rng = rand::thread_rng();
            *sfw_providers.choose(&mut rng).unwrap_or(&"motionbgs")
        };
        let provider = providers::get_provider(chosen)?;
        let config = SearchConfig {
            query: cleaned_query,
            order,
            count: 40,
            page: 1,
            api_key,
            resolutions: None,
            ratios: None,
            colors: None,
            categories: categories.clone(),
            purity: purity.clone(),
        };
        return provider.fetch_video(&config).await;
    }
    let provider = providers::get_provider(&source)?;
    let config = SearchConfig {
        query: cleaned_query,
        order,
        count: 40,
        page: 0,
        api_key,
        resolutions: None,
        ratios: None,
        colors: None,
        categories,
        purity,
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
    resolutions: Option<String>,
    ratios: Option<String>,
    colors: Option<String>,
    categories: Option<String>,
    purity: Option<String>,
) -> Result<Vec<VideoResult>, String> {
    let app_state = state.snapshot();
    let api_key = Some(app_state.wallhaven_api_key);
    let disabled = app_state.disabled_sources;

    log::info!(
        "[fetch_videos_list] source={}, query={}, res={:?}, rat={:?}, col={:?}",
        source,
        query,
        resolutions,
        ratios,
        colors
    );

    if disabled.contains(&source) {
        return Err(format!(
            "The wallpaper source '{}' has been disabled in settings.",
            source
        ));
    }

    let cleaned_query = clean_search_query(&query);

    if source == "all" || source == "unified" {
        // Fan out to all SFW providers concurrently and merge results
        let mut providers_list = vec![
            "motionbgs",
            "alphacoders",
            "wallhaven",
            "pinterest",
            "wallpaperwaves",
        ];
        providers_list.retain(|p| !disabled.contains(&p.to_string()));

        if providers_list.is_empty() {
            return Ok(Vec::new());
        }

        let mut fetch_page = page;
        if fetch_page <= 1
            && (cleaned_query.is_empty() || cleaned_query == "all" || cleaned_query == "wallpaper")
        {
            use rand::Rng;
            fetch_page = rand::thread_rng().gen_range(1..=15);
        }

        let config = SearchConfig {
            query: cleaned_query.clone(),
            order: order.clone(),
            count: 20, // Fetch fewer per provider to keep weight low
            page: fetch_page,
            api_key: api_key.clone(),
            resolutions: resolutions.clone(),
            ratios: ratios.clone(),
            colors: colors.clone(),
            categories: categories.clone(),
            purity: purity.clone(),
        };

        let mut all_results = Vec::new();

        // Concurrent fetching for better performance
        let mut tasks = Vec::new();
        for p_name in providers_list {
            let mut config_clone = config.clone();
            if p_name != "wallhaven" {
                if let Some(ref hex) = config.colors {
                    if let Some(name) = hex_to_color_name(hex) {
                        if config_clone.query.is_empty()
                            || config_clone.query == "all"
                            || config_clone.query == "wallpaper"
                        {
                            config_clone.query = name.to_string();
                        } else {
                            config_clone.query = format!("{} {}", config_clone.query, name);
                        }
                    }
                }
            }

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

        // Apply post-fetch filters to the unified results
        providers::apply_post_fetch_filters(&mut all_results, &config);

        // Sort by ID or shuffle? Shuffling makes it feel more "unified"
        use rand::seq::SliceRandom;
        let mut rng = rand::thread_rng();
        all_results.shuffle(&mut rng);

        return Ok(all_results);
    }

    let provider = providers::get_provider(&source)?;

    let mut fetch_page = page;
    if fetch_page <= 1
        && (cleaned_query.is_empty() || cleaned_query == "all" || cleaned_query == "wallpaper")
    {
        use rand::Rng;
        fetch_page = rand::thread_rng().gen_range(1..=15);
    }

    let mut config = SearchConfig {
        query: cleaned_query,
        order,
        count: 40,
        page: fetch_page,
        api_key,
        resolutions,
        ratios,
        colors,
        categories,
        purity,
    };

    if source != "wallhaven" {
        if let Some(ref hex) = config.colors {
            if let Some(name) = hex_to_color_name(hex) {
                if config.query.is_empty() || config.query == "all" || config.query == "wallpaper" {
                    config.query = name.to_string();
                } else {
                    config.query = format!("{} {}", config.query, name);
                }
            }
        }
    }

    let mut results = provider.fetch_videos_list(&config).await?;

    // Apply post-fetch filters for all providers
    providers::apply_post_fetch_filters(&mut results, &config);

    // Shuffle the results to guarantee freshness even on specific searches
    use rand::seq::SliceRandom;
    let mut rng = rand::thread_rng();
    results.shuffle(&mut rng);

    Ok(results)
}

/// Fetches tags for a specific video ID using the provider's implementation.
#[tauri::command]
pub async fn fetch_video_tags(source: String, id: String) -> Result<Vec<String>, String> {
    if source == "local" || source == "imported" {
        return Ok(Vec::new());
    }
    let provider = crate::wallpaper::providers::get_provider(&source)?;
    provider.fetch_tags(&id).await
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
        tags: None,
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
        crate::wallpaper::providers::youtube::download_clip(
            &dl_url,
            &dl_id,
            start_time,
            end_time,
            max_height,
            Some(&window),
        )
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
        tags: None,
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
    use base64::{engine::general_purpose, Engine as _};

    let path = std::path::PathBuf::from(&local_path);
    let id = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown");

    let base_dir = crate::wallpaper::desktop::app_data_dir().join("thumbnails");
    let _ = std::fs::create_dir_all(&base_dir);
    let thumb_path = base_dir.join(format!("{}.jpg", id));

    let clean_base64 = if let Some(pos) = base64_data.find(",") {
        &base64_data[pos + 1..]
    } else {
        &base64_data
    };

    let bytes = general_purpose::STANDARD
        .decode(clean_base64)
        .map_err(|e| e.to_string())?;
    std::fs::write(&thumb_path, bytes).map_err(|e| e.to_string())?;

    crate::wallpaper::state::set_thumbnail(
        &state,
        local_path,
        thumb_path.to_string_lossy().to_string(),
    )
}

#[tauri::command]
pub fn check_ytdlp_installed() -> bool {
    crate::wallpaper::providers::youtube::find_ytdlp().is_ok()
}

#[tauri::command]
pub async fn install_ytdlp(window: Window) -> Result<(), String> {
    use std::fs::File;
    use std::io::{Read, Write};

    // 1. Get destination path
    let bin_dir = crate::wallpaper::desktop::app_data_dir().join("bin");
    std::fs::create_dir_all(&bin_dir)
        .map_err(|e| format!("Failed to create bin directory: {}", e))?;
    let dest_path = bin_dir.join("yt-dlp.exe");

    // 2. Perform download in blocking task so we don't block the async executor thread
    tokio::task::spawn_blocking(move || {
        let client = reqwest::blocking::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
            .build()
            .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

        let url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
        let mut response = client
            .get(url)
            .send()
            .map_err(|e| format!("Failed to send request: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Server returned status: {}", response.status()));
        }

        let total_size = response.content_length().unwrap_or(0);
        let mut file = File::create(&dest_path)
            .map_err(|e| format!("Failed to create executable file: {}", e))?;

        let mut buffer = [0; 16384];
        let mut downloaded: u64 = 0;

        loop {
            let bytes_read = response
                .read(&mut buffer)
                .map_err(|e| format!("Error reading download stream: {}", e))?;

            if bytes_read == 0 {
                break;
            }

            file.write_all(&buffer[..bytes_read])
                .map_err(|e| format!("Failed to write to file: {}", e))?;

            downloaded += bytes_read as u64;

            if total_size > 0 {
                let progress = (downloaded as f64 / total_size as f64 * 100.0) as u32;
                let _ = window.emit("ytdlp-install-progress", progress);
            }
        }

        file.flush()
            .map_err(|e| format!("Failed to flush file: {}", e))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub fn check_ffmpeg_installed() -> bool {
    crate::wallpaper::providers::youtube::find_ffmpeg().is_some()
}

#[tauri::command]
pub async fn install_ffmpeg() -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new("powershell");
        cmd.args(&[
            "-NoProfile",
            "-Command",
            "Start-Process powershell -ArgumentList '-NoExit -NoProfile -Command winget install Gyan.FFmpeg --accept-package-agreements --accept-source-agreements' -Verb RunAs -Wait"
        ]);
        cmd.creation_flags(0x08000000);

        let status = cmd
            .status()
            .map_err(|e| format!("Failed to spawn winget process: {}", e))?;
        if status.success() {
            Ok(())
        } else {
            Err("Winget exited with an error code or was cancelled. Please try 'winget install Gyan.FFmpeg' manually in a terminal.".to_string())
        }
    }
    #[cfg(not(windows))]
    {
        Err("Auto-install is only supported on Windows.".to_string())
    }
}

#[tauri::command]
pub async fn fetch_wallhaven_collections(username: String) -> Result<String, String> {
    let url = format!("https://wallhaven.cc/api/v1/collections/{}", username);
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("Wallhaven returned status {}", resp.status()));
    }
    resp.text()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))
}
