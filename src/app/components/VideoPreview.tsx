"use client";

import { useEffect, useRef, useState, memo } from "react";

import { VideoResult } from "@/hooks/useWallpaper";
import { isStaticWallpaper } from "@/utils/wallpaperTypes";
import { convertFileSrc } from "@tauri-apps/api/core";
import { EffectLayer } from "./CanvasEffectRenderer";
import { WebGLEffectRenderer } from "./WebGLEffectRenderer";
import { useTranslation } from "@/hooks/useTranslation";

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

export const VideoPreview = memo(function VideoPreview({
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
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(video.duration || 0);
  const [totalDuration, setTotalDuration] = useState(video.duration || 0);
  const [activeThumb, setActiveThumb] = useState<"start" | "end">("start");
  const [localPaused, setLocalPaused] = useState(false);
  const [effects, setEffects] = useState<EffectLayer[]>([]);

  const [localSpeed, setLocalSpeed] = useState(playbackSpeed);
  const [localBlur, setLocalBlur] = useState(blurStrength);
  const [isBuffering, setIsBuffering] = useState(true);

  useEffect(() => {
    setLocalSpeed(playbackSpeed);
  }, [playbackSpeed]);

  useEffect(() => {
    setLocalBlur(blurStrength);
  }, [blurStrength]);

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

  const previewFilter = previewCssFilter(filterPreset, localBlur);

  const handleError = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const target = event.target as HTMLVideoElement;
    if (target.src !== video.video_url && video.video_url) {
      target.src = video.video_url;
    }
  };

  return (
    <article className="preview-surface">
      {/* Left Column (Media & Timeline) */}
      <div className="preview-left-pane">
        <div className="preview-stage">
          {/* Immersive Ambient Backglow */}
          <div className="preview-ambient-glow">
            <img src={video.thumbnail_url || videoSrc} alt="" />
          </div>
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
              style={{ filter: previewFilter, border: "none", width: "100%", aspectRatio: "16/9" }}
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
                onPause={() => setLocalPaused(true)}
                onPlay={() => setLocalPaused(false)}
                onWaiting={() => setIsBuffering(true)}
                onPlaying={() => setIsBuffering(false)}
                onCanPlay={() => setIsBuffering(false)}
                onLoadedMetadata={(e) => {
                   const vid = e.target as HTMLVideoElement;
                   if (vid.duration > 0) {
                       setTotalDuration(vid.duration);
                       if (endTime === 0) setEndTime(vid.duration);
                   }
                }}
                style={{ filter: previewFilter, opacity: isBuffering ? 0 : 1, transition: "opacity 0.3s ease" }}
              />
          )}

          {/* Buffering Overlay */}
          {isBuffering && !isStaticImage && !isHtml && !isLoading && (
            <div style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 5,
              pointerEvents: "none"
            }}>
              <div className="spinner" style={{
                width: "42px",
                height: "42px",
                border: "3px solid rgba(255,255,255,0.1)",
                borderTopColor: "var(--accent, #9ae600)",
                borderRadius: "50%",
                animation: "spin 1s linear infinite"
              }} />
            </div>
          )}

          {/* Render interactive ITL effects as a transparent overlay over the native video file */}
          {effects.length > 0 && (
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 10 }}>
              <WebGLEffectRenderer
                videoSrc={videoSrc}
                effects={effects}
                isOverlay={true}
                isPaused={localPaused}
              />
            </div>
          )}
          <div className="preview-overlay">
            <span className="preview-chip">{isStaticImage ? t("staticImage") : t("liveWallpaper")}</span>
            {!isStaticImage && (
              <span className="preview-chip">
                {video.duration > 0 ? `${video.duration.toFixed(1)}s` : "Looping"}
              </span>
            )}
            <span className="preview-chip">
              {video.width > 0 && video.height > 0 ? `${video.width}x${video.height}` : "Desktop media"}
            </span>
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
              <span className="eyebrow" style={{ color: "#fff", letterSpacing: "1.5px", fontSize: "11px", textTransform: "uppercase" }}>{t("applyingWallpaper")}</span>
            </div>
          )}
        </div>

        {/* Dual Range Slider for Trimming Previews */}
        {!isStaticImage && !isHtml && (
          <div className="yt-range-section" style={{ 
            visibility: endTime > 0 ? "visible" : "hidden"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", alignItems: "center" }}>
              <span className="eyebrow" style={{ fontSize: "10px" }}>{t("trimRangeControl")}</span>
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
      </div>

      {/* Right Column (Inspector Sidebar) */}
      <div className="preview-right-pane">
        <div className="preview-inspector-scroll">
          <div className="preview-copy">
            <span className="eyebrow">{t("scenePreview")}</span>
            <h3>{video.id}</h3>
            <p>{video.local_path || video.video_url}</p>
          </div>

          {/* Playback & Blur Controls */}
          <div className="preview-params-grid">
             {!isStaticImage && onSetSpeed && (
               <div className="property-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label className="eyebrow">{t("engineSpeed")}: {localSpeed.toFixed(1)}x</label>
                    {localSpeed !== 1 && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setLocalSpeed(1);
                          if (videoRef.current) videoRef.current.playbackRate = 1;
                          onSetSpeed(1);
                        }}
                        style={{ background: "none", border: "none", color: "#a1a1aa", cursor: "pointer", padding: "4px", borderRadius: "4px", display: "flex" }}
                        title="Reset to 1.0x"
                        className="hover-bg-dark"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                          <path d="M3 3v5h5"></path>
                        </svg>
                      </button>
                    )}
                  </div>
                 <input 
                   type="range" min="0.1" max="4" step="0.1" 
                   value={localSpeed} 
                   className="property-control"
                   onChange={(e) => {
                     const val = parseFloat(e.target.value);
                     setLocalSpeed(val);
                     if (videoRef.current) videoRef.current.playbackRate = val;
                   }}
                   onMouseUp={(e) => onSetSpeed(parseFloat((e.target as HTMLInputElement).value))} 
                   onTouchEnd={(e) => onSetSpeed(parseFloat((e.target as HTMLInputElement).value))} 
                   disabled={isLoading}
                 />
               </div>
             )}
             {onSetBlur && (
               <div className="property-group">
                 <label className="eyebrow">{t("sceneBlur")}: {localBlur}px</label>
                 <input 
                   type="range" min="0" max="100" step="1" 
                   value={localBlur} 
                   className="property-control"
                   onChange={(e) => setLocalBlur(parseInt(e.target.value))}
                   onMouseUp={(e) => onSetBlur(parseInt((e.target as HTMLInputElement).value))} 
                   onTouchEnd={(e) => onSetBlur(parseInt((e.target as HTMLInputElement).value))} 
                   disabled={isLoading}
                 />
               </div>
             )}
          </div>

          {/* Secondary Actions Grid */}
          <div className="preview-actions-grid">
            {onToggleHide && (
              <button className="action-btn" onClick={onToggleHide} disabled={isLoading} title="Hide from library (requires PIN)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <span>{isHidden ? t("unhide") : t("hide")}</span>
              </button>
            )}
            {!isStaticImage && (
              <button className="action-btn" onClick={() => setLocalPaused(!localPaused)} disabled={isLoading}>
                {localPaused ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    <span>{t("resume")}</span>
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                    <span>{t("pause")}</span>
                  </>
                )}
              </button>
            )}
            <button className="action-btn" onClick={onToggleFavorite} disabled={isLoading}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              <span>{isFavorite ? t("unfavorite") : t("favorite")}</span>
            </button>
            <button className="action-btn" onClick={onToggleQueue} disabled={isLoading}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              <span>{isQueued ? t("removeQueue") : t("addQueue")}</span>
            </button>
            {onEditEffects && (
              <button className="action-btn" onClick={onEditEffects} disabled={isLoading}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                <span>{t("editor")}</span>
              </button>
            )}
          </div>
        </div>

        {/* Primary Action Anchored Box */}
        <div className="preview-primary-action-box">
          <button className="action-btn" onClick={() => onApply(startTime, endTime)} disabled={isLoading}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            <span>{isLoading ? t("applying") : t("applyToDesktop")}</span>
          </button>
        </div>
      </div>
    </article>
  );
});

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
