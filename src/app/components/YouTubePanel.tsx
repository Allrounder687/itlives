"use client";

import { useYouTube, YtMetaResult } from "@/hooks/useYouTube";
import { useState, useEffect, useRef } from "react";

interface YouTubePanelProps {
  onApplyWallpaper: (video: any) => void;
  onStop: () => void;
  isPlaying: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const QUALITIES = [
  { label: "720p", value: 720 },
  { label: "1080p (HD)", value: 1080 },
  { label: "1440p (2K)", value: 1440 },
  { label: "2160p (4K)", value: 2160 },
];

export function YouTubePanel({ onApplyWallpaper, onStop, isPlaying }: YouTubePanelProps) {
  const yt = useYouTube();
  const clipDuration = yt.endTime - yt.startTime;
  const playerRef = useRef<HTMLIFrameElement>(null);
  const [activeThumb, setActiveThumb] = useState<"start" | "end">("start");
  const [iframeStart, setIframeStart] = useState(0);
  const [history, setHistory] = useState<YtMetaResult[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("yt_history");
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load YouTube history", e);
    }
  }, []);

  useEffect(() => {
    if (yt.meta) {
      setHistory((prev) => {
        if (prev.some((item) => item.id === yt.meta!.id)) {
          return prev;
        }
        const updated = [yt.meta!, ...prev].slice(0, 10);
        localStorage.setItem("yt_history", JSON.stringify(updated));
        return updated;
      });
    }
  }, [yt.meta]);

  const [isYtdlpInstalled, setIsYtdlpInstalled] = useState(true);
  const [isCheckingYtdlp, setIsCheckingYtdlp] = useState(true);
  const [isInstallingYtdlp, setIsInstallingYtdlp] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [installError, setInstallError] = useState<string | null>(null);

  const [isFfmpegInstalled, setIsFfmpegInstalled] = useState(true);
  const [isCheckingFfmpeg, setIsCheckingFfmpeg] = useState(true);
  const [isInstallingFfmpeg, setIsInstallingFfmpeg] = useState(false);
  const [ffmpegError, setFfmpegError] = useState<string | null>(null);

  useEffect(() => {
    checkYtdlp();
    checkFfmpeg();
  }, []);

  const checkYtdlp = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const installed = await invoke<boolean>("check_ytdlp_installed");
      setIsYtdlpInstalled(installed);
    } catch (err) {
      console.error("Failed to check yt-dlp", err);
    } finally {
      setIsCheckingYtdlp(false);
    }
  };

  const checkFfmpeg = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const installed = await invoke<boolean>("check_ffmpeg_installed");
      setIsFfmpegInstalled(installed);
    } catch (err) {
      console.error("Failed to check ffmpeg", err);
    } finally {
      setIsCheckingFfmpeg(false);
    }
  };

  const handleInstallYtdlp = async () => {
    setIsInstallingYtdlp(true);
    setInstallProgress(0);
    setInstallError(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const { listen } = await import("@tauri-apps/api/event");

      const unlisten = await listen<number>("ytdlp-install-progress", (event) => {
        setInstallProgress(event.payload);
      });

      await invoke("install_ytdlp");
      unlisten();

      setIsYtdlpInstalled(true);
      if (yt.url.trim()) {
        yt.fetchMeta();
      }
    } catch (err: any) {
      const msg = typeof err === "string" ? err : err.message || "Failed to install yt-dlp";
      setInstallError(msg);
    } finally {
      setIsInstallingYtdlp(false);
    }
  };

  const handleInstallFfmpeg = async () => {
    setIsInstallingFfmpeg(true);
    setFfmpegError(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("install_ffmpeg");
      setIsFfmpegInstalled(true);
      if (yt.error && yt.error.toLowerCase().includes("ffmpeg")) {
        yt.setError(null);
      }
    } catch (err: any) {
      const msg = typeof err === "string" ? err : err.message || "Failed to install ffmpeg";
      setFfmpegError(msg);
    } finally {
      setIsInstallingFfmpeg(false);
    }
  };

  useEffect(() => {
    if (yt.meta) {
      setIframeStart(yt.startTime);
    }
  }, [yt.meta]);

  const handleFetchAndApply = async () => {
    const result = await yt.downloadClip();
    if (result) {
      onApplyWallpaper(result);
    }
  };

  // Sync Video IFrame Time on slider drags
  useEffect(() => {
    if (playerRef.current && yt.meta) {
      const iframe = playerRef.current;
      // Seek via iframe postMessage works only with YT.Player API, 
      // but simple iframe reload with start= is foolproof for previews.
      // To avoid reloading iframe 10x per second, we can just do a small reload on mouseUp or debounced.
    }
  }, [yt.startTime, yt.meta]);

  const embedUrl = yt.meta 
    ? `https://www.youtube.com/embed/${yt.meta.id}?start=${Math.floor(iframeStart)}&autoplay=1&controls=1&rel=0`
    : "";

  return (
    <section className="panel panel--main yt-panel">
      <div className="section-head">
        <span className="eyebrow">YouTube Clip Extractor</span>
        <h2>Video to Wallpaper</h2>
      </div>

      {!isYtdlpInstalled && !isCheckingYtdlp ? (
        <div className="yt-setup-card" style={{
          background: "rgba(30, 30, 35, 0.6)",
          backdropFilter: "blur(12px)",
          border: "1px solid var(--accent-soft, rgba(255, 0, 128, 0.2))",
          borderRadius: "16px",
          padding: "32px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "20px",
          margin: "2rem auto",
          maxWidth: "500px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
          animation: "fade-in 0.4s ease-out"
        }}>
          <div style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--accent, #ff007f) 0%, #7928ca 100%)",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 0 20px rgba(255, 0, 127, 0.4)",
            fontSize: "28px"
          }}>
            📥
          </div>
          <div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "20px", color: "var(--text)" }}>YouTube Extractor Setup</h3>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--text-soft)", lineHeight: "1.6" }}>
              To extract and trim video clips from YouTube, we use the powerful, open-source <strong>yt-dlp</strong> engine. We couldn't find it installed on your system.
            </p>
          </div>

          {isInstallingYtdlp ? (
            <div style={{ width: "100%", marginTop: "10px" }}>
              <div className="yt-progress-bar" style={{
                height: "6px",
                background: "rgba(255,255,255,0.1)",
                borderRadius: "3px",
                overflow: "hidden"
              }}>
                <div 
                  className="yt-progress-fill" 
                  style={{ 
                    width: `${installProgress}%`, 
                    height: "100%",
                    background: "linear-gradient(90deg, var(--accent, #ff007f) 0%, #7928ca 100%)",
                    transition: "width 0.2s ease-out",
                    boxShadow: "0 0 8px var(--accent)",
                    animation: "none"
                  }} 
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "12px" }}>
                <span style={{ color: "var(--text-soft)" }}>Downloading engine...</span>
                <strong style={{ color: "var(--accent)" }}>{installProgress}%</strong>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="action-btn action-btn--primary"
              onClick={handleInstallYtdlp}
              style={{ padding: "12px 32px", fontSize: "14px", width: "100%", marginTop: "10px" }}
            >
              Auto-Install yt-dlp Engine
            </button>
          )}

          {installError && (
            <div className="callout callout--error" style={{ width: "100%", margin: "10px 0 0 0" }}>
              <span className="callout__label">Installation Failed</span>
              <p style={{ fontSize: "12px" }}>{installError}</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* URL Input + Quality */}
          <div className="yt-url-row">
            <div className="field" style={{ flex: 1 }}>
              <span className="field__label">YouTube Video URL</span>
              <div className="input-group">
                <input
                  className="input input--hud"
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={yt.url}
                  onChange={(e) => yt.setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") yt.fetchMeta();
                  }}
                />
                
                <select 
                  className="input input--hud" 
                  style={{ width: "120px" }}
                  value={yt.maxHeight}
                  onChange={(e) => yt.setMaxHeight(parseInt(e.target.value))}
                >
                  {QUALITIES.map(q => (
                    <option key={q.value} value={q.value}>{q.label}</option>
                  ))}
                </select>

                <button
                  type="button"
                  className="action-btn action-btn--accent-ghost"
                  onClick={yt.fetchMeta}
                  disabled={yt.isLoadingMeta || yt.isDownloading}
                >
                  {yt.isLoadingMeta ? "Loading..." : "Fetch Info"}
                </button>
              </div>
            </div>
          </div>

          {/* Error */}
          {yt.error && (
            <div className="callout callout--error" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <span className="callout__label">Error</span>
                <p>{yt.error}</p>
              </div>
              {yt.error.toLowerCase().includes("yt-dlp") && (
                <div style={{ marginTop: "4px" }}>
                  {isInstallingYtdlp ? (
                    <div style={{ width: "100%" }}>
                      <div className="yt-progress-bar" style={{ height: "4px", borderRadius: "2px" }}>
                        <div 
                          className="yt-progress-fill" 
                          style={{ width: `${installProgress}%`, animation: "none" }} 
                        />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", fontSize: "11px" }}>
                        <span>Downloading...</span>
                        <strong>{installProgress}%</strong>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="action-btn action-btn--accent-ghost"
                      onClick={handleInstallYtdlp}
                      style={{ width: "auto" }}
                    >
                      Auto-Install yt-dlp Now
                    </button>
                  )}
                </div>
              )}
              {(yt.error.toLowerCase().includes("ffmpeg") || !isFfmpegInstalled) && (
                <div style={{ marginTop: "4px" }}>
                  {isInstallingFfmpeg ? (
                    <div style={{ width: "100%" }}>
                      <span className="muted" style={{ fontSize: "12px" }}>Running Gyan.FFmpeg installation (this will trigger a Winget UAC prompt, please accept it)...</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <button
                        type="button"
                        className="action-btn action-btn--accent-ghost"
                        onClick={handleInstallFfmpeg}
                        style={{ width: "auto" }}
                      >
                        Auto-Install FFmpeg Now
                      </button>
                      {ffmpegError && <p style={{ fontSize: "11px", color: "var(--accent)", margin: 0 }}>{ffmpegError}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Loading skeleton */}
          {yt.isLoadingMeta && <div className="skeleton skeleton-preview" />}

          {/* Video Metadata + Time Slider */}
          {yt.meta && !yt.isLoadingMeta && (
            <div className="yt-clip-builder">
              {/* IFrame Preview instead of Static Card */}
              <div className="yt-player-container">
                <iframe
                  ref={playerRef}
                  className="yt-preview-iframe"
                  src={embedUrl}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>

              {/* Quick Info Bar */}
              <div className="yt-meta-tagline">
                <span>ID: <strong>{yt.meta.id}</strong></span>
                <span>Duration: <strong>{formatDuration(yt.meta.duration)}</strong></span>
                <span>Resolution Choice: <strong>{yt.maxHeight}p max</strong></span>
              </div>

              {/* Dual Range Slider */}
              <div className="yt-range-section">
                <div className="yt-range-header">
                  <span className="eyebrow">Clip Range Selection</span>
                  <span className="yt-clip-duration">
                    {formatTime(yt.startTime)} → {formatTime(yt.endTime)} ({formatDuration(clipDuration)})
                  </span>
                </div>

                <div className="yt-dual-slider">
                  <div className="yt-slider-track">
                    <div
                      className="yt-slider-fill"
                      style={{
                        left: `${(yt.startTime / yt.meta.duration) * 100}%`,
                        width: `${((yt.endTime - yt.startTime) / yt.meta.duration) * 100}%`,
                      }}
                    />
                  </div>
                  <input
                    type="range"
                    className="yt-range-input yt-range-start"
                    style={{ zIndex: activeThumb === "start" ? 15 : 10 }}
                    onMouseDown={() => setActiveThumb("start")}
                    onTouchStart={() => setActiveThumb("start")}
                    onMouseUp={() => setIframeStart(yt.startTime)}
                    onTouchEnd={() => setIframeStart(yt.startTime)}
                    min={0}
                    max={yt.meta.duration}
                    step={0.5}
                    value={yt.startTime}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (val < yt.endTime - 1) yt.setStartTime(val);
                    }}
                  />
                  <input
                    type="range"
                    className="yt-range-input yt-range-end"
                    style={{ zIndex: activeThumb === "end" ? 15 : 10 }}
                    onMouseDown={() => setActiveThumb("end")}
                    onTouchStart={() => setActiveThumb("end")}
                    onMouseUp={() => setIframeStart(yt.startTime)}
                    onTouchEnd={() => setIframeStart(yt.startTime)}
                    min={0}
                    max={yt.meta.duration}
                    step={0.5}
                    value={yt.endTime}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (val > yt.startTime + 1) yt.setEndTime(val);
                    }}
                  />
                </div>

                <div className="yt-range-labels">
                  <span>0:00</span>
                  <span>{formatDuration(yt.meta.duration)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="action-row action-row--hud">
                <button
                  className="action-btn action-btn--primary"
                  onClick={handleFetchAndApply}
                  disabled={yt.isDownloading || clipDuration < 1}
                >
                  {yt.isDownloading ? "Downloading..." : "Download & Apply"}
                </button>

                <button
                  className="action-btn action-btn--secondary"
                  onClick={yt.downloadClip}
                  disabled={yt.isDownloading || clipDuration < 1}
                >
                  {yt.isDownloading ? "Processing..." : "Download Only"}
                </button>

                {isPlaying && (
                  <button className="action-btn action-btn--ghost" onClick={onStop}>
                    Unload Engine
                  </button>
                )}
              </div>

              {/* Download progress */}
              {yt.isDownloading && (
                <div className="yt-download-progress">
                  <div className="yt-progress-bar">
                    <div 
                      className="yt-progress-fill" 
                      style={{ width: `${yt.downloadProgress}%`, animation: "none" }} 
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                    <p className="muted">Downloading and trimming clip via yt-dlp...</p>
                    <strong style={{ color: "var(--accent)" }}>{Math.floor(yt.downloadProgress)}%</strong>
                  </div>
                </div>
              )}

              {/* Success */}
              {yt.downloadedVideo && !yt.isDownloading && (
                <div className="callout callout--success">
                  <span className="callout__label">Clip Ready & Saved in Library</span>
                  <p>Downloaded {formatDuration(clipDuration)} clip successfully at {yt.maxHeight}p.</p>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!yt.meta && !yt.isLoadingMeta && !yt.error && (
            <div className="yt-empty-state">
              <div className="yt-empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.13C5.12 19.56 12 19.56 12 19.56s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.43z" />
                  <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
                </svg>
              </div>
              <h3>Paste a YouTube URL above</h3>
              <p className="muted">
                The extractor will fetch the video metadata and let you trim a clip range
                to download and set as your desktop wallpaper.
              </p>
            </div>
          )}

          {/* Recent Extractions History */}
          {history.length > 0 && (
            <div className="yt-history-section" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: "2.5rem", paddingTop: "1.5rem" }}>
              <span className="eyebrow" style={{ display: "block", marginBottom: "0.75rem" }}>Recent Extractions</span>
              <div className="yt-history-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="yt-history-card panel"
                    style={{
                      cursor: "pointer",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--panel-stroke)",
                      background: "var(--bg-elevated)",
                      transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s"
                    }}
                    onClick={() => {
                      yt.setUrl(item.video_url || `https://www.youtube.com/watch?v=${item.id}`);
                      yt.setMeta(item);
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.borderColor = "var(--accent)";
                      e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.3)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = "none";
                      e.currentTarget.style.borderColor = "var(--panel-stroke)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#000" }}>
                      <img src={item.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <span className="quality-badge" style={{ position: "absolute", bottom: "4px", right: "4px", padding: "1px 4px", fontSize: "8px", background: "rgba(0,0,0,0.7)", borderRadius: "4px" }}>
                        {formatDuration(item.duration)}
                      </span>
                    </div>
                    <div style={{ padding: "8px", fontSize: "11px", display: "flex", flexDirection: "column", gap: "3px" }}>
                      <strong style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.id}</strong>
                      <span style={{ fontSize: "9px", color: "var(--text-soft)" }}>{item.width}x{item.height} (YouTube)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
