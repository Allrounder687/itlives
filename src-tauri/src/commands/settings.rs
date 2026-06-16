use crate::wallpaper;
use crate::wallpaper::providers::{self, VideoResult};
use crate::wallpaper::state::{AppStateStore, WallpaperState};
use tauri::State;

#[tauri::command]
pub fn list_sources() -> Vec<String> {
    providers::list_providers()
}

#[tauri::command]
pub fn cleanup_cache(keep: usize) -> Result<usize, String> {
    wallpaper::desktop::cleanup_cache(keep)
}

#[tauri::command]
pub fn get_app_state(state: State<'_, AppStateStore>) -> WallpaperState {
    wallpaper::state::get(&state)
}

#[tauri::command]
pub fn set_lightweight_mode(
    state: State<'_, AppStateStore>,
    enabled: bool,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_lightweight_mode(&state, enabled)
}

#[tauri::command]
pub fn set_restore_on_launch(
    state: State<'_, AppStateStore>,
    enabled: bool,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_restore_on_launch(&state, enabled)
}

#[tauri::command]
pub fn set_window_behavior(
    state: State<'_, AppStateStore>,
    close_to_tray: bool,
    minimize_to_tray: bool,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_window_behavior(&state, close_to_tray, minimize_to_tray)
}

#[tauri::command]
pub fn set_auto_pause(
    state: State<'_, AppStateStore>,
    enabled: bool,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_auto_pause(&state, enabled)
}

#[tauri::command]
pub fn set_keep_effects_running_on_pause(
    state: State<'_, AppStateStore>,
    enabled: bool,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_keep_effects_running_on_pause(&state, enabled)
}

#[tauri::command]
pub fn import_local_video(
    state: State<'_, AppStateStore>,
    video: VideoResult,
) -> Result<WallpaperState, String> {
    wallpaper::state::import_local_video(&state, video)
}

#[tauri::command]
pub fn remove_imported_video(
    state: State<'_, AppStateStore>,
    video: VideoResult,
) -> Result<WallpaperState, String> {
    wallpaper::state::remove_imported_video(&state, video)
}

#[tauri::command]
pub fn remove_recent_video(
    state: State<'_, AppStateStore>,
    video: VideoResult,
) -> Result<WallpaperState, String> {
    wallpaper::state::remove_recent_video(&state, video)
}

#[tauri::command]
pub fn set_theme(state: State<'_, AppStateStore>, theme: String) -> Result<WallpaperState, String> {
    wallpaper::state::set_theme(&state, theme)
}

#[tauri::command]
pub fn set_categories_filter(
    state: State<'_, AppStateStore>,
    categories: String,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_categories_filter(&state, categories)
}

#[tauri::command]
pub fn set_purity_filter(
    state: State<'_, AppStateStore>,
    purity: String,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_purity_filter(&state, purity)
}


#[tauri::command]
pub fn set_wallhaven_api_key(
    state: State<'_, AppStateStore>,
    key: String,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_wallhaven_api_key(&state, key)
}

