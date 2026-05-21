"use client";

import { useWallpaper } from "@/hooks/useWallpaper";
import { VolumeSlider } from "./VolumeSlider";

type WallpaperState = ReturnType<typeof useWallpaper>;

interface HeroPanelProps {
  wallpaper: WallpaperState;
}

export function HeroPanel({ wallpaper }: HeroPanelProps) {
  const currentResolution = wallpaper.currentVideo
    ? `${wallpaper.currentVideo.width}x${wallpaper.currentVideo.height}`
    : "Awaiting media";

  return (
    <section className="hero panel hero--hud" style={{ padding: "10px 18px", marginBottom: "8px" }}>
      <div className="hero__status">
        <div className={`engine-orb ${wallpaper.isPlaying ? "engine-orb--active" : ""}`}>
          <div className="engine-pulse" />
        </div>
        <div className="hero__meta">
          <p className="eyebrow">{wallpaper.isPlaying ? "Engine Active" : "Engine Standby"}</p>
          <h2>{wallpaper.currentVideo?.id.replace(/-/g, " ") || "OpenClaw LWP"}</h2>
        </div>
      </div>

      <div className="hero__metrics">
        <div className="hud-metric">
          <span>Resolution</span>
          <strong>{currentResolution}</strong>
        </div>
        <div className="hud-metric">
          <span>Provider</span>
          <strong>{wallpaper.currentVideo ? "LIVE WALLPAPER" : "READY"}</strong>
        </div>
        <div className="hud-metric">
          <span>Volume</span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <VolumeSlider
              initialVolume={wallpaper.volumePercent}
              onCommit={wallpaper.setVolumePercent}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
