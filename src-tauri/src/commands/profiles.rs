use std::path::PathBuf;
use tauri::command;

// OPTIMIZATION: Switched to async helper to avoid blocking the main thread during directory creation
async fn get_profiles_dir() -> PathBuf {
    let app_data = std::env::var("OPENCLAW_LWP_RUNTIME_DIR").unwrap_or_else(|_| {
        let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| "C:\\".to_string());
        PathBuf::from(local_app_data)
            .join("itLives")
            .to_string_lossy()
            .to_string()
    });
    let dir = PathBuf::from(app_data).join("profiles");
    let _ = tokio::fs::create_dir_all(&dir).await;
    dir
}

#[command]
pub async fn save_profile(name: String, config_json: String) -> Result<(), String> {
    let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-', "_");
    let path = get_profiles_dir().await.join(format!("{}.ilwp", safe_name));
    // OPTIMIZATION: Swapped synchronous write for async stream to free up main IPC thread
    tokio::fs::write(path, config_json).await.map_err(|e| e.to_string())
}

#[command]
pub async fn load_profile(name: String) -> Result<String, String> {
    let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-', "_");
    let path = get_profiles_dir().await.join(format!("{}.ilwp", safe_name));
    // OPTIMIZATION: Non-blocking async file read
    tokio::fs::read_to_string(path).await.map_err(|e| e.to_string())
}

#[command]
pub async fn list_profiles() -> Result<Vec<String>, String> {
    let dir = get_profiles_dir().await;
    let mut profiles = Vec::new();
    // OPTIMIZATION: Async directory iteration
    if let Ok(mut entries) = tokio::fs::read_dir(dir).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            if let Ok(file_type) = entry.file_type().await {
                if file_type.is_file() {
                    let path = entry.path();
                    if path.extension().and_then(|e| e.to_str()) == Some("ilwp") {
                        if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                            profiles.push(stem.to_string());
                        }
                    }
                }
            }
        }
    }
    Ok(profiles)
}

#[command]
pub async fn delete_profile(name: String) -> Result<(), String> {
    let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-', "_");
    let path = get_profiles_dir().await.join(format!("{}.ilwp", safe_name));
    if path.exists() {
        // OPTIMIZATION: Async file removal
        tokio::fs::remove_file(path).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}
