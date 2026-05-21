"use client";

import { VideoResult } from "@/hooks/useWallpaper";
import { isStaticWallpaper } from "@/utils/wallpaperTypes";

interface StatusBarProps {
  isPlaying: boolean;
  currentVideo: VideoResult | null;
}

export function StatusBar({ isPlaying, currentVideo }: StatusBarProps) {
  return (
    <section className="status-panel panel">
      <div className="status-panel__main">
        <div className={`status-orb ${isPlaying ? "status-orb--active" : ""}`} />
        <div>
          <p className="status-label">{isPlaying ? "Wallpaper engine active" : "Wallpaper engine idle"}</p>
          <p className="status-value">
            {currentVideo ? currentVideo.id : "No wallpaper deployed"}
          </p>
        </div>
      </div>

      <div className="status-panel__meta">
        <div>
          <span className="status-meta-label">Source</span>
          <strong>{currentVideo ? (isStaticWallpaper(currentVideo) ? "STATIC IMAGE" : "LIVE WALLPAPER") : "NONE"}</strong>
        </div>
        <div>
          <span className="status-meta-label">Duration</span>
          <strong>{currentVideo ? `${currentVideo.duration.toFixed(1)}s` : "--"}</strong>
        </div>
      </div>
    </section>
  );
}
