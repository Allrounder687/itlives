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
  pinterest_urls: string[];
  adult_pin: string | null;
  hidden_videos: string[];
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
  pinterestUrls: string[];
  hasAdultPin: boolean;
  hiddenVideos: string[];
  isAdultUnlocked: boolean;
  searchResults: VideoResult[];
  page: number;
  category: string;
  colorFilter: string;
  autostartEnabled: boolean;
  hasMore?: boolean;
  duplicateNotice?: string | null;
  previewDismissed: boolean;
  adultPin: string | null;
  resolutions: string | null;
  ratios: string | null;
  colors: string | null;
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
    pinterestUrls: persisted.pinterest_urls ?? [
      "https://www.pinterest.com/search/pins/?q=fantasy%20wallpaper&rs=ac&len=12&source_id=ac_ysOA3Mkj&eq=fantasy%20wall&etslf=5698"
    ],
    hasAdultPin: persisted.adult_pin !== null && persisted.adult_pin !== undefined && persisted.adult_pin !== "",
    hiddenVideos: persisted.hidden_videos ?? [],
    adultPin: persisted.adult_pin,
    resolutions: current.resolutions ?? null,
    ratios: current.ratios ?? null,
    colors: current.colors ?? null,
  };
}

export function isStaticWallpaper(video?: { video_url?: string; local_path?: string; source?: string } | null): boolean {
  if (!video) return false;
  const url = (video.video_url || "").toLowerCase();
  const path = (video.local_path || "").toLowerCase();
  const src = (video.source || "").toLowerCase();
  
  if (url.includes(".mp4") || url.includes(".webm") || url.includes(".mov") || url.includes(".m3u8") ||
      path.includes(".mp4") || path.includes(".webm") || path.includes(".mov") || path.includes(".m3u8")) {
    return false;
  }
  
  return url.endsWith(".jpg") || url.endsWith(".jpeg") || url.endsWith(".png") || url.endsWith(".webp") ||
         path.endsWith(".jpg") || path.endsWith(".jpeg") || path.endsWith(".png") || path.endsWith(".webp") ||
         src === "wallhaven" || src === "pinterest";
}

