"use client";

import { useRef, useState, useEffect } from "react";
import { VideoResult } from "@/hooks/useWallpaper";
import { convertFileSrc } from "@tauri-apps/api/core";

interface HoverVideoProps {
  video: VideoResult;
  className?: string;
  onClick?: () => void;
}

export function HoverVideo({ video, className, onClick }: HoverVideoProps) {
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const src = video.local_path
    ? convertFileSrc(video.local_path)
    : video.video_url;

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

      {src && (
        <video 
          ref={videoRef}
          src={src}
          muted
          loop
          playsInline
          autoPlay={isHovered}
          preload="metadata"
          style={{ 
            position: "absolute", 
            inset: 0, 
            width: "100%", 
            height: "100%", 
            objectFit: "cover",
            opacity: isHovered || !video.thumbnail_url ? 1 : 0,
            transition: "opacity 0.3s ease"
          }}
        />
      )}
      
      <div style={{ position: "absolute", inset: 0, border: "1px solid rgba(255,255,255,0.05)", borderRadius: "inherit", pointerEvents: "none" }} />
    </div>
  );
}
