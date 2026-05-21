"use client";

import { useCallback } from "react";
import { getCoreApi, getDialogApi } from "@/utils/tauriApis";
import { VideoResult, PersistedState, WallpaperState, applyPersistedState } from "@/utils/wallpaperTypes";

export function useWallpaperActions(state: WallpaperState, setState: React.Dispatch<React.SetStateAction<WallpaperState>>) {
  
  const applyWallpaper = useCallback(async (video: VideoResult, startTime?: number, endTime?: number) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("apply_wallpaper", {
        video,
        scalePercent: state.wallpaperScalePercent,
        startTime: startTime !== undefined ? startTime : null,
        endTime: endTime !== undefined ? endTime : null,
      });
      setState((s) => ({
        ...applyPersistedState(persisted, s),
        currentVideo: video,
        isPlaying: true,
        paused: false,
        error: null,
        errorHint: null,
      }));
    } catch (error: any) {
      setState((s) => ({ ...s, error: error.toString() }));
    }
  }, [state.wallpaperScalePercent, setState]);

  const fetchVideosList = useCallback(async () => {
    if (state.source === "direct") return [];
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const { invoke } = await getCoreApi();
      const results = await invoke<VideoResult[]>("fetch_videos_list", {
        source: state.source,
        query: state.query,
        order: "trending",
        page: state.page,
      });
      setState((s) => ({ ...s, searchResults: results, isLoading: false }));
      return results;
    } catch (error: any) {
      setState((s) => ({ ...s, isLoading: false, error: error.toString() }));
      return [];
    }
  }, [state.source, state.query, state.page, setState]);

  const fetchVideo = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const { invoke } = await getCoreApi();
      const video = await invoke<VideoResult>("fetch_video", {
        source: state.source,
        query: state.query,
        order: "trending",
      });
      setState((s) => ({ ...s, isLoading: false }));
      return video;
    } catch (error: any) {
      setState((s) => ({ ...s, isLoading: false, error: error.toString() }));
      return null;
    }
  }, [state.source, state.query, setState]);

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
    setWallpaperFilter
  };
}
