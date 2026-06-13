fn main() {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        let final_img_path = std::path::Path::new("C:\\Windows\\Web\\Wallpaper\\Windows\\img0.jpg");
        let path_wide: Vec<u16> = final_img_path
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        unsafe {
            use windows::Win32::UI::WindowsAndMessaging::{
                SystemParametersInfoW, SPI_SETDESKWALLPAPER, SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS,
            };

            let res = SystemParametersInfoW(
                SPI_SETDESKWALLPAPER,
                0,
                Some(path_wide.as_ptr() as *mut std::ffi::c_void),
                SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0x02), // Only SPIF_SENDCHANGE
            );
            println!("Result: {:?}", res);
        }
    }
}
