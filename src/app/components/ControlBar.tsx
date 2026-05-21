"use client";

import { useState, useEffect } from "react";

interface ControlBarProps {
  source: string;
  query: string;
  isLoading: boolean;
  onSourceChange: (source: string) => void;
  onQueryChange: (query: string) => void;
  onCategoryChange?: (category: string) => void;
  onBrowseLocalFile: () => void;
  onFetch: () => void;
  onFetchAndApply: () => void;
  onStop: () => void;
}

const CATEGORIES = [
  "All", "Anime", "Games", "Superhero", "Nature", "Car", "Tv", "Holiday", "Animal", "Fantasy", "Space", "Horror", "Technology", "Football", "Japan"
];

export function ControlBar({
  source,
  query,
  isLoading,
  onSourceChange,
  onQueryChange,
  onCategoryChange,
  onBrowseLocalFile,
  onFetch,
  onFetchAndApply,
  onStop,
}: ControlBarProps) {
  const [showRedGifs, setShowRedGifs] = useState(false);

  useEffect(() => {
    const checkUnlock = () => {
      setShowRedGifs(localStorage.getItem("unlock_redgifs") === "true");
    };
    checkUnlock();
    window.addEventListener("unlock_redgifs", checkUnlock);
    return () => window.removeEventListener("unlock_redgifs", checkUnlock);
  }, []);

  const handleQueryChange = (val: string) => {
    if (val.trim().toLowerCase() === "unlock_redgifs") {
        localStorage.setItem("unlock_redgifs", "true");
        window.dispatchEvent(new Event("unlock_redgifs"));
        onQueryChange("");
        onSourceChange("redgifs");
        return;
    }
    if (val.trim().toLowerCase() === "lock_redgifs") {
        localStorage.setItem("unlock_redgifs", "false");
        window.dispatchEvent(new Event("unlock_redgifs"));
        onQueryChange("");
        onSourceChange("unified");
        return;
    }
    onQueryChange(val);
  };

  return (
    <div className="control-shell" style={{ marginTop: "4px", gap: "8px", padding: "10px 14px" }}>
      <div className="control-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
        <span className="eyebrow" style={{ color: "var(--accent)" }}>
          {source === "direct" ? "Direct Media Entry" : source === "redgifs" ? "NSFW Engine" : source === "wallhaven" ? "WallHaven Static Feed" : source === "pinterest" ? "Pinterest Static Feed" : "Discover Unified Feed"}
        </span>
        {showRedGifs && (
            <button
                type="button"
                className={`action-btn ${source === "redgifs" ? "action-btn--primary" : "action-btn--ghost"}`}
                style={{ fontSize: "10px", padding: "4px 8px" }}
                onClick={() => onSourceChange(source === "redgifs" ? "unified" : "redgifs")}
            >
                {source === "redgifs" ? "Exit NSFW Engine" : "Enter NSFW Engine"}
            </button>
        )}
      </div>

      {source !== "direct" && (
        <div className="source-selector" style={{ 
          display: "flex", 
          gap: "6px", 
          background: "rgba(0, 0, 0, 0.25)", 
          padding: "4px", 
          borderRadius: "8px",
          border: "1px solid rgba(255, 255, 255, 0.05)",
          marginBottom: "12px"
        }}>
          {[
            { id: "unified", label: "🎥 Unified Live", desc: "Live video loops" },
            { id: "wallhaven", label: "🖼️ WallHaven", desc: "Premium static images" },
            { id: "pinterest", label: "📌 Pinterest", desc: "Art & static designs" },
            ...(showRedGifs ? [{ id: "redgifs", label: "🔞 NSFW Loop", desc: "Adult content" }] : [])
          ].map((src) => (
            <button
              key={src.id}
              type="button"
              className={`action-btn ${source === src.id ? "action-btn--primary" : "action-btn--ghost"}`}
              style={{ 
                flex: 1, 
                fontSize: "12px", 
                padding: "8px 12px", 
                borderRadius: "6px", 
                transition: "all 0.2s ease",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2px"
              }}
              onClick={() => onSourceChange(src.id)}
            >
              <span style={{ fontWeight: "bold" }}>{src.label}</span>
              <span style={{ fontSize: "9px", opacity: 0.6 }}>{src.desc}</span>
            </button>
          ))}
        </div>
      )}

      <div className="control-grid-v2">
        <div className="field">
          <span className="field__label">
            {source === "direct" ? "Integrated Video Feed URL or local path" : "Search Query"}
          </span>
          <div className="input-group">
            <input
              className="input input--hud"
              type="text"
              placeholder={source === "direct" ? "Paste an .mp4 URL or local file path" : "Search worldwide live wallpapers..."}
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onFetchAndApply();
                }
              }}
            />
            {source === "direct" && (
                <button
                  type="button"
                  className="action-btn action-btn--accent-ghost"
                  onClick={onBrowseLocalFile}
                  disabled={isLoading}
                >
                  Browse Local
                </button>
            )}
          </div>
        </div>
      </div>

      {source !== "direct" && (
        <div className="categories-scroll" style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px", scrollbarWidth: "none" }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`pill ${query.toLowerCase() === cat.toLowerCase() ? "" : "pill--muted"}`}
              style={{ padding: "8px 16px", cursor: "pointer", border: "none", whiteSpace: "nowrap" }}
              onClick={() => onCategoryChange && onCategoryChange(cat.toLowerCase())}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="action-row action-row--hud" style={{ marginTop: "4px" }}>
        <button className="action-btn action-btn--primary" onClick={onFetchAndApply} disabled={isLoading}>
          {isLoading ? "Syncing..." : "Fetch and Deploy"}
        </button>

        <button className="action-btn action-btn--secondary" onClick={onFetch} disabled={isLoading}>
          Preview Stream
        </button>

        <button className="action-btn action-btn--ghost" onClick={onStop}>
          Unload Engine
        </button>
      </div>
    </div>
  );
}
