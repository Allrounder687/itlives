"use client";

import { useCallback, useState } from "react";

let coreApiPromise: Promise<typeof import("@tauri-apps/api/core")> | null = null;

function getCoreApi() {
  if (!coreApiPromise) {
    coreApiPromise = import("@tauri-apps/api/core");
  }
  return coreApiPromise;
}

export interface YtMetaResult {
  id: string;
  video_url: string;
  thumbnail_url: string;
  local_path: string;
  duration: number;
  width: number;
  height: number;
  source: string;
  start_time: number | null;
  end_time: number | null;
}

export interface YouTubeState {
  url: string;
  meta: YtMetaResult | null;
  startTime: number;
  endTime: number;
  maxHeight: number;
  isLoadingMeta: boolean;
  isDownloading: boolean;
  downloadProgress: number; // 0 to 100
  error: string | null;
  downloadedVideo: YtMetaResult | null;
}

export function useYouTube() {
  const [state, setState] = useState<YouTubeState>({
    url: "",
    meta: null,
    startTime: 0,
    endTime: 0,
    maxHeight: 1080,
    isLoadingMeta: false,
    isDownloading: false,
    downloadProgress: 0,
    error: null,
    downloadedVideo: null,
  });

  const setUrl = useCallback((url: string) => {
    setState((s) => ({ ...s, url, error: null, meta: null }));
  }, []);

  const setStartTime = useCallback((startTime: number) => {
    setState((s) => ({ ...s, startTime }));
  }, []);

  const setEndTime = useCallback((endTime: number) => {
    setState((s) => ({ ...s, endTime }));
  }, []);

  const setMaxHeight = useCallback((maxHeight: number) => {
    setState((s) => ({ ...s, maxHeight }));
  }, []);

  const fetchMeta = useCallback(async () => {
    if (!state.url.trim()) {
      setState((s) => ({ ...s, error: "Paste a YouTube URL first." }));
      return;
    }

    setState((s) => ({ ...s, isLoadingMeta: true, error: null, meta: null, downloadedVideo: null }));
    try {
      const { invoke } = await getCoreApi();
      const meta = await invoke<YtMetaResult>("fetch_youtube_meta", {
        url: state.url.trim(),
      });
      setState((s) => ({
        ...s,
        meta,
        startTime: 0,
        endTime: Math.min(meta.duration, 30),
        isLoadingMeta: false,
      }));
    } catch (error: unknown) {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : "Failed to fetch video info";
      setState((s) => ({ ...s, isLoadingMeta: false, error: message }));
    }
  }, [state.url]);

  const downloadClip = useCallback(async () => {
    if (!state.url.trim()) {
      setState((s) => ({ ...s, error: "No URL provided." }));
      return null;
    }

    const start = state.startTime;
    const end = state.endTime;
    if (end <= start) {
      setState((s) => ({ ...s, error: "End time must be after start time." }));
      return null;
    }

    setState((s) => ({ ...s, isDownloading: true, downloadProgress: 0, error: null }));

    try {
      // Lazy load window listener
      const { invoke } = await getCoreApi();
      const { listen } = await import("@tauri-apps/api/event");

      const unlisten = await listen<number>("yt-progress", (event) => {
        setState((s) => ({ ...s, downloadProgress: event.payload }));
      });

      const result = await invoke<YtMetaResult>("download_youtube_clip", {
        url: state.url.trim(),
        startTime: start,
        endTime: end,
        maxHeight: state.maxHeight,
      });

      unlisten();

      setState((s) => ({
        ...s,
        isDownloading: false,
        downloadProgress: 100,
        downloadedVideo: result,
      }));
      return result;
    } catch (error: unknown) {
      const message = typeof error === "string" ? error : error instanceof Error ? error.message : "Download failed";
      setState((s) => ({ ...s, isDownloading: false, error: message }));
      return null;
    }
  }, [state.url, state.startTime, state.endTime, state.maxHeight]);

  const setMeta = useCallback((meta: YtMetaResult | null) => {
    setState((s) => ({
      ...s,
      meta,
      startTime: 0,
      endTime: meta ? Math.min(meta.duration, 30) : 0,
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((s) => ({ ...s, error }));
  }, []);

  return {
    ...state,
    setUrl,
    setStartTime,
    setEndTime,
    setMaxHeight,
    fetchMeta,
    downloadClip,
    setError,
    setMeta,
  };
}
