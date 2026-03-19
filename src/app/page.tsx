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
import { UnifiedLibrary } from "./components/LibraryList";
import { AutomationPanel } from "./components/AutomationPanel";
import { QueuePanel } from "./components/QueuePanel";
import { YouTubePanel } from "./components/YouTubePanel";
import { EditorWorkspace } from "./components/EditorWorkspace";
import { CanvasEffectRenderer } from "./components/CanvasEffectRenderer";
import { useEffect } from "react";


function VolumeSlider({ initialVolume, onCommit }: { initialVolume: number, onCommit: (val: number) => void }) {
  const [localVal, setLocalVal] = useState(initialVolume);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <input
        type="range"
        min="0"
        max="100"
        value={localVal}
        onChange={(e) => setLocalVal(parseInt(e.target.value))}
        onMouseUp={() => onCommit(localVal)}
        onTouchEnd={() => onCommit(localVal)}
        style={{
          WebkitAppearance: "none",
          width: "80px",
          height: "4px",
          background: "rgba(255,255,255,0.1)",
          borderRadius: "2px",
          outline: "none",
          cursor: "pointer"
        }}
      />
      <strong>{localVal}%</strong>
    </div>
  );
}

const ICONS = {
  discover: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  library: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  ),
  direct: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  preview: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  youtube: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.13C5.12 19.56 12 19.56 12 19.56s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.43z" />
      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44 a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
};

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


