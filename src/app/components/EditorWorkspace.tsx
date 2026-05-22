"use client";

import { useState, useEffect } from "react";
import { EffectLayer } from "./CanvasEffectRenderer";
import { WebGLEffectRenderer } from "./WebGLEffectRenderer";
import { VideoResult } from "@/hooks/useWallpaper";
import "./editor.css";


interface EditorWorkspaceProps {
  currentVideo: VideoResult | null;
  onApplyPreset?: (preset: any) => void;
  onApplyWallpaper?: (video: VideoResult) => Promise<void>;
  onUploadMedia?: () => Promise<void>;
}

const EFFECT_TEMPLATES: Record<string, Omit<EffectLayer, "id">> = {
  snow: { type: "snow", name: "Snowfall", enabled: true, params: { count: 200, speed: 1.5, wind: 0.3, size: 6.0 } },
  rain: { type: "rain", name: "Raindrops", enabled: true, params: { count: 300, speed: 1.2, wind: 0.1, size: 4.0 } },
  fireflies: { type: "fireflies", name: "Fireflies", enabled: true, params: { count: 80, speed: 0.5, size: 5.0, color: "#aaff44" } },
  stars: { type: "stars", name: "Starfield", enabled: true, params: { count: 400, speed: 0.1, size: 3.0, twinkle: 0.8 } },
  fog: { type: "fog", name: "Fog / Mist", enabled: true, params: { count: 60, speed: 0.3, size: 40.0, opacity: 0.4 } },
  "water-caustics": { type: "water-caustics", name: "Water Reflection", enabled: true, params: { speed: 1.0, scale: 3.0, intensity: 1.0, color: "#00ffff", yOffset: -400, width: 2000, height: 800 } },
  "blowing-leaves": { type: "blowing-leaves", name: "Blowing Leaves", enabled: true, params: { count: 80, speed: 1.0, wind: 0.5, size: 15.0, color: "#4caf50" } },
  vignette: { type: "vignette", name: "Vignette Frame", enabled: true, params: { intensity: 0.6, offset: 0.1 } },
  bloom: { type: "bloom", name: "Bloom Glow", enabled: true, params: { intensity: 1.0, threshold: 0.5, smoothing: 0.9 } },
  glitch: { type: "glitch", name: "Cyber Glitch", enabled: true, params: { strength: 0.1 } },
  "audio-visualizer": { type: "audio-visualizer", name: "Audio Visualizer", enabled: true, params: {} },
  parallax: { type: "parallax", name: "Parallax Depth", enabled: true, params: { intensity: 1.0 } },
  "cursor-trail": { type: "cursor-trail", name: "Sparkle Trail", enabled: true, params: { color: "auto" } },
  "ribbon-trail": { type: "ribbon-trail", name: "Fluid Ribbon", enabled: true, params: { color: "auto", width: 5.0, length: 50 } },
  "click-ripple": { type: "click-ripple", name: "Click Ripple", enabled: true, params: { color: "#ffffff" } },
  "color-grade": { type: "color-grade", name: "Color Tint", enabled: true, params: { color: "rgba(255, 100, 50, 0.15)", intensity: 0.3, blendMode: "overlay" } },
  "blur-region": { type: "blur-region", name: "Blur Region", enabled: true, params: { x: 10, y: 10, w: 30, h: 20, blur: 15 } },
  clock: { type: "clock", name: "Clock Widget", enabled: true, params: { format: "24h", style: "minimal", color: "#ffffff", opacity: 0.8, x: 50, y: 50 } },
  "music-player": { type: "music-player", name: "Music Player", enabled: true, params: { x: 50, y: 80, scale: 1.0, theme: "glass", opacity: 0.9, shape: "standard", color: "auto" } },
  "app-launcher": { type: "app-launcher", name: "App Launcher", enabled: true, params: { x: 50, y: 90, scale: 1.0, apps: [], layout: "dock" } },
};

const EFFECT_DROPDOWN: { group: string, items: { key: string, icon: string, label: string }[] }[] = [
  { group: "⛅ Particles", items: [
    { key: "snow", icon: "❄️", label: "Snowfall" },
    { key: "rain", icon: "🌧️", label: "Raindrops" },
    { key: "fireflies", icon: "🪲", label: "Fireflies" },
    { key: "stars", icon: "⭐", label: "Starfield" },
    { key: "fog", icon: "🌫️", label: "Fog / Mist" },
  ]},
  { group: "🎬 Post Processing", items: [
    { key: "vignette", icon: "🖼️", label: "Vignette" },
    { key: "bloom", icon: "✨", label: "Bloom Glow" },
    { key: "glitch", icon: "⚡", label: "Cyber Glitch" },
  ]},
  { group: "🎮 Interactive", items: [
    { key: "audio-visualizer", icon: "🎵", label: "Audio Visualizer" },
    { key: "parallax", icon: "🔮", label: "Parallax Depth" },
    { key: "cursor-trail", icon: "🌟", label: "Sparkle Trail" },
    { key: "ribbon-trail", icon: "🖌️", label: "Fluid Ribbon" },
    { key: "click-ripple", icon: "💥", label: "Click Ripple" },
  ]},
  { group: "🎨 Overlays & Widgets", items: [
    { key: "color-grade", icon: "🎨", label: "Color Tint" },
    { key: "blur-region", icon: "🔲", label: "Blur Region" },
    { key: "clock", icon: "🕐", label: "Clock Widget" },
    { key: "music-player", icon: "🎧", label: "Music Player" },
    { key: "app-launcher", icon: "🚀", label: "App Launcher" },
  ]},
];

