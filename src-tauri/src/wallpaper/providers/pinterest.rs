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
        let client = reqwest::Client::builder()
            .connect_timeout(std::time::Duration::from_secs(8))
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .map_err(|e| format!("Failed to build reqwest client: {}", e))?;
        let mut urls = Vec::new();
        let query = config.query.trim().to_lowercase();
        let page = if config.page > 0 { config.page } else { 1 };

        // 1. Always load user's custom Pinterest URLs from settings — these are their configured sources
        let state_path = crate::wallpaper::state::state_file();
        if state_path.exists() {
            if let Ok(raw) = std::fs::read_to_string(&state_path) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&raw) {
                    if let Some(urls_val) = val.get("pinterest_urls") {
                        if let Ok(custom_urls) = serde_json::from_value::<Vec<String>>(urls_val.clone()) {
                            let active_custom_urls: Vec<String> = custom_urls
                                .into_iter()
                                .map(|u| u.trim().to_string())
                                .filter(|u| !u.is_empty())
                                .collect();

                            if !active_custom_urls.is_empty() {
                                // Rotate through custom URLs across pages for pagination variety
                                let idx = ((page - 1) as usize) % active_custom_urls.len();
                                urls.push(active_custom_urls[idx].clone());
                                // On first page, include all custom URLs for a richer initial result set
                                if page == 1 {
                                    for (i, url) in active_custom_urls.iter().enumerate() {
                                        if i != idx && !urls.contains(url) {
                                            urls.push(url.clone());
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // 2. If user typed a specific search query (not empty / "all"), also add a query-based URL
        let has_custom_query = !query.is_empty() && query != "all";
        if has_custom_query {
            let suffixes = [
                "",
                " 4k",
                " aesthetic",
                " background",
                " art",
                " high quality",
                " design",
                " dark",
                " desktop",
                " hd",
                " cool",
                " style",
            ];
            let suffix = suffixes[(page - 1) as usize % suffixes.len()];
            let query_url = format!("https://www.pinterest.com/search/pins/?q={}{}%20wallpaper", urlencoding::encode(&query), urlencoding::encode(suffix));
            urls.push(query_url);
        }

        // 3. If no URLs at all (no custom URLs AND no query), use generic wallpaper searches
        if urls.is_empty() {
            let suffixes = [
                "",
                " 4k",
                " aesthetic",
                " background",
                " art",
                " high quality",
                " design",
                " dark",
                " desktop",
                " hd",
                " cool",
                " style",
            ];
            let suffix = suffixes[(page - 1) as usize % suffixes.len()];
            let query_url = format!("https://www.pinterest.com/search/pins/?q=wallpapers{}", urlencoding::encode(suffix));
            urls.push(query_url);
        }

        log::info!("[Pinterest] Scraping {} sources...", urls.len());

        let mut results = Vec::new();
        let mut seen_ids = std::collections::HashSet::new();

        for url in urls {
            log::info!("[Pinterest] Fetching url: {}", url);
            let resp = match client
                .get(&url)
                .header("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1")
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .send()
                .await 
            {
                Ok(r) => r,
                Err(e) => {
                    log::warn!("[Pinterest] Failed to fetch source URL {}: {}", url, e);
                    continue;
                }
            };

            let raw_text = match resp.text().await {
                Ok(t) => t,
                Err(e) => {
                    log::warn!("[Pinterest] Failed to read body from {}: {}", url, e);
                    continue;
                }
            };

            let script_re = Regex::new(r#"<script[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)</script>"#).unwrap();
            for cap in script_re.captures_iter(&raw_text) {
                let content = &cap[2];
                if content.contains("initialReduxState") {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(content) {
                        if let Some(initial_redux_state) = v.pointer("/initialReduxState") {
                            let mut feed_pin_ids = Vec::new();
                            
                            // 1. Extract pin IDs from the main feed
                            if let Some(feeds) = initial_redux_state.get("feeds").and_then(|f| f.as_object()) {
                                for (key, val) in feeds {
                                    if key.contains("search") || key.contains("board") || key.contains("feed") {
                                        if let Some(arr) = val.as_array() {
                                            for item in arr {
                                                if let Some(pid) = item.get("id").and_then(|pid| pid.as_str()) {
                                                    feed_pin_ids.push(pid.to_string());
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            
                            // Fallback: search for any array in feeds if no key matched
                            if feed_pin_ids.is_empty() {
                                if let Some(feeds) = initial_redux_state.get("feeds").and_then(|f| f.as_object()) {
                                    for (_, val) in feeds {
                                        if let Some(arr) = val.as_array() {
                                            for item in arr {
                                                if let Some(pid) = item.get("id").and_then(|pid| pid.as_str()) {
                                                    feed_pin_ids.push(pid.to_string());
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            // 2. Fetch details for each pin ID
                            if let Some(pins) = initial_redux_state.get("pins").and_then(|p| p.as_object()) {
                                fn find_video_url(val: &serde_json::Value) -> Option<String> {
                                    if let Some(s) = val.as_str() {
                                        if s.contains(".mp4") || s.contains(".m3u8") || s.contains(".webm") || s.contains(".mov") {
                                            return Some(s.to_string());
                                        }
                                    } else if let Some(obj) = val.as_object() {
                                        if let Some(videos) = obj.get("videos") {
                                            if let Some(url) = videos.pointer("/video_list/V_HLSV4/url").and_then(|u| u.as_str()) {
                                                return Some(url.to_string());
                                            }
                                            if let Some(url) = videos.pointer("/video_list/V_720P/url").and_then(|u| u.as_str()) {
                                                return Some(url.to_string());
                                            }
                                        }
                                        for (_, sub_val) in obj {
                                            if let Some(url) = find_video_url(sub_val) {
                                                return Some(url);
                                            }
                                        }
                                    } else if let Some(arr) = val.as_array() {
                                        for sub_val in arr {
                                            if let Some(url) = find_video_url(sub_val) {
                                                return Some(url);
                                            }
                                        }
                                    }
                                    None
                                }

                                let pin_ids_to_process = if !feed_pin_ids.is_empty() {
                                    feed_pin_ids
                                } else {
                                    pins.keys().cloned().collect()
                                };

                                for pid in pin_ids_to_process {
                                    if seen_ids.contains(&pid) {
                                        continue;
                                    }
                                    if let Some(pin) = pins.get(&pid) {
                                        let mut image_url = None;
                                        if let Some(images) = pin.get("images").and_then(|i| i.as_object()) {
                                            for size in &["originals", "736x", "474x", "236x"] {
                                                if let Some(img_info) = images.get(*size) {
                                                    if let Some(url) = img_info.get("url").and_then(|u| u.as_str()) {
                                                        image_url = Some(url.to_string());
                                                        break;
                                                    }
                                                }
                                            }
                                        }

                                        if let Some(img_url) = image_url {
                                            seen_ids.insert(pid.clone());
                                            // Track image hash for cross-dedup with regex fallback
                                            if let Some(ih) = img_url.rsplit('/').next().and_then(|f| f.split('.').next()) {
                                                seen_ids.insert(format!("imghash_{}", ih));
                                            }
                                            let video_url = find_video_url(pin).unwrap_or_else(|| img_url.clone());
                                            let thumbnail_url = pin.pointer("/images/236x/url")
                                                .and_then(|u| u.as_str())
                                                .map(|s| s.to_string())
                                                .unwrap_or_else(|| img_url.clone());

                                            results.push(VideoResult {
                                                id: pid.clone(),
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
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Regex fallback: extract unique pinimg image paths from entire HTML + JSON
            // This catches additional pins from related boards, suggestions, and JSON data
            let fallback_re = Regex::new(r#"i\.pinimg\.com\\?/(originals|736x|474x|236x|170x)\\?/([a-f0-9]{2})\\?/([a-f0-9]{2})\\?/([a-f0-9]{2})\\?/([a-f0-9]+)\.([a-z]{3,4})"#).unwrap();
            for cap in fallback_re.captures_iter(&raw_text) {
                let d1 = &cap[2];
                let d2 = &cap[3];
                let d3 = &cap[4];
                let hash = &cap[5];
                let ext = &cap[6];
                let dedup_key = format!("imghash_{}", hash);
                if seen_ids.contains(&dedup_key) {
                    continue;
                }
                seen_ids.insert(dedup_key.clone());
                let path = format!("{}/{}/{}/{}.{}", d1, d2, d3, hash, ext);
                results.push(VideoResult {
                    id: format!("pin_{}", hash),
                    video_url: format!("https://i.pinimg.com/originals/{}", path),
                    thumbnail_url: format!("https://i.pinimg.com/236x/{}", path),
                    local_path: String::new(),
                    duration: 0.0,
                    width: 1920,
                    height: 1080,
                    source: "pinterest".to_string(),
                    start_time: None,
                    end_time: None,
                });
            }
        }

        // Shuffling Pinterest results adds a great sense of variety!
        use rand::seq::SliceRandom;
        let mut rng = rand::thread_rng();
        results.shuffle(&mut rng);

        log::info!("[Pinterest] Found {} unique wallpapers (live & static)", results.len());
        Ok(results)
    }

    async fn download_video(&self, video: &VideoResult) -> Result<String, String> {
        let cache_dir = crate::wallpaper::desktop::get_cache_dir();
        // Try progressively smaller resolutions: originals → 736x → 474x → 236x
        let sizes = ["originals", "736x", "474x", "236x"];
        let base_url = video.video_url
            .replace("/originals/", "/{SIZE}/")
            .replace("/736x/", "/{SIZE}/")
            .replace("/474x/", "/{SIZE}/")
            .replace("/236x/", "/{SIZE}/");
        for size in &sizes {
            let url = base_url.replace("{SIZE}", size);
            match super::download_to_cache(&url, &video.id, "pinterest", &cache_dir, None).await {
                Ok(path) => return Ok(path),
                Err(e) => {
                    log::warn!("[Pinterest] Download at {} failed: {}", size, e);
                    continue;
                }
            }
        }
        Err("All Pinterest download attempts failed".to_string())
    }
}

#[cfg(test)]
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_pinterest_scrape() {
        let path = "../pinterest_fetched.html";
        if !std::path::Path::new(path).exists() {
            println!("File pinterest_fetched.html does not exist");
            return;
        }
        let raw_text = std::fs::read_to_string(path).unwrap();
        println!("Loaded file of size {}", raw_text.len());

        // Regex for <a href="/pin/ID/...> ... <img src="pinimg_url"...>
        // We'll search for pin links and see what images follow them within a reasonable distance
        let pin_re = Regex::new(r#"(?s)href="/pin/(\d+)/?".*?i\.pinimg\.com/([^"'\s>]+)"#).unwrap();
        let mut count = 0;
        for cap in pin_re.captures_iter(&raw_text) {
            let pin_id = cap[1].to_string();
            let img_path = cap[2].to_string();
            println!("Matched Pin: {} -> {}", pin_id, img_path);
            count += 1;
            if count >= 30 {
                break;
            }
        }
        println!("Total matched via regex: {}", count);
    }
}
