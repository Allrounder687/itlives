//! Video provider plugin system.
//! Any video source (RedGIFs, TikTok, YouTube, direct URL, local file)
//! implements the `VideoProvider` trait to become a wallpaper source.

pub mod alphacoders;
pub mod direct_url;
pub mod motionbgs;
pub mod pinterest;
pub mod wallhaven;
pub mod wallpaperwaves;
pub mod youtube;

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Universal result returned by any video provider.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoResult {
    pub id: String,
    pub video_url: String,
    pub thumbnail_url: String,
    pub local_path: String,
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub source: String,
    pub start_time: Option<f64>,
    pub end_time: Option<f64>,
    pub tags: Option<Vec<String>>,
}

/// Configuration for a provider search request.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchConfig {
    pub query: String,
    pub order: String,
    pub count: u32,
    pub page: u32,
    pub api_key: Option<String>,
    pub resolutions: Option<String>,
    pub ratios: Option<String>,
    pub colors: Option<String>,
    pub categories: Option<String>,
    pub purity: Option<String>,
}

impl Default for SearchConfig {
    fn default() -> Self {
        Self {
            query: String::new(),
            order: "trending".to_string(),
            count: 40,
            page: 1,
            api_key: None,
            resolutions: None,
            ratios: None,
            colors: None,
            categories: Some("111".to_string()),
            purity: Some("100".to_string()),
        }
    }
}

/// Trait that all video providers must implement.
/// Adding a new source = implement this trait + register in `get_provider()`.
#[async_trait::async_trait]
pub trait VideoProvider: Send + Sync {
    /// Human-readable name of the source (e.g. "RedGIFs", "Direct URL").
    fn name(&self) -> &str;

    /// Fetch a random video from this source given a search config.
    async fn fetch_video(&self, config: &SearchConfig) -> Result<VideoResult, String>;

    /// Fetch a list of videos from this source given a search config.
    async fn fetch_videos_list(&self, config: &SearchConfig) -> Result<Vec<VideoResult>, String>;

    /// Downloads the given video to cache and returns local path string.
    async fn download_video(
        &self,
        video: &VideoResult,
        app_handle: Option<tauri::AppHandle>,
    ) -> Result<String, String>;

    /// Fetches tags for a specific video ID. Default returns empty.
    async fn fetch_tags(&self, _id: &str) -> Result<Vec<String>, String> {
        Ok(Vec::new())
    }
}

#[derive(Clone, serde::Serialize)]
pub struct DownloadProgress {
    pub id: String,
    pub progress: u64,
    pub total: u64,
}

