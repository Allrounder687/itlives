//! MotionBGs video provider implementation.

use super::{download_to_cache, SearchConfig, VideoProvider, VideoResult};
use rand::seq::SliceRandom;

pub struct MotionBgsProvider;

const SEARCH_URL: &str = "https://motionbgs.com/tag:";

#[async_trait::async_trait]
impl VideoProvider for MotionBgsProvider {
    fn name(&self) -> &str {
        "MotionBGs"
    }

    async fn fetch_video(&self, config: &SearchConfig) -> Result<VideoResult, String> {
        let client = reqwest::Client::new();
        let query = if config.query.is_empty() { "anime".to_string() } else { config.query.to_lowercase() };
        let page = if config.page == 0 { 1 } else { config.page };
        
        let url = if page <= 1 {
            format!("{}{}/", SEARCH_URL, query)
        } else {
            format!("{}{}/{}/", SEARCH_URL, query, page)
        };

        log::info!("[MotionBGs] Fetching search page: {}", url);

        let resp = client
            .get(&url)
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8")
            .send()
            .await
            .map_err(|e| format!("MotionBGs search failed: {}", e))?;

        log::info!("[MotionBGs] Response Status: {}", resp.status());

        let text = resp
            .text()
            .await
            .map_err(|e| format!("MotionBGs parse failed: {}", e))?;

        log::info!("[MotionBGs] HTML Length: {}", text.len());
        if text.len() > 200 {
            log::info!("[MotionBGs] Body Preview: {}", &text[..200]);
        } else {
            log::info!("[MotionBGs] Body: {}", text);
        }

        // Extract IDs and slugs using string splitting or simple parsing.
        // Pattern: /i/c/546x308/media/ID/SLUG.jpg or link href="/ID/SLUG"
        let mut items = Vec::new();
        
        // Let's use regular expression or string searches to extract items
        let mut cursor = 0;
        while let Some(start_idx) = text[cursor..].find("/media/") {
            let actual_start = cursor + start_idx + 7; // after "/media/"
            let remaining = &text[actual_start..];
            
            if let Some(slash_idx) = remaining.find('/') {
                let id_str = &remaining[..slash_idx];
                if id_str.chars().all(|c| c.is_ascii_digit()) {
                    let id = id_str;
                    let remaining2 = &remaining[slash_idx + 1..];
                    
                    if let Some(quote_idx) = remaining2.find(|c| c == '\"' || c == '\'' || c == ' ' || c == '/') {
                        let slug = &remaining2[..quote_idx];
                        if !slug.is_empty() && slug != "thumb" && slug != "thumb.jpg" {
                            items.push((id.to_string(), slug.to_string()));
                        }
                    }
                }
            }
            cursor = actual_start + 1;
        }

        // Deduplicate
        items.sort_by(|a, b| a.0.cmp(&b.0));
        items.dedup_by(|a, b| a.0 == b.0);

        if items.is_empty() {
            return Err("MotionBGs returned empty results (no items found on page)".to_string());
        }

        log::info!("[MotionBGs] Found {} items from page", items.len());

        // Pick a random wallpaper
        let (id, slug) = {
            let mut rng = rand::thread_rng();
            let chosen = items.choose(&mut rng).ok_or("No items selected")?;
            (chosen.0.clone(), chosen.1.clone())
        };

        let mut final_slug = slug.clone();
        
        if final_slug.ends_with(".webp") {
            final_slug = final_slug[..final_slug.len() - 5].to_string();
        }
        if final_slug.ends_with(".jpg") {
            final_slug = final_slug[..final_slug.len() - 4].to_string();
        }

        // 4K download link
        let video_url = format!("https://motionbgs.com/dl/4k/{}", id);
        // Thumbnail URL pattern
        let thumbnail_url = format!("https://motionbgs.com/i/c/546x308/media/{}/{}.jpg", id, final_slug);

        let cache_dir = crate::wallpaper::desktop::get_cache_dir();
        
        log::info!("[MotionBGs] Selected Video URL: {}", video_url);

        // Download to cache or trigger direct
        let local_path =
            download_to_cache(&video_url, &id, "motionbgs", &cache_dir, None).await?;

        // Cleanup old videos
        let _ = crate::wallpaper::desktop::cleanup_cache(15);

        Ok(VideoResult {
            id: id.clone(),
            video_url,
            thumbnail_url,
            local_path,
            duration: 0.0, // Scrapes do not include duration
            width: 3840,   // Assuming 4K resolution preferred
            height: 2160,
            source: "motionbgs".to_string(),
            start_time: None,
            end_time: None,
        })
    }

    async fn fetch_videos_list(&self, config: &SearchConfig) -> Result<Vec<VideoResult>, String> {
        let client = reqwest::Client::new();
        let query = if config.query.is_empty() { "anime".to_string() } else { config.query.to_lowercase() };
        let page = if config.page == 0 { 1 } else { config.page };

        let url = if page <= 1 {
            format!("{}{}/", SEARCH_URL, query)
        } else {
            format!("{}{}/{}/", SEARCH_URL, query, page)
        };

        let resp = client
            .get(&url)
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8")
            .send()
            .await
            .map_err(|e| format!("MotionBGs search failed: {}", e))?;

        let text = resp
            .text()
            .await
            .map_err(|e| format!("MotionBGs parse failed: {}", e))?;

        let mut items = Vec::new();
        let mut cursor = 0;
        
        while let Some(start_idx) = text[cursor..].find("/media/") {
            let actual_start = cursor + start_idx + 7;
            let remaining = &text[actual_start..];
            if let Some(slash_idx) = remaining.find('/') {
                let id_str = &remaining[..slash_idx];
                if id_str.chars().all(|c| c.is_ascii_digit()) {
                    let id = id_str;
                    let remaining2 = &remaining[slash_idx + 1..];
                    if let Some(quote_idx) = remaining2.find(|c| c == '\"' || c == '\'' || c == ' ' || c == '/') {
                        let slug = &remaining2[..quote_idx];
                        if !slug.is_empty() && slug != "thumb" && slug != "thumb.jpg" {
                            items.push((id.to_string(), slug.to_string()));
                        }
                    }
                }
            }
            cursor = actual_start + 1;
        }

        items.sort_by(|a, b| a.0.cmp(&b.0));
        items.dedup_by(|a, b| a.0 == b.0);

        let mut results = Vec::new();
        for (id, slug) in items {
            let mut final_slug = slug.clone();
            
            // Sequentially strip extensions from the end of parsed slug
            if final_slug.ends_with(".webp") {
                final_slug = final_slug[..final_slug.len() - 5].to_string();
            }
            if final_slug.ends_with(".jpg") {
                final_slug = final_slug[..final_slug.len() - 4].to_string();
            }

            results.push(VideoResult {
                id: id.clone(),
                video_url: format!("https://motionbgs.com/dl/4k/{}", id),
                thumbnail_url: format!("https://motionbgs.com/i/c/546x308/media/{}/{}.jpg", id, final_slug),
                local_path: String::new(),
                duration: 0.0,
                width: 3840,
                height: 2160,
                source: "motionbgs".to_string(),
                start_time: None,
                end_time: None,
            });
        }

        Ok(results)
    }

    async fn download_video(&self, video: &VideoResult) -> Result<String, String> {
        let cache_dir = crate::wallpaper::desktop::get_cache_dir();
        super::download_to_cache(&video.video_url, &video.id, "motionbgs", &cache_dir, None).await
    }
}
