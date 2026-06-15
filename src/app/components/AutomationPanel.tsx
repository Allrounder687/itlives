"use client";

import { ChangeEvent, useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface AutomationPanelProps {
  wallpaper: any; // Type accurately if you have a state hook structure, for now 'any' works well for direct mapping.
}

const FILTER_OPTIONS = [
  { value: "none", label: "None" },
  { value: "grayscale", label: "Grayscale" },
  { value: "vivid", label: "Vivid" },
  { value: "soft", label: "Soft" },
  { value: "noir", label: "Noir" },
  { value: "retro", label: "Retro" },
];

export function AutomationPanel({ wallpaper }: AutomationPanelProps) {
  const onRotationIntervalChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    if (Number.isFinite(nextValue)) {
      void wallpaper.setRotationConfig(wallpaper.rotationEnabled, nextValue);
    }
  };

  const onWallpaperScaleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    if (Number.isFinite(nextValue)) {
      void wallpaper.setWallpaperScale(nextValue);
    }
  };

  const onWallpaperVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    if (Number.isFinite(nextValue)) {
      void wallpaper.setVolumePercent(nextValue);
    }
  };

  const [syncAccent, setSyncAccent] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("syncWindowsAccent");
    if (saved !== null) {
      setSyncAccent(saved === "true");
    }
    
    // Load Shell settings
    const savedHideIcons = localStorage.getItem("hideDesktopIcons") === "true";
    const savedTaskbarBlur = localStorage.getItem("enableTaskbarBlur") === "true";
    
    setHideDesktopIcons(savedHideIcons);
    setEnableTaskbarBlur(savedTaskbarBlur);
    
    if (savedHideIcons) {
      invoke("toggle_desktop_icons", { visible: false }).catch(console.error);
    }
    if (savedTaskbarBlur) {
      invoke("set_taskbar_state", { enableBlur: true, useAcrylic: true }).catch(console.error);
    }
  }, []);

  const [hideDesktopIcons, setHideDesktopIcons] = useState(false);
  const [enableTaskbarBlur, setEnableTaskbarBlur] = useState(false);

  const onHideDesktopIconsChange = (event: ChangeEvent<HTMLInputElement>) => {
    const isChecked = event.target.checked;
    setHideDesktopIcons(isChecked);
    localStorage.setItem("hideDesktopIcons", String(isChecked));
    invoke("toggle_desktop_icons", { visible: !isChecked }).catch(console.error);
  };

  const onEnableTaskbarBlurChange = (event: ChangeEvent<HTMLInputElement>) => {
    const isChecked = event.target.checked;
    setEnableTaskbarBlur(isChecked);
    localStorage.setItem("enableTaskbarBlur", String(isChecked));
    invoke("set_taskbar_state", { enableBlur: isChecked, useAcrylic: true }).catch(console.error);
  };

  const onSyncAccentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const isChecked = event.target.checked;
    setSyncAccent(isChecked);
    localStorage.setItem("syncWindowsAccent", String(isChecked));
  };

  return (
    <div className="panel automation-card">
      <div className="section-head">
        <span className="eyebrow">Rotation</span>
        <h2>Playback Scheduler</h2>
      </div>
      <div className="automation-grid">
        <div style={{gridColumn: "1 / -1", marginTop: "10px"}}>
            <h3 style={{fontSize: "14px", opacity: 0.8, marginBottom: "15px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "5px"}}>Windows Shell Integration</h3>
        </div>
        <label className="toggle-row">
          <span>Hide Desktop Icons</span>
          <input
            type="checkbox"
            checked={hideDesktopIcons}
            onChange={onHideDesktopIconsChange}
          />
        </label>
        <label className="toggle-row">
          <span>Enable Taskbar Blur (Acrylic)</span>
          <input
            type="checkbox"
            checked={enableTaskbarBlur}
            onChange={onEnableTaskbarBlurChange}
          />
        </label>
        <div style={{gridColumn: "1 / -1", marginTop: "10px"}}>
            <h3 style={{fontSize: "14px", opacity: 0.8, marginBottom: "15px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "5px"}}>General Behaviors</h3>
        </div>
        <label className="toggle-row">
          <span>Enable Lightweight Mode (Pentium Processors / Low Battery)</span>
          <input
            type="checkbox"
            checked={wallpaper.lightweightMode}
            onChange={(event) => wallpaper.setLightweightMode(event.target.checked)}
          />
        </label>
        <label className="toggle-row">
          <span>Sync Windows Accent Color (Taskbar/Windows) with Wallpaper</span>
          <input
            type="checkbox"
            checked={syncAccent}
            onChange={onSyncAccentChange}
          />
        </label>
        <label className="toggle-row">
          <span>Pause live wallpaper playback</span>
          <input
            type="checkbox"
            checked={wallpaper.paused}
            onChange={(event) => wallpaper.setPaused(event.target.checked)}
          />
        </label>
        <label className="toggle-row">
          <span>Keep desktop effects (like pets) running while wallpaper is paused</span>
          <input
            type="checkbox"
            checked={wallpaper.keepEffectsRunningOnPause}
            onChange={(event) => wallpaper.setKeepEffectsRunningOnPause(event.target.checked)}
          />
        </label>
        <label className="toggle-row">
          <span>Start itLives on system startup</span>
          <input
            type="checkbox"
            checked={wallpaper.autostartEnabled}
            onChange={(event) => wallpaper.setAutostartEnabled(event.target.checked)}
          />
        </label>
        <label className="toggle-row">
          <span>Restore wallpaper on app launch</span>
          <input
            type="checkbox"
            checked={wallpaper.restoreOnLaunch}
            onChange={(event) => wallpaper.setRestoreOnLaunch(event.target.checked)}
          />
        </label>
        <label className="toggle-row">
          <span>Auto-pause to save battery and performance</span>
          <input
            type="checkbox"
            checked={wallpaper.autoPauseEnabled}
            onChange={(event) => wallpaper.setAutoPauseEnabled(event.target.checked)}
          />
        </label>
        <label className="toggle-row">
          <span>Enable timed rotation</span>
          <input
            type="checkbox"
            checked={wallpaper.rotationEnabled}
            disabled={wallpaper.queue.length === 0}
            onChange={(event) =>
              wallpaper.setRotationConfig(event.target.checked, wallpaper.rotationIntervalSeconds)
            }
          />
        </label>
        <label className="field">
          <span className="field__label">Slideshow/Queue Source</span>
          <select
            className="input input--select"
            value={wallpaper.slideshowSource || "local"}
            onChange={(event) => wallpaper.setSlideshowSource(event.target.value)}
          >
            <option value="local">Local PC Library (Imports)</option>
            <option value="online">Online History (Favorites & Recents)</option>
            <option value="discover">Discover New (Random Online Wallpapers)</option>
          </select>
          <span className="field__hint">
            Controls which wallpapers are used to auto-fill the slideshow rotation queue when it runs empty.
          </span>
        </label>
        <label className="toggle-row">
          <span>Close app to tray</span>
          <input
            type="checkbox"
            checked={wallpaper.closeToTray}
            onChange={(event) =>
              wallpaper.setWindowBehavior(event.target.checked, wallpaper.minimizeToTray)
            }
          />
        </label>
        <label className="toggle-row">
          <span>Minimize button sends app to tray</span>
          <input
            type="checkbox"
            checked={wallpaper.minimizeToTray}
            onChange={(event) =>
              wallpaper.setWindowBehavior(wallpaper.closeToTray, event.target.checked)
            }
          />
        </label>
        <label className="field">
          <span className="field__label">Rotation Interval (seconds)</span>
          <input
            className="input"
            type="number"
            min={30}
            step={30}
            value={wallpaper.rotationIntervalSeconds}
            onChange={onRotationIntervalChange}
          />
        </label>
        <label className="field">
          <span className="field__label">Wallpaper Volume</span>
          <div className="scale-control">
            <input
              className="scale-slider"
              type="range"
              min={0}
              max={100}
              step={5}
              value={wallpaper.volumePercent}
              onChange={onWallpaperVolumeChange}
            />
            <input
              className="input scale-input"
              type="number"
              min={0}
              max={100}
              step={5}
              value={wallpaper.volumePercent}
              onChange={onWallpaperVolumeChange}
            />
            <span className="scale-suffix">%</span>
          </div>
          <span className="field__hint">
            `0%` keeps wallpapers silent. Raise the slider if you want ambient audio from local or remote video files.
          </span>
        </label>
        <label className="field">
          <span className="field__label">Live Video Filter</span>
          <select
            className="input input--select"
            value={wallpaper.videoFilter}
            onChange={(event) => wallpaper.setWallpaperFilter(event.target.value)}
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="field__hint">
            Filters apply to the desktop wallpaper engine and the in-app preview. Changing filters reapplies the active wallpaper.
          </span>
        </label>
        <label className="field">
          <span className="field__label">Wallpaper Render Scale</span>
          <div className="scale-control">
            <input
              className="scale-slider"
              type="range"
              min={25}
              max={200}
              step={5}
              defaultValue={wallpaper.wallpaperScalePercent}
              onMouseUp={(e) => wallpaper.setWallpaperScale(parseInt((e.target as HTMLInputElement).value))}
              onTouchEnd={(e) => wallpaper.setWallpaperScale(parseInt((e.target as HTMLInputElement).value))}
            />
            <input
              className="input scale-input"
              type="number"
              min={25}
              max={200}
              step={5}
              value={wallpaper.wallpaperScalePercent}
              onChange={(e) => wallpaper.setWallpaperScale(parseInt(e.target.value))}
            />
            <span className="scale-suffix">%</span>
          </div>
          <span className="field__hint">
            Lower values reduce wallpaper render load and memory pressure. `100%` matches screen-scale rendering.
          </span>
        </label>
        <div className="automation-note">
          <strong>Queue size: {wallpaper.queue.length}</strong>
          <span>
            Rotation runs while the app process is alive. If the window is hidden to tray, playback and timers keep running.
          </span>
        </div>
      </div>
    </div>
  );
}
