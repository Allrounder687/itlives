//! YouTube provider — downloads a time-trimmed clip from YouTube using yt-dlp.
//! Requires yt-dlp and ffmpeg to be installed on the system PATH.

use super::{SearchConfig, VideoProvider, VideoResult};
use serde::Deserialize;
use std::process::Command;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
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

/// Helper to scan directories recursively for a specific executable.
fn find_in_dir_recursive(dir: &std::path::Path, filename: &str, depth: usize, max_depth: usize) -> Option<std::path::PathBuf> {
    if depth > max_depth {
        return None;
    }
    if let Ok(entries) = std::fs::read_dir(dir) {
        let mut subdirs = Vec::new();
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_file() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.eq_ignore_ascii_case(filename) {
                        return Some(path);
                    }
                }
            } else if path.is_dir() {
                subdirs.push(path);
            }
        }
        for subdir in subdirs {
            if let Some(found) = find_in_dir_recursive(&subdir, filename, depth + 1, max_depth) {
                return Some(found);
            }
        }
    }
    None
}

/// Helper to check Winget Packages directory recursively for a specific binary.
fn find_in_winget_packages(filename: &str) -> Option<std::path::PathBuf> {
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let winget_dir = std::path::PathBuf::from(local_app_data)
            .join("Microsoft")
            .join("WinGet")
            .join("Packages");
        if winget_dir.exists() {
            if let Some(p) = find_in_dir_recursive(&winget_dir, filename, 0, 4) {
                return Some(p);
            }
        }
    }
    if let Ok(user_profile) = std::env::var("USERPROFILE") {
        let winget_dir = std::path::PathBuf::from(user_profile)
            .join("AppData")
            .join("Local")
            .join("Microsoft")
            .join("WinGet")
            .join("Packages");
        if winget_dir.exists() {
            if let Some(p) = find_in_dir_recursive(&winget_dir, filename, 0, 4) {
                return Some(p);
            }
        }
    }
    None
}

/// Helper to check Winget Links directory for a specific binary.
fn find_in_winget_links(filename: &str) -> Option<std::path::PathBuf> {
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let links_dir = std::path::PathBuf::from(local_app_data)
            .join("Microsoft")
            .join("WinGet")
            .join("Links");
        let p = links_dir.join(filename);
        if p.exists() {
            return Some(p);
        }
    }
    if let Ok(user_profile) = std::env::var("USERPROFILE") {
        let links_dir = std::path::PathBuf::from(user_profile)
            .join("AppData")
            .join("Local")
            .join("Microsoft")
            .join("WinGet")
            .join("Links");
        let p = links_dir.join(filename);
        if p.exists() {
            return Some(p);
        }
    }
    None
}

#[cfg(windows)]
fn parse_reg_path_output(stdout: &str) -> Option<String> {
    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("Path") {
            if let Some(pos) = trimmed.find("REG_SZ") {
                return Some(trimmed[pos + 6..].trim().to_string());
            } else if let Some(pos) = trimmed.find("REG_EXPAND_SZ") {
                return Some(trimmed[pos + 13..].trim().to_string());
            }
        }
    }
    None
}

#[cfg(windows)]
fn expand_path_var(raw_path: &str) -> String {
    let mut expanded = raw_path.to_string();
    let vars = &[
        ("USERPROFILE", "USERPROFILE"),
        ("LOCALAPPDATA", "LOCALAPPDATA"),
        ("LocalAppData", "LOCALAPPDATA"),
        ("APPDATA", "APPDATA"),
        ("SystemDrive", "SystemDrive"),
        ("SystemRoot", "SystemRoot"),
        ("windir", "SystemRoot"),
        ("ProgramFiles", "ProgramFiles"),
    ];
    for &(placeholder, env_name) in vars {
        let pattern = format!("%{}%", placeholder);
        if expanded.contains(&pattern) {
            if let Ok(val) = std::env::var(env_name) {
                expanded = expanded.replace(&pattern, &val);
            }
        }
    }
    expanded
}

