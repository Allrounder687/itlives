//! RedGIFs API fetcher module.
//! Handles authentication and video search via the RedGIFs v2 API.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

const AUTH_URL: &str = "https://api.redgifs.com/v2/auth/temporary";
const SEARCH_URL: &str = "https://api.redgifs.com/v2/gifs/search";

#[derive(Debug, Deserialize)]
struct AuthResponse {
    token: String,
}

#[derive(Debug, Deserialize)]
struct SearchResponse {
    gifs: Option<Vec<GifEntry>>,
    page: Option<u32>,
    pages: Option<u32>,
    total: Option<u32>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct GifEntry {
    pub id: String,
    pub urls: GifUrls,
    pub duration: Option<f64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct GifUrls {
    pub hd: Option<String>,
    pub sd: Option<String>,
    pub poster: Option<String>,
    pub thumbnail: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct FetchResult {
    pub id: String,
    pub video_url: String,
    pub thumbnail_url: String,
    pub local_path: String,
    pub duration: f64,
    pub width: u32,
    pub height: u32,
}

/// Fetches a temporary auth token from RedGIFs.
async fn get_token(client: &reqwest::Client) -> Result<String, String> {
    let resp = client
        .get(AUTH_URL)
        .header("User-Agent", "Mozilla/5.0")
        .send()
        .await
        .map_err(|e| format!("Auth request failed: {}", e))?;

    let auth: AuthResponse = resp
        .json()
        .await
        .map_err(|e| format!("Auth parse failed: {}", e))?;

    Ok(auth.token)
}

/// Searches RedGIFs for videos matching the given query.
pub async fn search_videos(
    query: &str,
    order: &str,
    count: u32,
    page: u32,
) -> Result<Vec<GifEntry>, String> {
    let client = reqwest::Client::new();
    let token = get_token(&client).await?;

    let url = format!(
        "{}?search_text={}&order={}&count={}&page={}",
        SEARCH_URL, query, order, count, page
    );

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "Mozilla/5.0")
        .send()
        .await
        .map_err(|e| format!("Search failed: {}", e))?;

    let data: SearchResponse = resp
        .json()
        .await
        .map_err(|e| format!("Search parse failed: {}", e))?;

    data.gifs.ok_or_else(|| "No gifs found".to_string())
}

/// Downloads a video to the local cache directory and returns the path.
pub async fn download_video(
    video_url: &str,
    video_id: &str,
    cache_dir: &PathBuf,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    // Re-auth for download (token may be needed for CDN)
    let token = get_token(&client).await?;

    let dest = cache_dir.join(format!("redgifs_{}.mp4", video_id));

    // Skip if already downloaded
    if dest.exists() {
        return Ok(dest.to_string_lossy().to_string());
    }

    // Ensure cache dir exists
    std::fs::create_dir_all(cache_dir).map_err(|e| e.to_string())?;

    let resp = client
        .get(video_url)
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "Mozilla/5.0")
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Download read failed: {}", e))?;

    std::fs::write(&dest, &bytes).map_err(|e| format!("File write failed: {}", e))?;

    log::info!("Downloaded video: {} ({} bytes)", video_id, bytes.len());
    Ok(dest.to_string_lossy().to_string())
}

/// High-level: fetch a random video, download it, return result.
pub async fn fetch_random_video(
    query: &str,
    order: &str,
) -> Result<FetchResult, String> {
    let page = rand::random::<u32>() % 5 + 1;
    let gifs = search_videos(query, order, 40, page).await?;

    if gifs.is_empty() {
        return Err("No videos found".to_string());
    }

    let idx = rand::random::<usize>() % gifs.len();
    let gif = &gifs[idx];

    let video_url = gif
        .urls
        .hd
        .as_ref()
        .or(gif.urls.sd.as_ref())
        .ok_or_else(|| "No video URL available".to_string())?;

    let cache_dir = super::desktop::get_cache_dir();
    let local_path = download_video(video_url, &gif.id, &cache_dir).await?;

    // Cleanup old videos (keep 15 most recent)
    let _ = super::desktop::cleanup_cache(15);

    Ok(FetchResult {
        id: gif.id.clone(),
        video_url: video_url.clone(),
        thumbnail_url: gif
            .urls
            .thumbnail
            .clone()
            .unwrap_or_default(),
        local_path,
        duration: gif.duration.unwrap_or(0.0),
        width: gif.width.unwrap_or(0),
        height: gif.height.unwrap_or(0),
    })
}
