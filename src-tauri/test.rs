use std::ptr::null_mut;
use windows::Win32::UI::WindowsAndMessaging::{
    FindWindowExW, FindWindowW, SendMessageTimeoutW, SMTO_NORMAL, EnumWindows, GetClassNameW, IsWindowVisible
};
use windows::Win32::Foundation::{HWND, LPARAM, BOOL, WPARAM};
use windows::core::PCWSTR;

fn encode(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

fn main() {
    unsafe {
        let progman_cls = encode("Progman");
        let progman = FindWindowW(PCWSTR(progman_cls.as_ptr()), PCWSTR::null());
        println!("Progman: {:?}", progman.0);
        
        let mut res = 0usize;
        SendMessageTimeoutW(progman, 0x052C, WPARAM(0), LPARAM(0), SMTO_NORMAL, 1000, Some(&mut res));
        
        let mut target = HWND(0 as _);
        EnumWindows(Some(enum_cb), LPARAM(&mut target as *mut _ as _));
        
        println!("Background WorkerW found: {:?}", target.0);
    }
}

unsafe extern "system" fn enum_cb(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let mut class_name = [0u16; 256];
    let len = windows::Win32::UI::WindowsAndMessaging::GetClassNameW(hwnd, &mut class_name);
    let c_name = String::from_utf16_lossy(&class_name[..len as usize]);
    
    if c_name == "WorkerW" || c_name == "Progman" {
        let shelldll = "SHELLDLL_DefView\0".encode_utf16().collect::<Vec<u16>>();
        let shell = FindWindowExW(hwnd, HWND(0 as _), PCWSTR(shelldll.as_ptr()), PCWSTR::null());
        if !shell.is_invalid() {
            println!("Found Icon Container ({}): {:?}", c_name, hwnd.0);
            let workerw_cls = "WorkerW\0".encode_utf16().collect::<Vec<u16>>();
            let worker = FindWindowExW(HWND(0 as _), hwnd, PCWSTR(workerw_cls.as_ptr()), PCWSTR::null());
            if !worker.is_invalid() {
                println!("Found Next Sibling WorkerW: {:?}", worker.0);
                *(lparam.0 as *mut HWND) = worker;
            }
            return BOOL(0);
        }
    }
    BOOL(1)
}
