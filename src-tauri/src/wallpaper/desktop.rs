//! Desktop wallpaper integration using Win32 API.
//! Embeds video behind desktop icons by finding the WorkerW window.

use std::path::PathBuf;
use std::process::Command;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::sync::Mutex;
use lazy_static::lazy_static;

use std::collections::HashMap;

lazy_static! {
    static ref CURRENT_VIDEO: Mutex<HashMap<String, String>> = Mutex::new(HashMap::new());
    static ref LAST_CONFIG: Mutex<HashMap<String, WallpaperConfig>> = Mutex::new(HashMap::new());
}

#[derive(Clone, PartialEq, Debug)]
struct WallpaperConfig {
    path: String,
    scale: u64,
    volume: u64,
    filter: String,
    speed: f64,
    blur: u32,
    paused: bool,
    start_time: Option<f64>,
    end_time: Option<f64>,
}

#[cfg(windows)]
pub mod win32 {

    use std::sync::Mutex;
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM, WPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, FindWindowExW, FindWindowW, SendMessageTimeoutW, SMTO_NORMAL,
    };

    static FOUND_WORKERW: Mutex<isize> = Mutex::new(0);

    pub fn get_desktop_workerw() -> Option<isize> {
        unsafe {
            // 1. Find Progman window
            let progman_class: Vec<u16> = "Progman\0".encode_utf16().collect();
            let progman = FindWindowW(PCWSTR(progman_class.as_ptr()), PCWSTR::null()).ok()?;

            log::info!("Found Progman: {:?}", progman.0);

            // 2. Send magic message 0x052C to make Windows spawn WorkerW
            let mut result_val = 0usize;
            let _ = SendMessageTimeoutW(
                progman,
                0x052C,
                WPARAM(0),
                LPARAM(0),
                SMTO_NORMAL,
                1000,
                Some(&mut result_val),
            );

            // Small delay to let Windows create the WorkerW
            std::thread::sleep(std::time::Duration::from_millis(1500));

            // 3. Reset the global
            if let Ok(mut g) = FOUND_WORKERW.lock() {
                *g = 0;
            }

            // 4. Enumerate all top-level windows to find WorkerW
            let _ = EnumWindows(Some(enum_cb), LPARAM(0));

            let handle = FOUND_WORKERW.lock().ok().map(|g| *g).unwrap_or(0);
            if handle != 0 {
                log::info!("Found Target Canvas (With Icons): {}", handle);
                Some(handle)
            } else {
                // Fallback: embed directly into Progman
                log::info!(
                    "WorkerW holding icons not found, falling back to Progman: {:?}",
                    progman.0
                );
                Some(progman.0 as isize)
            }
        }
    }

    unsafe extern "system" fn enum_cb(hwnd: HWND, _lparam: LPARAM) -> BOOL {
        let shelldll: Vec<u16> = "SHELLDLL_DefView\0".encode_utf16().collect();
        let shell = FindWindowExW(hwnd, HWND(0 as _), PCWSTR(shelldll.as_ptr()), PCWSTR::null());
        
        if shell.is_ok() && !shell.unwrap().is_invalid() {
            // This is the window that actually holds the icons!
            // The old PowerShell script embedded directly into this window, and shoved mpv behind SHELLDLL_DefView.
            if let Ok(mut g) = FOUND_WORKERW.lock() {
                *g = hwnd.0 as isize;
            }
            return BOOL(0);
        }
        BOOL(1)
    }

    static mut SEARCH_PID: u32 = 0;
    static mut FOUND_HWND: HWND = HWND(0 as _);

    pub fn find_hwnd_by_pid(pid: u32) -> Option<isize> {
        unsafe {
            SEARCH_PID = pid;
            FOUND_HWND = HWND(0 as _);
            let _ = EnumWindows(Some(enum_pid_cb), LPARAM(0));
            if FOUND_HWND.0 != 0 as _ {
                Some(FOUND_HWND.0 as isize)
            } else {
                None
            }
        }
    }

    unsafe extern "system" fn enum_pid_cb(hwnd: HWND, _lparam: LPARAM) -> BOOL {
        let mut wnd_pid = 0;
        windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId(hwnd, Some(&mut wnd_pid));
        if wnd_pid == SEARCH_PID {
            let mut class_name = [0u16; 256];
            let len = windows::Win32::UI::WindowsAndMessaging::GetClassNameW(hwnd, &mut class_name);
            let c_name = String::from_utf16_lossy(&class_name[..len as usize]);
            
            if c_name == "mpv" {
                FOUND_HWND = hwnd;
                return BOOL(0); // Stop enumeration, we found the actual mpv player window!
            }
        }
        BOOL(1)
    }
}

