"use client";

import React from "react";
import { useWallpaper } from "@/hooks/useWallpaper";
import { VolumeSlider } from "./VolumeSlider";
import { isStaticWallpaper } from "@/utils/wallpaperTypes";
import type { TabState } from "./Sidebar";

type WallpaperState = ReturnType<typeof useWallpaper>;

interface HeroPanelProps {
  wallpaper: WallpaperState;
  activeTab?: TabState;
  onEditEffects?: (video: any) => void;
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

export function HeroPanel({ wallpaper, activeTab, onEditEffects }: HeroPanelProps) {
  const [tags, setTags] = React.useState<string[]>([]);

  React.useEffect(() => {
    let active = true;
    if (wallpaper.currentVideo) {
      if (wallpaper.currentVideo.tags && wallpaper.currentVideo.tags.length > 0) {
        setTags(wallpaper.currentVideo.tags);
      } else {
        setTags([]);
        wallpaper.fetchVideoTags(wallpaper.currentVideo.source, wallpaper.currentVideo.id)
          .then(fetchedTags => {
            if (active && fetchedTags.length > 0) {
              setTags(fetchedTags);
            }
          })
          .catch(() => {});
      }
    } else {
      setTags([]);
    }
    return () => { active = false; };
  }, [wallpaper.currentVideo, wallpaper.fetchVideoTags]);

  const currentResolution = wallpaper.currentVideo
    ? `${wallpaper.currentVideo.width}×${wallpaper.currentVideo.height}`
    : "Awaiting media";

  const dynamicTitle = wallpaper.currentVideo?.id.replace(/-/g, " ")
    || (activeTab ? TAB_TITLES[activeTab] : "itLives")
    || "itLives";

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

      {wallpaper.currentVideo && tags.length > 0 && (
        <div style={{ 
          marginTop: "16px", 
          display: "flex", 
          flexWrap: "wrap", 
          gap: "8px",
          paddingTop: "12px",
          borderTop: "1px solid rgba(255,255,255,0.05)"
        }}>
          {Array.from(new Set(tags)).map(tag => (
            <button
              key={tag}
              onClick={() => {
                if (tag === "itl-package") return; // Non-clickable badge
                wallpaper.setQuery(tag);
                wallpaper.fetchVideosList();
              }}
              style={{
                background: tag === "itl-package" ? "rgba(100,200,255,0.15)" : "rgba(255,255,255,0.05)",
                border: tag === "itl-package" ? "1px solid rgba(100,200,255,0.4)" : "1px solid rgba(255,255,255,0.1)",
                borderRadius: "4px",
                padding: "4px 8px",
                fontSize: "11px",
                color: tag === "itl-package" ? "#88ccff" : "var(--text-soft)",
                cursor: tag === "itl-package" ? "default" : "pointer",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                if (tag === "itl-package") return;
                e.currentTarget.style.background = "var(--accent)";
                e.currentTarget.style.color = "#000";
              }}
              onMouseLeave={(e) => {
                if (tag === "itl-package") return;
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.color = "var(--text-soft)";
              }}
            >
              {tag === "itl-package" ? "📦 ITL Package" : `#${tag}`}
            </button>
          ))}
          {tags.includes("itl-package") && onEditEffects && (
            <button 
              className="action-btn action-btn--secondary" 
              style={{ padding: "4px 12px", fontSize: "11px", height: "auto", marginLeft: "auto" }}
              onClick={() => onEditEffects(wallpaper.currentVideo)}
            >
              🖌 Edit Effects
            </button>
          )}
        </div>
      )}
    </section>
  );
}

