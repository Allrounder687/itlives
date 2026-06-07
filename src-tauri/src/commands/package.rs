use serde_json::Value;
use std::fs;
use std::path::PathBuf;

#[tauri::command]
pub fn export_itl_package(config_json: String, dest_path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;

        let mut config: Value = serde_json::from_str(&config_json).map_err(|e| e.to_string())?;

        let video_src = config["videoSrc"]
            .as_str()
            .ok_or("No videoSrc found in config")?
            .to_string();
        let video_path = PathBuf::from(&video_src);

        if !video_path.exists() {
            return Err("Video file does not exist".to_string());
        }

        let ext = video_path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("mp4");
        let new_video_name = format!("video.{}", ext);

        config["videoSrc"] = Value::String(new_video_name.clone());

        // Create temp dir
        let temp_dir = std::env::temp_dir().join(format!("itlives_export_{}", std::process::id()));
        if temp_dir.exists() {
            let _ = fs::remove_dir_all(&temp_dir);
        }
        fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

        // Copy video
        fs::copy(&video_path, temp_dir.join(&new_video_name)).map_err(|e| e.to_string())?;

        // Write config
        fs::write(
            temp_dir.join("config.json"),
            serde_json::to_string(&config).unwrap(),
        )
        .map_err(|e| e.to_string())?;

        // Zip it up to a temporary .zip file first
        let temp_zip_path = temp_dir.with_extension("zip");
        let source_pattern = format!("{}\\*", temp_dir.display());
        let mut cmd = std::process::Command::new("powershell");
        cmd.args(&[
            "-NoProfile",
            "-Command",
            &format!(
                "Compress-Archive -Path '{}' -DestinationPath '{}' -Force",
                source_pattern,
                temp_zip_path.display()
            ),
        ]);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let output = cmd
            .output()
            .map_err(|e| format!("PowerShell failed to execute: {}", e))?;

        if output.status.success() {
            // Rename the temp zip to the actual destination path (.itl)
            fs::rename(&temp_zip_path, &dest_path)
                .or_else(|_| {
                    fs::copy(&temp_zip_path, &dest_path)?;
                    fs::remove_file(&temp_zip_path)
                })
                .map_err(|e| format!("Failed to move package to destination: {}", e))?;

            let _ = fs::remove_dir_all(&temp_dir);
            Ok(())
        } else {
            let _ = fs::remove_dir_all(&temp_dir);
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            Err(format!(
                "Failed to create .itl package. PowerShell error: {}\n{}",
                stderr, stdout
            ))
        }
    }
    #[cfg(not(windows))]
    {
        Err("Export is only supported on Windows".to_string())
    }
}

#[tauri::command]
pub fn import_itl_package(
    state: tauri::State<'_, crate::wallpaper::state::AppStateStore>,
    src_path: String,
) -> Result<String, String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;

        let temp_dir = std::env::temp_dir().join(format!("itlives_import_{}", std::process::id()));
        if temp_dir.exists() {
            let _ = fs::remove_dir_all(&temp_dir);
        }
        fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

        // Copy the .itl to a .zip file so Expand-Archive accepts it
        let temp_zip_path = temp_dir.with_extension("zip");
        fs::copy(&src_path, &temp_zip_path)
            .map_err(|e| format!("Failed to copy source file: {}", e))?;

        let mut cmd = std::process::Command::new("powershell");
        cmd.args(&[
            "-NoProfile",
            "-Command",
            &format!(
                "Expand-Archive -Path '{}' -DestinationPath '{}' -Force",
                temp_zip_path.display(),
                temp_dir.display()
            ),
        ]);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let status = cmd
            .status()
            .map_err(|e| format!("PowerShell failed: {}", e))?;

        let _ = fs::remove_file(&temp_zip_path); // Cleanup temp zip

        if !status.success() {
            let _ = fs::remove_dir_all(&temp_dir);
            return Err("Failed to extract .itl package".to_string());
        }

        let config_path = temp_dir.join("config.json");
        if !config_path.exists() {
            let _ = fs::remove_dir_all(&temp_dir);
            return Err("Invalid .itl package: config.json missing".to_string());
        }

        let config_str = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
        let mut config: Value = serde_json::from_str(&config_str).map_err(|e| e.to_string())?;
        let relative_video_src = config["videoSrc"]
            .as_str()
            .ok_or("No videoSrc found in config")?
            .to_string();
        let video_filename = std::path::Path::new(&relative_video_src)
            .file_name()
            .ok_or_else(|| "Invalid video filename".to_string())?
            .to_string_lossy()
            .to_string();

        let source_video_path = temp_dir.join(&video_filename);

        if !source_video_path.exists() {
            let _ = fs::remove_dir_all(&temp_dir);
            return Err(format!(
                "Invalid .itl package: video file {} missing",
                video_filename
            ));
        }

        // Create wallpapers/imported dir
        let local_app_data = std::env::var("LOCALAPPDATA").map_err(|e| e.to_string())?;
        let imported_dir = PathBuf::from(&local_app_data)
            .join("itLives")
            .join("wallpapers")
            .join("imported");
        fs::create_dir_all(&imported_dir).map_err(|e| e.to_string())?;

        // Copy video to imported
        let new_video_name = format!(
            "imported_{}_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis(),
            video_filename
        );
        let final_video_path = imported_dir.join(&new_video_name);
        fs::copy(&source_video_path, &final_video_path).map_err(|e| e.to_string())?;

        // Update config with absolute path
        config["videoSrc"] = Value::String(final_video_path.to_string_lossy().to_string());

        // Save as profile
        let original_filename = PathBuf::from(&src_path)
            .file_stem()
            .unwrap()
            .to_string_lossy()
            .to_string();
        let profile_name = format!("{} (Imported)", original_filename);

        super::profiles::save_profile(
            profile_name.clone(),
            serde_json::to_string(&config).unwrap(),
        )?;

        // Add to Library Imports
        let thumbnail_url = config
            .get("thumbnailUrl")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let safe_name =
            profile_name.replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-', "_");

        let video = crate::wallpaper::providers::VideoResult {
            id: safe_name.clone(), // ID matches the actual .ilwp filename so we can load it later
            video_url: final_video_path.to_string_lossy().to_string(),
            thumbnail_url,
            local_path: final_video_path.to_string_lossy().to_string(),
            duration: 0.0,
            width: 1920,
            height: 1080,
            source: "local".to_string(),
            start_time: None,
            end_time: None,
            tags: Some(vec!["itl-package".to_string(), safe_name]),
        };

        let _ = crate::wallpaper::state::import_local_video(&state, video);

        // Cleanup temp dir
        let _ = fs::remove_dir_all(&temp_dir);

        Ok(profile_name)
    }
    #[cfg(not(windows))]
    {
        Err("Import is only supported on Windows".to_string())
    }
}

