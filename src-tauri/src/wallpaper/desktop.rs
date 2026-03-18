//! Desktop wallpaper integration using Win32 API.
//! Embeds video behind desktop icons by finding the WorkerW window.

use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;

/// Global state tracking the currently playing wallpaper video path.
static CURRENT_VIDEO: Mutex<Option<String>> = Mutex::new(None);
#[cfg(windows)]
mod win32 {
    use std::sync::Mutex;
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM, WPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, FindWindowExW, FindWindowW, SendMessageTimeoutW, SetWindowPos, SMTO_NORMAL,
        SWP_NOACTIVATE, SWP_NOZORDER, SWP_SHOWWINDOW,
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
                WPARAM(0xD),
                LPARAM(0x1),
                SMTO_NORMAL,
                1000,
                Some(&mut result_val),
            );

            // Small delay to let Windows create the WorkerW
            std::thread::sleep(std::time::Duration::from_millis(200));

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

        let mut class_name = [0u16; 256];
        let len = windows::Win32::UI::WindowsAndMessaging::GetClassNameW(hwnd, &mut class_name);
        let c_name = String::from_utf16_lossy(&class_name[..len as usize]);

        if c_name == "WorkerW" || c_name == "Progman" {
            let shell = FindWindowExW(
                hwnd,
                HWND::default(),
                PCWSTR(shelldll.as_ptr()),
                PCWSTR::null(),
            );

            // If it DOES have SHELLDLL_DefView, it is target containment window layer!
            if shell.is_ok() && !shell.unwrap().is_invalid() {
                use windows::Win32::UI::WindowsAndMessaging::{
                    GetClassNameW, GetWindow, GW_HWNDNEXT,
                };

                // The WorkerW window created by 0x052C is usually placed immediately behind the icons window.
                if let Ok(next) = GetWindow(hwnd, GW_HWNDNEXT) {
                    let mut cn_sub = [0u16; 256];
                    let len_sub = GetClassNameW(next, &mut cn_sub);
                    let class_sub = String::from_utf16_lossy(&cn_sub[..len_sub as usize]);
                    if class_sub == "WorkerW" {
                        if let Ok(mut g) = FOUND_WORKERW.lock() {
                            *g = next.0 as isize;
                        }
                        return BOOL(0); // Stop enumeration
                    }
                }

                // Fallback to the icons window itself if adjacent is not found
                if let Ok(mut g) = FOUND_WORKERW.lock() {
                    *g = hwnd.0 as isize;
                }
                return BOOL(0); // Stop enumeration
            }
        }
        BOOL(1) // Continue enumeration
    }
}

/// Sets a video file as a live desktop wallpaper using mpv.
pub fn set_video(
    path: &str,
    scale_percent: u64,
    volume_percent: u64,
    video_filter: &str,
    paused: bool,
) -> Result<String, String> {
    let resolved_path = path.to_string();
    let is_url = path.starts_with("http://") || path.starts_with("https://");
    let scale_percent = scale_percent.clamp(25, 200);
    let volume_percent = volume_percent.min(100);

    if is_url && path.contains("motionbgs.com") && !path.ends_with(".mp4") {
        log::info!("Detected motionbgs webpage. Applying automatic extractor...");
    }

    let video_path = PathBuf::from(&resolved_path);
    if !is_url && !video_path.exists() {
        return Err(format!("Video file not found: {}", resolved_path));
    }

    // Kill any existing mpv wallpaper process
    stop_video().ok();

    #[cfg(windows)]
    {
        let _mpv_path = find_mpv().ok_or("mpv not found. Install: winget install shinchiro.mpv")?;

        let workerw = win32::get_desktop_workerw().unwrap_or(0);
        log::info!("Spawning standalone PowerShell self-healing script fix wrapper layout... WorkerW: {}", workerw);

        let script_path = app_root_dir()
            .join("scripts")
            .join("set_wallpaper_cli_v2.ps1");
        let _child = Command::new("powershell")
            .args(&[
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                &script_path.to_string_lossy(),
                "-VideoPath",
                path,
                "-ScalePercent",
                &scale_percent.to_string(),
                "-VolumePercent",
                &volume_percent.to_string(),
                "-VideoFilter",
                video_filter,
                "-StartPaused",
                if paused { "$true" } else { "$false" },
                "-WindowHandle",
                &workerw.to_string(),
            ])
            .spawn()
            .map_err(|e| format!("Failed to launch powershell self-healing wrapper: {}", e))?;
    }

    if let Ok(mut current) = CURRENT_VIDEO.lock() {
        *current = Some(path.to_string());
    }

    log::info!("Video wallpaper set to: {}", path);
    Ok(format!("Wallpaper set: {} at {}%", path, scale_percent))
}

/// Stops all current video wallpapers.
pub fn stop_video() -> Result<String, String> {
    if let Ok(content) = std::fs::read_to_string(mpv_pid_file()) {
        for pid_str in content.lines() {
            if let Ok(pid) = pid_str.trim().parse::<u32>() {
                let _ = Command::new("taskkill")
                    .args(&["/PID", &pid.to_string(), "/T", "/F"])
                    .output();
            }
        }
    }
    let _ = std::fs::remove_file(mpv_pid_file());
    if let Ok(mut current) = CURRENT_VIDEO.lock() {
        *current = None;
    }
    Ok("Wallpaper stopped".to_string())
}

/// Returns the currently playing video path.
pub fn get_current() -> Option<String> {
    CURRENT_VIDEO.lock().ok().and_then(|v| v.clone())
}

pub fn set_paused(paused: bool) -> Result<(), String> {
    send_ipc_command(&format!(
        "{{\"command\": [\"set_property\", \"pause\", {}]}}\n",
        paused
    ))
}

pub fn set_volume(volume_percent: u64) -> Result<(), String> {
    let volume_percent = volume_percent.min(100);
    let muted = if volume_percent == 0 { "true" } else { "false" };
    send_ipc_command(&format!(
        "{{\"command\": [\"set_property\", \"volume\", {}]}}\n{{\"command\": [\"set_property\", \"mute\", {}]}}\n",
        volume_percent, muted
    ))
}

/// Gets the cache directory for downloaded videos.
pub fn get_cache_dir() -> PathBuf {
    app_data_dir().join("wallpapers").join("redgifs")
}

pub fn app_data_dir() -> PathBuf {
    std::env::var("OPENCLAW_LWP_RUNTIME_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| app_root_dir().join("runtime"))
}

pub fn app_root_dir() -> PathBuf {
    std::env::var("OPENCLAW_LWP_APP_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .parent()
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("."))
        })
}

/// Cleans up old cached videos.
pub fn cleanup_cache(keep: usize) -> Result<usize, String> {
    let cache_dir = get_cache_dir();
    if !cache_dir.exists() {
        return Ok(0);
    }

    let mut entries: Vec<_> = std::fs::read_dir(&cache_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().is_some_and(|ext| ext == "mp4"))
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

fn mpv_pid_file() -> PathBuf {
    app_data_dir().join("mpv.pid")
}

fn read_mpv_pid() -> Option<u32> {
    std::fs::read_to_string(mpv_pid_file())
        .ok()
        .and_then(|raw| raw.trim().parse::<u32>().ok())
}

fn send_ipc_command(payload: &str) -> Result<(), String> {
    use std::fs::OpenOptions;
    use std::io::Write;

    let mut sent_any = false;
    let mut last_err = String::new();

    for idx in 0..8 {
        let pipe_name = format!(r"\\.\pipe\openclaw-mpv-{}", idx);
        
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
    if let Ok(out) = Command::new("where").arg("mpv").output() {
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
