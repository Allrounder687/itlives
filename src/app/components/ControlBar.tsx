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
  pinterestUrls?: string[];
  onSetPinterestUrls?: (urls: string[]) => Promise<void>;
  colorFilter?: string;
  onColorFilterChange?: (color: string) => void;
  category?: string;
}

const CATEGORIES = [
  "All", "Women", "Men", "Black BG Minimalist", "Sci-Fi Cyberpunk",
  "Fantasy", "Aesthetic", "Anime", "Cyberpunk", "Minimalist", "Games", "Vaporwave", 
  "Lo-Fi", "Pixel Art", "Sci-Fi", "Superhero", "Nature", "Space", "Abstract", 
  "Synthwave", "Cityscape", "Car", "Landscape", "Neon", "Dark", "Futuristic",
  "Tv", "Holiday", "Animal", "Horror", "Technology", "Football", 
  "Japan", "Vintage", "3D Renders", "Illustration", "Architecture",
  "Steampunk", "Retro", "Cosmic", "Forest", "Ocean", "Glitch Art", 
  "Dark Academia", "Cottagecore", "Magical", "Vector", "Pastel"
];

const COLORS = [
  { name: "None", value: "", hex: "transparent" },
  { name: "Red", value: "red", hex: "#ff3b30" },
  { name: "Blue", value: "blue", hex: "#007aff" },
  { name: "Green", value: "green", hex: "#34c759" },
  { name: "Yellow", value: "yellow", hex: "#ffcc00" },
  { name: "Purple", value: "purple", hex: "#af52de" },
  { name: "Pink", value: "pink", hex: "#ff2d55" },
  { name: "Black", value: "black", hex: "#000000" },
  { name: "White", value: "white", hex: "#ffffff" },
  { name: "Orange", value: "orange", hex: "#ff9500" },
  { name: "Cyan", value: "cyan", hex: "#32ade6" }
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
  pinterestUrls = [],
  onSetPinterestUrls,
  colorFilter = "",
  onColorFilterChange,
  category = "all",
}: ControlBarProps) {
  const [showRedGifs, setShowRedGifs] = useState(false);
  const [showPinterestSources, setShowPinterestSources] = useState(true);
  const [newPinUrl, setNewPinUrl] = useState("");
  const [pinAddStatus, setPinAddStatus] = useState<"idle" | "adding" | "added" | "duplicate">("idle");

  const handleAddPinUrl = async () => {
    const trimmed = newPinUrl.trim();
    if (!trimmed || !onSetPinterestUrls) return;
    if (pinterestUrls.includes(trimmed)) {
      setPinAddStatus("duplicate");
      setTimeout(() => setPinAddStatus("idle"), 2000);
      return;
    }
    setPinAddStatus("adding");
    await onSetPinterestUrls([...pinterestUrls, trimmed]);
    setNewPinUrl("");
    setPinAddStatus("added");
    setTimeout(() => setPinAddStatus("idle"), 1500);
  };

  const handleRemovePinUrl = async (idx: number) => {
    if (!onSetPinterestUrls) return;
    await onSetPinterestUrls(pinterestUrls.filter((_, i) => i !== idx));
  };

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
              className={`action-btn ${source === src.id ? "action-btn--filter-active" : "action-btn--ghost"}`}
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

      {/* Inline Pinterest Source Manager — visible when Pinterest is active source */}
      {source === "pinterest" && onSetPinterestUrls && (
        <div style={{
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: "10px",
          marginBottom: "12px",
          overflow: "hidden",
          transition: "all 0.3s ease"
        }}>
          {/* Header / Toggle */}
          <button
            type="button"
            onClick={() => setShowPinterestSources(!showPinterestSources)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: "10px 14px",
              background: "transparent",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              transition: "background 0.2s ease"
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "14px" }}>📌</span>
              <span style={{ fontSize: "12px", fontWeight: 600 }}>Pinterest Sources</span>
              <span style={{
                fontSize: "10px",
                background: pinterestUrls.length > 0 ? "var(--accent-soft)" : "rgba(255,99,99,0.15)",
                color: pinterestUrls.length > 0 ? "var(--accent)" : "rgba(255,99,99,0.9)",
                padding: "2px 8px",
                borderRadius: "99px",
                fontWeight: 700
              }}>
                {pinterestUrls.length} active
              </span>
            </div>
            <span style={{
              fontSize: "10px",
              opacity: 0.5,
              transform: showPinterestSources ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease"
            }}>▼</span>
          </button>

          {/* Expandable Content */}
          {showPinterestSources && (
            <div style={{ padding: "0 14px 14px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* Add URL form */}
              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  type="text"
                  className="input input--hud"
                  placeholder="Paste Pinterest board/search URL..."
                  value={newPinUrl}
                  onChange={(e) => setNewPinUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddPinUrl(); }}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    background: "rgba(0,0,0,0.35)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "6px",
                    color: "#fff",
                    fontSize: "11px"
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddPinUrl}
                  disabled={pinAddStatus === "adding"}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    background: pinAddStatus === "added" ? "rgba(100,255,100,0.15)" : pinAddStatus === "duplicate" ? "rgba(255,170,0,0.15)" : "var(--accent)",
                    color: pinAddStatus === "added" ? "#8f8" : pinAddStatus === "duplicate" ? "#fca" : "#000",
                    fontWeight: "bold",
                    border: "none",
                    fontSize: "11px",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap"
                  }}
                >
                  {pinAddStatus === "adding" ? "Adding..." : pinAddStatus === "added" ? "Added ✓" : pinAddStatus === "duplicate" ? "Duplicate!" : "+ Add"}
                </button>
              </div>

              {/* List of active sources */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "160px", overflowY: "auto" }}>
                {pinterestUrls.length > 0 ? (
                  pinterestUrls.map((url, idx) => {
                    // Extract a readable label from the URL
                    let label = url;
                    try {
                      const parsed = new URL(url);
                      const q = parsed.searchParams.get("q");
                      if (q) {
                        label = `🔍 ${decodeURIComponent(q)}`;
                      } else {
                        const pathParts = parsed.pathname.split("/").filter(Boolean);
                        label = pathParts.length > 0 ? `📋 ${pathParts.join(" / ")}` : url;
                      }
                    } catch { /* keep raw url */ }

                    return (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          background: "rgba(255, 255, 255, 0.02)",
                          border: "1px solid rgba(255, 255, 255, 0.04)",
                          transition: "all 0.15s ease"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                      >
                        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                          <span style={{
                            fontSize: "11px",
                            color: "rgba(255, 255, 255, 0.85)",
                            fontWeight: 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                          }}>
                            {label}
                          </span>
                          <span style={{
                            fontSize: "9px",
                            color: "rgba(255, 255, 255, 0.35)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontFamily: "monospace"
                          }} title={url}>
                            {url}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePinUrl(idx)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "rgba(255, 99, 99, 0.6)",
                            fontSize: "11px",
                            cursor: "pointer",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            transition: "all 0.15s ease",
                            flexShrink: 0
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(255, 99, 99, 0.1)";
                            e.currentTarget.style.color = "rgba(255, 99, 99, 0.9)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = "rgba(255, 99, 99, 0.6)";
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div style={{
                    textAlign: "center",
                    padding: "12px",
                    fontSize: "11px",
                    color: "rgba(255, 255, 255, 0.35)",
                    fontStyle: "italic",
                    background: "rgba(255,99,99,0.04)",
                    borderRadius: "6px",
                    border: "1px dashed rgba(255,99,99,0.12)"
                  }}>
                    No Pinterest sources configured. Add a board or search URL above to start browsing.
                  </div>
                )}
              </div>

              {/* Quick tip */}
              <span style={{ fontSize: "9px", opacity: 0.4, fontStyle: "italic" }}>
                Tip: Add Pinterest search or board URLs. Wallpapers are scraped from all active sources.
              </span>
            </div>
          )}
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
        <>
          <div className="categories-scroll" style={{ display: "flex", flexWrap: "wrap", gap: "8px", paddingBottom: "8px" }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`pill ${(category || "all").toLowerCase() === cat.toLowerCase() ? "" : "pill--muted"}`}
                style={{ padding: "6px 14px", cursor: "pointer", border: "none", whiteSpace: "nowrap", minWidth: "fit-content" }}
                onClick={() => onCategoryChange && onCategoryChange(cat.toLowerCase())}
              >
                {cat}
              </button>
            ))}
          </div>
          
          <div className="color-picker-row" style={{ display: "flex", flexWrap: "wrap", gap: "10px", paddingBottom: "12px", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: "4px" }}>Filter Color:</span>
            {COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.name}
                onClick={() => onColorFilterChange && onColorFilterChange(c.value)}
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: c.hex,
                  border: colorFilter === c.value ? "2px solid var(--accent)" : "1px solid rgba(255,255,255,0.1)",
                  cursor: "pointer",
                  position: "relative",
                  boxShadow: colorFilter === c.value ? "0 0 8px var(--accent)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                {c.value === "" && <div style={{ width: "100%", height: "1px", background: "red", transform: "rotate(45deg)", position: "absolute" }} />}
              </button>
            ))}
          </div>
        </>
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
