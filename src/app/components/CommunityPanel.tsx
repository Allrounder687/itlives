"use client";

import { VideoResult } from "@/hooks/useWallpaper";
import { useState } from "react";

interface CommunityPanelProps {
  currentWallpaper: VideoResult | null;
}

export function CommunityPanel({ currentWallpaper }: CommunityPanelProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleShare = () => {
    if (!currentWallpaper) return;
    setIsSharing(true);
    
    // Simulate server upload
    setTimeout(() => {
        setIsSharing(false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        
        // Copy shareable link (simulated)
        const shareLink = `itlives://wallpaper/${currentWallpaper.id}?source=${currentWallpaper.source}`;
        navigator.clipboard.writeText(shareLink).catch(() => {});
    }, 1500);
  };

  return (
    <div className="community-panel" style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <header className="community-header" style={{ textAlign: "center", marginBottom: "3rem" }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "0.5rem", background: "linear-gradient(90deg, var(--accent), #fff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Community Hub
        </h1>
        <p className="eyebrow" style={{ opacity: 0.6 }}>Share and discover wallpapers from the community</p>
      </header>

      <div className="share-box panel" style={{ padding: "2rem", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", background: "rgba(255,255,255,0.02)" }}>
        <h2 style={{ marginBottom: "1rem", fontSize: "1.2rem" }}>Share Your Current Setup</h2>
        
        {currentWallpaper ? (
          <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
            <div style={{ width: "200px", height: "120px", borderRadius: "8px", overflow: "hidden", border: "2px solid var(--accent)" }}>
                <img 
                    src={currentWallpaper.thumbnail_url} 
                    alt="Preview" 
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
            </div>
            <div style={{ flex: 1 }}>
                <h3 style={{ marginBottom: "0.5rem" }}>{currentWallpaper.id.replace(/-/g, " ")}</h3>
                <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.5)", marginBottom: "1.5rem" }}>
                    Share this masterpiece with the world! A unique deep link will be generated.
                </p>
                <button 
                    className={`action-btn ${success ? "action-btn--primary" : "action-btn--accent"}`}
                    onClick={handleShare}
                    disabled={isSharing}
                    style={{ width: "100%" }}
                >
                    {isSharing ? "Uploading to Cloud..." : success ? "✓ Link Copied to Clipboard!" : "Publicly Share Wallpaper"}
                </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "2rem", opacity: 0.5 }}>
            <p>You haven't applied a wallpaper yet. Apply one to share it!</p>
          </div>
        )}
      </div>

      <div className="feed-placeholder" style={{ marginTop: "4rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "1.4rem" }}>Trending Global Feed</h2>
            <span className="badge badge--accent">BETA</span>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1.5rem", opacity: 0.3 }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="panel" style={{ height: "240px", borderRadius: "12px", background: "rgba(255,255,255,0.05)" }} />
            ))}
        </div>
        
        <div style={{ textAlign: "center", marginTop: "-120px", position: "relative", zIndex: 10 }}>
            <div className="panel" style={{ display: "inline-block", padding: "1.5rem 3rem", border: "1px solid var(--accent)", background: "var(--bg-panel)", borderRadius: "30px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
                <p style={{ fontWeight: 600 }}>📡 Connecting to global server...</p>
                <p style={{ fontSize: "0.8rem", opacity: 0.6 }}>Discovery server pending deployment in next update.</p>
            </div>
        </div>
      </div>
    </div>
  );
}
