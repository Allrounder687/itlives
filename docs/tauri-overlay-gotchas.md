# Tauri Overlay & IPC Gotchas

This document records critical pitfalls encountered while building the transparent effects overlay (Tauri WebView) that sits behind desktop icons.

## 1. Tauri v2 Security Capabilities
By default, Tauri v2's Capability Security Model strictly blocks all IPC (`emit`, `listen`, `invoke`) for windows that are not explicitly whitelisted.
- **The Issue:** The `effects_overlay` window was spawned via code but was missing from `src-tauri/capabilities/default.json`. 
- **The Symptom:** Rust backend `app_handle.emit` calls fail silently, and frontend `listen` callbacks are completely ignored without throwing any errors in the console.
- **The Fix:** Always ensure dynamically created or secondary windows are added to the `windows` array in your capability configurations:
```json
"windows": [
  "main",
  "tray_menu",
  "effects_overlay"
]
```

## 2. Empty Tuple IPC Emission Bug
When emitting events from Rust, the payload type is strictly enforced by serde.
- **The Issue:** We mistakenly emitted an empty tuple `()` instead of the actual `layers_json` payload when applying effects:
  ```rust
  let _ = window.emit("effects-updated", ()); // Bug!
  ```
- **The Symptom:** `()` serializes to `null` in JSON. The frontend listener received `event.payload = null`, causing it to silently ignore the update. Clicking "Clear Effects" or "Apply" did nothing until a hot-reload or app restart forced a read from `localStorage`.
- **The Fix:** Ensure the correct data is cloned and emitted:
  ```rust
  let _ = window.emit("effects-updated", layers_json.clone());
  ```

## 3. Transparent Canvas Alpha Blending Quirk (HTML5)
When building overlays, it is common to set the Tauri window background to transparent and let a React `<canvas>` act as the particle surface.
- **The Issue:** Using `ctx.globalCompositeOperation = "screen"` to make particles glow (like sparkles or click ripples).
- **The Symptom:** When a canvas has a transparent background (not a solid color), the `"screen"` composition mode effectively zeroes out the alpha channel in many browser implementations because the background alpha is 0. This makes all particles 100% invisible.
- **The Fix:** When drawing on a transparent canvas layer over video/desktop, rely on CSS RGBA colors for transparency rather than `globalCompositeOperation = "screen"`. Standard `source-over` (the default) correctly composites RGBA values over transparent backgrounds.

## 4. `pointer-events: none` and IPC
Setting `pointerEvents: "none"` on a WebView canvas or container in CSS (and `window.set_ignore_cursor_events(true)` in Rust) successfully makes the window click-through so users can interact with their desktop.
- **Crucial Detail:** This does **not** block Tauri IPC. The window can still receive `cursor-moved` events from a background Rust loop polling the Win32 `GetCursorPos` API. This is the correct architecture for interactive wallpapers.
