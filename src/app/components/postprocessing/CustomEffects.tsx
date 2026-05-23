import React, { forwardRef, useMemo, useEffect, useRef } from "react";
import * as THREE from "three";
import { Effect } from "postprocessing";
import { useFrame, useThree } from "@react-three/fiber";

// ─────────────────────────────────────────────────────────────
// 1. Advanced Liquid Ripple — click ripples + continuous
//    water surface waves + auto-emitter zone + rain drops
// ─────────────────────────────────────────────────────────────
const rippleFragmentShader = `
uniform float uTime;
uniform vec2 uRipples[16];
uniform float uRippleTimes[16];
uniform int uRippleCount;
uniform float uIntensity;

// Continuous water surface wave uniforms
uniform int uWaveMode;         // 0=off, 1=full screen, 2=zone
uniform vec4 uWaveZone;        // x,y,w,h in UV space (for mode 2)
uniform float uWaveSpeed;
uniform float uWaveScale;
uniform float uWaveStrength;

// Raindrop surface uniforms
uniform int uRainMode;         // 0=off, 1=on
uniform float uRainIntensity;

uniform sampler2D tNormal;     // High quality water normal map

//
// Hash functions for procedural noise
//
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float hash3(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

//
// Smooth noise
//
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

//
// Continuous water surface distortion (caustic-like waves using Normal Map)
//
vec2 waterSurface(vec2 uv, float time) {
  float t = time * uWaveSpeed * 0.05;
  
  // Pan two layers of the normal map in different directions
  vec2 uv1 = uv * (uWaveScale * 0.3) + vec2(t * 0.2, t * 0.3);
  vec2 uv2 = uv * (uWaveScale * 0.4) - vec2(t * 0.15, -t * 0.25);
  
  // The normal map is repeating, so we can just use fract(uv)
  vec3 n1 = texture2D(tNormal, fract(uv1)).rgb * 2.0 - 1.0;
  vec3 n2 = texture2D(tNormal, fract(uv2)).rgb * 2.0 - 1.0;
  
  // Combine normals
  vec3 normal = normalize(n1 + n2);
  
  return normal.xy * 0.015 * uWaveStrength;
}

//
// Raindrop impact ripples — procedural tiled impacts
//
vec2 raindropRipples(vec2 uv, float time) {
  vec2 totalDisp = vec2(0.0);
  float intensity = uRainIntensity;
  
  // Sample normal map to break up the perfect circles of the raindrops
  vec3 surfaceNormal = texture2D(tNormal, fract(uv * 2.0 + time * 0.01)).rgb * 2.0 - 1.0;
  
  // Tile the screen into cells, each cell can have a raindrop
  for (float scale = 1.0; scale <= 2.0; scale += 1.0) {
    vec2 cellSize = vec2(0.12, 0.12) / scale;
    vec2 cell = floor(uv / cellSize);
    
    // Check this cell and 8 neighbors for ripples
    for (int dx = -1; dx <= 1; dx++) {
      for (int dy = -1; dy <= 1; dy++) {
        vec2 neighborCell = cell + vec2(float(dx), float(dy));
        
        // Random drop position within the cell
        vec2 dropUV = (neighborCell + 0.5) * cellSize;
        dropUV += (vec2(hash(neighborCell * 17.3), hash(neighborCell * 31.7)) - 0.5) * cellSize * 0.8;
        
        // Random drop timing — repeats every few seconds
        float period = 1.5 + hash(neighborCell * 53.1) * 2.5;
        float phase = hash(neighborCell * 71.3) * period;
        float dropAge = mod(time + phase, period);
        
        if (dropAge < 1.5) {
          float dist = distance(uv, dropUV);
          
          // Add organic distortion to the distance field so the ring isn't perfectly circular
          dist += surfaceNormal.x * 0.005;
          
          float radius = dropAge * 0.08;
          
          // Concentric ring wave
          float wave = sin((dist - radius) * 120.0) * exp(-dropAge * 3.5);
          float envelope = smoothstep(0.06, 0.0, abs(dist - radius));
          
          // Fade as it expands
          float fade = 1.0 - smoothstep(0.0, 1.0, dropAge);
          
          vec2 dir = normalize(uv - dropUV + 0.0001);
          totalDisp += dir * wave * envelope * fade * 0.015 * intensity;
        }
      }
    }
  }
  
  return totalDisp;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 distortedUV = uv;
  
  // ── Click/auto ripples ──
  for(int i = 0; i < 16; i++) {
    if (i >= uRippleCount) break;
    
    vec2 center = uRipples[i];
    float age = uTime - uRippleTimes[i];
    
    if (age > 0.0 && age < 3.0) {
      float dist = distance(uv, center);
      float radius = age * 0.35;
      
      // Multiple concentric rings for realism
      float wave1 = sin((dist - radius) * 25.0) * exp(-age * 1.2);
      float wave2 = sin((dist - radius) * 50.0) * exp(-age * 2.0) * 0.5;
      float wave = wave1 + wave2;
      
      float envelope = smoothstep(0.18, 0.0, abs(dist - radius));
      
      vec2 dir = normalize(uv - center + 0.001);
      distortedUV += dir * wave * envelope * 0.025 * uIntensity;
    }
  }
  
  // ── Continuous water surface waves ──
  if (uWaveMode == 1) {
    // Full screen water surface
    distortedUV += waterSurface(uv, uTime);
  } else if (uWaveMode == 2) {
    // Zone-limited water surface
    vec2 zoneMin = uWaveZone.xy;
    vec2 zoneMax = uWaveZone.xy + uWaveZone.zw;
    float inZone = step(zoneMin.x, uv.x) * step(uv.x, zoneMax.x) *
                   step(zoneMin.y, uv.y) * step(uv.y, zoneMax.y);
    // Soft edge blend
    float edgeFade = smoothstep(0.0, 0.05, uv.x - zoneMin.x) *
                     smoothstep(0.0, 0.05, zoneMax.x - uv.x) *
                     smoothstep(0.0, 0.05, uv.y - zoneMin.y) *
                     smoothstep(0.0, 0.05, zoneMax.y - uv.y);
    distortedUV += waterSurface(uv, uTime) * edgeFade;
  }
  
  // ── Procedural raindrop ripples ──
  if (uRainMode == 1) {
    distortedUV += raindropRipples(uv, uTime);
  }
  
  // Apply slight refraction color shift for realism
  vec4 colorR = texture2D(inputBuffer, distortedUV + vec2(0.001, 0.0) * uIntensity);
  vec4 colorG = texture2D(inputBuffer, distortedUV);
  vec4 colorB = texture2D(inputBuffer, distortedUV - vec2(0.001, 0.0) * uIntensity);
  
  outputColor = vec4(colorR.r, colorG.g, colorB.b, colorG.a);
}
`;

