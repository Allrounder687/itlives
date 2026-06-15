use crate::wallpaper;
use crate::wallpaper::state::{AppStateStore, WallpaperState};
use std::io::{Read, Write};
use std::net::TcpListener;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::thread;

pub fn start(state: AppStateStore, app: tauri::AppHandle) {
    thread::spawn(move || {
        let listener = TcpListener::bind("127.0.0.1:3030");
        if let Err(e) = listener {
            log::error!("[API] Failed to bind to port 3030: {}", e);
            return;
        }
        let listener = listener.unwrap();
        log::info!("[API] Integration server listening on 127.0.0.1:3030");

        for stream in listener.incoming() {
            match stream {
                Ok(mut stream) => {
                    let mut buffer = [0; 1024];
                    if let Ok(bytes_read) = stream.read(&mut buffer) {
                        let request = String::from_utf8_lossy(&buffer[..bytes_read]);
                        if let Some(path) = parse_request_path(&request) {
                            handle_request(&mut stream, &path, &state, app.clone());
                        }
                    }
                }
                Err(e) => {
                    log::error!("[API] Stream error: {}", e);
                }
            }
        }
    });
}

fn parse_request_path(request: &str) -> Option<String> {
    let mut lines = request.lines();
    if let Some(first_line) = lines.next() {
        let mut parts = first_line.split_whitespace();
        if let Some("GET") = parts.next() {
            if let Some(path) = parts.next() {
                return Some(path.to_string());
            }
        }
    }
    None
}

