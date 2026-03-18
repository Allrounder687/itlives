"use client";

import { useYouTube, YtMetaResult } from "@/hooks/useYouTube";

interface YouTubePanelProps {
  onApplyWallpaper: (video: any) => void;
  onStop: () => void;
  isPlaying: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function YouTubePanel({ onApplyWallpaper, onStop, isPlaying }: YouTubePanelProps) {
  const yt = useYouTube();
  const clipDuration = yt.endTime - yt.startTime;

  const handleFetchAndApply = async () => {
    const result = await yt.downloadClip();
    if (result) {
      onApplyWallpaper(result);
    }
  };

  return (
    <section className="panel panel--main yt-panel">
      <div className="section-head">
        <span className="eyebrow">YouTube Clip Extractor</span>
        <h2>Video to Wallpaper</h2>
      </div>

      {/* URL Input */}
      <div className="yt-url-row">
        <div className="field" style={{ flex: 1 }}>
          <span className="field__label">YouTube Video URL</span>
          <div className="input-group">
            <input
              className="input input--hud"
              type="text"
              placeholder="https://www.youtube.com/watch?v=..."
              value={yt.url}
              onChange={(e) => yt.setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") yt.fetchMeta();
              }}
            />
            <button
              type="button"
              className="action-btn action-btn--accent-ghost"
              onClick={yt.fetchMeta}
              disabled={yt.isLoadingMeta || yt.isDownloading}
            >
              {yt.isLoadingMeta ? "Loading..." : "Fetch Info"}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {yt.error && (
        <div className="callout callout--error">
          <span className="callout__label">Error</span>
          <p>{yt.error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {yt.isLoadingMeta && <div className="skeleton skeleton-preview" />}

      {/* Video Metadata + Time Slider */}
      {yt.meta && !yt.isLoadingMeta && (
        <div className="yt-clip-builder">
          {/* Thumbnail + Info */}
          <div className="yt-meta-card">
            {yt.meta.thumbnail_url && (
              <img
                className="yt-thumb"
                src={yt.meta.thumbnail_url}
                alt="Video thumbnail"
              />
            )}
            <div className="yt-meta-info">
              <div className="yt-meta-tag">
                <span className="eyebrow">ID</span>
                <strong>{yt.meta.id}</strong>
              </div>
              <div className="yt-meta-tag">
                <span className="eyebrow">Duration</span>
                <strong>{formatDuration(yt.meta.duration)}</strong>
              </div>
              <div className="yt-meta-tag">
                <span className="eyebrow">Resolution</span>
                <strong>{yt.meta.width}×{yt.meta.height}</strong>
              </div>
            </div>
          </div>

          {/* Dual Range Slider */}
          <div className="yt-range-section">
            <div className="yt-range-header">
              <span className="eyebrow">Clip Range</span>
              <span className="yt-clip-duration">
                {formatTime(yt.startTime)} → {formatTime(yt.endTime)} ({formatDuration(clipDuration)})
              </span>
            </div>

            <div className="yt-dual-slider">
              <div className="yt-slider-track">
                <div
                  className="yt-slider-fill"
                  style={{
                    left: `${(yt.startTime / yt.meta.duration) * 100}%`,
                    width: `${((yt.endTime - yt.startTime) / yt.meta.duration) * 100}%`,
                  }}
                />
              </div>
              <input
                type="range"
                className="yt-range-input yt-range-start"
                min={0}
                max={yt.meta.duration}
                step={0.5}
                value={yt.startTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (val < yt.endTime - 1) yt.setStartTime(val);
                }}
              />
              <input
                type="range"
                className="yt-range-input yt-range-end"
                min={0}
                max={yt.meta.duration}
                step={0.5}
                value={yt.endTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (val > yt.startTime + 1) yt.setEndTime(val);
                }}
              />
            </div>

            <div className="yt-range-labels">
              <span>0:00</span>
              <span>{formatDuration(yt.meta.duration)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="action-row action-row--hud">
            <button
              className="action-btn action-btn--primary"
              onClick={handleFetchAndApply}
              disabled={yt.isDownloading || clipDuration < 1}
            >
              {yt.isDownloading ? "Downloading..." : "Download & Apply"}
            </button>

            <button
              className="action-btn action-btn--secondary"
              onClick={yt.downloadClip}
              disabled={yt.isDownloading || clipDuration < 1}
            >
              {yt.isDownloading ? "Processing..." : "Download Only"}
            </button>

            {isPlaying && (
              <button className="action-btn action-btn--ghost" onClick={onStop}>
                Unload Engine
              </button>
            )}
          </div>

          {/* Download progress */}
          {yt.isDownloading && (
            <div className="yt-download-progress">
              <div className="yt-progress-bar">
                <div className="yt-progress-fill" />
              </div>
              <p className="muted">Downloading and trimming clip via yt-dlp...</p>
            </div>
          )}

          {/* Success */}
          {yt.downloadedVideo && !yt.isDownloading && (
            <div className="callout callout--success">
              <span className="callout__label">Clip Ready</span>
              <p>Downloaded {formatDuration(clipDuration)} clip successfully.</p>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!yt.meta && !yt.isLoadingMeta && !yt.error && (
        <div className="yt-empty-state">
          <div className="yt-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.13C5.12 19.56 12 19.56 12 19.56s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.43z" />
              <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
            </svg>
          </div>
          <h3>Paste a YouTube URL above</h3>
          <p className="muted">
            The extractor will fetch the video metadata and let you trim a clip range
            to download and set as your desktop wallpaper.
          </p>
        </div>
      )}
    </section>
  );
}
