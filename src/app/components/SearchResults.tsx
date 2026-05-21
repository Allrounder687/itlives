"use client";

import { VideoResult } from "@/hooks/useWallpaper";
import { HoverVideo } from "./HoverVideo";

interface SearchResultsProps {
  results: VideoResult[];
  onSelect: (video: VideoResult) => void;
  page: number;
  onPageChange: (page: number) => void;
}

export function SearchResults({ results, onSelect, page, onPageChange }: SearchResultsProps) {
  if (results.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="search-grid">
        {results.map((item) => (
          <article 
            key={`${item.source}:${item.id}`} 
            className="search-card"
          >
            <div className="search-card__media">
              <HoverVideo video={item} onClick={() => onSelect(item)} />
            </div>
            <div className="search-card__copy">
              <strong>{/^[0-9-]+$/.test(item.id) ? "Live Wallpaper" : item.id.replace(/-/g, " ")}</strong>
              <span>LIVE WALLPAPER</span>
            </div>
          </article>
        ))}
      </div>

      <div className="search-pagination" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", padding: "1rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <button 
          type="button" 
          className="mini-btn" 
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <span className="pagination-text">Page {page}</span>
        <button 
          type="button" 
          className="mini-btn" 
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
