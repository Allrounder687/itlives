"use client";

import { useState, memo, useEffect } from "react";
import { getCoreApi } from "@/utils/tauriApis";
import { LibraryItem } from "@/hooks/useWallpaper";
import { isStaticWallpaper, formatVideoTitle } from "@/utils/wallpaperTypes";
import { HoverVideo } from "./HoverVideo";

interface UnifiedLibraryProps {
  favorites: LibraryItem[];
  recents: LibraryItem[];
  imports: LibraryItem[];
  favoriteIds: Set<string>;
  queueIds: Set<string>;
  hiddenVideos: string[];
  onApply: (item: LibraryItem) => void;
  onPreview: (item: LibraryItem) => void;
  onToggleFavorite: (item: LibraryItem) => void;
  onToggleQueue: (item: LibraryItem) => void;
  onRemoveRecent?: (item: LibraryItem) => void;
  onRemoveImport?: (item: LibraryItem) => void;
  onUploadMedia?: () => void;
  onApplyOverlay?: (item: LibraryItem) => void;
}

export function formatSavedAt(timestamp: number) {
  if (!timestamp) return "Saved";
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const UnifiedLibrary = memo(function UnifiedLibrary({
  favorites,
  recents,
  imports,
  favoriteIds,
  queueIds,
  hiddenVideos,
  onApply,
  onPreview,
  onToggleFavorite,
  onToggleQueue,
  onRemoveRecent,
  onRemoveImport,
  onUploadMedia,
  onApplyOverlay,
}: UnifiedLibraryProps) {
  const [filter, setFilter] = useState<"all" | "favorites" | "recents" | "local" | "interactive" | "icon_physics">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "live" | "static">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [interactives, setInteractives] = useState<LibraryItem[]>([]);

  useEffect(() => {
    getCoreApi().then(({ invoke }) => {
      invoke<any[]>("get_builtin_interactives")
        .then(async (items) => {
          const interactivesList = await Promise.all(items.map(async (video) => {
            let saved_at = Date.now() / 1000;
            if (video.local_path) {
              try {
                saved_at = await invoke<number>("get_file_modified_time", { path: video.local_path });
              } catch (e) {
                console.error("Failed to get modified time", e);
              }
            }
            return { video, saved_at } as LibraryItem;
          }));
          setInteractives(interactivesList);
        })
        .catch(console.error);
    });
  }, []);

  const getCombinedItems = () => {
    const map = new Map<string, LibraryItem & { isFavorite?: boolean; isRecent?: boolean; isLocal?: boolean }>();

    favorites.forEach(item => {
      const key = `${item.video.id}:${item.video.local_path}`;
      map.set(key, { ...item, isFavorite: true, saved_at: item.saved_at || 0 });
    });

    recents.forEach(item => {
      const key = `${item.video.id}:${item.video.local_path}`;
      if (map.has(key)) {
        map.get(key)!.isRecent = true;
      } else {
        map.set(key, { ...item, isRecent: true, saved_at: item.saved_at || 0 });
      }
    });

    imports.forEach(item => {
      const key = `${item.video.id}:${item.video.local_path}`;
      if (map.has(key)) {
        map.get(key)!.isLocal = true;
      } else {
        map.set(key, { ...item, isLocal: true, saved_at: item.saved_at || 0 });
      }
    });

    interactives.forEach(item => {
      const key = `${item.video.id}:${item.video.local_path}`;
      if (!map.has(key)) {
        map.set(key, { ...item, isLocal: true, saved_at: item.saved_at || 0 });
      }
    });

    return Array.from(map.values()).sort((a, b) => (b.saved_at || 0) - (a.saved_at || 0));
  };

  const combinedItems = getCombinedItems();

  const filteredItems = combinedItems.filter(item => {
    if (searchQuery && !formatVideoTitle(item.video.id, item.video.local_path || item.video.video_url).toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filter === "favorites" && !item.isFavorite) return false;
    if (filter === "recents" && !item.isRecent) return false;
    if (filter === "local" && !item.isLocal && item.video.source !== "interactive") return false;
    if (filter === "interactive" && item.video.source !== "interactive") return false;
    if (filter === "icon_physics" && !(item.video.tags && item.video.tags.includes("icon_physics"))) return false;

    if (hiddenVideos.includes(item.video.id)) return false;

    if (typeFilter === "all") return true;
    const isStatic = isStaticWallpaper(item.video);
    return typeFilter === "static" ? isStatic : !isStatic;
  });

  const [gridSize, setGridSize] = useState<"S" | "M" | "L" | "XL" | "XXL">("M");

  return (
    <div className="library-card panel" style={{ marginTop: "1rem", flex: 1 }}>
      <div className="section-head" style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <span className="eyebrow">User Space</span>
          <h2>Wallpaper Library</h2>
        </div>
        {onUploadMedia && (
          <button
            type="button"
            className="action-btn action-btn--primary"
            style={{ padding: "8px 16px", borderRadius: "8px", fontWeight: 600 }}
            onClick={onUploadMedia}
          >
            + Add Local File
          </button>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", flex: 1, alignItems: "center" }}>
          
          <div className="search-input-wrapper" style={{ position: "relative", minWidth: "200px" }}>
            <svg style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input 
              type="text" 
              className="input" 
              placeholder="Search library..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: "34px", paddingRight: "12px", width: "100%", height: "34px", borderRadius: "8px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>

          <div className="library-filter-bar" style={{ marginBottom: 0 }}>
            {(["all", "favorites", "recents", "local", "interactive", "icon_physics"] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`library-filter-btn ${filter === f ? "library-filter-btn--active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "icon_physics" ? "Icon Physics" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div className="library-filter-bar" style={{ marginBottom: 0 }}>
            {(["all", "live", "static"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`library-filter-btn ${typeFilter === t ? "library-filter-btn--active" : ""}`}
                onClick={() => setTypeFilter(t)}
              >
                {t === "all" ? "All Types" : t === "live" ? "Live" : "Static"}
              </button>
            ))}
          </div>
        </div>

        <div className="library-filter-bar" style={{ marginBottom: 0 }}>
          {(["S", "M", "L", "XL", "XXL"] as const).map((size) => (
            <button
              key={size}
              type="button"
              className={`library-filter-btn ${gridSize === size ? "library-filter-btn--active" : ""}`}
              onClick={() => setGridSize(size)}
              style={{ padding: "6px 12px" }}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <p className="library-empty">No wallpapers found in {filter} view {typeFilter !== "all" ? `(${typeFilter} filter active)` : ""}.</p>
      ) : (
        <div className={`library-grid-view library-grid-view--${gridSize.toLowerCase()}`}>
          {filteredItems.map((item, index) => {
            const key = `${item.video.id}:${item.video.local_path}`;
            const isFavorite = favoriteIds.has(key);
            const isQueued = queueIds.has(key);

            return (
              <article className="library-card-item" key={key}>
                <div className="library-card-item__media">
                  <HoverVideo video={item.video} gridSize={gridSize} onClick={() => onPreview(item)} priority={index < 8} />

                  <div className="library-card-item__actions">
                    {onRemoveRecent && item.isRecent && (
                      <button
                        type="button"
                        className="icon-btn icon-btn--danger"
                        onClick={(e) => { e.stopPropagation(); onRemoveRecent(item); }}
                        title="Remove from Recents"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    )}
                    {onRemoveImport && item.isLocal && !item.isRecent && !item.isFavorite && (
                      <button
                        type="button"
                        className="icon-btn icon-btn--danger"
                        onClick={(e) => { e.stopPropagation(); onRemoveImport(item); }}
                        title="Remove Local File"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    )}
                    {onToggleFavorite && (
                      <button
                        type="button"
                        className={`icon-btn ${isFavorite ? "icon-btn--active" : ""}`}
                        onClick={(e) => { e.stopPropagation(); onToggleFavorite(item); }}
                        title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                      >
                        {isFavorite ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      className={`icon-btn ${isQueued ? "icon-btn--active" : ""}`}
                      onClick={(e) => { e.stopPropagation(); onToggleQueue(item); }}
                      title={isQueued ? "Remove from Queue" : "Add to Queue"}
                    >
                      {isQueued ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                      )}
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--accent"
                      onClick={(e) => { e.stopPropagation(); onApply(item); }}
                      title="Apply Wallpaper"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                    </button>
                    {onApplyOverlay && item.video.source === "interactive" && (
                      <button
                        type="button"
                        className="icon-btn"
                        style={{ color: "#00ffcc", border: "1px solid rgba(0,255,204,0.3)", borderRadius: "8px" }}
                        onClick={(e) => { e.stopPropagation(); onApplyOverlay(item); }}
                        title="Apply as Overlay"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                      </button>
                    )}
                  </div>
                </div>

                <div className="library-card-item__copy" style={{ padding: "10px 12px", background: "rgba(0,0,0,0.3)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <strong style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: "13px", fontWeight: 600, color: "#fff" }} title={formatVideoTitle(item.video.id, item.video.local_path || item.video.video_url)}>
                      {formatVideoTitle(item.video.id, item.video.local_path || item.video.video_url)}
                    </strong>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                    {item.saved_at > 0 && (Date.now() / 1000 - item.saved_at) < (3 * 24 * 60 * 60) && (
                      <span style={{ padding: "2px 6px", fontSize: "9px", backgroundColor: "var(--accent)", color: "#000", borderRadius: "4px", fontWeight: 700, letterSpacing: "0.5px" }}>NEW</span>
                    )}
                    {item.video.width > 0 && (
                      <span style={{ padding: "2px 6px", fontSize: "9px", backgroundColor: "rgba(255,255,255,0.1)", color: "#eee", borderRadius: "4px", fontWeight: 500, letterSpacing: "0.5px" }}>
                        {item.video.width >= 3840 ? "4K" : item.video.width >= 1920 ? "1080p" : item.video.width >= 1280 ? "720p" : `${item.video.width}p`}
                      </span>
                    )}
                    <span style={{ padding: "2px 6px", fontSize: "9px", backgroundColor: isStaticWallpaper(item.video) ? "rgba(100,200,255,0.15)" : "rgba(255,100,150,0.15)", color: isStaticWallpaper(item.video) ? "#8ae" : "#f8a", borderRadius: "4px", fontWeight: 500, letterSpacing: "0.5px" }}>
                      {isStaticWallpaper(item.video) ? "STATIC" : "LIVE"}
                    </span>
                    {item.video.local_path && (
                      <span style={{ padding: "2px 6px", fontSize: "9px", backgroundColor: "rgba(255,255,255,0.1)", color: "#aaa", borderRadius: "4px", fontWeight: 500, letterSpacing: "0.5px" }}>LOCAL</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
});
