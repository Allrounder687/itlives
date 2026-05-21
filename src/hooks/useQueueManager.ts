"use client";

import { useCallback, useEffect, useRef } from "react";
import { getCoreApi } from "@/utils/tauriApis";
import { VideoResult, PersistedState, WallpaperState, applyPersistedState } from "@/utils/wallpaperTypes";

export function useQueueManager(state: WallpaperState, setState: React.Dispatch<React.SetStateAction<WallpaperState>>) {
  const rotationBusyRef = useRef(false);

  const addToQueue = useCallback(async (video: VideoResult) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("add_to_queue", { video });
      setState((s) => applyPersistedState(persisted, s));
    } catch (error: any) {
      console.error("Queue add failed", error);
    }
  }, [setState]);

  const removeFromQueue = useCallback(async (video: VideoResult) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("remove_from_queue", { video });
      setState((s) => applyPersistedState(persisted, s));
    } catch (error: any) {
      console.error("Queue remove failed", error);
    }
  }, [setState]);

  useEffect(() => {
    if (state.isHydrating || !state.rotationEnabled || state.queue.length === 0) return;

    const timer = window.setInterval(async () => {
      if (rotationBusyRef.current) return;
      rotationBusyRef.current = true;
      try {
        const { invoke } = await getCoreApi();
        const advanced = await invoke<{ video: VideoResult; state: PersistedState }>("advance_rotation", {
          scalePercent: state.wallpaperScalePercent,
        });
        setState((s) => ({
          ...applyPersistedState(advanced.state, s),
          currentVideo: advanced.video,
          paused: false,
        }));
      } catch (error) {
        console.error("Rotation failure", error);
      } finally {
        rotationBusyRef.current = false;
      }
    }, Math.max(30, state.rotationIntervalSeconds) * 1000);

    return () => window.clearInterval(timer);
  }, [state.isHydrating, state.queue.length, state.rotationEnabled, state.rotationIntervalSeconds, state.wallpaperScalePercent, setState]);

  return { addToQueue, removeFromQueue };
}
