//! Direct URL provider — plays any .mp4 URL or local video file as wallpaper.
//! This is the simplest provider: just pass a URL or file path.

use std::path::Path;

use super::{download_to_cache, SearchConfig, VideoProvider, VideoResult};

pub struct DirectUrlProvider;

#[async_trait::async_trait]
impl VideoProvider for DirectUrlProvider {
    fn name(&self) -> &str {
        "Direct URL"
    }

    async fn fetch_video(&self, config: &SearchConfig) -> Result<VideoResult, String> {
        let url = &config.query;

        if url.is_empty() {
            return Err("No URL provided. Pass a .mp4 URL or local file path.".to_string());
        }

        // Check if it's a local file
        let is_local = url.starts_with("file://")
            || url.starts_with("\\\\")
            || Path::new(url).is_absolute()
            || url.chars().nth(1) == Some(':');

        if is_local {
            let clean_path = url
                .strip_prefix("file:///")
                .or_else(|| url.strip_prefix("file://"))
                .unwrap_or(url)
                .to_string();
            if !Path::new(&clean_path).exists() {
                return Err(format!("Local file not found: {}", clean_path));
            }
            return Ok(VideoResult {
                id: format!("local_{}", chrono_id()),
                video_url: clean_path.clone(),
                thumbnail_url: String::new(),
                local_path: clean_path,
                duration: 0.0,
                width: 0,
                height: 0,
                source: "direct".to_string(),
                start_time: None,
                end_time: None,
                tags: None,
            });
        }

        // Remote URL — download to cache
        let video_id = url
            .split('/')
            .last()
            .unwrap_or("video")
            .replace(".mp4", "")
            .chars()
            .take(32)
            .collect::<String>();

        let cache_dir = crate::wallpaper::desktop::get_cache_dir();
        let local_path =
            download_to_cache(url, &video_id, "direct", &cache_dir, None, None).await?;

        Ok(VideoResult {
            id: video_id,
            video_url: url.clone(),
            thumbnail_url: String::new(),
            local_path,
            duration: 0.0,
            width: 0,
            height: 0,
            source: "direct".to_string(),
            start_time: None,
            end_time: None,
            tags: None,
        })
    }

    async fn fetch_videos_list(&self, config: &SearchConfig) -> Result<Vec<VideoResult>, String> {
        self.fetch_video(config).await.map(|v| vec![v])
    }

    async fn download_video(
        &self,
        video: &VideoResult,
        app_handle: Option<tauri::AppHandle>,
    ) -> Result<String, String> {
        // Direct Provider has local files or direct URLs download already cache saved index paths.
        if !video.local_path.is_empty() && std::path::Path::new(&video.local_path).exists() {
            return Ok(video.local_path.clone());
        }

        let is_local = video.video_url.starts_with("file://")
            || video.video_url.starts_with("\\\\")
            || std::path::Path::new(&video.video_url).is_absolute()
            || video.video_url.chars().nth(1) == Some(':');

        if is_local {
            return Ok(video.video_url.clone());
        }

        let cache_dir = crate::wallpaper::desktop::get_cache_dir();
        super::download_to_cache(
            &video.video_url,
            &video.id,
            "direct",
            &cache_dir,
            None,
            app_handle,
        )
        .await
    }
}

fn chrono_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}