function Home() {
  const wallpaper = useWallpaper();
  const [activeTab, setActiveTab] = useState<"discover" | "library" | "direct" | "preview" | "editor" | "youtube" | "settings">("discover");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [lastVolume, setLastVolume] = useState(25);
  const [isOverlayMode, setIsOverlayMode] = useState(false);
  const [overlayConfig, setOverlayConfig] = useState<{ videoSrc?: string; layers?: any[] }>({});

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("mode=desktop-overlay")) {
      setIsOverlayMode(true);
    }
  }, []);

  useEffect(() => {
    if (isOverlayMode) {
      const loadConfig = () => {
        console.log("[Overlay] invoking get_current_effects...");
        import("@tauri-apps/api/core").then(({ invoke }) => {
          invoke<string>("get_current_effects").then((json) => {
            console.log("[Overlay] Raw effects JSON:", json);
            try {
              const config = JSON.parse(json);
              console.log("[Overlay] Successfully parsed config:", config);
              setOverlayConfig(config);
            } catch (e) {
              console.error("[Overlay] Failed to parse overlay config:", e);
            }
          });
        }).catch(console.error);
      };

      loadConfig();

      let unlistenRef = { current: () => { } };

      import("@tauri-apps/api/event").then(({ listen }) => {
        listen("effects-updated", (e: any) => {
          console.log("[Overlay] effects-updated received with direct payload!");
          try {
            const config = typeof e.payload === "string" ? JSON.parse(e.payload) : e.payload;
            setOverlayConfig(config);
          } catch (err) {
            console.error("[Overlay] Failed to parse overlay config payload:", err);
          }
        }).then(u => {
          unlistenRef.current = u;
        });
      }).catch(console.error);

      return () => {
        if (unlistenRef.current) unlistenRef.current();
      };
    }
  }, [isOverlayMode]);




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

  if (isOverlayMode) {
    return (
      <main className="workspace-overlay" style={{ background: "transparent", width: "100vw", height: "100vh", overflow: "hidden" }}>
        <style dangerouslySetInnerHTML={{
          __html: `
          html, body {
            background: transparent !important;
          }
          /* Hide Next.js Dev Portal / Error Overlay or badges */
          nextjs-portal,
          #nextjs-dev-overlay-container,
          [data-nextjs-toast],
          [data-nextjs-portal] {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
            width: 0 !important;
            height: 0 !important;
          }
        ` }} />
        <CanvasEffectRenderer
          videoSrc={overlayConfig.videoSrc || ""}
          effects={overlayConfig.layers || []}
          isOverlay={true}
        />

      </main>
    );
  }



  return (
    <div className="shell">
      <TitleBar minimizeToTray={wallpaper.minimizeToTray} />

      <div className="shell__backdrop" />

      <div className={`shell__body ${isSidebarCollapsed ? "shell__body--collapsed" : ""}`}>
        <aside className={`sidebar panel ${isSidebarCollapsed ? "sidebar--collapsed" : ""}`}>
          <div className="brand-block">
            <button
              type="button"
              className="brand-mark brand-mark--clickable"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              <div className="apps-grid">
                <div /> <div />
                <div /> <div />
              </div>
            </button>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-list">
              <button
                type="button"
                className={`sidebar-list__item sidebar-list__item--clickable ${activeTab === "discover" ? "sidebar-list__item--active" : ""}`}
                onClick={() => setActiveTab("discover")}
                title="Discover"
              >
                <div className="tab-icon">{ICONS.discover}</div>
                {!isSidebarCollapsed && <span>Discover</span>}
              </button>
              <button
                type="button"
                className={`sidebar-list__item sidebar-list__item--clickable ${activeTab === "library" ? "sidebar-list__item--active" : ""}`}
                onClick={() => setActiveTab("library")}
                title="Library"
              >
                <div className="tab-icon">{ICONS.library}</div>
                {!isSidebarCollapsed && <span>Library</span>}
              </button>
              <button
                type="button"
                className={`sidebar-list__item sidebar-list__item--clickable ${activeTab === "direct" ? "sidebar-list__item--active" : ""}`}
                onClick={() => setActiveTab("direct")}
                title="Direct Launch"
              >
                <div className="tab-icon">{ICONS.direct}</div>
                {!isSidebarCollapsed && <span>Direct Launch</span>}
              </button>
              <button
                type="button"
                className={`sidebar-list__item sidebar-list__item--clickable ${activeTab === "preview" ? "sidebar-list__item--active" : ""}`}
                onClick={() => setActiveTab("preview")}
                title="Preview Deck"
              >
                <div className="tab-icon">{ICONS.preview}</div>
                {!isSidebarCollapsed && <span>Preview Deck</span>}
              </button>
              <button
                type="button"
                className={`sidebar-list__item sidebar-list__item--clickable ${activeTab === "editor" ? "sidebar-list__item--active" : ""}`}
                onClick={() => setActiveTab("editor")}
                title="Effects Editor"
              >
                <div className="tab-icon">✨</div>
                {!isSidebarCollapsed && <span>Effects Editor</span>}
              </button>

              <button
                type="button"
                className={`sidebar-list__item sidebar-list__item--clickable ${activeTab === "youtube" ? "sidebar-list__item--active" : ""}`}
                onClick={() => setActiveTab("youtube")}
                title="YouTube"
              >
                <div className="tab-icon">{ICONS.youtube}</div>
                {!isSidebarCollapsed && <span>YouTube</span>}
              </button>
              <button
                type="button"
                className={`sidebar-list__item sidebar-list__item--clickable ${activeTab === "settings" ? "sidebar-list__item--active" : ""}`}
                onClick={() => setActiveTab("settings")}
                title="Settings"
              >
                <div className="tab-icon">{ICONS.settings}</div>
                {!isSidebarCollapsed && <span>Settings</span>}
              </button>
            </div>
          </div>
        </aside>

        <main className="workspace">
          <section className="hero panel hero--hud">
            <div className="hero__status">
              <div className={`engine-orb ${wallpaper.isPlaying ? "engine-orb--active" : ""}`}>
                <div className="engine-pulse" />
              </div>
              <div className="hero__meta">
                <p className="eyebrow">{wallpaper.isPlaying ? "Engine Active" : "Engine Standby"}</p>
                <h2>{wallpaper.currentVideo?.id.replace(/-/g, " ") || "it Lives - Motion Studio"}</h2>
              </div>
            </div>

            <div className="hero__metrics">
              <div className="hud-metric">
                <span>Resolution</span>
                <strong>{currentResolution}</strong>
              </div>
              <div className="hud-metric">
                <span>Provider</span>
                <strong>{wallpaper.currentVideo?.source.toUpperCase() || "READY"}</strong>
              </div>
              <div className="hud-metric">
                <span>Volume</span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <VolumeSlider
                    initialVolume={wallpaper.volumePercent}
                    onCommit={wallpaper.setVolumePercent}
                  />
                </div>
              </div>
            </div>
          </section>


          {activeTab === "discover" && (
            <section className="panel panel--main">
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
                  volumePercent={wallpaper.volumePercent}
                  filterPreset={wallpaper.videoFilter}
                  isFavorite={wallpaper.isFavorite(wallpaper.currentVideo)}
                  isQueued={wallpaper.isQueued(wallpaper.currentVideo)}
                  onApply={(st, et) => wallpaper.applyWallpaper(wallpaper.currentVideo!, st, et)}
                  onToggleFavorite={() => wallpaper.toggleFavorite(wallpaper.currentVideo!)}
                  onToggleQueue={toggleCurrentQueue}
                  onClose={() => wallpaper.selectVideo(null as any)}
                />
              )}
            </section>
          )}

          {activeTab === "library" && (
            <UnifiedLibrary
              favorites={wallpaper.favorites}
              recents={wallpaper.recents}
              imports={wallpaper.imports}
              favoriteIds={favoriteIds}
              queueIds={queueIds}
              onApply={(item) => wallpaper.applyWallpaper(item.video)}
              onPreview={(item) => wallpaper.selectVideo(item.video)}
              onToggleFavorite={(item) => wallpaper.toggleFavorite(item.video)}
              onToggleQueue={(item) =>
                queueIds.has(`${item.video.id}:${item.video.local_path}`)
                  ? wallpaper.removeFromQueue(item.video)
                  : wallpaper.addToQueue(item.video)
              }
              onRemoveRecent={(item) => wallpaper.removeRecentVideo(item.video)}
              onRemoveImport={(item) => wallpaper.removeImportedVideo(item.video)}
            />
          )}

          {activeTab === "settings" && (
            <section className="panel" style={{ padding: "16px", marginTop: "1rem" }}>
              <div className="section-head" style={{ marginBottom: "1.5rem" }}>
                <span className="eyebrow">Controls & Queue</span>
                <h2>Application Settings</h2>
              </div>
              <div className="support-grid">
                <AutomationPanel wallpaper={wallpaper} />
                <QueuePanel wallpaper={wallpaper} />
              </div>
            </section>
          )}

          {activeTab === "direct" && (
            <section className="panel panel--main">
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

              <div className="hud-ready-zone">
                <div className="hud-ring" />
                <div className="hud-center">
                  <span className="eyebrow">Ready to Deploy</span>
                  <p className="muted">Paste a stream URL or browse for a local file to override the current desktop scene.</p>
                </div>
              </div>
            </section>
          )}

          {activeTab === "preview" && (
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
                  volumePercent={wallpaper.volumePercent}
                  filterPreset={wallpaper.videoFilter}
                  isFavorite={wallpaper.isFavorite(wallpaper.currentVideo)}
                  isQueued={wallpaper.isQueued(wallpaper.currentVideo)}
                  onApply={(st, et) => wallpaper.applyWallpaper(wallpaper.currentVideo!, st, et)}
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

          {activeTab === "youtube" && (
            <YouTubePanel
              onApplyWallpaper={(video) => wallpaper.applyWallpaper(video)}
              onStop={wallpaper.stopWallpaper}
              isPlaying={wallpaper.isPlaying}
            />
          )}

          {activeTab === "editor" && (
            <EditorWorkspace
              currentVideo={wallpaper.currentVideo}
              onApplyWallpaper={async (v) => { await wallpaper.applyWallpaper(v); }}
            />
          )}


          {/* Master Floating HUD for Universal Control */}
          {wallpaper.isPlaying && (
            <div className="master-hud">
              <div className="hud-content">
                <button
                  className={`action-btn ${wallpaper.paused ? "action-btn--primary" : "action-btn--ghost"}`}
                  style={{ padding: "8px 12px", minWidth: "40px" }}
                  onClick={() => wallpaper.setPaused(!wallpaper.paused)}
                  title={wallpaper.paused ? "Resume Wallpaper" : "Pause Wallpaper"}
                >
                  {wallpaper.paused ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                  )}
                </button>

                <div className="hud-info">
                  <span className="eyebrow" style={{ fontSize: "10px", lineHeight: 1 }}>Now Playing</span>
                  <span className="hud-title" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "160px", fontSize: "12px", fontWeight: "bold" }}>
                    {wallpaper.currentVideo?.id.replace(/-/g, " ") || "Live Wallpaper"}
                  </span>
                </div>

                <div className="hud-divider" style={{ width: "1px", height: "24px", background: "rgba(255,255,255,0.08)" }} />

                <div className="hud-audio" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, color: "var(--accent)", display: "flex" }}
                    onClick={() => {
                      if (wallpaper.volumePercent > 0) {
                        setLastVolume(wallpaper.volumePercent);
                        wallpaper.setVolumePercent(0);
                      } else {
                        wallpaper.setVolumePercent(lastVolume > 0 ? lastVolume : 30);
                      }
                    }}
                    title={wallpaper.volumePercent > 0 ? "Mute" : "Unmute"}
                  >
                    {wallpaper.volumePercent > 0 ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "red" }}><path d="M11 5L6 9H2v6h4l5 4V5z" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
                    )}
                  </button>
                  <VolumeSlider
                    initialVolume={wallpaper.volumePercent}
                    onCommit={wallpaper.setVolumePercent}
                  />
                </div>

                <button
                  className="action-btn action-btn--danger-ghost"
                  style={{ padding: "8px 12px", fontSize: "11px" }}
                  onClick={wallpaper.stopWallpaper}
                >
                  Stop
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default dynamic(() => Promise.resolve(Home), { ssr: false });
