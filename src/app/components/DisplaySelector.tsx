"use client";

import React, { useEffect, useState } from "react";
import { DisplayMonitor } from "@/utils/wallpaperTypes";
import { useWallpaper } from "@/hooks/useWallpaper";

function MonitorIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#60a5fa" : "rgba(255,255,255,0.4)"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

export default function DisplaySelector() {
  const { fetchMonitors, selectedMonitor, setSelectedMonitor } = useWallpaper();
  const [monitors, setMonitors] = useState<DisplayMonitor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMonitors() {
      const data = await fetchMonitors();
      setMonitors(data);
      if (data.length > 0 && !selectedMonitor) {
        const primary = data.find(m => m.is_primary) || data[0];
        setSelectedMonitor(primary);
      }
      setLoading(false);
    }
    loadMonitors();
  }, [fetchMonitors]);

  if (loading || monitors.length <= 1) return null;

  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "10px",
      marginBottom: "12px",
      padding: "10px 12px",
    }}>
      <div style={{ fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
        Target Display
      </div>
      <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "2px" }}>
        {monitors.map((m, i) => {
          const isSelected = selectedMonitor?.name === m.name;
          return (
            <button
              key={m.name + i}
              type="button"
              onClick={() => setSelectedMonitor(m)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 10px",
                borderRadius: "7px",
                border: isSelected ? "1px solid rgba(96,165,250,0.5)" : "1px solid rgba(255,255,255,0.06)",
                background: isSelected ? "rgba(59,130,246,0.15)" : "rgba(0,0,0,0.2)",
                color: isSelected ? "#60a5fa" : "rgba(255,255,255,0.7)",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: isSelected ? 600 : 400,
                whiteSpace: "nowrap",
                transition: "all 0.2s ease",
                boxShadow: isSelected ? "0 0 12px rgba(59,130,246,0.15)" : "none",
              }}
              onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#fff"; } }}
              onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.background = "rgba(0,0,0,0.2)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; } }}
            >
              <MonitorIcon active={isSelected} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <span style={{ lineHeight: 1 }}>{m.name}{m.is_primary ? " (Primary)" : ""}</span>
                <span style={{ fontSize: "10px", opacity: 0.6, lineHeight: 1, marginTop: "2px" }}>{m.width}×{m.height}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