const TIME_PRESETS: { key: string, name: string, layers: Omit<EffectLayer, "id">[] }[] = [
  { key: "dawn", name: "🌅 Dawn", layers: [
    { type: "color-grade", name: "Dawn Tint", enabled: true, params: { color: "rgba(255, 180, 100, 0.2)", intensity: 0.35, blendMode: "overlay" } },
    { type: "fog", name: "Morning Mist", enabled: true, params: { count: 40, speed: 0.2, size: 50, opacity: 0.3 } },
    { type: "bloom", name: "Soft Glow", enabled: true, params: { intensity: 0.8, threshold: 0.6, smoothing: 0.95 } },
  ]},
  { key: "golden", name: "🌇 Golden Hour", layers: [
    { type: "color-grade", name: "Golden Tint", enabled: true, params: { color: "rgba(255, 160, 40, 0.25)", intensity: 0.4, blendMode: "overlay" } },
    { type: "vignette", name: "Warm Vignette", enabled: true, params: { intensity: 0.5, offset: 0.15 } },
    { type: "bloom", name: "Sunset Glow", enabled: true, params: { intensity: 1.5, threshold: 0.4, smoothing: 0.9 } },
  ]},
  { key: "night", name: "🌙 Night Sky", layers: [
    { type: "color-grade", name: "Night Tint", enabled: true, params: { color: "rgba(20, 30, 80, 0.3)", intensity: 0.4, blendMode: "multiply" } },
    { type: "stars", name: "Stars", enabled: true, params: { count: 500, speed: 0.05, size: 3, twinkle: 0.9 } },
    { type: "vignette", name: "Dark Vignette", enabled: true, params: { intensity: 0.8, offset: 0.05 } },
  ]},
  { key: "cyber", name: "💜 Cyberpunk", layers: [
    { type: "color-grade", name: "Neon Tint", enabled: true, params: { color: "rgba(180, 0, 255, 0.2)", intensity: 0.35, blendMode: "screen" } },
    { type: "rain", name: "Neon Rain", enabled: true, params: { count: 200, speed: 2.0, wind: 0.2, size: 3 } },
    { type: "bloom", name: "Neon Glow", enabled: true, params: { intensity: 2.0, threshold: 0.3, smoothing: 0.8 } },
    { type: "glitch", name: "Glitch", enabled: true, params: { strength: 0.05 } },
  ]},
  { key: "enchanted", name: "🧚 Enchanted", layers: [
    { type: "color-grade", name: "Forest Tint", enabled: true, params: { color: "rgba(0, 180, 80, 0.15)", intensity: 0.25, blendMode: "overlay" } },
    { type: "fireflies", name: "Fireflies", enabled: true, params: { count: 120, speed: 0.4, size: 5, color: "#ccff66" } },
    { type: "fog", name: "Forest Fog", enabled: true, params: { count: 30, speed: 0.15, size: 60, opacity: 0.25 } },
    { type: "vignette", name: "Soft Frame", enabled: true, params: { intensity: 0.4, offset: 0.2 } },
  ]},
  { key: "blizzard", name: "🏔️ Blizzard", layers: [
    { type: "snow", name: "Heavy Snow", enabled: true, params: { count: 800, speed: 2.5, wind: 1.5, size: 5 } },
    { type: "fog", name: "White-Out", enabled: true, params: { count: 50, speed: 0.5, size: 80, opacity: 0.5 } },
    { type: "color-grade", name: "Cold Tint", enabled: true, params: { color: "rgba(180, 200, 255, 0.15)", intensity: 0.3, blendMode: "screen" } },
    { type: "bloom", name: "Ice Glow", enabled: true, params: { intensity: 0.6, threshold: 0.7, smoothing: 0.95 } },
  ]},
];

