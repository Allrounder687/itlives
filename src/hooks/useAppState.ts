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
    selectedMonitor: null,
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
    pinterestUrls: [
      "https://www.pinterest.com/search/pins/?q=fantasy%20wallpaper&rs=ac&len=12&source_id=ac_ysOA3Mkj&eq=fantasy%20wall&etslf=5698"
    ],
    searchResults: [],
    page: 1,
    category: "all",
    colorFilter: "",
    autostartEnabled: false,
    hasMore: true,
    duplicateNotice: null,
    previewDismissed: true,
    hiddenVideos: [],

    resolutions: null,
    ratios: null,
    colors: null,
    categoriesFilter: "111",
    purityFilter: "100",
    keepEffectsRunningOnPause: false,
    slideshowSource: "local",
    discoverProvider: "unified",
    lightweightMode: false,
    perfFullscreen: "pause",
    perfFocused: "play",
    perfBattery: "pause",
    perfBatterySaver: "pause",
    perfRemoteDesktop: "pause",
    perfRestartLockScreen: false,
    perfDisplayPauseRule: "Per screen",
    perfPauseAlgorithm: "Grid",
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

    const unlistens: (() => void)[] = [];
    import("@tauri-apps/api/event").then(({ listen }) => {
      if (!active) return;
      listen("wallpaper-paused", (e: any) => {
        if (!active) return;
        setState((current) => ({ ...current, paused: e.payload.paused }));
      }).then((u) => unlistens.push(u));

      listen("state-updated", (e: any) => {
        if (!active) return;
        const persisted = e.payload as PersistedState;
        setState((current) => applyPersistedState(persisted, current));
      }).then((u) => unlistens.push(u));

      listen("wallpaper-loading", (e: any) => {
        if (!active) return;
        setState((current) => ({ ...current, isLoading: e.payload as boolean }));
      }).then((u) => unlistens.push(u));
    });

    return () => { 
      active = false; 
      unlistens.forEach((u) => u());
    };
  }, []);

  return { state, setState };
}
