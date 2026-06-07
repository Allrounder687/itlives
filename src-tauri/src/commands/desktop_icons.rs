use rand::Rng;

#[cfg(windows)]
pub fn throw_random_desktop_icon() -> Result<(), String> {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{HWND, LPARAM, WPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{
        FindWindowExW, GetSystemMetrics, SendMessageW, SM_CXSCREEN, SM_CYSCREEN,
    };

    unsafe {
        let worker_hwnd = crate::wallpaper::desktop::win32::get_desktop_workerw().unwrap_or(0);
        if worker_hwnd == 0 {
            return Err("WorkerW not found".into());
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
            return Err("SHELLDLL_DefView not found".into());
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
            return Err("SysListView32 not found".into());
        }

        const LVM_GETITEMCOUNT: u32 = 0x1000 + 4;
        const LVM_SETITEMPOSITION: u32 = 0x1000 + 15;

        let count = SendMessageW(listview_hwnd, LVM_GETITEMCOUNT, WPARAM(0), LPARAM(0)).0 as i32;
        if count <= 0 {
            return Err("No desktop icons found".into());
        }

        let mut rng = rand::thread_rng();
        let random_index = rng.gen_range(0..count);

        let screen_w = GetSystemMetrics(SM_CXSCREEN);
        let screen_h = GetSystemMetrics(SM_CYSCREEN);

        let x = rng.gen_range(50..(screen_w - 100));
        let y = rng.gen_range(50..(screen_h - 100));

        let lparam = ((y as u32) << 16) | ((x as u32) & 0xFFFF);

        SendMessageW(
            listview_hwnd,
            LVM_SETITEMPOSITION,
            WPARAM(random_index as usize),
            LPARAM(lparam as isize),
        );
    }

    Ok(())
}

#[cfg(not(windows))]
pub fn throw_random_desktop_icon() -> Result<(), String> {
    Err("Not supported on this OS".into())
}

#[tauri::command]
pub fn invoke_throw_random_desktop_icon() -> Result<(), String> {
    throw_random_desktop_icon()
}
