"use client";

import { useRef, useState, useEffect } from "react";
import { VideoResult } from "@/hooks/useWallpaper";
import { isStaticWallpaper } from "@/utils/wallpaperTypes";
import { convertFileSrc } from "@tauri-apps/api/core";

interface HoverVideoProps {
  video: VideoResult;
  className?: string;
  onClick?: () => void;
}

export function HoverVideo({ video, className, onClick }: HoverVideoProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const src = video.local_path
    ? convertFileSrc(video.local_path)
    : video.video_url;

  const isStaticImage = isStaticWallpaper(video);

  const shouldRenderVideo = isHovered || (!video.thumbnail_url && video.local_path);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleLoadedData = async () => {
    if (!video.thumbnail_url && videoRef.current && video.local_path) {
      const vid = videoRef.current;
      // Seek slightly to avoid capturing black frame at absolute start
      if (vid.currentTime === 0 && vid.duration > 0.5) {
        vid.currentTime = 0.5;
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = vid.videoWidth || 320;
      canvas.height = vid.videoHeight || 180;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL("image/jpeg", 0.82);
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("save_thumbnail", { localPath: video.local_path, base64Data: base64 });
        } catch (e) {
          console.error("save_thumbnail trigger failed", e);
        }
      }
    }
  };

  const hasValidThumb = !!video.thumbnail_url && !imgError;

  return (
    <div 
      className={`hover-video-container ${className || ""}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", cursor: onClick ? "pointer" : "default" }}
      title={onClick ? "Click to open full preview" : ""}
    >
      {video.thumbnail_url && !imgError && (
        <img 
          src={video.thumbnail_url} 
          alt={video.id}
          onError={() => setImgError(true)}
          style={{ 
            position: "absolute", 
            inset: 0, 
            width: "100%", 
            height: "100%", 
            objectFit: "cover",
            opacity: (!isStaticImage && isHovered && src) ? 0 : 1,
            transform: (isStaticImage && isHovered) ? "scale(1.08)" : "scale(1)",
            transition: "opacity 0.3s ease, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)"
          }} 
        />
      )}

      {!hasValidThumb && (
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #111 0%, #050505 100%)",
          color: "rgba(255, 255, 255, 0.15)",
          fontWeight: 900,
          fontSize: "1.2rem",
          letterSpacing: "0.2em",
          userSelect: "none",
          fontFamily: "system-ui, sans-serif"
        }}>
          IT LIVES
        </div>
      )}

      {src && shouldRenderVideo && !isStaticImage && (
        <video 
          ref={videoRef}
          src={src}
          crossOrigin={video.local_path ? "anonymous" : undefined}
          muted
          loop
          playsInline
          autoPlay={isHovered}
          preload="metadata"
          onLoadedData={handleLoadedData}
          onSeeked={handleLoadedData}
          style={{ 
            position: "absolute", 
            inset: 0, 
            width: "100%", 
            height: "100%", 
            objectFit: "cover",
            opacity: isHovered ? 1 : 0,
            transition: "opacity 0.3s ease"
          }}
        />
      )}
      
      <div style={{ position: "absolute", inset: 0, border: "1px solid rgba(255,255,255,0.05)", borderRadius: "inherit", pointerEvents: "none" }} />
    </div>
  );
}
