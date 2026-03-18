"use client";

import { useCallback, useEffect, useRef, useState } from "react";

let coreApiPromise: Promise<typeof import("@tauri-apps/api/core")> | null = null;
let windowApiPromise: Promise<typeof import("@tauri-apps/api/window")> | null = null;
let dialogApiPromise: Promise<typeof import("@tauri-apps/plugin-dialog")> | null = null;

function getCoreApi() {
  if (!coreApiPromise) {
    coreApiPromise = import("@tauri-apps/api/core");
  }
  return coreApiPromise;
}

function getWindowApi() {
  if (!windowApiPromise) {
    windowApiPromise = import("@tauri-apps/api/window");
  }
  return windowApiPromise;
}

function getDialogApi() {
  if (!dialogApiPromise) {
    dialogApiPromise = import("@tauri-apps/plugin-dialog");
  }
  return dialogApiPromise;
}

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

interface PersistedState {
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
}

interface QueueAdvanceResult {
  video: VideoResult;
  state: PersistedState;
}

interface WallpaperState {
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
  searchResults: VideoResult[];
  page: number;
  category: string;
}

function applyPersistedState(persisted: PersistedState, current: WallpaperState): WallpaperState {
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
  };
}

function toErrorMessage(error: unknown, fallback: string) {
  return typeof error === "string" ? error : error instanceof Error ? error.message : fallback;
}

function getErrorHint(message: string, source: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("not allowed")) {
    return "The Tauri window capability set is missing a required permission. Restart the app after the capability update.";
  }

  if (normalized.includes("fetch failed") || normalized.includes("network") || normalized.includes("download")) {
    return source === "direct"
      ? "Verify the URL points directly to a playable MP4 file or switch to a local file path."
      : "The provider request failed. Try a different query or switch to direct media mode.";
  }

  if (normalized.includes("apply failed") || normalized.includes("wallpaper") || normalized.includes("mpv")) {
    return "The media was fetched but desktop playback did not attach cleanly. Stop playback, relaunch the app, and retry with a known-good MP4.";
  }

  if (normalized.includes("queue")) {
    return "The queue state on disk may be stale. Clear the queue and add the wallpapers again.";
  }

  return source === "direct"
    ? "Use a direct MP4 URL or a fully qualified local file path."
    : "Try a simpler search term or switch providers.";
}

function validateDirectInput(query: string) {
  const value = query.trim();
  if (!value) {
    return "Enter a direct MP4 URL or a local file path before launching playback.";
  }
  return null;
}

