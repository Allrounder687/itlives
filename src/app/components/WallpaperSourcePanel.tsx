"use client";

import React, { useState } from "react";

interface WallpaperSourcePanelProps {
  wallpaper: {
    wallhavenApiKey: string;
    disabledSources: string[];
    pinterestUrls: string[];
    setWallhavenApiKey: (key: string) => Promise<void>;
    setDisabledSources: (sources: string[]) => Promise<void>;
    setPinterestUrls: (urls: string[]) => Promise<void>;
  };
}

interface WallpaperSourceOption {
  id: string;
  name: string;
  desc: string;
  emoji: string;
}

const SOURCES: WallpaperSourceOption[] = [
  { id: "motionbgs", name: "MotionBGs Feed", desc: "Unified SFW video feed provider", emoji: "🎥" },
  { id: "alphacoders", name: "AlphaCoders Feed", desc: "Live video loops", emoji: "🎬" },
  { id: "wallpaperwaves", name: "Wallpaper Waves Feed", desc: "Premium live loops and animated wallpapers", emoji: "🌊" },
  { id: "wallhaven", name: "WallHaven Feed", desc: "Premium static imagery provider", emoji: "🖼️" },
  { id: "pinterest", name: "Pinterest Feed", desc: "Aesthetic design and photography scrapers", emoji: "📌" },
];

