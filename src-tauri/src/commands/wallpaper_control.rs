use crate::wallpaper;
use crate::wallpaper::providers::VideoResult;
use crate::wallpaper::state::{AppStateStore, WallpaperState};
use tauri::{Emitter, Manager, State};

use std::sync::atomic::{AtomicBool, Ordering};
static TRACKING_STARTED: AtomicBool = AtomicBool::new(false);

#[tauri::command]
pub async fn apply_wallpaper_inner(
    app: tauri::AppHandle,
    state: State<'_, AppStateStore>,
    mut video: VideoResult,
    scale_percent: u64,
    start_time: Option<f64>,
    end_time: Option<f64>,
    monitor: Option<String>,
) -> Result<WallpaperState, String> {
    if video.source == "youtube_stream" {
        // Do not trigger download. We stream directly via mpv's ytdl-hook.
        if video.local_path.is_empty() || video.local_path.contains("embed") {
            video.local_path = video.video_url.clone();
        }
    } else if video.local_path.is_empty() || video.local_path.starts_with("http") {
        log::info!(
            "[Core] Download on apply triggered for source: {}",
            video.source
        );
        let provider = crate::wallpaper::providers::get_provider(&video.source)?;
        let local_path = provider.download_video(&video, Some(app.clone())).await?;
        video.local_path = local_path;

        let _ = wallpaper::desktop::cleanup_cache(15);
    }

    let current = wallpaper::state::get(&state);
    // Keep rotation setting intact when manually applying a wallpaper, per user preference
    // let _ = wallpaper::state::set_rotation(&state, false, current.rotation_interval_seconds);

    let path_lower = video.local_path.to_lowercase();
    let is_web = path_lower.ends_with(".html");
    let is_static_image = path_lower.ends_with(".jpg")
        || path_lower.ends_with(".jpeg")
        || path_lower.ends_with(".png")
        || path_lower.ends_with(".webp")
        || video.source == "wallhaven"
        || video.source == "pinterest";

    if is_web {
        wallpaper::desktop::set_web_wallpaper(app.clone(), &video.local_path, monitor.clone())?;
    } else if is_static_image {
        // If applying static image, close webviews
        let m_key = monitor
            .as_ref()
            .cloned()
            .unwrap_or_else(|| "default".to_string());
        if m_key == "SPAN_ALL" {
            for (label, window) in app.webview_windows() {
                if label.starts_with("web_wallpaper_") {
                    let _ = window.close();
                }
            }
        } else {
            let window_label = format!("web_wallpaper_{}", m_key)
                .chars()
                .map(|c| if c.is_alphanumeric() || c == '-' || c == '/' || c == ':' || c == '_' { c } else { '_' })
                .collect::<String>();
            if let Some(window) = app.get_webview_window(&window_label) {
                let _ = window.close();
            }
        }

        let local_path = video.local_path.clone();
        tokio::task::spawn_blocking(move || wallpaper::desktop::set_static_image(&local_path))
            .await
            .map_err(|e| format!("Static image processing task failed: {}", e))??;
    } else {
        wallpaper::desktop::set_video(
            app.clone(),
            &video.local_path,
            scale_percent,
            current.volume_percent,
            &current.video_filter,
            current.playback_speed,
            current.blur_strength,
            false,
            start_time,
            end_time,
            monitor.clone(),
        )?;
    }

    if let Some(window) = app.get_webview_window("effects_overlay") {
        let _ = window.hide();
        let data_dir = app
            .path()
            .app_local_data_dir()
            .unwrap_or_else(|_| std::path::PathBuf::from("."));
        let _ = std::fs::remove_file(data_dir.join("current_effects.json"));
    }

    wallpaper::state::mark_active(&state, video)
}

#[tauri::command]
pub async fn apply_wallpaper(
    app: tauri::AppHandle,
    state: State<'_, AppStateStore>,
    video: VideoResult,
    scale_percent: u64,
    start_time: Option<f64>,
    end_time: Option<f64>,
    monitor: Option<String>,
) -> Result<WallpaperState, String> {
    let _ = app.emit("wallpaper-loading", true);
    let result = apply_wallpaper_inner(app.clone(), state, video, scale_percent, start_time, end_time, monitor).await;
    let _ = app.emit("wallpaper-loading", false);
    result
}

