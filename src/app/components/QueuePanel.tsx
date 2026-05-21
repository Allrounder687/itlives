"use client";

import { useState } from "react";
import { formatSavedAt } from "./LibraryList";

interface QueuePanelProps {
  wallpaper: any; // mapping wallpaper module from hook feeds.
}

export function QueuePanel({ wallpaper }: QueuePanelProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    wallpaper.reorderQueue(draggedIndex, targetIndex);
    setDraggedIndex(null);
  };

  return (
    <div className="panel queue-card">
      <div className="queue-card__head">
        <div className="section-head">
          <span className="eyebrow">Queue</span>
          <h2>Playback Order</h2>
        </div>
        <button
          type="button"
          className="mini-btn"
          disabled={wallpaper.queue.length === 0}
          onClick={() => wallpaper.clearQueue()}
        >
          Clear Queue
        </button>
      </div>

      {wallpaper.queue.length === 0 ? (
        <p className="library-empty">Queue wallpapers from preview, recents, or favorites to enable rotation.</p>
      ) : (
        <div className="library-list">
          {wallpaper.queue.map((item: any, index: number) => (
            <article 
              className="library-item" 
              key={`${item.video.id}:${item.video.local_path}`}
              draggable={true}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              style={{ 
                cursor: "move", 
                opacity: draggedIndex === index ? 0.3 : 1,
                border: draggedIndex !== null && draggedIndex !== index ? "1px dashed rgba(187, 255, 93, 0.3)" : "1px solid rgba(255,255,255,0.03)",
                transition: "opacity 0.2s ease"
              }}
            >
              <div className="library-item__copy" style={{ pointerEvents: "none" }}>
                <strong>{index + 1}. {item.video.id}</strong>
                <span>LIVE WALLPAPER - queued {formatSavedAt(item.saved_at)}</span>
              </div>
              <div className="library-item__actions">
                <button
                  type="button"
                  className="mini-btn mini-btn--accent"
                  onClick={() => wallpaper.applyWallpaper(item.video)}
                >
                  Play Now
                </button>
                <button
                  type="button"
                  className="mini-btn"
                  onClick={() => wallpaper.removeFromQueue(item.video)}
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
