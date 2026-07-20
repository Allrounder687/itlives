"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Monitor, 
  Volume2, 
  FolderOpen, 
  Play, 
  Pause, 
  Laptop, 
  Activity, 
  ShieldAlert, 
  FileText, 
  Settings, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Image, 
  MousePointer, 
  Cpu, 
  Globe, 
  Music, 
  Tv, 
  Clock, 
  Lock, 
  ExternalLink,
  Eye,
  Sliders,
  Folder,
  Compass,
  CheckCircle,
  AlertCircle,
  Search,
  Power
} from "lucide-react";
import { ThemeSelector } from "./ThemeSelector";
import { WallpaperSourcePanel } from "./WallpaperSourcePanel";
import { QueuePanel } from "./QueuePanel";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "@/hooks/useTranslation";

interface SettingsPanelProps {
  wallpaper: any; // Context hook from useWallpaper
}

type SubTab = "general" | "performance" | "wallpaper" | "screensaver" | "system" | "accounts";

// Reusable Custom Styled Dropdown Selector Component
interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (val: string) => void;
}

function CustomSelect({ value, options, onChange }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(opt => opt.value === value) || options[0];

  useEffect(() => {
    if (!isOpen) return;
    const handleClose = () => setIsOpen(false);
    document.addEventListener("click", handleClose);
    return () => document.removeEventListener("click", handleClose);
  }, [isOpen]);

  return (
    <div className="custom-select-container">
      <button 
        type="button"
        className="custom-select-trigger"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
      >
        <span>{selectedOption?.label}</span>
        <span className={`custom-select-arrow ${isOpen ? "open" : ""}`}>▼</span>
      </button>
      {isOpen && (
        <ul className="custom-select-options">
          {options.map((opt) => (
            <li 
              key={opt.value}
              className={`custom-select-option ${opt.value === value ? "selected" : ""}`}
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SettingsPanel({ wallpaper }: SettingsPanelProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SubTab>("general");
  const [searchQuery, setSearchQuery] = useState("");
  const settingsContainerRef = useRef<HTMLDivElement>(null);

  // --- LOCALPERSISTED FRONTEND ONLY STATES ---
  const [uiAnimations, setUiAnimations] = useState(true);
  const [language, setLanguage] = useState("Same as System");
  const [audioOutput, setAudioOutput] = useState("All screen(s)");
  const [audioFocusedOnly, setAudioFocusedOnly] = useState(true);
  const [wallpaperDir, setWallpaperDir] = useState("C:\\Users\\Achie\\AppData\\Local\\Lively Wallpaper\\Library");

  // App Rules Local State (UI rendering only, saved in localStorage)
  const [perfAppRules, setPerfAppRules] = useState<string[]>([]);
  const [newAppRule, setNewAppRule] = useState("");
  const [showAppRules, setShowAppRules] = useState(false);
  const [showPlaybackOrder, setShowPlaybackOrder] = useState(false);

  // Wallpaper Options local state
  const [wpDesktopPicture, setWpDesktopPicture] = useState(false);
  const [wpChooseFit, setWpChooseFit] = useState("Fill");
  const [wpInput, setWpInput] = useState("Mouse");
  const [wpMouseInteractionFocused, setWpMouseInteractionFocused] = useState(true);
  const [pluginVideoPlayer, setPluginVideoPlayer] = useState("mpv");
  const [pluginGpuDecode, setPluginGpuDecode] = useState(true);
  const [pluginWindowsColors, setPluginWindowsColors] = useState(false);
  const [pluginWebBrowser, setPluginWebBrowser] = useState("WebView2");
  const [pluginDiskCache, setPluginDiskCache] = useState(false);
  const [pluginDebugPort, setPluginDebugPort] = useState(false);
  const [pluginDebugPortVal, setPluginDebugPortVal] = useState("8080");
  const [musicAudioDevice, setMusicAudioDevice] = useState("Default");
  const [musicAppExclusions, setMusicAppExclusions] = useState<string[]>([]);
  const [newExclusion, setNewExclusion] = useState("");
  const [showExclusions, setShowExclusions] = useState(false);
  const [showSourcesPanel, setShowSourcesPanel] = useState(false);

  // Screensaver Options local state
  const [saverInactivity, setSaverInactivity] = useState("Off");
  const [saverOnResumeLogon, setSaverOnResumeLogon] = useState(false);
  const [saverFadeToBlack, setSaverFadeToBlack] = useState(true);
  const [saverVolume, setSaverVolume] = useState(50);

  // System local state
  const [systemTaskbarTheme, setSystemTaskbarTheme] = useState("Off");
  const [devDebugEnabled, setDevDebugEnabled] = useState(false);
  const [logStatus, setLogStatus] = useState<string | null>(null);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [currentAppVersion, setCurrentAppVersion] = useState<string>("");

  // Updater states
  const [updateStatus, setUpdateStatus] = useState<string>("");
  const [updateVersion, setUpdateVersion] = useState("0.1.1");
  const [updateNotes, setUpdateNotes] = useState("Initial update");
  const [updateKeyPassword, setUpdateKeyPassword] = useState("openclaw");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);  // Hydrate local states on mount
  useEffect(() => {
    setUiAnimations(localStorage.getItem("settings_ui_animations") !== "false");
    setLanguage(localStorage.getItem("settings_language") || "Same as System");
    setAudioOutput(localStorage.getItem("settings_audio_output") || "All screen(s)");
    setAudioFocusedOnly(localStorage.getItem("settings_audio_focused_only") !== "false");
    setWallpaperDir(localStorage.getItem("settings_wallpaper_dir") || "C:\\Users\\Achie\\AppData\\Local\\Lively Wallpaper\\Library");

    try {
      const savedRules = localStorage.getItem("settings_perf_app_rules");
      if (savedRules) setPerfAppRules(JSON.parse(savedRules));
    } catch (e) { console.error(e); }

    // Wallpaper
    setWpDesktopPicture(localStorage.getItem("settings_wp_desktop_picture") === "true");
    setWpChooseFit(localStorage.getItem("settings_wp_choose_fit") || "Fill");
    setWpInput(localStorage.getItem("settings_wp_input") || "Mouse");
    setWpMouseInteractionFocused(localStorage.getItem("settings_wp_mouse_interaction_focused") !== "false");
    setPluginVideoPlayer(localStorage.getItem("settings_plugin_video_player") || "mpv");
    setPluginGpuDecode(localStorage.getItem("settings_plugin_gpu_decode") !== "false");
    setPluginWindowsColors(localStorage.getItem("settings_plugin_windows_colors") === "true");
    setPluginWebBrowser(localStorage.getItem("settings_plugin_web_browser") || "WebView2");
    setPluginDiskCache(localStorage.getItem("settings_plugin_disk_cache") === "true");
    setPluginDebugPort(localStorage.getItem("settings_plugin_debug_port") === "true");
    setPluginDebugPortVal(localStorage.getItem("settings_plugin_debug_port_val") || "8080");
    setMusicAudioDevice(localStorage.getItem("settings_music_audio_device") || "Default");

    try {
      const savedExclusions = localStorage.getItem("settings_music_app_exclusions");
      if (savedExclusions) setMusicAppExclusions(JSON.parse(savedExclusions));
    } catch (e) { console.error(e); }

    // Screensaver
    setSaverInactivity(localStorage.getItem("settings_saver_inactivity") || "Off");
    setSaverOnResumeLogon(localStorage.getItem("settings_saver_on_resume_logon") === "true");
    setSaverFadeToBlack(localStorage.getItem("settings_saver_fade_to_black") !== "false");
    setSaverVolume(Number(localStorage.getItem("settings_saver_volume") || "50"));

    // System
    setSystemTaskbarTheme(localStorage.getItem("settings_system_taskbar_theme") || "Off");
    setDevDebugEnabled(localStorage.getItem("settings_dev_debug_enabled") === "true");

    // Initialize Autostart
    import('@tauri-apps/plugin-autostart').then(({ isEnabled }) => {
      isEnabled().then(setAutostartEnabled).catch(console.error);
    }).catch(console.error);

    // Get App Version
    import('@tauri-apps/api/app').then(({ getVersion }) => {
      getVersion().then(setCurrentAppVersion).catch(console.error);
    }).catch(console.error);
  }, []);

  // --- SETTER FOR RUST BACKEND PERFORMANCE CONFIGURATION ---
  const updatePerfConfig = (updates: {
    fullscreen?: string;
    focused?: string;
    battery?: string;
    batterySaver?: string;
    remoteDesktop?: string;
    restartLockScreen?: boolean;
    displayPauseRule?: string;
    pauseAlgorithm?: string;
  }) => {
    const fs = updates.fullscreen !== undefined ? updates.fullscreen : (wallpaper.perfFullscreen || "pause");
    const fc = updates.focused !== undefined ? updates.focused : (wallpaper.perfFocused || "play");
    const bat = updates.battery !== undefined ? updates.battery : (wallpaper.perfBattery || "pause");
    const bs = updates.batterySaver !== undefined ? updates.batterySaver : (wallpaper.perfBatterySaver || "pause");
    const rd = updates.remoteDesktop !== undefined ? updates.remoteDesktop : (wallpaper.perfRemoteDesktop || "pause");
    const rls = updates.restartLockScreen !== undefined ? updates.restartLockScreen : (!!wallpaper.perfRestartLockScreen);
    const dpr = updates.displayPauseRule !== undefined ? updates.displayPauseRule : (wallpaper.perfDisplayPauseRule || "Per screen");
    const pa = updates.pauseAlgorithm !== undefined ? updates.pauseAlgorithm : (wallpaper.perfPauseAlgorithm || "Grid");

    wallpaper.setPerfConfig(fs, fc, bat, bs, rd, rls, dpr, pa);
  };

  // --- BROWSE WALLPAPER DIRECTORY ---
  const handleBrowseWallpaperDir = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true, multiple: false, title: "Select Wallpaper Directory" });
      if (typeof selected === "string" && selected) {
        setWallpaperDir(selected);
        localStorage.setItem("settings_wallpaper_dir", selected);
      }
    } catch (e) {
      console.error("Failed to pick directory", e);
    }
  };

  // --- TASKBAR THEME CHANGE CONTROLLER ---
  const handleTaskbarThemeChange = async (theme: string) => {
    setSystemTaskbarTheme(theme);
    localStorage.setItem("settings_system_taskbar_theme", theme);
    try {
      if (theme === "Off") {
        await invoke("set_taskbar_state", { enableBlur: false, useAcrylic: false });
      } else if (theme === "Clear" || theme === "Blur") {
        await invoke("set_taskbar_state", { enableBlur: true, useAcrylic: false });
      } else if (theme === "Acrylic") {
        await invoke("set_taskbar_state", { enableBlur: true, useAcrylic: true });
      }
    } catch (e) {
      console.error("Failed to invoke set_taskbar_state", e);
    }
  };

  // --- APP RULES LIST HANDLERS ---
  const handleAddAppRule = () => {
    const trimmed = newAppRule.trim();
    if (!trimmed) return;
    if (perfAppRules.includes(trimmed)) {
      setNewAppRule("");
      return;
    }
    const updated = [...perfAppRules, trimmed];
    setPerfAppRules(updated);
    localStorage.setItem("settings_perf_app_rules", JSON.stringify(updated));
    setNewAppRule("");
  };

  const handleRemoveAppRule = (app: string) => {
    const updated = perfAppRules.filter(r => r !== app);
    setPerfAppRules(updated);
    localStorage.setItem("settings_perf_app_rules", JSON.stringify(updated));
  };

  // --- MUSIC EXCLUSIONS LIST HANDLERS ---
  const handleAddExclusion = () => {
    const trimmed = newExclusion.trim();
    if (!trimmed) return;
    if (musicAppExclusions.includes(trimmed)) {
      setNewExclusion("");
      return;
    }
    const updated = [...musicAppExclusions, trimmed];
    setMusicAppExclusions(updated);
    localStorage.setItem("settings_music_app_exclusions", JSON.stringify(updated));
    setNewExclusion("");
  };

  const handleRemoveExclusion = (app: string) => {
    const updated = musicAppExclusions.filter(e => e !== app);
    setMusicAppExclusions(updated);
    localStorage.setItem("settings_music_app_exclusions", JSON.stringify(updated));
  };

  // --- CREATE LOG FILE ---
  const handleCreateLogFile = async () => {
    try {
      setLogStatus("Creating log file...");
      await invoke("export_logs");
      setLogStatus("Logs exported to Desktop.");
      setTimeout(() => setLogStatus(null), 3000);
    } catch (e) {
      setLogStatus(`Error: ${e}`);
    }
  };

  const handleCheckUpdates = async () => {
    try {
      setIsCheckingUpdate(true);
      setUpdateStatus("Checking for updates...");
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        setUpdateStatus(`Update ${update.version} found! Downloading...`);
        let downloaded = 0;
        let contentLength = 0;
        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              contentLength = event.data.contentLength || 0;
              break;
            case 'Progress':
              downloaded += event.data.chunkLength;
              setUpdateStatus(`Downloading: ${Math.round((downloaded / contentLength) * 100)}%`);
              break;
            case 'Finished':
              setUpdateStatus("Update installed. Restarting...");
              break;
          }
        });
        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
      } else {
        setUpdateStatus("App is up to date.");
        setTimeout(() => setUpdateStatus(""), 3000);
      }
    } catch (e) {
      console.error(e);
      setUpdateStatus(`Update check failed: ${e}`);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handlePublishUpdate = async () => {
    try {
      const { ask } = await import('@tauri-apps/plugin-dialog');
      const confirmed = await ask("Are you sure you want to build and publish a new application update? This will take several minutes and freeze the backend.", {
        title: "Confirm Update Publish",
        kind: "warning"
      });
      if (!confirmed) return;
      
      setIsPublishing(true);
      setUpdateStatus("Bumping version and building...");
      await invoke("publish_app_update", {
        version: updateVersion,
        releaseNotes: updateNotes,
        privateKeyPassword: updateKeyPassword
      });
      setUpdateStatus("Update successfully published to GitHub!");
      setTimeout(() => setUpdateStatus(""), 5000);
    } catch (e) {
      console.error(e);
      setUpdateStatus(`Failed to publish: ${e}`);
    } finally {
      setIsPublishing(false);
    }
  };

  // --- LAUNCH WINDOWS SCREENSAVER SETTINGS ---
  const handleLaunchScreensaverSettings = async () => {
    try {
      await invoke("launch_external_app", { path: "control.exe" });
    } catch (e) {
      console.error(e);
    }
  };
  // --- UNIVERSAL SEARCH EFFECT ---
  useEffect(() => {
    if (!settingsContainerRef.current) return;
    
    const container = settingsContainerRef.current;
    const cards = container.querySelectorAll('.settings-card');
    const headers = container.querySelectorAll('.settings-section-header, .settings-danger-zone');
    
    if (!searchQuery.trim()) {
      cards.forEach(card => (card as HTMLElement).style.display = '');
      headers.forEach(h => (h as HTMLElement).style.display = '');
      return;
    }
    
    const q = searchQuery.toLowerCase();
    
    // Hide headers during search for a flat list
    headers.forEach(h => (h as HTMLElement).style.display = 'none');
    
    cards.forEach(card => {
      const text = card.textContent?.toLowerCase() || '';
      if (text.includes(q)) {
        (card as HTMLElement).style.display = '';
      } else {
        (card as HTMLElement).style.display = 'none';
      }
    });
  }, [searchQuery, activeTab]);

  return (
    <section className="settings-dashboard">
      {/* 1. Left Sidebar Navigation Panel */}
      <div className="settings-sidebar-nav">
        <div className="settings-sidebar-header">
          <span>Application</span>
          <h2>Preferences</h2>
        </div>
        
        <div style={{ padding: "0 16px 20px 16px" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={16} style={{ position: "absolute", left: "14px", color: "var(--accent)" }} />
            <input 
              type="text" 
              placeholder="Search settings..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ 
                width: "100%", 
                background: "rgba(0,0,0,0.3)", 
                border: "1px solid var(--accent)", 
                borderRadius: "8px", 
                padding: "10px 12px 10px 38px", 
                color: "white", 
                fontSize: "14px",
                fontWeight: "500",
                outline: "none",
                boxShadow: "0 0 10px rgba(162, 255, 0, 0.1)"
              }} 
            />
          </div>
        </div>
        
        <button 
          type="button" 
          className={`settings-tab-btn ${activeTab === "general" ? "active" : ""}`}
          onClick={() => setActiveTab("general")}
        >
          <span className="settings-tab-icon"><Sliders size={18} /></span>
          <span>{t("general")}</span>
        </button>

        <button 
          type="button" 
          className={`settings-tab-btn ${activeTab === "performance" ? "active" : ""}`}
          onClick={() => setActiveTab("performance")}
        >
          <span className="settings-tab-icon"><Activity size={18} /></span>
          <span>{t("performance")}</span>
        </button>

        <button 
          type="button" 
          className={`settings-tab-btn ${activeTab === "wallpaper" ? "active" : ""}`}
          onClick={() => setActiveTab("wallpaper")}
        >
          <span className="settings-tab-icon"><Image size={18} /></span>
          <span>{t("wallpaper")}</span>
        </button>

        <button 
          type="button" 
          className={`settings-tab-btn ${activeTab === "screensaver" ? "active" : ""}`}
          onClick={() => setActiveTab("screensaver")}
        >
          <span className="settings-tab-icon"><Clock size={18} /></span>
          <span>{t("screensaver")}</span>
        </button>

        <button 
          type="button" 
          className={`settings-tab-btn ${activeTab === "system" ? "active" : ""}`}
          onClick={() => setActiveTab("system")}
        >
          <span className="settings-tab-icon"><Settings size={18} /></span>
          <span>{t("system")}</span>
        </button>

        <button 
          type="button" 
          className={`settings-tab-btn ${activeTab === "accounts" ? "active" : ""}`}
          onClick={() => setActiveTab("accounts")}
        >
          <span className="settings-tab-icon"><Lock size={18} /></span>
          <span>{t("accounts") || "Accounts"}</span>
        </button>
      </div>

      {/* 2. Right Workspace Content Panel */}
      <div className="settings-panel-body" ref={settingsContainerRef}>

        {/* ================= GENERAL PAGE ================= */}
        {(activeTab === "general" || searchQuery) && (
          <>
            <div>
              <span className="settings-section-title">Appearance & behavior</span>
              <div className="settings-grid-layout">
                {/* Start with Windows */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Monitor size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">Start with Windows</span>
                      <span className="settings-card-desc">Lively needs to run in the background for wallpaper playback.</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <label className="switch-label">
                      <input 
                        type="checkbox" 
                        checked={wallpaper.autostartEnabled} 
                        onChange={(e) => wallpaper.setAutostartEnabled(e.target.checked)}
                      />
                      <span className="switch-slider"></span>
                    </label>
                  </div>
                </div>

                {/* System-tray Icon */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Tv size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">System-tray Icon</span>
                      <span className="settings-card-desc">System-tray icon visibility. Lively will continue to run with the icon hidden.</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <label className="switch-label">
                      <input 
                        type="checkbox" 
                        checked={wallpaper.closeToTray} 
                        onChange={(e) => wallpaper.setWindowBehavior(e.target.checked, wallpaper.minimizeToTray)}
                      />
                      <span className="switch-slider"></span>
                    </label>
                  </div>
                </div>

                {/* User Interface Animations */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Activity size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">User interface</span>
                      <span className="settings-card-desc">User interface effects and animations.</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <label className="switch-label">
                      <input 
                        type="checkbox" 
                        checked={uiAnimations} 
                        onChange={(e) => {
                          setUiAnimations(e.target.checked);
                          localStorage.setItem("settings_ui_animations", String(e.target.checked));
                        }}
                      />
                      <span className="switch-slider"></span>
                    </label>
                  </div>
                </div>

                {/* Language Selection */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Globe size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">{t("language")}</span>
                      <span className="settings-card-desc">{t("languageDesc")}</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <CustomSelect 
                      value={language}
                      onChange={(val) => {
                        setLanguage(val);
                        localStorage.setItem("settings_language", val);
                        window.dispatchEvent(new Event("settings-language-changed"));
                      }}
                      options={[
                        { value: "Same as System", label: "Same as System" },
                        { value: "English", label: "English" },
                        { value: "Español", label: "Español" },
                        { value: "Français", label: "Français" },
                        { value: "Deutsch", label: "Deutsch" },
                        { value: "日本語", label: "日本語" },
                        { value: "简体中文", label: "简体中文" },
                        { value: "Русский", label: "Русский" },
                        { value: "Português", label: "Português" },
                        { value: "한국어", label: "한국어" },
                        { value: "Italiano", label: "Italiano" },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Themes */}
            <div className="settings-card" style={{ maxWidth: "100%" }}>
              <div className="settings-card-top" style={{ marginBottom: "4px" }}>
                <div className="settings-card-icon-container"><Sliders size={18} /></div>
                <div className="settings-card-info">
                  <span className="settings-card-title">Workspace Color Theme</span>
                  <span className="settings-card-desc">Customize the user interface accent color and glow effects.</span>
                </div>
              </div>
              <ThemeSelector currentTheme={wallpaper.theme} onThemeChange={wallpaper.setTheme} />
            </div>

            {/* Audio Section */}
            <div>
              <span className="settings-section-title">Audio</span>
              <div className="settings-grid-layout">
                {/* Volume */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Volume2 size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">Volume</span>
                      <span className="settings-card-desc">Volume level of all wallpapers.</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <div className="settings-slider-container">
                      <input 
                        type="range"
                        className="settings-slider"
                        min={0}
                        max={100}
                        value={wallpaper.volumePercent}
                        onChange={(e) => wallpaper.setVolumePercent(parseInt(e.target.value))}
                      />
                      <span className="settings-slider-value">{wallpaper.volumePercent}%</span>
                    </div>
                  </div>
                </div>

                {/* Audio Output device */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Tv size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">Output</span>
                      <span className="settings-card-desc">Control how wallpaper audio plays across your screens.</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <CustomSelect 
                      value={audioOutput}
                      onChange={(val) => {
                        setAudioOutput(val);
                        localStorage.setItem("settings_audio_output", val);
                      }}
                      options={[
                        { value: "All screen(s)", label: "All screen(s)" },
                        { value: "Per screen", label: "Per screen" },
                        { value: "Primary monitor only", label: "Primary monitor only" },
                      ]}
                    />
                  </div>
                </div>

                {/* Play audio only when desktop is focused */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Lock size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">Play audio only when desktop is focused</span>
                      <span className="settings-card-desc">Mutes wallpaper audio when working in other applications.</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <label className="switch-label">
                      <input 
                        type="checkbox" 
                        checked={audioFocusedOnly} 
                        onChange={(e) => {
                          setAudioFocusedOnly(e.target.checked);
                          localStorage.setItem("settings_audio_focused_only", String(e.target.checked));
                        }}
                      />
                      <span className="switch-slider"></span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* File Section */}
            <div>
              <span className="settings-section-title">File</span>
              <div className="settings-card" style={{ maxWidth: "100%" }}>
                <div className="settings-card-top">
                  <div className="settings-card-icon-container"><Folder size={18} /></div>
                  <div className="settings-card-info" style={{ flex: 1 }}>
                    <span className="settings-card-title">Wallpaper Directory</span>
                    <span className="settings-card-desc">Path used to store imported wallpaper files.</span>
                    <span style={{ fontSize: "11px", color: "var(--accent)", wordBreak: "break-all", fontFamily: "monospace", marginTop: "6px" }}>
                      {wallpaperDir}
                    </span>
                  </div>
                  <button 
                    type="button" 
                    className="action-btn action-btn--secondary"
                    style={{ minHeight: "34px", padding: "0 14px", fontSize: "12px" }}
                    onClick={handleBrowseWallpaperDir}
                  >
                    Change Folder
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ================= PERFORMANCE PAGE ================= */}
        {(activeTab === "performance" || searchQuery) && (
          <>
            <div>
              <span className="settings-section-title">Wallpaper playback</span>
              <div className="settings-grid-layout">
                {/* Fullscreen Behavior */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Monitor size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">Applications fullscreen</span>
                      <span className="settings-card-desc">Set what to do when fullscreen games/applications are running.</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <div className="settings-button-group">
                      <button 
                        type="button" 
                        className={`settings-group-btn ${wallpaper.perfFullscreen === "pause" ? "active-pause" : ""}`}
                        onClick={() => updatePerfConfig({ fullscreen: "pause" })}
                      >
                        <Pause size={12} /> Pause
                      </button>
                      <button 
                        type="button" 
                        className={`settings-group-btn ${wallpaper.perfFullscreen === "play" ? "active-play" : ""}`}
                        onClick={() => updatePerfConfig({ fullscreen: "play" })}
                      >
                        <Play size={12} /> Keep Running
                      </button>
                    </div>
                  </div>
                </div>

                {/* Focused Behavior */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Activity size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">Applications focused</span>
                      <span className="settings-card-desc">Set what to do when any application is in focus.</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <div className="settings-button-group">
                      <button 
                        type="button" 
                        className={`settings-group-btn ${wallpaper.perfFocused === "pause" ? "active-pause" : ""}`}
                        onClick={() => updatePerfConfig({ focused: "pause" })}
                      >
                        <Pause size={12} /> Pause
                      </button>
                      <button 
                        type="button" 
                        className={`settings-group-btn ${wallpaper.perfFocused === "play" ? "active-play" : ""}`}
                        onClick={() => updatePerfConfig({ focused: "play" })}
                      >
                        <Play size={12} /> Keep Running
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Laptops and Power */}
            <div>
              <span className="settings-section-title">Laptops & Power</span>
              <div className="settings-grid-layout">
                {/* Battery power */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Laptop size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">When on Battery Power</span>
                      <span className="settings-card-desc">Change playback when AC power is disconnected.</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <div className="settings-button-group">
                      <button 
                        type="button" 
                        className={`settings-group-btn ${wallpaper.perfBattery === "pause" ? "active-pause" : ""}`}
                        onClick={() => updatePerfConfig({ battery: "pause" })}
                      >
                        <Pause size={12} /> Pause
                      </button>
                      <button 
                        type="button" 
                        className={`settings-group-btn ${wallpaper.perfBattery === "play" ? "active-play" : ""}`}
                        onClick={() => updatePerfConfig({ battery: "play" })}
                      >
                        <Play size={12} /> Keep Running
                      </button>
                    </div>
                  </div>
                </div>

                {/* Battery saver */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Laptop size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">When on Battery Saver</span>
                      <span className="settings-card-desc">Change playback when Windows Power Saving Mode is enabled.</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <div className="settings-button-group">
                      <button 
                        type="button" 
                        className={`settings-group-btn ${wallpaper.perfBatterySaver === "pause" ? "active-pause" : ""}`}
                        onClick={() => updatePerfConfig({ batterySaver: "pause" })}
                      >
                        <Pause size={12} /> Pause
                      </button>
                      <button 
                        type="button" 
                        className={`settings-group-btn ${wallpaper.perfBatterySaver === "play" ? "active-play" : ""}`}
                        onClick={() => updatePerfConfig({ batterySaver: "play" })}
                      >
                        <Play size={12} /> Keep Running
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance System Settings */}
            <div>
              <span className="settings-section-title">System Playback Rules</span>
              <div className="settings-grid-layout">
                {/* Remote Desktop */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Tv size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">When on Remote Desktop</span>
                      <span className="settings-card-desc">Change playback when running a Remote Desktop session.</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <div className="settings-button-group">
                      <button 
                        type="button" 
                        className={`settings-group-btn ${wallpaper.perfRemoteDesktop === "pause" ? "active-pause" : ""}`}
                        onClick={() => updatePerfConfig({ remoteDesktop: "pause" })}
                      >
                        <Pause size={12} /> Pause
                      </button>
                      <button 
                        type="button" 
                        className={`settings-group-btn ${wallpaper.perfRemoteDesktop === "play" ? "active-play" : ""}`}
                        onClick={() => updatePerfConfig({ remoteDesktop: "play" })}
                      >
                        <Play size={12} /> Keep Running
                      </button>
                    </div>
                  </div>
                </div>

                {/* Restart lock screen */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Lock size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">Restart wallpaper returning from lock screen</span>
                      <span className="settings-card-desc">Forces wallpaper refresh on desktop login.</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <label className="switch-label">
                      <input 
                        type="checkbox" 
                        checked={!!wallpaper.perfRestartLockScreen} 
                        onChange={(e) => updatePerfConfig({ restartLockScreen: e.target.checked })}
                      />
                      <span className="switch-slider"></span>
                    </label>
                  </div>
                </div>

                {/* Display pause rule */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Monitor size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">Display pause rule</span>
                      <span className="settings-card-desc">Pause wallpaper on all screens or only active screen.</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <CustomSelect 
                      value={wallpaper.perfDisplayPauseRule || "Per screen"}
                      onChange={(val) => updatePerfConfig({ displayPauseRule: val })}
                      options={[
                        { value: "Per screen", label: "Per screen" },
                        { value: "All screens", label: "All screens" },
                      ]}
                    />
                  </div>
                </div>

                {/* Pause algorithm */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Activity size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">Pause algorithm</span>
                      <span className="settings-card-desc">Wallpaper window pause algorithm configuration.</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <CustomSelect 
                      value={wallpaper.perfPauseAlgorithm || "Grid"}
                      onChange={(val) => updatePerfConfig({ pauseAlgorithm: val })}
                      options={[
                        { value: "Grid", label: "Grid" },
                        { value: "Process", label: "Process" },
                        { value: "Foreground", label: "Foreground" },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Collapsible rule grids */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Application Rules */}
              <div className="settings-collapsible">
                <div 
                  className="settings-collapsible-trigger"
                  onClick={() => setShowAppRules(!showAppRules)}
                >
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Settings size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">Application Rules</span>
                      <span className="settings-card-desc">Pause wallpaper when running these applications.</span>
                    </div>
                  </div>
                  <ChevronRight 
                    size={18} 
                    style={{ 
                      transform: showAppRules ? "rotate(90deg)" : "rotate(0deg)", 
                      transition: "transform 0.2s ease" 
                    }} 
                  />
                </div>

                {showAppRules && (
                  <div className="settings-list-container">
                    <div className="settings-list-input-row">
                      <input 
                        type="text" 
                        className="settings-list-input"
                        placeholder="Enter process name (e.g., discord.exe)..."
                        value={newAppRule}
                        onChange={(e) => setNewAppRule(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddAppRule()}
                      />
                      <button 
                        type="button" 
                        className="settings-list-add-btn"
                        onClick={handleAddAppRule}
                      >
                        Add Rule
                      </button>
                    </div>
                    <div className="settings-list-items">
                      {perfAppRules.length > 0 ? (
                        perfAppRules.map(app => (
                          <div key={app} className="settings-list-item">
                            <span className="settings-list-item-text">{app}</span>
                            <button 
                              type="button" 
                              className="settings-list-item-delete"
                              onClick={() => handleRemoveAppRule(app)}
                            >
                              Remove
                            </button>
                          </div>
                        ))
                      ) : (
                        <span style={{ fontSize: "11px", opacity: 0.5, fontStyle: "italic", padding: "4px" }}>
                          No application rules active.
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Playback rotation order */}
              <div className="settings-collapsible">
                <div 
                  className="settings-collapsible-trigger"
                  onClick={() => setShowPlaybackOrder(!showPlaybackOrder)}
                >
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Play size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">Playback Rotation & Order</span>
                      <span className="settings-card-desc">Configure the active playlist queue and timed rotation intervals.</span>
                    </div>
                  </div>
                  <ChevronRight 
                    size={18} 
                    style={{ 
                      transform: showPlaybackOrder ? "rotate(90deg)" : "rotate(0deg)", 
                      transition: "transform 0.2s ease" 
                    }} 
                  />
                </div>

                {showPlaybackOrder && (
                  <div className="settings-list-container">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginBottom: "16px", background: "rgba(0,0,0,0.25)", padding: "12px", borderRadius: "8px", border: "1px solid var(--panel-stroke)" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "12px" }}>
                        <input 
                          type="checkbox"
                          checked={wallpaper.rotationEnabled}
                          disabled={wallpaper.queue.length === 0}
                          onChange={(e) => wallpaper.setRotationConfig(e.target.checked, wallpaper.rotationIntervalSeconds)}
                          style={{ accentColor: "var(--accent)" }}
                        />
                        <span>Enable Timed Rotation</span>
                      </label>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
                        <span>Interval (seconds):</span>
                        <input 
                          className="input"
                          type="number"
                          min={30}
                          step={30}
                          value={wallpaper.rotationIntervalSeconds}
                          onChange={(e) => wallpaper.setRotationConfig(wallpaper.rotationEnabled, Number(e.target.value))}
                          style={{ width: "80px", padding: "4px 8px", borderRadius: "4px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-stroke)", color: "#fff" }}
                        />
                      </div>
                    </div>

                    <QueuePanel wallpaper={wallpaper} />
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ================= WALLPAPER PAGE ================= */}
        {(activeTab === "wallpaper" || searchQuery) && (
          <>
            <div>
              <span className="settings-section-title">Appearance & behavior</span>
              <div className="settings-grid-layout">
                {/* Desktop Picture */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Image size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">Desktop picture</span>
                      <span className="settings-card-desc">Set a static picture of animated wallpaper as desktop wallpaper.</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <label className="switch-label">
                      <input 
                        type="checkbox" 
                        checked={wpDesktopPicture} 
                        onChange={(e) => {
                          setWpDesktopPicture(e.target.checked);
                          localStorage.setItem("settings_wp_desktop_picture", String(e.target.checked));
                        }}
                      />
                      <span className="switch-slider"></span>
                    </label>
                  </div>
                </div>

                {/* Scaling fit */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Sliders size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">Choose a fit</span>
                      <span className="settings-card-desc">Wallpaper scaling and placement algorithm.</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <CustomSelect 
                      value={wpChooseFit}
                      onChange={(val) => {
                        setWpChooseFit(val);
                        localStorage.setItem("settings_wp_choose_fit", val);
                      }}
                      options={[
                        { value: "Fill", label: "Fill" },
                        { value: "Fit", label: "Fit" },
                        { value: "Stretch", label: "Stretch" },
                        { value: "Uniform", label: "Uniform" },
                      ]}
                    />
                  </div>
                </div>

                {/* Wallpaper input */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><MousePointer size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">Wallpaper input</span>
                      <span className="settings-card-desc">Select ways to interact with active wallpaper.</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <CustomSelect 
                      value={wpInput}
                      onChange={(val) => {
                        setWpInput(val);
                        localStorage.setItem("settings_wp_input", val);
                      }}
                      options={[
                        { value: "Mouse", label: "Mouse Pointer" },
                        { value: "Keyboard", label: "Keyboard" },
                        { value: "None", label: "Disabled" },
                      ]}
                    />
                  </div>
                </div>

                {/* Mouse interaction focused */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><MousePointer size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">Mouse interaction focused</span>
                      <span className="settings-card-desc">Enables wallpaper clicks even when other windows are focused.</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <label className="switch-label">
                      <input 
                        type="checkbox" 
                        checked={wpMouseInteractionFocused} 
                        onChange={(e) => {
                          setWpMouseInteractionFocused(e.target.checked);
                          localStorage.setItem("settings_wp_mouse_interaction_focused", String(e.target.checked));
                        }}
                      />
                      <span className="switch-slider"></span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Video player plugin settings */}
            <div>
              <span className="settings-section-title">Video & Browser Players</span>
              <div className="settings-grid-layout">
                {/* Video Player */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Cpu size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">Video player</span>
                      <span className="settings-card-desc">Select the player used for video wallpaper.</span>
                    </div>
                  </div>
                  <div className="settings-card-control" style={{ flexDirection: "column", gap: "12px", width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-soft)" }}>Select Engine:</span>
                      <CustomSelect 
                        value={pluginVideoPlayer}
                        onChange={(val) => {
                          setPluginVideoPlayer(val);
                          localStorage.setItem("settings_plugin_video_player", val);
                        }}
                        options={[
                          { value: "mpv", label: "mpv (Recommended)" },
                          { value: "VLC", label: "VLC" },
                        ]}
                      />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center", background: "rgba(0,0,0,0.15)", padding: "8px 10px", borderRadius: "6px" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-soft)" }}>GPU decode (Hardware Accel.)</span>
                      <label className="switch-label">
                        <input 
                          type="checkbox" 
                          checked={pluginGpuDecode} 
                          onChange={(e) => {
                            setPluginGpuDecode(e.target.checked);
                            localStorage.setItem("settings_plugin_gpu_decode", String(e.target.checked));
                          }}
                        />
                        <span className="switch-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Web Browser Player */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Globe size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">Web browser</span>
                      <span className="settings-card-desc">Select the HTML browser engine engine.</span>
                    </div>
                  </div>
                  <div className="settings-card-control" style={{ flexDirection: "column", gap: "12px", width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-soft)" }}>Select Browser:</span>
                      <CustomSelect 
                        value={pluginWebBrowser}
                        onChange={(val) => {
                          setPluginWebBrowser(val);
                          localStorage.setItem("settings_plugin_web_browser", val);
                        }}
                        options={[
                          { value: "WebView2", label: "Microsoft WebView2" },
                          { value: "CefSharp", label: "CefSharp" },
                        ]}
                      />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center", background: "rgba(0,0,0,0.15)", padding: "8px 10px", borderRadius: "6px" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-soft)" }}>Disk cache</span>
                      <label className="switch-label">
                        <input 
                          type="checkbox" 
                          checked={pluginDiskCache} 
                          onChange={(e) => {
                            setPluginDiskCache(e.target.checked);
                            localStorage.setItem("settings_plugin_disk_cache", String(e.target.checked));
                          }}
                        />
                        <span className="switch-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Music and visualizations */}
            <div>
              <span className="settings-section-title">Music Visualizations</span>
              <div className="settings-grid-layout">
                {/* Audio device selection */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Music size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">Audio device</span>
                      <span className="settings-card-desc">Select device for sound visualizing spectrum.</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <CustomSelect 
                      value={musicAudioDevice}
                      onChange={(val) => {
                        setMusicAudioDevice(val);
                        localStorage.setItem("settings_music_audio_device", val);
                      }}
                      options={[
                        { value: "Default", label: "System Default" },
                        { value: "Realtek Audio", label: "Realtek Audio Output" },
                        { value: "Digital Output", label: "Digital Audio S/PDIF" },
                      ]}
                    />
                  </div>
                </div>

                {/* Exclusions list */}
                <div className="settings-collapsible" style={{ height: "fit-content" }}>
                  <div 
                    className="settings-collapsible-trigger"
                    onClick={() => setShowExclusions(!showExclusions)}
                  >
                    <div className="settings-card-top">
                      <div className="settings-card-icon-container"><Activity size={18} /></div>
                      <div className="settings-card-info">
                        <span className="settings-card-title">App exclusion</span>
                        <span className="settings-card-desc">Select apps to exclude from showing music details.</span>
                      </div>
                    </div>
                    <ChevronRight 
                      size={18} 
                      style={{ 
                        transform: showExclusions ? "rotate(90deg)" : "rotate(0deg)", 
                        transition: "transform 0.2s ease" 
                      }} 
                    />
                  </div>

                  {showExclusions && (
                    <div className="settings-list-container">
                      <div className="settings-list-input-row">
                        <input 
                          type="text" 
                          className="settings-list-input"
                          placeholder="Enter process (e.g., spotify.exe)..."
                          value={newExclusion}
                          onChange={(e) => setNewExclusion(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddExclusion()}
                        />
                        <button 
                          type="button" 
                          className="settings-list-add-btn"
                          onClick={handleAddExclusion}
                        >
                          Exclude
                        </button>
                      </div>
                      <div className="settings-list-items">
                        {musicAppExclusions.length > 0 ? (
                          musicAppExclusions.map(app => (
                            <div key={app} className="settings-list-item">
                              <span className="settings-list-item-text">{app}</span>
                              <button 
                                type="button" 
                                className="settings-list-item-delete"
                                onClick={() => handleRemoveExclusion(app)}
                              >
                                Remove
                              </button>
                            </div>
                          ))
                        ) : (
                          <span style={{ fontSize: "11px", opacity: 0.5, fontStyle: "italic", padding: "4px" }}>
                            No exclusions defined.
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sources section */}
            <div className="settings-collapsible">
              <div 
                className="settings-collapsible-trigger"
                onClick={() => setShowSourcesPanel(!showSourcesPanel)}
              >
                <div className="settings-card-top">
                  <div className="settings-card-icon-container"><Compass size={18} /></div>
                  <div className="settings-card-info">
                    <span className="settings-card-title">Enabled Scrapers & Feed Sources</span>
                    <span className="settings-card-desc">Manage Pinterest scraper URLs, Steam Workshop imports, and Wallhaven keys.</span>
                  </div>
                </div>
                <ChevronRight 
                  size={18} 
                  style={{ 
                    transform: showSourcesPanel ? "rotate(90deg)" : "rotate(0deg)", 
                    transition: "transform 0.2s ease" 
                  }} 
                />
              </div>

              {showSourcesPanel && (
                <div className="settings-list-container">
                  <WallpaperSourcePanel wallpaper={wallpaper} />
                </div>
              )}
            </div>
          </>
        )}

        {/* ================= SCREENSAVER PAGE ================= */}
        {(activeTab === "screensaver" || searchQuery) && (
          <>
            <div>
              <span className="settings-section-title">Appearance & behavior</span>
              <div className="settings-grid-layout">
                {/* Screensaver Inactivity trigger */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Clock size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">Inactivity Screensaver</span>
                      <span className="settings-card-desc">After the inactivity period use the current wallpaper as screensaver.</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <CustomSelect 
                      value={saverInactivity}
                      onChange={(val) => {
                        setSaverInactivity(val);
                        localStorage.setItem("settings_saver_inactivity", val);
                      }}
                      options={[
                        { value: "Off", label: "Off / Disabled" },
                        { value: "5 minutes", label: "5 minutes" },
                        { value: "10 minutes", label: "10 minutes" },
                        { value: "15 minutes", label: "15 minutes" },
                        { value: "30 minutes", label: "30 minutes" },
                      ]}
                    />
                  </div>
                </div>

                {/* Logon lock screen */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Lock size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">Logon lock screen</span>
                      <span className="settings-card-desc">Locks Windows when dismissing the screensaver.</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <label className="switch-label">
                      <input 
                        type="checkbox" 
                        checked={saverOnResumeLogon} 
                        onChange={(e) => {
                          setSaverOnResumeLogon(e.target.checked);
                          localStorage.setItem("settings_saver_on_resume_logon", String(e.target.checked));
                        }}
                      />
                      <span className="switch-slider"></span>
                    </label>
                  </div>
                </div>

                {/* Fade to black */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Eye size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">Fade to black</span>
                      <span className="settings-card-desc">Fades screen to black before screensaver begins.</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <label className="switch-label">
                      <input 
                        type="checkbox" 
                        checked={saverFadeToBlack} 
                        onChange={(e) => {
                          setSaverFadeToBlack(e.target.checked);
                          localStorage.setItem("settings_saver_fade_to_black", String(e.target.checked));
                        }}
                      />
                      <span className="switch-slider"></span>
                    </label>
                  </div>
                </div>

                {/* Volume */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Volume2 size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">Volume</span>
                      <span className="settings-card-desc">Volume level of screensaver wallpapers.</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <div className="settings-slider-container">
                      <input 
                        type="range"
                        className="settings-slider"
                        min={0}
                        max={100}
                        value={saverVolume}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setSaverVolume(val);
                          localStorage.setItem("settings_saver_volume", String(val));
                        }}
                      />
                      <span className="settings-slider-value">{saverVolume}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Screensaver Windows System configurations */}
            <div>
              <span className="settings-section-title">System Configuration</span>
              <div className="settings-card" style={{ maxWidth: "100%" }}>
                <div className="settings-card-top">
                  <div className="settings-card-icon-container"><ExternalLink size={18} /></div>
                  <div className="settings-card-info" style={{ flex: 1 }}>
                    <span className="settings-card-title">Windows Screensaver Panel</span>
                    <span className="settings-card-desc">Configure screensaver options in default Windows Control Panel.</span>
                  </div>
                  <button 
                    type="button" 
                    className="action-btn action-btn--secondary"
                    onClick={handleLaunchScreensaverSettings}
                    style={{ minHeight: "34px", padding: "0 14px", fontSize: "12px" }}
                  >
                    Open Settings
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ================= SYSTEM PAGE ================= */}
        {(activeTab === "system" || searchQuery) && (
          <>
            <div>
              <span className="settings-section-title">Appearance & behavior</span>
              <div className="settings-grid-layout">
                {/* Taskbar Theme selection */}
                <div className="settings-card" style={{ gridColumn: "1 / -1" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                    <div className="settings-card-top">
                      <div className="settings-card-icon-container"><Monitor size={18} /></div>
                      <div className="settings-card-info">
                        <span className="settings-card-title">Taskbar Theme</span>
                        <span className="settings-card-desc">Change system taskbar transparency and blur appearance in real-time.</span>
                      </div>
                    </div>
                    <div className="settings-card-control">
                      <CustomSelect 
                        value={systemTaskbarTheme}
                        onChange={(val) => handleTaskbarThemeChange(val)}
                        options={[
                          { value: "Off", label: "Off (Default Windows)" },
                          { value: "Clear", label: "Clear (Transparent)" },
                          { value: "Blur", label: "Blur (Glass Effect)" },
                          { value: "Acrylic", label: "Acrylic (Muted Glow)" },
                        ]}
                      />
                    </div>
                  </div>
                  {/* Re-designed operational status banner (Not on hold!) */}
                  <div className="settings-alert-banner">
                    <span className="settings-alert-icon"><CheckCircle size={18} /></span>
                    <span className="settings-alert-text">
                      Windows taskbar theme integration is active. Shell transparency modifiers apply instantly.
                    </span>
                  </div>
                </div>

                {/* Autostart Toggle */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Power size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">Start with Windows</span>
                      <span className="settings-card-desc">Automatically launch the app silently on system boot.</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <label className="switch-label">
                      <input 
                        type="checkbox" 
                        checked={autostartEnabled} 
                        onChange={async (e) => {
                          const checked = e.target.checked;
                          setAutostartEnabled(checked);
                          try {
                            const { enable, disable } = await import('@tauri-apps/plugin-autostart');
                            if (checked) await enable();
                            else await disable();
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                      />
                      <span className="switch-slider"></span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* App Updates */}
            <div style={{ marginTop: "24px" }}>
              <span className="settings-section-title">Application Updates</span>
              <div className="settings-grid-layout">
                {/* Regular User Update Check */}
                <div className="settings-card">
                  <div className="settings-card-top" style={{ flex: 1 }}>
                    <div className="settings-card-icon-container"><AlertCircle size={18} /></div>
                    <div className="settings-card-info" style={{ flex: 1 }}>
                      <span className="settings-card-title">
                        Check for Updates 
                        {currentAppVersion && <span style={{ marginLeft: "8px", fontSize: "11px", color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "10px" }}>v{currentAppVersion}</span>}
                      </span>
                      <span className="settings-card-desc">Automatically fetch and install the latest OTA updates.</span>
                    </div>
                  </div>
                  <div className="settings-card-control" style={{ width: "100%" }}>
                    <button 
                      type="button" 
                      className="action-btn action-btn--primary"
                      onClick={handleCheckUpdates}
                      disabled={isCheckingUpdate}
                      style={{ minHeight: "34px", padding: "0 14px", fontSize: "12px", width: "100%" }}
                    >
                      {isCheckingUpdate ? "Checking..." : "Check Now"}
                    </button>
                  </div>
                </div>

                {/* Developer Publisher Mode */}
                <div className="settings-card" style={{ gridColumn: "1 / -1", border: "1px solid var(--accent)", background: "rgba(0, 0, 0, 0.2)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: "12px" }}>
                    <div className="settings-card-top">
                      <div className="settings-card-icon-container" style={{ background: "var(--accent)" }}><Activity size={18} color="#000" /></div>
                      <div className="settings-card-info">
                        <span className="settings-card-title" style={{ color: "var(--accent)" }}>Developer OTA Publisher</span>
                        <span className="settings-card-desc">Build the app and deploy an update to all users globally.</span>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                    <input 
                      type="text" 
                      value={updateVersion} 
                      onChange={(e) => setUpdateVersion(e.target.value)} 
                      placeholder="New Version (e.g. 1.0.1)"
                      style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#fff" }}
                    />
                    <input 
                      type="password" 
                      value={updateKeyPassword} 
                      onChange={(e) => setUpdateKeyPassword(e.target.value)} 
                      placeholder="Private Key Password"
                      style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#fff" }}
                    />
                  </div>
                  <textarea 
                    value={updateNotes}
                    onChange={(e) => setUpdateNotes(e.target.value)}
                    placeholder="Release Notes..."
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#fff", minHeight: "60px", marginBottom: "10px" }}
                  />
                  
                  {updateStatus && (
                    <div style={{ padding: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "6px", marginBottom: "10px", fontSize: "12px", color: "var(--accent)" }}>
                      {updateStatus}
                    </div>
                  )}

                  <button 
                    type="button" 
                    className="action-btn action-btn--primary"
                    onClick={handlePublishUpdate}
                    disabled={isPublishing}
                    style={{ minHeight: "34px", padding: "0 14px", fontSize: "12px", width: "100%", background: "var(--accent)", color: "#000" }}
                  >
                    {isPublishing ? "Building & Publishing (This takes 3+ minutes)..." : "Publish App Update"}
                  </button>
                </div>
              </div>
            </div>

            {/* Developer Diagnostic options */}
            <div>
              <span className="settings-section-title">Developer Diagnostics</span>
              <div className="settings-grid-layout">
                {/* Debug mode toggle */}
                <div className="settings-card">
                  <div className="settings-card-top">
                    <div className="settings-card-icon-container"><Settings size={18} /></div>
                    <div className="settings-card-info">
                      <span className="settings-card-title">Debug Logging</span>
                      <span className="settings-card-desc">Show developer menu and logging configurations.</span>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <label className="switch-label">
                      <input 
                        type="checkbox" 
                        checked={devDebugEnabled} 
                        onChange={(e) => {
                          setDevDebugEnabled(e.target.checked);
                          localStorage.setItem("settings_dev_debug_enabled", String(e.target.checked));
                        }}
                      />
                      <span className="switch-slider"></span>
                    </label>
                  </div>
                </div>

                {/* Log report file */}
                <div className="settings-card">
                  <div className="settings-card-top" style={{ flex: 1 }}>
                    <div className="settings-card-icon-container"><FileText size={18} /></div>
                    <div className="settings-card-info" style={{ flex: 1 }}>
                      <span className="settings-card-title">Log File</span>
                      <span className="settings-card-desc">Create log report file for diagnostic purposes.</span>
                      {logStatus && (
                        <span style={{ fontSize: "11px", color: "var(--accent)", marginTop: "4px", fontWeight: "bold" }}>
                          {logStatus}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="settings-card-control" style={{ width: "100%" }}>
                    <button 
                      type="button" 
                      className="action-btn action-btn--secondary"
                      onClick={handleCreateLogFile}
                      style={{ minHeight: "34px", padding: "0 14px", fontSize: "12px", width: "100%" }}
                    >
                      Generate Log Report
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ================= ACCOUNTS PAGE ================= */}
        {(activeTab === "accounts" || searchQuery) && (
          <div className="animate-fade-in">
            <span className="settings-section-title">Connected Accounts</span>
            <div className="settings-grid-layout">
              {/* DeviantArt Account Card */}
              <div className="settings-card">
                <div className="settings-card-top">
                  <div className="settings-card-icon-container"><Globe size={18} /></div>
                  <div className="settings-card-info">
                    <span className="settings-card-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      DeviantArt
                      {wallpaper.addonCredentials?.deviantart?.access_token && (
                        <span style={{ fontSize: "10px", backgroundColor: "var(--accent)", color: "#000", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>CONNECTED</span>
                      )}
                    </span>
                    <span className="settings-card-desc">Connect official DeviantArt developer credentials to access high-quality original images.</span>
                  </div>
                </div>
                
                <div className="settings-card-control" style={{ width: "100%", marginTop: "12px", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                    <label style={{ fontSize: "11px", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Client ID</label>
                    <input 
                      type="text" 
                      className="text-input" 
                      placeholder="e.g. 23812" 
                      style={{ width: "100%", padding: "8px 12px" }}
                      value={wallpaper.addonCredentials?.deviantart?.client_id || ""}
                      onChange={(e) => {
                        const newCreds = { ...wallpaper.addonCredentials, deviantart: { ...wallpaper.addonCredentials?.deviantart, client_id: e.target.value } };
                        wallpaper.setAddonCredentials(newCreds);
                      }}
                    />
                  </div>
                  
                  {wallpaper.addonCredentials?.deviantart?.access_token && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "4px 0", marginTop: "4px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <label style={{ fontSize: "12px", color: "var(--text-bright)", fontWeight: "500" }}>Enhanced Mode</label>
                        <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Include unfiltered and mature content in search results.</span>
                      </div>
                      <label className="switch-label">
                        <input 
                          type="checkbox" 
                          checked={wallpaper.addonCredentials?.deviantart?.enhancedMode || false}
                          onChange={(e) => {
                            const newCreds = { 
                              ...wallpaper.addonCredentials, 
                              deviantart: { 
                                ...wallpaper.addonCredentials?.deviantart, 
                                enhancedMode: e.target.checked
                              } 
                            };
                            wallpaper.setAddonCredentials(newCreds);
                          }}
                        />
                        <span className="switch-slider"></span>
                      </label>
                    </div>
                  )}
                  <button 
                    type="button" 
                    className="action-btn action-btn--primary"
                    style={{ minHeight: "36px", width: "100%", justifyContent: "center", marginTop: "4px" }}
                    onClick={() => {
                      const daCreds = wallpaper.addonCredentials?.deviantart;
                      if (!daCreds?.client_id) return;
                      invoke("start_oauth_flow", { provider: "deviantart", clientId: daCreds.client_id, clientSecret: "" })
                        .catch(e => console.error("OAuth Error:", e));
                    }}
                  >
                    {wallpaper.addonCredentials?.deviantart?.access_token ? "Reconnect with DeviantArt" : "Connect with DeviantArt"}
                  </button>
                  <a href="https://www.deviantart.com/developers/" target="_blank" rel="noreferrer" style={{ fontSize: "12px", color: "var(--accent)", textAlign: "center", textDecoration: "none", cursor: "pointer" }}>
                    Get your developer credentials here <ExternalLink size={12} style={{ display: "inline", verticalAlign: "middle" }}/>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
