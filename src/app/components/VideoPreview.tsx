"use client";

import { useEffect, useRef } from "react";

import { VideoResult } from "@/hooks/useWallpaper";
import { convertFileSrc } from "@tauri-apps/api/core";

interface VideoPreviewProps {
  video: VideoResult;
  isPaused: boolean;
  volumePercent: number;
  filterPreset: string;
  isFavorite: boolean;
  isQueued: boolean;
  onApply: () => void;
  onTogglePause: () => void;
  onToggleFavorite: () => void;
  onToggleQueue: () => void;
}

export function VideoPreview({
  video,
  isPaused,
  volumePercent,
  filterPreset,
  isFavorite,
  isQueued,
  onApply,
  onTogglePause,
  onToggleFavorite,
  onToggleQueue,
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const videoSrc = video.local_path
    ? convertFileSrc(video.local_path)
    : video.video_url;

  useEffect(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }

    element.volume = Math.min(Math.max(volumePercent, 0), 100) / 100;

    if (isPaused) {
      void element.pause();
    } else {
      void element.play().catch(() => undefined);
    }
  }, [isPaused, volumePercent, videoSrc]);

  const handleError = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const target = event.target as HTMLVideoElement;
    if (target.src !== video.video_url && video.video_url) {
      target.src = video.video_url;
    }
  };

  return (
    <article className="preview-surface">
      <div className="preview-stage">
        <video
          ref={videoRef}
          className="preview-video"
          src={videoSrc}
          preload="metadata"
          autoPlay
          loop
          muted
          playsInline
          controls
          style={{ filter: previewCssFilter(filterPreset) }}
        />
        <div className="preview-overlay">
          <span className="preview-chip">{video.source.toUpperCase()}</span>
          <span className="preview-chip" style={{ wordBreak: "break-all", maxWidth: "200px" }}>SRC: {videoSrc}</span>
          <span className="preview-chip">
            {video.duration > 0 ? `${video.duration.toFixed(1)}s` : "Looping"}
          </span>
          <span className="preview-chip">
            {video.width > 0 && video.height > 0 ? `${video.width}x${video.height}` : "Desktop media"}
          </span>
        </div>
      </div>

      <div className="preview-footer">
        <div className="preview-copy">
          <span className="eyebrow">Preview Loaded</span>
          <h3>{video.id}</h3>
          <p>{video.local_path}</p>
        </div>

        <div className="preview-actions">
          <button className="action-btn action-btn--secondary" onClick={onTogglePause}>
            {isPaused ? "Resume" : "Pause"}
          </button>
          <button className="action-btn action-btn--secondary" onClick={onToggleFavorite}>
            {isFavorite ? "Unfavorite" : "Save Favorite"}
          </button>
          <button className="action-btn action-btn--secondary" onClick={onToggleQueue}>
            {isQueued ? "Remove From Queue" : "Add To Queue"}
          </button>
          <button className="action-btn action-btn--primary" onClick={onApply}>
            Apply To Desktop
          </button>
        </div>
      </div>
    </article>
  );
}

function previewCssFilter(filterPreset: string) {
  switch (filterPreset) {
    case "grayscale":
      return "grayscale(1)";
    case "vivid":
      return "contrast(1.12) saturate(1.35)";
    case "soft":
      return "brightness(1.04) contrast(0.94) saturate(0.88)";
    case "noir":
      return "grayscale(1) contrast(1.15) brightness(0.96)";
    case "retro":
      return "sepia(0.35) saturate(1.15) hue-rotate(-8deg) contrast(1.05)";
    default:
      return "none";
  }
}
