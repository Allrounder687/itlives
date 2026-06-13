"use client";

import { useState } from "react";
import { formatSavedAt } from "./LibraryList";
import { isStaticWallpaper } from "@/utils/wallpaperTypes";
import { HoverVideo } from "./HoverVideo";

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
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            className="mini-btn mini-btn--primary"
            onClick={() => wallpaper.browseFolderToQueue()}
          >
            + Add Folder
          </button>
          <button
            type="button"
            className="mini-btn"
            disabled={wallpaper.queue.length === 0}
            onClick={() => wallpaper.clearQueue()}
          >
            Clear Queue
          </button>
        </div>
      </div>

      {wallpaper.queue.length === 0 ? (
        <p className="library-empty">Queue wallpapers from preview, recents, or favorites to play them.</p>
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
              <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%" }}>
                <div style={{ width: "64px", height: "38px", flexShrink: 0, borderRadius: "4px", overflow: "hidden", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                  <HoverVideo video={item.video} />
                </div>
                <div className="library-item__copy" style={{ pointerEvents: "none", flexGrow: 1 }}>
                  <strong>{index + 1}. {item.video.id}</strong>
                  <span>{isStaticWallpaper(item.video) ? "STATIC IMAGE" : "LIVE WALLPAPER"} - queued {formatSavedAt(item.saved_at)}</span>
                </div>
              </div>
              <div className="library-item__actions" style={{ flexShrink: 0, marginLeft: "12px" }}>
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
