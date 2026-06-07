"use client";

import { useState, useEffect } from "react";
import { BatchDownloadModal } from "./BatchDownloadModal";
import { AdvancedFilters } from "./AdvancedFilters";
import DisplaySelector from "./DisplaySelector";

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
  resolutions?: string | null;
  ratios?: string | null;
  colors?: string | null;
  onResolutionsChange?: (res: string | null) => void;
  onRatiosChange?: (ratio: string | null) => void;
  onColorsChange?: (color: string | null) => void;
  categoriesFilter?: string | null;
  purityFilter?: string | null;
  onCategoriesFilterChange?: (categories: string) => void;
  onPurityFilterChange?: (purity: string) => void;
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

const WALLPAPERWAVES_CATEGORIES = [
  "All", "Anime", "Abstract", "Animal", "Cartoon", "Fantasy", "Games", "Landscape", 
  "Memes", "Pixel Art", "Retro", "Sci-Fi", "TV Movies", "Vehicle"
];

const WALLHAVEN_CATEGORIES = [
  { label: "All", value: "all", count: 0 },
  { label: "Nature", value: "https://wallhaven.cc/user/DeviateFish/collections/95531", count: 35786 },
  { label: "Urban", value: "https://wallhaven.cc/user/DeviateFish/collections/82369", count: 7109 },
  { label: "Space", value: "https://wallhaven.cc/user/DeviateFish/collections/648901", count: 1344 },
  { label: "Animals", value: "https://wallhaven.cc/user/DeviateFish/collections/95534", count: 8278 },
  { label: "Cars", value: "https://wallhaven.cc/user/DeviateFish/collections/89250", count: 2596 },
  { label: "Games", value: "https://wallhaven.cc/user/DeviateFish/collections/82366", count: 2386 },
  { label: "Art", value: "https://wallhaven.cc/user/DeviateFish/collections/1036329", count: 1911 },
  { label: "Digital Art", value: "https://wallhaven.cc/user/DeviateFish/collections/1638210", count: 4471 },
  { label: "Architecture", value: "https://wallhaven.cc/user/DeviateFish/collections/95532", count: 2329 },
  { label: "Film/TV", value: "https://wallhaven.cc/user/DeviateFish/collections/340321", count: 730 },
  { label: "Food/Drink", value: "https://wallhaven.cc/user/DeviateFish/collections/131464", count: 3066 }
].sort((a, b) => b.count - a.count);

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
  resolutions,
  ratios,
  colors,
  onResolutionsChange,
  onRatiosChange,
  onColorsChange,
  categoriesFilter,
  purityFilter,
  onCategoriesFilterChange,
  onPurityFilterChange,
}: ControlBarProps) {
  const [showPinterestSources, setShowPinterestSources] = useState(true);
  const [newPinUrl, setNewPinUrl] = useState("");
  const [pinAddStatus, setPinAddStatus] = useState<"idle" | "adding" | "added" | "duplicate">("idle");
  
  const [showWallhavenCollections, setShowWallhavenCollections] = useState(false);
  const [wallhavenUsername, setWallhavenUsername] = useState("");
  const [wallhavenCollections, setWallhavenCollections] = useState<any[]>([]);
  const [fetchingCollections, setFetchingCollections] = useState(false);
  const [batchDownloadModalOpen, setBatchDownloadModalOpen] = useState(false);

  const getHeatmapColor = (count: number, maxCount: number) => {
    if (maxCount === 0 || count === 0) return undefined;
    // Logarithmic scale avoids one massive collection making everything else blue
    const ratio = Math.log(count + 1) / Math.log(maxCount + 1);
    // Hue: 320 (Pink/Red/Hot) down to 220 (Blue/Cool)
    const hue = 220 + (100 * ratio);
    return `hsla(${hue}, 80%, 60%, ${0.15 + 0.5 * ratio})`;
  };
  const maxCollectionCount = wallhavenCollections.length > 0 ? Math.max(...wallhavenCollections.map((c: any) => c.count || 0)) : 0;

  const handleFetchWallhavenCollections = async () => {
    if (!wallhavenUsername.trim()) return;
    setFetchingCollections(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const resp = await invoke<string>("fetch_wallhaven_collections", { username: wallhavenUsername.trim() });
      const data = JSON.parse(resp);
      if (data && data.data) {
        let collections = data.data.map((c: any) => ({
          label: c.label,
          value: `https://wallhaven.cc/user/${wallhavenUsername.trim()}/collections/${c.id}`,
          count: c.count || 0
        }));
        // Sort highest count first
        collections.sort((a: any, b: any) => b.count - a.count);
        setWallhavenCollections(collections);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to fetch collections. Username might not exist.");
    } finally {
      setFetchingCollections(false);
    }
  };

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



  const handleQueryChange = (val: string) => {
    onQueryChange(val);
  };

  return (
    <div className="control-shell" style={{ marginTop: "4px", gap: "8px", padding: "10px 14px" }}>
      <div className="control-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
        <span className="eyebrow" style={{ color: "var(--accent)" }}>
          {source === "direct" ? "Direct Media Entry" : 
           source === "wallhaven" ? "WallHaven Static Feed" : 
           source === "pinterest" ? "Pinterest Static Feed" : 
           source === "wallpaperwaves" ? "Wallpaper Waves Live Feed" : 
           source === "alphacoders" ? "AlphaCoders Live Feed" : 
           "Discover Unified Feed"}
        </span>
      </div>

      {source !== "direct" && (
        <div className="source-selector" style={{ 
          display: "flex", 
          flexWrap: "wrap",
          gap: "6px", 
          background: "rgba(0, 0, 0, 0.25)", 
          padding: "4px", 
          borderRadius: "8px",
          border: "1px solid rgba(255, 255, 255, 0.05)",
          marginBottom: "12px"
        }}>
          {[
            { id: "unified", label: "🎥 Unified Live", desc: "Combined live loops" },
            { id: "alphacoders", label: "🎬 AlphaCoders", desc: "Live video loops" },
            { id: "wallpaperwaves", label: "🌊 WP Waves", desc: "Premium loops" },
            { id: "wallhaven", label: "🖼️ WallHaven", desc: "Premium static images" },
            { id: "pinterest", label: "📌 Pinterest", desc: "Art & static designs" }
          ].map((src) => (
            <button
              key={src.id}
              type="button"
              className={`action-btn ${source === src.id ? "action-btn--filter-active" : "action-btn--ghost"}`}
              style={{ 
                flex: "1 1 120px", 
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

      {/* Inline Wallhaven Collections Manager — visible when Wallhaven is active source */}
      {source === "wallhaven" && (
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
            onClick={() => setShowWallhavenCollections(!showWallhavenCollections)}
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
              <span style={{ fontSize: "14px" }}>🖼️</span>
              <span style={{ fontSize: "12px", fontWeight: 600 }}>Wallhaven Collections</span>
              <span style={{
                fontSize: "10px",
                background: wallhavenCollections.length > 0 ? "var(--accent-soft)" : "rgba(255,99,99,0.15)",
                color: wallhavenCollections.length > 0 ? "var(--accent)" : "rgba(255,99,99,0.9)",
                padding: "2px 8px",
                borderRadius: "99px",
                fontWeight: 700
              }}>
                {wallhavenCollections.length} found
              </span>
            </div>
            <span style={{
              fontSize: "10px",
              opacity: 0.5,
              transform: showWallhavenCollections ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease"
            }}>▼</span>
          </button>

          {/* Expandable Content */}
          {showWallhavenCollections && (
            <div style={{ padding: "0 14px 14px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* Fetch form */}
              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  type="text"
                  className="input input--hud"
                  placeholder="Enter a Wallhaven Username..."
                  value={wallhavenUsername}
                  onChange={(e) => setWallhavenUsername(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleFetchWallhavenCollections(); }}
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
                  onClick={handleFetchWallhavenCollections}
                  disabled={fetchingCollections}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    background: "var(--accent)",
                    color: "#000",
                    fontWeight: "bold",
                    border: "none",
                    fontSize: "11px",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap"
                  }}
                >
                  {fetchingCollections ? "Fetching..." : "Fetch User"}
                </button>
              </div>
              {/* Quick tip */}
              <span style={{ fontSize: "9px", opacity: 0.4, fontStyle: "italic" }}>
                Tip: Enter a Wallhaven username to dynamically load all their public collections as categories below.
              </span>
            </div>
          )}
        </div>
      )}

      <DisplaySelector />

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
            {source === "wallhaven" ? (
              [{label: "All", value: "all", count: 0}, ...wallhavenCollections].map((cat) => {
                const isActive = (category || "all").toLowerCase() === cat.value.toLowerCase();
                const heatmapColor = (!isActive && cat.count) ? getHeatmapColor(cat.count, maxCollectionCount) : undefined;
                return (
                  <button
                    key={cat.label}
                    type="button"
                    className={`pill ${isActive ? "" : "pill--muted"}`}
                    style={{ 
                      padding: "6px 14px", 
                      cursor: "pointer", 
                      border: "none", 
                      whiteSpace: "nowrap", 
                      minWidth: "fit-content",
                      background: heatmapColor,
                      color: heatmapColor ? "#fff" : undefined
                    }}
                    onClick={() => onCategoryChange && onCategoryChange(cat.value)}
                  >
                    {cat.label} {cat.count ? `(${cat.count.toLocaleString()})` : ''}
                  </button>
                );
              })
            ) : (source === "wallpaperwaves" ? WALLPAPERWAVES_CATEGORIES : CATEGORIES).map((cat) => (
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
          
          {source === "wallhaven" && category.startsWith("http") && (
            <div style={{ marginTop: "4px", marginBottom: "12px", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="action-btn action-btn--secondary"
                style={{ padding: "4px 12px", fontSize: "11px", gap: "6px" }}
                onClick={() => setBatchDownloadModalOpen(true)}
              >
                ⬇️ Batch Download Collection
              </button>
            </div>
          )}
          
          {!category.startsWith("http") && source !== "direct" && source !== "youtube" && (
            <AdvancedFilters 
              resolutionFilter={resolutions || null}
              ratioFilter={ratios || null}
              colorFilter={colors || null}
              onResolutionChange={onResolutionsChange || (() => {})}
              onRatioChange={onRatiosChange || (() => {})}
              onColorChange={onColorsChange || (() => {})}
              categoriesFilter={categoriesFilter}
              purityFilter={purityFilter}
              onCategoriesChange={onCategoriesFilterChange}
              onPurityChange={onPurityFilterChange}
              showColorFilter={true}
            />
          )}
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

      {batchDownloadModalOpen && (
        <BatchDownloadModal
          collectionUrl={category}
          collectionName={wallhavenCollections.find(c => c.value === category)?.label || "Wallhaven Collection"}
          onClose={() => setBatchDownloadModalOpen(false)}
        />
      )}
    </div>
  );
}