pub fn set_video(
    app: tauri::AppHandle,
    path: &str,
    scale_percent: u64,
    volume_percent: u64,
    video_filter: &str,
    speed: f64,
    blur: u32,
    paused: bool,
    start_time: Option<f64>,
    end_time: Option<f64>,
    monitor_name: Option<String>,
) -> Result<String, String> {
    use tauri::Manager;
    let resolved_path = path.to_string();
    let is_url = resolved_path.starts_with("http");
    let scale_percent = scale_percent.clamp(25, 200);
    let volume_percent = volume_percent.min(100);

    let video_path = std::path::Path::new(&resolved_path);
    if !is_url && !video_path.exists() {
        return Err(format!("Video file not found: {}", resolved_path));
    }

    let new_config = WallpaperConfig {
        path: path.to_string(),
        scale: scale_percent,
        volume: volume_percent,
        filter: video_filter.to_string(),
        speed,
        blur,
        paused,
        start_time,
        end_time,
    };

    let monitors = app.available_monitors().unwrap_or_default();
    let mut target_m = monitors.first().cloned();
    if let Some(ref m_name) = monitor_name {
        for m in &monitors {
            if m.name().map(|n| n == m_name).unwrap_or(false) {
                target_m = Some(m.clone());
                break;
            }
        }
    }
    let mut m_key = target_m.as_ref().and_then(|m| m.name().cloned()).unwrap_or_else(|| "default".to_string());
    if let Some(ref m_name) = monitor_name {
        if m_name == "SPAN_ALL" {
            m_key = "SPAN_ALL".to_string();
        }
    }
    if let Ok(last) = LAST_CONFIG.lock() {
        if let Some(config) = last.get(&m_key) {
            if config == &new_config {
                log::info!("Skip re-apply: Configuration identical for monitor {}", m_key);
                return Ok("Skipped redundant re-apply".to_string());
            }
        }
    }

    // If launching SPAN_ALL, stop all specific monitors.
    // If launching a specific monitor, ensure SPAN_ALL is stopped.
    if m_key == "SPAN_ALL" {
        let _ = stop_video();
    } else {
        stop_video_for_monitor("SPAN_ALL");
        stop_video_for_monitor(&m_key);
    }

    #[cfg(windows)]
    {
        let mpv_path = find_mpv().ok_or("mpv not found. Install: winget install shinchiro.mpv")?;
        let workerw = win32::get_desktop_workerw().unwrap_or(0);
        
    let mut width = target_m.as_ref().map(|m| m.size().width).unwrap_or(1920);
    let mut height = target_m.as_ref().map(|m| m.size().height).unwrap_or(1080);
    let mut x = target_m.as_ref().map(|m| m.position().x).unwrap_or(0);
    let mut y = target_m.as_ref().map(|m| m.position().y).unwrap_or(0);

    // Close any web wallpaper for this monitor
    let window_label = format!("web_wallpaper_{}", m_key.replace(" ", "_").replace("\\", "_"));
    if let Some(window) = app.get_webview_window(&window_label) {
        let _ = window.close();
    }
    
    // If SPAN_ALL, close all web wallpapers
    if m_key == "SPAN_ALL" {
        for (label, window) in app.webview_windows() {
            if label.starts_with("web_wallpaper_") {
                let _ = window.close();
            }
        }
    }

        if m_key == "SPAN_ALL" {
            let mut min_x = i32::MAX;
            let mut min_y = i32::MAX;
            let mut max_x = i32::MIN;
            let mut max_y = i32::MIN;
            for m in &monitors {
                let mx = m.position().x;
                let my = m.position().y;
                let mw = m.size().width as i32;
                let mh = m.size().height as i32;
                min_x = min_x.min(mx);
                min_y = min_y.min(my);
                max_x = max_x.max(mx + mw);
                max_y = max_y.max(my + mh);
            }
            if min_x != i32::MAX {
                x = min_x;
                y = min_y;
                width = (max_x - min_x) as u32;
                height = (max_y - min_y) as u32;
            }
        }

        let target_width = ((width as f64 * scale_percent as f64 / 100.0) / 2.0).round() as u32 * 2;
        let target_height = ((height as f64 * scale_percent as f64 / 100.0) / 2.0).round() as u32 * 2;
        let target_width = target_width.max(2);
        let target_height = target_height.max(2);

        let filter_chain = get_filter_chain(target_width as u64, target_height as u64, video_filter, blur);
        let mute = if volume_percent <= 0 { "yes" } else { "no" };
        let pause_val = if paused { "yes" } else { "no" };

        // Generate a deterministic pipe name based on monitor index or name length
        let pipe_idx = m_key.len() % 10;
        let ipc_server = format!(r"\\.\pipe\itlives-mpv-{}", pipe_idx);

        let mut args = vec![
            format!("--input-ipc-server={}", ipc_server),
            "--loop=inf".to_string(),
            format!("--mute={}", mute),
            format!("--volume={}", volume_percent),
            format!("--speed={}", speed),
            format!("--pause={}", pause_val),
            "--no-osc".to_string(),
            "--no-osd-bar".to_string(),
            "--no-border".to_string(),
            "--no-config".to_string(),
            "--input-default-bindings=no".to_string(),
            "--input-vo-keyboard=no".to_string(),
            "--show-in-taskbar=no".to_string(),
            "--keepaspect=no".to_string(),
            "--force-window=yes".to_string(),
            format!("--geometry={}x{}+{}+{}", width, height, x, y),
            "--ontop=no".to_string(),
            "--vo=gpu-next".to_string(),
            "--gpu-api=d3d11".to_string(),
            "--hwdec=d3d11va".to_string(),
            "--gpu-context=d3d11".to_string(),
            "--panscan=1.0".to_string(),
            format!("--vf={}", filter_chain),
            "--demuxer-max-bytes=32M".to_string(),
            "--demuxer-max-back-bytes=16M".to_string(),
            "--cache=no".to_string(),
            "--vd-lavc-fast".to_string(),
            "--vd-lavc-skiploopfilter=all".to_string(),
            "--vd-lavc-threads=1".to_string(),
            "--dither-depth=no".to_string(),
            "--icc-profile-auto=no".to_string(),
            "--terminal=no".to_string(),
        ];

        if workerw == 0 {
            args.push("--wid=0".to_string());
        }

        if let Some(st) = start_time {
            args.push(format!("--start={}", st));
        }
        if let Some(et) = end_time {
            args.push(format!("--end={}", et));
        }

        args.push(resolved_path.clone());

        let mut cmd = Command::new(mpv_path);
        cmd.args(&args);
        #[cfg(windows)]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        
        let child = cmd.spawn().map_err(|e| format!("Failed to spawn mpv: {}", e))?;
        let pid = child.id();
        
        // Save PID for this monitor
        save_mpv_pid(&m_key, pid);

        if workerw != 0 {
            let m_key_thread = m_key.clone();
            std::thread::spawn(move || {
                for _ in 0..30 { // Try for up to 15 seconds (30 * 500ms)
                    std::thread::sleep(std::time::Duration::from_millis(500));
                    if let Some(hwnd) = win32::find_hwnd_by_pid(pid) {
                        unsafe {
                            let _ = windows::Win32::UI::WindowsAndMessaging::SetParent(
                                windows::Win32::Foundation::HWND(hwnd as _),
                                windows::Win32::Foundation::HWND(workerw as _)
                            );
                            
                            let shelldll: Vec<u16> = "SHELLDLL_DefView\0".encode_utf16().collect();
                            let shell_hwnd = windows::Win32::UI::WindowsAndMessaging::FindWindowExW(
                                windows::Win32::Foundation::HWND(workerw as _),
                                windows::Win32::Foundation::HWND(0 as _),
                                windows::core::PCWSTR(shelldll.as_ptr()),
                                windows::core::PCWSTR::null()
                            ).unwrap_or(windows::Win32::Foundation::HWND(1 as _));

                            let chrome_class: Vec<u16> = "Chrome_WidgetWin_1\0".encode_utf16().collect();
                            let effects_hwnd = windows::Win32::UI::WindowsAndMessaging::FindWindowExW(
                                windows::Win32::Foundation::HWND(workerw as _),
                                windows::Win32::Foundation::HWND(0 as _),
                                windows::core::PCWSTR(chrome_class.as_ptr()),
                                windows::core::PCWSTR::null()
                            ).unwrap_or(windows::Win32::Foundation::HWND(0 as _));

                            // To maintain the sandwich: if effects overlay is active, place video strictly behind it.
                            // Otherwise, place video strictly behind the desktop icons.
                            let mut target_z = if shell_hwnd != windows::Win32::Foundation::HWND(0 as _) && shell_hwnd != windows::Win32::Foundation::HWND(1 as _) {
                                shell_hwnd
                            } else {
                                windows::Win32::Foundation::HWND(1 as _)
                            };

                            if effects_hwnd != windows::Win32::Foundation::HWND(0 as _) && effects_hwnd != windows::Win32::Foundation::HWND(1 as _) {
                                // If effects overlay is found, we use it as the insertion point so mpv slides underneath it
                                target_z = effects_hwnd;
                            }

                            let _ = windows::Win32::UI::WindowsAndMessaging::SetWindowPos(
                                windows::Win32::Foundation::HWND(hwnd as _),
                                target_z,
                                x, y, width as i32, height as i32,
                                windows::Win32::UI::WindowsAndMessaging::SWP_SHOWWINDOW
                            );

                            let _ = windows::Win32::UI::WindowsAndMessaging::SetWindowPos(
                                windows::Win32::Foundation::HWND(hwnd as _),
                                target_z,
                                x, y, width as i32, height as i32,
                                windows::Win32::UI::WindowsAndMessaging::SWP_SHOWWINDOW
                            );
                        }
                        log::info!("Successfully reparented mpv window for monitor {}", m_key_thread);
                        break;
                    }
                }
            });
        }
    }

    if let Ok(mut current) = CURRENT_VIDEO.lock() {
        current.insert(m_key.clone(), path.to_string());
    }

    if let Ok(mut last) = LAST_CONFIG.lock() {
        last.insert(m_key.clone(), new_config);
    }

    log::info!("Video wallpaper set to: {} on monitor {}", path, m_key);
    Ok(format!("Wallpaper set: {} on {}", path, m_key))
}

