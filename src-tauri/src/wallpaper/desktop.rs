//! Desktop wallpaper integration using Win32 API.
//! Embeds video behind desktop icons by finding the WorkerW window.

use std::path::PathBuf;
use std::process::Command;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::sync::Mutex;
use lazy_static::lazy_static;

lazy_static! {
    static ref CURRENT_VIDEO: Mutex<Option<String>> = Mutex::new(None);
    static ref LAST_CONFIG: Mutex<Option<WallpaperConfig>> = Mutex::new(None);
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

            // If it DOES have SHELLDLL_DefView, it is the parent containing icons!
            if shell.is_ok() && !shell.unwrap().is_invalid() {
                use windows::Win32::UI::WindowsAndMessaging::{
                    GetClassNameW, GetWindow, GW_HWNDNEXT, GW_HWNDPREV,
                };

                // 1. Check adjacent Next Sibling (Windows 10 Standard)
                if let Ok(next) = GetWindow(hwnd, GW_HWNDNEXT) {
                    let mut cn_sub = [0u16; 256];
                    let len_sub = GetClassNameW(next, &mut cn_sub);
                    let class_sub = String::from_utf16_lossy(&cn_sub[..len_sub as usize]);
                    if class_sub == "WorkerW" {
                        if let Ok(mut g) = FOUND_WORKERW.lock() {
                            *g = next.0 as isize;
                        }
                        return BOOL(0);
                    }
                }

                // 2. Check adjacent Previous Sibling (Windows 11 Fallback)
                if let Ok(prev) = GetWindow(hwnd, GW_HWNDPREV) {
                    let mut cn_sub = [0u16; 256];
                    let len_sub = GetClassNameW(prev, &mut cn_sub);
                    let class_sub = String::from_utf16_lossy(&cn_sub[..len_sub as usize]);
                    if class_sub == "WorkerW" {
                        if let Ok(mut g) = FOUND_WORKERW.lock() {
                            *g = prev.0 as isize;
                        }
                        return BOOL(0);
                    }
                }

                // Standard fallback to self layer if sibling is missing
                if let Ok(mut g) = FOUND_WORKERW.lock() {
                    *g = hwnd.0 as isize;
                }
                return BOOL(0);
            }
        }
        BOOL(1)
    }
}

/// Sets a video file as a live desktop wallpaper using mpv.
pub fn set_video(
    path: &str,
    scale_percent: u64,
    volume_percent: u64,
    video_filter: &str,
    speed: f64,
    blur: u32,
    paused: bool,
    start_time: Option<f64>,
    end_time: Option<f64>,
) -> Result<String, String> {
    let resolved_path = path.to_string();
    let is_url = resolved_path.starts_with("http");
    let scale_percent = scale_percent.clamp(25, 200);
    let volume_percent = volume_percent.min(100);

    let video_path = std::path::Path::new(&resolved_path);
    if !is_url && !video_path.exists() {
        return Err(format!("Video file not found: {}", resolved_path));
    }

    // --- Smart Skip Check ---
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

    if let Ok(last) = LAST_CONFIG.lock() {
        let last: &Option<WallpaperConfig> = &*last;
        if let Some(config) = last.as_ref() {
            if config == &new_config {
                log::info!("Skip re-apply: Configuration is identical to active wallpaper.");
                return Ok("Skipped redundant re-apply".to_string());
            }
        }
    }

    // Kill any existing mpv wallpaper process
    stop_video().ok();

    #[cfg(windows)]
    {
        let _mpv_path = find_mpv().ok_or("mpv not found. Install: winget install shinchiro.mpv")?;

        let workerw = win32::get_desktop_workerw().unwrap_or(0);
        log::info!("Spawning standalone PowerShell self-healing script fix wrapper layout... WorkerW: {}", workerw);

        let script_content = include_str!("../../../scripts/set_wallpaper_cli_v2.ps1");
        let script_dir = app_data_dir().join("scripts");
        let _ = std::fs::create_dir_all(&script_dir);
        let script_path = script_dir.join("set_wallpaper_cli_v2.ps1");
        let _ = std::fs::write(&script_path, script_content);

        let mut args = vec![
            "-NoProfile".to_string(),
            "-ExecutionPolicy".to_string(),
            "Bypass".to_string(),
            "-File".to_string(),
            script_path.to_string_lossy().into_owned(),
            "-VideoPath".to_string(),
            path.to_string(),
            "-ScalePercent".to_string(),
            scale_percent.to_string(),
            "-VolumePercent".to_string(),
            volume_percent.to_string(),
            "-VideoFilter".to_string(),
            video_filter.to_string(),
            "-StartPaused".to_string(),
            if paused { "1".to_string() } else { "0".to_string() },
            "-WindowHandle".to_string(),
            workerw.to_string(),
            "-MpvPath".to_string(),
            _mpv_path.to_string(),
            "-Speed".to_string(),
            speed.to_string(),
            "-BlurStrength".to_string(),
            blur.to_string(),
        ];

        if let Some(st) = start_time {
            args.push("-StartTime".to_string());
            args.push(st.to_string());
        }

        if let Some(et) = end_time {
            args.push("-EndTime".to_string());
            args.push(et.to_string());
        }

        let mut cmd = Command::new("powershell");
        cmd.args(&args);
        #[cfg(windows)]
        cmd.creation_flags(0x08000000);
        
        let _child = cmd.spawn()
            .map_err(|e| format!("Failed to launch powershell self-healing wrapper: {}", e))?;
    }

    if let Ok(mut current) = CURRENT_VIDEO.lock() {
        let current: &mut Option<String> = &mut *current;
        *current = Some(path.to_string());
    }

    if let Ok(mut last) = LAST_CONFIG.lock() {
        let last: &mut Option<WallpaperConfig> = &mut *last;
        *last = Some(new_config);
    }

    log::info!("Video wallpaper set to: {}", path);
    Ok(format!("Wallpaper set: {} at {}%", path, scale_percent))
}