#[tauri::command]
pub async fn start_oauth_flow(
    provider: String,
    client_id: String,
    client_secret: String,
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppStateStore>,
) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;
    use tauri_plugin_dialog::DialogExt;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    
    if provider != "deviantart" {
        return Err("Only deviantart is supported".into());
    }

    let redirect_uri = "http://localhost:34567/callback";
    
    // Generate PKCE code verifier and challenge
    use rand::RngCore;
    use sha2::{Digest, Sha256};
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
    
    let mut verifier_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut verifier_bytes);
    let code_verifier = URL_SAFE_NO_PAD.encode(verifier_bytes);
    
    let mut hasher = Sha256::new();
    hasher.update(code_verifier.as_bytes());
    let code_challenge = URL_SAFE_NO_PAD.encode(hasher.finalize());

    let auth_url = format!(
        "https://www.deviantart.com/oauth2/authorize?response_type=code&client_id={}&redirect_uri={}&scope=browse&code_challenge={}&code_challenge_method=S256",
        client_id, redirect_uri, code_challenge
    );

    // Launch browser
    app_handle.shell().open(auth_url, None).map_err(|e| e.to_string())?;

    // Start local server
    let listener = tokio::net::TcpListener::bind("127.0.0.1:34567").await.map_err(|e| e.to_string())?;
    
    let mut code = String::new();
    let mut last_request = String::new();
    let timeout_duration = std::time::Duration::from_secs(120); // 2 minutes timeout
    
    let _ = tokio::time::timeout(timeout_duration, async {
        loop {
            if let Ok((mut stream, _)) = listener.accept().await {
                let mut buffer = [0; 2048];
                if let Ok(n) = stream.read(&mut buffer).await {
                    let request = String::from_utf8_lossy(&buffer[..n]);
                    
                    if request.contains("GET /favicon.ico") {
                        let response = "HTTP/1.1 404 Not Found\r\n\r\n";
                        let _ = stream.write_all(response.as_bytes()).await;
                        continue;
                    }
                    
                    last_request = request.to_string();
                    
                    if let Some(code_idx) = request.find("code=") {
                        let start = code_idx + 5;
                        let end = request[start..].find(&[' ', '&', '\r', '\n'][..]).unwrap_or(request.len() - start);
                        code = request[start..start+end].to_string();
                        
                        let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n<html><body><h2>Login Successful!</h2><p>You can safely close this window and return to itLives.</p><script>window.close();</script></body></html>";
                        let _ = stream.write_all(response.as_bytes()).await;
                        break;
                    } else if request.contains("GET /callback") {
                        let response = "HTTP/1.1 400 Bad Request\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n<html><body><h2>Invalid Request</h2><p>No authorization code found.</p></body></html>";
                        let _ = stream.write_all(response.as_bytes()).await;
                        break; // Stop if it's a callback without a code (e.g. error)
                    }
                }
            }
        }
    }).await;

    if code.is_empty() {
        app_handle.dialog().message(&format!("Failed to capture authorization code.\n\nRaw request received:\n{}", last_request)).title("OAuth Error").show(|_| {});
        return Err("Failed to capture authorization code".into());
    }

    // Exchange code for token
    let client = reqwest::Client::new();
    let res = client.post("https://www.deviantart.com/oauth2/token")
        .form(&[
            ("grant_type", "authorization_code"),
            ("client_id", &client_id),
            ("redirect_uri", redirect_uri),
            ("code", &code),
            ("code_verifier", &code_verifier),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
        
        let mut creds = std::collections::HashMap::new();
        creds.insert("client_id".to_string(), serde_json::Value::String(client_id));
        creds.insert("client_secret".to_string(), serde_json::Value::String(client_secret));
        if let Some(at) = json.get("access_token") {
            creds.insert("access_token".to_string(), at.clone());
        }
        if let Some(rt) = json.get("refresh_token") {
            creds.insert("refresh_token".to_string(), rt.clone());
        }
        
        // Save to state
        let mut all_creds = crate::wallpaper::state::get(&state).addon_credentials.clone();
        all_creds.insert(provider, serde_json::Value::Object(creds.into_iter().map(|(k, v)| (k, v)).collect()));
        
        crate::wallpaper::state::set_addon_credentials(&state, all_creds)?;
        
        app_handle.dialog().message("DeviantArt account successfully linked!")
            .title("OAuth Integration")
            .show(|_| {});
            
        Ok(())
    } else {
        let err_text = res.text().await.unwrap_or_default();
        app_handle.dialog().message(&format!("Token exchange failed: {}", err_text)).title("OAuth Error").show(|_| {});
        Err(format!("Token exchange failed: {}", err_text))
    }
}

#[tauri::command]
pub fn set_addon_credentials(
    state: State<'_, AppStateStore>,
    credentials: std::collections::HashMap<String, serde_json::Value>,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_addon_credentials(&state, credentials)
}

#[tauri::command]
pub fn set_disabled_sources(
    state: State<'_, AppStateStore>,
    disabled: Vec<String>,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_disabled_sources(&state, disabled)
}

#[tauri::command]
pub fn set_pinterest_urls(
    state: State<'_, AppStateStore>,
    urls: Vec<String>,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_pinterest_urls(&state, urls)
}

#[tauri::command]
pub fn toggle_hide_video(
    state: State<'_, AppStateStore>,
    video_id: String,
) -> Result<WallpaperState, String> {
    wallpaper::state::toggle_hide_video(&state, video_id)
}

#[derive(serde::Serialize)]
pub struct DisplayMonitor {
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub scale_factor: f64,
    pub is_primary: bool,
}

