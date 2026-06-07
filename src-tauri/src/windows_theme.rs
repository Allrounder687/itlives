use windows::core::PCSTR;
use windows::Win32::Foundation::FARPROC;
use windows::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryA};

#[repr(C)]
#[derive(Debug, Clone, Copy)]
struct DWMCOLORIZATIONPARAMS {
    colorization_color: u32,
    colorization_afterglow: u32,
    colorization_color_balance: u32,
    colorization_afterglow_balance: u32,
    colorization_blur_balance: u32,
    colorization_glass_reflection_intensity: u32,
    colorization_opaque_blend: u32,
}

type DwmGetColorizationParameters =
    unsafe extern "system" fn(*mut DWMCOLORIZATIONPARAMS, *mut u32) -> i32;
type DwmSetColorizationParameters =
    unsafe extern "system" fn(*mut DWMCOLORIZATIONPARAMS, u32) -> i32;

/// Changes the Windows System Accent Color dynamically
/// `hex_color` should be a standard 6-character hex string like "FF0000" or "#FF0000"
#[tauri::command]
pub fn sync_windows_accent_color(hex_color: String) -> Result<(), String> {
    let clean_hex = hex_color.replace("#", "");
    if clean_hex.len() != 6 {
        return Err("Invalid hex color format. Expected 6 characters.".into());
    }

    // Convert hex string to u32, adding full alpha channel (0xFF000000)
    let color_rgb = u32::from_str_radix(&clean_hex, 16)
        .map_err(|e| format!("Failed to parse hex color: {}", e))?;

    // Format required by DWM: AARRGGBB. We set alpha to 0xFF.
    let dwm_color = 0xFF000000 | color_rgb;

    unsafe {
        let dwmapi = LoadLibraryA(PCSTR("dwmapi.dll\0".as_ptr()))
            .map_err(|e| format!("Failed to load dwmapi.dll: {}", e))?;

        let get_proc: FARPROC = GetProcAddress(dwmapi, PCSTR(127 as *const u8));
        let set_proc: FARPROC = GetProcAddress(dwmapi, PCSTR(131 as *const u8));

        if let (Some(get), Some(set)) = (get_proc, set_proc) {
            let get_fn: DwmGetColorizationParameters = std::mem::transmute(get);
            let set_fn: DwmSetColorizationParameters = std::mem::transmute(set);

            let mut params = DWMCOLORIZATIONPARAMS {
                colorization_color: 0,
                colorization_afterglow: 0,
                colorization_color_balance: 0,
                colorization_afterglow_balance: 0,
                colorization_blur_balance: 0,
                colorization_glass_reflection_intensity: 0,
                colorization_opaque_blend: 0,
            };
            let mut unknown = 0;

            // Get current params to maintain other balances
            let _ = get_fn(&mut params, &mut unknown);

            // Update just the color and afterglow
            params.colorization_color = dwm_color;
            params.colorization_afterglow = dwm_color;

            // Apply the new color parameters
            let res = set_fn(&mut params, unknown);
            if res != 0 {
                return Err(format!(
                    "DwmSetColorizationParameters failed with HRESULT: {}",
                    res
                ));
            }
        } else {
            return Err("Could not find required ordinals in dwmapi.dll".into());
        }
    }

    Ok(())
}