fn handle_request(
    stream: &mut std::net::TcpStream,
    path: &str,
    state: &AppStateStore,
    app: tauri::AppHandle,
) {
    let (url_path, query) = match path.find('?') {
        Some(i) => (&path[..i], Some(&path[i + 1..])),
        None => (path, None),
    };

    let (status_code, response_body) = match url_path {
        "/status" => {
            let snapshot = state.snapshot();
            (
                200,
                serde_json::to_string_pretty(&snapshot).unwrap_or_default(),
            )
        }
        "/set" => {
            let mut set_path = None;
            if let Some(q) = query {
                for pair in q.split('&') {
                    if pair.starts_with("path=") {
                        let encoded = &pair[5..];
                        if let Ok(decoded) = urlencoding::decode(encoded) {
                            set_path = Some(decoded.into_owned());
                        }
                    }
                }
            }

            if let Some(video_path) = set_path {
                let current = state.snapshot();
                let _ = crate::wallpaper::desktop::set_video(
                    app.clone(),
                    &video_path,
                    current.wallpaper_scale_percent,
                    current.volume_percent,
                    &current.video_filter,
                    current.playback_speed,
                    current.blur_strength,
                    false,
                    None,
                    None,
                    None,
                );
                
                let video = crate::wallpaper::providers::VideoResult {
                    id: std::path::Path::new(&video_path)
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("local_video")
                        .to_string(),
                    video_url: video_path.clone(),
                    thumbnail_url: video_path.clone(),
                    local_path: video_path.clone(),
                    duration: 0.0,
                    width: 1920,
                    height: 1080,
                    source: "local".to_string(),
                    start_time: None,
                    end_time: None,
                    tags: None,
                };
                let _ = crate::wallpaper::state::mark_active(state, video);
                (200, r#"{"status":"set"}"#.to_string())
            } else {
                (400, r#"{"error":"missing_path"}"#.to_string())
            }
        }
        "/set_source" => {
            let mut set_val = None;
            if let Some(q) = query {
                for pair in q.split('&') {
                    if pair.starts_with("val=") {
                        let encoded = &pair[4..];
                        if let Ok(decoded) = urlencoding::decode(encoded) {
                            set_val = Some(decoded.into_owned());
                        }
                    }
                }
            }

            if let Some(val) = set_val {
                let _ = crate::wallpaper::state::set_slideshow_source(state, val);
                (200, r#"{"status":"source_set"}"#.to_string())
            } else {
                (400, r#"{"error":"missing_val"}"#.to_string())
            }
        }
        "/set_provider" => {
            let mut set_val = None;
            if let Some(q) = query {
                for pair in q.split('&') {
                    if pair.starts_with("val=") {
                        let encoded = &pair[4..];
                        if let Ok(decoded) = urlencoding::decode(encoded) {
                            set_val = Some(decoded.into_owned());
                        }
                    }
                }
            }

            if let Some(val) = set_val {
                let _ = crate::wallpaper::state::set_discover_provider(state, val);
                (200, r#"{"status":"provider_set"}"#.to_string())
            } else {
                (400, r#"{"error":"missing_val"}"#.to_string())
            }
        }
        "/pause" => {
            let _ = wallpaper::desktop::set_paused(&app, true);
            let _ = wallpaper::state::set_paused(state, true);
            (200, r#"{"status":"paused"}"#.to_string())
        }
        "/play" => {
            let _ = wallpaper::desktop::set_paused(&app, false);
            let _ = wallpaper::state::set_paused(state, false);
            (200, r#"{"status":"playing"}"#.to_string())
        }
        "/toggle" => {
            let current = state.snapshot();
            let new_paused = !current.paused;
            let _ = wallpaper::desktop::set_paused(&app, new_paused);
            let _ = wallpaper::state::set_paused(state, new_paused);
            (
                200,
                format!(
                    r#"{{"status":"{}"}}"#,
                    if new_paused { "paused" } else { "playing" }
                ),
            )
        }
        "/next" => {
            let current = state.snapshot();
            let mut next_video = None;

            if let Ok(advanced) = wallpaper::state::advance_queue(state) {
                next_video = Some(advanced.video);
            } else if !current.recents.is_empty() {
                use rand::Rng;
                let mut rng = rand::thread_rng();
                let index = rng.gen_range(0..current.recents.len());
                next_video = Some(current.recents[index].video.clone());
            } else if !current.imports.is_empty() {
                use rand::Rng;
                let mut rng = rand::thread_rng();
                let index = rng.gen_range(0..current.imports.len());
                next_video = Some(current.imports[index].video.clone());
            }

            if let Some(video) = next_video {
                let _ = wallpaper::desktop::set_video(
                    app.clone(),
                    &video.local_path,
                    current.wallpaper_scale_percent,
                    current.volume_percent,
                    &current.video_filter,
                    current.playback_speed,
                    current.blur_strength,
                    false,
                    None,
                    None,
                    None,
                );
                let _ = wallpaper::state::mark_active(state, video);
                (200, r#"{"status":"next"}"#.to_string())
            } else {
                (400, r#"{"error":"no_wallpapers"}"#.to_string())
            }
        }
        "/prev" => {
            let current = state.snapshot();
            let mut prev_video = None;

            if let Ok(retreated) = wallpaper::state::retreat_queue(state) {
                prev_video = Some(retreated.video);
            } else if current.recents.len() > 1 {
                prev_video = Some(current.recents[1].video.clone());
            } else if !current.recents.is_empty() {
                prev_video = Some(current.recents[0].video.clone());
            }

            if let Some(video) = prev_video {
                let _ = wallpaper::desktop::set_video(
                    app.clone(),
                    &video.local_path,
                    current.wallpaper_scale_percent,
                    current.volume_percent,
                    &current.video_filter,
                    current.playback_speed,
                    current.blur_strength,
                    false,
                    None,
                    None,
                    None,
                );
                let _ = wallpaper::state::mark_active(state, video);
                (200, r#"{"status":"prev"}"#.to_string())
            } else {
                (400, r#"{"error":"no_wallpapers"}"#.to_string())
            }
        }
        "/play_last" | "/start" => {
            let current = state.snapshot();
            if let Some(video) = current
                .current_video
                .as_ref()
                .or_else(|| current.recents.first().map(|i| &i.video))
            {
                let _ = wallpaper::desktop::set_video(
                    app.clone(),
                    &video.local_path,
                    current.wallpaper_scale_percent,
                    current.volume_percent,
                    &current.video_filter,
                    current.playback_speed,
                    current.blur_strength,
                    false,
                    None,
                    None,
                    None,
                );
                let _ = wallpaper::state::mark_active(state, video.clone());
                (200, r#"{"status":"started"}"#.to_string())
            } else {
                (400, r#"{"error":"no_recent_video"}"#.to_string())
            }
        }
        "/stop" => {
            let _ = wallpaper::desktop::stop_video();
            let _ = wallpaper::state::clear_active(state);
            (200, r#"{"status":"stopped"}"#.to_string())
        }
        _ => (404, r#"{"error":"not_found"}"#.to_string()),
    };

    let response = format!(
        "HTTP/1.1 {} OK\r\nContent-Type: application/json\r\nConnection: close\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
        status_code, response_body
    );
    let _ = stream.write_all(response.as_bytes());
}

pub fn save_rainmeter_inc(state: &WallpaperState) {
    let dir = crate::wallpaper::desktop::app_data_dir();
    let path = dir.join("rainmeter_state.inc");

    let current_video = state.current_video.as_ref();
    let video_title = current_video
        .map(|v| v.id.clone())
        .unwrap_or_else(|| "None".to_string());
    let video_path = current_video
        .map(|v| v.local_path.clone())
        .unwrap_or_else(|| "".to_string());
    let video_thumbnail = current_video
        .map(|v| v.thumbnail_url.clone())
        .unwrap_or_else(|| "".to_string());

    let mut next_title = "Random (Shuffle)".to_string();
    let mut next_thumb = "".to_string();
    
    if !state.queue.is_empty() {
        let index = state.queue_cursor % state.queue.len();
        next_title = state.queue[index].video.id.clone();
        next_thumb = state.queue[index].video.thumbnail_url.clone();
    }

    let mut prev_video = None;
    if !state.queue.is_empty() {
        let len = state.queue.len();
        let index = if len == 1 {
            0
        } else {
            (state.queue_cursor + len - 2) % len
        };
        prev_video = Some(state.queue[index].video.clone());
    } else if state.recents.len() > 1 {
        prev_video = Some(state.recents[1].video.clone());
    } else if !state.recents.is_empty() {
        prev_video = Some(state.recents[0].video.clone());
    }

    let prev_title = prev_video.as_ref().map(|v| v.id.clone()).unwrap_or_else(|| "None".to_string());
    let prev_thumb = prev_video.as_ref().map(|v| v.thumbnail_url.clone()).unwrap_or_else(|| "".to_string());

    let thumb_file_path = dir.join("current_thumbnail.jpg");
    let next_file_path = dir.join("next_thumbnail.jpg");
    let prev_file_path = dir.join("prev_thumbnail.jpg");

    let resolve_thumb = |url: &str, path: &str, target_path: &std::path::PathBuf| -> String {
        if url.starts_with("http") {
            target_path.to_string_lossy().into_owned()
        } else if !url.is_empty() {
            url.to_string()
        } else if path.to_lowercase().ends_with(".html") {
            // For web wallpapers, fallback to preview.jpg or preview.gif in same dir
            let p = std::path::Path::new(path);
            if let Some(parent) = p.parent() {
                let jpg = parent.join("preview.jpg");
                if jpg.exists() {
                    return jpg.to_string_lossy().into_owned();
                }
                let gif = parent.join("preview.gif");
                if gif.exists() {
                    return gif.to_string_lossy().into_owned();
                }
            }
            "".to_string()
        } else if path.to_lowercase().ends_with(".jpg") 
               || path.to_lowercase().ends_with(".png") 
               || path.to_lowercase().ends_with(".jpeg") 
               || path.to_lowercase().ends_with(".webp") {
            // For static images, the image itself is the thumbnail
            path.to_string()
        } else {
            "".to_string()
        }
    };

    let actual_video_thumb = resolve_thumb(&video_thumbnail, &video_path, &thumb_file_path);
    
    let next_path = if !state.queue.is_empty() {
        let index = state.queue_cursor % state.queue.len();
        state.queue[index].video.local_path.clone()
    } else {
        "".to_string()
    };
    let actual_next_thumb = resolve_thumb(&next_thumb, &next_path, &next_file_path);

    let prev_path = prev_video.as_ref().map(|v| v.local_path.clone()).unwrap_or_else(|| "".to_string());
    let actual_prev_thumb = resolve_thumb(&prev_thumb, &prev_path, &prev_file_path);

    let content = format!(
        "[Variables]\nitLives_IsPlaying={}\nitLives_Paused={}\nitLives_Volume={}\nitLives_VideoTitle={}\nitLives_VideoPath={}\nitLives_VideoThumbnail={}\nitLives_NextVideoTitle={}\nitLives_NextVideoThumbnail={}\nitLives_PrevVideoTitle={}\nitLives_PrevVideoThumbnail={}\n",
        if state.is_playing { 1 } else { 0 },
        if state.paused { 1 } else { 0 },
        state.volume_percent,
        video_title,
        video_path,
        actual_video_thumb,
        next_title,
        actual_next_thumb,
        prev_title,
        actual_prev_thumb
    );

    let _ = std::fs::write(&path, content);

    std::thread::spawn(move || {
        let client = reqwest::blocking::Client::new();
        
        let mut final_thumb_path = actual_video_thumb.clone();
        if video_thumbnail.starts_with("http") {
            if let Ok(resp) = client.get(&video_thumbnail).send() {
                if let Ok(bytes) = resp.bytes() {
                    let _ = std::fs::write(&thumb_file_path, bytes);
                    final_thumb_path = thumb_file_path.to_string_lossy().into_owned();
                }
            }
        } else {
            let _ = std::fs::remove_file(&thumb_file_path);
        }
        
        if next_thumb.starts_with("http") {
            if let Ok(resp) = client.get(&next_thumb).send() {
                if let Ok(bytes) = resp.bytes() {
                    let _ = std::fs::write(&next_file_path, bytes);
                }
            }
        } else {
            let _ = std::fs::remove_file(&next_file_path);
        }
        
        if prev_thumb.starts_with("http") {
            if let Ok(resp) = client.get(&prev_thumb).send() {
                if let Ok(bytes) = resp.bytes() {
                    let _ = std::fs::write(&prev_file_path, bytes);
                }
            }
        } else {
            let _ = std::fs::remove_file(&prev_file_path);
        }

        // Extract Dominant Color
        let mut theme_color = "255,170,0,255".to_string(); // Default orange
        if let Ok(img) = image::open(&final_thumb_path) {
            let img = img.resize(64, 64, image::imageops::FilterType::Nearest).into_rgb8();
            let (mut r_sum, mut g_sum, mut b_sum, mut count) = (0u64, 0u64, 0u64, 0u64);
            for pixel in img.pixels() {
                let (r, g, b) = (pixel[0] as u64, pixel[1] as u64, pixel[2] as u64);
                // Exclude pure black/white to find the accent color
                if (r > 15 || g > 15 || b > 15) && (r < 240 || g < 240 || b < 240) {
                    r_sum += r; g_sum += g; b_sum += b; count += 1;
                }
            }
            if count > 0 {
                // Boost saturation slightly by stretching contrast around the mean
                theme_color = format!("{},{},{},255", r_sum / count, g_sum / count, b_sum / count);
            }
        }

        // Append Theme Color to inc file so Rainmeter picks it up
        use std::io::Write;
        if let Ok(mut file) = std::fs::OpenOptions::new().append(true).open(&path) {
            let _ = writeln!(file, "itLives_ThemeColor={}", theme_color);
        }

        let mut cmd = std::process::Command::new("powershell");
        cmd.args(&[
            "-NoProfile",
            "-Command",
            "if (Get-Process Rainmeter -ErrorAction SilentlyContinue) { & 'C:\\Program Files\\Rainmeter\\Rainmeter.exe' !Refresh itlives_LiveWallpaper }"
        ]);
        #[cfg(windows)]
        cmd.creation_flags(0x08000000);
        let _ = cmd.spawn();
    });
}
