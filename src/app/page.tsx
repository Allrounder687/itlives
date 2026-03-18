"use client";

import dynamic from "next/dynamic";
import { ChangeEvent, useState } from "react";
import { LibraryItem, useWallpaper } from "@/hooks/useWallpaper";
import { TitleBar } from "./components/TitleBar";
import { VideoPreview } from "./components/VideoPreview";
import { ControlBar } from "./components/ControlBar";
import { StatusBar } from "./components/StatusBar";
import { SearchResults } from "./components/SearchResults";
import { FloatingPreview } from "./components/FloatingPreview";

const FEATURE_CARDS = [
  {
    eyebrow: "Windowing",
    title: "Tray Resident Shell",
    text: "Close or minimize the frameless app into the tray without losing queue, restore, or wallpaper state.",
  },
  {
    eyebrow: "Diagnostics",
    title: "Guided Failure Hints",
    text: "Input validation and launch diagnostics now point at provider, permission, and desktop attach issues instead of generic failures.",
  },
];

const SOURCE_NOTES: Record<string, string> = {
  direct: "Use a direct MP4 URL or a local file path for the fastest desktop playback path.",
  redgifs: "Search and preview clips before applying them to the desktop background.",
  motionbgs: "Search and pull 4K animated dynamic desktop wallpapers automatically from MotionBGs.",
};

const FILTER_OPTIONS = [
  { value: "none", label: "None" },
  { value: "grayscale", label: "Grayscale" },
  { value: "vivid", label: "Vivid" },
  { value: "soft", label: "Soft" },
  { value: "noir", label: "Noir" },
  { value: "retro", label: "Retro" },
];

