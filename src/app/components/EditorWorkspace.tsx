"use client";

import { useState } from "react";
import { CanvasEffectRenderer, EffectLayer } from "./CanvasEffectRenderer";
import { VideoResult } from "@/hooks/useWallpaper";
import "./editor.css";


interface EditorWorkspaceProps {
  currentVideo: VideoResult | null;
  onApplyPreset?: (preset: any) => void;
  onApplyWallpaper?: (video: VideoResult) => Promise<void>;
}

const EFFECT_TEMPLATES: Record<string, Omit<EffectLayer, "id">> = {
  snow: { type: "snow", name: "Snowfall", enabled: true, params: { count: 120, speed: 1.5 } },
  rain: { type: "rain", name: "Raindrops", enabled: true, params: { count: 150, speed: 1.2 } },
  vignette: { type: "vignette", name: "Vignette Frame", enabled: true, params: { intensity: 0.6 } },
  "cursor-trail": { type: "cursor-trail", name: "Sparkle Trail 🌟", enabled: true, params: {} },
  "click-ripple": { type: "click-ripple", name: "Click Burst 💥", enabled: true, params: {} },
  "blur-region": { type: "blur-region", name: "Blur Mask 🌫️", enabled: true, params: { x: 10, y: 10, w: 30, h: 20, blur: 15 } },
};

export function EditorWorkspace({ currentVideo, onApplyWallpaper }: EditorWorkspaceProps) {
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
    setLayers(layers.map(l => l.id === id ? { ...l, params: { ...l.params, [key]: value } } : l));
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
        <div className="editor-sidebar-header">
          <h3>My Effects</h3>
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

        {/* Child-friendly Add Effect Grid */}
        <div style={{ borderTop: "1px solid var(--panel-stroke)", paddingTop: "16px" }}>
          <span className="eyebrow" style={{ fontSize: "10px" }}>Add Magic Effect</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", marginTop: "8px" }}>
            <button 
              type="button" 
              className="action-btn action-btn--secondary" 
              style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "12px", height: "auto", alignItems: "center", borderRadius: "16px" }}
              onClick={() => addEffect("snow")}
            >
              <div style={{ fontSize: "24px" }}>❄️</div>
              <span style={{ fontSize: "12px", fontWeight: "600" }}>Snow</span>
            </button>
            <button 
              type="button" 
              className="action-btn action-btn--secondary" 
              style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "12px", height: "auto", alignItems: "center", borderRadius: "16px" }}
              onClick={() => addEffect("rain")}
            >
              <div style={{ fontSize: "24px" }}>🌧️</div>
              <span style={{ fontSize: "12px", fontWeight: "600" }}>Rain</span>
            </button>
            <button 
              type="button" 
              className="action-btn action-btn--secondary" 
              style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "12px", height: "auto", alignItems: "center", borderRadius: "16px" }}
              onClick={() => addEffect("cursor-trail")}
            >
              <div style={{ fontSize: "24px" }}>🌟</div>
              <span style={{ fontSize: "12px", fontWeight: "600" }}>Sparkles</span>
            </button>
            <button 
              type="button" 
              className="action-btn action-btn--secondary" 
              style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "12px", height: "auto", alignItems: "center", borderRadius: "16px" }}
              onClick={() => addEffect("click-ripple")}
            >
              <div style={{ fontSize: "24px" }}>💥</div>
              <span style={{ fontSize: "12px", fontWeight: "600" }}>Click Burst</span>
            </button>
            <button 
              type="button" 
              className="action-btn action-btn--secondary" 
              style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "12px", height: "auto", alignItems: "center", borderRadius: "16px" }}
              onClick={() => addEffect("blur-region")}
            >
              <div style={{ fontSize: "24px" }}>🌫️</div>
              <span style={{ fontSize: "12px", fontWeight: "600" }}>Blur Area</span>
            </button>
            <button 
              type="button" 
              className="action-btn action-btn--secondary" 
              style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "12px", height: "auto", alignItems: "center", borderRadius: "16px" }}
              onClick={() => addEffect("vignette")}
            >
              <div style={{ fontSize: "24px" }}>🖼️</div>
              <span style={{ fontSize: "12px", fontWeight: "600" }}>Border Frame</span>
            </button>
          </div>
        </div>
      </div>


      {/* Center: Canvas overlay Preview */}
      <div className="editor-preview" style={{ position: "relative" }}>
        <div style={{ position: "absolute", top: "12px", right: "12px", zIndex: 20 }}>
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

        <CanvasEffectRenderer 
          videoSrc={currentVideo ? (currentVideo.local_path || currentVideo.video_url) : ""} 
          effects={layers} 
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
              <div className="property-group">
                <label>Intensity ({selectedLayer.params.intensity})</label>
                <input 
                  type="range" min="0" max="1" step="0.1" 
                  className="property-control"
                  value={selectedLayer.params.intensity} 
                  onChange={(e) => updateParam(selectedLayer.id, "intensity", parseFloat(e.target.value))} 
                />
              </div>
            )}

            {(selectedLayer.type === "snow" || selectedLayer.type === "rain") && (
              <>
                <div className="property-group">
                  <label>Count ({selectedLayer.params.count})</label>
                  <input 
                    type="range" min="20" max="500" step="10" 
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
          </div>
        ) : (
          <div className="editor-empty">
            <p>Select a layer to edit properties.</p>
          </div>
        )}
      </div>
    </div>
  );
}
