use std::path::PathBuf;
use tauri::command;

fn get_profiles_dir() -> PathBuf {
    let app_data = std::env::var("OPENCLAW_LWP_RUNTIME_DIR").unwrap_or_else(|_| {
        let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| "C:\\".to_string());
        PathBuf::from(local_app_data)
            .join("itLives")
            .to_string_lossy()
            .to_string()
    });
    let dir = PathBuf::from(app_data).join("profiles");
    std::fs::create_dir_all(&dir).ok();
    dir
}

#[command]
pub fn save_profile(name: String, config_json: String) -> Result<(), String> {
    let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-', "_");
    let path = get_profiles_dir().join(format!("{}.ilwp", safe_name));
    std::fs::write(path, config_json).map_err(|e| e.to_string())
}

#[command]
pub fn load_profile(name: String) -> Result<String, String> {
    let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-', "_");
    let path = get_profiles_dir().join(format!("{}.ilwp", safe_name));
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[command]
pub fn list_profiles() -> Result<Vec<String>, String> {
    let dir = get_profiles_dir();
    let mut profiles = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
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
pub fn delete_profile(name: String) -> Result<(), String> {
    let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-', "_");
    let path = get_profiles_dir().join(format!("{}.ilwp", safe_name));
    if path.exists() {
        std::fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