pub fn set_web_wallpaper(
    app: tauri::AppHandle,
    url: &str,
    monitor_name: Option<String>,
) -> Result<String, String> {
    use tauri::Manager;
    let monitors = app.available_monitors().unwrap_or_default();
    let mut target_m = monitors.first().cloned();
    let mut m_key = target_m.as_ref().and_then(|m| m.name().cloned()).unwrap_or_else(|| "default".to_string());
    
    if let Some(ref m_name) = monitor_name {
        if m_name == "SPAN_ALL" {
            m_key = "SPAN_ALL".to_string();
        } else {
            for m in &monitors {
                if m.name().map(|n| n == m_name).unwrap_or(false) {
                    target_m = Some(m.clone());
                    m_key = m_name.clone();
                    break;
                }
            }
        }
    }

    if m_key == "SPAN_ALL" {
        let _ = stop_video();
    } else {
        stop_video_for_monitor("SPAN_ALL");
        stop_video_for_monitor(&m_key);
    }

    let mut width = target_m.as_ref().map(|m| m.size().width).unwrap_or(1920);
    let mut height = target_m.as_ref().map(|m| m.size().height).unwrap_or(1080);
    let mut x = target_m.as_ref().map(|m| m.position().x).unwrap_or(0);
    let mut y = target_m.as_ref().map(|m| m.position().y).unwrap_or(0);

    if m_key == "SPAN_ALL" {
        let mut min_x = i32::MAX;
        let mut min_y = i32::MAX;
        let mut max_x = i32::MIN;
        let mut max_y = i32::MIN;
        for m in &monitors {
            let mx = m.position().x;
            let my = m.position().y;
            let mw = m.size().width as i32;
            let mh = m.size().height as i32;
            min_x = min_x.min(mx);
            min_y = min_y.min(my);
            max_x = max_x.max(mx + mw);
            max_y = max_y.max(my + mh);
        }
        if min_x != i32::MAX {
            x = min_x;
            y = min_y;
            width = (max_x - min_x) as u32;
            height = (max_y - min_y) as u32;
        }
    }

    let window_label = format!("web_wallpaper_{}", m_key.replace(" ", "_").replace("\\", "_"));

    if let Some(window) = app.get_webview_window(&window_label) {
        window.eval(&format!("window.location.replace('{}');", url.replace("'", "\\'"))).map_err(|e| e.to_string())?;
        if let Ok(mut current) = CURRENT_VIDEO.lock() {
            current.insert(m_key.clone(), url.to_string());
        }
        return Ok(format!("Web wallpaper updated to {} on {}", url, m_key));
    }

    let parsed_url = if url.starts_with("http") {
        tauri::Url::parse(url).unwrap()
    } else {
        let path = std::path::Path::new(url);
        if !path.exists() {
            return Err(format!("Local HTML file not found: {}", url));
        }
        tauri::Url::from_file_path(path).unwrap()
    };

    let window = tauri::WebviewWindowBuilder::new(&app, &window_label, tauri::WebviewUrl::External(parsed_url))
        .decorations(false)
        .transparent(true)
        .skip_taskbar(true)
        .build()
        .map_err(|e| format!("Failed to build webview: {}", e))?;

    #[cfg(windows)]
    {
        let hwnd = window.hwnd().unwrap();
        let workerw = win32::get_desktop_workerw().unwrap_or(0);
        unsafe {
            let _ = windows::Win32::UI::WindowsAndMessaging::SetParent(
                windows::Win32::Foundation::HWND(hwnd.0 as _),
                windows::Win32::Foundation::HWND(workerw as _)
            );
            
            let shelldll: Vec<u16> = "SHELLDLL_DefView\0".encode_utf16().collect();
            let shell_hwnd = windows::Win32::UI::WindowsAndMessaging::FindWindowExW(
                windows::Win32::Foundation::HWND(workerw as _),
                windows::Win32::Foundation::HWND(0 as _),
                windows::core::PCWSTR(shelldll.as_ptr()),
                windows::core::PCWSTR::null()
            ).unwrap_or(windows::Win32::Foundation::HWND(1 as _));

            let mut target_z = if shell_hwnd != windows::Win32::Foundation::HWND(0 as _) && shell_hwnd != windows::Win32::Foundation::HWND(1 as _) {
                shell_hwnd
            } else {
                windows::Win32::Foundation::HWND(1 as _)
            };

            let chrome_class: Vec<u16> = "Chrome_WidgetWin_1\0".encode_utf16().collect();
            let effects_hwnd = windows::Win32::UI::WindowsAndMessaging::FindWindowExW(
                windows::Win32::Foundation::HWND(workerw as _),
                windows::Win32::Foundation::HWND(0 as _),
                windows::core::PCWSTR(chrome_class.as_ptr()),
                windows::core::PCWSTR::null()
            ).unwrap_or(windows::Win32::Foundation::HWND(0 as _));

            // If we are injecting a webview (effects overlay itself uses webview),
            // we should be careful not to place it behind itself. But this is mainly for web-wallpapers.
            // If effects_hwnd exists and is NOT the webview we are currently injecting (hwnd), place behind it.
            if effects_hwnd != windows::Win32::Foundation::HWND(0 as _) && effects_hwnd != windows::Win32::Foundation::HWND(1 as _) && effects_hwnd.0 != hwnd.0 {
                target_z = effects_hwnd;
            }

            let _ = windows::Win32::UI::WindowsAndMessaging::SetWindowPos(
                windows::Win32::Foundation::HWND(hwnd.0 as _),
                target_z,
                x, y, width as i32, height as i32,
                windows::Win32::UI::WindowsAndMessaging::SWP_SHOWWINDOW
            );
        }
    }

    if let Ok(mut current) = CURRENT_VIDEO.lock() {
        current.insert(m_key.clone(), url.to_string());
    }

    Ok(format!("Web wallpaper set: {} on {}", url, m_key))
}

