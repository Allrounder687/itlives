# OpenClaw LWP (Live Wallpaper)

OpenClaw LWP is an advanced, high-performance Live Wallpaper engine and desktop customization suite for Windows. Combining the power of Next.js, React Three Fiber, and a low-level native Rust backend via Tauri, OpenClaw LWP transforms your static desktop into a dynamic, interactive workspace without sacrificing system performance.

## 🚀 Epic Feature Suite

### 📡 Unrivaled Content Providers
Stop relying on local files. OpenClaw seamlessly streams and scrapes from the web's best platforms:
- **Streaming Platforms**: Full native integration for **YouTube** and **Twitch** (`youtube.rs`), allowing you to set live streams or VODs directly as your desktop background.
- **Premium Wallpaper Sources**: Native scrapers and integration for **Wallhaven.cc**, **Alphacoders**, **MotionBGs**, **Pinterest**, and **WallpaperWaves**.
- **Direct URLs**: Pass any valid media URL directly to the rendering engine.

### 🔌 Deep Wallhaven.cc API Integration
A power-user's dream for Wallhaven enthusiasts:
- **API Authentication**: Link your Wallhaven API key directly in the app.
- **Personal Collections**: Browse, manage, and set your private Wallhaven collections as rotating wallpapers.
- **Smart Batch Downloader**: Download massive collections directly to your local drive. The built-in downloader (`BatchDownloadModal.tsx`) automatically respects Wallhaven's rate limits, pausing between requests to prevent IP bans.

### 🎨 Advanced Image Editing & Rendering Engine
Why use Photoshop when your wallpaper engine does it for you?
- **Static Image Editor (`EditorWorkspace.tsx`)**: A fully-featured editing suite built right into the app. Crop, color-correct, apply filters, and manipulate your static wallpapers before applying them.
- **Interactive 3D WebGL**: Built on `@react-three/fiber` and `three.js`. Render massive 3D scenes (`WebGLEffectRenderer.tsx`) that react to your mouse and system state.
- **Parallax Environments**: Multi-layered 2.5D parallax environments (`ParallaxRenderer.tsx`) that shift as you move your cursor.
- **Audio Reactivity**: Watch your desktop pulse to your music with real-time audio monitoring (`audio.rs`).

### 🖥️ Power User Controls
- **Multi-Display Support**: Individually configure different wallpapers, streams, or 3D scenes for every monitor you own (`DisplaySelector.tsx`).
- **Automation & Scheduling**: Set up robust rules in the `AutomationPanel.tsx` to change wallpapers based on time of day, system theme, or battery life.
- **True Desktop Reparenting**: The Rust backend hooks your wallpaper directly behind the Windows desktop icons using the deep `WorkerW` API, ensuring flawless integration without blocking your workflow.
- **Performance Throttling**: The engine automatically pauses rendering when full-screen games or heavy applications are launched (`performance.rs`).

## 🏗️ Architecture Stack

- **Frontend**: Next.js (App Router), React 19, Tailwind CSS v4.
- **3D Engine**: Three.js, React Three Fiber, React Three Drei.
- **Backend**: Tauri 2.0 (Rust) handling deep OS-level APIs (Windows Themes, HWND reparenting, audio loopback).
- **Automation Scripts**: Unified Node.js CLI scraper `scripts/scrape.js`.

## 🛠️ Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install)

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the full desktop application (Next.js + Tauri):
   ```bash
   npm run tauri dev
   ```

### Included CLI Tools
- `npm run scrape -- --source=<pinterest|alphacoders> --query="<search>"`: Run the built-in scraper locally.

## 📜 Changelog
Check the [CHANGELOG.md](./CHANGELOG.md) to see recent updates and history.

## 📄 License
*Private / All Rights Reserved.*
