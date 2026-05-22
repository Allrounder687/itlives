use tauri::{State, Manager, Emitter};
use crate::wallpaper::providers::VideoResult;
use crate::wallpaper::state::{AppStateStore, WallpaperState};
use crate::wallpaper;

use std::sync::atomic::{AtomicBool, Ordering};
static TRACKING_STARTED: AtomicBool = AtomicBool::new(false);




#[tauri::command]
pub async fn apply_wallpaper(
    app: tauri::AppHandle,
    state: State<'_, AppStateStore>,
    mut video: VideoResult,
    scale_percent: u64,
    start_time: Option<f64>,
    end_time: Option<f64>,
    monitor: Option<String>,
) -> Result<WallpaperState, String> {
    if video.local_path.is_empty() || video.local_path.starts_with("http") {
        log::info!("[Core] Download on apply triggered for source: {}", video.source);
        let provider = crate::wallpaper::providers::get_provider(&video.source)?;
        let local_path = provider.download_video(&video).await?;
        video.local_path = local_path;
        
        let _ = wallpaper::desktop::cleanup_cache(15);
    }

    let current = wallpaper::state::get(&state);
    let _ = wallpaper::state::set_rotation(&state, false, current.rotation_interval_seconds);
    
    let path_lower = video.local_path.to_lowercase();
    let is_web = path_lower.ends_with(".html");
    let is_static_image = path_lower.ends_with(".jpg") 
        || path_lower.ends_with(".jpeg") 
        || path_lower.ends_with(".png") 
        || path_lower.ends_with(".webp")
        || video.source == "wallhaven"
        || video.source == "pinterest";

    if is_web {
        wallpaper::desktop::set_web_wallpaper(
            app.clone(),
            &video.local_path,
            monitor.clone(),
        )?;
    } else if is_static_image {
        // If applying static image, close webviews
        let m_key = monitor.as_ref().cloned().unwrap_or_else(|| "default".to_string());
        if m_key == "SPAN_ALL" {
            for (label, window) in app.webview_windows() {
                if label.starts_with("web_wallpaper_") {
                    let _ = window.close();
                }
            }
        } else {
            let window_label = format!("web_wallpaper_{}", m_key.replace(" ", "_").replace("\\", "_"));
            if let Some(window) = app.get_webview_window(&window_label) {
                let _ = window.close();
            }
        }
        
        let local_path = video.local_path.clone();
        tokio::task::spawn_blocking(move || {
            wallpaper::desktop::set_static_image(&local_path)
        })
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
    wallpaper::state::mark_active(&state, video)
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
pub fn apply_desktop_effects(
    app_handle: tauri::AppHandle,
    layers_json: String,
) -> Result<(), String> {
    // 1. Save effects configuration securely inside local data state
    let data_dir = app_handle.path().app_local_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    std::fs::create_dir_all(&data_dir).ok();
    let config_path = data_dir.join("current_effects.json");
    std::fs::write(config_path, &layers_json).map_err(|e| format!("Failed to save current_effects.json: {}", e))?;


    // 2. Spawn Transparent Overlay Window to attach into layout grids
    log::info!("[Overlay] apply_desktop_effects triggered with config size: {}", layers_json.len());
    if let Some(window) = app_handle.get_webview_window("effects_overlay") {
        log::info!("[Overlay] Found effects_overlay window, making visible and setting ignore_cursor...");
        let _ = window.show();
        let _ = window.set_ignore_cursor_events(true);
        let _ = window.emit("effects-updated", layers_json.clone());

        // Push behind desktop icons layer using win32 SetParent reparenting trick
        #[cfg(windows)]
        {
            let workerw_opt = crate::wallpaper::desktop::win32::get_desktop_workerw();
            log::info!("[Overlay] Lookup WorkerW handles found: {:?}", workerw_opt);
            if let Some(workerw) = workerw_opt {
                if let Ok(hwnd) = window.hwnd() {
                    let shelldll: Vec<u16> = "SHELLDLL_DefView\0".encode_utf16().collect();
                    let shell_hwnd = unsafe {
                        windows::Win32::UI::WindowsAndMessaging::FindWindowExW(
                            windows::Win32::Foundation::HWND(workerw as _),
                            windows::Win32::Foundation::HWND(0 as _),
                            windows::core::PCWSTR(shelldll.as_ptr()),
                            windows::core::PCWSTR::null()
                        ).unwrap_or(windows::Win32::Foundation::HWND(1 as _)) // HWND_BOTTOM fallback
                    };

                    unsafe {
                        // Stitch the effects overlay into the Icon Container
                        let _ = windows::Win32::UI::WindowsAndMessaging::SetParent(
                            windows::Win32::Foundation::HWND(hwnd.0 as _),
                            windows::Win32::Foundation::HWND(workerw as _)
                        );

                        // Strip borders
                        let old_style = windows::Win32::UI::WindowsAndMessaging::GetWindowLongW(
                            windows::Win32::Foundation::HWND(hwnd.0 as _),
                            windows::Win32::UI::WindowsAndMessaging::GWL_STYLE
                        );
                        let _ = windows::Win32::UI::WindowsAndMessaging::SetWindowLongW(
                            windows::Win32::Foundation::HWND(hwnd.0 as _),
                            windows::Win32::UI::WindowsAndMessaging::GWL_STYLE,
                            old_style & !0x00280020 // Remove WS_POPUP, WS_CAPTION etc
                        );

                        // Push it exactly behind the icons (SHELLDLL_DefView)
                        let target_z = if shell_hwnd != windows::Win32::Foundation::HWND(0 as _) && shell_hwnd != windows::Win32::Foundation::HWND(1 as _) {
                            shell_hwnd
                        } else {
                            windows::Win32::Foundation::HWND(1 as _)
                        };

                        let v_x = windows::Win32::UI::WindowsAndMessaging::GetSystemMetrics(windows::Win32::UI::WindowsAndMessaging::SM_XVIRTUALSCREEN);
                        let v_y = windows::Win32::UI::WindowsAndMessaging::GetSystemMetrics(windows::Win32::UI::WindowsAndMessaging::SM_YVIRTUALSCREEN);
                        let v_w = windows::Win32::UI::WindowsAndMessaging::GetSystemMetrics(windows::Win32::UI::WindowsAndMessaging::SM_CXVIRTUALSCREEN);
                        let v_h = windows::Win32::UI::WindowsAndMessaging::GetSystemMetrics(windows::Win32::UI::WindowsAndMessaging::SM_CYVIRTUALSCREEN);

                        let _ = windows::Win32::UI::WindowsAndMessaging::SetWindowPos(
                            windows::Win32::Foundation::HWND(hwnd.0 as _),
                            target_z,
                            v_x, v_y, v_w, v_h,
                            windows::Win32::UI::WindowsAndMessaging::SWP_SHOWWINDOW
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
        use windows::Win32::UI::WindowsAndMessaging::{GetCursorPos, GetSystemMetrics, SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN};
        use windows::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_LBUTTON};
        use windows::Win32::Foundation::POINT;

        let mut was_down = false;

        loop {
            let mut pt = POINT::default();
            unsafe {
                if GetCursorPos(&mut pt).is_ok() {
                    #[derive(serde::Serialize, Clone)]
                    struct CursorPayload {
                        x: i32,
                        y: i32,
                    }
                    
                    let vx = GetSystemMetrics(SM_XVIRTUALSCREEN);
                    let vy = GetSystemMetrics(SM_YVIRTUALSCREEN);
                    let payload = CursorPayload {
                        x: pt.x - vx,
                        y: pt.y - vy,
                    };
                    
                    let _ = app_handle.emit("cursor-moved", payload.clone());

                    // Track left mouse button clicks
                    let lbtn_state = GetAsyncKeyState(VK_LBUTTON.0 as i32);
                    let is_down = (lbtn_state as u16 & 0x8000) != 0;
                    
                    if is_down && !was_down {
                        let mut cursor_on_desktop = false;
                        let hwnd = windows::Win32::UI::WindowsAndMessaging::WindowFromPoint(pt);
                        if hwnd.0 != 0 as _ {
                            let mut current_hwnd = hwnd;
                            while current_hwnd.0 != 0 as _ {
                                let mut class_name = [0u16; 256];
                                let len = windows::Win32::UI::WindowsAndMessaging::GetClassNameW(current_hwnd, &mut class_name);
                                let c_name = String::from_utf16_lossy(&class_name[..len as usize]);
                                if c_name == "WorkerW" || c_name == "Progman" || c_name == "SysListView32" || c_name == "SHELLDLL_DefView" || c_name == "mpv" {
                                    cursor_on_desktop = true;
                                    break;
                                }
                                current_hwnd = windows::Win32::UI::WindowsAndMessaging::GetParent(current_hwnd).unwrap_or(windows::Win32::Foundation::HWND(0 as _));
                            }
                        }

                        if cursor_on_desktop {
                            log::info!("[Overlay] Click captured on desktop window class, emitting cursor-click");
                            let _ = app_handle.emit("cursor-click", payload);
                        } else {
                            log::debug!("[Overlay] Ignored click directed at non-desktop active window");
                        }
                    }
                    was_down = is_down;
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(32)); // ~30fps for smoother balance between perf and response
        }
    });
}

#[tauri::command]
pub fn get_current_effects(app_handle: tauri::AppHandle) -> Result<String, String> {
    let data_dir = app_handle.path().app_local_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    let config_path = data_dir.join("current_effects.json");
    if config_path.exists() {
        std::fs::read_to_string(config_path).map_err(|e| e.to_string())
    } else {
        Ok("{}".to_string())
    }
}


