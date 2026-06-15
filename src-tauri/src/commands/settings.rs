use crate::wallpaper;
use crate::wallpaper::providers::{self, VideoResult};
use crate::wallpaper::state::{AppStateStore, WallpaperState};
use tauri::State;

#[tauri::command]
pub fn list_sources() -> Vec<String> {
    providers::list_providers()
}

#[tauri::command]
pub fn cleanup_cache(keep: usize) -> Result<usize, String> {
    wallpaper::desktop::cleanup_cache(keep)
}

#[tauri::command]
pub fn get_app_state(state: State<'_, AppStateStore>) -> WallpaperState {
    wallpaper::state::get(&state)
}

#[tauri::command]
pub fn set_restore_on_launch(
    state: State<'_, AppStateStore>,
    enabled: bool,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_restore_on_launch(&state, enabled)
}

#[tauri::command]
pub fn set_window_behavior(
    state: State<'_, AppStateStore>,
    close_to_tray: bool,
    minimize_to_tray: bool,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_window_behavior(&state, close_to_tray, minimize_to_tray)
}

#[tauri::command]
pub fn set_auto_pause(
    state: State<'_, AppStateStore>,
    enabled: bool,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_auto_pause(&state, enabled)
}

#[tauri::command]
pub fn set_keep_effects_running_on_pause(
    state: State<'_, AppStateStore>,
    enabled: bool,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_keep_effects_running_on_pause(&state, enabled)
}

#[tauri::command]
pub fn import_local_video(
    state: State<'_, AppStateStore>,
    video: VideoResult,
) -> Result<WallpaperState, String> {
    wallpaper::state::import_local_video(&state, video)
}

#[tauri::command]
pub fn remove_imported_video(
    state: State<'_, AppStateStore>,
    video: VideoResult,
) -> Result<WallpaperState, String> {
    wallpaper::state::remove_imported_video(&state, video)
}

#[tauri::command]
pub fn remove_recent_video(
    state: State<'_, AppStateStore>,
    video: VideoResult,
) -> Result<WallpaperState, String> {
    wallpaper::state::remove_recent_video(&state, video)
}

#[tauri::command]
pub fn set_theme(state: State<'_, AppStateStore>, theme: String) -> Result<WallpaperState, String> {
    wallpaper::state::set_theme(&state, theme)
}

#[tauri::command]
pub fn set_categories_filter(
    state: State<'_, AppStateStore>,
    categories: String,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_categories_filter(&state, categories)
}

#[tauri::command]
pub fn set_purity_filter(
    state: State<'_, AppStateStore>,
    purity: String,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_purity_filter(&state, purity)
}

#[tauri::command]
pub fn check_dependencies() -> Vec<String> {
    let mut missing = Vec::new();
    if wallpaper::desktop::find_mpv().is_none() {
        missing.push("mpv".to_string());
    }
    missing
}

#[tauri::command]
pub async fn install_mpv() -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new("powershell");
        // We use powershell to run winget so we can capture output or handle it better if needed,
        // but mostly to ensure we can run it minimized/hidden.
        cmd.args(&[
            "-NoProfile",
            "-Command",
            "winget install shinchiro.mpv --accept-package-agreements --accept-source-agreements",
        ]);
        cmd.creation_flags(0x08000000);

        let status = cmd
            .status()
            .map_err(|e| format!("Failed to spawn winget process: {}", e))?;
        if status.success() {
            Ok(())
        } else {
            Err("Winget exited with an error code. Please try 'winget install shinchiro.mpv' manually in a terminal.".to_string())
        }
    }
    #[cfg(not(windows))]
    {
        Err("Auto-install is only supported on Windows.".to_string())
    }
}

#[tauri::command]
pub fn set_wallhaven_api_key(
    state: State<'_, AppStateStore>,
    key: String,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_wallhaven_api_key(&state, key)
}

#[tauri::command]
pub fn set_disabled_sources(
    state: State<'_, AppStateStore>,
    disabled: Vec<String>,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_disabled_sources(&state, disabled)
}

#[tauri::command]
pub fn set_pinterest_urls(
    state: State<'_, AppStateStore>,
    urls: Vec<String>,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_pinterest_urls(&state, urls)
}

#[tauri::command]
pub fn toggle_hide_video(
    state: State<'_, AppStateStore>,
    video_id: String,
) -> Result<WallpaperState, String> {
    wallpaper::state::toggle_hide_video(&state, video_id)
}