/// Stops the video wallpaper on a specific monitor (by its key).
pub fn stop_video_for_monitor(m_key: &str) {
    let pid_file = mpv_pid_file_for(m_key);
    if let Ok(content) = std::fs::read_to_string(&pid_file) {
        if let Ok(pid) = content.trim().parse::<u32>() {
            let mut cmd = Command::new("taskkill");
            cmd.args(&["/PID", &pid.to_string(), "/T", "/F"]);
            #[cfg(windows)]
            cmd.creation_flags(0x08000000);
            let _ = cmd.output();
        }
    }
    let _ = std::fs::remove_file(&pid_file);
    if let Ok(mut m) = CURRENT_VIDEO.lock() { m.remove(m_key); }
    if let Ok(mut m) = LAST_CONFIG.lock() { m.remove(m_key); }
}

/// Stops all current video wallpapers (all monitors).
pub fn stop_video() -> Result<String, String> {
    let pid_dir = app_data_dir().join("pids");
    if let Ok(entries) = std::fs::read_dir(&pid_dir) {
        for entry in entries.flatten() {
            if let Ok(content) = std::fs::read_to_string(entry.path()) {
                if let Ok(pid) = content.trim().parse::<u32>() {
                    let mut cmd = Command::new("taskkill");
                    cmd.args(&["/PID", &pid.to_string(), "/T", "/F"]);
                    #[cfg(windows)]
                    cmd.creation_flags(0x08000000);
                    let _ = cmd.output();
                }
            }
            let _ = std::fs::remove_file(entry.path());
        }
    }
    if let Ok(mut m) = CURRENT_VIDEO.lock() { m.clear(); }
    if let Ok(mut m) = LAST_CONFIG.lock() { m.clear(); }
    Ok("Wallpaper stopped".to_string())
}

