"use client";

import { useCallback } from "react";
import { getCoreApi } from "@/utils/tauriApis";
import { VideoResult, PersistedState, WallpaperState, applyPersistedState } from "@/utils/wallpaperTypes";

export function useLibraryActions(state: WallpaperState, setState: React.Dispatch<React.SetStateAction<WallpaperState>>) {
  
  const toggleFavorite = useCallback(async (video: VideoResult) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("toggle_favorite", { video });
      setState((s) => applyPersistedState(persisted, s));
    } catch (error: any) {
      console.error("Favorite toggle failed", error);
    }
  }, [setState]);

  const removeRecentVideo = useCallback(async (video: VideoResult) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("remove_recent_video", { video });
      setState((s) => applyPersistedState(persisted, s));
    } catch (error: any) {
      console.error("Remove recent failed", error);
    }
  }, [setState]);

  const removeImportedVideo = useCallback(async (video: VideoResult) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("remove_imported_video", { video });
      setState((s) => applyPersistedState(persisted, s));
    } catch (error: any) {
      console.error("Remove import failed", error);
    }
  }, [setState]);

  return { toggleFavorite, removeRecentVideo, removeImportedVideo };
}
