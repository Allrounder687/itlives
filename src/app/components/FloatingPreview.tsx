"use client";

import { VideoResult } from "@/hooks/useWallpaper";
import { VideoPreview } from "./VideoPreview";
import { useState, memo } from "react";

interface FloatingPreviewProps {
  video: VideoResult;
  volumePercent: number;
  filterPreset: string;
  isFavorite: boolean;
  isQueued: boolean;
  playbackSpeed?: number;
  blurStrength?: number;
  onApply: (start?: number, end?: number) => void;
  onToggleFavorite: () => void;
  onToggleQueue: () => void;
  onSetSpeed?: (s: number) => void;
  onSetBlur?: (b: number) => void;
  onClose: () => void;
  isLoading?: boolean;
  isHidden?: boolean;
  onToggleHide?: () => void;
  onEditEffects?: () => void;
}

export const FloatingPreview = memo(function FloatingPreview(props: FloatingPreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  if (isMinimized) {
    return (
      <div
        className="minimized-preview-trigger"
        style={{ position: "fixed", right: 0, top: "50%", transform: "translateY(-50%)", zIndex: 99999, background: "#111", border: "1px solid var(--accent)", padding: "0.5rem 0.75rem", borderTopLeftRadius: "0.5rem", borderBottomLeftRadius: "0.5rem", cursor: "pointer", boxShadow: "0 0 12px rgba(0,0,0,0.5)" }}
        onClick={() => !props.isLoading && setIsMinimized(false)}
      >
        <span style={{ fontSize: "0.85rem", color: "var(--accent)" }}>
          🖼️ Show Preview
        </span>
      </div>
    );
  }

  return (
    <div 
      className={`floating-preview-overlay ${isFullscreen ? "fullscreen-mode" : "mini-mode"}`}
      onClick={props.onClose}
    >
      <div className="floating-preview-container panel" onClick={(e) => e.stopPropagation()}>
        <div className="floating-header">
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", textAlign: "left" }}>
            <span className="eyebrow" style={{ fontSize: "9px", color: "var(--accent)" }}>Scene Preview</span>
            <strong style={{ fontSize: "14px", color: "#fff", textTransform: "none", letterSpacing: "normal" }}>{props.video.id}</strong>
          </div>
          <div className="floating-actions">
            <button className="mini-btn" onClick={() => setIsFullscreen(!isFullscreen)} disabled={props.isLoading}>
              {isFullscreen ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v5H3M21 8h-5V3M3 16h5v5M16 21v-5h5"/></svg>
                  <span>Windowed</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 15v6h-6M3 9V3h6"/></svg>
                  <span>Fullscreen</span>
                </>
              )}
            </button>
            <button className="mini-btn" onClick={() => setIsMinimized(true)} disabled={props.isLoading}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>
              <span>Minimize</span>
            </button>
            <button className="mini-btn mini-btn--accent" style={{ background: "rgba(255, 91, 103, 0.1)", border: "1px solid rgba(255, 91, 103, 0.2)", color: "#ff5b67" }} onClick={props.onClose} disabled={props.isLoading}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              <span>Close</span>
            </button>
          </div>
        </div>

        <div className="floating-body">
          <VideoPreview {...props} />
        </div>
      </div>
    </div>
  );
});
