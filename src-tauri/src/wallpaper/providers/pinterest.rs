//! Pinterest static wallpaper provider.

use super::{SearchConfig, VideoProvider, VideoResult};
use regex::Regex;

pub struct PinterestProvider;

#[async_trait::async_trait]
impl VideoProvider for PinterestProvider {
    fn name(&self) -> &str {
        "Pinterest"
    }

    async fn fetch_video(&self, config: &SearchConfig) -> Result<VideoResult, String> {
        let items = self.fetch_videos_list(config).await?;
        items.into_iter().next().ok_or("No wallpapers found on Pinterest".to_string())
    }

    async fn fetch_videos_list(&self, config: &SearchConfig) -> Result<Vec<VideoResult>, String> {
        let client = reqwest::Client::new();
        let query = config.query.trim().to_lowercase();
        
        let url = if query.is_empty() || query == "all" {
            "https://www.pinterest.com/search/pins/?q=wallpapers".to_string()
        } else {
            format!("https://www.pinterest.com/search/pins/?q={}%20wallpaper", urlencoding::encode(&query))
        };

        log::info!("[Pinterest] Fetching url: {}", url);

        let resp = client
            .get(&url)
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
            .send()
            .await
            .map_err(|e| format!("Pinterest search failed: {}", e))?;

        let text = resp
            .text()
            .await
            .map_err(|e| format!("Pinterest parse failed: {}", e))?;

        // Extract Pinterest image patterns:
        // Format: https://i.pinimg.com/736x/8b/a1/df/8ba1df...jpg or similar
        // Let's use a regex to capture the prefix, subfolder, and rest of the path
        let re = Regex::new(r"https://i\.pinimg\.com/([^/]+)/([a-f0-9/]+/[a-f0-9]+\.(jpg|png|webp))").unwrap();

        let mut results = Vec::new();
        let mut seen_ids = std::collections::HashSet::new();

        for cap in re.captures_iter(&text) {
            let _original_size = &cap[1]; // e.g., "236x", "564x", "736x"
            let path = &cap[2];          // e.g., "8b/a1/df/8ba1df23143.jpg"

            // Extract a unique ID from the filename (e.g. "8ba1df23143" from "8b/a1/df/8ba1df23143.jpg")
            let id = path.split('/')
                .last()
                .and_then(|f| f.split('.').next())
                .unwrap_or(path)
                .to_string();

            if seen_ids.contains(&id) {
                continue;
            }
            seen_ids.insert(id.clone());

            // Programmatically construct high-resolution target (736x is standard and highly reliable)
            let video_url = format!("https://i.pinimg.com/736x/{}", path);
            let thumbnail_url = format!("https://i.pinimg.com/236x/{}", path);

            results.push(VideoResult {
                id,
                video_url,
                thumbnail_url,
                local_path: String::new(),
                duration: 0.0,
                width: 1920,
                height: 1080,
                source: "pinterest".to_string(),
                start_time: None,
                end_time: None,
            });
        }

        // Shuffling Pinterest results adds a great sense of variety!
        use rand::seq::SliceRandom;
        let mut rng = rand::thread_rng();
        results.shuffle(&mut rng);

        log::info!("[Pinterest] Found {} unique static wallpapers", results.len());
        Ok(results)
    }

    async fn download_video(&self, video: &VideoResult) -> Result<String, String> {
        let cache_dir = crate::wallpaper::desktop::get_cache_dir();
        super::download_to_cache(&video.video_url, &video.id, "pinterest", &cache_dir, None).await
    }
}
