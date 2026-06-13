//! AlphaCoders video provider implementation.

use super::{download_to_cache, SearchConfig, VideoProvider, VideoResult};
use rand::seq::SliceRandom;
use regex::Regex;

pub struct AlphaCodersProvider;

#[async_trait::async_trait]
impl VideoProvider for AlphaCodersProvider {
    fn name(&self) -> &str {
        "AlphaCoders"
    }

    async fn fetch_video(&self, config: &SearchConfig) -> Result<VideoResult, String> {
        let items = self.fetch_videos_list(config).await?;
        if items.is_empty() {
            return Err("AlphaCoders returned empty results (no items found on page)".to_string());
        }

        let chosen = {
            let mut rng = rand::thread_rng();
            items.choose(&mut rng).ok_or("No items selected")?.clone()
        };

        let cache_dir = crate::wallpaper::desktop::get_cache_dir();

        log::info!("[AlphaCoders] Selected Video URL: {}", chosen.video_url);

        let local_path = download_to_cache(
            &chosen.video_url,
            &chosen.id,
            "alphacoders",
            &cache_dir,
            None,
            None,
        )
        .await?;

        let _ = crate::wallpaper::desktop::cleanup_cache(15);

        let mut final_video = chosen;
        final_video.local_path = local_path;

        Ok(final_video)
    }

    async fn fetch_videos_list(&self, config: &SearchConfig) -> Result<Vec<VideoResult>, String> {
        let client = reqwest::Client::new();
        let query = config.query.trim().to_lowercase();
        let page = if config.page == 0 { 1 } else { config.page };

        let url = if query.is_empty() || query == "all" {
            format!("https://alphacoders.com/live-wallpapers?page={}", page)
        } else {
            let slug = query.replace(' ', "-").to_lowercase();
            format!("https://alphacoders.com/{}?type=live-wallpapers&page={}", slug, page)
        };

        log::info!("[AlphaCoders] Fetching url: {}", url);

        let resp = client
            .get(&url)
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
            .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8")
            .header("Accept-Language", "en-US,en;q=0.9")
            .header("Upgrade-Insecure-Requests", "1")
            .header("Sec-Fetch-Dest", "document")
            .header("Sec-Fetch-Mode", "navigate")
            .header("Sec-Fetch-Site", "none")
            .header("Sec-Fetch-User", "?1")
            .header("Connection", "keep-alive")
            .send()
            .await
            .map_err(|e| format!("AlphaCoders search failed: {}", e))?;

        log::info!("[AlphaCoders] Response Status: {}", resp.status());

        if resp.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(Vec::new());
        }

        let text = resp
            .text()
            .await
            .map_err(|e| format!("AlphaCoders parse failed: {}", e))?;

        // Format is typically: https://images2.alphacoders.com/140/thumb-350-1407175.mp4
        // Or: https://images2.alphacoders.com/140/1407175.mp4
        // Let's grab all MP4 urls in the page matching the pattern `https://images[0-9]+\.alphacoders\.com/[0-9]+/([0-9]+)\.mp4`
        let re = Regex::new(r"https://(images\d*\.alphacoders\.com/\d+/)(\d+)\.mp4").unwrap();

        let mut items = Vec::new();
        for cap in re.captures_iter(&text) {
            let prefix = cap[1].to_string(); // e.g., "images2.alphacoders.com/140/"
            let id = cap[2].to_string(); // e.g., "1407175"

            // Reconstruct URLs.
            let video_url = format!("https://{}{}.mp4", prefix, id);
            // Thumbnails on alphacoders live wallpapers are usually MP4 too, but they also have fallback JPGs sometimes.
            // To ensure the UI displays correctly if it doesn't support MP4 thumbs natively everywhere, we could map to JPG format if available.
            // But if we just pass the low-res MP4 or leave thumb the same as video, the UI might handle it or fail.
            // Let's try passing the thumb as an MP4. The UI VideoPreview component can play MP4.
            // Note: In SearchResults, the thumbnails are typically <img> tags. Passing an MP4 might break <img>.
            // Fortunately, alphacoders often provides JPG thumbs as well: "thumb-350-1407175.webp" or ".jpg"
            // Let's generate a webp/jpg URL for the thumbnail.
            // Typical picture thumb: https://images2.alphacoders.com/140/thumb-350-1407175.webp
            let thumbnail_url = format!("https://{}thumb-{}.jpg", prefix, id);

            let mut tags_list = vec!["alphacoders".to_string()];
            let mut is_people = false;
            let is_anime = true;

            // Extract tags from query and path details
            for part in query.split_whitespace().chain(prefix.split('/')) {
                let p = part.to_lowercase();
                if p.len() > 1 && p != "images" && p != "images2" && p != "alphacoders" && p != "com" {
                    tags_list.push(p.clone());
                    if p == "girl" || p == "girls" || p == "woman" || p == "women" || p == "catgirl" || p == "succubus" || p == "waifu" || p == "maid" || p == "beauty" || p == "pretty" || p == "cute" {
                        is_people = true;
                    }
                }
            }
            if is_people {
                tags_list.push("girl".to_string());
                tags_list.push("people".to_string());
            }
            if is_anime {
                tags_list.push("anime".to_string());
            }

            let result = VideoResult {
                id: id.clone(),
                video_url,
                thumbnail_url,
                local_path: String::new(),
                duration: 0.0,
                width: 3840,
                height: 2160,
                source: "alphacoders".to_string(),
                start_time: None,
                end_time: None,
                tags: Some(tags_list),
            };

            items.push(result);
        }

        // Deduplicate based on ID
        items.sort_by(|a, b| a.id.cmp(&b.id));
        items.dedup_by(|a, b| a.id == b.id);

        Ok(items)
    }

    async fn download_video(
        &self,
        video: &VideoResult,
        app_handle: Option<tauri::AppHandle>,
    ) -> Result<String, String> {
        let cache_dir = crate::wallpaper::desktop::get_cache_dir();
        super::download_to_cache(
            &video.video_url,
            &video.id,
            "alphacoders",
            &cache_dir,
            None,
            app_handle,
        )
        .await
    }
}