#[tauri::command]
pub async fn next_wallpaper(
    app: tauri::AppHandle,
    state: State<'_, AppStateStore>,
) -> Result<WallpaperState, String> {
    let current = state.snapshot();
    let mut next_video = None;

    if let Ok(advanced) = wallpaper::state::advance_queue(&state) {
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
        apply_wallpaper(
            app.clone(),
            state.clone(),
            video,
            current.wallpaper_scale_percent,
            None,
            None,
            None,
        )
        .await
    } else {
        Err("No wallpapers available to play next".to_string())
    }
}

#[tauri::command]
pub async fn prev_wallpaper(
    app: tauri::AppHandle,
    state: State<'_, AppStateStore>,
) -> Result<WallpaperState, String> {
    let current = state.snapshot();
    let mut prev_video = None;

    if let Ok(advanced) = wallpaper::state::retreat_queue(&state) {
        prev_video = Some(advanced.video);
    } else if !current.recents.is_empty() {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        let index = rng.gen_range(0..current.recents.len());
        prev_video = Some(current.recents[index].video.clone());
    } else if !current.imports.is_empty() {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        let index = rng.gen_range(0..current.imports.len());
        prev_video = Some(current.imports[index].video.clone());
    }

    if let Some(video) = prev_video {
        apply_wallpaper(
            app.clone(),
            state.clone(),
            video,
            current.wallpaper_scale_percent,
            None,
            None,
            None,
        )
        .await
    } else {
        Err("No wallpapers available to play previous".to_string())
    }
}

#[tauri::command]
pub fn stop_wallpaper(
    state: State<'_, AppStateStore>,
    app_handle: tauri::AppHandle,
) -> Result<WallpaperState, String> {
    wallpaper::desktop::stop_video()?;

    if let Some(window) = app_handle.get_webview_window("effects_overlay") {
        let _ = window.hide();
    }
    for (label, window) in app_handle.webview_windows() {
        if label.starts_with("web_wallpaper_") {
            let _ = window.close();
        }
    }

    wallpaper::state::clear_active(&state)
}

#[tauri::command]
pub fn get_wallpaper_status() -> Option<String> {
    wallpaper::desktop::get_current()
}

#[tauri::command]
pub fn set_wallpaper_paused(
    state: State<'_, AppStateStore>,
    paused: bool,
) -> Result<WallpaperState, String> {
    let persisted = wallpaper::state::set_paused(&state, paused)?;
    if persisted.is_playing {
        if let Err(e) = wallpaper::desktop::set_paused(paused) {
            log::warn!("Failed to apply paused state: {}", e);
        }
    }
    Ok(persisted)
}

#[tauri::command]
pub fn set_wallpaper_volume(
    state: State<'_, AppStateStore>,
    volume_percent: u64,
) -> Result<WallpaperState, String> {
    let persisted = wallpaper::state::set_volume_percent(&state, volume_percent)?;
    if persisted.is_playing {
        if let Err(e) = wallpaper::desktop::set_volume(persisted.volume_percent) {
            log::warn!("Failed to apply volume: {}", e);
        }
    }
    Ok(persisted)
}

#[tauri::command]
pub fn set_wallpaper_filter(
    app: tauri::AppHandle,
    state: State<'_, AppStateStore>,
    video_filter: String,
) -> Result<WallpaperState, String> {
    let persisted = wallpaper::state::set_video_filter(&state, video_filter)?;
    if persisted.is_playing {
        if let Some(video) = persisted.current_video.as_ref() {
            let path_lower = video.local_path.to_lowercase();
            let is_static = path_lower.ends_with(".jpg")
                || path_lower.ends_with(".jpeg")
                || path_lower.ends_with(".png")
                || path_lower.ends_with(".webp")
                || video.source == "wallhaven"
                || video.source == "pinterest";

            if is_static {
                if let Err(e) = wallpaper::desktop::set_static_image(&video.local_path) {
                    log::warn!("Failed to set static image filter: {}", e);
                }
            } else {
                if let Err(e) = wallpaper::desktop::set_video(
                    app,
                    &video.local_path,
                    persisted.wallpaper_scale_percent,
                    persisted.volume_percent,
                    &persisted.video_filter,
                    persisted.playback_speed,
                    persisted.blur_strength,
                    persisted.paused,
                    None,
                    None,
                    None,
                ) {
                    log::warn!("Failed to set video filter: {}", e);
                }
            }
        }
    }
    Ok(persisted)
}

