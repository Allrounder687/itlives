"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef, useCallback, useTransition, useMemo } from "react";
import { useWallpaper } from "@/hooks/useWallpaper";
import { TitleBar } from "./components/TitleBar";
import { Sidebar, TabState } from "./components/Sidebar";
import { useAddons } from "@/hooks/useAddons";

const MasterHUD = dynamic(() => import("./components/MasterHUD").then((m) => m.MasterHUD), { ssr: false });
const ControlBar = dynamic(() => import("./components/ControlBar").then((m) => m.ControlBar), { ssr: false });
const SearchResults = dynamic(() => import("./components/SearchResults").then((m) => m.SearchResults), { ssr: false, loading: () => <div className="skeleton skeleton-preview" /> });
const SettingsPanel = dynamic(() => import("./components/SettingsPanel").then((m) => m.SettingsPanel), { ssr: false });
const DownloadProgressOverlay = dynamic(() => import("./components/DownloadProgressOverlay").then((m) => m.DownloadProgressOverlay), { ssr: false });

const UnifiedLibrary = dynamic(() => import("./components/LibraryList").then((m) => m.UnifiedLibrary), { ssr: false });
const VideoPreview = dynamic(() => import("./components/VideoPreview").then((m) => m.VideoPreview), { ssr: false });
const YouTubePanel = dynamic(() => import("./components/YouTubePanel").then((m) => m.YouTubePanel), { ssr: false });
const EditorWorkspace = dynamic(() => import("./components/EditorWorkspace").then((m) => m.EditorWorkspace), { ssr: false });
const WebGLEffectRenderer = dynamic(() => import("./components/WebGLEffectRenderer").then((m) => m.WebGLEffectRenderer), { ssr: false });
const ParallaxWorkspace = dynamic(() => import("./components/ParallaxWorkspace").then((m) => m.ParallaxWorkspace), { ssr: false });
const FloatingPreview = dynamic(() => import("./components/FloatingPreview").then((m) => m.FloatingPreview), { ssr: false });
const AddonsMarketplace = dynamic(() => import("./components/AddonsMarketplace").then((m) => m.AddonsMarketplace), { ssr: false });
const OnboardingWizard = dynamic(() => import("./components/OnboardingWizard").then((m) => m.OnboardingWizard), { ssr: false });
const SplashScreen = dynamic(() => import("./components/SplashScreen").then((m) => m.SplashScreen), { ssr: false });

