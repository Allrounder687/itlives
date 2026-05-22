//! RedGIFs video provider implementation.

use super::{download_to_cache, SearchConfig, VideoProvider, VideoResult};
use serde::Deserialize;

const AUTH_URL: &str = "https://api.redgifs.com/v2/auth/temporary";
const SEARCH_URL: &str = "https://api.redgifs.com/v2/gifs/search";

pub struct RedGifsProvider;

#[derive(Deserialize)]
struct AuthResponse {
    token: String,
}

#[derive(Deserialize)]
struct SearchResponse {
    gifs: Option<Vec<GifEntry>>,
}

#[derive(Deserialize, Clone)]
struct GifEntry {
    id: String,
    urls: GifUrls,
    duration: Option<f64>,
    width: Option<u32>,
    height: Option<u32>,
}

#[derive(Deserialize, Clone)]
struct GifUrls {
    hd: Option<String>,
    sd: Option<String>,
    thumbnail: Option<String>,
}

async fn get_token(client: &reqwest::Client) -> Result<String, String> {
    let resp = client
        .get(AUTH_URL)
        .header("User-Agent", "Mozilla/5.0")
        .send()
        .await
        .map_err(|e| format!("RedGIFs auth failed: {}", e))?;

    let auth: AuthResponse = resp
        .json()
        .await
        .map_err(|e| format!("RedGIFs auth parse failed: {}", e))?;

    Ok(auth.token)
}

#[async_trait::async_trait]
impl VideoProvider for RedGifsProvider {
    fn name(&self) -> &str {
        "RedGIFs"
    }

    async fn fetch_video(&self, config: &SearchConfig) -> Result<VideoResult, String> {
        let client = reqwest::Client::new();
        let token = get_token(&client).await?;

        let page = if config.page == 0 {
            rand::random::<u32>() % 5 + 1
        } else {
            config.page
        };

        let url = format!(
            "{}?search_text={}&order={}&count={}&page={}",
            SEARCH_URL, config.query, config.order, config.count, page
        );

        let resp = client
            .get(&url)
            .header("Authorization", format!("Bearer {}", token))
            .header("User-Agent", "Mozilla/5.0")
            .send()
            .await
            .map_err(|e| format!("RedGIFs search failed: {}", e))?;

        let data: SearchResponse = resp
            .json()
            .await
            .map_err(|e| format!("RedGIFs parse failed: {}", e))?;

        let gifs = data.gifs.ok_or("No gifs returned from RedGIFs")?;
        if gifs.is_empty() {
            return Err("RedGIFs returned empty results".to_string());
        }

        let idx = rand::random::<usize>() % gifs.len();
        let gif = &gifs[idx];

        let video_url = gif
            .urls
            .hd
            .as_ref()
            .or(gif.urls.sd.as_ref())
            .ok_or("No video URL in RedGIFs result")?;

        let cache_dir = crate::wallpaper::desktop::get_cache_dir();
        let auth_header = vec![("Authorization".to_string(), format!("Bearer {}", token))];

        let local_path =
            download_to_cache(video_url, &gif.id, "redgifs", &cache_dir, Some(auth_header)).await?;

        // Cleanup old videos
        let _ = crate::wallpaper::desktop::cleanup_cache(15);

        Ok(VideoResult {
            id: gif.id.clone(),
            video_url: video_url.clone(),
            thumbnail_url: gif.urls.thumbnail.clone().unwrap_or_default(),
            local_path,
            duration: gif.duration.unwrap_or(0.0),
            width: gif.width.unwrap_or(0),
            height: gif.height.unwrap_or(0),
            source: "redgifs".to_string(),
            start_time: None,
            end_time: None,
            tags: None,
        })
    }

    async fn fetch_videos_list(&self, config: &SearchConfig) -> Result<Vec<VideoResult>, String> {
        let client = reqwest::Client::new();
        let token = get_token(&client).await?;

        let page = if config.page == 0 { 1 } else { config.page };

        let url = format!(
            "{}?search_text={}&order={}&count={}&page={}",
            SEARCH_URL, config.query, config.order, config.count, page
        );

        let resp = client
            .get(&url)
            .header("Authorization", format!("Bearer {}", token))
            .header("User-Agent", "Mozilla/5.0")
            .send()
            .await
            .map_err(|e| format!("RedGIFs search failed: {}", e))?;

        let data: SearchResponse = resp
            .json()
            .await
            .map_err(|e| format!("RedGIFs parse failed: {}", e))?;

        let gifs = data.gifs.ok_or("No gifs returned from RedGIFs")?;
        
        let mut results = Vec::new();
        for gif in gifs {
            let video_url = gif.urls.hd.as_ref()
                .or(gif.urls.sd.as_ref())
                .cloned();
                
            if let Some(url) = video_url {
                results.push(VideoResult {
                    id: gif.id.clone(),
                    video_url: url,
                    thumbnail_url: gif.urls.thumbnail.clone().unwrap_or_default(),
                    local_path: String::new(), // Not downloaded yet
                    duration: gif.duration.unwrap_or(0.0),
                    width: gif.width.unwrap_or(0),
                    height: gif.height.unwrap_or(0),
                    source: "redgifs".to_string(),
                    start_time: None,
                    end_time: None,
            tags: None,
                });
            }
        }
        
        Ok(results)
    }

    async fn download_video(&self, video: &VideoResult) -> Result<String, String> {
        let client = reqwest::Client::new();
        let token = get_token(&client).await?; // auth required

        let cache_dir = crate::wallpaper::desktop::get_cache_dir();
        let auth_header = vec![("Authorization".to_string(), format!("Bearer {}", token))];

        super::download_to_cache(&video.video_url, &video.id, "redgifs", &cache_dir, Some(auth_header)).await
    }
}
