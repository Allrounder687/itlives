use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::fs;
use tokio::io::AsyncWriteExt;

#[derive(Serialize, Clone)]
pub struct BatchProgress {
    pub current: u32,
    pub total: u32,
    pub current_url: String,
    pub status: String,
}

#[derive(Deserialize)]
struct WallhavenAPIResponse {
    data: Vec<WallhavenAPIItem>,
    meta: Option<WallhavenAPIMeta>,
}

#[derive(Deserialize)]
struct WallhavenAPIItem {
    id: String,
    path: String,
}

#[derive(Deserialize)]
struct WallhavenAPIMeta {
    last_page: u32,
    total: u32,
}

static CANCEL_FLAG: AtomicBool = AtomicBool::new(false);

#[tauri::command]
pub async fn cancel_batch_download() -> Result<(), String> {
    CANCEL_FLAG.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn start_wallhaven_batch_download(
    app: AppHandle,
    collection_url: String,
    target_dir: String,
    max_count: Option<u32>,
) -> Result<(), String> {
    // collection_url is expected to be "https://wallhaven.cc/user/DeviateFish/collections/95531"
    // Convert to API: "https://wallhaven.cc/api/v1/collections/DeviateFish/95531"
    let parts: Vec<&str> = collection_url.split('/').collect();
    if parts.len() < 7 {
        return Err("Invalid collection URL".to_string());
    }
    let username = parts[4];
    let coll_id = parts[6];

    let base_api_url = format!(
        "https://wallhaven.cc/api/v1/collections/{}/{}",
        username, coll_id
    );

    let target_path = PathBuf::from(&target_dir);
    if !target_path.exists() {
        fs::create_dir_all(&target_path)
            .await
            .map_err(|e| e.to_string())?;
    }

    CANCEL_FLAG.store(false, Ordering::SeqCst);

    tauri::async_runtime::spawn(async move {
        let client = reqwest::Client::new();
        let mut current_page = 1;
        let mut downloaded_count = 0;
        let mut total_expected = max_count.unwrap_or(u32::MAX);

        loop {
            if CANCEL_FLAG.load(Ordering::SeqCst) {
                let _ = app.emit(
                    "batch-download-progress",
                    BatchProgress {
                        current: downloaded_count,
                        total: total_expected,
                        current_url: "".to_string(),
                        status: "Cancelled".to_string(),
                    },
                );
                break;
            }

            let api_url = format!("{}?page={}", base_api_url, current_page);
            let resp = match client.get(&api_url).send().await {
                Ok(r) => r,
                Err(e) => {
                    log::error!("Batch Download API error: {}", e);
                    break;
                }
            };

            if resp.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
                // Rate limited, sleep and retry
                let _ = app.emit(
                    "batch-download-progress",
                    BatchProgress {
                        current: downloaded_count,
                        total: total_expected,
                        current_url: "".to_string(),
                        status: "Rate limited by Wallhaven. Sleeping 10s...".to_string(),
                    },
                );
                tokio::time::sleep(Duration::from_secs(10)).await;
                continue;
            }

            if !resp.status().is_success() {
                log::error!("Batch Download API non-success: {}", resp.status());
                break;
            }

            let api_data: WallhavenAPIResponse = match resp.json().await {
                Ok(d) => d,
                Err(e) => {
                    log::error!("Batch Download JSON error: {}", e);
                    break;
                }
            };

            if let Some(meta) = &api_data.meta {
                if max_count.is_none() || max_count.unwrap() > meta.total {
                    total_expected = meta.total;
                }
            }

            if api_data.data.is_empty() {
                break; // No more data
            }

            for item in api_data.data {
                if CANCEL_FLAG.load(Ordering::SeqCst) || downloaded_count >= total_expected {
                    break;
                }

                let ext = item.path.split('.').last().unwrap_or("jpg");
                let file_name = format!("wh_{}.{}", item.id, ext);
                let file_path = target_path.join(&file_name);

                if !file_path.exists() {
                    let _ = app.emit(
                        "batch-download-progress",
                        BatchProgress {
                            current: downloaded_count,
                            total: total_expected,
                            current_url: item.path.clone(),
                            status: format!("Downloading {}...", file_name),
                        },
                    );

                    // Download image
                    if let Ok(img_resp) = client.get(&item.path).send().await {
                        if let Ok(bytes) = img_resp.bytes().await {
                            if let Ok(mut file) = fs::File::create(&file_path).await {
                                let _ = file.write_all(&bytes).await;
                            }
                        }
                    }
                    // Respect Wallhaven API limits (approx 1 request per 1.5 seconds)
                    tokio::time::sleep(Duration::from_millis(1500)).await;
                } else {
                    let _ = app.emit(
                        "batch-download-progress",
                        BatchProgress {
                            current: downloaded_count,
                            total: total_expected,
                            current_url: item.path.clone(),
                            status: format!("Skipped {} (Already exists)", file_name),
                        },
                    );
                }

                downloaded_count += 1;
            }

            if CANCEL_FLAG.load(Ordering::SeqCst) || downloaded_count >= total_expected {
                break;
            }

            if let Some(meta) = &api_data.meta {
                if current_page >= meta.last_page {
                    break;
                }
            }
            current_page += 1;
        }

        let _ = app.emit(
            "batch-download-progress",
            BatchProgress {
                current: downloaded_count,
                total: total_expected,
                current_url: "".to_string(),
                status: if CANCEL_FLAG.load(Ordering::SeqCst) {
                    "Cancelled".to_string()
                } else {
                    "Completed".to_string()
                },
            },
        );
    });

    Ok(())
}

