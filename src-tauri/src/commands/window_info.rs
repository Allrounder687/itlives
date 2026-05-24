use tauri::command;
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId};
use windows::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};
use windows::Win32::System::ProcessStatus::GetProcessImageFileNameW;

#[derive(serde::Serialize)]
pub struct WindowInfo {
    pub title: String,
    pub process_name: String,
}

#[command]
pub fn get_active_window() -> Result<WindowInfo, String> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0 == 0 as *mut _ {
            return Err("No active window".into());
        }

        // Get Window Title
        let mut text: [u16; 512] = [0; 512];
        let len = GetWindowTextW(hwnd, &mut text);
        let title = String::from_utf16_lossy(&text[..len as usize]);

        // Get Process ID
        let mut process_id = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut process_id));

        // Get Process Name
        let mut process_name = String::new();
        if let Ok(process_handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process_id) {
            let mut image_name: [u16; 512] = [0; 512];
            let len = GetProcessImageFileNameW(process_handle, &mut image_name);
            if len > 0 {
                let full_path = String::from_utf16_lossy(&image_name[..len as usize]);
                if let Some(name) = full_path.split('\\').last() {
                    process_name = name.to_string();
                } else {
                    process_name = full_path;
                }
            }
            let _ = windows::Win32::Foundation::CloseHandle(process_handle);
        }

        Ok(WindowInfo {
            title,
            process_name,
        })
    }
}
