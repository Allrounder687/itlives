"use client";

import { useRef, useState, useEffect } from "react";
import { VideoResult } from "@/hooks/useWallpaper";

interface HoverVideoProps {
  video: VideoResult;
  className?: string;
  onClick?: () => void;
}

export function HoverVideo({ video, className, onClick }: HoverVideoProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    async function resolveSource() {
      if (video.local_path && video.local_path.trim() !== "") {
        try {
          const { convertFileSrc } = await import("@tauri-apps/api/core");
          setSrc(convertFileSrc(video.local_path));
        } catch {
          setSrc(video.video_url || null);
        }
      } else {
        setSrc(video.video_url || null);
      }
    }
    resolveSource();
  }, [video]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  return (
    <div 
      className={`hover-video-container ${className || ""}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", cursor: onClick ? "pointer" : "default" }}
      title={onClick ? "Click to open full preview" : ""}
    >
      {video.thumbnail_url && (
        <img 
          src={video.thumbnail_url} 
          alt={video.id} 
          style={{ 
            position: "absolute", 
            inset: 0, 
            width: "100%", 
            height: "100%", 
            objectFit: "cover",
            opacity: isHovered && src ? 0 : 1,
            transition: "opacity 0.3s ease"
          }} 
        />
      )}
      
      {!video.thumbnail_url && !isHovered && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.4)" }}>
          <span style={{ fontSize: "10px", color: "var(--text-soft)", textTransform: "uppercase" }}>Video</span>
        </div>
      )}

      {src && (
        <video 
          ref={videoRef}
          src={src}
          muted
          loop
          playsInline
          style={{ 
            position: "absolute", 
            inset: 0, 
            width: "100%", 
            height: "100%", 
            objectFit: "cover",
            opacity: isHovered ? 1 : 0,
            transition: "opacity 0.5s ease"
          }}
        />
      )}
      
      <div style={{ position: "absolute", inset: 0, border: "1px solid rgba(255,255,255,0.05)", borderRadius: "inherit", pointerEvents: "none" }} />
      
      <div style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.5)",
          display: "grid",
          placeItems: "center",
          opacity: isHovered && onClick ? 1 : 0,
          transition: "opacity 0.2s ease",
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
      </div>
    </div>
  );
}
