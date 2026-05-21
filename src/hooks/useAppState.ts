"use client";

import { useEffect, useState } from "react";
import { getCoreApi } from "@/utils/tauriApis";
import { VideoResult, PersistedState, WallpaperState, applyPersistedState } from "@/utils/wallpaperTypes";

export function useAppState() {
  const [state, setState] = useState<WallpaperState>({
    currentVideo: null,
    isPlaying: false,
    isLoading: false,
    isHydrating: true,
    error: null,
    errorHint: null,
    source: "unified",
    query: "all",
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
    playbackSpeed: 1.0,
    blurStrength: 0,
    theme: "master-system",
    wallhavenApiKey: "KJ47mwX8D3S61aafbxxv37Rgijm6u4Eq",
    disabledSources: [],
    searchResults: [],
    page: 1,
    category: "all",
    autostartEnabled: false,
  });

  useEffect(() => {
    let active = true;

    async function hydrate() {
      try {
        const { invoke } = await getCoreApi();
        const persisted = await invoke<PersistedState>("get_app_state");
        let autostart = false;
        try {
          const { isEnabled } = await import("@tauri-apps/plugin-autostart");
          autostart = await isEnabled();
        } catch (e) {
            console.warn("Autostart plugin not available", e);
        }

        if (!active) return;
        setState((current) => ({
          ...applyPersistedState(persisted, current),
          autostartEnabled: autostart,
          isHydrating: false,
        }));
      } catch {
        if (!active) return;
        setState((current) => ({ ...current, isHydrating: false }));
      }
    }

    hydrate();
    return () => { active = false; };
  }, []);

  return { state, setState };
}
