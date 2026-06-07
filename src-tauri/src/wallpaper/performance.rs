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
                if let Some(r) = check_should_pause_detailed() {
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
            if set_mpv_pause(should_pause) {
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
        }
    });
}

fn force_paused() -> bool {
    FORCE_PAUSE.load(Ordering::Relaxed)
}

fn set_mpv_pause(pause: bool) -> bool {
    match crate::wallpaper::desktop::set_paused(pause) {
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
fn check_should_pause_detailed() -> Option<&'static str> {
    unsafe {
        // 1. Check for manual/forced conditions that override auto-logic
        // (Previously battery check was here, removed to avoid immediate pause on apply)

        // 2. Check current active window
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return Some("No foreground window (PC locked?)");
        }

        // 3. Identify if the foreground window belongs to our app.
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
        if fg_class.starts_with("Chrome_WidgetWin")
            || fg_class.starts_with("Tauri")
            || fg_class.contains("WebView")
            || fg_class == "Shell_TrayWnd"
            || fg_class == "Shell_SecondaryTrayWnd"
            || fg_class == "CabinetWClass"
        {
            return None;
        }

        // 4. Check for foreground application
        if fg_class != "WorkerW" && fg_class != "Progman" && fg_class != "mpv" {
            return Some("Focused window is active (Non-Desktop, Non-App)");
        }

        None
    }
}