#[tauri::command]
pub fn get_monitors(app_handle: tauri::AppHandle) -> Result<Vec<DisplayMonitor>, String> {
    let mut result = Vec::new();

    let monitors = app_handle.available_monitors().map_err(|e| e.to_string())?;
    let primary = app_handle.primary_monitor().ok().flatten();

    for m in monitors {
        let name = m
            .name()
            .unwrap_or(&"Unknown Display".to_string())
            .to_string();
        let size = m.size();
        let pos = m.position();
        let scale = m.scale_factor();
        let is_primary = if let Some(ref p) = primary {
            p.name() == m.name()
        } else {
            false
        };

        result.push(DisplayMonitor {
            name,
            width: size.width,
            height: size.height,
            x: pos.x,
            y: pos.y,
            scale_factor: scale,
            is_primary,
        });
    }

    Ok(result)
}

#[tauri::command]
pub fn launch_external_app(path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new(&path);
        // CREATE_NO_WINDOW = 0x08000000
        cmd.creation_flags(0x08000000);
        let _ = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn {}: {}", path, e))?;
    }
    #[cfg(not(windows))]
    {
        let _ = std::process::Command::new(&path)
            .spawn()
            .map_err(|e| format!("Failed to spawn {}: {}", path, e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn extract_icon_base64(path: String) -> Result<String, String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let script = format!(
            "Add-Type -AssemblyName System.Drawing;\n\
             $icon = [System.Drawing.Icon]::ExtractAssociatedIcon('{}');\n\
             if ($null -eq $icon) {{ exit 1 }}\n\
             $bitmap = $icon.ToBitmap();\n\
             $stream = New-Object System.IO.MemoryStream;\n\
             $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png);\n\
             $bytes = $stream.ToArray();\n\
             [Convert]::ToBase64String($bytes)",
            path.replace("'", "''")
        );
        let mut cmd = std::process::Command::new("powershell");
        cmd.args(&["-NoProfile", "-Command", &script]);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let output = cmd
            .output()
            .map_err(|e| format!("Failed to run PowerShell: {}", e))?;
        if output.status.success() {
            let b64 = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if b64.is_empty() {
                Err("Icon extraction returned empty result".into())
            } else {
                Ok(b64)
            }
        } else {
            Err("Failed to extract icon (PowerShell returned error)".into())
        }
    }
    #[cfg(not(windows))]
    {
        Err("Icon extraction is only supported on Windows".into())
    }
}

#[tauri::command]
pub fn set_slideshow_source(
    state: State<'_, AppStateStore>,
    source: String,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_slideshow_source(&state, source)
}

#[tauri::command]
pub fn set_discover_provider(
    state: State<'_, AppStateStore>,
    provider: String,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_discover_provider(&state, provider)
}

#[tauri::command]
pub fn set_perf_config(
    state: State<'_, AppStateStore>,
    fullscreen: String,
    focused: String,
    battery: String,
    battery_saver: String,
    remote_desktop: String,
    restart_lock_screen: bool,
    display_pause_rule: String,
    pause_algorithm: String,
) -> Result<WallpaperState, String> {
    wallpaper::state::set_perf_config(
        &state,
        fullscreen,
        focused,
        battery,
        battery_saver,
        remote_desktop,
        restart_lock_screen,
        display_pause_rule,
        pause_algorithm,
    )
}

#[tauri::command]
pub fn get_system_wallpaper() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let app_data = std::env::var("APPDATA").unwrap_or_default();
        let transcoded_path = std::path::Path::new(&app_data)
            .join("Microsoft")
            .join("Windows")
            .join("Themes")
            .join("TranscodedWallpaper");
            
        if transcoded_path.exists() {
            let temp_dir = std::env::temp_dir();
            let target_path = temp_dir.join("itlives_current_wallpaper.jpg");
            if let Err(e) = std::fs::copy(&transcoded_path, &target_path) {
                log::warn!("Failed to copy transcoded wallpaper: {}", e);
            } else {
                return Ok(target_path.to_string_lossy().to_string());
            }
        }

        use windows::Win32::UI::WindowsAndMessaging::{SystemParametersInfoW, SPI_GETDESKWALLPAPER, SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS};
        let mut buffer = [0u16; 512];
        unsafe {
            let res = SystemParametersInfoW(
                SPI_GETDESKWALLPAPER,
                buffer.len() as u32,
                Some(buffer.as_mut_ptr() as *mut _),
                SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0),
            );
            if res.is_ok() {
                let path = String::from_utf16_lossy(&buffer);
                let path = path.trim_end_matches('\0').trim().to_string();
                if std::path::Path::new(&path).exists() {
                    return Ok(path);
                }
            }
        }
    }
    Err("System wallpaper not found".to_string())
}

