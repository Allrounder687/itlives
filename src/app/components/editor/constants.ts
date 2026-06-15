import { EffectLayer } from "../CanvasEffectRenderer";

export const EFFECT_TEMPLATES: Record<string, Omit<EffectLayer, "id">> = {
  snow: { type: "snow", name: "Snowfall", enabled: true, params: { count: 200, speed: 1.5, wind: 0.3, size: 6.0 } },
  rain: { type: "rain", name: "Raindrops", enabled: true, params: { count: 300, speed: 1.2, wind: 0.1, size: 4.0 } },
  fireflies: { type: "fireflies", name: "Fireflies", enabled: true, params: { count: 80, speed: 0.5, size: 5.0, color: "#aaff44", texture: "/assets/brackeys_vfx_bundle/particles/alpha/star_05_a.png" } },
  "particle-emitter": { type: "particle-emitter", name: "Particle Engine", enabled: true, params: { preset: "fire", texture: "/assets/brackeys_vfx_bundle/particles/alpha/fire_01_a.png", count: 100, colorStart: "#ff5a00", colorEnd: "#000000", speed: 2.0, spread: 1.0, followMouse: false } },
  stars: { type: "stars", name: "Starfield", enabled: true, params: { count: 400, speed: 0.1, size: 3.0, twinkle: 0.8 } },
  fog: { type: "fog", name: "Fog / Mist", enabled: true, params: { count: 60, speed: 0.3, size: 40.0, opacity: 0.4 } },
  "water-caustics": { type: "water-caustics", name: "Water Reflection", enabled: true, params: { speed: 1.0, scale: 3.0, intensity: 1.0, color: "#00ffff", yOffset: -400, width: 2000, height: 800 } },
  "blowing-leaves": { type: "blowing-leaves", name: "Blowing Leaves", enabled: true, params: { count: 80, speed: 1.0, wind: 0.5, size: 15.0, color: "#4caf50" } },
  vignette: { type: "vignette", name: "Vignette Frame", enabled: true, params: { intensity: 0.6, offset: 0.1 } },
  bloom: { type: "bloom", name: "Bloom Glow", enabled: true, params: { intensity: 1.0, threshold: 0.5, smoothing: 0.9 } },
  glitch: { type: "glitch", name: "Cyber Glitch", enabled: true, params: { strength: 0.1 } },
  "audio-visualizer": { type: "audio-visualizer", name: "Audio Visualizer", enabled: true, params: {} },
  parallax: { type: "parallax", name: "Parallax Depth", enabled: true, params: { intensity: 1.0 } },
  "cursor-trail": { type: "cursor-trail", name: "Sparkle Trail", enabled: true, params: { color: "auto" } },
  "ribbon-trail": { type: "ribbon-trail", name: "Fluid Ribbon", enabled: true, params: { color: "auto", width: 5.0, length: 50 } },
  "click-ripple": { type: "click-ripple", name: "Click Ripple", enabled: true, params: { color: "#ffffff" } },
  "color-grade": { type: "color-grade", name: "Color Tint", enabled: true, params: { color: "rgba(255, 100, 50, 0.15)", intensity: 0.3, blendMode: "overlay" } },
  "blur-region": { type: "blur-region", name: "Blur Region", enabled: true, params: { x: 10, y: 10, w: 30, h: 20, blur: 15 } },
  clock: { type: "clock", name: "Clock Widget", enabled: true, params: { format: "24h", style: "minimal", color: "#ffffff", opacity: 0.8, x: 50, y: 50 } },
  timetable: { type: "timetable", name: "Timetable Widget", enabled: true, params: { x: 80, y: 30, scale: 1.0, opacity: 0.9, style: "card" } },
  "food-bowl": { type: "food-bowl", name: "Food Bowl", enabled: true, params: { x: 50, y: 80, scale: 1.0 } },
  "food-pizza": { type: "food-pizza", name: "Pizza Slice", enabled: true, params: { x: 40, y: 80, scale: 1.0 } },
  "food-meat": { type: "food-meat", name: "Big Meat", enabled: true, params: { x: 60, y: 80, scale: 1.0 } },
  "music-player": { type: "music-player", name: "Music Player", enabled: true, params: { x: 50, y: 80, scale: 1.0, theme: "glass", opacity: 0.9, shape: "standard", color: "auto" } },
  "app-launcher": { type: "app-launcher", name: "App Launcher", enabled: true, params: { x: 50, y: 90, scale: 1.0, apps: [], layout: "dock" } },
  sprite: { type: "sprite", name: "Image Sprite", enabled: true, params: { image: "", x: 50, y: 50, width: 300, height: 300, rotation: 0, opacity: 1.0, sway: 0.0 } },
  "god-rays": { type: "god-rays", name: "God Rays", enabled: true, params: { exposure: 0.6, decay: 0.95, density: 1.0, weight: 0.4, x: 50, y: 50 } },
  vhs: { type: "vhs", name: "Retro VHS", enabled: true, params: { rgbShift: 0.02, noise: 0.3, scanlines: 0.5 } },
  "liquid-ripple": { type: "liquid-ripple", name: "Screen Ripple", enabled: true, params: { intensity: 1.0, waveMode: "off", waveZoneX: 20, waveZoneY: 60, waveZoneW: 60, waveZoneH: 30, waveSpeed: 1.0, waveScale: 5.0, waveStrength: 1.0, autoRipple: false, autoInterval: 1.5, autoZoneX: 20, autoZoneY: 20, autoZoneW: 60, autoZoneH: 60, raindrops: false, rainIntensity: 1.0 } },
  "rain-on-glass": { type: "rain-on-glass", name: "Rain on Glass", enabled: true, params: { intensity: 1.0, dropSpeed: 1.0, streakCount: 15, dropletDensity: 20 } },
  "brightness-contrast": { type: "brightness-contrast", name: "Brightness / Contrast", enabled: true, params: { brightness: 0.1, contrast: 0.2 } },
  "hue-saturation": { type: "hue-saturation", name: "Hue & Saturation", enabled: true, params: { hue: 0.0, saturation: 0.2 } },
  sepia: { type: "sepia", name: "Sepia Filter", enabled: true, params: { intensity: 1.0 } },
  pixelation: { type: "pixelation", name: "Pixel Art Filter", enabled: true, params: { granularity: 5 } },
  noise: { type: "noise", name: "Film Grain / Noise", enabled: true, params: { opacity: 0.5, premultiply: true } },
  "chromatic-aberration": { type: "chromatic-aberration", name: "RGB Split (Chroma)", enabled: true, params: { offsetX: 0.02, offsetY: 0.02 } },
  "color-average": { type: "color-average", name: "Black & White", enabled: true, params: {} },
  "color-depth": { type: "color-depth", name: "Posterize (Color Depth)", enabled: true, params: { bits: 8 } },
  "dot-screen": { type: "dot-screen", name: "Comic Halftone", enabled: true, params: { angle: 1.57, scale: 1.0 } },
  "tilt-shift": { type: "tilt-shift", name: "Miniature Blur", enabled: true, params: { blur: 0.5, taper: 0.5 } },
  "water-effect": { type: "water-effect", name: "Underwater", enabled: true, params: { factor: 1.0 } },
};

