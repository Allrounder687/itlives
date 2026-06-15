# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - Initial Release
### Added
- **Native OS Backend (Rust/Tauri)**:
  - `desktop.rs`: Deep Windows API integration for HWND WorkerW reparenting.
  - `performance.rs`: Intelligent pausing and resource throttling during full-screen games.
  - `audio.rs`: Real-time system audio loopback for reactive visualizers.
- **Comprehensive Media Providers**:
  - Full streaming integration for **YouTube** and **Twitch** (`youtube.rs`).
  - Native integration for **Wallhaven**, **Alphacoders**, **MotionBGs**, **Pinterest**, and **WallpaperWaves**.
  - Custom `scripts/scrape.js` unified CLI for headless web scraping.
- **Deep Wallhaven Integration**:
  - Full Wallhaven API Key support (`setWallhavenApiKey`).
  - Personal collection browsing and application.
  - Intelligent `BatchDownloadModal` with automated rate-limiting to prevent IP bans.
- **Advanced Editing & Rendering Suite**:
  - `EditorWorkspace.tsx`: Massive built-in static image editing and manipulation suite.
  - `WebGLEffectRenderer.tsx`: Interactive 3D and WebGL particle systems via React Three Fiber.
  - `ParallaxRenderer.tsx`: Multi-layered 2.5D interactive parallax engine.
- **Power User Automation**:
  - `AutomationPanel.tsx` for scheduling and conditional wallpaper changes.
  - `DisplaySelector.tsx` for multi-monitor, independent wallpaper configuration.