/// Stops all current video wallpapers.
pub fn stop_video() -> Result<String, String> {
    if let Ok(content) = std::fs::read_to_string(mpv_pid_file()) {
        for pid_str in content.lines() {
            if let Ok(pid) = pid_str.trim().parse::<u32>() {
                let mut cmd = Command::new("taskkill");
                cmd.args(&["/PID", &pid.to_string(), "/T", "/F"]);
                #[cfg(windows)]
                cmd.creation_flags(0x08000000);
                let _ = cmd.output();
            }
        }
    }
    let _ = std::fs::remove_file(mpv_pid_file());
    if let Ok(mut current) = CURRENT_VIDEO.lock() {
        *current = None;
    }
    if let Ok(mut last) = LAST_CONFIG.lock() {
        let last: &mut Option<WallpaperConfig> = &mut *last;
        *last = None;
    }
    Ok("Wallpaper stopped".to_string())
}

/// Returns the currently playing video path.
pub fn get_current() -> Option<String> {
    if let Ok(guard) = CURRENT_VIDEO.lock() {
        return guard.clone();
    }
    None
}

pub fn set_speed(speed: f64) -> Result<(), String> {
    let speed = speed.clamp(0.1, 4.0);
    // Also update last config cache so we don't accidentally re-apply with old speed later
    if let Ok(mut last) = LAST_CONFIG.lock() {
        let last: &mut Option<WallpaperConfig> = &mut *last;
        if let Some(config) = last.as_mut() {
            config.speed = speed;
        }
    }
    send_ipc_command(&format!(
        "{{\"command\": [\"set_property\", \"speed\", {}]}}\n",
        speed
    ))
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
    app_data_dir().join("wallpapers").join("redgifs")
}

pub fn app_data_dir() -> PathBuf {
    std::env::var("OPENCLAW_LWP_RUNTIME_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            let app_data = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".to_string());
            let path = PathBuf::from(app_data).join("OpenClaw_LWP");
            let _ = std::fs::create_dir_all(&path);
            path
        })
}

pub fn app_root_dir() -> PathBuf {
    std::env::var("OPENCLAW_LWP_APP_DIR")
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

/// Sets a static image file as the desktop background using the native Windows API.
pub fn set_static_image(path: &str) -> Result<String, String> {
    let resolved_path = path.to_string();
    let img_path = std::path::Path::new(&resolved_path);
    if !img_path.exists() {
        return Err(format!("Image file not found: {}", resolved_path));
    }

    // Stop any video wallpaper first
    stop_video().ok();

    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        let path_wide: Vec<u16> = img_path.as_os_str().encode_wide().chain(std::iter::once(0)).collect();

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
        *current = Some(path.to_string());
    }

    log::info!("Static desktop background set to image: {}", path);
    Ok(format!("Static wallpaper set: {}", path))
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