function formatSavedAt(timestamp: number) {
  if (!timestamp) {
    return "Saved";
  }

  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function LibraryList({
  title,
  empty,
  items,
  onApply,
  onToggleFavorite,
  onToggleQueue,
  favoriteIds,
  queueIds,
}: {
  title: string;
  empty: string;
  items: LibraryItem[];
  onApply: (item: LibraryItem) => void;
  onToggleFavorite: (item: LibraryItem) => void;
  onToggleQueue: (item: LibraryItem) => void;
  favoriteIds: Set<string>;
  queueIds: Set<string>;
}) {
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
                <div className="library-item__copy">
                  <strong>{item.video.id}</strong>
                  <span>{item.video.source.toUpperCase()} - {formatSavedAt(item.saved_at)}</span>
                </div>
                <div className="library-item__actions">
                  <button type="button" className="mini-btn" onClick={() => onToggleFavorite(item)}>
                    {isFavorite ? "Unsave" : "Save"}
                  </button>
                  <button type="button" className="mini-btn" onClick={() => onToggleQueue(item)}>
                    {isQueued ? "Queued" : "Queue"}
                  </button>
                  <button type="button" className="mini-btn mini-btn--accent" onClick={() => onApply(item)}>
                    Apply
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

function ImportedLibraryList({
  items,
  onApply,
  onRemove,
  onToggleQueue,
  queueIds,
}: {
  items: LibraryItem[];
  onApply: (item: LibraryItem) => void;
  onRemove: (item: LibraryItem) => void;
  onToggleQueue: (item: LibraryItem) => void;
  queueIds: Set<string>;
}) {
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
                <div className="library-item__copy">
                  <strong>{item.video.id}</strong>
                  <span>{item.video.local_path}</span>
                </div>
                <div className="library-item__actions">
                  <button type="button" className="mini-btn" onClick={() => onRemove(item)}>
                    Remove
                  </button>
                  <button type="button" className="mini-btn" onClick={() => onToggleQueue(item)}>
                    {isQueued ? "Queued" : "Queue"}
                  </button>
                  <button type="button" className="mini-btn mini-btn--accent" onClick={() => onApply(item)}>
                    Apply
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

function Home() {
  const wallpaper = useWallpaper();
  const [activeTab, setActiveTab] = useState<"studio" | "preview">("studio");

  const handleFetchAndApply = async () => {
    const result = await wallpaper.fetchVideo();
    if (result) {
      await wallpaper.applyWallpaper(result);
    }
  };

  const currentResolution = wallpaper.currentVideo
    ? `${wallpaper.currentVideo.width}x${wallpaper.currentVideo.height}`
    : "Awaiting media";

  const favoriteIds = new Set(
    wallpaper.favorites.map((item) => `${item.video.id}:${item.video.local_path}`),
  );
  const queueIds = new Set(
    wallpaper.queue.map((item) => `${item.video.id}:${item.video.local_path}`),
  );

  const toggleCurrentQueue = () => {
    if (!wallpaper.currentVideo) {
      return;
    }
    if (wallpaper.isQueued(wallpaper.currentVideo)) {
      void wallpaper.removeFromQueue(wallpaper.currentVideo);
    } else {
      void wallpaper.addToQueue(wallpaper.currentVideo);
    }
  };

  const onRotationIntervalChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    if (Number.isFinite(nextValue)) {
      void wallpaper.setRotationConfig(wallpaper.rotationEnabled, nextValue);
    }
  };

  const onWallpaperScaleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    if (Number.isFinite(nextValue)) {
      void wallpaper.setWallpaperScale(nextValue);
    }
  };

  const onWallpaperVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    if (Number.isFinite(nextValue)) {
      void wallpaper.setVolumePercent(nextValue);
    }
  };

  return (
    <div className="shell">
      <TitleBar minimizeToTray={wallpaper.minimizeToTray} />

      <div className="shell__backdrop" />

      <div className="shell__body">
        <aside className="sidebar panel">
          <div className="brand-block">
            <div className="brand-mark">OC</div>
            <div>
              <p className="eyebrow">OpenClaw Premium</p>
              <h1>Live Wallpaper Studio</h1>
              <p className="muted">
                Frameless desktop control plane for fetching, previewing, and deploying video wallpapers.
              </p>
            </div>
          </div>

          <div className="metric-stack">
            <div className="metric-card">
              <span className="metric-label">Engine</span>
              <strong>{wallpaper.isHydrating ? "Restoring" : wallpaper.isPlaying ? "Active" : "Idle"}</strong>
              <span className="metric-subtle">
                {wallpaper.currentVideo ? wallpaper.currentVideo.source.toUpperCase() : "No source locked"}
              </span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Canvas</span>
              <strong>{currentResolution}</strong>
              <span className="metric-subtle">Desktop playback surface</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Input Mode</span>
              <strong>{wallpaper.source === "direct" ? "Direct Media" : "Provider Search"}</strong>
              <span className="metric-subtle">{SOURCE_NOTES[wallpaper.source] ?? "Source ready"}</span>
            </div>
          </div>

          <div className="sidebar-section">
            <div className="section-head">
              <span className="eyebrow">Automation</span>
              <h2>Queue And Rotation Live</h2>
            </div>

            <div className="sidebar-list">
              <div className="sidebar-list__item">
                <span>Persistent playback queue</span>
                <span className="pill">Live</span>
              </div>
              <div className="sidebar-list__item">
                <span>Timed wallpaper rotation</span>
                <span className="pill">Live</span>
              </div>
              <div className="sidebar-list__item">
                <span>Favorites and recents</span>
                <span className="pill">Live</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="workspace">
          <section className="hero panel">
            <div className="hero__copy">
              <p className="eyebrow">Desktop Engine</p>
              <h2>Rotate queued wallpapers on a real playback schedule</h2>
              <p className="muted">
                Build a queue from previews, recents, or favorites, then let the app cycle through that stack automatically.
              </p>
            </div>

            <div className="hero__badges">
              <span className="hero-badge">Persistent Queue</span>
              <span className="hero-badge">Timed Rotation</span>
              <span className="hero-badge">Disk-backed State</span>
            </div>
          </section>

          <StatusBar
            isPlaying={wallpaper.isPlaying}
            currentVideo={wallpaper.currentVideo}
          />

          <section className="workspace-tabs panel">
            <div className="tab-strip" role="tablist" aria-label="Workspace views">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "studio"}
                className={`tab-btn${activeTab === "studio" ? " tab-btn--active" : ""}`}
                onClick={() => setActiveTab("studio")}
              >
                Studio
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "preview"}
                className={`tab-btn${activeTab === "preview" ? " tab-btn--active" : ""}`}
                onClick={() => setActiveTab("preview")}
              >
                Preview
              </button>
            </div>
            <p className="tab-caption">
              {activeTab === "studio"
                ? "Configure sources, queue rotation, and library actions."
                : "Dedicated playback view for the current wallpaper preview."}
            </p>
          </section>

          {activeTab === "studio" ? (
            <>
              <section className="panel panel--main">
                <div className="section-head">
                  <span className="eyebrow">Discovery</span>
                  <h2>Source, query, and launch</h2>
                </div>

                <ControlBar
                  source={wallpaper.source}
                  query={wallpaper.query}
                  isLoading={wallpaper.isLoading}
                  onSourceChange={wallpaper.setSource}
                  onQueryChange={wallpaper.setQuery}
                  onCategoryChange={wallpaper.setCategory}
                  onBrowseLocalFile={wallpaper.browseLocalVideo}
                  onFetch={() => wallpaper.fetchVideosList()}
                  onFetchAndApply={handleFetchAndApply}
                  onStop={wallpaper.stopWallpaper}
                />

                <SearchResults 
                  results={wallpaper.searchResults} 
                  onSelect={wallpaper.selectVideo} 
                  page={wallpaper.page}
                  onPageChange={wallpaper.setPage}
                />

                {wallpaper.error && (
                  <div className="callout callout--error">
                    <span className="callout__label">Engine Error</span>
                    <p>{wallpaper.error}</p>
                    {wallpaper.errorHint && <p>{wallpaper.errorHint}</p>}
                  </div>
                )}

                {wallpaper.isLoading && <div className="skeleton skeleton-preview" />}

                {wallpaper.currentVideo && !wallpaper.isLoading && (
                  <FloatingPreview
                    video={wallpaper.currentVideo}
                    isPaused={wallpaper.paused}
                    volumePercent={wallpaper.volumePercent}
                    filterPreset={wallpaper.videoFilter}
                    isFavorite={wallpaper.isFavorite(wallpaper.currentVideo)}
                    isQueued={wallpaper.isQueued(wallpaper.currentVideo)}
                    onApply={() => wallpaper.applyWallpaper(wallpaper.currentVideo!)}
                    onTogglePause={() => wallpaper.setPaused(!wallpaper.paused)}
                    onToggleFavorite={() => wallpaper.toggleFavorite(wallpaper.currentVideo!)}
                    onToggleQueue={toggleCurrentQueue}
                    onClose={() => wallpaper.selectVideo(null as any)}
                  />
                )}
              </section>

              <div className="support-grid">
                <div className="panel automation-card">
                  <div className="section-head">
                    <span className="eyebrow">Rotation</span>
                    <h2>Playback Scheduler</h2>
                  </div>
                  <div className="automation-grid">
                    <label className="toggle-row">
                      <span>Pause live wallpaper playback</span>
                      <input
                        type="checkbox"
                        checked={wallpaper.paused}
                        onChange={(event) => wallpaper.setPaused(event.target.checked)}
                      />
                    </label>
                    <label className="toggle-row">
                      <span>Restore wallpaper on app launch</span>
                      <input
                        type="checkbox"
                        checked={wallpaper.restoreOnLaunch}
                        onChange={(event) => wallpaper.setRestoreOnLaunch(event.target.checked)}
                      />
                    </label>
                    <label className="toggle-row">
                      <span>Auto-pause to save battery and performance</span>
                      <input
                        type="checkbox"
                        checked={wallpaper.autoPauseEnabled}
                        onChange={(event) => wallpaper.setAutoPauseEnabled(event.target.checked)}
                      />
                    </label>
                    <label className="toggle-row">
                      <span>Enable timed rotation</span>
                      <input
                        type="checkbox"
                        checked={wallpaper.rotationEnabled}
                        disabled={wallpaper.queue.length === 0}
                        onChange={(event) =>
                          wallpaper.setRotationConfig(event.target.checked, wallpaper.rotationIntervalSeconds)
                        }
                      />
                    </label>
                    <label className="toggle-row">
                      <span>Close app to tray</span>
                      <input
                        type="checkbox"
                        checked={wallpaper.closeToTray}
                        onChange={(event) =>
                          wallpaper.setWindowBehavior(event.target.checked, wallpaper.minimizeToTray)
                        }
                      />
                    </label>
                    <label className="toggle-row">
                      <span>Minimize button sends app to tray</span>
                      <input
                        type="checkbox"
                        checked={wallpaper.minimizeToTray}
                        onChange={(event) =>
                          wallpaper.setWindowBehavior(wallpaper.closeToTray, event.target.checked)
                        }
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">Rotation Interval (seconds)</span>
                      <input
                        className="input"
                        type="number"
                        min={30}
                        step={30}
                        value={wallpaper.rotationIntervalSeconds}
                        onChange={onRotationIntervalChange}
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">Wallpaper Volume</span>
                      <div className="scale-control">
                        <input
                          className="scale-slider"
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={wallpaper.volumePercent}
                          onChange={onWallpaperVolumeChange}
                        />
                        <input
                          className="input scale-input"
                          type="number"
                          min={0}
                          max={100}
                          step={5}
                          value={wallpaper.volumePercent}
                          onChange={onWallpaperVolumeChange}
                        />
                        <span className="scale-suffix">%</span>
                      </div>
                      <span className="field__hint">
                        `0%` keeps wallpapers silent. Raise the slider if you want ambient audio from local or remote video files.
                      </span>
                    </label>
                    <label className="field">
                      <span className="field__label">Live Video Filter</span>
                      <select
                        className="input input--select"
                        value={wallpaper.videoFilter}
                        onChange={(event) => wallpaper.setVideoFilter(event.target.value)}
                      >
                        {FILTER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <span className="field__hint">
                        Filters apply to the desktop wallpaper engine and the in-app preview. Changing filters reapplies the active wallpaper.
                      </span>
                    </label>
                    <label className="field">
                      <span className="field__label">Wallpaper Render Scale</span>
                      <div className="scale-control">
                        <input
                          className="scale-slider"
                          type="range"
                          min={25}
                          max={200}
                          step={5}
                          value={wallpaper.wallpaperScalePercent}
                          onChange={onWallpaperScaleChange}
                        />
                        <input
                          className="input scale-input"
                          type="number"
                          min={25}
                          max={200}
                          step={5}
                          value={wallpaper.wallpaperScalePercent}
                          onChange={onWallpaperScaleChange}
                        />
                        <span className="scale-suffix">%</span>
                      </div>
                      <span className="field__hint">
                        Lower values reduce wallpaper render load and memory pressure. `100%` matches screen-scale rendering.
                      </span>
                    </label>
                    <div className="automation-note">
                      <strong>Queue size: {wallpaper.queue.length}</strong>
                      <span>
                        Rotation runs while the app process is alive. If the window is hidden to tray, playback and timers keep running.
                      </span>
                    </div>
                  </div>
                </div>

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
                      {wallpaper.queue.map((item, index) => (
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
              </div>

              <section className="library-grid">
                <ImportedLibraryList
                  items={wallpaper.imports}
                  queueIds={queueIds}
                  onApply={(item) => wallpaper.applyWallpaper(item.video)}
                  onRemove={(item) => wallpaper.removeImportedVideo(item.video)}
                  onToggleQueue={(item) =>
                    queueIds.has(`${item.video.id}:${item.video.local_path}`)
                      ? wallpaper.removeFromQueue(item.video)
                      : wallpaper.addToQueue(item.video)
                  }
                />

                <LibraryList
                  title="Favorites"
                  empty="Favorite wallpapers appear here after you save them."
                  items={wallpaper.favorites}
                  favoriteIds={favoriteIds}
                  queueIds={queueIds}
                  onApply={(item) => wallpaper.applyWallpaper(item.video)}
                  onToggleFavorite={(item) => wallpaper.toggleFavorite(item.video)}
                  onToggleQueue={(item) =>
                    queueIds.has(`${item.video.id}:${item.video.local_path}`)
                      ? wallpaper.removeFromQueue(item.video)
                      : wallpaper.addToQueue(item.video)
                  }
                />

                <LibraryList
                  title="Recent Wallpapers"
                  empty="Applied wallpapers will appear here after the first successful apply."
                  items={wallpaper.recents}
                  favoriteIds={favoriteIds}
                  queueIds={queueIds}
                  onApply={(item) => wallpaper.applyWallpaper(item.video)}
                  onToggleFavorite={(item) => wallpaper.toggleFavorite(item.video)}
                  onToggleQueue={(item) =>
                    queueIds.has(`${item.video.id}:${item.video.local_path}`)
                      ? wallpaper.removeFromQueue(item.video)
                      : wallpaper.addToQueue(item.video)
                  }
                />
              </section>

              <section className="feature-grid">
                {FEATURE_CARDS.map((card) => (
                  <article className="panel feature-card" key={card.title}>
                    <span className="eyebrow">{card.eyebrow}</span>
                    <h3>{card.title}</h3>
                    <p>{card.text}</p>
                  </article>
                ))}
              </section>
            </>
          ) : (
            <section className="panel preview-deck">
              <div className="section-head">
                <span className="eyebrow">Dedicated Preview</span>
                <h2>Wallpaper Playback</h2>
              </div>
              <p className="muted preview-deck__copy">
                Use this tab to inspect the current wallpaper without the scheduler, library, or diagnostics panels competing for space.
              </p>

              {wallpaper.error && (
                <div className="callout callout--error">
                  <span className="callout__label">Engine Error</span>
                  <p>{wallpaper.error}</p>
                  {wallpaper.errorHint && <p>{wallpaper.errorHint}</p>}
                </div>
              )}

              {wallpaper.isLoading && <div className="skeleton skeleton-preview skeleton-preview--deck" />}

              {wallpaper.currentVideo && !wallpaper.isLoading ? (
                <FloatingPreview
                  video={wallpaper.currentVideo}
                  isPaused={wallpaper.paused}
                  volumePercent={wallpaper.volumePercent}
                  filterPreset={wallpaper.videoFilter}
                  isFavorite={wallpaper.isFavorite(wallpaper.currentVideo)}
                  isQueued={wallpaper.isQueued(wallpaper.currentVideo)}
                  onApply={() => wallpaper.applyWallpaper(wallpaper.currentVideo!)}
                  onTogglePause={() => wallpaper.setPaused(!wallpaper.paused)}
                  onToggleFavorite={() => wallpaper.toggleFavorite(wallpaper.currentVideo!)}
                  onToggleQueue={toggleCurrentQueue}
                  onClose={() => wallpaper.selectVideo(null as any)}
                />
              ) : !wallpaper.isLoading ? (
                <div className="preview-empty">
                  <span className="eyebrow">No Media Loaded</span>
                  <h3>Fetch a wallpaper from the Studio tab</h3>
                  <p>Once a video is loaded, this tab becomes the clean playback surface for review and apply actions.</p>
                </div>
              ) : null}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default dynamic(() => Promise.resolve(Home), { ssr: false });
