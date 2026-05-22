//! Video provider plugin system.
//! Any video source (RedGIFs, TikTok, YouTube, direct URL, local file)
//! implements the `VideoProvider` trait to become a wallpaper source.

pub mod direct_url;
pub mod motionbgs;
pub mod alphacoders;
pub mod redgifs;
pub mod youtube;
pub mod wallhaven;
pub mod pinterest;
pub mod wallpaperwaves;

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
}

/// Configuration for a provider search request.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchConfig {
    pub query: String,
    pub order: String,
    pub count: u32,
    pub page: u32,
    pub api_key: Option<String>,
}

impl Default for SearchConfig {
    fn default() -> Self {
        Self {
            query: String::new(),
            order: "trending".to_string(),
            count: 40,
            page: 1,
            api_key: None,
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
    async fn download_video(&self, video: &VideoResult) -> Result<String, String>;
}

/// Downloads a video from URL to the cache dir. Shared utility for all providers.
pub async fn download_to_cache(
    video_url: &str,
    video_id: &str,
    source: &str,
    cache_dir: &PathBuf,
    extra_headers: Option<Vec<(String, String)>>,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(30))
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

    let mut req = client.get(video_url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .header("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8")
        .header("Accept-Language", "en-US,en;q=0.9");

    if let Some(headers) = extra_headers {
        for (key, value) in headers {
            req = req.header(&key, &value);
        }
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        return Err(format!("Download of {} failed with HTTP status: {}", video_url, status));
    }

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Download read failed: {}", e))?;

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
        "redgifs" => Ok(Box::new(redgifs::RedGifsProvider)),
        "motionbgs" => Ok(Box::new(motionbgs::MotionBgsProvider)),
        "alphacoders" => Ok(Box::new(alphacoders::AlphaCodersProvider)),
        "youtube" | "yt" => Ok(Box::new(youtube::YouTubeProvider)),
        "direct" | "url" => Ok(Box::new(direct_url::DirectUrlProvider)),
        "wallhaven" => Ok(Box::new(wallhaven::WallhavenProvider)),
        "pinterest" => Ok(Box::new(pinterest::PinterestProvider)),
        "wallpaperwaves" => Ok(Box::new(wallpaperwaves::WallpaperWavesProvider)),
        _ => Err(format!(
            "Unknown video source: '{}'. Available: redgifs, motionbgs, alphacoders, youtube, direct, wallhaven, pinterest, wallpaperwaves",
            source
        )),
    }
}

/// Lists all available provider names.
pub fn list_providers() -> Vec<String> {
    vec![
        "redgifs".to_string(),
        "motionbgs".to_string(),
        "alphacoders".to_string(),
        "youtube".to_string(),
        "direct".to_string(),
        "wallhaven".to_string(),
        "pinterest".to_string(),
        "wallpaperwaves".to_string(),
    ]
}

