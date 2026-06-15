"use client";

import React, { useState, useEffect } from "react";
import { useAddons, Addon } from "@/hooks/useAddons";

export const AddonsMarketplace = React.memo(function AddonsMarketplace() {
  const { installedAddons, isAddonInstalled, loadAddons, isLoading: addonsLoading } = useAddons();
  const [remoteAddons, setRemoteAddons] = useState<Addon[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRemoteAddons();
  }, []);

  const fetchRemoteAddons = async () => {
    setIsFetching(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const url = "https://raw.githubusercontent.com/allrounder687/openclaw-addons/main/addons.json";
      const addons = await invoke<Addon[]>("fetch_addon_registry", { registryUrl: url });
      setRemoteAddons(addons);
    } catch (e) {
      console.warn("Local fallback mode active for addons. (This is expected until the remote GitHub registry is pushed).", e);
      // Fallback local mock for UI testing purposes if the repo isn't up yet
      setRemoteAddons([
        {
          id: "youtube-dl",
          name: "Web Video Downloader (yt-dlp)",
          description: "Unlocks the ability to stream and download clips from YouTube, Twitch, Vimeo, and more.",
          install_url: "",
          addon_type: "executable",
          version: "1.0.0",
          author: "it Lives"
        },
        {
          id: "scraper-pinterest",
          name: "Pinterest Scraper",
          description: "Adds Pinterest as a dynamic wallpaper source. Allows scraping images from Pinterest boards.",
          install_url: "https://raw.githubusercontent.com/allrounder687/openclaw-addons/main/scripts/pinterest.js",
          addon_type: "script",
          version: "1.0.0",
          author: "it Lives"
        },
        {
          id: "scraper-alphacoders",
          name: "AlphaCoders Scraper",
          description: "Adds AlphaCoders as a source for high-quality live video loops.",
          install_url: "https://raw.githubusercontent.com/allrounder687/openclaw-addons/main/scripts/alphacoders.js",
          addon_type: "script",
          version: "1.0.0",
          author: "it Lives"
        },
        {
          id: "scraper-unified",
          name: "Unified Live Feed",
          description: "Combined SFW video feed provider (MotionBGs, etc).",
          install_url: "https://raw.githubusercontent.com/allrounder687/openclaw-addons/main/scripts/unified.js",
          addon_type: "script",
          version: "1.0.0",
          author: "it Lives"
        },
        {
          id: "scraper-wpwaves",
          name: "Wallpaper Waves Feed",
          description: "Premium live loops and animated wallpapers.",
          install_url: "https://raw.githubusercontent.com/allrounder687/openclaw-addons/main/scripts/wpwaves.js",
          addon_type: "script",
          version: "1.0.0",
          author: "it Lives"
        }
      ]);
    } finally {
      setIsFetching(false);
    }
  };

  const handleInstall = async (addon: Addon) => {
    setProcessingId(addon.id);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("install_addon", { addon });
      await loadAddons();
      window.dispatchEvent(new CustomEvent('reload-addons'));
    } catch (e) {
      console.error("Failed to install addon", e);
    } finally {
      setProcessingId(null);
    }
  };

  const handleUninstall = async (id: string) => {
    setProcessingId(id);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("uninstall_addon", { id });
      await loadAddons();
      window.dispatchEvent(new CustomEvent('reload-addons'));
    } catch (e) {
      console.error("Failed to uninstall addon", e);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <section className="panel panel--main" style={{ padding: "32px", overflowY: "auto" }}>
      <div className="section-head" style={{ marginBottom: "2rem" }}>
        <span className="eyebrow">Extensions & Plugins</span>
        <h2>Addons Marketplace</h2>
        <p className="muted" style={{ maxWidth: "600px", marginTop: "8px" }}>
          Enhance your OpenClaw experience by installing community-developed scrapers, features, and integrations. 
          By installing an addon, you agree to comply with the respective platform's Terms of Service.
        </p>
      </div>

      {isFetching ? (
        <div className="skeleton skeleton-preview" />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
          {remoteAddons.map(addon => {
            const installed = isAddonInstalled(addon.id);
            const processing = processingId === addon.id;
            
            return (
              <div key={addon.id} style={{
                background: installed ? "rgba(154, 230, 0, 0.05)" : "rgba(255, 255, 255, 0.02)",
                border: installed ? "1px solid rgba(154, 230, 0, 0.3)" : "1px solid rgba(255, 255, 255, 0.05)",
                borderRadius: "12px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text)" }}>{addon.name}</h3>
                  <span style={{ fontSize: "11px", opacity: 0.5, background: "rgba(0,0,0,0.5)", padding: "2px 6px", borderRadius: "4px" }}>
                    v{addon.version}
                  </span>
                </div>
                
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-soft)", flex: 1, lineHeight: "1.5" }}>
                  {addon.description}
                </p>
                
                <div style={{ fontSize: "11px", color: "var(--accent)" }}>
                  By: {addon.author}
                </div>

                <div style={{ marginTop: "8px" }}>
                  {installed ? (
                    <button 
                      className="action-btn action-btn--ghost" 
                      onClick={() => handleUninstall(addon.id)}
                      disabled={processing}
                      style={{ width: "100%", color: "#ff6b6b" }}
                    >
                      {processing ? "Uninstalling..." : "Uninstall Addon"}
                    </button>
                  ) : (
                    <button 
                      className="action-btn action-btn--primary" 
                      onClick={() => handleInstall(addon)}
                      disabled={processing}
                      style={{ width: "100%" }}
                    >
                      {processing ? "Installing..." : "Install Addon"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          
          {remoteAddons.length === 0 && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px", opacity: 0.5 }}>
              No addons found in the remote registry.
            </div>
          )}
        </div>
      )}
    </section>
  );
});