#[tauri::command]
pub fn set_wallpaper_scale(
    app: tauri::AppHandle,
    state: State<'_, AppStateStore>,
    scale_percent: u64,
) -> Result<WallpaperState, String> {
    let persisted = wallpaper::state::set_wallpaper_scale_percent(&state, scale_percent)?;
    if persisted.is_playing {
        if let Some(video) = persisted.current_video.as_ref() {
            let path_lower = video.local_path.to_lowercase();
            let is_static = path_lower.ends_with(".jpg")
                || path_lower.ends_with(".jpeg")
                || path_lower.ends_with(".png")
                || path_lower.ends_with(".webp")
                || video.source == "wallhaven"
                || video.source == "pinterest";

            if is_static {
                if let Err(e) = wallpaper::desktop::set_static_image(&video.local_path) {
                    log::warn!("Failed to set static image scale: {}", e);
                }
            } else {
                if let Err(e) = wallpaper::desktop::set_video(
                    app,
                    &video.local_path,
                    persisted.wallpaper_scale_percent,
                    persisted.volume_percent,
                    &persisted.video_filter,
                    persisted.playback_speed,
                    persisted.blur_strength,
                    persisted.paused,
                    None,
                    None,
                    None,
                ) {
                    log::warn!("Failed to set video scale: {}", e);
                }
            }
        }
    }
    Ok(persisted)
}

#[tauri::command]
pub fn set_wallpaper_speed(
    state: State<'_, AppStateStore>,
    speed: f64,
) -> Result<WallpaperState, String> {
    let persisted = wallpaper::state::set_playback_speed(&state, speed)?;
    if persisted.is_playing {
        if let Err(e) = wallpaper::desktop::set_speed(persisted.playback_speed) {
            log::warn!("Failed to apply speed: {}", e);
        }
    }
    Ok(persisted)
}

#[tauri::command]
pub fn set_wallpaper_blur(
    app: tauri::AppHandle,
    state: State<'_, AppStateStore>,
    blur: u32,
) -> Result<WallpaperState, String> {
    let persisted = wallpaper::state::set_blur_strength(&state, blur)?;
    if persisted.is_playing {
        if let Some(video) = persisted.current_video.as_ref() {
            let path_lower = video.local_path.to_lowercase();
            let is_static = path_lower.ends_with(".jpg")
                || path_lower.ends_with(".jpeg")
                || path_lower.ends_with(".png")
                || path_lower.ends_with(".webp")
                || video.source == "wallhaven"
                || video.source == "pinterest";

            if is_static {
                if let Err(e) = wallpaper::desktop::set_static_image(&video.local_path) {
                    log::warn!("Failed to set static image blur: {}", e);
                }
            } else {
                if let Err(e) = wallpaper::desktop::set_video(
                    app,
                    &video.local_path,
                    persisted.wallpaper_scale_percent,
                    persisted.volume_percent,
                    &persisted.video_filter,
                    persisted.playback_speed,
                    persisted.blur_strength,
                    persisted.paused,
                    None,
                    None,
                    None,
                ) {
                    log::warn!("Failed to set video blur: {}", e);
                }
            }
        }
    }
    Ok(persisted)
}

#[tauri::command]
pub fn toggle_favorite(
    state: State<'_, AppStateStore>,
    video: VideoResult,
) -> Result<WallpaperState, String> {
    wallpaper::state::toggle_favorite(&state, video)
}