/// Returns the currently playing video path (any monitor).
pub fn get_current() -> Option<String> {
    if let Ok(guard) = CURRENT_VIDEO.lock() {
        return guard.values().next().cloned();
    }
    None
}

pub fn set_speed(speed: f64) -> Result<(), String> {
    let speed = speed.clamp(0.1, 4.0);
    if let Ok(mut last) = LAST_CONFIG.lock() {
        if last.is_empty() { return Ok(()); }
        for config in last.values_mut() {
            config.speed = speed;
        }
    }
    send_ipc_command(&format!(
        "{{\"command\": [\"set_property\", \"speed\", {}]}}\n",
        speed
    ))
}

pub fn set_paused(paused: bool) -> Result<(), String> {
    if LAST_CONFIG.lock().map(|l| l.is_empty()).unwrap_or(true) {
        return Ok(());
    }
    send_ipc_command(&format!(
        "{{\"command\": [\"set_property\", \"pause\", {}]}}\n",
        paused
    ))
}

pub fn set_volume(volume_percent: u64) -> Result<(), String> {
    if LAST_CONFIG.lock().map(|l| l.is_empty()).unwrap_or(true) {
        return Ok(());
    }
    let volume_percent = volume_percent.min(100);
    let muted = if volume_percent == 0 { "true" } else { "false" };
    send_ipc_command(&format!(
        "{{\"command\": [\"set_property\", \"volume\", {}]}}\n{{\"command\": [\"set_property\", \"mute\", {}]}}\n",
        volume_percent, muted
    ))
}

