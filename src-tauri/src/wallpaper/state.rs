use crate::wallpaper::providers::VideoResult;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};

const MAX_RECENTS: usize = 12;
const MAX_FAVORITES: usize = 24;
const MAX_QUEUE: usize = 100_000;
const MAX_IMPORTED_FILES: usize = 48;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LibraryItem {
    pub video: VideoResult,
    pub saved_at: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(default)]
pub struct WallpaperState {
    pub current_video: Option<VideoResult>,
    pub is_playing: bool,
    pub wallpaper_scale_percent: u64,
    pub restore_on_launch: bool,
    pub close_to_tray: bool,
    pub minimize_to_tray: bool,
    pub recents: Vec<LibraryItem>,
    pub favorites: Vec<LibraryItem>,
    pub imports: Vec<LibraryItem>,
    pub queue: Vec<LibraryItem>,
    pub queue_cursor: usize,
    pub auto_pause_enabled: bool,
    pub paused: bool,
    pub volume_percent: u64,
    pub video_filter: String,
    pub playback_speed: f64,
    pub blur_strength: u32,
    pub theme: String,
    pub wallhaven_api_key: String,
    pub disabled_sources: Vec<String>,
    pub pinterest_urls: Vec<String>,
    pub hidden_videos: Vec<String>,
    pub keep_effects_running_on_pause: bool,
    pub categories_filter: String,
    pub purity_filter: String,
    pub slideshow_source: String,
    pub discover_provider: String,
}

