export interface VideoResult {
  id: string;
  video_url: string;
  thumbnail_url: string;
  local_path: string;
  duration: number;
  width: number;
  height: number;
  source: string;
}

export interface LibraryItem {
  video: VideoResult;
  saved_at: number;
}

export interface PersistedState {
  current_video: VideoResult | null;
  is_playing: boolean;
  wallpaper_scale_percent: number;
  restore_on_launch: boolean;
  close_to_tray: boolean;
  minimize_to_tray: boolean;
  recents: LibraryItem[];
  favorites: LibraryItem[];
  imports: LibraryItem[];
  queue: LibraryItem[];
  queue_cursor: number;
  rotation_enabled: boolean;
  rotation_interval_seconds: number;
  auto_pause_enabled: boolean;
  paused: boolean;
  volume_percent: number;
  video_filter: string;
  playback_speed: number;
  blur_strength: number;
  theme: string;
  wallhaven_api_key: string;
  disabled_sources: string[];
}

export interface WallpaperState {
  currentVideo: VideoResult | null;
  isPlaying: boolean;
  isLoading: boolean;
  isHydrating: boolean;
  error: string | null;
  errorHint: string | null;
  source: string;
  query: string;
  restoreOnLaunch: boolean;
  closeToTray: boolean;
  minimizeToTray: boolean;
  wallpaperScalePercent: number;
  recents: LibraryItem[];
  favorites: LibraryItem[];
  imports: LibraryItem[];
  queue: LibraryItem[];
  queueCursor: number;
  rotationEnabled: boolean;
  rotationIntervalSeconds: number;
  autoPauseEnabled: boolean;
  paused: boolean;
  volumePercent: number;
  videoFilter: string;
  playbackSpeed: number;
  blurStrength: number;
  theme: string;
  wallhavenApiKey: string;
  disabledSources: string[];
  searchResults: VideoResult[];
  page: number;
  category: string;
  autostartEnabled: boolean;
}

export function applyPersistedState(persisted: PersistedState, current: WallpaperState): WallpaperState {
  return {
    ...current,
    currentVideo: persisted.current_video,
    isPlaying: persisted.is_playing,
    wallpaperScalePercent: persisted.wallpaper_scale_percent,
    restoreOnLaunch: persisted.restore_on_launch,
    closeToTray: persisted.close_to_tray,
    minimizeToTray: persisted.minimize_to_tray,
    recents: persisted.recents,
    favorites: persisted.favorites,
    imports: persisted.imports,
    queue: persisted.queue,
    queueCursor: persisted.queue_cursor,
    rotationEnabled: persisted.rotation_enabled,
    rotationIntervalSeconds: persisted.rotation_interval_seconds,
    autoPauseEnabled: persisted.auto_pause_enabled,
    paused: persisted.paused,
    volumePercent: persisted.volume_percent,
    videoFilter: persisted.video_filter,
    playbackSpeed: persisted.playback_speed ?? 1.0,
    blurStrength: persisted.blur_strength ?? 0,
    theme: persisted.theme || "master-system",
    wallhavenApiKey: persisted.wallhaven_api_key ?? "KJ47mwX8D3S61aafbxxv37Rgijm6u4Eq",
    disabledSources: persisted.disabled_sources ?? [],
  };
}
