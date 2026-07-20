"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { VideoResult, isStaticWallpaper, formatVideoTitle } from "@/utils/wallpaperTypes";
import { HoverVideo } from "./HoverVideo";

interface SearchResultsProps {
  results: VideoResult[];
  onSelect: (video: VideoResult) => void;
  onEditEffects?: (video: VideoResult) => void;
  page: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  hasMore: boolean;
  duplicateNotice?: string | null;
}

export const SearchResults = memo(function SearchResults({ 
  results, 
  onSelect, 
  onEditEffects,
  page, 
  onPageChange, 
  isLoading, 
  hasMore, 
  duplicateNotice 
}: SearchResultsProps) {
  const [typeFilter, setTypeFilter] = useState<"all" | "live" | "static">("all");
  const [gridSize, setGridSize] = useState<"S" | "M" | "L" | "XL" | "XXL">("M");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [isDownloadingSelection, setIsDownloadingSelection] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  // IntersectionObserver to auto-trigger the next page request 250px before reaching bottom
  useEffect(() => {
    const target = observerTarget.current;
    if (!target || isLoading || !hasMore || results.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onPageChange(page + 1);
        }
      },
      {
        rootMargin: "250px",
      }
    );

    observer.observe(target);
    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [page, onPageChange, isLoading, hasMore, results.length]);

  const handleCardClick = useCallback((item: VideoResult) => {
    if (isSelectionMode) {
      setSelectedUrls((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(item.video_url)) {
          newSet.delete(item.video_url);
        } else {
          newSet.add(item.video_url);
        }
        return newSet;
      });
    } else {
      onSelect(item);
    }
  }, [isSelectionMode, onSelect]);

  if (results.length === 0) {
    return null;
  }

  const filteredResults = results.filter((item) => {
    if (typeFilter === "all") return true;
    const isStatic = isStaticWallpaper(item);
    return typeFilter === "static" ? isStatic : !isStatic;
  });

  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      setSelectedUrls(new Set());
    }
    setIsSelectionMode(!isSelectionMode);
  };

  const handleBatchDownload = async () => {
    if (selectedUrls.size === 0) return;
    
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { invoke } = await import("@tauri-apps/api/core");
      
      const targetDir = await open({
        directory: true,
        multiple: false,
        title: "Select Download Destination"
      });

      if (targetDir && typeof targetDir === "string") {
        setIsDownloadingSelection(true);
        await invoke("start_wallhaven_selection_download", {
          urls: Array.from(selectedUrls),
          targetDir
        });
        setIsDownloadingSelection(false);
        setIsSelectionMode(false);
        setSelectedUrls(new Set());
        alert("Batch download completed!");
      }
    } catch (e) {
      console.error(e);
      alert("Error starting batch download: " + e);
      setIsDownloadingSelection(false);
    }
  };

  return (
    <div style={{ marginTop: "1rem", position: "relative" }}>
      {/* Duplicates Prevention Alert Notice */}
      {duplicateNotice && (
        <div 
          className="callout callout--warning animate-pulse" 
          style={{ 
            margin: "0.5rem 0 1.25rem 0", 
            padding: "10px 14px", 
            borderRadius: "8px", 
            background: "rgba(255, 170, 0, 0.08)", 
            border: "1px solid rgba(255, 170, 0, 0.2)",
            fontSize: "11px",
            color: "rgba(255, 200, 100, 0.95)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 4px 12px rgba(255,170,0,0.05)"
          }}
        >
          <span style={{ fontSize: "14px" }}>⚠️</span>
          <strong>System Notice:</strong>
          <span>{duplicateNotice}</span>
        </div>
      )}

      <div className="discover-toolbar">
        <div className="discover-toolbar-group">
          <div className="library-filter-bar">
            {(["all", "live", "static"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`library-filter-btn ${typeFilter === t ? "library-filter-btn--active" : ""}`}
                onClick={() => setTypeFilter(t)}
              >
                {t === "all" ? "All" : t === "live" ? "Live" : "Static"}
              </button>
            ))}
          </div>
          <span className="discover-toolbar-text">
            Showing {filteredResults.length} of {results.length} search results
          </span>
        </div>

        <div className="discover-toolbar-group">
          <button
            type="button"
            className={`action-btn ${isSelectionMode ? 'action-btn--primary' : 'action-btn--ghost'}`}
            onClick={toggleSelectionMode}
            style={{ padding: "6px 12px", fontSize: "11px" }}
          >
            {isSelectionMode ? "Cancel Selection" : "Selection Mode"}
          </button>
          <div className="library-filter-bar">
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
      </div>

      {filteredResults.length === 0 ? (
        <p className="library-empty" style={{ margin: "2rem 0" }}>No wallpapers match the selected filter.</p>
      ) : (
        <div className={`search-grid search-grid--${gridSize.toLowerCase()}`}>
          {filteredResults.map((item, index) => (
            <SearchCard
              key={`${item.source}:${item.id}:${item.video_url}`}
              item={item}
              isSelected={selectedUrls.has(item.video_url)}
              isSelectionMode={isSelectionMode}
              gridSize={gridSize}
              onClick={handleCardClick}
              onEditEffects={onEditEffects}
              priority={index < 8}
            />
          ))}
        </div>
      )}

      {/* Infinite Scroll Sentinel and Status Loader */}
      <div 
        ref={observerTarget} 
        style={{ 
          display: "flex", 
          flexDirection: "column",
          alignItems: "center", 
          justifyContent: "center", 
          padding: "2.5rem 0",
          minHeight: "60px",
          width: "100%"
        }}
      >
        {isLoading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <div 
              className="hud-pulse-ring" 
              style={{ 
                width: "28px", 
                height: "28px", 
                borderRadius: "50%", 
                border: "2px dashed var(--accent)", 
                animation: "spin 2s linear infinite" 
              }} 
            />
            <span className="eyebrow" style={{ color: "var(--text-soft)", fontSize: "9px", letterSpacing: "0.12em" }}>
              Synthesizing More Scenes...
            </span>
          </div>
        )}

        {!hasMore && results.length > 0 && (
          <div 
            style={{ 
              color: "var(--text-dim)", 
              fontSize: "10px", 
              letterSpacing: "0.18em", 
              textTransform: "uppercase",
              borderTop: "1px solid rgba(255, 255, 255, 0.04)",
              width: "100%",
              textAlign: "center",
              paddingTop: "2.5rem",
              marginTop: "1.5rem"
            }}
          >
            ─ End of Scene Database ─
          </div>
        )}
      </div>

      {isSelectionMode && (
        <div style={{
          position: "fixed",
          bottom: "30px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(10, 10, 10, 0.85)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
          borderRadius: "99px",
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          zIndex: 1000,
          animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
        }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "white", paddingLeft: "12px" }}>
            {selectedUrls.size} Selected
          </span>
          <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.1)" }} />
          <button
            type="button"
            className="action-btn action-btn--primary"
            disabled={selectedUrls.size === 0 || isDownloadingSelection}
            onClick={handleBatchDownload}
            style={{ borderRadius: "99px", padding: "8px 20px" }}
          >
            {isDownloadingSelection ? "Downloading..." : `Download Selected`}
          </button>
        </div>
      )}
    </div>
  );
});

