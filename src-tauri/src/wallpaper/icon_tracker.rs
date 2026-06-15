use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Manager};

lazy_static::lazy_static! {
    static ref TRACKER_RUNNING: Arc<AtomicBool> = Arc::new(AtomicBool::new(false));
    static ref PENDING_SCAN: Arc<AtomicBool> = Arc::new(AtomicBool::new(false));
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
            GetMessageW, TranslateMessage, DispatchMessageW,
            EVENT_OBJECT_LOCATIONCHANGE, EVENT_OBJECT_CREATE, EVENT_OBJECT_DESTROY, EVENT_OBJECT_REORDER,
            WINEVENT_OUTOFCONTEXT, MSG,
        };
        use windows::Win32::UI::Accessibility::{SetWinEventHook, UnhookWinEvent, HWINEVENTHOOK};
        
        const LVM_GETITEMCOUNT: u32 = 0x1000 + 4;
        const LVM_GETITEMPOSITION: u32 = 0x1000 + 16;
        
        let mut last_json_icons: Option<String> = None;
        let mut cached_listview_hwnd = HWND(0 as _);

        // Find the listview
        unsafe {
            let worker_hwnd = crate::wallpaper::desktop::win32::get_desktop_workerw().unwrap_or(0);
            if worker_hwnd != 0 {
                let shelldll_class: Vec<u16> = "SHELLDLL_DefView\0".encode_utf16().collect();
                let shell_hwnd = FindWindowExW(
                    HWND(worker_hwnd as _),
                    HWND(0 as _),
                    PCWSTR(shelldll_class.as_ptr()),
                    PCWSTR::null(),
                ).unwrap_or(HWND(0 as _));

                if shell_hwnd != HWND(0 as _) {
                    let syslistview_class: Vec<u16> = "SysListView32\0".encode_utf16().collect();
                    cached_listview_hwnd = FindWindowExW(
                        shell_hwnd,
                        HWND(0 as _),
                        PCWSTR(syslistview_class.as_ptr()),
                        PCWSTR::null(),
                    ).unwrap_or(HWND(0 as _));
                }
            }
        }

        // We use a local function to scan icons so we can call it initially and on events
        let mut scan_icons = |listview_hwnd: HWND| {
            if listview_hwnd == HWND(0 as _) { return; }
            unsafe {
                let count = SendMessageW(listview_hwnd, LVM_GETITEMCOUNT, WPARAM(0), LPARAM(0)).0 as i32;
                if count <= 0 {
                    return;
                }

                let mut pid = 0;
                GetWindowThreadProcessId(listview_hwnd, Some(&mut pid));
                if pid == 0 { return; }

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
        };

        // Initial scan
        scan_icons(cached_listview_hwnd);

        // Define hook callback
        unsafe extern "system" fn hook_callback(
            _hwineventhook: HWINEVENTHOOK,
            event: u32,
            hwnd: HWND,
            _idobject: i32,
            _idchild: i32,
            _iddeventthread: u32,
            _dwmseventtime: u32,
        ) {
            // We only care if an object inside SysListView32 changed
            let mut class_name = [0u16; 256];
            let len = windows::Win32::UI::WindowsAndMessaging::GetClassNameW(hwnd, &mut class_name);
            let c_name = String::from_utf16_lossy(&class_name[..len as usize]);
            
            if c_name == "SysListView32" {
                PENDING_SCAN.store(true, Ordering::SeqCst);
            }
        }

        unsafe {
            // Register hook
            let hook = SetWinEventHook(
                EVENT_OBJECT_CREATE,
                EVENT_OBJECT_LOCATIONCHANGE,
                None,
                Some(hook_callback),
                0,
                0,
                WINEVENT_OUTOFCONTEXT,
            );

            let mut msg = MSG::default();
            while TRACKER_RUNNING.load(Ordering::SeqCst) {
                // We use MsgWaitForMultipleObjects or just a timeout message loop
                // Actually, standard GetMessage blocks. We need PeekMessage to allow exiting.
                let has_msg = windows::Win32::UI::WindowsAndMessaging::PeekMessageW(
                    &mut msg,
                    HWND(0 as _),
                    0,
                    0,
                    windows::Win32::UI::WindowsAndMessaging::PM_REMOVE,
                ).as_bool();

                if has_msg {
                    let _ = TranslateMessage(&msg);
                    let _ = DispatchMessageW(&msg);
                } else {
                    // Check if pending scan
                    if PENDING_SCAN.swap(false, Ordering::SeqCst) {
                        scan_icons(cached_listview_hwnd);
                    }
                    std::thread::sleep(Duration::from_millis(50));
                }
            }

            if !hook.is_invalid() {
                let _ = UnhookWinEvent(hook);
            }
        }
    });
}

#[cfg(not(windows))]
pub fn start_icon_tracking(_app_handle: AppHandle) {}

pub fn stop_icon_tracking() {
    TRACKER_RUNNING.store(false, Ordering::SeqCst);
}
