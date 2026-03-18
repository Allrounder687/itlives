"use client";

import { VideoResult } from "@/hooks/useWallpaper";

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
    <div className="search-results-panel panel">
      <div className="section-head">
        <span className="eyebrow">Search Discovery</span>
        <h2>Provider Results ({results.length})</h2>
      </div>

      <div className="search-grid">
        {results.map((item) => (
          <article 
            key={`${item.source}:${item.id}`} 
            className="search-card"
            onClick={() => onSelect(item)}
          >
            <div className="search-card__media">
              {item.thumbnail_url ? (
                <img src={item.thumbnail_url} alt={item.id} className="search-card__thumb" />
              ) : (
                <div className="search-card__thumb-placeholder">No Thumbnail</div>
              )}
            </div>
            <div className="search-card__copy">
              <strong>{item.id.replace(/-/g, " ")}</strong>
              <span>{item.source.toUpperCase()}</span>
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
