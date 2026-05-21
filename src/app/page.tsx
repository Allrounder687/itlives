"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef } from "react";
import { useWallpaper } from "@/hooks/useWallpaper";
import { TitleBar } from "./components/TitleBar";
import { Sidebar, TabState } from "./components/Sidebar";
import { HeroPanel } from "./components/HeroPanel";
import { MasterHUD } from "./components/MasterHUD";
import { ControlBar } from "./components/ControlBar";
import { SearchResults } from "./components/SearchResults";
import { FloatingPreview } from "./components/FloatingPreview";
import { UnifiedLibrary } from "./components/LibraryList";
import { PrivacyPanel } from "./components/PrivacyPanel";
import { AutomationPanel } from "./components/AutomationPanel";
import { VideoPreview } from "./components/VideoPreview";
import { QueuePanel } from "./components/QueuePanel";
import { YouTubePanel } from "./components/YouTubePanel";
import { EditorWorkspace } from "./components/EditorWorkspace";
import { CanvasEffectRenderer } from "./components/CanvasEffectRenderer";
import { ParallaxWorkspace } from "./components/ParallaxWorkspace";
import { ThemeSelector } from "./components/ThemeSelector";
import { CommunityPanel } from "./components/CommunityPanel";
import { DependencyChecker } from "./components/DependencyChecker";
import { WallpaperSourcePanel } from "./components/WallpaperSourcePanel";

