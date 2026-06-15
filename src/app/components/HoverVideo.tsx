"use client";

import { useRef, useState, useEffect } from "react";
import { VideoResult } from "@/hooks/useWallpaper";
import { isStaticWallpaper } from "@/utils/wallpaperTypes";
import { convertFileSrc } from "@tauri-apps/api/core";

interface HoverVideoProps {
  video: VideoResult;
  className?: string;
  gridSize?: "S" | "M" | "L" | "XL" | "XXL";
  onClick?: () => void;
  priority?: boolean;
}

export function HoverVideo({ video, className, gridSize = "M", onClick, priority = false }: HoverVideoProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isLocalFile = video.local_path && !video.local_path.startsWith("http");
  let src = isLocalFile
    ? convertFileSrc(video.local_path)
    : video.video_url;

  if (!isLocalFile && video.source === "motionbgs" && src?.includes("3840x2160")) {
    src = src.replace("3840x2160", "1920x1080");
  }

  const isStaticImage = isStaticWallpaper(video);
  const isHtml = video.local_path?.toLowerCase().endsWith(".html") || video.video_url?.toLowerCase().endsWith(".html");
  const isStaticRender = isStaticImage || isHtml;

  const effectiveThumbUrl = video.thumbnail_url && !video.thumbnail_url.startsWith("http") && !video.thumbnail_url.startsWith("/")
    ? convertFileSrc(video.thumbnail_url)
    : video.thumbnail_url;

  let thumbSrc = isStaticImage && (!video.thumbnail_url || imgError) 
    ? src 
    : effectiveThumbUrl;

  if (thumbSrc) {
    if (video.source === "wallhaven" && thumbSrc.includes("/small/")) {
      if (gridSize === "L" || gridSize === "XL" || gridSize === "XXL") {
        thumbSrc = thumbSrc.replace("/small/", "/lg/");
      }
    } else if (video.source === "pinterest" && thumbSrc.includes("/236x/")) {
      if (gridSize === "L") {
        thumbSrc = thumbSrc.replace("/236x/", "/474x/");
      } else if (gridSize === "XL" || gridSize === "XXL") {
        thumbSrc = thumbSrc.replace("/236x/", "/736x/");
      }
    }
  }

  const shouldRenderVideo = isHovered && !isStaticRender;

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleLoadedData = async () => {
    if (videoRef.current && (!video.thumbnail_url || imgError)) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          video.thumbnail_url = dataUrl;
          setImgError(false);
          import("@tauri-apps/api/core").then(({ invoke }) => {
            invoke("import_local_video", { video }).catch(console.error);
          });
        }
      } catch (e) {
        console.error("Frame capture failed:", e);
      }
    }
  };

  const hasValidThumb = !!effectiveThumbUrl && !imgError;
  const isPortrait = video.height && video.width && video.height > video.width;
  const objectPosition = isPortrait ? "center 20%" : "center";

  return (
    <div 
      className={`hover-video-container ${className || ""}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", cursor: onClick ? "pointer" : "default" }}
      title={onClick ? "Click to open full preview" : ""}
    >
      {(effectiveThumbUrl || isStaticImage) && !imgError && (
        <img 
          src={thumbSrc} 
          alt={video.id}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          onError={() => setImgError(true)}
          style={{ 
            position: "absolute", 
            inset: 0, 
            width: "100%", 
            height: "100%", 
            objectFit: "cover",
            objectPosition,
            opacity: (!isStaticRender && isHovered && src) ? 0 : 1,
            transform: (isStaticRender && isHovered) ? "scale(1.08)" : "scale(1)",
            transition: "opacity 0.3s ease, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)"
          }} 
        />
      )}

      {!hasValidThumb && !isStaticImage && (
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

      {src && shouldRenderVideo && !isStaticRender && (
        <video 
          ref={videoRef}
          src={src}
          crossOrigin={isLocalFile ? "anonymous" : undefined}
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
            objectPosition,
            opacity: isHovered ? 1 : 0,
            transition: "opacity 0.3s ease"
          }}
        />
      )}
      
      <div style={{ position: "absolute", inset: 0, border: "1px solid rgba(255,255,255,0.05)", borderRadius: "inherit", pointerEvents: "none" }} />
    </div>
  );
}
