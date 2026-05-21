"use client";

import React, { useState } from "react";

interface WallpaperSourcePanelProps {
  wallpaper: {
    wallhavenApiKey: string;
    disabledSources: string[];
    setWallhavenApiKey: (key: string) => Promise<void>;
    setDisabledSources: (sources: string[]) => Promise<void>;
  };
}

interface WallpaperSourceOption {
  id: string;
  name: string;
  desc: string;
  emoji: string;
}

const SOURCES: WallpaperSourceOption[] = [
  { id: "motionbgs", name: "MotionBGs Feed", desc: "Unified SFW video feed provider", emoji: "🎥" },
  { id: "alphacoders", name: "AlphaCoders Feed", desc: "Unified SFW video feed provider", emoji: "🎬" },
  { id: "wallhaven", name: "WallHaven Feed", desc: "Premium static imagery provider", emoji: "🖼️" },
  { id: "pinterest", name: "Pinterest Feed", desc: "Aesthetic design and photography scrapers", emoji: "📌" },
  { id: "redgifs", name: "NSFW Engine", desc: "Mature content loops", emoji: "🔞" },
];

export function WallpaperSourcePanel({ wallpaper }: WallpaperSourcePanelProps) {
  const [apiKeyInput, setApiKeyInput] = useState(wallpaper.wallhavenApiKey);
  const [showKey, setShowKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const handleSaveApiKey = async () => {
    setSaveStatus("saving");
    await wallpaper.setWallhavenApiKey(apiKeyInput);
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2500);
  };

  const handleToggleSource = async (sourceId: string, enabled: boolean) => {
    let newDisabled = [...wallpaper.disabledSources];
    if (enabled) {
      // If we are enabling it, remove it from disabled list
      newDisabled = newDisabled.filter(s => s !== sourceId);
    } else {
      // If we are disabling it, add it to disabled list if not present
      if (!newDisabled.includes(sourceId)) {
        newDisabled.push(sourceId);
      }
    }
    await wallpaper.setDisabledSources(newDisabled);
  };

  return (
    <div className="panel" style={{ padding: "16px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "16px" }}>
      <div className="section-head" style={{ marginBottom: "1.5rem" }}>
        <span className="eyebrow">Sources & Integrations</span>
        <h2>Wallpaper Providers</h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* WallHaven API Key section */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label className="field__label" style={{ fontWeight: 600, color: "var(--text-soft)" }}>
            Wallhaven.cc API Key
          </label>
          <div style={{ display: "flex", gap: "8px", position: "relative" }}>
            <input
              type={showKey ? "text" : "password"}
              className="input input--hud"
              placeholder="Paste your Wallhaven API Key..."
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              style={{ flex: 1, paddingRight: "40px" }}
            />
            <button
              type="button"
              className="action-btn action-btn--ghost"
              onClick={() => setShowKey(!showKey)}
              style={{
                position: "absolute",
                right: "95px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                fontSize: "12px",
                color: "rgba(255, 255, 255, 0.4)",
                cursor: "pointer",
                padding: "4px"
              }}
              title={showKey ? "Hide API Key" : "Show API Key"}
            >
              {showKey ? "Hide" : "Show"}
            </button>
            <button
              type="button"
              className="action-btn action-btn--primary"
              onClick={handleSaveApiKey}
              disabled={saveStatus === "saving"}
              style={{ minWidth: "80px", padding: "8px 16px" }}
            >
              {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved! ✓" : "Save"}
            </button>
          </div>
          <span className="field__hint" style={{ fontSize: "11px", opacity: 0.6 }}>
            Adding an API key removes rate limits and unlocks custom search capabilities.
          </span>
        </div>

        {/* Wallpaper Source Selection section */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <label className="field__label" style={{ fontWeight: 600, color: "var(--text-soft)", marginBottom: "4px" }}>
            Enabled Wallpaper Sources
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {SOURCES.map((source) => {
              const isEnabled = !wallpaper.disabledSources.includes(source.id);
              return (
                <div
                  key={source.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    background: isEnabled ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.2)",
                    border: "1px solid rgba(255, 255, 255, 0.03)",
                    opacity: isEnabled ? 1 : 0.6,
                    transition: "all 0.2s ease"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "20px" }}>{source.emoji}</span>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: "13px", fontWeight: "bold", color: isEnabled ? "#fff" : "rgba(255,255,255,0.4)" }}>
                        {source.name}
                      </span>
                      <span style={{ fontSize: "10px", opacity: 0.6 }}>
                        {source.desc}
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => handleToggleSource(source.id, e.target.checked)}
                    style={{
                      width: "16px",
                      height: "16px",
                      accentColor: "var(--accent)",
                      cursor: "pointer"
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
