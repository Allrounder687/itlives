//! MotionBGs video provider implementation.

use super::{download_to_cache, SearchConfig, VideoProvider, VideoResult};
use rand::seq::SliceRandom;

pub struct MotionBgsProvider;



#[async_trait::async_trait]
impl VideoProvider for MotionBgsProvider {
    fn name(&self) -> &str {
        "MotionBGs"
    }

    async fn fetch_video(&self, config: &SearchConfig) -> Result<VideoResult, String> {
        let client = reqwest::Client::new();
        let query = config.query.to_lowercase();
        let page = if config.page == 0 { 1 } else { config.page };
        
        let url = if query == "all" || query.is_empty() {
            if page <= 1 {
                "https://motionbgs.com/".to_string()
            } else {
                format!("https://motionbgs.com/{}/", page)
            }
        } else {
            if page <= 1 {
                format!("https://motionbgs.com/tag:{}/", query)
            } else {
                format!("https://motionbgs.com/tag:{}/{}/", query, page)
            }
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
        while let Some(start_idx) = text[cursor..].find("546x308/media/") {
            let actual_start = cursor + start_idx + 14; 
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

        let mut results = self.fetch_videos_list(config).await?;
        let chosen = {
            let mut rng = rand::thread_rng();
            results.shuffle(&mut rng);
            results.into_iter().next().ok_or("No items found")?
        };
        
        let cache_dir = crate::wallpaper::desktop::get_cache_dir();
        let local_path = download_to_cache(&chosen.video_url, &chosen.id, "motionbgs", &cache_dir, None).await?;
        
        let mut final_video = chosen;
        final_video.local_path = local_path;
        Ok(final_video)
    }

    async fn fetch_videos_list(&self, config: &SearchConfig) -> Result<Vec<VideoResult>, String> {
        let client = reqwest::Client::new();
        let query = config.query.to_lowercase().trim().replace(' ', "-");
        let page = if config.page == 0 { 1 } else { config.page };

        let url = if query == "all" || query.is_empty() {
            if page <= 1 {
                "https://motionbgs.com/".to_string()
            } else {
                format!("https://motionbgs.com/{}/", page)
            }
        } else {
            if page <= 1 {
                format!("https://motionbgs.com/tag:{}/", query)
            } else {
                format!("https://motionbgs.com/tag:{}/{}/", query, page)
            }
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
        
        while let Some(start_idx) = text[cursor..].find("546x308/media/") {
            let actual_start = cursor + start_idx + 14;
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
            let mut base_slug = slug.clone();
            // Sequentially strip extensions (e.g. .jpg.webp -> .jpg -> empty)
            while base_slug.ends_with(".webp") || base_slug.ends_with(".jpg") || base_slug.ends_with(".png") {
                if base_slug.ends_with(".webp") { base_slug = base_slug[..base_slug.len() - 5].to_string(); }
                else if base_slug.ends_with(".jpg") { base_slug = base_slug[..base_slug.len() - 4].to_string(); }
                else if base_slug.ends_with(".png") { base_slug = base_slug[..base_slug.len() - 4].to_string(); }
            }

            // Extract resolution from slug if present (e.g. 1920x1080 or 3840x2160)
            let mut width = 1920;
            let mut height = 1080;
            let mut video_res = "1920x1080".to_string();
            
            if base_slug.contains("3840x2160") {
                width = 3840; height = 2160; video_res = "3840x2160".to_string();
            }

            // Remove resolution from slug for the clean name used in direct path if needed, 
            // but the direct path actually includes it.
            // Direct path: https://motionbgs.com/media/ID/SLUG.RESOLUTION.mp4
            let mut name_only = base_slug.clone();
            if let Some(pos) = name_only.find('.') {
                name_only = name_only[..pos].to_string();
            }

            results.push(VideoResult {
                id: id.clone(),
                video_url: format!("https://motionbgs.com/media/{}/{}.{}.mp4", id, name_only, video_res),
                thumbnail_url: format!("https://motionbgs.com/i/c/546x308/media/{}/{}.jpg", id, base_slug),
                local_path: String::new(),
                duration: 0.0,
                width,
                height,
                source: "motionbgs".to_string(),
                start_time: None,
                end_time: None,
            tags: None,
            });
        }

        Ok(results)
    }

    async fn download_video(&self, video: &VideoResult) -> Result<String, String> {
        let cache_dir = crate::wallpaper::desktop::get_cache_dir();
        super::download_to_cache(&video.video_url, &video.id, "motionbgs", &cache_dir, None).await
    }
}
