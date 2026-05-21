"use client";

import { useCallback, useEffect } from "react";
import { getCoreApi, getWindowApi, getDialogApi } from "@/utils/tauriApis";
import { VideoResult, PersistedState, applyPersistedState, WallpaperState, LibraryItem } from "@/utils/wallpaperTypes";

export type { VideoResult, PersistedState, WallpaperState, LibraryItem };

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
    setWallpaperScale,
    setWallpaperFilter
  } = useWallpaperActions(state, setState);
  const { addToQueue, removeFromQueue } = useQueueManager(state, setState);
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
      const selected = await open({ multiple: false, filters: [{ name: "Wallpapers", extensions: ["mp4", "webm", "jpg", "jpeg", "png", "webp"] }] });
      if (typeof selected !== "string" || !selected) return;
      const { invoke } = await getCoreApi();
      const video = await invoke<VideoResult>("fetch_video", { source: "direct", query: selected, order: "trending" });
      const persisted = await invoke<PersistedState>("import_local_video", { video });
      setState((s) => ({ ...applyPersistedState(persisted, s), currentVideo: video }));
    } catch (e) { console.error("Browse failed", e); }
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
    fetchVideo,
    stopWallpaper,
    setPlaybackSpeed,
    setBlurStrength,
    setPaused,
    setWallpaperScale,
    setWallpaperFilter,
    addToQueue,
    removeFromQueue,
    toggleFavorite,
    removeRecentVideo,
    removeImportedVideo,
    setTheme,
    setVolumePercent,
    setWallhavenApiKey,
    setDisabledSources,
    setPinterestUrls,
    browseLocalVideo,
    isFavorite,
    isQueued,
    // Add missing simple state setters as needed for the UI
    setSource: (source: string) => setState(s => ({ ...s, source, page: 1 })),
    setQuery: (query: string) => setState(s => ({ ...s, query, page: 1 })),
    setPage: (page: number) => setState(s => ({ ...s, page })),
    setCategory: (category: string) => setState(s => ({ ...s, category, query: category, page: 1 })),
    selectVideo: (video: VideoResult) => setState(s => ({ ...s, currentVideo: video, previewDismissed: false })),
    dismissPreview: () => setState(s => ({ ...s, previewDismissed: true })),
  };
}