#[tauri::command]
pub fn show_mini_player(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    #[cfg(target_os = "windows")]
    {
        if let Some(window) = app.get_webview_window("mini_player") {
            if let Ok(hwnd) = window.hwnd() {
                let hwnd = windows::Win32::Foundation::HWND(hwnd.0 as *mut std::ffi::c_void);
                unsafe {
                    use windows::Win32::UI::WindowsAndMessaging::{
                        ShowWindow, SetWindowPos, HWND_TOPMOST, SW_SHOW,
                        GetWindowLongW, SetWindowLongW, GWL_STYLE, GWL_EXSTYLE,
                        WS_POPUP, WS_CAPTION, WS_THICKFRAME, WS_MINIMIZEBOX, WS_MAXIMIZEBOX, WS_SYSMENU,
                        WS_EX_TOOLWINDOW
                    };
                    
                    // 1. Ensure WS_POPUP style and remove standard caption/thickframes/system menus
                    let old_style = GetWindowLongW(hwnd, GWL_STYLE) as u32;
                    let mut new_style = old_style;
                    new_style |= WS_POPUP.0;
                    new_style &= !WS_CAPTION.0;
                    new_style &= !WS_THICKFRAME.0;
                    new_style &= !WS_MINIMIZEBOX.0;
                    new_style &= !WS_MAXIMIZEBOX.0;
                    new_style &= !WS_SYSMENU.0;
                    let _ = SetWindowLongW(hwnd, GWL_STYLE, new_style as i32);
                    
                    // 2. Set extended window styles (exStyle: tool window, no taskbar)
                    let old_ex = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
                    let new_ex = old_ex | WS_EX_TOOLWINDOW.0;
                    let _ = SetWindowLongW(hwnd, GWL_EXSTYLE, new_ex as i32);
                    
                    // 3. Position it relative to the monitor (and keep it always on top)
                    if let Ok(Some(monitor)) = window.current_monitor() {
                        let monitor_size = monitor.size();
                        let scale = monitor.scale_factor();
                        let w = (320.0 * scale) as i32;
                        let h = (420.0 * scale) as i32;
                        let x = monitor_size.width as i32 - w - (20.0 * scale) as i32;
                        let y = (monitor_size.height as i32 - h) / 2;
                        
                        let _ = SetWindowPos(
                            hwnd,
                            HWND_TOPMOST,
                            x,
                            y,
                            w,
                            h,
                            windows::Win32::UI::WindowsAndMessaging::SWP_SHOWWINDOW,
                        );
                    }
                    
                    let _ = ShowWindow(hwnd, SW_SHOW);
                }
            }
        }
        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Some(window) = app.get_webview_window("mini_player") {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
        return Ok(());
    }
}

#[tauri::command]
pub fn hide_mini_player(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    #[cfg(target_os = "windows")]
    {
        if let Some(window) = app.get_webview_window("mini_player") {
            if let Ok(hwnd) = window.hwnd() {
                let hwnd = windows::Win32::Foundation::HWND(hwnd.0 as *mut std::ffi::c_void);
                unsafe {
                    let _ = windows::Win32::UI::WindowsAndMessaging::ShowWindow(hwnd, windows::Win32::UI::WindowsAndMessaging::SW_HIDE);
                }
            }
        }
        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Some(window) = app.get_webview_window("mini_player") {
            let _ = window.hide();
        }
        return Ok(());
    }
}

#[tauri::command]
pub fn toggle_mini_player(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    #[cfg(target_os = "windows")]
    {
        if let Some(window) = app.get_webview_window("mini_player") {
            if let Ok(hwnd) = window.hwnd() {
                let hwnd = windows::Win32::Foundation::HWND(hwnd.0 as *mut std::ffi::c_void);
                unsafe {
                    let visible = windows::Win32::UI::WindowsAndMessaging::IsWindowVisible(hwnd).as_bool();
                    if visible {
                        let _ = hide_mini_player(app);
                    } else {
                        let _ = show_mini_player(app);
                    }
                }
            }
        }
        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Some(window) = app.get_webview_window("mini_player") {
            let visible = window.is_visible().unwrap_or(false);
            if visible {
                let _ = window.hide();
            } else {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }
        return Ok(());
    }
}
