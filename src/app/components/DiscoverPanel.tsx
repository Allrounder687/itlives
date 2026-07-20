"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAddons, Addon } from "@/hooks/useAddons";
import { AdvancedFilters } from "./AdvancedFilters";
import DisplaySelector from "./DisplaySelector";
import { SearchResults } from "./SearchResults";
import { BatchDownloadModal } from "./BatchDownloadModal";
import { VideoResult } from "@/utils/wallpaperTypes";
import { useTranslation } from "@/hooks/useTranslation";

interface DiscoverPanelProps {
  wallpaper: any; // Context hook from useWallpaper
  setActiveTab: (tab: any) => void;
  onEditEffects?: (video: VideoResult) => void;
}

const CATEGORIES = [
  "All", "Women", "Men", "Black BG Minimalist", "Sci-Fi Cyberpunk",
  "Fantasy", "Aesthetic", "Anime", "Cyberpunk", "Minimalist", "Games", "Vaporwave", 
  "Lo-Fi", "Pixel Art", "Sci-Fi", "Superhero", "Nature", "Space", "Abstract", 
  "Synthwave", "Cityscape", "Car", "Landscape", "Neon", "Dark", "Futuristic",
  "Tv", "Holiday", "Animal", "Horror", "Technology", "Football", 
  "Japan", "Vintage", "3D Renders", "Illustration", "Architecture",
  "Steampunk", "Retro", "Cosmic", "Forest", "Ocean", "Glitch Art", 
  "Dark Academia", "Cottagecore", "Magical", "Vector", "Pastel"
];

const WALLPAPERWAVES_CATEGORIES = [
  "All", "Anime", "Abstract", "Animal", "Cartoon", "Fantasy", "Games", "Landscape", 
  "Memes", "Pixel Art", "Retro", "Sci-Fi", "TV Movies", "Vehicle"
];

const ALPHACODERS_CATEGORIES = [
  "All", "Anime", "Games", "Movies", "TV Shows", "Nature", "Space", "Fantasy",
  "Sci-Fi", "Abstract", "Cars", "Motorcycles", "Music", "Sports", "Photography", "Animals"
];

const WALLHAVEN_CATEGORIES = [
  { label: "All", value: "all", count: 0 },
  { label: "Nature", value: "https://wallhaven.cc/user/DeviateFish/collections/95531", count: 35786 },
  { label: "Urban", value: "https://wallhaven.cc/user/DeviateFish/collections/82369", count: 7109 },
  { label: "Space", value: "https://wallhaven.cc/user/DeviateFish/collections/648901", count: 1344 },
  { label: "Animals", value: "https://wallhaven.cc/user/DeviateFish/collections/95534", count: 8278 },
  { label: "Cars", value: "https://wallhaven.cc/user/DeviateFish/collections/89250", count: 2596 },
  { label: "Games", value: "https://wallhaven.cc/user/DeviateFish/collections/82366", count: 2386 },
  { label: "Art", value: "https://wallhaven.cc/user/DeviateFish/collections/1036329", count: 1911 },
  { label: "Digital Art", value: "https://wallhaven.cc/user/DeviateFish/collections/1638210", count: 4471 },
  { label: "Architecture", value: "https://wallhaven.cc/user/DeviateFish/collections/95532", count: 2329 },
  { label: "Film/TV", value: "https://wallhaven.cc/user/DeviateFish/collections/340321", count: 730 },
  { label: "Food/Drink", value: "https://wallhaven.cc/user/DeviateFish/collections/131464", count: 3066 }
].sort((a, b) => b.count - a.count);