/// Helper to generate the combined filter chain (v2)
fn get_filter_chain(target_width: u64, target_height: u64, preset: &str, blur: u32) -> String {
    let mut filters = Vec::new();
    
    // 1. Initial Scale
    filters.push(format!("scale={}:{}", target_width, target_height));

    // 2. Preset Filters
    match preset {
        "grayscale" => filters.push("format=gray".to_string()),
        "vivid" => filters.push("eq=contrast=1.12:brightness=0:saturation=1.35:gamma=1.0".to_string()),
        "soft" => filters.push("eq=contrast=0.94:brightness=0.04:saturation=0.88:gamma=1.0".to_string()),
        "noir" => filters.push("format=gray,eq=contrast=1.15:brightness=-0.04".to_string()),
        "retro" => filters.push("hue=h=8:s=0.92,eq=contrast=1.05:brightness=0.03:saturation=1.18".to_string()),
        _ => {}
    }

    // 3. Dynamic Blur
    if blur > 0 {
        filters.push(format!("boxblur={}:{}", blur, (blur as f64 * 0.5) as u32));
    }

    filters.join(",")
}

pub fn set_blur(_blur: u32) -> Result<(), String> {
    // Note: This requires re-applying the whole filter chain via IPC.
    // For simplicity, we'll usually trigger set_video for filter changes or skip live blur if too complex.
    // However, we can try to update 'vf' property.
    // We'll leave this to be triggered by set_video for now as it's more robust.
    Ok(())
}

/// Gets the cache directory for downloaded videos.
pub fn get_cache_dir() -> PathBuf {
    app_data_dir().join("wallpapers").join("cache")
}

pub fn app_data_dir() -> PathBuf {
    std::env::var("ITLIVES_RUNTIME_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            let app_data = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".to_string());
            let path = PathBuf::from(app_data).join("itLives");
            let _ = std::fs::create_dir_all(&path);
            path
        })
}

pub fn app_root_dir() -> PathBuf {
    std::env::var("ITLIVES_APP_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(PathBuf::from))
                .unwrap_or_else(|| PathBuf::from("."))
        })
}

/// Cleans up old cached videos and images.
pub fn cleanup_cache(keep: usize) -> Result<usize, String> {
    let cache_dir = get_cache_dir();
    if !cache_dir.exists() {
        return Ok(0);
    }

    let mut entries: Vec<_> = std::fs::read_dir(&cache_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().is_some_and(|ext| {
            let ext_str = ext.to_string_lossy().to_lowercase();
            ext_str == "mp4" || ext_str == "jpg" || ext_str == "jpeg" || ext_str == "png" || ext_str == "webp"
        }))
        .collect();

    entries.sort_by_key(|e| {
        std::cmp::Reverse(
            e.metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .unwrap_or(std::time::SystemTime::UNIX_EPOCH),
        )
    });

    let mut removed = 0;
    if entries.len() > keep {
        for entry in &entries[keep..] {
            if std::fs::remove_file(entry.path()).is_ok() {
                removed += 1;
            }
        }
    }
    Ok(removed)
}

