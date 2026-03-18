use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

use crate::wallpaper::state::AppStateStore;

#[cfg(windows)]
use windows::Win32::Foundation::RECT;
#[cfg(windows)]
use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::{
    GetClassNameW, GetForegroundWindow, GetSystemMetrics, GetWindowRect, SM_CXSCREEN, SM_CYSCREEN,
};

static MONITOR_STARTED: AtomicBool = AtomicBool::new(false);

/// Thread-safe flag to force resume if we want to override
static FORCE_PAUSE: AtomicBool = AtomicBool::new(false);
static IS_PAUSED: AtomicBool = AtomicBool::new(false);

pub fn start_monitor(state_store: AppStateStore) {
    if MONITOR_STARTED.swap(true, Ordering::SeqCst) {
        return;
    }

    log::info!("Starting performance monitor thread...");

    thread::spawn(move || {
        loop {
            thread::sleep(Duration::from_millis(1500));

            let mut should_pause = force_paused();
            let state = state_store.snapshot();

            #[cfg(windows)]
            {
                if !should_pause && state.auto_pause_enabled {
                    should_pause = check_should_pause();
                }
            }

            let was_paused = IS_PAUSED.load(Ordering::Relaxed);

            if should_pause != was_paused {
                log::info!("Performance state changing: Paused = {}", should_pause);
                if set_mpv_pause(should_pause) {
                    IS_PAUSED.store(should_pause, Ordering::Relaxed);
                }
            } else if should_pause && !was_paused {
                // Edge case: state might not match mpv actual state if mpv restarted,
                // but we send the command periodically just in case?
                // No, just track it to avoid spam.
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
            log::info!("Successfully sent pause={} to mpv", pause);
            true
        }
        Err(error) => {
            log::warn!("Failed to send IPC command to mpv: {}", error);
            false
        }
    }
}

/// Run diagnostics to determine if wallpaper loop should be paused to preserve system resources
#[cfg(windows)]
fn check_should_pause() -> bool {
    unsafe {
        // 1. Check power state (Battery vs AC)
        let mut status = SYSTEM_POWER_STATUS::default();
        if GetSystemPowerStatus(&mut status).is_ok() {
            if status.ACLineStatus == 0 {
                log::info!("Auto-pause trigger: Battery power detected.");
                return true;
            }
        }

        // 2. Check current active window
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            log::info!("Auto-pause trigger: Null foreground window (PC locked or overlay).");
            return true;
        }

        // --- FIX: Do not pause if the foreground window belongs to our own app! ---
        let mut process_id = 0u32;
        windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId(
            hwnd,
            Some(&mut process_id),
        );
        if process_id == std::process::id() {
            // Foreground window is our dashboard/tray, do not pause
            return false;
        }

        // 3. Check for fullscreen application
        let mut rect = RECT::default();
        if GetWindowRect(hwnd, &mut rect).is_ok() {
            let width = rect.right - rect.left;
            let height = rect.bottom - rect.top;

            let screen_w = GetSystemMetrics(SM_CXSCREEN);
            let screen_h = GetSystemMetrics(SM_CYSCREEN);

            if width >= screen_w && height >= screen_h {
                // Validate we are not looking at the desktop itself
                let mut class_name = [0u16; 256];
                let len = GetClassNameW(hwnd, &mut class_name);
                let c_name = String::from_utf16_lossy(&class_name[..len as usize]);
                let c_name = c_name.trim_end_matches('\0');

                if c_name != "WorkerW" && c_name != "Progman" {
                    log::info!(
                        "Auto-pause trigger: Fullscreen app detected (ClassName: {}).",
                        c_name
                    );
                    return true;
                }
            }
        }

        false
    }
}
