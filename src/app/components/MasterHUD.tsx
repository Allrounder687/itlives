"use client";

import { useState } from "react";
import { VolumeSlider } from "./VolumeSlider";
import { useWallpaper } from "@/hooks/useWallpaper";

type WallpaperState = ReturnType<typeof useWallpaper>;

interface MasterHUDProps {
  wallpaper: WallpaperState;
}

export function MasterHUD({ wallpaper }: MasterHUDProps) {
  const [lastVolume, setLastVolume] = useState(25);

  if (!wallpaper.isPlaying) return null;

  return (
    <div className="master-hud">
      <div className="hud-content">
        <button
          className={`action-btn ${wallpaper.paused ? "action-btn--primary" : "action-btn--ghost"}`}
          style={{ padding: "8px 12px", minWidth: "40px" }}
          onClick={() => wallpaper.setPaused(!wallpaper.paused)}
          title={wallpaper.paused ? "Resume Wallpaper" : "Pause Wallpaper"}
        >
          {wallpaper.paused ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
          )}
        </button>

        <div className="hud-info">
          <span className="eyebrow" style={{ fontSize: "10px", lineHeight: 1 }}>Now Playing</span>
          <span className="hud-title" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "160px", fontSize: "12px", fontWeight: "bold" }}>
            {wallpaper.currentVideo?.id.replace(/-/g, " ") || "Live Wallpaper"}
          </span>
        </div>

        <div className="hud-divider" style={{ width: "1px", height: "24px", background: "rgba(255,255,255,0.08)" }} />

        <div className="hud-audio" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, color: "var(--accent)", display: "flex" }}
            onClick={() => {
              if (wallpaper.volumePercent > 0) {
                setLastVolume(wallpaper.volumePercent);
                wallpaper.setVolumePercent(0);
              } else {
                wallpaper.setVolumePercent(lastVolume > 0 ? lastVolume : 30);
              }
            }}
            title={wallpaper.volumePercent > 0 ? "Mute" : "Unmute"}
          >
            {wallpaper.volumePercent > 0 ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "red" }}><path d="M11 5L6 9H2v6h4l5 4V5z" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
            )}
          </button>
          <VolumeSlider
            initialVolume={wallpaper.volumePercent}
            onCommit={wallpaper.setVolumePercent}
          />
        </div>

        <button
          className="action-btn action-btn--danger-ghost"
          style={{ padding: "8px 12px", fontSize: "11px" }}
          onClick={wallpaper.stopWallpaper}
        >
          Stop
        </button>
      </div>
    </div>
  );
}