fn process_static_image_if_needed(path: &str) -> Result<String, String> {
    #[cfg(windows)]
    {
        use windows::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SM_CXSCREEN, SM_CYSCREEN};

        let resolved_path = path.to_string();
        let img_path = std::path::Path::new(&resolved_path);
        if !img_path.exists() {
            return Err(format!("Image file not found: {}", resolved_path));
        }

        // 1. Get Screen Resolution
        let screen_w = unsafe { GetSystemMetrics(SM_CXSCREEN) };
        let screen_h = unsafe { GetSystemMetrics(SM_CYSCREEN) };
        
        let (screen_w, screen_h) = if screen_w <= 0 || screen_h <= 0 {
            log::warn!("Invalid screen metrics detected. Defaulting to 1920x1080.");
            (1920, 1080)
        } else {
            (screen_w as u32, screen_h as u32)
        };

        // 2. Open Image and Check Aspect Ratio
        let img = image::open(img_path)
            .map_err(|e| format!("Failed to open static image: {}", e))?;
        
        let img_w = img.width();
        let img_h = img.height();

        if img_w == 0 || img_h == 0 {
            return Err("Image dimensions are zero".to_string());
        }

        let aspect_img = img_w as f32 / img_h as f32;
        let aspect_screen = screen_w as f32 / screen_h as f32;
        
        let diff = (aspect_img - aspect_screen).abs();
        
        // If aspect ratio matches within a tiny threshold, no composite is needed.
        if diff <= 0.05 {
            log::info!("Image matches screen aspect ratio ({} vs {}). No composite needed.", aspect_img, aspect_screen);
            return Ok(resolved_path);
        }

        log::info!(
            "Aspect ratio mismatch ({} vs {}). Applying premium blurred-cover composite...",
            aspect_img,
            aspect_screen
        );

        // 3. Create a composite landscape image
        let scale_x = screen_w as f32 / img_w as f32;
        let scale_y = screen_h as f32 / img_h as f32;

        // Directly scale to a tiny low-res cover image to make resizing and blurring instant (takes <2ms total!)
        let low_res_w = 240u32;
        let low_res_h = (240 * screen_h / screen_w).max(8);

        let scale_cover_low = (low_res_w as f32 / img_w as f32).max(low_res_h as f32 / img_h as f32);
        let cover_low_w = ((img_w as f32 * scale_cover_low).round() as u32).max(low_res_w);
        let cover_low_h = ((img_h as f32 * scale_cover_low).round() as u32).max(low_res_h);

        let cover_low_img = img.resize(cover_low_w, cover_low_h, image::imageops::FilterType::Triangle);
        let crop_low_x = (cover_low_w - low_res_w) / 2;
        let crop_low_y = (cover_low_h - low_res_h) / 2;
        let cover_low_cropped = cover_low_img.crop_imm(crop_low_x, crop_low_y, low_res_w, low_res_h);

        // Blur the low-res cover background
        let blurred_low_res = image::imageops::blur(&cover_low_cropped.to_rgba8(), 4.0);
        let blurred_bg_img = image::DynamicImage::ImageRgba8(blurred_low_res);
        let mut base_img = blurred_bg_img.resize_exact(screen_w, screen_h, image::imageops::FilterType::Triangle).to_rgba8();

        let scale_contain = scale_x.min(scale_y);
        // Clamp contain dimensions to be at most screen_w/screen_h to prevent subtraction underflow
        let contain_w = ((img_w as f32 * scale_contain).round() as u32).min(screen_w);
        let contain_h = ((img_h as f32 * scale_contain).round() as u32).min(screen_h);
        
        // Use Triangle filter (fast and smooth linear scaling) instead of the extremely heavy Lanczos3
        let contain_img = img.resize(contain_w, contain_h, image::imageops::FilterType::Triangle);
        let contain_rgba = contain_img.to_rgba8();

        let overlay_x = ((screen_w - contain_w) / 2) as i64;
        let overlay_y = ((screen_h - contain_h) / 2) as i64;
        
        image::imageops::overlay(&mut base_img, &contain_rgba, overlay_x, overlay_y);

        // 4. Save the composite image in cache directory
        let cache_dir = get_cache_dir();
        let _ = std::fs::create_dir_all(&cache_dir);
        let file_name = img_path.file_stem().unwrap_or_default().to_string_lossy();
        let composite_path = cache_dir.join(format!("{}_composite.png", file_name));

        base_img.save(&composite_path)
            .map_err(|e| format!("Failed to save composite wallpaper image: {}", e))?;

        log::info!("Composite wallpaper successfully written to: {:?}", composite_path);
        Ok(composite_path.to_string_lossy().into_owned())
    }
    #[cfg(not(windows))]
    {
        Ok(path.to_string())
    }
}

