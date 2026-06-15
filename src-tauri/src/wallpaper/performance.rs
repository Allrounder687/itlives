use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

use crate::wallpaper::state::AppStateStore;

#[cfg(windows)]
use windows::Win32::Foundation::RECT;
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::{
    GetClassNameW, GetForegroundWindow, GetSystemMetrics, GetWindowRect, SM_CXSCREEN, SM_CYSCREEN,
};

static MONITOR_STARTED: AtomicBool = AtomicBool::new(false);

/// Thread-safe flag to force resume if we want to override
static FORCE_PAUSE: AtomicBool = AtomicBool::new(false);
static IS_PAUSED: AtomicBool = AtomicBool::new(true);
use tauri::Emitter;

pub fn start_monitor(state_store: AppStateStore, app_handle: tauri::AppHandle) {
    if MONITOR_STARTED.swap(true, Ordering::SeqCst) {
        return;
    }

    log::info!("Starting performance monitor thread (Initial state: Forced Unpause Request)...");

    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(1500));

        let state = state_store.snapshot();
        if !state.is_playing {
            IS_PAUSED.store(false, Ordering::Relaxed);
            continue;
        }

        let mut should_pause = state.paused || force_paused();
        let mut reason = if state.paused {
            "Manual User Pause"
        } else if force_paused() {
            "Force-pause flag"
        } else {
            "None"
        };

        #[cfg(windows)]
        {
            if !should_pause && state.auto_pause_enabled {
                if let Some(r) = check_should_pause_detailed(&state) {
                    should_pause = true;
                    reason = r;
                }
            }
        }

        let was_paused = IS_PAUSED.load(Ordering::Relaxed);

        if should_pause != was_paused {
            log::info!(
                "Performance monitor: State changing to Paused = {} because: {}",
                should_pause,
                reason
            );
            
            // Send IPC to MPV if it's running (ignore failure)
            let _ = set_mpv_pause(&app_handle, should_pause);
            
            // Always update state and emit to frontend (for HTML interactives)
            IS_PAUSED.store(should_pause, Ordering::Relaxed);

            #[derive(serde::Serialize, Clone)]
            struct PausePayload {
                paused: bool,
            }
            let _ = app_handle.emit(
                "wallpaper-paused",
                PausePayload {
                    paused: should_pause,
                },
            );
        }
    });
}

fn force_paused() -> bool {
    FORCE_PAUSE.load(Ordering::Relaxed)
}

fn set_mpv_pause(app: &tauri::AppHandle, pause: bool) -> bool {
    match crate::wallpaper::desktop::set_paused(app, pause) {
        Ok(()) => {
            log::info!("Successfully sent IPC pause={} to mpv", pause);
            true
        }
        Err(error) => {
            // Log as debug because this is common if mpv is still launching or shutting down
            log::debug!(
                "Could not send IPC to mpv (usually okay during transitions): {}",
                error
            );
            false
        }
    }
}

/// Run diagnostics to determine if wallpaper loop should be paused to preserve system resources
#[cfg(windows)]
fn check_should_pause_detailed(state: &crate::wallpaper::state::WallpaperState) -> Option<&'static str> {
    unsafe {
        // 1. Check Battery status
        let mut power_status = windows::Win32::System::Power::SYSTEM_POWER_STATUS::default();
        if windows::Win32::System::Power::GetSystemPowerStatus(&mut power_status).is_ok() {
            if power_status.ACLineStatus == 0 && state.perf_battery == "pause" {
                return Some("Running on battery power");
            }
            if power_status.SystemStatusFlag == 1 && state.perf_battery_saver == "pause" {
                return Some("Running on battery saver");
            }
        }

        // 2. Check Remote Session status
        use windows::Win32::UI::WindowsAndMessaging::SM_REMOTESESSION;
        if GetSystemMetrics(SM_REMOTESESSION) != 0 && state.perf_remote_desktop == "pause" {
            return Some("Running on Remote Desktop session");
        }

        // 3. Check current active window
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return Some("No foreground window (PC locked?)");
        }

        // 4. Identify if the foreground window belongs to our app.
        //    WebView2 (msedgewebview2.exe) runs in a separate process but is
        //    a child of our main Tauri window, so we must check BOTH the
        //    direct foreground HWND and its root ancestor.
        let our_pid = std::process::id();

        let mut fg_pid = 0u32;
        windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId(hwnd, Some(&mut fg_pid));
        if fg_pid == our_pid {
            return None;
        }

        use windows::Win32::UI::WindowsAndMessaging::{GetAncestor, GA_ROOTOWNER};
        let root_hwnd = GetAncestor(hwnd, GA_ROOTOWNER);
        let mut root_pid = 0u32;
        windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId(
            root_hwnd,
            Some(&mut root_pid),
        );
        if root_pid == our_pid {
            return None;
        }

        // Also check class name – WebView2/Chrome widgets are part of our app
        let mut class_name = [0u16; 256];
        let len = GetClassNameW(hwnd, &mut class_name);
        let c_name = String::from_utf16_lossy(&class_name[..len as usize]);
        let fg_class = c_name.trim_end_matches('\0');

        // Chrome_WidgetWin_* is the WebView2/Chromium embedded class used by Tauri
        if fg_class == "Shell_TrayWnd"
            || fg_class == "Shell_SecondaryTrayWnd"
        {
            return None;
        }

        // 5. Check for foreground application and apply pause rules
        if fg_class != "WorkerW" && fg_class != "Progman" && fg_class != "mpv" {
            // Check if active window is fullscreen
            let mut rect = RECT::default();
            let _ = GetWindowRect(hwnd, &mut rect);
            let cx = GetSystemMetrics(SM_CXSCREEN);
            let cy = GetSystemMetrics(SM_CYSCREEN);
            let is_fullscreen = rect.left == 0 && rect.top == 0 && rect.right == cx && rect.bottom == cy;

            if is_fullscreen {
                if state.perf_fullscreen == "pause" {
                    return Some("Fullscreen application is active");
                }
            } else {
                if state.perf_focused == "pause" {
                    return Some("Focused window is active");
                }
            }
        }

        None
    }
}