pub async fn download_to_cache(
    video_url: &str,
    video_id: &str,
    source: &str,
    cache_dir: &PathBuf,
    extra_headers: Option<Vec<(String, String)>>,
    app_handle: Option<tauri::AppHandle>,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(300))
        .no_brotli()
        .no_gzip()
        .no_deflate()
        .build()
        .map_err(|e| format!("Failed to build reqwest client: {}", e))?;
    let ext = if video_url.contains(".png") {
        "png"
    } else if video_url.contains(".webp") {
        "webp"
    } else if video_url.contains(".jpeg") {
        "jpeg"
    } else if video_url.contains(".gif") {
        "gif"
    } else if video_url.contains(".mp4") {
        "mp4"
    } else if video_url.contains(".webm") {
        "webm"
    } else if video_url.contains(".mov") {
        "mov"
    } else if video_url.contains(".m3u8") {
        "m3u8"
    } else {
        "jpg"
    };
    let dest = cache_dir.join(format!("{}_{}.{}", source, video_id, ext));

    if dest.exists() {
        return Ok(dest.to_string_lossy().to_string());
    }

    std::fs::create_dir_all(cache_dir).map_err(|e| e.to_string())?;

    let mut attempt = 0;
    let max_attempts = 3;
    let bytes = loop {
        attempt += 1;

        let mut req = client.get(video_url)
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .header("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8")
            .header("Accept-Language", "en-US,en;q=0.9");

        if let Some(ref headers) = extra_headers {
            for (key, value) in headers {
                req = req.header(key, value);
            }
        }

        let resp_result = req.send().await;

        match resp_result {
            Ok(mut resp) => {
                let status = resp.status();
                if !status.is_success() {
                    if attempt >= max_attempts {
                        return Err(format!(
                            "Download of {} failed with HTTP status: {}",
                            video_url, status
                        ));
                    }
                    tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
                    continue;
                }

                let total_size = resp.content_length().unwrap_or(0);
                let mut downloaded: u64 = 0;
                let mut bytes_data = Vec::new();
                let mut failed = false;

                let mut last_emit = std::time::Instant::now();

                // Instead of StreamExt, we use the built-in chunk() method
                while let Some(chunk_res) = resp.chunk().await.transpose() {
                    match chunk_res {
                        Ok(chunk) => {
                            downloaded += chunk.len() as u64;
                            bytes_data.extend_from_slice(&chunk);
                            if let Some(app) = &app_handle {
                                let now = std::time::Instant::now();
                                // Emit at most once per 100ms, or if we hit exactly total_size to ensure 100% is emitted
                                if now.duration_since(last_emit).as_millis() > 100 || (total_size > 0 && downloaded >= total_size) {
                                    use tauri::Emitter;
                                    let _ = app.emit(
                                        "download-progress",
                                        DownloadProgress {
                                            id: video_id.to_string(),
                                            progress: downloaded,
                                            total: total_size,
                                        },
                                    );
                                    last_emit = now;
                                }
                            }
                            
                            // Break early if we've downloaded all bytes (prevents hanging on keep-alive connections)
                            if total_size > 0 && downloaded >= total_size {
                                break;
                            }
                        }
                        Err(e) => {
                            failed = true;
                            if attempt >= max_attempts {
                                return Err(format!(
                                    "Download read failed after {} attempts: {}",
                                    max_attempts, e
                                ));
                            }
                            log::warn!(
                                "Download read failed (attempt {}): {}. Retrying...",
                                attempt,
                                e
                            );
                            tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
                            break;
                        }
                    }
                }

                if !failed {
                    break bytes_data;
                }
            }
            Err(e) => {
                if attempt >= max_attempts {
                    return Err(format!(
                        "Download failed after {} attempts: {}",
                        max_attempts, e
                    ));
                }
                log::warn!(
                    "Download request failed (attempt {}): {}. Retrying...",
                    attempt,
                    e
                );
                tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
            }
        }
    };

    std::fs::write(&dest, &bytes).map_err(|e| format!("File write failed: {}", e))?;

    log::info!(
        "[{}] Downloaded: {} ({} bytes)",
        source,
        video_id,
        bytes.len()
    );
    Ok(dest.to_string_lossy().to_string())
}

/// Registry: returns the provider for a given source name.
pub fn get_provider(source: &str) -> Result<Box<dyn VideoProvider>, String> {
    match source.to_lowercase().as_str() {
        "motionbgs" => Ok(Box::new(motionbgs::MotionBgsProvider)),
        "alphacoders" => Ok(Box::new(alphacoders::AlphaCodersProvider)),
        "youtube" | "yt" => Ok(Box::new(youtube::YouTubeProvider)),
        "direct" | "url" => Ok(Box::new(direct_url::DirectUrlProvider)),
        "wallhaven" => Ok(Box::new(wallhaven::WallhavenProvider)),
        "pinterest" => Ok(Box::new(pinterest::PinterestProvider)),
        "wallpaperwaves" => Ok(Box::new(wallpaperwaves::WallpaperWavesProvider)),
        _ => Err(format!(
            "Unknown video source: '{}'. Available: motionbgs, alphacoders, youtube, direct, wallhaven, pinterest, wallpaperwaves",
            source
        )),
    }
}

/// Lists all available provider names.
pub fn list_providers() -> Vec<String> {
    vec![
        "motionbgs".to_string(),
        "alphacoders".to_string(),
        "youtube".to_string(),
        "direct".to_string(),
        "wallhaven".to_string(),
        "pinterest".to_string(),
        "wallpaperwaves".to_string(),
    ]
}

