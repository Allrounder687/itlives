use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Addon {
    pub id: String,
    pub name: String,
    pub description: String,
    pub install_url: String,
    pub addon_type: String, // "executable", "script", "ui"
    pub version: String,
    pub author: String,
}

#[tauri::command]
pub async fn fetch_addon_registry(registry_url: String) -> Result<Vec<Addon>, String> {
    reqwest::get(&registry_url)
        .await
        .map_err(|e| e.to_string())?
        .json::<Vec<Addon>>()
        .await
        .map_err(|e| e.to_string())
}

fn get_addons_dir(app: &AppHandle) -> PathBuf {
    let app_dir = app.path().app_local_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    let addons_dir = app_dir.join("addons");
    if !addons_dir.exists() {
        let _ = fs::create_dir_all(&addons_dir);
    }
    addons_dir
}

#[tauri::command]
pub async fn install_addon(app: AppHandle, addon: Addon) -> Result<(), String> {
    let addons_dir = get_addons_dir(&app);
    let addon_path = addons_dir.join(format!("{}.json", addon.id));
    
    let json = serde_json::to_string_pretty(&addon).map_err(|e| e.to_string())?;
    fs::write(&addon_path, json).map_err(|e| e.to_string())?;
    
    if addon.addon_type == "script" {
        let response = reqwest::get(&addon.install_url).await.map_err(|e| e.to_string())?;
        let bytes = response.bytes().await.map_err(|e| e.to_string())?;
        let script_path = addons_dir.join(format!("{}.js", addon.id));
        fs::write(&script_path, &bytes).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn uninstall_addon(app: AppHandle, id: String) -> Result<(), String> {
    let addons_dir = get_addons_dir(&app);
    let addon_path = addons_dir.join(format!("{}.json", id));
    if addon_path.exists() {
        let _ = fs::remove_file(addon_path);
    }
    let script_path = addons_dir.join(format!("{}.js", id));
    if script_path.exists() {
        let _ = fs::remove_file(script_path);
    }
    Ok(())
}

#[tauri::command]
pub async fn list_installed_addons(app: AppHandle) -> Result<Vec<Addon>, String> {
    let addons_dir = get_addons_dir(&app);
    let mut addons = Vec::new();
    if let Ok(entries) = fs::read_dir(addons_dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("json") {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(addon) = serde_json::from_str::<Addon>(&content) {
                        addons.push(addon);
                    }
                }
            }
        }
    }
    Ok(addons)
}

#[tauri::command]
pub async fn get_addon_script(app: AppHandle, id: String) -> Result<String, String> {
    let addons_dir = get_addons_dir(&app);
    let script_path = addons_dir.join(format!("{}.js", id));
    fs::read_to_string(script_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_addons_folder(app: AppHandle) -> Result<(), String> {
    let addons_dir = get_addons_dir(&app);
    std::process::Command::new("explorer")
        .arg(addons_dir)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