export const EFFECT_DROPDOWN: { group: string, items: { key: string, icon: string, label: string }[] }[] = [
  { group: "📦 Assets & Layers", items: [
    { key: "sprite", icon: "🖼️", label: "Image Sprite" },
  ]},
  { group: "⛅ Particles", items: [
    { key: "particle-emitter", icon: "✨", label: "Particle Engine" },
    { key: "snow", icon: "❄️", label: "Snowfall" },
    { key: "rain", icon: "🌧️", label: "Raindrops" },
    { key: "fireflies", icon: "🪲", label: "Fireflies" },
    { key: "stars", icon: "⭐", label: "Starfield" },
    { key: "fog", icon: "🌫️", label: "Fog / Mist" },
  ]},
  { group: "🎬 Post Processing", items: [
    { key: "god-rays", icon: "🌤️", label: "God Rays" },
    { key: "vignette", icon: "🖼️", label: "Vignette" },
    { key: "bloom", icon: "✨", label: "Bloom Glow" },
    { key: "glitch", icon: "⚡", label: "Cyber Glitch" },
    { key: "vhs", icon: "📼", label: "Retro VHS" },
    { key: "rain-on-glass", icon: "🌧️", label: "Rain on Glass" },
  ]},
  { group: "🎮 Interactive", items: [
    { key: "audio-visualizer", icon: "🎵", label: "Audio Visualizer" },
    { key: "parallax", icon: "🔮", label: "Parallax Depth" },
    { key: "cursor-trail", icon: "🌟", label: "Sparkle Trail" },
    { key: "ribbon-trail", icon: "🖌️", label: "Fluid Ribbon" },
    { key: "click-ripple", icon: "💥", label: "Click Ripple" },
    { key: "liquid-ripple", icon: "💧", label: "Screen Ripple" },
  ]},
  { group: "🎨 Overlays & Widgets", items: [
    { key: "color-grade", icon: "🎨", label: "Color Tint" },
    { key: "blur-region", icon: "🔲", label: "Blur Region" },
    { key: "clock", icon: "🕐", label: "Clock Widget" },
    { key: "food-bowl", icon: "🥣", label: "Food Bowl" },
    { key: "food-pizza", icon: "🍕", label: "Pizza Slice" },
    { key: "food-meat", icon: "🥩", label: "Big Meat" },
    { key: "music-player", icon: "🎧", label: "Music Player" },
    { key: "app-launcher", icon: "🚀", label: "App Launcher" },
  ]},
  { group: "📸 Pro Photo Editing", items: [
    { key: "brightness-contrast", icon: "☀️", label: "Brightness / Contrast" },
    { key: "hue-saturation", icon: "🌈", label: "Hue & Saturation" },
    { key: "sepia", icon: "🎞️", label: "Sepia Filter" },
    { key: "pixelation", icon: "👾", label: "Pixel Art Filter" },
    { key: "noise", icon: "📻", label: "Film Grain / Noise" },
    { key: "chromatic-aberration", icon: "📸", label: "RGB Split" },
    { key: "color-average", icon: "🌑", label: "Black & White" },
    { key: "color-depth", icon: "🎛️", label: "Posterize (Color Depth)" },
    { key: "dot-screen", icon: "📰", label: "Comic Halftone" },
    { key: "tilt-shift", icon: "🔍", label: "Miniature Blur" },
    { key: "water-effect", icon: "🌊", label: "Underwater" },
  ]},
];

