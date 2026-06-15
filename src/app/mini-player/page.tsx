"use client";

import { useWallpaper } from "@/hooks/useWallpaper";
import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { convertFileSrc } from "@tauri-apps/api/core";
import { isStaticWallpaper } from "@/utils/wallpaperTypes";
import { Play, Pause, SkipForward, SkipBack, Settings, Square, X, Maximize2 } from "lucide-react";

function MiniPlayer() {
  const wallpaper = useWallpaper();
  const [mounted, setMounted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [systemWallpaper, setSystemWallpaper] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && typeof document !== "undefined") {
      document.documentElement.style.background = "transparent";
      document.documentElement.style.backgroundColor = "transparent";
      document.body.style.background = "transparent";
      document.body.style.backgroundColor = "transparent";

      // Force transparency on all direct wrapper divs inside body (Next.js route portals/wrappers)
      const children = document.body.children;
      for (let i = 0; i < children.length; i++) {
        const child = children[i] as HTMLElement;
        if (child.tagName === "DIV") {
          child.style.background = "transparent";
          child.style.backgroundColor = "transparent";
        }
      }
    }
  }, [mounted]);

  useEffect(() => {
    const fetchSystemWallpaper = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const path = await invoke<string>("get_system_wallpaper");
        if (path) {
          setSystemWallpaper(convertFileSrc(path));
        }
      } catch (e) {
        console.warn("Failed to get system wallpaper:", e);
      }
    };
    if (mounted) {
      fetchSystemWallpaper();
    }
  }, [mounted, wallpaper.currentVideo]);

  const startDrag = async (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("select")) return;

    setIsDragging(true);
    dragStartPos.current = { x: e.screenX, y: e.screenY };
  };

  useEffect(() => {
    const handleMouseMove = async (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.screenX - dragStartPos.current.x;
      const dy = e.screenY - dragStartPos.current.y;
      if (dx === 0 && dy === 0) return;

      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        const pos = await win.outerPosition();
        const { PhysicalPosition } = await import("@tauri-apps/api/window");
        await win.setPosition(new PhysicalPosition(pos.x + dx, pos.y + dy));
        dragStartPos.current = { x: e.screenX, y: e.screenY };
      } catch (err) {
        console.error("Drag move failed:", err);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const closeWindow = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("hide_mini_player");
    } catch (e) {
      console.error("Failed to hide mini player", e);
    }
  };

  const restoreMainWindow = async () => {
    try {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const mainWin = await WebviewWindow.getByLabel("main");
      if (mainWin) {
        await mainWin.show();
        await mainWin.unminimize();
        await mainWin.setFocus();
      }
    } catch (e) {
      console.error("Failed to restore main window", e);
    }
  };

  if (!mounted) return null;

  const currentVideo = wallpaper.currentVideo;
  const videoSrc = currentVideo 
    ? (currentVideo.local_path ? convertFileSrc(currentVideo.local_path) : currentVideo.video_url)
    : "";

  const thumbnailSrc = currentVideo
    ? (currentVideo.thumbnail_url?.startsWith("http") || currentVideo.thumbnail_url?.startsWith("data:")
      ? currentVideo.thumbnail_url
      : (currentVideo.thumbnail_url 
          ? convertFileSrc(currentVideo.thumbnail_url) 
          : (currentVideo.local_path ? convertFileSrc(currentVideo.local_path) : "")))
    : systemWallpaper;

  return (
    <div style={{
      position: "relative",
      width: "100vw",
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      color: "#fff",
      overflow: "hidden",
      fontFamily: "system-ui, -apple-system, sans-serif",
      padding: "10px",
      boxSizing: "border-box",
      background: "transparent"
    }}>
      {/* Global CSS injection for transparent body, animations, and custom slider */}
      <style dangerouslySetInnerHTML={{__html: `
        html, body, #__next, body > div, [data-reactroot] {
          background: transparent !important;
          background-color: transparent !important;
          margin: 0;
          padding: 0;
          overflow: hidden !important;
          user-select: none;
        }
        nextjs-portal, #nextjs-dev-overlay-container, [data-nextjs-toast], [data-nextjs-portal] {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
          width: 0 !important;
          height: 0 !important;
          pointer-events: none !important;
        }
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 6px #00ff88, 0 0 10px #00ff88; opacity: 0.8; }
          50% { box-shadow: 0 0 14px #00ff88, 0 0 24px #00ff88; opacity: 1; }
          100% { box-shadow: 0 0 6px #00ff88, 0 0 10px #00ff88; opacity: 0.8; }
        }
        .pulse-active {
          animation: pulseGlow 2s infinite ease-in-out;
        }
        @keyframes loadingPulse {
          0% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.35); opacity: 1; }
          100% { transform: scale(1); opacity: 0.5; }
        }
        .loading-pulse {
          animation: loadingPulse 1s infinite ease-in-out;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .hover-btn {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .hover-btn:hover {
          transform: scale(1.08);
        }
        .hover-btn:active {
          transform: scale(0.95);
        }
        .mini-slider {
          -webkit-appearance: none;
          width: 100%;
          height: 5px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.15);
          outline: none;
          transition: background 0.15s;
        }
        .mini-slider:hover {
          background: rgba(255, 255, 255, 0.25);
        }
        .mini-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #00ff88;
          cursor: pointer;
          box-shadow: 0 0 8px rgba(0, 255, 136, 0.6);
          transition: transform 0.1s, background-color 0.15s;
        }
        .mini-slider::-webkit-slider-thumb:hover {
          transform: scale(1.3);
          background: #33ffaa;
        }
        .mini-slider::-webkit-slider-thumb:active {
          transform: scale(1.1);
        }
      `}} />

      {/* Adaptive Background Layer */}
      <div style={{
        position: "absolute",
        top: "10px",
        left: "10px",
        right: "10px",
        bottom: "10px",
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        borderRadius: "20px",
        clipPath: "inset(0 round 20px)",
        isolation: "isolate"
      }}>
        {currentVideo ? (
          <>
            {/* Display blurred video if the active wallpaper is a video */}
            {videoSrc && !isStaticWallpaper(currentVideo) && (
              <video
                key={videoSrc}
                src={videoSrc}
                autoPlay
                loop
                muted
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  filter: "blur(30px) brightness(0.35) saturate(1.35)",
                  transform: "scale(1.15)",
                  zIndex: 1
                }}
              />
            )}
            {/* Blurred thumbnail as wallpaper baseline/fallback */}
            <img
              src={thumbnailSrc || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80"}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "blur(30px) brightness(0.35) saturate(1.35)",
                transform: "scale(1.15)",
                zIndex: 0
              }}
            />
          </>
        ) : systemWallpaper ? (
          /* Show blurred system desktop wallpaper when app LWP is inactive */
          <img
            src={systemWallpaper}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "blur(30px) brightness(0.35) saturate(1.35)",
              transform: "scale(1.15)",
              zIndex: 0
            }}
          />
        ) : (
          /* Default elegant dark canvas when idle and no system wallpaper found */
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, #07110a 0%, #0c1a10 100%)",
            zIndex: 0
          }} />
        )}
      </div>

      {/* Transparent Glass Container */}
      <div style={{
        position: "relative",
        zIndex: 2,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: "rgba(10, 15, 12, 0.28)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "20px",
        boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.1), 0 24px 60px rgba(0, 0, 0, 0.5)"
      }}>
        {/* Header - Drag Region */}
        <div 
          data-tauri-drag-region
          onMouseDown={startDrag}
          style={{
            height: "44px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            cursor: "grab"
          }}
        >
          {/* Status Indicator */}
          <div data-tauri-drag-region style={{ display: "flex", alignItems: "center", gap: "8px", pointerEvents: "none" }}>
            <div 
              className={wallpaper.isLoading ? "loading-pulse" : (wallpaper.isPlaying && !wallpaper.paused ? "pulse-active" : "")}
              style={{ 
                width: "8px", 
                height: "8px", 
                borderRadius: "50%", 
                background: wallpaper.isLoading 
                  ? "#00bfff" 
                  : (wallpaper.isPlaying && !wallpaper.paused ? "#00ff88" : (wallpaper.paused ? "#ffaa00" : "#666")),
                boxShadow: wallpaper.isLoading 
                  ? "0 0 10px #00bfff" 
                  : (wallpaper.isPlaying && !wallpaper.paused ? "0 0 10px #00ff88" : "none"),
                transition: "all 0.3s ease"
              }} 
            />
            <span style={{ fontSize: "12px", fontWeight: "600", letterSpacing: "0.5px", color: "rgba(255, 255, 255, 0.85)" }}>
              {wallpaper.isLoading 
                ? "Loading..." 
                : (wallpaper.isPlaying && !wallpaper.paused ? "Active" : (wallpaper.paused ? "Paused" : "Standby"))}
            </span>
          </div>

          {/* Header Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button 
              onClick={restoreMainWindow}
              className="hover-btn"
              style={{ 
                background: "rgba(255,255,255,0.06)", 
                border: "none", 
                color: "#ccc", 
                cursor: "pointer", 
                padding: "6px", 
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              title="Restore Dashboard"
            >
              <Maximize2 size={13} />
            </button>
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="hover-btn"
              style={{ 
                background: showSettings ? "rgba(0, 255, 136, 0.15)" : "rgba(255,255,255,0.06)", 
                border: "none", 
                color: showSettings ? "#00ff88" : "#ccc", 
                cursor: "pointer", 
                padding: "6px", 
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              title="Settings"
            >
              <Settings size={13} />
            </button>
            <button 
              onClick={closeWindow}
              className="hover-btn"
              style={{ 
                background: "rgba(255, 91, 103, 0.1)", 
                border: "none", 
                color: "#ff5b67", 
                cursor: "pointer", 
                padding: "6px", 
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              title="Close Mini Player"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Center Floating Art/Preview */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "8px 20px 0 20px"
        }}>
          {/* Floating 16:9 Card */}
          <div style={{
            width: "100%",
            aspectRatio: "16/9",
            borderRadius: "12px",
            overflow: "hidden",
            position: "relative",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            boxShadow: "0 12px 28px rgba(0, 0, 0, 0.45)",
            background: "rgba(0, 0, 0, 0.3)"
          }}>
            {videoSrc && !isStaticWallpaper(currentVideo) ? (
              <video
                src={videoSrc}
                autoPlay
                loop
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : thumbnailSrc ? (
              <img
                src={thumbnailSrc}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255, 255, 255, 0.4)",
                fontSize: "12px",
                fontWeight: "500",
                letterSpacing: "0.5px"
              }}>
                No wallpaper active
              </div>
            )}
            
            {/* Subtle Loading Spinner Overlay */}
            {wallpaper.isLoading && (
              <div style={{
                position: "absolute",
                inset: 0,
                background: "rgba(10, 15, 12, 0.45)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 5,
                transition: "all 0.3s ease"
              }}>
                <div style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  border: "2.5px solid rgba(255, 255, 255, 0.1)",
                  borderTopColor: "#00ff88",
                  animation: "spin 0.8s linear infinite",
                  boxShadow: "0 0 15px rgba(0, 255, 136, 0.3)"
                }} />
              </div>
            )}
          </div>

          {/* Title & Metadata Info */}
          <div style={{
            marginTop: "16px",
            textAlign: "center",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px"
          }}>
            <h3 style={{
              margin: 0,
              fontSize: "14px",
              fontWeight: "600",
              color: "#fff",
              maxWidth: "100%",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              letterSpacing: "0.2px"
            }}>
              {currentVideo 
                ? currentVideo.id.replace(/-/g, " ").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) 
                : (systemWallpaper ? "Desktop Wallpaper" : "Standby Mode")}
            </h3>
            
            <span style={{
              fontSize: "9px",
              fontWeight: "700",
              letterSpacing: "1px",
              color: "rgba(255, 255, 255, 0.5)",
              background: "rgba(255, 255, 255, 0.08)",
              padding: "2px 8px",
              borderRadius: "20px",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              textTransform: "uppercase",
              marginTop: "2px"
            }}>
              {currentVideo ? currentVideo.source : "Windows Static"}
            </span>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div style={{
          padding: "20px 24px 24px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}>
          {/* Controls HUD */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "14px"
          }}>
            <button 
              onClick={() => wallpaper.playPrevious()} 
              className="hover-btn"
              style={{
                ...controlBtnStyle,
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.05)"
              }}
              title="Previous Wallpaper"
            >
              <SkipBack size={16} />
            </button>
            
            <button 
              onClick={() => wallpaper.setPaused(!wallpaper.paused)} 
              className="hover-btn"
              style={{
                ...controlBtnStyle,
                width: "48px",
                height: "48px",
                background: "rgba(0, 255, 136, 0.2)",
                color: "#00ff88",
                border: "1px solid rgba(0, 255, 136, 0.35)",
                boxShadow: wallpaper.paused ? "none" : "0 0 15px rgba(0, 255, 136, 0.25)"
              }}
              title={wallpaper.paused ? "Play" : "Pause"}
            >
              {wallpaper.paused ? <Play size={18} style={{ marginLeft: "2px" }} /> : <Pause size={18} />}
            </button>
            
            <button 
              onClick={() => wallpaper.playNext()} 
              className="hover-btn"
              style={{
                ...controlBtnStyle,
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.05)"
              }}
              title="Next Wallpaper"
            >
              <SkipForward size={16} />
            </button>

            <button 
              onClick={() => wallpaper.stopWallpaper()} 
              className="hover-btn"
              style={{
                ...controlBtnStyle,
                background: "rgba(255, 91, 103, 0.12)",
                color: "#ff5b67",
                border: "1px solid rgba(255, 91, 103, 0.3)"
              }}
              title="Stop Wallpaper"
            >
              <Square size={14} />
            </button>
          </div>
        </div>

        {/* Settings Panel Overlay */}
        {showSettings && (
          <div style={{
            position: "absolute",
            top: "44px",
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(10, 15, 12, 0.65)",
            backdropFilter: "blur(25px)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            zIndex: 10,
            borderTop: "1px solid rgba(255, 255, 255, 0.08)"
          }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#00ff88", letterSpacing: "0.5px" }}>Tuning & Settings</h3>
            
            {/* Sliders Container */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Volume Slider */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "#aaa", fontWeight: "500" }}>VOLUME</span>
                  <span style={{ fontSize: "11px", color: "#fff", fontWeight: "600" }}>{wallpaper.volumePercent}%</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="100"
                  value={wallpaper.volumePercent}
                  onChange={(e) => wallpaper.setVolumePercent(parseInt(e.target.value))}
                  className="mini-slider"
                />
              </div>

              {/* Speed Slider */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "#aaa", fontWeight: "500" }}>PLAYBACK SPEED</span>
                  <span style={{ fontSize: "11px", color: "#fff", fontWeight: "600" }}>{wallpaper.playbackSpeed}x</span>
                </div>
                <input 
                  type="range"
                  min="0.25"
                  max="3"
                  step="0.05"
                  value={wallpaper.playbackSpeed}
                  onChange={(e) => wallpaper.setPlaybackSpeed(parseFloat(e.target.value))}
                  className="mini-slider"
                />
              </div>

              {/* Blur Slider */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "#aaa", fontWeight: "500" }}>BLUR STRENGTH</span>
                  <span style={{ fontSize: "11px", color: "#fff", fontWeight: "600" }}>{wallpaper.blurStrength}px</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="100"
                  value={wallpaper.blurStrength}
                  onChange={(e) => wallpaper.setBlurStrength(parseInt(e.target.value))}
                  className="mini-slider"
                />
              </div>
            </div>

            <hr style={{ border: "none", height: "1px", background: "rgba(255, 255, 255, 0.08)", margin: "4px 0" }} />

            {/* Source Settings */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "11px", color: "#aaa", fontWeight: "500" }}>SLIDESHOW SOURCE</label>
                <select 
                  value={wallpaper.slideshowSource}
                  onChange={(e) => wallpaper.setSlideshowSource(e.target.value)}
                  style={{ 
                    background: "rgba(255,255,255,0.06)", 
                    border: "1px solid rgba(255,255,255,0.08)", 
                    color: "#fff", 
                    padding: "8px", 
                    borderRadius: "6px", 
                    outline: "none",
                    fontSize: "12px",
                    cursor: "pointer"
                  }}
                >
                  <option value="local" style={{ background: "#111" }}>Local Library</option>
                  <option value="online" style={{ background: "#111" }}>Online History</option>
                  <option value="discover" style={{ background: "#111" }}>Discover New</option>
                </select>
              </div>

              {wallpaper.slideshowSource === "discover" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "11px", color: "#aaa", fontWeight: "500" }}>DISCOVER PROVIDER</label>
                  <select 
                    value={wallpaper.discoverProvider || "unified"}
                    onChange={(e) => wallpaper.setDiscoverProvider(e.target.value)}
                    style={{ 
                      background: "rgba(255,255,255,0.06)", 
                      border: "1px solid rgba(255,255,255,0.08)", 
                      color: "#fff", 
                      padding: "8px", 
                      borderRadius: "6px", 
                      outline: "none",
                      fontSize: "12px",
                      cursor: "pointer"
                    }}
                  >
                    <option value="unified" style={{ background: "#111" }}>Unified (All)</option>
                    <option value="wallhaven" style={{ background: "#111" }}>Wallhaven</option>
                    <option value="motionbgs" style={{ background: "#111" }}>MotionBGs</option>
                    <option value="alphacoders" style={{ background: "#111" }}>AlphaCoders</option>
                    <option value="pinterest" style={{ background: "#111" }}>Pinterest</option>
                    <option value="wallpaperwaves" style={{ background: "#111" }}>WallpaperWaves</option>
                  </select>
                </div>
              )}
            </div>

            <button 
              onClick={() => setShowSettings(false)}
              className="hover-btn"
              style={{ 
                marginTop: "auto", 
                background: "rgba(0, 255, 136, 0.15)", 
                border: "1px solid rgba(0, 255, 136, 0.3)", 
                color: "#00ff88", 
                padding: "10px", 
                borderRadius: "8px", 
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "12px"
              }}
            >
              Close Settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const controlBtnStyle = {
  background: "rgba(255,255,255,0.08)",
  border: "none",
  color: "#fff",
  width: "38px",
  height: "38px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.2s"
};

export default dynamic(() => Promise.resolve(MiniPlayer), { ssr: false });
