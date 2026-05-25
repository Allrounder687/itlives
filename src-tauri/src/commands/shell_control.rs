use tauri::command;

#[cfg(windows)]
mod win32 {
    use windows::Win32::Foundation::{HWND, LPARAM, BOOL};
    use windows::Win32::UI::WindowsAndMessaging::{
        FindWindowW, FindWindowExW, EnumWindows, ShowWindow, SW_HIDE, SW_SHOW
    };
    use windows::core::PCWSTR;

    static mut FOUND_SYSLISTVIEW: HWND = HWND(0 as _);

    unsafe extern "system" fn enum_cb(hwnd: HWND, _lparam: LPARAM) -> BOOL {
        let shelldll: Vec<u16> = "SHELLDLL_DefView\0".encode_utf16().collect();
        let shell = FindWindowExW(hwnd, HWND(0 as _), PCWSTR(shelldll.as_ptr()), PCWSTR::null());
        
        if shell.is_ok() && !shell.clone().unwrap().is_invalid() {
            let syslistview: Vec<u16> = "SysListView32\0".encode_utf16().collect();
            let listview = FindWindowExW(shell.clone().unwrap(), HWND(0 as _), PCWSTR(syslistview.as_ptr()), PCWSTR::null());
            if listview.is_ok() && !listview.clone().unwrap().is_invalid() {
                FOUND_SYSLISTVIEW = listview.unwrap();
                return BOOL(0);
            }
        }
        BOOL(1)
    }

    pub fn set_desktop_icons_visible(visible: bool) -> Result<(), String> {
        unsafe {
            FOUND_SYSLISTVIEW = HWND(0 as _);
            
            // Try standard Progman -> SHELLDLL_DefView
            let progman_class: Vec<u16> = "Progman\0".encode_utf16().collect();
            let progman = FindWindowW(PCWSTR(progman_class.as_ptr()), PCWSTR::null());
            
            if let Ok(p) = progman {
                if !p.is_invalid() {
                    let shelldll: Vec<u16> = "SHELLDLL_DefView\0".encode_utf16().collect();
                    let shell = FindWindowExW(p, HWND(0 as _), PCWSTR(shelldll.as_ptr()), PCWSTR::null());
                    
                    if let Ok(s) = shell {
                        if !s.is_invalid() {
                            let syslistview: Vec<u16> = "SysListView32\0".encode_utf16().collect();
                            let listview = FindWindowExW(s, HWND(0 as _), PCWSTR(syslistview.as_ptr()), PCWSTR::null());
                            if let Ok(lv) = listview {
                                if !lv.is_invalid() {
                                    FOUND_SYSLISTVIEW = lv;
                                }
                            }
                        }
                    }
                }
            }

            // If not found in Progman, Windows likely spawned WorkerW. EnumWindows to find it.
            if FOUND_SYSLISTVIEW.0 == 0 as _ {
                let _ = EnumWindows(Some(enum_cb), LPARAM(0));
            }

            if FOUND_SYSLISTVIEW.0 != 0 as _ {
                let cmd = if visible { SW_SHOW } else { SW_HIDE };
                let _ = ShowWindow(FOUND_SYSLISTVIEW, cmd);
                Ok(())
            } else {
                Err("Could not locate desktop icons container (SysListView32)".to_string())
            }
        }
    }
    
    // Taskbar Blur using SetWindowCompositionAttribute
    #[repr(C)]
    struct WINDOWCOMPOSITIONATTRIBDATA {
        attrib: u32,
        pv_data: *mut std::ffi::c_void,
        cb_data: usize,
    }

    #[repr(C)]
    struct ACCENT_POLICY {
        accent_state: u32,
        accent_flags: u32,
        gradient_color: u32,
        animation_id: u32,
    }

    pub fn set_taskbar_blur(enable: bool, use_acrylic: bool) -> Result<(), String> {
        unsafe {
            let tray_class: Vec<u16> = "Shell_TrayWnd\0".encode_utf16().collect();
            let tray = FindWindowW(PCWSTR(tray_class.as_ptr()), PCWSTR::null());
            
            if tray.is_err() || tray.clone().unwrap().is_invalid() {
                return Err("Could not find Windows Taskbar".to_string());
            }
            
            let user32 = windows::Win32::System::LibraryLoader::LoadLibraryW(PCWSTR("user32.dll\0".encode_utf16().collect::<Vec<u16>>().as_ptr())).map_err(|e| e.to_string())?;
            let set_window_composition_attribute = windows::Win32::System::LibraryLoader::GetProcAddress(user32, windows::core::s!("SetWindowCompositionAttribute"));
            
            if let Some(func) = set_window_composition_attribute {
                let func: extern "system" fn(HWND, *mut WINDOWCOMPOSITIONATTRIBDATA) -> BOOL = std::mem::transmute(func);
                
                let state = if enable {
                    if use_acrylic { 4 } else { 3 } // 3 = ACCENT_ENABLE_BLURBEHIND, 4 = ACCENT_ENABLE_ACRYLICBLURBEHIND
                } else {
                    0 // ACCENT_DISABLED
                };
                
                let mut policy = ACCENT_POLICY {
                    accent_state: state,
                    accent_flags: 2, // Draw all borders
                    gradient_color: 0x01000000, // Slight tint
                    animation_id: 0,
                };
                
                let mut data = WINDOWCOMPOSITIONATTRIBDATA {
                    attrib: 19, // WCA_ACCENT_POLICY
                    pv_data: &mut policy as *mut _ as *mut std::ffi::c_void,
                    cb_data: std::mem::size_of::<ACCENT_POLICY>(),
                };
                
                func(tray.unwrap(), &mut data);
                Ok(())
            } else {
                Err("SetWindowCompositionAttribute not available on this OS".to_string())
            }
        }
    }
}

#[command]
pub fn toggle_desktop_icons(visible: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        win32::set_desktop_icons_visible(visible)
    }
    #[cfg(not(windows))]
    {
        Err("Desktop icon toggling is only supported on Windows".to_string())
    }
}

#[command]
pub fn set_taskbar_state(enable_blur: bool, use_acrylic: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        win32::set_taskbar_blur(enable_blur, use_acrylic)
    }
    #[cfg(not(windows))]
    {
        Err("Taskbar customization is only supported on Windows".to_string())
    }
}