const SearchCard = memo(function SearchCard({
  item,
  isSelected,
  isSelectionMode,
  gridSize,
  onClick,
  onEditEffects,
  priority,
}: {
  item: VideoResult;
  isSelected: boolean;
  isSelectionMode: boolean;
  gridSize: "S" | "M" | "L" | "XL" | "XXL";
  onClick: (item: VideoResult) => void;
  onEditEffects?: (item: VideoResult) => void;
  priority?: boolean;
}) {
  const handleCardClick = () => {
    onClick(item);
  };

  return (
    <article className={`search-card ${isSelected ? 'search-card--selected' : ''}`}>
      <div className="search-card__media" style={{ position: "relative" }}>
        <HoverVideo video={item} gridSize={gridSize} onClick={handleCardClick} priority={priority} />
        
        {isSelectionMode && (
          <div style={{
            position: "absolute",
            top: "8px",
            left: "8px",
            width: "20px",
            height: "20px",
            borderRadius: "4px",
            border: `2px solid ${isSelected ? "var(--accent)" : "rgba(255,255,255,0.4)"}`,
            background: isSelected ? "var(--accent)" : "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
            pointerEvents: "none"
          }}>
            {isSelected && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
          </div>
        )}

        {/* Edit Effects Action Button */}
        {onEditEffects && (
          <div className="search-card__edit-btn-wrapper">
            <button 
              type="button" 
              className="action-btn action-btn--secondary search-card__edit-btn"
              title="Edit Effects"
              style={{ padding: "8px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%" }}
              onClick={(e) => {
                e.stopPropagation();
                onEditEffects(item);
              }}
            >
              ✨
            </button>
          </div>
        )}

        {!isSelectionMode && (
          <button
            type="button"
            className="search-card__download-btn"
            title="Download Image"
            onClick={async (e) => {
              e.stopPropagation();
              const btn = e.currentTarget;
              try {
                const { save } = await import("@tauri-apps/plugin-dialog");
                const { invoke } = await import("@tauri-apps/api/core");
                const ext = item.video_url.split('.').pop() || 'jpg';
                const targetPath = await save({
                  title: "Save Image As",
                  defaultPath: `wallhaven_${item.id}.${ext}`,
                  filters: [{ name: 'Image', extensions: [ext] }]
                });
                if (targetPath) {
                  const originalHtml = btn.innerHTML;
                  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style="animation: spin 2s linear infinite"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>`;
                  await invoke("download_single_file", { url: item.video_url, targetPath });
                  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                  setTimeout(() => { btn.innerHTML = originalHtml; }, 2000);
                }
              } catch (err) {
                alert("Download failed: " + err);
              }
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
        )}
      </div>
      <div className="search-card__copy">
        <strong className="search-card__title" title={formatVideoTitle(item.id, item.local_path || item.video_url)}>
          {formatVideoTitle(item.id, item.local_path || item.video_url)}
        </strong>
        <div className="search-card__tags">
          <span className={`search-card__tag search-card__tag--${isStaticWallpaper(item) ? "static" : "live"}`}>
            {isStaticWallpaper(item) ? "STATIC" : "LIVE"}
          </span>
          {item.width > 0 && (
            <span className="search-card__tag search-card__tag--res">
              {item.width >= 3840 ? "4K" : item.width >= 1920 ? "1080p" : item.width >= 1280 ? "720p" : `${item.width}p`}
            </span>
          )}
        </div>
      </div>
    </article>
  );
});
