"use client";

import { useState, useEffect, useRef } from "react";
import { VideoResult, isStaticWallpaper } from "@/utils/wallpaperTypes";
import { HoverVideo } from "./HoverVideo";

interface SearchResultsProps {
  results: VideoResult[];
  onSelect: (video: VideoResult) => void;
  page: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  hasMore: boolean;
  duplicateNotice?: string | null;
}

export function SearchResults({ 
  results, 
  onSelect, 
  page, 
  onPageChange, 
  isLoading, 
  hasMore, 
  duplicateNotice 
}: SearchResultsProps) {
  const [typeFilter, setTypeFilter] = useState<"all" | "live" | "static">("all");
  const [gridSize, setGridSize] = useState<"S" | "M" | "L" | "XL" | "XXL">("M");
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

  if (results.length === 0) {
    return null;
  }

  const filteredResults = results.filter((item) => {
    if (typeFilter === "all") return true;
    const isStatic = isStaticWallpaper(item);
    return typeFilter === "static" ? isStatic : !isStatic;
  });

  return (
    <div style={{ marginTop: "1rem" }}>
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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <div className="library-filter-bar" style={{ marginBottom: 0 }}>
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
          <span className="eyebrow" style={{ color: "var(--text-soft)", fontSize: "10px" }}>
            Showing {filteredResults.length} of {results.length} search results
          </span>
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

      {filteredResults.length === 0 ? (
        <p className="library-empty" style={{ margin: "2rem 0" }}>No wallpapers match the selected filter.</p>
      ) : (
        <div className={`search-grid search-grid--${gridSize.toLowerCase()}`}>
          {filteredResults.map((item) => (
            <article 
              key={`${item.source}:${item.id}`} 
              className="search-card"
            >
              <div className="search-card__media">
                <HoverVideo video={item} onClick={() => onSelect(item)} />
              </div>
              <div className="search-card__copy">
                <strong>{/^[0-9-]+$/.test(item.id) ? "Live Wallpaper" : item.id.replace(/-/g, " ")}</strong>
                <span>{isStaticWallpaper(item) ? "STATIC IMAGE" : "LIVE WALLPAPER"}</span>
              </div>
            </article>
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
    </div>
  );
}