#[tauri::command]
pub async fn download_single_file(url: String, target_path: String) -> Result<(), String> {
    let client = reqwest::Client::new();
    let img_resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let bytes = img_resp.bytes().await.map_err(|e| e.to_string())?;

    let mut file = fs::File::create(&target_path)
        .await
        .map_err(|e| e.to_string())?;
    file.write_all(&bytes).await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn start_wallhaven_selection_download(
    app: AppHandle,
    urls: Vec<String>,
    target_dir: String,
) -> Result<(), String> {
    let target_path = PathBuf::from(&target_dir);
    if !target_path.exists() {
        fs::create_dir_all(&target_path)
            .await
            .map_err(|e| e.to_string())?;
    }

    CANCEL_FLAG.store(false, Ordering::SeqCst);

    tauri::async_runtime::spawn(async move {
        let client = reqwest::Client::new();
        let total_expected = urls.len() as u32;
        let mut downloaded_count = 0;

        for url in urls {
            if CANCEL_FLAG.load(Ordering::SeqCst) {
                break;
            }

            let ext = url.split('.').last().unwrap_or("jpg");
            let file_name = format!("wh_selected_{}.{}", downloaded_count, ext);
            let file_path = target_path.join(&file_name);

            if !file_path.exists() {
                let _ = app.emit(
                    "batch-download-progress",
                    BatchProgress {
                        current: downloaded_count,
                        total: total_expected,
                        current_url: url.clone(),
                        status: format!("Downloading {}...", file_name),
                    },
                );

                if let Ok(img_resp) = client.get(&url).send().await {
                    if let Ok(bytes) = img_resp.bytes().await {
                        if let Ok(mut file) = fs::File::create(&file_path).await {
                            let _ = file.write_all(&bytes).await;
                        }
                    }
                }
                tokio::time::sleep(Duration::from_millis(1500)).await;
            } else {
                let _ = app.emit(
                    "batch-download-progress",
                    BatchProgress {
                        current: downloaded_count,
                        total: total_expected,
                        current_url: url.clone(),
                        status: format!("Skipped {} (Already exists)", file_name),
                    },
                );
            }

            downloaded_count += 1;
        }

        let _ = app.emit(
            "batch-download-progress",
            BatchProgress {
                current: downloaded_count,
                total: total_expected,
                current_url: "".to_string(),
                status: if CANCEL_FLAG.load(Ordering::SeqCst) {
                    "Cancelled".to_string()
                } else {
                    "Completed".to_string()
                },
            },
        );
    });

    Ok(())
}
