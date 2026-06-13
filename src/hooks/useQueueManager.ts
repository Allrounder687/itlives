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

  const clearQueue = useCallback(async () => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("clear_queue");
      setState((s) => applyPersistedState(persisted, s));
    } catch (error: any) {
      console.error("Queue clear failed", error);
    }
  }, [setState]);

  const importFolderToQueue = useCallback(async (folderPath: string) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("import_folder_to_queue", { folderPath });
      setState((s) => applyPersistedState(persisted, s));
    } catch (error: any) {
      console.error("Import folder failed", error);
    }
  }, [setState]);

  const reorderQueue = useCallback(async (fromIndex: number, toIndex: number) => {
    try {
      const { invoke } = await getCoreApi();
      const persisted = await invoke<PersistedState>("reorder_queue", { fromIndex, toIndex });
      setState((s) => applyPersistedState(persisted, s));
    } catch (error: any) {
      console.error("Queue reorder failed", error);
    }
  }, [setState]);



  return { addToQueue, removeFromQueue, clearQueue, importFolderToQueue, reorderQueue };
}