pub fn apply_post_fetch_filters(results: &mut Vec<VideoResult>, config: &SearchConfig) {
    results.retain(|item| {
        // Apply Resolution filter
        if let Some(ref res) = config.resolutions {
            let res = res.trim();
            if res.starts_with(">=") {
                let parts: Vec<&str> = res[2..].split('x').collect();
                if parts.len() == 2 {
                    if let (Ok(w), Ok(h)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
                        if item.width < w || item.height < h {
                            return false;
                        }
                    }
                }
            } else {
                let parts: Vec<&str> = res.split('x').collect();
                if parts.len() == 2 {
                    if let (Ok(w), Ok(h)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
                        if item.width != w || item.height != h {
                            return false;
                        }
                    }
                }
            }
        }

        // Apply Ratio filter
        if let Some(ref ratio) = config.ratios {
            let ratio = ratio.trim();
            let parts: Vec<&str> = ratio.split('x').collect();
            if parts.len() == 2 {
                if let (Ok(rw), Ok(rh)) = (parts[0].parse::<f32>(), parts[1].parse::<f32>()) {
                    let target_ratio = rw / rh;
                    let item_ratio = item.width as f32 / item.height as f32;
                    if (item_ratio - target_ratio).abs() > 0.05 {
                        return false;
                    }
                }
            }
        }

        // Apply fallback Purity filter
        if let Some(ref purity) = config.purity {
            // purity bits: [0] SFW, [1] Sketchy, [2] NSFW (from left, 100 is SFW)
            let chars: Vec<char> = purity.chars().collect();
            if chars.len() >= 3 {
                let _allow_sfw = chars[0] == '1';
                let allow_sketchy = chars[1] == '1';
                let allow_nsfw = chars[2] == '1';

                if let Some(ref tags) = item.tags {
                    for tag in tags {
                        let t = tag.to_lowercase();
                        
                        // NSFW check
                        if !allow_nsfw {
                            if t.contains("nsfw") || t.contains("nude") || t.contains("18+") || t.contains("hentai") || t.contains("porn") || t.contains("naked") || t == "sex" || t.contains("xxx") {
                                return false;
                            }
                        }
                        
                        // Sketchy check
                        if !allow_sketchy {
                            if t.contains("sketchy") || t.contains("bikini") || t.contains("swimsuit") || t.contains("lingerie") || t.contains("underwear") || t.contains("cleavage") || t.contains("boobs") || t.contains("sexy") || t.contains("semi-nude") || t.contains("ass") || t.contains("butt") || t.contains("breasts") || t.contains("ecchi") || t.contains("lewd") {
                                return false;
                            }
                        }
                    }
                }
            }
        }

        // Apply fallback Categories filter
        if let Some(ref categories) = config.categories {
            // categories bits: [0] General, [1] Anime, [2] People (100, 010, 001)
            let chars: Vec<char> = categories.chars().collect();
            if chars.len() >= 3 {
                let allow_general = chars[0] == '1';
                let allow_anime = chars[1] == '1';
                let allow_people = chars[2] == '1';

                if !allow_anime {
                    if let Some(ref tags) = item.tags {
                        for tag in tags {
                            let t = tag.to_lowercase();
                            if t.contains("anime") || t.contains("manga") || t.contains("weeb") || t.contains("vocaloid") || t.contains("fanart") || t.contains("artwork") || t.contains("illustration") {
                                return false;
                            }
                        }
                    }
                }
                
                if !allow_people {
                    if let Some(ref tags) = item.tags {
                        for tag in tags {
                            let t = tag.to_lowercase();
                            if t == "people" || t == "person" || t == "girl" || t == "boy" || t == "woman" || t == "man" || t.contains("cosplay") || t.contains("model") || t.contains("actress") {
                                return false;
                            }
                        }
                    }
                }

                if !allow_general {
                    if let Some(ref tags) = item.tags {
                        let has_anime = tags.iter().any(|tag| {
                            let t = tag.to_lowercase();
                            t.contains("anime") || t.contains("manga") || t.contains("weeb") || t.contains("vocaloid") || t.contains("fanart") || t.contains("artwork") || t.contains("illustration")
                        });
                        let has_people = tags.iter().any(|tag| {
                            let t = tag.to_lowercase();
                            t == "people" || t == "person" || t == "girl" || t == "boy" || t == "woman" || t == "man" || t.contains("cosplay") || t.contains("model") || t.contains("actress")
                        });
                        if !has_anime && !has_people {
                            // If it's neither anime nor people, it is categorized as General, so filter it out
                            return false;
                        }
                    }
                }
            }
        }

        true
    });
}