impl Default for WallpaperState {
    fn default() -> Self {
        Self {
            current_video: None,
            is_playing: false,
            wallpaper_scale_percent: 100,
            restore_on_launch: true,
            close_to_tray: true,
            minimize_to_tray: false,
            recents: Vec::new(),
            favorites: Vec::new(),
            imports: Vec::new(),
            queue: Vec::new(),
            queue_cursor: 0,
            auto_pause_enabled: false,
            paused: false,
            volume_percent: 0,
            video_filter: "none".to_string(),
            playback_speed: 1.0,
            blur_strength: 0,
            theme: "master-system".to_string(),
            wallhaven_api_key: "KJ47mwX8D3S61aafbxxv37Rgijm6u4Eq".to_string(),
            disabled_sources: Vec::new(),
            pinterest_urls: vec![
                "https://www.pinterest.com/search/pins/?q=fantasy%20wallpaper&rs=ac&len=12&source_id=ac_ysOA3Mkj&eq=fantasy%20wall&etslf=5698".to_string()
            ],
            hidden_videos: Vec::new(),
            keep_effects_running_on_pause: false,
            categories_filter: "111".to_string(),
            purity_filter: "100".to_string(),
            slideshow_source: "local".to_string(),
            discover_provider: "unified".to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QueueAdvanceResult {
    pub video: VideoResult,
    pub state: WallpaperState,
}

#[derive(Clone)]
pub struct AppStateStore {
    inner: Arc<RwLock<WallpaperState>>,
    path: Arc<PathBuf>,
    app_handle: Arc<std::sync::Mutex<Option<tauri::AppHandle>>>,
}

impl AppStateStore {
    pub fn new() -> Self {
        Self::from_path(state_file())
    }

    pub fn from_path(path: PathBuf) -> Self {
        let mut state = load_from_path(&path);
        if !state.queue.is_empty() {
            state.queue_cursor %= state.queue.len();
        } else {
            state.queue_cursor = 0;
        }
        Self {
            inner: Arc::new(RwLock::new(state)),
            path: Arc::new(path),
            app_handle: Arc::new(std::sync::Mutex::new(None)),
        }
    }

    pub fn set_app_handle(&self, handle: tauri::AppHandle) {
        if let Ok(mut lock) = self.app_handle.lock() {
            *lock = Some(handle);
        }
    }

    pub fn snapshot(&self) -> WallpaperState {
        match self.inner.read() {
            Ok(state) => state.clone(),
            Err(poisoned) => poisoned.into_inner().clone(),
        }
    }

    fn persist(&self, state: &WallpaperState) -> Result<(), String> {
        save_to_path(&self.path, state)?;
        crate::integrations::save_rainmeter_inc(state);
        Ok(())
    }

    fn update<F>(&self, mutate: F) -> Result<WallpaperState, String>
    where
        F: FnOnce(&mut WallpaperState) -> Result<(), String>,
    {
        let mut state = match self.inner.write() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };
        mutate(&mut state)?;
        if !state.queue.is_empty() {
            state.queue_cursor %= state.queue.len();
        } else {
            state.queue_cursor = 0;
        }
        self.persist(&state)?;

        // Emit state update event
        use tauri::Emitter;
        if let Ok(lock) = self.app_handle.lock() {
            if let Some(app) = lock.as_ref() {
                let _ = app.emit("state-updated", state.clone());
            }
        }

        Ok(state.clone())
    }
}

fn now_ts() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub fn state_file() -> PathBuf {
    base_state_dir().join("itlives-state.json")
}

fn base_state_dir() -> PathBuf {
    std::env::var("ITLIVES_STATE_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| super::desktop::app_data_dir())
}

fn load_from_path(path: &Path) -> WallpaperState {
    fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str::<WallpaperState>(&raw).ok())
        .unwrap_or_default()
}

fn save_to_path(path: &Path, state: &WallpaperState) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

fn same_video(left: &VideoResult, right: &VideoResult) -> bool {
    left.local_path == right.local_path || left.id == right.id
}

fn insert_unique_front(items: &mut Vec<LibraryItem>, video: VideoResult, max_len: usize) {
    items.retain(|item| !same_video(&item.video, &video));
    items.insert(
        0,
        LibraryItem {
            video,
            saved_at: now_ts(),
        },
    );
    if items.len() > max_len {
        items.truncate(max_len);
    }
}

pub fn get(store: &AppStateStore) -> WallpaperState {
    store.snapshot()
}

pub fn mark_active(store: &AppStateStore, video: VideoResult) -> Result<WallpaperState, String> {
    store.update(|state| {
        state.is_playing = true;
        state.paused = false;
        state.current_video = Some(video.clone());
        insert_unique_front(&mut state.recents, video, MAX_RECENTS);

        if state.queue.len() <= 1 {
            if state.slideshow_source == "discover" {
                let provider_name = state.discover_provider.clone();
                let categories = state.categories_filter.clone();
                let purity = state.purity_filter.clone();
                let store_clone = store.clone();
                tauri::async_runtime::spawn(async move {
                    if let Ok(provider) = crate::wallpaper::providers::get_provider(&provider_name) {
                        let config = crate::wallpaper::providers::SearchConfig {
                            query: "all".to_string(),
                            order: "random".to_string(),
                            count: 20,
                            page: 1,
                            api_key: None,
                            resolutions: None,
                            ratios: None,
                            colors: None,
                            categories: Some(categories),
                            purity: Some(purity),
                        };
                        if let Ok(results) = provider.fetch_videos_list(&config).await {
                            let _ = store_clone.update(|s| {
                                s.queue.clear();
                                for v in results {
                                    s.queue.push(LibraryItem {
                                        video: v,
                                        saved_at: now_ts(),
                                    });
                                }
                                s.queue_cursor = 0;
                                Ok(())
                            });
                        }
                    }
                });
            } else if !state.recents.is_empty() || !state.imports.is_empty() {
                use rand::seq::SliceRandom;
                let mut rng = rand::thread_rng();
                let mut videos_to_add = Vec::new();
                
                if state.slideshow_source == "local" && !state.imports.is_empty() {
                    videos_to_add.extend(state.imports.iter().map(|i| i.video.clone()));
                } else if state.slideshow_source == "online" && !state.favorites.is_empty() {
                    videos_to_add.extend(state.favorites.iter().map(|i| i.video.clone()));
                    videos_to_add.extend(state.recents.iter().take(10).map(|i| i.video.clone()));
                } else {
                    // Fallback to whatever is available
                    if !state.imports.is_empty() {
                        videos_to_add.extend(state.imports.iter().map(|i| i.video.clone()));
                    } else {
                        videos_to_add.extend(state.recents.iter().take(15).map(|i| i.video.clone()));
                    }
                }
                
                videos_to_add.shuffle(&mut rng);
                
                state.queue.clear();
                for v in videos_to_add {
                    state.queue.push(LibraryItem {
                        video: v,
                        saved_at: now_ts(),
                    });
                }
                state.queue_cursor = 0;
            }
        }

        Ok(())
    })
}

pub fn clear_active(store: &AppStateStore) -> Result<WallpaperState, String> {
    store.update(|state| {
        state.is_playing = false;
        state.current_video = None;
        Ok(())
    })
}

pub fn set_restore_on_launch(
    store: &AppStateStore,
    enabled: bool,
) -> Result<WallpaperState, String> {
    store.update(|state| {
        state.restore_on_launch = enabled;
        Ok(())
    })
}

pub fn set_wallpaper_scale_percent(
    store: &AppStateStore,
    scale_percent: u64,
) -> Result<WallpaperState, String> {
    store.update(|state| {
        state.wallpaper_scale_percent = scale_percent.clamp(25, 200);
        Ok(())
    })
}

pub fn set_auto_pause(store: &AppStateStore, enabled: bool) -> Result<WallpaperState, String> {
    store.update(|state| {
        state.auto_pause_enabled = enabled;
        Ok(())
    })
}

pub fn set_keep_effects_running_on_pause(
    store: &AppStateStore,
    enabled: bool,
) -> Result<WallpaperState, String> {
    store.update(|state| {
        state.keep_effects_running_on_pause = enabled;
        Ok(())
    })
}

pub fn set_paused(store: &AppStateStore, paused: bool) -> Result<WallpaperState, String> {
    store.update(|state| {
        state.paused = paused;
        Ok(())
    })
}

pub fn set_volume_percent(
    store: &AppStateStore,
    volume_percent: u64,
) -> Result<WallpaperState, String> {
    store.update(|state| {
        state.volume_percent = volume_percent.min(100);
        Ok(())
    })
}

pub fn set_video_filter(
    store: &AppStateStore,
    video_filter: String,
) -> Result<WallpaperState, String> {
    store.update(|state| {
        state.video_filter = match video_filter.as_str() {
            "none" | "grayscale" | "vivid" | "soft" | "noir" | "retro" => video_filter,
            _ => "none".to_string(),
        };
        Ok(())
    })
}

pub fn set_playback_speed(store: &AppStateStore, speed: f64) -> Result<WallpaperState, String> {
    store.update(|state| {
        state.playback_speed = speed.clamp(0.1, 4.0);
        Ok(())
    })
}

pub fn set_blur_strength(store: &AppStateStore, strength: u32) -> Result<WallpaperState, String> {
    store.update(|state| {
        state.blur_strength = strength.min(100);
        Ok(())
    })
}

pub fn set_window_behavior(
    store: &AppStateStore,
    close_to_tray: bool,
    minimize_to_tray: bool,
) -> Result<WallpaperState, String> {
    store.update(|state| {
        state.close_to_tray = close_to_tray;
        state.minimize_to_tray = minimize_to_tray;
        Ok(())
    })
}

pub fn set_theme(store: &AppStateStore, theme: String) -> Result<WallpaperState, String> {
    store.update(|state| {
        state.theme = theme;
        Ok(())
    })
}

pub fn set_categories_filter(
    store: &AppStateStore,
    categories_filter: String,
) -> Result<WallpaperState, String> {
    store.update(|state| {
        state.categories_filter = categories_filter;
        Ok(())
    })
}

pub fn set_purity_filter(
    store: &AppStateStore,
    purity_filter: String,
) -> Result<WallpaperState, String> {
    store.update(|state| {
        state.purity_filter = purity_filter;
        Ok(())
    })
}

pub fn set_slideshow_source(
    store: &AppStateStore,
    slideshow_source: String,
) -> Result<WallpaperState, String> {
    let state = store.update(|state| {
        state.slideshow_source = match slideshow_source.as_str() {
            "online" => "online".to_string(),
            "discover" => "discover".to_string(),
            _ => "local".to_string(),
        };
        state.queue.clear();
        state.queue_cursor = 0;
        Ok(())
    })?;

    if let Some(curr) = state.current_video.clone() {
        let _ = mark_active(store, curr);
    }
    
    Ok(state)
}

pub fn set_discover_provider(
    store: &AppStateStore,
    provider: String,
) -> Result<WallpaperState, String> {
    let state = store.update(|state| {
        state.discover_provider = provider;
        state.queue.clear();
        state.queue_cursor = 0;
        Ok(())
    })?;

    if let Some(curr) = state.current_video.clone() {
        let _ = mark_active(store, curr);
    }
    
    Ok(state)
}

pub fn toggle_favorite(
    store: &AppStateStore,
    video: VideoResult,
) -> Result<WallpaperState, String> {
    store.update(|state| {
        if let Some(index) = state
            .favorites
            .iter()
            .position(|item| same_video(&item.video, &video))
        {
            state.favorites.remove(index);
        } else {
            insert_unique_front(&mut state.favorites, video, MAX_FAVORITES);
        }
        Ok(())
    })
}

pub fn import_local_video(
    store: &AppStateStore,
    video: VideoResult,
) -> Result<WallpaperState, String> {
    store.update(|state| {
        insert_unique_front(&mut state.imports, video, MAX_IMPORTED_FILES);
        Ok(())
    })
}

pub fn remove_imported_video(
    store: &AppStateStore,
    video: VideoResult,
) -> Result<WallpaperState, String> {
    store.update(|state| {
        state
            .imports
            .retain(|item| !same_video(&item.video, &video));
        Ok(())
    })
}

pub fn remove_recent_video(
    store: &AppStateStore,
    video: VideoResult,
) -> Result<WallpaperState, String> {
    store.update(|state| {
        state
            .recents
            .retain(|item| !same_video(&item.video, &video));
        Ok(())
    })
}

pub fn add_to_queue(store: &AppStateStore, video: VideoResult) -> Result<WallpaperState, String> {
    store.update(|state| {
        state.queue.retain(|item| !same_video(&item.video, &video));
        state.queue.push(LibraryItem {
            video,
            saved_at: now_ts(),
        });
        if state.queue.len() > MAX_QUEUE {
            let overflow = state.queue.len() - MAX_QUEUE;
            state.queue.drain(0..overflow);
            state.queue_cursor = state.queue_cursor.saturating_sub(overflow);
        }
        if !state.queue.is_empty() {
            state.queue_cursor %= state.queue.len();
        } else {
            state.queue_cursor = 0;
        }
        Ok(())
    })
}

pub fn add_multiple_to_queue(store: &AppStateStore, videos: Vec<VideoResult>) -> Result<WallpaperState, String> {
    store.update(|state| {
        for video in videos {
            state.queue.retain(|item| !same_video(&item.video, &video));
            state.queue.push(LibraryItem {
                video,
                saved_at: now_ts(),
            });
        }
        if state.queue.len() > MAX_QUEUE {
            let overflow = state.queue.len() - MAX_QUEUE;
            state.queue.drain(0..overflow);
            state.queue_cursor = state.queue_cursor.saturating_sub(overflow);
        }
        if !state.queue.is_empty() {
            state.queue_cursor %= state.queue.len();
        } else {
            state.queue_cursor = 0;
        }
        Ok(())
    })
}

pub fn remove_from_queue(
    store: &AppStateStore,
    video: VideoResult,
) -> Result<WallpaperState, String> {
    store.update(|state| {
        let previous_len = state.queue.len();
        state.queue.retain(|item| !same_video(&item.video, &video));
        if state.queue.is_empty() {
            state.queue_cursor = 0;
        } else if previous_len != state.queue.len() {
            state.queue_cursor %= state.queue.len();
        }
        Ok(())
    })
}

pub fn clear_queue(store: &AppStateStore) -> Result<WallpaperState, String> {
    store.update(|state| {
        state.queue.clear();
        state.queue_cursor = 0;
        Ok(())
    })
}

pub fn reorder_queue(
    store: &AppStateStore,
    from_index: usize,
    to_index: usize,
) -> Result<WallpaperState, String> {
    store.update(|state| {
        if from_index < state.queue.len() && to_index < state.queue.len() {
            let item = state.queue.remove(from_index);
            state.queue.insert(to_index, item);
        }
        Ok(())
    })
}

pub fn set_thumbnail(
    store: &AppStateStore,
    local_path: String,
    thumb_path: String,
) -> Result<WallpaperState, String> {
    store.update(|state| {
        for item in state.imports.iter_mut() {
            if item.video.local_path == local_path {
                item.video.thumbnail_url = thumb_path.clone();
            }
        }
        for item in state.recents.iter_mut() {
            if item.video.local_path == local_path {
                item.video.thumbnail_url = thumb_path.clone();
            }
        }
        for item in state.favorites.iter_mut() {
            if item.video.local_path == local_path {
                item.video.thumbnail_url = thumb_path.clone();
            }
        }
        for item in state.queue.iter_mut() {
            if item.video.local_path == local_path {
                item.video.thumbnail_url = thumb_path.clone();
            }
        }
        if let Some(ref mut curr) = state.current_video {
            if curr.local_path == local_path {
                curr.thumbnail_url = thumb_path.clone();
            }
        }
        Ok(())
    })
}



pub fn set_wallhaven_api_key(store: &AppStateStore, key: String) -> Result<WallpaperState, String> {
    store.update(|state| {
        state.wallhaven_api_key = key;
        Ok(())
    })
}

pub fn set_disabled_sources(
    store: &AppStateStore,
    disabled: Vec<String>,
) -> Result<WallpaperState, String> {
    store.update(|state| {
        state.disabled_sources = disabled;
        Ok(())
    })
}

pub fn set_pinterest_urls(
    store: &AppStateStore,
    urls: Vec<String>,
) -> Result<WallpaperState, String> {
    store.update(|state| {
        state.pinterest_urls = urls;
        Ok(())
    })
}

pub fn advance_queue(store: &AppStateStore) -> Result<QueueAdvanceResult, String> {
    let mut state = match store.inner.write() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    };

    if state.queue.is_empty() {
        state.queue_cursor = 0;
        return Err("Queue is empty".to_string());
    }

    state.queue_cursor %= state.queue.len();
    let len = state.queue.len();
    let index = state.queue_cursor;
    let video = state.queue[index].video.clone();
    state.queue_cursor = (index + 1) % len;
    store.persist(&state)?;

    Ok(QueueAdvanceResult {
        video,
        state: state.clone(),
    })
}

pub fn retreat_queue(store: &AppStateStore) -> Result<QueueAdvanceResult, String> {
    let mut state = match store.inner.write() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    };