function Home() {
  const wallpaper = useWallpaper();
  const [activeTab, setActiveTab] = useState<TabState>("discover");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isOverlayMode, setIsOverlayMode] = useState(false);
  const [overlayConfig, setOverlayConfig] = useState<{ videoSrc?: string; layers?: any[] }>({});

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", wallpaper.theme || "master-system");
    }
  }, [wallpaper.theme]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("mode=desktop-overlay")) {
      setIsOverlayMode(true);
    }
  }, []);

  useEffect(() => {
    if (isOverlayMode) {
      const loadConfig = () => {
        import("@tauri-apps/api/core").then(({ invoke }) => {
          invoke<string>("get_current_effects").then((json) => {
            try {
              setOverlayConfig(JSON.parse(json));
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
          try {
            const config = typeof e.payload === "string" ? JSON.parse(e.payload) : e.payload;
            setOverlayConfig(config);
          } catch (err) {
            console.error("[Overlay] Failed to parse overlay config payload:", err);
          }
        }).then(u => { unlistenRef.current = u; });
      }).catch(console.error);

      return () => { if (unlistenRef.current) unlistenRef.current(); };
    }
  }, [isOverlayMode]);

  const prevQueryRef = useRef(wallpaper.query);
  const prevCategoryRef = useRef(wallpaper.category);
  const fetchVideosListRef = useRef(wallpaper.fetchVideosList);
  fetchVideosListRef.current = wallpaper.fetchVideosList;

  const lastFetchedRef = useRef<{ source: string; query: string; page: number; category: string; urlsHash: string } | null>(null);

  // Automatically fetch wallpapers when hydration finishes or when source/query/page/category/pinterestUrls/activeTab changes
  useEffect(() => {
    if (wallpaper.isHydrating) return;
    if (wallpaper.source === "direct") return;
    if (activeTab !== "discover") return;

    const urlsHash = JSON.stringify(wallpaper.pinterestUrls);

    // Prevent duplicate concurrent/overlapping fetches for the exact same query/page/source/category/pinterestUrls
    const currentFetchKey = {
      source: wallpaper.source,
      query: wallpaper.query,
      page: wallpaper.page,
      category: wallpaper.category,
      urlsHash,
    };

    if (
      lastFetchedRef.current &&
      lastFetchedRef.current.source === currentFetchKey.source &&
      lastFetchedRef.current.query === currentFetchKey.query &&
      lastFetchedRef.current.page === currentFetchKey.page &&
      lastFetchedRef.current.category === currentFetchKey.category &&
      lastFetchedRef.current.urlsHash === currentFetchKey.urlsHash
    ) {
      return;
    }

    lastFetchedRef.current = currentFetchKey;

    const queryChanged = prevQueryRef.current !== wallpaper.query;
    const categoryChanged = prevCategoryRef.current !== wallpaper.category;

    prevQueryRef.current = wallpaper.query;
    prevCategoryRef.current = wallpaper.category;

    // Use a 400ms debounce ONLY when manual text query typing is in progress
    // If it's a category click, source change, page change, or initial load, fetch immediately (0ms delay)
    const delay = (queryChanged && !categoryChanged) ? 400 : 0;

    const t = setTimeout(() => {
      fetchVideosListRef.current();
    }, delay);

    return () => clearTimeout(t);
  }, [
    wallpaper.isHydrating,
    wallpaper.source,
    wallpaper.query,
    wallpaper.page,
    wallpaper.category,
    wallpaper.pinterestUrls,
    activeTab
  ]);

  const handleFetchAndApply = async () => {
    const result = await wallpaper.fetchVideo();
    if (result) {
      await wallpaper.applyWallpaper(result);
    }
  };

  const favoriteIds = new Set(wallpaper.favorites.map((item) => `${item.video.id}:${item.video.local_path}`));
  const queueIds = new Set(wallpaper.queue.map((item) => `${item.video.id}:${item.video.local_path}`));

  const toggleCurrentQueue = () => {
    if (!wallpaper.currentVideo) return;
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
          html, body { background: transparent !important; }
          nextjs-portal, #nextjs-dev-overlay-container, [data-nextjs-toast], [data-nextjs-portal] {
            display: none !important; opacity: 0 !important; visibility: hidden !important; width: 0 !important; height: 0 !important;
          }
        ` }} />
        <CanvasEffectRenderer videoSrc={overlayConfig.videoSrc || ""} effects={overlayConfig.layers || []} isOverlay={true} />
      </main>
    );
  }

  return (
    <div className="shell">
      <TitleBar minimizeToTray={wallpaper.minimizeToTray} />
      <div className="shell__backdrop" />

      <div className={`shell__body ${isSidebarCollapsed ? "shell__body--collapsed" : ""}`}>
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          isSidebarCollapsed={isSidebarCollapsed} 
          setIsSidebarCollapsed={setIsSidebarCollapsed} 
        />

        <main className="workspace">
          <DependencyChecker />
          {wallpaper.error && (
            <div className="callout callout--error" style={{ margin: "1rem 0" }}>
              <span className="callout__label">Engine Error</span>
              <p>{wallpaper.error}</p>
              {wallpaper.errorHint && <p>{wallpaper.errorHint}</p>}
              {wallpaper.error.includes("mpv not found") && (
                <div style={{ marginTop: "1rem" }}>
                   <p className="muted">This application requires <strong>mpv</strong> to render video wallpapers.</p>
                   <code style={{ background: "rgba(0,0,0,0.3)", padding: "4px 8px", borderRadius: "4px" }}>winget install shinchiro.mpv</code>
                </div>
              )}
            </div>
          )}

          <HeroPanel wallpaper={wallpaper} />

          {activeTab === "discover" && (
            <section className="panel panel--main">
              <ControlBar
                source={wallpaper.source} query={wallpaper.query} isLoading={wallpaper.isLoading}
                onSourceChange={wallpaper.setSource} onQueryChange={wallpaper.setQuery}
                onCategoryChange={wallpaper.setCategory} onBrowseLocalFile={wallpaper.browseLocalVideo}
                onFetch={() => wallpaper.fetchVideosList()} onFetchAndApply={handleFetchAndApply}
                onStop={wallpaper.stopWallpaper}
                pinterestUrls={wallpaper.pinterestUrls}
                onSetPinterestUrls={wallpaper.setPinterestUrls}
              />
              <SearchResults
                results={wallpaper.searchResults} onSelect={wallpaper.selectVideo}
                page={wallpaper.page} onPageChange={wallpaper.setPage}
                isLoading={wallpaper.isLoading}
                hasMore={wallpaper.hasMore ?? true}
                duplicateNotice={wallpaper.duplicateNotice}
              />
              {wallpaper.isLoading && wallpaper.page === 1 && <div className="skeleton skeleton-preview" />}
            </section>
          )}

          {activeTab === "library" && (
            <UnifiedLibrary
              favorites={wallpaper.favorites} recents={wallpaper.recents}
              imports={wallpaper.imports} favoriteIds={favoriteIds} queueIds={queueIds}
              hiddenVideos={wallpaper.hiddenVideos}
              isAdultUnlocked={wallpaper.isAdultUnlocked}
              hasAdultPin={wallpaper.hasAdultPin}
              onUnlock={async () => {
                const pin = prompt("Enter PIN to unlock hidden content:");
                if (pin) {
                  const valid = await wallpaper.verifyAdultPin(pin);
                  if (!valid) alert("Incorrect PIN");
                }
              }}
              onApply={(item) => wallpaper.applyWallpaper(item.video)}
              onPreview={(item) => wallpaper.selectVideo(item.video)}
              onToggleFavorite={(item) => wallpaper.toggleFavorite(item.video)}
              onToggleQueue={(item) => queueIds.has(`${item.video.id}:${item.video.local_path}`) ? wallpaper.removeFromQueue(item.video) : wallpaper.addToQueue(item.video)}
              onRemoveRecent={(item) => wallpaper.removeRecentVideo(item.video)}
              onRemoveImport={(item) => wallpaper.removeImportedVideo(item.video)}
            />
          )}

          {activeTab === "community" && (
            <CommunityPanel currentWallpaper={wallpaper.currentVideo} />
          )}

          {activeTab === "settings" && (
            <section className="panel" style={{ padding: "16px", marginTop: "1rem" }}>
              <div className="section-head" style={{ marginBottom: "1.5rem" }}>
                <span className="eyebrow">Controls & Appearance</span>
                <h2>Application Settings</h2>
              </div>
              <div className="support-grid">
                <ThemeSelector currentTheme={wallpaper.theme} onThemeChange={wallpaper.setTheme} />
                <WallpaperSourcePanel wallpaper={wallpaper} />
                <AutomationPanel wallpaper={wallpaper} />
                <QueuePanel wallpaper={wallpaper} />
                <PrivacyPanel 
                  hasAdultPin={wallpaper.hasAdultPin}
                  isAdultUnlocked={wallpaper.isAdultUnlocked}
                  onSetPin={wallpaper.setAdultPin}
                  onVerifyPin={wallpaper.verifyAdultPin}
                  onLock={wallpaper.lockAdult}
                />
              </div>
            </section>
          )}

          {activeTab === "direct" && (
            <section className="panel panel--main">
              <ControlBar
                source={wallpaper.source} query={wallpaper.query} isLoading={wallpaper.isLoading}
                onSourceChange={wallpaper.setSource} onQueryChange={wallpaper.setQuery}
                onCategoryChange={wallpaper.setCategory} onBrowseLocalFile={wallpaper.browseLocalVideo}
                onFetch={() => wallpaper.fetchVideosList()} onFetchAndApply={handleFetchAndApply}
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
              {wallpaper.currentVideo && !wallpaper.isLoading ? (
                <VideoPreview
                  video={wallpaper.currentVideo}
                  volumePercent={wallpaper.volumePercent}
                  filterPreset={wallpaper.videoFilter}
                  isFavorite={wallpaper.isFavorite(wallpaper.currentVideo)}
                  isQueued={wallpaper.isQueued(wallpaper.currentVideo)}
                  playbackSpeed={wallpaper.playbackSpeed}
                  blurStrength={wallpaper.blurStrength}
                  onApply={(st?: number, et?: number) => wallpaper.applyWallpaper(wallpaper.currentVideo!, st, et)}
                  onToggleFavorite={() => wallpaper.toggleFavorite(wallpaper.currentVideo!)}
                  onToggleQueue={toggleCurrentQueue}
                  onSetSpeed={wallpaper.setPlaybackSpeed}
                  onSetBlur={wallpaper.setBlurStrength}
                  isHidden={wallpaper.hiddenVideos.includes(wallpaper.currentVideo.id)}
                  onToggleHide={wallpaper.hasAdultPin ? () => wallpaper.toggleHideVideo(wallpaper.currentVideo!.id) : undefined}
                />
              ) : !wallpaper.isLoading ? (
                <div className="preview-empty">
                  <span className="eyebrow">No Media Loaded</span>
                  <h3>Fetch a wallpaper from the Studio tab</h3>
                </div>
              ) : null}
            </section>
          )}

          {activeTab === "youtube" && (
            <YouTubePanel onApplyWallpaper={(v) => wallpaper.applyWallpaper(v)} onStop={wallpaper.stopWallpaper} isPlaying={wallpaper.isPlaying} />
          )}

          {activeTab === "editor" && (
            <EditorWorkspace currentVideo={wallpaper.currentVideo} onApplyWallpaper={async (v) => { await wallpaper.applyWallpaper(v); }} />
          )}

          {activeTab === "parallax" && (
            <ParallaxWorkspace />
          )}

          <MasterHUD wallpaper={wallpaper} />
        </main>
      </div>

      {wallpaper.currentVideo && activeTab !== "preview" && !wallpaper.previewDismissed && (
        <FloatingPreview
          video={wallpaper.currentVideo}
          volumePercent={wallpaper.volumePercent}
          filterPreset={wallpaper.videoFilter}
          isFavorite={wallpaper.isFavorite(wallpaper.currentVideo)}
          isQueued={wallpaper.isQueued(wallpaper.currentVideo)}
          playbackSpeed={wallpaper.playbackSpeed}
          blurStrength={wallpaper.blurStrength}
          onApply={(st?: number, et?: number) => wallpaper.applyWallpaper(wallpaper.currentVideo!, st, et)}
          onToggleFavorite={() => wallpaper.toggleFavorite(wallpaper.currentVideo!)}
          onToggleQueue={toggleCurrentQueue}
          onSetSpeed={wallpaper.setPlaybackSpeed}
          onSetBlur={wallpaper.setBlurStrength}
          onClose={() => wallpaper.dismissPreview()}
          isLoading={wallpaper.isLoading}
          isHidden={wallpaper.hiddenVideos.includes(wallpaper.currentVideo.id)}
          onToggleHide={wallpaper.hasAdultPin ? () => wallpaper.toggleHideVideo(wallpaper.currentVideo!.id) : undefined}
        />
      )}
    </div>
  );
}

export default dynamic(() => Promise.resolve(Home), { ssr: false });