function Home() {
  const wallpaper = useWallpaper();
  const { isAddonInstalled } = useAddons();
  const [activeTab, setActiveTab] = useState<TabState>("library");
  const [renderedTab, setRenderedTab] = useState<TabState>("library");
  const [isPending, startTransition] = useTransition();

  const isSourceAvailable = useCallback((src: string) => {
    if (src === "unified") return isAddonInstalled("scraper-unified");
    if (src === "wallpaperwaves") return isAddonInstalled("scraper-wpwaves");
    if (src === "alphacoders") return isAddonInstalled("scraper-alphacoders");
    if (src === "wallhaven") return isAddonInstalled("scraper-wallhaven");
    if (src === "pinterest") return isAddonInstalled("scraper-pinterest");
    return true; // direct, youtube (handled in its own tab)
  }, [isAddonInstalled]);

  const handleTabChange = useCallback((tab: TabState) => {
    setActiveTab(tab);
    startTransition(() => {
      setRenderedTab(tab);
    });
  }, []);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isOverlayMode, setIsOverlayMode] = useState(false);
  const [overlayConfig, setOverlayConfig] = useState<{ 
    videoSrc?: string; 
    layers?: any[]; 
    bgMode?: "cover" | "contain" | "blur-fill" | "stretch" | "triptych" | "mirror" | "tiles";
    bgBlur?: number;
    bgBrightness?: number;
  }>({});
  const [isErrorDismissed, setIsErrorDismissed] = useState(false);
  const [isErrorVisible, setIsErrorVisible] = useState(false);

  // Reset error dismissal when a new error appears
  const prevErrorRef = useRef(wallpaper.error);
  useEffect(() => {
    if (wallpaper.error && wallpaper.error !== prevErrorRef.current) {
      setIsErrorDismissed(false);
      setIsErrorVisible(true);
    }
    if (!wallpaper.error) {
      setIsErrorVisible(false);
    }
    prevErrorRef.current = wallpaper.error;
  }, [wallpaper.error]);

  const dismissError = useCallback(() => {
    setIsErrorDismissed(true);
    setTimeout(() => setIsErrorVisible(false), 300);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", wallpaper.theme || "master-system");
    }
  }, [wallpaper.theme]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      if (wallpaper.lightweightMode) {
        document.body.classList.add("lightweight-mode");
      } else {
        document.body.classList.remove("lightweight-mode");
      }
    }
  }, [wallpaper.lightweightMode]);

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
            setOverlayConfig(config || {});
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

  const lastFetchedRef = useRef<{ source: string; query: string; page: number; category: string; urlsHash: string; resolutions: string | null; ratios: string | null; colors: string | null; categoriesFilter: string | null; purityFilter: string | null; } | null>(null);

  // Automatically fetch wallpapers when hydration finishes or when source/query/page/category/pinterestUrls/activeTab changes
  useEffect(() => {
    if (wallpaper.isHydrating) return;
    if (wallpaper.source === "direct") return;
    if (activeTab !== "discover") return;
    if (!isSourceAvailable(wallpaper.source)) return;

    const urlsHash = JSON.stringify(wallpaper.pinterestUrls);

    // Prevent duplicate concurrent/overlapping fetches for the exact same query/page/source/category/pinterestUrls
    const currentFetchKey = {
      source: wallpaper.source,
      query: wallpaper.query,
      page: wallpaper.page,
      category: wallpaper.category,
      urlsHash,
      resolutions: wallpaper.resolutions,
      ratios: wallpaper.ratios,
      colors: wallpaper.colors,
      categoriesFilter: wallpaper.categoriesFilter,
      purityFilter: wallpaper.purityFilter,
    };

    if(
      lastFetchedRef.current &&
      lastFetchedRef.current.source === currentFetchKey.source &&
      lastFetchedRef.current.query === currentFetchKey.query &&
      lastFetchedRef.current.page === currentFetchKey.page &&
      lastFetchedRef.current.category === currentFetchKey.category &&
      lastFetchedRef.current.urlsHash === currentFetchKey.urlsHash &&
      lastFetchedRef.current.resolutions === currentFetchKey.resolutions &&
      lastFetchedRef.current.ratios === currentFetchKey.ratios &&
      lastFetchedRef.current.colors === currentFetchKey.colors &&
      lastFetchedRef.current.categoriesFilter === currentFetchKey.categoriesFilter &&
      lastFetchedRef.current.purityFilter === currentFetchKey.purityFilter
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
    wallpaper.resolutions,
    wallpaper.ratios,
    wallpaper.colors,
    wallpaper.categoriesFilter,
    wallpaper.purityFilter,
    activeTab,
    isSourceAvailable
  ]);

  const handleFetchAndApply = useCallback(async () => {
    const result = await wallpaper.fetchVideo();
    if (result) {
      await wallpaper.applyWallpaper(result);
    }
  }, [wallpaper.fetchVideo, wallpaper.applyWallpaper]);

  const favoriteIds = useMemo(() => {
    return new Set(wallpaper.favorites.map((item) => `${item.video.id}:${item.video.local_path}`));
  }, [wallpaper.favorites]);

  const queueIds = useMemo(() => {
    return new Set(wallpaper.queue.map((item) => `${item.video.id}:${item.video.local_path}`));
  }, [wallpaper.queue]);

  const toggleCurrentQueue = useCallback(() => {
    if (!wallpaper.currentVideo) return;
    if (wallpaper.isQueued(wallpaper.currentVideo)) {
      void wallpaper.removeFromQueue(wallpaper.currentVideo);
    } else {
      void wallpaper.addToQueue(wallpaper.currentVideo);
    }
  }, [wallpaper.currentVideo, wallpaper.isQueued, wallpaper.removeFromQueue, wallpaper.addToQueue]);

  const handleEditEffects = useCallback((video: any) => {
    handleTabChange("editor");
    setTimeout(() => window.dispatchEvent(new CustomEvent('load-profile', {detail: video.id})), 100);
  }, [handleTabChange]);

  const handleApplyCurrent = useCallback((st?: number, et?: number) => {
    if (wallpaper.currentVideo) {
      void wallpaper.applyWallpaper(wallpaper.currentVideo, st, et);
    }
  }, [wallpaper.currentVideo, wallpaper.applyWallpaper]);

  const handleToggleFavoriteCurrent = useCallback(() => {
    if (wallpaper.currentVideo) {
      void wallpaper.toggleFavorite(wallpaper.currentVideo);
    }
  }, [wallpaper.currentVideo, wallpaper.toggleFavorite]);

  const handleToggleHideCurrent = useCallback(() => {
    if (wallpaper.currentVideo) {
      void wallpaper.toggleHideVideo(wallpaper.currentVideo.id);
    }
  }, [wallpaper.currentVideo, wallpaper.toggleHideVideo]);

  const handleEditEffectsCurrent = useCallback(() => {
    if (wallpaper.currentVideo) {
      handleTabChange("editor");
      setTimeout(() => window.dispatchEvent(new CustomEvent('load-profile', {detail: wallpaper.currentVideo!.id})), 100);
    }
  }, [wallpaper.currentVideo, handleTabChange]);

  const handleClosePreview = useCallback(() => {
    wallpaper.dismissPreview();
  }, [wallpaper.dismissPreview]);

  const handleLibraryApply = useCallback((item: any) => {
    void wallpaper.applyWallpaper(item.video);
  }, [wallpaper.applyWallpaper]);

  const handleLibraryApplyOverlay = useCallback((item: any) => {
    import("@tauri-apps/api/core").then(({ invoke }) => {
      invoke("apply_interactive_overlay_cmd", { video: item.video, monitor: null }).catch(console.error);
    });
  }, []);

  const handleLibraryPreview = useCallback((item: any) => {
    wallpaper.selectVideo(item.video);
  }, [wallpaper.selectVideo]);

  const handleLibraryToggleFavorite = useCallback((item: any) => {
    void wallpaper.toggleFavorite(item.video);
  }, [wallpaper.toggleFavorite]);

  const handleLibraryToggleQueue = useCallback((item: any) => {
    const key = `${item.video.id}:${item.video.local_path}`;
    if (queueIds.has(key)) {
      void wallpaper.removeFromQueue(item.video);
    } else {
      void wallpaper.addToQueue(item.video);
    }
  }, [queueIds, wallpaper.removeFromQueue, wallpaper.addToQueue]);

  const handleLibraryRemoveRecent = useCallback((item: any) => {
    void wallpaper.removeRecentVideo(item.video);
  }, [wallpaper.removeRecentVideo]);

  const handleLibraryRemoveImport = useCallback((item: any) => {
    void wallpaper.removeImportedVideo(item.video);
  }, [wallpaper.removeImportedVideo]);

  const handleOverlayParamUpdate = useCallback((layerId: string, paramName: string, value: any) => {
    setOverlayConfig(prev => {
      if (!prev || !prev.layers) return prev;
      const newLayers = prev.layers.map(layer => {
        if (layer.id === layerId) {
          return { ...layer, params: { ...layer.params, [paramName]: value } };
        }
        return layer;
      });
      return { ...prev, layers: newLayers };
    });
  }, []);

  const handleOverlayRemoveLayer = useCallback((layerId: string) => {
    setOverlayConfig(prev => {
      if (!prev || !prev.layers) return prev;
      return { ...prev, layers: prev.layers.filter(l => l.id !== layerId) };
    });
  }, []);
  const discoverPanel = useMemo(() => {
    if (renderedTab !== "discover") return null;
    return (
      <section className="panel panel--main">
        <ControlBar
          source={wallpaper.source} query={wallpaper.query} isLoading={wallpaper.isLoading}
          onSourceChange={wallpaper.setSource} onQueryChange={wallpaper.setQuery}
          onCategoryChange={wallpaper.setCategory} onBrowseLocalFile={wallpaper.browseLocalVideo}
          onFetch={wallpaper.fetchVideosList} onFetchAndApply={handleFetchAndApply}
          onStop={wallpaper.stopWallpaper}
          pinterestUrls={wallpaper.pinterestUrls}
          onSetPinterestUrls={wallpaper.setPinterestUrls}
          category={wallpaper.category}
          colorFilter={wallpaper.colorFilter}
          onColorFilterChange={wallpaper.setColorFilter}
          resolutions={wallpaper.resolutions}
          ratios={wallpaper.ratios}
          colors={wallpaper.colors}
          onResolutionsChange={wallpaper.setResolutions}
          onRatiosChange={wallpaper.setRatios}
          onColorsChange={wallpaper.setColors}
          categoriesFilter={wallpaper.categoriesFilter}
          purityFilter={wallpaper.purityFilter}
          onCategoriesFilterChange={wallpaper.setCategoriesFilter}
          onPurityFilterChange={wallpaper.setPurityFilter}
        />
        {isSourceAvailable(wallpaper.source) ? (
          <SearchResults
            results={wallpaper.searchResults} onSelect={wallpaper.selectVideo}
            page={wallpaper.page} onPageChange={wallpaper.setPage}
            isLoading={wallpaper.isLoading}
            hasMore={wallpaper.hasMore ?? true}
            duplicateNotice={wallpaper.duplicateNotice}
            onEditEffects={handleEditEffects}
          />
        ) : (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-soft)" }}>
            <p>Source requires an addon. Please go to the <strong>Addons Marketplace</strong>.</p>
          </div>
        )}
        {wallpaper.isLoading && wallpaper.page === 1 && <div className="skeleton skeleton-preview" />}
      </section>
    );
  }, [
    renderedTab,
    wallpaper.source,
    wallpaper.query,
    wallpaper.isLoading,
    wallpaper.pinterestUrls,
    wallpaper.category,
    wallpaper.colorFilter,
    wallpaper.resolutions,
    wallpaper.ratios,
    wallpaper.colors,
    wallpaper.categoriesFilter,
    wallpaper.purityFilter,
    wallpaper.searchResults,
    wallpaper.page,
    wallpaper.hasMore,
    wallpaper.duplicateNotice,
    wallpaper.setSource,
    wallpaper.setQuery,
    wallpaper.setCategory,
    wallpaper.browseLocalVideo,
    wallpaper.fetchVideosList,
    handleFetchAndApply,
    wallpaper.stopWallpaper,
    wallpaper.setPinterestUrls,
    wallpaper.setColorFilter,
    wallpaper.setResolutions,
    wallpaper.setRatios,
    wallpaper.setColors,
    wallpaper.setCategoriesFilter,
    wallpaper.setPurityFilter,
    wallpaper.setPage,
    handleEditEffects,
    isSourceAvailable
  ]);

  const libraryPanel = useMemo(() => {
    if (renderedTab !== "library") return null;
    return (
      <UnifiedLibrary
        favorites={wallpaper.favorites} recents={wallpaper.recents}
        imports={wallpaper.imports} favoriteIds={favoriteIds} queueIds={queueIds}
        hiddenVideos={wallpaper.hiddenVideos}
        onApply={handleLibraryApply}
        onPreview={handleLibraryPreview}
        onToggleFavorite={handleLibraryToggleFavorite}
        onToggleQueue={handleLibraryToggleQueue}
        onRemoveRecent={handleLibraryRemoveRecent}
        onRemoveImport={handleLibraryRemoveImport}
        onUploadMedia={wallpaper.browseLocalVideo}
        onApplyOverlay={handleLibraryApplyOverlay}
      />
    );
  }, [
    renderedTab,
    wallpaper.favorites,
    wallpaper.recents,
    wallpaper.imports,
    favoriteIds,
    queueIds,
    wallpaper.hiddenVideos,
    handleLibraryApply,
    handleLibraryPreview,
    handleLibraryToggleFavorite,
    handleLibraryToggleQueue,
    handleLibraryRemoveRecent,
    handleLibraryRemoveImport,
    wallpaper.browseLocalVideo,
    handleLibraryApplyOverlay
  ]);



  const settingsPanel = useMemo(() => {
    if (renderedTab !== "settings") return null;
    return <SettingsPanel wallpaper={wallpaper} />;
  }, [renderedTab, wallpaper]);



  const youtubePanel = useMemo(() => {
    if (renderedTab !== "youtube") return null;
    return (
      <YouTubePanel onApplyWallpaper={wallpaper.applyWallpaper} onStop={wallpaper.stopWallpaper} isPlaying={wallpaper.isPlaying} />
    );
  }, [renderedTab, wallpaper.applyWallpaper, wallpaper.stopWallpaper, wallpaper.isPlaying]);

  const editorPanel = useMemo(() => {
    if (renderedTab !== "editor") return null;
    return (
      <EditorWorkspace 
        currentVideo={wallpaper.currentVideo} 
        onSelectVideo={wallpaper.selectVideo}
        onApplyWallpaper={wallpaper.applyWallpaper}
        onUploadMedia={wallpaper.browseLocalVideo}
        onStopWallpaper={wallpaper.stopWallpaper}
        recentWallpapers={wallpaper.recents}
      />
    );
  }, [
    renderedTab,
    wallpaper.currentVideo,
    wallpaper.selectVideo,
    wallpaper.applyWallpaper,
    wallpaper.browseLocalVideo,
    wallpaper.stopWallpaper,
    wallpaper.recents
  ]);


  const addonsPanel = useMemo(() => {
    if (renderedTab !== "addons") return null;
    return <AddonsMarketplace />;
  }, [renderedTab]);

  const titleBarElement = useMemo(() => {
    return <TitleBar minimizeToTray={wallpaper.minimizeToTray} />;
  }, [wallpaper.minimizeToTray]);





  const masterHudElement = useMemo(() => {
    return <MasterHUD wallpaper={wallpaper} />;
  }, [
    wallpaper.isPlaying,
    wallpaper.currentVideo,
    wallpaper.paused,
    wallpaper.volumePercent,
    wallpaper.stopWallpaper,
    wallpaper.setPaused,
    wallpaper.setVolumePercent
  ]);

  const isCurrentHidden = wallpaper.currentVideo ? wallpaper.hiddenVideos.includes(wallpaper.currentVideo.id) : false;
  const isCurrentFavorite = wallpaper.currentVideo ? wallpaper.isFavorite(wallpaper.currentVideo) : false;
  const isCurrentQueued = wallpaper.currentVideo ? wallpaper.isQueued(wallpaper.currentVideo) : false;

  const floatingPreviewElement = useMemo(() => {
    if (!wallpaper.currentVideo || wallpaper.previewDismissed) return null;
    return (
      <FloatingPreview
        video={wallpaper.currentVideo}
        volumePercent={wallpaper.volumePercent}
        filterPreset={wallpaper.videoFilter}
        isFavorite={isCurrentFavorite}
        isQueued={isCurrentQueued}
        playbackSpeed={wallpaper.playbackSpeed}
        blurStrength={wallpaper.blurStrength}
        onApply={handleApplyCurrent}
        onToggleFavorite={handleToggleFavoriteCurrent}
        onToggleQueue={toggleCurrentQueue}
        onSetSpeed={wallpaper.setPlaybackSpeed}
        onSetBlur={wallpaper.setBlurStrength}
        onClose={handleClosePreview}
        isLoading={wallpaper.isLoading}
        isHidden={isCurrentHidden}
        onToggleHide={handleToggleHideCurrent}
        onEditEffects={handleEditEffectsCurrent}
      />
    );
  }, [
    wallpaper.currentVideo,
    activeTab,
    wallpaper.previewDismissed,
    wallpaper.volumePercent,
    wallpaper.videoFilter,
    isCurrentFavorite,
    isCurrentQueued,
    wallpaper.playbackSpeed,
    wallpaper.blurStrength,
    handleApplyCurrent,
    handleToggleFavoriteCurrent,
    toggleCurrentQueue,
    wallpaper.setPlaybackSpeed,
    wallpaper.setBlurStrength,
    handleClosePreview,
    wallpaper.isLoading,
    isCurrentHidden,
    handleToggleHideCurrent,
    handleEditEffectsCurrent
  ]);

  const downloadProgressOverlayElement = useMemo(() => {
    return <DownloadProgressOverlay />;
  }, []);

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
        {/* Overlay ignores all pointer events at OS level and captures desktop directly */}
        <WebGLEffectRenderer 
          videoSrc={overlayConfig?.videoSrc || ""} 
          effects={overlayConfig?.layers || []} 
          isOverlay={true} 
          onUpdateParam={handleOverlayParamUpdate}
          onRemoveLayer={handleOverlayRemoveLayer}
          isPaused={wallpaper.paused && !wallpaper.keepEffectsRunningOnPause}
          bgMode={overlayConfig?.bgMode}
          bgBlur={overlayConfig?.bgBlur}
          bgBrightness={overlayConfig?.bgBrightness}
        />
      </main>
    );
  }

  if (wallpaper.isLoading) {
    if (process.env.NODE_ENV === "production") {
      return <SplashScreen />;
    }
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <div className="shell">
      <OnboardingWizard />
      {wallpaper.isLoading && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          background: "rgba(10, 15, 10, 0.85)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(154, 230, 0, 0.2)",
          borderRadius: "12px",
          padding: "16px 24px",
          zIndex: 99999,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "16px",
          color: "#fff",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
          animation: "fadeIn 0.3s ease, slideUp 0.3s ease"
        }}>
          {/* Hacker HUD Loader Animation (Miniaturized) */}
          <div style={{ position: "relative", width: "40px", height: "40px" }}>
            <div style={{
              position: "absolute",
              inset: 0,
              border: "1px solid rgba(154, 230, 0, 0.1)",
              borderRadius: "50%"
            }} />
            <div style={{
              position: "absolute",
              inset: "4px",
              border: "1px dashed rgba(154, 230, 0, 0.2)",
              borderRadius: "50%",
              animation: "spin-reverse 15s linear infinite"
            }} />
            <div style={{
              position: "absolute",
              inset: "-2px",
              border: "2px solid transparent",
              borderTopColor: "var(--accent)",
              borderBottomColor: "var(--accent)",
              borderRadius: "50%",
              animation: "spin 2s cubic-bezier(0.5, 0, 0.5, 1) infinite"
            }} />
            <div style={{
              position: "absolute",
              inset: "0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              animation: "pulse 2s infinite"
            }}>
              ⏳
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <h3 style={{
              margin: 0,
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "1px",
              color: "var(--accent)",
              textTransform: "uppercase",
              textShadow: "0 0 10px rgba(154, 230, 0, 0.5)"
            }}>
              Synchronizing Engine
            </h3>
            <p style={{ margin: 0, fontSize: "10px", opacity: 0.6, letterSpacing: "0.5px" }}>
              Allocating background graphics...
            </p>
          </div>
          
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes spin-reverse {
              0% { transform: rotate(360deg); }
              100% { transform: rotate(0deg); }
            }
            @keyframes pulse {
              0%, 100% { transform: scale(0.9); opacity: 0.6; }
              50% { transform: scale(1.1); opacity: 1; }
            }
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from { transform: translateY(20px); }
              to { transform: translateY(0); }
            }
          ` }} />
        </div>
      )}
      {titleBarElement}
      <div className="shell__backdrop" />

      <div className={`shell__body ${isSidebarCollapsed ? "shell__body--collapsed" : ""}`}>
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={handleTabChange} 
          isSidebarCollapsed={isSidebarCollapsed} 
          setIsSidebarCollapsed={setIsSidebarCollapsed} 
        />

        <main className="workspace">
          {discoverPanel}
          {libraryPanel}
          {settingsPanel}
          {youtubePanel}
          {editorPanel}
          {addonsPanel}

          {masterHudElement}
        </main>
      </div>

      {floatingPreviewElement}

      {/* Floating Error Toast */}
      {wallpaper.error && isErrorVisible && (
        <div className={`error-toast ${isErrorDismissed ? "error-toast--exiting" : "error-toast--entering"}`}>
          <div className="error-toast__icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div className="error-toast__body">
            <strong className="error-toast__title">Engine Error</strong>
            <p className="error-toast__message">{wallpaper.error}</p>
            {wallpaper.errorHint && <p className="error-toast__hint">{wallpaper.errorHint}</p>}
            {wallpaper.error.includes("mpv not found") && (
              <code className="error-toast__code">winget install shinchiro.mpv</code>
            )}
          </div>
          <button className="error-toast__dismiss" onClick={dismissError} aria-label="Dismiss error">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
      {downloadProgressOverlayElement}
    </div>
  );
}

export default dynamic(() => Promise.resolve(Home), { ssr: false });
