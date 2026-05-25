use windows::Win32::Foundation::{HWND, LPARAM};
use windows::Win32::UI::WindowsAndMessaging::{
    FindWindowW, FindWindowExW, EnumWindows
};
use windows::core::PCWSTR;

static mut FOUND_SYSLISTVIEW: HWND = HWND(0 as _);

unsafe extern "system" fn enum_cb(hwnd: HWND, _lparam: LPARAM) -> windows::Win32::Foundation::BOOL {
    let shelldll: Vec<u16> = "SHELLDLL_DefView\0".encode_utf16().collect();
    let shell = FindWindowExW(Some(hwnd), Some(HWND(0 as _)), PCWSTR(shelldll.as_ptr()), PCWSTR::null());
    
    if shell.is_ok() && !shell.unwrap().is_invalid() {
        let syslistview: Vec<u16> = "SysListView32\0".encode_utf16().collect();
        let listview = FindWindowExW(Some(shell.unwrap()), Some(HWND(0 as _)), PCWSTR(syslistview.as_ptr()), PCWSTR::null());
        if listview.is_ok() && !listview.unwrap().is_invalid() {
            FOUND_SYSLISTVIEW = listview.unwrap();
            return windows::Win32::Foundation::BOOL(0);
        }
    }
    windows::Win32::Foundation::BOOL(1)
}

fn main() {
    unsafe {
        // 1. Find SysListView32
        let progman_class: Vec<u16> = "Progman\0".encode_utf16().collect();
        let progman = FindWindowW(PCWSTR(progman_class.as_ptr()), PCWSTR::null()).unwrap();
        
        let shelldll: Vec<u16> = "SHELLDLL_DefView\0".encode_utf16().collect();
        let shell = FindWindowExW(Some(progman), Some(HWND(0 as _)), PCWSTR(shelldll.as_ptr()), PCWSTR::null());
        
        if shell.is_ok() && !shell.unwrap().is_invalid() {
            let syslistview: Vec<u16> = "SysListView32\0".encode_utf16().collect();
            let listview = FindWindowExW(Some(shell.unwrap()), Some(HWND(0 as _)), PCWSTR(syslistview.as_ptr()), PCWSTR::null());
            if listview.is_ok() && !listview.unwrap().is_invalid() {
                FOUND_SYSLISTVIEW = listview.unwrap();
            }
        }

        if FOUND_SYSLISTVIEW.0 == 0 as _ {
            let _ = EnumWindows(Some(enum_cb), LPARAM(0));
        }

        if FOUND_SYSLISTVIEW.0 != 0 as _ {
            println!("Found SysListView32! HWND: {:?}", FOUND_SYSLISTVIEW.0);
            
            // Toggle test
            use windows::Win32::UI::WindowsAndMessaging::{ShowWindow, SW_HIDE, SW_SHOW};
            println!("Hiding icons...");
            let _ = ShowWindow(FOUND_SYSLISTVIEW, SW_HIDE);
            std::thread::sleep(std::time::Duration::from_secs(3));
            println!("Showing icons...");
            let _ = ShowWindow(FOUND_SYSLISTVIEW, SW_SHOW);
        } else {
            println!("Could not find SysListView32");
        }
        
        // 2. Taskbar test
        let tray_class: Vec<u16> = "Shell_TrayWnd\0".encode_utf16().collect();
        let tray = FindWindowW(PCWSTR(tray_class.as_ptr()), PCWSTR::null());
        if tray.is_ok() && !tray.unwrap().is_invalid() {
            println!("Found Taskbar! HWND: {:?}", tray.unwrap().0);
        } else {
            println!("Could not find Taskbar");
        }
    }
}
