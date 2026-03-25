"use client";

import React from "react";

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
  parallax: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 17L12 22L2 17M2 12L12 17L22 12M12 2L2 7L12 12L22 7L12 2Z" />
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44 a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
};

export type TabState = "discover" | "library" | "direct" | "preview" | "editor" | "youtube" | "parallax" | "settings";

interface SidebarProps {
  activeTab: TabState;
  setActiveTab: (tab: TabState) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (v: boolean) => void;
}

export function Sidebar({ activeTab, setActiveTab, isSidebarCollapsed, setIsSidebarCollapsed }: SidebarProps) {
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
            title="Discover"
          >
            <div className="tab-icon">{ICONS.discover}</div>
            {!isSidebarCollapsed && <span>Discover</span>}
          </button>
          <button
            type="button"
            className={`sidebar-list__item sidebar-list__item--clickable ${activeTab === "library" ? "sidebar-list__item--active" : ""}`}
            onClick={() => setActiveTab("library")}
            title="Library"
          >
            <div className="tab-icon">{ICONS.library}</div>
            {!isSidebarCollapsed && <span>Library</span>}
          </button>
          <button
            type="button"
            className={`sidebar-list__item sidebar-list__item--clickable ${activeTab === "direct" ? "sidebar-list__item--active" : ""}`}
            onClick={() => setActiveTab("direct")}
            title="Direct Launch"
          >
            <div className="tab-icon">{ICONS.direct}</div>
            {!isSidebarCollapsed && <span>Direct Launch</span>}
          </button>
          <button
            type="button"
            className={`sidebar-list__item sidebar-list__item--clickable ${activeTab === "preview" ? "sidebar-list__item--active" : ""}`}
            onClick={() => setActiveTab("preview")}
            title="Preview Deck"
          >
            <div className="tab-icon">{ICONS.preview}</div>
            {!isSidebarCollapsed && <span>Preview Deck</span>}
          </button>
          <button
            type="button"
            className={`sidebar-list__item sidebar-list__item--clickable ${activeTab === "parallax" ? "sidebar-list__item--active" : ""}`}
            onClick={() => setActiveTab("parallax")}
            title="Parallax Engine"
          >
            <div className="tab-icon">{ICONS.parallax}</div>
            {!isSidebarCollapsed && <span>Parallax Engine</span>}
          </button>
          <button
            type="button"
            className={`sidebar-list__item sidebar-list__item--clickable ${activeTab === "editor" ? "sidebar-list__item--active" : ""}`}
            onClick={() => setActiveTab("editor")}
            title="Effects Editor"
          >
            <div className="tab-icon">✨</div>
            {!isSidebarCollapsed && <span>Effects Editor</span>}
          </button>

          <button
            type="button"
            className={`sidebar-list__item sidebar-list__item--clickable ${activeTab === "youtube" ? "sidebar-list__item--active" : ""}`}
            onClick={() => setActiveTab("youtube")}
            title="YouTube"
          >
            <div className="tab-icon">{ICONS.youtube}</div>
            {!isSidebarCollapsed && <span>YouTube</span>}
          </button>
          <button
            type="button"
            className={`sidebar-list__item sidebar-list__item--clickable ${activeTab === "settings" ? "sidebar-list__item--active" : ""}`}
            onClick={() => setActiveTab("settings")}
            title="Settings"
          >
            <div className="tab-icon">{ICONS.settings}</div>
            {!isSidebarCollapsed && <span>Settings</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
