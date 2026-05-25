//! Wallpaper Waves video provider implementation.

use super::{download_to_cache, SearchConfig, VideoProvider, VideoResult};
use regex::Regex;

pub struct WallpaperWavesProvider;

#[async_trait::async_trait]
impl VideoProvider for WallpaperWavesProvider {
    fn name(&self) -> &str {
        "WallpaperWaves"
    }

    async fn fetch_video(&self, config: &SearchConfig) -> Result<VideoResult, String> {
        let items = self.fetch_videos_list(config).await?;
        items.into_iter().next().ok_or_else(|| "No wallpapers found on Wallpaper Waves".to_string())
    }

    async fn fetch_videos_list(&self, config: &SearchConfig) -> Result<Vec<VideoResult>, String> {
        let client = reqwest::Client::new();
        let query = config.query.trim().to_lowercase();
        let page = if config.page == 0 { 1 } else { config.page };

        // Normalize spaces to hyphens for category slug matching
        let normalized = query.replace(' ', "-").to_lowercase();
        
        let url = if normalized.is_empty() || normalized == "all" {
            if page <= 1 {
                "https://wallpaperwaves.com/".to_string()
            } else {
                format!("https://wallpaperwaves.com/page/{}/", page)
            }
        } else if [
            "anime", "abstract", "animal", "cartoon", "fantasy", "games", "landscape", 
            "memes", "pixel-art", "retro", "sci-fi", "tv-movies", "vehicle"
        ].contains(&normalized.as_str()) {
            if page <= 1 {
                format!("https://wallpaperwaves.com/category/{}/", normalized)
            } else {
                format!("https://wallpaperwaves.com/category/{}/page/{}/", normalized, page)
            }
        } else {
            // General WordPress search query
            if page <= 1 {
                format!("https://wallpaperwaves.com/?s={}", urlencoding::encode(&query))
            } else {
                format!("https://wallpaperwaves.com/page/{}/?s={}", page, urlencoding::encode(&query))
            }
        };

        log::info!("[WallpaperWaves] Fetching URL: {}", url);

        let resp = client
            .get(&url)
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8")
            .header("Accept-Language", "en-US,en;q=0.9")
            .send()
            .await
            .map_err(|e| format!("WallpaperWaves search failed: {}", e))?;

        let text = resp
            .text()
            .await
            .map_err(|e| format!("WallpaperWaves parse failed: {}", e))?;

        // Extract articles
        let article_re = Regex::new(r"(?s)<article[^>]*class=[^>]*moewalls-card.*?/article>").unwrap();
        let href_re = Regex::new(r#"<div class="jeg_thumb">\s*<a href="([^"]+)""#).unwrap();
        let src_re = Regex::new(r#"<img[^>]*src="([^"]+)""#).unwrap();
        let res_re = Regex::new(r#"class="moe-badge-right"[^>]*>([^<]+)<"#).unwrap();

        let mut results = Vec::new();

        for cap in article_re.captures_iter(&text) {
            let block = &cap[0];
            let href = href_re.captures(block).map(|c| c[1].to_string());
            let src = src_re.captures(block).map(|c| c[1].to_string());

            if let (Some(post_url), Some(thumb_url)) = (href, src) {
                let id = post_url
                    .trim_end_matches('/')
                    .split('/')
                    .last()
                    .unwrap_or("unknown")
                    .to_string();

                // Predict low-res preview mp4 URL by replacing the webp/jpg suffix
                let video_url = if thumb_url.contains("wallpaperwaves-com.webp") {
                    thumb_url.replace("wallpaperwaves-com.webp", "preview.mp4")
                } else if thumb_url.ends_with(".webp") {
                    thumb_url.replace(".webp", "-preview.mp4")
                } else if thumb_url.ends_with(".jpg") {
                    thumb_url.replace(".jpg", "-preview.mp4")
                } else {
                    thumb_url.clone()
                };

                let resolution = res_re.captures(block)
                    .map(|c| c[1].to_string())
                    .unwrap_or_else(|| "1920x1080".to_string());

                let mut width = 1920;
                let mut height = 1080;
                if resolution.contains('x') {
                    let parts: Vec<&str> = resolution.split('x').collect();
                    if parts.len() == 2 {
                        if let (Ok(w), Ok(h)) = (parts[0].trim().parse::<u32>(), parts[1].trim().parse::<u32>()) {
                            width = w;
                            height = h;
                        }
                    }
                }

                results.push(VideoResult {
                    id,
                    video_url, // Used in Discover page video preview element
                    thumbnail_url: thumb_url,
                    local_path: post_url, // Store full page URL in local_path temporarily for detail extraction
                    duration: 0.0,
                    width,
                    height,
                    source: "wallpaperwaves".to_string(),
                    start_time: None,
                    end_time: None,
            tags: None,
                });
            }
        }

        Ok(results)
    }

    async fn download_video(&self, video: &VideoResult, app_handle: Option<tauri::AppHandle>) -> Result<String, String> {
        let client = reqwest::Client::new();
        let detail_url = if video.local_path.starts_with("http") {
            video.local_path.clone()
        } else {
            format!("https://wallpaperwaves.com/{}/", video.id)
        };

        log::info!("[WallpaperWaves] Fetching detail page for download: {}", detail_url);
        let resp = client
            .get(&detail_url)
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .send()
            .await
            .map_err(|e| format!("Failed to fetch detailed page: {}", e))?;

        let html = resp
            .text()
            .await
            .map_err(|e| format!("Failed to read detailed page HTML: {}", e))?;

        // Extract high-res download attachment script link
        let download_re = Regex::new(r#"download\.php\?video=([^"'\s<>]+)"#).unwrap();
        let download_url = if let Some(cap) = download_re.captures(&html) {
            format!("https://wallpaperwaves.com/download.php?video={}", &cap[1])
        } else {
            // Direct mp4 link fallback
            let mp4_re = Regex::new(r#"href="([^"]+\.mp4)""#).unwrap();
            if let Some(cap) = mp4_re.captures(&html) {
                cap[1].to_string()
            } else {
                // Secondary preview mp4 fallback
                video.video_url.clone()
            }
        };

        log::info!("[WallpaperWaves] Resolved download URL: {}", download_url);

        let cache_dir = crate::wallpaper::desktop::get_cache_dir();
        download_to_cache(&download_url, &video.id, "wallpaperwaves", &cache_dir, None, app_handle).await
    }
}
