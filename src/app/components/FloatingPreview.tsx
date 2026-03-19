"use client";

import { VideoResult } from "@/hooks/useWallpaper";
import { VideoPreview } from "./VideoPreview";
import { useState } from "react";

interface FloatingPreviewProps {
  video: VideoResult;
  volumePercent: number;
  filterPreset: string;
  isFavorite: boolean;
  isQueued: boolean;
  onApply: (start?: number, end?: number) => void;
  onToggleFavorite: () => void;
  onToggleQueue: () => void;
  onClose: () => void;
}

export function FloatingPreview(props: FloatingPreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  if (isMinimized) {
    return (
      <div 
        className="minimized-preview-trigger"
        style={{ position: "fixed", right: 0, top: "50%", transform: "translateY(-50%)", zIndex: 99999, background: "#111", border: "1px solid var(--accent)", padding: "0.5rem 0.75rem", borderTopLeftRadius: "0.5rem", borderBottomLeftRadius: "0.5rem", cursor: "pointer", boxShadow: "0 0 12px rgba(0,0,0,0.5)" }}
        onClick={() => setIsMinimized(false)}
      >
        <span style={{ fontSize: "0.85rem", color: "var(--accent)" }}>
          🖼️ Show Preview
        </span>
      </div>
    );
  }

  return (
    <div className={`floating-preview-overlay ${isFullscreen ? "fullscreen-mode" : "mini-mode"}`}>
      <div className="floating-preview-container panel">
        <div className="floating-header">
          <strong>{props.video.id} Preview</strong>
          <div className="floating-actions">
            <button className="mini-btn" onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </button>
            <button className="mini-btn" onClick={() => setIsMinimized(true)}>
              Minimize
            </button>
            <button className="mini-btn mini-btn--accent" onClick={props.onClose}>
              Close Preview
            </button>
          </div>
        </div>
        
        <div className="floating-body">
          <VideoPreview {...props} />
        </div>
      </div>
    </div>
  );
}