// Available Addons Registry
const REMOTE_ADDONS_REGISTRY = [
  {
    id: "scraper-unified",
    sourceId: "unified",
    name: "Unified Feed Scraper",
    description: "Combined SFW video loops from MotionBGs, cinematic loops, and anime feeds.",
    install_url: "https://raw.githubusercontent.com/allrounder687/openclaw-addons/main/scripts/unified.js",
    addon_type: "script",
    version: "1.0.0",
    author: "it Lives",
    icon: "🎥",
    features: ["Combined multi-source feed", "Continuous live preview loops", "Optimized WebM streams"],
    type: "live"
  },
  {
    id: "scraper-wpwaves",
    sourceId: "wallpaperwaves",
    name: "WP Waves Scraper",
    description: "Premium high-fidelity live loop wallpapers and dynamic visual effects.",
    install_url: "https://raw.githubusercontent.com/allrounder687/openclaw-addons/main/scripts/wpwaves.js",
    addon_type: "script",
    version: "1.0.0",
    author: "it Lives",
    icon: "🌊",
    features: ["Cinematic dynamic loops", "Low CPU usage MP4 streams", "Deduplicated tag catalog"],
    type: "live"
  },
  {
    id: "scraper-alphacoders",
    sourceId: "alphacoders",
    name: "AlphaCoders Scraper",
    description: "Expands discovery with high-definition dynamic wallpapers, gaming clips, and anime loops.",
    install_url: "https://raw.githubusercontent.com/allrounder687/openclaw-addons/main/scripts/alphacoders.js",
    addon_type: "script",
    version: "1.0.0",
    author: "it Lives",
    icon: "🎬",
    features: ["Gaming & anime clips database", "Direct cache streaming", "HD & 4K video resolution"],
    type: "live"
  },
  {
    id: "scraper-wallhaven",
    sourceId: "wallhaven",
    name: "WallHaven Feed Scraper",
    description: "Dynamic scraping for high-res static images and visual digital art feeds.",
    install_url: "https://raw.githubusercontent.com/allrounder687/openclaw-addons/main/scripts/wallhaven.js",
    addon_type: "script",
    version: "1.0.0",
    author: "it Lives",
    icon: "🖼️",
    features: ["Custom public collections loading", "Hexadecimal color filtering", "Precise aspect ratio sorting"],
    type: "static"
  },
  {
    id: "scraper-pinterest",
    sourceId: "pinterest",
    name: "Pinterest Feed Scraper",
    description: "Import and scrape aesthetic visual boards and user curation boards in real-time.",
    install_url: "https://raw.githubusercontent.com/allrounder687/openclaw-addons/main/scripts/pinterest.js",
    addon_type: "script",
    version: "1.0.0",
    author: "it Lives",
    icon: "📌",
    features: ["Scrape custom boards inline", "Infinite search pagination", "Art & design photography feeds"],
    type: "static"
  }
];

