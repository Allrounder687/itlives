"use client";

import { LibraryItem } from "@/hooks/useWallpaper";
import { HoverVideo } from "./HoverVideo";

interface LibraryListProps {
  title: string;
  empty: string;
  items: LibraryItem[];
  favoriteIds: Set<string>;
  queueIds: Set<string>;
  onApply: (item: LibraryItem) => void;
  onPreview: (item: LibraryItem) => void;
  onToggleFavorite: (item: LibraryItem) => void;
  onToggleQueue: (item: LibraryItem) => void;
  onRemove?: (item: LibraryItem) => void;
}

export function formatSavedAt(timestamp: number) {
  if (!timestamp) {
    return "Saved";
  }

  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function LibraryList({
  title,
  empty,
  items,
  onApply,
  onPreview,
  onToggleFavorite,
  onToggleQueue,
  onRemove,
  favoriteIds,
  queueIds,
}: LibraryListProps) {
  return (
    <div className="library-card panel">
      <div className="section-head">
        <span className="eyebrow">Library</span>
        <h2>{title}</h2>
      </div>

      {items.length === 0 ? (
        <p className="library-empty">{empty}</p>
      ) : (
        <div className="library-list">
          {items.map((item) => {
            const key = `${item.video.id}:${item.video.local_path}`;
            const isFavorite = favoriteIds.has(key);
            const isQueued = queueIds.has(key);

            return (
              <article className="library-item" key={key}>
                <div className="library-item__left">
                  <div className="library-item__thumb">
                    <HoverVideo video={item.video} onClick={() => onPreview(item)} />
                  </div>
                  <div className="library-item__copy">
                    <strong>{item.video.id.replace(/-/g, " ")}</strong>
                    <span>{item.video.source.toUpperCase()} - {formatSavedAt(item.saved_at)}</span>
                  </div>
                </div>
                <div className="library-item__actions">
                  {onRemove && (
                    <button 
                      type="button" 
                      className="icon-btn icon-btn--danger" 
                      onClick={() => onRemove(item)}
                      title="Remove from Recents"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  )}
                  {onToggleFavorite && (
                    <button 
                      type="button" 
                      className={`icon-btn ${isFavorite ? "icon-btn--active" : ""}`} 
                      onClick={() => onToggleFavorite(item)}
                      title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                    >
                      {isFavorite ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                      )}
                    </button>
                  )}
                  <button 
                    type="button" 
                    className={`icon-btn ${isQueued ? "icon-btn--active" : ""}`} 
                    onClick={() => onToggleQueue(item)}
                    title={isQueued ? "Remove from Queue" : "Add to Queue"}
                  >
                    {isQueued ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                    )}
                  </button>
                  <button 
                    type="button" 
                    className="icon-btn icon-btn--accent" 
                    onClick={() => onApply(item)}
                    title="Apply Wallpaper"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ImportedLibraryListProps {
  items: LibraryItem[];
  queueIds: Set<string>;
  onApply: (item: LibraryItem) => void;
  onPreview: (item: LibraryItem) => void;
  onRemove: (item: LibraryItem) => void;
  onToggleQueue: (item: LibraryItem) => void;
}

export function ImportedLibraryList({
  items,
  onApply,
  onPreview,
  onRemove,
  onToggleQueue,
  queueIds,
}: ImportedLibraryListProps) {
  return (
    <div className="library-card panel">
      <div className="section-head">
        <span className="eyebrow">Local Files</span>
        <h2>Imported Videos</h2>
      </div>

      {items.length === 0 ? (
        <p className="library-empty">Use Browse Local Video to build a reusable local wallpaper library.</p>
      ) : (
        <div className="library-list">
          {items.map((item) => {
            const key = `${item.video.id}:${item.video.local_path}`;
            const isQueued = queueIds.has(key);

            return (
              <article className="library-item" key={key}>
                <div className="library-item__left">
                  <div className="library-item__thumb">
                    <HoverVideo video={item.video} onClick={() => onPreview(item)} />
                  </div>
                  <div className="library-item__copy">
                    <strong>{item.video.id.replace(/-/g, " ")}</strong>
                    <span>{item.video.local_path}</span>
                  </div>
                </div>
                <div className="library-item__actions">
                  <button 
                    type="button" 
                    className="icon-btn icon-btn--danger" 
                    onClick={() => onRemove(item)}
                    title="Remove Local File"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                  <button 
                    type="button" 
                    className={`icon-btn ${isQueued ? "icon-btn--active" : ""}`} 
                    onClick={() => onToggleQueue(item)}
                    title={isQueued ? "Remove from Queue" : "Add to Queue"}
                  >
                    {isQueued ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                    )}
                  </button>
                  <button 
                    type="button" 
                    className="icon-btn icon-btn--accent" 
                    onClick={() => onApply(item)}
                    title="Apply Wallpaper"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
