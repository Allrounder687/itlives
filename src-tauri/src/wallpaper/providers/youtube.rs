//! YouTube provider — downloads a time-trimmed clip from YouTube using yt-dlp.
//! Requires yt-dlp and ffmpeg to be installed on the system PATH.

use super::{SearchConfig, VideoProvider, VideoResult};
use serde::Deserialize;
use std::process::Command;
use tauri::Emitter;

pub struct YouTubeProvider;

/// Metadata returned by `yt-dlp --dump-json`.
#[derive(Debug, Deserialize)]
pub struct YtMeta {
    pub id: String,
    #[allow(dead_code)]
    pub title: String,
    pub duration: Option<f64>,
    pub thumbnail: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

/// Check whether yt-dlp is available on the system.
fn find_ytdlp() -> Result<String, String> {
    if let Ok(out) = Command::new("where").arg("yt-dlp").output() {
        if out.status.success() {
            let path = String::from_utf8_lossy(&out.stdout)
                .lines()
                .next()
                .unwrap_or("")
                .trim()
                .to_string();
            if !path.is_empty() {
                return Ok(path);
            }
        }
    }

    for p in &[
        "C:\\Program Files\\yt-dlp\\yt-dlp.exe",
        "C:\\tools\\yt-dlp\\yt-dlp.exe",
    ] {
        if std::path::Path::new(p).exists() {
            return Ok(p.to_string());
        }
    }

    Err(
        "yt-dlp not found. Install it: winget install yt-dlp.yt-dlp  (or download from https://github.com/yt-dlp/yt-dlp/releases)"
            .to_string(),
    )
}

/// Fetch video metadata from YouTube without downloading.
pub fn fetch_metadata(url: &str) -> Result<YtMeta, String> {
    let ytdlp = find_ytdlp()?;

    let output = Command::new(&ytdlp)
        .args([
            "--dump-json",
            "--no-playlist",
            "--no-warnings",
            url,
        ])
        .output()
        .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp metadata fetch failed: {}", stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str::<YtMeta>(&stdout)
        .map_err(|e| format!("Failed to parse yt-dlp JSON: {}", e))
}

/// Download a time-trimmed clip to the cache directory with quality caps and progress streaming.
pub fn download_clip(
    url: &str,
    video_id: &str,
    start_secs: f64,
    end_secs: f64,
    max_height: u32,
    window: Option<&tauri::Window>,
) -> Result<String, String> {
    let ytdlp = find_ytdlp()?;
    let cache_dir = crate::wallpaper::desktop::get_cache_dir();
    std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;

    let safe_id = video_id
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .take(32)
        .collect::<String>();
    let filename = format!(
        "yt_{}_{:.0}_{:.0}_{}p.mp4",
        safe_id, start_secs, end_secs, max_height
    );
    let dest = cache_dir.join(&filename);

    if dest.exists() {
        if let Some(w) = window { let _ = w.emit("yt-progress", 100); }
        return Ok(dest.to_string_lossy().to_string());
    }

    let section_arg = format!("*{:.1}-{:.1}", start_secs, end_secs);
    let format_arg = format!(
        "bestvideo[height<={}][ext=mp4]+bestaudio[ext=m4a]/best[height<={}]/best",
        max_height, max_height
    );

    log::info!(
        "[YouTube] Downloading clip: {} section={} quality={}p",
        url, section_arg, max_height
    );

    use std::io::{BufRead, BufReader};
    use std::process::Stdio;

    let mut child = Command::new(&ytdlp)
        .args([
            "--no-playlist",
            "--no-warnings",
            "--download-sections",
            &section_arg,
            "-f",
            &format_arg,
            "--merge-output-format",
            "mp4",
            "--newline",
            "--progress",
            "-o",
            &dest.to_string_lossy(),
            url,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;

    if let Some(stderr) = child.stderr.take() {
        let w_clone = window.map(|w| w.clone());
        let clip_dur = if end_secs > start_secs { end_secs - start_secs } else { 1.0 };
        
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            // Split on \r (carriage return) instead of \n to capture incremental updates
            for chunk in reader.split(b'\r').filter_map(|c| c.ok()) {
                let line = String::from_utf8_lossy(&chunk);
                if let Some(w) = w_clone.as_ref() {
                    // Standard yt-dlp percent
                    if line.contains("[download]") && line.contains("%") {
                        if let Some(pct_str) = line.split_whitespace().find(|s| s.contains("%")) {
                            if let Ok(pct) = pct_str.replace("%", "").parse::<f64>() {
                                let _ = w.emit("yt-progress", pct as u32);
                            }
                        }
                    } 
                    // ffmpeg timestamp parser: "time=00:00:05.12"
                    else if line.contains("time=") {
                        if let Some(time_part) = line.split_whitespace().find(|s| s.starts_with("time=")) {
                            let ts_str = time_part.replace("time=", ""); // "00:00:05.12"
                            let hms: Vec<&str> = ts_str.split(':').collect();
                            if hms.len() >= 3 {
                                if let (Ok(h), Ok(m), Ok(s)) = (hms[0].parse::<f64>(), hms[1].parse::<f64>(), hms[2].parse::<f64>()) {
                                    let current_secs = (h * 3600.0) + (m * 60.0) + s;
                                    let pct = ((current_secs / clip_dur) * 100.0).min(100.0);
                                    let _ = w.emit("yt-progress", pct as u32);
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    let status = child.wait().map_err(|e| format!("yt-dlp wait failed: {}", e))?;

    if !status.success() {
        return Err("yt-dlp download failed".to_string());
    }

    if !dest.exists() {
        return Err("yt-dlp completed but output file was not created".to_string());
    }

    if let Some(w) = window { let _ = w.emit("yt-progress", 100); }

    log::info!(
        "[YouTube] Clip saved: {} ({} bytes)",
        dest.display(),
        std::fs::metadata(&dest).map(|m| m.len()).unwrap_or(0)
    );

    Ok(dest.to_string_lossy().to_string())
}

#[async_trait::async_trait]
impl VideoProvider for YouTubeProvider {
    fn name(&self) -> &str {
        "YouTube"
    }

    async fn fetch_video(&self, config: &SearchConfig) -> Result<VideoResult, String> {
        let url = &config.query;
        if url.is_empty() {
            return Err("No YouTube URL provided.".to_string());
        }

        let meta = tokio::task::spawn_blocking({
            let url = url.clone();
            move || fetch_metadata(&url)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))??;

        Ok(VideoResult {
            id: meta.id,
            video_url: config.query.clone(),
            thumbnail_url: meta.thumbnail.unwrap_or_default(),
            local_path: String::new(), // Not downloaded yet
            duration: meta.duration.unwrap_or(0.0),
            width: meta.width.unwrap_or(1920),
            height: meta.height.unwrap_or(1080),
            source: "youtube".to_string(),
            start_time: None,
            end_time: None,
        })
    }

    async fn fetch_videos_list(
        &self,
        config: &SearchConfig,
    ) -> Result<Vec<VideoResult>, String> {
        self.fetch_video(config).await.map(|v| vec![v])
    }

    async fn download_video(&self, video: &VideoResult) -> Result<String, String> {
        // If already downloaded, return
        if !video.local_path.is_empty()
            && std::path::Path::new(&video.local_path).exists()
        {
            return Ok(video.local_path.clone());
        }

        let start = video.start_time.unwrap_or(0.0);
        let end = video
            .end_time
            .unwrap_or(video.duration)
            .max(start + 1.0);

        let url = video.video_url.clone();
        let vid_id = video.id.clone();
        tokio::task::spawn_blocking(move || download_clip(&url, &vid_id, start, end, 1080, None))
            .await
            .map_err(|e| format!("Task join error: {}", e))?
    }
}
