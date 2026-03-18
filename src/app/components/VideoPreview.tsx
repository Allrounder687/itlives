"use client";

import { useEffect, useRef, useState } from "react";

import { VideoResult } from "@/hooks/useWallpaper";
import { convertFileSrc } from "@tauri-apps/api/core";

interface VideoPreviewProps {
  video: VideoResult;
  isPaused: boolean;
  volumePercent: number;
  filterPreset: string;
  isFavorite: boolean;
  isQueued: boolean;
  onApply: (start?: number, end?: number) => void;
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
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(video.duration || 0);
  const [totalDuration, setTotalDuration] = useState(video.duration || 0);
  const [activeThumb, setActiveThumb] = useState<"start" | "end">("start");

  const videoSrc = video.local_path
    ? convertFileSrc(video.local_path)
    : video.video_url;

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;

    const handleTimeUpdate = () => {
      // Avoid infinite 0 reset loop before duration loads
      if (endTime > 0 && element.currentTime >= endTime) {
        element.currentTime = startTime;
      }
    };

    element.addEventListener("timeupdate", handleTimeUpdate);
    return () => element.removeEventListener("timeupdate", handleTimeUpdate);
  }, [startTime, endTime]);

  // Immediate seek previews on slider drags
  useEffect(() => {
    const element = videoRef.current;
    if (element && startTime >= 0) {
      element.currentTime = startTime;
    }
  }, [startTime]);

  useEffect(() => {
    const element = videoRef.current;
    if (element && endTime > 0) {
      // seek slightly before endTime so they see the end frame context
      element.currentTime = Math.max(0, endTime - 0.2);
    }
  }, [endTime]);

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
          onLoadedMetadata={(e) => {
             const vid = e.target as HTMLVideoElement;
             if (vid.duration > 0) {
                 setTotalDuration(vid.duration);
                 if (endTime === 0) setEndTime(vid.duration);
             }
          }}
          style={{ filter: previewCssFilter(filterPreset) }}
        />
        <div className="preview-overlay">
          <span className="preview-chip">{video.source.toUpperCase()}</span>
          <span className="preview-chip">
            {video.duration > 0 ? `${video.duration.toFixed(1)}s` : "Looping"}
          </span>
          <span className="preview-chip">
            {video.width > 0 && video.height > 0 ? `${video.width}x${video.height}` : "Desktop media"}
          </span>
        </div>
        
        {/* Dual Range Slider for Trimming Previews */}
        {endTime > 0 && (
          <div className="yt-range-section" style={{ padding: "12px", borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", alignItems: "center" }}>
              <span className="eyebrow" style={{ fontSize: "10px" }}>Trim Range Control</span>
              <span style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 600 }}>
                {formatTime(startTime)} → {formatTime(endTime)} ({(endTime - startTime).toFixed(1)}s)
              </span>
            </div>

            <div className="yt-dual-slider">
              <div className="yt-slider-track">
                <div
                  className="yt-slider-fill"
                  style={{
                    left: `${(startTime / totalDuration) * 100}%`,
                    width: `${((endTime - startTime) / totalDuration) * 100}%`,
                  }}
                />
              </div>
              <input
                type="range"
                className="yt-range-input yt-range-start"
                style={{ zIndex: activeThumb === "start" ? 15 : 10 }}
                onMouseDown={() => setActiveThumb("start")}
                onTouchStart={() => setActiveThumb("start")}
                min={0}
                max={totalDuration}
                step={0.5}
                value={startTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (val < endTime - 1) setStartTime(val);
                }}
              />
              <input
                type="range"
                className="yt-range-input yt-range-end"
                style={{ zIndex: activeThumb === "end" ? 15 : 10 }}
                onMouseDown={() => setActiveThumb("end")}
                onTouchStart={() => setActiveThumb("end")}
                min={0}
                max={totalDuration}
                step={0.5}
                value={endTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (val > startTime + 1) setEndTime(val);
                }}
              />
            </div>
          </div>
        )}
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
          <button className="action-btn action-btn--primary" onClick={() => onApply(startTime, endTime)}>
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