#[cfg(windows)]
fn find_in_registry_path(filename: &str) -> Option<std::path::PathBuf> {
    let mut paths_to_check = Vec::new();
    
    // Query User PATH from HKCU
    let mut cmd_user = Command::new("reg");
    cmd_user.args(&["query", "HKCU\\Environment", "/v", "Path"]);
    cmd_user.creation_flags(0x08000000);
    if let Ok(output) = cmd_user.output() {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Some(path_val) = parse_reg_path_output(&stdout) {
                paths_to_check.push(path_val);
            }
        }
    }
    
    // Query System PATH from HKLM
    let mut cmd_sys = Command::new("reg");
    cmd_sys.args(&["query", "HKLM\\System\\CurrentControlSet\\Control\\Session Manager\\Environment", "/v", "Path"]);
    cmd_sys.creation_flags(0x08000000);
    if let Ok(output) = cmd_sys.output() {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Some(path_val) = parse_reg_path_output(&stdout) {
                paths_to_check.push(path_val);
            }
        }
    }

    for path_str in paths_to_check {
        let expanded = expand_path_var(&path_str);
        for dir in expanded.split(';') {
            let trimmed = dir.trim();
            if trimmed.is_empty() {
                continue;
            }
            let p = std::path::PathBuf::from(trimmed).join(filename);
            if p.exists() {
                return Some(p);
            }
        }
    }
    
    None
}

#[cfg(not(windows))]
fn find_in_registry_path(_filename: &str) -> Option<std::path::PathBuf> {
    None
}

static YTDLP_PATH_CACHE: std::sync::OnceLock<String> = std::sync::OnceLock::new();
static FFMPEG_PATH_CACHE: std::sync::OnceLock<std::path::PathBuf> = std::sync::OnceLock::new();

/// Check whether yt-dlp is available on the system.
pub fn find_ytdlp() -> Result<String, String> {
    if let Some(cached) = YTDLP_PATH_CACHE.get() {
        return Ok(cached.clone());
    }

    let path = find_ytdlp_uncached()?;
    let _ = YTDLP_PATH_CACHE.set(path.clone());
    Ok(path)
}

fn find_ytdlp_uncached() -> Result<String, String> {
    // 1. Check local app data bin directory first (Tauri runtime context)
    let local_path = crate::wallpaper::desktop::app_data_dir().join("bin").join("yt-dlp.exe");
    if local_path.exists() {
        return Ok(local_path.to_string_lossy().to_string());
    }

    // 2. Check hardcoded fallback local app data path directly (using LOCALAPPDATA env var)
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let p = std::path::PathBuf::from(local_app_data).join("OpenClaw_LWP").join("bin").join("yt-dlp.exe");
        if p.exists() {
            return Ok(p.to_string_lossy().to_string());
        }
    }

    // 3. Check Winget Links directory
    if let Some(p) = find_in_winget_links("yt-dlp.exe") {
        return Ok(p.to_string_lossy().to_string());
    }

    // 4. Check Winget Packages directory recursively
    if let Some(p) = find_in_winget_packages("yt-dlp.exe") {
        return Ok(p.to_string_lossy().to_string());
    }

    // 5. Check Registry PATH (bypasses active process-level PATH caching!)
    if let Some(p) = find_in_registry_path("yt-dlp.exe") {
        return Ok(p.to_string_lossy().to_string());
    }

    // 6. Check active process PATH using 'where' command
    if let Ok(out) = {
        let mut cmd = Command::new("where");
        cmd.arg("yt-dlp");
        #[cfg(windows)]
        cmd.creation_flags(0x08000000);
        cmd.output()
    } {
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

    // 7. Check common static installation paths
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

/// Find ffmpeg executable on the system, checking local folders, PATH, standard installation sites, and Winget packages.
pub fn find_ffmpeg() -> Option<std::path::PathBuf> {
    if let Some(cached) = FFMPEG_PATH_CACHE.get() {
        return Some(cached.clone());
    }

    let path = find_ffmpeg_uncached()?;
    let _ = FFMPEG_PATH_CACHE.set(path.clone());
    Some(path)
}

fn find_ffmpeg_uncached() -> Option<std::path::PathBuf> {
    // 1. Check local app data bin directory first (Tauri runtime context)
    let local_path = crate::wallpaper::desktop::app_data_dir().join("bin").join("ffmpeg.exe");
    if local_path.exists() {
        return Some(local_path);
    }

    // 2. Check hardcoded fallback local app data path directly (using LOCALAPPDATA env var)
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let p = std::path::PathBuf::from(local_app_data).join("OpenClaw_LWP").join("bin").join("ffmpeg.exe");
        if p.exists() {
            return Some(p);
        }
    }

    // 3. Check Winget Links directory
    if let Some(p) = find_in_winget_links("ffmpeg.exe") {
        return Some(p);
    }

    // 4. Check Winget Packages directory recursively (finds Gyan.FFmpeg or other packages!)
    if let Some(p) = find_in_winget_packages("ffmpeg.exe") {
        return Some(p);
    }

    // 5. Check Registry PATH (bypasses active process-level PATH caching!)
    if let Some(p) = find_in_registry_path("ffmpeg.exe") {
        return Some(p);
    }

    // 6. Check active process PATH using 'where' command
    if let Ok(out) = {
        let mut cmd = Command::new("where");
        cmd.arg("ffmpeg");
        #[cfg(windows)]
        cmd.creation_flags(0x08000000);
        cmd.output()
    } {
        if out.status.success() {
            let path = String::from_utf8_lossy(&out.stdout)
                .lines()
                .next()
                .unwrap_or("")
                .trim()
                .to_string();
            if !path.is_empty() {
                let p = std::path::PathBuf::from(path);
                if p.exists() {
                    return Some(p);
                }
            }
        }
    }

    // 7. Check common Gyan.FFmpeg and standard installation paths on Windows
    let common_paths = &[
        "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
        "C:\\Program Files\\ffmpeg\\ffmpeg.exe",
        "C:\\Program Files\\Gyan.FFmpeg\\bin\\ffmpeg.exe",
        "C:\\Program Files\\Gyan.FFmpeg\\ffmpeg.exe",
        "C:\\Program Files\\GyanFFmpeg\\bin\\ffmpeg.exe",
        "C:\\tools\\ffmpeg\\bin\\ffmpeg.exe",
    ];

    for p in common_paths {
        let path = std::path::PathBuf::from(p);
        if path.exists() {
            return Some(path);
        }
    }

    None
}