export const TIME_PRESETS: { key: string, name: string, layers: Omit<EffectLayer, "id">[] }[] = [
  { key: "dawn", name: "🌅 Dawn", layers: [
    { type: "color-grade", name: "Dawn Tint", enabled: true, params: { color: "rgba(255, 180, 100, 0.2)", intensity: 0.35, blendMode: "overlay" } },
    { type: "fog", name: "Morning Mist", enabled: true, params: { count: 40, speed: 0.2, size: 50, opacity: 0.3 } },
    { type: "bloom", name: "Soft Glow", enabled: true, params: { intensity: 0.8, threshold: 0.6, smoothing: 0.95 } },
  ]},
  { key: "golden", name: "🌇 Golden Hour", layers: [
    { type: "color-grade", name: "Golden Tint", enabled: true, params: { color: "rgba(255, 160, 40, 0.25)", intensity: 0.4, blendMode: "overlay" } },
    { type: "vignette", name: "Warm Vignette", enabled: true, params: { intensity: 0.5, offset: 0.15 } },
    { type: "bloom", name: "Sunset Glow", enabled: true, params: { intensity: 1.5, threshold: 0.4, smoothing: 0.9 } },
  ]},
  { key: "night", name: "🌙 Night Sky", layers: [
    { type: "color-grade", name: "Night Tint", enabled: true, params: { color: "rgba(20, 30, 80, 0.3)", intensity: 0.4, blendMode: "multiply" } },
    { type: "stars", name: "Stars", enabled: true, params: { count: 500, speed: 0.05, size: 3, twinkle: 0.9 } },
    { type: "vignette", name: "Dark Vignette", enabled: true, params: { intensity: 0.8, offset: 0.05 } },
  ]},
  { key: "cyber", name: "💜 Cyberpunk", layers: [
    { type: "color-grade", name: "Neon Tint", enabled: true, params: { color: "rgba(180, 0, 255, 0.2)", intensity: 0.35, blendMode: "screen" } },
    { type: "rain", name: "Neon Rain", enabled: true, params: { count: 200, speed: 2.0, wind: 0.2, size: 3 } },
    { type: "bloom", name: "Neon Glow", enabled: true, params: { intensity: 2.0, threshold: 0.3, smoothing: 0.8 } },
    { type: "glitch", name: "Glitch", enabled: true, params: { strength: 0.05 } },
  ]},
  { key: "enchanted", name: "🧚 Enchanted", layers: [
    { type: "color-grade", name: "Forest Tint", enabled: true, params: { color: "rgba(0, 180, 80, 0.15)", intensity: 0.25, blendMode: "overlay" } },
    { type: "fireflies", name: "Fireflies", enabled: true, params: { count: 120, speed: 0.4, size: 5, color: "#ccff66" } },
    { type: "fog", name: "Forest Fog", enabled: true, params: { count: 30, speed: 0.15, size: 60, opacity: 0.25 } },
    { type: "vignette", name: "Soft Frame", enabled: true, params: { intensity: 0.4, offset: 0.2 } },
  ]},
  { key: "blizzard", name: "🏔️ Blizzard", layers: [
    { type: "snow", name: "Heavy Snow", enabled: true, params: { count: 800, speed: 2.5, wind: 1.5, size: 5 } },
    { type: "fog", name: "White-Out", enabled: true, params: { count: 50, speed: 0.5, size: 80, opacity: 0.5 } },
    { type: "color-grade", name: "Cold Tint", enabled: true, params: { color: "rgba(180, 200, 255, 0.15)", intensity: 0.3, blendMode: "screen" } },
    { type: "bloom", name: "Ice Glow", enabled: true, params: { intensity: 0.6, threshold: 0.7, smoothing: 0.95 } },
  ]},
];

