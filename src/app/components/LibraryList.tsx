"use client";

import { useState, memo } from "react";
import { LibraryItem } from "@/hooks/useWallpaper";
import { isStaticWallpaper } from "@/utils/wallpaperTypes";
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
}: UnifiedLibraryProps) {
  const [filter, setFilter] = useState<"all" | "favorites" | "recents" | "local">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "live" | "static">("all");

  const getCombinedItems = () => {
    const map = new Map<string, LibraryItem & { isFavorite?: boolean; isRecent?: boolean; isLocal?: boolean }>();

    favorites.forEach(item => {
      const key = `${item.video.id}:${item.video.local_path}`;
      map.set(key, { ...item, isFavorite: true, saved_at: item.saved_at || Date.now() / 1000 });
    });

    recents.forEach(item => {
      const key = `${item.video.id}:${item.video.local_path}`;
      if (map.has(key)) {
        map.get(key)!.isRecent = true;
      } else {
        map.set(key, { ...item, isRecent: true, saved_at: item.saved_at || Date.now() / 1000 });
      }
    });

    imports.forEach(item => {
      const key = `${item.video.id}:${item.video.local_path}`;
      if (map.has(key)) {
        map.get(key)!.isLocal = true;
      } else {
        map.set(key, { ...item, isLocal: true, saved_at: item.saved_at || Date.now() / 1000 });
      }
    });

    return Array.from(map.values()).sort((a, b) => (b.saved_at || 0) - (a.saved_at || 0));
  };

  const combinedItems = getCombinedItems();

  const filteredItems = combinedItems.filter(item => {
    if (filter === "favorites" && !item.isFavorite) return false;
    if (filter === "recents" && !item.isRecent) return false;
    if (filter === "local" && !item.isLocal) return false;

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
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", flex: 1 }}>
          <div className="library-filter-bar" style={{ marginBottom: 0 }}>
            {(["all", "favorites", "recents", "local"] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`library-filter-btn ${filter === f ? "library-filter-btn--active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
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
                  </div>
                </div>

                <div className="library-card-item__copy">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <strong style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.video.id.replace(/-/g, " ")}</strong>
                    {item.video.width > 0 && (
                      <span className="quality-badge" style={{ padding: "1px 4px", fontSize: "8px" }}>
                        {item.video.width >= 3840 ? "4K" : item.video.width >= 1920 ? "1080p" : item.video.width >= 1280 ? "720p" : `${item.video.width}p`}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-soft)", marginTop: "1px" }}>
                    <span style={{ fontSize: "9px" }}>{isStaticWallpaper(item.video) ? "STATIC IMAGE" : "LIVE WALLPAPER"}{item.video.local_path ? " (Local)" : ""} - {formatSavedAt(item.saved_at)}</span>
                    {item.video.duration > 0 && <span style={{ fontSize: "9px" }}>{Math.floor(item.video.duration / 60)}m {Math.floor(item.video.duration % 60)}s</span>}
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