class LiquidRippleEffectImpl extends Effect {
  constructor() {
    super("LiquidRippleEffect", rippleFragmentShader, {
      uniforms: new Map<string, THREE.Uniform<any>>([
        ["uTime", new THREE.Uniform(0)],
        ["uRipples", new THREE.Uniform(new Array(16).fill(null).map(() => new THREE.Vector2(0, 0)))],
        ["uRippleTimes", new THREE.Uniform(new Float32Array(16))],
        ["uRippleCount", new THREE.Uniform(0)],
        ["uIntensity", new THREE.Uniform(1.0)],
        // Continuous wave
        ["uWaveMode", new THREE.Uniform(0)],
        ["uWaveZone", new THREE.Uniform(new THREE.Vector4(0.2, 0.2, 0.6, 0.3))],
        ["uWaveSpeed", new THREE.Uniform(1.0)],
        ["uWaveScale", new THREE.Uniform(5.0)],
        ["uWaveStrength", new THREE.Uniform(1.0)],
        // Raindrop
        ["uRainMode", new THREE.Uniform(0)],
        ["uRainIntensity", new THREE.Uniform(1.0)],
        ["tNormal", new THREE.Uniform(null)],
      ])
    });
  }
}

interface LiquidRippleProps {
  isOverlay: boolean;
  intensity?: number;
  // Continuous wave
  waveMode?: "off" | "fullscreen" | "zone";
  waveZoneX?: number; waveZoneY?: number; waveZoneW?: number; waveZoneH?: number;
  waveSpeed?: number;
  waveScale?: number;
  waveStrength?: number;
  // Auto-emitter
  autoRipple?: boolean;
  autoInterval?: number; // seconds between auto ripples
  autoZoneX?: number; autoZoneY?: number; autoZoneW?: number; autoZoneH?: number;
  // Raindrop surface
  raindrops?: boolean;
  rainIntensity?: number;
}

