"use client";

import { useCallback } from "react";
import { getCoreApi, getDialogApi } from "@/utils/tauriApis";
import { VideoResult, PersistedState, WallpaperState, applyPersistedState } from "@/utils/wallpaperTypes";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export function useWallpaperActions(state: WallpaperState, setState: React.Dispatch<React.SetStateAction<WallpaperState>>) {
  
  const applyWallpaper = useCallback(async (video: VideoResult, startTime?: number, endTime?: number) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("apply_wallpaper", {
        video,
        scalePercent: state.wallpaperScalePercent,
        startTime: startTime ?? video.start_time ?? null,
        endTime: endTime ?? video.end_time ?? null,
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
    } catch (error: unknown) {
      setState((s) => ({ ...s, isLoading: false, error: String(error) }));
    }
  }, [state.wallpaperScalePercent, state.selectedMonitor?.name, setState]);

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
      let finalQuery = state.query;


      const { invoke } = await getCoreApi();
      const builtinSources = ["wallhaven", "motionbgs", "pinterest", "youtube", "alphacoders", "wpwaves"];
      let results: VideoResult[] = [];

      if (!builtinSources.includes(state.source)) {
        // It's a custom addon source!
        try {
          const script = await invoke<string>("get_addon_script", { id: `scraper-${state.source}` });
          if (script) {
            let fn;
            try {
              const module = { exports: {} as any };
              fn = new Function("module", "exports", "fetch", script + "\nreturn module.exports;");
            } catch (err: any) {
              throw new Error(`SyntaxError during parsing: ${err.message}. Script start: ${script.substring(0, 100)}`);
            }
            const module = { exports: {} as any };
            
            // Bypass CORS by injecting Tauri's native HTTP fetch
            const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
            const addon = fn(module, module.exports, tauriFetch);
            
            if (addon && typeof addon.fetchWallpapers === "function") {
              const filters = {
                search: finalQuery,
                resolutions: state.resolutions,
                ratios: state.ratios,
                colors: state.colors,
                categories: state.categoriesFilter,
                purity: state.purityFilter,
                credentials: state.addonCredentials,
              };
              results = await addon.fetchWallpapers(filters, state.page);
            } else {
              throw new Error("Addon does not export fetchWallpapers function");
            }
          } else {
            throw new Error("Addon script not found");
          }
        } catch (e) {
          console.error(`Failed to fetch from custom addon ${state.source}:`, e);
          throw e;
        }
      } else {
        results = await invoke<VideoResult[]>("fetch_videos_list", {
          source: state.source,
          query: finalQuery,
          order: "random",
          page: state.page,
          resolutions: state.resolutions,
          ratios: state.ratios,
          colors: state.colors,
          categories: state.categoriesFilter,
          purity: state.purityFilter,
        });
      }
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
  }, [state.source, state.query, state.page, state.resolutions, state.ratios, state.colors, state.categoriesFilter, state.purityFilter, setState]);

  const fetchVideo = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const { invoke } = await getCoreApi();
      const builtinSources = ["wallhaven", "motionbgs", "pinterest", "youtube", "alphacoders", "wpwaves"];
      let video: VideoResult | null = null;

      if (!builtinSources.includes(state.source)) {
        try {
          const script = await invoke<string>("get_addon_script", { id: `scraper-${state.source}` });
          if (script) {
            let fn;
            try {
              const module = { exports: {} as any };
              fn = new Function("module", "exports", "fetch", script + "\nreturn module.exports;");
            } catch (err: any) {
              throw new Error(`SyntaxError during parsing: ${err.message}. Script start: ${script.substring(0, 100)}`);
            }
            const module = { exports: {} as any };
            const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
            const addon = fn(module, module.exports, tauriFetch);
            
            if (addon && typeof addon.fetchWallpapers === "function") {
              const found = state.searchResults.find(v => v.id === id);
              if (found) {
                video = found;
              } else {
                // Fallback for recents/favorites: if we can't find it in the current search results,
                // we'll just reconstruct a basic VideoResult since addons don't have a fetch_video endpoint yet.
                video = {
                  id,
                  source: state.source,
                  title: "Addon Media",
                  thumbnail_url: "",
                  video_url: `https://backend.deviantart.com/rss.xml?q=${id}`, // Dummy
                  local_path: "",
                  duration: 0,
                  width: 1920,
                  height: 1080
                };
              }
            } else {
              throw new Error("Addon does not export fetchWallpapers function");
            }
          } else {
            throw new Error("Addon script not found");
          }
        } catch (e) {
          console.error(`Failed to fetch from custom addon ${state.source}:`, e);
          throw e;
        }
      } else {
        video = await invoke<VideoResult>("fetch_video", {
          source: state.source,
          query: state.query,
          order: "trending",
          resolutions: state.resolutions,
          ratios: state.ratios,
          colors: state.colors,
          categories: state.categoriesFilter,
          purity: state.purityFilter,
        });
      }

      setState((s) => ({ ...s, isLoading: false }));
      return video;
    } catch (error: any) {
      setState((s) => ({ ...s, isLoading: false, error: error.toString() }));
      return null;
    }
  }, [state.source, state.query, state.resolutions, state.ratios, state.colors, state.categoriesFilter, state.purityFilter, setState]);

  const stopWallpaper = useCallback(async () => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("stop_wallpaper");
      setState((s) => ({ ...applyPersistedState(persisted, s), isPlaying: false }));
    } catch (error: unknown) {
      setState((s) => ({ ...s, error: String(error) }));
    }
  }, [setState]);

  const setPlaybackSpeed = useCallback(async (speed: number) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_wallpaper_speed", { speed });
      setState((s) => applyPersistedState(persisted, s));
    } catch (error: unknown) {
      setState((s) => ({ ...s, error: String(error) }));
    }
  }, [setState]);

  const setBlurStrength = useCallback(async (blur: number) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_wallpaper_blur", { blur });
      setState((s) => applyPersistedState(persisted, s));
    } catch (error: unknown) {
      setState((s) => ({ ...s, error: String(error) }));
    }
  }, [setState]);

  const setPaused = useCallback(async (paused: boolean) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_wallpaper_paused", { paused });
      setState((s) => applyPersistedState(persisted, s));
    } catch (error: unknown) {
      setState((s) => ({ ...s, error: String(error) }));
    }
  }, [setState]);

  const setKeepEffectsRunningOnPause = useCallback(async (enabled: boolean) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_keep_effects_running_on_pause", { enabled });
      setState((s) => applyPersistedState(persisted, s));
    } catch (error: unknown) {
      setState((s) => ({ ...s, error: String(error) }));
    }
  }, [setState]);

  const setWallpaperScale = useCallback(async (scalePercent: number) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_wallpaper_scale", { scalePercent });
      setState((s) => applyPersistedState(persisted, s));
    } catch (error: unknown) {
      setState((s) => ({ ...s, error: String(error) }));
    }
  }, [setState]);

  const setWallpaperFilter = useCallback(async (videoFilter: string) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("set_wallpaper_filter", { videoFilter });
      setState((s) => applyPersistedState(persisted, s));
    } catch (error: unknown) {
      setState((s) => ({ ...s, error: String(error) }));
    }
  }, [setState]);

  const playNext = useCallback(async () => {
    try {
      setState((s) => ({ ...s, isLoading: true }));
      const { invoke } = await getCoreApi();
      await invoke("next_wallpaper");
    } catch (error) {
      console.error("Failed to play next", error);
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, [setState]);

  const playPrevious = useCallback(async () => {
    try {
      setState((s) => ({ ...s, isLoading: true }));
      const { invoke } = await getCoreApi();
      await invoke("prev_wallpaper");
    } catch (error) {
      console.error("Failed to play previous", error);
      setState((s) => ({ ...s, isLoading: false }));
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
    setKeepEffectsRunningOnPause,
    setWallpaperScale,
    setWallpaperFilter,
    fetchVideoTags,
    playNext,
    playPrevious
  };
}