/// Fetch video metadata from YouTube without downloading.
pub fn fetch_metadata(url: &str) -> Result<YtMeta, String> {
    let ytdlp = find_ytdlp()?;

    let mut cmd = Command::new(&ytdlp);
    cmd.args([
        "--dump-json",
        "--no-playlist",
        "--no-warnings",
        url,
    ]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);

    let output = cmd.output()
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

    let mut cmd = Command::new(&ytdlp);

    // Inject ffmpeg's parent directory into the PATH for this command so yt-dlp can locate it without rebooting!
    if let Some(ffmpeg_path) = find_ffmpeg() {
        if let Some(ffmpeg_dir) = ffmpeg_path.parent() {
            if let Ok(current_path) = std::env::var("PATH") {
                let new_path = format!("{};{}", ffmpeg_dir.to_string_lossy(), current_path);
                cmd.env("PATH", new_path);
            }
        }
    }

    cmd.args([
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
    ]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);

    let mut child = cmd.stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;

    use std::sync::{Arc, Mutex};
    let error_lines = Arc::new(Mutex::new(Vec::<String>::new()));

    if let Some(stdout) = child.stdout.take() {
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for _ in reader.lines() {} // Consume stdout to prevent pipe block
        });
    }

    if let Some(stderr) = child.stderr.take() {
        let w_clone = window.map(|w| w.clone());
        let clip_dur = if end_secs > start_secs { end_secs - start_secs } else { 1.0 };
        let err_clone = error_lines.clone();
        
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            // Split on \r (carriage return) instead of \n to capture incremental updates
            for chunk in reader.split(b'\r').filter_map(|c| c.ok()) {
                let line = String::from_utf8_lossy(&chunk);
                
                // Track all lines in our thread-safe error buffer for debugging
                let trimmed = line.trim().to_string();
                if !trimmed.is_empty() {
                    if let Ok(mut g) = err_clone.lock() {
                        g.push(trimmed);
                    }
                }

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
        let errs = if let Ok(g) = error_lines.lock() {
            let len = g.len();
            let start = if len > 5 { len - 5 } else { 0 };
            g[start..].join("\n")
        } else {
            String::new()
        };
        
        let msg = if errs.is_empty() {
            "yt-dlp download failed".to_string()
        } else {
            format!("yt-dlp download failed: {}", errs)
        };
        
        return Err(msg);
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
            tags: None,
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