export const LiquidRipple = forwardRef(({
  isOverlay,
  intensity = 1.0,
  waveMode = "off",
  waveZoneX = 20, waveZoneY = 60, waveZoneW = 60, waveZoneH = 30,
  waveSpeed = 1.0,
  waveScale = 5.0,
  waveStrength = 1.0,
  autoRipple = false,
  autoInterval = 1.5,
  autoZoneX = 20, autoZoneY = 20, autoZoneW = 60, autoZoneH = 60,
  raindrops = false,
  rainIntensity = 1.0,
}: LiquidRippleProps, ref) => {
  const effect = useMemo(() => new LiquidRippleEffectImpl(), []);
  const ripples = useRef<{x: number, y: number, time: number}[]>([]);
  const clockRef = useRef(0);
  const lastAutoRef = useRef(0);
  const normalMapRef = useRef<THREE.Texture | null>(null);

  // Load the normal map asynchronously so it doesn't suspend the composer
  useEffect(() => {
    new THREE.TextureLoader().load("/assets/textures/waternormals.jpg", (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      normalMapRef.current = tex;
      effect.uniforms.get("tNormal")!.value = tex;
    });
  }, [effect]);
  
  // Click listener for interactive ripples
  useEffect(() => {
    let isMounted = true;
    let unlistenFunctions: Array<() => void> = [];

    const setupIPC = async () => {
      if (!isOverlay) {
        const handleClick = (e: MouseEvent) => {
          const w = window.innerWidth;
          const h = window.innerHeight;
          ripples.current.push({
            x: e.clientX / w,
            y: 1.0 - (e.clientY / h),
            time: clockRef.current
          });
          if (ripples.current.length > 16) ripples.current.shift();
        };
        window.addEventListener("pointerdown", handleClick);
        unlistenFunctions.push(() => window.removeEventListener("pointerdown", handleClick));
        return;
      }

      try {
        const { listen } = await import("@tauri-apps/api/event");
        if (!isMounted) return;
        const unClick = await listen<{x: number, y: number}>("cursor-click", (e) => {
          let payload = e.payload as any;
          if (typeof payload === "string") { try { payload = JSON.parse(payload); } catch(err){} }
          if (!payload || typeof payload.x !== "number") return;
          
          const w = window.innerWidth;
          const h = window.innerHeight;
          const px = payload.x / (window.devicePixelRatio || 1);
          const py = payload.y / (window.devicePixelRatio || 1);

          ripples.current.push({
            x: px / w,
            y: 1.0 - (py / h),
            time: clockRef.current
          });
          if (ripples.current.length > 16) ripples.current.shift();
        });
        unlistenFunctions.push(unClick);
      } catch (e) {
        console.log("Tauri IPC not available for Liquid Ripple");
      }
    };
    setupIPC();
    return () => { isMounted = false; unlistenFunctions.forEach(fn => fn()); };
  }, [isOverlay]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    clockRef.current = time;
    
    // Auto-ripple emitter
    if (autoRipple && time - lastAutoRef.current > autoInterval) {
      lastAutoRef.current = time;
      // Random position within the auto zone (params are 0-100%)
      const zx = (autoZoneX / 100);
      const zy = (autoZoneY / 100);
      const zw = (autoZoneW / 100);
      const zh = (autoZoneH / 100);
      ripples.current.push({
        x: zx + Math.random() * zw,
        y: zy + Math.random() * zh,
        time: time
      });
      if (ripples.current.length > 16) ripples.current.shift();
    }
    
    // Update uniforms
    effect.uniforms.get("uTime")!.value = time;
    effect.uniforms.get("uIntensity")!.value = intensity;
    
    // Wave mode
    const modeMap: Record<string, number> = { off: 0, fullscreen: 1, zone: 2 };
    effect.uniforms.get("uWaveMode")!.value = modeMap[waveMode] || 0;
    effect.uniforms.get("uWaveZone")!.value.set(
      waveZoneX / 100, (100 - waveZoneY - waveZoneH) / 100,
      waveZoneW / 100, waveZoneH / 100
    );
    effect.uniforms.get("uWaveSpeed")!.value = waveSpeed;
    effect.uniforms.get("uWaveScale")!.value = waveScale;
    effect.uniforms.get("uWaveStrength")!.value = waveStrength;
    
    // Raindrop mode
    effect.uniforms.get("uRainMode")!.value = raindrops ? 1 : 0;
    effect.uniforms.get("uRainIntensity")!.value = rainIntensity;
    
    // Prune dead ripples
    ripples.current = ripples.current.filter(r => (time - r.time) < 3.0);
    
    const count = ripples.current.length;
    effect.uniforms.get("uRippleCount")!.value = count;
    
    const posArr = effect.uniforms.get("uRipples")!.value;
    const timeArr = effect.uniforms.get("uRippleTimes")!.value;
    
    for (let i = 0; i < 16; i++) {
      if (i < count) {
        posArr[i].set(ripples.current[i].x, ripples.current[i].y);
        timeArr[i] = ripples.current[i].time;
      }
    }
  });

  return <primitive ref={ref} object={effect} dispose={null} />;
});

