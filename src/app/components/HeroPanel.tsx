"use client";

import { useWallpaper } from "@/hooks/useWallpaper";
import { VolumeSlider } from "./VolumeSlider";
import { isStaticWallpaper } from "@/utils/wallpaperTypes";
import type { TabState } from "./Sidebar";

type WallpaperState = ReturnType<typeof useWallpaper>;

interface HeroPanelProps {
  wallpaper: WallpaperState;
  activeTab?: TabState;
}

const TAB_TITLES: Record<string, string> = {
  discover: "Discover Feed",
  library: "Unified Library",
  direct: "Direct Launch",
  preview: "Preview Deck",
  editor: "Effects Editor",
  youtube: "YouTube Studio",
  parallax: "Parallax Engine",
  settings: "Application Settings",
  community: "Community Hub",
};

export function HeroPanel({ wallpaper, activeTab }: HeroPanelProps) {
  const currentResolution = wallpaper.currentVideo
    ? `${wallpaper.currentVideo.width}×${wallpaper.currentVideo.height}`
    : "Awaiting media";

  const dynamicTitle = wallpaper.currentVideo?.id.replace(/-/g, " ")
    || (activeTab ? TAB_TITLES[activeTab] : "OpenClaw LWP")
    || "OpenClaw LWP";

  return (
    <section className="hero panel hero--hud" style={{ marginBottom: "8px" }}>
      <div className="hero__status" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div className={`engine-orb ${wallpaper.isPlaying ? "engine-orb--active" : ""}`} style={{ flexShrink: 0, transform: "scale(0.8)" }}>
          <div className="engine-pulse" />
        </div>
        <div className="hero__meta">
          <p className="eyebrow" style={{ margin: 0, fontSize: "9px" }}>{wallpaper.isPlaying ? "Engine Active" : "Engine Standby"}</p>
          <h2 style={{ margin: 0, fontSize: "14px", lineHeight: 1.2, fontWeight: 600 }}>{dynamicTitle}</h2>
        </div>
      </div>

      <div className="hero__metrics" style={{ display: "flex", alignItems: "center", gap: "24px" }}>
        <div className="hud-metric">
          <span>Resolution</span>
          <strong>{currentResolution}</strong>
        </div>
        <div className="hud-metric">
          <span>Provider</span>
          <strong>{wallpaper.currentVideo ? (isStaticWallpaper(wallpaper.currentVideo) ? "STATIC IMAGE" : "LIVE WALLPAPER") : "READY"}</strong>
        </div>
        <div className="hud-metric">
          <span>Volume</span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
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

