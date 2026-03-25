# Changelog

## [Unreleased] - 2026-03-25

### Fixed
- **Floating Preview UI**: Resolved a text clipping issue where long descriptions were hidden at the bottom of the container. Added vertical scrolling and refined `max-height` constraints.
- **Glassmorphism Theme**: Updated the `FloatingPreview` to use a high-end, premium aesthetic consistent with the Master System design (0.85 backdrop blur, vivid hover states).
- **Auto-Play on Application**: Fixed a bug where live wallpapers would load in a static/paused state when first applied to the desktop.
- **Performance Monitor Sync**: Updated the background performance thread to respect manual user commands. Previously, the monitor would fight with the UI over "Play/Pause" states (the "press twice to play" bug).
- **Power Management Logic**: Disabled the strict "pause on battery" check which was causing wallpapers to immediately freeze on laptop systems without user feedback.
- **Video Engine Argument Parsing**: Refactored the `mpv` command construction to use safe array-based argument passing in PowerShell. This prevents local file paths with spaces from breaking the command-line flags.
- **MPV Path Resolution**: Fixed an issue where the background wallpaper engine would fail if `mpv.exe` was not in the default global path. The app now correctly passes the resolved binary path from the Rust backend to the deployment script.

### Added
- Premium SVG icons (Fullscreen, Minimize, Close) for the Floating Preview controls.
- Improved layout for the Master HUD and preview footer to prevent overlap on smaller resolutions.