/// Sets a static image file as the desktop background using the native Windows API.
pub fn set_static_image(path: &str) -> Result<String, String> {
    let resolved_path = path.to_string();
    let img_path = std::path::Path::new(&resolved_path);
    if !img_path.exists() {
        return Err(format!("Image file not found: {}", resolved_path));
    }

    // Stop any video wallpaper first
    stop_video().ok();

    // Generate blurred cover composite if aspect ratio mismatches screen
    let final_image_path = match process_static_image_if_needed(&resolved_path) {
        Ok(composite_path) => composite_path,
        Err(e) => {
            log::warn!("Failed to process image composite: {}. Falling back to original path.", e);
            resolved_path
        }
    };
    let final_img_path = std::path::Path::new(&final_image_path);

    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        let path_wide: Vec<u16> = final_img_path.as_os_str().encode_wide().chain(std::iter::once(0)).collect();

        unsafe {
            use windows::Win32::UI::WindowsAndMessaging::{
                SystemParametersInfoW, SPI_SETDESKWALLPAPER, SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS
            };

            let res = SystemParametersInfoW(
                SPI_SETDESKWALLPAPER,
                0,
                Some(path_wide.as_ptr() as *mut std::ffi::c_void),
                SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0x01 | 0x02), // SPIF_UPDATEINIFILE | SPIF_SENDCHANGE
            );

            if res.is_err() {
                return Err(format!("SystemParametersInfoW failed: {:?}", res));
            }
        }
    }

    if let Ok(mut current) = CURRENT_VIDEO.lock() {
        current.insert("static".to_string(), path.to_string());
    }

    log::info!("Static desktop background set to image: {}", final_image_path);
    Ok(format!("Static wallpaper set: {}", final_image_path))
}

fn mpv_pid_file_for(m_key: &str) -> PathBuf {
    let safe_key: String = m_key.chars().map(|c| if c.is_alphanumeric() { c } else { '_' }).collect();
    let pid_dir = app_data_dir().join("pids");
    let _ = std::fs::create_dir_all(&pid_dir);
    pid_dir.join(format!("{}.pid", safe_key))
}

fn save_mpv_pid(m_key: &str, pid: u32) {
    let _ = std::fs::write(mpv_pid_file_for(m_key), pid.to_string());
}

fn send_ipc_command(payload: &str) -> Result<(), String> {
    use std::fs::OpenOptions;
    use std::io::Write;

    let mut sent_any = false;
    let mut last_err = String::new();

    for idx in 0..8 {
        let pipe_name = format!(r"\\.\pipe\itlives-mpv-{}", idx);
        
        if let Ok(mut pipe) = OpenOptions::new().write(true).open(&pipe_name) {
            if pipe.write_all(payload.as_bytes()).is_ok() {
                sent_any = true;
            } else {
                last_err = format!("Failed to write to {}", pipe_name);
            }
        }
    }

    if sent_any {
        Ok(())
    } else {
        Err(format!("Failed to connect to any mpv IPC: {}", last_err))
    }
}

/// Finds mpv.exe on the system.
pub(crate) fn find_mpv() -> Option<String> {
    for p in &[
        "C:\\Program Files\\MPV Player\\mpv.exe",
        "C:\\Program Files\\mpv\\mpv.exe",
        "C:\\Program Files (x86)\\mpv\\mpv.exe",
        "C:\\tools\\mpv\\mpv.exe",
    ] {
        if std::path::Path::new(p).exists() {
            return Some(p.to_string());
        }
    }
    if let Ok(out) = {
        let mut cmd = Command::new("where");
        cmd.arg("mpv");
        #[cfg(windows)]
        cmd.creation_flags(0x08000000);
        cmd.output()
    } {
        if out.status.success() {
            let p = String::from_utf8_lossy(&out.stdout)
                .lines()
                .next()
                .unwrap_or("")
                .trim()
                .to_string();
            if !p.is_empty() {
                return Some(p);
            }
        }
    }
    None
}
