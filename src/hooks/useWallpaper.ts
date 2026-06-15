"use client";

import { useCallback, useEffect } from "react";
import { getCoreApi, getWindowApi, getDialogApi } from "@/utils/tauriApis";
import { VideoResult, PersistedState, applyPersistedState, WallpaperState, LibraryItem, DisplayMonitor } from "@/utils/wallpaperTypes";

export type { VideoResult, PersistedState, WallpaperState, LibraryItem, DisplayMonitor };

import { useAppState } from "./useAppState";
import { useWallpaperActions } from "./useWallpaperActions";
import { useQueueManager } from "./useQueueManager";
import { useLibraryActions } from "./useLibraryActions";

export function useWallpaper() {
  const { state, setState } = useAppState();
  const { 
    applyWallpaper, 
    fetchVideosList, 
    fetchVideo, 
    stopWallpaper, 
    setPlaybackSpeed, 
    setBlurStrength,
    setPaused,
    setKeepEffectsRunningOnPause,
    setWallpaperScale,
    setWallpaperFilter,
    fetchVideoTags,
    playNext,
    playPrevious
  } = useWallpaperActions(state, setState);
  const { addToQueue, removeFromQueue, clearQueue, importFolderToQueue, reorderQueue } = useQueueManager(state, setState);
  const { toggleFavorite, removeRecentVideo, removeImportedVideo } = useLibraryActions(state, setState);

  const setTheme = useCallback(async (theme: string) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_theme", { theme });
      setState((s) => applyPersistedState(persisted, s));
    } catch (e) { console.error("Theme failed", e); }
  }, [setState]);

  const setVolumePercent = useCallback(async (volumePercent: number) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_wallpaper_volume", { volumePercent });
      setState((s) => applyPersistedState(persisted, s));
    } catch (e) { console.error("Volume failed", e); }
  }, [setState]);

  const setWallhavenApiKey = useCallback(async (key: string) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_wallhaven_api_key", { key });
      setState((s) => applyPersistedState(persisted, s));
    } catch (e) { console.error("API Key failed", e); }
  }, [setState]);

  const setDisabledSources = useCallback(async (disabled: string[]) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_disabled_sources", { disabled });
      setState((s) => applyPersistedState(persisted, s));
    } catch (e) { console.error("Disabled sources failed", e); }
  }, [setState]);

  const setPinterestUrls = useCallback(async (urls: string[]) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_pinterest_urls", { urls });
      setState((s) => ({ ...applyPersistedState(persisted, s), page: 1 }));
    } catch (e) { console.error("Pinterest URLs failed", e); }
  }, [setState]);

  // Composition: Add any other missing simple setters here
  const browseLocalVideo = useCallback(async () => {
    try {
      const { open } = await getDialogApi();
      const selected = await open({ multiple: false, filters: [{ name: "Wallpapers", extensions: ["mp4", "webm", "jpg", "jpeg", "png", "webp", "html"] }] });
      if (typeof selected !== "string" || !selected) return;
      const { invoke } = await getCoreApi();
      const video = await invoke<VideoResult>("fetch_video", { source: "direct", query: selected, order: "trending" });
      const persisted = await invoke<PersistedState>("import_local_video", { video });
      setState((s) => ({ ...applyPersistedState(persisted, s), currentVideo: video }));
    } catch (e) { console.error("Browse failed", e); }
  }, [setState]);

  const browseFolderToQueue = useCallback(async () => {
    try {
      const { open } = await getDialogApi();
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected !== "string" || !selected) return;
      await importFolderToQueue(selected);
    } catch (e) { console.error("Browse folder failed", e); }
  }, [importFolderToQueue]);

  const toggleHideVideo = useCallback(async (videoId: string) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("toggle_hide_video", { videoId });
      setState((s) => applyPersistedState(persisted, s));
    } catch (e) { console.error("Toggle hide video failed", e); }
  }, [setState]);

  const fetchMonitors = useCallback(async (): Promise<DisplayMonitor[]> => {
    try {
      const { invoke } = await getCoreApi();
      return await invoke<DisplayMonitor[]>("get_monitors");
    } catch (e) {
      console.error("Failed to fetch monitors", e);
      return [];
    }
  }, []);

  const setRestoreOnLaunch = useCallback(async (enabled: boolean) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_restore_on_launch", { enabled });
      setState((s) => applyPersistedState(persisted, s));
    } catch (e) { console.error("setRestoreOnLaunch failed", e); }
  }, [setState]);

  const setAutoPauseEnabled = useCallback(async (enabled: boolean) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_auto_pause", { enabled });
      setState((s) => applyPersistedState(persisted, s));
    } catch (e) { console.error("setAutoPauseEnabled failed", e); }
  }, [setState]);

  const setWindowBehavior = useCallback(async (closeToTray: boolean, minimizeToTray: boolean) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_window_behavior", { closeToTray, minimizeToTray });
      setState((s) => applyPersistedState(persisted, s));
    } catch (e) { console.error("setWindowBehavior failed", e); }
  }, [setState]);

  const setAutostartEnabled = useCallback(async (enabled: boolean) => {
    try {
      const { enable, disable } = await import("@tauri-apps/plugin-autostart");
      if (enabled) await enable();
      else await disable();
      setState(s => ({ ...s, autostartEnabled: enabled }));
    } catch (e) { console.error("setAutostartEnabled failed", e); }
  }, [setState]);



  const isFavorite = useCallback((video: VideoResult) => {
    return state.favorites.some((f) => f.video.id === video.id || f.video.local_path === video.local_path);
  }, [state.favorites]);

  const isQueued = useCallback((video: VideoResult) => {
    return state.queue.some((q) => q.video.id === video.id || q.video.local_path === video.local_path);
  }, [state.queue]);

  return {
    ...state,
    applyWallpaper,
    fetchVideosList,
    fetchVideoTags,
    fetchVideo,
    stopWallpaper,
    setPlaybackSpeed,
    setBlurStrength,
    setPaused,
    setKeepEffectsRunningOnPause,
    setWallpaperScale,
    setWallpaperFilter,
    playNext,
    playPrevious,
    addToQueue,
    removeFromQueue,
    clearQueue,
    importFolderToQueue,
    reorderQueue,
    toggleFavorite,
    removeRecentVideo,
    removeImportedVideo,
    setTheme,
    setVolumePercent,
    setWallhavenApiKey,
    setDisabledSources,
    setPinterestUrls,
    toggleHideVideo,
    fetchMonitors,
    setRestoreOnLaunch,
    setAutoPauseEnabled,
    setWindowBehavior,
    setAutostartEnabled,
    browseLocalVideo,
    browseFolderToQueue,
    isFavorite,
    isQueued,
    // Add missing simple state setters as needed for the UI
    setSource: (source: string) => setState(s => ({ ...s, source, page: 1 })),
    setQuery: (query: string) => setState(s => ({ ...s, query, page: 1 })),
    setPage: (page: number) => setState(s => ({ ...s, page })),
    setResolutions: (resolutions: string | null) => setState(s => ({ ...s, resolutions, page: 1 })),
    setRatios: (ratios: string | null) => setState(s => ({ ...s, ratios, page: 1 })),
    setColors: (colors: string | null) => setState(s => ({ ...s, colors, page: 1 })),
    setCategoriesFilter: async (categoriesFilter: string) => {
      try {
        const { invoke } = await getCoreApi();
        const persisted = await invoke<PersistedState>("set_categories_filter", { categories: categoriesFilter });
        setState((s) => ({ ...applyPersistedState(persisted, s), page: 1 }));
      } catch (e) { console.error("Categories filter failed", e); }
    },
    setPurityFilter: async (purityFilter: string) => {
      try {
        const { invoke } = await getCoreApi();
        const persisted = await invoke<PersistedState>("set_purity_filter", { purity: purityFilter });
        setState((s) => ({ ...applyPersistedState(persisted, s), page: 1 }));
      } catch (e) { console.error("Purity filter failed", e); }
    },
    setSlideshowSource: async (slideshowSource: string) => {
      try {
        const { invoke } = await getCoreApi();
        const persisted = await invoke<PersistedState>("set_slideshow_source", { source: slideshowSource });
        setState((s) => applyPersistedState(persisted, s));
      } catch (e) { console.error("Slideshow source failed", e); }
    },
    setDiscoverProvider: async (provider: string) => {
      try {
        const { invoke } = await getCoreApi();
        const persisted = await invoke<PersistedState>("set_discover_provider", { provider });
        setState((s) => applyPersistedState(persisted, s));
      } catch (e) { console.error("Discover provider failed", e); }
    },
    setSelectedMonitor: (monitor: DisplayMonitor | null) => setState(s => ({ ...s, selectedMonitor: monitor })),
    setColorFilter: (colorFilter: string) => setState(s => {
      // Keep old colorFilter logic just in case it's used elsewhere, but we map to colors
      return { ...s, colorFilter, colors: colorFilter || null, page: 1 };
    }),
    setCategory: (category: string) => setState(s => {
      const q = category === "all" ? "" : category;
      return { ...s, category, query: q.trim(), page: 1 };
    }),
    selectVideo: (video: VideoResult) => setState(s => ({ ...s, currentVideo: video, previewDismissed: false })),
    dismissPreview: () => setState(s => ({ ...s, previewDismissed: true })),
  };
}
