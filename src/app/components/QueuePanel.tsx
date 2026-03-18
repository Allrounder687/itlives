"use client";

import { formatSavedAt } from "./LibraryList";

interface QueuePanelProps {
  wallpaper: any; // mapping wallpaper module from hook feeds.
}

export function QueuePanel({ wallpaper }: QueuePanelProps) {
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
            <article className="library-item" key={`${item.video.id}:${item.video.local_path}`}>
              <div className="library-item__copy">
                <strong>{index + 1}. {item.video.id}</strong>
                <span>{item.video.source.toUpperCase()} - queued {formatSavedAt(item.saved_at)}</span>
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
