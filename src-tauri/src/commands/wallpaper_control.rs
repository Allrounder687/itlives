use tauri::{State, Manager, Emitter};
use crate::wallpaper::providers::VideoResult;
use crate::wallpaper::state::{AppStateStore, WallpaperState};
use crate::wallpaper;

use std::sync::atomic::{AtomicBool, Ordering};
static TRACKING_STARTED: AtomicBool = AtomicBool::new(false);



#[tauri::command]
pub async fn apply_wallpaper(
    state: State<'_, AppStateStore>,
    mut video: VideoResult,
    scale_percent: u64,
    start_time: Option<f64>,
    end_time: Option<f64>,
) -> Result<WallpaperState, String> {
    if video.local_path.is_empty() {
        log::info!("[Core] Download on apply triggered for source: {}", video.source);
        let provider = crate::wallpaper::providers::get_provider(&video.source)?;
        let local_path = provider.download_video(&video).await?;
        video.local_path = local_path;
        
        let _ = wallpaper::desktop::cleanup_cache(15);
    }

    let current = wallpaper::state::get(&state);
    wallpaper::desktop::set_video(
        &video.local_path,
        scale_percent,
        current.volume_percent,
        &current.video_filter,
        false, 
        start_time,
        end_time,
    )?;
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
        wallpaper::desktop::set_paused(paused)?;
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
        wallpaper::desktop::set_volume(persisted.volume_percent)?;
    }
    Ok(persisted)
}

#[tauri::command]
pub fn set_wallpaper_filter(
    state: State<'_, AppStateStore>,
    video_filter: String,
) -> Result<WallpaperState, String> {
    let persisted = wallpaper::state::set_video_filter(&state, video_filter)?;
    if persisted.is_playing {
        if let Some(video) = persisted.current_video.as_ref() {
            wallpaper::desktop::set_video(
                &video.local_path,
                persisted.wallpaper_scale_percent,
                persisted.volume_percent,
                &persisted.video_filter,
                persisted.paused,
                None,
                None,
            )?;
        }
    }
    Ok(persisted)
}

#[tauri::command]
pub fn set_wallpaper_scale(
    state: State<'_, AppStateStore>,
    scale_percent: u64,
) -> Result<WallpaperState, String> {
    let persisted = wallpaper::state::set_wallpaper_scale_percent(&state, scale_percent)?;
    if persisted.is_playing {
        if let Some(video) = persisted.current_video.as_ref() {
            wallpaper::desktop::set_video(
                &video.local_path,
                persisted.wallpaper_scale_percent,
                persisted.volume_percent,
                &persisted.video_filter,
                persisted.paused,
                None,
                None,
            )?;
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
        let _ = window.emit("effects-updated", ());

        // Push behind desktop icons layer using win32 SetParent reparenting trick
        #[cfg(windows)]
        {
            let workerw_opt = crate::wallpaper::desktop::win32::get_desktop_workerw();
            log::info!("[Overlay] Lookup WorkerW handles found: {:?}", workerw_opt);
            if let Some(workerw) = workerw_opt {
                if let Ok(hwnd) = window.hwnd() {
                    let script = format!(
                        "Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue; \
                         Add-Type -TypeDefinition @\"\nusing System;\nusing System.Runtime.InteropServices;\npublic class Win32 {{\n[DllImport(\"user32.dll\")]\npublic static extern IntPtr SetParent(IntPtr h, IntPtr p);\n[DllImport(\"user32.dll\")]\npublic static extern IntPtr GetWindowLongPtrW(IntPtr hWnd, int nIndex);\n[DllImport(\"user32.dll\")]\npublic static extern IntPtr SetWindowLongPtrW(IntPtr hWnd, int nIndex, IntPtr dwNewLong);\n[DllImport(\"user32.dll\")]\npublic static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);\n[DllImport(\"user32.dll\")]\npublic static extern IntPtr FindWindowEx(IntPtr h1, IntPtr h2, string c, string n);\n}}\n\"@ -ErrorAction SilentlyContinue; \
                         $v = [System.Windows.Forms.SystemInformation]::VirtualScreen; \
                         $shell = [Win32]::FindWindowEx([IntPtr]{}, [IntPtr]::Zero, \"SHELLDLL_DefView\", $null); \
                         [Win32]::SetParent([IntPtr]{}, [IntPtr]{}); \
                         $old = [Win32]::GetWindowLongPtrW([IntPtr]{}, -20); \
                         $new_style = $old.ToInt64() -bor 0x00280020; \
                         [Win32]::SetWindowLongPtrW([IntPtr]{}, -20, [IntPtr]$new_style); \
                         if ($shell -ne [IntPtr]::Zero) {{ \
                             [Win32]::SetWindowPos([IntPtr]{}, $shell, $v.X, $v.Y, $v.Width, $v.Height, 0x0040); \
                         }} else {{ \
                             [Win32]::SetWindowPos([IntPtr]{}, [IntPtr]::Zero, $v.X, $v.Y, $v.Width, $v.Height, 0x0040); \
                         }}",
                        workerw, hwnd.0 as isize, workerw, hwnd.0 as isize, hwnd.0 as isize, hwnd.0 as isize, hwnd.0 as isize
                    );


                    
                    let temp_dir = std::env::temp_dir();
                    let script_path = temp_dir.join("attach_effects_overlay.ps1");
                    if let Err(e) = std::fs::write(&script_path, &script) {
                        log::error!("[Overlay] Failed to write powershell script: {}", e);
                    } else {
                        log::info!("[Overlay] Script written to {:?}", script_path);
                    }

                    match std::process::Command::new("powershell")
                        .args(&[
                            "-NoProfile",
                            "-WindowStyle", "Hidden",
                            "-ExecutionPolicy", "Bypass",
                            "-File", script_path.to_str().unwrap()
                        ])
                        .spawn() {
                            Ok(p) => {
                                log::info!("[Overlay] Powershell process spawned with PID: {:?}", p.id());
                                start_mouse_tracking(app_handle.clone());
                            },
                            Err(e) => log::error!("[Overlay] Failed to spawn Powershell: {}", e)
                        }
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
        use windows::Win32::Foundation::POINT;

        loop {
            let mut pt = POINT::default();
            unsafe {
                if GetCursorPos(&mut pt).is_ok() {
                    let vx = GetSystemMetrics(SM_XVIRTUALSCREEN);
                    let vy = GetSystemMetrics(SM_YVIRTUALSCREEN);
                    let _ = app_handle.emit("cursor-moved", (pt.x - vx, pt.y - vy));
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(16)); // ~60fps
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


