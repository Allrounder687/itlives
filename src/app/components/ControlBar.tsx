"use client";

interface ControlBarProps {
  source: string;
  query: string;
  isLoading: boolean;
  onSourceChange: (source: string) => void;
  onQueryChange: (query: string) => void;
  onCategoryChange?: (category: string) => void;
  onBrowseLocalFile: () => void;
  onFetch: () => void;
  onFetchAndApply: () => void;
  onStop: () => void;
}

const SOURCES = [
  { value: "motionbgs", label: "MotionBGs" },
  { value: "redgifs", label: "RedGIFs" },
  { value: "direct", label: "Direct URL / File" },
];

const CATEGORIES = [
  "Anime", "Games", "Superhero", "Nature", "Car", "Tv", "Holiday", "Animal", "Fantasy", "Space", "Horror", "Technology", "Football", "Japan"
];

export function ControlBar({
  source,
  query,
  isLoading,
  onSourceChange,
  onQueryChange,
  onCategoryChange,
  onBrowseLocalFile,
  onFetch,
  onFetchAndApply,
  onStop,
}: ControlBarProps) {
  return (
    <div className="control-shell">
      <div className="source-pills">
        {SOURCES.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`source-pill ${source === item.value ? "source-pill--active" : ""}`}
            onClick={() => onSourceChange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="control-grid">
        <label className="field">
          <span className="field__label">Source Mode</span>
          <select
            className="input input--select"
            value={source}
            onChange={(e) => onSourceChange(e.target.value)}
          >
            {SOURCES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field field--wide">
          <span className="field__label">
            {source === "direct" ? "Video URL or local path" : "Search query"}
          </span>
          <input
            className="input"
            type="text"
            placeholder={source === "direct" ? "Paste an .mp4 URL or local file path" : "Search clips..."}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onFetchAndApply();
              }
            }}
          />
          {source === "direct" && (
            <div className="direct-file-row">
              <button
                type="button"
                className="action-btn action-btn--secondary"
                onClick={onBrowseLocalFile}
                disabled={isLoading}
              >
                Browse Local Video
              </button>
              <span className="field__hint">
                Uses the native Windows file picker and fills the selected path automatically.
              </span>
            </div>
          )}
        </label>
      </div>

      {source === "motionbgs" && (
        <div className="categories-row" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1rem", marginBottom: "1rem" }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className="source-pill"
              style={{ padding: "0.25rem 0.75rem", fontSize: "0.8rem" }}
              onClick={() => onCategoryChange && onCategoryChange(cat.toLowerCase())}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="action-row">
        <button className="action-btn action-btn--primary" onClick={onFetchAndApply} disabled={isLoading}>
          {isLoading ? "Loading..." : "Fetch and Play"}
        </button>

        <button className="action-btn action-btn--secondary" onClick={onFetch} disabled={isLoading}>
          Preview Only
        </button>

        <button className="action-btn action-btn--ghost" onClick={onStop}>
          Stop Playback
        </button>
      </div>
    </div>
  );
}
