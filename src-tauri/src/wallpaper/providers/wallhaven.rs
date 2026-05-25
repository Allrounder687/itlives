//! WallHaven static wallpaper provider.

use super::{SearchConfig, VideoProvider, VideoResult};
use serde::Deserialize;

pub struct WallhavenProvider;

#[derive(Deserialize)]
struct WallhavenResponse {
    data: Option<Vec<WallhavenItem>>,
}

#[derive(Deserialize)]
struct WallhavenDetailResponse {
    data: Option<WallhavenDetailData>,
}

#[derive(Deserialize)]
struct WallhavenDetailData {
    tags: Option<Vec<WallhavenTag>>,
}

#[derive(Deserialize)]
struct WallhavenTag {
    name: String,
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

        let mut url = format!(
            "https://wallhaven.cc/api/v1/search?purity=100&page={}",
            page
        );

        if config.order == "random" {
            url.push_str("&sorting=random");
        }

        if !query.is_empty() && query != "all" {
            if query.starts_with("https://wallhaven.cc/user/") {
                let parts: Vec<&str> = query.split('/').collect();
                if parts.len() >= 7 {
                    let username = parts[4];
                    let coll_id_with_params = parts[6];
                    let coll_id = coll_id_with_params.split('?').next().unwrap_or(coll_id_with_params);
                    url = format!("https://wallhaven.cc/api/v1/collections/{}/{}?page={}", username, coll_id, page);
                }
            } else {
                url = format!("{}&q={}", url, urlencoding::encode(query));
            }
        }

        if let Some(ref key) = config.api_key {
            let trimmed = key.trim();
            if !trimmed.is_empty() {
                url = format!("{}&apikey={}", url, trimmed);
            }
        }

        if let Some(ref res) = config.resolutions {
            let trimmed = res.trim();
            if !trimmed.is_empty() {
                if trimmed.starts_with(">=") {
                    url = format!("{}&atleast={}", url, &trimmed[2..]);
                } else {
                    url = format!("{}&resolutions={}", url, trimmed);
                }
            }
        }

        if let Some(ref ratio) = config.ratios {
            let trimmed = ratio.trim();
            if !trimmed.is_empty() {
                url = format!("{}&ratios={}", url, trimmed);
            }
        }

        if let Some(ref color) = config.colors {
            let trimmed = color.trim();
            if !trimmed.is_empty() {
                url = format!("{}&colors={}", url, trimmed);
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
            tags: None,
            });
        }

        Ok(results)
    }

    async fn download_video(&self, video: &VideoResult, app_handle: Option<tauri::AppHandle>) -> Result<String, String> {
        let cache_dir = crate::wallpaper::desktop::get_cache_dir();
        super::download_to_cache(
            &video.video_url,
            &video.id,
            "wallhaven",
            &cache_dir,
            Some(vec![("User-Agent".to_string(), "Mozilla/5.0".to_string())]),
            app_handle,
        ).await
    }

    async fn fetch_tags(&self, id: &str) -> Result<Vec<String>, String> {
        let url = format!("https://wallhaven.cc/api/v1/w/{}", id);
        let client = reqwest::Client::new();
        let resp = client
            .get(&url)
            .header("User-Agent", "Mozilla/5.0")
            .send()
            .await
            .map_err(|e| format!("WallHaven API failed: {}", e))?;

        let data: WallhavenDetailResponse = resp
            .json()
            .await
            .map_err(|e| format!("WallHaven parse failed: {}", e))?;

        if let Some(detail) = data.data {
            if let Some(tags) = detail.tags {
                return Ok(tags.into_iter().map(|t| t.name).collect());
            }
        }
        
        Ok(Vec::new())
    }
}