#[tauri::command]
pub async fn apply_desktop_effects(
    app_handle: tauri::AppHandle,
    layers_json: String,
) -> Result<(), String> {
    // 1. Save effects configuration securely inside local data state
    let data_dir = app_handle
        .path()
        .app_local_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."));
    let _ = tokio::fs::create_dir_all(&data_dir).await;
    let config_path = data_dir.join("current_effects.json");
    // OPTIMIZATION: Swapped synchronous write for async stream
    tokio::fs::write(config_path, &layers_json).await
        .map_err(|e| format!("Failed to save current_effects.json: {}", e))?;

    // 2. Spawn Transparent Overlay Window to attach into layout grids
    log::info!(
        "[Overlay] apply_desktop_effects triggered with config size: {}",
        layers_json.len()
    );
    if let Some(window) = app_handle.get_webview_window("effects_overlay") {
        log::info!(
            "[Overlay] Found effects_overlay window, making visible and setting ignore_cursor..."
        );
        let _ = window.show();
        let _ = window.set_ignore_cursor_events(true);
        let _ = window.emit("effects-updated", layers_json.clone());

        // Push behind desktop icons layer using win32 SetParent reparenting trick
        #[cfg(windows)]
        {
            let workerw_opt = crate::wallpaper::desktop::win32::get_desktop_workerw();
            let effects_overlay_hwnd = app_handle.get_webview_window("effects_overlay")
                .and_then(|w| w.hwnd().ok())
                .map(|h| h.0 as isize)
                .unwrap_or(0);
            log::info!("[Overlay] Lookup WorkerW handles found: {:?}", workerw_opt);
            if let Some(workerw) = workerw_opt {
                if effects_overlay_hwnd != 0 {
                    unsafe {
                        // Stitch the effects overlay into the Icon Container
                        let _ = windows::Win32::UI::WindowsAndMessaging::SetParent(
                            windows::Win32::Foundation::HWND(effects_overlay_hwnd as _),
                            windows::Win32::Foundation::HWND(workerw as _),
                        );

                        // Strip borders
                        let old_style = windows::Win32::UI::WindowsAndMessaging::GetWindowLongW(
                            windows::Win32::Foundation::HWND(effects_overlay_hwnd as _),
                            windows::Win32::UI::WindowsAndMessaging::GWL_STYLE,
                        );
                        let mut new_style = old_style as u32;
                        new_style &= !windows::Win32::UI::WindowsAndMessaging::WS_POPUP.0;
                        new_style &= !windows::Win32::UI::WindowsAndMessaging::WS_CAPTION.0;
                        new_style &= !windows::Win32::UI::WindowsAndMessaging::WS_THICKFRAME.0;
                        new_style &= !windows::Win32::UI::WindowsAndMessaging::WS_MINIMIZEBOX.0;
                        new_style &= !windows::Win32::UI::WindowsAndMessaging::WS_MAXIMIZEBOX.0;
                        new_style &= !windows::Win32::UI::WindowsAndMessaging::WS_SYSMENU.0;
                        new_style |= windows::Win32::UI::WindowsAndMessaging::WS_CHILD.0;
                        let _ = windows::Win32::UI::WindowsAndMessaging::SetWindowLongW(
                            windows::Win32::Foundation::HWND(effects_overlay_hwnd as _),
                            windows::Win32::UI::WindowsAndMessaging::GWL_STYLE,
                            new_style as i32,
                        );

                        // Push it exactly behind the icons (SHELLDLL_DefView)
                        let shelldll: Vec<u16> = "SHELLDLL_DefView\0".encode_utf16().collect();
                        let shell_hwnd = windows::Win32::UI::WindowsAndMessaging::FindWindowExW(
                            windows::Win32::Foundation::HWND(workerw as _),
                            windows::Win32::Foundation::HWND(0 as _),
                            windows::core::PCWSTR(shelldll.as_ptr()),
                            windows::core::PCWSTR::null(),
                        )
                        .unwrap_or(windows::Win32::Foundation::HWND(1 as _));

                        let target_z = if shell_hwnd != windows::Win32::Foundation::HWND(0 as _)
                            && shell_hwnd != windows::Win32::Foundation::HWND(1 as _)
                        {
                            shell_hwnd
                        } else {
                            windows::Win32::Foundation::HWND(1 as _)
                        };

                        let v_x = windows::Win32::UI::WindowsAndMessaging::GetSystemMetrics(
                            windows::Win32::UI::WindowsAndMessaging::SM_XVIRTUALSCREEN,
                        );
                        let v_y = windows::Win32::UI::WindowsAndMessaging::GetSystemMetrics(
                            windows::Win32::UI::WindowsAndMessaging::SM_YVIRTUALSCREEN,
                        );
                        let v_w = windows::Win32::UI::WindowsAndMessaging::GetSystemMetrics(
                            windows::Win32::UI::WindowsAndMessaging::SM_CXVIRTUALSCREEN,
                        );
                        let v_h = windows::Win32::UI::WindowsAndMessaging::GetSystemMetrics(
                            windows::Win32::UI::WindowsAndMessaging::SM_CYVIRTUALSCREEN,
                        );

                        let _ = windows::Win32::UI::WindowsAndMessaging::SetWindowPos(
                            windows::Win32::Foundation::HWND(effects_overlay_hwnd as _),
                            target_z,
                            v_x,
                            v_y,
                            v_w,
                            v_h,
                            windows::Win32::UI::WindowsAndMessaging::SWP_SHOWWINDOW,
                        );
                    }

                    log::info!("[Overlay] Native reparenting successful.");
                    start_mouse_tracking(app_handle.clone());
                }
            } else {
                log::warn!("[Overlay] WorkerW not found, skipping reparenting layout overlays!");
            }
        }
    } else {
        log::error!("[Overlay] effects_overlay window could not be found in current app context.");
    }

    Ok(())
}