export const DEMO_PRESETS: { key: string, name: string, thumbnail: string, path: string, layers: Omit<EffectLayer, "id">[] }[] = [
  { 
    key: "lake-sunset", name: "Lake Sunset", thumbnail: "/assets/wallpapers/lake_sunset.png", path: "/assets/wallpapers/lake_sunset.png", 
    layers: [
      { type: "liquid-ripple", name: "Lake Water", enabled: true, params: { intensity: 1.0, waveMode: "zone", waveZoneX: 0, waveZoneY: 65, waveZoneW: 100, waveZoneH: 35, waveSpeed: 0.8, waveScale: 6.0, waveStrength: 1.5, autoRipple: false, raindrops: false } }
    ] 
  },
  { 
    key: "rainy-city", name: "Rainy Cyberpunk City", thumbnail: "/assets/wallpapers/rainy_city.png", path: "/assets/wallpapers/rainy_city.png", 
    layers: [
      { type: "rain-on-glass", name: "Window Rain", enabled: true, params: { intensity: 1.5, dropSpeed: 1.2, streakCount: 20, dropletDensity: 30 } },
      { type: "bloom", name: "Neon Glow", enabled: true, params: { intensity: 1.2, threshold: 0.5, smoothing: 0.8 } }
    ] 
  },
  { 
    key: "ocean-storm", name: "Stormy Ocean", thumbnail: "/assets/wallpapers/ocean_storm.png", path: "/assets/wallpapers/ocean_storm.png", 
    layers: [
      { type: "liquid-ripple", name: "Turbulent Water", enabled: true, params: { intensity: 1.5, waveMode: "fullscreen", waveSpeed: 2.0, waveScale: 8.0, waveStrength: 2.5, raindrops: true, rainIntensity: 2.0 } },
      { type: "rain", name: "Heavy Rain", enabled: true, params: { count: 800, speed: 2.5, wind: 1.5, size: 5.0 } },
      { type: "fog", name: "Storm Clouds", enabled: true, params: { count: 40, speed: 0.6, size: 80.0, opacity: 0.4 } }
    ] 
  },
  { 
    key: "forest-godrays", name: "Enchanted Forest", thumbnail: "/assets/wallpapers/forest_godrays.png", path: "/assets/wallpapers/forest_godrays.png", 
    layers: [
      { type: "god-rays", name: "Sunlight Shafts", enabled: true, params: { exposure: 0.8, decay: 0.93, density: 1.2, weight: 0.5, x: 50, y: 30 } },
      { type: "fireflies", name: "Forest Pixies", enabled: true, params: { count: 100, speed: 0.3, size: 4.0, color: "#e8ffb3" } },
      { type: "fog", name: "Morning Mist", enabled: true, params: { count: 30, speed: 0.2, size: 60.0, opacity: 0.2 } }
    ] 
  }
];
