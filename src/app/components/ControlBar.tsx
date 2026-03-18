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

const SOURCES = [
  { value: "motionbgs", label: "MotionBGs" },
  { value: "redgifs", label: "RedGIFs" },
  { value: "direct", label: "Direct URL / File" },
];

const CATEGORIES = [
  "Anime", "Games", "Superhero", "Nature", "Car", "Tv", "Holiday", "Animal", "Fantasy", "Space", "Horror", "Technology", "Football", "Japan"
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

  const visibleSources = SOURCES.filter((item) => item.value !== "redgifs" || showRedGifs);

  return (
    <div className="control-shell">
      <div className="source-pills">
        {visibleSources.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`source-pill ${source === item.value ? "source-pill--active" : ""}`}
            onClick={() => onSourceChange(item.value)}
          >
            {item.value === "motionbgs" && <span style={{ marginRight: "8px" }}>🌏</span>}
            {item.value === "redgifs" && <span style={{ marginRight: "8px" }}>🎬</span>}
            {item.value === "direct" && <span style={{ marginRight: "8px" }}>🔗</span>}
            {item.label}
          </button>
        ))}
      </div>

      <div className="control-grid-v2">
        <div className="field">
          <span className="field__label">
            {source === "direct" ? "Integrated Video Feed URL or local path" : "Search Query"}
          </span>
          <div className="input-group">
            <input
              className="input input--hud"
              type="text"
              placeholder={source === "direct" ? "Paste an .mp4 URL or local file path" : "Search clips..."}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
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

      {source === "motionbgs" && (
        <div className="categories-scroll">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`pill ${query.toLowerCase() === cat.toLowerCase() ? "" : "pill--muted"}`}
              style={{ padding: "8px 16px", cursor: "pointer", border: "none" }}
              onClick={() => onCategoryChange && onCategoryChange(cat.toLowerCase())}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="action-row action-row--hud">
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
