use std::net::TcpListener;
use std::io::{Read, Write};
use std::thread;
use crate::wallpaper::state::{AppStateStore, WallpaperState};
use crate::wallpaper;

pub fn start(state: AppStateStore) {
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
                            handle_request(&mut stream, &path, &state);
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

fn handle_request(stream: &mut std::net::TcpStream, path: &str, state: &AppStateStore) {
    let (status_code, response_body) = match path {
        "/status" => {
            let snapshot = state.snapshot();
            (200, serde_json::to_string_pretty(&snapshot).unwrap_or_default())
        }
        "/pause" => {
            let _ = wallpaper::desktop::set_paused(true);
            let _ = wallpaper::state::set_paused(state, true);
            (200, r#"{"status":"paused"}"#.to_string())
        }
        "/play" => {
            let _ = wallpaper::desktop::set_paused(false);
            let _ = wallpaper::state::set_paused(state, false);
            (200, r#"{"status":"playing"}"#.to_string())
        }
        "/toggle" => {
            let current = state.snapshot();
            let new_paused = !current.paused;
            let _ = wallpaper::desktop::set_paused(new_paused);
            let _ = wallpaper::state::set_paused(state, new_paused);
            (200, format!(r#"{{"status":"{}"}}"#, if new_paused { "paused" } else { "playing" }))
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
                    &video.local_path,
                    current.wallpaper_scale_percent,
                    current.volume_percent,
                    &current.video_filter,
                    false,
                    None,
                    None,
                );
                let _ = wallpaper::state::mark_active(state, video);
                (200, r#"{"status":"next"}"#.to_string())
            } else {
                (400, r#"{"error":"no_wallpapers"}"#.to_string())
            }
        }
        "/play_last" | "/start" => {
            let current = state.snapshot();
            if let Some(video) = current.current_video.as_ref().or_else(|| current.recents.first().map(|i| &i.video)) {
                let _ = wallpaper::desktop::set_video(
                    &video.local_path,
                    current.wallpaper_scale_percent,
                    current.volume_percent,
                    &current.video_filter,
                    false,
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
        _ => {
            (404, r#"{"error":"not_found"}"#.to_string())
        }
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
    let video_title = current_video.map(|v| v.id.clone()).unwrap_or_else(|| "None".to_string());
    let video_path = current_video.map(|v| v.local_path.clone()).unwrap_or_else(|| "".to_string());
    let video_thumbnail = current_video.map(|v| v.thumbnail_url.clone()).unwrap_or_else(|| "".to_string());
    
    let content = format!(
        "[Variables]\nOpenClaw_IsPlaying={}\nOpenClaw_Paused={}\nOpenClaw_Volume={}\nOpenClaw_VideoTitle={}\nOpenClaw_VideoPath={}\nOpenClaw_VideoThumbnail={}\n",
        if state.is_playing { 1 } else { 0 },
        if state.paused { 1 } else { 0 },
        state.volume_percent,
        video_title,
        video_path,
        video_thumbnail
    );

    let _ = std::fs::write(path, content);

    // Download Thumbnail if remote so Rainmeter reads a local file instantly
    let thumb_file_path = dir.join("current_thumbnail.jpg");
    if video_thumbnail.starts_with("http") {
        std::thread::spawn(move || {
            let client = reqwest::blocking::Client::new();
            if let Ok(resp) = client.get(&video_thumbnail).send() {
                if let Ok(bytes) = resp.bytes() {
                    let _ = std::fs::write(&thumb_file_path, bytes);
                    // Trigger Rainmeter to refresh the OpenClaw skin after download is complete
                    let _ = std::process::Command::new("powershell")
                        .args(&[
                            "-NoProfile",
                            "-Command",
                            "if (Get-Process Rainmeter -ErrorAction SilentlyContinue) { & 'C:\\Program Files\\Rainmeter\\Rainmeter.exe' !Refresh OpenClaw }"
                        ])
                        .spawn();
                }
            }
        });
    } else {
        // Trigger Rainmeter immediately if already local or empty
        let _ = std::process::Command::new("powershell")
            .args(&[
                "-NoProfile",
                "-Command",
                "if (Get-Process Rainmeter -ErrorAction SilentlyContinue) { & 'C:\\Program Files\\Rainmeter\\Rainmeter.exe' !Refresh OpenClaw }"
            ])
            .spawn();
    }
}