export function WallpaperSourcePanel({ wallpaper }: WallpaperSourcePanelProps) {
  const [apiKeyInput, setApiKeyInput] = useState(wallpaper.wallhavenApiKey);
  const [showKey, setShowKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [newPinterestUrl, setNewPinterestUrl] = useState("");
  
  // AI Settings
  const [aiSearchEnabled, setAiSearchEnabled] = useState(
    typeof localStorage !== 'undefined' ? localStorage.getItem("aiSearchEnabled") === "true" : false
  );
  const [aiProvider, setAiProvider] = useState(
    typeof localStorage !== 'undefined' ? (localStorage.getItem("aiProvider") || "openai") : "openai"
  );
  const [aiBaseUrl, setAiBaseUrl] = useState(
    typeof localStorage !== 'undefined' ? (localStorage.getItem("aiBaseUrl") || "") : ""
  );
  
  // Store a separate API key for each provider so switching doesn't lose them
  const getStoredApiKey = (provider: string) => typeof localStorage !== 'undefined' ? (localStorage.getItem(`aiApiKey_${provider}`) || "") : "";
  const [aiApiKey, setAiApiKey] = useState(getStoredApiKey(aiProvider));
  
  const [aiModel, setAiModel] = useState(
    typeof localStorage !== 'undefined' ? (localStorage.getItem("aiModel") || "gpt-3.5-turbo") : "gpt-3.5-turbo"
  );
  const [showAiKey, setShowAiKey] = useState(false);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value;
    setAiProvider(newProvider);
    setAiApiKey(getStoredApiKey(newProvider));
    
    // Auto-fill default models based on provider
    if (newProvider === "openai") setAiModel("gpt-4o-mini");
    else if (newProvider === "anthropic") setAiModel("claude-3-haiku-20240307");
    else if (newProvider === "google") setAiModel("gemini-1.5-flash");
    else if (newProvider === "perplexity") setAiModel("llama-3.1-sonar-small-128k-online");
    else if (newProvider === "openrouter") setAiModel("openrouter/auto");
    else if (newProvider === "ollama") setAiModel("llama3");
    
    if (newProvider === "ollama") setAiBaseUrl("http://localhost:11434/v1");
    else setAiBaseUrl("");
  };

  const handleSaveAiSettings = () => {
    localStorage.setItem("aiSearchEnabled", String(aiSearchEnabled));
    localStorage.setItem("aiProvider", aiProvider);
    localStorage.setItem("aiBaseUrl", aiBaseUrl);
    localStorage.setItem(`aiApiKey_${aiProvider}`, aiApiKey);
    localStorage.setItem("aiModel", aiModel);
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2500);
  };
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  const handleScanWorkshop = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const dirPath = await open({
        directory: true,
        multiple: false,
        title: "Select Wallpaper Engine Workshop Folder (431960)"
      });
      if (!dirPath) return;

      setIsScanning(true);
      setScanResult(null);

      const { invoke } = await import("@tauri-apps/api/core");
      const importedCount = await invoke<number>("scan_wallpaper_engine_directory", { path: dirPath });
      
      setScanResult(`Successfully imported ${importedCount} wallpapers!`);
      // Force reload of the library tab if it is open
      window.dispatchEvent(new CustomEvent('reload-app-state'));
    } catch (e: any) {
      console.error(e);
      setScanResult(`Error: ${e}`);
    } finally {
      setIsScanning(false);
      setTimeout(() => setScanResult(null), 5000);
    }
  };

  const handleAddPinterestUrl = async () => {
    const trimmed = newPinterestUrl.trim();
    if (!trimmed) return;
    const currentList = wallpaper.pinterestUrls || [];
    if (currentList.includes(trimmed)) {
      setNewPinterestUrl("");
      return;
    }
    const newList = [...currentList, trimmed];
    await wallpaper.setPinterestUrls(newList);
    setNewPinterestUrl("");
  };

  const handleRemovePinterestUrl = async (indexToRemove: number) => {
    const currentList = wallpaper.pinterestUrls || [];
    const newList = currentList.filter((_, idx) => idx !== indexToRemove);
    await wallpaper.setPinterestUrls(newList);
  };

  const handleSaveApiKey = async () => {
    setSaveStatus("saving");
    await wallpaper.setWallhavenApiKey(apiKeyInput);
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2500);
  };

  const handleToggleSource = async (sourceId: string, enabled: boolean) => {
    let newDisabled = [...wallpaper.disabledSources];
    if (enabled) {
      // If we are enabling it, remove it from disabled list
      newDisabled = newDisabled.filter(s => s !== sourceId);
    } else {
      // If we are disabling it, add it to disabled list if not present
      if (!newDisabled.includes(sourceId)) {
        newDisabled.push(sourceId);
      }
    }
    await wallpaper.setDisabledSources(newDisabled);
  };

  return (
    <div className="panel" style={{ padding: "16px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "16px" }}>
      <div className="section-head" style={{ marginBottom: "1.5rem" }}>
        <span className="eyebrow">Sources & Integrations</span>
        <h2>Wallpaper Providers</h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* AI Semantic Search section */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "16px", background: "rgba(255, 255, 255, 0.01)", border: "1px solid rgba(255, 255, 255, 0.03)", borderRadius: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <label className="field__label" style={{ fontWeight: 600, color: "var(--accent)" }}>
                ✨ AI Semantic Search
              </label>
              <span className="field__hint" style={{ fontSize: "11px", opacity: 0.6, marginBottom: "4px", maxWidth: "80%" }}>
                Translates complex descriptions like "cozy rainy night" into optimized tags for better results. Supports OpenAI, OpenRouter, and Ollama.
              </span>
            </div>
            <input
              type="checkbox"
              checked={aiSearchEnabled}
              onChange={(e) => {
                setAiSearchEnabled(e.target.checked);
                localStorage.setItem("aiSearchEnabled", String(e.target.checked));
              }}
              style={{ width: "20px", height: "20px", accentColor: "var(--accent)", cursor: "pointer" }}
            />
          </div>
          
          {aiSearchEnabled && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                   <label style={{ fontSize: "10px", color: "var(--text-soft)" }}>AI Provider</label>
                   <select className="input input--hud" value={aiProvider} onChange={handleProviderChange} style={{ height: "36px" }}>
                     <option value="openai">OpenAI</option>
                     <option value="anthropic">Anthropic</option>
                     <option value="google">Google Gemini</option>
                     <option value="perplexity">Perplexity</option>
                     <option value="openrouter">OpenRouter</option>
                     <option value="ollama">Ollama (Local)</option>
                     <option value="antigravity">Antigravity AI (OAuth)</option>
                   </select>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                   <label style={{ fontSize: "10px", color: "var(--text-soft)" }}>Model ID</label>
                   <input type="text" className="input input--hud" value={aiModel} onChange={(e) => setAiModel(e.target.value)} placeholder="Model name" disabled={aiProvider === "antigravity"} />
                </div>
              </div>
              
              {aiProvider === "antigravity" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "10px", background: "rgba(154, 230, 0, 0.1)", borderRadius: "8px", border: "1px solid rgba(154, 230, 0, 0.3)" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-soft)", textAlign: "center", marginBottom: "4px" }}>
                    Connect to your Antigravity account to enable AI search instantly.
                  </span>
                  <button type="button" className="action-btn action-btn--primary" onClick={() => alert("Antigravity OAuth flow will open here. Currently a placeholder.")} style={{ width: "100%", background: "var(--accent)", color: "#000", fontWeight: "bold" }}>
                    Sign in with Antigravity
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                     <label style={{ fontSize: "10px", color: "var(--text-soft)" }}>API Key {aiProvider === "ollama" ? "(Optional)" : ""}</label>
                     <div style={{ display: "flex", gap: "8px", position: "relative" }}>
                       <input type={showAiKey ? "text" : "password"} className="input input--hud" value={aiApiKey} onChange={(e) => setAiApiKey(e.target.value)} placeholder="sk-..." style={{ flex: 1 }} />
                       <button type="button" className="action-btn action-btn--primary" onClick={handleSaveAiSettings} disabled={saveStatus === "saving"}>
                         {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved! ✓" : "Save AI"}
                       </button>
                     </div>
                  </div>
                  {(aiProvider === "ollama" || aiProvider === "openrouter" || aiProvider === "openai") && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                       <label style={{ fontSize: "10px", color: "var(--text-soft)" }}>Base URL Override (Optional)</label>
                       <input type="text" className="input input--hud" value={aiBaseUrl} onChange={(e) => setAiBaseUrl(e.target.value)} placeholder={aiProvider === "ollama" ? "http://localhost:11434/v1" : "https://api.openai.com/v1"} />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* WallHaven API Key section */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label className="field__label" style={{ fontWeight: 600, color: "var(--text-soft)" }}>
            Wallhaven.cc API Key
          </label>
          <div style={{ display: "flex", gap: "8px", position: "relative" }}>
            <input
              type={showKey ? "text" : "password"}
              className="input input--hud"
              placeholder="Paste your Wallhaven API Key..."
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              style={{ flex: 1, paddingRight: "40px" }}
            />
            <button
              type="button"
              className="action-btn action-btn--ghost"
              onClick={() => setShowKey(!showKey)}
              style={{
                position: "absolute",
                right: "95px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                fontSize: "12px",
                color: "rgba(255, 255, 255, 0.4)",
                cursor: "pointer",
                padding: "4px"
              }}
              title={showKey ? "Hide API Key" : "Show API Key"}
            >
              {showKey ? "Hide" : "Show"}
            </button>
            <button
              type="button"
              className="action-btn action-btn--primary"
              onClick={handleSaveApiKey}
              disabled={saveStatus === "saving"}
              style={{ minWidth: "80px", padding: "8px 16px" }}
            >
              {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved! ✓" : "Save"}
            </button>
          </div>
          <span className="field__hint" style={{ fontSize: "11px", opacity: 0.6 }}>
            Adding an API key removes rate limits and unlocks custom search capabilities.
          </span>
        </div>

        {/* Custom Pinterest URLs / Pages section */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "16px", background: "rgba(255, 255, 255, 0.01)", border: "1px solid rgba(255, 255, 255, 0.03)", borderRadius: "12px" }}>
          <label className="field__label" style={{ fontWeight: 600, color: "var(--text-soft)" }}>
            📌 Pinterest Scraper Sources
          </label>
          <span className="field__hint" style={{ fontSize: "11px", opacity: 0.6, marginBottom: "4px" }}>
            Add your favorite Pinterest boards, searches, or catalog URLs to dynamically source wallpapers from them.
          </span>

          {/* Add URL form */}
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              className="input input--hud"
              placeholder="Paste Pinterest search or board URL (e.g. https://www.pinterest.com/search/pins/?q=fantasy%20wallpaper)..."
              value={newPinterestUrl}
              onChange={(e) => setNewPinterestUrl(e.target.value)}
              style={{ flex: 1, padding: "8px 12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#fff" }}
            />
            <button
              type="button"
              className="action-btn action-btn--primary"
              onClick={handleAddPinterestUrl}
              style={{ padding: "8px 16px", borderRadius: "6px", cursor: "pointer", background: "var(--accent)", color: "#000", fontWeight: "bold", border: "none" }}
            >
              Add Page
            </button>
          </div>

          {/* List of active URLs */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
            {wallpaper.pinterestUrls && wallpaper.pinterestUrls.length > 0 ? (
              wallpaper.pinterestUrls.map((url, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.04)"
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      color: "rgba(255, 255, 255, 0.8)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "80%",
                      fontFamily: "monospace"
                    }}
                    title={url}
                  >
                    {url}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemovePinterestUrl(idx)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "rgba(255, 99, 99, 0.7)",
                      fontSize: "12px",
                      cursor: "pointer",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 99, 99, 0.1)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <span style={{ fontSize: "11px", opacity: 0.5, fontStyle: "italic", textAlign: "center", padding: "8px" }}>
                No custom Pinterest pages configured. Defaulting to general wallpaper queries.
              </span>
            )}
          </div>
        </div>

        {/* Steam Workshop Import section */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "16px", background: "rgba(255, 255, 255, 0.01)", border: "1px solid rgba(255, 255, 255, 0.03)", borderRadius: "12px" }}>
          <label className="field__label" style={{ fontWeight: 600, color: "var(--text-soft)" }}>
            🎮 Wallpaper Engine Workshop
          </label>
          <span className="field__hint" style={{ fontSize: "11px", opacity: 0.6, marginBottom: "4px" }}>
            Scan your Steam Workshop directory (e.g., steamapps/workshop/content/431960) to automatically import your Wallpaper Engine library into OpenClaw.
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="action-btn action-btn--primary"
              onClick={handleScanWorkshop}
              disabled={isScanning}
              style={{ padding: "8px 16px", borderRadius: "6px", cursor: isScanning ? "wait" : "pointer", background: "rgba(154, 230, 0, 0.2)", color: "var(--accent)", border: "1px solid rgba(154, 230, 0, 0.3)", display: "flex", alignItems: "center", gap: "8px", fontWeight: "bold" }}
            >
              {isScanning ? (
                <>
                  <span style={{ animation: "spin 1s linear infinite" }}>⏳</span>
                  Scanning Directory...
                </>
              ) : (
                <>
                  <span>📂</span>
                  Select Workshop Directory
                </>
              )}
            </button>
            {scanResult && (
              <span style={{ fontSize: "12px", color: scanResult.includes("Error") ? "#ff6b6b" : "var(--accent)", alignSelf: "center", fontWeight: "bold" }}>
                {scanResult}
              </span>
            )}
          </div>
        </div>

        {/* Wallpaper Source Selection section */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <label className="field__label" style={{ fontWeight: 600, color: "var(--text-soft)", marginBottom: "4px" }}>
            Enabled Wallpaper Sources
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {SOURCES.map((source) => {
              const isEnabled = !wallpaper.disabledSources.includes(source.id);
              return (
                <div
                  key={source.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    background: isEnabled ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.2)",
                    border: "1px solid rgba(255, 255, 255, 0.03)",
                    opacity: isEnabled ? 1 : 0.6,
                    transition: "all 0.2s ease"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "20px" }}>{source.emoji}</span>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: "13px", fontWeight: "bold", color: isEnabled ? "#fff" : "rgba(255,255,255,0.4)" }}>
                        {source.name}
                      </span>
                      <span style={{ fontSize: "10px", opacity: 0.6 }}>
                        {source.desc}
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => handleToggleSource(source.id, e.target.checked)}
                    style={{
                      width: "16px",
                      height: "16px",
                      accentColor: "var(--accent)",
                      cursor: "pointer"
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
