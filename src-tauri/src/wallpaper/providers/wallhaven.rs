//! WallHaven static wallpaper provider.

use super::{SearchConfig, VideoProvider, VideoResult};
use serde::Deserialize;

pub struct WallhavenProvider;

#[derive(Deserialize)]
struct WallhavenResponse {
    data: Option<Vec<WallhavenItem>>,
}

#[derive(Deserialize, Clone)]
struct WallhavenItem {
    id: String,
    path: String,
    dimension_x: u32,
    dimension_y: u32,
    thumbs: WallhavenThumbs,
}

#[derive(Deserialize, Clone)]
struct WallhavenThumbs {
    small: Option<String>,
    original: Option<String>,
}

#[async_trait::async_trait]
impl VideoProvider for WallhavenProvider {
    fn name(&self) -> &str {
        "WallHaven"
    }

    async fn fetch_video(&self, config: &SearchConfig) -> Result<VideoResult, String> {
        let items = self.fetch_videos_list(config).await?;
        items.into_iter().next().ok_or("No wallpapers found".to_string())
    }

    async fn fetch_videos_list(&self, config: &SearchConfig) -> Result<Vec<VideoResult>, String> {
        let client = reqwest::Client::new();
        let query = config.query.trim();
        let page = if config.page == 0 { 1 } else { config.page };

        // Construct search URL
        // General query search, purity = 100 (sfw only)
        let mut url = format!(
            "https://wallhaven.cc/api/v1/search?purity=100&page={}",
            page
        );

        if !query.is_empty() && query != "all" {
            url = format!("{}&q={}", url, urlencoding::encode(query));
        }

        if let Some(ref key) = config.api_key {
            let trimmed = key.trim();
            if !trimmed.is_empty() {
                url = format!("{}&apikey={}", url, trimmed);
            }
        }

        log::info!("[WallHaven] Fetching url: {}", url);

        let resp = client
            .get(&url)
            .header("User-Agent", "Mozilla/5.0")
            .send()
            .await
            .map_err(|e| format!("WallHaven API failed: {}", e))?;

        let data: WallhavenResponse = resp
            .json()
            .await
            .map_err(|e| format!("WallHaven parse failed: {}", e))?;

        let items = data.data.unwrap_or_default();
        let mut results = Vec::new();

        for item in items {
            results.push(VideoResult {
                id: item.id.clone(),
                video_url: item.path.clone(), // Set the high-res image URL as "video_url"
                thumbnail_url: item.thumbs.original.clone()
                    .or(item.thumbs.small.clone())
                    .unwrap_or_default(),
                local_path: String::new(),
                duration: 0.0, // Static wallpaper
                width: item.dimension_x,
                height: item.dimension_y,
                source: "wallhaven".to_string(),
                start_time: None,
                end_time: None,
            });
        }

        Ok(results)
    }

    async fn download_video(&self, video: &VideoResult) -> Result<String, String> {
        let cache_dir = crate::wallpaper::desktop::get_cache_dir();
        super::download_to_cache(&video.video_url, &video.id, "wallhaven", &cache_dir, None).await
    }
}
