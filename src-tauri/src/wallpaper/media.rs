use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
use tauri::{AppHandle, Emitter};
use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager;
use windows::Storage::Streams::DataReader;

lazy_static::lazy_static! {
    static ref MEDIA_POLLING: Arc<AtomicBool> = Arc::new(AtomicBool::new(false));
}

#[derive(serde::Serialize, Clone, Default, PartialEq)]
pub struct MediaInfo {
    title: String,
    artist: String,
    album: String,
    is_playing: bool,
    thumbnail_base64: Option<String>,
}

#[derive(serde::Serialize, Clone, Default, PartialEq)]
pub struct MediaTimeline {
    position: f64,
    start_time: f64,
    end_time: f64,
}

#[tauri::command]
pub fn media_play_pause() -> Result<(), String> {
    if let Ok(manager) = GlobalSystemMediaTransportControlsSessionManager::RequestAsync().and_then(|op| op.get()) {
        if let Ok(session) = manager.GetCurrentSession() {
            let _ = session.TryTogglePlayPauseAsync();
        }
    }
    Ok(())
}

#[tauri::command]
pub fn media_next() -> Result<(), String> {
    if let Ok(manager) = GlobalSystemMediaTransportControlsSessionManager::RequestAsync().and_then(|op| op.get()) {
        if let Ok(session) = manager.GetCurrentSession() {
            let _ = session.TrySkipNextAsync();
        }
    }
    Ok(())
}

#[tauri::command]
pub fn media_prev() -> Result<(), String> {
    if let Ok(manager) = GlobalSystemMediaTransportControlsSessionManager::RequestAsync().and_then(|op| op.get()) {
        if let Ok(session) = manager.GetCurrentSession() {
            let _ = session.TrySkipPreviousAsync();
        }
    }
    Ok(())
}

#[tauri::command]
pub fn media_seek(position: f64) -> Result<(), String> {
    if let Ok(manager) = GlobalSystemMediaTransportControlsSessionManager::RequestAsync().and_then(|op| op.get()) {
        if let Ok(session) = manager.GetCurrentSession() {
            let ticks = (position * 10_000_000.0) as i64;
            let _ = session.TryChangePlaybackPositionAsync(ticks);
        }
    }
    Ok(())
}

pub fn init_media_polling(app_handle: AppHandle) {
    if MEDIA_POLLING.load(Ordering::SeqCst) {
        return;
    }
    MEDIA_POLLING.store(true, Ordering::SeqCst);
    
    std::thread::spawn(move || {
        let mut last_info = MediaInfo::default();
        let mut last_timeline = MediaTimeline::default();

        loop {
            if !MEDIA_POLLING.load(Ordering::SeqCst) { break; }
            
            if let Ok(manager) = GlobalSystemMediaTransportControlsSessionManager::RequestAsync().and_then(|op| op.get()) {
                if let Ok(session) = manager.GetCurrentSession() {
                    // Get Timeline
                    if let Ok(timeline) = session.GetTimelineProperties() {
                        let t_start = timeline.StartTime().map(|t| t.Duration as f64 / 10_000_000.0).unwrap_or(0.0);
                        let t_end = timeline.EndTime().map(|t| t.Duration as f64 / 10_000_000.0).unwrap_or(0.0);
                        let t_pos = timeline.Position().map(|t| t.Duration as f64 / 10_000_000.0).unwrap_or(0.0);
                        
                        let new_timeline = MediaTimeline {
                            position: t_pos,
                            start_time: t_start,
                            end_time: t_end,
                        };
                        
                        if new_timeline != last_timeline {
                            last_timeline = new_timeline.clone();
                            let _ = app_handle.emit("media-timeline", new_timeline);
                        }
                    }

                    // Get Playback Info
                    let mut new_info = MediaInfo::default();
                    if let Ok(playback) = session.GetPlaybackInfo() {
                        if let Ok(status) = playback.PlaybackStatus() {
                            new_info.is_playing = status.0 == 4; // Playing = 4
                        }
                    }

                    // Get Metadata
                    if let Ok(properties) = session.TryGetMediaPropertiesAsync().and_then(|op| op.get()) {
                        new_info.title = properties.Title().map(|s| s.to_string()).unwrap_or_default();
                        new_info.artist = properties.Artist().map(|s| s.to_string()).unwrap_or_default();
                        new_info.album = properties.AlbumTitle().map(|s| s.to_string()).unwrap_or_default();
                        
                        // Try to get thumbnail
                        if let Ok(thumb_ref) = properties.Thumbnail() {
                            if let Ok(stream) = thumb_ref.OpenReadAsync().and_then(|op| op.get()) {
                                if let Ok(size) = stream.Size() {
                                    let size = size as u32;
                                    let mut buf = vec![0u8; size as usize];
                                    if let Ok(reader) = DataReader::CreateDataReader(&stream) {
                                        if let Ok(_) = reader.LoadAsync(size).and_then(|op| op.get()) {
                                            if let Ok(_) = reader.ReadBytes(&mut buf) {
                                                use base64::Engine;
                                                let b64 = base64::engine::general_purpose::STANDARD.encode(&buf);
                                                new_info.thumbnail_base64 = Some(format!("data:image/jpeg;base64,{}", b64));
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if new_info != last_info {
                        last_info = new_info.clone();
                        let _ = app_handle.emit("media-updated", new_info);
                    }
                } else {
                    let new_info = MediaInfo::default();
                    if new_info != last_info {
                        last_info = new_info.clone();
                        let _ = app_handle.emit("media-updated", new_info);
                    }
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(1000));
        }
    });
}