// ─────────────────────────────────────────────────────────────
// 2. Volumetric God Rays (Screen Space Light Shafts)
// ─────────────────────────────────────────────────────────────
const godRaysFragmentShader = `
uniform float uExposure;
uniform float uDecay;
uniform float uDensity;
uniform float uWeight;
uniform vec2 uLightPosition;
uniform int uSamples;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 deltaTextCoord = uv - uLightPosition;
  deltaTextCoord *= 1.0 / float(uSamples) * uDensity;
  
  vec2 currentUV = uv;
  vec4 color = inputColor;
  float illuminationDecay = 1.0;
  
  for(int i = 0; i < 100; i++) {
    if (i >= uSamples) break;
    currentUV -= deltaTextCoord;
    currentUV = clamp(currentUV, 0.0, 1.0);
    
    vec4 sampleColor = texture2D(inputBuffer, currentUV);
    float luma = dot(sampleColor.rgb, vec3(0.299, 0.587, 0.114));
    float bright = smoothstep(0.4, 0.8, luma);
    sampleColor *= bright * illuminationDecay * uWeight;
    
    color += sampleColor;
    illuminationDecay *= uDecay;
  }
  
  outputColor = color * uExposure;
}
`;

class GodRaysEffectImpl extends Effect {
  constructor() {
    super("GodRaysEffect", godRaysFragmentShader, {
      uniforms: new Map<string, THREE.Uniform<any>>([
        ["uExposure", new THREE.Uniform(0.6)],
        ["uDecay", new THREE.Uniform(0.95)],
        ["uDensity", new THREE.Uniform(1.0)],
        ["uWeight", new THREE.Uniform(0.4)],
        ["uLightPosition", new THREE.Uniform(new THREE.Vector2(0.5, 0.5))],
        ["uSamples", new THREE.Uniform(60)],
      ])
    });
  }
}

export const ScreenSpaceGodRays = forwardRef(({ params }: { params: any }, ref) => {
  const effect = useMemo(() => new GodRaysEffectImpl(), []);
  
  useFrame(() => {
    effect.uniforms.get("uExposure")!.value = params.exposure || 0.6;
    effect.uniforms.get("uDecay")!.value = params.decay || 0.95;
    effect.uniforms.get("uDensity")!.value = params.density || 1.0;
    effect.uniforms.get("uWeight")!.value = params.weight || 0.4;
    
    const px = (params.x || 50) / 100;
    const py = 1.0 - ((params.y || 50) / 100);
    effect.uniforms.get("uLightPosition")!.value.set(px, py);
  });

  return <primitive ref={ref} object={effect} dispose={null} />;
});