    if state.queue.is_empty() {
        state.queue_cursor = 0;
        return Err("Queue is empty".to_string());
    }

    state.queue_cursor %= state.queue.len();
    let len = state.queue.len();
    let index = if len == 1 {
        0
    } else {
        (state.queue_cursor + len - 2) % len
    };

    let video = state.queue[index].video.clone();
    state.queue_cursor = (index + 1) % len;
    store.persist(&state)?;

    Ok(QueueAdvanceResult {
        video,
        state: state.clone(),
    })
}

pub fn toggle_hide_video(
    store: &AppStateStore,
    video_id: String,
) -> Result<WallpaperState, String> {
    let state = store.update(|s| {
        if let Some(pos) = s.hidden_videos.iter().position(|id| id == &video_id) {
            s.hidden_videos.remove(pos);
        } else {
            s.hidden_videos.push(video_id);
        }
        Ok(())
    })?;
    Ok(state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::Mutex;

    static TEST_LOCK: Mutex<()> = Mutex::new(());

    fn sample_video(id: &str) -> VideoResult {
        VideoResult {
            id: id.to_string(),
            video_url: format!("https://example.com/{id}.mp4"),
            thumbnail_url: String::new(),
            local_path: format!("C:/tmp/{id}.mp4"),
            duration: 12.5,
            width: 1920,
            height: 1080,
            source: "direct".to_string(),
            start_time: None,
            end_time: None,
            tags: None,
        }
    }

    fn prepare_store(name: &str) -> AppStateStore {
        let dir = std::env::temp_dir().join(format!("itlives-tests-{name}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("temp dir");
        AppStateStore::from_path(dir.join("state.json"))
    }

    #[test]
    fn mark_active_persists_current_and_recents() {
        let _guard = TEST_LOCK.lock().expect("test lock");
        let store = prepare_store("mark-active");

        let state = mark_active(&store, sample_video("alpha")).expect("mark active");
        assert!(state.is_playing);
        assert_eq!(
            state.current_video.as_ref().map(|v| v.id.as_str()),
            Some("alpha")
        );
        assert_eq!(state.recents.len(), 1);
        assert_eq!(state.recents[0].video.id, "alpha");
    }

    #[test]
    fn toggle_favorite_adds_then_removes() {
        let _guard = TEST_LOCK.lock().expect("test lock");
        let store = prepare_store("toggle-favorite");

        let added = toggle_favorite(&store, sample_video("beta")).expect("favorite add");
        assert_eq!(added.favorites.len(), 1);
        assert_eq!(added.favorites[0].video.id, "beta");

        let removed = toggle_favorite(&store, sample_video("beta")).expect("favorite remove");
        assert!(removed.favorites.is_empty());
    }

    #[test]
    fn queue_rotation_advances_in_order() {
        let _guard = TEST_LOCK.lock().expect("test lock");
        let store = prepare_store("queue-advance");

        add_to_queue(&store, sample_video("one")).expect("queue one");
        add_to_queue(&store, sample_video("two")).expect("queue two");

        let first = advance_queue(&store).expect("advance 1");
        let second = advance_queue(&store).expect("advance 2");
        let third = advance_queue(&store).expect("advance 3");

        assert_eq!(first.video.id, "one");
        assert_eq!(second.video.id, "two");
        assert_eq!(third.video.id, "one");
    }

    #[test]
    fn restore_setting_persists() {
        let _guard = TEST_LOCK.lock().expect("test lock");
        let store = prepare_store("restore-setting");

        let disabled = set_restore_on_launch(&store, false).expect("disable restore");
        assert!(!disabled.restore_on_launch);

        let enabled = set_restore_on_launch(&store, true).expect("enable restore");
        assert!(enabled.restore_on_launch);
    }

    #[test]
    fn wallpaper_scale_persists_with_clamp() {
        let _guard = TEST_LOCK.lock().expect("test lock");
        let store = prepare_store("wallpaper-scale");

        let low = set_wallpaper_scale_percent(&store, 10).expect("low scale");
        assert_eq!(low.wallpaper_scale_percent, 25);

        let high = set_wallpaper_scale_percent(&store, 250).expect("high scale");
        assert_eq!(high.wallpaper_scale_percent, 200);

        let loaded = get(&store);
        assert_eq!(loaded.wallpaper_scale_percent, 200);
    }

    #[test]
    fn window_behavior_persists() {
        let _guard = TEST_LOCK.lock().expect("test lock");
        let store = prepare_store("window-behavior");

        let state = set_window_behavior(&store, true, true).expect("window behavior");
        assert!(state.close_to_tray);
        assert!(state.minimize_to_tray);

        let loaded = get(&store);
        assert!(loaded.close_to_tray);
        assert!(loaded.minimize_to_tray);
    }
}