export function useWallpaper() {
  const [state, setState] = useState<WallpaperState>({
    currentVideo: null,
    isPlaying: false,
    isLoading: false,
    isHydrating: true,
    error: null,
    errorHint: null,
    source: "direct",
    query: "https://motionbgs.com/media/1194/vegeta-ultra-ego.3840x2160.mp4",
    restoreOnLaunch: true,
    closeToTray: true,
    minimizeToTray: false,
    wallpaperScalePercent: 100,
    recents: [],
    favorites: [],
    imports: [],
    queue: [],
    queueCursor: 0,
    rotationEnabled: false,
    rotationIntervalSeconds: 300,
    autoPauseEnabled: true,
    paused: false,
    volumePercent: 0,
    videoFilter: "none",
    searchResults: [],
    page: 1,
    category: "",
  });

  const rotationBusyRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      try {
        const { invoke } = await getCoreApi();
        const persisted = await invoke<PersistedState>("get_app_state");
        if (!active) {
          return;
        }
        setState((current) => ({
          ...applyPersistedState(persisted, current),
          isHydrating: false,
        }));
      } catch {
        if (!active) {
          return;
        }
        setState((current) => ({ ...current, isHydrating: false }));
      }
    }

    hydrate();

    return () => {
      active = false;
    };
  }, []);

  const setSource = useCallback((source: string) => {
    setState((s) => ({ ...s, source, page: 1 }));
  }, []);

  const setQuery = useCallback((query: string) => {
    setState((s) => ({ ...s, query, page: 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setState((s) => ({ ...s, page }));
  }, []);

  const setCategory = useCallback((category: string) => {
    setState((s) => ({ ...s, category, query: category, page: 1 }));
  }, []);

  const browseLocalVideo = useCallback(async () => {
    try {
      const { open } = await getDialogApi();
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "Video Files",
            extensions: ["mp4", "webm", "m4v", "mov", "avi", "mkv"],
          },
        ],
      });

      if (typeof selected !== "string" || !selected) {
        return;
      }

      const { invoke } = await getCoreApi();
      const importedVideo = await invoke<VideoResult>("fetch_video", {
        source: "direct",
        query: selected,
        order: "trending",
      });
      const persisted = await invoke<PersistedState>("import_local_video", {
        video: importedVideo,
      });

      setState((s) => ({
        ...applyPersistedState(persisted, s),
        source: "direct",
        query: selected,
        currentVideo: importedVideo,
        error: null,
        errorHint: null,
      }));
    } catch (error: unknown) {
      const message = toErrorMessage(error, "File picker failed");
      setState((s) => ({
        ...s,
        error: message,
        errorHint: "The native file picker could not be opened. You can still paste a full local file path manually.",
      }));
    }
  }, []);

  const fetchVideo = useCallback(async () => {
    if (state.source === "direct") {
      const inputError = validateDirectInput(state.query);
      if (inputError) {
        setState((s) => ({
          ...s,
          error: inputError,
          errorHint: "Direct media mode expects either an MP4 URL or a full local file path.",
        }));
        return null;
      }
    }

    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const { invoke } = await getCoreApi();
      const result = await invoke<VideoResult>("fetch_video", {
        source: state.source,
        query: state.query,
        order: "trending",
      });
      setState((s) => ({ ...s, currentVideo: result, isLoading: false, errorHint: null }));
      return result;
    } catch (error: unknown) {
      const message = toErrorMessage(error, "Fetch failed");
      setState((s) => ({
        ...s,
        isLoading: false,
        error: message,
        errorHint: getErrorHint(message, state.source),
      }));
      return null;
    }
  }, [state.source, state.query]);

  const fetchVideosList = useCallback(async () => {
    if (state.source === "direct") return [];

    setState((s) => ({ ...s, isLoading: true, error: null, searchResults: [] }));
    try {
      const { invoke } = await getCoreApi();
      const results = await invoke<VideoResult[]>("fetch_videos_list", {
        source: state.source,
        query: state.query,
        order: "trending",
        page: state.page,
      });
      setState((s) => ({ ...s, searchResults: results, isLoading: false, errorHint: null }));
      return results;
    } catch (error: unknown) {
      const message = toErrorMessage(error, "Fetch list failed");
      setState((s) => ({
        ...s,
        isLoading: false,
        error: message,
        errorHint: getErrorHint(message, state.source),
      }));
      return [];
    }
  }, [state.source, state.query]);

  const selectVideo = useCallback((video: VideoResult) => {
    setState((s) => ({ ...s, currentVideo: video }));
  }, []);

  const applyWallpaper = useCallback(async (video: VideoResult) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("apply_wallpaper", {
        video,
        scalePercent: state.wallpaperScalePercent,
      });
      setState((s) => ({
        ...applyPersistedState(persisted, s),
        currentVideo: video,
        isPlaying: true,
        error: null,
        errorHint: null,
      }));
    } catch (error: unknown) {
      const message = toErrorMessage(error, "Apply failed");
      setState((s) => ({
        ...s,
        error: message,
        errorHint: getErrorHint(message, state.source),
      }));
    }
  }, [state.source, state.wallpaperScalePercent]);

  const stopWallpaper = useCallback(async () => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("stop_wallpaper");
      setState((s) => ({
        ...applyPersistedState(persisted, s),
        isPlaying: false,
        error: null,
        errorHint: null,
      }));
    } catch (error: unknown) {
      const message = toErrorMessage(error, "Stop failed");
      setState((s) => ({
        ...s,
        error: message,
        errorHint: getErrorHint(message, state.source),
      }));
    }
  }, [state.source]);

  const toggleFavorite = useCallback(async (video: VideoResult) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("toggle_favorite", { video });
      setState((s) => ({
        ...applyPersistedState(persisted, s),
        error: null,
        errorHint: null,
      }));
    } catch (error: unknown) {
      const message = toErrorMessage(error, "Favorite update failed");
      setState((s) => ({
        ...s,
        error: message,
        errorHint: getErrorHint(message, state.source),
      }));
    }
  }, [state.source]);

  const removeImportedVideo = useCallback(async (video: VideoResult) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("remove_imported_video", { video });
      setState((s) => ({
        ...applyPersistedState(persisted, s),
        error: null,
        errorHint: null,
      }));
    } catch (error: unknown) {
      const message = toErrorMessage(error, "Imported video removal failed");
      setState((s) => ({
        ...s,
        error: message,
        errorHint: "Could not remove the imported local file from the library.",
      }));
    }
  }, []);

  const addToQueue = useCallback(async (video: VideoResult) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("add_to_queue", { video });
      setState((s) => ({
        ...applyPersistedState(persisted, s),
        error: null,
        errorHint: null,
      }));
    } catch (error: unknown) {
      const message = toErrorMessage(error, "Queue update failed");
      setState((s) => ({
        ...s,
        error: message,
        errorHint: getErrorHint(message, state.source),
      }));
    }
  }, [state.source]);

  const removeFromQueue = useCallback(async (video: VideoResult) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("remove_from_queue", { video });
      setState((s) => ({
        ...applyPersistedState(persisted, s),
        error: null,
        errorHint: null,
      }));
    } catch (error: unknown) {
      const message = toErrorMessage(error, "Queue removal failed");
      setState((s) => ({
        ...s,
        error: message,
        errorHint: getErrorHint(message, state.source),
      }));
    }
  }, [state.source]);

  const clearQueue = useCallback(async () => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("clear_queue");
      setState((s) => ({
        ...applyPersistedState(persisted, s),
        error: null,
        errorHint: null,
      }));
    } catch (error: unknown) {
      const message = toErrorMessage(error, "Queue clear failed");
      setState((s) => ({
        ...s,
        error: message,
        errorHint: getErrorHint(message, state.source),
      }));
    }
  }, [state.source]);

  const setRotationConfig = useCallback(async (enabled: boolean, intervalSeconds: number) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_rotation", {
        enabled,
        intervalSeconds,
      });
      setState((s) => ({
        ...applyPersistedState(persisted, s),
        error: null,
        errorHint: null,
      }));
    } catch (error: unknown) {
      const message = toErrorMessage(error, "Rotation settings failed");
      setState((s) => ({
        ...s,
        error: message,
        errorHint: getErrorHint(message, state.source),
      }));
    }
  }, [state.source]);

  const setRestoreOnLaunch = useCallback(async (enabled: boolean) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_restore_on_launch", { enabled });
      setState((s) => ({
        ...applyPersistedState(persisted, s),
        error: null,
        errorHint: null,
      }));
    } catch (error: unknown) {
      const message = toErrorMessage(error, "Restore preference failed");
      setState((s) => ({
        ...s,
        error: message,
        errorHint: getErrorHint(message, state.source),
      }));
    }
  }, [state.source]);

  const setWindowBehavior = useCallback(async (closeToTray: boolean, minimizeToTray: boolean) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_window_behavior", {
        closeToTray,
        minimizeToTray,
      });
      setState((s) => ({
        ...applyPersistedState(persisted, s),
        error: null,
        errorHint: null,
      }));
    } catch (error: unknown) {
      const message = toErrorMessage(error, "Window behavior update failed");
      setState((s) => ({
        ...s,
        error: message,
        errorHint: getErrorHint(message, s.source),
      }));
    }
  }, []);

  const setWallpaperScale = useCallback(async (scalePercent: number) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_wallpaper_scale", {
        scalePercent,
      });
      setState((s) => ({
        ...applyPersistedState(persisted, s),
        error: null,
        errorHint: null,
      }));
    } catch (error: unknown) {
      const message = toErrorMessage(error, "Wallpaper scale update failed");
      setState((s) => ({
        ...s,
        error: message,
        errorHint: "Try a value between 25% and 200%. The current wallpaper will be reapplied at the new scale.",
      }));
    }
  }, []);

  const setAutoPauseEnabled = useCallback(async (enabled: boolean) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_auto_pause", { enabled });
      setState((s) => ({
        ...applyPersistedState(persisted, s),
        error: null,
        errorHint: null,
      }));
    } catch (error: unknown) {
      const message = toErrorMessage(error, "Auto-pause setting update failed");
      setState((s) => ({
        ...s,
        error: message,
        errorHint: "Could not persist auto-pause preference.",
      }));
    }
  }, []);

  const setPaused = useCallback(async (paused: boolean) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_wallpaper_paused", { paused });
      setState((s) => ({
        ...applyPersistedState(persisted, s),
        error: null,
        errorHint: null,
      }));
    } catch (error: unknown) {
      const message = toErrorMessage(error, "Pause update failed");
      setState((s) => ({
        ...s,
        error: message,
        errorHint: "Could not pause or resume the current wallpaper session.",
      }));
    }
  }, []);

  const setVolumePercent = useCallback(async (volumePercent: number) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_wallpaper_volume", {
        volumePercent,
      });
      setState((s) => ({
        ...applyPersistedState(persisted, s),
        error: null,
        errorHint: null,
      }));
    } catch (error: unknown) {
      const message = toErrorMessage(error, "Volume update failed");
      setState((s) => ({
        ...s,
        error: message,
        errorHint: "Could not update wallpaper audio volume.",
      }));
    }
  }, []);

  const setVideoFilter = useCallback(async (videoFilter: string) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_wallpaper_filter", {
        videoFilter,
      });
      setState((s) => ({
        ...applyPersistedState(persisted, s),
        error: null,
        errorHint: null,
      }));
    } catch (error: unknown) {
      const message = toErrorMessage(error, "Filter update failed");
      setState((s) => ({
        ...s,
        error: message,
        errorHint: "Could not apply the selected live video filter.",
      }));
    }
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    async function bindCloseBehavior() {
      try {
        const { getCurrentWindow } = await getWindowApi();
        const appWindow = getCurrentWindow();
        unlisten = await appWindow.onCloseRequested(async (event) => {
          if (!state.closeToTray) {
            return;
          }

          event.preventDefault();
          await appWindow.hide();
        });
      } catch {
        unlisten = undefined;
      }
    }

    void bindCloseBehavior();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [state.closeToTray]);

  useEffect(() => {
    if (state.isHydrating || !state.rotationEnabled || state.queue.length === 0) {
      return;
    }

    const timer = window.setInterval(async () => {
      if (rotationBusyRef.current) {
        return;
      }
      rotationBusyRef.current = true;

      try {
        const { invoke } = await getCoreApi();
        const advanced = await invoke<QueueAdvanceResult>("advance_rotation", {
          scalePercent: state.wallpaperScalePercent,
        });

        setState((s) => ({
          ...applyPersistedState(advanced.state, s),
          currentVideo: advanced.video,
          error: null,
          errorHint: null,
        }));
      } catch (error: unknown) {
        const message = toErrorMessage(error, "Rotation advance failed");
        setState((s) => ({
          ...s,
          error: message,
          errorHint: getErrorHint(message, s.source),
        }));
      } finally {
        rotationBusyRef.current = false;
      }
    }, Math.max(30, state.rotationIntervalSeconds) * 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [state.isHydrating, state.queue.length, state.rotationEnabled, state.rotationIntervalSeconds, state.wallpaperScalePercent]);

  useEffect(() => {
    if (state.isHydrating || state.source === "direct") {
      return;
    }
    // Automatically refetch lists when the pager offset is changed by components footers
    void fetchVideosList();
  }, [state.page, state.category]);

  const isFavorite = useCallback(
    (video: VideoResult | null) =>
      !!video &&
      state.favorites.some(
        (item) => item.video.local_path === video.local_path || item.video.id === video.id,
      ),
    [state.favorites],
  );

  const isQueued = useCallback(
    (video: VideoResult | null) =>
      !!video &&
      state.queue.some(
        (item) => item.video.local_path === video.local_path || item.video.id === video.id,
      ),
    [state.queue],
  );

  return {
    ...state,
    setSource,
    setQuery,
    setPage,
    setCategory,
    browseLocalVideo,
    fetchVideo,
    fetchVideosList,
    selectVideo,
    applyWallpaper,
    stopWallpaper,
    toggleFavorite,
    removeImportedVideo,
    addToQueue,
    removeFromQueue,
    clearQueue,
    setRotationConfig,
    setRestoreOnLaunch,
    setWindowBehavior,
    setWallpaperScale,
    setAutoPauseEnabled,
    setPaused,
    setVolumePercent,
    setVideoFilter,
    isFavorite,
    isQueued,
  };
}