#[derive(serde::Serialize)]
pub struct DisplayMonitor {
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub scale_factor: f64,
    pub is_primary: bool,
}

#[tauri::command]
pub fn get_monitors(app_handle: tauri::AppHandle) -> Result<Vec<DisplayMonitor>, String> {
    let mut result = Vec::new();

    let monitors = app_handle.available_monitors().map_err(|e| e.to_string())?;
    let primary = app_handle.primary_monitor().ok().flatten();

    for m in monitors {
        let name = m
            .name()
            .unwrap_or(&"Unknown Display".to_string())
            .to_string();
        let size = m.size();
        let pos = m.position();
        let scale = m.scale_factor();
        let is_primary = if let Some(ref p) = primary {
            p.name() == m.name()
        } else {
            false
        };

        result.push(DisplayMonitor {
            name,
            width: size.width,
            height: size.height,
            x: pos.x,
            y: pos.y,
            scale_factor: scale,
            is_primary,
        });
    }

    Ok(result)
}

#[tauri::command]
pub fn launch_external_app(path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new(&path);
        // CREATE_NO_WINDOW = 0x08000000
        cmd.creation_flags(0x08000000);
        let _ = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn {}: {}", path, e))?;
    }
    #[cfg(not(windows))]
    {
        let _ = std::process::Command::new(&path)
            .spawn()
            .map_err(|e| format!("Failed to spawn {}: {}", path, e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn extract_icon_base64(path: String) -> Result<String, String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let script = format!(
            "Add-Type -AssemblyName System.Drawing;\n\
             $icon = [System.Drawing.Icon]::ExtractAssociatedIcon('{}');\n\
             if ($null -eq $icon) {{ exit 1 }}\n\
             $bitmap = $icon.ToBitmap();\n\
             $stream = New-Object System.IO.MemoryStream;\n\
             $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png);\n\
             $bytes = $stream.ToArray();\n\
             [Convert]::ToBase64String($bytes)",
            path.replace("'", "''")
        );
        let mut cmd = std::process::Command::new("powershell");
        cmd.args(&["-NoProfile", "-Command", &script]);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let output = cmd
            .output()
            .map_err(|e| format!("Failed to run PowerShell: {}", e))?;
        if output.status.success() {
            let b64 = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if b64.is_empty() {
                Err("Icon extraction returned empty result".into())
            } else {
                Ok(b64)
            }
        } else {
            Err("Failed to extract icon (PowerShell returned error)".into())
        }
    }
    #[cfg(not(windows))]
    {
        Err("Icon extraction is only supported on Windows".into())
    }
}

#[tauri::command]
pub fn set_slideshow_source(
    state: State<'_, AppStateStore>,
    source: String,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_slideshow_source(&state, source)
}

#[tauri::command]
pub fn set_discover_provider(
    state: State<'_, AppStateStore>,
    provider: String,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_discover_provider(&state, provider)
}

#[tauri::command]
pub fn get_system_wallpaper() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let app_data = std::env::var("APPDATA").unwrap_or_default();
        let transcoded_path = std::path::Path::new(&app_data)
            .join("Microsoft")
            .join("Windows")
            .join("Themes")
            .join("TranscodedWallpaper");
            
        if transcoded_path.exists() {
            let temp_dir = std::env::temp_dir();
            let target_path = temp_dir.join("itlives_current_wallpaper.jpg");
            if let Err(e) = std::fs::copy(&transcoded_path, &target_path) {
                log::warn!("Failed to copy transcoded wallpaper: {}", e);
            } else {
                return Ok(target_path.to_string_lossy().to_string());
            }
        }

        use windows::Win32::UI::WindowsAndMessaging::{SystemParametersInfoW, SPI_GETDESKWALLPAPER, SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS};
        let mut buffer = [0u16; 512];
        unsafe {
            let res = SystemParametersInfoW(
                SPI_GETDESKWALLPAPER,
                buffer.len() as u32,
                Some(buffer.as_mut_ptr() as *mut _),
                SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0),
            );
            if res.is_ok() {
                let path = String::from_utf16_lossy(&buffer);
                let path = path.trim_end_matches('\0').trim().to_string();
                if std::path::Path::new(&path).exists() {
                    return Ok(path);
                }
            }
        }
    }
    Err("System wallpaper not found".to_string())
}