export const DiscoverPanel = React.memo(function DiscoverPanel({
  wallpaper,
  setActiveTab,
  onEditEffects
}: DiscoverPanelProps) {
  const { t } = useTranslation();
  const { installedAddons, isAddonInstalled, evaluateAddon } = useAddons();

  // Collapsible Filters Drawer
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  // Custom Addon Filters Schema
  const [customFiltersSchema, setCustomFiltersSchema] = useState<any>(null);

  useEffect(() => {
    const builtinSources = ["wallhaven", "motionbgs", "pinterest", "youtube", "alphacoders", "wpwaves", "direct", "local", "favorites"];
    if (wallpaper.source && !builtinSources.includes(wallpaper.source)) {
      const addonId = `scraper-${wallpaper.source}`;
      if (isAddonInstalled(addonId)) {
        evaluateAddon(addonId).then((module: any) => {
          if (module && typeof module.getFilters === 'function') {
            setCustomFiltersSchema(module.getFilters());
          } else {
            setCustomFiltersSchema(null);
          }
        });
      } else {
        setCustomFiltersSchema(null);
      }
    } else {
      setCustomFiltersSchema(null);
    }
  }, [wallpaper.source, evaluateAddon, isAddonInstalled]);

  // Collapsible Sidebar & Filters
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showExploreAddons, setShowExploreAddons] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Background installation task state
  const [installingId, setInstallingId] = useState<string | null>(null);

  // Wallhaven collections local persistence
  const [wallhavenCollections, setWallhavenCollections] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("openclaw_wallhaven_collections");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [wallhavenUsername, setWallhavenUsername] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("openclaw_wallhaven_username") || "";
    }
    return "";
  });
  const [fetchingCollections, setFetchingCollections] = useState(false);
  const [showWallhavenCollections, setShowWallhavenCollections] = useState(true);

  // Pinterest state
  const [newPinUrl, setNewPinUrl] = useState("");
  const [pinAddStatus, setPinAddStatus] = useState<"idle" | "adding" | "added" | "duplicate">("idle");
  const [showPinterestSources, setShowPinterestSources] = useState(true);

  const [batchDownloadModalOpen, setBatchDownloadModalOpen] = useState(false);

  // Check if a source is currently installed
  const isSourceAvailable = useCallback((src: string) => {
    if (src === "direct") return true;
    if (src === "wallpaperwaves") return isAddonInstalled("scraper-wpwaves");
    return isAddonInstalled(`scraper-${src}`);
  }, [isAddonInstalled]);

  // Dynamic separation of Installed vs explore addons
  const activeSources = useMemo(() => {
    const list: Array<{
      id: string;
      label: string;
      icon: string;
      desc: string;
      type: string;
      installed: boolean;
      addonId: string | null;
    }> = [
      { id: "direct", label: "Direct URL / File", icon: "🔗", desc: "Paste direct URL or browse local file", type: "direct", installed: true, addonId: null }
    ];

    REMOTE_ADDONS_REGISTRY.forEach((addon) => {
      const installed = isAddonInstalled(addon.id);
      if (installed) {
        list.push({
          id: addon.sourceId,
          label: addon.name.replace(" Scraper", "").replace(" Feed", ""),
          icon: addon.icon,
          desc: addon.description,
          type: addon.type,
          installed: true,
          addonId: addon.id
        });
      }
    });

    // Also include custom scraper addons that might not be in our registry but start with "scraper-"
    installedAddons.forEach((addon: Addon) => {
      if (addon.id.startsWith("scraper-") && !REMOTE_ADDONS_REGISTRY.some(r => r.id === addon.id)) {
        const rawId = addon.id.replace("scraper-", "");
        const label = rawId.charAt(0).toUpperCase() + rawId.slice(1);
        list.push({
          id: rawId,
          label: label,
          icon: "🔌",
          desc: addon.description || "Custom scraper source",
          type: "live",
          installed: true,
          addonId: addon.id
        });
      }
    });

    return list;
  }, [installedAddons, isAddonInstalled]);

  const exploreSources = useMemo(() => {
    const list: any[] = [];
    REMOTE_ADDONS_REGISTRY.forEach((addon) => {
      const installed = isAddonInstalled(addon.id);
      if (!installed) {
        list.push({
          id: addon.sourceId,
          addonId: addon.id,
          label: addon.name.replace(" Scraper", "").replace(" Feed", ""),
          icon: addon.icon,
          desc: addon.description,
          type: addon.type,
          features: addon.features,
          installed: false
        });
      }
    });
    return list;
  }, [isAddonInstalled]);

  // Get active source info (whether installed or not)
  const currentSourceInfo = useMemo(() => {
    const all = [...activeSources, ...exploreSources];
    return all.find(s => s.id === wallpaper.source) || activeSources[0];
  }, [activeSources, exploreSources, wallpaper.source]);

  // Heatmap helper for Wallhaven count
  const maxCollectionCount = useMemo(() => {
    return wallhavenCollections.length > 0 ? Math.max(...wallhavenCollections.map(c => c.count || 0)) : 0;
  }, [wallhavenCollections]);

  const getHeatmapColor = (count: number, maxCount: number) => {
    if (maxCount === 0 || count === 0) return undefined;
    const ratio = Math.log(count + 1) / Math.log(maxCount + 1);
    const hue = 220 + (100 * ratio);
    return `hsla(${hue}, 80%, 60%, ${0.15 + 0.5 * ratio})`;
  };

  // Inline Scraper Installer handler
  const handleInstallAddonInline = async (addonId: string) => {
    const addonInfo = REMOTE_ADDONS_REGISTRY.find(a => a.id === addonId);
    if (!addonInfo) return;
    setInstallingId(addonId);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      
      // Standard addon structure to pass to Tauri commands
      const addonObj = {
        id: addonInfo.id,
        name: addonInfo.name,
        description: addonInfo.description,
        install_url: addonInfo.install_url,
        addon_type: addonInfo.addon_type,
        version: addonInfo.version,
        author: addonInfo.author
      };
      
      await invoke("install_addon", { addon: addonObj });
      
      // Small artificial delay for sync
      await new Promise(r => setTimeout(r, 600));

      // Dispatch reload custom events
      window.dispatchEvent(new CustomEvent('reload-addons'));
      window.dispatchEvent(new CustomEvent('reload-app-state'));
    } catch (e) {
      console.error("Failed to install addon inline", e);
      alert("Failed to install scraper addon: " + e);
    } finally {
      setInstallingId(null);
    }
  };

  // Wallhaven handlers
  const handleFetchWallhavenCollections = async () => {
    if (!wallhavenUsername.trim()) return;
    setFetchingCollections(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const resp = await invoke<string>("fetch_wallhaven_collections", { username: wallhavenUsername.trim() });
      const data = JSON.parse(resp);
      if (data && data.data) {
        const collections = data.data.map((c: any) => ({
          label: c.label,
          value: `https://wallhaven.cc/user/${wallhavenUsername.trim()}/collections/${c.id}`,
          count: c.count || 0
        })).sort((a: any, b: any) => b.count - a.count);
        
        setWallhavenCollections(collections);
        localStorage.setItem("openclaw_wallhaven_collections", JSON.stringify(collections));
        localStorage.setItem("openclaw_wallhaven_username", wallhavenUsername.trim());
      }
    } catch (e) {
      console.error(e);
      alert("Failed to fetch collections. Username might not exist.");
    } finally {
      setFetchingCollections(false);
    }
  };

  // Pinterest handlers
  const handleAddPinUrl = async () => {
    const trimmed = newPinUrl.trim();
    if (!trimmed || !wallpaper.setPinterestUrls) return;
    const currentList = wallpaper.pinterestUrls || [];
    if (currentList.includes(trimmed)) {
      setPinAddStatus("duplicate");
      setTimeout(() => setPinAddStatus("idle"), 2000);
      return;
    }
    setPinAddStatus("adding");
    await wallpaper.setPinterestUrls([...currentList, trimmed]);
    setNewPinUrl("");
    setPinAddStatus("added");
    setTimeout(() => setPinAddStatus("idle"), 1500);
  };

  const handleRemovePinUrl = async (idx: number) => {
    if (!wallpaper.setPinterestUrls) return;
    const currentList = wallpaper.pinterestUrls || [];
    await wallpaper.setPinterestUrls(currentList.filter((_: any, i: number) => i !== idx));
  };

  return (
    <div className={`discover-dashboard ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      {/* LEFT SIDEBAR PANEL */}
      <aside className="discover-sidebar">
        {/* ACTIVE FEEDS LIST */}
        <div className="discover-sidebar-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="discover-sidebar-title">{t("activeFeeds")}</span>
          </div>
          <div className="discover-sources-list">
            {activeSources.map((src) => {
              const isActive = wallpaper.source === src.id;
              return (
                <div
                  key={src.id}
                  role="button"
                  tabIndex={0}
                  className={`discover-source-item ${isActive ? "active" : ""}`}
                  onClick={() => wallpaper.setSource(src.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      wallpaper.setSource(src.id);
                    }
                  }}
                >

                  <span className="discover-source-icon">{src.icon}</span>
                  <div className="discover-source-info">
                    <h3 className="discover-source-label">{src.label}</h3>
                    <p className="discover-source-desc">{src.desc}</p>
                  </div>
                  <span className="discover-source-badge">{src.type}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* EXPLORE ADDONS */}
        <div className="discover-sidebar-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="discover-sidebar-title">Explore Addons</span>
            <button 
              type="button"
              className="discover-btn-link"
              style={{ padding: "4px 8px", fontSize: "11px", height: "auto", border: "1px solid rgba(255,255,255,0.03)" }}
              onClick={() => setShowExploreAddons(!showExploreAddons)}
            >
              {showExploreAddons ? "Hide" : "Browse"}
            </button>
          </div>
          
          {showExploreAddons && (
            <div className="discover-sources-list discover-sources-list--addons">
              {exploreSources.map((src) => {
                const installed = isAddonInstalled(src.id);
                return (
                  <div
                    key={src.id}
                    className="discover-source-item discover-source-item--addon"
                  >
                    <div className="discover-source-item__info">
                      <span className="discover-source-item__icon">{src.icon}</span>
                      <div className="discover-source-item__text">
                        <span className="discover-source-item__label">{src.label}</span>
                        {src.desc && <span className="discover-source-item__desc">{src.desc}</span>}
                      </div>
                    </div>
                    {installed ? (
                      <span className="discover-source-item__status">Installed</span>
                    ) : (
                      <button
                        className="discover-btn-install"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInstallAddonInline(src.addonId);
                        }}
                        disabled={installingId === src.addonId}
                      >
                        {installingId === src.addonId ? "Installing..." : "Install"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Source Configurations (Pinterest / Wallhaven / Direct) */}
        {wallpaper.source === "pinterest" && activeSources.some(s => s.id === "pinterest") && (
          <div className="discover-sidebar-section">
            <span className="discover-sidebar-title">Pinterest Boards</span>
            <div className="discover-source-config">
              <button
                type="button"
                onClick={() => setShowPinterestSources(!showPinterestSources)}
                style={{
                  display: "flex", justifyContent: "space-between", width: "100%",
                  background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: 600
                }}
              >
                <span>Boards Manager ({wallpaper.pinterestUrls?.length || 0})</span>
                <span>{showPinterestSources ? "▼" : "▲"}</span>
              </button>

              {showPinterestSources && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input
                      type="text"
                      className="input"
                      placeholder="Paste Board or search URL..."
                      value={newPinUrl}
                      onChange={(e) => setNewPinUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddPinUrl(); }}
                      style={{ padding: "8px 10px", fontSize: "11px", height: "32px" }}
                    />
                    <button
                      type="button"
                      className="action-btn action-btn--primary"
                      onClick={handleAddPinUrl}
                      disabled={pinAddStatus === "adding"}
                      style={{ padding: "0 12px", fontSize: "11px", height: "32px", whiteSpace: "nowrap" }}
                    >
                      {pinAddStatus === "adding" ? "..." : pinAddStatus === "added" ? "✓" : "+"}
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "120px", overflowY: "auto" }}>
                    {wallpaper.pinterestUrls?.map((url: string, idx: number) => {
                      let label = url;
                      try {
                        const parsed = new URL(url);
                        const q = parsed.searchParams.get("q");
                        label = q ? `🔍 ${decodeURIComponent(q)}` : `📋 ${parsed.pathname.split("/").filter(Boolean).slice(-2).join(" / ")}`;
                      } catch {}
                      return (
                        <div key={idx} style={{
                          display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "space-between",
                          padding: "6px 8px", background: "rgba(255,255,255,0.02)", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.04)"
                        }}>
                          <span style={{ fontSize: "10px", color: "var(--text-soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "150px" }} title={url}>{label}</span>
                          <button
                            type="button"
                            onClick={() => handleRemovePinUrl(idx)}
                            style={{ background: "transparent", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "10px", padding: "2px 6px" }}
                          >✕</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {wallpaper.source === "wallhaven" && activeSources.some(s => s.id === "wallhaven") && (
          <div className="discover-sidebar-section">
            <span className="discover-sidebar-title">Wallhaven Config</span>
            <div className="discover-source-config">
              <button
                type="button"
                onClick={() => setShowWallhavenCollections(!showWallhavenCollections)}
                style={{
                  display: "flex", justifyContent: "space-between", width: "100%",
                  background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: 600
                }}
              >
                <span>User Collections ({wallhavenCollections.length})</span>
                <span>{showWallhavenCollections ? "▼" : "▲"}</span>
              </button>

              {showWallhavenCollections && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input
                      type="text"
                      className="input"
                      placeholder="Enter username..."
                      value={wallhavenUsername}
                      onChange={(e) => setWallhavenUsername(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleFetchWallhavenCollections(); }}
                      style={{ padding: "8px 10px", fontSize: "11px", height: "32px" }}
                    />
                    <button
                      type="button"
                      className="action-btn action-btn--primary"
                      onClick={handleFetchWallhavenCollections}
                      disabled={fetchingCollections}
                      style={{ padding: "0 10px", fontSize: "11px", height: "32px" }}
                    >
                      {fetchingCollections ? "..." : "Load"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {wallpaper.source === "direct" && (
          <div className="discover-sidebar-section">
            <span className="discover-sidebar-title">Local Entry</span>
            <button
              type="button"
              className="discover-btn-link"
              onClick={wallpaper.browseLocalVideo}
              disabled={wallpaper.isLoading}
            >
              📂 Browse Local Media File
            </button>
          </div>
        )}

        {/* Collapsible Advanced Filters Drawer */}
        {wallpaper.source !== "direct" && isFiltersExpanded && !wallpaper.category?.startsWith("http") && (
          <div className="discover-sidebar-section" style={{ marginTop: "auto" }}>
            <span className="discover-sidebar-title">Search Filters</span>

            {/* Target Monitor Selector inside Filters */}
            <div style={{ marginBottom: "16px" }}>
              <span className="discover-sidebar-title" style={{ fontSize: "10px", opacity: 0.7, marginBottom: "8px", display: "block" }}>Screen Assignment</span>
              <DisplaySelector />
            </div>

            {customFiltersSchema ? (
               <div style={{ padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", fontSize: "11px", color: "var(--text-soft)" }}>
                 <p style={{ margin: "0 0 12px 0", color: "var(--accent)" }}>Custom Plugin Filters</p>
                 {Object.entries(customFiltersSchema).map(([key, value]: [string, any]) => (
                   <div key={key} style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
                      <span style={{ fontWeight: 600 }}>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                      {Array.isArray(value) ? (
                         <select className="input" style={{ padding: "6px 8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#fff" }}>
                           {value.map((v: string) => <option key={v} value={v}>{v}</option>)}
                         </select>
                      ) : (
                         <input type="text" className="input" placeholder={`Enter ${key}...`} style={{ padding: "6px 8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#fff" }} />
                      )}
                   </div>
                 ))}
               </div>
            ) : (
               <div style={{ padding: "16px", textAlign: "center", background: "rgba(0,0,0,0.2)", borderRadius: "8px", fontSize: "11px", color: "var(--text-dim)", border: "1px dashed rgba(255,255,255,0.05)" }}>
                 No advanced filters available for this source.
               </div>
            )}
          </div>
        )}

        {/* Toggle Filters Button */}
        {wallpaper.source !== "direct" && !wallpaper.category?.startsWith("http") && (
          <button
            type="button"
            className="discover-btn-link"
            style={{ padding: "8px 10px", fontSize: "11px", border: "1px solid rgba(255,255,255,0.03)" }}
            onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
          >
            {isFiltersExpanded ? "▲ Hide Search Filters" : "▼ Show Search Filters"}
          </button>
        )}
      </aside>

      {/* Floating Toggle Button */}
      <button
        type="button"
        className="sidebar-toggle-btn"
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        style={{
          position: "absolute",
          left: isSidebarCollapsed ? "0" : "278px",
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 20,
          background: "var(--bg-elevated)",
          border: "1px solid var(--panel-edge)",
          borderLeft: isSidebarCollapsed ? "none" : "1px solid var(--panel-edge)",
          borderRadius: isSidebarCollapsed ? "0 12px 12px 0" : "50%",
          padding: isSidebarCollapsed ? "24px 8px" : "8px",
          color: "var(--text-soft)",
          cursor: "pointer",
          backdropFilter: "blur(12px)",
          boxShadow: "4px 0 15px rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "left 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.15s ease",
          width: isSidebarCollapsed ? "auto" : "28px",
          height: isSidebarCollapsed ? "auto" : "28px"
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ 
            transform: isSidebarCollapsed ? "rotate(180deg)" : "rotate(0deg)", 
            transition: "transform 0.3s ease" 
          }}
        >
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>

      {/* RIGHT CONTENT WORKSPACE */}
      <main className="discover-content">
        {/* Premium Hero Title Banner */}
        <header className="discover-hero-banner" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <h1>{t("discoverTitle")}</h1>
            <p>
              {t("discoverDesc")}
            </p>
          </div>
        </header>

        {/* Search Input Area */}
        <div className="discover-search-row">
          <div className="discover-search-container">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="discover-search-input"
              placeholder={wallpaper.source === "direct" ? t("searchDirectPlaceholder") : t("searchPlaceholder")}
              value={wallpaper.query}
              onChange={(e) => wallpaper.setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isSourceAvailable(wallpaper.source)) {
                  wallpaper.fetchVideosList();
                }
              }}
            />
          </div>

          <div className="discover-actions-group">
            <button
              className="action-btn action-btn--primary"
              onClick={wallpaper.fetchVideosList}
              disabled={wallpaper.isLoading || !isSourceAvailable(wallpaper.source)}
              style={{ padding: "10px 18px", fontSize: "12px", height: "42px" }}
            >
              {wallpaper.isLoading ? t("queryingBtn") : t("searchBtn")}
            </button>

            <button
              className="action-btn action-btn--ghost"
              onClick={wallpaper.stopWallpaper}
              style={{ padding: "10px 14px", fontSize: "12px", height: "42px" }}
            >
              {t("unloadBtn")}
            </button>
          </div>
        </div>

        {/* Categories Bar */}
        {wallpaper.source !== "direct" && wallpaper.source !== "youtube" && isSourceAvailable(wallpaper.source) && (
          <div className="discover-category-list">
            {(() => {
              let catsToRender: any[] = [];
              let isObject = false;

              if (wallpaper.source === "wallhaven") {
                catsToRender = [{ label: "All", value: "all", count: 0 }, ...wallhavenCollections];
                isObject = true;
              } else if (wallpaper.source === "alphacoders") {
                catsToRender = ALPHACODERS_CATEGORIES;
              } else {
                catsToRender = wallpaper.source === "wallpaperwaves" ? WALLPAPERWAVES_CATEGORIES : CATEGORIES;
              }

              const displayLimit = 12;
              const hasMore = catsToRender.length > displayLimit;
              const visibleCats = showAllCategories ? catsToRender : catsToRender.slice(0, displayLimit);

              return (
                <>
                  {visibleCats.map((cat: any) => {
                    const isActive = isObject 
                      ? (wallpaper.category || "all").toLowerCase() === cat.value.toLowerCase()
                      : (wallpaper.category || "all").toLowerCase() === cat.toLowerCase();

                    return (
                      <button
                        key={isObject ? cat.label : cat}
                        type="button"
                        className={`discover-category-pill ${isActive ? "active" : ""}`}
                        style={isObject && !isActive && cat.count ? {
                          background: getHeatmapColor(cat.count, maxCollectionCount),
                          color: "#fff"
                        } : undefined}
                        onClick={() => wallpaper.setCategory(isObject ? cat.value : cat.toLowerCase())}
                      >
                        {isObject ? `${cat.label} ${cat.count ? `(${cat.count.toLocaleString()})` : ''}` : cat}
                      </button>
                    );
                  })}
                  
                  {hasMore && (
                    <button
                      type="button"
                      className="discover-category-pill discover-category-pill--more"
                      onClick={() => setShowAllCategories(!showAllCategories)}
                      style={{ background: "transparent", border: "1px dashed rgba(255,255,255,0.2)" }}
                    >
                      {showAllCategories ? "Show Less ▲" : `Show More +${catsToRender.length - displayLimit}`}
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Wallhaven batch download helper */}
        {wallpaper.source === "wallhaven" && wallpaper.category?.startsWith("http") && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-8px" }}>
            <button
              type="button"
              className="action-btn action-btn--secondary"
              style={{ padding: "6px 14px", fontSize: "11px", gap: "6px" }}
              onClick={() => setBatchDownloadModalOpen(true)}
            >
              ⬇️ Batch Download Collection
            </button>
          </div>
        )}

        {/* Wallpaper Feed Grid (Dynamic rendering based on installation status) */}
        {isSourceAvailable(wallpaper.source) ? (
          <div style={{ flex: 1, minHeight: 0 }}>
            <SearchResults
              results={wallpaper.searchResults}
              onSelect={wallpaper.selectVideo}
              page={wallpaper.page}
              onPageChange={wallpaper.setPage}
              isLoading={wallpaper.isLoading}
              hasMore={wallpaper.hasMore ?? true}
              duplicateNotice={wallpaper.duplicateNotice}
              onEditEffects={onEditEffects}
            />
          </div>
        ) : (
          /* GORGEOUS LOCKED BLURRED PREVIEW STATE */
          <div className="locked-source-container">
            {/* Blurred background preview tiles */}
            <div className="locked-preview-grid">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="locked-preview-card" />
              ))}
            </div>

            {/* Central glass overlay card */}
            <div className="locked-source-overlay">
              <div className="locked-glass-card">
                <h3>Unlock {currentSourceInfo?.label || "Scraper"} Feed</h3>
                <p>
                  {currentSourceInfo?.desc || "Enhance your discovery feed with premium animated wallpapers."}
                </p>

                <div className="locked-features-list">
                  {((currentSourceInfo as any)?.features || ["Live continuous loops", "Optimized media compression", "Direct stream browser"]).map((feat: string, i: number) => (
                    <div key={i} className="locked-feature-item">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      {feat}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="locked-action-btn"
                  onClick={() => handleInstallAddonInline(currentSourceInfo.addonId)}
                  disabled={installingId === currentSourceInfo.addonId}
                >
                  {installingId === currentSourceInfo.addonId ? "Installing Scraper..." : `Install Scraper Addon`}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Batch Download Modal */}
      {batchDownloadModalOpen && (
        <BatchDownloadModal
          collectionUrl={wallpaper.category}
          collectionName={wallhavenCollections.find(c => c.value === wallpaper.category)?.label || "Wallhaven Collection"}
          onClose={() => setBatchDownloadModalOpen(false)}
        />
      )}
    </div>
  );
});
