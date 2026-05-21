"use client";

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export function DependencyChecker() {
  const [missing, setMissing] = useState<string[]>([]);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    check();
  }, []);

  async function check() {
    try {
      const result = await invoke<string[]>("check_dependencies");
      setMissing(result);
    } catch (e) {
      console.error("Failed to check dependencies", e);
    }
  }

  async function handleInstall() {
    setIsInstalling(true);
    setInstallError(null);
    try {
      await invoke("install_mpv");
      // Re-check after install
      const result = await invoke<string[]>("check_dependencies");
      setMissing(result);
      if (result.length === 0) {
        setIsDone(true);
      }
    } catch (e: any) {
      setInstallError(e.toString());
    } finally {
      setIsInstalling(false);
    }
  }

  if (missing.length === 0 && !isDone) return null;

  return (
    <div className="dependency-banner" style={{
      background: "linear-gradient(90deg, #1a1a1a 0%, #0d0d0d 100%)",
      border: "1px solid var(--accent)",
      borderRadius: "16px",
      padding: "20px",
      margin: "1rem 0",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "24px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 16px var(--accent-soft)",
      animation: "slide-down 0.5s cubic-bezier(0.16, 1, 0.3, 1)"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ 
          width: "48px", height: "48px", borderRadius: "12px", 
          background: "var(--accent-soft)", display: "grid", placeItems: "center",
          fontSize: "24px"
        }}>
          {isDone ? "✅" : "⚠️"}
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: "16px" }}>
            {isDone ? "System Ready" : "Missing Engine: MPV Player"}
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-soft)" }}>
            {isDone 
              ? "The wallpaper engine has been successfully configured." 
              : "We need mpv to render video wallpapers on your desktop."}
          </p>
          {installError && (
            <p style={{ margin: "8px 0 0", fontSize: "12px", color: "var(--danger)" }}>
              Error: {installError}
            </p>
          )}
        </div>
      </div>

      {!isDone && (
        <button 
          className="action-btn action-btn--primary" 
          disabled={isInstalling}
          onClick={handleInstall}
          style={{ minWidth: "160px" }}
        >
          {isInstalling ? "Installing..." : "Auto-Install Engine"}
        </button>
      )}
      
      {isDone && (
        <button 
          className="mini-btn" 
          onClick={() => setIsDone(false)}
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