#[tauri::command]
pub fn scan_wallpaper_engine_directory(
    state: tauri::State<'_, crate::wallpaper::state::AppStateStore>,
    path: String,
) -> Result<usize, String> {
    let base_path = PathBuf::from(&path);
    if !base_path.exists() || !base_path.is_dir() {
        return Err("Directory does not exist or is not a directory".to_string());
    }

    let mut imported_count = 0;

    let entries = fs::read_dir(&base_path).map_err(|e| e.to_string())?;
    for entry in entries.filter_map(Result::ok) {
        let item_path = entry.path();
        if item_path.is_dir() {
            let project_json_path = item_path.join("project.json");
            if project_json_path.exists() {
                if let Ok(content) = fs::read_to_string(&project_json_path) {
                    if let Ok(config) = serde_json::from_str::<Value>(&content) {
                        let file_relative = config["file"].as_str().unwrap_or("");
                        let title = config["title"]
                            .as_str()
                            .unwrap_or("Workshop Video")
                            .to_string();
                        let preview_relative = config["preview"].as_str().unwrap_or("");

                        if !file_relative.is_empty() {
                            let media_path = item_path.join(file_relative);
                            let media_ext = media_path
                                .extension()
                                .and_then(|s| s.to_str())
                                .unwrap_or("")
                                .to_lowercase();
                            let is_supported = matches!(
                                media_ext.as_str(),
                                "mp4"
                                    | "webm"
                                    | "mov"
                                    | "avi"
                                    | "jpg"
                                    | "jpeg"
                                    | "png"
                                    | "webp"
                                    | "html"
                                    | "htm"
                            );

                            if is_supported && media_path.exists() {
                                let thumbnail_url = if !preview_relative.is_empty() {
                                    let t_path = item_path.join(preview_relative);
                                    if t_path.exists() {
                                        t_path.to_string_lossy().to_string()
                                    } else {
                                        String::new()
                                    }
                                } else {
                                    String::new()
                                };

                                let video = crate::wallpaper::providers::VideoResult {
                                    id: format!("we_{}", entry.file_name().to_string_lossy()),
                                    video_url: media_path.to_string_lossy().to_string(),
                                    thumbnail_url,
                                    local_path: media_path.to_string_lossy().to_string(),
                                    duration: 0.0,
                                    width: 1920,
                                    height: 1080,
                                    source: "local".to_string(),
                                    start_time: None,
                                    end_time: None,
                                    tags: Some(vec!["wallpaper-engine".to_string(), title.clone()]),
                                };

                                let _ = crate::wallpaper::state::import_local_video(&state, video);
                                imported_count += 1;
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(imported_count)
}