// ─────────────────────────────────────────────────────────────
// 3. Rain-on-Glass — wet surface with streaks and droplets
//    on the wallpaper surface (depth/parallax distortion)
// ─────────────────────────────────────────────────────────────
const rainOnGlassFragmentShader = `
uniform float uTime;
uniform float uIntensity;
uniform float uDropSpeed;
uniform float uStreakCount;
uniform float uDropletDensity;
uniform sampler2D tNormal;

float hash21(vec2 p) {
  p = fract(p * vec2(233.34, 851.73));
  p += dot(p, p + 23.45);
  return fract(p.x * p.y);
}

// Smooth noise for streak paths
float sNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1, 0));
  float c = hash21(i + vec2(0, 1));
  float d = hash21(i + vec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

//
// Raindrop streak — a droplet sliding down the glass
//
float rainStreak(vec2 uv, float id, float time) {
  float speed = uDropSpeed * (0.5 + hash21(vec2(id, 7.7)) * 1.0);
  
  // Horizontal wobble path  
  float wobble = sin(uv.y * 10.0 + id * 43.0 + time * 0.5) * 0.01;
  float xCenter = hash21(vec2(id, 3.3)) + wobble;
  
  // Vertical position — drop slides down, wraps around
  float yStart = fract(time * speed * 0.1 + hash21(vec2(id, 11.1)));
  float yPos = 1.0 - yStart;
  
  // Streak shape — elongated teardrop
  float dx = abs(uv.x - xCenter);
  float dy = uv.y - yPos;
  
  // Only draw below the drop head
  float trail = smoothstep(0.0, 0.15, dy) * smoothstep(0.25, 0.0, dy);
  float width = smoothstep(0.008, 0.0, dx) * trail;
  
  // Add fluid distortion using normal map
  vec3 nMap = texture2D(tNormal, fract(uv * 3.0 + time * 0.05)).rgb * 2.0 - 1.0;
  
  // Drop head (round but deformed by normal map)
  float headDist = length(vec2((uv.x - xCenter) * 3.0, uv.y - yPos) + nMap.xy * 0.015);
  float head = smoothstep(0.02, 0.0, headDist);
  
  return max(width * 0.5, head);
}

//
// Static micro-droplets on the glass surface
//
float microDroplets(vec2 uv, float time) {
  float total = 0.0;
  vec2 gridUV = uv * uDropletDensity;
  vec2 cell = floor(gridUV);
  vec2 f = fract(gridUV);
  
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 cellId = cell + neighbor;
      
      // Random position within cell
      vec2 dropPos = vec2(hash21(cellId * 17.1), hash21(cellId * 31.3));
      
      // Add subtle noise deformation
      vec3 nMap = texture2D(tNormal, fract((f - neighbor - dropPos) * 10.0)).rgb * 2.0 - 1.0;
      
      // Slowly fade in/out
      float life = sin(time * 0.3 + hash21(cellId * 53.7) * 6.28) * 0.5 + 0.5;
      
      float dist = length(f - neighbor - dropPos + nMap.xy * 0.1);
      float radius = 0.05 + hash21(cellId * 71.1) * 0.1;
      
      float drop = smoothstep(radius, radius * 0.3, dist) * life;
      total += drop;
    }
  }
  
  return clamp(total, 0.0, 1.0);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float time = uTime;
  vec2 distortedUV = uv;
  float totalDropIntensity = 0.0;
  
  // Sliding rain streaks
  float streakCount = uStreakCount;
  for (float i = 0.0; i < 30.0; i++) {
    if (i >= streakCount) break;
    float streak = rainStreak(uv, i, time);
    totalDropIntensity += streak;
    
    // Refract the background behind each streak/drop
    vec2 streakNormal = vec2(
      rainStreak(uv + vec2(0.001, 0.0), i, time) - rainStreak(uv - vec2(0.001, 0.0), i, time),
      rainStreak(uv + vec2(0.0, 0.001), i, time) - rainStreak(uv - vec2(0.0, 0.001), i, time)
    );
    distortedUV += streakNormal * 0.05 * uIntensity;
  }
  
  // Micro droplets
  float drops = microDroplets(uv, time);
  totalDropIntensity += drops * 0.3;
  
  // Refract from micro droplets
  vec2 dropNormal = vec2(
    microDroplets(uv + vec2(0.002, 0.0), time) - microDroplets(uv - vec2(0.002, 0.0), time),
    microDroplets(uv + vec2(0.0, 0.002), time) - microDroplets(uv - vec2(0.0, 0.002), time)
  );
  distortedUV += dropNormal * 0.02 * uIntensity;
  
  vec4 refracted = texture2D(inputBuffer, distortedUV);
  
  // Add subtle specular highlight on drops to make them visible
  float specular = totalDropIntensity * 0.15 * uIntensity;
  
  outputColor = vec4(refracted.rgb + specular, refracted.a);
}
`;

class RainOnGlassEffectImpl extends Effect {
  constructor() {
    super("RainOnGlassEffect", rainOnGlassFragmentShader, {
      uniforms: new Map<string, THREE.Uniform<any>>([
        ["uTime", new THREE.Uniform(0)],
        ["uIntensity", new THREE.Uniform(1.0)],
        ["uDropSpeed", new THREE.Uniform(1.0)],
        ["uStreakCount", new THREE.Uniform(15.0)],
        ["uDropletDensity", new THREE.Uniform(20.0)],
        ["tNormal", new THREE.Uniform(null)],
      ])
    });
  }
}

export const RainOnGlass = forwardRef(({ params }: { params: any }, ref) => {
  const effect = useMemo(() => new RainOnGlassEffectImpl(), []);
  const normalMapRef = useRef<THREE.Texture | null>(null);

  // Load normal map
  useEffect(() => {
    new THREE.TextureLoader().load("/assets/textures/waternormals.jpg", (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      normalMapRef.current = tex;
      effect.uniforms.get("tNormal")!.value = tex;
    });
  }, [effect]);
  
  useFrame((state) => {
    effect.uniforms.get("uTime")!.value = state.clock.elapsedTime;
    effect.uniforms.get("uIntensity")!.value = params.intensity || 1.0;
    effect.uniforms.get("uDropSpeed")!.value = params.dropSpeed || 1.0;
    effect.uniforms.get("uStreakCount")!.value = params.streakCount || 15.0;
    effect.uniforms.get("uDropletDensity")!.value = params.dropletDensity || 20.0;
  });

  return <primitive ref={ref} object={effect} dispose={null} />;
});
