use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Manager};

lazy_static::lazy_static! {
    static ref TRACKER_RUNNING: Arc<AtomicBool> = Arc::new(AtomicBool::new(false));
}

#[derive(serde::Serialize)]
pub struct IconPos {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

#[cfg(windows)]
pub fn start_icon_tracking(app_handle: AppHandle) {
    if TRACKER_RUNNING.load(Ordering::SeqCst) {
        return;
    }
    TRACKER_RUNNING.store(true, Ordering::SeqCst);

    std::thread::spawn(move || {
        use std::ffi::c_void;
        use std::time::Duration;
        use windows::core::PCWSTR;
        use windows::Win32::Foundation::{CloseHandle, HWND, LPARAM, WPARAM};
        use windows::Win32::System::Memory::{
            VirtualAllocEx, VirtualFreeEx, MEM_COMMIT, MEM_RELEASE, MEM_RESERVE, PAGE_READWRITE,
        };
        use windows::Win32::System::Diagnostics::Debug::ReadProcessMemory;
        use windows::Win32::System::Threading::{OpenProcess, PROCESS_VM_OPERATION, PROCESS_VM_READ, PROCESS_VM_WRITE};
        use windows::Win32::UI::WindowsAndMessaging::{
            FindWindowExW, GetWindowThreadProcessId, SendMessageW,
        };

        const LVM_GETITEMCOUNT: u32 = 0x1000 + 4;
        const LVM_GETITEMPOSITION: u32 = 0x1000 + 16;

        let mut last_json_icons: Option<String> = None;
        let mut cached_listview_hwnd = HWND(0 as _);

        while TRACKER_RUNNING.load(Ordering::SeqCst) {
            std::thread::sleep(Duration::from_millis(100)); // 10 FPS

            unsafe {
                if cached_listview_hwnd == HWND(0 as _) || windows::Win32::UI::WindowsAndMessaging::IsWindow(cached_listview_hwnd).as_bool() == false {
                    let worker_hwnd = crate::wallpaper::desktop::win32::get_desktop_workerw().unwrap_or(0);
                    if worker_hwnd == 0 {
                        continue;
                    }

                    let shelldll_class: Vec<u16> = "SHELLDLL_DefView\0".encode_utf16().collect();
                    let shell_hwnd = FindWindowExW(
                        HWND(worker_hwnd as _),
                        HWND(0 as _),
                        PCWSTR(shelldll_class.as_ptr()),
                        PCWSTR::null(),
                    )
                    .unwrap_or(HWND(0 as _));

                    if shell_hwnd == HWND(0 as _) {
                        continue;
                    }

                    let syslistview_class: Vec<u16> = "SysListView32\0".encode_utf16().collect();
                    let listview_hwnd = FindWindowExW(
                        shell_hwnd,
                        HWND(0 as _),
                        PCWSTR(syslistview_class.as_ptr()),
                        PCWSTR::null(),
                    )
                    .unwrap_or(HWND(0 as _));

                    if listview_hwnd == HWND(0 as _) {
                        continue;
                    }
                    cached_listview_hwnd = listview_hwnd;
                }

                let listview_hwnd = cached_listview_hwnd;

                let count = SendMessageW(listview_hwnd, LVM_GETITEMCOUNT, WPARAM(0), LPARAM(0)).0 as i32;
                if count <= 0 {
                    continue;
                }

                let mut pid = 0;
                GetWindowThreadProcessId(listview_hwnd, Some(&mut pid));

                if pid == 0 {
                    continue;
                }

                let process_handle = OpenProcess(
                    PROCESS_VM_OPERATION | PROCESS_VM_READ | PROCESS_VM_WRITE,
                    false,
                    pid,
                );

                if let Ok(handle) = process_handle {
                    let point_size = std::mem::size_of::<windows::Win32::Foundation::POINT>();
                    let mem_ptr = VirtualAllocEx(
                        handle,
                        None,
                        point_size,
                        MEM_COMMIT | MEM_RESERVE,
                        PAGE_READWRITE,
                    );

                    if !mem_ptr.is_null() {
                        let mut icons = Vec::with_capacity(count as usize);

                        for i in 0..count {
                            let res = SendMessageW(
                                listview_hwnd,
                                LVM_GETITEMPOSITION,
                                WPARAM(i as usize),
                                LPARAM(mem_ptr as isize),
                            ).0;

                            if res != 0 {
                                let mut pt = windows::Win32::Foundation::POINT { x: 0, y: 0 };
                                let mut bytes_read = 0;
                                let read_res = ReadProcessMemory(
                                    handle,
                                    mem_ptr,
                                    &mut pt as *mut _ as *mut c_void,
                                    point_size,
                                    Some(&mut bytes_read),
                                );

                                if read_res.is_ok() && bytes_read == point_size {
                                    icons.push(IconPos {
                                        x: pt.x,
                                        y: pt.y,
                                        w: 80, // Default icon width
                                        h: 100, // Default icon height
                                    });
                                }
                            }
                        }

                        let _ = VirtualFreeEx(handle, mem_ptr, 0, MEM_RELEASE);

                        // Dispatch to interactive wallpapers
                        if !icons.is_empty() {
                            if let Ok(json_icons) = serde_json::to_string(&icons) {
                                if Some(&json_icons) != last_json_icons.as_ref() {
                                    last_json_icons = Some(json_icons.clone());
                                    for (label, window) in app_handle.webview_windows() {
                                        if label.starts_with("web_wallpaper_") {
                                            let _ = window.eval(&format!(
                                                "if (window.__dispatch_icons) window.__dispatch_icons({});",
                                                json_icons
                                            ));
                                        }
                                    }
                                }
                            }
                        }
                    }

                    let _ = CloseHandle(handle);
                }
            }
        }
    });
}

#[cfg(not(windows))]
pub fn start_icon_tracking(_app_handle: AppHandle) {}

pub fn stop_icon_tracking() {
    TRACKER_RUNNING.store(false, Ordering::SeqCst);
}
