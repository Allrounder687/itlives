use std::process::Command;
use std::fs;
use tauri::AppHandle;
use serde_json::Value;

#[tauri::command]
pub async fn publish_app_update(app: AppHandle, version: String, release_notes: String, private_key_password: String) -> Result<(), String> {
    let mut app_dir = std::env::current_dir().map_err(|e| e.to_string())?;
    if app_dir.ends_with("src-tauri") {
        app_dir.pop();
    }
    let frontend_dir = app_dir;
    
    let package_json_path = frontend_dir.join("package.json");
    let package_json_str = fs::read_to_string(&package_json_path).map_err(|e| format!("Read package.json: {}", e))?;
    let mut package_json: Value = serde_json::from_str(&package_json_str).map_err(|e| format!("Parse package.json: {}", e))?;
    package_json["version"] = Value::String(version.clone());
    fs::write(&package_json_path, serde_json::to_string_pretty(&package_json).unwrap()).map_err(|e| e.to_string())?;

    let tauri_conf_path = frontend_dir.join("src-tauri").join("tauri.conf.json");
    let tauri_conf_str = fs::read_to_string(&tauri_conf_path).map_err(|e| format!("Read tauri.conf.json: {}", e))?;
    let mut tauri_conf: Value = serde_json::from_str(&tauri_conf_str).map_err(|e| format!("Parse tauri.conf.json: {}", e))?;
    
    tauri_conf["version"] = Value::String(version.clone());
    fs::write(&tauri_conf_path, serde_json::to_string_pretty(&tauri_conf).unwrap()).map_err(|e| e.to_string())?;

    let cargo_toml_path = frontend_dir.join("src-tauri").join("Cargo.toml");
    let cargo_toml_str = fs::read_to_string(&cargo_toml_path).map_err(|e| format!("Read Cargo.toml: {}", e))?;
    let re = regex::Regex::new(r#"version = "[^"]+""#).unwrap();
    let new_cargo_toml = re.replace(&cargo_toml_str, format!("version = \"{}\"", version));
    fs::write(&cargo_toml_path, new_cargo_toml.to_string()).map_err(|e| e.to_string())?;

    let key_path = frontend_dir.join("src-tauri").join("openclaw.key");
    let private_key = fs::read_to_string(&key_path).map_err(|e| format!("Failed to read private key: {}", e))?;

    let mut build_cmd = if cfg!(target_os = "windows") {
        let mut cmd = Command::new("cmd");
        cmd.args(&["/C", "npm"]);
        cmd
    } else {
        Command::new("npm")
    };
    build_cmd.current_dir(&frontend_dir)
        .args(&["run", "tauri", "build"])
        .env("TAURI_SIGNING_PRIVATE_KEY", &private_key);
        
    if !private_key_password.is_empty() {
        build_cmd.env("TAURI_SIGNING_PRIVATE_KEY_PASSWORD", &private_key_password);
    }

    let status = build_cmd.status().map_err(|e| format!("Failed to run build: {}", e))?;
    if !status.success() {
        return Err("App build failed".to_string());
    }

    let release_tag = format!("v{}", version);
    let mut gh_cmd = if cfg!(target_os = "windows") {
        let mut cmd = Command::new("cmd");
        cmd.args(&["/C", "gh"]);
        cmd
    } else {
        Command::new("gh")
    };

    let status = gh_cmd
        .current_dir(&frontend_dir)
        .args(&["release", "create", &release_tag, "--title", &release_tag, "--notes", &release_notes])
        .status()
        .map_err(|e| format!("Failed to create GitHub release: {}", e))?;
        
    if !status.success() {
        return Err("Failed to create GitHub release".to_string());
    }

    let nsis_dir = frontend_dir.join("src-tauri").join("target").join("release").join("bundle").join("nsis");
    
    let mut files_to_upload = Vec::new();
    if let Ok(entries) = fs::read_dir(&nsis_dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if let Some(ext) = path.extension() {
                if ext == "exe" || ext == "zip" || ext == "sig" {
                    files_to_upload.push(path);
                }
            }
        }
    }

    for file in &files_to_upload {
        let mut gh_upload_cmd = if cfg!(target_os = "windows") {
            let mut cmd = Command::new("cmd");
            cmd.args(&["/C", "gh"]);
            cmd
        } else {
            Command::new("gh")
        };

        let status = gh_upload_cmd
            .current_dir(&frontend_dir)
            .args(&["release", "upload", &release_tag, file.to_str().unwrap()])
            .status()
            .map_err(|e| format!("Failed to upload asset: {}", e))?;
        if !status.success() {
            return Err("Failed to upload asset to GitHub release".to_string());
        }
    }

    let mut zip_url = String::new();
    let mut signature = String::new();
    
    for file in &files_to_upload {
        let file_name = file.file_name().unwrap().to_str().unwrap();
        if file_name.ends_with(".zip") {
            zip_url = format!("https://github.com/Allrounder687/itlives/releases/download/{}/{}", release_tag, file_name);
        } else if file_name.ends_with(".sig") {
            signature = fs::read_to_string(file).map_err(|e| e.to_string())?;
        }
    }

    let pub_date = chrono::Utc::now().to_rfc3339();
    let update_json = serde_json::json!({
        "version": version,
        "notes": release_notes,
        "pub_date": pub_date,
        "platforms": {
            "windows-x86_64": {
                "signature": signature,
                "url": zip_url
            }
        }
    });

    let update_json_path = frontend_dir.join("update.json");
    fs::write(&update_json_path, serde_json::to_string_pretty(&update_json).unwrap()).map_err(|e| e.to_string())?;

    let mut git_cmd = || {
        if cfg!(target_os = "windows") {
            let mut cmd = Command::new("cmd");
            cmd.args(&["/C", "git"]);
            cmd
        } else {
            Command::new("git")
        }
    };

    git_cmd().current_dir(&frontend_dir).args(&["add", "update.json", "src-tauri/tauri.conf.json", "package.json", "src-tauri/Cargo.toml"]).status().unwrap();
    git_cmd().current_dir(&frontend_dir).args(&["commit", "-m", &format!("Release {}", release_tag)]).status().unwrap();
    git_cmd().current_dir(&frontend_dir).args(&["push"]).status().unwrap();

    Ok(())
}
