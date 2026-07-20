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

fn get_addons_repo_dir(app: &AppHandle) -> PathBuf {
    let app_dir = app.path().app_local_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    let repo_dir = app_dir.join("addons_repo");
    repo_dir
}

#[tauri::command]
pub async fn sync_addons_registry(app: AppHandle) -> Result<(), String> {
    let repo_dir = get_addons_repo_dir(&app);
    let repo_url = "https://github.com/allrounder687/openclaw-addons.git";

    if repo_dir.exists() && repo_dir.join(".git").exists() {
        let status = std::process::Command::new("git")
            .current_dir(&repo_dir)
            .args(&["pull"])
            .status()
            .map_err(|e| format!("Failed to execute git pull: {}", e))?;
            
        if !status.success() {
            return Err("git pull failed".to_string());
        }
    } else {
        if !repo_dir.exists() {
            let _ = fs::create_dir_all(&repo_dir);
        }
        
        let status = std::process::Command::new("git")
            .args(&["clone", repo_url, repo_dir.to_str().unwrap()])
            .status()
            .map_err(|e| format!("Failed to execute git clone: {}", e))?;
            
        if !status.success() {
            return Err("git clone failed".to_string());
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn push_addons_updates(app: AppHandle, commit_message: String) -> Result<(), String> {
    let repo_dir = get_addons_repo_dir(&app);

    if !repo_dir.exists() || !repo_dir.join(".git").exists() {
        return Err("Addons repository not found locally.".to_string());
    }

    let status_add = std::process::Command::new("git")
        .current_dir(&repo_dir)
        .args(&["add", "."])
        .status()
        .map_err(|e| format!("Failed to execute git add: {}", e))?;
        
    if !status_add.success() {
        return Err("git add failed".to_string());
    }

    let status_commit = std::process::Command::new("git")
        .current_dir(&repo_dir)
        .args(&["commit", "-m", &commit_message])
        .status()
        .map_err(|e| format!("Failed to execute git commit: {}", e))?;

    let status_push = std::process::Command::new("git")
        .current_dir(&repo_dir)
        .args(&["push"])
        .status()
        .map_err(|e| format!("Failed to execute git push: {}", e))?;
        
    if !status_push.success() {
        return Err("git push failed".to_string());
    }

    Ok(())
}

#[tauri::command]
pub async fn fetch_addon_registry(app: AppHandle, registry_url: String) -> Result<Vec<Addon>, String> {
    let repo_dir = get_addons_repo_dir(&app);
    let local_addons_json = repo_dir.join("addons.json");

    if local_addons_json.exists() {
        let content = std::fs::read_to_string(&local_addons_json)
            .map_err(|e| format!("Failed to read addons.json from local repo: {}", e))?;
        return serde_json::from_str(&content).map_err(|e| format!("Failed to parse local addons.json: {}", e));
    }

    if registry_url.contains("openclaw-addons/main/addons.json") {
        let local_repo_path = std::path::PathBuf::from(r"d:\use after format\allrounder687\openclaw-addons\addons.json");
        if local_repo_path.exists() {
            let content = std::fs::read_to_string(&local_repo_path).map_err(|e| format!("Failed to read from local repo at {:?}: {}", local_repo_path, e))?;
            return serde_json::from_str(&content).map_err(|e| e.to_string());
        }
    }

    let response = reqwest::get(&registry_url)
        .await
        .map_err(|e| e.to_string())?;
    let response = response
        .error_for_status()
        .map_err(|e| e.to_string())?;
    response
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
    let repo_dir = get_addons_repo_dir(&app);
    
    if addon.addon_type == "script" {
        let suffix = addon.install_url.split("main/scripts/").last().map(|s| s.to_string()).unwrap_or_else(|| format!("{}.js", addon.id));
        let repo_script_path = repo_dir.join("scripts").join(&suffix);
        let local_repo_path = std::path::PathBuf::from(r"d:\use after format\allrounder687\openclaw-addons\scripts").join(&suffix);
        
        let content_result = if repo_script_path.exists() {
            std::fs::read_to_string(&repo_script_path)
        } else if addon.install_url.contains("openclaw-addons/main/scripts") && local_repo_path.exists() {
            std::fs::read_to_string(&local_repo_path)
        } else {
            Err(std::io::Error::new(std::io::ErrorKind::NotFound, "Not found locally"))
        };

        if let Ok(content) = content_result {
            let script_path = addons_dir.join(format!("{}.js", addon.id));
            fs::write(&script_path, content)
                .map_err(|e| format!("Failed to write script file: {}", e))?;
        } else {
            let response = reqwest::get(&addon.install_url)
                .await
                .map_err(|e| format!("Failed to download script: {}", e))?;
            let response = response
                .error_for_status()
                .map_err(|e| format!("HTTP error downloading script: {}", e))?;
            let bytes = response
                .bytes()
                .await
                .map_err(|e| format!("Failed to read script bytes: {}", e))?;
                
            if let Ok(text) = std::str::from_utf8(&bytes) {
                let trimmed = text.trim();
                if trimmed == "404: Not Found" || trimmed.starts_with("404:") || trimmed.is_empty() {
                    return Err("Failed to install: downloaded script is empty or returned 404".to_string());
                }
            }

            let script_path = addons_dir.join(format!("{}.js", addon.id));
            fs::write(&script_path, &bytes).map_err(|e| format!("Failed to write script file: {}", e))?;
        }
    }
    
    let addon_path = addons_dir.join(format!("{}.json", addon.id));
    let json = serde_json::to_string_pretty(&addon).map_err(|e| e.to_string())?;
    fs::write(&addon_path, json).map_err(|e| format!("Failed to write addon manifest: {}", e))?;
    
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