export function EditorWorkspace({ currentVideo, onApplyWallpaper, onUploadMedia }: EditorWorkspaceProps) {
  const [layers, setLayers] = useState<EffectLayer[]>([
    { id: "vignette-1", type: "vignette", name: "Vignette Frame", enabled: true, params: { intensity: 0.5 } }
  ]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>("vignette-1");

  const addEffect = (type: keyof typeof EFFECT_TEMPLATES) => {
    const template = EFFECT_TEMPLATES[type];
    const newLayer: EffectLayer = {
      ...template,
      id: `${type}-${Date.now()}`,
    };
    setLayers([...layers, newLayer]);
    setSelectedLayerId(newLayer.id);
  };

  const removeEffect = (id: string) => {
    setLayers(layers.filter(l => l.id !== id));
    if (selectedLayerId === id) setSelectedLayerId(null);
  };

  const updateParam = (id: string, key: string, value: any) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, params: { ...l.params, [key]: value } } : l));
  };

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalMode, setProfileModalMode] = useState<"save" | "load">("load");
  const [savedProfiles, setSavedProfiles] = useState<string[]>([]);
  const [newProfileName, setNewProfileName] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const openProfileModal = async (mode: "save" | "load") => {
    setProfileModalMode(mode);
    setIsProfileModalOpen(true);
    setNewProfileName("");
    if (mode === "load") {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const list = await invoke<string[]>("list_profiles");
        setSavedProfiles(list || []);
      } catch (err) {
        console.error("Failed to list profiles", err);
      }
    }
  };

  useEffect(() => {
    const handleLoadProfileEvent = (e: any) => {
      if (e.detail) {
        executeLoadProfile(e.detail);
      }
    };
    window.addEventListener("load-profile", handleLoadProfileEvent);
    return () => window.removeEventListener("load-profile", handleLoadProfileEvent);
  }, []);

  const executeSaveProfile = async () => {
    if (!currentVideo || !newProfileName.trim()) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const config = { videoSrc: currentVideo.local_path || currentVideo.video_url, layers };
      await invoke("save_profile", { name: newProfileName.trim(), configJson: JSON.stringify(config) });
      setIsProfileModalOpen(false);
    } catch (err) {
      console.error("Failed to save profile:", err);
    }
  };

  const executeLoadProfile = async (name: string) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const configJson = await invoke<string>("load_profile", { name });
      const config = JSON.parse(configJson);
      
      if (config.videoSrc && onApplyWallpaper) {
        await onApplyWallpaper({
          id: name,
          thumbnail_url: "",
          video_url: config.videoSrc,
          source: "local",
          local_path: config.videoSrc,
          duration: 0,
          width: 1920,
          height: 1080
        });
      }
      
      if (config.layers) {
        setLayers(config.layers);
      }
      
      setIsProfileModalOpen(false);
    } catch (err) {
      console.error("Failed to load profile:", err);
    }
  };

  const handleExportItl = async () => {
    if (!currentVideo) return;
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const destPath = await save({ filters: [{ name: "itLives Package", extensions: ["itl"] }] });
      if (!destPath) return;

      const { invoke } = await import("@tauri-apps/api/core");
      const config = { videoSrc: currentVideo.local_path || currentVideo.video_url, thumbnailUrl: currentVideo.thumbnail_url, layers };
      await invoke("export_itl_package", { configJson: JSON.stringify(config), destPath });
      alert(`Package exported successfully to:\n${destPath}`);
      setIsProfileModalOpen(false);
    } catch (err) {
      console.error("Failed to export .itl package:", err);
      alert("Failed to export package.");
    }
  };

  const handleImportItl = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const srcPath = await open({ multiple: false, directory: false, filters: [{ name: "itLives Package", extensions: ["itl"] }] });
      if (!srcPath) return;

      setIsImporting(true);

      const { invoke } = await import("@tauri-apps/api/core");
      const newProfileName = await invoke<string>("import_itl_package", { srcPath });
      
      // Reload profile list and automatically load it
      const list = await invoke<string[]>("list_profiles");
      setSavedProfiles(list || []);
      
      setIsImporting(false);
      
      alert(`Package imported successfully as profile: '${newProfileName}'`);
      
      // Auto-load the new profile
      executeLoadProfile(newProfileName);
    } catch (err) {
      setIsImporting(false);
      console.error("Failed to import .itl package:", err);
      alert("Failed to import package.");
    }
  };

  const selectedLayer = layers.find(l => l.id === selectedLayerId);

  if (!currentVideo) {
    return (
      <div className="editor-empty panel" style={{ gridColumn: "span 3", padding: "40px" }}>
        <span className="eyebrow">Visual Effects Editor</span>
        <h3>No Wallpaper Loaded</h3>
        <p>Go to the **Discover** tab and fetch a wallpaper first to add effects to it.</p>
      </div>
    );
  }

  return (
    <div className="editor-workspace panel">
      {/* Left Sidebar: Layers & Add Tool */}
      <div className="editor-sidebar" style={{ borderRight: "1px solid var(--panel-stroke)" }}>
        <div className="editor-sidebar-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>My Effects</h3>
          <div style={{ display: "flex", gap: "6px" }}>
            <button 
              onClick={() => openProfileModal("save")}
              className="action-btn action-btn--secondary"
              style={{ padding: "4px 8px", fontSize: "11px", minHeight: "24px", borderRadius: "8px" }}
              title="Save Profile"
            >
              💾 Save
            </button>
            <button 
              onClick={() => openProfileModal("load")}
              className="action-btn action-btn--secondary"
              style={{ padding: "4px 8px", fontSize: "11px", minHeight: "24px", borderRadius: "8px" }}
              title="Load Profile"
            >
              📂 Load
            </button>
          </div>
        </div>

        <div className="editor-layer-list" style={{ flex: 1 }}>
          {layers.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--text-dim)", padding: "20px" }}>No effects added yet</p>
          ) : (
            layers.map((layer) => (
              <div 
                key={layer.id} 
                className={`editor-layer-item ${selectedLayerId === layer.id ? "editor-layer-item--active" : ""}`}
                onClick={() => setSelectedLayerId(layer.id)}
              >
                <div className="editor-layer-item__info">
                  <input 
                    type="checkbox" 
                    checked={layer.enabled} 
                    onChange={(e) => setLayers(layers.map(l => l.id === layer.id ? { ...l, enabled: e.target.checked } : l))}
                    onClick={(e) => e.stopPropagation()} 
                    style={{ cursor: "pointer", width: "16px", height: "16px" }}
                  />
                  <strong style={{ fontSize: "14px" }}>{layer.name}</strong>
                </div>
                <button 
                  type="button" 
                  className="action-btn action-btn--danger-ghost"
                  style={{ padding: "4px 8px", fontSize: "11px", minHeight: "26px", borderRadius: "8px" }}
                  onClick={(e) => { e.stopPropagation(); removeEffect(layer.id); }}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add Effect Dropdown */}
        <div style={{ borderTop: "1px solid var(--panel-stroke)", paddingTop: "12px" }}>
          <span className="eyebrow" style={{ fontSize: "10px", marginBottom: "6px", display: "block" }}>Add Effect</span>
          <select
            className="input"
            value=""
            onChange={(e) => { if (e.target.value) addEffect(e.target.value); e.target.value = ""; }}
            style={{ width: "100%", padding: "8px 10px", borderRadius: "10px", fontSize: "13px", cursor: "pointer" }}
          >
            <option value="" disabled>＋ Choose an effect...</option>
            {EFFECT_DROPDOWN.map(group => (
              <optgroup key={group.group} label={group.group}>
                {group.items.map(item => (
                  <option key={item.key} value={item.key}>{item.icon} {item.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Time-of-Day Preset Skins */}
        <div style={{ borderTop: "1px solid var(--panel-stroke)", paddingTop: "12px", marginTop: "8px" }}>
          <span className="eyebrow" style={{ fontSize: "10px", marginBottom: "6px", display: "block" }}>⏰ Scene Skins</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px" }}>
            {TIME_PRESETS.map(preset => (
              <button
                key={preset.key}
                type="button"
                className="action-btn action-btn--secondary"
                style={{ padding: "8px 6px", fontSize: "11px", borderRadius: "10px", fontWeight: "600", textAlign: "center" }}
                onClick={() => {
                  const newLayers = preset.layers.map((l, i) => ({
                    ...l,
                    id: `${preset.key}-${l.type}-${Date.now()}-${i}`,
                  }));
                  setLayers(prev => [...prev, ...newLayers as EffectLayer[]]);
                }}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>


      {/* Center: Canvas overlay Preview */}
      <div className="editor-preview" style={{ position: "relative" }}>
        <div style={{ position: "absolute", top: "12px", right: "12px", zIndex: 20, display: "flex", gap: "8px" }}>
          <button 
            type="button" 
            className="action-btn action-btn--secondary"
            style={{ padding: "10px 16px", borderRadius: "12px", fontWeight: "600", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}
            onClick={async () => {
              if (typeof window !== "undefined") {
                const emptyConfig = { videoSrc: "", layers: [] };
                localStorage.setItem("desktop_effects", JSON.stringify(emptyConfig));
                setLayers([]);
                try {
                  const { invoke } = await import("@tauri-apps/api/core");
                  await invoke("apply_desktop_effects", { layersJson: JSON.stringify(emptyConfig) });
                } catch (err) {
                  console.error("[Editor] Invoke failed:", err);
                }
              }
            }}
          >
            Clear Effects
          </button>
          
          {onUploadMedia && (
            <button 
              type="button" 
              className="action-btn action-btn--ghost"
              style={{ padding: "8px 12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
              onClick={onUploadMedia}
            >
              Upload Media
            </button>
          )}
          
          <button 
            type="button" 
            className="action-btn action-btn--primary"
            style={{ padding: "10px 16px", borderRadius: "12px", fontWeight: "600", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}
            onClick={async () => {
              console.log("[Editor] Apply to Desktop button clicked!");
              if (typeof window !== "undefined" && currentVideo) {
                const config = {
                  videoSrc: currentVideo.local_path || currentVideo.video_url,
                  layers: layers
                };
                console.log("[Editor] Saving config to localStorage & invoking tauri:", config);
                localStorage.setItem("desktop_effects", JSON.stringify(config));
                
                try {
                  const { invoke } = await import("@tauri-apps/api/core");
                  console.log("[Editor] Invoking onApplyWallpaper for video...");
                  if (onApplyWallpaper) {
                    await onApplyWallpaper(currentVideo);
                  }
                  console.log("[Editor] Invoking apply_desktop_effects... size:", JSON.stringify(config).length);
                  await invoke("apply_desktop_effects", { layersJson: JSON.stringify(config) });
                  alert("✨ Effects Applied to Desktop Overlay Mode!");
                } catch (err) {
                  console.error("[Editor] Invoke failed:", err);
                  alert("Sync complete! (Ensure transparent overlay mode is enabled for full auto-binds)");
                }
              } else {
                console.warn("[Editor] Clicked but currentVideo is missing or window is undefined.", { currentVideo });
              }
            }}
          >
            Apply to Desktop
          </button>
        </div>

        <WebGLEffectRenderer 
          videoSrc={currentVideo ? (currentVideo.local_path || currentVideo.video_url) : ""} 
          effects={layers} 
          selectedLayerId={selectedLayerId}
          onUpdateParam={updateParam}
        />

      </div>


      {/* Right Sidebar: Properties Layout */}
      <div className="editor-sidebar" style={{ borderLeft: "1px solid var(--panel-stroke)" }}>
        <div className="editor-sidebar-header">
          <h3>Properties</h3>
        </div>

        {selectedLayer ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="property-group">
              <label>Layer Name</label>
              <input type="text" className="input" value={selectedLayer.name} disabled />
            </div>

            {selectedLayer.type === "vignette" && (
              <>
                <div className="property-group">
                  <label>Darkness ({selectedLayer.params.intensity})</label>
                  <input 
                    type="range" min="0" max="1" step="0.05" 
                    className="property-control"
                    value={selectedLayer.params.intensity} 
                    onChange={(e) => updateParam(selectedLayer.id, "intensity", parseFloat(e.target.value))} 
                  />
                </div>
                <div className="property-group">
                  <label>Offset ({selectedLayer.params.offset || 0.1})</label>
                  <input 
                    type="range" min="0" max="1" step="0.05" 
                    className="property-control"
                    value={selectedLayer.params.offset || 0.1} 
                    onChange={(e) => updateParam(selectedLayer.id, "offset", parseFloat(e.target.value))} 
                  />
                </div>
              </>
            )}

            {(selectedLayer.type === "snow" || selectedLayer.type === "rain") && (
              <>
                <div className="property-group">
                  <label>Count ({selectedLayer.params.count})</label>
                  <input 
                    type="range" min="20" max="2000" step="10" 
                    className="property-control"
                    value={selectedLayer.params.count} 
                    onChange={(e) => updateParam(selectedLayer.id, "count", parseInt(e.target.value))} 
                  />
                </div>
                <div className="property-group">
                  <label>Speed ({selectedLayer.params.speed})</label>
                  <input 
                    type="range" min="0.5" max="5" step="0.1" 
                    className="property-control"
                    value={selectedLayer.params.speed} 
                    onChange={(e) => updateParam(selectedLayer.id, "speed", parseFloat(e.target.value))} 
                  />
                </div>
                <div className="property-group">
                  <label>Wind ({selectedLayer.params.wind || 0})</label>
                  <input 
                    type="range" min="0" max="2" step="0.1" 
                    className="property-control"
                    value={selectedLayer.params.wind || 0} 
                    onChange={(e) => updateParam(selectedLayer.id, "wind", parseFloat(e.target.value))} 
                  />
                </div>
                <div className="property-group">
                  <label>Size ({selectedLayer.params.size || 6})</label>
                  <input 
                    type="range" min="1" max="20" step="0.5" 
                    className="property-control"
                    value={selectedLayer.params.size || 6} 
                    onChange={(e) => updateParam(selectedLayer.id, "size", parseFloat(e.target.value))} 
                  />
                </div>
                <div className="property-group">
                  <label>Color</label>
                  <input 
                    type="color" 
                    value={selectedLayer.params.color || (selectedLayer.type === "snow" ? "#ffffff" : "#aaccff")} 
                    onChange={(e) => updateParam(selectedLayer.id, "color", e.target.value)} 
                    style={{ width: "100%", height: "36px", border: "none", borderRadius: "8px", cursor: "pointer" }}
                  />
                </div>
              </>
            )}

            {selectedLayer.type === "water-caustics" && (
              <>
                <div className="property-group">
                  <label>Speed ({selectedLayer.params.speed || 1.0})</label>
                  <input type="range" min="0.1" max="5" step="0.1" className="property-control" value={selectedLayer.params.speed || 1.0} onChange={(e) => updateParam(selectedLayer.id, "speed", parseFloat(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Scale ({selectedLayer.params.scale || 3.0})</label>
                  <input type="range" min="0.5" max="10" step="0.5" className="property-control" value={selectedLayer.params.scale || 3.0} onChange={(e) => updateParam(selectedLayer.id, "scale", parseFloat(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Intensity ({selectedLayer.params.intensity || 1.0})</label>
                  <input type="range" min="0.1" max="5" step="0.1" className="property-control" value={selectedLayer.params.intensity || 1.0} onChange={(e) => updateParam(selectedLayer.id, "intensity", parseFloat(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Color</label>
                  <input type="color" value={selectedLayer.params.color || "#00ffff"} onChange={(e) => updateParam(selectedLayer.id, "color", e.target.value)} style={{ width: "100%", height: "36px", border: "none", borderRadius: "8px", cursor: "pointer" }} />
                </div>
              </>
            )}

            {selectedLayer.type === "blowing-leaves" && (
              <>
                <div className="property-group">
                  <label>Count ({selectedLayer.params.count || 80})</label>
                  <input type="range" min="10" max="500" step="10" className="property-control" value={selectedLayer.params.count || 80} onChange={(e) => updateParam(selectedLayer.id, "count", parseInt(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Wind ({selectedLayer.params.wind || 0.5})</label>
                  <input type="range" min="0" max="2" step="0.1" className="property-control" value={selectedLayer.params.wind || 0.5} onChange={(e) => updateParam(selectedLayer.id, "wind", parseFloat(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Speed ({selectedLayer.params.speed || 1.0})</label>
                  <input type="range" min="0.1" max="3" step="0.1" className="property-control" value={selectedLayer.params.speed || 1.0} onChange={(e) => updateParam(selectedLayer.id, "speed", parseFloat(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Size ({selectedLayer.params.size || 15.0})</label>
                  <input type="range" min="5" max="50" step="1" className="property-control" value={selectedLayer.params.size || 15.0} onChange={(e) => updateParam(selectedLayer.id, "size", parseFloat(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Color</label>
                  <input type="color" value={selectedLayer.params.color || "#4caf50"} onChange={(e) => updateParam(selectedLayer.id, "color", e.target.value)} style={{ width: "100%", height: "36px", border: "none", borderRadius: "8px", cursor: "pointer" }} />
                </div>
              </>
            )}

            {selectedLayer.type === "bloom" && (
              <>
                <div className="property-group">
                  <label>Intensity ({selectedLayer.params.intensity || 1.0})</label>
                  <input 
                    type="range" min="0" max="5" step="0.1" 
                    className="property-control"
                    value={selectedLayer.params.intensity || 1.0} 
                    onChange={(e) => updateParam(selectedLayer.id, "intensity", parseFloat(e.target.value))} 
                  />
                </div>
                <div className="property-group">
                  <label>Threshold ({selectedLayer.params.threshold || 0.5})</label>
                  <input 
                    type="range" min="0" max="1" step="0.05" 
                    className="property-control"
                    value={selectedLayer.params.threshold || 0.5} 
                    onChange={(e) => updateParam(selectedLayer.id, "threshold", parseFloat(e.target.value))} 
                  />
                </div>
                <div className="property-group">
                  <label>Smoothing ({selectedLayer.params.smoothing || 0.9})</label>
                  <input 
                    type="range" min="0" max="1" step="0.05" 
                    className="property-control"
                    value={selectedLayer.params.smoothing || 0.9} 
                    onChange={(e) => updateParam(selectedLayer.id, "smoothing", parseFloat(e.target.value))} 
                  />
                </div>
              </>
            )}

            {selectedLayer.type === "glitch" && (
              <div className="property-group">
                <label>Strength ({selectedLayer.params.strength || 0.1})</label>
                <input 
                  type="range" min="0.01" max="1" step="0.01" 
                  className="property-control"
                  value={selectedLayer.params.strength || 0.1} 
                  onChange={(e) => updateParam(selectedLayer.id, "strength", parseFloat(e.target.value))} 
                />
              </div>
            )}

            {selectedLayer.type === "parallax" && (
              <div className="property-group">
                <label>Depth Intensity ({selectedLayer.params.intensity || 1.0})</label>
                <input 
                  type="range" min="0.1" max="5" step="0.1" 
                  className="property-control"
                  value={selectedLayer.params.intensity || 1.0} 
                  onChange={(e) => updateParam(selectedLayer.id, "intensity", parseFloat(e.target.value))} 
                />
              </div>
            )}

            {selectedLayer.type === "color-grade" && (
              <>
                <div className="property-group">
                  <label>Tint Color</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px" }}>
                    {[
                      { label: "Warm", color: "rgba(255, 100, 50, 0.3)" },
                      { label: "Cool", color: "rgba(50, 100, 255, 0.3)" },
                      { label: "Cyber", color: "rgba(180, 0, 255, 0.25)" },
                      { label: "Emerald", color: "rgba(0, 200, 100, 0.2)" },
                      { label: "Sepia", color: "rgba(180, 140, 80, 0.3)" },
                    ].map(preset => (
                      <button
                        key={preset.label}
                        type="button"
                        className="action-btn action-btn--secondary"
                        style={{ padding: "6px", fontSize: "10px", borderRadius: "8px", background: preset.color }}
                        onClick={() => updateParam(selectedLayer.id, "color", preset.color)}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="property-group">
                  <label>Opacity ({selectedLayer.params.intensity || 0.3})</label>
                  <input 
                    type="range" min="0" max="1" step="0.05" 
                    className="property-control"
                    value={selectedLayer.params.intensity || 0.3} 
                    onChange={(e) => updateParam(selectedLayer.id, "intensity", parseFloat(e.target.value))} 
                  />
                </div>
                <div className="property-group">
                  <label>Blend Mode</label>
                  <select 
                    className="input"
                    value={selectedLayer.params.blendMode || "overlay"}
                    onChange={(e) => updateParam(selectedLayer.id, "blendMode", e.target.value)}
                  >
                    <option value="overlay">Overlay</option>
                    <option value="multiply">Multiply</option>
                    <option value="screen">Screen</option>
                    <option value="color">Color</option>
                    <option value="hard-light">Hard Light</option>
                    <option value="soft-light">Soft Light</option>
                  </select>
                </div>
              </>
            )}

            {(selectedLayer.type === "cursor-trail" || selectedLayer.type === "click-ripple" || selectedLayer.type === "ribbon-trail") && (
              <>
                <div className="property-group">
                  <label>Color</label>
                  <input 
                    type="color" 
                    value={selectedLayer.params.color || (selectedLayer.type === "cursor-trail" ? "#9ae600" : "#ffffff")}
                    onChange={(e) => updateParam(selectedLayer.id, "color", e.target.value)}
                    style={{ width: "100%", height: "36px", border: "none", borderRadius: "8px", cursor: "pointer" }}
                  />
                </div>
                {(selectedLayer.type === "cursor-trail" || selectedLayer.type === "click-ripple") && (
                  <div className="property-group">
                    <label>Size ({selectedLayer.params.size || 8})</label>
                    <input 
                      type="range" min="2" max="50" step="1" 
                      className="property-control"
                      value={selectedLayer.params.size || 8} 
                      onChange={(e) => updateParam(selectedLayer.id, "size", parseInt(e.target.value))} 
                    />
                  </div>
                )}
                {selectedLayer.type === "ribbon-trail" && (
                  <>
                    <div className="property-group">
                      <label>Width ({selectedLayer.params.width || 5.0})</label>
                      <input 
                        type="range" min="1" max="20" step="0.5" 
                        className="property-control"
                        value={selectedLayer.params.width || 5.0} 
                        onChange={(e) => updateParam(selectedLayer.id, "width", parseFloat(e.target.value))} 
                      />
                    </div>
                    <div className="property-group">
                      <label>Length ({selectedLayer.params.length || 50})</label>
                      <input 
                        type="range" min="10" max="200" step="10" 
                        className="property-control"
                        value={selectedLayer.params.length || 50} 
                        onChange={(e) => updateParam(selectedLayer.id, "length", parseInt(e.target.value))} 
                      />
                    </div>
                  </>
                )}
                {(selectedLayer.type === "cursor-trail" || selectedLayer.type === "click-ripple") && (
                  <div className="property-group">
                    <label>Shape</label>
                  <select className="input" value={selectedLayer.params.shape || "circle"} onChange={(e) => updateParam(selectedLayer.id, "shape", e.target.value)}>
                    <option value="circle">Circle</option>
                    <option value="spark">Spark (Star)</option>
                    <option value="square">Square</option>
                    <option value="ring">Ring</option>
                  </select>
                </div>
                )}
              </>
            )}

            {selectedLayer.type === "blur-region" && (
              <>
                <div className="property-group">
                  <label>Position X ({selectedLayer.params.x}%)</label>
                  <input type="range" min="0" max="100" className="property-control" value={selectedLayer.params.x} onChange={(e) => updateParam(selectedLayer.id, "x", parseInt(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Position Y ({selectedLayer.params.y}%)</label>
                  <input type="range" min="0" max="100" className="property-control" value={selectedLayer.params.y} onChange={(e) => updateParam(selectedLayer.id, "y", parseInt(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Width ({selectedLayer.params.w}%)</label>
                  <input type="range" min="5" max="100" className="property-control" value={selectedLayer.params.w} onChange={(e) => updateParam(selectedLayer.id, "w", parseInt(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Height ({selectedLayer.params.h}%)</label>
                  <input type="range" min="5" max="100" className="property-control" value={selectedLayer.params.h} onChange={(e) => updateParam(selectedLayer.id, "h", parseInt(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Blur Intensity ({selectedLayer.params.blur})</label>
                  <input type="range" min="2" max="100" className="property-control" value={selectedLayer.params.blur} onChange={(e) => updateParam(selectedLayer.id, "blur", parseInt(e.target.value))} />
                </div>
              </>
            )}

            {selectedLayer.type === "fireflies" && (
              <>
                <div className="property-group">
                  <label>Count ({selectedLayer.params.count})</label>
                  <input type="range" min="10" max="500" step="10" className="property-control" value={selectedLayer.params.count} onChange={(e) => updateParam(selectedLayer.id, "count", parseInt(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Speed ({selectedLayer.params.speed})</label>
                  <input type="range" min="0.1" max="3" step="0.1" className="property-control" value={selectedLayer.params.speed} onChange={(e) => updateParam(selectedLayer.id, "speed", parseFloat(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Size ({selectedLayer.params.size})</label>
                  <input type="range" min="1" max="15" step="0.5" className="property-control" value={selectedLayer.params.size} onChange={(e) => updateParam(selectedLayer.id, "size", parseFloat(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Color</label>
                  <input type="color" value={selectedLayer.params.color || "#aaff44"} onChange={(e) => updateParam(selectedLayer.id, "color", e.target.value)} style={{ width: "100%", height: "36px", border: "none", borderRadius: "8px", cursor: "pointer" }} />
                </div>
              </>
            )}

            {selectedLayer.type === "stars" && (
              <>
                <div className="property-group">
                  <label>Count ({selectedLayer.params.count})</label>
                  <input type="range" min="50" max="2000" step="50" className="property-control" value={selectedLayer.params.count} onChange={(e) => updateParam(selectedLayer.id, "count", parseInt(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Speed ({selectedLayer.params.speed})</label>
                  <input type="range" min="0" max="1" step="0.05" className="property-control" value={selectedLayer.params.speed} onChange={(e) => updateParam(selectedLayer.id, "speed", parseFloat(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Size ({selectedLayer.params.size})</label>
                  <input type="range" min="1" max="10" step="0.5" className="property-control" value={selectedLayer.params.size} onChange={(e) => updateParam(selectedLayer.id, "size", parseFloat(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Twinkle ({selectedLayer.params.twinkle})</label>
                  <input type="range" min="0" max="1" step="0.05" className="property-control" value={selectedLayer.params.twinkle} onChange={(e) => updateParam(selectedLayer.id, "twinkle", parseFloat(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Color</label>
                  <input type="color" value={selectedLayer.params.color || "#ffffff"} onChange={(e) => updateParam(selectedLayer.id, "color", e.target.value)} style={{ width: "100%", height: "36px", border: "none", borderRadius: "8px", cursor: "pointer" }} />
                </div>
              </>
            )}

            {selectedLayer.type === "fog" && (
              <>
                <div className="property-group">
                  <label>Density ({selectedLayer.params.count})</label>
                  <input type="range" min="10" max="200" step="10" className="property-control" value={selectedLayer.params.count} onChange={(e) => updateParam(selectedLayer.id, "count", parseInt(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Drift Speed ({selectedLayer.params.speed})</label>
                  <input type="range" min="0.05" max="2" step="0.05" className="property-control" value={selectedLayer.params.speed} onChange={(e) => updateParam(selectedLayer.id, "speed", parseFloat(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Cloud Size ({selectedLayer.params.size})</label>
                  <input type="range" min="10" max="120" step="5" className="property-control" value={selectedLayer.params.size} onChange={(e) => updateParam(selectedLayer.id, "size", parseFloat(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Opacity ({selectedLayer.params.opacity})</label>
                  <input type="range" min="0.05" max="0.8" step="0.05" className="property-control" value={selectedLayer.params.opacity} onChange={(e) => updateParam(selectedLayer.id, "opacity", parseFloat(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Color</label>
                  <input type="color" value={selectedLayer.params.color || "#d9e0eb"} onChange={(e) => updateParam(selectedLayer.id, "color", e.target.value)} style={{ width: "100%", height: "36px", border: "none", borderRadius: "8px", cursor: "pointer" }} />
                </div>
              </>
            )}

            {selectedLayer.type === "clock" && (
              <>
                <div className="property-group">
                  <label>Format</label>
                  <select className="input" value={selectedLayer.params.format || "24h"} onChange={(e) => updateParam(selectedLayer.id, "format", e.target.value)}>
                    <option value="24h">24 Hour</option>
                    <option value="12h">12 Hour</option>
                  </select>
                </div>
                <div className="property-group">
                  <label>Style</label>
                  <select className="input" value={selectedLayer.params.style || "minimal"} onChange={(e) => updateParam(selectedLayer.id, "style", e.target.value)}>
                    <option value="minimal">Minimal</option>
                    <option value="bold">Bold</option>
                    <option value="neon">Neon Glow</option>
                    <option value="retro">Retro LCD</option>
                    <option value="analog">Analog Face</option>
                    <option value="digital-clean">Digital Clean</option>
                    <option value="futuristic-day">Futuristic Day</option>
                  </select>
                </div>
                <div className="property-group" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input type="checkbox" checked={selectedLayer.params.color === "auto"} onChange={(e) => updateParam(selectedLayer.id, "color", e.target.checked ? "auto" : "#ffffff")} />
                  <label style={{ margin: 0 }}>Auto Match Wallpaper Color</label>
                </div>
                {selectedLayer.params.color !== "auto" && (
                  <div className="property-group">
                    <label>Color</label>
                    <input type="color" value={selectedLayer.params.color || "#ffffff"} onChange={(e) => updateParam(selectedLayer.id, "color", e.target.value)} style={{ width: "100%", height: "36px", border: "none", borderRadius: "8px", cursor: "pointer" }} />
                  </div>
                )}
                {selectedLayer.params.style === "analog" && (
                  <div className="property-group">
                    <label>Secondary Color (Seconds)</label>
                    <input type="color" value={selectedLayer.params.secondaryColor || "#ff3366"} onChange={(e) => updateParam(selectedLayer.id, "secondaryColor", e.target.value)} style={{ width: "100%", height: "36px", border: "none", borderRadius: "8px", cursor: "pointer" }} />
                  </div>
                )}
                <div className="property-group">
                  <label>Size ({selectedLayer.params.size || 160}px)</label>
                  <input type="range" min="50" max="800" step="10" className="property-control" value={selectedLayer.params.size || 160} onChange={(e) => updateParam(selectedLayer.id, "size", parseInt(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Opacity ({selectedLayer.params.opacity || 0.8})</label>
                  <input type="range" min="0.1" max="1" step="0.05" className="property-control" value={selectedLayer.params.opacity || 0.8} onChange={(e) => updateParam(selectedLayer.id, "opacity", parseFloat(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Position X ({selectedLayer.params.x || 50}%)</label>
                  <input type="range" min="0" max="100" className="property-control" value={selectedLayer.params.x || 50} onChange={(e) => updateParam(selectedLayer.id, "x", parseInt(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Position Y ({selectedLayer.params.y || 50}%)</label>
                  <input type="range" min="0" max="100" className="property-control" value={selectedLayer.params.y || 50} onChange={(e) => updateParam(selectedLayer.id, "y", parseInt(e.target.value))} />
                </div>
              </>
            )}

            {selectedLayer.type === "vignette" && (
              <>
                <div className="property-group">
                  <label>Offset ({selectedLayer.params.offset || 0.1})</label>
                  <input type="range" min="0" max="1" step="0.05" className="property-control" value={selectedLayer.params.offset || 0.1} onChange={(e) => updateParam(selectedLayer.id, "offset", parseFloat(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Darkness ({selectedLayer.params.intensity || 0.6})</label>
                  <input type="range" min="0" max="2" step="0.1" className="property-control" value={selectedLayer.params.intensity || 0.6} onChange={(e) => updateParam(selectedLayer.id, "intensity", parseFloat(e.target.value))} />
                </div>
              </>
            )}

            {selectedLayer.type === "audio-visualizer" && (
              <>
                <div className="property-group">
                  <label>Style</label>
                  <select className="input" value={selectedLayer.params.style || "circle"} onChange={(e) => updateParam(selectedLayer.id, "style", e.target.value)}>
                    <option value="circle">Circle</option>
                    <option value="horizontal">Horizontal Bars</option>
                    <option value="mirror">Mirrored Bars</option>
                  </select>
                </div>
                <div className="property-group">
                  <label>Color</label>
                  <input type="color" value={selectedLayer.params.color || "#ffffff"} onChange={(e) => updateParam(selectedLayer.id, "color", e.target.value)} style={{ width: "100%", height: "36px", border: "none", borderRadius: "8px", cursor: "pointer" }} />
                </div>
                <div className="property-group">
                  <label>Scale ({selectedLayer.params.scale || 1.0})</label>
                  <input type="range" min="0.1" max="5" step="0.1" className="property-control" value={selectedLayer.params.scale || 1.0} onChange={(e) => updateParam(selectedLayer.id, "scale", parseFloat(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Radius ({selectedLayer.params.radius || 250})</label>
                  <input type="range" min="50" max="800" step="10" className="property-control" value={selectedLayer.params.radius || 250} onChange={(e) => updateParam(selectedLayer.id, "radius", parseFloat(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Opacity ({selectedLayer.params.opacity || 0.8})</label>
                  <input type="range" min="0.1" max="1" step="0.05" className="property-control" value={selectedLayer.params.opacity || 0.8} onChange={(e) => updateParam(selectedLayer.id, "opacity", parseFloat(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Position X ({selectedLayer.params.x || 50}%)</label>
                  <input type="range" min="0" max="100" className="property-control" value={selectedLayer.params.x || 50} onChange={(e) => updateParam(selectedLayer.id, "x", parseInt(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Position Y ({selectedLayer.params.y || 50}%)</label>
                  <input type="range" min="0" max="100" className="property-control" value={selectedLayer.params.y || 50} onChange={(e) => updateParam(selectedLayer.id, "y", parseInt(e.target.value))} />
                </div>
              </>
            )}
            {selectedLayer.type === "ribbon-trail" && (
              <>
                <div className="property-group" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input type="checkbox" checked={selectedLayer.params.color === "auto"} onChange={(e) => updateParam(selectedLayer.id, "color", e.target.checked ? "auto" : "#ffffff")} />
                  <label style={{ margin: 0 }}>Auto Match Wallpaper Color</label>
                </div>
                {selectedLayer.params.color !== "auto" && (
                  <div className="property-group">
                    <label>Color</label>
                    <input type="color" value={selectedLayer.params.color || "#ffffff"} onChange={(e) => updateParam(selectedLayer.id, "color", e.target.value)} style={{ width: "100%", height: "36px", border: "none", borderRadius: "8px", cursor: "pointer" }} />
                  </div>
                )}
                <div className="property-group">
                  <label>Width ({selectedLayer.params.width || 5.0})</label>
                  <input type="range" min="1" max="20" step="1" className="property-control" value={selectedLayer.params.width || 5.0} onChange={(e) => updateParam(selectedLayer.id, "width", parseFloat(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Length ({selectedLayer.params.length || 50})</label>
                  <input type="range" min="10" max="200" step="10" className="property-control" value={selectedLayer.params.length || 50} onChange={(e) => updateParam(selectedLayer.id, "length", parseInt(e.target.value))} />
                </div>
              </>
            )}

            {selectedLayer.type === "cursor-trail" && (
              <>
                <div className="property-group" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input type="checkbox" checked={selectedLayer.params.color === "auto"} onChange={(e) => updateParam(selectedLayer.id, "color", e.target.checked ? "auto" : "#ffffff")} />
                  <label style={{ margin: 0 }}>Auto Match Wallpaper Color</label>
                </div>
                {selectedLayer.params.color !== "auto" && (
                  <div className="property-group">
                    <label>Color</label>
                    <input type="color" value={selectedLayer.params.color || "#ffffff"} onChange={(e) => updateParam(selectedLayer.id, "color", e.target.value)} style={{ width: "100%", height: "36px", border: "none", borderRadius: "8px", cursor: "pointer" }} />
                  </div>
                )}
              </>
            )}

            {selectedLayer.type === "music-player" && (
              <>
                <div className="property-group">
                  <label>Shape</label>
                  <select className="input" value={selectedLayer.params.shape || "standard"} onChange={(e) => updateParam(selectedLayer.id, "shape", e.target.value)}>
                    <option value="standard">Standard</option>
                    <option value="compact">Compact</option>
                    <option value="vinyl">Vinyl Record</option>
                  </select>
                </div>
                <div className="property-group">
                  <label>Theme</label>
                  <select className="input" value={selectedLayer.params.theme || "glass"} onChange={(e) => updateParam(selectedLayer.id, "theme", e.target.value)}>
                    <option value="glass">Glass</option>
                    <option value="apple-music">Apple Music (Blur)</option>
                    <option value="spotify-dark">Spotify Dark</option>
                    <option value="winamp-retro">Winamp Retro</option>
                  </select>
                </div>
                <div className="property-group" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input type="checkbox" checked={selectedLayer.params.color === "auto"} onChange={(e) => updateParam(selectedLayer.id, "color", e.target.checked ? "auto" : "#ffffff")} />
                  <label style={{ margin: 0 }}>Auto Match Wallpaper Color</label>
                </div>
                {selectedLayer.params.color !== "auto" && (
                  <div className="property-group">
                    <label>Accent Color</label>
                    <input type="color" value={selectedLayer.params.color || "#ffffff"} onChange={(e) => updateParam(selectedLayer.id, "color", e.target.value)} style={{ width: "100%", height: "36px", border: "none", borderRadius: "8px", cursor: "pointer" }} />
                  </div>
                )}
                <div className="property-group">
                  <label>Scale ({selectedLayer.params.scale || 1.0})</label>
                  <input type="range" min="0.5" max="2.0" step="0.1" className="property-control" value={selectedLayer.params.scale || 1.0} onChange={(e) => updateParam(selectedLayer.id, "scale", parseFloat(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Position X ({selectedLayer.params.x || 50}%)</label>
                  <input type="range" min="0" max="100" className="property-control" value={selectedLayer.params.x || 50} onChange={(e) => updateParam(selectedLayer.id, "x", parseInt(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Position Y ({selectedLayer.params.y || 80}%)</label>
                  <input type="range" min="0" max="100" className="property-control" value={selectedLayer.params.y || 80} onChange={(e) => updateParam(selectedLayer.id, "y", parseInt(e.target.value))} />
                </div>
              </>
            )}

            {selectedLayer.type === "app-launcher" && (
              <>
                <div className="property-group">
                  <label>Layout</label>
                  <select className="input" value={selectedLayer.params.layout || "dock"} onChange={(e) => updateParam(selectedLayer.id, "layout", e.target.value)}>
                    <option value="dock">Horizontal Dock</option>
                    <option value="grid">App Grid</option>
                  </select>
                </div>
                <div className="property-group">
                  <label>Theme</label>
                  <select className="input" value={selectedLayer.params.theme || "glass"} onChange={(e) => updateParam(selectedLayer.id, "theme", e.target.value)}>
                    <option value="glass">Glassmorphism</option>
                    <option value="frutiger-aero">Frutiger Aero (Vista)</option>
                    <option value="neumorphism">Neumorphism</option>
                    <option value="flat">Flat Minimal</option>
                  </select>
                </div>
                <div className="property-group">
                  <label>Apps</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {(selectedLayer.params.apps || []).map((app: any, idx: number) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.05)", padding: "8px", borderRadius: "8px" }}>
                        {app.iconBase64 ? (
                          <img src={`data:image/png;base64,${app.iconBase64}`} alt="icon" style={{ width: "32px", height: "32px", objectFit: "contain" }} />
                        ) : (
                          <span style={{ fontSize: "24px" }}>{app.icon || "🚀"}</span>
                        )}
                        <div style={{ flex: 1, overflow: "hidden" }}>
                          <div style={{ fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{app.name}</div>
                          <div style={{ fontSize: "10px", opacity: 0.6, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{app.path}</div>
                        </div>
                        <button type="button" className="action-btn action-btn--secondary-ghost" style={{ padding: "4px" }} title="Change Icon" onClick={async () => {
                          const { open } = await import("@tauri-apps/plugin-dialog");
                          const imgPath = await open({ multiple: false, directory: false, filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg"] }] });
                          if (imgPath) {
                            const { convertFileSrc } = await import("@tauri-apps/api/core");
                            const src = convertFileSrc(imgPath as string);
                            // Convert image to base64
                            const img = new Image();
                            img.crossOrigin = "Anonymous";
                            img.onload = () => {
                              const canvas = document.createElement("canvas");
                              canvas.width = img.width; canvas.height = img.height;
                              const ctx = canvas.getContext("2d");
                              if (ctx) {
                                ctx.drawImage(img, 0, 0);
                                const b64 = canvas.toDataURL("image/png").split(",")[1];
                                const newApps = [...selectedLayer.params.apps];
                                newApps[idx] = { ...newApps[idx], iconBase64: b64 };
                                updateParam(selectedLayer.id, "apps", newApps);
                              }
                            };
                            img.src = src;
                          }
                        }}>🖼️</button>
                        <button type="button" className="action-btn action-btn--danger-ghost" style={{ padding: "4px" }} onClick={() => {
                          const newApps = [...selectedLayer.params.apps];
                          newApps.splice(idx, 1);
                          updateParam(selectedLayer.id, "apps", newApps);
                        }}>✕</button>
                      </div>
                    ))}
                    <button type="button" className="action-btn action-btn--secondary" onClick={async () => {
                      const { open } = await import("@tauri-apps/plugin-dialog");
                      const path = await open({ multiple: false, directory: false, filters: [{ name: "Executable", extensions: ["exe", "bat", "lnk"] }] });
                      if (path) {
                        // Extract filename for default name
                        const defaultName = (path as string).split(/[/\\]/).pop()?.split(".")[0] || "App";
                        const name = prompt("Enter a name for this app:", defaultName);
                        if (!name) return;
                        
                        let iconBase64 = null;
                        let iconEmoji = "🚀";
                        try {
                          const { invoke } = await import("@tauri-apps/api/core");
                          iconBase64 = await invoke("extract_icon_base64", { path });
                        } catch (e) {
                          console.warn("Failed to extract icon natively, falling back to emoji", e);
                          iconEmoji = prompt("Could not extract icon natively. Enter an emoji to use as the icon (e.g. 🎮, 🌐, 🎵):", "🚀") || "🚀";
                        }
                        
                        const newApps = [...(selectedLayer.params.apps || []), { path, name, icon: iconEmoji, iconBase64 }];
                        updateParam(selectedLayer.id, "apps", newApps);
                      }
                    }}>
                      ＋ Add App
                    </button>
                  </div>
                </div>
                <div className="property-group">
                  <label>Scale ({selectedLayer.params.scale || 1.0})</label>
                  <input type="range" min="0.5" max="2.0" step="0.1" className="property-control" value={selectedLayer.params.scale || 1.0} onChange={(e) => updateParam(selectedLayer.id, "scale", parseFloat(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Position X ({selectedLayer.params.x || 50}%)</label>
                  <input type="range" min="0" max="100" className="property-control" value={selectedLayer.params.x || 50} onChange={(e) => updateParam(selectedLayer.id, "x", parseInt(e.target.value))} />
                </div>
                <div className="property-group">
                  <label>Position Y ({selectedLayer.params.y || 90}%)</label>
                  <input type="range" min="0" max="100" className="property-control" value={selectedLayer.params.y || 90} onChange={(e) => updateParam(selectedLayer.id, "y", parseInt(e.target.value))} />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="editor-empty">
            <p>Select a layer to edit properties.</p>
          </div>
        )}
      </div>

      {/* Profile Manager Modal */}
      {isProfileModalOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(10px)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }} onClick={() => setIsProfileModalOpen(false)}>
          <div style={{
            background: "rgba(30, 30, 30, 0.9)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "24px", padding: "32px", width: "400px", maxWidth: "90%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", gap: "20px"
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 600 }}>
                {profileModalMode === "save" ? "Save Current Profile" : "Load Saved Profile"}
              </h2>
              <button className="action-btn action-btn--danger-ghost" style={{ padding: "8px" }} onClick={() => setIsProfileModalOpen(false)}>✕</button>
            </div>

            {profileModalMode === "save" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "12px", opacity: 0.7 }}>Profile Name</label>
                  <input 
                    className="input" 
                    value={newProfileName} 
                    onChange={e => setNewProfileName(e.target.value)}
                    placeholder="E.g., Cyberpunk Rain, Relaxing Dawn"
                    style={{ width: "100%", padding: "12px", borderRadius: "12px", fontSize: "14px" }}
                    autoFocus
                  />
                </div>
                <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                  <button 
                    className="action-btn action-btn--primary" 
                    style={{ flex: 1, padding: "12px", borderRadius: "12px" }}
                    onClick={executeSaveProfile}
                    disabled={!newProfileName.trim()}
                  >
                    Save Profile
                  </button>
                  <button 
                    className="action-btn action-btn--secondary" 
                    style={{ flex: 1, padding: "12px", borderRadius: "12px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}
                    onClick={handleExportItl}
                  >
                    📦 Export as .itl
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "300px", overflowY: "auto" }}>
                {savedProfiles.length === 0 ? (
                  <div style={{ padding: "40px 0", textAlign: "center", opacity: 0.5, fontSize: "14px" }}>
                    No saved profiles yet.
                  </div>
                ) : (
                  savedProfiles.map(p => (
                    <div key={p} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "16px", background: "rgba(255,255,255,0.05)", borderRadius: "12px",
                      cursor: "pointer", transition: "background 0.2s"
                    }} onClick={() => executeLoadProfile(p)}>
                      <div style={{ fontWeight: 500 }}>{p}</div>
                      <div style={{ opacity: 0.5 }}>→</div>
                    </div>
                  ))
                )}
                
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: "8px", paddingTop: "16px" }}>
                  <button 
                    className="action-btn action-btn--secondary" 
                    style={{ width: "100%", padding: "12px", borderRadius: "12px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}
                    onClick={handleImportItl}
                    disabled={isImporting}
                  >
                    {isImporting ? "⏳ Importing Package..." : "📥 Import .itl Package"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
