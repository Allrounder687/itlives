"use client";

import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useNsfw } from "@/hooks/useNsfw";
import { useAddons } from "@/hooks/useAddons";
import { useTranslation } from "@/hooks/useTranslation";

const ICONS = {
  discover: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  library: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  ),
  direct: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  preview: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  youtube: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.13C5.12 19.56 12 19.56 12 19.56s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.43z" />
      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44 a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  community: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
};

export type TabState = "discover" | "library" | "editor" | "youtube" | "settings" | "addons";

interface SidebarProps {
  activeTab: TabState;
  setActiveTab: (tab: TabState) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (v: boolean) => void;
}

export const Sidebar = React.memo(function Sidebar({ activeTab, setActiveTab, isSidebarCollapsed, setIsSidebarCollapsed }: SidebarProps) {
  const { t } = useTranslation();
  const { isUnlocked, unlockNsfw } = useNsfw();
  const { isAddonInstalled } = useAddons();
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);

  const settingsClickCount = useRef(0);
  const settingsClickTimer = useRef<NodeJS.Timeout | null>(null);

  const handleSettingsClick = () => {
    setActiveTab("settings");
    
    if (!isUnlocked) {
      settingsClickCount.current += 1;
      if (settingsClickTimer.current) clearTimeout(settingsClickTimer.current);
      
      settingsClickTimer.current = setTimeout(() => {
        settingsClickCount.current = 0;
      }, 1000); // 1 second window for triple click
      
      if (settingsClickCount.current >= 3) {
        settingsClickCount.current = 0;
        setShowPinModal(true);
      }
    }
  };

  return (
    <aside className={`sidebar panel ${isSidebarCollapsed ? "sidebar--collapsed" : ""}`}>
      <div className="brand-block">
        <button
          type="button"
          className="brand-mark brand-mark--clickable"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <div className="apps-grid">
            <div /> <div />
            <div /> <div />
          </div>
        </button>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-list">
          <button
            type="button"
            className={`sidebar-list__item sidebar-list__item--clickable ${activeTab === "discover" ? "sidebar-list__item--active" : ""}`}
            onClick={() => setActiveTab("discover")}
            title={t("discover")}
          >
            <div className="tab-icon">{ICONS.discover}</div>
            <span>{t("discover")}</span>
          </button>
          <button
            type="button"
            className={`sidebar-list__item sidebar-list__item--clickable ${activeTab === "library" ? "sidebar-list__item--active" : ""}`}
            onClick={() => setActiveTab("library")}
            title={t("library")}
          >
            <div className="tab-icon">{ICONS.library}</div>
            <span>{t("library")}</span>
          </button>

          <button
            type="button"
            className={`sidebar-list__item sidebar-list__item--clickable ${activeTab === "editor" ? "sidebar-list__item--active" : ""}`}
            onClick={() => setActiveTab("editor")}
            title={t("editor")}
          >
            <div className="tab-icon">✨</div>
            <span>{t("editor")}</span>
          </button>

          {isAddonInstalled("youtube-dl") && (
            <button
              type="button"
              className={`sidebar-list__item sidebar-list__item--clickable ${activeTab === "youtube" ? "sidebar-list__item--active" : ""}`}
              onClick={() => setActiveTab("youtube")}
              title={t("youtube")}
            >
              <div className="tab-icon">{ICONS.youtube}</div>
              <span>{t("youtube")}</span>
            </button>
          )}


          <button
            type="button"
            className={`sidebar-list__item sidebar-list__item--clickable ${activeTab === "addons" ? "sidebar-list__item--active" : ""}`}
            onClick={() => setActiveTab("addons")}
            title={t("addons")}
          >
            <div className="tab-icon">📦</div>
            <span>{t("addons")}</span>
          </button>
          <button
            type="button"
            className={`sidebar-list__item sidebar-list__item--clickable ${activeTab === "settings" ? "sidebar-list__item--active" : ""}`}
            onClick={handleSettingsClick}
            title={t("settings")}
          >
            <div className="tab-icon">{ICONS.settings}</div>
            <span>{t("settings")}</span>
          </button>
        </div>
      </div>

      <div className="sidebar-section" style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button
          type="button"
          className="sidebar-list__item sidebar-list__item--clickable"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          title={isSidebarCollapsed ? t("expand") : t("collapse")}
          style={{ justifyContent: isSidebarCollapsed ? 'center' : 'flex-start' }}
        >
          <div className="tab-icon">
            {isSidebarCollapsed ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            )}
          </div>
          <span>{isSidebarCollapsed ? t("expand") : t("collapse")}</span>
        </button>
      </div>

      {showPinModal && typeof document !== "undefined" && createPortal(
        <div className="modal-overlay" style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999999
        }}>

          <div className="panel" style={{ padding: "32px", maxWidth: "340px", width: "100%", textAlign: "center", border: "1px solid rgba(255,107,107,0.3)", boxShadow: "0 20px 40px rgba(0,0,0,0.8)" }}>
            <div style={{ marginBottom: "20px" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 8px rgba(154,230,0,0.5))" }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <h3 style={{ marginBottom: "8px", color: "#fff", letterSpacing: "1px" }}>Restricted Access</h3>
            <p style={{ fontSize: "12px", color: "var(--text-soft)", marginBottom: "24px" }}>
              Enter PIN to unlock sensitive content and settings.
            </p>
            <input 
              type="password" 
              className="input input--hud" 
              style={{ width: "100%", textAlign: "center", letterSpacing: "12px", fontSize: "28px", marginBottom: "16px", padding: "12px", borderRadius: "8px", background: "rgba(0,0,0,0.5)", border: pinError ? "1px solid #ff6b6b" : "1px solid rgba(255,255,255,0.1)" }}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setPinError(false);
              }}
              autoFocus
              maxLength={4}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (pin === "3747") {
                    unlockNsfw();
                    setShowPinModal(false);
                    setPin("");
                  } else {
                    setPinError(true);
                    setPin("");
                  }
                }
                if (e.key === "Escape") {
                  setShowPinModal(false);
                  setPin("");
                  setPinError(false);
                }
              }}
            />
            {pinError && <div style={{ color: "#ff6b6b", fontSize: "12px", marginBottom: "16px", animation: "shake 0.4s" }}>Incorrect PIN. Access Denied.</div>}
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: pinError ? "0" : "16px" }}>
              <button className="action-btn action-btn--ghost" style={{ flex: 1 }} onClick={() => { setShowPinModal(false); setPin(""); setPinError(false); }}>Cancel</button>
              <button className="action-btn action-btn--primary" style={{ flex: 1 }} onClick={() => {
                if (pin === "3747") {
                  unlockNsfw();
                  setShowPinModal(false);
                  setPin("");
                } else {
                  setPinError(true);
                  setPin("");
                }
              }}>Unlock</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </aside>
  );
});