#[tauri::command]
pub fn show_mini_player(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    #[cfg(target_os = "windows")]
    {
        if let Some(window) = app.get_webview_window("mini_player") {
            if let Ok(hwnd) = window.hwnd() {
                let hwnd = windows::Win32::Foundation::HWND(hwnd.0 as *mut std::ffi::c_void);
                unsafe {
                    use windows::Win32::UI::WindowsAndMessaging::{
                        ShowWindow, SetWindowPos, HWND_TOPMOST, SW_SHOW,
                        GetWindowLongW, SetWindowLongW, GWL_STYLE, GWL_EXSTYLE,
                        WS_POPUP, WS_CAPTION, WS_THICKFRAME, WS_MINIMIZEBOX, WS_MAXIMIZEBOX, WS_SYSMENU,
                        WS_EX_TOOLWINDOW
                    };
                    
                    // 1. Ensure WS_POPUP style and remove standard caption/thickframes/system menus
                    let old_style = GetWindowLongW(hwnd, GWL_STYLE) as u32;
                    let mut new_style = old_style;
                    new_style |= WS_POPUP.0;
                    new_style &= !WS_CAPTION.0;
                    new_style &= !WS_THICKFRAME.0;
                    new_style &= !WS_MINIMIZEBOX.0;
                    new_style &= !WS_MAXIMIZEBOX.0;
                    new_style &= !WS_SYSMENU.0;
                    let _ = SetWindowLongW(hwnd, GWL_STYLE, new_style as i32);
                    
                    // 2. Set extended window styles (exStyle: tool window, no taskbar)
                    let old_ex = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
                    let new_ex = old_ex | WS_EX_TOOLWINDOW.0;
                    let _ = SetWindowLongW(hwnd, GWL_EXSTYLE, new_ex as i32);
                    
                    // 3. Position it relative to the monitor (and keep it always on top)
                    if let Ok(Some(monitor)) = window.current_monitor() {
                        let monitor_size = monitor.size();
                        let scale = monitor.scale_factor();
                        let w = (320.0 * scale) as i32;
                        let h = (420.0 * scale) as i32;
                        let x = monitor_size.width as i32 - w - (20.0 * scale) as i32;
                        let y = (monitor_size.height as i32 - h) / 2;
                        
                        let _ = SetWindowPos(
                            hwnd,
                            HWND_TOPMOST,
                            x,
                            y,
                            w,
                            h,
                            windows::Win32::UI::WindowsAndMessaging::SWP_SHOWWINDOW,
                        );
                    }
                    
                    let _ = ShowWindow(hwnd, SW_SHOW);
                }
            }
        }
        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Some(window) = app.get_webview_window("mini_player") {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
        return Ok(());
    }
}

#[tauri::command]
pub fn hide_mini_player(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    #[cfg(target_os = "windows")]
    {
        if let Some(window) = app.get_webview_window("mini_player") {
            if let Ok(hwnd) = window.hwnd() {
                let hwnd = windows::Win32::Foundation::HWND(hwnd.0 as *mut std::ffi::c_void);
                unsafe {
                    let _ = windows::Win32::UI::WindowsAndMessaging::ShowWindow(hwnd, windows::Win32::UI::WindowsAndMessaging::SW_HIDE);
                }
            }
        }
        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Some(window) = app.get_webview_window("mini_player") {
            let _ = window.hide();
        }
        return Ok(());
    }
}

#[tauri::command]
pub fn toggle_mini_player(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    #[cfg(target_os = "windows")]
    {
        if let Some(window) = app.get_webview_window("mini_player") {
            if let Ok(hwnd) = window.hwnd() {
                let hwnd = windows::Win32::Foundation::HWND(hwnd.0 as *mut std::ffi::c_void);
                unsafe {
                    let visible = windows::Win32::UI::WindowsAndMessaging::IsWindowVisible(hwnd).as_bool();
                    if visible {
                        let _ = hide_mini_player(app);
                    } else {
                        let _ = show_mini_player(app);
                    }
                }
            }
        }
        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Some(window) = app.get_webview_window("mini_player") {
            let visible = window.is_visible().unwrap_or(false);
            if visible {
                let _ = window.hide();
            } else {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }
        return Ok(());
    }
}
