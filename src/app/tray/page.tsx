"use client";

import { useWallpaper } from "@/hooks/useWallpaper";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

function TrayMenu() {
  const wallpaper = useWallpaper();
  const [mounted, setMounted] = useState(false);
  const [localVolume, setLocalVolume] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Resize based on favorites list length to fix empty space
    const updateSize = async () => {
        try {
            const { getCurrentWindow } = await import("@tauri-apps/api/window");
            let win = getCurrentWindow();
            const { LogicalSize } = await import("@tauri-apps/api/dpi");
            const height = 240 + Math.min(wallpaper.favorites.length, 3) * 55;
            await win.setSize(new LogicalSize(380, height));
        } catch (e) {}
    };
    if (typeof window !== "undefined") {
        updateSize();
    }
  }, [wallpaper.favorites.length]);

  useEffect(() => {
    setLocalVolume(wallpaper.volumePercent);
  }, [wallpaper.volumePercent]);

  if (!mounted) return null;

  return (
    <div className="tray-container" style={{
      width: "100%",
      height: "100%",
      background: "rgba(10, 15, 10, 0.85)",
      backdropFilter: "blur(20px)",
      border: "1px solid rgba(154, 230, 0, 0.15)",
      borderRadius: "16px",
      display: "flex",
      flexDirection: "column",
      color: "#fff",
      overflow: "hidden",
      boxShadow: "0 12px 40px rgba(0,0,0,0.6)"
    }}>
      {/* Header */}
      <div style={{
        padding: "16px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "linear-gradient(to bottom, rgba(154, 230, 0, 0.08), transparent)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: wallpaper.isPlaying ? "var(--accent)" : "#666", boxShadow: wallpaper.isPlaying ? "0 0 10px var(--accent)" : "none" }} />
          <span style={{ fontSize: "13px", fontWeight: "bold", letterSpacing: "0.5px" }}>OpenClaw LWP</span>
        </div>
        <button 
          onClick={async () => {
             const { getCurrentWindow } = await import("@tauri-apps/api/window");
             let win = getCurrentWindow();
             await win.hide();
          }}
          style={{ background: "transparent", border: "none", color: "#888", cursor: "pointer", fontSize: "14px" }}
        >
          ✕
        </button>
      </div>

      {/* Main Container */}
      <div style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>
        
        {/* Currently Playing Card */}
        {wallpaper.currentVideo ? (
          <div style={{
            position: "relative",
            borderRadius: "12px",
            overflow: "hidden",
            height: "160px",
            border: "1px solid rgba(255,255,255,0.06)",
            boxShadow: "0 4px 15px rgba(0,0,0,0.3)"
          }}>
            <img 
              src={wallpaper.currentVideo.thumbnail_url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80"} 
              style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.6 }} 
            />
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to top, rgba(0,0,0,0.85) 30%, transparent)",
              display: "flex", flexDirection: "column", justifyContent: "flex-end",
              padding: "12px"
            }}>
              <span style={{ fontSize: "11px", color: "var(--accent)", fontWeight: "bold" }}>NOW PLAYING</span>
              <h4 style={{ margin: "2px 0 8px 0", fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {wallpaper.currentVideo.id.replace(/-/g, " ")}
              </h4>
              
              <div style={{ display: "flex", gap: "8px" }}>
                <button 
                  onClick={() => wallpaper.setPaused(!wallpaper.paused)}
                  style={{
                    flex: 1, padding: "8px", borderRadius: "6px", border: "none",
                    background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", fontSize: "12px"
                  }}
                >
                  {wallpaper.paused ? "▶ Resume" : "⏸ Pause"}
                </button>
                <button 
                  onClick={() => wallpaper.stopWallpaper()}
                  style={{
                    padding: "8px 12px", borderRadius: "6px", border: "none",
                    background: "rgba(231, 76, 60, 0.2)", color: "#e74c3c", cursor: "pointer", fontSize: "12px"
                  }}
                >
                  Stop
                </button>
              </div>

              {/* Volume Slider added inside the overlay triggers index */}
              <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                 <span style={{ fontSize: "11px", color: "#aaa" }}>Vol</span>
                 <input 
                   type="range"
                   min="0" max="100"
                   value={localVolume}
                   onChange={(e) => setLocalVolume(parseInt(e.target.value))}
                   onMouseUp={() => wallpaper.setVolumePercent(localVolume)}
                   onTouchEnd={() => wallpaper.setVolumePercent(localVolume)}
                   style={{ flex: 1, accentColor: "var(--accent)", height: "4px" }}
                 />
                 <span style={{ fontSize: "11px", minWidth: "22px", textAlign: "right" }}>{localVolume}%</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            height: "160px", borderRadius: "12px", background: "rgba(255,255,255,0.03)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            border: "1px dashed rgba(255,255,255,0.1)", color: "#aaa"
          }}>
            <span style={{ fontSize: "13px" }}>Engine Standby</span>
          </div>
        )}

        {/* Quick Lists (Favorites / Recents) */}
        <div>
          <span style={{ fontSize: "11px", color: "#888", fontWeight: "bold", letterSpacing: "0.5px" }}>QUICK SWITCH</span>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
            {wallpaper.favorites.slice(0, 3).map((item, idx) => (
              <button
                key={idx}
                onClick={() => wallpaper.applyWallpaper(item.video)}
                style={{
                  display: "flex", alignItems: "center", gap: "10px", padding: "8px",
                  borderRadius: "8px", border: "1px solid transparent", background: "rgba(255,255,255,0.02)",
                  color: "#fff", cursor: "pointer", textAlign: "left", transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(154, 230, 0, 0.05)";
                  e.currentTarget.style.borderColor = "rgba(154, 230, 0, 0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                  e.currentTarget.style.borderColor = "transparent";
                }}
              >
                <img src={item.video.thumbnail_url} style={{ width: "36px", height: "36px", borderRadius: "4px", objectFit: "cover" }} />
                <span style={{ fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                  {item.video.id.replace(/-/g, " ")}
                </span>
                <span style={{ fontSize: "9px", color: "var(--accent)" }}>Apply</span>
              </button>
            ))}
            {wallpaper.favorites.length === 0 && (
              <div style={{ fontSize: "11px", color: "#555", padding: "8px" }}>No items in favorites.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default dynamic(() => Promise.resolve(TrayMenu), { ssr: false });
