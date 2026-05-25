"use client";

import { useEffect, useRef, useState } from "react";

import { VideoResult } from "@/hooks/useWallpaper";
import { isStaticWallpaper } from "@/utils/wallpaperTypes";
import { convertFileSrc } from "@tauri-apps/api/core";
import { EffectLayer } from "./CanvasEffectRenderer";
import { WebGLEffectRenderer } from "./WebGLEffectRenderer";

interface VideoPreviewProps {
  video: VideoResult;
  volumePercent: number;
  filterPreset: string;
  isFavorite: boolean;
  isQueued: boolean;
  playbackSpeed?: number;
  blurStrength?: number;
  onApply: (start?: number, end?: number) => void;
  onToggleFavorite: () => void;
  onToggleQueue: () => void;
  onSetSpeed?: (s: number) => void;
  onSetBlur?: (b: number) => void;
  isLoading?: boolean;
  isHidden?: boolean;
  onToggleHide?: () => void;
  onEditEffects?: () => void;
}

export function VideoPreview({
  video,
  volumePercent,
  filterPreset,
  isFavorite,
  isQueued,
  playbackSpeed = 1.0,
  blurStrength = 0,
  onApply,
  onToggleFavorite,
  onToggleQueue,
  onSetSpeed,
  onSetBlur,
  isLoading = false,
  isHidden = false,
  onToggleHide,
  onEditEffects,
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(video.duration || 0);
  const [totalDuration, setTotalDuration] = useState(video.duration || 0);
  const [activeThumb, setActiveThumb] = useState<"start" | "end">("start");
  const [localPaused, setLocalPaused] = useState(false);
  const [effects, setEffects] = useState<EffectLayer[]>([]);

  useEffect(() => {
    let isMounted = true;
    setEffects([]);

    const fetchProfileEffects = async () => {
      if (!video.id) return;
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const configJson = await invoke<string>("load_profile", { name: video.id });
        if (!isMounted) return;
        const config = JSON.parse(configJson);
        if (config.layers) {
          setEffects(config.layers);
        }
      } catch (err) {
        console.log("No profile effects loaded for:", video.id);
      }
    };

    void fetchProfileEffects();
    return () => {
      isMounted = false;
    };
  }, [video.id]);

  const isStaticImage = isStaticWallpaper(video);

  const isHtml = video.local_path?.toLowerCase().endsWith(".html") || video.video_url?.toLowerCase().endsWith(".html");

  const isLocalFile = video.local_path && !video.local_path.startsWith("http");
  let videoSrc = isLocalFile
    ? convertFileSrc(video.local_path)
    : video.video_url;

  if (!isLocalFile && video.source === "motionbgs" && videoSrc?.includes("3840x2160")) {
    videoSrc = videoSrc.replace("3840x2160", "1920x1080");
  }

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

  const isDraggingThumbRef = useRef(false);

  // Immediate seek previews on slider drags
  useEffect(() => {
    const element = videoRef.current;
    if (element && startTime >= 0 && isDraggingThumbRef.current && activeThumb === "start") {
      element.currentTime = startTime;
    }
  }, [startTime, activeThumb]);

  useEffect(() => {
    const element = videoRef.current;
    if (element && endTime > 0 && isDraggingThumbRef.current && activeThumb === "end") {
      // seek slightly before endTime so they see the end frame context
      element.currentTime = Math.max(0, endTime - 0.2);
    }
  }, [endTime, activeThumb]);

  useEffect(() => {
    const handleMouseUp = () => { isDraggingThumbRef.current = false; };
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchend", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }

    element.volume = Math.min(Math.max(volumePercent, 0), 100) / 100;

    if (localPaused) {
      void element.pause();
    } else {
      void element.play().catch(() => undefined);
    }

    element.playbackRate = playbackSpeed;
  }, [localPaused, volumePercent, videoSrc, playbackSpeed]);

  const previewFilter = previewCssFilter(filterPreset, blurStrength);

  const handleError = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const target = event.target as HTMLVideoElement;
    if (target.src !== video.video_url && video.video_url) {
      target.src = video.video_url;
    }
  };

  return (
    <article className="preview-surface">
      <div className="preview-stage">
        {isStaticImage ? (
          <img
            className="preview-video"
            src={videoSrc}
            alt={video.id}
            style={{ filter: previewFilter, objectFit: "contain", width: "100%", height: "100%" }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (target.src !== video.thumbnail_url && video.thumbnail_url) {
                target.src = video.thumbnail_url;
              }
            }}
          />
        ) : isHtml ? (
          <iframe 
            src={videoSrc} 
            className="preview-video"
            style={{ filter: previewFilter, border: "none", width: "100%", height: "100%", position: "absolute", inset: 0 }}
          />
        ) : (
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
            onPause={() => setLocalPaused(true)}
            onPlay={() => setLocalPaused(false)}
            onLoadedMetadata={(e) => {
               const vid = e.target as HTMLVideoElement;
               if (vid.duration > 0) {
                   setTotalDuration(vid.duration);
                   if (endTime === 0) setEndTime(vid.duration);
               }
            }}
            style={{ filter: previewFilter }}
          />
        )}

        {/* Render interactive ITL effects as a transparent overlay over the native video file */}
        {effects.length > 0 && (
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 10 }}>
            <WebGLEffectRenderer
              videoSrc={videoSrc}
              effects={effects}
              isOverlay={true}
            />
          </div>
        )}
        <div className="preview-overlay">
          <span className="preview-chip">{isStaticImage ? "STATIC IMAGE" : "LIVE WALLPAPER"}</span>
          {!isStaticImage && (
            <span className="preview-chip">
              {video.duration > 0 ? `${video.duration.toFixed(1)}s` : "Looping"}
            </span>
          )}
          <span className="preview-chip">
            {video.width > 0 && video.height > 0 ? `${video.width}x${video.height}` : "Desktop media"}
          </span>
        </div>
        
        {/* Dual Range Slider for Trimming Previews */}
        {!isStaticImage && endTime > 0 && (
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
                onMouseDown={() => { setActiveThumb("start"); isDraggingThumbRef.current = true; }}
                onTouchStart={() => { setActiveThumb("start"); isDraggingThumbRef.current = true; }}
                min={0}
                max={totalDuration}
                step={0.5}
                value={startTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (val < endTime - 1) setStartTime(val);
                }}
                disabled={isLoading}
              />
              <input
                type="range"
                className="yt-range-input yt-range-end"
                style={{ zIndex: activeThumb === "end" ? 15 : 10 }}
                onMouseDown={() => { setActiveThumb("end"); isDraggingThumbRef.current = true; }}
                onTouchStart={() => { setActiveThumb("end"); isDraggingThumbRef.current = true; }}
                min={0}
                max={totalDuration}
                step={0.5}
                value={endTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (val > startTime + 1) setEndTime(val);
                }}
                disabled={isLoading}
              />
            </div>
          </div>
        )}

        {/* Playback & Blur Controls */}
        <div className="preview-params-grid" style={{ padding: "12px", background: "rgba(0,0,0,0.15)", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: "20px" }}>
           {!isStaticImage && onSetSpeed && (
             <div className="property-group" style={{ flex: 1 }}>
               <label className="eyebrow" style={{ fontSize: "10px" }}>Engine Speed: {playbackSpeed.toFixed(1)}x</label>
               <input 
                 type="range" min="0.1" max="4" step="0.1" 
                 defaultValue={playbackSpeed} 
                 className="property-control"
                 onMouseUp={(e) => onSetSpeed(parseFloat((e.target as HTMLInputElement).value))} 
                 onTouchEnd={(e) => onSetSpeed(parseFloat((e.target as HTMLInputElement).value))} 
                 disabled={isLoading}
               />
             </div>
           )}
           {onSetBlur && (
             <div className="property-group" style={{ flex: 1 }}>
               <label className="eyebrow" style={{ fontSize: "10px" }}>Scene Blur: {blurStrength}px</label>
               <input 
                 type="range" min="0" max="100" step="1" 
                 defaultValue={blurStrength} 
                 className="property-control"
                 onMouseUp={(e) => onSetBlur(parseInt((e.target as HTMLInputElement).value))} 
                 onTouchEnd={(e) => onSetBlur(parseInt((e.target as HTMLInputElement).value))} 
                 disabled={isLoading}
               />
             </div>
           )}
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="preview-stage__loading-overlay" style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            zIndex: 20,
            gap: "14px",
            animation: "preview-spawn 0.3s ease-out"
          }}>
            <div className="spinner" style={{
              width: "42px",
              height: "42px",
              border: "3px solid rgba(255,255,255,0.1)",
              borderTopColor: "var(--accent, #9ae600)",
              borderRadius: "50%",
              animation: "spin 1s linear infinite"
            }} />
            <span className="eyebrow" style={{ color: "#fff", letterSpacing: "1.5px", fontSize: "11px", textTransform: "uppercase" }}>Applying Wallpaper...</span>
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
          {onToggleHide && (
            <button className="action-btn action-btn--secondary" onClick={onToggleHide} disabled={isLoading} title="Hide from library (requires PIN)">
              {isHidden ? "Unhide 👁️" : "Hide 👁️‍🗨️"}
            </button>
          )}
          {!isStaticImage && (
            <button className="action-btn action-btn--secondary" onClick={() => setLocalPaused(!localPaused)} disabled={isLoading}>
              {localPaused ? "Resume" : "Pause"}
            </button>
          )}
          <button className="action-btn action-btn--secondary" onClick={onToggleFavorite} disabled={isLoading}>
            {isFavorite ? "Unfavorite" : "Save Favorite"}
          </button>
          <button className="action-btn action-btn--secondary" onClick={onToggleQueue} disabled={isLoading}>
            {isQueued ? "Remove From Queue" : "Add To Queue"}
          </button>
          {onEditEffects && (
            <button className="action-btn action-btn--secondary" onClick={onEditEffects} disabled={isLoading}>
              Open in Editor
            </button>
          )}
          <button className="action-btn action-btn--primary" onClick={() => onApply(startTime, endTime)} disabled={isLoading}>
            {isLoading ? "Applying..." : "Apply To Desktop"}
          </button>
        </div>
      </div>
    </article>
  );
}

function previewCssFilter(filterPreset: string, blur: number = 0) {
  let css = "none";
  switch (filterPreset) {
    case "grayscale":
      css = "grayscale(1)";
      break;
    case "vivid":
      css = "contrast(1.12) saturate(1.35)";
      break;
    case "soft":
      css = "brightness(1.04) contrast(0.94) saturate(0.88)";
      break;
    case "noir":
      css = "grayscale(1) contrast(1.15) brightness(0.96)";
      break;
    case "retro":
      css = "sepia(0.35) saturate(1.15) hue-rotate(-8deg) contrast(1.05)";
      break;
  }
  
  if (blur > 0) {
    css = (css === "none" ? "" : css + " ") + `blur(${blur}px)`;
  }
  return css;
}
