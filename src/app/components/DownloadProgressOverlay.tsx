"use client";

import { useState, useEffect } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

interface DownloadProgressPayload {
  id: string;
  progress: number;
  total: number;
}

export function DownloadProgressOverlay() {
  const [downloads, setDownloads] = useState<Record<string, DownloadProgressPayload>>({});

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    listen<DownloadProgressPayload>("download-progress", (event) => {
      setDownloads((prev) => ({
        ...prev,
        [event.payload.id]: event.payload,
      }));
      
      // Auto clear when complete
      if (event.payload.progress >= event.payload.total && event.payload.total > 0) {
        setTimeout(() => {
          setDownloads((prev) => {
            const next = { ...prev };
            delete next[event.payload.id];
            return next;
          });
        }, 2000);
      }
    }).then((un) => {
      unlisten = un;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const activeDownloads = Object.values(downloads).filter(d => d.total > 0 && d.progress < d.total);

  if (activeDownloads.length === 0) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: "20px",
      right: "20px",
      zIndex: 999999,
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      pointerEvents: "none"
    }}>
      {activeDownloads.map((d) => {
        const percent = Math.min(100, Math.round((d.progress / d.total) * 100));
        const mbProgress = (d.progress / 1024 / 1024).toFixed(1);
        const mbTotal = (d.total / 1024 / 1024).toFixed(1);
        
        return (
          <div key={d.id} style={{
            background: "rgba(10, 10, 12, 0.9)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "12px",
            padding: "16px",
            width: "320px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#fff", opacity: 0.9 }}>
                Downloading Wallpaper
              </span>
              <span style={{ fontSize: "11px", color: "var(--accent-color, #00f0ff)", fontWeight: 700 }}>
                {percent}%
              </span>
            </div>
            
            <div style={{ 
              width: "100%", 
              height: "4px", 
              background: "rgba(255,255,255,0.1)", 
              borderRadius: "4px",
              overflow: "hidden"
            }}>
              <div style={{ 
                height: "100%", 
                width: `${percent}%`, 
                background: "var(--accent-color, #00f0ff)",
                boxShadow: "0 0 10px var(--accent-color, #00f0ff)",
                transition: "width 0.2s ease-out"
              }} />
            </div>
            
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "rgba(255,255,255,0.5)" }}>
              <span>ID: {d.id}</span>
              <span>{mbProgress} MB / {mbTotal} MB</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
