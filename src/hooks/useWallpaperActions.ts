"use client";

import { useCallback } from "react";
import { getCoreApi, getDialogApi } from "@/utils/tauriApis";
import { VideoResult, PersistedState, WallpaperState, applyPersistedState } from "@/utils/wallpaperTypes";

export function useWallpaperActions(state: WallpaperState, setState: React.Dispatch<React.SetStateAction<WallpaperState>>) {
  
  const applyWallpaper = useCallback(async (video: VideoResult, startTime?: number, endTime?: number) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("apply_wallpaper", {
        video,
        scalePercent: state.wallpaperScalePercent,
        startTime: startTime !== undefined ? startTime : null,
        endTime: endTime !== undefined ? endTime : null,
        monitor: state.selectedMonitor?.name || null,
      });
      setState((s) => ({
        ...applyPersistedState(persisted, s),
        currentVideo: video,
        isPlaying: true,
        paused: false,
        isLoading: false,
        error: null,
        errorHint: null,
      }));
    } catch (error: any) {
      setState((s) => ({ ...s, isLoading: false, error: error.toString() }));
    }
  }, [state.wallpaperScalePercent, setState]);

  const fetchVideoTags = useCallback(async (source: string, id: string): Promise<string[]> => {
    if (source === "redgifs") return []; // Legacy fallback to prevent backend errors for old saved wallpapers
    try {
      const { invoke } = await getCoreApi();
      return await invoke<string[]>("fetch_video_tags", { source, id });
    } catch (error) {
      console.warn("[itLives] Failed to fetch tags for legacy or invalid source:", error);
      return [];
    }
  }, []);

  const fetchVideosList = useCallback(async () => {
    if (state.source === "direct") return [];
    setState((s) => ({ ...s, isLoading: true, error: null, duplicateNotice: null }));
    try {
      const { invoke } = await getCoreApi();
      const results = await invoke<VideoResult[]>("fetch_videos_list", {
        source: state.source,
        query: state.query,
        order: "trending",
        page: state.page,
        resolutions: state.resolutions,
        ratios: state.ratios,
        colors: state.colors,
      });
      setState((s) => {
        // If this is page 1, we start clean and don't count existing results as duplicates
        const existingKeys = s.page === 1 ? new Set<string>() : new Set(s.searchResults.map(item => `${item.source}:${item.id}`));
        const duplicates: string[] = [];
        const uniqueNewResults = results.filter(item => {
          const key = `${item.source}:${item.id}`;
          if (existingKeys.has(key)) {
            duplicates.push(item.id);
            return false;
          }
          return true;
        });

        if (duplicates.length > 0) {
          console.warn(`[itLives] Prevented ${duplicates.length} duplicate wallpapers from repeating:`, duplicates);
        }

        const combinedResults = s.page === 1 ? results : [...s.searchResults, ...uniqueNewResults];
        
        // Final absolute deduplication pass
        const seen = new Set<string>();
        const deduplicated = combinedResults.filter(item => {
          const key = `${item.source}:${item.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        const hasMore = results.length > 0 && uniqueNewResults.length > 0;
        return {
          ...s,
          searchResults: deduplicated,
          isLoading: false,
          hasMore,
          duplicateNotice: duplicates.length > 0 ? `Prevented ${duplicates.length} duplicate wallpapers from repeating.` : null
        };
      });
      return results;
    } catch (error: any) {
      setState((s) => ({ ...s, isLoading: false, error: error.toString() }));
      return [];
    }
  }, [state.source, state.query, state.page, state.resolutions, state.ratios, state.colors, setState]);

  const fetchVideo = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const { invoke } = await getCoreApi();
      const video = await invoke<VideoResult>("fetch_video", {
        source: state.source,
        query: state.query,
        order: "trending",
        resolutions: state.resolutions,
        ratios: state.ratios,
        colors: state.colors,
      });
      setState((s) => ({ ...s, isLoading: false }));
      return video;
    } catch (error: any) {
      setState((s) => ({ ...s, isLoading: false, error: error.toString() }));
      return null;
    }
  }, [state.source, state.query, state.resolutions, state.ratios, state.colors, setState]);

  const stopWallpaper = useCallback(async () => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("stop_wallpaper");
      setState((s) => ({ ...applyPersistedState(persisted, s), isPlaying: false }));
    } catch (error: any) {
      setState((s) => ({ ...s, error: error.toString() }));
    }
  }, [setState]);

  const setPlaybackSpeed = useCallback(async (speed: number) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_wallpaper_speed", { speed });
      setState((s) => applyPersistedState(persisted, s));
    } catch (error: any) {
      setState((s) => ({ ...s, error: error.toString() }));
    }
  }, [setState]);

  const setBlurStrength = useCallback(async (blur: number) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_wallpaper_blur", { blur });
      setState((s) => applyPersistedState(persisted, s));
    } catch (error: any) {
      setState((s) => ({ ...s, error: error.toString() }));
    }
  }, [setState]);

  const setPaused = useCallback(async (paused: boolean) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_wallpaper_paused", { paused });
      setState((s) => applyPersistedState(persisted, s));
    } catch (error: any) {
      setState((s) => ({ ...s, error: error.toString() }));
    }
  }, [setState]);

  const setWallpaperScale = useCallback(async (scalePercent: number) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_wallpaper_scale", { scalePercent });
      setState((s) => applyPersistedState(persisted, s));
    } catch (error: any) {
      setState((s) => ({ ...s, error: error.toString() }));
    }
  }, [setState]);

  const setWallpaperFilter = useCallback(async (videoFilter: string) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_wallpaper_filter", { videoFilter });
      setState((s) => applyPersistedState(persisted, s));
    } catch (error: any) {
      setState((s) => ({ ...s, error: error.toString() }));
    }
  }, [setState]);

  return { 
    applyWallpaper, 
    fetchVideosList, 
    fetchVideo, 
    stopWallpaper, 
    setPlaybackSpeed, 
    setBlurStrength,
    setPaused,
    setWallpaperScale,
    setWallpaperFilter,
    fetchVideoTags
  };
}