pub fn start_mouse_tracking(app_handle: tauri::AppHandle) {
    if TRACKING_STARTED.load(Ordering::SeqCst) {
        return;
    }
    TRACKING_STARTED.store(true, Ordering::SeqCst);
    log::info!("[Overlay] Starting background global mouse cursor tracking stream...");

    std::thread::spawn(move || {
        use windows::Win32::Foundation::POINT;
        use windows::Win32::UI::Input::KeyboardAndMouse::{
            GetAsyncKeyState, VK_LBUTTON, VK_MBUTTON, VK_RBUTTON,
        };
        use windows::Win32::UI::WindowsAndMessaging::{
            GetCursorPos, GetSystemMetrics, SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN,
        };

        let mut was_l_down = false;
        let mut was_r_down = false;
        let mut was_m_down = false;

        loop {
            let mut pt = POINT::default();
            unsafe {
                if GetCursorPos(&mut pt).is_ok() {
                    #[derive(serde::Serialize, Clone)]
                    struct CursorPayload {
                        x: i32,
                        y: i32,
                        button: Option<String>,
                    }

                    let vx = GetSystemMetrics(SM_XVIRTUALSCREEN);
                    let vy = GetSystemMetrics(SM_YVIRTUALSCREEN);
                    let payload = CursorPayload {
                        x: pt.x - vx,
                        y: pt.y - vy,
                        button: None,
                    };

                    let _ = app_handle.emit("cursor-moved", payload.clone());

                    // Track left mouse button clicks
                    let lbtn_state = GetAsyncKeyState(VK_LBUTTON.0 as i32);
                    let is_l_down = (lbtn_state as u16 & 0x8000) != 0;

                    if is_l_down && !was_l_down {
                        let mut click_payload = payload.clone();
                        click_payload.button = Some("left".to_string());
                        let _ = app_handle.emit("cursor-click", click_payload);
                    }
                    was_l_down = is_l_down;

                    // Track right mouse button clicks
                    let rbtn_state = GetAsyncKeyState(VK_RBUTTON.0 as i32);
                    let is_r_down = (rbtn_state as u16 & 0x8000) != 0;

                    if is_r_down && !was_r_down {
                        let mut click_payload = payload.clone();
                        click_payload.button = Some("right".to_string());
                        let _ = app_handle.emit("cursor-click", click_payload);
                    }
                    was_r_down = is_r_down;

                    // Track middle mouse button clicks (Food)
                    let mbtn_state = GetAsyncKeyState(VK_MBUTTON.0 as i32);
                    let is_m_down = (mbtn_state as u16 & 0x8000) != 0;

                    if is_m_down && !was_m_down {
                        let mut click_payload = payload.clone();
                        click_payload.button = Some("food".to_string());
                        let _ = app_handle.emit("cursor-click", click_payload);
                    }
                    was_m_down = is_m_down;
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(32)); // ~30fps for smoother balance between perf and response
        }
    });
}

#[tauri::command]
pub async fn get_current_effects(app_handle: tauri::AppHandle) -> Result<String, String> {
    let data_dir = app_handle
        .path()
        .app_local_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."));
    let config_path = data_dir.join("current_effects.json");
    if config_path.exists() {
        // OPTIMIZATION: Non-blocking file read
        tokio::fs::read_to_string(config_path).await.map_err(|e| e.to_string())
    } else {
        Ok("{}".to_string())
    }
}
